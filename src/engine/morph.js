import { kabsch, applyKabsch } from './math.js';
import { elementColor } from './molecule.js';
import { token } from '../core/theme.js';

/** Transformacion animada de sustrato a producto.
 *
 *  Los atomos que la reaccion conserva se interpolan tras superponer producto
 *  sobre sustrato con Kabsch: el nucleo esteroide se queda quieto y solo se
 *  mueve lo que la enzima cambia. Los que desaparecen se encogen y se apagan;
 *  los que aparecen crecen desde su vecino. Solo se representan atomos pesados:
 *  los hidrogenos no tienen correspondencia fiable entre las dos moleculas.
 */
export function prepareMorph(subRecord, prodRecord, atomMap) {
  if (!atomMap || !atomMap.pairs) return null;
  const subXyz = subRecord.atoms.xyz, prodXyz = prodRecord.atoms.xyz;
  if (!subXyz.length || !prodXyz.length) return null;

  const pairs = atomMap.pairs;
  const mobile = new Float64Array(pairs.length * 3);
  const target = new Float64Array(pairs.length * 3);
  for (let k = 0; k < pairs.length; k++) {
    const [i, j] = pairs[k];
    target[k * 3] = subXyz[i * 3] / 1000;
    target[k * 3 + 1] = subXyz[i * 3 + 1] / 1000;
    target[k * 3 + 2] = subXyz[i * 3 + 2] / 1000;
    mobile[k * 3] = prodXyz[j * 3] / 1000;
    mobile[k * 3 + 1] = prodXyz[j * 3 + 1] / 1000;
    mobile[k * 3 + 2] = prodXyz[j * 3 + 2] / 1000;
  }
  const fit = kabsch(mobile, target);
  const prodAligned = new Float64Array(prodXyz.length);
  for (let i = 0; i < prodXyz.length; i++) prodAligned[i] = prodXyz[i] / 1000;
  applyKabsch(fit, prodAligned, prodAligned);

  const pairFor = new Map(pairs);
  const subHeavy = [];
  for (let i = 0; i < subRecord.atoms.el.length; i++) if (subRecord.atoms.el[i] !== 'H') subHeavy.push(i);
  const prodHeavy = [];
  for (let j = 0; j < prodRecord.atoms.el.length; j++) if (prodRecord.atoms.el[j] !== 'H') prodHeavy.push(j);
  const matchedProd = new Set(pairs.map((p) => p[1]));

  const entries = [];
  const subToEntry = new Map();
  const prodToEntry = new Map();

  for (const i of subHeavy) {
    const j = pairFor.has(i) ? pairFor.get(i) : null;
    const entry = {
      el: subRecord.atoms.el[i],
      from: [subXyz[i * 3] / 1000, subXyz[i * 3 + 1] / 1000, subXyz[i * 3 + 2] / 1000],
      to: j === null ? null : [prodAligned[j * 3], prodAligned[j * 3 + 1], prodAligned[j * 3 + 2]],
      kind: j === null ? 'removed' : 'kept',
      subIndex: i, prodIndex: j,
      number: (subRecord.atoms.n && subRecord.atoms.n[i]) || null,
    };
    subToEntry.set(i, entries.length);
    if (j !== null) prodToEntry.set(j, entries.length);
    entries.push(entry);
  }
  for (const j of prodHeavy) {
    if (matchedProd.has(j)) continue;
    entries.push({
      el: prodRecord.atoms.el[j],
      from: null,
      to: [prodAligned[j * 3], prodAligned[j * 3 + 1], prodAligned[j * 3 + 2]],
      kind: 'added', subIndex: null, prodIndex: j,
      number: (prodRecord.atoms.n && prodRecord.atoms.n[j]) || null,
    });
    prodToEntry.set(j, entries.length - 1);
  }

  // Los atomos que entran arrancan desde su vecino conservado, no desde la nada.
  for (const entry of entries) {
    if (entry.kind !== 'added') continue;
    const anchor = neighborAnchor(prodRecord, entry.prodIndex, prodToEntry, entries);
    entry.from = anchor || entry.to;
  }
  for (const entry of entries) {
    if (entry.kind !== 'removed') continue;
    const anchor = neighborAnchor(subRecord, entry.subIndex, subToEntry, entries, 'from');
    entry.to = anchor || entry.from;
  }

  const bonds = { a: [], b: [], order: [], phase: [] };
  addBonds(subRecord, subToEntry, bonds, 'sub');
  addBonds(prodRecord, prodToEntry, bonds, 'prod');

  return { entries, bonds, substrate: subRecord, product: prodRecord, atomMap };
}

