import { token } from '../core/theme.js';

/** Radios de Van der Waals en angstrom (Bondi, J Phys Chem 1964;68:441-451;
 *  valores de uso estandar en visualizacion molecular). */
export const VDW = {
  H: 1.20, C: 1.70, N: 1.55, O: 1.52, F: 1.47, P: 1.80, S: 1.80,
  Cl: 1.75, Br: 1.85, I: 1.98, Na: 2.27, K: 2.75, Mg: 1.73, Ca: 2.31,
};

const ELEMENT_TOKEN = {
  H: 'el-h', C: 'el-c', N: 'el-n', O: 'el-o', S: 'el-s', P: 'el-p',
  F: 'el-f', Cl: 'el-cl', Br: 'el-br', I: 'el-i',
};

const FAMILY_TOKEN = {
  androgeno: 'fam-androgeno', estrogeno: 'fam-estrogeno', gestageno: 'fam-gestageno',
  progestageno_sintetico: 'fam-gestageno', glucocorticoide: 'fam-gluco',
  mineralocorticoide: 'fam-minera', precursor: 'fam-precursor',
  antiandrogeno: 'fam-farmaco', antiestrogeno_serm: 'fam-farmaco', sprm: 'fam-farmaco',
  inhibidor_enzimatico: 'fam-farmaco', anabolizante: 'fam-androgeno', otro: 'fam-precursor',
};

let cache = { theme: null, colors: {} };

function palette() {
  const theme = document.documentElement.getAttribute('data-theme') || 'auto';
  const key = theme + ':' + (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (cache.theme === key) return cache.colors;
  const colors = {};
  for (const [el, name] of Object.entries(ELEMENT_TOKEN)) colors[el] = token(name) || '#888';
  for (const [fam, name] of Object.entries(FAMILY_TOKEN)) colors['fam:' + fam] = token(name) || '#888';
  for (const ring of ['a', 'b', 'c', 'd']) colors['ring:' + ring] = token('ring-' + ring) || '#888';
  colors['ring:side'] = token('ring-side') || '#888';
  colors.muted = token('ink-3') || '#888';
  colors.accent = token('accent') || '#0b5cad';
  colors.up = token('up') || '#c62828';
  colors.down = token('down') || '#1565c0';
  cache = { theme: key, colors };
  return colors;
}

export function familyColor(family) { return palette()['fam:' + family] || palette().muted; }
export function elementColor(el) { return palette()[el] || palette().muted; }

/** Grupo funcional destacado por el coloreado 'groups'. */
const GROUP_COLOR_ORDER = [
  ['hidroxilo', 'el-o'], ['fenol', 'el-o'], ['cetona', 'up'], ['aldehido', 'up'],
  ['ester', 'fam-gestageno'], ['lactona', 'fam-gestageno'], ['sulfato', 'el-s'],
  ['etinilo', 'fam-estrogeno'], ['nitrilo', 'el-n'], ['amida', 'el-n'],
  ['halogeno', 'el-cl'], ['trifluorometilo', 'el-f'], ['ciclopropano', 'ring-c'],
];

/** Prepara los buffers que consume el motor a partir de la ficha de datos.
 *  El resultado se puede reutilizar entre nodos: no depende de la camara. */
export function prepareMolecule(record, options) {
  const o = options || {};
  const el = record.atoms.el;
  const n = el.length;
  const raw = record.atoms.xyz;
  if (!raw || raw.length !== n * 3) return null;

  const xyz = new Float32Array(n * 3);
  for (let i = 0; i < raw.length; i++) xyz[i] = raw[i] / 1000;

  const radii = new Float32Array(n);
  const isH = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    radii[i] = VDW[el[i]] || 1.7;
    isH[i] = el[i] === 'H' ? 1 : 0;
  }

  const bonds = {
    a: Uint16Array.from(record.bonds.a),
    b: Uint16Array.from(record.bonds.b),
    order: Uint8Array.from(record.bonds.order),
  };

  return {
    xyz, radii, isH, bonds,
    colors: colorAtoms(record, o.coloring || 'element'),
    numbering: record.atoms.n || [],
    record,
  };
}

/** Colores por atomo segun el esquema elegido. */
export function colorAtoms(record, scheme, extra) {
  const p = palette();
  const el = record.atoms.el;
  const n = el.length;
  const colors = new Array(n);

  if (scheme === 'family') {
    const c = familyColor(record.family);
    for (let i = 0; i < n; i++) colors[i] = el[i] === 'H' ? p.H : c;
    return colors;
  }

  if (scheme === 'rings' && record.steroid) {
    const ring = new Array(n).fill(null);
    for (const [key, atoms] of Object.entries(record.steroid.rings)) {
      for (const idx of atoms) ring[idx] = key.toLowerCase();
    }
    for (const idx of record.steroid.sideChain || []) if (ring[idx] === null) ring[idx] = 'side';
    for (let i = 0; i < n; i++) {
      colors[i] = ring[i] ? p['ring:' + ring[i]] : (el[i] === 'H' ? p.H : p.muted);
    }
    // Los hidrogenos heredan el color del carbono al que cuelgan.
    inheritHydrogens(record, colors);
    return colors;
  }

  if (scheme === 'groups') {
    for (let i = 0; i < n; i++) colors[i] = el[i] === 'H' ? p.H : p.muted;
    const byType = new Map((record.groups || []).map((g) => [g.type, g.atoms]));
    for (const [type, tokenName] of GROUP_COLOR_ORDER) {
      const atoms = byType.get(type);
      if (!atoms) continue;
      const color = token(tokenName) || p.accent;
      for (const idx of atoms) colors[idx] = color;
    }
    inheritHydrogens(record, colors);
    return colors;
  }

  if (scheme === 'change' && extra) {
    for (let i = 0; i < n; i++) colors[i] = el[i] === 'H' ? p.H : p.muted;
    for (const idx of extra.added || []) colors[idx] = token('ring-c') || '#2e9e5b';
    for (const idx of extra.removed || []) colors[idx] = p.up;
    for (const idx of extra.changed || []) colors[idx] = token('focus') || '#b45309';
    return colors;
  }

  for (let i = 0; i < n; i++) colors[i] = p[el[i]] || p.muted;
  return colors;
}

