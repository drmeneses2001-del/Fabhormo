/** Estado global observable. Un unico objeto plano; los modulos se suscriben por clave. */

const listeners = new Map();
let state = {};

export function initStore(initial) { state = Object.assign({}, initial); }

export function get() { return state; }
export function getKey(key) { return state[key]; }

export function set(partial) {
  const changed = [];
  for (const [k, v] of Object.entries(partial)) {
    if (state[k] !== v) { state[k] = v; changed.push(k); }
  }
  if (!changed.length) return state;
  const notified = new Set();
  for (const key of changed) {
    for (const fn of listeners.get(key) || []) {
      if (!notified.has(fn)) { notified.add(fn); fn(state, changed); }
    }
  }
  for (const fn of listeners.get('*') || []) if (!notified.has(fn)) fn(state, changed);
  return state;
}

export function on(keys, fn) {
  for (const key of [].concat(keys)) {
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key).add(fn);
  }
  return () => off(keys, fn);
}

export function off(keys, fn) {
  for (const key of [].concat(keys)) {
    const set_ = listeners.get(key);
    if (set_) set_.delete(fn);
  }
}
