#!/usr/bin/env node
/**
 * Verificacion en navegador headless de los dos artefactos compilados.
 * Abre cada ruta, exige cero errores de consola, mide fps donde el modulo
 * expone una escena 3D y guarda una captura por ruta en dist/verify/.
 *
 *   node tools/verify.js [--routes "#/atlas,#/esteroidogenesis/mapa"] [--no-shots]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'verify');
const EXECUTABLE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const args = process.argv.slice(2);
const argValue = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const SHOTS = !args.includes('--no-shots');

const DEFAULT_ROUTES = [
  '#/', '#/esteroidogenesis/mapa', '#/esteroidogenesis/escalas/tis_leydig',
  '#/esteroidogenesis/deficit/cond_def_21oh', '#/esteroidogenesis/recorrido/1',
  '#/atlas', '#/atlas/mol_testosterona', '#/organos', '#/interacciones/mapa',
  '#/interacciones/comparar/mol_testosterona/mol_dihidrotestosterona',
  '#/receptores', '#/ciclo', '#/laboratorio', '#/farmacos', '#/elegibilidad',
  '#/lecturas', '#/autoevaluacion',
];

// El visor de Artifacts envuelve el fragmento; se reproduce aqui con la misma
// politica de seguridad para que un fallo de CSP salga en la verificacion.
const ARTIFACT_CSP = "default-src 'none'; img-src data: blob:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'";

function wrapArtifact(fragment) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${ARTIFACT_CSP}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>:root{color-scheme:light dark}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style>
</head><body>${fragment}</body></html>`;
}

async function measureFps(page) {
  return page.evaluate(async () => {
    const api = window.__atlas;
    if (!api || !api.engine || !api.engine.isActive || !api.engine.isActive()) return null;
    return await api.engine.benchmark(120);
  });
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  const routes = (argValue('--routes') || '').trim()
    ? argValue('--routes').split(',').map((s) => s.trim())
    : DEFAULT_ROUTES;

  const standalonePath = path.join(DIST, 'atlas-esteroide-3d.html');
  const artifactPath = path.join(DIST, 'artifact.html');
  if (!fs.existsSync(standalonePath)) { console.error('Falta dist/atlas-esteroide-3d.html; ejecuta npm run build'); process.exit(1); }

  // El fragmento de Artifact se envuelve en un archivo temporal servido por file://
  const wrappedPath = path.join(OUT, '_artifact-host.html');
  fs.writeFileSync(wrappedPath, wrapArtifact(fs.readFileSync(artifactPath, 'utf8')));

  const browser = await chromium.launch({ executablePath: EXECUTABLE, args: ['--no-sandbox', '--force-device-scale-factor=2'] });
  const report = { generated: new Date().toISOString(), variants: {}, ok: true };

  for (const [variant, file] of [['standalone', standalonePath], ['artifact', wrappedPath]]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const results = [];
    const url = pathToFileURL(file).href;

    for (const route of routes) {
      const errors = [];
      const onConsole = (msg) => { if (msg.type() === 'error') errors.push(msg.text()); };
      const onPageError = (err) => errors.push('pageerror: ' + err.message);
      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      const t0 = Date.now();
      try {
        await page.goto(url + route, { waitUntil: 'load' });
        await page.evaluate((r) => { if (location.hash !== r) location.hash = r; }, route);
        await page.waitForFunction(() => window.__atlas && window.__atlas.ready === true, { timeout: 15000 });
        await page.waitForTimeout(450);
        const slug = route.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'home';
        if (SHOTS && variant === 'standalone') {
          await page.evaluate(() => { if (window.__atlas && window.__atlas.engine) window.__atlas.engine.autoSpin = false; });
          await page.waitForTimeout(120);
          await page.screenshot({ path: path.join(OUT, `${slug}.png`), scale: 'css' });
        }
        const fps = await measureFps(page);
        const title = await page.evaluate(() => (window.__atlas && window.__atlas.routeTitle) || document.title);
        results.push({ route, title, ms: Date.now() - t0, fps, errors });
        if (errors.length) report.ok = false;
      } catch (err) {
        results.push({ route, ms: Date.now() - t0, fatal: err.message, errors });
        report.ok = false;
      }
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
    }
    report.variants[variant] = results;
    await context.close();
  }
  await browser.close();

  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));

  let bad = 0;
  for (const [variant, results] of Object.entries(report.variants)) {
    console.log(`\n  ${variant}`);
    for (const r of results) {
      const fps = r.fps ? `  ${r.fps.fps.toFixed(0)} fps / ${r.fps.ms.toFixed(1)} ms / ${r.fps.primitives} prim` : '';
      const state = r.fatal ? 'FATAL ' + r.fatal : (r.errors.length ? `${r.errors.length} error(es): ${r.errors[0].slice(0, 120)}` : 'ok');
      if (r.fatal || r.errors.length) bad++;
      console.log(`    ${r.route.padEnd(52)} ${String(r.ms).padStart(5)} ms ${fps.padEnd(34)} ${state}`);
    }
  }
  console.log(`\n  informe: ${path.relative(ROOT, path.join(OUT, 'report.json'))}`);
  if (bad) { console.error(`  ${bad} ruta(s) con problemas`); process.exit(1); }
  console.log('  verificacion en verde');
}

run().catch((err) => { console.error(err); process.exit(1); });
