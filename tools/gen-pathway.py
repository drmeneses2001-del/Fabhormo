#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Construye el grafo de la esteroidogenesis: enzimas, reacciones, tejidos,
expresion por tejido y cuadros clinicos por deficit enzimatico.

Fuente principal para la via, los compartimentos y la expresion por tejido:
Miller WL, Auchus RJ. Endocr Rev. 2011;32(1):81-151. Las citas concretas de cada
bloque van en el campo 'source' de cada entidad. Ninguna cifra se inventa: lo que
no se ha podido comprobar viaja marcado como pendiente y la ficha lo muestra.
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'src', 'data')

PENDIENTE = ('Referencia transcrita sin acceso a la red desde el entorno de compilacion; '
             'el identificador esta pendiente de comprobacion en linea.')

READINGS = [
    dict(id='read:miller2011', kind='revision',
         citation='Miller WL, Auchus RJ. The molecular biology, biochemistry, and physiology of human '
                  'steroidogenesis and its disorders. Endocr Rev. 2011;32(1):81-151.',
         doi='10.1210/er.2010-0013', verified=False, note=PENDIENTE,
         tags=['esteroidogenesis', 'enzimas', 'deficits'],
         summary='Revision de referencia sobre la via completa, la localizacion subcelular de cada '
                 'enzima, su expresion por tejido y los cuadros por deficit.'),
    dict(id='read:auchus2004', kind='revision',
         citation='Auchus RJ. The backdoor pathway to dihydrotestosterone. Trends Endocrinol Metab. '
                  '2004;15(9):432-438.',
         doi='10.1016/j.tem.2004.09.004', verified=False, note=PENDIENTE,
         tags=['via alternativa', 'DHT'],
         summary='Describe la ruta que llega a dihidrotestosterona sin pasar por testosterona, con '
                 '5α-reduccion temprana del sustrato C21.'),
    dict(id='read:turcu2015', kind='revision',
         citation='Turcu AF, Auchus RJ. Adrenal steroidogenesis and congenital adrenal hyperplasia. '
                  'Endocrinol Metab Clin North Am. 2015;44(2):275-296.',
         doi='10.1016/j.ecl.2015.02.002', verified=False, note=PENDIENTE,
         tags=['suprarrenal', 'hiperplasia suprarrenal congenita', '11-oxigenados'],
         summary='Esteroidogenesis suprarrenal por zonas y correlato con las formas de hiperplasia '
                 'suprarrenal congenita, incluidos los androgenos 11-oxigenados.'),
    dict(id='read:speiser2018', kind='guia',
         citation='Speiser PW, Arlt W, Auchus RJ, et al. Congenital adrenal hyperplasia due to steroid '
                  '21-hydroxylase deficiency: an Endocrine Society clinical practice guideline. '
                  'J Clin Endocrinol Metab. 2018;103(11):4043-4088.',
         doi='10.1210/jc.2018-01865', verified=False, note=PENDIENTE,
         tags=['21-hidroxilasa', 'guia clinica'],
         summary='Guia de practica clinica para el diagnostico, el cribado neonatal y el tratamiento '
                 'del deficit de 21-hidroxilasa.'),
    dict(id='read:payne2004', kind='revision',
         citation='Payne AH, Hales DB. Overview of steroidogenic enzymes in the pathway from cholesterol '
                  'to active steroid hormones. Endocr Rev. 2004;25(6):947-970.',
         doi='10.1210/er.2003-0030', verified=False, note=PENDIENTE,
         tags=['enzimas', 'sulfotransferasas'],
         summary='Panoramica de las enzimas esteroidogenicas, con enfasis en la regulacion de su '
                 'expresion y en las reacciones de conjugacion.'),
]

MILLER = 'read:miller2011'
AUCHUS_BACKDOOR = 'read:auchus2004'
TURCU = 'read:turcu2015'
SPEISER = 'read:speiser2018'
PAYNE = 'read:payne2004'

MITO = 'mitocondria_membrana_interna'
REL = 'reticulo_endoplasmico_liso'
CIT = 'citosol'

