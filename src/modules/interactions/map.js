import { el, clear, icon, announce } from '../../core/dom.js';
import { byId, all, name as entityName } from '../../core/repo.js';
import { go, idFromSlug, slugFromId, linkFor } from '../../core/router.js';
import { setStageBar, crumbs, toolbar } from '../../ui/shell.js';
import { mountStage, showTooltip, hideTooltip } from '../../ui/stage.js';
import { openInspector, closeInspector } from '../../ui/inspector.js';
import { moleculeNode, labelNode, arrowNode, haloNode } from '../../engine/scene.js';
import { prepareMolecule, colorAtoms, familyColor } from '../../engine/molecule.js';
import { token } from '../../core/theme.js';

/** Mapa de interacciones: hormonas, farmacos, enzimas y receptores en un grafo
 *  de fuerzas. Las aristas salen de tres sitios distintos del mismo conjunto de
 *  datos: los ligandos declarados en cada receptor, las reacciones de la via y
 *  las interacciones curadas. */

const EDGE_STYLE = {
  agonista: { color: 'fam-androgeno', dash: null, label: 'agonista' },
  agonista_parcial: { color: 'fam-androgeno', dash: [6, 3], label: 'agonista parcial' },
  antagonista: { color: 'up', dash: [2, 3], label: 'antagonista' },
  modulador: { color: 'fam-farmaco', dash: [7, 3], label: 'modulador selectivo' },
  inhibicion_enzimatica: { color: 'up', dash: null, label: 'inhibe' },
  inhibicion_cyp: { color: 'up', dash: [4, 3], label: 'inhibe CYP' },
  sustrato: { color: 'ink-3', dash: [3, 4], label: 'sustrato de' },
  precursor: { color: 'enz-red', dash: null, label: 'precursor de' },
  antagonismo: { color: 'up', dash: [2, 3], label: 'antagoniza' },
  modulacion_selectiva: { color: 'fam-farmaco', dash: [7, 3], label: 'modula' },
  sinergia_clinica: { color: 'enz-sulf', dash: [5, 5], label: 'relación clínica' },
  otro: { color: 'ink-3', dash: [2, 4], label: 'relación' },
};

const FILTERS = [
  { value: 'todo', label: 'Todo' },
  { value: 'receptor', label: 'Receptores' },
  { value: 'enzima', label: 'Enzimas' },
  { value: 'farmaco', label: 'Fármacos' },
];

let stage = null;
let focusId = null;
let filter = 'todo';
let graph = null;
let panelBody = null;

function collectGraph() {
  const nodes = new Map();
  const edges = [];
  const addNode = (id, kind) => {
    if (!byId(id)) return null;
    if (!nodes.has(id)) nodes.set(id, { id, kind, degree: 0 });
    return nodes.get(id);
  };

  for (const rec of all('receptors')) {
    addNode(rec.id, 'receptor');
    for (const l of rec.ligands || []) {
      if (!addNode(l.mol, byId(l.mol) && byId(l.mol).role && byId(l.mol).role.includes('farmaco') ? 'farmaco' : 'hormona')) continue;
      edges.push({ a: l.mol, b: rec.id, kind: l.kind, source: 'receptor' });
    }
  }
  for (const i of all('interactions')) {
    const ka = byId(i.a), kb = byId(i.b);
    if (!ka || !kb) continue;
    addNode(i.a, kindOf(i.a));
    addNode(i.b, kindOf(i.b));
    edges.push({ a: i.a, b: i.b, kind: i.kind, mechanism: i.mechanism, clinical: i.clinical,
                 strength: i.strength, source: 'interaccion', id: i.id });
  }
  for (const e of edges) {
    if (nodes.has(e.a)) nodes.get(e.a).degree++;
    if (nodes.has(e.b)) nodes.get(e.b).degree++;
  }
  return { nodes: Array.from(nodes.values()), edges };
}

function kindOf(id) {
  const prefix = id.split(':')[0];
  if (prefix === 'enz') return 'enzima';
  if (prefix === 'rec') return 'receptor';
  if (prefix === 'drug') return 'farmaco';
  return 'hormona';
}

