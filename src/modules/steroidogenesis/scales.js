import { el, clear, icon, announce } from '../../core/dom.js';
import { byId, all, name as entityName } from '../../core/repo.js';
import { go, idFromSlug, slugFromId, linkFor } from '../../core/router.js';
import { setStageBar, crumbs, toolbar } from '../../ui/shell.js';
import { mountStage, showTooltip, hideTooltip } from '../../ui/stage.js';
import { openInspector, closeInspector, compartmentLabel } from '../../ui/inspector.js';
import { moleculeNode, labelNode, pathNode, haloNode, Node } from '../../engine/scene.js';
import { bodyOutline, toPath3, ellipsePath, cellOutline, mitochondrion, erCisternae, nucleus, spread }
  from '../../engine/shapes.js';
import { prepareMolecule, colorAtoms, familyColor } from '../../engine/molecule.js';
import { token } from '../../core/theme.js';

/** Seis escalas sobre una sola escena: el cuerpo, el organo, la celula, el
 *  organulo, la enzima y la molecula. La camara recorre el eje de escala con
 *  fundido entre bandas, de modo que nunca se pierde la referencia de donde se
 *  esta mirando. */

const SCALES = [
  { level: 0, label: 'Cuerpo', hint: '~1,7 m' },
  { level: 1, label: 'Organo', hint: '1–10 cm' },
  { level: 2, label: 'Celula', hint: '~20 µm' },
  { level: 3, label: 'Organulo', hint: '~1 µm' },
  { level: 4, label: 'Enzima', hint: '~8 nm' },
  { level: 5, label: 'Molecula', hint: '~1 nm' },
];

let stage = null;
let tissue = null;
let level = 0;
let crumbHost = null;

/** Cada escala vive en su propia franja del eje Z: al bajar de escala la camara
 *  avanza y la banda anterior se desvanece. */
const BAND_Z = [0, -260, -520, -780, -1040, -1300];
const BAND_SPAN = 0.45;

function band(l) { return [l - BAND_SPAN, l + BAND_SPAN]; }

function buildScene() {
  const scene = stage.engine.scene;
  scene.clear();
  buildBody(scene);
  if (tissue) {
    buildOrgan(scene);
    buildCell(scene);
    buildOrganelle(scene);
    buildEnzyme(scene);
    buildMolecule(scene);
  }
  goToLevel(level, false);
}

/* ------------------------------------------------------------ escala 0: cuerpo --- */

function buildBody(scene) {
  const z = BAND_Z[0];
  const line = token('line-strong') || '#bbb';
  const outline = toPath3(bodyOutline(sexOf(tissue)), z - 4);
  scene.add(pathNode(outline, {
    stroke: line, fill: token('surface-2'), lineWidth: 1.4, scaleBand: band(0),
    layer: -4, id: 'body:outline',
  }));
  scene.add(labelNode('Esquema, no anatomia a escala', {
    position: [0, -6, z], size: 11, color: token('ink-3'), always: true,
    scaleBand: band(0), layer: 2, id: 'body:disclaimer',
  }));

  const organs = all('organs').filter((o) => o.anchor);
  for (const organ of organs) {
    if (organ.sex === 'xx' && sexOf(tissue) === 'xy') continue;
    if (organ.sex === 'xy' && sexOf(tissue) === 'xx') continue;
    const [x, y, r] = organ.anchor;
    const isSource = organ.kind === 'sintesis' || organ.kind === 'ambos';
    const color = isSource ? (token('accent') || '#0b5cad') : (token('ink-3') || '#888');
    const highlight = tissue && byId(tissue) && byId(tissue).organ === organ.id;
    scene.add(new Node('molecule', {
      xyz: new Float32Array([x, y, z, -x, y, z].slice(0, x === 0 ? 3 : 6)),
      radii: new Float32Array(x === 0 ? [r] : [r, r]),
      colors: x === 0 ? [color] : [color, color],
      isH: new Uint8Array(x === 0 ? 1 : 2),
      bonds: { a: new Uint16Array(0), b: new Uint16Array(0), order: new Uint8Array(0) },
      representation: 'spacefill', hydrogens: false,
    }, {
      scaleBand: band(0), layer: -1, id: 'organ:' + organ.id,
      pick: { type: 'org', id: organ.id },
      opacity: highlight ? 1 : 0.85,
    }));
    const toLeft = LEFT_LABELS.has(organ.id);
    scene.add(labelNode(organ.names.es, {
      position: [labelX(x, r, toLeft), y, z + 1], size: 11,
      color: highlight ? token('accent') : token('ink-2'),
      weight: highlight ? 600 : 400, always: highlight,
      align: toLeft ? 'right' : 'left', avoidCollision: !highlight,
      scaleBand: band(0), layer: 3, id: 'organlbl:' + organ.id,
    }));
    if (highlight) {
      scene.add(haloNode({ position: [x, y, z + 1], radius: r + 1.6, color: token('accent'),
        width: 1.8, pulse: 1, scaleBand: band(0), layer: 2, id: 'organhalo:' + organ.id }));
    }
  }
}

