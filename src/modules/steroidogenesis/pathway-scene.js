import { all, byId, name as entityName } from '../../core/repo.js';
import { moleculeNode, labelNode, arrowNode, haloNode } from '../../engine/scene.js';
import { prepareMolecule, colorAtoms, familyColor } from '../../engine/molecule.js';
import { token } from '../../core/theme.js';

/** Construccion compartida del mapa de la via. La usan el mapa libre, el
 *  simulador de deficits y el recorrido guiado, de modo que las tres vistas
 *  hablan literalmente del mismo grafo y de las mismas posiciones. */

export const LABEL_DROP = 9.5;
export const LABEL_RISE = 10.5;
export const SPACING_X = 34;
export const SPACING_Y = 35;

export const ENZYME_TOKEN = {
  CYP: 'enz-cyp', HSD: 'enz-hsd', SRD5A: 'enz-red', AKR: 'enz-red',
  SULT: 'enz-sulf', STS: 'enz-sulf', transportador: 'enz-otro', otro: 'enz-otro',
};

export const COMPARTMENT_GLYPH = {
  mitocondria_membrana_interna: '◆',
  reticulo_endoplasmico_liso: '●',
  citosol: '○',
  membrana: '■',
};

export function enzymeColor(enzymeId) {
  const enz = byId(enzymeId);
  return token(ENZYME_TOKEN[enz && enz.family] || 'enz-otro') || '#888';
}

export function layoutMap() {
  const pathway = byId('path:esteroidogenesis') || (window.ATLAS_DATA && window.ATLAS_DATA.pathway);
  const map = new Map();
  for (const entry of (pathway && pathway.layout) || []) {
    map.set(entry.mol, [entry.x * SPACING_X, -entry.y * SPACING_Y, 0]);
  }
  return map;
}

export function pathwayGroups() {
  const pathway = window.ATLAS_DATA && window.ATLAS_DATA.pathway;
  return (pathway && pathway.groups) || [];
}

/** Serie visible segun los grupos plegados. */
export function seriesVisible(series, collapsed) {
  if (series === 'backdoor') return !collapsed.has('grp:backdoor');
  if (series === '11oxo') return !collapsed.has('grp:11oxo');
  if (series === 'corticoide' || series === 'inactivacion') return !collapsed.has('grp:corticoide');
  return true;
}

/**
 * Construye la escena del mapa.
 * @param engine motor destino
 * @param options { collapsed:Set, tissue:string|null, levels:Map<molId,number>, lod:boolean }
 */
export function buildPathwayScene(engine, options) {
  const o = options || {};
  const collapsed = o.collapsed || new Set();
  const positions = layoutMap();
  const reactions = all('reactions');
  const scene = engine.scene;
  scene.clear();

  const visibleMols = new Set();
  const activeReactions = [];
  for (const r of reactions) {
    if (!seriesVisible(r.series, collapsed)) continue;
    if (!positions.has(r.substrate) || !positions.has(r.product)) continue;
    activeReactions.push(r);
    visibleMols.add(r.substrate);
    visibleMols.add(r.product);
  }

  const count = visibleMols.size;
  const representation = o.representation || (count > 20 ? 'wire' : 'sticks');
  const line = token('line') || '#ccc';
  const muted = token('ink-3') || '#888';

  // Aristas primero: quedan por detras de los nodos en el orden del pintor.
  for (const r of activeReactions) {
    const from = positions.get(r.substrate);
    const to = positions.get(r.product);
    const weight = o.tissue ? tissueWeight(r, o.tissue) : 1;
    const color = weight > 0 ? enzymeColor(r.enzyme) : line;
    const alpha = weight > 0 ? 1 : 0.2;
    scene.add(arrowNode(from, to, {
      color, width: weight >= 1 ? 1.7 : 1.2, alpha,
      dash: weight === 0.5 ? [5, 4] : null, doubleHead: r.reversible,
      curve: curveFor(r), layer: -1, id: 'edge:' + r.id,
      pick: { type: 'rx', id: r.id },
      scaleBand: null,
    }));
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2];
    const enz = byId(r.enzyme);
    scene.add(labelNode((enz && enz.names.corto) || r.enzyme, {
      position: offsetForLabel(mid, from, to, curveFor(r)),
      size: 11, weight: 600, color: weight > 0 ? color : muted, always: true, font: 'mono',
      alpha, layer: 6, id: 'edgelbl:' + r.id, avoidCollision: false,
    }));
    scene.add(labelNode(COMPARTMENT_GLYPH[r.compartment] || '', {
      position: offsetForLabel(mid, from, to, curveFor(r), 12),
      size: 10, weight: 400, color: token(r.compartment === 'mitocondria_membrana_interna' ? 'comp-mito' : 'comp-rel') || muted,
      always: true, alpha, layer: 6, id: 'edgeglyph:' + r.id, avoidCollision: false,
    }));
  }

  // Nodos: cada metabolito es su molecula real en miniatura.
  for (const molId of visibleMols) {
    const record = byId(molId);
    const position = positions.get(molId);
    if (!record || !position) continue;
    const level = o.levels ? o.levels.get(molId) : undefined;
    addMoleculeNode(scene, record, position, representation, level, o);
  }

  return { positions, reactions: activeReactions, molecules: visibleMols, representation };
}

