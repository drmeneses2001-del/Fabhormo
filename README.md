# Atlas Esteroide 3D

Atlas interactivo y autocontenido sobre la bioquímica de las hormonas esteroideas sexuales, con
la esteroidogénesis como capítulo insignia y los órganos blanco como destino. Se compila a un
único archivo HTML que funciona con doble clic, sin conexión y sin dependencias externas.

## Uso

```bash
npm install          # solo herramientas de compilación (esbuild, playwright-core, fuentes OFL)
npm run data         # regenera moléculas, vía, órganos, datos clínicos y validación
npm run build        # compila dist/atlas-esteroide-3d.html y dist/artifact.html
npm run verify       # abre cada ruta en Chromium headless, mide fps y captura pantallas
npm test             # pruebas unitarias de motor, modelo de flujo y datos
npm run dev          # servidor local sobre src/ para desarrollar sin compilar
```

Los dos artefactos salen de la misma fuente:

- `dist/atlas-esteroide-3d.html` se abre con doble clic desde el disco.
- `dist/artifact.html` es el mismo contenido sin envoltorio, para publicar como Artifact.

Ambos declaran la misma política de seguridad, así que lo que funciona en uno funciona en el otro.

## Qué contiene

**Capítulo I · Esteroidogénesis.** Mapa de la vía con la rejilla clásica Δ5 sobre Δ4, donde cada
metabolito es su molécula real en tres dimensiones y cada flecha lleva su enzima, su compartimento
y sus cofactores. Recorrido por escalas del cuerpo a la molécula pasando por órgano, célula,
orgánulo y enzima. Vista del paso enzimático con la transformación animada de sustrato a producto.
Simulador de déficits enzimáticos y bloqueos farmacológicos contrastado con la tabla clínica.
Recorrido guiado de quince pasos.

**Láminas.** Atlas molecular con cuatro representaciones y cuatro coloreados. Órganos blanco con
iluminación bidireccional entre hormona y territorio. Mapa de interacciones bioquímicas.
Comparador de estructuras con superposición. Receptores. Ciclo hormonal. Laboratorio.
Interacciones farmacológicas. Elegibilidad clínica. Lecturas y fuentes. Autoevaluación.

## Rigor de los datos

- Las 82 moléculas pasan dos puertas antes de entrar: la fórmula calculada debe coincidir con la
  esperada y, en las 69 con clave InChI de referencia, también la clave. Una entrada que falle no
  se escribe y la compilación se detiene.
- Las conformaciones tridimensionales son calculadas y así lo declara cada ficha. La molécula para
  la que la geometría no converge viaja sin coordenadas antes que con una geometría inventada.
- El simulador de déficits se compara en cada compilación con la tabla clínica curada. De 63
  comprobaciones, 59 coinciden; las 4 restantes llevan una nota que explica qué fisiología no
  captura el modelo. Una discrepancia sin nota rompe la compilación.
- Toda entidad publicable lleva fuente. Las citas bibliográficas y los identificadores de PubChem
  se marcan como pendientes de comprobar mientras no se contrasten en línea, y la aplicación lo
  muestra en la pestaña de fuentes de cada ficha y en el módulo de lecturas.

## Documentación

- [`docs/arquitectura-atlas-esteroide-3d.md`](docs/arquitectura-atlas-esteroide-3d.md): el plano de
  construcción.
- [`docs/decisiones/`](docs/decisiones): decisiones tomadas durante el desarrollo y sus motivos.
- [`docs/fuentes.md`](docs/fuentes.md): estado de verificación de cada bloque de datos.

## Presupuesto

| Métrica | Objetivo | Medido |
|---|---|---|
| Tamaño del artefacto | ≤ 3,5 MB (máximo 4,5) | 0,66 MB |
| Tiempo hasta interactivo | < 1,5 s | 0,11 s |
| Memoria JavaScript | < 150 MB | 10 MB |
| Fotogramas por segundo, escena molecular | 60 | 60 |
| Fotogramas por segundo, escena más pesada | ≥ 30 | 44 |
