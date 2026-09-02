/** Persistencia opcional. Puede lanzar en previsualizaciones o con cookies bloqueadas,
 *  asi que toda lectura y escritura va envuelta y la app funciona sin ella. */

const PREFIX = 'atlas3d.';

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch { return fallback; }
}

export function save(key, value) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); return true; }
  catch { return false; }
}

export function remove(key) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* sin persistencia */ }
}
