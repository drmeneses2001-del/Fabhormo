import { el, clear, icon, $, announce } from '../core/dom.js';
import { byId, name as entityName, reactionsProducing, reactionsConsuming, organsTargetedBy,
         tissuesProducing, interactionsOf, conditionsOfEnzyme, all } from '../core/repo.js';
import { linkFor, go } from '../core/router.js';
import { familyColor } from '../engine/molecule.js';

const FAMILY_LABEL = {
  androgeno: 'Androgeno', estrogeno: 'Estrogeno', gestageno: 'Gestageno',
  progestageno_sintetico: 'Progestageno sintetico', glucocorticoide: 'Glucocorticoide',
  mineralocorticoide: 'Mineralocorticoide', precursor: 'Precursor',
  antiandrogeno: 'Antiandrogeno', antiestrogeno_serm: 'Modulador del receptor de estrogeno',
  sprm: 'Modulador del receptor de progesterona', inhibidor_enzimatico: 'Inhibidor enzimatico',
  anabolizante: 'Anabolizante', otro: 'Otro',
};

const ROLE_LABEL = {
  endogena: 'endogena', farmaco: 'farmaco', metabolito: 'metabolito', intermediario: 'intermediario',
};

let activeTab = 'estructura';
let currentId = null;
let renderThumb = null;

export function setThumbRenderer(fn) { renderThumb = fn; }

export function openInspector(id, options) {
  const entity = byId(id);
  const shell = $('#app');
  const host = $('#inspector');
  if (!entity) { closeInspector(); return; }
  currentId = id;
  if (options && options.tab) activeTab = options.tab;
  shell.dataset.inspector = 'true';
  render(host, entity);
  announce('Ficha de ' + entityName(id));
}

export function closeInspector() {
  currentId = null;
  const shell = $('#app');
  shell.dataset.inspector = 'false';
  clear($('#inspector'));
}

export function inspectorTarget() { return currentId; }

function tabsFor(entity) {
  const kind = entity.id.split(':')[0];
  if (kind === 'mol' || kind === 'drug') {
    return [['estructura', 'Estructura'], ['sintesis', 'Sintesis'], ['accion', 'Accion'],
            ['clinica', 'Clinica'], ['fuentes', 'Fuentes']];
  }
  if (kind === 'enz') return [['estructura', 'Enzima'], ['sintesis', 'Reacciones'], ['clinica', 'Deficits'], ['fuentes', 'Fuentes']];
  if (kind === 'org') return [['accion', 'Territorio'], ['clinica', 'Clinica'], ['fuentes', 'Fuentes']];
  if (kind === 'rec') return [['estructura', 'Receptor'], ['accion', 'Ligandos'], ['fuentes', 'Fuentes']];
  if (kind === 'cond') return [['clinica', 'Cuadro'], ['sintesis', 'Bloqueo'], ['fuentes', 'Fuentes']];
  return [['estructura', 'Ficha'], ['fuentes', 'Fuentes']];
}

function render(host, entity) {
  clear(host);
  const tabs = tabsFor(entity);
  if (!tabs.some(([k]) => k === activeTab)) activeTab = tabs[0][0];

  const kind = entity.id.split(':')[0];
  const kicker = kind === 'mol' || kind === 'drug'
    ? [FAMILY_LABEL[entity.family] || entity.family, (entity.role || []).map((r) => ROLE_LABEL[r] || r).join(', ')].filter(Boolean).join(' · ')
    : { enz: 'Enzima', org: 'Organo blanco', rec: 'Receptor', cond: 'Cuadro clinico', tis: 'Tejido' }[kind] || '';

  const head = el('div', { class: 'a-inspector__head' }, [
    el('button', { class: 'a-inspector__close', 'aria-label': 'Cerrar ficha', onClick: closeInspector }, icon('close')),
    el('div', { class: 'a-inspector__kicker', text: kicker }),
    el('h2', { class: 'a-inspector__title', text: entityName(entity.id) }),
    entity.names && entity.names.en && entity.names.en !== entity.names.es
      ? el('div', { class: 'a-muted', style: { fontSize: 'var(--fs-md)' }, text: entity.names.en }) : null,
  ]);

  const tabBar = el('div', { class: 'a-inspector__tabs', role: 'tablist' }, tabs.map(([key, label]) =>
    el('button', {
      class: 'a-inspector__tab', role: 'tab', 'aria-selected': key === activeTab ? 'true' : 'false',
      text: label, onClick: () => { activeTab = key; render(host, entity); },
    })));

  const body = el('div', { class: 'a-inspector__body' });
  host.appendChild(head);
  host.appendChild(tabBar);
  host.appendChild(body);
  renderTab(body, entity, activeTab);
}