function neighborAnchor(record, index, indexToEntry, entries, field) {
  const { a, b } = record.bonds;
  for (let k = 0; k < a.length; k++) {
    let other = null;
    if (a[k] === index) other = b[k];
    else if (b[k] === index) other = a[k];
    if (other === null || record.atoms.el[other] === 'H') continue;
    const entryIndex = indexToEntry.get(other);
    if (entryIndex === undefined) continue;
    const entry = entries[entryIndex];
    const p = field === 'from' ? entry.from : entry.to;
    if (p) return p.slice();
  }
  return null;
}

function addBonds(record, indexToEntry, bonds, phase) {
  const { a, b, order } = record.bonds;
  const seen = new Set();
  for (let k = 0; k < a.length; k++) {
    if (record.atoms.el[a[k]] === 'H' || record.atoms.el[b[k]] === 'H') continue;
    const ia = indexToEntry.get(a[k]);
    const ib = indexToEntry.get(b[k]);
    if (ia === undefined || ib === undefined) continue;
    const key = Math.min(ia, ib) + ':' + Math.max(ia, ib);
    const existing = bonds.a.findIndex((x, i) => (Math.min(bonds.a[i], bonds.b[i]) + ':' + Math.max(bonds.a[i], bonds.b[i])) === key);
    if (existing >= 0) {
      if (bonds.phase[existing] !== phase) bonds.phase[existing] = 'both';
      if (phase === 'prod') bonds.order[existing] = order[k];
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    bonds.a.push(ia); bonds.b.push(ib); bonds.order.push(order[k]); bonds.phase.push(phase);
  }
}

const RADIUS = { H: 1.20, C: 1.70, N: 1.55, O: 1.52, S: 1.80, F: 1.47, Cl: 1.75 };

/** Estructura lista para el motor. Llamar a applyMorph para situarla en un t. */
export function morphNodeData(morph, options) {
  const o = options || {};
  const n = morph.entries.length;
  const data = {
    xyz: new Float32Array(n * 3),
    radii: new Float32Array(n),
    colors: new Array(n),
    isH: new Uint8Array(n),
    atomAlpha: new Float32Array(n),
    bonds: {
      a: Uint16Array.from(morph.bonds.a),
      b: Uint16Array.from(morph.bonds.b),
      order: Uint8Array.from(morph.bonds.order),
    },
    bondPhase: morph.bonds.phase,
    representation: o.representation || 'ballstick',
    hydrogens: false,
    morph,
  };
  for (let i = 0; i < n; i++) {
    data.radii[i] = RADIUS[morph.entries[i].el] || 1.7;
    data.colors[i] = elementColor(morph.entries[i].el);
  }
  applyMorph(data, 0);
  return data;
}

/** Coloreado por cambio: rojo lo que sale, verde lo que entra. */
export function morphChangeColors(data) {
  const removed = token('up') || '#c62828';
  const added = token('ring-c') || '#2e9e5b';
  const kept = token('ink-3') || '#888';
  return data.morph.entries.map((e) =>
    e.kind === 'removed' ? removed : e.kind === 'added' ? added : kept);
}

export function applyMorph(data, t) {
  const entries = data.morph.entries;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const from = e.from, to = e.to;
    data.xyz[i * 3] = from[0] + (to[0] - from[0]) * t;
    data.xyz[i * 3 + 1] = from[1] + (to[1] - from[1]) * t;
    data.xyz[i * 3 + 2] = from[2] + (to[2] - from[2]) * t;
    if (e.kind === 'removed') data.atomAlpha[i] = Math.max(0, 1 - t * 1.6);
    else if (e.kind === 'added') data.atomAlpha[i] = Math.max(0, (t - 0.35) / 0.65);
    else data.atomAlpha[i] = 1;
  }
  // Un enlace vive mientras vivan sus dos atomos.
  data.bondAlpha = data.bondAlpha || new Float32Array(data.bonds.a.length);
  for (let k = 0; k < data.bonds.a.length; k++) {
    const phase = data.bondPhase[k];
    const alphaA = data.atomAlpha[data.bonds.a[k]];
    const alphaB = data.atomAlpha[data.bonds.b[k]];
    let alpha = Math.min(alphaA, alphaB);
    if (phase === 'sub') alpha *= Math.max(0, 1 - t * 1.4);
    else if (phase === 'prod') alpha *= Math.max(0, (t - 0.3) / 0.7);
    data.bondAlpha[k] = alpha;
  }
  return data;
}
