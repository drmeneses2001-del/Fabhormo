# ADR-0003 — Representaciones esquemáticas y su declaración

Fecha: 2026-09-02 · Estado: aceptada · Resuelve: D6 del documento de arquitectura

## Contexto

Las vistas de escalas, órganos blanco, paso enzimático y receptor necesitan mostrar anatomía,
compartimentos celulares y proteínas. No hay activos anatómicos con procedencia clara disponibles
y tampoco estructuras cristalográficas (ver ADR-0002). El riesgo es que un dibujo convincente se
lea como un dato.

## Decisión

1. **Toda la geometría no molecular se genera por código** en `src/engine/shapes.js`: la silueta
   humana a partir de una media silueta reflejada, las membranas celulares con irregularidad
   controlada, la mitocondria con su membrana interna plegada y las cisternas del retículo. Nada
   proviene de ilustraciones de terceros.
2. **Cada vista esquemática lo dice.** El cuerpo lleva la leyenda «esquema anatómico, no a escala»;
   la vista de la enzima, «representación esquemática: no hay estructura cristalográfica cargada»;
   el dominio de unión al ligando, «esquema».
3. **Lo que sí es dato real convive con el esquema sin mezclarse.** En el paso enzimático el
   compartimento es esquemático pero las dos moléculas y la correspondencia atómica entre ellas son
   datos; en la vista de receptor el dominio es un esquema pero el ligando es la molécula real y el
   tipo de actividad está citado.
4. **Sin cifra sin fuente.** La afinidad relativa de cada ligando por su receptor no se muestra
   como número, porque no hay fuente comprobable en esta compilación; se muestra la clase de
   actividad, que sí lo está.

## Consecuencias

- El lector distingue en todo momento qué está mirando.
- Las vistas quedan preparadas para incorporar trazas Cα reales sin rehacer nada: el motor ya tiene
  la primitiva de tubo y el nodo correspondiente.
