import { el, clear, icon, $, announce } from '../core/dom.js';
import { go, linkFor, currentRoute } from '../core/router.js';
import { cycleTheme, resolvedTheme } from '../core/theme.js';
import * as store from '../core/store.js';
import { openSearch } from './search-dialog.js';

/** Capitulo insignia y laminas. El orden y el tratamiento visual distinto del
 *  capitulo son parte del diseno: la esteroidogenesis es la puerta de entrada. */
export const CHAPTER = {
  num: 'Capítulo I',
  title: 'Esteroidogénesis',
  desc: 'Del colesterol a cada hormona sexual, paso a paso',
  route: '#/esteroidogenesis/mapa',
  views: [
    { route: '#/esteroidogenesis/mapa', label: 'Mapa de la vía', icon: 'pathway' },
    { route: '#/esteroidogenesis/escalas', label: 'Dónde ocurre', icon: 'scales' },
    { route: '#/esteroidogenesis/paso', label: 'Paso enzimático', icon: 'step' },
    { route: '#/esteroidogenesis/deficit', label: 'Simulador de déficits', icon: 'deficit' },
    { route: '#/esteroidogenesis/recorrido/1', label: 'Recorrido guiado', icon: 'tour' },
  ],
};

export const MODULES = [
  { route: '#/atlas', label: 'Atlas molecular', icon: 'molecule' },
  { route: '#/organos', label: 'Órganos blanco', icon: 'body' },
  { route: '#/interacciones/mapa', label: 'Interacción bioquímica', icon: 'link' },
  { route: '#/interacciones/comparar', label: 'Comparador', icon: 'compare' },
  { route: '#/receptores', label: 'Receptores', icon: 'receptor' },
  { route: '#/ciclo', label: 'Ciclo hormonal', icon: 'cycle' },
  { route: '#/laboratorio', label: 'Laboratorio', icon: 'lab' },
  { route: '#/farmacos', label: 'Interacciones farmacológicas', icon: 'pill' },
  { route: '#/elegibilidad', label: 'Elegibilidad clínica', icon: 'check' },
  { route: '#/autoevaluacion', label: 'Autoevaluación', icon: 'quiz' },
];

export function buildRail() {
  const chapterHost = $('#railChapter');
  const modulesHost = $('#railModules');
  clear(chapterHost); clear(modulesHost);

  const chapter = el('a', { class: 'a-chapter', href: CHAPTER.route, 'data-route': '#/esteroidogenesis' }, [
    el('div', { class: 'a-chapter__num', text: CHAPTER.num }),
    el('div', { class: 'a-chapter__title', text: CHAPTER.title }),
    el('div', { class: 'a-chapter__desc', text: CHAPTER.desc }),
    el('div', { class: 'a-chapter__views' }, CHAPTER.views.map((v) =>
      el('a', { class: 'a-chapter__view', href: v.route, 'data-route': v.route }, [icon(v.icon), el('span', { text: v.label })]))),
    el('div', { class: 'a-progress', id: 'tourProgress', hidden: true }, el('div', { class: 'a-progress__fill', style: { width: '0%' } })),
  ]);
  chapterHost.appendChild(chapter);

  modulesHost.appendChild(el('div', { class: 'a-rail__grouptitle', text: 'Láminas' }));
  for (const m of MODULES) {
    modulesHost.appendChild(el('a', { class: 'a-rail__item', href: m.route, 'data-route': m.route },
      [icon(m.icon), el('span', { class: 'a-rail__label', text: m.label })]));
  }
}

export function markActiveRoute(path) {
  for (const node of document.querySelectorAll('[data-route]')) {
    const target = node.getAttribute('data-route');
    const active = path === target || path.startsWith(target + '/');
    if (active) node.setAttribute('aria-current', 'page');
    else node.removeAttribute('aria-current');
  }
}

export function initShell() {
  buildRail();

  const shell = $('#app');
  const toggle = $('#railToggle');
  toggle.addEventListener('click', () => {
    const collapsed = shell.dataset.collapsed === 'true';
    if (window.innerWidth <= 700) {
      shell.dataset.mobilerail = shell.dataset.mobilerail === 'true' ? 'false' : 'true';
      return;
    }
    shell.dataset.collapsed = String(!collapsed);
    toggle.setAttribute('aria-expanded', String(collapsed));
  });

  $('#themeBtn').addEventListener('click', () => {
    const mode = cycleTheme();
    announce('Tema: ' + (mode === 'system' ? 'sistema' : mode === 'dark' ? 'oscuro' : 'claro'));
  });

  $('#searchBtn').addEventListener('click', () => openSearch());

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
  });

  // Los enlaces de hash funcionan solos; este manejador solo cierra el rail movil.
  document.addEventListener('click', (e) => {
    const link = e.target.closest && e.target.closest('a[href^="#/"]');
    if (link && window.innerWidth <= 700) shell.dataset.mobilerail = 'false';
  });
}

export function setStageBar(nodes) {
  const bar = $('#stageBar');
  clear(bar);
  for (const n of [].concat(nodes || [])) if (n) bar.appendChild(n);
  return bar;
}

export function crumbs(items) {
  const wrap = el('nav', { class: 'a-crumbs', 'aria-label': 'Ruta' });
  items.forEach((item, i) => {
    if (i) wrap.appendChild(el('span', { class: 'a-crumbs__sep', text: '›' }));
    if (item.href) wrap.appendChild(el('a', { href: item.href, text: item.label, 'aria-current': item.current ? 'page' : null }));
    else if (item.onClick) wrap.appendChild(el('button', { text: item.label, onClick: item.onClick, 'aria-current': item.current ? 'page' : null }));
    else wrap.appendChild(el('span', { text: item.label, 'aria-current': item.current ? 'page' : null }));
  });
  return wrap;
}

export function toolbar(children) { return el('div', { class: 'a-toolbar' }, children); }

export function goTo(id) { go(linkFor(id)); }
export { currentRoute, store };
