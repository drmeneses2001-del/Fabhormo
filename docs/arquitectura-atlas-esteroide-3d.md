# Atlas Esteroide 3D — Documento de arquitectura técnica (Fase 1)

> Plano de construcción para la Fase 2 (desarrollo). Este documento no contiene contenido clínico
> definitivo ni código de producción: define estructura, contratos, presupuestos, criterios de
> aceptación y decisiones. Todo lo que aquí se marca como **[verificar]** debe confirmarse contra
> la fuente primaria durante la Fase 2 antes de incorporarse a los datos.

| Campo | Valor |
|---|---|
| Producto | Atlas Esteroide 3D — atlas interactivo de hormonas esteroideas sexuales, esteroidogénesis y órganos blanco |
| Entregables finales | `dist/atlas-esteroide-3d.html` (doble clic, sin red) y `dist/artifact.html` (publicable como Artifact) |
| Idioma de la interfaz | Español (nombres con sinónimos en inglés para búsqueda) |
| Público | Estudiantes y residentes de ginecología, endocrinología y medicina; docentes |
| Versión del documento | 1.0 (2026-09-02) |

---

## 0. Resumen ejecutivo y decisiones clave

1. **Se conserva el enfoque de motor 3D propio sobre Canvas 2D** (esferas sombreadas por sprites,
   enlaces por gradiente, orden del pintor). Justificación en §4.1. WebGL queda como *backend
   opcional* detrás de la misma interfaz `Renderer`, sin ser requisito.
2. **La app se organiza como un atlas con un capítulo insignia**: la Esteroidogénesis es la
   portada viva y el eje de navegación; el resto de módulos son "láminas" que cuelgan de ella.
3. **Un único grafo de conocimiento** con identificadores estables (`mol:`, `enz:`, `rx:`,
   `tis:`, `org:`, `rec:`, `drug:`, `cond:`) une moléculas, enzimas, reacciones, tejidos, órganos,
   receptores, fármacos y cuadros clínicos. Cada vista es una proyección de ese grafo.
4. **Lenguaje visual multiescala coherente**: cuerpo → órgano → célula → orgánulo → enzima →
   molécula se renderizan con el mismo motor, la misma cámara, la misma luz y el mismo sistema de
   selección. El cambio de escala es un *zoom continuo* con bandas de fundido (§4.6).
5. **Datos trazables por construcción**: el pipeline de build descarga conformaciones 3D de
   PubChem por CID, las anota (numeración esteroidea C1–C19, anillos A–D, grupos funcionales),
   las valida y las incrusta con procedencia (CID, fecha, tipo de conformación). Ningún dato se
   escribe a mano sin campo `source`.
6. **Simulador de déficits enzimáticos cualitativo y auditable**: propagación en el grafo de la
   vía para direcciones (↑/↓) más tabla curada con cita para el cuadro clínico. Se evita la
   pseudo-precisión cinética (§5.5).
7. **Build sin dependencias de runtime ni de red**: fuente en módulos ES, empaquetador propio de
   cero dependencias (con `esbuild` como acelerador opcional), assets como data URI, dos plantillas
   de salida (doble clic y Artifact).
8. **Presupuestos duros**: 60 fps interactivo / 30 fps mínimo, ≤ 3 000 primitivas por frame,
   archivo final ≤ 4,5 MB (objetivo 3,5 MB), interactivo en < 1,5 s desde `file://` (§2).

### 0.1 Estado de la base previa (hallazgo de la Fase 1)

El repositorio `Fabhormo` solo contiene un README vacío. La carpeta `hormonas/` de la versión
previa **Atlas Esteroide** (11 módulos, motor Canvas 2D, 58 moléculas PubChem, módulo de
esteroidogénesis) **no está en este repositorio ni en ningún otro repositorio accesible de la
cuenta** (se revisaron `Atlas-esfera`, `Claudeproyects`, `instrumentos-gineco`, `Notebook-code`,
`HRLALM-URG-GO`). Por tanto:

- La arquitectura se diseña **para absorber esa base** mediante una Fase 0 de "rescate" con un
  importador (`tools/import-legacy.js`) que extrae del HTML previo las moléculas, fichas y textos
  al nuevo modelo de datos (§10.1).
- El alcance de los módulos heredados se describe aquí a partir de la lista del prompt
  (comparador, ciclo hormonal, receptores, laboratorio, interacciones farmacológicas,
  elegibilidad clínica, lecturas, autoevaluación). El alcance exacto de cada uno **se confirma en
  la Fase 0** leyendo `hormonas/README.md` cuando el usuario lo aporte al repositorio.
- Si la base no apareciera, el plan sigue siendo válido: la Fase 2 (datos) genera desde PubChem
  el conjunto completo de moléculas y la Fase 7 reconstruye los módulos heredados desde su
  especificación.

**Acción requerida del usuario antes de la Fase 2**: añadir la carpeta `hormonas/` (o el HTML
previo compilado) al repositorio, en `legacy/hormonas/`.

---

## 1. Principios rectores

| Principio | Consecuencia arquitectónica |
|---|---|
| Atlas serio de referencia, no juguete | Tipografía editorial, densidad informativa alta, animación al servicio del significado, nada decorativo sin función |
| La esteroidogénesis es el centro | Portada = vía viva; navegación jerárquica "capítulo → láminas"; enlaces desde cada entidad a su lugar en la vía |
| Todo dato tiene procedencia | Campo `source` obligatorio en el esquema; validador de build rechaza registros sin fuente |
| Interactividad real | Cada vista 3D: rotar, zoom, panear, seleccionar, hover con ficha; nunca imágenes estáticas |
| Un solo lenguaje visual entre escalas | Un motor, una cámara, una luz, un halo de selección, una paleta semántica |
| Autonomía total | Cero peticiones de red en runtime; fuentes/iconos/datos incrustados; funciona con `file://` y bajo la CSP de Artifacts |
| Rendimiento en gama media | Presupuestos medibles, calidad adaptativa, render bajo demanda |
| Construible incrementalmente | Fases con criterios de aceptación verificables en navegador headless |

---

## 2. Restricciones y presupuestos

### 2.1 Plataformas objetivo

| Plataforma | Prioridad | Notas |
|---|---|---|
| Chrome / Edge de escritorio (Windows, macOS) abriendo `file://` | P0 | Escenario "doble clic" |
| Viewer de Artifacts (claude.ai) | P0 | CSP estricta: sin CDNs, sin `blob:` para fuentes, sin descargas iniciadas por la página |
| Safari iPadOS / macOS | P1 | Gestos táctiles, límite de área de canvas (~16 M píxeles), `DecompressionStream` reciente |
| Firefox escritorio | P1 | Sin particularidades esperadas |
| Móvil (< 700 px) | P2 | Funcional con diseño apilado; no se optimiza la experiencia 3D |

### 2.2 Presupuestos de rendimiento

| Métrica | Objetivo | Mínimo aceptable | Cómo se mide |
|---|---|---|---|
| FPS durante interacción (arrastre/zoom) | 60 | 30 sostenidos | `tools/verify.js` con `performance.now()` en 120 frames de rotación forzada |
| FPS en reposo | 0 (render solo si "dirty") | — | Contador de frames tras 2 s sin entrada = 0 |
| Primitivas por frame (esferas + segmentos de enlace + puntos) | ≤ 3 000 | ≤ 6 000 en escenas sin animación | Contador interno `renderer.stats.primitives` |
| Moléculas simultáneas en mapa de vía | ≤ 24 sin hidrógenos (~30 átomos pesados c/u) | — | LOD automático |
| Moléculas con hidrógenos y superficie | 1 (atlas) / 2 (comparador) | — | — |
| Trazas Cα de proteínas en escena | ≤ 2 (~250–300 residuos c/u) | — | — |
| Tiempo hasta interactivo desde `file://` | < 1,5 s | < 3 s | Marca `performance.mark('interactive')` |
| Tamaño de `dist/atlas-esteroide-3d.html` | ≤ 3,5 MB | ≤ 4,5 MB | Build falla por encima del máximo |
| Memoria JS | < 150 MB | < 250 MB | `performance.memory` (Chrome) |
| `devicePixelRatio` efectivo | ≤ 2 | baja a 1,5 / 1 por calidad adaptativa | — |

### 2.3 Presupuesto de tamaño (desglose objetivo)

| Componente | Objetivo |
|---|---|
| Código JS minificado | ≤ 650 KB |
| CSS | ≤ 60 KB |
| Datos moleculares (≈ 90 moléculas, coordenadas cuantizadas, anotaciones) | ≤ 700 KB |
| Trazas Cα de receptores/enzimas (≈ 8 estructuras) | ≤ 150 KB |
| Contenido textual (fichas, vía, clínica, lecturas, preguntas) | ≤ 600 KB |
| Fuentes (3 familias, subconjunto latín + griego + símbolos, woff2 base64) | ≤ 320 KB |
| Iconos (SVG `<symbol>` inline) | ≤ 60 KB |
| Siluetas anatómicas y celulares (paths vectoriales) | ≤ 120 KB |
| **Total** | **≈ 2,7 MB objetivo, 4,5 MB máximo** |

Base64 añade ~33 % a binarios; el presupuesto ya lo contempla.

### 2.4 Restricciones de la variante Artifact (`dist/artifact.html`)

- Sin `<!DOCTYPE>`, `<html>`, `<head>` ni `<body>` propios; `<title>` y `<style>` al inicio del
  archivo (el host los envuelve).
- Tokens de tema: paleta clara completa en `:root`; redefinición oscura bajo
  `@media (prefers-color-scheme: dark)` con selector `:root:not([data-theme="light"])`; y de nuevo
  bajo `:root[data-theme="dark"]`. `body` con `background` explícito desde token.
- Fuentes solo como `data:` URI (no `blob:`). Nada de `<link>` externo.
- Sin `<a download>` ni guardado iniciado por script (inertes en el viewer). Las exportaciones
  (PNG de la escena, JSON del estado) se ofrecen solo en la variante doble clic.
- `localStorage` envuelto en `try/catch` (puede lanzar en previsualización).
- Tamaño de página ≤ 16 MB (muy por encima de nuestro presupuesto).

### 2.5 Restricciones de la variante doble clic (`file://`)

- `fetch()` de archivos locales está bloqueado → todo inline.
- Web Workers solo vía `Blob` URL (funciona en Chrome/Edge/Firefox; verificar en Safari). El motor
  **no depende** de workers: todo cálculo pesado se hace en build.
- `history.pushState` no funciona con `file://` en algunos navegadores → enrutado por `hash`.

---

## 3. Mapa de módulos y navegación

### 3.1 Estructura

