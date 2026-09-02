/** Enrutado por hash: es el unico que funciona igual con file:// y dentro del
 *  visor de Artifacts. Las rutas se declaran como patrones con segmentos ':id'. */

const routes = [];
let current = null;
let onChange = null;

export function defineRoute(pattern, handler, meta) {
  const parts = pattern.split('/').filter(Boolean);
  routes.push({ pattern, parts, handler, meta: meta || {} });
}

function matchRoute(pathParts) {
  let best = null;
  for (const route of routes) {
    if (route.parts.length !== pathParts.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < route.parts.length; i++) {
      const rp = route.parts[i];
      if (rp.startsWith(':')) params[rp.slice(1)] = decodeURIComponent(pathParts[i]);
      else if (rp !== pathParts[i]) { ok = false; break; }
    }
    if (ok) { best = { route, params }; break; }
  }
  return best;
}

export function parseHash(hash) {
  const raw = (hash || '').replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('¿?');
  const parts = pathPart.split('/').filter(Boolean);
  const query = {};
  if (queryPart) for (const kv of queryPart.split('&')) {
    const [k, v] = kv.split('=');
    if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return { parts, query, path: '#/' + parts.join('/') };
}

export function resolve(hash) {
  const { parts, query, path } = parseHash(hash);
  const found = matchRoute(parts) || matchRoute(['inicio']);
  if (!found) return null;
  return { path, parts, query, params: found.params, route: found.route };
}

export function go(path, opts) {
  const target = path.startsWith('#') ? path : '#/' + path.replace(/^\/+/, '');
  if (location.hash === target) { handle(); return; }
  if (opts && opts.replace) location.replace(location.pathname + location.search + target);
  else location.hash = target;
}

function handle() {
  const resolved = resolve(location.hash);
  if (!resolved) return;
  const previous = current;
  current = resolved;
  if (onChange) onChange(resolved, previous);
}

export function startRouter(handler) {
  onChange = handler;
  window.addEventListener('hashchange', handle);
  if (!location.hash) go('#/', { replace: true });
  handle();
}

export function currentRoute() { return current; }

/** Enlace canonico de una entidad segun su prefijo de identificador. */
export function linkFor(id) {
  if (!id) return '#/';
  const [kind, rest] = String(id).split(':');
  switch (kind) {
    case 'mol': case 'drug': return '#/atlas/' + id.replace(':', '_');
    case 'enz': return '#/esteroidogenesis/paso/enz_' + rest;
    case 'rx': return '#/esteroidogenesis/paso/' + id.replace(':', '_');
    case 'tis': return '#/esteroidogenesis/escalas/' + id.replace(':', '_');
    case 'org': return '#/organos/' + id.replace(':', '_');
    case 'rec': return '#/receptores/' + id.replace(':', '_');
    case 'cond': return '#/esteroidogenesis/deficit/' + id.replace(':', '_');
    case 'lab': return '#/laboratorio';
    case 'read': return '#/lecturas';
    default: return '#/';
  }
}

/** Conversion entre identificador de datos (mol:x) y segmento de ruta (mol_x). */
export function idFromSlug(slug) { return slug ? slug.replace('_', ':') : null; }
export function slugFromId(id) { return id ? id.replace(':', '_') : null; }
