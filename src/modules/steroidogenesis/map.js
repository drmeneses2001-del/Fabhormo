import { el, clear, icon, announce } from '../../core/dom.js';
import { byId, name as entityName, all } from '../../core/repo.js';
import { go, idFromSlug, slugFromId } from '../../core/router.js';
import * as store from '../../core/store.js';
import { setStageBar, crumbs, toolbar } from '../../ui/shell.js';
import { mountStage, showTooltip, hideTooltip } from '../../ui/stage.js';
import { openInspector, closeInspector, compartmentLabel } from '../../ui/inspector.js';
import { buildPathwayScene, enzymeColor, COMPARTMENT_GLYPH, layoutMap, pathwayGroups } from './pathway-scene.js';
import { familyColor } from '../../engine/molecule.js';
import { token } from '../../core/theme.js';
import { load, save } from '../../core/persist.js';

let stage = null;
let collapsed = new Set(['grp:backdoor', 'grp:11oxo', 'grp:corticoide']);
let tissue = null;
let built = null;
let focusId = null;

function rebuild(options) {
  const opts = Object.assign({ collapsed, tissue }, options || {});
  built = buildPathwayScene(stage.engine, opts);
  if (!options || !options.keepCamera) frameAll();
  stage.engine.requestRender();
  updateLegend();
  announce('Mapa de la via con ' + built.molecules.size + ' metabolitos y ' + built.reactions.length + ' reacciones');
}

function frameAll() {
  const b = stage.engine.scene.bounds();
  stage.engine.fitSphere(b.center, b.radius, 1.04);
  stage.engine.camera.orientation.set([0, 0, 0, 1]);
  stage.engine.camera.markDirty();
}

function toggleGroup(groupId, on) {
  if (on) collapsed.delete(groupId); else collapsed.add(groupId);
  save('pathwayGroups', Array.from(collapsed));
  rebuild({ keepCamera: true });
}

function setTissue(id) {
  tissue = tissue === id ? null : id;
  store.set({ tissueFilter: tissue });
  rebuild({ keepCamera: true });
  buildBar();
}

let legendNode = null;
function updateLegend() {
  if (!legendNode) return;
  clear(legendNode);
  const families = [
    ['Precursor', familyColor('precursor')], ['Gestageno', familyColor('gestageno')],
    ['Androgeno', familyColor('androgeno')], ['Estrogeno', familyColor('estrogeno')],
    ['Glucocorticoide', familyColor('glucocorticoide')], ['Mineralocorticoide', familyColor('mineralocorticoide')],
  ];
  const enzymes = [['CYP', token('enz-cyp')], ['HSD', token('enz-hsd')],
                   ['Reductasa / AKR', token('enz-red')], ['Sulfato', token('enz-sulf')]];
  legendNode.appendChild(el('div', { class: 'a-legend__title', text: 'Metabolito' }));
  for (const [label, color] of families) {
    legendNode.appendChild(el('div', { class: 'a-legend__row' }, [
      el('span', { class: 'a-legend__swatch', style: { background: color } }), el('span', { text: label })]));
  }
  legendNode.appendChild(el('div', { class: 'a-legend__title', style: { marginTop: '8px' }, text: 'Enzima' }));
  for (const [label, color] of enzymes) {
    legendNode.appendChild(el('div', { class: 'a-legend__row' }, [
      el('span', { class: 'a-legend__swatch', style: { background: color, height: '2px' } }), el('span', { text: label })]));
  }
  legendNode.appendChild(el('div', { class: 'a-legend__title', style: { marginTop: '8px' }, text: 'Compartimento' }));
  legendNode.appendChild(el('div', { class: 'a-legend__row' }, [
    el('span', { style: { color: token('comp-mito'), width: '11px', textAlign: 'center' }, text: '◆' }),
    el('span', { text: 'Mitocondria' })]));
  legendNode.appendChild(el('div', { class: 'a-legend__row' }, [
    el('span', { style: { color: token('comp-rel'), width: '11px', textAlign: 'center' }, text: '●' }),
    el('span', { text: 'Reticulo endoplasmico liso' })]));
  if (tissue) {
    legendNode.appendChild(el('div', { class: 'a-note', style: { marginTop: '9px', fontSize: 'var(--fs-xs)' },
      text: 'Atenuado: la enzima no se expresa en ' + entityName(tissue) + '.' }));
  }
}

