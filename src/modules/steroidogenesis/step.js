import { el, clear, icon, announce } from '../../core/dom.js';
import { byId, all, name as entityName } from '../../core/repo.js';
import { go, idFromSlug, slugFromId, linkFor } from '../../core/router.js';
import { setStageBar, crumbs, toolbar } from '../../ui/shell.js';
import { mountStage, buttonGroup } from '../../ui/stage.js';
import { compartmentLabel } from '../../ui/inspector.js';
import { moleculeNode, labelNode, pathNode } from '../../engine/scene.js';
import { prepareMorph, morphNodeData, applyMorph, morphChangeColors } from '../../engine/morph.js';
import { elementColor, familyColor } from '../../engine/molecule.js';
import { token } from '../../core/theme.js';

const KIND_LABEL = {
  hidroxilacion: 'Hidroxilacion', escision_cadena: 'Escision de la cadena lateral',
  oxidacion_3b_isomerizacion: 'Oxidacion 3β e isomerizacion Δ5 a Δ4',
  reduccion_17ceto: 'Reduccion del 17-ceto', oxidacion_17oh: 'Oxidacion del 17β-OH',
  a5_reduccion: '5α-reduccion', aromatizacion: 'Aromatizacion',
  sulfatacion: 'Sulfatacion', desulfatacion: 'Desulfatacion',
  '11b_hidroxilacion': '11β-hidroxilacion', '18_oxidacion': 'Oxidacion en C18', otro: 'Transformacion',
};

let stage = null;
let node = null;
let morph = null;
let reaction = null;
let progress = 0;
let playing = true;
let direction = 1;
let coloring = 'change';
let progressBar = null;

function setColoring(value) {
  coloring = value;
  if (!node || !morph) return;
  node.data.colors = value === 'change' ? morphChangeColors(node.data)
    : morph.entries.map((e) => elementColor(e.el));
  stage.engine.requestRender();
}

function tick(dt) {
  if (!playing || !node) return;
  progress += direction * dt / 2600;
  if (progress >= 1) { progress = 1; direction = -1; }
  if (progress <= 0) { progress = 0; direction = 1; }
  applyMorph(node.data, ease(progress));
  if (progressBar) progressBar.style.width = (progress * 100).toFixed(1) + '%';
  stage.engine.requestRender();
}

function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

function setProgress(value) {
  progress = Math.max(0, Math.min(1, value));
  applyMorph(node.data, ease(progress));
  if (progressBar) progressBar.style.width = (progress * 100).toFixed(1) + '%';
  stage.engine.requestRender();
}

/** Membrana del compartimento donde ocurre la reaccion: contexto sin inventar
 *  estructura. La mitocondria se dibuja como doble membrana con crestas y el
 *  reticulo liso como cisterna. */
function compartmentBackdrop(scene, compartment) {
  const isMito = compartment === 'mitocondria_membrana_interna';
  const color = token(isMito ? 'comp-mito' : 'comp-rel') || '#888';
  const w = 21, h = 12.5, z = -14;
  const outer = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    outer.push(Math.cos(a) * w, Math.sin(a) * h * (isMito ? 1 : 0.62), z);
  }
  scene.add(pathNode(Float64Array.from(outer), {
    stroke: color, lineWidth: 1.4, fill: null, layer: -4, id: 'comp:outer',
    opacity: 0.5,
  }));
  if (isMito) {
    const inner = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      const r = 1 + 0.09 * Math.sin(a * 7);
      inner.push(Math.cos(a) * w * 0.87 * r, Math.sin(a) * h * 0.87 * r, z + 0.5);
    }
    scene.add(pathNode(Float64Array.from(inner), {
      stroke: color, lineWidth: 1.1, layer: -4, id: 'comp:inner', opacity: 0.7, dash: null,
    }));
  }
  scene.add(labelNode(isMito ? 'Mitocondria · membrana interna' : 'Reticulo endoplasmico liso', {
    position: [0, -h * (isMito ? 1 : 0.62) - 2.6, z], size: 11, weight: 600,
    color, always: true, layer: -3, id: 'comp:lbl', halo: true,
  }));
}