# --------------------------------------------------------------------- enzimas ---
ENZYMES = [
    dict(id='enz:StAR', gene='STAR', es='Proteina StAR', en='Steroidogenic acute regulatory protein',
         corto='StAR', family='transportador', compartment=MITO,
         activities=[dict(id='transporte', label='Transporte de colesterol a la membrana mitocondrial interna',
                          cofactors=[])],
         note='Paso limitante y regulado de forma aguda por LH, FSH, ACTH y hCG.'),
    dict(id='enz:CYP11A1', gene='CYP11A1', es='Enzima de escision de cadena lateral',
         en='Cholesterol side-chain cleavage enzyme', corto='CYP11A1', family='CYP', compartment=MITO,
         electronDonor='FDX1_FDXR',
         activities=[dict(id='scc', label='20,22-desmolasa: colesterol a pregnenolona',
                          cofactors=['NADPH', 'adrenodoxina (FDX1)', 'adrenodoxina reductasa (FDXR)'])],
         note='Unico paso comun a toda la esteroidogenesis: define la capacidad total de la celula.'),
    dict(id='enz:HSD3B2', gene='HSD3B2', es='3β-hidroxiesteroide deshidrogenasa tipo 2',
         en='3β-hydroxysteroid dehydrogenase type 2', corto='3β-HSD2', family='HSD', compartment=REL,
         activities=[dict(id='oxid', label='Oxidacion 3β-OH e isomerizacion Δ5 a Δ4', cofactors=['NAD+'])],
         note='Isoforma de gonada y suprarrenal. Convierte la serie Δ5 en la serie Δ4.'),
    dict(id='enz:HSD3B1', gene='HSD3B1', es='3β-hidroxiesteroide deshidrogenasa tipo 1',
         en='3β-hydroxysteroid dehydrogenase type 1', corto='3β-HSD1', family='HSD', compartment=REL,
         activities=[dict(id='oxid', label='Oxidacion 3β-OH e isomerizacion Δ5 a Δ4', cofactors=['NAD+'])],
         note='Isoforma de placenta y tejidos perifericos.'),
    dict(id='enz:CYP17A1', gene='CYP17A1', es='17α-hidroxilasa / 17,20-liasa',
         en='Steroid 17α-hydroxylase/17,20-lyase', corto='CYP17A1', family='CYP', compartment=REL,
         electronDonor='POR',
         activities=[dict(id='hidroxilasa', label='17α-hidroxilacion', cofactors=['NADPH', 'POR']),
                     dict(id='liasa', label='Escision 17,20 (requiere citocromo b5)',
                          cofactors=['NADPH', 'POR', 'CYB5A'])],
         note='Una sola proteina con dos actividades. La proporcion entre ellas decide si la celula '
              'fabrica cortisol o androgenos: el citocromo b5 inclina la balanza hacia la liasa.'),
    dict(id='enz:POR', gene='POR', es='NADPH-citocromo P450 oxidorreductasa',
         en='P450 oxidoreductase', corto='POR', family='otro', compartment=REL,
         activities=[dict(id='transf', label='Cede electrones a los P450 microsomales', cofactors=['NADPH'])]),
    dict(id='enz:CYB5A', gene='CYB5A', es='Citocromo b5', en='Cytochrome b5', corto='CYB5A',
         family='otro', compartment=REL,
         activities=[dict(id='alosterico', label='Potencia la actividad liasa de CYP17A1', cofactors=[])]),
    dict(id='enz:HSD17B3', gene='HSD17B3', es='17β-hidroxiesteroide deshidrogenasa tipo 3',
         en='17β-hydroxysteroid dehydrogenase type 3', corto='17β-HSD3', family='HSD', compartment=REL,
         activities=[dict(id='red', label='Reduccion del 17-ceto a 17β-OH', cofactors=['NADPH'])],
         note='Isoforma testicular: es la que convierte androstenediona en testosterona en el testiculo.'),
    dict(id='enz:AKR1C3', gene='AKR1C3', es='Aldo-ceto reductasa 1C3 (17β-HSD5)',
         en='Aldo-keto reductase 1C3', corto='AKR1C3', family='AKR', compartment=CIT,
         activities=[dict(id='red', label='Reduccion del 17-ceto a 17β-OH', cofactors=['NADPH'])],
         note='Version periferica de la activacion androgenica: piel, adiposo, prostata.'),
    dict(id='enz:HSD17B1', gene='HSD17B1', es='17β-hidroxiesteroide deshidrogenasa tipo 1',
         en='17β-hydroxysteroid dehydrogenase type 1', corto='17β-HSD1', family='HSD', compartment=CIT,
         activities=[dict(id='red', label='Estrona a estradiol', cofactors=['NADPH'])],
         note='Granulosa y placenta: activa el estrogeno.'),
    dict(id='enz:HSD17B2', gene='HSD17B2', es='17β-hidroxiesteroide deshidrogenasa tipo 2',
         en='17β-hydroxysteroid dehydrogenase type 2', corto='17β-HSD2', family='HSD', compartment=REL,
         activities=[dict(id='oxid', label='Estradiol a estrona, testosterona a androstenediona', cofactors=['NAD+'])],
         note='Enzima de apagado: protege al endometrio y a otros tejidos del exceso de esteroide activo.'),
    dict(id='enz:CYP19A1', gene='CYP19A1', es='Aromatasa', en='Aromatase', corto='CYP19A1',
         family='CYP', compartment=REL, electronDonor='POR',
         activities=[dict(id='arom', label='Aromatizacion del anillo A con perdida de C19',
                          cofactors=['NADPH', 'POR'])],
         note='Tres ciclos de hidroxilacion que eliminan el carbono 19 y convierten el anillo A en fenol: '
              'es el unico paso que transforma un androgeno en estrogeno.'),
    dict(id='enz:SRD5A1', gene='SRD5A1', es='5α-reductasa tipo 1', en='5α-reductase type 1',
         corto='SRD5A1', family='SRD5A', compartment=REL,
         activities=[dict(id='red5a', label='Reduccion del doble enlace Δ4', cofactors=['NADPH'])],
         note='Higado, piel no genital y cerebro.'),
    dict(id='enz:SRD5A2', gene='SRD5A2', es='5α-reductasa tipo 2', en='5α-reductase type 2',
         corto='SRD5A2', family='SRD5A', compartment=REL,
         activities=[dict(id='red5a', label='Reduccion del doble enlace Δ4', cofactors=['NADPH'])],
         note='Piel genital, prostata, epididimo y foliculo piloso: es la que fabrica DHT donde importa.'),
    dict(id='enz:AKR1C2', gene='AKR1C2', es='Aldo-ceto reductasa 1C2 (3α-HSD tipo 3)',
         en='Aldo-keto reductase 1C2', corto='AKR1C2', family='AKR', compartment=CIT,
         activities=[dict(id='red3a', label='Reduccion del 3-ceto a 3α-OH', cofactors=['NADPH'])]),
    dict(id='enz:HSD17B6', gene='HSD17B6', es='17β-HSD tipo 6 (RODH)', en='17β-HSD type 6',
         corto='HSD17B6', family='HSD', compartment=REL,
         activities=[dict(id='oxid3a', label='Oxidacion 3α-OH a 3-ceto', cofactors=['NAD+'])]),
    dict(id='enz:SULT2A1', gene='SULT2A1', es='Sulfotransferasa 2A1', en='Sulfotransferase 2A1',
         corto='SULT2A1', family='SULT', compartment=CIT,
         activities=[dict(id='sulf', label='Sulfatacion del 3β-OH', cofactors=['PAPS'])],
         note='Zona reticular de la suprarrenal e higado: crea el reservorio circulante de DHEA-S.'),
    dict(id='enz:SULT1E1', gene='SULT1E1', es='Estrogeno sulfotransferasa', en='Estrogen sulfotransferase',
         corto='SULT1E1', family='SULT', compartment=CIT,
         activities=[dict(id='sulf', label='Sulfatacion del fenol del anillo A', cofactors=['PAPS'])]),
    dict(id='enz:STS', gene='STS', es='Esteroide sulfatasa', en='Steroid sulfatase', corto='STS',
         family='STS', compartment=REL,
         activities=[dict(id='desulf', label='Hidrolisis del sulfato', cofactors=[])],
         note='Rescata el esteroide activo desde su reservorio sulfatado; clave en placenta y mama.'),
    dict(id='enz:CYP21A2', gene='CYP21A2', es='21-hidroxilasa', en='Steroid 21-hydroxylase',
         corto='CYP21A2', family='CYP', compartment=REL, electronDonor='POR',
         activities=[dict(id='21oh', label='21-hidroxilacion', cofactors=['NADPH', 'POR'])],
         note='Exclusiva de la corteza suprarrenal. Su deficit es la causa mas frecuente de hiperplasia '
              'suprarrenal congenita.'),
    dict(id='enz:CYP11B1', gene='CYP11B1', es='11β-hidroxilasa', en='Steroid 11β-hydroxylase',
         corto='CYP11B1', family='CYP', compartment=MITO, electronDonor='FDX1_FDXR',
         activities=[dict(id='11boh', label='11β-hidroxilacion', cofactors=['NADPH', 'FDX1', 'FDXR'])],
         note='Zona fasciculada: ultimo paso del cortisol.'),
    dict(id='enz:CYP11B2', gene='CYP11B2', es='Aldosterona sintasa', en='Aldosterone synthase',
         corto='CYP11B2', family='CYP', compartment=MITO, electronDonor='FDX1_FDXR',
         activities=[dict(id='11boh', label='11β-hidroxilacion', cofactors=['NADPH', 'FDX1', 'FDXR']),
                     dict(id='18oh', label='18-hidroxilacion', cofactors=['NADPH', 'FDX1', 'FDXR']),
                     dict(id='18oxid', label='18-oxidacion a aldehido', cofactors=['NADPH', 'FDX1', 'FDXR'])],
         note='Solo en la zona glomerular; sus tres actividades explican por que la aldosterona no se '
              'fabrica en ningun otro sitio.'),
    dict(id='enz:HSD11B1', gene='HSD11B1', es='11β-HSD tipo 1', en='11β-HSD type 1', corto='11β-HSD1',
         family='HSD', compartment=REL,
         activities=[dict(id='red', label='Cortisona a cortisol', cofactors=['NADPH'])]),
    dict(id='enz:HSD11B2', gene='HSD11B2', es='11β-HSD tipo 2', en='11β-HSD type 2', corto='11β-HSD2',
         family='HSD', compartment=REL,
         activities=[dict(id='oxid', label='Cortisol a cortisona', cofactors=['NAD+'])],
         note='Protege al receptor mineralocorticoide del cortisol en rinon.'),
    dict(id='enz:CYP3A7', gene='CYP3A7', es='CYP3A7 (16α-hidroxilasa fetal)', en='Cytochrome P450 3A7',
         corto='CYP3A7', family='CYP', compartment=REL, electronDonor='POR',
         activities=[dict(id='16aoh', label='16α-hidroxilacion', cofactors=['NADPH', 'POR'])],
         note='Higado fetal: fabrica el precursor 16α-hidroxilado del estriol.'),
    dict(id='enz:CYP3A4', gene='CYP3A4', es='CYP3A4', en='Cytochrome P450 3A4', corto='CYP3A4',
         family='CYP', compartment=REL, electronDonor='POR',
         activities=[dict(id='oxid', label='Oxidacion e inactivacion hepatica de esteroides y farmacos',
                          cofactors=['NADPH', 'POR'])]),
]

# ------------------------------------------------------------------ reacciones ---
# 'weight' es la fraccion de flujo que la ruta se lleva en condiciones normales:
# 1 = ruta principal, valores menores = derivaciones. Solo interviene en el
# modelo cualitativo de flujo, no en el contenido de la ficha.
def rx(rid, sub, prod, enz, kind, series, comp, cof, tissues, activity=None,
       reversible=False, note=None, source=None, alt=None, weight=1.0):
    return dict(id=rid, substrate=sub, product=prod, enzyme=enz, activity=activity, kind=kind,
                series=series, compartment=comp, cofactors=cof, reversible=reversible,
                tissues=tissues, note=note, altEnzymes=alt or [], weight=weight,
                source=[source or MILLER])

T_ALL_GONAD = ['tis:leydig', 'tis:teca', 'tis:cuerpo_luteo', 'tis:fasciculada', 'tis:reticular',
               'tis:glomerulosa', 'tis:sincitiotrofoblasto']