function buildBar() {
  const groups = pathwayGroups();
  setStageBar([
    crumbs([{ label: 'Esteroidogenesis' }, { label: 'Mapa de la via', current: true }]),
    toolbar([
      el('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } }, groups
        .filter((g) => g.collapsed || g.id === 'grp:corticoide')
        .map((g) => el('button', {
          class: 'a-chip', 'data-active': collapsed.has(g.id) ? null : 'true',
          style: { '--chip-color': token(g.color) },
          title: g.description, text: g.label,
          onClick: (e) => {
            const on = collapsed.has(g.id);
            toggleGroup(g.id, on);
            if (on) e.currentTarget.dataset.active = 'true';
            else e.currentTarget.removeAttribute('data-active');
          },
        }))),
      el('button', { class: 'a-btn a-btn--icon', title: 'Encuadrar', onClick: frameAll }, icon('frame')),
    ]),
  ]);
}

function tissuePanel() {
  const panel = el('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } });
  panel.appendChild(el('div', { style: { padding: '11px 12px 8px', borderBottom: '1px solid var(--line)' } }, [
    el('div', { class: 'a-section__title', style: { marginBottom: '4px' }, text: 'Filtrar por tejido' }),
    el('div', { class: 'a-src', text: 'Resalta las reacciones que ese tejido puede hacer.' }),
  ]));
  const list = el('div', { class: 'a-list', style: { overflowY: 'auto', flex: '1', padding: '6px' } });
  const groupsByOrgan = new Map();
  for (const t of all('tissues')) {
    if (!groupsByOrgan.has(t.organ)) groupsByOrgan.set(t.organ, []);
    groupsByOrgan.get(t.organ).push(t);
  }
  const ORGAN_LABEL = {
    'org:testiculo': 'Testiculo', 'org:ovario': 'Ovario', 'org:suprarrenal': 'Suprarrenal',
    'org:placenta': 'Placenta', 'org:adiposo': 'Tejido adiposo', 'org:piel': 'Piel',
    'org:genitales_externos': 'Genitales externos', 'org:prostata': 'Prostata',
    'org:mama': 'Mama', 'org:higado': 'Higado', 'org:cerebro': 'Cerebro', 'org:hueso': 'Hueso',
  };
  for (const [organ, items] of groupsByOrgan) {
    list.appendChild(el('div', { class: 'a-rail__grouptitle', style: { padding: '7px 8px 3px' },
      text: ORGAN_LABEL[organ] || organ }));
    for (const t of items) {
      list.appendChild(el('button', {
        class: 'a-list__item', 'data-active': tissue === t.id ? 'true' : null,
        onClick: (e) => { setTissue(t.id); refreshTissueButtons(list); },
        'data-tissue': t.id,
      }, [
        el('div', { class: 'a-list__main' }, [
          el('div', { class: 'a-list__name', text: t.names.es }),
          el('div', { class: 'a-list__meta', text: (t.produces || []).map((m) => entityName(m)).slice(0, 2).join(', ') }),
        ]),
      ]));
    }
  }
  panel.appendChild(list);
  panel.appendChild(el('div', { style: { padding: '8px 12px', borderTop: '1px solid var(--line)' } },
    el('a', { class: 'a-btn', style: { width: '100%', justifyContent: 'center' },
      href: '#/esteroidogenesis/recorrido/1' }, [icon('tour'), el('span', { text: 'Recorrido guiado' })])));
  return panel;
}

function refreshTissueButtons(list) {
  for (const b of list.querySelectorAll('[data-tissue]')) {
    if (b.dataset.tissue === tissue) b.dataset.active = 'true';
    else b.removeAttribute('data-active');
  }
}

export function mount(host, ctx) {
  const storedGroups = load('pathwayGroups', null);
  if (Array.isArray(storedGroups)) collapsed = new Set(storedGroups);

  stage = mountStage(host, {
    label: 'Mapa interactivo de la esteroidogenesis',
    panel: tissuePanel(),
    engine: { autoSpin: false, quality: 3 },
  });
  stage.engine.renderer.fogStrength = 0.16;
  stage.engine.camera.orthographic = true;

  const legendWrap = el('div', { class: 'a-legend', style: { paddingBottom: '6px', left: 'auto', right: 'var(--sp-4)' } });
  const legendBody = el('div', { hidden: true });
  const legendToggle = el('button', {
    class: 'a-legend__title',
    style: { display: 'flex', alignItems: 'center', gap: '5px', width: '100%', cursor: 'pointer' },
    'aria-expanded': 'false',
    onClick: () => {
      const open = legendBody.hidden;
      legendBody.hidden = !open;
      legendToggle.setAttribute('aria-expanded', String(open));
    },
  }, [el('span', { text: 'Leyenda' }), el('span', { style: { marginLeft: 'auto', opacity: '.6' }, text: '+' })]);
  legendWrap.appendChild(legendToggle);
  legendWrap.appendChild(legendBody);
  legendNode = legendBody;
  stage.canvasWrap.appendChild(legendWrap);

  stage.engine.on('hover', (info) => {
    if (!info) { hideTooltip(); return; }
    const rect = stage.canvas.getBoundingClientRect();
    const item = stage.engine.renderer.pickList.find((p) => p.node && p.node.pick && p.node.pick.id === info.id);
    const x = rect.left + (item ? item.x : 0), y = rect.top + (item ? item.y : 0);
    if (info.type === 'rx') {
      const r = byId(info.id);
      if (!r) return;
      const enz = byId(r.enzyme);
      showTooltip(el('div', {}, [
        el('strong', { text: entityName(r.substrate) + ' → ' + entityName(r.product) }),
        el('div', { class: 'a-tooltip__sub', text: (enz ? enz.names.es : r.enzyme) + ' · ' + compartmentLabel(r.compartment) }),
        r.cofactors && r.cofactors.length ? el('div', { class: 'a-tooltip__sub', text: r.cofactors.join(', ') }) : null,
      ]), x, y);
    } else if (info.type === 'mol') {
      const m = byId(info.id);
      if (!m) return;
      showTooltip(el('div', {}, [
        el('strong', { text: m.names.es }),
        el('div', { class: 'a-tooltip__sub', text: m.formula + ' · ' + m.mw + ' g/mol' }),
      ]), x, y);
    }
  });

  stage.engine.on('select', (sel) => {
    if (!sel) { closeInspector(); focusId = null; return; }
    focusId = sel.id;
    if (sel.type === 'rx') {
      const r = byId(sel.id);
      go('#/esteroidogenesis/paso/' + slugFromId(sel.id));
      return;
    }
    openInspector(sel.id, { tab: 'sintesis' });
  });

  buildBar();
  rebuild();

  const focus = ctx.params.focus ? idFromSlug(ctx.params.focus) : null;
  if (focus && byId(focus)) {
    openInspector(focus, { tab: 'sintesis' });
    const positions = layoutMap();
    const p = positions.get(focus);
    if (p) {
      stage.engine.camera.target.set(p);
      stage.engine.camera.distance = 46;
      stage.engine.camera.markDirty();
      stage.engine.requestRender();
    }
  }

  return {
    unmount() {
      hideTooltip();
      closeInspector();
      legendNode = null;
      if (stage) stage.destroy();
      stage = null; built = null;
    },
  };
}