function buildScene() {
  const scene = stage.engine.scene;
  scene.clear();
  const sub = byId(reaction.substrate);
  const prod = byId(reaction.product);
  morph = prepareMorph(sub, prod, reaction.atomMap);
  if (!morph) return false;

  compartmentBackdrop(scene, reaction.compartment);

  const data = morphNodeData(morph, { representation: 'ballstick' });
  node = moleculeNode(data, { id: 'morph', pick: { type: 'rx', id: reaction.id }, scale: 1.9 });
  Object.assign(node.data, data);
  scene.add(node);
  setColoring(coloring);

  // Cofactores como perlas etiquetadas alrededor del sitio activo.
  const cof = reaction.cofactors || [];
  cof.forEach((c, i) => {
    const spread = 6.5;
    const x = (i - (cof.length - 1) / 2) * spread;
    scene.add(labelNode(c, { position: [x, -10.4, -6], size: 11, color: token('ink-3'),
      always: true, layer: 4, id: 'cof:' + i, halo: true, font: 'mono' }));
  });

  stage.engine.fitSphere([0, 0, 0], 17, 1.05);
  stage.engine.camera.orientation.set([0, 0, 0, 1]);
  stage.engine.camera.markDirty();
  return true;
}

function infoPanel() {
  const enz = byId(reaction.enzyme);
  const sub = byId(reaction.substrate);
  const prod = byId(reaction.product);
  const panel = el('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto' } });
  const body = el('div', { style: { padding: '14px' } });

  body.appendChild(el('div', { class: 'a-inspector__kicker', text: KIND_LABEL[reaction.kind] || 'Reaccion' }));
  body.appendChild(el('h2', { style: { fontSize: 'var(--fs-lg)', margin: '3px 0 10px', lineHeight: '1.25' } }, [
    el('a', { href: linkFor(sub.id), text: sub.names.es, style: { color: familyColor(sub.family), textDecoration: 'none' } }),
    el('span', { text: ' → ' }),
    el('a', { href: linkFor(prod.id), text: prod.names.es, style: { color: familyColor(prod.family), textDecoration: 'none' } }),
  ]));

  body.appendChild(el('div', { class: 'a-section' }, [
    el('div', { class: 'a-section__title', text: 'Enzima' }),
    el('a', { class: 'a-list__item', href: '#/esteroidogenesis/paso/' + slugFromId(reaction.id),
      style: { border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' } }, [
      el('div', { class: 'a-list__main' }, [
        el('div', { class: 'a-list__name', text: enz ? enz.names.es : reaction.enzyme }),
        el('div', { class: 'a-list__meta', text: (enz ? 'gen ' + enz.gene + ' · ' : '') + compartmentLabel(reaction.compartment) }),
      ]),
    ]),
    enz && enz.note ? el('p', { class: 'a-src', style: { marginTop: '8px' }, text: enz.note }) : null,
  ]));

  body.appendChild(el('div', { class: 'a-section' }, [
    el('div', { class: 'a-section__title', text: 'Que cambia' }),
    el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: 'var(--fs-md)' } }, [
      changeChip(morph ? morph.entries.filter((e) => e.kind === 'added').length : 0, 'entran', token('ring-c')),
      changeChip(morph ? morph.entries.filter((e) => e.kind === 'removed').length : 0, 'salen', token('up')),
      changeChip(morph ? morph.entries.filter((e) => e.kind === 'kept').length : 0, 'se conservan', token('ink-3')),
    ]),
    reaction.note ? el('p', { style: { marginTop: '9px', fontSize: 'var(--fs-md)' }, text: reaction.note }) : null,
  ]));

  if (reaction.cofactors && reaction.cofactors.length) {
    body.appendChild(el('div', { class: 'a-section' }, [
      el('div', { class: 'a-section__title', text: 'Cofactores' }),
      el('div', { style: { display: 'flex', gap: '5px', flexWrap: 'wrap' } },
        reaction.cofactors.map((c) => el('span', { class: 'a-chip a-chip--sm', text: c }))),
    ]));
  }

  const tissues = (reaction.tissues || []).map((t) => byId(t)).filter(Boolean);
  if (tissues.length) {
    body.appendChild(el('div', { class: 'a-section' }, [
      el('div', { class: 'a-section__title', text: 'Donde ocurre' }),
      el('div', { class: 'a-list' }, tissues.map((t) => el('a', {
        class: 'a-list__item', href: '#/esteroidogenesis/escalas/' + slugFromId(t.id),
      }, [icon('scales'), el('div', { class: 'a-list__main' }, [
        el('div', { class: 'a-list__name', text: t.names.es }),
      ])]))),
    ]));
  }

  const conds = all('conditions').filter((c) => (c.blocks || []).some((b) => b.reaction === reaction.id));
  if (conds.length) {
    body.appendChild(el('div', { class: 'a-section' }, [
      el('div', { class: 'a-section__title', text: 'Si este paso falla' }),
      el('div', { class: 'a-list' }, conds.map((c) => el('a', {
        class: 'a-list__item', href: '#/esteroidogenesis/deficit/' + slugFromId(c.id),
      }, [icon(c.kind === 'farmacologico' ? 'pill' : 'deficit'),
          el('div', { class: 'a-list__main' }, [
            el('div', { class: 'a-list__name', text: c.names.es }),
            el('div', { class: 'a-list__meta', text: c.gene || (c.drug ? entityName(c.drug) : '') }),
          ])]))),
    ]));
  }

  const others = all('reactions').filter((r) => r.id !== reaction.id &&
    (r.substrate === reaction.product || r.product === reaction.substrate));
  if (others.length) {
    body.appendChild(el('div', { class: 'a-section' }, [
      el('div', { class: 'a-section__title', text: 'Pasos contiguos' }),
      el('div', { class: 'a-list' }, others.slice(0, 6).map((r) => el('a', {
        class: 'a-list__item', href: '#/esteroidogenesis/paso/' + slugFromId(r.id),
      }, [icon('step'), el('div', { class: 'a-list__main' }, [
        el('div', { class: 'a-list__name', text: entityName(r.substrate) + ' → ' + entityName(r.product) }),
        el('div', { class: 'a-list__meta', text: entityName(r.enzyme) }),
      ])]))),
    ]));
  }

  panel.appendChild(body);
  return panel;
}

