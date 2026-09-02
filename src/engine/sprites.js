/** Cache de esferas sombreadas. Cada esfera se dibuja una vez a un canvas
 *  fuera de pantalla y luego se pinta con drawImage: es lo que permite miles de
 *  atomos a 60 fps sin WebGL. La luz es fija (arriba-izquierda) en todas las
 *  escalas, para que molecula, organulo y organo compartan volumen. */

const BUCKETS = [];
for (let r = 2; r <= 160; r = r * Math.SQRT2) BUCKETS.push(Math.round(r));
BUCKETS.push(200, 260);

export function radiusBucket(r) {
  for (const b of BUCKETS) if (r <= b) return b;
  return BUCKETS[BUCKETS.length - 1];
}

export class SpriteCache {
  constructor(theme) {
    this.theme = theme || 'light';
    this.map = new Map();
    this.bytes = 0;
    this.maxBytes = 4 * 1024 * 1024;
    this.order = [];
  }

  setTheme(theme) {
    if (theme === this.theme) return;
    this.theme = theme;
    this.clear();
  }

  clear() { this.map.clear(); this.order.length = 0; this.bytes = 0; }

  /** Devuelve un canvas con la esfera de color pedido y radio de cubeta. */
  get(color, radius, style) {
    const bucket = radiusBucket(radius);
    const key = color + '|' + bucket + '|' + (style || 'solid') + '|' + this.theme;
    let sprite = this.map.get(key);
    if (sprite) return sprite;
    sprite = this.render(color, bucket, style || 'solid');
    this.map.set(key, sprite);
    this.order.push(key);
    this.bytes += (bucket * 2 + 4) * (bucket * 2 + 4) * 4;
    while (this.bytes > this.maxBytes && this.order.length > 24) {
      const old = this.order.shift();
      const s = this.map.get(old);
      if (s) { this.bytes -= (s.width * s.height * 4); this.map.delete(old); }
    }
    return sprite;
  }

  render(color, r, style) {
    const pad = Math.max(1, Math.round(r * 0.06));
    const size = Math.ceil(r * 2 + pad * 2);
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2, cy = size / 2;
    const dark = this.theme === 'dark';

    if (style === 'flat') {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      canvas.hotspot = r;
      return canvas;
    }

    // Cuerpo: gradiente radial desplazado hacia la luz.
    const lx = cx - r * 0.34, ly = cy - r * 0.38;
    const grad = ctx.createRadialGradient(lx, ly, r * 0.06, cx, cy, r * 1.06);
    grad.addColorStop(0, mix(color, '#ffffff', dark ? 0.5 : 0.62));
    grad.addColorStop(0.42, mix(color, '#ffffff', dark ? 0.14 : 0.2));
    grad.addColorStop(0.82, color);
    grad.addColorStop(1, mix(color, dark ? '#05070b' : '#1a1a1a', dark ? 0.5 : 0.36));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    // Luz de borde: separa esferas oscuras del fondo en tema oscuro.
    if (r > 3.5) {
      ctx.strokeStyle = dark ? 'rgba(255,255,255,.20)' : 'rgba(0,0,0,.16)';
      ctx.lineWidth = Math.max(0.6, r * 0.055);
      ctx.beginPath(); ctx.arc(cx, cy, r - ctx.lineWidth / 2, 0, Math.PI * 2); ctx.stroke();
    }

    // Brillo especular pequeno.
    if (r > 5) {
      const spec = ctx.createRadialGradient(lx, ly, 0, lx, ly, r * 0.42);
      spec.addColorStop(0, 'rgba(255,255,255,' + (dark ? 0.5 : 0.62) + ')');
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = spec;
      ctx.beginPath(); ctx.arc(lx, ly, r * 0.42, 0, Math.PI * 2); ctx.fill();
    }

    canvas.hotspot = r;
    return canvas;
  }
}

/* ------------------------------------------------------------- utilidades --- */

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function parseColor(c) {
  if (!c) return [128, 128, 128];
  if (HEX.test(c)) {
    let h = c.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) { const p = m[1].split(',').map(Number); return [p[0] || 0, p[1] || 0, p[2] || 0]; }
  return [128, 128, 128];
}

export function mix(a, b, t) {
  const ca = parseColor(a), cb = parseColor(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return 'rgb(' + r + ',' + g + ',' + bl + ')';
}

export function withAlpha(color, alpha) {
  const c = parseColor(color);
  return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + alpha + ')';
}
