import { quatIdentity, quatFromAxisAngle, quatMultiply, quatNormalize, quatSlerp,
         quatToMat3, mat3Transpose, vec3, clamp, lerp } from './math.js';

/** Camara orbital con orientacion por cuaternion (sin bloqueo de cardan).
 *  El estado es serializable, para enlaces profundos y fotogramas clave. */
export class Camera {
  constructor() {
    this.target = vec3(0, 0, 0);
    this.orientation = quatIdentity();
    this.distance = 22;
    this.minDistance = 1.2;
    this.maxDistance = 900;
    this.fov = 35 * Math.PI / 180;
    this.orthographic = false;
    this.panX = 0;
    this.panY = 0;
    this._rot = new Float64Array(9);
    this._rotT = new Float64Array(9);
    this._dirty = true;
  }

  markDirty() { this._dirty = true; }

  /** Matriz de vista (transpuesta de la orientacion): mundo -> camara. */
  viewMatrix() {
    if (this._dirty) {
      quatToMat3(this.orientation, this._rot);
      mat3Transpose(this._rot, this._rotT);
      this._dirty = false;
    }
    return this._rotT;
  }

  rotate(dx, dy) {
    // El arrastre horizontal gira alrededor del eje vertical del mundo y el
    // vertical alrededor del eje horizontal de la camara: es el gesto esperado.
    const qy = quatFromAxisAngle([0, 1, 0], dx);
    const rot = quatToMat3(this.orientation);
    const right = [rot[0], rot[3], rot[6]];
    const qx = quatFromAxisAngle(right, dy);
    quatMultiply(qy, this.orientation, this.orientation);
    quatMultiply(qx, this.orientation, this.orientation);
    quatNormalize(this.orientation, this.orientation);
    this.markDirty();
  }

  zoom(factor) {
    this.distance = clamp(this.distance * factor, this.minDistance, this.maxDistance);
  }

  pan(dx, dy) {
    const k = this.distance * Math.tan(this.fov / 2) * 2;
    this.panX -= dx * k;
    this.panY += dy * k;
  }

  resetPan() { this.panX = 0; this.panY = 0; }

  fitSphere(center, radius, padding) {
    this.target.set(center);
    const pad = padding === undefined ? 1.25 : padding;
    this.distance = clamp((radius * pad) / Math.tan(this.fov / 2), this.minDistance, this.maxDistance);
    this.minDistance = Math.max(0.4, radius * 0.25);
    this.maxDistance = Math.max(this.distance * 12, radius * 40);
    this.resetPan();
  }

  getState() {
    return {
      target: Array.from(this.target), orientation: Array.from(this.orientation),
      distance: this.distance, panX: this.panX, panY: this.panY, orthographic: this.orthographic,
    };
  }

  setState(s) {
    if (!s) return;
    if (s.target) this.target.set(s.target);
    if (s.orientation) this.orientation.set(s.orientation);
    if (typeof s.distance === 'number') this.distance = s.distance;
    if (typeof s.panX === 'number') this.panX = s.panX;
    if (typeof s.panY === 'number') this.panY = s.panY;
    if (typeof s.orthographic === 'boolean') this.orthographic = s.orthographic;
    this.markDirty();
  }

  /** Interpolacion entre dos estados: esferica en la orientacion, lineal en el resto. */
  static interpolate(a, b, t) {
    const q = quatSlerp(Float64Array.from(a.orientation), Float64Array.from(b.orientation), t);
    return {
      orientation: Array.from(q),
      target: [lerp(a.target[0], b.target[0], t), lerp(a.target[1], b.target[1], t), lerp(a.target[2], b.target[2], t)],
      distance: Math.exp(lerp(Math.log(a.distance), Math.log(b.distance), t)),
      panX: lerp(a.panX || 0, b.panX || 0, t),
      panY: lerp(a.panY || 0, b.panY || 0, t),
      orthographic: t < 0.5 ? a.orthographic : b.orthographic,
    };
  }
}

export const EASING = {
  linear: (t) => t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutQuint: (t) => 1 - Math.pow(1 - t, 5),
};