/** Disposicion por fuerzas, calculada una vez al montar. */
function layout(g) {
  const index = new Map(g.nodes.map((n, i) => [n.id, i]));
  const n = g.nodes.length;
  const pos = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = 40 + (i % 5) * 6;
    pos[i * 2] = Math.cos(a) * r;
    pos[i * 2 + 1] = Math.sin(a) * r;
  }
  const links = g.edges.map((e) => [index.get(e.a), index.get(e.b)]).filter(([a, b]) => a !== undefined && b !== undefined);
  const disp = new Float64Array(n * 2);
  const area = 140 * 140;
  const k = Math.sqrt(area / Math.max(1, n));
  for (let iter = 0; iter < 320; iter++) {
    const temp = 6 * (1 - iter / 320) + 0.3;
    disp.fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i * 2] - pos[j * 2], dy = pos[i * 2 + 1] - pos[j * 2 + 1];
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = (Math.random() - 0.5); dy = (Math.random() - 0.5); d2 = 0.01; }
        const f = (k * k) / d2;
        disp[i * 2] += dx * f; disp[i * 2 + 1] += dy * f;
        disp[j * 2] -= dx * f; disp[j * 2 + 1] -= dy * f;
      }
    }
    for (const [a, b] of links) {
      const dx = pos[a * 2] - pos[b * 2], dy = pos[a * 2 + 1] - pos[b * 2 + 1];
      const d = Math.max(0.6, Math.hypot(dx, dy));
      const f = (d * d) / k / d;
      disp[a * 2] -= dx * f; disp[a * 2 + 1] -= dy * f;
      disp[b * 2] += dx * f; disp[b * 2 + 1] += dy * f;
    }
    for (let i = 0; i < n; i++) {
      const dx = disp[i * 2], dy = disp[i * 2 + 1];
      const d = Math.max(0.001, Math.hypot(dx, dy));
      pos[i * 2] += (dx / d) * Math.min(d, temp) - pos[i * 2] * 0.012;
      pos[i * 2 + 1] += (dy / d) * Math.min(d, temp) - pos[i * 2 + 1] * 0.012;
    }
  }
  return { pos, index };
}

function visible(node) {
  if (filter === 'todo') return true;
  if (filter === 'receptor') return node.kind === 'receptor' || node.kind === 'hormona' || node.kind === 'farmaco';
  if (filter === 'enzima') return node.kind === 'enzima' || node.kind === 'farmaco' || node.kind === 'hormona';
  return node.kind === 'farmaco' || node.kind === 'receptor' || node.kind === 'enzima';
}

