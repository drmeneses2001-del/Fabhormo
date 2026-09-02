import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  kabsch, applyKabsch, rmsd, quatFromAxisAngle, quatToMat3, applyMat3,
  quatSlerp, boundingSphere, principalAxes, jacobiEigen, clamp,
} from '../src/engine/math.js';

test('Kabsch recupera una rotacion y una traslacion conocidas', () => {
  const A = new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0, 2, 0.5, -1]);
  const R = quatToMat3(quatFromAxisAngle([0.3, 1, 0.2], 0.9));
  const B = new Float64Array(A.length);
  for (let i = 0; i < A.length / 3; i++) {
    const v = applyMat3(R, A.subarray(i * 3, i * 3 + 3));
    B[i * 3] = v[0] + 5; B[i * 3 + 1] = v[1] - 2; B[i * 3 + 2] = v[2] + 1;
  }
  const out = applyKabsch(kabsch(A, B), A);
  assert.ok(rmsd(out, B) < 1e-9, 'la superposicion deberia ser exacta');
});

test('Kabsch no introduce reflexiones', () => {
  // Un tetraedro y su imagen especular no deben poder superponerse.
  const A = new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]);
  const mirror = new Float64Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, -1]);
  const out = applyKabsch(kabsch(A, mirror), A);
  assert.ok(rmsd(out, mirror) > 0.1, 'una reflexion no es una rotacion valida');
});

test('la interpolacion esferica de cuaterniones mantiene la norma', () => {
  const a = quatFromAxisAngle([0, 1, 0], 0.2);
  const b = quatFromAxisAngle([1, 0, 0], 2.4);
  for (let t = 0; t <= 1.0001; t += 0.25) {
    const q = quatSlerp(a, b, t);
    assert.ok(Math.abs(Math.hypot(q[0], q[1], q[2], q[3]) - 1) < 1e-9);
  }
});

test('la esfera envolvente contiene todos los puntos', () => {
  const xyz = new Float64Array([0, 0, 0, 3, 0, 0, 0, 4, 0, -2, -2, 5]);
  const b = boundingSphere(xyz);
  for (let i = 0; i < xyz.length / 3; i++) {
    const d = Math.hypot(xyz[i * 3] - b.center[0], xyz[i * 3 + 1] - b.center[1], xyz[i * 3 + 2] - b.center[2]);
    assert.ok(d <= b.radius + 1e-9);
  }
});

test('los ejes principales ordenan de mayor a menor varianza', () => {
  const xyz = new Float64Array(300);
  for (let i = 0; i < 100; i++) {
    xyz[i * 3] = (Math.sin(i) * 10);
    xyz[i * 3 + 1] = (Math.cos(i) * 3);
    xyz[i * 3 + 2] = (Math.sin(i * 2) * 0.5);
  }
  const { values } = principalAxes(xyz);
  assert.ok(values[0] >= values[1] && values[1] >= values[2]);
});

test('la diagonalizacion de Jacobi resuelve una matriz diagonal', () => {
  const { values } = jacobiEigen(new Float64Array([5, 0, 0, 0, 2, 0, 0, 0, 9]));
  assert.deepEqual(values.map((v) => Math.round(v)), [9, 5, 2]);
});

test('clamp respeta los limites', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(clamp(1.5, 0, 3), 1.5);
});