```
Atlas Esteroide 3D
│
├── Portada (hero 3D: constelación de la vía, entrada al capítulo)
│
├── CAPÍTULO INSIGNIA · Esteroidogénesis            ruta base  #/esteroidogenesis
│     ├── Mapa de la vía (grafo 2.5D, Δ5 / Δ4, enzimas, compartimentos)   #/esteroidogenesis/mapa
│     ├── Escalas (cuerpo → órgano → célula → orgánulo → enzima → molécula) #/esteroidogenesis/escalas/:tejido
│     ├── Paso enzimático (reacción 3D con morph sustrato → producto)       #/esteroidogenesis/paso/:rx
│     ├── Simulador de déficits                                             #/esteroidogenesis/deficit/:cond
│     └── Recorrido guiado                                                  #/esteroidogenesis/recorrido/:n
│
├── LÁMINAS (módulos)
│     ├── Atlas molecular 3D                  #/atlas  · #/atlas/:mol
│     ├── Órganos blanco                      #/organos · #/organos/:org · #/organos/hormona/:mol
│     ├── Interacción bioquímica              #/interacciones
│     │     ├── Mapa de interacciones         #/interacciones/mapa
│     │     ├── Comparador sincronizado       #/interacciones/comparar/:molA/:molB
│     │     └── Receptor–ligando              #/interacciones/receptor/:rec/:mol
│     ├── Ciclo hormonal                      #/ciclo
│     ├── Receptores                          #/receptores · #/receptores/:rec
│     ├── Laboratorio                         #/laboratorio
│     ├── Interacciones farmacológicas        #/farmacos
│     ├── Elegibilidad clínica                #/elegibilidad
│     ├── Lecturas                            #/lecturas
│     └── Autoevaluación                      #/autoevaluacion
│
└── Transversales: búsqueda global (⌘/Ctrl+K), inspector lateral, fuentes/créditos, ajustes
```

### 3.2 Cómo se entra al capítulo insignia

- **Portada = vía viva.** Al abrir la app, el escenario central muestra la constelación 3D de la
  esteroidogénesis (colesterol en el centro; familias hormonales como brazos; moléculas reales
  rotando lentamente como nodos). Un clic en cualquier nodo entra en el capítulo ya enfocado en esa
  molécula. El botón primario de la portada es "Recorrer la esteroidogénesis".
- **Barra de navegación (rail izquierdo).** Primer bloque, con tratamiento distinto (numeral de
  capítulo, tipografía display, indicador de progreso del recorrido): *Esteroidogénesis*. Debajo,
  en un bloque titulado "Láminas", el resto de módulos en tipografía UI normal.
- **Puentes desde cualquier entidad.** Toda ficha de molécula tiene el botón "Ver en la vía"; toda
  enzima "Ver el paso"; todo órgano "Dónde se sintetiza / Dónde actúa"; toda condición clínica
  "Simular el déficit". Estos puentes hacen que el capítulo sea el nodo central del grafo de
  navegación, no una pestaña más.
- **Progreso.** El recorrido guiado guarda el paso alcanzado (`localStorage`, opcional) y la
  portada ofrece "Continuar en el paso n".

### 3.3 Relación entre módulos (dependencias de datos)

```
                    ┌──────────────┐
                    │  Atlas mol.  │◄──────── Comparador, Receptor–ligando, Interacciones
                    └──────┬───────┘
                           │ mol:*
   ┌───────────┐    ┌──────▼─────────┐    ┌───────────────┐
   │ Receptores│◄───│ ESTEROIDOGÉNESIS│───►│ Órganos blanco│◄── Ciclo hormonal
   └─────┬─────┘    └──────┬─────────┘    └───────┬───────┘
         │ rec:*           │ rx:* enz:* tis:*      │ org:*
         │                 ▼                       │
         │          ┌─────────────┐                │
         └─────────►│ Laboratorio │◄───────────────┘   (perfil analítico por déficit)
                    └──────┬──────┘
                           │ cond:*
             ┌─────────────┼─────────────────┐
             ▼             ▼                 ▼
       Elegibilidad   Interacc. farm.   Autoevaluación ◄── Lecturas (citas)
```

Regla: un módulo nunca duplica datos de otro; consume el repositorio (§6) por ID.

### 3.4 Disposición de pantalla (shell)

Tres zonas persistentes en escritorio (≥ 1 100 px):

| Zona | Ancho | Contenido |
|---|---|---|
| Rail de navegación (izq.) | 64 px colapsado / 240 px expandido | Capítulo, láminas, búsqueda, tema, fuentes |
| Escenario (centro) | flexible | Canvas 3D o vista del módulo; barra de herramientas flotante (representación, coloreado, cámara, capturar) |
| Inspector (der.) | 360 px, colapsable | Ficha de la entidad seleccionada, pestañas (Estructura · Síntesis · Acción · Clínica · Fuentes), puentes a otros módulos |

En tablet, el inspector se convierte en hoja inferior deslizante; en móvil todo se apila.
El escenario mantiene siempre ≥ 50 % del viewport para que "la interactividad y el 3D sean
protagonistas".

---

## 4. Arquitectura del motor gráfico 3D

### 4.1 Decisión: Canvas 2D propio (mantener) frente a WebGL

| Criterio | Canvas 2D propio | WebGL puro (sin Three.js) |
|---|---|---|
| Complejidad de implementación | Baja-media; base ya existente | Alta: shaders, buffers, picking por color-ID, gestión de contexto perdido |
| Peso de código | ~40–60 KB | ~120–200 KB (impostores de esferas, tubos, texto) |
| Compatibilidad `file://` + Artifacts + Safari iPad | Muy alta | Alta, pero con pérdida de contexto en tabs en segundo plano y GPU por software en VMs/escritorio remoto |
| Rendimiento con 3 000 primitivas | 60 fps con sprites cacheados (probado en apps similares) | Holgado (100 k+) |
| Rendimiento con 20 000+ primitivas (proteína completa, superficie densa) | Insuficiente | Adecuado |
| Texto y anotaciones | Nativo (`fillText`) | Requiere atlas de glifos u overlay DOM |
| Antialiasing | Nativo | Depende de MSAA del contexto |

**Decisión:** Canvas 2D como backend P0. Las escenas más pesadas del alcance (mapa de vía con ≤ 24
moléculas sin H, dos trazas Cα de ~300 residuos, superficie de puntos de una molécula) caben en el
presupuesto de 3 000–6 000 primitivas. No se representa ninguna proteína a nivel de todos los
átomos. **El motor se diseña con la interfaz `Renderer` desacoplada de la escena** para que un
backend WebGL (`RendererGL`) pueda añadirse en el futuro sin tocar módulos. La Fase 1 debe
demostrar con la escena "mapa de vía completo" ≥ 30 fps en un portátil de gama media; si no se
alcanza tras aplicar LOD, se reabre la decisión (§13).

### 4.2 Estructura del motor (`src/engine/`)

```
engine/
  math.js        vec3, mat3/mat4, quat, bounding sphere, Kabsch (superposición), PCA
  camera.js      Cámara orbital: target, distancia, cuaternión de orientación, fov, near/far,
                 inercia, límites, encuadre (fitBounds), interpolación de estados (slerp + lerp)
  controls.js    Entrada unificada: ratón, rueda, táctil (1 dedo rota, 2 dedos zoom/pan),
                 teclado (flechas, +/−, R reset, 1–4 representaciones); pointer capture
  scene.js       Grafo de escena ligero: nodos con transform local/mundo, visibilidad, capa,
                 opacidad, "escala" (§4.6) y lista de primitivas
  primitives.js  Sphere, Bond (segmento con dos mitades), Tube (polilínea 3D), Point (nube),
                 Path (silueta vectorial con profundidad), Billboard (etiqueta), Halo
  renderer2d.js  Backend Canvas 2D: proyección, ordenación (pintor), sprites, niebla, halos
  sprites.js     Caché de sprites de esferas sombreadas (por elemento/color, radio px, tema)
  picking.js     Hit-test en espacio pantalla sobre las primitivas proyectadas del último frame
  tween.js       Tweens con easing, cadenas, cancelación; reloj único
  timeline.js    Secuencias de keyframes (cámara + estado de escena + UI) para recorridos
  morph.js       Interpolación entre moléculas por correspondencia de átomos (§5.4)
  layout.js      Layouts: grafo de vía (capas Δ5/Δ4), fuerza dirigida (mapa de interacciones),
                 anillo/espiral (constelación de portada)
  quality.js     Calidad adaptativa (DPR, hidrógenos, resolución de sprites, sombras)
  stats.js       Métricas por frame (ms, primitivas, sprites) para verificación
```

### 4.3 Pipeline de render (por frame, solo si `dirty`)

1. **Actualizar** tweens/timeline → cámara y transformaciones de nodos.
2. **Recolectar** primitivas visibles de los nodos con `scale` dentro de la banda activa (§4.6),
   aplicando LOD por nodo (p. ej. ocultar H si el radio proyectado < 2 px).
3. **Transformar y proyectar**: `mat4` vista-proyección en `Float32Array` reutilizados; cálculo de
   `z` de vista, radio en píxeles, y factor de niebla.
4. **Ordenar** por profundidad (pintor). Implementación: ordenación por índices en `Uint32Array`
   con clave `z` cuantizada a 16 bits (radix/counting sort) para evitar `Array.prototype.sort`
   con comparador en escenas de miles de primitivas.
5. **Dibujar** de atrás hacia delante:
   - `Path` de fondo (siluetas anatómicas/celulares) con profundidad fija por capa.
   - `Bond`: cada mitad con el color de su átomo; grosor proporcional al radio proyectado;
     `lineCap: round`; gradiente lineal solo cuando el grosor ≥ 3 px (coste).
   - `Sphere`: `drawImage` del sprite cacheado escalado al radio; si el radio > 96 px, se dibuja
     un gradiente radial directo para no pixelar.
   - `Tube`: segmentos de la polilínea Cα como capsulas (dos círculos + rectángulo) con sombreado
     por profundidad; opción "cinta" plana con ancho variable.
   - `Point`: nube de superficie, `fillRect` de 1–2 px con alfa por profundidad.
   - `Halo`: anillo de selección/hover dibujado después de la primitiva a la que pertenece.
   - `Billboard`: etiquetas con halo de contraste (`strokeText` + `fillText`), en la capa superior,
     con evitación simple de colisiones (rejilla de ocupación).
6. **Post**: niebla de profundidad (alfa por z), viñeta suave opcional; overlay DOM sincronizado
   (callouts) recibe posiciones proyectadas vía `renderer.project(nodeId)`.
7. **Estadísticas** y decisión de calidad adaptativa (media móvil de 30 frames > 20 ms → bajar un
   escalón; < 10 ms durante 120 frames → subir).

Los modelos de iluminación se hornean en los sprites: dirección de luz fija (arriba-izquierda,
consistente en todas las escalas), término Lambert + brillo especular pequeño + luz de borde
tenue en tema oscuro. Un sprite por (color, radioBucket, tema); buckets de radio en potencias de
√2 desde 2 px hasta 128 px; presupuesto de caché ≤ 4 MB (LRU).

### 4.4 Representaciones moleculares

| Modo | Primitivas | Notas |
|---|---|---|
| Bolas y varillas (por defecto) | Sphere (r = 0,28 × rVdW) + Bond | Enlaces dobles: dos segmentos paralelos desplazados en el plano de pantalla; triples: tres |
| Varillas (licorice) | Bond gruesos + Sphere pequeñas en vértices | Ideal para comparador |
| Esferas (spacefill) | Sphere (r = rVdW) | Radios VdW de Bondi 1964 **[verificar]** |
| Superficie | Point (nube SAS precalculada en build, Shrake–Rupley, sonda 1,4 Å) sobre varillas translúcidas | ~800–1 500 puntos por molécula; alfa por profundidad |
| Esqueleto (wire) | Bond de 1 px | Para escenas con muchas moléculas (LOD 2) |

Coloreados (ortogonales a la representación):

- **Por elemento** (CPK adaptado por tema, §11.4).
- **Por anillo A–D** del núcleo esteroide (requiere anotación §6.3): A, B, C, D y cadena lateral
  con la paleta de anillos; átomos fuera del núcleo en gris.
- **Por grupo funcional**: hidroxilo, cetona, éster, etinilo, aromático (anillo A fenólico),
  Δ4-3-ceto, Δ5, 19-nor, 17α-sustituyente, lactona, etc.
