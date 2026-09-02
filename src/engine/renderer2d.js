import { SpriteCache, mix, withAlpha } from './sprites.js';
import { clamp } from './math.js';

const T_SPHERE = 0, T_BOND = 1, T_TUBE = 2, T_POINT = 3, T_PATH = 4, T_LABEL = 5, T_HALO = 6, T_ARROW = 7;

/** Render por orden del pintor sobre Canvas 2D. Reutiliza los objetos de la
 *  lista de dibujo entre fotogramas: tras el calentamiento no reserva memoria. */
export class Renderer2D {
  constructor(canvas, options) {
    const o = options || {};
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.dpr = 1;
    this.maxDpr = o.maxDpr || 2;
    this.width = 1; this.height = 1;
    this.sprites = new SpriteCache(o.theme || 'light');
    this.palette = o.palette || { fog: '#0a0e14', ink: '#e8e6e1', muted: '#737a86', halo: '#ffffff' };
    this.pool = [];
    this.count = 0;
    this.order = [];
    this.pickList = [];
    this.projected = new Map();
    this.stats = { ms: 0, primitives: 0, spheres: 0, labels: 0, culled: 0 };
    this.fogStrength = o.fogStrength === undefined ? 0.55 : o.fogStrength;
    this.labelGrid = null;
    this._labelCols = 0;
    this._labelRows = 0;
  }

  setTheme(theme, palette) {
    this.sprites.setTheme(theme);
    if (palette) this.palette = palette;
  }

  resize(cssWidth, cssHeight, dpr) {
    const d = clamp(dpr || window.devicePixelRatio || 1, 1, this.maxDpr);
    const w = Math.max(1, Math.round(cssWidth));
    const h = Math.max(1, Math.round(cssHeight));
    if (this.width === w && this.height === h && this.dpr === d) return false;
    this.width = w; this.height = h; this.dpr = d;
    this.canvas.width = Math.round(w * d);
    this.canvas.height = Math.round(h * d);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this._labelCols = Math.ceil(w / 58);
    this._labelRows = Math.ceil(h / 20);
    this.labelGrid = new Uint8Array(this._labelCols * this._labelRows);
    return true;
  }

  item() {
    if (this.count < this.pool.length) return this.pool[this.count++];
    const it = {};
    this.pool.push(it);
    this.count++;
    return it;
  }

  /* --------------------------------------------------------- proyeccion --- */

  beginFrame(camera) {
    this.count = 0;
    this.pickList.length = 0;
    this.projected.clear();
    this.cam = camera;
    this.view = camera.viewMatrix();
    this.focal = (this.height / 2) / Math.tan(camera.fov / 2);
    this.cx = this.width / 2;
    this.cy = this.height / 2;
    this.nearClip = Math.max(0.02, camera.minDistance * 0.05);
  }

  /** Mundo -> pantalla. Devuelve false si el punto queda detras de la camara. */
  project(x, y, z, out) {
    const v = this.view, cam = this.cam;
    const dx = x - cam.target[0], dy = y - cam.target[1], dz = z - cam.target[2];
    const vx = v[0] * dx + v[1] * dy + v[2] * dz - cam.panX;
    const vy = v[3] * dx + v[4] * dy + v[5] * dz - cam.panY;
    const vz = v[6] * dx + v[7] * dy + v[8] * dz;
    const depth = cam.distance - vz;
    if (depth <= this.nearClip) return false;
    const k = cam.orthographic ? this.focal / cam.distance : this.focal / depth;
    out.x = this.cx + vx * k;
    out.y = this.cy - vy * k;
    out.depth = depth;
    out.k = k;
    return true;
  }

  /* ------------------------------------------------------ lista de dibujo --- */

  addSphere(x, y, z, radius, color, node, atomIndex, alpha, style) {
    const it = this.item();
    if (!this.project(x, y, z, it)) { this.count--; this.stats.culled++; return null; }
    const r = radius * it.k;
    if (r < 0.35 || it.x < -r - 20 || it.x > this.width + r + 20 || it.y < -r - 20 || it.y > this.height + r + 20) {
      this.count--; this.stats.culled++; return null;
    }
    it.type = T_SPHERE; it.r = r; it.color = color; it.node = node;
    it.index = atomIndex === undefined ? -1 : atomIndex;
    it.alpha = alpha === undefined ? 1 : alpha;
    it.style = style || 'solid';
    if (node && node.pickable) this.pickList.push(it);
    return it;
  }

