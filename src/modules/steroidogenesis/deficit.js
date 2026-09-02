import { el, clear, icon, announce, num } from '../../core/dom.js';
import { byId, all, name as entityName } from '../../core/repo.js';
import { go, idFromSlug, slugFromId, linkFor } from '../../core/router.js';
import { setStageBar, crumbs, toolbar } from '../../ui/shell.js';
import { mountStage, showTooltip, hideTooltip } from '../../ui/stage.js';
import { openInspector, closeInspector } from '../../ui/inspector.js';
import { buildPathwayScene, layoutMap, LABEL_RISE } from './pathway-scene.js';
import { simulate, direction, DIRECTION_LABEL, compareWithExpected } from '../../core/flux.js';
import { labelNode, haloNode } from '../../engine/scene.js';
import { token } from '../../core/theme.js';

let stage = null;
let condition = null;
let severity = 1;      // 1 = bloqueo completo declarado; 0 = enzima intacta
let result = null;
let panelBody = null;

function blocksFor() {
  if (!condition) return [];
  return (condition.blocks || []).map((b) => ({
    reaction: b.reaction,
    activity: 1 - (1 - b.activity) * severity,
  }));
}

function run() {
  result = simulate(all('reactions'), blocksFor());
  const levels = new Map();
  for (const [mol, ratio] of result.ratios) levels.set(mol, ratio);
  buildPathwayScene(stage.engine, {
    collapsed: new Set(['grp:backdoor', 'grp:11oxo']),
    levels, spin: false, representation: 'wire',
  });
  decorate(levels);
  const b = stage.engine.scene.bounds();
  stage.engine.fitSphere(b.center, b.radius, 1.04);
  stage.engine.camera.orientation.set([0, 0, 0, 1]);
  stage.engine.camera.markDirty();
  stage.engine.requestRender();
  renderPanel();
  announce('Simulacion de ' + (condition ? condition.names.es : 'la via sin bloqueos'));
}

/** Marca de direccion sobre cada metabolito y halo de acumulacion. */
function decorate(levels) {
  const scene = stage.engine.scene;
  const positions = layoutMap();
  const up = token('up') || '#c62828';
  const down = token('down') || '#1565c0';
  for (const [mol, ratio] of levels) {
    const p = positions.get(mol);
    if (!p) continue;
    const dir = direction(ratio);
    if (dir === 'flat') continue;
    const color = dir.startsWith('up') ? up : down;
    scene.add(labelNode(DIRECTION_LABEL[dir], {
      position: [p[0], p[1] + LABEL_RISE, p[2]], size: dir.endsWith('2') ? 19 : 16, weight: 600,
      color, always: true, layer: 8, id: 'dir:' + mol, avoidCollision: false,
    }));
    if (dir === 'up2' || dir === 'up') {
      scene.add(haloNode({ position: p, radius: 5, color, width: 1.5,
        pulse: dir === 'up2' ? 1 : 0, layer: 2, id: 'acc:' + mol, opacity: 0.7 }));
    }
  }
  // El bloqueo se marca sobre la propia flecha de la reaccion.
  for (const b of blocksFor()) {
    const rx = byId(b.reaction);
    if (!rx || b.activity >= 0.95) continue;
    const from = positions.get(rx.substrate);
    const to = positions.get(rx.product);
    if (!from || !to) continue;
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
    scene.add(labelNode('✗', { position: mid, size: 17, weight: 600, color: up, always: true,
      layer: 9, id: 'blk:' + rx.id, avoidCollision: false }));
    const edge = scene.get('edge:' + rx.id);
    if (edge) { edge.data.color = up; edge.data.dash = [4, 4]; edge.opacity = 0.85; }
  }
}

