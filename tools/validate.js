#!/usr/bin/env node
/**
 * Validador del conjunto de datos. Falla la compilacion si:
 *   - hay identificadores duplicados o referencias colgantes entre entidades
 *   - una entidad publicable no declara fuente
 *   - el simulador de flujo contradice la tabla clinica curada sin una nota
 *     de discrepancia que lo explique
 *
 *   node tools/validate.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulate, compareWithExpected, DIRECTION_LABEL } from '../src/core/flux.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, 'src', 'data');

const read = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
const readDir = (name) => {
  const dir = path.join(DATA, name);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
};

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

const molecules = readDir('molecules');
const enzymes = fs.existsSync(path.join(DATA, 'enzymes.json')) ? read('enzymes.json') : [];
const reactions = fs.existsSync(path.join(DATA, 'reactions.json')) ? read('reactions.json') : [];
const tissues = fs.existsSync(path.join(DATA, 'tissues.json')) ? read('tissues.json') : [];
const conditions = fs.existsSync(path.join(DATA, 'conditions.json')) ? read('conditions.json') : [];
const organs = fs.existsSync(path.join(DATA, 'organs.json')) ? read('organs.json') : [];
const receptors = fs.existsSync(path.join(DATA, 'receptors.json')) ? read('receptors.json') : [];
const interactions = fs.existsSync(path.join(DATA, 'interactions.json')) ? read('interactions.json') : [];
const readings = fs.existsSync(path.join(DATA, 'readings.json')) ? read('readings.json') : [];
const questions = fs.existsSync(path.join(DATA, 'questions.json')) ? read('questions.json') : [];
const labs = fs.existsSync(path.join(DATA, 'labs.json')) ? read('labs.json') : [];
const eligibility = fs.existsSync(path.join(DATA, 'eligibility.json')) ? read('eligibility.json') : [];
const pathway = fs.existsSync(path.join(DATA, 'pathway.json')) ? read('pathway.json') : null;

/* ------------------------------------------------ identificadores unicos --- */

const index = new Map();
const register = (items, label) => {
  for (const item of items) {
    if (!item || !item.id) { fail(`${label}: registro sin identificador`); continue; }
    if (index.has(item.id)) fail(`identificador duplicado: ${item.id}`);
    index.set(item.id, item);
  }
};
register(molecules, 'molecules');
register(enzymes, 'enzymes');
register(reactions, 'reactions');
register(tissues, 'tissues');
register(conditions, 'conditions');
register(organs, 'organs');
register(receptors, 'receptors');
register(interactions, 'interactions');
register(readings, 'readings');
register(questions, 'questions');
register(labs, 'labs');
register(eligibility, 'eligibility');

const must = (id, where) => {
  if (id === null || id === undefined) return;
  if (!index.has(id)) fail(`${where}: referencia colgante a ${id}`);
};

/* ------------------------------------------------- referencias cruzadas --- */

for (const r of reactions) {
  must(r.substrate, r.id); must(r.product, r.id); must(r.enzyme, r.id);
  for (const a of r.altEnzymes || []) must(a, r.id);
  for (const t of r.tissues || []) must(t, r.id);
  if (!r.source || !r.source.length) fail(`${r.id}: sin fuente`);
  for (const s of r.source || []) if (typeof s === 'string') must(s, r.id);
}
for (const t of tissues) {
  for (const e of t.expression || []) must(e.enzyme, t.id);
  for (const m of t.produces || []) must(m, t.id);
  if (organs.length) must(t.organ, t.id);
}
for (const c of conditions) {
  must(c.enzyme, c.id);
  if (c.drug) must(c.drug, c.id);
  for (const b of c.blocks || []) must(b.reaction, c.id);
  for (const lv of c.expectedLevels || []) must(lv.mol, c.id);
  for (const l of c.labs || []) if (labs.length) must(l, c.id);
}
for (const o of organs) {
  for (const t of o.targets || []) {
    must(t.hormone, o.id); must(t.receptor, o.id);
    if (!t.source || !t.source.length) fail(`${o.id}: efecto de ${t.hormone} sin fuente`);
  }
}
for (const rec of receptors) {
  for (const l of rec.ligands || []) must(l.mol, rec.id);
}
for (const i of interactions) { must(i.a, i.id); must(i.b, i.id); }
for (const q of questions) for (const l of q.links || []) must(l, q.id);
if (pathway) for (const entry of pathway.layout || []) must(entry.mol, 'pathway');

/* --------------------------------------------------------------- fuentes --- */

for (const m of molecules) {
  if (!m.source || !m.source.length) fail(`${m.id}: sin fuente`);
  if (!m.conformer) fail(`${m.id}: sin declaracion de conformacion`);
}
for (const e of enzymes) if (!e.source || !e.source.length) fail(`${e.id}: sin fuente`);
for (const c of conditions) if (!c.source || !c.source.length) fail(`${c.id}: sin fuente`);
for (const r of readings) {
  if (!r.citation) fail(`${r.id}: lectura sin cita`);
  if (r.verified !== true) warn(`${r.id}: cita pendiente de comprobacion en linea`);
}

const unverifiedMolecules = molecules.filter((m) => (m.source || []).some((s) => s.verified !== true));
if (unverifiedMolecules.length) {
  warn(`${unverifiedMolecules.length} moleculas con identificador de PubChem pendiente de comprobar`);
}
const without3d = molecules.filter((m) => m.conformer && m.conformer.kind === 'none');
if (without3d.length) warn(`${without3d.length} moleculas sin conformacion 3D: ${without3d.map((m) => m.id).join(', ')}`);

/* --------------------------- coherencia entre el simulador y la clinica --- */

let checked = 0, agreed = 0, overridden = 0;
for (const c of conditions) {
  if (!c.expectedLevels || !c.expectedLevels.length) continue;
  const { ratios } = simulate(reactions, c.blocks);
  const rows = compareWithExpected(c, ratios);
  const byMol = new Map(c.expectedLevels.map((e) => [e.mol, e]));
  for (const row of rows) {
    checked++;
    if (row.agrees === true) { agreed++; continue; }
    const expected = byMol.get(row.mol);
    if (expected && expected.override) { overridden++; continue; }
    fail(`${c.id}: el modelo calcula ${DIRECTION_LABEL[row.computed]} para ${row.mol} y la tabla `
       + `clinica dice ${DIRECTION_LABEL[row.expected]}, sin nota de discrepancia`);
  }
}

/* ----------------------------------------------------------------- salida --- */

const totals = [
  ['moleculas', molecules.length], ['enzimas', enzymes.length], ['reacciones', reactions.length],
  ['tejidos', tissues.length], ['cuadros', conditions.length], ['organos', organs.length],
  ['receptores', receptors.length], ['interacciones', interactions.length],
  ['lecturas', readings.length], ['preguntas', questions.length],
];
console.log('\n  ' + totals.filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(' · '));
console.log(`  simulador frente a tabla clinica: ${agreed}/${checked} coinciden, `
          + `${overridden} con nota de discrepancia`);
for (const w of warnings) console.log('  aviso: ' + w);
if (errors.length) {
  console.error('\n  ERRORES (' + errors.length + '):');
  for (const e of errors) console.error('   ' + e);
  process.exit(1);
}
console.log('  datos coherentes\n');
