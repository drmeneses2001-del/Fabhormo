import { el, clear, icon, announce, debounce } from '../../core/dom.js';
import { all, byId, name as entityName, interactionsOf } from '../../core/repo.js';
import { linkFor, slugFromId, go } from '../../core/router.js';
import { setStageBar, crumbs, toolbar } from '../../ui/shell.js';
import { familyColor } from '../../engine/molecule.js';
import { resolveSource } from '../../ui/inspector.js';

/** Interacciones farmacologicas: parte de las interacciones curadas y las agrupa
 *  por mecanismo, con la enzima compartida como nexo cuando lo hay. */

const KIND_LABEL = {
  inhibicion_enzimatica: 'Inhibicion enzimatica', inhibicion_cyp: 'Inhibicion de CYP3A4',
  induccion_cyp: 'Induccion de CYP3A4', sustrato: 'Metabolismo', antagonismo: 'Antagonismo',
  modulacion_selectiva: 'Modulacion selectiva', sinergia_clinica: 'Relacion clinica',
  precursor: 'Profarmaco', otro: 'Otra relacion',
};

let query = '';

function render(root) {
  clear(root);
  const view = el('div', { class: 'a-view a-view--scroll' });
  const doc = el('div', { class: 'a-view--doc' });

  doc.appendChild(el('h1', { text: 'Interacciones farmacologicas' }));
  doc.appendChild(el('p', { style: { fontSize: 'var(--fs-lg)', color: 'var(--ink-2)', maxWidth: '66ch' },
    text: 'Cada entrada nombra el mecanismo por el que dos entidades se afectan. Cuando la relacion '
        + 'pasa por una enzima, la enzima aparece como nodo: es donde se entiende por que un '
        + 'inductor de CYP3A4 puede hacer fallar un anticonceptivo.' }));

  doc.appendChild(el('div', { class: 'a-note', style: { margin: '14px 0' },
    text: 'Aviso practico: los inductores potentes de CYP3A4, entre ellos rifampicina, '
        + 'carbamazepina, fenitoina, fenobarbital, efavirenz y la hierba de San Juan, reducen la '
        + 'exposicion a etinilestradiol y a los gestagenos y pueden hacer fallar la anticoncepcion '
        + 'hormonal. La conducta habitual es usar un metodo que no dependa de esa via, como el DIU '
        + 'de cobre o el de levonorgestrel.' }));

  const search = el('input', {
    type: 'search', placeholder: 'Filtrar por farmaco, enzima o mecanismo…',
    'aria-label': 'Filtrar interacciones', value: query,
    style: { width: '100%', maxWidth: '420px', border: '1px solid var(--line-strong)',
             borderRadius: 'var(--radius-sm)', padding: '6px 9px', background: 'var(--surface)',
             margin: '4px 0 16px' },
    onInput: debounce((e) => { query = e.target.value; render(root); }, 160),
  });
  doc.appendChild(search);

  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const q = norm(query).trim();
  const groups = new Map();
  for (const i of all('interactions')) {
    const hay = norm([entityName(i.a), entityName(i.b), i.kind, i.mechanism, i.clinical].join(' '));
    if (q && !hay.includes(q)) continue;
    if (!groups.has(i.kind)) groups.set(i.kind, []);
    groups.get(i.kind).push(i);
  }

  if (!groups.size) {
    doc.appendChild(el('div', { class: 'a-note', text: 'Sin coincidencias.' }));
  }

  for (const [kind, items] of groups) {
    doc.appendChild(el('div', { class: 'a-section' }, [
      el('div', { class: 'a-section__title', text: KIND_LABEL[kind] || kind }),
      el('div', {}, items.map((i) => el('div', { class: 'a-card', style: { marginBottom: '8px' } }, [
        el('div', { style: { display: 'flex', gap: '7px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '5px' } }, [
          el('a', { class: 'a-chip a-chip--sm', href: linkFor(i.a),
            style: { '--chip-color': familyColor((byId(i.a) || {}).family) }, text: entityName(i.a) }),
          el('span', { class: 'a-muted', text: '→' }),
          el('a', { class: 'a-chip a-chip--sm', href: linkFor(i.b), text: entityName(i.b) }),
          i.strength ? el('span', { class: 'a-badge', text: 'relevancia ' + i.strength }) : null,
        ].filter(Boolean)),
        el('p', { style: { fontSize: 'var(--fs-md)', marginBottom: '4px' }, text: i.mechanism }),
        i.clinical ? el('p', { class: 'a-muted', style: { fontSize: 'var(--fs-sm)', marginBottom: '4px' }, text: i.clinical }) : null,
        el('div', { class: 'a-src' }, (i.source || []).map(resolveSource).filter(Boolean)
          .map((s) => el('span', { text: s.citation || '' }))),
      ].filter(Boolean)))),
    ]));
  }

  doc.appendChild(el('a', { class: 'a-btn a-btn--primary', style: { marginTop: '10px' },
    href: '#/interacciones/mapa' }, [icon('link'), el('span', { text: 'Ver el mapa completo' })]));
  view.appendChild(doc);
  root.appendChild(view);
}

export function mount(root) {
  setStageBar([crumbs([{ label: 'Interacciones farmacologicas', current: true }])]);
  render(root);
  announce('Interacciones farmacologicas');
  return {};
}
