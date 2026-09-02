/** Algebra minima para el motor: vectores, cuaterniones, matrices 4x4 en
 *  Float32Array y superposicion de Kabsch. Todo pensado para reutilizar buffers
 *  y no generar basura por frame. */

export function vec3(x, y, z) { return new Float64Array([x || 0, y || 0, z || 0]); }

export function sub(a, b, out) {
  const o = out || new Float64Array(3);
  o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2];
  return o;
}
export function add(a, b, out) {
  const o = out || new Float64Array(3);
  o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2];
  return o;
}
export function scale(a, k, out) {
  const o = out || new Float64Array(3);
  o[0] = a[0] * k; o[1] = a[1] * k; o[2] = a[2] * k;
  return o;
}
export function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function cross(a, b, out) {
  const o = out || new Float64Array(3);
  const x = a[1] * b[2] - a[2] * b[1];
  const y = a[2] * b[0] - a[0] * b[2];
  const z = a[0] * b[1] - a[1] * b[0];
  o[0] = x; o[1] = y; o[2] = z;
  return o;
}
export function length(a) { return Math.hypot(a[0], a[1], a[2]); }
export function normalize(a, out) {
  const l = length(a) || 1;
  return scale(a, 1 / l, out);
}
export function lerp3(a, b, t, out) {
  const o = out || new Float64Array(3);
  o[0] = a[0] + (b[0] - a[0]) * t;
  o[1] = a[1] + (b[1] - a[1]) * t;
  o[2] = a[2] + (b[2] - a[2]) * t;
  return o;
}
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }

/* --------------------------------------------------------- cuaterniones --- */

export function quatIdentity() { return new Float64Array([0, 0, 0, 1]); }

export function quatFromAxisAngle(axis, angle, out) {
  const o = out || new Float64Array(4);
  const h = angle * 0.5, s = Math.sin(h);
  const l = Math.hypot(axis[0], axis[1], axis[2]) || 1;
  o[0] = axis[0] / l * s; o[1] = axis[1] / l * s; o[2] = axis[2] / l * s; o[3] = Math.cos(h);
  return o;
}

export function quatMultiply(a, b, out) {
  const o = out || new Float64Array(4);
  const ax = a[0], ay = a[1], az = a[2], aw = a[3];
  const bx = b[0], by = b[1], bz = b[2], bw = b[3];
  o[0] = aw * bx + ax * bw + ay * bz - az * by;
  o[1] = aw * by - ax * bz + ay * bw + az * bx;
  o[2] = aw * bz + ax * by - ay * bx + az * bw;
  o[3] = aw * bw - ax * bx - ay * by - az * bz;
  return o;
}

export function quatNormalize(q, out) {
  const o = out || q;
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  o[0] = q[0] / l; o[1] = q[1] / l; o[2] = q[2] / l; o[3] = q[3] / l;
  return o;
}