// Reparto de etiquetas para que el tronco no se sature por un solo lado.
/** Las etiquetas se apartan de la silueta: en la cabeza y la linea media los
 *  organos son pequenos y el texto acabaria encima del dibujo. */
function labelX(x, r, toLeft) {
  const d = Math.max(Math.abs(x) + r + 1.6, 17.5);
  return toLeft ? -d : d;
}

const LEFT_LABELS = new Set(['org:hipotalamo', 'org:cerebro', 'org:endotelio', 'org:utero',
  'org:placenta', 'org:prostata', 'org:genitales_externos', 'org:hueso', 'org:laringe']);

function sexOf(tissueId) {
  const t = tissueId && byId(tissueId);
  if (!t) return 'ambos';
  if (['tis:teca', 'tis:granulosa', 'tis:cuerpo_luteo', 'tis:sincitiotrofoblasto'].includes(t.id)) return 'xx';
  if (['tis:leydig', 'tis:prostata_estroma'].includes(t.id)) return 'xy';
  return 'ambos';
}

/* ------------------------------------------------------------ escala 1: organo --- */

function buildOrgan(scene) {
  const t = byId(tissue);
  const organ = byId(t.organ);
  const z = BAND_Z[1];
  const accent = token('accent') || '#0b5cad';
  const line = token('line-strong') || '#bbb';

  scene.add(pathNode(ellipsePath(0, 0, 34, 24, z - 3), {
    stroke: line, fill: null, lineWidth: 1.6, scaleBand: band(1), layer: -3, id: 'organ:shape',
  }));
  scene.add(labelNode(organ ? organ.names.es : t.organ, {
    position: [0, 27, z], size: 15, weight: 600, color: token('ink'), font: 'serif',
    always: true, scaleBand: band(1), layer: 3, id: 'organ:title',
  }));

  // Zonas o poblaciones celulares del organo, con la del tejido activo resaltada.
  const siblings = all('tissues').filter((x) => x.organ === t.organ);
  const positions = spread(Math.max(siblings.length, 1), 19, 13, Math.PI / 2);
  siblings.forEach((sib, i) => {
    const [x, y] = positions[i];
    const active = sib.id === tissue;
    scene.add(pathNode(toPath3(cellOutline(9.5, 0.1, i + 3), z - 1), {
      stroke: active ? accent : line, fill: null, lineWidth: active ? 1.8 : 1.1,
      scaleBand: band(1), layer: -2, id: 'zone:' + sib.id,
      position: [x, y, 0], pick: { type: 'tis', id: sib.id },
    }));
    scene.add(labelNode(sib.names.es, {
      position: [x, y - 11.5, z], size: 11, weight: active ? 600 : 400,
      color: active ? accent : token('ink-2'), always: true,
      scaleBand: band(1), layer: 3, id: 'zonelbl:' + sib.id,
    }));
  });
}

