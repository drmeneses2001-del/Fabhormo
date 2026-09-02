import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA = path.join(ROOT, 'src', 'data');
const molecules = fs.readdirSync(path.join(DATA, 'molecules')).filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(DATA, 'molecules', f), 'utf8')));

test('cada molecula declara formula, clave InChI y procedencia', () => {
  for (const m of molecules) {
    assert.match(m.formula, /^[A-Z]/, `${m.id} sin formula`);
    assert.match(m.inchikey, /^[A-Z]{14}-[A-Z]{10}-[A-Z]$/, `${m.id} con clave InChI mal formada`);
    assert.ok(m.source && m.source.length, `${m.id} sin fuente`);
    assert.ok(m.conformer && m.conformer.kind, `${m.id} sin declaracion de conformacion`);
  }
});

test('las coordenadas y los enlaces son coherentes con la lista de atomos', () => {
  for (const m of molecules) {
    const n = m.atoms.el.length;
    if (m.conformer.kind === 'none') { assert.equal(m.atoms.xyz.length, 0); continue; }
    assert.equal(m.atoms.xyz.length, n * 3, `${m.id}: coordenadas incompletas`);
    assert.equal(m.atoms.n.length, n, `${m.id}: numeracion incompleta`);
    for (let i = 0; i < m.bonds.a.length; i++) {
      assert.ok(m.bonds.a[i] < n && m.bonds.b[i] < n, `${m.id}: enlace fuera de rango`);
    }
  }
});

test('el nucleo esteroide anotado tiene los cuatro anillos completos', () => {
  const esteroides = molecules.filter((m) => m.steroid);
  assert.ok(esteroides.length > 50, 'deberia haber esteroides anotados');
  for (const m of esteroides) {
    const { A, B, C, D } = m.steroid.rings;
    assert.equal(A.length, 6, `${m.id}: anillo A incompleto`);
    assert.equal(B.length, 6, `${m.id}: anillo B incompleto`);
    assert.equal(C.length, 6, `${m.id}: anillo C incompleto`);
    assert.equal(D.length, 5, `${m.id}: anillo D incompleto`);
  }
});

test('los estrogenos tienen anillo A aromatico y carecen de C19', () => {
  for (const id of ['mol:estradiol', 'mol:estrona', 'mol:estriol']) {
    const m = molecules.find((x) => x.id === id);
    assert.ok(m.steroid.aromaticA, `${id} deberia tener el anillo A aromatico`);
    assert.ok(m.steroid.nor19, `${id} no deberia tener carbono 19`);
  }
});

test('la testosterona conserva su carbono 19 y no es aromatica', () => {
  const t = molecules.find((m) => m.id === 'mol:testosterona');
  assert.equal(t.steroid.aromaticA, false);
  assert.equal(t.steroid.nor19, false);
  assert.equal(t.formula, 'C19H28O2');
});

test('la escision de la cadena lateral retira seis carbonos', () => {
  const reactions = JSON.parse(fs.readFileSync(path.join(DATA, 'reactions.json'), 'utf8'));
  const rx = reactions.find((r) => r.id === 'rx:col_preg');
  const col = molecules.find((m) => m.id === 'mol:colesterol');
  const salen = rx.atomMap.removed.filter((i) => col.atoms.el[i] === 'C');
  assert.equal(salen.length, 6, 'CYP11A1 corta entre C20 y C22 y se lleva seis carbonos');
});

test('la aromatizacion elimina un carbono', () => {
  const reactions = JSON.parse(fs.readFileSync(path.join(DATA, 'reactions.json'), 'utf8'));
  const rx = reactions.find((r) => r.id === 'rx:t_e2');
  const t = molecules.find((m) => m.id === 'mol:testosterona');
  const salen = rx.atomMap.removed.filter((i) => t.atoms.el[i] === 'C');
  assert.equal(salen.length, 1, 'la aromatasa se lleva el carbono 19');
});
