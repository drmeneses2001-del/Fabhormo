import { el, clear, icon, announce, num } from '../../core/dom.js';
import { byId, all, name as entityName } from '../../core/repo.js';
import { go, idFromSlug, slugFromId, linkFor } from '../../core/router.js';
import * as store from '../../core/store.js';
import { setStageBar, crumbs, toolbar } from '../../ui/shell.js';
import { mountStage, buttonGroup, selectField } from '../../ui/stage.js';
import { moleculeNode, labelNode } from '../../engine/scene.js';
import { prepareMolecule, colorAtoms, coreAtomMap, structuralDiff, familyColor } from '../../engine/molecule.js';
import { kabsch, applyKabsch, rmsd } from '../../engine/math.js';
import { token } from '../../core/theme.js';

/** Comparador de estructuras. Las dos moleculas viven en la misma escena y bajo
 *  la misma camara, de modo que la rotacion esta sincronizada por construccion.
 *  En modo superpuesto se alinean por Kabsch sobre los atomos que comparten
 *  numeracion esteroidea. */

const PRESETS = [
  { a: 'mol:testosterona', b: 'mol:dht', label: 'Testosterona y DHT' },
  { a: 'mol:estradiol', b: 'drug:etinilestradiol', label: 'Estradiol y etinilestradiol' },
  { a: 'mol:progesterona', b: 'drug:levonorgestrel', label: 'Progesterona y levonorgestrel' },
  { a: 'mol:testosterona', b: 'drug:nandrolona', label: 'Testosterona y nandrolona' },
  { a: 'mol:cortisol', b: 'mol:aldosterona', label: 'Cortisol y aldosterona' },
  { a: 'mol:testosterona', b: 'mol:estradiol', label: 'Testosterona y estradiol' },
  { a: 'mol:dhea', b: 'mol:androstenediol', label: 'DHEA y androstenediol' },
  { a: 'drug:levonorgestrel', b: 'drug:drospirenona', label: 'Levonorgestrel y drospirenona' },
];

let stage = null;
let idA = 'mol:testosterona';
let idB = 'mol:dht';
let mode = 'lado';
let coloring = 'rings';
let panelBody = null;

function withGeometry() {
  return all('molecules').filter((m) => m.atoms && m.atoms.xyz && m.atoms.xyz.length)
    .slice().sort((x, y) => x.names.es.localeCompare(y.names.es, 'es'));
}

function build() {
  const scene = stage.engine.scene;
  scene.clear();
  const a = byId(idA), b = byId(idB);
  if (!a || !b) return;

  const pa = prepareMolecule(a, { coloring });
  const pb = prepareMolecule(b, { coloring });
  if (!pa || !pb) return;

  const pairs = coreAtomMap(a, b);
  let alignedB = pb.xyz;
  let fitRmsd = null;
  if (pairs.length >= 3) {
    const mobile = new Float64Array(pairs.length * 3);
    const target = new Float64Array(pairs.length * 3);
    pairs.forEach(([i, j], k) => {
      target[k * 3] = pa.xyz[i * 3]; target[k * 3 + 1] = pa.xyz[i * 3 + 1]; target[k * 3 + 2] = pa.xyz[i * 3 + 2];
      mobile[k * 3] = pb.xyz[j * 3]; mobile[k * 3 + 1] = pb.xyz[j * 3 + 1]; mobile[k * 3 + 2] = pb.xyz[j * 3 + 2];
    });
    const fit = kabsch(mobile, target);
    const out = applyKabsch(fit, Float64Array.from(pb.xyz));
    alignedB = Float32Array.from(out);
    const fitted = new Float64Array(pairs.length * 3);
    pairs.forEach(([, j], k) => {
      fitted[k * 3] = alignedB[j * 3]; fitted[k * 3 + 1] = alignedB[j * 3 + 1]; fitted[k * 3 + 2] = alignedB[j * 3 + 2];
    });
    fitRmsd = rmsd(fitted, target);
  }

  const offset = mode === 'lado' ? 8.5 : 0;
  addMolecule(scene, a, pa, pa.xyz, [-offset, 0, 0], 'A', mode === 'superpuesto' ? 0.85 : 1);
  addMolecule(scene, b, pb, mode === 'superpuesto' ? alignedB : pb.xyz, [offset, 0, 0], 'B',
    mode === 'superpuesto' ? 0.7 : 1);

  stage.engine.resetCamera(mode === 'lado' ? 1.12 : 1.35);
  stage.engine.requestRender();
  renderPanel(fitRmsd, pairs.length);
}

function addMolecule(scene, record, prepared, xyz, position, tag, opacity) {
  const colors = mode === 'superpuesto'
    ? new Array(record.atoms.el.length).fill(familyColor(record.family))
    : colorAtoms(record, coloring);
  const node = moleculeNode({
    xyz, radii: prepared.radii, colors, isH: prepared.isH, bonds: prepared.bonds,
  }, {
    representation: mode === 'superpuesto' ? 'sticks' : 'ballstick',
    position, id: 'cmp:' + tag, opacity,
    pick: { type: 'mol', id: record.id },
  });
  node.data.record = record;
  node.data.hydrogens = false;
  scene.add(node);
  scene.add(labelNode(record.names.es, {
    position: [position[0], -7.5, position[2]], size: 13, weight: 600,
    color: familyColor(record.family), always: true, layer: 5, id: 'cmplbl:' + tag,
  }));
}

