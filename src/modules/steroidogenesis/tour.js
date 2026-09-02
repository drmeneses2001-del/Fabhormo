import { el, clear, icon, announce } from '../../core/dom.js';
import { byId, all, name as entityName } from '../../core/repo.js';
import { go, linkFor, slugFromId } from '../../core/router.js';
import { setStageBar, crumbs, toolbar } from '../../ui/shell.js';
import { mountStage } from '../../ui/stage.js';
import { moleculeNode, labelNode, haloNode } from '../../engine/scene.js';
import { prepareMolecule, colorAtoms, familyColor } from '../../engine/molecule.js';
import { prepareMorph, morphNodeData, applyMorph, morphChangeColors } from '../../engine/morph.js';
import { buildPathwayScene, layoutMap } from './pathway-scene.js';
import { token } from '../../core/theme.js';
import { load, save } from '../../core/persist.js';

/** Recorrido guiado: la misma escena y los mismos datos que el modo libre, en un
 *  orden pensado para quien lo ve por primera vez. Cada paso deja un enlace al
 *  lugar del atlas donde seguir explorando por cuenta propia. */

let stage = null;
let index = 0;
let morphState = null;
let narrationHost = null;

const STEPS = [
  {
    title: 'Un esqueleto de cuatro anillos',
    text: 'Todas las hormonas esteroideas comparten el mismo armazon: tres anillos de seis carbonos '
        + 'y uno de cinco, el nucleo ciclopentanoperhidrofenantreno. Lo que las diferencia son los '
        + 'grupos que cuelgan de el y unos pocos dobles enlaces.',
    scene: (s) => molecule('mol:colesterol', 'rings'),
    link: { label: 'Ver el colesterol en el atlas', href: '#/atlas/mol_colesterol' },
  },
  {
    title: 'Los anillos se llaman A, B, C y D',
    text: 'La numeracion es universal: el carbono 3 esta en el anillo A y el 17 en el D. Casi toda '
        + 'la quimica que veras ocurre en esas dos posiciones, mas el carbono 11 y el 19.',
    scene: () => molecule('mol:testosterona', 'rings'),
    link: { label: 'Comparar estructuras', href: '#/interacciones/comparar/mol_testosterona/mol_estradiol' },
  },
  {
    title: 'Todo empieza en el colesterol',
    text: 'La celula esteroidogenica toma colesterol de las lipoproteinas o lo sintetiza. El paso '
        + 'que regula la produccion no es enzimatico: es el transporte del colesterol a la membrana '
        + 'mitocondrial interna por la proteina StAR, y es lo que responde en minutos a LH, FSH y ACTH.',
    scene: () => molecule('mol:colesterol', 'element'),
    link: { label: 'Ver la celula por dentro', href: '#/esteroidogenesis/escalas/tis_leydig' },
  },
  {
    title: 'CYP11A1 corta la cadena lateral',
    text: 'Dentro de la mitocondria, la enzima de escision retira seis carbonos de la cadena lateral '
        + 'del colesterol y deja pregnenolona. Es el unico paso comun a toda la esteroidogenesis: '
        + 'todo lo demas viene despues.',
    scene: () => morph('rx:col_preg'),
    link: { label: 'Ver el paso completo', href: '#/esteroidogenesis/paso/rx_col_preg' },
  },
  {
    title: 'La bifurcacion: Δ5 o Δ4',
    text: 'Desde la pregnenolona hay dos rutas paralelas. La 3β-HSD oxida el hidroxilo del carbono 3 '
        + 'y desplaza el doble enlace: eso convierte la serie Δ5 (arriba) en la serie Δ4 (abajo). '
        + 'En el ser humano el camino hacia los androgenos prefiere quedarse arriba.',
    scene: () => pathway(['mol:pregnenolona', 'mol:progesterona', 'mol:17oh_pregnenolona', 'mol:17oh_progesterona']),
    link: { label: 'Explorar el mapa', href: '#/esteroidogenesis/mapa' },
  },
  {
    title: 'CYP17A1 hace dos cosas distintas',
    text: 'Una sola proteina con dos actividades. Como 17α-hidroxilasa anade un hidroxilo en el '
        + 'carbono 17; como 17,20-liasa corta el enlace entre los carbonos 17 y 20 y deja un '
        + 'androgeno de 19 carbonos. El citocromo b5 inclina la balanza hacia la segunda.',
    scene: () => morph('rx:preg_17ohpreg'),
    link: { label: 'Ficha de CYP17A1', href: '#/esteroidogenesis/paso/rx_17ohpreg_dhea' },
  },
  {
    title: 'La liasa da el primer androgeno',
    text: 'Al cortar la cadena lateral de la 17α-hidroxipregnenolona aparece la DHEA. Fijate en que '
        + 'la molecula pierde dos carbonos y un oxigeno: acaba de pasar de C21 a C19.',
    scene: () => morph('rx:17ohpreg_dhea'),
    link: { label: 'Ver DHEA en el atlas', href: '#/atlas/mol_dhea' },
  },
  {
    title: 'De DHEA a testosterona',
    text: 'Dos pasos mas: la 3β-HSD pasa la molecula a la serie Δ4 y la 17β-HSD3 reduce el grupo '
        + 'ceto del carbono 17. El resultado es testosterona, el androgeno circulante principal.',
    scene: () => pathway(['mol:dhea', 'mol:androstenediona', 'mol:testosterona']),
    link: { label: 'Ver testosterona', href: '#/atlas/mol_testosterona' },
  },
  {
    title: 'La 5α-reductasa amplifica la senal',
    text: 'En la piel genital, la prostata y el foliculo piloso, la testosterona se reduce a '
        + 'dihidrotestosterona. La composicion apenas cambia, pero la afinidad por el receptor sube '
        + 'y la disociacion se hace mas lenta: el mismo mensaje, mucho mas alto.',
    scene: () => morph('rx:t_dht'),
    link: { label: 'Deficit de 5α-reductasa', href: '#/esteroidogenesis/deficit/cond_def_5ar2' },
  },
  {
    title: 'La aromatasa cambia de familia',
    text: 'Tres hidroxilaciones sucesivas eliminan el carbono 19 y convierten el anillo A en un '
        + 'fenol aromatico. Ese unico paso transforma un androgeno en un estrogeno, y es el que '
        + 'bloquean el letrozol y el anastrozol.',
    scene: () => morph('rx:t_e2'),
    link: { label: 'Ver la aromatasa', href: '#/esteroidogenesis/paso/rx_t_e2' },
  },
  {
    title: 'Dos celulas para un estrogeno',
    text: 'En el foliculo ovarico el trabajo esta repartido. La teca tiene CYP17A1 y fabrica '
        + 'androstenediona, pero no tiene aromatasa. La granulosa tiene aromatasa, pero no puede '
        + 'fabricar androgenos. Ninguna de las dos produce estradiol por si sola.',
    scene: () => pathway(['mol:androstenediona', 'mol:testosterona', 'mol:estrona', 'mol:estradiol'], 'tis:granulosa'),
    link: { label: 'Ver la granulosa', href: '#/esteroidogenesis/escalas/tis_granulosa' },
  },
  {
    title: 'La suprarrenal trabaja por zonas',
    text: 'La misma glandula fabrica tres cosas distintas segun la zona. La glomerular no tiene '
        + 'CYP17A1 y termina en aldosterona; la fasciculada hidroxila en 17 pero corta poco y '
        + 'termina en cortisol; la reticular tiene citocromo b5 alto y desvia el flujo a DHEA.',
    scene: () => pathway(null, 'tis:reticular'),
    link: { label: 'Recorrer la suprarrenal', href: '#/esteroidogenesis/escalas/tis_reticular' },
  },
  {
    title: 'Del torrente al organo blanco',
    text: 'La hormona viaja unida a la SHBG y a la albumina, y solo la fraccion libre entra en la '
        + 'celula diana. Alli encuentra su receptor: androgenos con AR, estrogenos con ERα y ERβ, '
        + 'progesterona con PR. El efecto depende del receptor que haya en ese tejido.',
    scene: () => molecule('mol:estradiol', 'groups'),
    link: { label: 'Ver los organos blanco', href: '#/organos' },
  },
  {
    title: 'Cuando un paso falla',
    text: 'Bloquea la 21-hidroxilasa y veras el patron completo: se acumula todo lo que hay antes '
        + 'del bloqueo, falta lo que hay despues, y el flujo represado se desvia por la unica salida '
        + 'libre, la androgenica. Ese es el mecanismo de la hiperplasia suprarrenal congenita.',
    scene: () => pathway(null, null, true),
    link: { label: 'Abrir el simulador', href: '#/esteroidogenesis/deficit/cond_def_21oh' },
  },
  {
    title: 'El mapa completo',
    text: 'Ya tienes las piezas: un origen comun, dos series paralelas, una enzima con dos '
        + 'actividades que decide el destino, una reduccion que amplifica y una aromatizacion que '
        + 'cambia de familia. Lo demas es donde ocurre cada paso y que pasa cuando falta una enzima.',
    scene: () => pathway(),
    link: { label: 'Explorar por tu cuenta', href: '#/esteroidogenesis/mapa' },
  },
];

