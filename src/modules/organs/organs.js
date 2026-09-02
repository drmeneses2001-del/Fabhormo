import { el, clear, icon, announce } from '../../core/dom.js';
import { byId, all, name as entityName, organsTargetedBy } from '../../core/repo.js';
import { go, idFromSlug, slugFromId, linkFor } from '../../core/router.js';
import * as store from '../../core/store.js';
import { setStageBar, crumbs, toolbar } from '../../ui/shell.js';
import { mountStage, buttonGroup, showTooltip, hideTooltip } from '../../ui/stage.js';
import { openInspector, closeInspector } from '../../ui/inspector.js';
import { Node, labelNode, pathNode, haloNode, arrowNode } from '../../engine/scene.js';
import { bodyOutline, toPath3 } from '../../engine/shapes.js';
import { familyColor } from '../../engine/molecule.js';
import { token } from '../../core/theme.js';

/** Cuerpo estratificado: la silueta y los organos como cuerpos con volumen.
 *  Elegir una hormona ilumina sus territorios; elegir un organo lista las
 *  hormonas que actuan sobre el. Las dos direcciones usan los mismos datos. */

const STAGES = [
  { value: 'fetal', label: 'Fetal' },
  { value: 'pubertad', label: 'Pubertad' },
  { value: 'adulto', label: 'Adulto' },
  { value: 'gestacion', label: 'Gestacion' },
  { value: 'climaterio', label: 'Climaterio' },
];

const HORMONES = ['mol:testosterona', 'mol:dht', 'mol:estradiol', 'mol:estrona',
  'mol:progesterona', 'mol:cortisol', 'mol:aldosterona', 'mol:dhea', 'mol:alopregnanolona',
  'mol:doc', 'mol:11ceto_testosterona'];

let stage = null;
let hormone = null;
let organFocus = null;
let sex = 'xx';
let stageLife = 'adulto';
let receptorFilter = null;
let panelBody = null;

function visibleOrgans() {
  return all('organs').filter((o) => {
    if (o.sex === 'xx' && sex !== 'xx') return false;
    if (o.sex === 'xy' && sex !== 'xy') return false;
    if (o.id === 'org:placenta' && stageLife !== 'gestacion') return false;
    return !!o.anchor;
  });
}

function targetsOf(organ) {
  return (organ.targets || []).filter((t) => {
    if (receptorFilter && t.receptor !== receptorFilter) return false;
    if (t.stage && t.stage.length && !t.stage.includes(stageLife)) return false;
    return true;
  });
}

function intensityFor(organ) {
  if (!hormone) return 0;
  const hits = targetsOf(organ).filter((t) => t.hormone === hormone);
  if (!hits.length) return 0;
  return Math.max(...hits.map((t) => t.weight || 1));
}

