# ADR-0001 — Empaquetado, fuentes y verificación

Fecha: 2026-09-02 · Estado: aceptada · Resuelve: D1 y R6 del documento de arquitectura

## Contexto

La arquitectura exige un artefacto autónomo sin dependencias de red y deja abierto
si usar `esbuild` como acelerador o solo el empaquetador propio, y cómo obtener
subconjuntos de fuentes sin `pyftsubset`.

## Decisión

1. **Doble camino de empaquetado.** `tools/bundle-lite.js` (cero dependencias) es el
   camino garantizado; `esbuild`, cuando está instalado, se usa por defecto por su
   minificación. Ambos caminos se verifican en navegador headless. `bundle-lite`
   impone un subconjunto de sintaxis (sin `export default`, sin `import()` dinámico,
   solo imports relativos estáticos) que el propio empaquetador comprueba, así que
   el código fuente sigue siendo compilable sin npm.
2. **Fuentes desde @fontsource, subconjuntadas con fontTools.** Los paquetes
   `@fontsource/source-serif-4`, `@fontsource/source-sans-3` y
   `@fontsource/jetbrains-mono` (licencia OFL) se instalan como devDependency y
   `tools/subset-fonts.py` genera subconjuntos woff2 con el juego de caracteres del
   atlas: latín, acentos del español, griego químico, flechas, símbolos de
   comparación y sub/superíndices. Resultado: 62 KB en woff2, 85 KB en base64,
   frente al presupuesto de 320 KB.
3. **Misma política de seguridad en las dos variantes.** La variante de doble clic
   declara por meta la misma CSP que aplica el visor de Artifacts, y `verify.js`
   envuelve el fragmento de Artifact en un anfitrión con esa CSP. Lo que funciona en
   una variante funciona en la otra, y un fallo de política aparece en verificación.

## Consecuencias

- El build funciona en una máquina sin npm, con ~20 % más de tamaño de JavaScript.
- Las fuentes viajan incrustadas sin ninguna petición de red.
- Añadir sintaxis fuera del subconjunto rompe el build lite: es intencionado.
