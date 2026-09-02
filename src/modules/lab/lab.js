import { el, clear, icon, announce } from '../../core/dom.js';
import { all, byId, name as entityName } from '../../core/repo.js';
import { linkFor, slugFromId } from '../../core/router.js';
import { setStageBar, crumbs, toolbar } from '../../ui/shell.js';
import { simulate, compareWithExpected, DIRECTION_LABEL } from '../../core/flux.js';
import { resolveSource } from '../../ui/inspector.js';

/** Laboratorio: rangos orientativos por analito y perfil esperado de cada cuadro
 *  clinico, derivado de la misma tabla curada que usa el simulador. */

let selected = null;

function profileFor(condition) {
  const { ratios } = simulate(all('reactions'), condition.blocks);
  return compareWithExpected(condition, ratios);
}

function render(root) {
  clear(root);
  const view = el('div', { class: 'a-view a-view--split' });
  const panel = el('div', { class: 'a-stage__panel' });
  const body = el('div', { class: 'a-view a-view--scroll', style: { position: 'relative', flex: '1' } });

  panel.appendChild(el('div', { style: { padding: '11px 12px 8px', borderBottom: '1px solid var(--line)' } }, [
    el('div', { class: 'a-section__title', style: { marginBottom: '3px' }, text: 'Perfil esperado' }),
    el('div', { class: 'a-src', text: 'Elige un cuadro para ver qué se espera encontrar.' }),
  ]));
  const list = el('div', { class: 'a-list', style: { overflowY: 'auto', flex: '1', padding: '6px' } });
  list.appendChild(el('button', {
    class: 'a-list__item', 'data-active': selected ? null : 'true',
    onClick: () => { selected = null; render(root); },
  }, [icon('lab'), el('div', { class: 'a-list__main' },
    el('div', { class: 'a-list__name', text: 'Rangos de referencia' }))]));
  for (const c of all('conditions').filter((x) => x.expectedLevels && x.expectedLevels.length)) {
    list.appendChild(el('button', {
      class: 'a-list__item', 'data-active': selected === c.id ? 'true' : null,
      onClick: () => { selected = c.id; render(root); },
    }, [icon('deficit'), el('div', { class: 'a-list__main' }, [
      el('div', { class: 'a-list__name', text: c.names.es }),
      el('div', { class: 'a-list__meta', text: c.gene || '' })])]));
  }
  panel.appendChild(list);

  const doc = el('div', { class: 'a-view--doc' });
  if (!selected) {
    doc.appendChild(el('h1', { text: 'Rangos de referencia' }));
    doc.appendChild(el('div', { class: 'a-note', style: { margin: '10px 0 18px', maxWidth: '66ch' },
      text: 'Los intervalos son orientativos y dependen del método de medida, del laboratorio, del '
          + 'sexo, de la edad y del momento del ciclo. Se dan como referencia de magnitud y de '
          + 'sentido, no como criterio diagnóstico.' }));
    for (const l of all('labs')) {
      doc.appendChild(el('div', { class: 'a-section' }, [
        el('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' } }, [
          el('h3', { text: l.names.es }),
          el('span', { class: 'a-src mono', text: l.unit }),
          l.analyte ? el('a', { class: 'a-chip a-chip--sm', href: linkFor(l.analyte),
            text: entityName(l.analyte) }) : null,
        ].filter(Boolean)),
        el('table', { style: { marginTop: '6px' } }, [
          el('tbody', {}, (l.ranges || []).map((r) => el('tr', {}, [
            el('td', { class: 'a-muted', style: { width: '38%' }, text: r.population }),
            el('td', { text: r.text })]))),
        ]),
        el('ul', { style: { marginTop: '7px', fontSize: 'var(--fs-md)' } },
          (l.interpretation || []).map((t) => el('li', { text: t }))),
        el('div', { class: 'a-src' }, (l.source || []).map(resolveSource).filter(Boolean)
          .map((s) => el('div', {}, [el('span', { class: 'a-badge a-badge--warn', text: 'pendiente' }),
            ' ', s.citation || '']))),
      ]));
    }
  } else {
    const c = byId(selected);
    const rows = profileFor(c);
    doc.appendChild(el('div', { class: 'a-inspector__kicker', text: 'Perfil analítico esperado' }));
    doc.appendChild(el('h1', { text: c.names.es }));
    doc.appendChild(el('div', { class: 'a-muted', style: { marginBottom: '16px' },
      text: (c.gene ? 'gen ' + c.gene : '') + (c.inheritance ? ' · ' + c.inheritance : '') }));
    doc.appendChild(el('table', {}, [
      el('thead', {}, el('tr', {}, [el('th', { text: 'Analito' }), el('th', { text: 'Esperado' }),
        el('th', { text: 'Modelo de flujo' }), el('th', { text: 'Papel' })])),
      el('tbody', {}, rows.map((r) => el('tr', {}, [
        el('td', {}, el('a', { href: linkFor(r.mol), text: entityName(r.mol) })),
        el('td', { class: 'mono', style: { color: dirColor(r.expected) }, text: DIRECTION_LABEL[r.expected] }),
        el('td', { class: 'mono', style: { color: dirColor(r.computed) }, text: DIRECTION_LABEL[r.computed] || '—' }),
        el('td', { text: r.marker ? 'marcador diagnóstico' : '' }),
      ]))),
    ]));
    const labs = (c.labs || []).map((id) => byId(id)).filter(Boolean);
    if (labs.length) {
      doc.appendChild(el('div', { class: 'a-section', style: { marginTop: '18px' } }, [
        el('div', { class: 'a-section__title', text: 'Qué pedir' }),
        el('div', { class: 'a-list' }, labs.map((l) => el('div', { class: 'a-list__item' }, [
          icon('lab'), el('div', { class: 'a-list__main' }, [
            el('div', { class: 'a-list__name', text: l.names.es }),
            el('div', { class: 'a-list__meta', text: (l.interpretation || [])[0] || '' })])]))),
      ]));
    }
    doc.appendChild(el('a', { class: 'a-btn a-btn--primary', style: { marginTop: '16px' },
      href: '#/esteroidogenesis/deficit/' + slugFromId(c.id) },
      [icon('deficit'), el('span', { text: 'Ver el bloqueo en la vía' })]));
  }
  body.appendChild(doc);
  view.appendChild(panel);
  view.appendChild(body);
  root.appendChild(view);
}

function dirColor(dir) {
  if (!dir) return 'inherit';
  if (dir.startsWith('up')) return 'var(--up)';
  if (dir.startsWith('down')) return 'var(--down)';
  return 'var(--ink-3)';
}

export function mount(root) {
  setStageBar([crumbs([{ label: 'Laboratorio', current: true }])]);
  render(root);
  announce('Laboratorio');
  return {};
}