  addBond(ax, ay, az, bx, by, bz, colorA, colorB, width, node, alpha, order) {
    const a = { }, b = { };
    if (!this.project(ax, ay, az, a) || !this.project(bx, by, bz, b)) { this.stats.culled++; return null; }
    const it = this.item();
    it.type = T_BOND;
    it.x = a.x; it.y = a.y; it.x2 = b.x; it.y2 = b.y;
    it.depth = (a.depth + b.depth) * 0.5;
    it.k = (a.k + b.k) * 0.5;
    it.w = Math.max(0.6, width * it.k);
    it.color = colorA; it.color2 = colorB; it.node = node;
    it.alpha = alpha === undefined ? 1 : alpha;
    it.order = order || 1;
    return it;
  }

  addTubeSegment(ax, ay, az, bx, by, bz, color, width, node, alpha) {
    const a = {}, b = {};
    if (!this.project(ax, ay, az, a) || !this.project(bx, by, bz, b)) { this.stats.culled++; return null; }
    const it = this.item();
    it.type = T_TUBE;
    it.x = a.x; it.y = a.y; it.x2 = b.x; it.y2 = b.y;
    it.depth = (a.depth + b.depth) * 0.5;
    it.w = Math.max(0.8, width * (a.k + b.k) * 0.5);
    it.color = color; it.node = node;
    it.alpha = alpha === undefined ? 1 : alpha;
    return it;
  }

  addPoint(x, y, z, color, size, node, alpha) {
    const it = this.item();
    if (!this.project(x, y, z, it)) { this.count--; return null; }
    it.type = T_POINT; it.color = color; it.node = node;
    it.r = Math.max(0.7, size * it.k * 0.35);
    it.alpha = alpha === undefined ? 1 : alpha;
    return it;
  }

  addArrow(ax, ay, az, bx, by, bz, style, node) {
    const a = {}, b = {};
    if (!this.project(ax, ay, az, a) || !this.project(bx, by, bz, b)) { this.stats.culled++; return null; }
    const it = this.item();
    it.type = T_ARROW;
    it.x = a.x; it.y = a.y; it.x2 = b.x; it.y2 = b.y;
    it.depth = (a.depth + b.depth) * 0.5;
    it.style = style;
    it.node = node;
    it.r = 10;
    if (node && node.pickable) this.pickList.push(it);
    return it;
  }

  addPath(points2d, depth, style, node) {
    const it = this.item();
    it.type = T_PATH; it.depth = depth; it.points = points2d; it.style = style; it.node = node;
    it.x = points2d.length ? points2d[0] : 0;
    it.y = points2d.length ? points2d[1] : 0;
    if (node && node.pickable) this.pickList.push(it);
    return it;
  }

  addLabel(x, y, z, text, style, node) {
    const it = this.item();
    if (!this.project(x, y, z, it)) { this.count--; return null; }
    it.type = T_LABEL; it.text = text; it.style = style; it.node = node;
    it.r = 0;
    return it;
  }

  addHalo(x, y, z, radius, color, width, node, alpha, dash) {
    const it = this.item();
    if (!this.project(x, y, z, it)) { this.count--; return null; }
    it.type = T_HALO; it.r = radius * it.k; it.color = color; it.w = width;
    it.node = node; it.alpha = alpha === undefined ? 1 : alpha; it.dash = dash || null;
    if (node && node.pickable) this.pickList.push(it);
    return it;
  }

  /* -------------------------------------------------------------- dibujo --- */

