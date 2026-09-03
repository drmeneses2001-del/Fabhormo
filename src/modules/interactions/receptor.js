import { el, clear, icon, announce } from '../../core/dom.js';
import { byId, all, name as entityName } from '../../core/repo.js';
import { go, idFromSlug, slugFromId, linkFor } from '../../core/router.js';
import { setStageBar, crumbs, toolbar } from '../../ui/shell.js';
import { mountStage } from '../../ui/stage.js';
import { moleculeNode, labelNode, pathNode, haloNode } from '../../engine/scene.js';
import { cellOutline, toPath3, spread } from '../../engine/shapes.js';
import { prepareMolecule, colorAtoms, familyColor } from '../../engine/molecule.js';
import { token } from '../../core/theme.js';

/** Receptor y ligando. Sin estructura cristalografica disponible en el entorno
 *  de compilacion, el dominio de union se representa como un esquema declarado
 *  como tal: lo que si es dato real es la molecula del ligando y el tipo de
 *  actividad que ejerce sobre el receptor. */

const KIND_LABEL = {
  agonista: 'Agonista', agonista_parcial: 'Agonista parcial',
  antagonista: 'Antagonista', modulador: 'Modulador selectivo',
};

let stage = null;
let recId = 'rec:AR';
let molId = null;
let panelBody = null;

function build() {
  const scene = stage.engine.scene;
  scene.clear();
  const rec = byId(recId);
  const mol = molId && byId(molId);
  const color = token('fam-farmaco') || '#6a1b9a';

  scene.add(pathNode(toPath3(cellOutline(16, 0.26, 31), -2), {
    stroke: color, fill: null, lineWidth: 2, layer: -3, id: 'lbd',
  }));
  scene.add(labelNode('Dominio de unión al ligando · esquema', {
    position: [0, 18.5, 0], size: 11, color, always: true, layer: 3, id: 'lbd:lbl',
  }));
  scene.add(labelNode('Sin estructura cristalográfica cargada', {
    position: [0, -18.5, 0], size: 10, color: token('ink-3'), always: true, layer: 3, id: 'lbd:note',
  }));

  if (mol && mol.atoms.xyz.length) {
    const prepared = prepareMolecule(mol, { coloring: 'element' });
    const node = moleculeNode({
      xyz: prepared.xyz, radii: prepared.radii, colors: colorAtoms(mol, 'element'),
      isH: prepared.isH, bonds: prepared.bonds,
    }, { representation: 'ballstick', scale: 1.25, spin: 0.16, id: 'ligand',
         pick: { type: 'mol', id: mol.id } });
    node.data.record = mol;
    node.data.hydrogens = false;
    scene.add(node);
    const kind = ((rec.ligands || []).find((l) => l.mol === mol.id) || {}).kind;
    scene.add(labelNode(mol.names.es + (kind ? ' · ' + (KIND_LABEL[kind] || kind).toLowerCase() : ''), {
      position: [0, -14, 0], size: 13, weight: 600, color: familyColor(mol.family),
      always: true, layer: 4, id: 'ligand:lbl',
    }));
  } else {
    scene.add(labelNode('Elige un ligando', { position: [0, 0, 0], size: 14,
      color: token('ink-3'), always: true, layer: 3, id: 'empty' }));
  }

  // Contactos esquematicos alrededor del bolsillo.
  spread(6, 13, 12, 0.5).forEach((p, i) => {
    scene.add(haloNode({ position: [p[0], p[1], -1], radius: 1.2, color, width: 1.1,
      opacity: 0.5, layer: -2, id: 'contact' + i }));
  });

  stage.engine.resetCamera(1.15);
  stage.engine.requestRender();
  renderPanel();
}