- **Por familia** (color plano de la familia hormonal, para escenas con muchas moléculas).
- **Por cambio** (en pasos enzimáticos: átomos añadidos/eliminados/modificados).

### 4.5 Sistema de cámara y controles

- Cámara orbital con **cuaternión** (sin bloqueo de cardán), objetivo (`target`), distancia,
  `fov` 35°, perspectiva. Modo ortográfico opcional para comparador (superposiciones limpias).
- Inercia en rotación (amortiguación 0,92/frame), límites de zoom por escena (`minDist`,
  `maxDist`) derivados del `boundingSphere`.
- `fitBounds(nodos, padding)` para encuadrar; `flyTo(estado, ms, easing)` para transiciones;
  `lookAt(átomo)` para centrar en un átomo/grupo.
- Rotación automática lenta en reposo (opcional, se detiene al interactuar; respeta
  `prefers-reduced-motion`).
- **Cámaras sincronizadas**: `CameraLink` comparte cuaternión y distancia entre dos viewports
  (comparador) con posibilidad de desacoplar.
- Estados de cámara serializables (para deep links y keyframes del recorrido).

### 4.6 Multiescala: un lenguaje visual coherente

La escena tiene un eje de **escala logarítmica** `S` (0 = cuerpo, 5 = molécula). Cada nodo declara
la banda `[sMin, sMax]` en la que existe. La cámara tiene, además de su distancia, un nivel de
escala continuo; el zoom de rueda/pellizco mueve la distancia, y al superar umbrales se cruza a la
siguiente escala con **fundido cruzado** (0,6 s) y reanclaje de la cámara al nodo "portal" sobre
el que se hizo zoom.

| S | Escala | Tamaño real | Primitivas | Ejemplo |
|---|---|---|---|---|
| 0 | Cuerpo | ~1,7 m | Path (silueta estratificada), Sphere (órganos como blobs brillantes) | Cuerpo con gónadas, suprarrenales, placenta, tejidos periféricos |
| 1 | Órgano/tejido | ~1–10 cm | Path (corte esquemático), Sphere (zonas: teca/granulosa, glomerulosa/fasciculata/reticularis, Leydig) | Corteza suprarrenal en zonas; folículo ovárico |
| 2 | Célula | ~20 µm | Sphere translúcida grande (membrana con luz de borde), Sphere/Path para orgánulos | Célula de Leydig con mitocondrias y RE liso |
| 3 | Orgánulo | ~1 µm | Path (crestas, cisternas) + Sphere (enzimas ancladas como perlas) | Membrana mitocondrial interna con CYP11A1; RE liso con CYP17A1/POR |
| 4 | Enzima | ~5–10 nm | Tube (traza Cα), Sphere (hemo, ligando) | CYP17A1 con abiraterona (PDB) **[verificar]** |
| 5 | Molécula | ~1 nm | Sphere + Bond | Pregnenolona |

Reglas de coherencia entre escalas:

- **Misma luz, mismo sombreado, misma niebla, mismo halo de selección** (anillo doble: color de la
  entidad + blanco/negro según tema).
- **Portales**: un nodo con `portal: {to: scale, focus: id}` muestra al hover un anillo pulsante y
  una etiqueta "Entrar →"; doble clic o zoom sostenido lo cruza.
- **Migas de escala** en la barra superior del escenario: `Cuerpo › Testículo › Célula de Leydig ›
  Mitocondria › CYP11A1 › Pregnenolona`; cada miga es un salto directo.
- **Continuidad cromática**: la molécula conserva su color de familia en todas las escalas
  (como perla en la enzima, como nodo en el mapa, como bolas y varillas en el atlas).

### 4.7 Selección, hover y picking

- Tras cada frame se guarda un `Float32Array` con `(x, y, rPx, z, id)` de las primitivas
  seleccionables proyectadas. El hover recorre solo las primitivas dentro de la celda de una
  rejilla de 64 px (cubeta espacial) y elige la de menor `z` que contenga el puntero.
- Entidades seleccionables: átomo, molécula (grupo), enzima, nodo de vía, órgano, zona, orgánulo,
  residuo Cα. La selección emite `select:{type,id}` al store; el inspector responde.
- Hover muestra tooltip DOM anclado a la posición proyectada (≤ 1 tooltip a la vez).
- Teclado: `Tab` recorre entidades seleccionables del escenario en orden de lectura (accesible),
  `Enter` selecciona, `Esc` limpia.

### 4.8 Animación y recorridos

- `Tween(objeto, propiedades, ms, easing)` con easing estándar (`easeInOutCubic` por defecto).
- `Timeline` = lista de `Keyframe { t, camera?, scene?, ui?, narration?, hold? }`; soporta
  reproducir/pausar/saltar/velocidad; expone `progress` para la barra de progreso del recorrido.
- **Morph** (§5.4): dado un mapa de correspondencia átomo→átomo, interpola posiciones tras
  superponer con Kabsch sobre los átomos comunes; átomos que desaparecen se desvanecen y se
  contraen; los nuevos aparecen desde su átomo vecino.
- Presupuesto: cualquier transición ≤ 800 ms; los recorridos permiten "saltar animación".

### 4.9 Capa DOM sobre el canvas

El canvas dibuja geometría; el DOM dibuja **texto rico y controles** (callouts, leyendas, barras
de progreso, tooltips). Un `OverlayManager` recibe posiciones proyectadas por ID cada frame que
cambie y actualiza `transform: translate3d()` de los callouts. Esto mantiene el texto nítido,
seleccionable y accesible sin recurrir a atlas de glifos.

---

## 5. Capítulo insignia: Esteroidogénesis

### 5.1 Objetivo pedagógico y criterio de éxito

Quien vea el capítulo por primera vez debe poder responder, sin texto adicional: de dónde viene
cada hormona sexual (colesterol), por qué pasos y enzimas, en qué compartimento de qué célula de
qué órgano, qué ocurre si una enzima falla, y a qué órgano va la hormona resultante. El capítulo
se construye como **cinco vistas sobre el mismo grafo** (`pathway.json`, §6.5), todas con el motor
3D y todas enlazadas por el mismo `focus` (molécula, reacción o enzima seleccionada).

### 5.2 Vista 1 — Mapa de la vía (grafo 2.5D)

- Layout determinista por capas (`layout.js: pathwayLayers`): filas = número de carbonos
  (C27 → C21 → C19 → C18), columnas = serie Δ5 (izquierda) y Δ4 (derecha), con la rama
  corticoide (C21 → cortisol/aldosterona) plegada a la derecha en tono atenuado y expandible.
- Cada nodo es la **molécula real en miniatura** (varillas, sin H, LOD 2) girando muy lento; al
  hover crece y muestra nombre; al clic se selecciona (inspector) y con doble clic entra en el
  atlas. Con más de 24 nodos visibles se aplica `wire`.
- Cada arista es una **reacción**: flecha con etiqueta de enzima (color por familia enzimática) y
  glifo de compartimento (mitocondria ◆ / RE liso ●). Aristas reversibles (17β-HSD1/2, 3β-HSD
  no) con doble punta. Cofactores (POR, adrenodoxina/FDX1–FDXR, CYB5A, NADPH) como chips en la
  etiqueta.
- **Filtro por tejido** (chips: Leydig, teca, granulosa, cuerpo lúteo, fasciculata, reticularis,
  glomerulosa, placenta, adiposo, piel/folículo, próstata, hígado): atenúa las aristas cuya enzima
  no se expresa en ese tejido y resalta la ruta activa; los nodos no alcanzables se desaturan.
  Este filtro es el que enseña la **teoría de las dos células** (teca → granulosa) y la ausencia de
  CYP17A1 en placenta y glomerulosa.
- Toggle "Vías alternativas": vía *backdoor* hacia DHT y andrógenos 11-oxigenados (CYP11B1 →
  HSD11B2 → AKR1C3), plegadas por defecto para no saturar al principiante.
- Leyenda flotante siempre visible: familias, enzimas, compartimentos, cofactores.

### 5.3 Vista 2 — Escalas (dónde ocurre)

Recorre las escalas §4.6 con foco en un tejido: cuerpo → órgano (zonas) → célula esteroidogénica
→ orgánulo → enzima → molécula. Contenido mínimo obligatorio por tejido (a poblar en Fase 4):

| Tejido (`tis:`) | Célula | Compartimentos y enzimas clave | Producto principal |
|---|---|---|---|
| Testículo | Leydig | Mito: StAR, CYP11A1 · REL: HSD3B2, CYP17A1 (+POR, CYB5A), HSD17B3 | Testosterona |
| Ovario | Teca | Mito: StAR, CYP11A1 · REL: HSD3B2, CYP17A1 | Androstenediona |
| Ovario | Granulosa | REL: CYP19A1, HSD17B1 (sin CYP17A1) | Estradiol |
| Ovario | Cuerpo lúteo | Mito: CYP11A1 · REL: HSD3B2 | Progesterona |
| Suprarrenal | Zona glomerulosa | Sin CYP17A1; CYP21A2, CYP11B2 | Aldosterona |
| Suprarrenal | Zona fasciculada | CYP17A1 hidroxilasa (liasa baja); CYP21A2, CYP11B1 | Cortisol |
| Suprarrenal | Zona reticular | CYP17A1 + CYB5A alto (liasa), SULT2A1; HSD3B2 bajo | DHEA, DHEA-S |
| Placenta | Sincitiotrofoblasto | Sin CYP17A1; CYP11A1, HSD3B1, STS, CYP19A1, HSD17B1 | Progesterona, estriol (desde DHEA-S fetal 16α-OH) |
| Tejido adiposo / mama / hueso / cerebro | Estromal, otras | CYP19A1, HSD17B, STS | Estrona/estradiol locales |
| Piel genital, próstata, folículo | Fibroblasto, epitelio | SRD5A2 (SRD5A1 en piel no genital, hígado) | DHT |
| Hígado | Hepatocito | UGT, SULT, CYP3A4 (inactivación), SHBG (síntesis) | Metabolitos conjugados |

Todas las asignaciones tejido–enzima se almacenan en `expression.json` con fuente (revisión de
referencia, p. ej. Miller & Auchus 2011, *Endocr Rev* **[verificar]**) y no en el código.

### 5.4 Vista 3 — Paso enzimático (reacción en 3D)

Para cada reacción `rx:*`:

- Escenario dividido: a la izquierda la enzima (traza Cα si hay estructura PDB **[verificar]**;
  si no, glifo esquemático de la familia con hemo/NAD(P) simbólico), a la derecha sustrato →
  producto con **morph** (§4.8): superposición Kabsch sobre el núcleo esteroide; átomos que
  cambian coloreados "por cambio" (rojo = eliminado, verde = añadido, ámbar = modificado).
