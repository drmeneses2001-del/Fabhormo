import { el, clear, icon, announce } from '../../core/dom.js';
import { all, byId, name as entityName } from '../../core/repo.js';
import { linkFor } from '../../core/router.js';
import { setStageBar, crumbs, toolbar } from '../../ui/shell.js';
import { load, save } from '../../core/persist.js';
import { resolveSource } from '../../ui/inspector.js';

/** Autoevaluacion. Cada pregunta explica la respuesta y enlaza con el lugar del
 *  atlas donde se estudia, para que el fallo lleve al contenido y no a la nada. */

const MODULES = [
  { value: 'todos', label: 'Todos' },
  { value: 'esteroidogenesis', label: 'Esteroidogenesis' },
  { value: 'organos', label: 'Organos blanco' },
  { value: 'farmacos', label: 'Farmacologia' },
  { value: 'ciclo', label: 'Ciclo' },
  { value: 'laboratorio', label: 'Laboratorio' },
  { value: 'atlas', label: 'Estructura molecular' },
  { value: 'elegibilidad', label: 'Elegibilidad' },
];

let filter = 'todos';
let index = 0;
let answers = new Map();
let deck = [];
let host = null;

function buildDeck() {
  deck = all('questions').filter((q) => filter === 'todos' || q.module === filter);
  index = 0;
}

function render() {
  if (!host) return;
  clear(host);
  const doc = el('div', { class: 'a-view--doc' });

  if (!deck.length) {
    doc.appendChild(el('div', { class: 'a-empty' }, [
      el('div', { class: 'a-empty__title', text: 'Sin preguntas para este filtro' })]));
    host.appendChild(doc);
    return;
  }

  const q = deck[index];
  const given = answers.get(q.id);
  const correct = given !== undefined && given === q.answer;

  doc.appendChild(el('div', { style: { display: 'flex', justifyContent: 'space-between',
    alignItems: 'baseline', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' } }, [
    el('div', { class: 'a-src', text: 'Pregunta ' + (index + 1) + ' de ' + deck.length
      + ' · dificultad ' + '•'.repeat(q.difficulty) }),
    el('div', { class: 'a-src', text: score() }),
  ]));
  doc.appendChild(el('div', { class: 'a-progress', style: { marginBottom: '18px' } },
    el('div', { class: 'a-progress__fill', style: { width: ((index + 1) / deck.length * 100) + '%' } })));

  doc.appendChild(el('h2', { style: { fontSize: 'var(--fs-xl)', marginBottom: '16px', maxWidth: '62ch' },
    text: q.stem }));

  const options = el('div', { class: 'a-list', style: { gap: '6px', marginBottom: '18px' } });
  q.options.forEach((text, i) => {
    const chosen = given === i;
    const isAnswer = i === q.answer;
    const showState = given !== undefined;
    options.appendChild(el('button', {
      class: 'a-list__item',
      style: {
        border: '1px solid ' + (showState && isAnswer ? 'var(--ring-c)'
          : showState && chosen ? 'var(--up)' : 'var(--line)'),
        background: showState && isAnswer ? 'color-mix(in srgb, var(--ring-c) 12%, transparent)'
          : showState && chosen ? 'color-mix(in srgb, var(--up) 10%, transparent)' : 'transparent',
        borderRadius: 'var(--radius-sm)', padding: '10px 12px', alignItems: 'flex-start',
      },
      disabled: showState,
      onClick: () => { answers.set(q.id, i); persist(); render(); },
    }, [
      el('span', { class: 'mono', style: { opacity: '.55', marginRight: '2px' },
        text: String.fromCharCode(65 + i) + '.' }),
      el('div', { class: 'a-list__main' }, el('div', { style: { fontSize: 'var(--fs-md)', whiteSpace: 'normal' }, text })),
      showState && isAnswer ? icon('check') : null,
    ].filter(Boolean)));
  });
  doc.appendChild(options);

  if (given !== undefined) {
    doc.appendChild(el('div', { class: 'a-card', style: { marginBottom: '16px',
      borderLeft: '3px solid ' + (correct ? 'var(--ring-c)' : 'var(--up)') } }, [
      el('div', { style: { fontWeight: '600', marginBottom: '5px' },
        text: correct ? 'Correcto' : 'La respuesta correcta es la ' + String.fromCharCode(65 + q.answer) }),
      el('p', { style: { fontSize: 'var(--fs-md)', marginBottom: '8px' }, text: q.explanation }),
      q.links && q.links.length ? el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } },
        q.links.filter((l) => byId(l)).map((l) => el('a', { class: 'a-chip a-chip--sm',
          href: linkFor(l), text: entityName(l) }))) : null,
      el('div', { class: 'a-src', style: { marginTop: '7px' } },
        (q.source || []).map(resolveSource).filter(Boolean).map((s) => el('span', { text: s.citation || '' }))),
    ].filter(Boolean)));
  }

  doc.appendChild(el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, [
    el('button', { class: 'a-btn', disabled: index === 0,
      onClick: () => { index--; render(); } }, el('span', { text: 'Anterior' })),
    el('button', { class: 'a-btn a-btn--primary', disabled: index >= deck.length - 1,
      onClick: () => { index++; render(); } }, [el('span', { text: 'Siguiente' }), icon('chevron')]),
    el('button', { class: 'a-btn a-btn--ghost',
      onClick: () => { answers = new Map(); persist(); index = 0; render(); } },
      [icon('reset'), el('span', { text: 'Reiniciar' })]),
  ]));

  host.appendChild(doc);
}

function score() {
  let done = 0, ok = 0;
  for (const q of deck) {
    const a = answers.get(q.id);
    if (a === undefined) continue;
    done++;
    if (a === q.answer) ok++;
  }
  return done ? ok + ' aciertos de ' + done + ' respondidas' : 'sin responder';
}

function persist() { save('quiz', Array.from(answers.entries())); }

export function mount(root) {
  const stored = load('quiz', null);
  if (Array.isArray(stored)) answers = new Map(stored);
  buildDeck();

  setStageBar([
    crumbs([{ label: 'Autoevaluacion', current: true }]),
    toolbar([el('label', { class: 'a-field' }, [
      el('span', { text: 'Tema' }),
      el('select', { onChange: (e) => { filter = e.target.value; buildDeck(); render(); } },
        MODULES.map((m) => el('option', { value: m.value, selected: m.value === filter ? true : null, text: m.label }))),
    ])]),
  ]);

  host = el('div', { class: 'a-view a-view--scroll' });
  root.appendChild(host);
  render();
  announce('Autoevaluacion con ' + deck.length + ' preguntas');
  return { unmount() { host = null; } };
}