function build() {
  const scene = stage.engine.scene;
  scene.clear();
  const line = token('line-strong') || '#bbb';
  const accent = hormone ? familyColor((byId(hormone) || {}).family) : (token('accent') || '#0b5cad');

  scene.add(pathNode(toPath3(bodyOutline(sex), -4), {
    stroke: line, fill: token('surface'), lineWidth: 1.5, layer: -4, id: 'body',
  }));
  scene.add(labelNode('Esquema anatomico, no a escala', {
    position: [0, -5.5, 0], size: 11, color: token('ink-3'), always: true, layer: 2, id: 'disclaimer',
  }));

  for (const organ of visibleOrgans()) {
    const [x, y, r] = organ.anchor;
    const intensity = intensityFor(organ);
    const focused = organFocus === organ.id;
    const base = token('ink-3') || '#888';
    const color = intensity > 0 ? accent : base;
    const opacity = hormone ? (intensity > 0 ? 1 : 0.25) : 0.9;
    const points = x === 0 ? [0, y, 0] : [x, y, 0, -x, y, 0];
    scene.add(new Node('molecule', {
      xyz: Float32Array.from(points),
      radii: Float32Array.from(x === 0 ? [r] : [r, r]),
      colors: x === 0 ? [color] : [color, color],
      isH: new Uint8Array(x === 0 ? 1 : 2),
      bonds: { a: new Uint16Array(0), b: new Uint16Array(0), order: new Uint8Array(0) },
      representation: 'spacefill', hydrogens: false,
    }, { layer: -1, id: 'organ:' + organ.id, opacity, pick: { type: 'org', id: organ.id } }));

    if (intensity > 0) {
      scene.add(haloNode({ position: [x, y, 1], radius: r + 0.9 + intensity * 0.9,
        color: accent, width: 1 + intensity * 1.1, opacity: 0.55 + intensity * 0.45,
        pulse: intensity >= 1 ? 1 : 0, layer: 1, id: 'glow:' + organ.id }));
      if (x !== 0) {
        scene.add(haloNode({ position: [-x, y, 1], radius: r + 0.9 + intensity * 0.9,
          color: accent, width: 1 + intensity * 1.1, opacity: 0.55 + intensity * 0.45,
          pulse: intensity >= 1 ? 1 : 0, layer: 1, id: 'glow2:' + organ.id }));
      }
    }
    if (focused) {
      scene.add(haloNode({ position: [x, y, 1.5], radius: r + 2.6, color: token('focus'),
        width: 1.6, dash: [3, 3], layer: 2, id: 'focus:' + organ.id }));
    }

    const marked = intensity > 0 || focused;
    if (!hormone || marked) {
      const toLeft = LEFT_LABELS.has(organ.id);
      scene.add(labelNode(organ.names.es, {
        position: [labelX(x, r, toLeft), y, 1], size: 11,
        weight: marked ? 600 : 400,
        color: marked ? accent : token('ink-2'),
        align: toLeft ? 'right' : 'left', always: marked, avoidCollision: !marked,
        layer: 3, id: 'lbl:' + organ.id,
      }));
    }
  }

  stage.engine.fitSphere([0, 50, 0], 56, 1.08);
  stage.engine.camera.orientation.set([0, 0, 0, 1]);
  stage.engine.camera.markDirty();
  stage.engine.requestRender();
  renderPanel();
}

/** Las etiquetas se apartan de la silueta: en la cabeza y la linea media los
 *  organos son pequenos y el texto acabaria encima del dibujo. */
function labelX(x, r, toLeft) {
  const d = Math.max(Math.abs(x) + r + 1.6, 17.5);
  return toLeft ? -d : d;
}

const LEFT_LABELS = new Set(['org:hipotalamo', 'org:cerebro', 'org:endotelio', 'org:utero',
  'org:placenta', 'org:prostata', 'org:genitales_externos', 'org:hueso', 'org:laringe']);

/* ------------------------------------------------------------------ panel --- */