function changeChip(n, label, color) {
  return el('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '5px' } }, [
    el('span', { class: 'a-legend__swatch', style: { background: color } }),
    el('span', { text: n + ' ' + label }),
  ]);
}

function buildBar() {
  const controls = el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } });
  const playBtn = el('button', {
    class: 'a-btn a-btn--icon', title: 'Reproducir o pausar la transformacion',
    onClick: () => { playing = !playing; clear(playBtn); playBtn.appendChild(icon(playing ? 'pause' : 'play')); },
  }, icon('pause'));
  const slider = el('input', {
    type: 'range', min: '0', max: '1000', value: '0', 'aria-label': 'Avance de la reaccion',
    style: { width: '190px' },
    onInput: (e) => { playing = false; clear(playBtn); playBtn.appendChild(icon('play')); setProgress(Number(e.target.value) / 1000); },
  });
  progressBar = null;
  controls.appendChild(playBtn);
  controls.appendChild(slider);
  const sync = () => { slider.value = String(Math.round(progress * 1000)); };
  stage.engine.onBeforeRender = sync;

  setStageBar([
    crumbs([{ label: 'Esteroidogenesis', href: '#/esteroidogenesis/mapa' },
            { label: 'Paso enzimatico', current: true }]),
    toolbar([
      controls,
      buttonGroup([
        { value: 'change', label: 'Cambio' },
        { value: 'element', label: 'Elemento' },
      ], coloring, setColoring),
    ]),
  ]);
}

function chooseReaction(id) {
  if (id && byId(id)) return byId(id);
  const withMap = all('reactions').filter((r) => r.atomMap);
  return withMap.find((r) => r.id === 'rx:col_preg') || withMap[0] || null;
}

export function mount(host, ctx) {
  const wanted = ctx.params.id ? idFromSlug(ctx.params.id) : null;
  reaction = chooseReaction(wanted);
  if (!reaction) {
    host.appendChild(el('div', { class: 'a-empty' }, [
      el('div', { class: 'a-empty__title', text: 'Sin reaccion seleccionada' }),
      el('a', { class: 'a-btn', href: '#/esteroidogenesis/mapa', text: 'Volver al mapa' }),
    ]));
    return {};
  }

  stage = mountStage(host, { label: 'Transformacion del sustrato en producto',
    engine: { autoSpin: false, quality: 3 } });
  stage.engine.renderer.fogStrength = 0.3;
  progress = 0; direction = 1; playing = true;

  const ok = buildScene();
  stage.panelSlot.hidden = false;
  stage.panelSlot.appendChild(infoPanel());
  buildBar();

  if (!ok) {
    stage.canvasWrap.appendChild(el('div', { class: 'a-empty' }, [
      el('div', { class: 'a-empty__title', text: 'Sin correspondencia atomica' }),
      el('div', { class: 'a-muted', text: 'Este paso necesita la conformacion 3D de las dos moleculas.' }),
    ]));
  }

  let last = performance.now();
  const loop = () => {
    if (!stage) return;
    const now = performance.now();
    tick(now - last);
    last = now;
    raf = requestAnimationFrame(loop);
  };
  let raf = requestAnimationFrame(loop);
  announce('Paso ' + entityName(reaction.substrate) + ' a ' + entityName(reaction.product));

  return {
    unmount() {
      cancelAnimationFrame(raf);
      if (stage) stage.destroy();
      stage = null; node = null; morph = null; reaction = null;
    },
  };
}