REACTIONS = [
    rx('rx:col_preg', 'mol:colesterol', 'mol:pregnenolona', 'enz:CYP11A1', 'escision_cadena',
       'comun', MITO, ['NADPH', 'FDX1', 'FDXR'], T_ALL_GONAD, activity='scc',
       note='Tres oxidaciones sucesivas cortan la cadena lateral entre C20 y C22 y liberan '
            'isocaproaldehido. Es el paso limitante de toda la esteroidogenesis.'),

    # Serie Δ5
    rx('rx:preg_17ohpreg', 'mol:pregnenolona', 'mol:17oh_pregnenolona', 'enz:CYP17A1', 'hidroxilacion',
       'delta5', REL, ['NADPH', 'POR'], ['tis:leydig', 'tis:teca', 'tis:fasciculada', 'tis:reticular'],
       activity='hidroxilasa'),
    rx('rx:17ohpreg_dhea', 'mol:17oh_pregnenolona', 'mol:dhea', 'enz:CYP17A1', 'escision_cadena',
       'delta5', REL, ['NADPH', 'POR', 'CYB5A'], ['tis:leydig', 'tis:teca', 'tis:reticular'],
       activity='liasa',
       note='En el ser humano la actividad liasa es mucho mas eficiente sobre el sustrato Δ5: por eso '
            'la ruta hacia los androgenos pasa por DHEA y no por 17-hidroxiprogesterona.'),
    rx('rx:dhea_dheas', 'mol:dhea', 'mol:dhea_s', 'enz:SULT2A1', 'sulfatacion', 'delta5', CIT,
       ['PAPS'], ['tis:reticular', 'tis:hepatocito'], reversible=False,
       note='El sulfato hace del DHEA un reservorio circulante de vida media larga.', weight=0.6),
    rx('rx:dheas_dhea', 'mol:dhea_s', 'mol:dhea', 'enz:STS', 'desulfatacion', 'delta5', REL,
       [], ['tis:sincitiotrofoblasto', 'tis:mama_estroma', 'tis:piel_genital'], weight=0.4),
    rx('rx:dhea_a5diol', 'mol:dhea', 'mol:androstenediol', 'enz:AKR1C3', 'reduccion_17ceto',
       'delta5', CIT, ['NADPH'], ['tis:leydig', 'tis:piel_genital', 'tis:adiposo'], activity='red',
       reversible=True, alt=['enz:HSD17B3'], weight=0.35),

    # Δ5 -> Δ4 por 3β-HSD
    rx('rx:preg_prog', 'mol:pregnenolona', 'mol:progesterona', 'enz:HSD3B2',
       'oxidacion_3b_isomerizacion', 'delta4', REL, ['NAD+'],
       ['tis:cuerpo_luteo', 'tis:teca', 'tis:leydig', 'tis:fasciculada', 'tis:glomerulosa'],
       alt=['enz:HSD3B1']),
    rx('rx:17ohpreg_17ohprog', 'mol:17oh_pregnenolona', 'mol:17oh_progesterona', 'enz:HSD3B2',
       'oxidacion_3b_isomerizacion', 'delta4', REL, ['NAD+'], ['tis:fasciculada', 'tis:teca', 'tis:leydig']),
    rx('rx:dhea_a4', 'mol:dhea', 'mol:androstenediona', 'enz:HSD3B2', 'oxidacion_3b_isomerizacion',
       'delta4', REL, ['NAD+'], ['tis:teca', 'tis:leydig', 'tis:reticular'], alt=['enz:HSD3B1']),
    rx('rx:a5diol_t', 'mol:androstenediol', 'mol:testosterona', 'enz:HSD3B2',
       'oxidacion_3b_isomerizacion', 'delta4', REL, ['NAD+'], ['tis:leydig'], weight=0.5),

    # Serie Δ4
    rx('rx:prog_17ohprog', 'mol:progesterona', 'mol:17oh_progesterona', 'enz:CYP17A1', 'hidroxilacion',
       'delta4', REL, ['NADPH', 'POR'], ['tis:fasciculada', 'tis:teca', 'tis:leydig'], activity='hidroxilasa'),
    rx('rx:17ohprog_a4', 'mol:17oh_progesterona', 'mol:androstenediona', 'enz:CYP17A1', 'escision_cadena',
       'delta4', REL, ['NADPH', 'POR', 'CYB5A'], ['tis:teca', 'tis:leydig'], activity='liasa',
       note='Paso poco eficiente en el ser humano: la 17-hidroxiprogesterona se acumula cuando la via '
            'hacia el cortisol esta bloqueada.', weight=0.3),
    rx('rx:a4_t', 'mol:androstenediona', 'mol:testosterona', 'enz:HSD17B3', 'reduccion_17ceto',
       'delta4', REL, ['NADPH'], ['tis:leydig', 'tis:piel_genital', 'tis:adiposo'], activity='red',
       reversible=True, alt=['enz:AKR1C3', 'enz:HSD17B2']),
    rx('rx:t_dht', 'mol:testosterona', 'mol:dht', 'enz:SRD5A2', 'a5_reduccion', 'delta4', REL,
       ['NADPH'], ['tis:piel_genital', 'tis:prostata_estroma', 'tis:foliculo_piloso'], activity='red5a',
       alt=['enz:SRD5A1'],
       note='La 5α-reduccion es irreversible y multiplica la potencia androgenica: la DHT se une al '
            'receptor con mas afinidad y se disocia mas despacio que la testosterona.'),

    # Estrogenos
    rx('rx:a4_e1', 'mol:androstenediona', 'mol:estrona', 'enz:CYP19A1', 'aromatizacion', 'estrogeno',
       REL, ['NADPH', 'POR'], ['tis:granulosa', 'tis:sincitiotrofoblasto', 'tis:adiposo', 'tis:mama_estroma'], weight=0.5),
    rx('rx:t_e2', 'mol:testosterona', 'mol:estradiol', 'enz:CYP19A1', 'aromatizacion', 'estrogeno',
       REL, ['NADPH', 'POR'], ['tis:granulosa', 'tis:sincitiotrofoblasto', 'tis:adiposo', 'tis:cerebro_glia'], weight=0.5),
    rx('rx:e1_e2', 'mol:estrona', 'mol:estradiol', 'enz:HSD17B1', 'reduccion_17ceto', 'estrogeno',
       CIT, ['NADPH'], ['tis:granulosa', 'tis:sincitiotrofoblasto', 'tis:mama_estroma'], activity='red',
       reversible=True, alt=['enz:HSD17B2']),
    rx('rx:e1_e1s', 'mol:estrona', 'mol:estrona_sulfato', 'enz:SULT1E1', 'sulfatacion', 'estrogeno',
       CIT, ['PAPS'], ['tis:hepatocito', 'tis:mama_estroma'], reversible=False, weight=0.5),
    rx('rx:e1s_e1', 'mol:estrona_sulfato', 'mol:estrona', 'enz:STS', 'desulfatacion', 'estrogeno',
       REL, [], ['tis:mama_estroma', 'tis:sincitiotrofoblasto'], weight=0.4),
    rx('rx:dhea_16ohdhea', 'mol:dhea', 'mol:16oh_dhea', 'enz:CYP3A7', 'hidroxilacion', 'estrogeno',
       REL, ['NADPH', 'POR'], ['tis:hepatocito'],
       note='Ocurre en el higado fetal: es el origen del estriol de la gestacion.', weight=0.3),
    rx('rx:16ohdhea_e3', 'mol:16oh_dhea', 'mol:estriol', 'enz:CYP19A1', 'aromatizacion', 'estrogeno',
       REL, ['NADPH', 'POR'], ['tis:sincitiotrofoblasto'],
       note='Simplificacion de la unidad fetoplacentaria: la placenta desulfata, oxida con 3β-HSD1 y '
            'aromatiza el precursor 16α-hidroxilado que llega del feto.', weight=0.5),

    # Rama corticoide
    rx('rx:prog_doc', 'mol:progesterona', 'mol:doc', 'enz:CYP21A2', 'hidroxilacion', 'corticoide',
       REL, ['NADPH', 'POR'], ['tis:glomerulosa', 'tis:fasciculada'], activity='21oh'),
    rx('rx:17ohprog_s', 'mol:17oh_progesterona', 'mol:11_desoxicortisol', 'enz:CYP21A2', 'hidroxilacion',
       'corticoide', REL, ['NADPH', 'POR'], ['tis:fasciculada'], activity='21oh'),
    rx('rx:s_cortisol', 'mol:11_desoxicortisol', 'mol:cortisol', 'enz:CYP11B1', '11b_hidroxilacion',
       'corticoide', MITO, ['NADPH', 'FDX1', 'FDXR'], ['tis:fasciculada'], activity='11boh'),
    rx('rx:doc_b', 'mol:doc', 'mol:corticosterona', 'enz:CYP11B2', '11b_hidroxilacion', 'corticoide',
       MITO, ['NADPH', 'FDX1', 'FDXR'], ['tis:glomerulosa'], activity='11boh', alt=['enz:CYP11B1']),
    rx('rx:b_18ohb', 'mol:corticosterona', 'mol:18oh_corticosterona', 'enz:CYP11B2', '18_oxidacion',
       'corticoide', MITO, ['NADPH', 'FDX1', 'FDXR'], ['tis:glomerulosa'], activity='18oh', weight=0.7),
    rx('rx:18ohb_aldo', 'mol:18oh_corticosterona', 'mol:aldosterona', 'enz:CYP11B2', '18_oxidacion',
       'corticoide', MITO, ['NADPH', 'FDX1', 'FDXR'], ['tis:glomerulosa'], activity='18oxid', weight=0.7),
    rx('rx:cortisol_cortisona', 'mol:cortisol', 'mol:cortisona', 'enz:HSD11B2', 'otro', 'inactivacion',
       REL, ['NAD+'], ['tis:hepatocito'], reversible=True, alt=['enz:HSD11B1'], weight=0.5),

    # Androgenos 11-oxigenados
    rx('rx:a4_11oha4', 'mol:androstenediona', 'mol:11oh_androstenediona', 'enz:CYP11B1',
       '11b_hidroxilacion', '11oxo', MITO, ['NADPH', 'FDX1', 'FDXR'], ['tis:reticular'], activity='11boh',
       source=TURCU, weight=0.3),
    rx('rx:11oha4_11kt', 'mol:11oh_androstenediona', 'mol:11ceto_testosterona', 'enz:AKR1C3',
       'reduccion_17ceto', '11oxo', CIT, ['NADPH'], ['tis:adiposo', 'tis:piel_genital'], activity='red',
       source=TURCU,
       note='Simplificacion de dos pasos: 11β-HSD2 oxida el 11β-OH a 11-ceto y AKR1C3 reduce el 17-ceto. '
            'La 11-cetotestosterona es un androgeno potente de origen suprarrenal.', weight=0.5),

    # Via alternativa (backdoor)
    rx('rx:17ohprog_17ohallo', 'mol:17oh_progesterona', 'mol:17oh_alopregnanolona', 'enz:SRD5A1',
       'a5_reduccion', 'backdoor', REL, ['NADPH'], ['tis:leydig', 'tis:reticular'], activity='red5a',
       source=AUCHUS_BACKDOOR,
       note='Simplificacion de dos pasos: 5α-reduccion por SRD5A1 y reduccion 3α por AKR1C2.', weight=0.25),
    rx('rx:17ohallo_androsterona', 'mol:17oh_alopregnanolona', 'mol:androsterona', 'enz:CYP17A1',
       'escision_cadena', 'backdoor', REL, ['NADPH', 'POR', 'CYB5A'], ['tis:leydig', 'tis:reticular'],
       activity='liasa', source=AUCHUS_BACKDOOR, weight=0.5),
    rx('rx:androsterona_adiol', 'mol:androsterona', 'mol:androstanodiol', 'enz:AKR1C3',
       'reduccion_17ceto', 'backdoor', CIT, ['NADPH'], ['tis:leydig', 'tis:piel_genital'],
       activity='red', source=AUCHUS_BACKDOOR, weight=0.5),
    rx('rx:adiol_dht', 'mol:androstanodiol', 'mol:dht', 'enz:HSD17B6', 'otro', 'backdoor', REL,
       ['NAD+'], ['tis:piel_genital', 'tis:prostata_estroma'], activity='oxid3a', source=AUCHUS_BACKDOOR,
       note='Cierra la via alternativa: se llega a DHT sin pasar por testosterona.', weight=0.4),
    rx('rx:a4_5adione', 'mol:androstenediona', 'mol:androstanodiona', 'enz:SRD5A1', 'a5_reduccion',
       'backdoor', REL, ['NADPH'], ['tis:prostata_estroma'], activity='red5a', source=AUCHUS_BACKDOOR, weight=0.25),
    rx('rx:5adione_dht', 'mol:androstanodiona', 'mol:dht', 'enz:AKR1C3', 'reduccion_17ceto', 'backdoor',
       CIT, ['NADPH'], ['tis:prostata_estroma'], activity='red', source=AUCHUS_BACKDOOR,
       note='Via de 5α-diona: en el cancer de prostata resistente a la castracion es la ruta dominante '
            'hacia la DHT.', weight=0.4),
    rx('rx:prog_allo', 'mol:progesterona', 'mol:alopregnanolona', 'enz:SRD5A1', 'a5_reduccion',
       'backdoor', REL, ['NADPH'], ['tis:cerebro_glia', 'tis:cuerpo_luteo'], activity='red5a',
       note='Simplificacion de dos pasos (SRD5A1 y AKR1C2). La alopregnanolona es un neuroesteroide '
            'modulador del receptor GABA-A.', weight=0.3),
]

