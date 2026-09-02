import { el, clear, icon, announce, num } from '../../core/dom.js';
import { all, byId, name as entityName } from '../../core/repo.js';
import { linkFor, slugFromId } from '../../core/router.js';
import { setStageBar, crumbs, toolbar } from '../../ui/shell.js';
import { token } from '../../core/theme.js';

/** Ciclo ovarico y endometrial. Las curvas son perfiles normalizados: describen
 *  la forma y la relacion temporal, no concentraciones. El cursor de dia enlaza
 *  con el tejido que esta trabajando y con la fase correspondiente. */

let host = null;
let canvas = null;
let day = 14;
let visible = new Set(['estradiol', 'progesterona', 'lh', 'fsh']);
let detachResize = null;

function cycle() { return window.ATLAS_DATA && window.ATLAS_DATA.cycle; }

function draw() {
  const data = cycle();
  if (!canvas || !data) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const padL = 54, padR = 18, padT = 30, padB = 34;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const x = (d) => padL + ((d - 1) / (data.days - 1)) * plotW;
  // Un 6 % de aire arriba para que los picos no toquen el borde.
  const y = (v) => padT + (1 - v * 0.94) * plotH;

  // Bandas de fase.
  const phaseColors = ['up', 'fam-estrogeno', 'accent', 'fam-gestageno'];
  data.phases.forEach((p, i) => {
    ctx.fillStyle = token(phaseColors[i] || 'ink-3');
    ctx.globalAlpha = 0.06;
    ctx.fillRect(x(p.from_), padT, x(p.to) - x(p.from_) + plotW / (data.days - 1), plotH);
    ctx.globalAlpha = 1;
    ctx.fillStyle = token('ink-3');
    ctx.font = '600 10px AtlasSans, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.label.toUpperCase(), (x(p.from_) + x(p.to)) / 2, padT - 11);
  });

  // Rejilla de dias.
  ctx.strokeStyle = token('line');
  ctx.lineWidth = 1;
  ctx.font = '10px AtlasSans, system-ui, sans-serif';
  ctx.fillStyle = token('ink-3');
  for (let d = 1; d <= data.days; d += 7) {
    ctx.beginPath(); ctx.moveTo(x(d), padT); ctx.lineTo(x(d), padT + plotH); ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillText('dia ' + d, x(d), padT + plotH + 16);
  }
  ctx.beginPath(); ctx.moveTo(padL, padT + plotH); ctx.lineTo(padL + plotW, padT + plotH); ctx.stroke();

  // Marca de ovulacion.
  ctx.strokeStyle = token('focus');
  ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(x(data.ovulation), padT); ctx.lineTo(x(data.ovulation), padT + plotH); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = token('focus');
  ctx.textAlign = 'left';
  ctx.fillText('ovulacion', x(data.ovulation) + 4, padT + 11);

  // Series.
  for (const s of data.series) {
    if (!visible.has(s.id)) continue;
    const values = data.curves[s.id];
    if (!values) continue;
    ctx.strokeStyle = token(s.color) || '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    values.forEach((v, i) => { const px = x(i + 1), py = y(v); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
    ctx.stroke();
    const last = values[values.length - 1];
    ctx.fillStyle = token(s.color) || '#888';
    ctx.font = '600 11px AtlasSans, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(s.label, padL + plotW - 2, y(last) - 6);
  }

  // Cursor del dia.
  ctx.strokeStyle = token('ink');
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x(day), padT); ctx.lineTo(x(day), padT + plotH); ctx.stroke();
  for (const s of data.series) {
    if (!visible.has(s.id)) continue;
    const v = data.curves[s.id][day - 1];
    ctx.fillStyle = token(s.color) || '#888';
    ctx.beginPath(); ctx.arc(x(day), y(v), 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = token('ink-3');
  ctx.font = '10px AtlasSans, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('nivel relativo', 6, padT + 10);
}

function phaseFor(d) {
  const data = cycle();
  return (data.phases || []).find((p) => d >= p.from_ && d <= p.to) || data.phases[0];
}

function tissuesFor(d) {
  const data = cycle();
  const entry = (data.tissuesByDay || []).find((t) => d >= t.from_ && d <= t.to);
  return entry ? entry.tissues : [];
}

function renderDetail(node) {
  const data = cycle();
  clear(node);
  const phase = phaseFor(day);
  node.appendChild(el('div', { class: 'a-inspector__kicker', text: 'Dia ' + day + ' · fase ' + phase.label.toLowerCase() }));
  node.appendChild(el('p', { style: { fontSize: 'var(--fs-md)', marginBottom: '12px' }, text: phase.text }));

  node.appendChild(el('div', { class: 'a-section' }, [
    el('div', { class: 'a-section__title', text: 'Niveles relativos en este dia' }),
    el('table', {}, [
      el('thead', {}, el('tr', {}, [el('th', { text: 'Serie' }), el('th', { text: 'Nivel' })])),
      el('tbody', {}, data.series.filter((s) => visible.has(s.id)).map((s) => el('tr', {}, [
        el('td', {}, [el('span', { class: 'a-legend__swatch',
          style: { background: token(s.color), display: 'inline-block', marginRight: '6px' } }),
          s.mol ? el('a', { href: linkFor(s.mol), text: s.label }) : el('span', { text: s.label })]),
        el('td', { class: 'mono', text: num(data.curves[s.id][day - 1] * 100, 0) + ' %' }),
      ]))),
    ]),
  ]));

  const tissues = tissuesFor(day);
  if (tissues.length) {
    node.appendChild(el('div', { class: 'a-section' }, [
      el('div', { class: 'a-section__title', text: 'Que tejido esta trabajando' }),
      el('div', { class: 'a-list' }, tissues.map((t) => el('a', {
        class: 'a-list__item', href: '#/esteroidogenesis/escalas/' + slugFromId(t),
      }, [icon('scales'), el('div', { class: 'a-list__main' }, [
        el('div', { class: 'a-list__name', text: entityName(t) }),
        el('div', { class: 'a-list__meta', text: ((byId(t) || {}).produces || []).map(entityName).join(', ') }),
      ])]))),
    ]));
  }
  node.appendChild(el('div', { class: 'a-note', text: data.note }));
}

export function mount(root) {
  host = el('div', { class: 'a-view', style: { display: 'flex' } });
  const main = el('div', { style: { flex: '1', minWidth: '0', display: 'flex', flexDirection: 'column', padding: '18px' } });
  const chartWrap = el('div', { style: { flex: '1', minHeight: '220px', position: 'relative' } });
  canvas = el('canvas', { style: { position: 'absolute', inset: '0', width: '100%', height: '100%' },
    role: 'img', 'aria-label': 'Curvas normalizadas del ciclo ovarico' });
  chartWrap.appendChild(canvas);
  main.appendChild(chartWrap);

  const slider = el('input', {
    type: 'range', min: '1', max: '28', value: String(day), 'aria-label': 'Dia del ciclo',
    style: { width: '100%', marginTop: '12px' },
    onInput: (e) => { day = Number(e.target.value); draw(); renderDetail(detail); },
  });
  main.appendChild(slider);

  const legend = el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' } },
    cycle().series.map((s) => el('button', {
      class: 'a-chip', 'data-active': visible.has(s.id) ? 'true' : null,
      style: { '--chip-color': token(s.color) }, text: s.label,
      onClick: (e) => {
        if (visible.has(s.id)) { visible.delete(s.id); e.currentTarget.removeAttribute('data-active'); }
        else { visible.add(s.id); e.currentTarget.dataset.active = 'true'; }
        draw(); renderDetail(detail);
      },
    })));
  main.appendChild(legend);

  const side = el('div', { style: { flex: '0 0 340px', borderLeft: '1px solid var(--line)',
    background: 'var(--surface)', overflowY: 'auto' } });
  const detail = el('div', { style: { padding: '14px' } });
  side.appendChild(detail);

  host.appendChild(main);
  host.appendChild(side);
  root.appendChild(host);

  setStageBar([
    crumbs([{ label: 'Ciclo hormonal', current: true }]),
    toolbar([el('span', { class: 'a-src', text: 'Arrastra el control para recorrer los 28 dias' })]),
  ]);

  const onResize = () => draw();
  window.addEventListener('resize', onResize);
  detachResize = () => window.removeEventListener('resize', onResize);
  requestAnimationFrame(() => { draw(); renderDetail(detail); });
  announce('Ciclo hormonal de 28 dias');

  return { unmount() { if (detachResize) detachResize(); host = null; canvas = null; } };
}