/* ------------------------------------------------------- escenas del paso --- */

function molecule(molId, coloring) {
  const record = byId(molId);
  if (!record || !record.atoms.xyz.length) return;
  const prepared = prepareMolecule(record, { coloring });
  const node = moleculeNode({
    xyz: prepared.xyz, radii: prepared.radii, colors: colorAtoms(record, coloring),
    isH: prepared.isH, bonds: prepared.bonds,
  }, { representation: 'ballstick', id: 'tour:mol', spin: 0,
       pick: { type: 'mol', id: molId } });
  node.data.record = record;
  node.data.hydrogens = false;
  stage.engine.scene.add(node);
  stage.engine.autoSpin = true;
  stage.engine.spinSpeed = 0.14;
  stage.engine.camera.orthographic = false;
  stage.engine.resetCamera(1.35);
}

function morph(reactionId) {
  const rx = byId(reactionId);
  if (!rx || !rx.atomMap) return;
  const data = morphNodeData(prepareMorph(byId(rx.substrate), byId(rx.product), rx.atomMap),
    { representation: 'ballstick' });
  const node = moleculeNode(data, { id: 'tour:morph', scale: 1.7,
    pick: { type: 'rx', id: reactionId } });
  Object.assign(node.data, data);
  node.data.colors = morphChangeColors(node.data);
  stage.engine.scene.add(node);
  const sub = byId(rx.substrate), prod = byId(rx.product);
  stage.engine.scene.add(labelNode(sub.names.es + '  →  ' + prod.names.es, {
    position: [0, -13, 0], size: 13, weight: 600, color: token('ink-2'), always: true,
    layer: 5, id: 'tour:morphlbl' }));
  morphState = { node, t: 0, dir: 1 };
  stage.engine.autoSpin = false;
  stage.engine.camera.orthographic = false;
  stage.engine.resetCamera(1.3);
}

