/** Modelo cualitativo de flujo sobre el grafo de la via.
 *
 *  No pretende reproducir concentraciones: reparte un flujo constante desde el
 *  colesterol y calcula, para cada metabolito, un nivel relativo de estado
 *  estacionario. Un nodo sube cuando pierde salidas (el bloqueo lo represa) y
 *  baja cuando pierde entradas. El resultado se compara siempre contra el mismo
 *  calculo sin bloqueos, de modo que lo que se muestra es un cociente.
 *
 *  Se usa igual en el navegador y en el validador de compilacion: sin DOM.
 */

const CLEARANCE = 0.55;   // aclaramiento inespecifico de cada metabolito
const ITERATIONS = 80;
const SOURCE = 'mol:colesterol';

export function buildGraph(reactions) {
  const incoming = new Map();
  const outgoing = new Map();
  const nodes = new Set();
  for (const r of reactions) {
    nodes.add(r.substrate);
    nodes.add(r.product);
    if (!incoming.has(r.product)) incoming.set(r.product, []);
    if (!outgoing.has(r.substrate)) outgoing.set(r.substrate, []);
    incoming.get(r.product).push(r);
    outgoing.get(r.substrate).push(r);
    if (r.reversible) {
      if (!incoming.has(r.substrate)) incoming.set(r.substrate, []);
      if (!outgoing.has(r.product)) outgoing.set(r.product, []);
      incoming.get(r.substrate).push({ ...r, substrate: r.product, product: r.substrate, _reverse: true });
      outgoing.get(r.product).push({ ...r, substrate: r.product, product: r.substrate, _reverse: true });
    }
  }
  return { nodes, incoming, outgoing };
}

function activityOf(reaction, activities) {
  const a = activities.get(reaction.id);
  return (a === undefined ? 1 : a) * (reaction.weight === undefined ? 1 : reaction.weight);
}

/** Niveles relativos de estado estacionario, con el colesterol como fuente. */
export function computeLevels(graph, activities, options) {
  const o = options || {};
  const drive = o.drive || 1;
  const levels = new Map();
  for (const n of graph.nodes) levels.set(n, 0);
  levels.set(SOURCE, drive);

  for (let iter = 0; iter < ITERATIONS; iter++) {
    for (const node of graph.nodes) {
      if (node === SOURCE) { levels.set(node, drive); continue; }
      let inflow = 0;
      for (const r of graph.incoming.get(node) || []) {
        inflow += levels.get(r.substrate) * activityOf(r, activities) * (r._reverse ? 0.3 : 1);
      }
      let outCap = 0;
      for (const r of graph.outgoing.get(node) || []) {
        outCap += activityOf(r, activities) * (r._reverse ? 0.3 : 1);
      }
      levels.set(node, inflow / (outCap + CLEARANCE));
    }
  }
  return levels;
}

/**
 * Cociente de cada metabolito frente al mismo calculo sin bloqueos.
 * Incluye la respuesta del eje: si el cortisol cae, la ACTH sube y el estimulo
 * sobre la celula esteroidogenica aumenta, que es lo que explica la hiperplasia
 * y el acumulo de precursores.
 */
export function simulate(reactions, blocks, options) {
  const o = options || {};
  const graph = buildGraph(reactions);
  const baseline = computeLevels(graph, new Map(), { drive: 1 });

  const activities = new Map();
  for (const b of blocks || []) activities.set(b.reaction, b.activity);

  let drive = 1;
  let levels = computeLevels(graph, activities, { drive });
  let feedback = 1;
  if (o.feedback !== false) {
    for (let round = 0; round < 12; round++) {
      const cortisol = ratioOf(levels, baseline, 'mol:cortisol');
      // La ACTH sube en proporcion al deficit de cortisol, con techo fisiologico.
      const target = Math.min(8, Math.max(0.25, drive / Math.max(cortisol, 0.02)));
      if (Math.abs(target - drive) < 0.01) break;
      drive = drive + (target - drive) * 0.7;
      levels = computeLevels(graph, activities, { drive });
    }
    feedback = drive;
  }

  const ratios = new Map();
  for (const node of graph.nodes) ratios.set(node, ratioOf(levels, baseline, node));
  return { ratios, levels, baseline, feedback, graph };
}

function ratioOf(levels, baseline, node) {
  const base = baseline.get(node) || 0;
  const value = levels.get(node) || 0;
  if (base < 1e-9) return value < 1e-9 ? 1 : 2;
  return value / base;
}

export const THRESHOLDS = { up2: 2.0, up: 1.25, down: 0.75, down2: 0.4 };

export function direction(ratio) {
  if (ratio >= THRESHOLDS.up2) return 'up2';
  if (ratio >= THRESHOLDS.up) return 'up';
  if (ratio <= THRESHOLDS.down2) return 'down2';
  if (ratio <= THRESHOLDS.down) return 'down';
  return 'flat';
}

export const DIRECTION_LABEL = {
  up2: '↑↑', up: '↑', flat: '=', down: '↓', down2: '↓↓',
};

/** Compara lo que calcula el modelo con la tabla curada del cuadro clinico. */
export function compareWithExpected(condition, ratios) {
  const rows = [];
  for (const expected of condition.expectedLevels || []) {
    const ratio = ratios.get(expected.mol);
    const computed = ratio === undefined ? null : direction(ratio);
    const agrees = computed === null ? null : sameSign(computed, expected.direction);
    rows.push({ mol: expected.mol, expected: expected.direction, computed, ratio, agrees,
                marker: expected.marker });
  }
  return rows;
}

function sameSign(a, b) {
  const sign = (d) => (d === 'up' || d === 'up2' ? 1 : d === 'down' || d === 'down2' ? -1 : 0);
  return sign(a) === sign(b);
}
