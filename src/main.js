import { initStore, set as setState, get as getState } from './core/store.js';
import { initRepo } from './core/repo.js';
import { initTheme, watchTheme, resolvedTheme } from './core/theme.js';
import { defineRoute, startRouter, go, parseHash } from './core/router.js';
import { initShell, markActiveRoute, setStageBar } from './ui/shell.js';
import { clear, $, el } from './core/dom.js';
import { load } from './core/persist.js';
import { ROUTES } from './modules/index.js';

const DEFAULT_STATE = {
  theme: 'system', themeResolved: 'light', selection: null, hover: null,
  scale: 5, tissueFilter: null, representation: 'ballstick', coloring: 'element',
  tour: null, quality: 3, advanced: false, sex: 'xx', stage: 'adulto',
};

let currentModule = null;

function mountRoute(resolved) {
  const host = $('#stageBody');
  if (currentModule && currentModule.unmount) {
    try { currentModule.unmount(); } catch (err) { console.error('unmount', err); }
  }
  currentModule = null;
  clear(host);
  setStageBar([]);
  const shell = $('#app');
  shell.dataset.inspector = 'false';

  const mod = resolved.route.meta.module;
  const ctx = { params: resolved.params, query: resolved.query, path: resolved.path, host };
  window.__atlas.routeTitle = resolved.route.meta.title || 'Atlas Esteroide 3D';
  document.title = (resolved.route.meta.title ? resolved.route.meta.title + ' · ' : '') + 'Atlas Esteroide 3D';
  markActiveRoute(resolved.path);

  try {
    currentModule = mod.mount(host, ctx) || mod;
  } catch (err) {
    console.error('Error al montar ' + resolved.path, err);
    host.appendChild(el('div', { class: 'a-empty' }, [
      el('div', { class: 'a-empty__title', text: 'No se pudo abrir esta vista' }),
      el('div', { class: 'a-muted', text: String(err && err.message || err) }),
    ]));
  }
}

function boot() {
  initStore(Object.assign({}, DEFAULT_STATE, {
    theme: load('theme', 'system'), advanced: load('advanced', false),
  }));
  initTheme();
  setState({ themeResolved: resolvedTheme() });
  const stats = initRepo(window.ATLAS_DATA || {});

  window.__atlas = {
    ready: false, routeTitle: '', engine: null, go,
    state: getState, entities: stats.entities,
    version: '0.1.0',
  };

  initShell();

  for (const r of ROUTES) defineRoute(r.path, null, { module: r.module, title: r.title });

  watchTheme(() => {
    if (window.__atlas.engine && window.__atlas.engine.refreshTheme) window.__atlas.engine.refreshTheme();
    if (currentModule && currentModule.onTheme) currentModule.onTheme(resolvedTheme());
  });

  startRouter(mountRoute);
  window.__atlas.ready = true;
  performance.mark('atlas:interactive');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
