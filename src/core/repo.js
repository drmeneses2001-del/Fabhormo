/** Repositorio en memoria sobre ATLAS_DATA: indice por identificador y consultas
 *  del grafo (molecula, enzima, reaccion, tejido, organo, receptor, condicion). */

let data = {};
const index = new Map();

const LISTS = ['molecules', 'enzymes', 'reactions', 'tissues', 'organs', 'receptors',
  'interactions', 'conditions', 'labs', 'readings', 'questions', 'eligibility', 'tours'];

export function initRepo(raw) {
  data = raw || {};
  index.clear();
  for (const key of LISTS) {
    const list = data[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) if (item && item.id) index.set(item.id, item);
  }
  return { entities: index.size };
}

export function all(key) { return data[key] || []; }
export function raw() { return data; }
export function byId(id) { return index.get(id) || null; }
export function has(id) { return index.has(id); }

export function name(id) {
  const e = byId(id);
  if (!e) return id;
  return (e.names && (e.names.es || e.names.en)) || e.name || e.id;
}

export function shortName(id) {
  const e = byId(id);
  if (!e) return id;
  return (e.names && (e.names.corto || e.names.es)) || e.name || e.id;
}

export function list(key, filter) {
  const items = all(key);
  return filter ? items.filter(filter) : items;
}

/* --------------------------------------------------------------- consultas --- */

export function reactionsOf(molId) {
  return all('reactions').filter((r) => r.substrate === molId || r.product === molId);
}
export function reactionsProducing(molId) { return all('reactions').filter((r) => r.product === molId); }
export function reactionsConsuming(molId) { return all('reactions').filter((r) => r.substrate === molId); }
export function reactionsOfEnzyme(enzId) { return all('reactions').filter((r) => r.enzyme === enzId); }

export function enzymesIn(tissueId) {
  const tissue = byId(tissueId);
  if (!tissue || !tissue.expression) return [];
  return tissue.expression.filter((e) => e.level > 0).map((e) => byId(e.enzyme)).filter(Boolean);
}

export function expressionLevel(tissueId, enzId) {
  const tissue = byId(tissueId);
  if (!tissue || !tissue.expression) return 0;
  const found = tissue.expression.find((e) => e.enzyme === enzId);
  return found ? found.level : 0;
}

export function tissuesProducing(molId) {
  const out = [];
  for (const t of all('tissues')) if ((t.produces || []).includes(molId)) out.push(t);
  return out;
}

export function organsTargetedBy(molId) {
  const out = [];
  for (const o of all('organs')) {
    const targets = (o.targets || []).filter((t) => t.hormone === molId);
    if (targets.length) out.push({ organ: o, targets });
  }
  return out;
}

export function hormonesTargeting(organId) {
  const organ = byId(organId);
  return organ ? (organ.targets || []) : [];
}

export function interactionsOf(id) {
  return all('interactions').filter((i) => i.a === id || i.b === id);
}

export function conditionsOfEnzyme(enzId) {
  return all('conditions').filter((c) => c.enzyme === enzId);
}

export function moleculesOfFamily(family) {
  return all('molecules').filter((m) => m.family === family);
}

/** Camino mas corto desde colesterol hasta una molecula, para el hilo "de donde viene". */
export function pathTo(molId, rootId) {
  const root = rootId || 'mol:colesterol';
  const prev = new Map([[root, null]]);
  const queue = [root];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === molId) break;
    for (const r of reactionsConsuming(cur)) {
      if (!prev.has(r.product)) { prev.set(r.product, r); queue.push(r.product); }
    }
  }
  if (!prev.has(molId)) return null;
  const chain = [];
  let node = molId;
  while (prev.get(node)) { const r = prev.get(node); chain.unshift(r); node = r.substrate; }
  return chain;
}

/* --------------------------------------------------------------- busqueda --- */

const SEARCHABLE = [
  ['molecules', 'Molecula'], ['enzymes', 'Enzima'], ['organs', 'Organo'],
  ['receptors', 'Receptor'], ['conditions', 'Cuadro clinico'], ['tissues', 'Tejido'],
  ['readings', 'Lectura'],
];

function normalize(text) {
  return String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

let searchIndex = null;

function buildSearchIndex() {
  searchIndex = [];
  for (const [key, label] of SEARCHABLE) {
    for (const item of all(key)) {
      const names = item.names || {};
      const terms = [names.es, names.en, names.corto, item.gene, item.citation, item.id]
        .concat(names.synonyms || []).filter(Boolean);
      searchIndex.push({ id: item.id, kind: label, key, title: names.es || item.citation || item.id,
        subtitle: names.en || item.gene || '', haystack: normalize(terms.join(' ')) });
    }
  }
}

export function search(query, limit) {
  if (!searchIndex) buildSearchIndex();
  const q = normalize(query).trim();
  if (!q) return [];
  const words = q.split(/\s+/);
  const hits = [];
  for (const entry of searchIndex) {
    let score = 0, ok = true;
    for (const w of words) {
      const at = entry.haystack.indexOf(w);
      if (at < 0) { ok = false; break; }
      score += at === 0 ? 12 : (entry.haystack[at - 1] === ' ' ? 7 : 2);
    }
    if (ok) hits.push({ ...entry, score: score + Math.max(0, 8 - entry.title.length / 6) });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit || 24);
}