export function quatSlerp(a, b, t, out) {
  const o = out || new Float64Array(4);
  let cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  if (cos < 0) { cos = -cos; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let s0, s1;
  if (cos > 0.9995) { s0 = 1 - t; s1 = t; }
  else {
    const theta = Math.acos(cos), sinTheta = Math.sin(theta);
    s0 = Math.sin((1 - t) * theta) / sinTheta;
    s1 = Math.sin(t * theta) / sinTheta;
  }
  o[0] = a[0] * s0 + bx * s1; o[1] = a[1] * s0 + by * s1;
  o[2] = a[2] * s0 + bz * s1; o[3] = a[3] * s0 + bw * s1;
  return quatNormalize(o, o);
}

/** Matriz de rotacion 3x3 (fila mayor, 9 elementos) a partir de un cuaternion. */
export function quatToMat3(q, out) {
  const m = out || new Float64Array(9);
  const x = q[0], y = q[1], z = q[2], w = q[3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  m[0] = 1 - (yy + zz); m[1] = xy - wz;       m[2] = xz + wy;
  m[3] = xy + wz;       m[4] = 1 - (xx + zz); m[5] = yz - wx;
  m[6] = xz - wy;       m[7] = yz + wx;       m[8] = 1 - (xx + yy);
  return m;
}

export function applyMat3(m, v, out) {
  const o = out || new Float64Array(3);
  const x = v[0], y = v[1], z = v[2];
  o[0] = m[0] * x + m[1] * y + m[2] * z;
  o[1] = m[3] * x + m[4] * y + m[5] * z;
  o[2] = m[6] * x + m[7] * y + m[8] * z;
  return o;
}

export function mat3Transpose(m, out) {
  const o = out || new Float64Array(9);
  o[0] = m[0]; o[1] = m[3]; o[2] = m[6];
  o[3] = m[1]; o[4] = m[4]; o[5] = m[7];
  o[6] = m[2]; o[7] = m[5]; o[8] = m[8];
  return o;
}

export function mat3Multiply(a, b, out) {
  const o = out || new Float64Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  }
  return o;
}

/* ------------------------------------------------------------ geometria --- */

/** Esfera envolvente (centro + radio) de una lista plana de coordenadas xyz. */
export function boundingSphere(xyz, radii) {
  const n = xyz.length / 3;
  if (!n) return { center: vec3(0, 0, 0), radius: 1 };
  let cx = 0, cy = 0, cz = 0;
  for (let i = 0; i < n; i++) { cx += xyz[i * 3]; cy += xyz[i * 3 + 1]; cz += xyz[i * 3 + 2]; }
  cx /= n; cy /= n; cz /= n;
  let r = 0;
  for (let i = 0; i < n; i++) {
    const d = Math.hypot(xyz[i * 3] - cx, xyz[i * 3 + 1] - cy, xyz[i * 3 + 2] - cz) + (radii ? radii[i] : 0);
    if (d > r) r = d;
  }
  return { center: vec3(cx, cy, cz), radius: r || 1 };
}

export function centroid(xyz, indices) {
  const idx = indices || null;
  const n = idx ? idx.length : xyz.length / 3;
  const c = new Float64Array(3);
  if (!n) return c;
  for (let k = 0; k < n; k++) {
    const i = idx ? idx[k] : k;
    c[0] += xyz[i * 3]; c[1] += xyz[i * 3 + 1]; c[2] += xyz[i * 3 + 2];
  }
  c[0] /= n; c[1] /= n; c[2] /= n;
  return c;
}

/** Ejes principales por analisis de componentes: se usa para dar a todas las
 *  moleculas una pose canonica (eje mayor en X) antes de guardarlas. */
export function principalAxes(xyz) {
  const n = xyz.length / 3;
  const c = centroid(xyz);
  const cov = new Float64Array(9);
  for (let i = 0; i < n; i++) {
    const x = xyz[i * 3] - c[0], y = xyz[i * 3 + 1] - c[1], z = xyz[i * 3 + 2] - c[2];
    cov[0] += x * x; cov[1] += x * y; cov[2] += x * z;
    cov[4] += y * y; cov[5] += y * z; cov[8] += z * z;
  }
  cov[3] = cov[1]; cov[6] = cov[2]; cov[7] = cov[5];
  for (let i = 0; i < 9; i++) cov[i] /= n || 1;
  return jacobiEigen(cov);
}

/** Diagonalizacion de una matriz simetrica 3x3 por rotaciones de Jacobi.
 *  Devuelve valores propios descendentes y sus vectores propios en filas. */
export function jacobiEigen(matrix) {
  const a = Float64Array.from(matrix);
  const v = new Float64Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  for (let sweep = 0; sweep < 24; sweep++) {
    let off = Math.abs(a[1]) + Math.abs(a[2]) + Math.abs(a[5]);
    if (off < 1e-12) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      const apq = a[p * 3 + q];
      if (Math.abs(apq) < 1e-14) continue;
      const app = a[p * 3 + p], aqq = a[q * 3 + q];
      const theta = (aqq - app) / (2 * apq);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k * 3 + p], akq = a[k * 3 + q];
        a[k * 3 + p] = c * akp - s * akq;
        a[k * 3 + q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p * 3 + k], aqk = a[q * 3 + k];
        a[p * 3 + k] = c * apk - s * aqk;
        a[q * 3 + k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k * 3 + p], vkq = v[k * 3 + q];
        v[k * 3 + p] = c * vkp - s * vkq;
        v[k * 3 + q] = s * vkp + c * vkq;
      }
    }
  }
  const order = [0, 1, 2].sort((i, j) => a[j * 3 + j] - a[i * 3 + i]);
  const values = order.map((i) => a[i * 3 + i]);
  const vectors = new Float64Array(9);
  order.forEach((col, row) => {
    vectors[row * 3] = v[col]; vectors[row * 3 + 1] = v[3 + col]; vectors[row * 3 + 2] = v[6 + col];
  });
  return { values, vectors };
}