function build() {
  const scene = stage.engine.scene;
  scene.clear();
  const { pos, index } = graph.layout;
  const neighbours = new Set();
  if (focusId) {
    neighbours.add(focusId);
    for (const e of graph.edges) {
      if (e.a === focusId) neighbours.add(e.b);
      if (e.b === focusId) neighbours.add(e.a);
    }
  }

  for (const e of graph.edges) {
    const ia = index.get(e.a), ib = index.get(e.b);
    if (ia === undefined || ib === undefined) continue;
    const na = graph.nodes[ia], nb = graph.nodes[ib];
    if (!visible(na) || !visible(nb)) continue;
    const dim = focusId && !(neighbours.has(e.a) && neighbours.has(e.b));
    const style = EDGE_STYLE[e.kind] || EDGE_STYLE.otro;
    scene.add(arrowNode([pos[ia * 2], pos[ia * 2 + 1], 0], [pos[ib * 2], pos[ib * 2 + 1], 0], {
      color: token(style.color) || '#888', width: dim ? 0.7 : 1.3, dash: style.dash,
      head: 5, gapStart: 11, gapEnd: 13, alpha: dim ? 0.12 : 0.9,
      layer: -1, id: 'ix:' + e.a + '|' + e.b,
    }));
  }

  for (const node of graph.nodes) {
    if (!visible(node)) continue;
    const i = index.get(node.id);
    const p = [pos[i * 2], pos[i * 2 + 1], 0];
    const dim = focusId && !neighbours.has(node.id);
    const entity = byId(node.id);
    const color = node.kind === 'receptor' ? (token('fam-farmaco') || '#6a1b9a')
      : node.kind === 'enzima' ? (token('enz-cyp') || '#d84315')
      : familyColor(entity.family);

    if (node.kind === 'hormona' || node.kind === 'farmaco') {
      const prepared = prepareMolecule(entity, { coloring: 'family' });
      if (prepared) {
        const mol = moleculeNode({
          xyz: prepared.xyz, radii: prepared.radii,
          colors: new Array(entity.atoms.el.length).fill(color),
          isH: prepared.isH, bonds: prepared.bonds,
        }, { representation: 'wire', position: p, scale: 0.62, opacity: dim ? 0.16 : 1,
             pick: { type: 'mol', id: node.id }, id: 'n:' + node.id });
        mol.data.hydrogens = false;
        mol.data.record = entity;
        scene.add(mol);
      } else {
        scene.add(haloNode({ position: p, radius: 2.4, color, width: 1.6, opacity: dim ? 0.16 : 1,
          pick: { type: 'mol', id: node.id }, id: 'n:' + node.id }));
      }
    } else {
      scene.add(haloNode({ position: p, radius: node.kind === 'receptor' ? 3.4 : 2.6,
        color, width: node.kind === 'receptor' ? 2.4 : 1.8, opacity: dim ? 0.16 : 1,
        pick: { type: node.kind === 'receptor' ? 'rec' : 'enz', id: node.id }, id: 'n:' + node.id }));
    }

    const label = (entity.names && (entity.names.corto || entity.names.es)) || node.id;
    scene.add(labelNode(label, {
      position: [p[0], p[1] - 4.6, 0], size: 11, weight: node.kind === 'receptor' ? 600 : 400,
      color, always: !dim && (node.degree > 2 || node.id === focusId),
      avoidCollision: true, alpha: dim ? 0.2 : 1, layer: 4, id: 'l:' + node.id,
    }));
  }

  stage.engine.resetCamera(1.08);
  stage.engine.camera.orientation.set([0, 0, 0, 1]);
  stage.engine.camera.markDirty();
  stage.engine.requestRender();
  renderPanel();
}

function renderPanel() {
  if (!panelBody) return;
  clear(panelBody);
  if (!focusId) {
    panelBody.appendChild(el('div', { class: 'a-note',
      text: 'Selecciona un nodo para aislar sus relaciones. Las flechas continuas son agonismo o '
          + 'inhibición directa, las punteadas antagonismo o modulación selectiva.' }));
    panelBody.appendChild(el('div', { class: 'a-section', style: { marginTop: '14px' } }, [
      el('div', { class: 'a-section__title', text: 'Tipos de relación' }),
      ...Object.entries(EDGE_STYLE).filter(([, s], i, arr) => arr.findIndex(([, x]) => x.label === s.label) === i)
        .map(([, s]) => el('div', { class: 'a-legend__row' }, [
          el('span', { class: 'a-legend__swatch', style: { background: token(s.color), height: '2px' } }),
          el('span', { text: s.label })])),
    ]));
    return;
  }
  const entity = byId(focusId);
  panelBody.appendChild(el('div', { class: 'a-inspector__kicker', text: kindLabel(kindOf(focusId)) }));
  panelBody.appendChild(el('h2', { class: 'a-inspector__title', style: { fontSize: 'var(--fs-lg)' },
    text: entityName(focusId) }));

  const related = graph.edges.filter((e) => e.a === focusId || e.b === focusId);
  panelBody.appendChild(el('div', { class: 'a-src', style: { marginBottom: '12px' },
    text: related.length + (related.length === 1 ? ' relación' : ' relaciones') }));
  for (const e of related) {
    const other = e.a === focusId ? e.b : e.a;
    const style = EDGE_STYLE[e.kind] || EDGE_STYLE.otro;
    panelBody.appendChild(el('div', { class: 'a-section' }, [
      el('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '3px', flexWrap: 'wrap' } }, [
        el('span', { class: 'a-chip a-chip--sm', style: { '--chip-color': token(style.color) },
          text: style.label }),
        el('button', { class: 'a-list__name', style: { fontWeight: '600', textAlign: 'left' },
          onClick: () => { focusId = other; build(); }, text: entityName(other) }),
      ]),
      e.mechanism ? el('p', { style: { fontSize: 'var(--fs-md)', marginBottom: '3px' }, text: e.mechanism }) : null,
      e.clinical ? el('p', { class: 'a-muted', style: { fontSize: 'var(--fs-sm)' }, text: e.clinical }) : null,
    ].filter(Boolean)));
  }
  panelBody.appendChild(el('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap' } }, [
    el('a', { class: 'a-btn', href: linkFor(focusId) }, [icon('info'), el('span', { text: 'Ficha' })]),
    el('button', { class: 'a-btn a-btn--ghost', onClick: () => { focusId = null; build(); } },
      [el('span', { text: 'Ver todo el mapa' })]),
  ]));
}