function renderPanel(fitRmsd, paired) {
  if (!panelBody) return;
  clear(panelBody);
  const a = byId(idA), b = byId(idB);
  panelBody.appendChild(el('div', { class: 'a-section' }, [
    el('div', { class: 'a-section__title', text: 'Identidad' }),
    el('table', {}, [
      el('thead', {}, el('tr', {}, [el('th', { text: '' }),
        el('th', { text: a.names.corto || a.names.es }), el('th', { text: b.names.corto || b.names.es })])),
      el('tbody', {}, [
        row('Fórmula', a.formula, b.formula),
        row('Masa molar', a.mw + ' g/mol', b.mw + ' g/mol'),
        row('Familia', a.family.replace(/_/g, ' '), b.family.replace(/_/g, ' ')),
        row('Átomos pesados', String(a.heavyAtoms), String(b.heavyAtoms)),
      ]),
    ]),
  ]));

  const diff = structuralDiff(a, b);
  panelBody.appendChild(el('div', { class: 'a-section' }, [
    el('div', { class: 'a-section__title', text: 'Diferencias por posición' }),
    diff.length
      ? el('table', {}, [
          el('thead', {}, el('tr', {}, [el('th', { text: 'Posición' }),
            el('th', { text: a.names.corto || 'A' }), el('th', { text: b.names.corto || 'B' })])),
          el('tbody', {}, diff.map((d) => el('tr', {}, [
            el('td', { class: 'mono', text: d.position }),
            el('td', { text: d.a }), el('td', { text: d.b })]))),
        ])
      : el('div', { class: 'a-note', text: 'Sin diferencias de sustituyentes sobre el núcleo, o alguna '
          + 'de las dos no es un esteroide.' }),
  ]));

  if (fitRmsd !== null) {
    panelBody.appendChild(el('div', { class: 'a-section' }, [
      el('div', { class: 'a-section__title', text: 'Superposición' }),
      el('p', { style: { fontSize: 'var(--fs-md)' },
        text: paired + ' átomos del núcleo emparejados por numeración esteroidea, con una '
            + 'desviación cuadrática media de ' + num(fitRmsd, 2) + ' ángstrom.' }),
      el('div', { class: 'a-src', text: 'Las conformaciones son calculadas: la desviación mide el '
        + 'ajuste geométrico entre ellas, no una diferencia experimental.' }),
    ]));
  }

  for (const record of [a, b]) {
    if (!record.pharm) continue;
    panelBody.appendChild(el('div', { class: 'a-section' }, [
      el('div', { class: 'a-section__title', text: record.names.es }),
      el('p', { style: { fontSize: 'var(--fs-md)' }, text: record.pharm.mechanism }),
      el('a', { class: 'a-btn a-btn--ghost', href: linkFor(record.id) },
        [icon('molecule'), el('span', { text: 'Ficha completa' })]),
    ]));
  }
}

function row(label, x, y) {
  return el('tr', {}, [el('td', { class: 'a-muted', text: label }), el('td', { text: x }), el('td', { text: y })]);
}

function buildBar() {
  const items = withGeometry().map((m) => ({ value: m.id, label: m.names.es }));
  setStageBar([
    crumbs([{ label: 'Comparador', current: true }]),
    toolbar([
      selectField('A', items, idA, (v) => { idA = v; navigate(); }),
      selectField('B', items, idB, (v) => { idB = v; navigate(); }),
      buttonGroup([{ value: 'lado', label: 'Lado a lado' }, { value: 'superpuesto', label: 'Superpuestas' }],
        mode, (v) => { mode = v; build(); }),
      selectField('Color', [
        { value: 'rings', label: 'Anillos A-D' }, { value: 'element', label: 'Elemento' },
        { value: 'groups', label: 'Grupos' },
      ], coloring, (v) => { coloring = v; build(); }),
    ]),
  ]);
}

function navigate() { go('#/interacciones/comparar/' + slugFromId(idA) + '/' + slugFromId(idB)); }

function presetPanel() {
  const panel = el('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } });
  panel.appendChild(el('div', { style: { padding: '11px 12px 8px', borderBottom: '1px solid var(--line)' } }, [
    el('div', { class: 'a-section__title', style: { marginBottom: '3px' }, text: 'Comparaciones útiles' }),
    el('div', { class: 'a-src', text: 'Pares que explican una idea de un vistazo.' }),
  ]));
  const list = el('div', { class: 'a-list', style: { overflowY: 'auto', flex: '1', padding: '6px' } });
  for (const p of PRESETS) {
    if (!byId(p.a) || !byId(p.b)) continue;
    list.appendChild(el('button', {
      class: 'a-list__item', 'data-active': (idA === p.a && idB === p.b) ? 'true' : null,
      onClick: () => { idA = p.a; idB = p.b; navigate(); },
    }, [icon('compare'), el('div', { class: 'a-list__main' },
      el('div', { class: 'a-list__name', text: p.label }))]));
  }
  panel.appendChild(list);
  return panel;
}

export function mount(host, ctx) {
  const a = ctx.params.a ? idFromSlug(ctx.params.a) : null;
  const b = ctx.params.b ? idFromSlug(ctx.params.b) : null;
  if (a && byId(a)) idA = a;
  if (b && byId(b)) idB = b;

  stage = mountStage(host, { label: 'Comparador de estructuras', panel: presetPanel(),
    engine: { autoSpin: true, quality: 3 } });
  stage.engine.spinSpeed = 0.12;

  const side = el('div', { class: 'a-stage__aside' });
  panelBody = el('div', { style: { padding: '14px' } });
  side.appendChild(panelBody);
  stage.canvasWrap.appendChild(side);
  stage.canvas.dataset.reserveRight = window.innerWidth > 900 ? '336' : '0';
  stage.engine.handleResize(true);

  stage.engine.on('select', (sel) => { if (sel && sel.type === 'mol') go(linkFor(sel.id)); });

  buildBar();
  build();
  announce('Comparando ' + entityName(idA) + ' con ' + entityName(idB));

  return { unmount() { if (stage) stage.destroy(); stage = null; panelBody = null; } };
}
