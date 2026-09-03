import { el, clear, icon, announce, debounce } from '../../core/dom.js';
import { all, byId, name as entityName, search } from '../../core/repo.js';
import { go, idFromSlug, slugFromId } from '../../core/router.js';
import * as store from '../../core/store.js';
import { setStageBar, crumbs, toolbar } from '../../ui/shell.js';
import { mountStage, buttonGroup, selectField, showTooltip, hideTooltip } from '../../ui/stage.js';
import { openInspector, closeInspector } from '../../ui/inspector.js';
import { moleculeNode } from '../../engine/scene.js';
import { prepareMolecule, colorAtoms, computeSurface, familyColor } from '../../engine/molecule.js';

const FAMILIES = [
  { value: 'todas', label: 'Todas' },
  { value: 'androgeno', label: 'Andrógenos' },
  { value: 'estrogeno', label: 'Estrógenos' },
  { value: 'gestageno', label: 'Gestágenos' },
  { value: 'progestageno_sintetico', label: 'Progestágenos' },
  { value: 'precursor', label: 'Precursores' },
  { value: 'glucocorticoide', label: 'Glucocorticoides' },
  { value: 'mineralocorticoide', label: 'Mineralocorticoides' },
  { value: 'antiandrogeno', label: 'Antiandrógenos' },
  { value: 'antiestrogeno_serm', label: 'SERM' },
  { value: 'sprm', label: 'SPRM' },
  { value: 'inhibidor_enzimatico', label: 'Inhibidores' },
  { value: 'anabolizante', label: 'Anabolizantes' },
];

const REPRESENTATIONS = [
  { value: 'ballstick', label: 'Bolas', title: 'Bolas y varillas' },
  { value: 'sticks', label: 'Varillas', title: 'Varillas' },
  { value: 'spacefill', label: 'Esferas', title: 'Esferas de Van der Waals' },
  { value: 'surface', label: 'Superficie', title: 'Superficie accesible al disolvente' },
];

const COLORINGS = [
  { value: 'element', label: 'Elemento' },
  { value: 'rings', label: 'Anillos A-D' },
  { value: 'groups', label: 'Grupos funcionales' },
  { value: 'family', label: 'Familia' },
];

let stage = null;
let node = null;
let currentId = null;
let filterFamily = 'todas';
let query = '';
let listHost = null;
let unsubscribe = null;
let showHydrogens = true;

function molecules() {
  const list = all('molecules').filter((m) => m.atoms && m.atoms.xyz && m.atoms.xyz.length);
  const missing3d = all('molecules').filter((m) => !m.atoms || !m.atoms.xyz || !m.atoms.xyz.length);
  return { list, missing3d };
}

function filtered() {
  let items = all('molecules');
  if (filterFamily !== 'todas') items = items.filter((m) => m.family === filterFamily);
  if (query.trim()) {
    const hits = new Set(search(query, 200).map((h) => h.id));
    items = items.filter((m) => hits.has(m.id));
  }
  return items.slice().sort((a, b) => a.names.es.localeCompare(b.names.es, 'es'));
}

function renderList() {
  if (!listHost) return;
  clear(listHost);
  const items = filtered();
  if (!items.length) {
    listHost.appendChild(el('div', { class: 'a-muted', style: { padding: '12px', fontSize: 'var(--fs-md)' },
      text: 'Sin coincidencias' }));
    return;
  }
  for (const m of items) {
    const has3d = m.atoms.xyz && m.atoms.xyz.length > 0;
    listHost.appendChild(el('button', {
      class: 'a-list__item', 'aria-current': m.id === currentId ? 'true' : null,
      onClick: () => go('#/atlas/' + slugFromId(m.id)),
    }, [
      el('span', { class: 'a-list__dot', style: { background: familyColor(m.family) } }),
      el('div', { class: 'a-list__main' }, [
        el('div', { class: 'a-list__name', text: m.names.es }),
        el('div', { class: 'a-list__meta', text: m.formula + ' · ' + m.mw + ' g/mol' + (has3d ? '' : ' · sin 3D') }),
      ]),
    ]));
  }
}

function loadMolecule(id) {
  const record = byId(id);
  if (!record) return;
  currentId = id;
  const state = store.get();
  stage.engine.scene.clear();
  node = null;

  if (!record.atoms.xyz || !record.atoms.xyz.length) {
    stage.engine.requestRender();
    openInspector(id, { tab: 'fuentes' });
    renderList();
    return;
  }

  const prepared = prepareMolecule(record, { coloring: state.coloring });
  node = moleculeNode({
    xyz: prepared.xyz, radii: prepared.radii, colors: prepared.colors,
    isH: prepared.isH, bonds: prepared.bonds,
  }, { representation: state.representation, pick: { type: 'mol', id }, id: 'mol' });
  node.data.record = record;
  node.data.hydrogens = showHydrogens;
  applySurface(state.representation);
  stage.engine.scene.add(node);
  stage.engine.resetCamera(1.3);
  stage.engine.autoSpin = !stage.engine.reducedMotion;
  stage.engine.requestRender();
  openInspector(id);
  renderList();
  announce(record.names.es + ', ' + record.formula);
}

