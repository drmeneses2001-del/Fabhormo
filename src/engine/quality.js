/** Calidad adaptativa: si el fotograma se pasa de presupuesto de forma sostenida
 *  se baja un escalon (menos resolucion, hidrogenos ocultos, menos puntos);
 *  si sobra margen durante bastante rato se vuelve a subir. */

export const LEVELS = [
  { id: 0, dpr: 1,   hydrogens: false, surfaceStride: 4, labels: false, shadows: false },
  { id: 1, dpr: 1.25, hydrogens: false, surfaceStride: 3, labels: true, shadows: false },
  { id: 2, dpr: 1.5, hydrogens: true,  surfaceStride: 2, labels: true, shadows: true },
  { id: 3, dpr: 2,   hydrogens: true,  surfaceStride: 1, labels: true, shadows: true },
];

export class QualityController {
  constructor(initial) {
    this.level = initial === undefined ? 3 : initial;
    this.samples = [];
    this.goodFrames = 0;
    this.locked = false;
    this.onChange = null;
  }

  get settings() { return LEVELS[this.level]; }

  lock(level) { this.locked = true; this.set(level); }
  unlock() { this.locked = false; }

  set(level) {
    const next = Math.max(0, Math.min(LEVELS.length - 1, level));
    if (next === this.level) return false;
    this.level = next;
    this.samples.length = 0;
    this.goodFrames = 0;
    if (this.onChange) this.onChange(this.settings);
    return true;
  }

  /** dt en milisegundos del ultimo fotograma dibujado. */
  sample(ms) {
    if (this.locked) return false;
    this.samples.push(ms);
    if (this.samples.length > 30) this.samples.shift();
    if (this.samples.length < 30) return false;
    const mean = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    if (mean > 20 && this.level > 0) { this.goodFrames = 0; return this.set(this.level - 1); }
    if (mean < 10) {
      this.goodFrames += 30;
      this.samples.length = 0;
      if (this.goodFrames >= 120 && this.level < LEVELS.length - 1) { this.goodFrames = 0; return this.set(this.level + 1); }
    } else this.goodFrames = 0;
    return false;
  }
}
