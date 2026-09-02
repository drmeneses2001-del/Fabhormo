import { quatIdentity, quatToMat3, boundingSphere, vec3 } from './math.js';

let nextNodeId = 1;

/** Nodo de escena. Todos los tipos comparten transformacion, visibilidad, capa
 *  y banda de escala: asi el mismo motor dibuja moleculas, organulos y organos. */
export class Node {
  constructor(kind, data, options) {
    const o = options || {};
    this.id = o.id || (kind + ':' + nextNodeId++);
    this.kind = kind;
    this.data = data || {};
    this.visible = o.visible !== false;
    this.opacity = o.opacity === undefined ? 1 : o.opacity;
    this.layer = o.layer || 0;
    this.scaleBand = o.scaleBand || null;      // [sMin, sMax] o null = siempre
    this.position = vec3(...(o.position || [0, 0, 0]));
    this.scale = o.scale === undefined ? 1 : o.scale;
    this.quat = o.quat ? Float64Array.from(o.quat) : quatIdentity();
    this.spin = o.spin || 0;                   // radianes por segundo alrededor de Y
    this.pick = o.pick || null;                // { type, id } seleccionable
    this.pickable = o.pickable !== false && !!o.pick;
    this.userData = o.userData || {};
    this._rot = new Float64Array(9);
    this._rotDirty = true;
  }

  setQuat(q) { this.quat.set(q); this._rotDirty = true; }
  setPosition(x, y, z) { this.position[0] = x; this.position[1] = y; this.position[2] = z; }

  rotation() {
    if (this._rotDirty || this.spin) { quatToMat3(this.quat, this._rot); this._rotDirty = false; }
    return this._rot;
  }

  /** Esfera envolvente en coordenadas de mundo. El radio efectivo depende de la
   *  representacion: en bolas y varillas se dibuja un tercio del radio de Van der
   *  Waals, y encuadrar con el radio completo dejaria la molecula pequena. */
  bounds() {
    const xyz = this.data.xyz || this.data.points || null;
    if (!xyz) return { center: Float64Array.from(this.position), radius: (this.data.radius || 1) * this.scale };
    let radii = this.data.radii;
    if (this.kind === 'molecule' && radii && this.data.representation !== 'spacefill') {
      if (!this._boundsRadii || this._boundsRep !== this.data.representation) {
        const k = this.data.representation === 'wire' ? 0.05 : 0.3;
        this._boundsRadii = Float32Array.from(radii, (r) => r * k);
        this._boundsRep = this.data.representation;
      }
      radii = this._boundsRadii;
    }
    const b = boundingSphere(xyz, radii);
    return {
      center: vec3(b.center[0] * this.scale + this.position[0],
                   b.center[1] * this.scale + this.position[1],
                   b.center[2] * this.scale + this.position[2]),
      radius: b.radius * this.scale,
    };
  }
}

export class Scene {
  constructor() {
    this.nodes = [];
    this.byId = new Map();
    this.background = null;
    this.version = 0;
  }

  add(node) {
    this.nodes.push(node);
    this.byId.set(node.id, node);
    this.version++;
    return node;
  }

  remove(idOrNode) {
    const id = typeof idOrNode === 'string' ? idOrNode : idOrNode.id;
    const i = this.nodes.findIndex((n) => n.id === id);
    if (i >= 0) { this.nodes.splice(i, 1); this.byId.delete(id); this.version++; }
  }

  clear() { this.nodes.length = 0; this.byId.clear(); this.version++; }

  get(id) { return this.byId.get(id) || null; }

  /** Nodos visibles en la banda de escala pedida, ordenados por capa. */
  visibleNodes(scaleLevel) {
    const out = [];
    for (const n of this.nodes) {
      if (!n.visible || n.opacity <= 0.01) continue;
      if (n.scaleBand && scaleLevel !== undefined && scaleLevel !== null) {
        if (scaleLevel < n.scaleBand[0] - 0.5 || scaleLevel > n.scaleBand[1] + 0.5) continue;
      }
      out.push(n);
    }
    out.sort((a, b) => a.layer - b.layer);
    return out;
  }

  /** Esfera que contiene todos los nodos indicados (o todos los visibles). */
  bounds(ids) {
    const nodes = ids ? ids.map((i) => this.get(i)).filter(Boolean) : this.nodes.filter((n) => n.visible);
    if (!nodes.length) return { center: vec3(0, 0, 0), radius: 10 };
    let cx = 0, cy = 0, cz = 0;
    const spheres = nodes.map((n) => n.bounds());
    for (const s of spheres) { cx += s.center[0]; cy += s.center[1]; cz += s.center[2]; }
    cx /= spheres.length; cy /= spheres.length; cz /= spheres.length;
    let r = 1;
    for (const s of spheres) {
      const d = Math.hypot(s.center[0] - cx, s.center[1] - cy, s.center[2] - cz) + s.radius;
      if (d > r) r = d;
    }
    return { center: vec3(cx, cy, cz), radius: r };
  }
}

/* ------------------------------------------------------ fabricas de nodos --- */

/** Molecula: esferas y enlaces. xyz en angstrom, radios en angstrom. */
export function moleculeNode(mol, options) {
  const o = options || {};
  return new Node('molecule', {
    xyz: mol.xyz, radii: mol.radii, colors: mol.colors, isH: mol.isH,
    bonds: mol.bonds, atomIds: mol.atomIds || null, labels: mol.labels || null,
    surface: mol.surface || null, representation: o.representation || 'ballstick',
    highlight: null,
  }, o);
}

/** Traza de carbonos alfa u otra polilinea 3D. */
export function tubeNode(points, options) {
  const o = options || {};
  return new Node('tube', { points, width: o.width || 0.9, color: o.color || '#888', taper: o.taper !== false }, o);
}

/** Nube de puntos (superficie molecular, gradientes de concentracion). */
export function pointsNode(points, options) {
  const o = options || {};
  return new Node('points', { points, color: o.color || '#888', size: o.size || 1.6, colors: o.colors || null }, o);
}

/** Silueta vectorial con profundidad fija: anatomia, membranas, crestas. */
export function pathNode(path, options) {
  const o = options || {};
  return new Node('path', {
    path, fill: o.fill || null, stroke: o.stroke || null, lineWidth: o.lineWidth || 1.2,
    closed: o.closed !== false, dash: o.dash || null, plane: o.plane || 'xy',
  }, o);
}

/** Etiqueta anclada a una posicion del mundo, dibujada en el canvas. */
export function labelNode(text, options) {
  const o = options || {};
  return new Node('label', {
    text, color: o.color || null, size: o.size || 12, weight: o.weight || 400,
    offsetY: o.offsetY || 0, halo: o.halo !== false, font: o.font || 'sans',
  }, o);
}

/** Anillo/halo plano orientado a la camara: seleccion, portales, acumulacion. */
export function haloNode(options) {
  const o = options || {};
  return new Node('halo', {
    radius: o.radius || 1, color: o.color || '#fff', width: o.width || 2,
    pulse: o.pulse || 0, dash: o.dash || null,
  }, o);
}