/** Superposicion de Kabsch: rotacion optima que lleva "mobile" sobre "target".
 *  Ambos son listas planas xyz del mismo numero de puntos, ya emparejados. */
export function kabsch(mobile, target) {
  const n = mobile.length / 3;
  const cm = centroid(mobile), ct = centroid(target);
  const cov = new Float64Array(9);
  for (let i = 0; i < n; i++) {
    const mx = mobile[i * 3] - cm[0], my = mobile[i * 3 + 1] - cm[1], mz = mobile[i * 3 + 2] - cm[2];
    const tx = target[i * 3] - ct[0], ty = target[i * 3 + 1] - ct[1], tz = target[i * 3 + 2] - ct[2];
    cov[0] += mx * tx; cov[1] += mx * ty; cov[2] += mx * tz;
    cov[3] += my * tx; cov[4] += my * ty; cov[5] += my * tz;
    cov[6] += mz * tx; cov[7] += mz * ty; cov[8] += mz * tz;
  }
  // R = (H^T H)^(-1/2) H^T  obtenido por descomposicion propia de H^T H.
  const ht = mat3Transpose(cov);
  const hth = mat3Multiply(ht, cov);
  const { values, vectors } = jacobiEigen(hth);
  const inv = new Float64Array(9);
  for (let k = 0; k < 3; k++) {
    const s = Math.sqrt(Math.max(values[k], 1e-12));
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      inv[r * 3 + c] += vectors[k * 3 + r] * vectors[k * 3 + c] / s;
    }
  }
  let R = mat3Multiply(inv, ht);
  const det = R[0] * (R[4] * R[8] - R[5] * R[7]) - R[1] * (R[3] * R[8] - R[5] * R[6]) + R[2] * (R[3] * R[7] - R[4] * R[6]);
  if (det < 0) {
    // Reflexion: se invierte el eje del menor valor propio.
    const k = 2, fix = new Float64Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      fix[r * 3 + c] = (r === c ? 1 : 0) - 2 * vectors[k * 3 + r] * vectors[k * 3 + c];
    }
    R = mat3Multiply(R, fix);
  }
  return { rotation: R, mobileCenter: cm, targetCenter: ct };
}

/** Aplica una superposicion de Kabsch a una lista plana de coordenadas. */
export function applyKabsch(fit, xyz, out) {
  const o = out || new Float64Array(xyz.length);
  const { rotation: R, mobileCenter: cm, targetCenter: ct } = fit;
  for (let i = 0; i < xyz.length / 3; i++) {
    const x = xyz[i * 3] - cm[0], y = xyz[i * 3 + 1] - cm[1], z = xyz[i * 3 + 2] - cm[2];
    o[i * 3] = R[0] * x + R[1] * y + R[2] * z + ct[0];
    o[i * 3 + 1] = R[3] * x + R[4] * y + R[5] * z + ct[1];
    o[i * 3 + 2] = R[6] * x + R[7] * y + R[8] * z + ct[2];
  }
  return o;
}

export function rmsd(a, b) {
  const n = a.length / 3;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += (a[i * 3] - b[i * 3]) ** 2 + (a[i * 3 + 1] - b[i * 3 + 1]) ** 2 + (a[i * 3 + 2] - b[i * 3 + 2]) ** 2;
  }
  return Math.sqrt(sum / (n || 1));
}
