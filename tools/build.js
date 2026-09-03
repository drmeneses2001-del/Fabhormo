#!/usr/bin/env node
/**
 * Compila el atlas a dos artefactos autonomos:
 *   dist/atlas-esteroide-3d.html  -> se abre con doble clic desde file://
 *   dist/artifact.html            -> fragmento publicable como Artifact
 *
 * No hay peticiones de red en tiempo de ejecucion: fuentes, iconos, siluetas y
 * datos moleculares viajan incrustados. Uso:
 *   node tools/build.js [--lite] [--no-minify]
 *   --lite  usa el empaquetador propio sin dependencias en vez de esbuild
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleLite } from './bundle-lite.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const args = process.argv.slice(2);
const USE_LITE = args.includes('--lite');
const MINIFY = !args.includes('--no-minify');

const BUDGET_BYTES = 4.5 * 1024 * 1024;
const BUDGET_TARGET = 3.5 * 1024 * 1024;

const read = (p) => fs.readFileSync(p, 'utf8');
const exists = (p) => fs.existsSync(p);
const kb = (n) => (n / 1024).toFixed(1) + ' KB';

/* ------------------------------------------------------------------ CSS --- */

const CSS_ORDER = ['tokens.css', 'base.css', 'shell.css', 'components.css'];

function collectCss() {
  const dir = path.join(SRC, 'styles');
  const parts = [];
  for (const name of CSS_ORDER) {
    const p = path.join(dir, name);
    if (exists(p)) parts.push(`/* ${name} */\n` + read(p));
  }
  const modDir = path.join(dir, 'modules');
  if (exists(modDir)) {
    for (const name of fs.readdirSync(modDir).sort()) {
      if (name.endsWith('.css')) parts.push(`/* modules/${name} */\n` + read(path.join(modDir, name)));
    }
  }
  return parts.join('\n\n');
}