function hormonePanel() {
  const panel = el('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } });
  panel.appendChild(el('div', { style: { padding: '11px 12px 8px', borderBottom: '1px solid var(--line)' } }, [
    el('div', { class: 'a-section__title', style: { marginBottom: '3px' }, text: 'Hormona' }),
    el('div', { class: 'a-src', text: 'Selecciona una y se iluminan sus territorios diana.' }),
  ]));
  const list = el('div', { class: 'a-list', style: { overflowY: 'auto', flex: '1', padding: '6px' } });
  list.appendChild(el('button', {
    class: 'a-list__item', 'data-active': hormone ? null : 'true', 'data-h': 'ninguna',
    onClick: () => { hormone = null; go('#/organos'); },
  }, [el('div', { class: 'a-list__main' }, [el('div', { class: 'a-list__name', text: 'Ver todos los organos' })])]));

  for (const id of HORMONES) {
    const m = byId(id);
    if (!m) continue;
    const n = all('organs').filter((o) => (o.targets || []).some((t) => t.hormone === id)).length;
    if (!n) continue;
    list.appendChild(el('button', {
      class: 'a-list__item', 'data-active': hormone === id ? 'true' : null, 'data-h': id,
      onClick: () => go('#/organos/hormona/' + slugFromId(id)),
    }, [
      el('span', { class: 'a-list__dot', style: { background: familyColor(m.family) } }),
      el('div', { class: 'a-list__main' }, [
        el('div', { class: 'a-list__name', text: m.names.es }),
        el('div', { class: 'a-list__meta', text: n + (n === 1 ? ' territorio' : ' territorios') }),
      ]),
    ]));
  }
  panel.appendChild(list);
  return panel;
}

function renderPanel() {
  if (!panelBody) return;
  clear(panelBody);

  if (organFocus) {
    const organ = byId(organFocus);
    const rows = targetsOf(organ);
    panelBody.appendChild(el('div', { class: 'a-inspector__kicker', text: 'Territorio' }));
    panelBody.appendChild(el('h2', { class: 'a-inspector__title', style: { fontSize: 'var(--fs-lg)' },
      text: organ.names.es }));
    if (organ.synthesizes && organ.synthesizes.length) {
      panelBody.appendChild(el('div', { style: { margin: '6px 0 12px' } },
        organ.synthesizes.map((t) => el('a', { class: 'a-chip a-chip--sm', style: { marginRight: '4px' },
          href: '#/esteroidogenesis/escalas/' + slugFromId(t), text: 'sintetiza: ' + entityName(t) }))));
    }
    if (!rows.length) {
      panelBody.appendChild(el('div', { class: 'a-note',
        text: 'Sin efectos registrados para la etapa y el receptor seleccionados.' }));
    }
    for (const t of rows) {
      panelBody.appendChild(el('div', { class: 'a-section' }, [
        el('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' } }, [
          el('a', { class: 'a-chip a-chip--sm', style: { '--chip-color': familyColor((byId(t.hormone) || {}).family) },
            href: linkFor(t.hormone), text: entityName(t.hormone) }),
          el('a', { class: 'a-chip a-chip--sm', href: linkFor(t.receptor), text: entityName(t.receptor) }),
        ]),
        el('p', { style: { fontSize: 'var(--fs-md)', marginBottom: '4px' }, text: t.effect }),
        t.clinical ? el('p', { class: 'a-muted', style: { fontSize: 'var(--fs-sm)' }, text: t.clinical }) : null,
      ].filter(Boolean)));
    }
    panelBody.appendChild(el('button', { class: 'a-btn', onClick: () => { organFocus = null; build(); } },
      [el('span', { text: 'Ver todo el cuerpo' })]));
    return;
  }

  if (hormone) {
    const m = byId(hormone);
    const hits = organsTargetedBy(hormone)
      .map(({ organ, targets }) => ({ organ, targets: targets.filter((t) => !t.stage || t.stage.includes(stageLife)) }))
      .filter(({ organ, targets }) => targets.length && visibleOrgans().includes(organ));
    panelBody.appendChild(el('div', { class: 'a-inspector__kicker', text: 'Hormona' }));
    panelBody.appendChild(el('h2', { class: 'a-inspector__title', style: { fontSize: 'var(--fs-lg)' },
      text: m.names.es }));
    panelBody.appendChild(el('div', { class: 'a-src', style: { marginBottom: '12px' },
      text: hits.length + ' territorios en la etapa ' + STAGES.find((s) => s.value === stageLife).label.toLowerCase() }));
    for (const { organ, targets } of hits) {
      for (const t of targets) {
        panelBody.appendChild(el('div', { class: 'a-section' }, [
          el('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '3px' } }, [
            el('button', { class: 'a-list__name', style: { fontWeight: '600', textAlign: 'left' },
              onClick: () => { organFocus = organ.id; build(); }, text: organ.names.es }),
            el('a', { class: 'a-chip a-chip--sm', href: linkFor(t.receptor), text: entityName(t.receptor) }),
          ]),
          el('p', { style: { fontSize: 'var(--fs-md)', marginBottom: '3px' }, text: t.effect }),
          t.clinical ? el('p', { class: 'a-muted', style: { fontSize: 'var(--fs-sm)' }, text: t.clinical }) : null,
        ].filter(Boolean)));
      }
    }
    panelBody.appendChild(el('a', { class: 'a-btn', href: linkFor(hormone) },
      [icon('molecule'), el('span', { text: 'Ficha completa' })]));
    return;
  }

  panelBody.appendChild(el('div', { class: 'a-note',
    text: 'Elige una hormona en la lista para iluminar sus organos blanco, o selecciona un organo '
        + 'en el esquema para ver que hormonas actuan sobre el.' }));
}

