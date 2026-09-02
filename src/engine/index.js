import { Camera, EASING } from './camera.js';
import { attachControls } from './controls.js';
import { Scene } from './scene.js';
import { Renderer2D } from './renderer2d.js';
import { Tweens } from './tween.js';
import { QualityController } from './quality.js';
import { withAlpha } from './sprites.js';
import { clamp, applyMat3, vec3 } from './math.js';
import { token, resolvedTheme } from '../core/theme.js';

const REPRESENTATION = {
  ballstick: { sphere: 0.28, bond: 0.19, showSpheres: true, showBonds: true },
  sticks:    { sphere: 0.11, bond: 0.20, showSpheres: true, showBonds: true },
  spacefill: { sphere: 1.00, bond: 0.00, showSpheres: true, showBonds: false },
  surface:   { sphere: 0.14, bond: 0.14, showSpheres: true, showBonds: true, surface: true },
  wire:      { sphere: 0.00, bond: 0.07, showSpheres: false, showBonds: true },
};

/** Motor de escena. Un unico bucle de render bajo demanda: si nada cambia no se
 *  dibuja nada, de modo que en reposo el coste es cero. */
export class Engine {
  constructor(canvas, options) {
    const o = options || {};
    this.canvas = canvas;
    this.scene = new Scene();
    this.camera = new Camera();
    this.quality = new QualityController(o.quality === undefined ? 3 : o.quality);
    this.renderer = new Renderer2D(canvas, { theme: resolvedTheme(), maxDpr: this.quality.settings.dpr });
    this.tweens = new Tweens();
    this.listeners = new Map();
    this.scaleLevel = o.scaleLevel === undefined ? 5 : o.scaleLevel;
    this.autoSpin = o.autoSpin !== false;
    this.spinSpeed = 0.16;
    this.dirty = true;
    this.running = false;
    this.lastTime = 0;
    this.inertia = { x: 0, y: 0 };
    this.hovered = null;
    this.selected = null;
    this.focusIndex = -1;
    this.frameCount = 0;
    this.lastFrameMs = 0;
    this.fpsEstimate = 0;
    this.onBeforeRender = null;
    this.onAfterRender = null;
    this.reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.reducedMotion) this.autoSpin = false;

    this.quality.onChange = (settings) => {
      this.renderer.maxDpr = settings.dpr;
      this.handleResize(true);
      this.requestRender();
    };