function pathway(highlight, tissue, deficit) {
  buildPathwayScene(stage.engine, {
    collapsed: new Set(['grp:backdoor', 'grp:11oxo', deficit ? '' : 'grp:corticoide']),
    tissue: tissue || null, spin: false,
  });
  const positions = layoutMap();
  if (highlight) {
    for (const molId of highlight) {
      const p = positions.get(molId);
      if (p) {
        stage.engine.scene.add(haloNode({ position: p, radius: 6.5, color: token('accent'),
          width: 2, pulse: 1, layer: 3, id: 'tour:hl' + molId }));
      }
    }
  }
  if (deficit) {
    for (const rid of ['rx:prog_doc', 'rx:17ohprog_s']) {
      const rx = byId(rid);
      const from = positions.get(rx.substrate), to = positions.get(rx.product);
      if (!from || !to) continue;
      const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, 0];
      stage.engine.scene.add(labelNode('✗', { position: mid, size: 18, weight: 600,
        color: token('up'), always: true, layer: 8, id: 'tour:blk' + rid }));
    }
  }
  stage.engine.autoSpin = false;
  stage.engine.camera.orthographic = true;
  const ids = highlight && highlight.length
    ? highlight.map((m) => 'node:' + m).filter((id) => stage.engine.scene.get(id))
    : null;
  const b = stage.engine.scene.bounds(ids);
  stage.engine.fitSphere(b.center, Math.max(b.radius, 24), 1.2);
  stage.engine.camera.orientation.set([0, 0, 0, 1]);
  stage.engine.camera.markDirty();
}

/* ------------------------------------------------------------- narracion --- */