function applySurface(representation) {
  if (!node) return;
  if (representation === 'surface' && !node.data.surface) {
    node.data.surface = computeSurface(node.data.xyz, node.data.radii, node.data.isH, { density: 84 });
    node.data.surfaceColor = familyColor(node.data.record.family);
  }
}

function setRepresentation(value) {
  store.set({ representation: value });
  if (node) { node.data.representation = value; applySurface(value); stage.engine.requestRender(); }
}

function setColoring(value) {
  store.set({ coloring: value });
  if (node && node.data.record) {
    node.data.colors = colorAtoms(node.data.record, value);
    stage.engine.requestRender();
  }
}

function buildBar() {
  const state = store.get();
  setStageBar([
    crumbs([{ label: 'Atlas molecular', href: '#/atlas' },
            currentId ? { label: entityName(currentId), current: true } : null].filter(Boolean)),
    toolbar([
      buttonGroup(REPRESENTATIONS, state.representation, setRepresentation),
      selectField('Color', COLORINGS, state.coloring, setColoring),
      el('button', {
        class: 'a-btn', title: 'Mostrar u ocultar hidrógenos',
        'data-active': showHydrogens ? 'true' : null,
        onClick: (e) => {
          showHydrogens = !showHydrogens;
          if (showHydrogens) e.currentTarget.dataset.active = 'true';
          else e.currentTarget.removeAttribute('data-active');
          if (node) { node.data.hydrogens = showHydrogens; stage.engine.frameNodes(null, 1.3, true); }
        },
      }, el('span', { text: 'H' })),
      el('button', { class: 'a-btn a-btn--icon', title: 'Encuadrar (R)', onClick: () => stage.engine.resetCamera(1.3) }, icon('frame')),
      el('button', { class: 'a-btn a-btn--icon', title: 'Girar automáticamente',
        onClick: (e) => {
          stage.engine.autoSpin = !stage.engine.autoSpin;
          e.currentTarget.dataset.active = stage.engine.autoSpin ? 'true' : '';
          stage.engine.requestRender();
        } }, icon('reset')),
    ]),
  ]);
}

export function mount(host, ctx) {
  const panel = el('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } });
  const searchInput = el('input', {
    type: 'search', placeholder: 'Filtrar…', 'aria-label': 'Filtrar moléculas',
    style: { width: '100%', border: '1px solid var(--line-strong)', borderRadius: 'var(--radius-sm)',
             padding: '5px 8px', background: 'var(--surface-2)' },
    onInput: debounce((e) => { query = e.target.value; renderList(); }, 120),
  });
  const familySelect = selectField('Familia', FAMILIES, filterFamily, (v) => { filterFamily = v; renderList(); });
  panel.appendChild(el('div', { style: { padding: '10px', borderBottom: '1px solid var(--line)', display: 'grid', gap: '7px' } },
    [searchInput, familySelect]));
  listHost = el('div', { class: 'a-list', style: { overflowY: 'auto', padding: '6px', flex: '1' } });
  panel.appendChild(listHost);
  const counts = molecules();
  panel.appendChild(el('div', { style: { padding: '7px 10px', borderTop: '1px solid var(--line)' }, class: 'a-src',
    text: counts.list.length + ' moléculas con 3D' + (counts.missing3d.length ? ' · ' + counts.missing3d.length + ' sin conformación' : '') }));
  stage = mountStage(host, { label: 'Modelo tridimensional de la molécula', panel });

  stage.engine.on('hover', (info) => {
    if (!info || !node) { hideTooltip(); return; }
    const record = node.data.record;
    const index = info.index;
    if (index === undefined || index < 0) { hideTooltip(); return; }
    const number = record.atoms.n && record.atoms.n[index];
    const rect = stage.canvas.getBoundingClientRect();
    const item = stage.engine.renderer.pickList.find((p) => p.index === index);
    showTooltip(el('div', {}, [
      el('strong', { text: record.atoms.el[index] + (number ? ' ' + number : '') }),
      el('div', { class: 'a-tooltip__sub', text: number ? 'posición ' + number + ' del núcleo' : 'átomo ' + (index + 1) }),
    ]), rect.left + (item ? item.x : 0), rect.top + (item ? item.y : 0));
  });

  unsubscribe = store.on(['themeResolved'], () => {
    if (node && node.data.record) node.data.colors = colorAtoms(node.data.record, store.get().coloring);
  });

  const id = ctx.params.id ? idFromSlug(ctx.params.id) : null;
  const first = id && byId(id) ? id : (filtered()[0] && filtered()[0].id);
  buildBar();
  renderList();
  if (first) loadMolecule(first);
  buildBar();

  return {
    unmount() {
      if (unsubscribe) unsubscribe();
      hideTooltip();
      closeInspector();
      if (stage) stage.destroy();
      stage = null; node = null; listHost = null; currentId = null;
    },
  };
}