- Panel: tipo de reacción (hidroxilación, escisión de cadena lateral, oxidación 3β-OH/Δ5→Δ4,
  reducción 17-ceto, 5α-reducción, aromatización, sulfatación), cofactores, compartimento,
  tejidos donde ocurre, gen, cromosoma, estructura fuente, puentes ("Ver déficit", "Ver en
  la vía", "Ver inhibidores": abiraterona, finasterida, letrozol, etc.).
- La correspondencia átomo–átomo se calcula en build (`tools/annotate.js`) a partir de la
  numeración esteroidea: mismo número de carbono ↔ mismo átomo; heteroátomos por vecindad.
  Casos con pérdida de átomos (CYP11A1: C22–C27; CYP17A1 liasa: C20–C21; CYP19A1: C19) usan
  la lista `removed` explícita en la reacción.

### 5.5 Vista 4 — Simulador de déficits enzimáticos

Modelo en dos capas, ambas visibles para el usuario:

1. **Propagación cualitativa en el grafo** (`flux.js`). Cada reacción tiene actividad
   `a ∈ [0,1]` por tejido (1 = normal). Un déficit fija `a` de sus reacciones (completo 0,
   parcial 0,3; ajustable con deslizador). El algoritmo calcula, para cada metabolito, un nivel
   relativo `L` propagando desde colesterol (fuente constante) y aplicando conservación en cada
   nodo: el flujo bloqueado se redistribuye a las salidas alternativas del mismo nodo
   (derivación), y los productos aguas abajo caen proporcionalmente. Se muestra como ↑↑ ↑ = ↓ ↓↓
   (umbrales ±25 % / ±60 %) sobre cada nodo del mapa, con animación de "presión" (halo que crece
   en los acumulados, nodos que se apagan en los deficitarios). Además se simula la respuesta del
   eje (ACTH ↑ cuando cortisol ↓ → multiplica el flujo de entrada en suprarrenal ×2; LH ↑ cuando
   testosterona/estradiol ↓), lo que explica la hiperplasia y el exceso de precursores.
2. **Tabla curada con fuente** (`conditions.json`). Para cada condición: patrón analítico
   esperado (metabolito, dirección, marcador diagnóstico), fenotipo por sexo genético
   (46,XX / 46,XY), manifestaciones (virilización, ambigüedad genital, pérdida salina,
   hipertensión, pubertad, fertilidad), gen, herencia, tratamiento principal, referencia. **La
   capa 1 nunca contradice la capa 2**: el validador de build compara direcciones y falla si
   hay discrepancia no justificada con `override` documentado.

Condiciones mínimas del alcance (contenido a poblar y verificar en Fase 4): déficit de 21-hidroxilasa
(CYP21A2) clásico y no clásico, 11β-hidroxilasa (CYP11B1), 17α-hidroxilasa/17,20-liasa
(CYP17A1), 3β-HSD2 (HSD3B2), hiperplasia lipoide (StAR) y CYP11A1, POR, déficit de aromatasa
(CYP19A1), síndrome de exceso de aromatasa, déficit de 5α-reductasa 2 (SRD5A2), déficit de
17β-HSD3 (HSD17B3), déficit de CYB5A (liasa aislada); y bloqueos farmacológicos: abiraterona,
ketoconazol, inhibidores de aromatasa, finasterida/dutasterida, metirapona, osilodrostat.

Etiqueta permanente en la vista: "Modelo cualitativo de flujo; no reproduce concentraciones
reales. Ver Laboratorio para rangos".

### 5.6 Vista 5 — Recorrido guiado

`Timeline` de ~25–35 pasos con narración corta (≤ 60 palabras por paso), auto-avance opcional,
y "puntos de control" interactivos (el usuario debe, p. ej., arrastrar la cámara hasta ver el
anillo A o elegir la enzima correcta). Estructura obligatoria:

1. Portada: qué es un esteroide (núcleo ciclopentanoperhidrofenantreno, anillos A–D, numeración).
2. Colesterol: origen (LDL, síntesis de novo), transporte a la mitocondria (StAR).
3. CYP11A1: escisión de la cadena lateral → pregnenolona (escala orgánulo → enzima → molécula).
4. Bifurcación Δ5/Δ4 y 3β-HSD.
5. CYP17A1: dos actividades, papel de CYB5A, por qué en humanos domina la vía Δ5 hacia DHEA.
6. De DHEA a androstenediona y testosterona (17β-HSD3, AKR1C3).
7. 5α-reductasa → DHT (tejidos, potencia).
8. Aromatasa → estrona/estradiol; 17β-HSD1/2.
9. Teoría de las dos células en el folículo; cuerpo lúteo y progesterona.
10. Suprarrenal por zonas; DHEA-S; adrenarquia.
11. Placenta y unidad feto-placentaria; estriol.
12. Transporte (SHBG, albúmina) y llegada al órgano blanco (puente a Órganos blanco).
13. Qué pasa cuando falla (puente a Simulador de déficits).
14. Autoevaluación breve (5 preguntas) y resumen visual.

El recorrido usa exactamente los mismos nodos/escenas que el modo libre (no duplica contenido).

### 5.7 Criterios de aceptación del capítulo (Fase 4)

- El mapa muestra todas las reacciones del inventario §6.5 con enzima, compartimento y cofactores;
  el filtro por tejido reproduce las once filas de la tabla §5.3.
- Cada nodo abre su ficha y su molécula 3D real (CID trazable) en < 300 ms.
- Escalas: seis niveles navegables por zoom continuo y por migas para al menos tres tejidos
  (Leydig, teca/granulosa, suprarrenal por zonas) sin pérdida de referencia visual (fundido).
- Paso enzimático con morph correcto (átomos eliminados/añadidos coinciden con la química de la
  reacción) para todas las reacciones del núcleo sexual (≥ 16 reacciones).
- Simulador: para cada condición del §5.5 el patrón ↑/↓ calculado coincide con la tabla curada.
- Recorrido guiado completo, reproducible, con "saltar", "atrás" y progreso persistente.
- 30 fps mínimo en el mapa completo con LOD activo en un portátil de gama media (medido).

---

## 6. Modelo de datos

### 6.1 Principios

- **IDs estables y legibles** con prefijo de tipo: `mol:testosterona`, `enz:CYP17A1`,
  `rx:preg_to_17oh_preg`, `tis:leydig`, `org:prostata`, `rec:AR`, `drug:finasterida`,
  `cond:def_21oh`, `read:miller2011`, `q:0042`. Sin acentos ni espacios; ASCII.
- **Toda entidad lleva `source[]`** (§6.9). El validador rechaza entidades sin fuente, IDs
  duplicados y referencias colgantes.
- **Separación datos/código**: los datos son JSON estáticos en `src/data/`, incrustados en build
  como un solo objeto `ATLAS_DATA` (comprimido con un diccionario de claves cortas si supera
  el presupuesto).
- **Un repositorio en memoria (`DataRepo`)** indexa por ID y ofrece consultas: `byId`, `molsOf
  (family)`, `reactionsOf(mol)`, `enzymesIn(tissue)`, `organsTargetedBy(mol)`, `pathTo(mol)`.

### 6.2 Molécula (`Molecule`)

```ts
interface Molecule {
  id: 'mol:...';
  names: { es: string; en?: string; iupac?: string; synonyms?: string[] };
  cid: number;                       // PubChem CID
  inchikey: string; smiles: string;  // isomérico
  formula: string; mw: number;       // g/mol
  family: 'androgeno'|'estrogeno'|'gestageno'|'progestageno_sintetico'|'glucocorticoide'|
          'mineralocorticoide'|'precursor'|'antiandrogeno'|'antiestrogeno_serm'|'sprm'|
          'inhibidor_enzimatico'|'anabolizante'|'otro';
  role: ('endogena'|'farmaco'|'metabolito'|'intermediario')[];
  atoms: { el: string[]; xyz: number[]; /* Å×1000, enteros, plano */ h: boolean[] };
  bonds: { a: number[]; b: number[]; order: (1|2|3|4)[] };  // 4 = aromático
  steroid?: { numbering: (number|null)[]; rings: {A:number[];B:number[];C:number[];D:number[]};
              sideChain: number[]; aromaticA: boolean; nor19: boolean };
  groups: { type: string; atoms: number[]; position?: string }[];   // 'OH','C=O','ester','ethynyl',...
  surface?: { xyz: number[] };       // nube SAS opcional (Å×100)
  conformer: { kind: 'pubchem_3d_computed'|'pdb_ligand'|'none'; note?: string; pdb?: string };
  pharm?: PharmSheet;                // ficha farmacológica (§6.8)
  source: Source[];
}
```

Reglas: coordenadas centradas en el centroide y orientadas por PCA en build (eje mayor = X) para
que todas las moléculas "entren" en la misma pose; hidrógenos incluidos pero marcados para LOD.
Las conformaciones PubChem 3D son **calculadas** (no cristalográficas); la ficha lo declara.

### 6.3 Anotación esteroidea (build)

`tools/annotate.js` ejecuta un isomorfismo de subgrafo (VF2 simplificado sobre átomos pesados,
ignorando órdenes de enlace) contra la plantilla del gonano (17 átomos, 4 anillos) con
tolerancias: heteroátomo en posición 4 (4-azaesteroides: finasterida, dutasterida), anillo A
aromático (estrógenos), ausencia de C19 (19-nor), lactona espiro en C17 (espironolactona),
C17-etinilo, 11β-sustituyentes (mifepristona). Asigna `numbering[i] ∈ 1..19` a cada átomo del
núcleo y C19/C18 como metilos angulares cuando existen; detecta grupos funcionales por patrones
de vecindad. Moléculas no esteroideas (tamoxifeno, letrozol, anastrozol, flutamida,
bicalutamida, enzalutamida, clomifeno, raloxifeno) quedan con `steroid: undefined` y el atlas
oculta el coloreado por anillos.

### 6.4 Enzima (`Enzyme`) y cofactor

```ts
interface Enzyme {
  id: 'enz:CYP17A1'; gene: string; names: { es: string; en?: string; ec?: string[] };
  family: 'CYP'|'HSD'|'SRD5A'|'AKR'|'SULT'|'STS'|'transportador'|'otro';
  activities: { id: string; label: string; cofactors: string[] }[];  // p.ej. 17α-hidroxilasa / 17,20-liasa
  compartment: 'mitocondria_membrana_interna'|'reticulo_endoplasmico_liso'|'citosol'|'membrana';
  electronDonor?: 'POR'|'FDX1_FDXR'|'ninguno';
  structure?: { pdb: string; chain: string; ligand?: string; caTrace: number[] /* Å×100 */; note: string };
  inhibitors: 'drug:...'[]; conditions: 'cond:...'[];
  source: Source[];
}
```

Inventario mínimo de enzimas y proteínas accesorias del alcance (contenido a verificar):
StAR, CYP11A1, FDX1, FDXR, HSD3B2, HSD3B1, CYP17A1, POR, CYB5A, HSD17B3, AKR1C3 (HSD17B5),
HSD17B1, HSD17B2, CYP19A1, SRD5A2, SRD5A1, SULT2A1, STS, CYP21A2, CYP11B1, CYP11B2, HSD11B2,
HSD17B6 (vía backdoor), CYP3A4 (metabolismo), UGT2B17 (glucuronidación), SHBG (transporte).

### 6.5 Reacción y vía (`Reaction`, `Pathway`)

```ts
interface Reaction {
  id: 'rx:...'; substrate: 'mol:...'; product: 'mol:...'; enzyme: 'enz:...'; activity?: string;
  reversible: boolean; kind: 'hidroxilacion'|'escision_cadena'|'oxidacion_3b_isomerizacion'|
        'reduccion_17ceto'|'oxidacion_17oh'|'5a_reduccion'|'aromatizacion'|'sulfatacion'|
        'desulfatacion'|'11b_hidroxilacion'|'18_oxidacion'|'otro';
  compartment: Enzyme['compartment']; cofactors: string[];
  series: 'delta5'|'delta4'|'corticoide'|'backdoor'|'11oxo'|'estrogeno'|'inactivacion';
  atomMap?: { removed: number[]; added: number[]; changed: number[] };  // índices en sustrato/producto
  tissues: { tissue: 'tis:...'; weight: 0|0.5|1 }[];  // expresión relativa (de expression.json)
  source: Source[];
}
interface Pathway { id: 'path:esteroidogenesis'; reactions: 'rx:...'[];
  layout: { nodeId: string; layer: number; column: number }[]; groups: {...}[] }
```

Inventario mínimo de reacciones del núcleo (≥ 16 para el criterio de aceptación §5.7):
colesterol→pregnenolona; pregnenolona→progesterona; pregnenolona→17α-OH-pregnenolona;
17α-OH-pregnenolona→DHEA; progesterona→17α-OH-progesterona; 17α-OH-progesterona→androstenediona;
17α-OH-pregnenolona→17α-OH-progesterona; DHEA→androstenediona; DHEA→androstenediol;
androstenediol→testosterona; androstenediona→testosterona; testosterona→DHT;
androstenediona→estrona; testosterona→estradiol; estrona⇄estradiol; DHEA⇄DHEA-S;
estradiol→estriol (unidad feto-placentaria, con nota de simplificación). Rama corticoide:
progesterona→DOC→corticosterona→18-OH-corticosterona→aldosterona; 17-OHP→11-desoxicortisol→
cortisol. Ramas plegadas: 11-oxigenados y backdoor.

### 6.6 Tejido, órgano, receptor

```ts
interface Tissue { id: 'tis:...'; organ: 'org:...'; cell: string; zone?: string;
  expression: { enzyme: 'enz:...'; level: 0|0.5|1; source: Source[] }[];
  scaleAssets: { organPath: string; cellSprite: string };  // referencias a paths vectoriales
  produces: 'mol:...'[]; regulators: ('LH'|'FSH'|'ACTH'|'hCG'|'AngII'|'K+')[] }
interface Organ { id: 'org:...'; names; sex: 'ambos'|'xx'|'xy'; bodyAnchor: [x,y,z]; silhouettePath: string;
  targets: { hormone: 'mol:...'; receptor: 'rec:...'; effect: string; clinical: string; source: Source[] }[];
  synthesizes: 'tis:...'[] }
interface Receptor { id: 'rec:AR'; gene: string; names; class: 'nuclear'|'membrana';
  isoforms?: string[]; ligands: { mol: 'mol:...'; kind: 'agonista'|'agonista_parcial'|'antagonista'|'modulador_selectivo';
  affinity?: Affinity }[]; structure?: { pdb: string; ligand: 'mol:...'; caTrace: number[]; ligandXyz?: number[] };
  expression: 'org:...'[]; source: Source[] }
interface Affinity { metric: 'RBA'|'Ki'|'Kd'|'IC50'|'EC50'; value: number; unit: '%'|'nM';
  reference: 'mol:...'; assay?: string; source: Source }
```

Inventario mínimo de órganos/territorios (contenido a poblar): hipotálamo, hipófisis, mama,
útero (endometrio, miometrio, cérvix), vagina, ovario, trompa, testículo, epidídimo/vesículas
seminales, próstata, pene/genitales externos, piel (folículo, sebácea), hueso y cartílago de
crecimiento, músculo, tejido adiposo, hígado, endotelio/corazón, riñón, cerebro, laringe,
médula ósea, suprarrenal, placenta. Receptores: AR, ERα, ERβ, PR (A/B), GR, MR, GPER1, y
transportadores SHBG/albúmina como pseudo-entidades.

### 6.7 Interacción y fármaco

```ts
interface Interaction { id: 'ix:...'; a: string; b: string;  // cualquier ID (mol/drug/enz/rec)
  kind: 'agonismo'|'antagonismo'|'modulacion_selectiva'|'inhibicion_enzimatica'|'induccion_cyp'|
        'inhibicion_cyp'|'desplazamiento_shbg'|'sinergia_clinica'|'contraindicacion'|'precursor';
  direction: 'a->b'|'b->a'|'bidireccional'; strength?: 'alta'|'media'|'baja'; mechanism: string;
  clinical?: string; source: Source[] }
interface Drug extends Molecule { pharm: PharmSheet }
interface PharmSheet { class: string; mechanism: string; indications: string[]; contraindications: string[];
  adverse: string[]; pk: { bioavailability?: string; halfLife?: string; metabolism?: string; route: string[] };
  doses?: { context: string; text: string; source: Source }[]; monitoring?: string[]; pregnancy?: string;
  source: Source[] }
```

### 6.8 Condición clínica, laboratorio, elegibilidad, lectura, pregunta

```ts
interface Condition { id: 'cond:...'; names; gene?: string; enzyme?: 'enz:...'; inheritance?: string;
  blocks: { reaction: 'rx:...'; activity: number }[];        // entrada al simulador
  expectedLevels: { mol: 'mol:...'; direction: 'up2'|'up'|'flat'|'down'|'down2'; marker?: boolean; override?: string }[];
  phenotype: { xx: string; xy: string; common: string[] }; labs: 'lab:...'[]; treatment: string;
  source: Source[] }
interface LabTest { id: 'lab:...'; analyte: 'mol:...'|string; unit: string;
  ranges: { population: string; low: number; high: number; source: Source }[]; interpretation: string[] }
interface Eligibility { id: 'elig:...'; method: string; condition: string; category: 1|2|3|4;
  note?: string; source: Source /* OMS CME edición y página */ }
interface Reading { id: 'read:...'; citation: string; doi?: string; pmid?: string; kind: 'revision'|'guia'|'libro'|'articulo'; summary: string; tags: string[] }
interface Question { id: 'q:...'; stem: string; options: string[]; answer: number; explanation: string;
  links: string[]; module: string; difficulty: 1|2|3; source?: Source }
```

### 6.9 Procedencia (`Source`)

```ts
interface Source { db?: 'PubChem'|'RCSB PDB'|'UniProt'|'OMIM'|'OMS'|'DrugBank'|'ChEMBL';
  id?: string; url?: string; retrieved?: string;   // ISO-8601
  citation?: string; doi?: string; pmid?: string; pages?: string; note?: string }
```

Regla de oro: **una afirmación cuantitativa (afinidad, rango, dosis, prevalencia) siempre lleva
`Source` propio**, no solo la entidad contenedora.

### 6.10 Referencias cruzadas garantizadas

| Desde | Hacia | Uso |
|---|---|---|
| `Reaction.substrate/product` | `Molecule` | Nodo del mapa abre ficha del atlas |
| `Reaction.enzyme` | `Enzyme` | Paso enzimático, inhibidores |
| `Reaction.tissues[].tissue` | `Tissue` → `Organ` | Filtro por tejido, escalas |
| `Organ.targets[].hormone` | `Molecule` | "Seleccionar hormona → iluminar órganos" |
| `Organ.targets[].receptor` | `Receptor` | Receptores, afinidad |
| `Condition.blocks[].reaction` | `Reaction` | Simulador |
| `Condition.labs[]` | `LabTest` | Laboratorio |
| `Interaction.a/b` | cualquier entidad | Mapa de interacciones |
| `Question.links[]` | cualquier entidad | Explicación con puentes |

---

## 7. Órganos blanco

### 7.1 Modelo del cuerpo: "cuerpo estratificado 2.5D"

Se descarta un modelo 3D de malla anatómica (necesitaría un asset con licencia y procedencia,
pesaría > 1 MB y exigiría un rasterizador de triángulos). Se elige un **cuerpo estratificado**:
silueta humana frontal en 4–6 capas vectoriales (`Path`) con profundidad distinta (piel,
esqueleto esquemático, vísceras, sistema endocrino) y **órganos como primitivas 3D reales del
motor** (blobs `Sphere` agrupados, glándulas como esferoides) anclados en coordenadas
`bodyAnchor` (x, y, z). La cámara permite yaw limitado (±35°) y zoom; el paralaje entre capas y el
sombreado de los blobs dan sensación de volumen sin malla. Las siluetas se dibujan a mano en
`assets/anatomy/*.svg` (paths propios, sin dependencias de terceros) y se convierten a arrays
en build.

Variante por sexo: interruptor "46,XX / 46,XY" que cambia gónadas, útero/próstata, mama y
distribución de vello/grasa; los territorios comunes se comparten.

### 7.2 Interacción bidireccional

- **Hormona → órganos**: al elegir una hormona (chips por familia o desde el atlas) se iluminan
  sus órganos blanco con intensidad proporcional al peso del efecto (`targets[].weight`, curado);
  cada órgano iluminado muestra un callout DOM con receptor y efecto principal. Filtro por
  receptor (AR/ERα/ERβ/PR/GR/MR) y por "efecto" (desarrollo, reproducción, metabólico, SNC).
- **Órgano → hormonas**: al elegir un órgano se despliega en el inspector la tabla hormona →
  receptor → efecto → correlato clínico (fisiológico, hipo/hiperfunción, farmacológico), con
  puentes: "Ver hormona en el atlas", "Ver dónde se sintetiza" (escalas), "Ver fármacos que
  actúan aquí" (interacciones).
- **Línea temporal**: deslizador de etapas (fetal, neonatal, infancia/adrenarquia, pubertad,
  adulto, gestación, climaterio/andropausia) que cambia qué efectos se muestran (p. ej. la
  virilización de genitales externos por DHT solo en etapa fetal).

### 7.3 Vista de órgano

Al entrar en un órgano (escala 1) se muestra su corte esquemático (`Path`) con zonas/células
seleccionables y, si es esteroidogénico, el puente directo a las escalas del capítulo. Para
órganos blanco puros (próstata, endometrio, mama, hueso), la vista muestra la célula diana con
el receptor nuclear como perla y una miniatura del ligando; al clic entra en Receptor–ligando.

---

## 8. Interacción bioquímica

### 8.1 Mapa de interacciones (grafo de fuerzas)

- Nodos: hormonas endógenas, fármacos, enzimas y receptores del repositorio (≈ 120). Aristas:
  `Interaction.kind` con color y trazo por tipo (agonismo continuo, antagonismo punteado,
  inhibición enzimática con "T" terminal, inducción/inhibición CYP3A4 en gris).
- Layout de fuerza dirigida (`layout.js: force`) calculado **en build** para la configuración
  por defecto y guardado; en runtime solo se relaja localmente al filtrar (≤ 200 iteraciones,
  < 16 ms).
- Los nodos de molécula son miniaturas 3D reales (wire/varillas). Filtros por familia, tipo de
  interacción, receptor, y "foco": al seleccionar un nodo, el resto se atenúa y se muestran las
  interacciones de primer y segundo grado.
- El inspector muestra mecanismo, relevancia clínica y fuente por arista.

### 8.2 Comparador de estructuras con rotación sincronizada

- Dos viewports (o hasta cuatro en pantalla ancha) con `CameraLink`. Superposición Kabsch sobre
  los átomos del núcleo esteroide (numeración común) o sobre el máximo subgrafo común si alguna
  no es esteroide; modo "superponer en un solo viewport" con transparencia.
- Panel de diferencias generado automáticamente desde `groups` y `steroid`: sustituyentes
  distintos por posición (p. ej. "C17: etinilo vs H", "anillo A: aromático vs Δ4-3-ceto",
  "C19: ausente (19-nor)"), y desde `pharm`: potencia relativa, vía, semivida (con fuente).
- Presets pedagógicos: testosterona vs DHT; estradiol vs etinilestradiol; progesterona vs
  levonorgestrel vs drospirenona; testosterona vs nandrolona; cortisol vs aldosterona;
  DHEA vs androstenediol.

### 8.3 Visualización receptor–ligando y afinidad

- **Estructura**: traza Cα del dominio de unión a ligando (LBD) desde RCSB PDB (≈ 250 residuos,
  ~2 KB por estructura cuantizada) y coordenadas del ligando cocristalizado (todos los átomos).
  Candidatos (todos **[verificar]** ID, ligando y cadena antes de incorporar): AR-LBD con DHT
  (1I37), AR-LBD con testosterona (2AM9), ERα-LBD con estradiol (1ERE / 1GWR), PR-LBD con
  progesterona (1A28), GR-LBD con dexametasona (1M2Z), MR-LBD con aldosterona (2AA2), SHBG con
  DHT (1D2S); enzimas para §5.4: CYP17A1 con abiraterona (3RUK), CYP19A1 con androstenediona
  (3EQM), CYP11A1 con colesterol (3N9Y), CYP21A2 humana (4Y8W), HSD17B1 con estradiol (1FDT),
  SRD5A2 con finasterida (7BW1).
- Vista: cinta/tubo semitransparente, bolsillo resaltado (residuos a < 4,5 Å del ligando,
  calculado en build), ligando en bolas y varillas; toggle "sustituir ligando" que coloca otra
  molécula alineada por Kabsch sobre el núcleo del ligando cristalizado (solo ilustrativo,
  etiquetado como superposición geométrica, **no docking**).
- **Afinidad**: gráfico de barras/radial de afinidad relativa por receptor para la molécula
  seleccionada, con métrica, ensayo y fuente por barra (tablas de RBA de revisiones de
  referencia, p. ej. progestágenos frente a PR/AR/ER/GR/MR **[verificar y citar]**). Sin valor
  no citable no hay barra.

---

## 9. Módulos heredados: integración en la nueva arquitectura

Contrato común: cada módulo es un objeto `Module { id, title, route, mount(el, ctx), unmount(),
onState(state) }` registrado en `src/modules/index.js`; recibe `ctx = { repo, store, router,
engine, overlay, theme }`. Ningún módulo importa a otro: se comunican por store y rutas.

| Módulo heredado | Integración en la nueva arquitectura | Datos que consume |
|---|---|---|
| Comparador | Se convierte en §8.2 con cámaras sincronizadas y diferencias automáticas | `Molecule.steroid/groups/pharm` |
| Ciclo hormonal | Gráfica canvas 2D (mismo sistema de tokens) de E2, P4, LH, FSH, inhibina, folículo y endometrio sobre 28 días, con cursor que **ilumina en el cuerpo** los órganos activos y en el mapa de la vía las enzimas activas (teca/granulosa/cuerpo lúteo) en el día elegido | `cycle.json` (curvas con fuente), `Tissue`, `Organ` |
| Receptores | Ficha por receptor con dominios, isoformas, mecanismo genómico/no genómico, ligandos y afinidades; puente a §8.3 | `Receptor`, `Affinity` |
| Laboratorio | Rangos de referencia por población y por analito, interpretación, y "perfil esperado" generado desde `Condition.expectedLevels`; calculadora de índices (p. ej. testosterona libre calculada, con fórmula citada) | `LabTest`, `Condition` |
| Interacciones farmacológicas | Tabla/consulta de pares fármaco–fármaco y fármaco–hormona con mecanismo (CYP3A4, SHBG, etc.); vista compartida con §8.1 filtrada a fármacos | `Interaction`, `Drug` |
| Elegibilidad clínica | Buscador método × condición con categoría OMS (1–4), notas y fuente; puentes a fármaco y a órgano afectado | `Eligibility` |
| Lecturas | Bibliografía anotada filtrable por módulo/entidad; toda `Source` con DOI enlaza aquí | `Reading` |
| Autoevaluación | Motor de preguntas con explicación y puentes a la entidad; modo por módulo y examen mixto; resultados locales | `Question` |

Migración (Fase 0/7): `tools/import-legacy.js` extrae de `legacy/hormonas/` los datos (JSON
embebido o tablas) y los vuelca al esquema §6 marcando `source.note = 'importado de Atlas
Esteroide v1; verificar'`. Nada importado se publica sin fuente confirmada.

---

## 10. Arquitectura de archivos y build

### 10.1 Árbol del repositorio

```
Fabhormo/
├── README.md
├── docs/
│   ├── arquitectura-atlas-esteroide-3d.md   (este documento)
│   ├── decisiones/ADR-000x-*.md             (decisiones tomadas en Fase 2)
│   └── fuentes.md                           (registro de fuentes y fechas de consulta)
├── legacy/hormonas/                         (base previa; aportar por el usuario)
├── src/
│   ├── index.html                           plantilla de desarrollo (carga módulos ES sin build)
│   ├── main.js                              arranque: repo, store, router, shell, módulos
│   ├── core/    store.js router.js events.js repo.js search.js theme.js persist.js a11y.js
│   ├── engine/  (§4.2)
│   ├── modules/ home/ steroidogenesis/{map,scales,step,deficit,tour}/ atlas/ organs/
│   │            interactions/{map,compare,receptor}/ cycle/ receptors/ lab/ drugs/
│   │            eligibility/ readings/ quiz/  index.js
│   ├── ui/      shell.js rail.js inspector.js toolbar.js tooltip.js callout.js chips.js
│   │            dialog.js sheet.js progress.js legend.js icons.js
│   ├── styles/  tokens.css base.css shell.css components.css modules/*.css print.css
│   ├── data/    molecules/*.json enzymes.json reactions.json pathway.json expression.json
│   │            tissues.json organs.json receptors.json interactions.json drugs/*.json
│   │            conditions.json labs.json cycle.json eligibility.json readings.json
│   │            questions.json tours/*.json  manifest.json
│   └── assets/  fonts/*.woff2 icons/*.svg anatomy/*.svg cells/*.svg
├── tools/
│   ├── build.js            empaqueta → dist/ (dos variantes), valida presupuesto
│   ├── bundle-lite.js      empaquetador ESM propio (cero dependencias)
│   ├── fetch-pubchem.js    CID → SDF 3D + propiedades → raw/ (con caché y manifest)
│   ├── fetch-pdb.js        PDB ID → traza Cα + ligando → raw/
│   ├── annotate.js         numeración esteroidea, anillos, grupos, PCA, SAS, atomMap
│   ├── validate.js         esquema, IDs, referencias, fuentes, coherencia flujo/tabla
│   ├── import-legacy.js    extracción de la base previa
│   ├── subset-fonts.js     subconjunto woff2 (usa pyftsubset si existe; si no, copia estático)
│   ├── layout-precompute.js  fuerza dirigida y capas de la vía
│   ├── verify.js           navegador headless: rutas, errores de consola, fps, capturas
│   └── size-report.js      desglose de tamaño por componente
├── raw/                    descargas cacheadas (SDF, PDB, JSON PubChem) — versionadas
├── dist/                   atlas-esteroide-3d.html, artifact.html, verify/ (capturas)
├── test/                   unitarios de engine/math, annotate, flux, repo (node:test)
└── package.json            scripts únicamente; sin dependencias de runtime
```

### 10.2 Convenciones de módulos ES y empaquetado

- Código fuente en ES2020 con `import`/`export` estándar, sin bundler durante el desarrollo:
  `src/index.html` se abre desde un servidor local (`npx serve` o `python -m http.server`).
- `tools/bundle-lite.js` (cero dependencias): resuelve el grafo de imports desde `main.js`,
  ordena topológicamente, reescribe cada módulo como función registrada en un `__modules`
  interno (`define(path, fn)` / `require(path)`) y concatena. Restricciones que hacen viable
  el empaquetador: solo imports relativos estáticos, solo `export function|const|class` y
  `export { a, b }`, sin `import()` dinámico, sin `export default` (usar nombres). El validador
  de build rechaza sintaxis fuera de este subconjunto.
- Si `esbuild` está disponible como devDependency, `build.js --esbuild` lo usa para bundling y
  minificación; si no, aplica una minificación conservadora propia (comentarios, espacios) y
  aceptar ~20 % más de tamaño. La salida debe ser idéntica funcionalmente con ambos caminos
  (prueba de verificación).
- Los datos se inyectan como `window.ATLAS_DATA = {...}` en un `<script>` previo al código.
  JSON con claves cortas y coordenadas enteras; sin base64 de JSON (ineficiente).

### 10.3 Plantillas de salida

`tools/build.js` produce a partir de `dist/_bundle.{css,js}` y `dist/_data.js`:

1. **`dist/atlas-esteroide-3d.html`** (doble clic): `<!doctype html>`, `<html lang="es">`, `<meta
   viewport>`, `<title>`, `<style>` con fuentes data URI + tokens + estilos, `<body>` con shell
   mínima, `<script>` datos, `<script>` código. Incluye `<meta http-equiv="Content-Security-Policy">`
   equivalente a la de Artifacts (`default-src 'none'; img-src data:; font-src data:; style-src
   'unsafe-inline'; script-src 'unsafe-inline'`) para que **lo que funcione con doble clic
   funcione igual como Artifact**.
2. **`dist/artifact.html`**: mismo contenido sin `doctype/html/head/body`, con `<title>` y
   `<style>` al principio, tokens de tema según §2.4, sin exportaciones/descargas, y con la clase
   `is-artifact` en el contenedor raíz para ocultar funciones no disponibles.

### 10.4 Pipeline de datos (build-time, con red)

```
molecules.manifest.json (id, cid, family, role, alias)  ──► fetch-pubchem.js ──► raw/pubchem/{cid}.sdf + .json
pdb.manifest.json (id, pdb, chain, ligandResname)        ──► fetch-pdb.js     ──► raw/pdb/{id}.cif|pdb
raw/* ──► annotate.js ──► src/data/molecules/*.json, receptors/enzymes.structure
src/data/*.json ──► validate.js (esquema + referencias + fuentes + coherencia) ──► ok/falla
src/data + src/assets + src/* ──► build.js ──► dist/*.html ──► verify.js ──► dist/verify/report.json
```

- `fetch-pubchem.js` usa PUG REST (`/rest/pug/compound/cid/{cid}/SDF?record_type=3d` y
  `/property/...`), con caché en `raw/` y `manifest` con fecha y hash. Si un CID no tiene
  conformación 3D, el registro queda `conformer.kind = 'none'` y la molécula solo aparece en
  fichas (sin 3D) hasta que se aporte una fuente alternativa; el build lo lista como aviso.
- Los CID se resuelven **una sola vez** y quedan fijados en el manifiesto (no resolución por
  nombre en cada build). El apéndice B propone CID de partida marcados **[verificar]**.
- `raw/` se versiona en git para que el build sea reproducible sin red.

### 10.5 Verificación automatizada

- `npm test`: unitarios con `node:test` (math/Kabsch, annotate con moléculas patrón, flux con
  casos de déficit, repo).
- `npm run verify`: Playwright + Chromium (disponible en el entorno de desarrollo remoto) o
  `msedge --headless` como alternativa: abre `dist/atlas-esteroide-3d.html` vía `file://`, visita
  cada ruta del §3.1, comprueba cero errores de consola, mide fps en rotación forzada, guarda
  captura por ruta en `dist/verify/`, y escribe `report.json` con presupuesto vs. medido.
- `npm run build` falla si: tamaño > 4,5 MB, validación de datos falla, o alguna fuente `[verificar]`
  sigue sin confirmar en entidades publicadas (campo `source.verified !== true`).

### 10.6 Gestión de assets

| Asset | Origen | Proceso | Formato final |
|---|---|---|---|
| Fuentes | Archivos OFL en `src/assets/fonts/` | Subconjunto latín + latín-ext + griego + símbolos (α β γ δ Δ κ μ ↑ ↓ ⇄ ≥ ≤ ± ×) | woff2 base URI en `@font-face` |
| Iconos | SVG propios (trazo 1,5 px, rejilla 24) | Limpieza y `<symbol>` en un sprite inline | `<svg><symbol id="i-…">` |
| Siluetas anatómicas/celulares | SVG propios | Paths → arrays de comandos y profundidad | JSON en `ATLAS_DATA.assets` |
| Moléculas | PubChem | §10.4 | JSON cuantizado |
| Estructuras | RCSB PDB | Traza Cα + ligando + bolsillo | JSON cuantizado |
| Superficies | Calculadas (Shrake–Rupley) | Solo para moléculas del atlas | Nube de puntos Å×100 |

---

## 11. Sistema visual

### 11.1 Principios

1. **Lámina científica, no dashboard**: fondo profundo y limpio en el escenario, tipografía
   editorial en fichas, jerarquía por tamaño y peso, no por color.
2. **El color significa**: cada matiz está reservado a una semántica (familia hormonal, familia
   enzimática, compartimento, elemento, cambio). La interfaz en sí es casi monocroma.
3. **El 3D es protagonista**: escenario ≥ 50 % del viewport, paneles translúcidos que no
   compiten, controles flotantes que desaparecen al arrastrar.
4. **Movimiento con propósito**: solo transiciones que explican (morph, fundido entre escalas,
   halo de acumulación); respeta `prefers-reduced-motion`.
5. **Dos modos equivalentes**: "Lámina" (oscuro, por defecto en el escenario 3D) y "Papel"
   (claro); ambos con contraste AA en texto y AAA en cuerpo de ficha.

### 11.2 Tokens (definidos en `styles/tokens.css`; valores de partida ajustables en Fase 3)

| Token | Papel (claro) | Lámina (oscuro) |
|---|---|---|
| `--bg` | `#f6f4ef` (papel cálido) | `#0d1117` (grafito azulado) |
| `--bg-stage` | `#eceae3` | `#0a0e14` |
| `--surface` | `#ffffff` | `#141a23` |
| `--surface-2` | `#f0eee8` | `#1b222d` |
| `--ink` | `#1a1a1a` | `#e8e6e1` |
| `--ink-2` | `#4a4a48` | `#a9adb5` |
| `--ink-3` | `#7a7a76` | `#6f7580` |
| `--line` | `#d9d6cd` | `#2a323e` |
| `--accent` | `#0b5cad` (azul atlas) | `#6fb1ff` |
| `--focus` | `#ff8a00` | `#ffb454` |
| `--fam-androgeno` | `#1f5fbf` | `#5b9cff` |
| `--fam-estrogeno` | `#c2185b` | `#ff6fa8` |
| `--fam-gestageno` | `#b8860b` | `#ffcd4a` |
| `--fam-gluco` | `#2e7d32` | `#6fd07a` |
| `--fam-minera` | `#00796b` | `#4dd0c4` |
| `--fam-precursor` | `#5d6b7a` | `#9aa8b8` |
| `--enz-cyp` | `#d84315` | `#ff8a65` |
| `--enz-hsd` | `#6a1b9a` | `#ce93d8` |
| `--enz-red` | `#558b2f` | `#aed581` |
| `--enz-sulf` | `#00838f` | `#4dd0e1` |
| `--comp-mito` | `#8d2f2f` | `#e57373` |
| `--comp-rel` | `#35618f` | `#7fb3e6` |
| `--ring-A/B/C/D` | `#e64a19 / #fbc02d / #43a047 / #1e88e5` | `#ff7043 / #ffd54f / #66bb6a / #42a5f5` |
| `--delta-up / --delta-down` | `#c62828 / #1565c0` | `#ef5350 / #64b5f6` |

Implementación de temas conforme a §2.4 (tres bloques: `:root`, media query con
`:root:not([data-theme="light"])`, y `:root[data-theme="dark"]`); el interruptor de la app
escribe `data-theme` en el elemento raíz.

### 11.3 Tipografía (incrustada, licencia OFL)

| Uso | Familia propuesta | Pesos | Alternativa del sistema |
|---|---|---|---|
| Títulos, numerales de capítulo, nombres de molécula en escenario | Source Serif 4 | 600 | Georgia, "Times New Roman" |
| Interfaz y cuerpo de ficha | Source Sans 3 | 400, 600 | system-ui, Segoe UI, Roboto |
| Fórmulas, IDs, unidades, códigos PDB/CID | JetBrains Mono (o Source Code Pro) | 400 | ui-monospace, Consolas |

Escala tipográfica: 12 / 13 / 14 / 16 / 20 / 28 / 40 px; interlineado 1,45 en cuerpo; anchura de
línea máxima 68 caracteres en fichas. Los subíndices/superíndices químicos (C₁₉H₂₈O₂, 17α, Δ⁴)
se componen con caracteres Unicode incluidos en el subconjunto, no con `<sub>` cuando van en
canvas.

### 11.4 Colores de elementos (CPK adaptado)

| Elemento | Papel | Lámina |
|---|---|---|
| C | `#3d3d3d` | `#c9ccd1` |
| H | `#c8c8c8` | `#e8e8e8` (r reducido) |
| O | `#d62828` | `#ff5c5c` |
| N | `#1d4ed8` | `#6b8bff` |
| S | `#d4a017` | `#ffd23f` |
| F / Cl / Br / I | `#2e9e5b` / `#1faa59` / `#a33a1f` / `#7e3fbf` | ídem aclarados |

### 11.5 Componentes clave

- **Rail** con capítulo destacado (numeral "I" en serif, barra de progreso del recorrido).
- **Barra de escenario**: migas de escala, selector de representación/coloreado, cámara
  (encuadrar, reset, ortográfica), capturar (solo doble clic), ayuda de gestos.
- **Inspector** con pestañas fijas: Estructura · Síntesis · Acción · Clínica · Fuentes; cabecera
  con miniatura 3D viva de la entidad.
- **Chips semánticos** (familia, enzima, compartimento, tejido) con el color-token correspondiente
  y borde, nunca solo relleno (accesibilidad daltónica: además del color, glifo ◆ mito / ● REL,
  trazo continuo/punteado en aristas).
- **Callouts** de escenario: caja con vértice hacia la entidad, texto ≤ 2 líneas, botón "más".
- **Leyenda** plegable por escena.
- **Estados vacíos** con instrucción ("Selecciona una hormona para iluminar sus órganos").

### 11.6 Accesibilidad

Navegación por teclado completa (rail, inspector, entidades del escenario por `Tab`), foco
visible con `--focus`, `aria-live` para cambios de selección, descripciones textuales de cada
escena (`aria-describedby`) generadas desde los datos ("Mapa con 24 metabolitos y 26
reacciones; seleccionado: testosterona"), contraste AA, `prefers-reduced-motion` y
`prefers-contrast`, tamaño de objetivo táctil ≥ 40 px.

---

## 12. Plan de fases de desarrollo (ordenado por dependencias)

Cada fase termina con `npm run build && npm run verify` en verde y una captura por criterio en
`dist/verify/`. No se avanza con criterios pendientes. Estimaciones en "sesiones" de trabajo
del modelo constructor (orientativas).

### Fase 0 — Rescate de la base y andamiaje (1–2 sesiones)

Tareas: crear el árbol §10.1; `bundle-lite.js`, `build.js` con ambas plantillas, `verify.js`
con Chromium headless; tokens y tipografía incrustada; shell vacía con rail/escenario/inspector;
`import-legacy.js` sobre `legacy/hormonas/` (si está disponible) volcando a `raw/legacy/`.
**Aceptación**: los dos HTML se generan, abren sin errores desde `file://` y muestran la shell;
tamaño < 600 KB; el informe de tamaño funciona; inventario escrito en `docs/legacy-inventario.md`
(qué se reutiliza, qué se descarta y por qué).

### Fase 1 — Motor 3D núcleo (2–3 sesiones)

Tareas: `math`, `camera`, `controls`, `scene`, `primitives`, `sprites`, `renderer2d`,
`picking`, `tween`, `quality`, `stats`; escena de prueba con una molécula (testosterona) y una
escena de estrés (24 moléculas wire + 2 trazas Cα sintéticas).
**Aceptación**: 60 fps con testosterona bolas-varillas con H a DPR 2; ≥ 30 fps en la escena de
estrés en portátil medio (documentar máquina); hover/selección correctos en ambos; controles
ratón/táctil/teclado; render 0 fps en reposo; pruebas unitarias de `math` (Kabsch con caso
conocido) en verde.

### Fase 2 — Pipeline de datos y conjunto molecular (2–3 sesiones)

Tareas: `fetch-pubchem.js`, `annotate.js` (numeración, anillos, grupos, PCA, SAS, atomMap),
`validate.js`, manifiesto con ≥ 58 moléculas heredadas + las nuevas del apéndice B; fichas
farmacológicas importadas/verificadas; `fuentes.md`.
**Aceptación**: todas las moléculas con `conformer.kind` declarado y CID verificado (script
imprime tabla); numeración esteroidea correcta en un conjunto de control de 12 moléculas
revisadas manualmente (testosterona, estradiol, progesterona, colesterol, DHEA, DHT,
etinilestradiol, levonorgestrel, drospirenona, finasterida, mifepristona, espironolactona);
validador en verde; datos ≤ 700 KB.

### Fase 3 — Shell, sistema visual y Atlas molecular (2 sesiones)

Tareas: store/router/repo/búsqueda; rail e inspector completos; tema claro/oscuro; módulo
Atlas con lista filtrable, representaciones, coloreados, ficha con pestañas y puentes; deep links.
**Aceptación**: cada molécula navegable por URL; cambio de tema sin re-render de datos;
búsqueda < 50 ms; capturas de ambos temas; accesibilidad por teclado en atlas.

### Fase 4 — Capítulo Esteroidogénesis (4–6 sesiones; fase propia)

Subfases con aceptación individual: 4a Mapa de la vía (grafo, filtros por tejido, leyenda);
4b Escalas (siluetas, células, orgánulos, portales, migas para tres tejidos); 4c Paso
enzimático (morph, trazas Cα de las enzimas con estructura, panel); 4d Simulador de déficits
(flux + tabla curada + validador de coherencia); 4e Recorrido guiado (timeline, narración,
puntos de control, progreso). **Aceptación**: la lista completa de §5.7.

### Fase 5 — Órganos blanco (2 sesiones)

Tareas: siluetas por capas, anclajes, blobs de órganos, variante XX/XY, iluminación
bidireccional, línea temporal de etapas, vista de órgano.
**Aceptación**: para cada hormona endógena principal (testosterona, DHT, estradiol, estrona,
progesterona, DHEA) los órganos iluminados coinciden con `organs.json`; cada órgano abre tabla
con fuentes; navegación inversa desde el capítulo (escala 0) usa este mismo módulo.

### Fase 6 — Interacción bioquímica (2–3 sesiones)

Tareas: `fetch-pdb.js`, trazas y bolsillos; mapa de fuerzas precalculado; comparador con
`CameraLink` y diferencias automáticas; receptor–ligando con afinidades citadas.
**Aceptación**: ≥ 6 estructuras verificadas; comparador alinea correctamente los 6 presets;
mapa con ≥ 100 interacciones con fuente; ninguna barra de afinidad sin cita.

### Fase 7 — Módulos heredados (2–3 sesiones)

Tareas: migrar/reconstruir ciclo, receptores, laboratorio, interacciones farmacológicas,
elegibilidad, lecturas, autoevaluación al contrato `Module` y a los datos §6.
**Aceptación**: paridad funcional con el inventario de Fase 0 (o con la especificación §9 si no
hay base); todos los puentes cruzados operativos; preguntas con explicación y enlaces.

### Fase 8 — Integración, rendimiento, accesibilidad y cierre (2 sesiones)

Tareas: auditoría de presupuesto (§2), calidad adaptativa afinada, `prefers-reduced-motion`,
lectores de pantalla, revisión de fuentes (`verified: true` en todo lo publicado), README de
uso, `docs/decisiones/`, capturas finales, etiqueta de versión.
**Aceptación**: `build` y `verify` en verde con presupuesto cumplido en ambas variantes; artefacto
publicado como Artifact abre sin errores de CSP; informe final `dist/verify/report.json`.

### Dependencias entre fases

```
F0 ──► F1 ──► F3 ──► F4 ──► F5 ──► F8
 │      │      ▲      ▲      ▲
 └──► F2 ──────┘      │      │
        └─────────────┴──► F6 ──► F7
```

F2 puede avanzar en paralelo con F1. F6 y F7 requieren F3 y F2; F5 requiere F4b (escalas).

---

## 13. Riesgos técnicos y decisiones abiertas

| # | Riesgo / decisión | Impacto | Mitigación / quién decide |
|---|---|---|---|
| R1 | La base `hormonas/` no está disponible | Se pierde reutilización; el alcance heredado se reconstruye desde especificación | Usuario aporta `legacy/hormonas/`; si no, F7 construye desde §9 y F2 regenera moléculas |
| R2 | Canvas 2D no alcanza 30 fps en el mapa completo en gama media | Capítulo insignia lento | LOD wire, ocultar H, DPR 1,5, sprites menores; si persiste, activar `RendererGL` (ADR en F4a) |
| R3 | PubChem sin conformación 3D para alguna molécula (p. ej. moléculas grandes o cargadas) | Ficha sin 3D | Marcar `conformer.kind='none'`; buscar ligando en PDB; nunca "inventar" coordenadas |
| R4 | Casos límite del emparejador de numeración esteroidea (4-aza, espiro, 19-nor, aromático) | Coloreado/alineación erróneos | Conjunto de control manual (F2); fallback a MCS; anotación manual permitida con `source.note` |
| R5 | Fidelidad del simulador cualitativo (eje hipotálamo-hipófisis, derivaciones) | Mensaje clínico engañoso | Capa curada manda; validador de coherencia; etiqueta permanente "cualitativo" |
| R6 | Subconjunto de fuentes sin `pyftsubset` | +300–500 KB | Usar woff2 estáticos solo latín; el presupuesto lo absorbe |
| R7 | CSP de Artifacts vs `file://` divergen (workers, `blob:`) | Fallos solo en una variante | Misma CSP en la variante doble clic (§10.3); `verify.js` prueba ambas |
| R8 | Safari iPad: límite de canvas, gestos, memoria | Experiencia degradada | DPR cap 1,5 en iPadOS; canvas ≤ 4 096 px por lado; pruebas manuales P1 |
| R9 | Datos clínicos con fuentes heterogéneas o desactualizadas (OMS CME, RBA) | Rigor | Registro `fuentes.md` con edición/fecha; sin cita no se publica |
| R10 | Licencias: fuentes OFL sí; datos PDB/PubChem de dominio público; siluetas propias | Legal | Créditos en "Fuentes"; no incrustar figuras de terceros |
| D1 | ¿`esbuild` como acelerador opcional o solo `bundle-lite`? | Tamaño/tiempo de build | Opus decide en F0 según disponibilidad de `npm`; ambos caminos deben pasar `verify` |
| D2 | ¿Superficie por nube SAS o por spacefill translúcido? | Coste/legibilidad | Prototipar ambas en F3; elegir por fps y claridad; ADR |
| D3 | ¿Mostrar rama corticoide desplegada por defecto en el mapa? | Saturación para principiantes | Plegada por defecto; desplegada en modo "avanzado" (ajuste persistente) |
| D4 | ¿Texto de etiquetas en canvas o en DOM overlay? | Nitidez/accesibilidad vs coste | DOM para callouts/tooltips; canvas solo para etiquetas cortas con `Billboard` |
| D5 | Selección de estructuras PDB definitivas (una por receptor/enzima) | Fidelidad | Verificar en RCSB en F6; preferir resolución < 2,5 Å con el ligando endógeno |
| D6 | Grado de detalle de siluetas anatómicas (esquemático vs realista) | Peso/tiempo | Esquemático de línea clara; ≤ 120 KB |
| D7 | Persistencia de progreso (`localStorage`) y su ausencia en previsualización | Errores | Envolver en `try/catch`; la app funciona sin persistencia |
| D8 | Idioma secundario (inglés) | Alcance | Fuera de alcance; estructura `names.en` preparada |

---

## 14. Contratos de interfaz (referencia rápida para la Fase 2)

```ts
// core/store.js
interface State { route: Route; theme: 'light'|'dark'|'system'; selection: {type: string; id: string}|null;
  hover: {type: string; id: string}|null; scale: number; tissueFilter: string|null;
  representation: 'ballstick'|'sticks'|'spacefill'|'surface'|'wire'; coloring: 'element'|'rings'|'groups'|'family'|'change';
  tour: { id: string; step: number; playing: boolean }|null; quality: 0|1|2|3; advanced: boolean }
store.get(); store.set(partial); store.on(key, fn); store.off(key, fn)

// core/router.js  (hash)
router.go(path: string); router.on((route) => void); router.link(entityId): string

// core/repo.js
repo.byId(id); repo.list(type, filter?); repo.reactionsOf(molId); repo.enzymesIn(tissueId);
repo.organsTargetedBy(molId); repo.tissuesProducing(molId); repo.search(query): Hit[]

// engine
const engine = createEngine(canvas, { theme, quality });
engine.scene.add(node); engine.scene.remove(id); engine.camera.fitBounds(ids, pad);
engine.camera.flyTo(state, ms); engine.setScale(s); engine.requestRender();
engine.on('select', fn); engine.on('hover', fn); engine.project(id): {x, y, r, z}|null;
engine.stats: { ms: number; primitives: number; fps: number }
createMoleculeNode(molecule, { representation, coloring, hydrogens }): SceneNode
createTubeNode(caTrace, { color, width }): SceneNode
createPathNode(pathAsset, { depth, fill, stroke }): SceneNode
morph(nodeA, nodeB, atomMap, t: number): void
new Timeline(keyframes).play()/pause()/seek(step)/on('step', fn)

// modules/index.js
interface Module { id: string; title: string; route: RegExp; mount(el, ctx): void; unmount(): void; onState?(s: State): void }
```

---

## Apéndice A — Presupuesto por escena (referencia de LOD)

| Escena | Nodos | Primitivas estimadas | LOD por defecto |
|---|---|---|---|
| Portada (constelación) | 12 moléculas wire + aristas | ~600 | wire, sin H |
| Atlas: una molécula con H, bolas-varillas | 1 | ~150 | completo |
| Atlas: superficie | 1 | ~1 500 puntos + 60 varillas | puntos 2 px |
| Mapa de la vía (sexual + corticoide) | 24 moléculas | ~1 400 | varillas sin H; wire si > 18 visibles |
| Escala orgánulo | paths + 12 perlas | ~200 | — |
| Paso enzimático | traza Cα 480 res + 2 moléculas | ~900 | H ocultos en morph |
| Órganos blanco | 6 paths + 24 blobs (×3 esferas) | ~120 | — |
| Comparador ×2 con H | 2 | ~300 | completo |
| Receptor–ligando | traza 250 + ligando 50 + bolsillo 30 | ~450 | completo |
| Mapa de interacciones | 120 nodos wire + 200 aristas | ~2 800 | wire; miniaturas solo en foco |

## Apéndice B — Conjunto molecular de partida (CID PubChem **[verificar todos en F2]**)

Endógenas y precursores: colesterol (5997), pregnenolona (8955), 17α-hidroxipregnenolona,
DHEA (5881), DHEA-S, androstenediol, progesterona (5994), 17α-hidroxiprogesterona (6238),
androstenediona (6128), testosterona (6013), dihidrotestosterona (10635), estrona (5870),
estradiol (5757), estriol (5756), estetrol, 11-desoxicorticosterona, corticosterona,
18-hidroxicorticosterona, aldosterona (5839), 11-desoxicortisol, cortisol (5754), cortisona,
11β-hidroxiandrostenediona, 11-cetotestosterona, androsterona, alopregnanolona,
5α-androstanodiol.

Estrógenos y progestágenos farmacológicos: etinilestradiol, valerato de estradiol, estrógenos
conjugados (equilina como representante), levonorgestrel, norgestimato, desogestrel/etonogestrel,
gestodeno, noretisterona, dienogest, drospirenona, acetato de ciproterona, acetato de
medroxiprogesterona, acetato de clormadinona, nomegestrol, progesterona micronizada
(misma entidad), tibolona, didrogesterona.

Andrógenos y anabolizantes: enantato/undecanoato de testosterona, nandrolona, oxandrolona,
estanozolol, danazol, mesterolona.

Moduladores y antagonistas: tamoxifeno, raloxifeno, clomifeno, fulvestrant, bazedoxifeno,
ospemifeno, mifepristona, acetato de ulipristal, espironolactona, bicalutamida, enzalutamida,
flutamida, apalutamida, darolutamida.

Inhibidores enzimáticos: finasterida, dutasterida, anastrozol, letrozol, exemestano,
abiraterona, ketoconazol, metirapona, osilodrostat.

Otros de contexto: dexametasona, prednisolona, colecalciferol (secoesteroide no hormonal sexual,
solo para "qué es un esteroide"), ácido cólico (ídem).

Los CID sin número se resuelven en F2 por nombre/InChIKey y se fijan en el manifiesto. Las
moléculas ya presentes en la base previa se conservan con su CID original tras verificarlo.

## Apéndice C — Glosario de IDs de tejido y compartimento

`tis:leydig`, `tis:teca`, `tis:granulosa`, `tis:cuerpo_luteo`, `tis:glomerulosa`,
`tis:fasciculada`, `tis:reticular`, `tis:sincitiotrofoblasto`, `tis:adiposo`, `tis:piel_genital`,
`tis:foliculo_piloso`, `tis:prostata_estroma`,
`tis:hepatocito`, `tis:mama_estroma`, `tis:hueso_osteoblasto`, `tis:cerebro_glia`.
Compartimentos: `mitocondria_membrana_interna`, `reticulo_endoplasmico_liso`, `citosol`,
`membrana`.

## Apéndice D — Checklist de rigor antes de publicar cualquier dato

1. ¿Tiene `source` con identificador resoluble (CID, PDB, DOI/PMID, edición OMS)?
2. ¿Se ha comprobado el identificador contra la fuente en la fecha `retrieved`?
3. ¿La conformación 3D está declarada como calculada o experimental?
4. ¿La afirmación clínica está en una revisión o guía de referencia, no solo en memoria del
   modelo?
5. ¿Hay coherencia entre simulador y tabla curada? (validador)
6. ¿El texto distingue lo fisiológico de lo farmacológico y lo cualitativo de lo cuantitativo?
