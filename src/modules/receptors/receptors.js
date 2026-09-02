import { el, clear, icon, announce } from '../../core/dom.js';
import { all, byId, name as entityName } from '../../core/repo.js';
import { go, idFromSlug, slugFromId, linkFor } from '../../core/router.js';
import { setStageBar, crumbs, toolbar } from '../../ui/shell.js';
import { familyColor } from '../../engine/molecule.js';
import { resolveSource } from '../../ui/inspector.js';

const KIND_LABEL = {
  agonista: 'Agonista', agonista_parcial: 'Agonista parcial',
  antagonista: 'Antagonista', modulador: 'Modulador selectivo',
};

let current = null;

function render(root) {
  clear(root);
  const view = el('div', { class: 'a-view a-view--split' });
  const list = el('div', { class: 'a-stage__panel' });
  const body = el('div', { class: 'a-view a-view--scroll', style: { position: 'relative', flex: '1' } });

  list.appendChild(el('div', { style: { padding: '11px 12px 8px', borderBottom: '1px solid var(--line)' } },
    el('div', { class: 'a-section__title', style: { marginBottom: '0' }, text: 'Receptores' })));
  const items = el('div', { class: 'a-list', style: { overflowY: 'auto', flex: '1', padding: '6px' } });
  for (const r of all('receptors')) {
    items.appendChild(el('button', {
      class: 'a-list__item', 'data-active': current === r.id ? 'true' : null,
      onClick: () => go('#/receptores/' + slugFromId(r.id)),
    }, [icon('receptor'), el('div', { class: 'a-list__main' }, [
      el('div', { class: 'a-list__name', text: r.names.es }),
      el('div', { class: 'a-list__meta', text: 'gen ' + r.gene + ' · ' + (r.ligands || []).length + ' ligandos' })])]));
  }
  list.appendChild(items);

  const rec = current && byId(current);
  const doc = el('div', { class: 'a-view--doc' });
  if (!rec) {
    doc.appendChild(el('div', { class: 'a-empty' }, [
      el('div', { class: 'a-empty__title', text: 'Receptores de hormonas esteroideas' }),
      el('div', { class: 'a-muted', text: 'Elige uno para ver su mecanismo y sus ligandos.' })]));
  } else {
    doc.appendChild(el('div', { class: 'a-inspector__kicker',
      text: rec.class === 'nuclear' ? 'Receptor nuclear' : 'Receptor de membrana' }));
    doc.appendChild(el('h1', { text: rec.names.es }));
    doc.appendChild(el('div', { class: 'a-muted', style: { marginBottom: '16px' },
      text: rec.names.en + ' · gen ' + rec.gene + (rec.isoforms ? ' · isoformas ' + rec.isoforms.join(', ') : '') }));
    doc.appendChild(el('p', { style: { fontSize: 'var(--fs-lg)', maxWidth: '66ch' }, text: rec.mechanism }));

    const groups = {};
    for (const l of rec.ligands || []) (groups[l.kind] = groups[l.kind] || []).push(l.mol);
    for (const [kind, mols] of Object.entries(groups)) {
      doc.appendChild(el('div', { class: 'a-section' }, [
        el('div', { class: 'a-section__title', text: KIND_LABEL[kind] || kind }),
        el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, mols.map((m) =>
          el('a', { class: 'a-chip', href: linkFor(m),
            style: { '--chip-color': familyColor((byId(m) || {}).family) }, text: entityName(m) }))),
      ]));
    }

    const organs = all('organs').filter((o) => (o.targets || []).some((t) => t.receptor === rec.id));
    if (organs.length) {
      doc.appendChild(el('div', { class: 'a-section' }, [
        el('div', { class: 'a-section__title', text: 'Dónde actúa' }),
        el('table', {}, [
          el('thead', {}, el('tr', {}, [el('th', { text: 'Territorio' }), el('th', { text: 'Hormona' }), el('th', { text: 'Efecto' })])),
          el('tbody', {}, organs.flatMap((o) => (o.targets || []).filter((t) => t.receptor === rec.id).map((t) =>
            el('tr', {}, [
              el('td', {}, el('a', { href: '#/organos/' + slugFromId(o.id), text: o.names.es })),
              el('td', {}, el('a', { href: linkFor(t.hormone), text: entityName(t.hormone) })),
              el('td', { text: t.effect }),
            ])))),
        ]),
      ]));
    }

    doc.appendChild(el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '18px' } }, [
      el('a', { class: 'a-btn a-btn--primary', href: '#/interacciones/receptor/' + slugFromId(rec.id) },
        [icon('link'), el('span', { text: 'Ver receptor y ligando' })]),
      el('a', { class: 'a-btn', href: '#/interacciones/mapa/' + slugFromId(rec.id) },
        [icon('link'), el('span', { text: 'Ver en el mapa de interacciones' })]),
    ]));

    doc.appendChild(el('div', { class: 'a-section', style: { marginTop: '18px' } }, [
      el('div', { class: 'a-section__title', text: 'Fuentes' }),
      ...(rec.source || []).map(resolveSource).filter(Boolean).map((s) =>
        el('div', { class: 'a-src', style: { marginBottom: '5px' } }, [
          el('span', { class: 'a-badge' + (s.verified ? '' : ' a-badge--warn'),
            text: s.verified ? 'verificada' : 'pendiente' }), ' ', s.citation || ''])),
    ]));
  }
  body.appendChild(doc);
  view.appendChild(list);
  view.appendChild(body);
  root.appendChild(view);
}

export function mount(root, ctx) {
  current = ctx.params.id ? idFromSlug(ctx.params.id) : null;
  if (current && !byId(current)) current = null;
  setStageBar([crumbs([{ label: 'Receptores', href: '#/receptores' },
    current ? { label: entityName(current), current: true } : null].filter(Boolean))]);
  render(root);
  announce(current ? entityName(current) : 'Receptores');
  return {};
}