/* ------------------------------------------------------------ escala 2: celula --- */

function buildCell(scene) {
  const t = byId(tissue);
  const z = BAND_Z[2];
  const accent = token('accent') || '#0b5cad';
  const mito = token('comp-mito') || '#8d2f2f';
  const rel = token('comp-rel') || '#35618f';

  scene.add(pathNode(toPath3(cellOutline(30, 0.09, 11), z - 3), {
    stroke: accent, fill: null, lineWidth: 1.8, scaleBand: band(2), layer: -3, id: 'cell:membrane',
  }));
  scene.add(labelNode(t.cell, {
    position: [0, 33, z], size: 15, weight: 600, color: token('ink'), font: 'serif',
    always: true, scaleBand: band(2), layer: 3, id: 'cell:title',
  }));
  scene.add(pathNode(nucleus(8), {
    stroke: token('ink-3'), fill: null, lineWidth: 1.2, scaleBand: band(2), layer: -2,
    position: [-13, 9, z - 2], id: 'cell:nucleus',
  }));
  scene.add(labelNode('Nucleo', { position: [-13, -1, z], size: 10, color: token('ink-3'),
    always: true, scaleBand: band(2), layer: 3, id: 'cell:nucleuslbl' }));

  // Mitocondrias y reticulo liso, con las enzimas que el tejido expresa en cada uno.
  const enzymes = (t.expression || []).filter((e) => e.level > 0).map((e) => byId(e.enzyme)).filter(Boolean);
  const inMito = enzymes.filter((e) => e.compartment === 'mitocondria_membrana_interna');
  const inRel = enzymes.filter((e) => e.compartment === 'reticulo_endoplasmico_liso');

  [[11, 13], [17, -3], [4, -14]].forEach((p, i) => {
    const m = mitochondrion(7, 4.2);
    scene.add(pathNode(m.outer, { stroke: mito, fill: null, lineWidth: 1.4,
      position: [p[0], p[1], z - 1], scaleBand: band(2), layer: -2, id: 'cell:mito' + i }));
    scene.add(pathNode(m.inner, { stroke: mito, fill: null, lineWidth: 0.9,
      position: [p[0], p[1], z - 0.6], scaleBand: band(2), layer: -2, id: 'cell:mitoin' + i,
      opacity: 0.75 }));
  });
  scene.add(labelNode('Mitocondria · ' + inMito.length + ' enzimas', {
    position: [13, 18, z], size: 10, color: mito, always: true,
    scaleBand: band(2), layer: 3, id: 'cell:mitolbl' }));

  for (const [i, sheet] of erCisternae(30, 4, 3.4).entries()) {
    scene.add(pathNode(toPath3Flat(sheet), {
      stroke: rel, fill: null, lineWidth: 1.2, closed: false,
      position: [-8, -18, z - 1], scaleBand: band(2), layer: -2, id: 'cell:er' + i,
    }));
  }
  scene.add(labelNode('Reticulo endoplasmico liso · ' + inRel.length + ' enzimas', {
    position: [-8, -27, z], size: 10, color: rel, always: true,
    scaleBand: band(2), layer: 3, id: 'cell:erlbl' }));
}

function toPath3Flat(arr) {
  if (arr instanceof Float64Array && arr.length % 3 === 0) return arr;
  return toPath3(arr, 0);
}

/* --------------------------------------------------------- escala 3: organulo --- */