# --------------------------------------------------------------------- tejidos ---
def tis(tid, es, organ, cell, zone, expression, produces, regulators, desc, source=None):
    return dict(id=tid, names={'es': es, 'corto': es}, organ=organ, cell=cell, zone=zone,
                expression=[dict(enzyme=e, level=l) for e, l in expression],
                produces=produces, regulators=regulators, description=desc,
                source=[source or MILLER])

# level: 1 = expresion alta, 0.5 = baja o dependiente de contexto, 0 = ausente
TISSUES = [
    tis('tis:leydig', 'Celula de Leydig', 'org:testiculo', 'Celula de Leydig', None,
        [('enz:StAR', 1), ('enz:CYP11A1', 1), ('enz:HSD3B2', 1), ('enz:CYP17A1', 1),
         ('enz:CYB5A', 1), ('enz:POR', 1), ('enz:HSD17B3', 1), ('enz:AKR1C3', 0.5),
         ('enz:SRD5A1', 0.5), ('enz:CYP19A1', 0.5), ('enz:CYP21A2', 0), ('enz:CYP11B1', 0)],
        ['mol:testosterona', 'mol:androstenediona', 'mol:dhea'], ['LH', 'hCG'],
        'Unica fuente relevante de testosterona en el varon. Responde a LH con un aumento agudo del '
        'transporte de colesterol por StAR.'),
    tis('tis:teca', 'Celula de la teca', 'org:ovario', 'Celula de la teca interna', None,
        [('enz:StAR', 1), ('enz:CYP11A1', 1), ('enz:HSD3B2', 1), ('enz:CYP17A1', 1),
         ('enz:CYB5A', 0.5), ('enz:POR', 1), ('enz:HSD17B3', 0.5), ('enz:CYP19A1', 0),
         ('enz:CYP21A2', 0), ('enz:CYP11B1', 0)],
        ['mol:androstenediona', 'mol:testosterona'], ['LH'],
        'Mitad androgenica del foliculo: fabrica el precursor que la granulosa aromatiza. No expresa '
        'aromatasa, asi que por si sola no produce estrogeno.'),
    tis('tis:granulosa', 'Celula de la granulosa', 'org:ovario', 'Celula de la granulosa', None,
        [('enz:CYP19A1', 1), ('enz:HSD17B1', 1), ('enz:CYP17A1', 0), ('enz:HSD3B2', 0.5),
         ('enz:StAR', 0.5), ('enz:CYP11A1', 0.5), ('enz:POR', 1)],
        ['mol:estradiol', 'mol:estrona'], ['FSH', 'LH'],
        'Mitad estrogenica del foliculo: sin CYP17A1 no puede fabricar androgenos, de modo que depende '
        'del sustrato que le llega de la teca. Es la teoria de las dos celulas.'),
    tis('tis:cuerpo_luteo', 'Cuerpo luteo', 'org:ovario', 'Celula luteinica', None,
        [('enz:StAR', 1), ('enz:CYP11A1', 1), ('enz:HSD3B2', 1), ('enz:CYP17A1', 0.5),
         ('enz:CYP19A1', 0.5), ('enz:SRD5A1', 0.5)],
        ['mol:progesterona', 'mol:estradiol', 'mol:alopregnanolona'], ['LH', 'hCG'],
        'Tras la ovulacion la maquinaria se reorienta hacia la progesterona, que prepara y mantiene el '
        'endometrio secretor.'),
    tis('tis:glomerulosa', 'Zona glomerular', 'org:suprarrenal', 'Celula de la zona glomerular', 'glomerulosa',
        [('enz:StAR', 1), ('enz:CYP11A1', 1), ('enz:HSD3B2', 1), ('enz:CYP21A2', 1),
         ('enz:CYP11B2', 1), ('enz:CYP17A1', 0), ('enz:CYP11B1', 0), ('enz:POR', 1)],
        ['mol:aldosterona', 'mol:corticosterona'], ['AngII', 'K+'],
        'Sin CYP17A1 no puede hidroxilar en C17: por eso su producto final es aldosterona y no cortisol. '
        'La aldosterona sintasa es exclusiva de esta zona.'),
    tis('tis:fasciculada', 'Zona fasciculada', 'org:suprarrenal', 'Celula de la zona fasciculada', 'fasciculata',
        [('enz:StAR', 1), ('enz:CYP11A1', 1), ('enz:HSD3B2', 1), ('enz:CYP17A1', 1),
         ('enz:CYB5A', 0.5), ('enz:CYP21A2', 1), ('enz:CYP11B1', 1), ('enz:CYP11B2', 0), ('enz:POR', 1)],
        ['mol:cortisol'], ['ACTH'],
        'Expresa CYP17A1 con actividad hidroxilasa alta y liasa baja: hidroxila en 17 pero no corta la '
        'cadena lateral, de modo que la via termina en cortisol.'),
    tis('tis:reticular', 'Zona reticular', 'org:suprarrenal', 'Celula de la zona reticular', 'reticularis',
        [('enz:StAR', 1), ('enz:CYP11A1', 1), ('enz:CYP17A1', 1), ('enz:CYB5A', 1),
         ('enz:SULT2A1', 1), ('enz:HSD3B2', 0.5), ('enz:CYP11B1', 0.5), ('enz:POR', 1)],
        ['mol:dhea', 'mol:dhea_s', 'mol:11oh_androstenediona'], ['ACTH'],
        'Citocromo b5 alto y 3β-HSD2 baja: la combinacion favorece la actividad liasa y desvia el flujo '
        'hacia DHEA y su sulfato. Es el sustrato bioquimico de la adrenarquia.'),
    tis('tis:sincitiotrofoblasto', 'Sincitiotrofoblasto', 'org:placenta', 'Sincitiotrofoblasto', None,
        [('enz:CYP11A1', 1), ('enz:HSD3B1', 1), ('enz:CYP19A1', 1), ('enz:HSD17B1', 1),
         ('enz:STS', 1), ('enz:CYP17A1', 0), ('enz:StAR', 0.5)],
        ['mol:progesterona', 'mol:estriol', 'mol:estradiol', 'mol:estrona'], ['hCG'],
        'Tampoco expresa CYP17A1: no puede fabricar androgenos y depende de los precursores '
        'sulfatados que le llegan del feto. Ese reparto de tareas es la unidad fetoplacentaria.'),
    tis('tis:adiposo', 'Tejido adiposo', 'org:adiposo', 'Celula estromal del adiposo', None,
        [('enz:CYP19A1', 1), ('enz:AKR1C3', 1), ('enz:HSD17B2', 0.5), ('enz:STS', 0.5), ('enz:SRD5A1', 0.5)],
        ['mol:estrona', 'mol:estradiol', 'mol:testosterona'], [],
        'Principal fuente de estrogenos tras la menopausia y en el varon: aromatiza los androgenos '
        'circulantes en un proceso que aumenta con la masa grasa.'),
    tis('tis:piel_genital', 'Piel genital', 'org:genitales_externos', 'Fibroblasto de la piel genital', None,
        [('enz:SRD5A2', 1), ('enz:AKR1C3', 0.5), ('enz:SRD5A1', 0.5), ('enz:HSD17B6', 0.5)],
        ['mol:dht'], [],
        'La 5α-reductasa tipo 2 de este tejido es la que viriliza los genitales externos durante la '
        'vida fetal.'),
    tis('tis:foliculo_piloso', 'Foliculo piloso y glandula sebacea', 'org:piel', 'Unidad pilosebacea', None,
        [('enz:SRD5A1', 1), ('enz:SRD5A2', 0.5), ('enz:AKR1C3', 1), ('enz:CYP19A1', 0.5)],
        ['mol:dht'], [],
        'Explica el acne y el hirsutismo con androgenos circulantes normales: la conversion local '
        'decide el efecto.'),
    tis('tis:prostata_estroma', 'Prostata', 'org:prostata', 'Celula estromal y epitelial prostatica', None,
        [('enz:SRD5A2', 1), ('enz:SRD5A1', 0.5), ('enz:AKR1C3', 1), ('enz:HSD17B6', 0.5)],
        ['mol:dht'], [],
        'Concentra DHT muy por encima de la testosterona plasmatica: es la diana clasica de los '
        'inhibidores de 5α-reductasa.'),
    tis('tis:mama_estroma', 'Estroma mamario', 'org:mama', 'Fibroblasto y adipocito mamario', None,
        [('enz:CYP19A1', 1), ('enz:STS', 1), ('enz:HSD17B1', 1), ('enz:SULT1E1', 0.5)],
        ['mol:estradiol', 'mol:estrona'], [],
        'La suma de aromatasa y sulfatasa mantiene concentraciones intratumorales de estradiol muy '
        'superiores a las plasmaticas en la posmenopausia.'),
    tis('tis:hepatocito', 'Hepatocito', 'org:higado', 'Hepatocito', None,
        [('enz:SRD5A1', 1), ('enz:HSD11B1', 1), ('enz:SULT2A1', 1), ('enz:SULT1E1', 1),
         ('enz:CYP3A4', 1), ('enz:CYP3A7', 0.5), ('enz:HSD11B2', 0.5)],
        ['mol:cortisol', 'mol:estrona_sulfato'], [],
        'Inactiva y conjuga: define la vida media de las hormonas y de casi todos los farmacos '
        'esteroideos, y sintetiza la SHBG que las transporta.'),
    tis('tis:cerebro_glia', 'Sistema nervioso central', 'org:cerebro', 'Neurona y glia', None,
        [('enz:CYP19A1', 1), ('enz:SRD5A1', 1), ('enz:AKR1C2', 1), ('enz:CYP11A1', 0.5), ('enz:StAR', 0.5)],
        ['mol:alopregnanolona', 'mol:estradiol'], [],
        'Fabrica neuroesteroides in situ. La alopregnanolona modula el receptor GABA-A y la aromatasa '
        'local participa en la diferenciacion sexual del cerebro.'),
    tis('tis:hueso_osteoblasto', 'Hueso', 'org:hueso', 'Osteoblasto', None,
        [('enz:CYP19A1', 0.5), ('enz:AKR1C3', 0.5), ('enz:SRD5A1', 0.5)],
        ['mol:estradiol'], [],
        'El estradiol local, incluido el aromatizado a partir de androgenos, es lo que cierra el '
        'cartilago de crecimiento en ambos sexos.'),
]

