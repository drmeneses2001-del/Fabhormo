#!/usr/bin/env node
/** Desglose de tamano del artefacto compilado frente al presupuesto (docs, seccion 2.3). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const report = path.join(ROOT, 'dist', 'size-report.json');
if (!fs.existsSync(report)) { console.error('Ejecuta npm run build primero'); process.exit(1); }
const r = JSON.parse(fs.readFileSync(report, 'utf8'));
const kb = (n) => (n / 1024).toFixed(1).padStart(9) + ' KB';
console.log(`\n  Atlas Esteroide 3D — tamano (${r.bundler}, minificado: ${r.minify})\n`);
for (const [k, v] of Object.entries(r.breakdown)) console.log(`  ${k.padEnd(18)}${kb(v)}`);
console.log(`  ${'TOTAL'.padEnd(18)}${kb(r.bytes)}   objetivo ${kb(r.target).trim()}   maximo ${kb(r.budget).trim()}`);
console.log(`  uso del presupuesto: ${(r.bytes / r.budget * 100).toFixed(1)} %\n`);