function renderTab(body, entity, tab) {
  const kind = entity.id.split(':')[0];
  if (kind === 'mol' || kind === 'drug') return renderMoleculeTab(body, entity, tab);
  if (kind === 'enz') return renderEnzymeTab(body, entity, tab);
  if (kind === 'org') return renderOrganTab(body, entity, tab);
  if (kind === 'rec') return renderReceptorTab(body, entity, tab);
  if (kind === 'cond') return renderConditionTab(body, entity, tab);
  body.appendChild(el('div', { class: 'a-muted', text: 'Ficha en preparacion.' }));
}

/* ------------------------------------------------------------- moleculas --- */

function renderMoleculeTab(body, mol, tab) {
  if (tab === 'estructura') {
    body.appendChild(section('Identidad', el('dl', { class: 'a-kv' }, [
      el('dt', { text: 'Formula' }), el('dd', { class: 'mono', html: formatFormula(mol.formula) }),
      el('dt', { text: 'Masa molar' }), el('dd', { text: mol.mw + ' g/mol' }),
      el('dt', { text: 'Familia' }), el('dd', {}, familyChip(mol.family)),
      el('dt', { text: 'Papel' }), el('dd', { text: (mol.role || []).map((r) => ROLE_LABEL[r] || r).join(', ') }),
      el('dt', { text: 'Atomos' }), el('dd', { text: mol.heavyAtoms + ' pesados, ' + mol.atoms.el.length + ' con hidrogenos' }),
    ])));

    if (mol.steroid) {
      const s = mol.steroid;
      const marks = [];
      if (s.aromaticA) marks.push('anillo A aromatico');
      if (s.nor19) marks.push('19-nor (sin C19)');
      body.appendChild(section('Nucleo esteroide', el('div', {}, [
        el('div', { class: 'a-muted', style: { marginBottom: '8px', fontSize: 'var(--fs-sm)' },
                    text: 'Ciclopentanoperhidrofenantreno: anillos A, B, C y D' + (marks.length ? ' — ' + marks.join(', ') : '') }),
        ringLegend(),
        s.substituents && s.substituents.length ? substituentTable(s.substituents) : null,
      ])));
    } else {
      body.appendChild(section('Nucleo', el('div', { class: 'a-note',
        text: 'Molecula no esteroidea: el coloreado por anillos A-D no aplica.' })));
    }

    if (mol.groups && mol.groups.length) {
      body.appendChild(section('Grupos funcionales', el('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '5px' } },
        mol.groups.map((g) => el('span', { class: 'a-chip a-chip--sm', text: g.type.replace(/_/g, ' ') })))));
    }
    return;
  }

  if (tab === 'sintesis') {
    const producing = reactionsProducing(mol.id);
    const consuming = reactionsConsuming(mol.id);
    const tissues = tissuesProducing(mol.id);
    if (!producing.length && !consuming.length) {
      body.appendChild(emptyNote('Esta molecula no participa en la via de esteroidogenesis representada.'));
    }
    if (producing.length) body.appendChild(section('Se forma a partir de', reactionList(producing, 'substrate')));
    if (consuming.length) body.appendChild(section('Se transforma en', reactionList(consuming, 'product')));
    if (tissues.length) {
      body.appendChild(section('Donde se sintetiza', el('div', { class: 'a-list' }, tissues.map((t) =>
        el('a', { class: 'a-list__item', href: linkFor(t.id) }, [
          icon('scales'),
          el('div', { class: 'a-list__main' }, [
            el('div', { class: 'a-list__name', text: entityName(t.id) }),
            el('div', { class: 'a-list__meta', text: t.cell || '' }),
          ]),
        ])))));
    }
    body.appendChild(el('a', { class: 'a-btn a-btn--primary', href: '#/esteroidogenesis/mapa/' + mol.id.replace(':', '_') },
      [icon('pathway'), el('span', { text: 'Ver en la via' })]));
    return;
  }

  if (tab === 'accion') {
    const organs = organsTargetedBy(mol.id);
    if (!organs.length) body.appendChild(emptyNote('Sin organos blanco registrados para esta molecula.'));
    for (const { organ, targets } of organs) {
      body.appendChild(section(entityName(organ.id), el('div', {}, targets.map((t) => el('div', { style: { marginBottom: '9px' } }, [
        el('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '2px' } }, [
          el('a', { class: 'a-chip a-chip--sm', href: linkFor(t.receptor), text: entityName(t.receptor) }),
        ]),
        el('div', { style: { fontSize: 'var(--fs-md)' }, text: t.effect }),
        t.clinical ? el('div', { class: 'a-muted', style: { fontSize: 'var(--fs-sm)' }, text: t.clinical }) : null,
      ])))));
    }
    if (organs.length) {
      body.appendChild(el('a', { class: 'a-btn', href: '#/organos/hormona/' + mol.id.replace(':', '_') },
        [icon('body'), el('span', { text: 'Iluminar en el cuerpo' })]));
    }
    return;
  }

  if (tab === 'clinica') {
    if (mol.pharm) {
      const p = mol.pharm;
      body.appendChild(section('Mecanismo', el('p', { text: p.mechanism })));
      if (p.indications) body.appendChild(section('Indicaciones', bullets(p.indications)));
      if (p.contraindications) body.appendChild(section('Contraindicaciones', bullets(p.contraindications)));
      if (p.adverse) body.appendChild(section('Efectos adversos', bullets(p.adverse)));
      if (p.pk) {
        body.appendChild(section('Farmacocinetica', el('dl', { class: 'a-kv' }, [
          p.pk.route ? [el('dt', { text: 'Via' }), el('dd', { text: p.pk.route.join(', ') })] : null,
          p.pk.bioavailability ? [el('dt', { text: 'Biodisponibilidad' }), el('dd', { text: p.pk.bioavailability })] : null,
          p.pk.halfLife ? [el('dt', { text: 'Semivida' }), el('dd', { text: p.pk.halfLife })] : null,
          p.pk.metabolism ? [el('dt', { text: 'Metabolismo' }), el('dd', { text: p.pk.metabolism })] : null,
        ].filter(Boolean).flat())));
      }
    } else {
      body.appendChild(emptyNote('Ficha farmacologica pendiente para esta entrada.'));
    }
    const ix = interactionsOf(mol.id);
    if (ix.length) {
      body.appendChild(section('Interacciones', el('div', { class: 'a-list' }, ix.slice(0, 12).map((i) => {
        const other = i.a === mol.id ? i.b : i.a;
        return el('a', { class: 'a-list__item', href: linkFor(other) }, [
          icon('link'),
          el('div', { class: 'a-list__main' }, [
            el('div', { class: 'a-list__name', text: entityName(other) }),
            el('div', { class: 'a-list__meta', text: i.kind.replace(/_/g, ' ') + ' · ' + (i.mechanism || '') }),
          ]),
        ]);
      }))));
    }
    return;
  }

  if (tab === 'fuentes') {
    body.appendChild(section('Procedencia de la estructura', el('div', {}, [
      el('dl', { class: 'a-kv' }, [
        el('dt', { text: 'Clave InChI' }), el('dd', { class: 'mono', style: { wordBreak: 'break-all', fontSize: 'var(--fs-sm)' }, text: mol.inchikey }),
        el('dt', { text: 'SMILES' }), el('dd', { class: 'mono', style: { wordBreak: 'break-all', fontSize: 'var(--fs-xs)' }, text: mol.smiles }),
        mol.cid ? el('dt', { text: 'PubChem' }) : null,
        mol.cid ? el('dd', { class: 'mono', text: 'CID ' + mol.cid }) : null,
      ].filter(Boolean)),
      el('div', { class: 'a-note', style: { marginTop: '10px' }, text: mol.conformer.note }),
    ])));
    body.appendChild(section('Verificacion', el('div', {}, (mol.source || []).map((s) => el('div', { style: { marginBottom: '8px' } }, [
      el('div', {}, [
        el('span', { class: 'a-badge' + (s.verified ? '' : ' a-badge--warn'), text: s.verified ? 'verificada' : 'pendiente' }),
        el('span', { class: 'a-src', style: { marginLeft: '6px' }, text: (s.db || '') + ' ' + (s.id || '') }),
      ]),
      s.note ? el('div', { class: 'a-src', text: s.note }) : null,
    ])))));
    return;
  }
}