function buildOrganelle(scene) {
  const t = byId(tissue);
  const z = BAND_Z[3];
  const mito = token('comp-mito') || '#8d2f2f';
  const enzymes = (t.expression || []).filter((e) => e.level > 0).map((e) => byId(e.enzyme)).filter(Boolean);
  const inMito = enzymes.filter((e) => e.compartment === 'mitocondria_membrana_interna');
  const shape = mitochondrion(30, 17);

  scene.add(pathNode(shape.outer, { stroke: mito, fill: null, lineWidth: 1.6,
    position: [0, 0, z - 3], scaleBand: band(3), layer: -3, id: 'orgn:outer' }));
  scene.add(pathNode(shape.inner, { stroke: mito, fill: null, lineWidth: 1.2,
    position: [0, 0, z - 2], scaleBand: band(3), layer: -3, id: 'orgn:inner' }));
  scene.add(labelNode('Membrana mitocondrial interna', {
    position: [0, 21, z], size: 13, weight: 600, color: mito, always: true,
    scaleBand: band(3), layer: 3, id: 'orgn:title' }));

  const positions = spread(Math.max(inMito.length, 1), 24, 13, 0.4);
  inMito.forEach((enz, i) => {
    const [x, y] = positions[i];
    scene.add(haloNode({ position: [x, y, z], radius: 3.4, color: token('enz-cyp'), width: 2.2,
      scaleBand: band(3), layer: 1, id: 'orgn:enz' + enz.id,
      pick: { type: 'enz', id: enz.id } }));
    scene.add(labelNode(enz.names.corto, {
      position: [x, y - 5.6, z], size: 11, weight: 600, color: token('enz-cyp'), always: true,
      scaleBand: band(3), layer: 3, id: 'orgn:enzlbl' + enz.id }));
  });
  scene.add(labelNode('Aqui trabajan las enzimas mitocondriales del tejido', {
    position: [0, -22, z], size: 10, color: token('ink-3'), always: true,
    scaleBand: band(3), layer: 3, id: 'orgn:hint' }));
}

/* ------------------------------------------------------------ escala 4: enzima --- */

function buildEnzyme(scene) {
  const t = byId(tissue);
  const z = BAND_Z[4];
  const enzyme = mainEnzyme(t);
  if (!enzyme) return;
  const color = token('enz-cyp') || '#d84315';

  scene.add(pathNode(toPath3(cellOutline(22, 0.22, 21), z - 3), {
    stroke: color, fill: null, lineWidth: 2, scaleBand: band(4), layer: -3, id: 'enz:shape',
    pick: { type: 'enz', id: enzyme.id },
  }));
  scene.add(labelNode(enzyme.names.es, {
    position: [0, 26, z], size: 15, weight: 600, color: token('ink'), font: 'serif',
    always: true, scaleBand: band(4), layer: 3, id: 'enz:title' }));
  scene.add(labelNode('gen ' + enzyme.gene + ' · ' + compartmentLabel(enzyme.compartment), {
    position: [0, 22, z], size: 11, color: token('ink-3'), always: true,
    scaleBand: band(4), layer: 3, id: 'enz:sub' }));
  scene.add(labelNode('Representacion esquematica: no hay estructura cristalografica cargada', {
    position: [0, -25, z], size: 10, color: token('ink-3'), always: true,
    scaleBand: band(4), layer: 3, id: 'enz:disclaimer' }));

  const acts = enzyme.activities || [];
  acts.forEach((a, i) => {
    const y = 6 - i * 7;
    scene.add(labelNode(a.label, { position: [0, y, z], size: 11, color, always: true,
      scaleBand: band(4), layer: 3, id: 'enz:act' + i }));
  });
  const cofactors = new Set();
  for (const a of acts) for (const c of a.cofactors || []) cofactors.add(c);
  Array.from(cofactors).forEach((c, i) => {
    const [x, y] = spread(Math.max(cofactors.size, 1), 17, 11, 1.1)[i];
    scene.add(haloNode({ position: [x, y, z], radius: 2.4, color: token('ink-3'), width: 1.4,
      scaleBand: band(4), layer: 1, id: 'enz:cof' + i }));
    scene.add(labelNode(c, { position: [x, y - 4, z], size: 10, color: token('ink-3'), always: true,
      scaleBand: band(4), layer: 3, id: 'enz:coflbl' + i }));
  });
}