function inheritHydrogens(record, colors) {
  const { a, b } = record.bonds;
  const el = record.atoms.el;
  for (let k = 0; k < a.length; k++) {
    if (el[a[k]] === 'H' && el[b[k]] !== 'H') colors[a[k]] = mixToward(colors[b[k]]);
    else if (el[b[k]] === 'H' && el[a[k]] !== 'H') colors[b[k]] = mixToward(colors[a[k]]);
  }
}

function mixToward(color) { return color; }

/** Superficie accesible al disolvente por muestreo de esfera (Shrake-Rupley).
 *  Se calcula en el navegador y no en el archivo: ahorra peso y tarda ~5 ms. */
export function computeSurface(xyz, radii, isH, options) {
  const o = options || {};
  const probe = o.probe === undefined ? 1.4 : o.probe;
  const density = o.density || 96;
  const n = radii.length;
  const sphere = fibonacciSphere(density);
  const out = [];
  const cutoff = 4.6;

  for (let i = 0; i < n; i++) {
    if (isH && isH[i] && !o.hydrogens) continue;
    const ri = radii[i] + probe;
    const xi = xyz[i * 3], yi = xyz[i * 3 + 1], zi = xyz[i * 3 + 2];
    const neighbors = [];
    for (let j = 0; j < n; j++) {
      if (j === i || (isH && isH[j] && !o.hydrogens)) continue;
      const dx = xyz[j * 3] - xi, dy = xyz[j * 3 + 1] - yi, dz = xyz[j * 3 + 2] - zi;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < (ri + radii[j] + probe + cutoff) ** 2) neighbors.push(j);
    }
    for (let k = 0; k < sphere.length; k += 3) {
      const px = xi + sphere[k] * ri, py = yi + sphere[k + 1] * ri, pz = zi + sphere[k + 2] * ri;
      let buried = false;
      for (const j of neighbors) {
        const rj = radii[j] + probe;
        const dx = px - xyz[j * 3], dy = py - xyz[j * 3 + 1], dz = pz - xyz[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < rj * rj) { buried = true; break; }
      }
      if (!buried) out.push(px, py, pz);
    }
  }
  return Float32Array.from(out);
}

function fibonacciSphere(count) {
  const pts = new Float32Array(count * 3);
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    pts[i * 3] = Math.cos(theta) * r;
    pts[i * 3 + 1] = y;
    pts[i * 3 + 2] = Math.sin(theta) * r;
  }
  return pts;
}

/** Emparejamiento de atomos entre dos moleculas por numeracion esteroidea.
 *  Es la base de la superposicion del comparador y del morph del paso enzimatico. */
export function coreAtomMap(recordA, recordB) {
  const na = recordA.atoms.n || [], nb = recordB.atoms.n || [];
  const byNumberB = new Map();
  for (let i = 0; i < nb.length; i++) if (nb[i]) byNumberB.set(nb[i], i);
  const pairs = [];
  for (let i = 0; i < na.length; i++) {
    const number = na[i];
    if (number && byNumberB.has(number)) pairs.push([i, byNumberB.get(number)]);
  }
  return pairs;
}

/** Sustituyentes que cambian entre dos esteroides, por posicion del nucleo. */
export function structuralDiff(recordA, recordB) {
  const subs = (r) => {
    const map = new Map();
    for (const s of (r.steroid && r.steroid.substituents) || []) {
      if (!map.has(s.position)) map.set(s.position, []);
      map.get(s.position).push(s.group);
    }
    return map;
  };
  const A = subs(recordA), B = subs(recordB);
  const positions = Array.from(new Set([...A.keys(), ...B.keys()]));
  positions.sort((x, y) => {
    const nx = parseFloat(x.replace('Δ', '')) || 99, ny = parseFloat(y.replace('Δ', '')) || 99;
    return nx - ny;
  });
  const rows = [];
  for (const pos of positions) {
    const a = (A.get(pos) || []).sort().join(' + ') || '—';
    const b = (B.get(pos) || []).sort().join(' + ') || '—';
    if (a !== b) rows.push({ position: pos, a, b });
  }
  if (recordA.steroid && recordB.steroid) {
    if (recordA.steroid.nor19 !== recordB.steroid.nor19) {
      rows.push({ position: '19', a: recordA.steroid.nor19 ? 'ausente (19-nor)' : 'metilo',
                  b: recordB.steroid.nor19 ? 'ausente (19-nor)' : 'metilo' });
    }
    if (recordA.steroid.aromaticA !== recordB.steroid.aromaticA) {
      rows.push({ position: 'Anillo A', a: recordA.steroid.aromaticA ? 'aromatico' : 'no aromático',
                  b: recordB.steroid.aromaticA ? 'aromatico' : 'no aromático' });
    }
  }
  return rows;
}
