/**
 * Empaquetador ESM propio, sin dependencias, para el subconjunto de sintaxis que
 * usa este proyecto. Existe para que el atlas se pueda compilar en una maquina
 * sin npm; esbuild es solo un acelerador opcional (ver docs, decision D1).
 *
 * Subconjunto admitido, comprobado por el propio empaquetador:
 *   import { a, b as c } from './x.js';      import * as ns from './x.js';
 *   import './x.js';
 *   export function f(){}   export const x =   export let x =   export class C {}
 *   export { a, b as c };
 * No se admiten: export default, import() dinamico, imports de paquetes.
 */
import fs from 'node:fs';
import path from 'node:path';

const RE_IMPORT_NAMED = /^import\s+\{([^}]*)\}\s+from\s+['"](\.[^'"]+)['"];?\s*$/;
const RE_IMPORT_NS = /^import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"](\.[^'"]+)['"];?\s*$/;
const RE_IMPORT_BARE = /^import\s+['"](\.[^'"]+)['"];?\s*$/;
const RE_EXPORT_DECL = /^export\s+(async\s+function|function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/;
const RE_EXPORT_LIST = /^export\s+\{([^}]*)\};?\s*$/;

function parseSpecifiers(text) {
  return text.split(',').map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = s.split(/\s+as\s+/);
    return { imported: m[0].trim(), local: (m[1] || m[0]).trim() };
  });
}

function transform(source, file) {
  const deps = [];
  const exported = [];
  const lines = source.split('\n');
  const out = lines.map((line, i) => {
    const where = `${file}:${i + 1}`;
    if (/^\s*import\b/.test(line)) {
      if (/^\s*import\s*\(/.test(line)) throw new Error(`import() dinamico no admitido en ${where}`);
      let m;
      if ((m = line.match(RE_IMPORT_NAMED))) {
        deps.push(m[2]);
        const specs = parseSpecifiers(m[1]).map((s) =>
          s.imported === s.local ? s.imported : `${s.imported}: ${s.local}`);
        return `const { ${specs.join(', ')} } = __req(${JSON.stringify(m[2])});`;
      }
      if ((m = line.match(RE_IMPORT_NS))) {
        deps.push(m[2]);
        return `const ${m[1]} = __req(${JSON.stringify(m[2])});`;
      }
      if ((m = line.match(RE_IMPORT_BARE))) {
        deps.push(m[1]);
        return `__req(${JSON.stringify(m[1])});`;
      }
      throw new Error(`forma de import no admitida en ${where}: ${line.trim()}`);
    }
    if (/^\s*export\b/.test(line)) {
      if (/^\s*export\s+default\b/.test(line)) throw new Error(`export default no admitido en ${where}`);
      let m;
      if ((m = line.match(RE_EXPORT_LIST))) {
        for (const s of parseSpecifiers(m[1])) exported.push({ local: s.imported, as: s.local });
        return '';
      }
      if ((m = line.match(RE_EXPORT_DECL))) {
        exported.push({ local: m[2], as: m[2] });
        return line.replace(/^export\s+/, '');
      }
      throw new Error(`forma de export no admitida en ${where}: ${line.trim()}`);
    }
    return line;
  });
  return { code: out.join('\n'), deps, exported };
}

/** Minificacion conservadora: solo quita comentarios de linea completa y de bloque
 *  fuera de cadenas, y las lineas en blanco. No toca sangrias ni saltos internos,
 *  para no romper literales de plantilla. */
function minifySafe(code) {
  const out = [];
  let inBlock = false;
  for (const line of code.split('\n')) {
    const t = line.trim();
    if (inBlock) { if (t.includes('*/')) inBlock = false; continue; }
    if (t.startsWith('/*')) { if (!t.includes('*/')) inBlock = true; continue; }
    if (t.startsWith('//')) continue;
    if (!t) continue;
    out.push(line);
  }
  return out.join('\n');
}

export function bundleLite(entryFile, { minify = true } = {}) {
  const modules = new Map();
  const order = [];

  const load = (file) => {
    const key = path.resolve(file);
    if (modules.has(key)) return key;
    if (!fs.existsSync(key)) throw new Error(`modulo no encontrado: ${key}`);
    const src = fs.readFileSync(key, 'utf8');
    const { code, deps, exported } = transform(src, path.basename(key));
    modules.set(key, { code, deps, exported, resolved: {} });
    for (const dep of deps) {
      const depFile = path.resolve(path.dirname(key), dep);
      modules.get(key).resolved[dep] = load(depFile);
    }
    order.push(key);
    return key;
  };

  const entry = load(entryFile);
  const root = path.dirname(path.dirname(path.resolve(entryFile)));
  const id = (abs) => path.relative(root, abs).split(path.sep).join('/');

  const chunks = order.map((key) => {
    const mod = modules.get(key);
    const body = minify ? minifySafe(mod.code) : mod.code;
    const rewire = Object.entries(mod.resolved)
      .map(([spec, abs]) => `  if (p === ${JSON.stringify(spec)}) return __get(${JSON.stringify(id(abs))});`)
      .join('\n');
    const exportsDef = mod.exported
      .map((e) => `  Object.defineProperty(__x, ${JSON.stringify(e.as)}, { get: () => ${e.local}, enumerable: true });`)
      .join('\n');
    return `__def(${JSON.stringify(id(key))}, function (__x, __get) {
function __req(p) {
${rewire}
  throw new Error('dependencia no resuelta: ' + p);
}
${body}
${exportsDef}
});`;
  });

  return `(function(){"use strict";
var __m = {}, __c = {};
function __def(id, fn){ __m[id] = fn; }
function __get(id){
  if (__c[id]) return __c[id];
  var x = __c[id] = {};
  __m[id](x, __get);
  return x;
}
${chunks.join('\n')}
__get(${JSON.stringify(id(entry))});
})();`;
}