# ------------------------------------------------------------ cuadros clinicos ---
def cond(cid, es, en, gene, enzyme, inheritance, blocks, expected, xx, xy, common, labs,
         treatment, source, note=None):
    return dict(id=cid, names={'es': es, 'en': en, 'corto': es}, gene=gene, enzyme=enzyme,
                inheritance=inheritance,
                blocks=[dict(reaction=r, activity=a) for r, a in blocks],
                expectedLevels=[dict(mol=e[0], direction=e[1], marker=e[2],
                                     override=(e[3] if len(e) > 3 else None)) for e in expected],
                phenotype=dict(xx=xx, xy=xy, common=common),
                labs=labs, treatment=treatment, note=note, source=[source])

AR = 'autosomica recesiva'

CONDITIONS = [
    cond('cond:def_21oh', 'Deficit de 21-hidroxilasa (forma clasica)',
         '21-hydroxylase deficiency, classic', 'CYP21A2', 'enz:CYP21A2', AR,
         [('rx:prog_doc', 0.0), ('rx:17ohprog_s', 0.0)],
         [('mol:17oh_progesterona', 'up2', True), ('mol:progesterona', 'up', False),
          ('mol:androstenediona', 'up2', True), ('mol:testosterona', 'up', False),
          ('mol:cortisol', 'down2', True), ('mol:aldosterona', 'down2', True),
          ('mol:11_desoxicortisol', 'down', False), ('mol:doc', 'down', False)],
         'Virilizacion de los genitales externos ya al nacimiento (clitoromegalia, fusion de labios), '
         'con utero y ovarios normales. Es la causa mas frecuente de genitales ambiguos en el recien nacido 46,XX.',
         'Genitales masculinos normales al nacer; el riesgo dominante es la crisis de perdida salina '
         'en las primeras semanas y, si no se trata, la pubertad precoz periferica.',
         ['Perdida salina con hiponatremia, hiperpotasemia e hipovolemia en la forma perdedora de sal',
          'Hiperplasia suprarrenal por estimulo mantenido de ACTH',
          'Talla adulta baja por cierre epifisario adelantado si no se controla'],
         ['lab:17ohp', 'lab:testosterona', 'lab:renina', 'lab:cortisol'],
         'Glucocorticoide sustitutivo (hidrocortisona en la infancia) y mineralocorticoide '
         '(fludrocortisona) en la forma perdedora de sal, con sal suplementaria en el lactante.',
         SPEISER,
         'El bloqueo desvia el flujo acumulado hacia la unica salida libre, la via androgenica: por eso '
         'la 17-hidroxiprogesterona sube y con ella los androgenos.'),

    cond('cond:def_21oh_nc', 'Deficit de 21-hidroxilasa no clasico',
         '21-hydroxylase deficiency, non-classic', 'CYP21A2', 'enz:CYP21A2', AR,
         [('rx:prog_doc', 0.35), ('rx:17ohprog_s', 0.35)],
         [('mol:17oh_progesterona', 'up', True), ('mol:androstenediona', 'up', False),
          ('mol:testosterona', 'up', False), ('mol:cortisol', 'flat', False),
          ('mol:aldosterona', 'flat', False)],
         'Presentacion tardia con hirsutismo, acne, oligomenorrea e infertilidad; se confunde con '
         'sindrome de ovario poliquistico.',
         'Habitualmente asintomatico; puede haber acne o pubarquia precoz.',
         ['Actividad enzimatica residual suficiente para mantener cortisol y aldosterona normales',
          'Diagnostico con 17-hidroxiprogesterona basal en fase folicular temprana y prueba de ACTH'],
         ['lab:17ohp', 'lab:testosterona'],
         'Tratamiento solo si hay sintomas: anticonceptivo combinado o antiandrogeno para el '
         'hiperandrogenismo, glucocorticoide a dosis bajas si se busca gestacion.',
         SPEISER),

    cond('cond:def_11boh', 'Deficit de 11β-hidroxilasa', '11β-hydroxylase deficiency',
         'CYP11B1', 'enz:CYP11B1', AR,
         [('rx:s_cortisol', 0.0), ('rx:a4_11oha4', 0.0)],
         [('mol:11_desoxicortisol', 'up2', True), ('mol:doc', 'up2', True),
          ('mol:17oh_progesterona', 'up', False), ('mol:androstenediona', 'up2', False),
          ('mol:cortisol', 'down2', True),
          ('mol:aldosterona', 'down', False,
           'El modelo de flujo predice acumulo de aldosterona porque la aldosterona sintasa esta '
           'intacta y le llega mas sustrato. En la clinica la aldosterona es baja: el exceso de '
           '11-desoxicorticosterona actua sobre el receptor mineralocorticoide, expande el volumen y '
           'suprime la renina, y sin renina la zona glomerular no se estimula. Es una asa de '
           'regulacion que el modelo topologico no contiene.')],
         'Virilizacion como en el deficit de 21-hidroxilasa, pero con hipertension en vez de perdida salina.',
         'Genitales normales al nacer, pubertad precoz periferica e hipertension.',
         ['Hipertension e hipopotasemia por acumulo de 11-desoxicorticosterona, que tiene actividad '
          'mineralocorticoide',
          'La renina esta suprimida, al contrario que en el deficit de 21-hidroxilasa'],
         ['lab:11_desoxicortisol', 'lab:renina', 'lab:potasio'],
         'Glucocorticoide sustitutivo; el control de la hipertension mejora al frenar la ACTH.',
         TURCU),

    cond('cond:def_17oh', 'Deficit de 17α-hidroxilasa/17,20-liasa',
         '17α-hydroxylase/17,20-lyase deficiency', 'CYP17A1', 'enz:CYP17A1', AR,
         [('rx:preg_17ohpreg', 0.0), ('rx:prog_17ohprog', 0.0), ('rx:17ohpreg_dhea', 0.0),
          ('rx:17ohprog_a4', 0.0)],
         [('mol:progesterona', 'up2', False), ('mol:doc', 'up2', True),
          ('mol:corticosterona', 'up2', True), ('mol:cortisol', 'down2', True),
          ('mol:androstenediona', 'down2', True), ('mol:testosterona', 'down2', True),
          ('mol:estradiol', 'down2', True), ('mol:dhea', 'down2', False)],
         'Fenotipo femenino con infantilismo sexual: no hay estrogenos para desarrollar la mama ni '
         'para menstruar, con amenorrea primaria.',
         'Genitales externos femeninos o ambiguos pese al cariotipo 46,XY, porque no se fabrica '
         'testosterona; testiculos intraabdominales o inguinales.',
         ['Hipertension e hipopotasemia por exceso de desoxicorticosterona y corticosterona',
          'El cortisol es bajo pero la corticosterona compensa parcialmente su accion glucocorticoide'],
         ['lab:progesterona', 'lab:testosterona', 'lab:potasio', 'lab:renina'],
         'Glucocorticoide para frenar la ACTH y sustitucion de esteroides sexuales acorde al sexo asignado.',
         MILLER),

    cond('cond:def_3bhsd', 'Deficit de 3β-hidroxiesteroide deshidrogenasa tipo 2',
         '3β-HSD type 2 deficiency', 'HSD3B2', 'enz:HSD3B2', AR,
         [('rx:preg_prog', 0.0), ('rx:17ohpreg_17ohprog', 0.0), ('rx:dhea_a4', 0.0), ('rx:a5diol_t', 0.0)],
         [('mol:17oh_pregnenolona', 'up2', True), ('mol:dhea', 'up2', True),
          ('mol:dhea_s', 'up2', False), ('mol:pregnenolona', 'up2', False),
          ('mol:cortisol', 'down2', True), ('mol:aldosterona', 'down2', True),
          ('mol:testosterona', 'down2', False), ('mol:androstenediona', 'down', False)],
         'Virilizacion leve, paradojica: el DHEA acumulado es un androgeno debil pero se convierte en '
         'testosterona en tejidos perifericos.',
         'Virilizacion incompleta con hipospadias y micropene, porque el testiculo no puede fabricar '
         'testosterona por la via principal.',
         ['Perdida salina frecuente',
          'La relacion 17-hidroxipregnenolona / 17-hidroxiprogesterona muy elevada es la clave diagnostica'],
         ['lab:17oh_pregnenolona', 'lab:dhea_s', 'lab:renina'],
         'Glucocorticoide y mineralocorticoide sustitutivos.',
         MILLER),

    cond('cond:def_star', 'Hiperplasia suprarrenal lipoidea (deficit de StAR)',
         'Lipoid congenital adrenal hyperplasia', 'STAR', 'enz:StAR', AR,
         [('rx:col_preg', 0.02)],
         [('mol:pregnenolona', 'down2', False), ('mol:cortisol', 'down2', True),
          ('mol:aldosterona', 'down2', True), ('mol:testosterona', 'down2', True),
          ('mol:estradiol', 'down2', False), ('mol:dhea_s', 'down2', True),
          ('mol:colesterol', 'up', False)],
         'Genitales externos femeninos normales; la funcion ovarica puede aparecer en la pubertad antes '
         'de fallar, porque el ovario no ha acumulado esteres de colesterol.',
         'Genitales externos femeninos pese al cariotipo 46,XY: sin esteroidogenesis testicular no hay '
         'virilizacion.',
         ['Insuficiencia suprarrenal grave desde el periodo neonatal con perdida salina',
          'Acumulo de esteres de colesterol que destruye la celula esteroidogenica (modelo de dos golpes)'],
         ['lab:cortisol', 'lab:renina', 'lab:dhea_s'],
         'Sustitucion con glucocorticoide y mineralocorticoide de por vida y esteroides sexuales en la '
         'pubertad.',
         MILLER),

    cond('cond:def_por', 'Deficit de P450 oxidorreductasa', 'P450 oxidoreductase deficiency',
         'POR', 'enz:POR', AR,
         [('rx:preg_17ohpreg', 0.35), ('rx:17ohpreg_dhea', 0.05), ('rx:prog_17ohprog', 0.35),
          ('rx:17ohprog_a4', 0.05), ('rx:17ohprog_s', 0.4), ('rx:prog_doc', 0.4),
          ('rx:a4_e1', 0.2), ('rx:t_e2', 0.2)],
         [('mol:17oh_progesterona', 'up', True), ('mol:pregnenolona', 'up', False),
          ('mol:cortisol', 'down', True,
           'El modelo lo compensa con el aumento de ACTH y lo deja en rango. En la practica el '
           'cortisol basal puede ser normal pero la respuesta al estres esta comprometida, que es '
           'lo que importa clinicamente.'),
          ('mol:androstenediona', 'down', False),
          ('mol:estradiol', 'down', False)],
         'Virilizacion fetal que no progresa tras el nacimiento, por acumulo de androgenos de la via '
         'alternativa durante la vida intrauterina; virilizacion materna en la gestacion por deficit '
         'de aromatasa placentaria.',
         'Virilizacion incompleta.',
         ['Afecta a la vez a CYP17A1, CYP21A2 y CYP19A1, porque todas dependen del mismo donante de electrones',
          'Puede asociarse a craneosinostosis y sinostosis radiohumeral (sindrome de Antley-Bixler)'],
         ['lab:17ohp', 'lab:cortisol'],
         'Glucocorticoide en situaciones de estres y sustitucion sexual segun el fenotipo.',
         MILLER),

    cond('cond:def_aromatasa', 'Deficit de aromatasa', 'Aromatase deficiency', 'CYP19A1',
         'enz:CYP19A1', AR,
         [('rx:a4_e1', 0.0), ('rx:t_e2', 0.0), ('rx:16ohdhea_e3', 0.0)],
         [('mol:estradiol', 'down2', True), ('mol:estrona', 'down2', False),
          ('mol:estriol', 'down2', True), ('mol:testosterona', 'up2', True),
          ('mol:androstenediona', 'up2', False,
           'El modelo reparte el represamiento entre androstenediona y testosterona y deja la primera '
           'en rango. En la clinica suben las dos, porque la aromatasa es la unica salida real de '
           'ambas hacia los estrogenos.')],
         'Virilizacion de los genitales al nacer y virilizacion materna durante la gestacion; en la '
         'pubertad, ausencia de desarrollo mamario, ovarios poliquisticos y amenorrea primaria.',
         'Genitales normales, pero talla alta con epifisis abiertas en la edad adulta, osteoporosis y '
         'alteracion del metabolismo lipidico e hidrocarbonado.',
         ['Demuestra que el cierre del cartilago de crecimiento depende del estrogeno tambien en el varon',
          'Estriol materno indetectable durante la gestacion'],
         ['lab:estradiol', 'lab:testosterona', 'lab:fsh'],
         'Estrogeno sustitutivo, que normaliza la masa osea y cierra el cartilago de crecimiento.',
         MILLER),

    cond('cond:def_5ar2', 'Deficit de 5α-reductasa tipo 2', '5α-reductase type 2 deficiency',
         'SRD5A2', 'enz:SRD5A2', AR,
         [('rx:t_dht', 0.05)],
         [('mol:dht', 'down2', True),
          ('mol:testosterona', 'flat', True,
           'El modelo predice un ascenso leve por represamiento. En la clinica la testosterona es '
           'normal o alta: lo diagnostico no es su valor absoluto sino la relacion '
           'testosterona / dihidrotestosterona.')],
         'Sin expresion clinica: la DHT no interviene en el desarrollo genital femenino.',
         'Genitales externos femeninos o ambiguos al nacer con estructuras wolffianas normales; en la '
         'pubertad se produce virilizacion por el ascenso de testosterona, con crecimiento del falo y '
         'cambio de la voz, sin desarrollo prostatico ni barba densa.',
         ['La relacion testosterona / dihidrotestosterona elevada tras estimulo con hCG es diagnostica',
          'Separa con claridad las acciones de testosterona y de DHT en el desarrollo'],
         ['lab:testosterona', 'lab:dht'],
         'Decision de sexo de crianza individualizada; DHT topica o sistemica en la infancia en casos '
         'seleccionados.',
         MILLER),

    cond('cond:def_17bhsd3', 'Deficit de 17β-hidroxiesteroide deshidrogenasa tipo 3',
         '17β-HSD type 3 deficiency', 'HSD17B3', 'enz:HSD17B3', AR,
         [('rx:a4_t', 0.08)],
         [('mol:testosterona', 'down2', True), ('mol:androstenediona', 'up2', True),
          ('mol:estrona', 'up', False), ('mol:dht', 'down2', False)],
         'Sin expresion clinica.',
         'Genitales externos femeninos al nacer en el 46,XY; virilizacion y a veces ginecomastia en la '
         'pubertad, cuando AKR1C3 periferica convierte la androstenediona acumulada.',
         ['La relacion androstenediona / testosterona tras hCG es la prueba clave',
          'Se distingue del deficit de 5α-reductasa por la testosterona baja, no normal'],
         ['lab:testosterona', 'lab:androstenediona'],
         'Gonadectomia y sustitucion hormonal, o sustitucion androgenica, segun el sexo de crianza.',
         MILLER),

    cond('cond:def_cyb5a', 'Deficit aislado de 17,20-liasa por deficit de citocromo b5',
         'Isolated 17,20-lyase deficiency', 'CYB5A', 'enz:CYB5A', AR,
         [('rx:17ohpreg_dhea', 0.05), ('rx:17ohprog_a4', 0.05), ('rx:17ohallo_androsterona', 0.05)],
         [('mol:dhea', 'down2', True), ('mol:androstenediona', 'down2', False),
          ('mol:testosterona', 'down2', True),
          ('mol:17oh_pregnenolona', 'up', False,
           'El modelo lo deja en rango porque el cortisol conservado frena la ACTH y baja todo el '
           'flujo. La acumulacion del sustrato inmediato de la liasa es, sin embargo, esperable.'),
          ('mol:cortisol', 'flat', False)],
         'Ausencia de vello sexual y de androgenos suprarrenales.',
         'Virilizacion incompleta con cortisol conservado: demuestra que las dos actividades de CYP17A1 '
         'se pueden separar.',
         ['La metahemoglobinemia acompana al deficit de citocromo b5',
          'El cortisol es normal porque la actividad hidroxilasa se conserva'],
         ['lab:dhea_s', 'lab:testosterona'],
         'Sustitucion androgenica en la pubertad.',
         MILLER),
]

