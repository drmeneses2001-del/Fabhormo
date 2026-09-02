/** Tabla de rutas: cada entrada asocia un patron a un modulo con contrato
 *  mount(host, ctx) -> objeto con unmount() opcional. */
import * as home from './home/home.js';
import * as pathwayMap from './steroidogenesis/map.js';
import * as scales from './steroidogenesis/scales.js';
import * as step from './steroidogenesis/step.js';
import * as deficit from './steroidogenesis/deficit.js';
import * as tour from './steroidogenesis/tour.js';
import * as atlas from './atlas/atlas.js';
import * as organs from './organs/organs.js';
import * as interactionMap from './interactions/map.js';
import * as compare from './interactions/compare.js';
import * as receptorLigand from './interactions/receptor.js';
import * as receptors from './receptors/receptors.js';
import * as cycle from './cycle/cycle.js';
import * as lab from './lab/lab.js';
import * as drugs from './drugs/drugs.js';
import * as eligibility from './eligibility/eligibility.js';
import * as readings from './readings/readings.js';
import * as quiz from './quiz/quiz.js';

export const ROUTES = [
  { path: '/', module: home, title: 'Inicio' },
  { path: '/inicio', module: home, title: 'Inicio' },

  { path: '/esteroidogenesis', module: pathwayMap, title: 'Esteroidogenesis' },
  { path: '/esteroidogenesis/mapa', module: pathwayMap, title: 'Mapa de la via' },
  { path: '/esteroidogenesis/mapa/:focus', module: pathwayMap, title: 'Mapa de la via' },
  { path: '/esteroidogenesis/escalas', module: scales, title: 'Donde ocurre' },
  { path: '/esteroidogenesis/escalas/:tissue', module: scales, title: 'Donde ocurre' },
  { path: '/esteroidogenesis/paso', module: step, title: 'Paso enzimatico' },
  { path: '/esteroidogenesis/paso/:id', module: step, title: 'Paso enzimatico' },
  { path: '/esteroidogenesis/deficit', module: deficit, title: 'Simulador de deficits' },
  { path: '/esteroidogenesis/deficit/:id', module: deficit, title: 'Simulador de deficits' },
  { path: '/esteroidogenesis/recorrido/:step', module: tour, title: 'Recorrido guiado' },

  { path: '/atlas', module: atlas, title: 'Atlas molecular' },
  { path: '/atlas/:id', module: atlas, title: 'Atlas molecular' },
  { path: '/organos', module: organs, title: 'Organos blanco' },
  { path: '/organos/:id', module: organs, title: 'Organos blanco' },
  { path: '/organos/hormona/:mol', module: organs, title: 'Organos blanco' },

  { path: '/interacciones', module: interactionMap, title: 'Interaccion bioquimica' },
  { path: '/interacciones/mapa', module: interactionMap, title: 'Mapa de interacciones' },
  { path: '/interacciones/mapa/:focus', module: interactionMap, title: 'Mapa de interacciones' },
  { path: '/interacciones/comparar', module: compare, title: 'Comparador' },
  { path: '/interacciones/comparar/:a/:b', module: compare, title: 'Comparador' },
  { path: '/interacciones/receptor/:rec', module: receptorLigand, title: 'Receptor y ligando' },
  { path: '/interacciones/receptor/:rec/:mol', module: receptorLigand, title: 'Receptor y ligando' },

  { path: '/receptores', module: receptors, title: 'Receptores' },
  { path: '/receptores/:id', module: receptors, title: 'Receptores' },
  { path: '/ciclo', module: cycle, title: 'Ciclo hormonal' },
  { path: '/laboratorio', module: lab, title: 'Laboratorio' },
  { path: '/farmacos', module: drugs, title: 'Interacciones farmacologicas' },
  { path: '/elegibilidad', module: eligibility, title: 'Elegibilidad clinica' },
  { path: '/lecturas', module: readings, title: 'Lecturas y fuentes' },
  { path: '/autoevaluacion', module: quiz, title: 'Autoevaluacion' },
];