/* ------------------------------------------------------------------- barra --- */

function buildBar() {
  const receptors = all('receptors');
  setStageBar([
    crumbs([{ label: 'Organos blanco', href: '#/organos' },
            hormone ? { label: entityName(hormone), current: true } : null,
            organFocus ? { label: entityName(organFocus), current: true } : null].filter(Boolean)),
    toolbar([
      buttonGroup([{ value: 'xx', label: '46,XX' }, { value: 'xy', label: '46,XY' }], sex,
        (v) => { sex = v; if (v === 'xy' && stageLife === 'gestacion') stageLife = 'adulto'; build(); buildBar(); }),
      el('label', { class: 'a-field' }, [
        el('span', { text: 'Etapa' }),
        el('select', { onChange: (e) => { stageLife = e.target.value; build(); } },
          STAGES.filter((s) => !(s.value === 'gestacion' && sex === 'xy'))
            .map((s) => el('option', { value: s.value, selected: s.value === stageLife ? true : null, text: s.label }))),
      ]),
      el('label', { class: 'a-field' }, [
        el('span', { text: 'Receptor' }),
        el('select', { onChange: (e) => { receptorFilter = e.target.value || null; build(); } }, [
          el('option', { value: '', text: 'Todos' }),
          ...receptors.map((r) => el('option', { value: r.id, selected: r.id === receptorFilter ? true : null,
            text: r.names.corto })),
        ]),
      ]),
    ]),
  ]);
}

export function mount(host, ctx) {
  hormone = ctx.params.mol ? idFromSlug(ctx.params.mol) : null;
  organFocus = ctx.params.id ? idFromSlug(ctx.params.id) : null;
  if (hormone && !byId(hormone)) hormone = null;
  if (organFocus && !byId(organFocus)) organFocus = null;
  if (organFocus) {
    const organ = byId(organFocus);
    if (organ && organ.sex === 'xy') sex = 'xy';
  }

  stage = mountStage(host, {
    label: 'Esquema del cuerpo con los organos blanco',
    panel: hormonePanel(),
    engine: { autoSpin: false, quality: 3 },
  });
  stage.engine.renderer.fogStrength = 0.1;

  const side = el('div', { style: { position: 'absolute', right: '0', top: '0', bottom: '0',
    width: '330px', background: 'var(--surface)', borderLeft: '1px solid var(--line)',
    overflowY: 'auto', zIndex: '4' } });
  panelBody = el('div', { style: { padding: '14px' } });
  side.appendChild(panelBody);
  stage.canvasWrap.appendChild(side);
  stage.canvas.dataset.reserveRight = '330';
  stage.engine.handleResize(true);

  stage.engine.on('select', (sel) => {
    if (!sel || sel.type !== 'org') return;
    organFocus = organFocus === sel.id ? null : sel.id;
    build();
    buildBar();
  });
  stage.engine.on('hover', (info) => {
    if (!info || info.type !== 'org') { hideTooltip(); return; }
    const organ = byId(info.id);
    const rect = stage.canvas.getBoundingClientRect();
    const item = stage.engine.renderer.pickList.find((p) => p.node && p.node.pick && p.node.pick.id === info.id);
    const n = targetsOf(organ).length;
    showTooltip(el('div', {}, [
      el('strong', { text: organ.names.es }),
      el('div', { class: 'a-tooltip__sub', text: n + (n === 1 ? ' hormona registrada' : ' hormonas registradas') }),
    ]), rect.left + (item ? item.x : 0), rect.top + (item ? item.y : 0));
  });

  buildBar();
  build();
  announce(hormone ? 'Territorios de ' + entityName(hormone) : 'Esquema de organos blanco');

  return {
    unmount() {
      hideTooltip(); closeInspector();
      if (stage) stage.destroy();
      stage = null; panelBody = null;
    },
  };
}
