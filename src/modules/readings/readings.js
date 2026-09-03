import { el, clear, icon, announce } from '../../core/dom.js';
import { all, byId } from '../../core/repo.js';
import { setStageBar, crumbs } from '../../ui/shell.js';

/** Lecturas y fuentes. Reune las referencias citadas en el atlas y explica el
 *  estado de verificacion de cada dato: lo que se ha comprobado en compilacion y
 *  lo que queda pendiente de comprobar en linea. */

const KIND_LABEL = { revision: 'Revisión', guia: 'Guía clínica', libro: 'Libro', articulo: 'Articulo' };

function render(root) {
  clear(root);
  const view = el('div', { class: 'a-view a-view--scroll' });
  const doc = el('div', { class: 'a-view--doc' });
  const readings = all('readings');
  const molecules = all('molecules');
  const verified = molecules.filter((m) => (m.source || []).some((s) => s.verified === true)).length;
  const without3d = molecules.filter((m) => m.conformer && m.conformer.kind === 'none');

  doc.appendChild(el('h1', { text: 'Lecturas y fuentes' }));
  doc.appendChild(el('p', { style: { fontSize: 'var(--fs-lg)', color: 'var(--ink-2)', maxWidth: '66ch' },
    text: 'Este atlas distingue entre lo que ha podido comprobarse durante la compilación y lo que '
        + 'queda pendiente de comprobar contra la fuente original. Cada ficha lleva esa marca.' }));

  doc.appendChild(el('div', { class: 'a-section' }, [
    el('div', { class: 'a-section__title', text: 'Estado de verificación' }),
    el('table', {}, el('tbody', {}, [
      el('tr', {}, [el('td', { text: 'Moléculas con estructura' }), el('td', { class: 'mono', text: String(molecules.length) })]),
      el('tr', {}, [el('td', { text: 'Con clave InChI comprobada frente a un valor de referencia' }),
        el('td', { class: 'mono', text: verified + ' de ' + molecules.length })]),
      el('tr', {}, [el('td', { text: 'Sin conformación tridimensional' }),
        el('td', { class: 'mono', text: String(without3d.length) })]),
      el('tr', {}, [el('td', { text: 'Enzimas, reacciones y tejidos de la vía' }),
        el('td', { class: 'mono', text: all('enzymes').length + ' · ' + all('reactions').length + ' · ' + all('tissues').length })]),
      el('tr', {}, [el('td', { text: 'Cuadros clínicos y bloqueos farmacológicos' }),
        el('td', { class: 'mono', text: String(all('conditions').length) })]),
    ])),
  ]));

  doc.appendChild(el('div', { class: 'a-note', style: { marginBottom: '18px' },
    text: 'Las conformaciones tridimensionales se han calculado con geometría de distancias y campo '
        + 'de fuerzas a partir de la estructura de cada molécula, y cada una declara su procedencia '
        + 'en la pestana de fuentes de su ficha. La comprobación de los identificadores de PubChem y '
        + 'de las citas bibliográficas requiere acceso a la red y queda pendiente.' }));

  const byKind = new Map();
  for (const r of readings) {
    if (!byKind.has(r.kind)) byKind.set(r.kind, []);
    byKind.get(r.kind).push(r);
  }
  for (const [kind, items] of byKind) {
    doc.appendChild(el('div', { class: 'a-section' }, [
      el('div', { class: 'a-section__title', text: KIND_LABEL[kind] || kind }),
      el('div', {}, items.map((r) => el('div', { class: 'a-card', style: { marginBottom: '9px' } }, [
        el('div', { style: { fontSize: 'var(--fs-md)', marginBottom: '4px' } }, [
          el('span', { class: 'a-badge' + (r.verified ? '' : ' a-badge--warn'),
            text: r.verified ? 'verificada' : 'pendiente' }),
          ' ', r.citation,
        ]),
        r.doi ? el('div', { class: 'a-src mono', text: 'doi:' + r.doi }) : null,
        r.summary ? el('p', { class: 'a-muted', style: { fontSize: 'var(--fs-sm)', margin: '4px 0 0' }, text: r.summary }) : null,
        r.tags ? el('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' } },
          r.tags.map((t) => el('span', { class: 'a-chip a-chip--sm', text: t }))) : null,
      ].filter(Boolean)))),
    ]));
  }

  doc.appendChild(el('div', { class: 'a-section' }, [
    el('div', { class: 'a-section__title', text: 'Bases de datos' }),
    el('ul', { style: { fontSize: 'var(--fs-md)' } }, [
      el('li', { text: 'PubChem (National Center for Biotechnology Information): identificadores de '
        + 'compuesto y estructuras de referencia de cada molécula.' }),
      el('li', { text: 'Los identificadores citados en cada ficha permiten comprobar la estructura '
        + 'contra la fuente original.' }),
    ]),
  ]));

  doc.appendChild(el('div', { class: 'a-section' }, [
    el('div', { class: 'a-section__title', text: 'Tipografía' }),
    el('p', { style: { fontSize: 'var(--fs-md)' },
      text: 'Source Serif 4, Source Sans 3 y JetBrains Mono, con licencia SIL Open Font License 1.1, '
          + 'incrustadas como subconjuntos en el propio archivo.' }),
  ]));

  view.appendChild(doc);
  root.appendChild(view);
}

export function mount(root) {
  setStageBar([crumbs([{ label: 'Lecturas y fuentes', current: true }])]);
  render(root);
  announce('Lecturas y fuentes');
  return {};
}
