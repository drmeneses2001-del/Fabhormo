# Estado de verificación de las fuentes

Este registro dice, bloque a bloque, qué se ha comprobado durante la compilación y qué queda
pendiente de comprobar contra la fuente original. La aplicación muestra la misma distinción en la
pestaña de fuentes de cada ficha.

## Estructuras moleculares

| Comprobación | Alcance | Estado |
|---|---|---|
| Fórmula molecular calculada frente a la esperada | 82 moléculas | comprobada en compilación; una discrepancia detiene el build |
| Clave InChI calculada frente a un valor de referencia | 69 de 82 | comprobada en compilación |
| Clave InChI sin valor de referencia | 13 de 82 | pendiente de comprobar en línea |
| Identificador de compuesto de PubChem | 82 moléculas | pendiente de comprobar en línea |
| Conformación tridimensional | 81 con geometría, 1 sin ella | calculada con ETKDG v3 y MMFF94s, declarada como tal |

Moléculas sin clave InChI de referencia: 11-cetotestosterona, 11β-hidroxiandrostenediona, 16α-hidroxi-DHEA, 17α-hidroxialopregnanolona, 5α-androstano-3,17-diona, Acetato de nomegestrol, Bazedoxifeno, Darolutamida, Didrogesterona, Drospirenona, Norgestimato, Osilodrostat, Raloxifeno.

Moléculas sin conformación: Drospirenona.

## Contenido de la vía, clínico y farmacológico

| Bloque | Registros | Fuente principal | Estado |
|---|---|---|---|
| Enzimas | 26 | Miller y Auchus 2011; Payne y Hales 2004 | cita pendiente de comprobar |
| Reacciones | 37 | Miller y Auchus 2011; Auchus 2004; Turcu y Auchus 2015 | cita pendiente de comprobar |
| Tejidos y expresión enzimática | 16 | Miller y Auchus 2011 | cita pendiente de comprobar |
| Cuadros clínicos y bloqueos | 17 | Speiser y cols. 2018; Turcu y Auchus 2015 | cita pendiente de comprobar |
| Órganos y efectos | 19 órganos, 35 efectos | Hall y Hall 2020; Speroff 2020; Mooradian y cols. 1987 | cita pendiente de comprobar |
| Receptores | 7 | Miller y Auchus 2011; Speroff 2020 | cita pendiente de comprobar |
| Interacciones | 30 | Sitruk-Ware 2004; Stanczyk y cols. 2013; Handelsman 2020 | cita pendiente de comprobar |
| Laboratorio | 16 analitos | Speiser y cols. 2018; Speroff 2020; Handelsman 2020 | rangos orientativos, dependientes del método |
| Elegibilidad | 35 pares | OMS, criterios médicos de elegibilidad, 5.ª ed. | selección docente, no la tabla completa |
| Autoevaluación | 20 preguntas | según la pregunta | cita pendiente de comprobar |
| Ciclo hormonal | 8 series | Speroff 2020 | perfiles normalizados, no concentraciones |

## Coherencia interna comprobada en cada compilación

- Identificadores únicos y ausencia de referencias colgantes entre todas las entidades.
- Fuente declarada en toda entidad publicable.
- Correspondencia atómica presente en toda reacción cuyas dos moléculas tienen geometría.
- Coherencia entre el modelo cualitativo de flujo y la tabla clínica curada: cada discrepancia
  necesita una nota que la explique, o la compilación se detiene.

## Qué haría falta para cerrar lo pendiente

Una pasada con acceso a la red que confirme cada identificador de PubChem y sustituya las
conformaciones calculadas por las publicadas, resuelva los identificadores DOI de las doce
referencias y descargue las estructuras cristalográficas de receptores y enzimas para sustituir
los esquemas por trazas reales.

## Referencias citadas

- Miller WL, Auchus RJ. The molecular biology, biochemistry, and physiology of human steroidogenesis and its disorders. Endocr Rev. 2011;32(1):81-151. doi:10.1210/er.2010-0013
- Auchus RJ. The backdoor pathway to dihydrotestosterone. Trends Endocrinol Metab. 2004;15(9):432-438. doi:10.1016/j.tem.2004.09.004
- Turcu AF, Auchus RJ. Adrenal steroidogenesis and congenital adrenal hyperplasia. Endocrinol Metab Clin North Am. 2015;44(2):275-296. doi:10.1016/j.ecl.2015.02.002
- Speiser PW, Arlt W, Auchus RJ, et al. Congenital adrenal hyperplasia due to steroid 21-hydroxylase deficiency: an Endocrine Society clinical practice guideline. J Clin Endocrinol Metab. 2018;103(11):4043-4088. doi:10.1210/jc.2018-01865
- Payne AH, Hales DB. Overview of steroidogenic enzymes in the pathway from cholesterol to active steroid hormones. Endocr Rev. 2004;25(6):947-970. doi:10.1210/er.2003-0030
- Hall JE, Hall ME. Guyton and Hall Textbook of Medical Physiology. 14th ed. Elsevier; 2020. Capitulos de fisiología endocrina y reproductiva.
- Taylor HS, Pal L, Seli E. Speroff’s Clinical Gynecologic Endocrinology and Infertility. 9th ed. Wolters Kluwer; 2020.
- Mooradian AD, Morley JE, Korenman SG. Biological actions of androgens. Endocr Rev. 1987;8(1):1-28. doi:10.1210/edrv-8-1-1
- Organización Mundial de la Salud. Medical eligibility criteria for contraceptive use. 5th ed. Ginebra: OMS; 2015.
- Sitruk-Ware R. Pharmacological profile of progestins. Maturitas. 2004;47(4):277-283. doi:10.1016/j.maturitas.2004.01.001
- Stanczyk FZ, Archer DF, Bhavnani BR. Ethinyl estradiol and 17β-estradiol in combined oral contraceptives: pharmacokinetics, pharmacodynamics and risk assessment. Contraception. 2013;87(6):706-727. doi:10.1016/j.contraception.2012.12.011
- Handelsman DJ. Androgen physiology, pharmacology, use and misuse. En: Feingold KR et al., eds. Endotext. South Dartmouth: MDText.com; 2020.