function conditionList() {
  const panel = el('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } });
  panel.appendChild(el('div', { style: { padding: '11px 12px 8px', borderBottom: '1px solid var(--line)' } }, [
    el('div', { class: 'a-section__title', style: { marginBottom: '3px' }, text: 'Bloqueo a simular' }),
    el('div', { class: 'a-src', text: 'Elige un deficit enzimatico o un farmaco y observa que se acumula y que falta.' }),
  ]));
  const list = el('div', { class: 'a-list', style: { overflowY: 'auto', flex: '1', padding: '6px' } });

  list.appendChild(el('button', {
    class: 'a-list__item', 'data-active': condition ? null : 'true', 'data-cond': 'ninguno',
    onClick: () => { condition = null; go('#/esteroidogenesis/deficit'); },
  }, [icon('check'), el('div', { class: 'a-list__main' }, [
    el('div', { class: 'a-list__name', text: 'Via sin bloqueos' }),
    el('div', { class: 'a-list__meta', text: 'Referencia' })])]));

  const genetic = all('conditions').filter((c) => c.kind !== 'farmacologico');
  const drugs = all('conditions').filter((c) => c.kind === 'farmacologico');
  for (const [title, items, iconName] of [['Deficits enzimaticos', genetic, 'deficit'],
                                          ['Bloqueos farmacologicos', drugs, 'pill']]) {
    list.appendChild(el('div', { class: 'a-rail__grouptitle', style: { padding: '9px 8px 3px' }, text: title }));
    for (const c of items) {
      list.appendChild(el('button', {
        class: 'a-list__item', 'data-active': condition && condition.id === c.id ? 'true' : null,
        'data-cond': c.id,
        onClick: () => go('#/esteroidogenesis/deficit/' + slugFromId(c.id)),
      }, [icon(iconName), el('div', { class: 'a-list__main' }, [
        el('div', { class: 'a-list__name', text: c.names.es }),
        el('div', { class: 'a-list__meta', text: c.gene || (c.drug ? entityName(c.drug) : '') }),
      ])]));
    }
  }
  panel.appendChild(list);
  return panel;
}

function renderPanel() {
  if (!panelBody) return;
  clear(panelBody);
  if (!condition) {
    panelBody.appendChild(el('div', { class: 'a-note',
      text: 'La via sin bloqueos sirve de referencia: todos los metabolitos estan en su nivel basal.' }));
    return;
  }
  const enz = byId(condition.enzyme);

  panelBody.appendChild(el('div', { class: 'a-inspector__kicker',
    text: condition.kind === 'farmacologico' ? 'Bloqueo farmacologico' : 'Deficit enzimatico' }));
  panelBody.appendChild(el('h2', { class: 'a-inspector__title', style: { fontSize: 'var(--fs-lg)' },
    text: condition.names.es }));
  if (enz) {
    panelBody.appendChild(el('div', { class: 'a-muted', style: { fontSize: 'var(--fs-md)', marginBottom: '10px' },
      text: enz.names.es + (condition.gene ? ' · gen ' + condition.gene : '') +
            (condition.inheritance ? ' · ' + condition.inheritance : '') }));
  }

  // Control de severidad.
  const sev = el('div', { class: 'a-section' }, [
    el('div', { class: 'a-section__title', text: 'Actividad enzimatica residual' }),
    el('div', { style: { display: 'flex', alignItems: 'center', gap: '9px' } }, [
      el('input', {
        type: 'range', min: '0', max: '100', value: String(Math.round(severity * 100)),
        'aria-label': 'Severidad del bloqueo', style: { flex: '1' },
        onInput: (e) => { severity = Number(e.target.value) / 100; run(); },
      }),
      el('span', { class: 'mono', style: { minWidth: '54px', textAlign: 'right', fontSize: 'var(--fs-sm)' },
        text: residualLabel() }),
    ]),
  ]);
  panelBody.appendChild(sev);

  if (result && result.feedback && Math.abs(result.feedback - 1) > 0.08) {
    panelBody.appendChild(el('div', { class: 'a-note', style: { marginBottom: '14px' },
      text: (result.feedback > 1
        ? 'El cortisol bajo desinhibe la ACTH: el estimulo sobre la celula esteroidogenica sube ×'
        : 'El cortisol alto frena la ACTH: el estimulo baja ×') + num(result.feedback, 1) +
        '. Es lo que explica la hiperplasia y el acumulo de precursores.' }));
  }

  panelBody.appendChild(comparisonTable());

  if (condition.phenotype) {
    const p = condition.phenotype;
    panelBody.appendChild(el('div', { class: 'a-section' }, [
      el('div', { class: 'a-section__title', text: 'Cuadro clinico' }),
      p.xx ? el('p', { style: { fontSize: 'var(--fs-md)' } }, [el('strong', { text: '46,XX. ' }), p.xx]) : null,
      p.xy ? el('p', { style: { fontSize: 'var(--fs-md)' } }, [el('strong', { text: '46,XY. ' }), p.xy]) : null,
      p.common ? el('ul', { style: { fontSize: 'var(--fs-md)' } }, p.common.map((t) => el('li', { text: t }))) : null,
    ].filter(Boolean)));
  }
  if (condition.treatment) {
    panelBody.appendChild(el('div', { class: 'a-section' }, [
      el('div', { class: 'a-section__title', text: 'Tratamiento' }),
      el('p', { style: { fontSize: 'var(--fs-md)' }, text: condition.treatment }),
    ]));
  }
  if (condition.note) {
    panelBody.appendChild(el('div', { class: 'a-note', style: { marginBottom: '14px' }, text: condition.note }));
  }
  panelBody.appendChild(el('a', { class: 'a-btn', href: linkFor(condition.enzyme) },
    [icon('step'), el('span', { text: 'Ficha de la enzima' })]));
}

function residualLabel() {
  const blocks = blocksFor();
  if (!blocks.length) return '—';
  const min = Math.min(...blocks.map((b) => b.activity));
  return Math.round(min * 100) + ' %';
}

function comparisonTable() {
  const rows = compareWithExpected(condition, result.ratios);
  if (!rows.length) {
    return el('div', { class: 'a-section' }, [
      el('div', { class: 'a-section__title', text: 'Metabolitos afectados' }),
      el('div', { class: 'a-note', text: 'Este bloqueo no tiene tabla clinica curada: se muestra solo el calculo del modelo.' }),
    ]);
  }
  const table = el('table', {}, [
    el('thead', {}, el('tr', {}, [
      el('th', { text: 'Metabolito' }), el('th', { text: 'Modelo' }), el('th', { text: 'Clinica' })])),
    el('tbody', {}, rows.map((r) => {
      const expected = (condition.expectedLevels || []).find((e) => e.mol === r.mol);
      return el('tr', {}, [
        el('td', {}, [
          el('a', { href: linkFor(r.mol), text: entityName(r.mol) }),
          expected && expected.marker ? el('span', { class: 'a-badge', style: { marginLeft: '5px' }, text: 'marcador' }) : null,
        ]),
        el('td', { class: 'mono', style: { color: dirColor(r.computed) },
          title: 'cociente ' + num(r.ratio, 2), text: DIRECTION_LABEL[r.computed] || '—' }),
        el('td', { class: 'mono', style: { color: dirColor(r.expected) } }, [
          DIRECTION_LABEL[r.expected] || '—',
          expected && expected.override ? el('span', { class: 'a-badge a-badge--warn',
            style: { marginLeft: '5px' }, title: expected.override, text: 'nota' }) : null,
        ]),
      ]);
    })),
  ]);
  const notes = (condition.expectedLevels || []).filter((e) => e.override);
  return el('div', { class: 'a-section' }, [
    el('div', { class: 'a-section__title', text: 'Modelo frente a la clinica' }),
    table,
    el('div', { class: 'a-src', style: { marginTop: '7px' },
      text: 'Modelo cualitativo de flujo: reparte un flujo constante desde el colesterol y no '
          + 'reproduce concentraciones. Donde el modelo y la clinica no coinciden, manda la clinica.' }),
    ...notes.map((n) => el('div', { class: 'a-note a-note--warn', style: { marginTop: '7px' } }, [
      el('strong', { text: entityName(n.mol) + '. ' }), n.override,
    ])),
  ]);
}

function dirColor(dir) {
  if (!dir) return 'inherit';
  if (dir.startsWith('up')) return 'var(--up)';
  if (dir.startsWith('down')) return 'var(--down)';
  return 'var(--ink-3)';
}

export function mount(host, ctx) {
  const wanted = ctx.params.id ? idFromSlug(ctx.params.id) : null;
  condition = wanted ? byId(wanted) : null;
  severity = 1;

  stage = mountStage(host, {
    label: 'Simulador de bloqueos de la esteroidogenesis',
    panel: conditionList(),
    engine: { autoSpin: false, quality: 3 },
  });
  stage.engine.camera.orthographic = true;
  stage.engine.renderer.fogStrength = 0.12;

  const side = el('div', { style: { position: 'absolute', right: '0', top: '0', bottom: '0',
    width: '340px', background: 'var(--surface)', borderLeft: '1px solid var(--line)',
    overflowY: 'auto', zIndex: '4' } });
  panelBody = el('div', { style: { padding: '14px' } });
  side.appendChild(panelBody);
  stage.canvasWrap.appendChild(side);
  stage.canvas.dataset.reserveRight = '340';
  stage.engine.handleResize(true);

  stage.engine.on('select', (sel) => {
    if (sel && sel.type === 'mol') openInspector(sel.id, { tab: 'sintesis' });
  });
  stage.engine.on('hover', (info) => {
    if (!info || info.type !== 'mol' || !result) { hideTooltip(); return; }
    const ratio = result.ratios.get(info.id);
    const rect = stage.canvas.getBoundingClientRect();
    const item = stage.engine.renderer.pickList.find((p) => p.node && p.node.pick && p.node.pick.id === info.id);
    showTooltip(el('div', {}, [
      el('strong', { text: entityName(info.id) }),
      el('div', { class: 'a-tooltip__sub', text: ratio === undefined ? '' :
        'nivel relativo ×' + num(ratio, 2) + ' · ' + DIRECTION_LABEL[direction(ratio)] }),
    ]), rect.left + (item ? item.x : 0), rect.top + (item ? item.y : 0));
  });

  setStageBar([
    crumbs([{ label: 'Esteroidogenesis', href: '#/esteroidogenesis/mapa' },
            { label: 'Simulador de deficits', current: true }]),
    toolbar([el('span', { class: 'a-src',
      text: 'Rojo: se acumula · Azul y atenuado: falta' })]),
  ]);

  run();

  return {
    unmount() {
      hideTooltip(); closeInspector();
      if (stage) stage.destroy();
      stage = null; result = null; panelBody = null; condition = null;
    },
  };
}
