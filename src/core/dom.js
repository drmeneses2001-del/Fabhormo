/** Utilidades minimas de DOM. Sin dependencias: la app no usa framework. */

export function el(tag, props, children) {
  const node = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (v === true) node.setAttribute(k, '');
      else node.setAttribute(k, v);
    }
  }
  append(node, children);
  return node;
}

export function append(parent, children) {
  if (children === null || children === undefined || children === false) return parent;
  if (Array.isArray(children)) { for (const c of children) append(parent, c); return parent; }
  parent.appendChild(children instanceof Node ? children : document.createTextNode(String(children)));
  return parent;
}

export function clear(node) { while (node && node.firstChild) node.removeChild(node.firstChild); return node; }

export function icon(name, cls) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'a-ico' + (cls ? ' ' + cls : ''));
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', '#i-' + name);
  svg.appendChild(use);
  return svg;
}

export function $(sel, root) { return (root || document).querySelector(sel); }
export function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

/** Anuncia un cambio a lectores de pantalla sin mover el foco. */
export function announce(text) {
  const live = document.getElementById('live');
  if (live) { live.textContent = ''; requestAnimationFrame(() => { live.textContent = text; }); }
}

export function debounce(fn, ms) {
  let t = 0;
  return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}

/** Formatea un numero con separador decimal espanol y precision fija. */
export function num(value, digits) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const d = digits === undefined ? (Math.abs(value) >= 100 ? 0 : Math.abs(value) >= 10 ? 1 : 2) : digits;
  return value.toFixed(d).replace('.', ',');
}