function renderPanel() {
  if (!panelBody) return;
  clear(panelBody);
  const rec = byId(recId);
  panelBody.appendChild(el('div', { class: 'a-inspector__kicker',
    text: rec.class === 'nuclear' ? 'Receptor nuclear' : 'Receptor de membrana' }));
  panelBody.appendChild(el('h2', { class: 'a-inspector__title', style: { fontSize: 'var(--fs-lg)' },
    text: rec.names.es }));
  panelBody.appendChild(el('div', { class: 'a-muted', style: { fontSize: 'var(--fs-md)', marginBottom: '10px' },
    text: 'gen ' + rec.gene + (rec.isoforms ? ' · isoformas ' + rec.isoforms.join(', ') : '') }));
  panelBody.appendChild(el('p', { style: { fontSize: 'var(--fs-md)', marginBottom: '14px' },
    text: rec.mechanism }));

  const groups = {};
  for (const l of rec.ligands || []) {
    (groups[l.kind] = groups[l.kind] || []).push(l.mol);
  }
  for (const [kind, mols] of Object.entries(groups)) {
    panelBody.appendChild(el('div', { class: 'a-section' }, [
      el('div', { class: 'a-section__title', text: KIND_LABEL[kind] || kind }),
      el('div', { class: 'a-list' }, mols.map((m) => el('button', {
        class: 'a-list__item', 'data-active': m === molId ? 'true' : null,
        onClick: () => { molId = m; go('#/interacciones/receptor/' + slugFromId(recId) + '/' + slugFromId(m)); },
      }, [
        el('span', { class: 'a-list__dot', style: { background: familyColor((byId(m) || {}).family) } }),
        el('div', { class: 'a-list__main' }, el('div', { class: 'a-list__name', text: entityName(m) })),
      ]))),
    ]));
  }
  panelBody.appendChild(el('div', { class: 'a-note', style: { marginTop: '10px' },
    text: 'La afinidad relativa de cada ligando no se muestra como cifra: no hay una fuente '
        + 'comprobada disponible en esta compilación, y una cifra sin fuente no entra en el atlas.' }));
  panelBody.appendChild(el('div', { style: { display: 'flex', gap: '7px', marginTop: '12px', flexWrap: 'wrap' } }, [
    el('a', { class: 'a-btn', href: '#/receptores/' + slugFromId(recId) },
      [icon('receptor'), el('span', { text: 'Ficha del receptor' })]),
    molId ? el('a', { class: 'a-btn a-btn--ghost', href: linkFor(molId) },
      [icon('molecule'), el('span', { text: 'Ficha del ligando' })]) : null,
  ].filter(Boolean)));
}

function receptorPanel() {
  const panel = el('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } });
  panel.appendChild(el('div', { style: { padding: '11px 12px 8px', borderBottom: '1px solid var(--line)' } },
    el('div', { class: 'a-section__title', style: { marginBottom: '0' }, text: 'Receptor' })));
  const list = el('div', { class: 'a-list', style: { overflowY: 'auto', flex: '1', padding: '6px' } });
  for (const r of all('receptors')) {
    list.appendChild(el('button', {
      class: 'a-list__item', 'data-active': r.id === recId ? 'true' : null,
      onClick: () => go('#/interacciones/receptor/' + slugFromId(r.id)),
    }, [icon('receptor'), el('div', { class: 'a-list__main' }, [
      el('div', { class: 'a-list__name', text: r.names.es }),
      el('div', { class: 'a-list__meta', text: (r.ligands || []).length + ' ligandos' })])]));
  }
  panel.appendChild(list);
  return panel;
}

export function mount(host, ctx) {
  const r = ctx.params.rec ? idFromSlug(ctx.params.rec) : null;
  const m = ctx.params.mol ? idFromSlug(ctx.params.mol) : null;
  if (r && byId(r)) recId = r;
  const rec = byId(recId);
  molId = m && byId(m) ? m : ((rec.ligands || [])[0] || {}).mol || null;

  stage = mountStage(host, { label: 'Receptor y ligando', panel: receptorPanel(),
    engine: { autoSpin: false, quality: 3 } });

  const side = el('div', { class: 'a-stage__aside' });
  panelBody = el('div', { style: { padding: '14px' } });
  side.appendChild(panelBody);
  stage.canvasWrap.appendChild(side);
  stage.canvas.dataset.reserveRight = window.innerWidth > 900 ? '336' : '0';
  stage.engine.handleResize(true);

  setStageBar([
    crumbs([{ label: 'Interacción bioquímica', href: '#/interacciones/mapa' },
            { label: 'Receptor y ligando', current: true }]),
    toolbar([el('a', { class: 'a-btn', href: '#/receptores' },
      [icon('receptor'), el('span', { text: 'Todos los receptores' })])]),
  ]);
  build();
  announce(entityName(recId) + (molId ? ' con ' + entityName(molId) : ''));

  return { unmount() { if (stage) stage.destroy(); stage = null; panelBody = null; } };
}