# ------------------------------------------------------- bloqueos farmacologicos ---
DRUG_BLOCKS = [
    dict(id='cond:blq_abiraterona', drug='drug:abiraterona', enzyme='enz:CYP17A1',
         es='Bloqueo por abiraterona',
         blocks=[('rx:preg_17ohpreg', 0.1), ('rx:prog_17ohprog', 0.1), ('rx:17ohpreg_dhea', 0.05),
                 ('rx:17ohprog_a4', 0.05)],
         note='Inhibidor irreversible de CYP17A1. Frena a la vez la hidroxilasa y la liasa, de modo que '
              'suprime los androgenos suprarrenales y obliga a asociar un glucocorticoide para evitar el '
              'exceso de mineralocorticoides por acumulo de desoxicorticosterona.'),
    dict(id='cond:blq_finasterida', drug='drug:finasterida', enzyme='enz:SRD5A2',
         es='Bloqueo por finasterida',
         blocks=[('rx:t_dht', 0.15)],
         note='Inhibe sobre todo la 5α-reductasa tipo 2; la dutasterida inhibe ademas la tipo 1 y baja '
              'mas la DHT circulante.'),
    dict(id='cond:blq_letrozol', drug='drug:letrozol', enzyme='enz:CYP19A1',
         es='Bloqueo por inhibidor de aromatasa',
         blocks=[('rx:a4_e1', 0.02), ('rx:t_e2', 0.02), ('rx:16ohdhea_e3', 0.02)],
         note='Inhibidor no esteroideo competitivo. El exemestano, esteroideo, inactiva la enzima de '
              'forma irreversible.'),
    dict(id='cond:blq_metirapona', drug='drug:metirapona', enzyme='enz:CYP11B1',
         es='Bloqueo por metirapona',
         blocks=[('rx:s_cortisol', 0.1)],
         note='Acumula 11-desoxicortisol: es la base de la prueba clasica de reserva hipofisaria de ACTH.'),
    dict(id='cond:blq_ketoconazol', drug='drug:ketoconazol', enzyme='enz:CYP17A1',
         es='Bloqueo por ketoconazol',
         blocks=[('rx:col_preg', 0.4), ('rx:preg_17ohpreg', 0.3), ('rx:17ohpreg_dhea', 0.2),
                 ('rx:s_cortisol', 0.3)],
         note='Inhibidor poco selectivo de varios citocromos P450 esteroidogenicos; se usa para frenar '
              'el hipercortisolismo.'),
    dict(id='cond:blq_osilodrostat', drug='drug:osilodrostat', enzyme='enz:CYP11B1',
         es='Bloqueo por osilodrostat',
         blocks=[('rx:s_cortisol', 0.05), ('rx:b_18ohb', 0.2), ('rx:18ohb_aldo', 0.2)],
         note='Inhibe 11β-hidroxilasa y aldosterona sintasa; el acumulo de precursores con actividad '
              'mineralocorticoide puede causar hipopotasemia e hipertension.'),
]