  flush(fogRange) {
    const ctx = this.ctx;
    const n = this.count;
    if (this.order.length < n) this.order = new Array(n);
    for (let i = 0; i < n; i++) this.order[i] = i;
    const pool = this.pool;
    // Orden del pintor: de lejos a cerca. Las etiquetas van siempre encima.
    this.order.length = n;
    this.order.sort((i, j) => {
      const a = pool[i], b = pool[j];
      if (a.type === T_LABEL && b.type !== T_LABEL) return 1;
      if (b.type === T_LABEL && a.type !== T_LABEL) return -1;
      return b.depth - a.depth;
    });

    const fogNear = fogRange ? fogRange[0] : 0;
    const fogFar = fogRange ? fogRange[1] : 1e9;
    const fogSpan = Math.max(1e-6, fogFar - fogNear);
    const fogColor = this.palette.fog;
    const strength = this.fogStrength;
    if (this.labelGrid) this.labelGrid.fill(0);

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let oi = 0; oi < n; oi++) {
      const it = pool[this.order[oi]];
      const fog = strength > 0 ? clamp((it.depth - fogNear) / fogSpan, 0, 1) * strength : 0;
      switch (it.type) {
        case T_SPHERE: this.drawSphere(ctx, it, fog, fogColor); break;
        case T_BOND: this.drawBond(ctx, it, fog, fogColor); break;
        case T_TUBE: this.drawTube(ctx, it, fog, fogColor); break;
        case T_POINT: this.drawPoint(ctx, it, fog); break;
        case T_PATH: this.drawPath(ctx, it); break;
        case T_ARROW: this.drawArrow(ctx, it, fog, fogColor); break;
        case T_HALO: this.drawHalo(ctx, it); break;
        case T_LABEL: this.drawLabel(ctx, it); break;
      }
    }
    ctx.restore();
    this.stats.primitives = n;
  }

  drawSphere(ctx, it, fog, fogColor) {
    const color = fog > 0.01 ? mix(it.color, fogColor, fog) : it.color;
    ctx.globalAlpha = it.alpha;
    if (it.r > 96) {
      const g = ctx.createRadialGradient(it.x - it.r * 0.34, it.y - it.r * 0.38, it.r * 0.05, it.x, it.y, it.r * 1.05);
      g.addColorStop(0, mix(color, '#ffffff', 0.55));
      g.addColorStop(0.8, color);
      g.addColorStop(1, mix(color, '#000000', 0.3));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2); ctx.fill();
    } else {
      const sprite = this.sprites.get(color, it.r, it.style);
      const s = (it.r / sprite.hotspot) * (sprite.width / 2);
      ctx.drawImage(sprite, it.x - s, it.y - s, s * 2, s * 2);
    }
    ctx.globalAlpha = 1;
    this.stats.spheres++;
  }

  drawBond(ctx, it, fog, fogColor) {
    const mx = (it.x + it.x2) / 2, my = (it.y + it.y2) / 2;
    const ca = fog > 0.01 ? mix(it.color, fogColor, fog) : it.color;
    const cb = fog > 0.01 ? mix(it.color2, fogColor, fog) : it.color2;
    ctx.globalAlpha = it.alpha;
    if (it.order >= 2 && it.w > 2.2) {
      // Enlaces multiples: lineas paralelas desplazadas en el plano de pantalla.
      const dx = it.x2 - it.x, dy = it.y2 - it.y;
      const len = Math.hypot(dx, dy) || 1;
      const ox = (-dy / len) * it.w * 0.42, oy = (dx / len) * it.w * 0.42;
      const w = it.w * (it.order === 3 ? 0.3 : 0.42);
      const offsets = it.order === 3 ? [-1, 0, 1] : [-1, 1];
      for (const k of offsets) this.strokeHalfBond(ctx, it, ca, cb, mx, my, ox * k, oy * k, w);
    } else {
      this.strokeHalfBond(ctx, it, ca, cb, mx, my, 0, 0, it.w);
    }
    ctx.globalAlpha = 1;
  }

  strokeHalfBond(ctx, it, ca, cb, mx, my, ox, oy, w) {
    ctx.lineWidth = w;
    ctx.strokeStyle = ca;
    ctx.beginPath(); ctx.moveTo(it.x + ox, it.y + oy); ctx.lineTo(mx + ox, my + oy); ctx.stroke();
    ctx.strokeStyle = cb;
    ctx.beginPath(); ctx.moveTo(mx + ox, my + oy); ctx.lineTo(it.x2 + ox, it.y2 + oy); ctx.stroke();
  }

  drawTube(ctx, it, fog, fogColor) {
    ctx.globalAlpha = it.alpha;
    ctx.strokeStyle = fog > 0.01 ? mix(it.color, fogColor, fog) : it.color;
    ctx.lineWidth = it.w;
    ctx.beginPath(); ctx.moveTo(it.x, it.y); ctx.lineTo(it.x2, it.y2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawPoint(ctx, it, fog) {
    ctx.globalAlpha = it.alpha * (1 - fog * 0.75);
    ctx.fillStyle = it.color;
    const d = it.r * 2;
    if (d <= 2.4) ctx.fillRect(it.x - it.r, it.y - it.r, d, d);
    else { ctx.beginPath(); ctx.arc(it.x, it.y, it.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  drawPath(ctx, it) {
    const p = it.points;
    if (!p || p.length < 4) return;
    const st = it.style || {};
    ctx.globalAlpha = st.alpha === undefined ? 1 : st.alpha;
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    if (st.closed !== false) ctx.closePath();
    if (st.fill) { ctx.fillStyle = st.fill; ctx.fill(); }
    if (st.stroke) {
      ctx.strokeStyle = st.stroke;
      ctx.lineWidth = st.lineWidth || 1.2;
      if (st.dash) ctx.setLineDash(st.dash); else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }

  drawArrow(ctx, it, fog, fogColor) {
    const st = it.style || {};
    const color = fog > 0.01 ? mix(st.color || this.palette.muted, fogColor, fog * 0.7) : (st.color || this.palette.muted);
    let dx = it.x2 - it.x, dy = it.y2 - it.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return;
    dx /= len; dy /= len;
    // Se recorta en los dos extremos para no invadir los nodos que une.
    const gapA = st.gapStart === undefined ? 16 : st.gapStart;
    const gapB = st.gapEnd === undefined ? 18 : st.gapEnd;
    if (len < gapA + gapB + 6) return;
    const x1 = it.x + dx * gapA, y1 = it.y + dy * gapA;
    const x2 = it.x2 - dx * gapB, y2 = it.y2 - dy * gapB;
    ctx.globalAlpha = st.alpha === undefined ? 1 : st.alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = st.width || 1.4;
    if (st.dash) ctx.setLineDash(st.dash);
    ctx.beginPath();
    if (st.curve) {
      const mx = (x1 + x2) / 2 - dy * st.curve, my = (y1 + y2) / 2 + dx * st.curve;
      ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2);
    } else {
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    const head = st.head === undefined ? 7 : st.head;
    if (head > 0) {
      this.arrowHead(ctx, x2, y2, dx, dy, head, color);
      if (st.doubleHead) this.arrowHead(ctx, x1, y1, -dx, -dy, head, color);
    }
    ctx.globalAlpha = 1;
  }

  arrowHead(ctx, x, y, dx, dy, size, color) {
    const nx = -dy, ny = dx;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - dx * size + nx * size * 0.45, y - dy * size + ny * size * 0.45);
    ctx.lineTo(x - dx * size - nx * size * 0.45, y - dy * size - ny * size * 0.45);
    ctx.closePath();
    ctx.fill();
  }

  drawHalo(ctx, it) {
    ctx.globalAlpha = it.alpha;
    ctx.strokeStyle = it.color;
    ctx.lineWidth = it.w;
    if (it.dash) ctx.setLineDash(it.dash);
    ctx.beginPath(); ctx.arc(it.x, it.y, Math.max(2, it.r), 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  drawLabel(ctx, it) {
    const st = it.style || {};
    const size = st.size || 12;
    const y = it.y + (st.offsetY || 0);
    // Rejilla de ocupacion: evita que las etiquetas se pisen sin coste de layout.
    if (this.labelGrid && st.avoidCollision !== false) {
      const col = Math.floor(clamp(it.x, 0, this.width - 1) / 58);
      const row = Math.floor(clamp(y, 0, this.height - 1) / 20);
      const cell = row * this._labelCols + col;
      if (this.labelGrid[cell]) return;
      this.labelGrid[cell] = 1;
    }
    ctx.globalAlpha = st.alpha === undefined ? 1 : st.alpha;
    const family = st.font === 'serif' ? 'AtlasSerif, Georgia, serif'
      : st.font === 'mono' ? 'AtlasMono, ui-monospace, monospace'
      : 'AtlasSans, system-ui, sans-serif';
    ctx.font = (st.weight || 400) + ' ' + size + 'px ' + family;
    ctx.textAlign = st.align || 'center';
    ctx.textBaseline = st.baseline || 'middle';
    if (st.halo !== false) {
      ctx.strokeStyle = this.palette.fog;
      ctx.lineWidth = Math.max(2, size * 0.28);
      ctx.lineJoin = 'round';
      ctx.strokeText(it.text, it.x, y);
    }
    ctx.fillStyle = st.color || this.palette.ink;
    ctx.fillText(it.text, it.x, y);
    ctx.globalAlpha = 1;
    this.stats.labels++;
  }

  clearScreen(color) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = color || this.palette.fog;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /* ------------------------------------------------------------ seleccion --- */

  /** Elemento seleccionable mas cercano al puntero, el mas proximo en profundidad. */
  hitTest(px, py) {
    let best = null;
    for (const it of this.pickList) {
      const r = Math.max(it.r || 0, 6);
      const dx = px - it.x, dy = py - it.y;
      if (dx * dx + dy * dy > r * r) continue;
      if (!best || it.depth < best.depth) best = it;
    }
    return best;
  }

  screenPosition(nodeId) { return this.projected.get(nodeId) || null; }
  rememberPosition(nodeId, x, y, depth, r) { this.projected.set(nodeId, { x, y, depth, r }); }
}

export { T_SPHERE, T_BOND, T_TUBE, T_POINT, T_PATH, T_LABEL, T_HALO, T_ARROW, withAlpha };
