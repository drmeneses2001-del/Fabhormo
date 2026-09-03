import { el, clear, icon } from '../core/dom.js';
import { createEngine } from '../engine/index.js';

/** Monta un lienzo a pantalla completa dentro del escenario y devuelve el motor
 *  junto con utilidades de superposicion (llamadas, tooltip, leyenda). */
export function mountStage(host, options) {
  const o = options || {};
  // El lienzo vive en su propio contenedor: el motor mide ese contenedor, asi
  // que un panel lateral nunca descentra la proyeccion.
  const view = el('div', { class: 'a-view a-view--split' });
  const panelSlot = el('div', { class: 'a-stage__panel', hidden: !o.panel && !o.panelSlot });
  const canvasWrap = el('div', { class: 'a-stage__canvas' });
  const canvas = el('canvas', { class: 'a-canvas', tabindex: '0',
    role: 'application', 'aria-label': o.label || 'Escena tridimensional interactiva' });
  const overlay = el('div', { style: { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '3' } });
  canvasWrap.appendChild(canvas);
  canvasWrap.appendChild(overlay);
  if (o.panel) panelSlot.appendChild(o.panel);
  view.appendChild(panelSlot);
  view.appendChild(canvasWrap);
  host.appendChild(view);

  const engine = createEngine(canvas, o.engine);
  window.__atlas.engine = engine;

  const callouts = new Map();

  function callout(id, content, options2) {
    let node = callouts.get(id);
    if (!node) {
      node = el('div', { class: 'a-callout', style: { pointerEvents: 'auto' } });
      overlay.appendChild(node);
      callouts.set(id, node);
    }
    clear(node);
    node.appendChild(typeof content === 'string' ? document.createTextNode(content) : content);
    node.dataset.anchor = (options2 && options2.anchor) || '';
    return node;
  }

  function removeCallout(id) {
    const node = callouts.get(id);
    if (node) { node.remove(); callouts.delete(id); }
  }

  function clearCallouts() { for (const n of callouts.values()) n.remove(); callouts.clear(); }

  /** Reposiciona las llamadas segun la proyeccion del ultimo fotograma. */
  engine.onAfterRender = () => {
    for (const [id, node] of callouts) {
      const anchor = node.dataset.anchor || id;
      const p = engine.renderer.screenPosition(anchor);
      if (!p) { node.style.opacity = '0'; continue; }
      node.style.opacity = '1';
      node.style.transform = 'translate(' + Math.round(p.x) + 'px,' + Math.round(p.y) + 'px) translate(-50%,-50%)';
    }
    if (o.onAfterRender) o.onAfterRender();
  };

  function legend(title, rows) {
    const node = el('div', { class: 'a-legend' }, [
      el('div', { class: 'a-legend__title', text: title }),
      ...rows.map((r) => el('div', { class: 'a-legend__row' }, [
        el('span', { class: 'a-legend__swatch', style: { background: r.color, borderRadius: r.shape === 'line' ? '0' : '3px',
                     height: r.shape === 'line' ? '2px' : '11px' } }),
        el('span', { text: r.label }),
      ])),
    ]);
    canvasWrap.appendChild(node);
    return node;
  }

  function destroy() {
    engine.destroy();
    if (window.__atlas.engine === engine) window.__atlas.engine = null;
    view.remove();
  }

  return { view, canvas, canvasWrap, overlay, panelSlot, engine, callout, removeCallout,
           clearCallouts, legend, destroy };
}

/** Tooltip flotante compartido, anclado a coordenadas de pantalla. */
export function showTooltip(html, x, y) {
  const node = document.getElementById('tooltip');
  if (!node) return;
  clear(node);
  node.appendChild(typeof html === 'string' ? document.createTextNode(html) : html);
  node.style.left = x + 'px';
  node.style.top = y + 'px';
  node.hidden = false;
}

export function hideTooltip() {
  const node = document.getElementById('tooltip');
  if (node) node.hidden = true;
}

/** Grupo de botones para la barra del escenario. */
export function buttonGroup(items, active, onPick) {
  const group = el('div', { class: 'a-btngroup' });
  const buttons = items.map((item) => {
    const b = el('button', {
      class: 'a-btn', 'data-active': item.value === active ? 'true' : null,
      title: item.title || item.label, 'aria-pressed': item.value === active ? 'true' : 'false',
      onClick: () => {
        for (const other of buttons) {
          other.dataset.active = other === b ? 'true' : '';
          other.setAttribute('aria-pressed', other === b ? 'true' : 'false');
          if (other !== b) other.removeAttribute('data-active');
        }
        onPick(item.value);
      },
    }, [item.icon ? icon(item.icon, 'a-ico--sm') : null, item.label ? el('span', { text: item.label }) : null]);
    group.appendChild(b);
    return b;
  });
  return group;
}

export function selectField(label, items, active, onPick) {
  const select = el('select', { onChange: (e) => onPick(e.target.value) },
    items.map((i) => el('option', { value: i.value, selected: i.value === active ? true : null, text: i.label })));
  return el('label', { class: 'a-field' }, [el('span', { text: label }), select]);
}
