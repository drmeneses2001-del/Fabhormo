import { el, icon } from '../../core/dom.js';
import { all, byId } from '../../core/repo.js';
import { setStageBar } from '../../ui/shell.js';
import { mountStage } from '../../ui/stage.js';
import { moleculeNode, labelNode, tubeNode } from '../../engine/scene.js';
import { prepareMolecule, colorAtoms, familyColor } from '../../engine/molecule.js';
import { go } from '../../core/router.js';
import { load } from '../../core/persist.js';
import { quatFromAxisAngle } from '../../engine/math.js';
import { token } from '../../core/theme.js';

/** Constelacion de portada: el colesterol en el centro y las familias hormonales
 *  como brazos. Es la puerta de entrada al capitulo de esteroidogenesis. */
const SPOKES = [
  { id: 'mol:pregnenolona', label: 'Pregnenolona' },
  { id: 'mol:progesterona', label: 'Progesterona' },
  { id: 'mol:dhea', label: 'DHEA' },
  { id: 'mol:androstenediona', label: 'Androstenediona' },
  { id: 'mol:testosterona', label: 'Testosterona' },
  { id: 'mol:dht', label: 'DHT' },
  { id: 'mol:estrona', label: 'Estrona' },
  { id: 'mol:estradiol', label: 'Estradiol' },
  { id: 'mol:cortisol', label: 'Cortisol' },
  { id: 'mol:aldosterona', label: 'Aldosterona' },
];

let stage = null;

export function mount(host) {
  setStageBar([]);
  stage = mountStage(host, { label: 'Constelación de la esteroidogénesis',
    engine: { autoSpin: true, quality: 3 } });
  stage.engine.spinSpeed = 0.1;
  stage.engine.renderer.fogStrength = 0.45;

  const center = byId('mol:colesterol');
  if (center) addMolecule(center, [0, 0, 0], 0.95, true);

  const radius = 19;
  const line = token('line') || '#d9d6cd';
  SPOKES.forEach((spoke, i) => {
    const record = byId(spoke.id);
    if (!record || !record.atoms.xyz.length) return;
    const angle = (i / SPOKES.length) * Math.PI * 2;
    const tilt = Math.sin(i * 1.7) * 3.6;
    const p = [Math.cos(angle) * radius, tilt, Math.sin(angle) * radius];
    // Radio tenue desde el colesterol: la idea de origen comun se ve antes de leerla.
    stage.engine.scene.add(tubeNode(Float32Array.from([0, 0, 0, p[0] * 0.86, p[1] * 0.86, p[2] * 0.86]),
      { color: line, width: 0.16, taper: false, layer: -1, id: 'spoke:' + record.id }));
    addMolecule(record, p, 0.78, false);
    // La etiqueta se ancla al centro de la molecula y se desplaza en pantalla,
    // no en el mundo: asi mantiene la misma distancia al girar la escena.
    stage.engine.scene.add(labelNode(record.names.corto || record.names.es, {
      position: p, size: 12, weight: 600, offsetY: 42, layer: 5,
      color: familyColor(record.family), always: true, id: 'lbl:' + record.id,
    }));
  });

  stage.engine.fitSphere([0, -7, 0], radius + 6, 1.12);
  // Elevacion inicial: el anillo se lee como elipse, no como una linea.
  stage.engine.camera.setQuat = null;
  stage.engine.camera.rotate(0, -0.42);
  stage.engine.on('select', (sel) => { if (sel && sel.id) go('#/esteroidogenesis/mapa/' + sel.id.replace(':', '_')); });

  host.appendChild(overlay());
  return { unmount() { if (stage) stage.destroy(); stage = null; } };
}

function addMolecule(record, position, scale, isCenter) {
  const prepared = prepareMolecule(record, { coloring: 'family' });
  if (!prepared) return;
  const node = moleculeNode({
    xyz: prepared.xyz, radii: prepared.radii, colors: colorAtoms(record, 'family'),
    isH: prepared.isH, bonds: prepared.bonds,
  }, {
    representation: isCenter ? 'ballstick' : 'sticks', position, scale,
    pick: { type: 'mol', id: record.id }, id: 'node:' + record.id,
    spin: isCenter ? 0.22 : 0.36,
  });
  node.data.hydrogens = false;
  node.data.record = record;
  stage.engine.scene.add(node);
}

function overlay() {
  const tour = load('tour', null);
  return el('div', {
    style: { position: 'absolute', left: '0', right: '0', bottom: '0', padding: '28px 32px 32px',
             pointerEvents: 'none', zIndex: '5',
             background: 'linear-gradient(to top, var(--bg-stage) 34%, transparent)' },
  }, el('div', { style: { maxWidth: '620px', pointerEvents: 'auto' } }, [
    el('div', { style: { fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-3xl)', lineHeight: '1.05',
                         letterSpacing: '-0.015em', marginBottom: '10px' },
                text: 'De una sola molécula salen todas' }),
    el('p', { style: { fontSize: 'var(--fs-lg)', color: 'var(--ink-2)', marginBottom: '18px' },
              text: 'El colesterol es el origen comun de andrógenos, estrógenos, gestágenos y '
                  + 'corticoides. Este atlas sigue esa cascada paso a paso, enzima a enzima, hasta '
                  + 'el órgano donde cada hormona actua.' }),
    el('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } }, [
      el('a', { class: 'a-btn a-btn--primary', href: tour ? '#/esteroidogenesis/recorrido/' + tour.step : '#/esteroidogenesis/recorrido/1' },
        [icon('tour'), el('span', { text: tour ? 'Continuar el recorrido (paso ' + tour.step + ')' : 'Recorrer la esteroidogénesis' })]),
      el('a', { class: 'a-btn', href: '#/esteroidogenesis/mapa' }, [icon('pathway'), el('span', { text: 'Explorar el mapa' })]),
      el('a', { class: 'a-btn', href: '#/atlas' }, [icon('molecule'), el('span', { text: 'Atlas molecular' })]),
    ]),
    el('div', { class: 'a-src', style: { marginTop: '14px' },
                text: all('molecules').filter((m) => m.atoms && m.atoms.xyz && m.atoms.xyz.length).length
                    + ' moléculas con estructura tridimensional · '
                    + 'gira, acerca y selecciona cualquier nodo' }),
  ]));
}
