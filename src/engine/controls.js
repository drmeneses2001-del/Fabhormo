import { clamp } from './math.js';

/** Entrada unificada de raton, tactil y teclado sobre el canvas del escenario.
 *  Un dedo rota, dos dedos hacen zoom y desplazan, la rueda hace zoom,
 *  el teclado cubre lo mismo para navegacion accesible. */
export function attachControls(canvas, engine) {
  const camera = engine.camera;
  const pointers = new Map();
  let drag = null;
  let pinch = null;
  let velX = 0, velY = 0;
  let spinning = true;

  const size = () => ({ w: canvas.clientWidth || 1, h: canvas.clientHeight || 1 });

  function stopAuto() {
    spinning = false;
    engine.autoSpin = false;
  }

  function onPointerDown(e) {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      drag = { x: e.clientX, y: e.clientY, moved: 0, button: e.button, t: performance.now() };
      velX = velY = 0;
    } else if (pointers.size === 2) {
      const [a, b] = Array.from(pointers.values());
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      drag = null;
    }
    stopAuto();
  }

  function onPointerMove(e) {
    const prev = pointers.get(e.pointerId);
    if (prev) { prev.x = e.clientX; prev.y = e.clientY; }
    if (pinch && pointers.size === 2) {
      const [a, b] = Array.from(pointers.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      if (pinch.dist > 0) camera.zoom(clamp(pinch.dist / dist, 0.5, 2));
      const { w, h } = size();
      camera.pan((cx - pinch.cx) / w, (cy - pinch.cy) / h);
      pinch = { dist, cx, cy };
      engine.requestRender();
      return;
    }
    if (!drag) { engine.handleHover(e); return; }
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    const { w, h } = size();
    if (drag.button === 2 || e.shiftKey) camera.pan(dx / w, dy / h);
    else {
      velX = (dx / w) * 3.4; velY = (dy / h) * 3.4;
      camera.rotate(velX, velY);
    }
    drag.x = e.clientX; drag.y = e.clientY;
    engine.requestRender();
  }

  function onPointerUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && drag.moved < 5) engine.handleClick(e);
    if (drag) engine.startInertia(velX, velY);
    if (!pointers.size) drag = null;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ya liberado */ }
  }

  function onWheel(e) {
    e.preventDefault();
    stopAuto();
    camera.zoom(Math.exp(clamp(e.deltaY, -240, 240) * 0.0013));
    engine.onZoomChange(e);
    engine.requestRender();
  }

  function onKey(e) {
    const step = e.shiftKey ? 0.24 : 0.09;
    let handled = true;
    switch (e.key) {
      case 'ArrowLeft': camera.rotate(-step, 0); break;
      case 'ArrowRight': camera.rotate(step, 0); break;
      case 'ArrowUp': camera.rotate(0, -step); break;
      case 'ArrowDown': camera.rotate(0, step); break;
      case '+': case '=': camera.zoom(0.86); engine.onZoomChange(e); break;
      case '-': case '_': camera.zoom(1.16); engine.onZoomChange(e); break;
      case 'r': case 'R': engine.resetCamera(); break;
      case 'Tab': handled = engine.focusNext(e.shiftKey); break;
      case 'Enter': case ' ': handled = engine.activateFocused(); break;
      case 'Escape': handled = engine.clearSelection(); break;
      default: handled = false;
    }
    if (handled) { e.preventDefault(); stopAuto(); engine.requestRender(); }
  }

  function onContextMenu(e) { e.preventDefault(); }
  function onLeave() { engine.handleHover(null); }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('keydown', onKey);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('pointerleave', onLeave);

  return function detach() {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('keydown', onKey);
    canvas.removeEventListener('contextmenu', onContextMenu);
    canvas.removeEventListener('pointerleave', onLeave);
  };
}
