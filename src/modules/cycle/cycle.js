import { el } from '../../core/dom.js';

export function mount(host) {
  host.appendChild(el('div', { class: 'a-empty' }, [
    el('div', { class: 'a-empty__title', text: 'En construccion' }),
    el('div', { class: 'a-muted', text: 'Modulo cycle' }),
  ]));
  return {};
}