/* ------------------------------------------- otras entidades (fases 4 a 7) --- */

function renderEnzymeTab(body, enz, tab) {
  if (tab === 'estructura') {
    body.appendChild(section('Identidad', el('dl', { class: 'a-kv' }, [
      el('dt', { text: 'Gen' }), el('dd', { class: 'mono', text: enz.gene || '—' }),
      el('dt', { text: 'Familia' }), el('dd', { text: enz.family || '—' }),
      el('dt', { text: 'Compartimento' }), el('dd', { text: compartmentLabel(enz.compartment) }),
      enz.electronDonor ? el('dt', { text: 'Donante de electrones' }) : null,
      enz.electronDonor ? el('dd', { text: enz.electronDonor.replace(/_/g, ' + ') }) : null,
    ].filter(Boolean))));
    if (enz.activities) {
      body.appendChild(section('Actividades', el('div', { class: 'a-list' }, enz.activities.map((a) =>
        el('div', { class: 'a-list__item' }, [
          el('div', { class: 'a-list__main' }, [
            el('div', { class: 'a-list__name', text: a.label }),
            el('div', { class: 'a-list__meta', text: (a.cofactors || []).join(', ') }),
          ]),
        ])))));
    }
  } else if (tab === 'sintesis') {
    const rx = all('reactions').filter((r) => r.enzyme === enz.id);
    body.appendChild(rx.length ? reactionList(rx, 'both') : emptyNote('Sin reacciones registradas.'));
  } else if (tab === 'clinica') {
    const conds = conditionsOfEnzyme(enz.id);
    body.appendChild(conds.length
      ? el('div', { class: 'a-list' }, conds.map((c) => el('a', { class: 'a-list__item', href: linkFor(c.id) }, [
          icon('deficit'), el('div', { class: 'a-list__main' }, [
            el('div', { class: 'a-list__name', text: entityName(c.id) }),
            el('div', { class: 'a-list__meta', text: c.inheritance || '' }),
          ])])))
      : emptyNote('Sin cuadros clinicos registrados.'));
  } else {
    body.appendChild(sourceList(enz.source));
  }
}