    this.refreshTheme();
    this.detachControls = attachControls(canvas, this);
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas.parentElement || canvas);
    this.handleResize(true);
    this.start();
  }

  /* ------------------------------------------------------------- eventos --- */

  on(event, fn) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(fn);
    return () => this.off(event, fn);
  }
  off(event, fn) { const s = this.listeners.get(event); if (s) s.delete(fn); }
  emit(event, payload) { for (const fn of this.listeners.get(event) || []) fn(payload); }

  /* --------------------------------------------------------------- tema --- */

  refreshTheme() {
    const theme = resolvedTheme();
    this.theme = theme;
    this.palette = {
      fog: token('bg-stage') || (theme === 'dark' ? '#080b11' : '#e9e6dd'),
      ink: token('ink') || (theme === 'dark' ? '#e8e6e1' : '#1a1a1a'),
      muted: token('ink-3') || '#7a7a76',
      accent: token('accent') || '#0b5cad',
      line: token('line') || '#d9d6cd',
      halo: theme === 'dark' ? '#ffffff' : '#1a1a1a',
    };
    this.renderer.setTheme(theme, this.palette);
    this.requestRender();
  }

  /* ------------------------------------------------------------- tamano --- */

  handleResize(force) {
    const parent = this.canvas.parentElement || this.canvas;
    const reserved = Number(this.canvas.dataset.reserveRight || 0);
    const w = Math.max(80, (parent.clientWidth || this.canvas.clientWidth) - reserved);
    const h = parent.clientHeight || this.canvas.clientHeight;
    const changed = this.renderer.resize(w, h, Math.min(window.devicePixelRatio || 1, this.quality.settings.dpr));
    if (changed || force) this.requestRender();
  }

  /* ------------------------------------------------------------- camara --- */

  resetCamera(padding) {
    const b = this.scene.bounds();
    this.camera.fitSphere(b.center, b.radius, padding);
    this.camera.markDirty();
    this.requestRender();
  }

  frameNodes(ids, padding, animate) {
    const b = this.scene.bounds(ids);
    if (!animate) {
      this.camera.fitSphere(b.center, b.radius, padding);
      this.requestRender();
      return;
    }
    const from = this.camera.getState();
    this.camera.fitSphere(b.center, b.radius, padding);
    const to = this.camera.getState();
    this.camera.setState(from);
    this.flyTo(to, 620);
  }

  flyTo(state, duration, easing) {
    const from = this.camera.getState();
    this.tweens.add({
      duration: duration || 620, tag: 'camera', easing: easing || EASING.easeInOutCubic,
      onUpdate: (t) => { this.camera.setState(Camera.interpolate(from, state, t)); this.requestRender(); },
    });
  }

  startInertia(vx, vy) {
    if (this.reducedMotion) return;
    this.inertia.x = vx; this.inertia.y = vy;
    if (Math.abs(vx) + Math.abs(vy) > 0.002) this.requestRender();
  }

  onZoomChange() { this.emit('zoom', { distance: this.camera.distance }); }

  setScaleLevel(level, animate) {
    const target = clamp(level, 0, 5);
    if (!animate) { this.scaleLevel = target; this.requestRender(); this.emit('scale', target); return; }
    const from = this.scaleLevel;
    this.tweens.add({
      duration: 600, tag: 'scale',
      onUpdate: (t) => { this.scaleLevel = from + (target - from) * t; this.requestRender(); },
      onComplete: () => this.emit('scale', target),
    });
  }

  /* ---------------------------------------------------------- seleccion --- */

  handleHover(e) {
    if (!e) { this.setHovered(null); return; }
    const rect = this.canvas.getBoundingClientRect();
    const hit = this.renderer.hitTest(e.clientX - rect.left, e.clientY - rect.top);
    this.setHovered(hit ? { ...hit.node.pick, node: hit.node, index: hit.index, x: hit.x, y: hit.y } : null);
  }

  setHovered(info) {
    const same = (a, b) => (!a && !b) || (a && b && a.id === b.id && a.index === b.index);
    if (same(this.hovered, info)) return;
    this.hovered = info;
    this.canvas.style.cursor = info ? 'pointer' : 'default';
    this.emit('hover', info);
    this.requestRender();
  }

  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const hit = this.renderer.hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (!hit) { this.emit('select', null); this.selected = null; this.requestRender(); return; }
    this.selected = { ...hit.node.pick, node: hit.node, index: hit.index };
    this.emit('select', this.selected);
    this.requestRender();
  }

  clearSelection() {
    if (!this.selected) return false;
    this.selected = null;
    this.emit('select', null);
    this.requestRender();
    return true;
  }

  /** Recorrido por teclado de las entidades seleccionables del escenario. */
  focusNext(backwards) {
    const items = this.scene.nodes.filter((n) => n.pickable && n.visible);
    if (!items.length) return false;
    this.focusIndex = (this.focusIndex + (backwards ? -1 : 1) + items.length) % items.length;
    const node = items[this.focusIndex];
    this.setHovered({ ...node.pick, node, index: -1 });
    return true;
  }

  activateFocused() {
    if (!this.hovered) return false;
    this.selected = { ...this.hovered };
    this.emit('select', this.selected);
    this.requestRender();
    return true;
  }

  /* --------------------------------------------------------------- bucle --- */

  start() { if (!this.running) { this.running = true; this.lastTime = performance.now(); requestAnimationFrame(this.loop); } }
  stop() { this.running = false; }
  isActive() { return this.running && this.scene.nodes.length > 0; }
  requestRender() { this.dirty = true; }

  loop = (time) => {
    if (!this.running) return;
    const dt = Math.min(64, time - this.lastTime);
    this.lastTime = time;

    let animating = this.tweens.update(dt);
    if (this.autoSpin && !this.reducedMotion) { this.camera.rotate(this.spinSpeed * dt / 1000, 0); animating = true; }
    if (Math.abs(this.inertia.x) + Math.abs(this.inertia.y) > 0.0006) {
      this.camera.rotate(this.inertia.x, this.inertia.y);
      this.inertia.x *= 0.92; this.inertia.y *= 0.92;
      animating = true;
    }
    for (const n of this.scene.nodes) {
      if (n.spin && n.visible) {
        const a = n.spin * dt / 1000;
        const c = Math.cos(a / 2), s = Math.sin(a / 2);
        const q = n.quat;
        const nx = q[0] * c + q[2] * s, ny = q[1] * c + q[3] * s;
        const nz = q[2] * c - q[0] * s, nw = q[3] * c - q[1] * s;
        q[0] = nx; q[1] = ny; q[2] = nz; q[3] = nw;
        n._rotDirty = true;
        animating = true;
      }
    }

    if (this.dirty || animating) {
      const t0 = performance.now();
      this.render();
      this.lastFrameMs = performance.now() - t0;
      this.fpsEstimate = this.lastFrameMs > 0 ? 1000 / Math.max(this.lastFrameMs, 1000 / 240) : 0;
      this.quality.sample(this.lastFrameMs);
      this.dirty = false;
      this.frameCount++;
    }
    requestAnimationFrame(this.loop);
  };

  /* -------------------------------------------------------------- render --- */

  render() {
    const r = this.renderer;
    if (this.onBeforeRender) this.onBeforeRender();
    r.stats.spheres = 0; r.stats.labels = 0; r.stats.culled = 0;
    r.clearScreen(this.palette.fog);
    r.beginFrame(this.camera);

    const nodes = this.scene.visibleNodes(this.scaleLevel);
    const bounds = this.scene.bounds();
    const fogRange = [Math.max(0.1, this.camera.distance - bounds.radius * 1.1),
                      this.camera.distance + bounds.radius * 1.35];

    for (const node of nodes) {
      const alpha = node.opacity * this.bandAlpha(node);
      if (alpha < 0.02) continue;
      switch (node.kind) {
        case 'molecule': this.collectMolecule(node, alpha); break;
        case 'tube': this.collectTube(node, alpha); break;
        case 'points': this.collectPoints(node, alpha); break;
        case 'path': this.collectPath(node, alpha); break;
        case 'label': this.collectLabel(node, alpha); break;
        case 'arrow': this.collectArrow(node, alpha); break;
        case 'halo': this.collectHalo(node, alpha); break;
      }
    }

    r.flush(fogRange);
    if (this.onAfterRender) this.onAfterRender();
  }

  /** Desvanecido en los bordes de la banda de escala del nodo. */
  bandAlpha(node) {
    if (!node.scaleBand) return 1;
    const [lo, hi] = node.scaleBand;
    const s = this.scaleLevel;
    if (s >= lo && s <= hi) return 1;
    const d = s < lo ? lo - s : s - hi;
    return clamp(1 - d / 0.6, 0, 1);
  }

  worldPoint(node, i, out) {
    const o = out || new Float64Array(3);
    const xyz = node.data.xyz;
    const rot = node.rotation();
    const x = xyz[i * 3] * node.scale, y = xyz[i * 3 + 1] * node.scale, z = xyz[i * 3 + 2] * node.scale;
    o[0] = rot[0] * x + rot[1] * y + rot[2] * z + node.position[0];
    o[1] = rot[3] * x + rot[4] * y + rot[5] * z + node.position[1];
    o[2] = rot[6] * x + rot[7] * y + rot[8] * z + node.position[2];
    return o;
  }

  collectMolecule(node, alpha) {
    const d = node.data;
    const rep = REPRESENTATION[d.representation] || REPRESENTATION.ballstick;
    const showH = d.hydrogens === false ? false
      : (d.hydrogens === true || this.quality.settings.hydrogens) && d.representation !== 'wire';
    const n = d.xyz.length / 3;
    const pa = this._pa || (this._pa = new Float64Array(3));
    const pb = this._pb || (this._pb = new Float64Array(3));

    if (rep.showSpheres) {
      for (let i = 0; i < n; i++) {
        if (d.isH && d.isH[i] && !showH) continue;
        this.worldPoint(node, i, pa);
        const isHydrogen = d.isH && d.isH[i];
        const radius = (d.radii ? d.radii[i] : 1.6) * rep.sphere * node.scale
          * (isHydrogen && d.representation !== 'spacefill' ? 0.76 : 1);
        const color = (d.colorOverride && d.colorOverride[i]) || d.colors[i];
        const a = d.atomAlpha ? alpha * d.atomAlpha[i] : alpha;
        if (a > 0.02) this.renderer.addSphere(pa[0], pa[1], pa[2], radius, color, node, i, a);
      }
    }

    if (rep.showBonds && d.bonds) {
      const { a: ba, b: bb, order } = d.bonds;
      for (let k = 0; k < ba.length; k++) {
        const i = ba[k], j = bb[k];
        if (d.isH && (d.isH[i] || d.isH[j]) && !showH) continue;
        this.worldPoint(node, i, pa);
        this.worldPoint(node, j, pb);
        const ca = (d.colorOverride && d.colorOverride[i]) || d.colors[i];
        const cb = (d.colorOverride && d.colorOverride[j]) || d.colors[j];
        const aa = d.bondAlpha ? alpha * d.bondAlpha[k]
          : (d.atomAlpha ? alpha * Math.min(d.atomAlpha[i], d.atomAlpha[j]) : alpha);
        if (aa > 0.02) {
          this.renderer.addBond(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2], ca, cb,
            rep.bond * node.scale, node, aa, order ? order[k] : 1);
        }
      }
    }

    if (rep.surface && d.surface) {
      const stride = this.quality.settings.surfaceStride;
      const s = d.surface;
      const rot = node.rotation();
      for (let i = 0; i < s.length / 3; i += stride) {
        const x = s[i * 3] * node.scale, y = s[i * 3 + 1] * node.scale, z = s[i * 3 + 2] * node.scale;
        const wx = rot[0] * x + rot[1] * y + rot[2] * z + node.position[0];
        const wy = rot[3] * x + rot[4] * y + rot[5] * z + node.position[1];
        const wz = rot[6] * x + rot[7] * y + rot[8] * z + node.position[2];
        this.renderer.addPoint(wx, wy, wz, d.surfaceColor || this.palette.accent, 0.9, null, alpha * 0.5);
      }
    }

    // Halo de seleccion o de foco sobre el atomo o la molecula completa.
    const mark = this.markerFor(node);
    if (mark) {
      const b = node.bounds();
      this.renderer.addHalo(b.center[0], b.center[1], b.center[2], b.radius * 1.06,
        mark.color, mark.width, null, mark.alpha, mark.dash);
    }
  }

  markerFor(node) {
    if (!node.pick) return null;
    const sel = this.selected && this.selected.id === node.pick.id && this.selected.type === node.pick.type;
    const hov = this.hovered && this.hovered.id === node.pick.id && this.hovered.type === node.pick.type;
    if (sel) return { color: this.palette.accent, width: 2, alpha: 0.95, dash: null };
    if (hov) return { color: withAlpha(this.palette.halo, 0.5), width: 1.4, alpha: 0.8, dash: [4, 4] };
    return null;
  }

  collectTube(node, alpha) {
    const p = node.data.points;
    const rot = node.rotation();
    const n = p.length / 3;
    const pa = new Float64Array(3), pb = new Float64Array(3);
    const put = (i, out) => {
      const x = p[i * 3] * node.scale, y = p[i * 3 + 1] * node.scale, z = p[i * 3 + 2] * node.scale;
      out[0] = rot[0] * x + rot[1] * y + rot[2] * z + node.position[0];
      out[1] = rot[3] * x + rot[4] * y + rot[5] * z + node.position[1];
      out[2] = rot[6] * x + rot[7] * y + rot[8] * z + node.position[2];
    };
    for (let i = 0; i < n - 1; i++) {
      put(i, pa); put(i + 1, pb);
      const w = node.data.width * (node.data.taper ? (0.7 + 0.3 * Math.sin(Math.PI * i / n)) : 1);
      this.renderer.addTubeSegment(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2],
        node.data.colors ? node.data.colors[i] : node.data.color, w * node.scale, node, alpha);
    }
  }

  collectPoints(node, alpha) {
    const p = node.data.points;
    const rot = node.rotation();
    const stride = Math.max(1, this.quality.settings.surfaceStride);
    for (let i = 0; i < p.length / 3; i += stride) {
      const x = p[i * 3] * node.scale, y = p[i * 3 + 1] * node.scale, z = p[i * 3 + 2] * node.scale;
      const wx = rot[0] * x + rot[1] * y + rot[2] * z + node.position[0];
      const wy = rot[3] * x + rot[4] * y + rot[5] * z + node.position[1];
      const wz = rot[6] * x + rot[7] * y + rot[8] * z + node.position[2];
      this.renderer.addPoint(wx, wy, wz, node.data.colors ? node.data.colors[i] : node.data.color,
        node.data.size, node, alpha);
    }
  }

  /** Silueta: se proyecta punto a punto y se dibuja como poligono plano en 2D. */
  collectPath(node, alpha) {
    const path = node.data.path;
    const rot = node.rotation();
    const out = [];
    const tmp = { x: 0, y: 0, depth: 0, k: 1 };
    let depthSum = 0, count = 0;
    for (let i = 0; i < path.length / 3; i++) {
      const x = path[i * 3] * node.scale, y = path[i * 3 + 1] * node.scale, z = path[i * 3 + 2] * node.scale;
      const wx = rot[0] * x + rot[1] * y + rot[2] * z + node.position[0];
      const wy = rot[3] * x + rot[4] * y + rot[5] * z + node.position[1];
      const wz = rot[6] * x + rot[7] * y + rot[8] * z + node.position[2];
      if (!this.renderer.project(wx, wy, wz, tmp)) continue;
      out.push(tmp.x, tmp.y);
      depthSum += tmp.depth; count++;
    }
    if (out.length < 4) return;
    this.renderer.addPath(out, depthSum / count, {
      fill: node.data.fill, stroke: node.data.stroke, lineWidth: node.data.lineWidth,
      closed: node.data.closed, dash: node.data.dash, alpha,
    }, node);
  }

  collectLabel(node, alpha) {
    if (!this.quality.settings.labels && !node.data.always) return;
    const d = node.data;
    this.renderer.addLabel(node.position[0], node.position[1], node.position[2], d.text, {
      size: d.size, color: d.color || this.palette.ink, weight: d.weight, offsetY: d.offsetY,
      halo: d.halo, font: d.font, alpha, avoidCollision: d.avoidCollision,
    }, node);
  }

  collectArrow(node, alpha) {
    const d = node.data;
    const p = node.position;
    this.renderer.addArrow(
      d.from[0] + p[0], d.from[1] + p[1], d.from[2] + p[2],
      d.to[0] + p[0], d.to[1] + p[1], d.to[2] + p[2],
      { color: d.color, width: d.width, head: d.head, dash: d.dash, doubleHead: d.doubleHead,
        curve: d.curve, gapStart: d.gapStart, gapEnd: d.gapEnd, alpha }, node);
  }

  collectHalo(node, alpha) {
    const d = node.data;
    const pulse = d.pulse ? 1 + 0.08 * Math.sin(performance.now() / 420 * d.pulse) : 1;
    this.renderer.addHalo(node.position[0], node.position[1], node.position[2],
      d.radius * node.scale * pulse, d.color, d.width, node, alpha, d.dash);
    if (d.pulse) this.requestRender();
  }

  /* ------------------------------------------------------- verificacion --- */

  /** Mide fotogramas forzando rotacion continua. Lo usa tools/verify.js. */
  async benchmark(frames) {
    const total = frames || 120;
    const spin = this.autoSpin;
    this.autoSpin = false;
    const t0 = performance.now();
    let primitives = 0;
    for (let i = 0; i < total; i++) {
      this.camera.rotate(0.012, 0.004);
      this.render();
      primitives = this.renderer.stats.primitives;
      await new Promise((r) => requestAnimationFrame(r));
    }
    const elapsed = performance.now() - t0;
    this.autoSpin = spin;
    this.requestRender();
    return { fps: (total / elapsed) * 1000, ms: elapsed / total, primitives, quality: this.quality.level };
  }

  destroy() {
    this.stop();
    if (this.detachControls) this.detachControls();
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.scene.clear();
    this.listeners.clear();
  }
}

export function createEngine(canvas, options) { return new Engine(canvas, options); }
export { REPRESENTATION };
