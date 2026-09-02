import { load, save } from './persist.js';
import { set } from './store.js';

const ORDER = ['system', 'light', 'dark'];

export function initTheme() {
  const stored = load('theme', 'system');
  applyTheme(ORDER.includes(stored) ? stored : 'system');
}

export function applyTheme(mode) {
  const root = document.documentElement;
  if (mode === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
  save('theme', mode);
  set({ theme: mode, themeResolved: resolvedTheme() });
  return mode;
}

export function cycleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'system';
  return applyTheme(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length]);
}

export function resolvedTheme() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'dark' || attr === 'light') return attr;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Lee un token CSS resuelto (los colores del motor 3D vienen de la hoja de estilo,
 *  para que canvas y DOM compartan exactamente la misma paleta). */
export function token(name) {
  return getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim();
}

export function watchTheme(fn) {
  const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const handler = () => { set({ themeResolved: resolvedTheme() }); fn(resolvedTheme()); };
  if (mq && mq.addEventListener) mq.addEventListener('change', handler);
  return () => { if (mq && mq.removeEventListener) mq.removeEventListener('change', handler); };
}