function renderOrganTab(body, organ, tab) {
  if (tab === 'accion') {
    const targets = organ.targets || [];
    body.appendChild(targets.length ? el('table', {}, [
      el('thead', {}, el('tr', {}, [el('th', { text: 'Hormona' }), el('th', { text: 'Receptor' }), el('th', { text: 'Efecto' })])),
      el('tbody', {}, targets.map((t) => el('tr', {}, [
        el('td', {}, el('a', { href: linkFor(t.hormone), text: entityName(t.hormone) })),
        el('td', {}, el('a', { href: linkFor(t.receptor), text: entityName(t.receptor) })),
        el('td', { text: t.effect }),
      ]))),
    ]) : emptyNote('Sin hormonas registradas para este territorio.'));
  } else if (tab === 'clinica') {
    const rows = (organ.targets || []).filter((t) => t.clinical);
    body.appendChild(rows.length ? el('div', {}, rows.map((t) => el('div', { style: { marginBottom: '10px' } }, [
      el('div', { style: { fontWeight: 600, fontSize: 'var(--fs-md)' }, text: entityName(t.hormone) }),
      el('div', { style: { fontSize: 'var(--fs-md)' }, text: t.clinical }),
    ]))) : emptyNote('Sin correlato clinico registrado.'));
  } else {
    body.appendChild(sourceList(collectSources(organ)));
  }
}