function addMoleculeNode(scene, record, position, representation, level, o) {
  const hasGeometry = record.atoms && record.atoms.xyz && record.atoms.xyz.length;
  const color = familyColor(record.family);
  const scale = 2.8;

  if (hasGeometry) {
    const prepared = prepareMolecule(record, { coloring: 'family' });
    const node = moleculeNode({
      xyz: prepared.xyz, radii: prepared.radii, colors: colorAtoms(record, 'family'),
      isH: prepared.isH, bonds: prepared.bonds,
    }, {
      representation, position, scale,
      pick: { type: 'mol', id: record.id }, id: 'node:' + record.id,
      spin: o.spin === false ? 0 : 0.14,
    });
    node.data.hydrogens = false;
    node.data.record = record;
    if (level !== undefined && level !== null) applyLevelStyle(node, level, color);
    scene.add(node);
  } else {
    scene.add(haloNode({ position, radius: 3.2, color, width: 2, dash: [4, 3],
      pick: { type: 'mol', id: record.id }, id: 'node:' + record.id }));
  }

  scene.add(labelNode(record.names.corto || record.names.es, {
    position: [position[0], position[1] - LABEL_DROP, position[2]],
    size: 13, weight: 600, color, always: true, layer: 7,
    id: 'lbl:' + record.id, avoidCollision: false,
  }));
}

/** Estilo de acumulacion o caida en el simulador de deficits. */
function applyLevelStyle(node, level, color) {
  const up = token('up') || '#c62828';
  const down = token('down') || '#1565c0';
  if (level > 1.25) {
    node.opacity = 1;
    node.data.colorOverride = node.data.colors.map(() => up);
  } else if (level < 0.4) {
    node.opacity = 0.32;
    node.data.colorOverride = node.data.colors.map(() => down);
  } else if (level < 0.8) {
    node.opacity = 0.62;
  }
}

function tissueWeight(reaction, tissueId) {
  if ((reaction.tissues || []).includes(tissueId)) return 1;
  const tissue = byId(tissueId);
  if (!tissue) return 0;
  const level = (tissue.expression || []).find((e) => e.enzyme === reaction.enzyme);
  if (level && level.level >= 1) return 1;
  if (level && level.level > 0) return 0.5;
  for (const alt of reaction.altEnzymes || []) {
    const altLevel = (tissue.expression || []).find((e) => e.enzyme === alt);
    if (altLevel && altLevel.level > 0) return 0.5;
  }
  return 0;
}

/** Curvatura para separar aristas que unen la misma pareja de filas. */
function curveFor(reaction) {
  if (reaction.series === 'backdoor') return 18;
  if (reaction.series === '11oxo') return -13;
  if (reaction.kind === 'sulfatacion') return 10;
  if (reaction.kind === 'desulfatacion') return -10;
  return 0;
}

function offsetForLabel(mid, from, to, curve, extra) {
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const d = (curve ? -curve * 0.5 : 0) + (extra || 0) * 0.4 + 11;
  return [mid[0] + nx * d, mid[1] + ny * d, mid[2]];
}

export function tissueChips() {
  return all('tissues').map((t) => ({ id: t.id, label: t.names.es, organ: t.organ }));
}

export function reactionLabel(reaction) {
  return entityName(reaction.substrate) + ' → ' + entityName(reaction.product);
}
