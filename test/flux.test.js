import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulate, direction, compareWithExpected, buildGraph, computeLevels } from '../src/core/flux.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', n), 'utf8'));
const reactions = read('reactions.json');
const conditions = read('conditions.json');

test('sin bloqueos todos los metabolitos quedan en su nivel basal', () => {
  const { ratios } = simulate(reactions, []);
  for (const [mol, ratio] of ratios) {
    assert.ok(Math.abs(ratio - 1) < 1e-6, `${mol} deberia quedar en 1 y vale ${ratio}`);
  }
});

test('bloquear la 21-hidroxilasa acumula 17-hidroxiprogesterona y hunde el cortisol', () => {
  const cond = conditions.find((c) => c.id === 'cond:def_21oh');
  const { ratios } = simulate(reactions, cond.blocks);
  assert.equal(direction(ratios.get('mol:17oh_progesterona')), 'up2');
  assert.equal(direction(ratios.get('mol:cortisol')), 'down2');
  assert.equal(direction(ratios.get('mol:aldosterona')), 'down2');
});

test('el eje responde al deficit de cortisol aumentando el estimulo', () => {
  const cond = conditions.find((c) => c.id === 'cond:def_21oh');
  const { feedback } = simulate(reactions, cond.blocks);
  assert.ok(feedback > 2, 'la ACTH deberia subir de forma marcada');
  const sinEje = simulate(reactions, cond.blocks, { feedback: false });
  assert.equal(sinEje.feedback, 1);
});

test('todas las discrepancias con la tabla clinica estan justificadas', () => {
  for (const cond of conditions) {
    if (!cond.expectedLevels || !cond.expectedLevels.length) continue;
    const { ratios } = simulate(reactions, cond.blocks);
    const byMol = new Map(cond.expectedLevels.map((e) => [e.mol, e]));
    for (const row of compareWithExpected(cond, ratios)) {
      if (row.agrees === true) continue;
      const expected = byMol.get(row.mol);
      assert.ok(expected && expected.override,
        `${cond.id}: ${row.mol} discrepa sin nota que lo explique`);
    }
  }
});

test('un bloqueo parcial produce un efecto menor que uno completo', () => {
  const cond = conditions.find((c) => c.id === 'cond:def_21oh');
  const parcial = cond.blocks.map((b) => ({ reaction: b.reaction, activity: 0.5 }));
  const completo = simulate(reactions, cond.blocks).ratios.get('mol:cortisol');
  const medio = simulate(reactions, parcial).ratios.get('mol:cortisol');
  assert.ok(medio > completo, 'con actividad residual deberia quedar mas cortisol');
});

test('el grafo incluye las reacciones reversibles en los dos sentidos', () => {
  const graph = buildGraph(reactions);
  const reversible = reactions.find((r) => r.reversible);
  assert.ok(graph.outgoing.get(reversible.product).some((r) => r.product === reversible.substrate));
});