function kindLabel(kind) {
  return { receptor: 'Receptor', enzima: 'Enzima', farmaco: 'Fármaco', hormona: 'Hormona' }[kind] || '';
}

function buildBar() {
  setStageBar([
    crumbs([{ label: 'Interacción bioquímica', href: '#/interacciones/mapa' },
            focusId ? { label: entityName(focusId), current: true } : null].filter(Boolean)),
    toolbar([
      el('div', { style: { display: 'flex', gap: '4px' } }, FILTERS.map((f) => el('button', {
        class: 'a-chip', 'data-active': filter === f.value ? 'true' : null, text: f.label,
        onClick: (e) => {
          filter = f.value;
          for (const b of e.currentTarget.parentElement.children) b.removeAttribute('data-active');
          e.currentTarget.dataset.active = 'true';
          build();
        },
      }))),
      el('a', { class: 'a-btn', href: '#/interacciones/comparar' },
        [icon('compare'), el('span', { text: 'Comparador' })]),
    ]),
  ]);
}

export function mount(host, ctx) {
  focusId = ctx.params.focus ? idFromSlug(ctx.params.focus) : null;
  if (focusId && !byId(focusId)) focusId = null;

  stage = mountStage(host, { label: 'Mapa de interacciones bioquimicas',
    engine: { autoSpin: false, quality: 3 } });
  stage.engine.camera.orthographic = true;
  stage.engine.renderer.fogStrength = 0.05;

  const side = el('div', { class: 'a-stage__aside' });
  panelBody = el('div', { style: { padding: '14px' } });
  side.appendChild(panelBody);
  stage.canvasWrap.appendChild(side);
  stage.canvas.dataset.reserveRight = window.innerWidth > 900 ? '336' : '0';
  stage.engine.handleResize(true);

  graph = collectGraph();
  graph.layout = layout(graph);

  stage.engine.on('select', (sel) => {
    focusId = sel ? sel.id : null;
    build();
    buildBar();
  });
  stage.engine.on('hover', (info) => {
    if (!info) { hideTooltip(); return; }
    const rect = stage.canvas.getBoundingClientRect();
    const item = stage.engine.renderer.pickList.find((p) => p.node && p.node.pick && p.node.pick.id === info.id);
    showTooltip(el('div', {}, [el('strong', { text: entityName(info.id) }),
      el('div', { class: 'a-tooltip__sub', text: kindLabel(kindOf(info.id)) })]),
      rect.left + (item ? item.x : 0), rect.top + (item ? item.y : 0));
  });

  buildBar();
  build();
  announce('Mapa con ' + graph.nodes.length + ' entidades y ' + graph.edges.length + ' relaciones');

  return {
    unmount() {
      hideTooltip(); closeInspector();
      if (stage) stage.destroy();
      stage = null; graph = null; panelBody = null;
    },
  };
}
