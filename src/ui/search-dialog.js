import { el, clear, $, icon } from '../core/dom.js';
import { search, byId } from '../core/repo.js';
import { go, linkFor } from '../core/router.js';

let host = null;
let input = null;
let listHost = null;
let results = [];
let cursor = 0;

const KIND_ICON = {
  'Molecula': 'molecule', 'Enzima': 'step', 'Organo': 'body', 'Receptor': 'receptor',
  'Cuadro clinico': 'deficit', 'Tejido': 'scales', 'Lectura': 'book',
};

function render() {
  clear(listHost);
  if (!results.length) {
    listHost.appendChild(el('div', { class: 'a-empty', style: { height: '120px' } },
      el('div', { class: 'a-muted', text: input.value.trim() ? 'Sin resultados' : 'Escribe para buscar moleculas, enzimas, organos o cuadros clinicos' })));
    return;
  }
  results.forEach((r, i) => {
    listHost.appendChild(el('button', {
      class: 'a-list__item', 'data-active': i === cursor ? 'true' : null,
      onClick: () => choose(i), onMousemove: () => { if (cursor !== i) { cursor = i; render(); } },
    }, [
      icon(KIND_ICON[r.kind] || 'info'),
      el('div', { class: 'a-list__main' }, [
        el('div', { class: 'a-list__name', text: r.title }),
        el('div', { class: 'a-list__meta', text: r.kind + (r.subtitle ? ' · ' + r.subtitle : '') }),
      ]),
    ]));
  });
}

function choose(i) {
  const hit = results[i];
  if (!hit) return;
  closeSearch();
  go(linkFor(hit.id));
}

function onInput() {
  results = search(input.value, 18);
  cursor = 0;
  render();
}

function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(cursor + 1, results.length - 1); render(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); cursor = Math.max(cursor - 1, 0); render(); }
  else if (e.key === 'Enter') { e.preventDefault(); choose(cursor); }
}

export function openSearch(initial) {
  host = $('#dialog');
  host.hidden = false;
  clear(host);
  const panel = el('div', { class: 'a-dialog__panel' });
  input = el('input', {
    type: 'search', placeholder: 'Buscar en el atlas…', 'aria-label': 'Buscar',
    style: { width: '100%', border: '0', borderBottom: '1px solid var(--line)', padding: '14px 16px', background: 'transparent', fontSize: '16px', outline: 'none' },
    onInput, onKeydown: onKey,
  });
  listHost = el('div', { class: 'a-list', style: { maxHeight: '52vh', overflowY: 'auto', padding: '6px' } });
  panel.appendChild(input);
  panel.appendChild(listHost);
  host.appendChild(panel);
  host.addEventListener('click', (e) => { if (e.target === host) closeSearch(); });
  if (initial) input.value = initial;
  onInput();
  input.focus();
}

export function closeSearch() {
  if (host) { host.hidden = true; clear(host); }
}