function renderReceptorTab(body, rec, tab) {
  if (tab === 'estructura') {
    body.appendChild(section('Identidad', el('dl', { class: 'a-kv' }, [
      el('dt', { text: 'Gen' }), el('dd', { class: 'mono', text: rec.gene || '—' }),
      el('dt', { text: 'Clase' }), el('dd', { text: rec.class === 'nuclear' ? 'Receptor nuclear' : 'Receptor de membrana' }),
      rec.isoforms ? el('dt', { text: 'Isoformas' }) : null,
      rec.isoforms ? el('dd', { text: rec.isoforms.join(', ') }) : null,
    ].filter(Boolean))));
    if (rec.mechanism) body.appendChild(section('Mecanismo', el('p', { text: rec.mechanism })));
  } else if (tab === 'accion') {
    const ligands = rec.ligands || [];
    body.appendChild(ligands.length ? el('div', { class: 'a-list' }, ligands.map((l) =>
      el('a', { class: 'a-list__item', href: linkFor(l.mol) }, [
        icon('molecule'),
        el('div', { class: 'a-list__main' }, [
          el('div', { class: 'a-list__name', text: entityName(l.mol) }),
          el('div', { class: 'a-list__meta', text: l.kind.replace(/_/g, ' ') + (l.affinity ? ' · ' + l.affinity.metric + ' ' + l.affinity.value + ' ' + l.affinity.unit : '') }),
        ]),
      ]))) : emptyNote('Sin ligandos registrados.'));
  } else {
    body.appendChild(sourceList(rec.source));
  }
}

function renderConditionTab(body, cond, tab) {
  if (tab === 'clinica') {
    body.appendChild(section('Identidad', el('dl', { class: 'a-kv' }, [
      cond.gene ? el('dt', { text: 'Gen' }) : null, cond.gene ? el('dd', { class: 'mono', text: cond.gene }) : null,
      cond.inheritance ? el('dt', { text: 'Herencia' }) : null, cond.inheritance ? el('dd', { text: cond.inheritance }) : null,
      cond.enzyme ? el('dt', { text: 'Enzima' }) : null,
      cond.enzyme ? el('dd', {}, el('a', { href: linkFor(cond.enzyme), text: entityName(cond.enzyme) })) : null,
    ].filter(Boolean))));
    if (cond.phenotype) {
      body.appendChild(section('Fenotipo', el('div', {}, [
        cond.phenotype.xx ? el('p', {}, [el('strong', { text: '46,XX: ' }), cond.phenotype.xx]) : null,
        cond.phenotype.xy ? el('p', {}, [el('strong', { text: '46,XY: ' }), cond.phenotype.xy]) : null,
        cond.phenotype.common ? bullets(cond.phenotype.common) : null,
      ].filter(Boolean))));
    }
    if (cond.treatment) body.appendChild(section('Tratamiento', el('p', { text: cond.treatment })));
    body.appendChild(el('a', { class: 'a-btn a-btn--primary', href: linkFor(cond.id) },
      [icon('deficit'), el('span', { text: 'Simular el deficit' })]));
  } else if (tab === 'sintesis') {
    body.appendChild(section('Reacciones bloqueadas', el('div', { class: 'a-list' }, (cond.blocks || []).map((b) => {
      const rx = byId(b.reaction);
      return el('div', { class: 'a-list__item' }, [
        el('div', { class: 'a-list__main' }, [
          el('div', { class: 'a-list__name', text: rx ? entityName(rx.substrate) + ' → ' + entityName(rx.product) : b.reaction }),
          el('div', { class: 'a-list__meta', text: 'actividad residual ' + Math.round(b.activity * 100) + ' %' }),
        ]),
      ]);
    }))));
  } else {
    body.appendChild(sourceList(cond.source));
  }
}