function renderNarration() {
  const step = STEPS[index];
  clear(narrationHost);
  narrationHost.appendChild(el('div', { class: 'a-src', style: { marginBottom: '4px' },
    text: 'Paso ' + (index + 1) + ' de ' + STEPS.length }));
  narrationHost.appendChild(el('h2', { style: { fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-xl)',
    margin: '0 0 8px' }, text: step.title }));
  narrationHost.appendChild(el('p', { style: { fontSize: 'var(--fs-lg)', color: 'var(--ink-2)',
    marginBottom: '14px', maxWidth: '62ch' }, text: step.text }));
  const actions = el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' } }, [
    el('button', { class: 'a-btn', disabled: index === 0, onClick: () => goStep(index - 1) },
      [el('span', { text: 'Atras' })]),
    index < STEPS.length - 1
      ? el('button', { class: 'a-btn a-btn--primary', onClick: () => goStep(index + 1) },
          [el('span', { text: 'Siguiente' }), icon('chevron')])
      : el('a', { class: 'a-btn a-btn--primary', href: '#/esteroidogenesis/mapa' },
          [el('span', { text: 'Terminar y explorar' })]),
    step.link ? el('a', { class: 'a-btn a-btn--ghost', href: step.link.href },
      [icon('link'), el('span', { text: step.link.label })]) : null,
  ].filter(Boolean));
  narrationHost.appendChild(actions);
  announce(step.title);
}

function goStep(next) {
  index = Math.max(0, Math.min(STEPS.length - 1, next));
  save('tour', { step: index + 1 });
  morphState = null;
  stage.engine.scene.clear();
  STEPS[index].scene();
  stage.engine.requestRender();
  renderNarration();
  updateProgress();
  history.replaceState(null, '', '#/esteroidogenesis/recorrido/' + (index + 1));
  setStageBar([
    crumbs([{ label: 'Esteroidogenesis', href: '#/esteroidogenesis/mapa' },
            { label: 'Recorrido guiado', current: true }]),
    toolbar([el('span', { class: 'a-src', text: 'Puedes girar y acercar la escena en cualquier paso' })]),
  ]);
}

function updateProgress() {
  const bar = document.getElementById('tourProgress');
  if (!bar) return;
  bar.hidden = false;
  const fill = bar.firstChild;
  if (fill) fill.style.width = ((index + 1) / STEPS.length * 100).toFixed(0) + '%';
}

export function mount(host, ctx) {
  const wanted = Number(ctx.params.step || 1);
  index = Number.isFinite(wanted) ? Math.max(0, Math.min(STEPS.length - 1, wanted - 1)) : 0;

  stage = mountStage(host, { label: 'Recorrido guiado por la esteroidogenesis',
    engine: { autoSpin: false, quality: 3 } });
  stage.engine.renderer.fogStrength = 0.2;

  narrationHost = el('div', {
    style: { position: 'absolute', left: '0', right: '0', bottom: '0', padding: '22px 28px 26px',
             zIndex: '5', background: 'linear-gradient(to top, var(--bg-stage) 42%, transparent)' },
  });
  stage.canvasWrap.appendChild(narrationHost);

  stage.engine.on('select', (sel) => { if (sel && sel.type === 'mol') go(linkFor(sel.id)); });

  let last = performance.now();
  const loop = () => {
    if (!stage) return;
    const now = performance.now();
    if (morphState) {
      morphState.t += morphState.dir * (now - last) / 2800;
      if (morphState.t >= 1) { morphState.t = 1; morphState.dir = -1; }
      if (morphState.t <= 0) { morphState.t = 0; morphState.dir = 1; }
      const e = morphState.t < 0.5 ? 4 * Math.pow(morphState.t, 3)
        : 1 - Math.pow(-2 * morphState.t + 2, 3) / 2;
      applyMorph(morphState.node.data, e);
      stage.engine.requestRender();
    }
    last = now;
    raf = requestAnimationFrame(loop);
  };
  let raf = requestAnimationFrame(loop);

  goStep(index);

  return {
    unmount() {
      cancelAnimationFrame(raf);
      const bar = document.getElementById('tourProgress');
      if (bar) bar.hidden = true;
      if (stage) stage.destroy();
      stage = null; narrationHost = null; morphState = null;
    },
  };
}
