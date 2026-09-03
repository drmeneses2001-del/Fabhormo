import { el, clear, icon, announce, debounce } from '../../core/dom.js';
import { all } from '../../core/repo.js';
import { setStageBar, crumbs, toolbar } from '../../ui/shell.js';
import { resolveSource } from '../../ui/inspector.js';

/** Elegibilidad clinica segun los criterios medicos de la OMS.
 *  Categorias: 1 sin restriccion, 2 ventajas generalmente superiores,
 *  3 riesgos generalmente superiores, 4 riesgo inaceptable. */

const CATEGORY = {
  1: { label: 'Sin restricción', color: 'ring-c' },
  2: { label: 'Ventajas superiores a los riesgos', color: 'fam-gestageno' },
  3: { label: 'Riesgos superiores a las ventajas', color: 'focus' },
  4: { label: 'Riesgo inaceptable', color: 'up' },
};

let query = '';
let methodFilter = 'todos';

function render(root) {
  clear(root);
  const view = el('div', { class: 'a-view a-view--scroll' });
  const doc = el('div', { class: 'a-view--doc' });
  const rows = all('eligibility');
  const methods = Array.from(new Set(rows.map((r) => r.method)));

  doc.appendChild(el('h1', { text: 'Elegibilidad clínica' }));
  doc.appendChild(el('p', { style: { fontSize: 'var(--fs-lg)', color: 'var(--ink-2)', maxWidth: '66ch' },
    text: 'Criterios médicos de elegibilidad para el uso de anticonceptivos. La categoría responde a '
        + 'una pregunta concreta: con esta condición, conviene o no este método.' }));

  doc.appendChild(el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '14px 0' } },
    Object.entries(CATEGORY).map(([n, c]) => el('span', { class: 'a-chip a-chip--sm',
      style: { '--chip-color': 'var(--' + c.color + ')' }, text: n + ' · ' + c.label }))));

  const controls = el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' } }, [
    el('input', {
      type: 'search', placeholder: 'Filtrar por condición…', value: query,
      'aria-label': 'Filtrar condiciones',
      style: { flex: '1', minWidth: '220px', border: '1px solid var(--line-strong)',
               borderRadius: 'var(--radius-sm)', padding: '6px 9px', background: 'var(--surface)' },
      onInput: debounce((e) => { query = e.target.value; render(root); }, 160),
    }),
    el('label', { class: 'a-field' }, [
      el('span', { text: 'Método' }),
      el('select', { onChange: (e) => { methodFilter = e.target.value; render(root); } }, [
        el('option', { value: 'todos', text: 'Todos' }),
        ...methods.map((m) => el('option', { value: m, selected: m === methodFilter ? true : null, text: m })),
      ]),
    ]),
  ]);
  doc.appendChild(controls);

  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const q = norm(query).trim();
  const filtered = rows.filter((r) => (methodFilter === 'todos' || r.method === methodFilter)
    && (!q || norm(r.condition + ' ' + r.method).includes(q)));

  const byMethod = new Map();
  for (const r of filtered) {
    if (!byMethod.has(r.method)) byMethod.set(r.method, []);
    byMethod.get(r.method).push(r);
  }
  if (!byMethod.size) doc.appendChild(el('div', { class: 'a-note', text: 'Sin coincidencias.' }));

  for (const [method, items] of byMethod) {
    items.sort((a, b) => b.category - a.category);
    doc.appendChild(el('div', { class: 'a-section' }, [
      el('div', { class: 'a-section__title', text: method }),
      el('table', {}, [
        el('thead', {}, el('tr', {}, [el('th', { text: 'Condición' }), el('th', { style: { width: '80px' }, text: 'Categoría' }),
          el('th', { text: 'Nota' })])),
        el('tbody', {}, items.map((r) => el('tr', {}, [
          el('td', { text: r.condition }),
          el('td', {}, el('span', { class: 'a-chip a-chip--sm', 'data-active': 'true',
            style: { '--chip-color': 'var(--' + CATEGORY[r.category].color + ')' },
            title: CATEGORY[r.category].label, text: String(r.category) })),
          el('td', { class: 'a-muted', text: r.note || '' }),
        ]))),
      ]),
    ]));
  }

  const source = resolveSource((rows[0] && rows[0].source && rows[0].source[0]) || null);
  doc.appendChild(el('div', { class: 'a-note', style: { marginTop: '16px' } }, [
    el('strong', { text: 'Fuente y alcance. ' }),
    (source ? source.citation + ' ' : '') +
    'Se recoge una selección de pares método-condición con valor docente, no la tabla completa. '
    + 'Ante una decisión clínica hay que consultar la edición vigente del documento original y la '
    + 'adaptación nacional correspondiente.',
  ]));
  view.appendChild(doc);
  root.appendChild(view);
}

export function mount(root) {
  setStageBar([crumbs([{ label: 'Elegibilidad clínica', current: true }])]);
  render(root);
  announce('Elegibilidad clínica');
  return {};
}
