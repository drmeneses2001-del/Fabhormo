import { EASING } from './camera.js';

/** Reloj unico de animacion: los tweens se actualizan desde el bucle de render,
 *  nunca con temporizadores propios, para que nada anime con la pestana oculta. */
export class Tweens {
  constructor() { this.items = []; }

  add(opts) {
    const t = {
      duration: Math.max(1, opts.duration || 300),
      elapsed: 0,
      easing: typeof opts.easing === 'function' ? opts.easing : (EASING[opts.easing] || EASING.easeInOutCubic),
      onUpdate: opts.onUpdate || null,
      onComplete: opts.onComplete || null,
      tag: opts.tag || null,
      done: false,
    };
    if (t.tag) this.cancel(t.tag);
    this.items.push(t);
    return t;
  }

  cancel(tag) {
    for (const t of this.items) if (t.tag === tag) t.done = true;
    this.items = this.items.filter((t) => !t.done);
  }

  cancelAll() { this.items.length = 0; }

  get active() { return this.items.length > 0; }

  update(dt) {
    if (!this.items.length) return false;
    let alive = false;
    for (const t of this.items) {
      t.elapsed += dt;
      const p = Math.min(1, t.elapsed / t.duration);
      if (t.onUpdate) t.onUpdate(t.easing(p), p);
      if (p >= 1) { t.done = true; if (t.onComplete) t.onComplete(); }
      else alive = true;
    }
    if (this.items.some((t) => t.done)) this.items = this.items.filter((t) => !t.done);
    return alive || this.items.length > 0;
  }
}

/** Secuencia de fotogramas clave para los recorridos guiados. */
export class Timeline {
  constructor(keyframes, handlers) {
    this.keyframes = keyframes || [];
    this.index = 0;
    this.playing = false;
    this.handlers = handlers || {};
    this.elapsed = 0;
  }

  get length() { return this.keyframes.length; }
  get current() { return this.keyframes[this.index] || null; }
  get progress() { return this.length ? (this.index + 1) / this.length : 0; }

  seek(i) {
    this.index = Math.max(0, Math.min(this.length - 1, i));
    this.elapsed = 0;
    if (this.handlers.onStep) this.handlers.onStep(this.current, this.index);
    return this.index;
  }

  next() { return this.index < this.length - 1 ? this.seek(this.index + 1) : this.stop(); }
  prev() { return this.seek(this.index - 1); }
  play() { this.playing = true; if (this.handlers.onPlayState) this.handlers.onPlayState(true); }
  pause() { this.playing = false; if (this.handlers.onPlayState) this.handlers.onPlayState(false); }
  stop() { this.playing = false; if (this.handlers.onEnd) this.handlers.onEnd(); return this.index; }

  update(dt) {
    if (!this.playing) return;
    const kf = this.current;
    if (!kf) return;
    this.elapsed += dt;
    if (this.elapsed >= (kf.hold || 6000)) { this.elapsed = 0; this.next(); }
  }
}