function fontCss() {
  const manifestPath = path.join(ROOT, 'raw', 'fonts', 'manifest.json');
  if (!exists(manifestPath)) {
    console.warn('  aviso: no hay subconjuntos de fuentes (ejecuta tools/subset-fonts.py)');
    return '';
  }
  const manifest = JSON.parse(read(manifestPath));
  return manifest.map((f) => {
    const b64 = fs.readFileSync(path.join(ROOT, f.file)).toString('base64');
    return `@font-face{font-family:'${f.family}';font-style:normal;font-weight:${f.weight};` +
           `font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
  }).join('\n');
}

/* ----------------------------------------------------------------- datos --- */

// Un directorio bajo src/data se vuelve un array ordenado por nombre de archivo;
// un .json suelto se vuelve una clave con su contenido.
function collectData() {
  const dir = path.join(SRC, 'data');
  const out = {};
  if (!exists(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.isDirectory()) {
      const files = fs.readdirSync(path.join(dir, entry.name)).filter((f) => f.endsWith('.json')).sort();
      out[entry.name] = files.map((f) => JSON.parse(read(path.join(dir, entry.name, f))));
    } else if (entry.name.endsWith('.json')) {
      out[entry.name.replace(/\.json$/, '')] = JSON.parse(read(path.join(dir, entry.name)));
    }
  }
  return out;
}

function collectIcons() {
  const dir = path.join(SRC, 'assets', 'icons');
  if (!exists(dir)) return '';
  const symbols = fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).sort().map((f) => {
    const id = 'i-' + f.replace(/\.svg$/, '');
    const svg = read(path.join(dir, f));
    const viewBox = (svg.match(/viewBox="([^"]+)"/) || [, '0 0 24 24'])[1];
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').trim();
    return `<symbol id="${id}" viewBox="${viewBox}">${inner}</symbol>`;
  });
  if (!symbols.length) return '';
  return `<svg class="a-iconsprite" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">${symbols.join('')}</svg>`;
}

/* ------------------------------------------------------------ empaquetado --- */

async function bundleJs() {
  const entry = path.join(SRC, 'main.js');
  if (USE_LITE) return bundleLite(entry, { minify: MINIFY });
  let esbuild;
  try {
    esbuild = await import('esbuild');
  } catch {
    console.warn('  aviso: esbuild no disponible, se usa el empaquetador propio');
    return bundleLite(entry, { minify: MINIFY });
  }
  const result = await esbuild.build({
    entryPoints: [entry], bundle: true, write: false, format: 'iife',
    target: ['es2020'], minify: MINIFY, legalComments: 'none', charset: 'utf8',
    logLevel: 'warning',
  });
  return result.outputFiles[0].text;
}

async function minifyCss(css) {
  if (!MINIFY) return css;
  try {
    const esbuild = await import('esbuild');
    const r = await esbuild.transform(css, { loader: 'css', minify: true });
    return r.code;
  } catch {
    return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '\n').trim();
  }
}

/* ------------------------------------------------------------- plantillas --- */

const TITLE = 'Atlas Esteroide 3D';
const DESC = 'Atlas interactivo de hormonas esteroideas sexuales, esteroidogenesis y organos blanco';
// La variante de doble clic declara la misma politica que el visor de Artifacts
// para que lo que funcione en una funcione igual en la otra.
const CSP = "default-src 'none'; img-src data: blob:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'";

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

function shellHtml() {
  const p = path.join(SRC, 'shell.html');
  return exists(p) ? read(p) : '<div id="app"></div>';
}

function standalone({ css, js, dataJs, icons }) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="description" content="${DESC}">
<title>${TITLE}</title>
<style>${css}</style>
</head>
<body>
${icons}
${shellHtml()}
<script>window.ATLAS_TARGET="standalone";${dataJs}</script>
<script>${js}</script>
</body>
</html>
`;
}

function artifact({ css, js, dataJs, icons }) {
  return `<title>${TITLE}</title>
<style>${css}</style>
${icons}
${shellHtml()}
<script>window.ATLAS_TARGET="artifact";${dataJs}</script>
<script>${js}</script>
`;
}

/* ------------------------------------------------------------------ main --- */

async function main() {
  fs.mkdirSync(DIST, { recursive: true });
  const t0 = Date.now();

  // La compilacion no continua con datos incoherentes.
  if (!args.includes('--skip-validate')) {
    const { execFileSync } = await import('node:child_process');
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'validate.js')], { stdio: 'inherit' });
  }

  const js = await bundleJs();
  const cssRaw = fontCss() + '\n' + collectCss();
  const css = await minifyCss(cssRaw);
  const data = collectData();
  const dataJs = 'window.ATLAS_DATA=' + safeJson(data) + ';';
  const icons = collectIcons();

  const outStandalone = standalone({ css, js, dataJs, icons });
  const outArtifact = artifact({ css, js, dataJs, icons });
  const pStandalone = path.join(DIST, 'atlas-esteroide-3d.html');
  const pArtifact = path.join(DIST, 'artifact.html');
  fs.writeFileSync(pStandalone, outStandalone);
  fs.writeFileSync(pArtifact, outArtifact);

  const size = Buffer.byteLength(outStandalone);
  const breakdown = [
    ['codigo JS', Buffer.byteLength(js)],
    ['CSS + fuentes', Buffer.byteLength(css)],
    ['datos', Buffer.byteLength(dataJs)],
    ['iconos + shell', Buffer.byteLength(icons + shellHtml())],
  ];
  console.log(`\n  ${path.relative(ROOT, pStandalone)}  ${kb(size)}`);
  console.log(`  ${path.relative(ROOT, pArtifact)}  ${kb(Buffer.byteLength(outArtifact))}`);
  for (const [label, n] of breakdown) console.log(`      ${label.padEnd(16)} ${kb(n)}`);
  console.log(`  empaquetador: ${USE_LITE ? 'bundle-lite' : 'esbuild'}   minificado: ${MINIFY}   ${Date.now() - t0} ms`);

  const report = {
    generated: new Date().toISOString(), bundler: USE_LITE ? 'lite' : 'esbuild',
    minify: MINIFY, bytes: size, budget: BUDGET_BYTES, target: BUDGET_TARGET,
    breakdown: Object.fromEntries(breakdown),
  };
  fs.writeFileSync(path.join(DIST, 'size-report.json'), JSON.stringify(report, null, 2));

  if (size > BUDGET_BYTES) {
    console.error(`\n  ERROR: ${kb(size)} supera el presupuesto de ${kb(BUDGET_BYTES)}`);
    process.exit(1);
  }
  if (size > BUDGET_TARGET) console.warn(`  aviso: por encima del objetivo de ${kb(BUDGET_TARGET)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