# -------------------------------------------------------- disposicion del mapa ---
# Rejilla del esquema clasico: la serie Δ5 arriba, la Δ4 debajo, y a la derecha el
# grado de procesamiento (C21 -> C21 17-hidroxilado -> C19 -> C19 activado).
# Las ramas corticoide, estrogenica, 11-oxigenada y alternativa cuelgan de ahi.
LAYOUT = {
    'mol:colesterol': (0.0, -1.15),
    'mol:pregnenolona': (0.0, 0.0), 'mol:17oh_pregnenolona': (1.0, 0.0),
    'mol:dhea': (2.0, 0.0), 'mol:androstenediol': (3.0, 0.0),
    'mol:dhea_s': (2.0, -1.05), 'mol:16oh_dhea': (3.05, -1.05),
    'mol:progesterona': (0.0, 1.0), 'mol:17oh_progesterona': (1.0, 1.0),
    'mol:androstenediona': (2.0, 1.0), 'mol:testosterona': (3.0, 1.0),
    'mol:dht': (4.1, 1.45), 'mol:androstanodiona': (4.1, 0.55),
    'mol:estrona': (2.0, 2.05), 'mol:estradiol': (3.0, 2.05),
    'mol:estriol': (3.95, 2.6), 'mol:estrona_sulfato': (1.05, 2.35),
    'mol:doc': (-1.25, 1.75), 'mol:corticosterona': (-1.25, 2.5),
    'mol:18oh_corticosterona': (-1.25, 3.25), 'mol:aldosterona': (-1.25, 4.0),
    'mol:11_desoxicortisol': (0.15, 2.2), 'mol:cortisol': (0.15, 2.95),
    'mol:cortisona': (0.15, 3.7),
    'mol:11oh_androstenediona': (2.95, -2.0), 'mol:11ceto_testosterona': (3.95, -2.0),
    'mol:17oh_alopregnanolona': (1.25, 3.7), 'mol:androsterona': (2.3, 4.05),
    'mol:androstanodiol': (3.35, 4.05), 'mol:alopregnanolona': (-0.7, 3.7),
}