/* -------------------------------------------------------------- ayudantes --- */

function section(title, content) {
  return el('div', { class: 'a-section' }, [el('div', { class: 'a-section__title', text: title }), content]);
}

function bullets(items) { return el('ul', {}, items.map((t) => el('li', { text: t }))); }

function emptyNote(text) { return el('div', { class: 'a-note', text }); }

function familyChip(family) {
  return el('span', { class: 'a-chip a-chip--sm', style: { '--chip-color': familyColor(family) },
                      text: FAMILY_LABEL[family] || family });
}

function ringLegend() {
  const rings = [['a', 'A'], ['b', 'B'], ['c', 'C'], ['d', 'D']];
  return el('div', { style: { display: 'flex', gap: '10px', marginBottom: '10px' } }, rings.map(([k, label]) =>
    el('span', { style: { display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'var(--fs-sm)' } }, [
      el('span', { class: 'a-legend__swatch', style: { background: 'var(--ring-' + k + ')' } }),
      el('span', { text: 'Anillo ' + label }),
    ])));
}

function substituentTable(subs) {
  return el('table', {}, [
    el('thead', {}, el('tr', {}, [el('th', { text: 'Posicion' }), el('th', { text: 'Sustituyente' })])),
    el('tbody', {}, subs.map((s) => el('tr', {}, [
      el('td', { class: 'mono', text: s.position }),
      el('td', { text: s.group }),
    ]))),
  ]);
}

function reactionList(reactions, side) {
  return el('div', { class: 'a-list' }, reactions.map((r) => {
    const other = side === 'substrate' ? r.substrate : side === 'product' ? r.product : null;
    const label = other ? entityName(other) : entityName(r.substrate) + ' → ' + entityName(r.product);
    return el('a', { class: 'a-list__item', href: linkFor(r.id) }, [
      icon('step'),
      el('div', { class: 'a-list__main' }, [
        el('div', { class: 'a-list__name', text: label }),
        el('div', { class: 'a-list__meta', text: entityName(r.enzyme) + ' · ' + compartmentLabel(r.compartment) }),
      ]),
    ]);
  }));
}

export function compartmentLabel(c) {
  return {
    mitocondria_membrana_interna: 'mitocondria',
    reticulo_endoplasmico_liso: 'reticulo endoplasmico liso',
    citosol: 'citosol', membrana: 'membrana',
  }[c] || c || '—';
}

function collectSources(entity) {
  const out = [];
  if (entity.source) out.push(...entity.source);
  for (const t of entity.targets || []) if (t.source) out.push(...t.source);
  return out;
}

function sourceList(sources) {
  const list = sources || [];
  if (!list.length) return emptyNote('Sin fuentes registradas todavia.');
  return el('div', {}, list.map((s) => el('div', { style: { marginBottom: '9px' } }, [
    el('div', { class: 'a-src' }, [
      el('span', { class: 'a-badge' + (s.verified ? '' : ' a-badge--warn'), text: s.verified ? 'verificada' : 'pendiente' }),
      ' ', s.citation || [s.db, s.id].filter(Boolean).join(' ') || '',
    ]),
    s.note ? el('div', { class: 'a-src', text: s.note }) : null,
  ].filter(Boolean))));
}

export function formatFormula(f) {
  return String(f || '').replace(/([A-Za-z])(\d+)/g, '$1<sub>$2</sub>').replace(/([+-])$/, '<sup>$1</sup>');
}
