# Traspaso a la Fase 2 (desarrollo)

Este archivo acompaña al documento de arquitectura y contiene lo que el modelo constructor
necesita para empezar.

## 1. Antes de empezar

1. Añadir la base previa en `legacy/hormonas/` (carpeta `hormonas/` de Atlas Esteroide, incluido
   su `README.md`). Si no existe, indicarlo explícitamente en `docs/legacy-inventario.md` y seguir
   la ruta alternativa descrita en §0.1 y §12 (Fase 0) de la arquitectura.
2. Leer completo `docs/arquitectura-atlas-esteroide-3d.md`. Las secciones §2 (presupuestos), §6
   (modelo de datos), §10 (build) y §12 (fases con criterios de aceptación) son vinculantes.
3. Trabajar fase por fase. Cada fase termina con `npm run build` y `npm run verify` en verde y
   capturas en `dist/verify/`. Registrar cada decisión abierta resuelta (§13) en
   `docs/decisiones/ADR-000x-*.md`.

## 2. Prompt de la Fase 2

> Eres un desarrollador senior de aplicaciones web científicas interactivas. Se te entrega el
> documento de arquitectura de "Atlas Esteroide 3D", una aplicación autocontenida sobre
> bioquímica de hormonas esteroideas sexuales y sus órganos blanco, con un capítulo especial e
> insignia dedicado a la esteroidogénesis.
>
> Tu tarea es implementar la aplicación siguiendo ese documento de arquitectura al pie de la
> letra, fase por fase, verificando cada módulo (visual y funcionalmente, con datos reales) antes
> de avanzar al siguiente. Reutiliza y mejora lo aprovechable del proyecto existente en
> `legacy/hormonas/` (motor 3D, datos moleculares de PubChem, fichas farmacológicas, contenido
> clínico) en vez de reescribirlo desde cero salvo que la arquitectura lo indique explícitamente.
>
> Requisitos de calidad:
> - Rigor científico: ningún dato inventado; toda cifra o estructura debe ser trazable a una
>   fuente citable (PubChem, RCSB PDB, literatura médica de referencia). Todo lo marcado
>   **[verificar]** en la arquitectura se comprueba contra la fuente antes de incorporarse.
> - El capítulo de esteroidogénesis es el criterio de éxito principal (§5.7): debe explicar con
>   claridad gráfica, para alguien que lo ve por primera vez, de dónde vienen las hormonas
>   esteroideas sexuales y cómo se van formando paso a paso, enzima a enzima, hasta el órgano
>   donde actúan.
> - Interactividad real en cada vista 3D (rotar, hacer zoom, seleccionar), no ilustraciones
>   estáticas.
> - Debe compilar a `dist/atlas-esteroide-3d.html` (doble clic, sin red) y a `dist/artifact.html`
>   (publicable como Artifact) con la misma funcionalidad.
> - Verifica en navegador headless (Chromium/Playwright o Edge) cada módulo antes de darlo por
>   terminado, con `tools/verify.js`.
>
> Documento de arquitectura: `docs/arquitectura-atlas-esteroide-3d.md`.

## 3. Orden de trabajo sugerido para la primera sesión

1. Fase 0 completa (andamiaje, build de dos variantes, `verify.js`, inventario de la base).
2. Fase 1 hasta la escena de estrés medida (decide si el presupuesto de Canvas 2D se cumple).
3. Fase 2 en paralelo: manifiesto de moléculas y descarga PubChem cacheada en `raw/`.