SERIES_GROUPS = [
    dict(id='grp:delta5', label='Serie Δ5', color='fam-precursor',
         description='Del colesterol a DHEA sin tocar el anillo A: es la ruta preferente de los '
                     'androgenos en el ser humano.'),
    dict(id='grp:delta4', label='Serie Δ4', color='fam-gestageno',
         description='La 3β-HSD oxida el 3β-hidroxilo e isomeriza el doble enlace: el esteroide pasa a '
                     'la serie activa.'),
    dict(id='grp:estrogeno', label='Estrogenos', color='fam-estrogeno',
         description='La aromatasa elimina el carbono 19 y convierte el anillo A en fenol.'),
    dict(id='grp:corticoide', label='Corticoides', color='fam-gluco',
         description='Rama exclusiva de la corteza suprarrenal, con 21-hidroxilasa y 11β-hidroxilasa.'),
    dict(id='grp:backdoor', label='Via alternativa', color='fam-androgeno', collapsed=True,
         description='Ruta que llega a DHT sin pasar por testosterona, con 5α-reduccion temprana.'),
    dict(id='grp:11oxo', label='Androgenos 11-oxigenados', color='fam-androgeno', collapsed=True,
         description='Androgenos potentes de origen suprarrenal, relevantes en hiperandrogenismo.'),
]


# ----------------------------------------------------------------- escritura ---
def enzyme_record(e):
    out = dict(id=e['id'], gene=e['gene'],
               names={'es': e['es'], 'en': e['en'], 'corto': e['corto']},
               family=e['family'], compartment=e['compartment'],
               activities=e['activities'], electronDonor=e.get('electronDonor'),
               note=e.get('note'), source=[PAYNE if e['family'] in ('SULT', 'STS') else MILLER])
    return out


def validate(molecule_ids):
    errors = []
    enzyme_ids = {e['id'] for e in ENZYMES}
    tissue_ids = {t['id'] for t in TISSUES}
    reaction_ids = {r['id'] for r in REACTIONS}

    for r in REACTIONS:
        for key in ('substrate', 'product'):
            if r[key] not in molecule_ids:
                errors.append('%s: %s desconocido %s' % (r['id'], key, r[key]))
        if r['enzyme'] not in enzyme_ids:
            errors.append('%s: enzima desconocida %s' % (r['id'], r['enzyme']))
        for alt in r['altEnzymes']:
            if alt not in enzyme_ids:
                errors.append('%s: enzima alternativa desconocida %s' % (r['id'], alt))
        for t in r['tissues']:
            if t not in tissue_ids:
                errors.append('%s: tejido desconocido %s' % (r['id'], t))
        if r['substrate'] not in LAYOUT or r['product'] not in LAYOUT:
            missing = [m for m in (r['substrate'], r['product']) if m not in LAYOUT]
            errors.append('%s: sin posicion en el mapa %s' % (r['id'], missing))

    for t in TISSUES:
        for e in t['expression']:
            if e['enzyme'] not in enzyme_ids:
                errors.append('%s: enzima desconocida %s' % (t['id'], e['enzyme']))
        for m in t['produces']:
            if m not in molecule_ids:
                errors.append('%s: molecula desconocida %s' % (t['id'], m))

    for c in CONDITIONS:
        if c['enzyme'] not in enzyme_ids:
            errors.append('%s: enzima desconocida %s' % (c['id'], c['enzyme']))
        for b in c['blocks']:
            if b['reaction'] not in reaction_ids:
                errors.append('%s: reaccion desconocida %s' % (c['id'], b['reaction']))
        for lv in c['expectedLevels']:
            if lv['mol'] not in molecule_ids:
                errors.append('%s: molecula desconocida %s' % (c['id'], lv['mol']))

    for d in DRUG_BLOCKS:
        for rid, _ in d['blocks']:
            if rid not in reaction_ids:
                errors.append('%s: reaccion desconocida %s' % (d['id'], rid))
    return errors


def main():
    import glob
    molecule_ids = set()
    for f in glob.glob(os.path.join(DATA, 'molecules', '*.json')):
        with open(f, encoding='utf-8') as fh:
            molecule_ids.add(json.load(fh)['id'])
    if not molecule_ids:
        print('Ejecuta antes tools/gen-molecules.py'); sys.exit(1)

    errors = validate(molecule_ids)
    if errors:
        print('El grafo no es coherente:')
        for e in errors:
            print('  ' + e)
        sys.exit(1)

    conditions = [dict(c) for c in CONDITIONS]
    for d in DRUG_BLOCKS:
        conditions.append(dict(
            id=d['id'], names={'es': d['es'], 'en': d['es'], 'corto': d['es']},
            kind='farmacologico', drug=d['drug'], enzyme=d['enzyme'], gene=None, inheritance=None,
            blocks=[dict(reaction=r, activity=a) for r, a in d['blocks']],
            expectedLevels=[], phenotype=None, labs=[], treatment=None, note=d['note'],
            source=[MILLER]))

    pathway = dict(
        id='path:esteroidogenesis',
        names={'es': 'Esteroidogenesis humana', 'en': 'Human steroidogenesis'},
        layout=[dict(mol=m, x=x, y=y) for m, (x, y) in LAYOUT.items()],
        groups=SERIES_GROUPS,
        source=[MILLER],
    )

    files = {
        'enzymes.json': [enzyme_record(e) for e in ENZYMES],
        'readings.json': READINGS,
        'reactions.json': REACTIONS,
        'tissues.json': TISSUES,
        'conditions.json': conditions,
        'pathway.json': pathway,
    }
    total = 0
    for name, payload in files.items():
        data = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
        with open(os.path.join(DATA, name), 'w', encoding='utf-8') as fh:
            fh.write(data)
        total += len(data.encode('utf-8'))
        n = len(payload) if isinstance(payload, list) else 1
        print('  %-18s %4d registros  %6.1f KB' % (name, n, len(data.encode('utf-8')) / 1024))
    print('\n  grafo coherente: %d enzimas, %d reacciones, %d tejidos, %d cuadros. %.1f KB'
          % (len(ENZYMES), len(REACTIONS), len(TISSUES), len(conditions), total / 1024))


if __name__ == '__main__':
    main()