function mainEnzyme(t) {
  const expressed = (t.expression || []).filter((e) => e.level >= 1).map((e) => byId(e.enzyme)).filter(Boolean);
  return expressed.find((e) => e.family === 'CYP') || expressed[0] || null;
}

/* ---------------------------------------------------------- escala 5: molecula --- */

function buildMolecule(scene) {
  const t = byId(tissue);
  const z = BAND_Z[5];
  const molId = (t.produces || [])[0];
  const record = molId && byId(molId);
  if (!record || !record.atoms.xyz.length) return;
  const prepared = prepareMolecule(record, { coloring: 'element' });
  const node = moleculeNode({
    xyz: prepared.xyz, radii: prepared.radii, colors: prepared.colors,
    isH: prepared.isH, bonds: prepared.bonds,
  }, {
    representation: 'ballstick', position: [0, 0, z], scale: 2.6, spin: 0.2,
    scaleBand: band(5), layer: 0, id: 'mol:node', pick: { type: 'mol', id: record.id },
  });
  node.data.record = record;
  node.data.hydrogens = false;
  scene.add(node);
  scene.add(labelNode(record.names.es, {
    position: [0, -16, z], size: 15, weight: 600, color: familyColor(record.family),
    font: 'serif', always: true, scaleBand: band(5), layer: 3, id: 'mol:lbl' }));
  scene.add(labelNode('Producto principal del tejido', {
    position: [0, -20, z], size: 11, color: token('ink-3'), always: true,
    scaleBand: band(5), layer: 3, id: 'mol:hint' }));
}

/* ------------------------------------------------------------------ camara --- */

function goToLevel(next, animate) {
  level = Math.max(0, Math.min(5, next));
  const z = BAND_Z[level];
  const radius = level === 0 ? 56 : 34;
  const target = { target: [0, level === 0 ? 50 : 0, z], orientation: [0, 0, 0, 1],
                   distance: radius / Math.tan(stage.engine.camera.fov / 2) * 1.05,
                   panX: 0, panY: 0, orthographic: false };
  if (animate) {
    stage.engine.flyTo(target, 620);
    stage.engine.setScaleLevel(level, true);
  } else {
    stage.engine.camera.setState(target);
    stage.engine.setScaleLevel(level, false);
  }
  renderCrumbs();
  buildBar();
  announce('Escala ' + SCALES[level].label);
}

function renderCrumbs() {
  if (!crumbHost) return;
  clear(crumbHost);
  const t = tissue && byId(tissue);
  const organ = t && byId(t.organ);
  const enzyme = t && mainEnzyme(t);
  const mol = t && byId((t.produces || [])[0]);
  const labels = [
    'Cuerpo', organ ? organ.names.es : 'Organo', t ? t.cell : 'Celula',
    'Mitocondria', enzyme ? enzyme.names.corto : 'Enzima', mol ? mol.names.corto : 'Molecula',
  ];
  labels.forEach((label, i) => {
    if (i) crumbHost.appendChild(el('span', { class: 'a-crumbs__sep', text: '›' }));
    crumbHost.appendChild(el('button', {
      text: label, 'aria-current': i === level ? 'page' : null,
      disabled: !tissue && i > 0,
      onClick: () => goToLevel(i, true),
    }));
  });
}

function buildBar() {
  const bar = [
    el('div', { class: 'a-crumbs', id: 'scaleCrumbs' }),
    toolbar([
      el('div', { class: 'a-btngroup' }, [
        el('button', { class: 'a-btn', title: 'Subir de escala', disabled: level === 0,
          onClick: () => goToLevel(level - 1, true) }, el('span', { text: '−' })),
        el('button', { class: 'a-btn', title: 'Bajar de escala', disabled: level === 5 || !tissue,
          onClick: () => goToLevel(level + 1, true) }, el('span', { text: '+' })),
      ]),
      el('span', { class: 'a-src', text: SCALES[level].label + ' · ' + SCALES[level].hint }),
    ]),
  ];
  setStageBar(bar);
  crumbHost = document.getElementById('scaleCrumbs');
  renderCrumbs();
}

