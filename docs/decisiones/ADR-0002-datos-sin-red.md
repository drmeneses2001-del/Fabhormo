# ADR-0002 — Generación de datos sin acceso a la red

Fecha: 2026-09-02 · Estado: aceptada · Resuelve: R3 y parte de R9 del documento de arquitectura

## Contexto

La arquitectura preveía descargar las conformaciones 3D de PubChem y las trazas Cα de RCSB PDB
durante la compilación. En el entorno donde se construyó la aplicación, la política de egreso
bloquea PubChem, RCSB PDB, UniProt, EBI y el resto de NCBI; solo son alcanzables npm, PyPI y
GitHub. Sin conformaciones no hay atlas tridimensional, y sin ninguna alternativa el proyecto se
detiene.

## Decisión

1. **Las estructuras se generan con RDKit** (disponible en PyPI) a partir de SMILES isoméricos
   transcritos en el manifiesto, con geometría de distancias ETKDG v3 y relajación MMFF94s con
   semilla fija, de modo que la compilación es reproducible.
2. **Dos puertas de verificación antes de escribir nada.** La fórmula molecular que calcula RDKit
   debe coincidir con la esperada, declarada por separado en el manifiesto. Cuando la entrada trae
   clave InChI de referencia, la calculada debe coincidir también: esa comprobación cubre
   conectividad y estereoquímica completas y es la más fuerte disponible sin red. Una entrada que
   falle cualquiera de las dos no se escribe y el generador termina con error.
3. **Lo que no se puede comprobar viaja marcado.** Las 13 moléculas sin clave de referencia y todos
   los identificadores de PubChem quedan con `verified: false` y una nota, y la aplicación lo
   muestra. `tools/fetch-pubchem.js` queda pendiente de escribir para el día en que haya red: su
   trabajo será sustituir conformaciones y confirmar identificadores en una sola pasada.
4. **Sin estructura cristalográfica no se dibuja una proteína.** Las vistas que la arquitectura
   preveía con trazas Cα (paso enzimático, receptor y ligando) usan representaciones esquemáticas
   que se declaran como tales en la propia vista. Es preferible un esquema honesto a una estructura
   inventada.
5. **La anotación del núcleo esteroide se hace con RDKit en compilación**, no con un emparejador
   propio en JavaScript como preveía la arquitectura. El isomorfismo de subgrafo con química real
   es más fiable, y el resultado viaja ya resuelto en los datos, así que el artefacto no carga
   ninguna biblioteca química.

## Consecuencias

- El atlas tiene 82 moléculas con estructura tridimensional y anotación completa del núcleo, sin
  haber inventado una sola coordenada.
- La drospirenona no tiene conformación: su geometría no converge con la estereoquímica escrita.
  Se publica sin coordenadas y con el motivo a la vista, en lugar de con una geometría plausible.
- Queda una tarea pendiente clara y acotada para cuando haya red: confirmar identificadores y
  sustituir conformaciones calculadas por las de PubChem.
