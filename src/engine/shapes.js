/** Geometria esquematica generada por codigo: siluetas, membranas y organulos.
 *
 *  Se dibuja como poligonos suaves en vez de incrustar ilustraciones de
 *  terceros. Es deliberadamente esquematica: representa donde ocurre cada paso,
 *  no la anatomia real, y asi queda dicho en la propia vista.
 */

/** Curva de Catmull-Rom muestreada: convierte pocos puntos de control en un
 *  contorno suave sin depender de rutas SVG externas. */
export function smoothClosed(points, samples) {
  const n = points.length / 2;
  const step = samples || 8;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p0 = idx(points, i - 1, n), p1 = idx(points, i, n);
    const p2 = idx(points, i + 1, n), p3 = idx(points, i + 2, n);
    for (let s = 0; s < step; s++) {
      const t = s / step, t2 = t * t, t3 = t2 * t;
      out.push(
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      );
    }
  }
  return out;
}

function idx(points, i, n) {
  const k = ((i % n) + n) % n;
  return [points[k * 2], points[k * 2 + 1]];
}

export function toPath3(points2d, z) {
  const out = new Float64Array((points2d.length / 2) * 3);
  for (let i = 0; i < points2d.length / 2; i++) {
    out[i * 3] = points2d[i * 2];
    out[i * 3 + 1] = points2d[i * 2 + 1];
    out[i * 3 + 2] = z || 0;
  }
  return out;
}

export function ellipsePath(cx, cy, rx, ry, z, segments) {
  const n = segments || 48;
  const out = new Float64Array((n + 1) * 3);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    out[i * 3] = cx + Math.cos(a) * rx;
    out[i * 3 + 1] = cy + Math.sin(a) * ry;
    out[i * 3 + 2] = z || 0;
  }
  return out;
}

/** Contorno frontal simplificado del cuerpo humano, media silueta reflejada.
 *  Coordenadas en la escala del cuerpo: 0 = pies, 100 = vertice del craneo. */
const BODY_HALF = [
  0, 100, 4.4, 98.4, 5.6, 94.6, 5.0, 90.6, 3.2, 88.4,
  2.6, 86.6, 6.0, 85.0, 11.6, 82.6, 13.4, 78.0, 14.2, 71.0,
  14.8, 64.0, 15.2, 58.0, 14.4, 53.6, 12.4, 53.0, 11.4, 57.0,
  10.4, 63.0, 9.6, 69.0, 9.4, 74.0, 9.0, 68.0, 8.4, 62.0,
  7.6, 58.4, 8.6, 54.0, 10.0, 50.0, 10.2, 45.0, 8.6, 36.0,
  7.4, 26.0, 6.6, 14.0, 6.8, 4.0, 6.0, 1.6, 1.2, 1.6, 1.0, 6.0,
  1.2, 18.0, 0.6, 32.0, 0, 40.0,
];

export function bodyOutline(sex) {
  const half = BODY_HALF.slice();
  if (sex === 'xx') {
    // Silueta femenina: hombros algo mas estrechos, cintura marcada y caderas anchas.
    for (let i = 0; i < half.length; i += 2) {
      const y = half[i + 1];
      if (y > 76 && y < 86) half[i] *= 0.9;
      if (y > 56 && y < 66) half[i] *= 0.92;
      if (y > 44 && y < 54) half[i] *= 1.12;
      if (y > 72 && y < 79) half[i] *= 1.06;
    }
  }
  const pts = [];
  for (let i = 0; i < half.length; i += 2) pts.push(half[i], half[i + 1]);
  for (let i = half.length - 2; i >= 0; i -= 2) {
    if (half[i] === 0) continue;
    pts.push(-half[i], half[i + 1]);
  }
  return smoothClosed(pts, 4);
}

/** Membrana celular con leve irregularidad: se distingue de un circulo perfecto. */
export function cellOutline(radius, wobble, seed) {
  const n = 42;
  const pts = [];
  let s = seed || 7;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = radius * (1 + (rand() - 0.5) * (wobble === undefined ? 0.12 : wobble));
    pts.push(Math.cos(a) * r, Math.sin(a) * r * 0.86);
  }
  return smoothClosed(pts, 4);
}

/** Mitocondria: contorno externo y membrana interna plegada en crestas. */
export function mitochondrion(rx, ry) {
  const outer = ellipsePath(0, 0, rx, ry, 0, 56);
  const inner = [];
  const n = 120;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const fold = 1 + 0.16 * Math.sin(a * 9);
    inner.push(Math.cos(a) * rx * 0.82 * fold, Math.sin(a) * ry * 0.78 * fold, 0.4);
  }
  return { outer, inner: Float64Array.from(inner) };
}

/** Cisternas del reticulo endoplasmico liso: laminas paralelas onduladas. */
export function erCisternae(width, count, spacing) {
  const sheets = [];
  for (let k = 0; k < count; k++) {
    const y = (k - (count - 1) / 2) * spacing;
    const pts = [];
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = (t - 0.5) * width;
      pts.push(x, y + Math.sin(t * Math.PI * 3 + k) * spacing * 0.22, 0);
    }
    sheets.push(Float64Array.from(pts));
  }
  return sheets;
}

/** Nucleo celular con su envoltura. */
export function nucleus(radius) {
  return ellipsePath(0, 0, radius, radius * 0.92, 0, 44);
}

/** Reparte n puntos sobre una elipse: sirve para colocar organulos o enzimas. */
export function spread(n, rx, ry, phase) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (phase || 0);
    out.push([Math.cos(a) * rx, Math.sin(a) * ry]);
  }
  return out;
}