/* ------------------------------------------------------------------ montaje --- */

function tissuePanel() {
  const panel = el('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } });
  panel.appendChild(el('div', { style: { padding: '11px 12px 8px', borderBottom: '1px solid var(--line)' } }, [
    el('div', { class: 'a-section__title', style: { marginBottom: '3px' }, text: 'Donde ocurre' }),
    el('div', { class: 'a-src', text: 'Elige un tejido y baja del cuerpo a la molecula.' }),
  ]));
  const list = el('div', { class: 'a-list', style: { overflowY: 'auto', flex: '1', padding: '6px' } });
  for (const t of all('tissues')) {
    const organ = byId(t.organ);
    list.appendChild(el('button', {
      class: 'a-list__item', 'data-active': tissue === t.id ? 'true' : null,
      onClick: () => go('#/esteroidogenesis/escalas/' + slugFromId(t.id)),
    }, [
      el('div', { class: 'a-list__main' }, [
        el('div', { class: 'a-list__name', text: t.names.es }),
        el('div', { class: 'a-list__meta', text: (organ ? organ.names.es + ' · ' : '') +
          (t.produces || []).map((m) => entityName(m)).slice(0, 2).join(', ') }),
      ]),
    ]));
  }
  panel.appendChild(list);
  return panel;
}

export function mount(host, ctx) {
  tissue = ctx.params.tissue ? idFromSlug(ctx.params.tissue) : null;
  if (tissue && !byId(tissue)) tissue = null;
  level = tissue ? 1 : 0;

  stage = mountStage(host, {
    label: 'Recorrido por escalas, del cuerpo a la molecula',
    panel: tissuePanel(),
    engine: { autoSpin: false, quality: 3 },
  });
  stage.engine.renderer.fogStrength = 0.18;

  stage.engine.on('select', (sel) => {
    if (!sel) return;
    if (sel.type === 'org') {
      const first = all('tissues').find((t) => t.organ === sel.id);
      if (first) { go('#/esteroidogenesis/escalas/' + slugFromId(first.id)); return; }
      openInspector(sel.id, { tab: 'accion' });
    } else if (sel.type === 'tis') {
      go('#/esteroidogenesis/escalas/' + slugFromId(sel.id));
    } else {
      openInspector(sel.id);
    }
  });

  stage.engine.on('hover', (info) => {
    if (!info) { hideTooltip(); return; }
    const rect = stage.canvas.getBoundingClientRect();
    const item = stage.engine.renderer.pickList.find((p) => p.node && p.node.pick && p.node.pick.id === info.id);
    const label = info.type === 'org' || info.type === 'tis' || info.type === 'enz' || info.type === 'mol'
      ? entityName(info.id) : info.id;
    showTooltip(el('div', {}, [el('strong', { text: label }),
      el('div', { class: 'a-tooltip__sub', text: 'Doble clic para entrar' })]),
      rect.left + (item ? item.x : 0), rect.top + (item ? item.y : 0));
  });

  // La rueda cruza de escala cuando se llega al limite del zoom de la actual.
  stage.engine.on('zoom', () => {
    const d = stage.engine.camera.distance;
    if (d < 26 && level < 5 && tissue) goToLevel(level + 1, true);
    else if (d > 190 && level > 0) goToLevel(level - 1, true);
  });

  buildBar();
  buildScene();

  return {
    unmount() {
      hideTooltip(); closeInspector();
      if (stage) stage.destroy();
      stage = null; crumbHost = null;
    },
  };
}
