#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Interacciones, fichas farmacologicas, laboratorio, ciclo, elegibilidad y
preguntas de autoevaluacion.

Regla que sigue todo este archivo: ninguna cifra sin fuente. Donde no se ha
podido comprobar un valor numerico se describe el sentido del efecto en vez de
inventar un numero, y las curvas del ciclo son perfiles normalizados, no
concentraciones.
"""
import json, math, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'src', 'data')

PENDIENTE = ('Referencia transcrita sin acceso a la red desde el entorno de compilación; '
             'el identificador está pendiente de comprobación en línea.')

EXTRA_READINGS = [
    dict(id='read:sitrukware2004', kind='revision',
         citation='Sitruk-Ware R. Pharmacological profile of progestins. Maturitas. 2004;47(4):277-283.',
         doi='10.1016/j.maturitas.2004.01.001', verified=False, note=PENDIENTE,
         tags=['progestagenos', 'perfil de actividad'],
         summary='Perfil de actividad residual de los progestágenos sintéticos sobre los receptores '
                 'de andrógenos, glucocorticoides y mineralocorticoides.'),
    dict(id='read:stanczyk2013', kind='revision',
         citation='Stanczyk FZ, Archer DF, Bhavnani BR. Ethinyl estradiol and 17β-estradiol in '
                  'combined oral contraceptives: pharmacokinetics, pharmacodynamics and risk '
                  'assessment. Contraception. 2013;87(6):706-727.',
         doi='10.1016/j.contraception.2012.12.011', verified=False, note=PENDIENTE,
         tags=['anticoncepción', 'estrógenos', 'farmacocinética'],
         summary='Diferencias farmacológicas entre etinilestradiol y estradiol en la anticoncepción '
                 'combinada y su repercusión sobre el riesgo.'),
    dict(id='read:handelsman2020', kind='revision',
         citation='Handelsman DJ. Androgen physiology, pharmacology, use and misuse. En: Feingold KR '
                  'et al., eds. Endotext. South Dartmouth: MDText.com; 2020.',
         doi=None, verified=False, note=PENDIENTE,
         tags=['andrógenos', 'farmacología'],
         summary='Revisión de la farmacología de los andrógenos y sus preparados, con las '
                 'diferencias entre ésteres y vías de administración.'),
]

SPEROFF = 'read:speroff2020'
MILLER = 'read:miller2011'
SPEISER = 'read:speiser2018'
OMS = 'read:oms2015'
SITRUK = 'read:sitrukware2004'
STANCZYK = 'read:stanczyk2013'
HANDELSMAN = 'read:handelsman2020'
HALL = 'read:hall2020'
TURCU = 'read:turcu2015'

# --------------------------------------------------------------- interacciones ---
def ix(a, b, kind, mechanism, clinical=None, strength='media', direction='a->b', source=None):
    return dict(id='ix:%s_%s_%s' % (a.split(':')[1], b.split(':')[1], kind[:4]),
                a=a, b=b, kind=kind, mechanism=mechanism, clinical=clinical,
                strength=strength, direction=direction, source=[source or SPEROFF])

INTERACTIONS = [
    # Inhibicion enzimatica dirigida
    ix('drug:finasterida', 'enz:SRD5A2', 'inhibicion_enzimatica',
       'Inhibidor competitivo del enzima, con formación de un complejo practicamente irreversible.',
       'Reduce la dihidrotestosterona circulante y prostática sin bajar la testosterona; útil en '
       'hiperplasia benigna de próstata y alopecia androgénica.', 'alta', source=HANDELSMAN),
    ix('drug:dutasterida', 'enz:SRD5A2', 'inhibicion_enzimatica',
       'Inhibe las isoformas 1 y 2 de la 5α-reductasa.',
       'Baja la dihidrotestosterona más que la finasterida y tiene semivida muy larga.',
       'alta', source=HANDELSMAN),
    ix('drug:dutasterida', 'enz:SRD5A1', 'inhibicion_enzimatica',
       'Inhibe también la isoforma hepática y cutánea.', None, 'alta', source=HANDELSMAN),
    ix('drug:anastrozol', 'enz:CYP19A1', 'inhibicion_enzimatica',
       'Inhibidor no esteroideo competitivo del hemo de la aromatasa.',
       'Suprime el estradiol circulante en la posmenopausia; en la premenopausia el eje responde '
       'aumentando las gonadotropinas.', 'alta', source=SPEROFF),
    ix('drug:letrozol', 'enz:CYP19A1', 'inhibicion_enzimatica',
       'Inhibidor no esteroideo competitivo, más potente que el anastrozol in vitro.',
       'Además del uso oncológico se emplea para inducción de la ovulación.', 'alta', source=SPEROFF),
    ix('drug:exemestano', 'enz:CYP19A1', 'inhibicion_enzimatica',
       'Inhibidor esteroideo que inactiva la enzima de forma irreversible: es un sustrato suicida.',
       'No hay resistencia cruzada completa con los inhibidores no esteroideos.', 'alta', source=SPEROFF),
    ix('drug:abiraterona', 'enz:CYP17A1', 'inhibicion_enzimatica',
       'Inhibidor irreversible que bloquea a la vez la actividad 17α-hidroxilasa y la 17,20-liasa.',
       'Suprime los andrógenos suprarrenales y tumorales; obliga a asociar glucocorticoide para '
       'contener el exceso de mineralocorticoides.', 'alta', source=TURCU),
    ix('drug:ketoconazol', 'enz:CYP17A1', 'inhibicion_enzimatica',
       'Inhibición poco selectiva de varios citocromos P450 esteroidogénicos.',
       'Se usa para frenar el hipercortisolismo; exige vigilar la función hepática.', 'media',
       source=TURCU),
    ix('drug:ketoconazol', 'enz:CYP3A4', 'inhibicion_cyp',
       'Inhibidor potente de CYP3A4.',
       'Aumenta la exposición a los esteroides y fármacos metabolizados por esta vía.', 'alta',
       source=STANCZYK),
    ix('drug:metirapona', 'enz:CYP11B1', 'inhibicion_enzimatica',
       'Inhibe la 11β-hidroxilación y acumula 11-desoxicortisol.',
       'Base de la prueba de reserva hipofisaria de ACTH y tratamiento del hipercortisolismo.',
       'alta', source=TURCU),
    ix('drug:osilodrostat', 'enz:CYP11B1', 'inhibicion_enzimatica',
       'Inhibidor potente de la 11β-hidroxilasa.',
       'Normaliza el cortisol con rapidez; puede producir hipopotasemia e hipertensión por acumulo '
       'de precursores con actividad mineralocorticoide.', 'alta', source=TURCU),
    ix('drug:osilodrostat', 'enz:CYP11B2', 'inhibicion_enzimatica',
       'Inhibe también la aldosterona sintasa.', None, 'media', source=TURCU),

    # Metabolismo hepatico
    ix('drug:etinilestradiol', 'enz:CYP3A4', 'sustrato',
       'Se metaboliza sobre todo por hidroxilación mediada por CYP3A4 y por conjugación con '
       'circulación enterohepática.',
       'Los inductores de CYP3A4 reducen su exposición y pueden hacer fallar la anticoncepción.',
       'alta', source=STANCZYK),
    ix('drug:levonorgestrel', 'enz:CYP3A4', 'sustrato',
       'Metabolizado por CYP3A4.',
       'Con inductores enzimáticos se recomienda un método no dependiente de esa vía.', 'alta',
       source=STANCZYK),
    ix('drug:ulipristal_ac', 'enz:CYP3A4', 'sustrato',
       'Sustrato de CYP3A4.',
       'Los inductores reducen su eficacia como anticonceptivo de urgencia.', 'alta', source=STANCZYK),
    ix('mol:cortisol', 'enz:CYP3A4', 'sustrato',
       'Inactivación hepática por oxidación y conjugación.', None, 'media', source=MILLER),
    ix('drug:dexametasona', 'enz:CYP3A4', 'sustrato',
       'Sustrato e inductor debil de CYP3A4.', None, 'media', source=MILLER),

    # Desplazamiento y transporte
    ix('drug:etinilestradiol', 'enz:CYP19A1', 'otro',
       'No es sustrato de la aromatasa: el anillo A ya está aromatizado, y por eso su efecto no '
       'depende de esa enzima.', None, 'baja', source=STANCZYK),

    # Relaciones clinicas entre farmacos y hormonas
    ix('drug:espironolactona', 'mol:aldosterona', 'antagonismo',
       'Compite con la aldosterona por el receptor mineralocorticoide.',
       'Diuretico ahorrador de potasio; su actividad antiandrogénica se aprovecha en hirsutismo y '
       'acné, y explica la ginecomastia como efecto adverso.', 'alta', source=SPEROFF),
    ix('drug:drospirenona', 'mol:aldosterona', 'antagonismo',
       'Derivado de la espironolactona con actividad antimineralocorticoide.',
       'Reduce la retención hidrica; exige precaución con el potasio en insuficiencia renal o con '
       'otros fármacos hiperpotasemiantes.', 'media', source=SITRUK),
    ix('drug:mifepristona', 'mol:progesterona', 'antagonismo',
       'Antagonista competitivo del receptor de progesterona con afinidad superior a la de la '
       'hormona natural.',
       'Interrumpe la gestación al retirar el soporte de progesterona sobre la decidua.', 'alta',
       source=SPEROFF),
    ix('drug:tamoxifeno', 'mol:estradiol', 'modulacion_selectiva',
       'Compite con el estradiol por el receptor y actua como antagonista en mama y agonista '
       'parcial en endometrio y hueso.',
       'De ahi el beneficio en cáncer de mama y a la vez el aumento del riesgo de patología '
       'endometrial.', 'alta', source=SPEROFF),
    ix('drug:clomifeno', 'mol:estradiol', 'modulacion_selectiva',
       'Bloquea la retroalimentación negativa del estradiol en el hipotálamo.',
       'Aumenta las gonadotropinas endógenas y se usa para inducir la ovulación.', 'alta',
       source=SPEROFF),
    ix('drug:finasterida', 'mol:dht', 'inhibicion_enzimatica',
       'Reduce la formación de dihidrotestosterona a partir de testosterona.',
       'La testosterona se mantiene o sube ligeramente.', 'alta', direction='a->b', source=HANDELSMAN),
    ix('drug:enantato_testosterona', 'mol:testosterona', 'precursor',
       'Éster que se hidroliza a testosterona tras la inyección intramuscular.',
       'La esterificación prolonga la liberación y evita el primer paso hepático.', 'alta',
       source=HANDELSMAN),
    ix('drug:undecanoato_testosterona', 'mol:testosterona', 'precursor',
       'Éster de cadena larga con absorción linfática parcial.',
       'Permite intervalos de administración muy largos.', 'alta', source=HANDELSMAN),
    ix('drug:valerato_estradiol', 'mol:estradiol', 'precursor',
       'Éster que se hidroliza a estradiol.',
       'Aporta estradiol identico al endógeno, a diferencia del etinilestradiol.', 'alta',
       source=STANCZYK),
    ix('drug:tibolona', 'mol:estradiol', 'sinergia_clinica',
       'Sus metabolitos tienen actividad estrogénica, progestagénica y androgénica según el tejido.',
       'Alivia síntomas climatéricos sin estimular el endometrio, con efecto androgénico sobre la '
       'libido.', 'media', source=SPEROFF),
    ix('drug:mpa', 'mol:cortisol', 'sinergia_clinica',
       'Actividad glucocorticoide residual apreciable.',
       'A dosis altas puede producir efectos de tipo corticoideo y frenar el eje suprarrenal.',
       'media', source=SITRUK),
    ix('drug:ciproterona_ac', 'mol:testosterona', 'antagonismo',
       'Bloquea el receptor de andrógenos y además frena las gonadotropinas.',
       'Doble mecanismo antiandrogénico; vigilar la función hepática y el riesgo de meningioma con '
       'exposición acumulada alta.', 'alta', source=SPEROFF),
]

# ---------------------------------------------------------- fichas farmacologicas ---
PHARM = {
    'drug:etinilestradiol': dict(
        cls='Estrógeno sintético', mechanism=(
            'El grupo etinilo en el carbono 17 impide la oxidación por la 17β-HSD2 y multiplica la '
            'potencia y la semivida frente al estradiol. Ese mismo rasgo explica su fuerte efecto '
            'de primer paso hepático sobre SHBG, factores de coagulación y angiotensinogeno.'),
        indications=['Anticoncepción hormonal combinada', 'Control del ciclo en asociación con un progestágeno'],
        contraindications=['Antecedente de tromboembolismo venoso o trombofilia conocida',
                           'Migraña con aura', 'Hipertensión no controlada',
                           'Cáncer de mama actual', 'Hepatopatia grave activa',
                           'Lactancia en las primeras semanas posparto'],
        adverse=['Aumento del riesgo tromboembólico venoso y arterial', 'Nauseas y tensión mamaria',
                 'Sangrado intermenstrual', 'Elevación de la tensión arterial'],
        pk=dict(route=['oral', 'transdermica', 'vaginal'], halfLife='aproximadamente un día',
                metabolism='CYP3A4 y conjugación con circulación enterohepática',
                bioavailability='reducida y variable por el primer paso hepático'),
        source=[STANCZYK]),
    'drug:levonorgestrel': dict(
        cls='Progestágeno de segunda generación, derivado de la 19-nortestosterona', mechanism=(
            'Agonista potente del receptor de progesterona con actividad androgénica residual. '
            'Inhibe el pico de LH, espesa el moco cervical y adelgaza el endometrio.'),
        indications=['Anticoncepción combinada y de solo gestágeno', 'Anticoncepción de urgencia',
                     'Dispositivo intrauterino liberador', 'Menorragia'],
        contraindications=['Cáncer de mama actual', 'Hepatopatia grave activa',
                           'Sangrado genital no filiado'],
        adverse=['Sangrado irregular', 'Acné y seborrea por la actividad androgénica residual',
                 'Cefalea'],
        pk=dict(route=['oral', 'intrauterina', 'subdermica'], halfLife='alrededor de un día',
                metabolism='CYP3A4', bioavailability='alta por vía oral'),
        source=[SITRUK]),
    'drug:drospirenona': dict(
        cls='Progestágeno derivado de la espironolactona', mechanism=(
            'Agonista del receptor de progesterona con actividad antimineralocorticoide y '
            'antiandrogénica, sin actividad androgénica residual.'),
        indications=['Anticoncepción combinada', 'Sindrome premenstrual con retención hidrica',
                     'Acné asociado a anticoncepción'],
        contraindications=['Insuficiencia renal o suprarrenal', 'Riesgo de hiperpotasemia',
                           'Antecedente de tromboembolismo'],
        adverse=['Hiperpotasemia en pacientes de riesgo', 'Sangrado irregular'],
        pk=dict(route=['oral'], halfLife='alrededor de 30 horas', metabolism='CYP3A4 minoritario',
                bioavailability='alta'),
        source=[SITRUK]),
    'drug:ciproterona_ac': dict(
        cls='Antiandrógeno esteroideo con actividad progestagénica', mechanism=(
            'Bloquea el receptor de andrógenos y suprime las gonadotropinas, de modo que reduce a '
            'la vez la acción y la producción de andrógenos.'),
        indications=['Hirsutismo y acné graves', 'Hiperandrogenismo', 'Cáncer de próstata avanzado'],
        contraindications=['Hepatopatia', 'Meningioma actual o previo', 'Tromboembolismo'],
        adverse=['Hepatotoxicidad dosis dependiente', 'Meningioma con exposición acumulada alta',
                 'Pérdida de libido', 'Riesgo tromboembólico'],
        pk=dict(route=['oral'], halfLife='alrededor de dos días', metabolism='CYP3A4',
                bioavailability='alta'),
        source=[SPEROFF]),
    'drug:finasterida': dict(
        cls='Inhibidor de la 5α-reductasa tipo 2', mechanism=(
            'Reduce la conversión de testosterona en dihidrotestosterona en los tejidos que '
            'expresan la isoforma 2, sobre todo próstata y folículo piloso.'),
        indications=['Hiperplasia benigna de próstata', 'Alopecia androgénica'],
        contraindications=['Gestación y mujeres en edad fertil, por riesgo de feminización de un '
                           'feto varon'],
        adverse=['Disfunción erectil y pérdida de libido', 'Ginecomastia',
                 'Reducción del PSA a la mitad, que hay que tener en cuenta en el cribado'],
        pk=dict(route=['oral'], halfLife='de cinco a seis horas', metabolism='CYP3A4',
                bioavailability='alta'),
        source=[HANDELSMAN]),
    'drug:espironolactona': dict(
        cls='Antagonista del receptor mineralocorticoide con actividad antiandrogénica', mechanism=(
            'Compite con la aldosterona por su receptor y, de forma menos selectiva, con los '
            'andrógenos por el suyo; además reduce la síntesis de andrógenos.'),
        indications=['Insuficiencia cardiaca', 'Hiperaldosteronismo', 'Hirsutismo y acné',
                     'Terapia hormonal feminizante'],
        contraindications=['Hiperpotasemia', 'Insuficiencia renal avanzada', 'Gestación'],
        adverse=['Hiperpotasemia', 'Ginecomastia y mastalgia', 'Irregularidad menstrual'],
        pk=dict(route=['oral'], halfLife='corta, con metabolitos activos de vida larga',
                metabolism='hepático, con canrenona como metabolito activo', bioavailability='alta'),
        source=[SPEROFF]),
    'drug:tamoxifeno': dict(
        cls='Modulador selectivo del receptor de estrógenos', mechanism=(
            'Antagonista en la mama y agonista parcial en hueso, hígado y endometrio, según los '
            'coactivadores presentes en cada tejido.'),
        indications=['Cáncer de mama con receptor hormonal positivo', 'Prevención en alto riesgo'],
        contraindications=['Antecedente de tromboembolismo', 'Gestación'],
        adverse=['Sofocos', 'Hiperplasia y carcinoma de endometrio', 'Tromboembolismo venoso',
                 'Cataratas'],
        pk=dict(route=['oral'], halfLife='de cinco a siete días',
                metabolism='CYP2D6 a endoxifeno, el metabolito activo', bioavailability='alta'),
        source=[SPEROFF]),
    'drug:letrozol': dict(
        cls='Inhibidor no esteroideo de la aromatasa', mechanism=(
            'Bloquea de forma competitiva y reversible el hemo de la aromatasa y suprime la '
            'síntesis periférica de estrógenos.'),
        indications=['Cáncer de mama posmenopáusico con receptor positivo',
                     'Inducción de la ovulación'],
        contraindications=['Premenopausia sin supresión ovarica en la indicación oncológica',
                           'Gestación'],
        adverse=['Artralgias', 'Pérdida de masa ósea', 'Sofocos'],
        pk=dict(route=['oral'], halfLife='alrededor de dos días', metabolism='CYP3A4 y CYP2A6',
                bioavailability='alta'),
        source=[SPEROFF]),
    'drug:abiraterona': dict(
        cls='Inhibidor de CYP17A1', mechanism=(
            'Bloquea la síntesis de andrógenos en el testículo, la suprarrenal y el propio tumor. '
            'Al frenar también la 17α-hidroxilasa se acumulan precursores con actividad '
            'mineralocorticoide.'),
        indications=['Cáncer de próstata resistente a la castración',
                     'Cáncer de próstata hormonosensible de alto riesgo'],
        contraindications=['Insuficiencia hepática grave'],
        adverse=['Hipertensión, hipopotasemia y edema por exceso de mineralocorticoides',
                 'Hepatotoxicidad', 'Fatiga'],
        pk=dict(route=['oral'], halfLife='alrededor de 12 horas', metabolism='CYP3A4 y SULT2A1',
                bioavailability='muy dependiente de la comida'),
        source=[TURCU]),
    'drug:enantato_testosterona': dict(
        cls='Éster de testosterona de acción intermedia', mechanism=(
            'Se hidroliza a testosterona tras la inyección; la esterificación prolonga la '
            'liberación y evita el primer paso hepático.'),
        indications=['Hipogonadismo masculino', 'Terapia hormonal masculinizante'],
        contraindications=['Cáncer de próstata o de mama', 'Policitemia', 'Deseo de fertilidad'],
        adverse=['Policitemia', 'Acné', 'Supresión de la espermatogénesis',
                 'Fluctuación de los niveles entre inyecciones'],
        pk=dict(route=['intramuscular'], halfLife='de cuatro a cinco días',
                metabolism='hepático tras hidrolisis del éster', bioavailability='completa por vía parenteral'),
        source=[HANDELSMAN]),
}

# --------------------------------------------------------------------- laboratorio ---
def lab(lid, analyte, es, unit, ranges, interpretation, source):
    return dict(id=lid, analyte=analyte, names={'es': es, 'corto': es}, unit=unit,
                ranges=[dict(population=p, text=t) for p, t in ranges],
                interpretation=interpretation, source=[source])

LABS = [
    lab('lab:testosterona', 'mol:testosterona', 'Testosterona total', 'ng/dL', [
        ('Varon adulto', 'aproximadamente 300 a 1000'),
        ('Mujer adulta', 'aproximadamente 15 a 70'),
    ], ['Se mide por la mañana por el ritmo circadiano y se confirma con una segunda determinación.',
        'La SHBG condiciona la fracción libre: conviene medirla cuando el valor total no encaja con '
        'la clínica.',
        'Cifras muy altas en una mujer, por encima de unos 150 a 200 ng/dL, obligan a descartar un '
        'tumor productor.'], HANDELSMAN),
    lab('lab:dht', 'mol:dht', 'Dihidrotestosterona', 'ng/dL', [
        ('Varon adulto', 'una decima parte aproximadamente de la testosterona total'),
    ], ['Lo informativo es la relación testosterona / dihidrotestosterona, muy elevada en el déficit '
        'de 5α-reductasa tipo 2.'], MILLER),
    lab('lab:estradiol', 'mol:estradiol', 'Estradiol', 'pg/mL', [
        ('Fase folicular temprana', 'aproximadamente 20 a 80'),
        ('Pico preovulatorio', 'aproximadamente 150 a 400'),
        ('Fase lútea', 'aproximadamente 60 a 200'),
        ('Posmenopausia', 'por debajo de 20'),
    ], ['La interpretación depende del día del ciclo: sin ese dato el valor aislado dice poco.',
        'En la posmenopausia procede de la aromatización periférica, no del ovario.'], SPEROFF),
    lab('lab:progesterona', 'mol:progesterona', 'Progesterona', 'ng/mL', [
        ('Fase folicular', 'por debajo de 1'),
        ('Fase lútea media', 'por encima de 3 confirma que ha habido ovulación'),
    ], ['Se mide alrededor del septimo día tras la ovulación.'], SPEROFF),
    lab('lab:17ohp', 'mol:17oh_progesterona', '17α-hidroxiprogesterona', 'ng/dL', [
        ('Adulto basal', 'por debajo de unos 200'),
        ('Déficit clásico de 21-hidroxilasa', 'muy elevada, habitualmente por encima de 10 000'),
        ('Forma no clásica', 'basal intermedia; se confirma con prueba de estímulo con ACTH'),
    ], ['Se extrae por la mañana y, en la mujer, en fase folicular temprana.',
        'Es el analito del cribado neonatal de la hiperplasia suprarrenal congénita.'], SPEISER),
    lab('lab:11_desoxicortisol', 'mol:11_desoxicortisol', '11-desoxicortisol', 'ng/dL', [
        ('Basal', 'bajo'), ('Déficit de 11β-hidroxilasa', 'muy elevado'),
    ], ['Su acumulo, junto con el de desoxicorticosterona, distingue el déficit de 11β-hidroxilasa '
        'del de 21-hidroxilasa.'], TURCU),
    lab('lab:cortisol', 'mol:cortisol', 'Cortisol', 'µg/dL', [
        ('Basal matutino', 'aproximadamente 6 a 20'),
        ('Insuficiencia suprarrenal', 'basal bajo con respuesta insuficiente al estímulo'),
    ], ['El ritmo circadiano obliga a fijar la hora de extracción.',
        'La respuesta al estímulo informa más que el valor basal aislado.'], MILLER),
    lab('lab:aldosterona', 'mol:aldosterona', 'Aldosterona', 'ng/dL', [
        ('Adulto en bipedestación', 'variable según postura, sodio y postura previa'),
    ], ['Se interpreta siempre junto con la renina: el cociente aldosterona / renina es lo que '
        'orienta.'], MILLER),
    lab('lab:renina', None, 'Actividad de renina plasmática', 'ng/mL/h', [
        ('Adulto', 'depende de la postura y del aporte de sodio'),
    ], ['Elevada en el déficit de 21-hidroxilasa con pérdida salina.',
        'Suprimida cuando se acumulan precursores con actividad mineralocorticoide, como en el '
        'déficit de 11β-hidroxilasa.'], SPEISER),
    lab('lab:dhea_s', 'mol:dhea_s', 'Sulfato de DHEA', 'µg/dL', [
        ('Adulto joven', 'alto, con descenso progresivo con la edad'),
    ], ['Marcador de producción androgénica suprarrenal por su vida media larga.',
        'Muy elevado orienta a tumor suprarrenal; muy bajo, a insuficiencia suprarrenal o déficit '
        'de StAR.'], TURCU),
    lab('lab:androstenediona', 'mol:androstenediona', 'Androstenediona', 'ng/dL', [
        ('Mujer adulta', 'variable con el ciclo'),
    ], ['Sube en el déficit de 21-hidroxilasa y en el hiperandrogenismo ovárico.',
        'La relación androstenediona / testosterona tras estímulo con hCG orienta al déficit de '
        '17β-HSD3.'], SPEISER),
    lab('lab:17oh_pregnenolona', 'mol:17oh_pregnenolona', '17α-hidroxipregnenolona', 'ng/dL', [
        ('Basal', 'bajo'), ('Déficit de 3β-HSD2', 'muy elevada'),
    ], ['La relación 17-hidroxipregnenolona / 17-hidroxiprogesterona muy alta es la clave del '
        'déficit de 3β-HSD2.'], MILLER),
    lab('lab:fsh', None, 'FSH', 'UI/L', [
        ('Fase folicular', 'aproximadamente 3 a 10'),
        ('Posmenopausia', 'por encima de 25 a 30'),
    ], ['Elevada con estradiol bajo indica fallo gonadal primario.',
        'Baja o normal con estradiol bajo orienta a origen central.'], SPEROFF),
    lab('lab:lh', None, 'LH', 'UI/L', [
        ('Fase folicular', 'aproximadamente 2 a 10'), ('Pico ovulatorio', 'multiplica varias veces el basal'),
    ], ['El cociente LH/FSH elevado se ha usado como apoyo, no como criterio, en el sindrome de '
        'ovario poliquistico.'], SPEROFF),
    lab('lab:potasio', None, 'Potasio', 'mEq/L', [
        ('Adulto', 'aproximadamente 3,5 a 5,0'),
    ], ['Alto en el déficit de 21-hidroxilasa con pérdida salina.',
        'Bajo cuando hay exceso de mineralocorticoides.'], SPEISER),
    lab('lab:shbg', None, 'Globulina transportadora de hormonas sexuales', 'nmol/L', [
        ('Adulto', 'variable; sube con estrógeno oral e hipertiroidismo, baja con andrógenos, '
                   'obesidad e hiperinsulinismo'),
    ], ['Sin su valor no se puede interpretar bien una testosterona total en el limite.'], HANDELSMAN),
]

# ------------------------------------------------------------------ ciclo ovarico ---
def gauss(x, mu, sigma):
    return math.exp(-((x - mu) ** 2) / (2 * sigma * sigma))


def cycle_curves():
    """Perfiles normalizados de 0 a 1 a lo largo de 28 dias. No son
    concentraciones: describen la forma de cada curva y su relacion temporal, que
    es lo que hay que aprender."""
    days = list(range(1, 29))
    out = {}
    # Estradiol: ascenso folicular con pico preovulatorio y meseta lutea.
    out['estradiol'] = [round(min(1, 0.08 + 0.92 * gauss(d, 12.5, 2.1) + 0.34 * gauss(d, 21, 4.2)), 3) for d in days]
    # LH: pico estrecho el dia 13-14.
    out['lh'] = [round(min(1, 0.09 + 0.95 * gauss(d, 13.5, 0.85)), 3) for d in days]
    # FSH: elevacion interciclo y pequeno repunte periovulatorio.
    out['fsh'] = [round(min(1, 0.30 * gauss(d, 2.5, 2.6) + 0.42 * gauss(d, 13.5, 1.2) + 0.16), 3) for d in days]
    # Progesterona: practicamente nula hasta la ovulacion, meseta lutea.
    out['progesterona'] = [round(min(1, 0.03 + 0.95 * gauss(d, 21.5, 3.6)), 3) for d in days]
    # Inhibina B folicular e inhibina A lutea.
    out['inhibina_b'] = [round(min(1, 0.15 + 0.7 * gauss(d, 8, 4.0)), 3) for d in days]
    out['inhibina_a'] = [round(min(1, 0.05 + 0.85 * gauss(d, 22, 4.0)), 3) for d in days]
    # Grosor endometrial: crece en la fase proliferativa y se mantiene en la secretora.
    out['endometrio'] = [round(min(1, 0.12 + 0.72 * min(1, max(0, (d - 4) / 12)) + 0.18 * gauss(d, 22, 5)), 3) for d in days]
    # Diametro folicular hasta la ovulacion y luego cuerpo luteo.
    out['foliculo'] = [round(min(1, 0.15 + 0.8 * min(1, max(0, (d - 3) / 11)) * (1 if d <= 14 else 0)
                                 + (0.55 * gauss(d, 21, 4.5) if d > 14 else 0)), 3) for d in days]
    return out


CYCLE = dict(
    id='cycle:ovarico',
    names={'es': 'Ciclo ovárico y endometrial', 'en': 'Ovarian and endometrial cycle'},
    days=28, ovulation=14,
    note=('Perfiles normalizados de 0 a 1: representan la forma de cada curva y su relación '
          'temporal, no concentraciones absolutas. Las cifras de referencia están en el modulo de '
          'laboratorio.'),
    phases=[
        dict(id='menstrual', label='Menstrual', from_=1, to=5,
             text='Caida de estradiol y progesterona tras la luteolisis: se descama el endometrio. '
                  'La FSH empieza a subir y recluta la nueva cohorte folicular.'),
        dict(id='folicular', label='Folicular', from_=6, to=13,
             text='El folículo dominante fabrica estradiol en cantidad creciente. La teca aporta '
                  'andrógenos y la granulosa los aromatiza. El estradiol prolifera el endometrio y '
                  'frena la FSH, lo que condena al resto de la cohorte.'),
        dict(id='ovulacion', label='Ovulación', from_=14, to=15,
             text='El estradiol sostenido por encima de un umbral invierte la retroalimentación: '
                  'la hipófisis responde con el pico de LH y el folículo se rompe.'),
        dict(id='lutea', label='Lútea', from_=16, to=28,
             text='El cuerpo lúteo produce progesterona, que transforma el endometrio en secretor y '
                  'enlentece los pulsos de GnRH. Sin gestación, la luteolisis retira el soporte y '
                  'el ciclo vuelve a empezar.'),
    ],
    series=[
        dict(id='estradiol', label='Estradiol', color='fam-estrogeno', mol='mol:estradiol'),
        dict(id='progesterona', label='Progesterona', color='fam-gestageno', mol='mol:progesterona'),
        dict(id='lh', label='LH', color='accent', mol=None),
        dict(id='fsh', label='FSH', color='enz-sulf', mol=None),
        dict(id='inhibina_b', label='Inhibina B', color='ink-3', mol=None),
        dict(id='inhibina_a', label='Inhibina A', color='ring-side', mol=None),
        dict(id='endometrio', label='Grosor endometrial', color='fam-farmaco', mol=None),
        dict(id='foliculo', label='Folículo y cuerpo lúteo', color='enz-red', mol=None),
    ],
    tissuesByDay=[
        dict(from_=1, to=5, tissues=[]),
        dict(from_=6, to=13, tissues=['tis:teca', 'tis:granulosa']),
        dict(from_=14, to=15, tissues=['tis:teca', 'tis:granulosa']),
        dict(from_=16, to=28, tissues=['tis:cuerpo_luteo']),
    ],
    source=[SPEROFF],
)

# ------------------------------------------------------------- elegibilidad OMS ---
def elig(method, condition, category, note=None):
    key = (method + '_' + condition).lower()
    for ch, rep in [(' ', '_'), (',', ''), ('(', ''), (')', ''), ('a', 'a'), ('e', 'e'),
                    ('i', 'i'), ('o', 'o'), ('u', 'u'), ('n', 'n'), ('/', '_'), ('<', 'lt'),
                    ('>', 'gt'), ('.', ''), ('-', '_'), ('+', 'mas')]:
        key = key.replace(ch, rep)
    return dict(id='elig:' + key[:60], method=method, condition=condition,
                category=category, note=note, source=[OMS])

ELIGIBILITY = [
    elig('Combinado (píldora, parche, anillo)', 'Migraña con aura, cualquier edad', 4,
         'El riesgo de ictus isquemico es el motivo del veto absoluto.'),
    elig('Combinado (píldora, parche, anillo)', 'Migraña sin aura, 35 años o más', 3,
         'Categoría 2 si es menor de 35 años.'),
    elig('Combinado (píldora, parche, anillo)', 'Tabaquismo, 35 años o más, 15 o más cigarrillos al día', 4),
    elig('Combinado (píldora, parche, anillo)', 'Tabaquismo, 35 años o más, menos de 15 cigarrillos al día', 3),
    elig('Combinado (píldora, parche, anillo)', 'Antecedente de tromboembolismo venoso', 4),
    elig('Combinado (píldora, parche, anillo)', 'Trombofilia conocida', 4),
    elig('Combinado (píldora, parche, anillo)', 'Hipertensión con cifras iguales o mayores de 160/100', 4),
    elig('Combinado (píldora, parche, anillo)', 'Hipertensión bien controlada', 3),
    elig('Combinado (píldora, parche, anillo)', 'Lactancia, menos de 6 semanas posparto', 4),
    elig('Combinado (píldora, parche, anillo)', 'Lactancia, de 6 semanas a 6 meses posparto', 3),
    elig('Combinado (píldora, parche, anillo)', 'Cáncer de mama actual', 4),
    elig('Combinado (píldora, parche, anillo)', 'Cáncer de mama pasado y sin recidiva en 5 años', 3),
    elig('Combinado (píldora, parche, anillo)', 'Diabetes con nefropatía, retinopatía o neuropatía', 3,
         'Puede llegar a 4 según la gravedad y la duración.'),
    elig('Combinado (píldora, parche, anillo)', 'Cirrosis descompensada', 4),
    elig('Combinado (píldora, parche, anillo)', 'Lupus con anticuerpos antifosfolípido positivos', 4),
    elig('Combinado (píldora, parche, anillo)', 'Obesidad con índice de masa corporal de 30 o más', 2),
    elig('Combinado (píldora, parche, anillo)', 'Endometriosis', 1),
    elig('Solo gestágeno (píldora)', 'Cáncer de mama actual', 4),
    elig('Solo gestágeno (píldora)', 'Antecedente de tromboembolismo venoso', 2),
    elig('Solo gestágeno (píldora)', 'Migraña con aura', 2,
         'Categoría 3 para continuar si la migraña con aura aparece durante el uso.'),
    elig('Solo gestágeno (píldora)', 'Lactancia, menos de 6 semanas posparto', 2),
    elig('Solo gestágeno (píldora)', 'Hipertensión grave', 2),
    elig('Inyectable de gestágeno (acetato de medroxiprogesterona)', 'Menos de 18 años', 2,
         'Por el efecto sobre la masa ósea en un período de acumulación.'),
    elig('Inyectable de gestágeno (acetato de medroxiprogesterona)', 'Múltiples factores de riesgo cardiovascular', 3),
    elig('Inyectable de gestágeno (acetato de medroxiprogesterona)', 'Cáncer de mama actual', 4),
    elig('Implante subdérmico (etonogestrel)', 'Cáncer de mama actual', 4),
    elig('Implante subdérmico (etonogestrel)', 'Antecedente de tromboembolismo venoso', 2),
    elig('Implante subdérmico (etonogestrel)', 'Uso de inductores enzimáticos potentes', 2),
    elig('DIU de levonorgestrel', 'Cáncer de mama actual', 4),
    elig('DIU de levonorgestrel', 'Sepsis puerperal', 4),
    elig('DIU de levonorgestrel', 'Enfermedad trofoblástica gestacional maligna', 4),
    elig('DIU de levonorgestrel', 'Miomas sin distorsión de la cavidad', 1),
    elig('DIU de cobre', 'Sangrado uterino no filiado antes de estudiarlo', 4,
         'Categoría 2 para continuar una vez estudiado.'),
    elig('DIU de cobre', 'Anemia ferropénica', 2),
    elig('DIU de cobre', 'Cáncer de mama actual', 1,
         'No contiene hormonas, de ahi la diferencia con el DIU de levonorgestrel.'),
]

# ---------------------------------------------------------------- autoevaluacion ---
def q(qid, module, stem, options, answer, explanation, links, difficulty=2, source=None):
    return dict(id=qid, module=module, stem=stem, options=options, answer=answer,
                explanation=explanation, links=links, difficulty=difficulty,
                source=[source] if source else [])

QUESTIONS = [
    q('q:0001', 'esteroidogenesis',
      '¿Qué paso limita la velocidad de toda la esteroidogénesis?',
      ['La 21-hidroxilación por CYP21A2',
       'El transporte de colesterol a la membrana mitocondrial interna por StAR',
       'La aromatización por CYP19A1',
       'La oxidación del 3β-hidroxilo por la 3β-HSD'], 1,
      'El paso limitante no es enzimático: es la llegada del colesterol al lugar donde trabaja '
      'CYP11A1. Por eso las hormonas troficas actuan en minutos sobre StAR.',
      ['enz:StAR', 'rx:col_preg'], 1, MILLER),
    q('q:0002', 'esteroidogenesis',
      '¿Por qué la zona glomerular de la suprarrenal no puede fabricar cortisol?',
      ['Le falta la 21-hidroxilasa', 'Le falta CYP17A1 y no puede hidroxilar en el carbono 17',
       'Le falta la 3β-HSD', 'Le falta la aldosterona sintasa'], 1,
      'Sin CYP17A1 la vía no puede llegar a 17-hidroxiprogesterona, que es el precursor obligado '
      'del cortisol. A cambio, es la única zona con aldosterona sintasa.',
      ['tis:glomerulosa', 'enz:CYP17A1'], 2, MILLER),
    q('q:0003', 'esteroidogenesis',
      '¿En el déficit clásico de 21-hidroxilasa, que explica la virilización?',
      ['La 21-hidroxilasa fabrica andrógenos directamente',
       'El flujo represado se desvía hacia la única salida libre, la vía androgénica',
       'El cortisol bajo estimula el ovario', 'La aldosterona baja aumenta la testosterona'], 1,
      'Al bloquear la salida hacia cortisol y aldosterona, la 17-hidroxiprogesterona se acumula y '
      'el exceso encuentra su única salida por la 17,20-liasa hacia androstenediona.',
      ['cond:def_21oh', 'rx:17ohprog_a4'], 2, SPEISER),
    q('q:0004', 'esteroidogenesis',
      '¿Qué distingue el déficit de 11β-hidroxilasa del de 21-hidroxilasa?',
      ['La virilización, que solo aparece en el de 11β',
       'La hipertensión por acumulo de desoxicorticosterona en vez de pérdida salina',
       'El cortisol, que es normal en el de 11β', 'La herencia, que es dominante en el de 11β'], 1,
      'Los dos virilizan, pero en el déficit de 11β-hidroxilasa se acumula desoxicorticosterona, '
      'que tiene actividad mineralocorticoide: hay hipertensión e hipopotasemia con renina baja.',
      ['cond:def_11boh', 'mol:doc'], 2, TURCU),
    q('q:0005', 'esteroidogenesis',
      '¿Qué enzima convierte un andrógeno en un estrógeno?',
      ['La 17β-HSD1', 'La 5α-reductasa tipo 2', 'La aromatasa CYP19A1', 'La 3β-HSD2'], 2,
      'La aromatasa elimina el carbono 19 y convierte el anillo A en un fenol aromático. Es el '
      'único paso que cambia de familia hormonal.',
      ['enz:CYP19A1', 'rx:t_e2'], 1, MILLER),
    q('q:0006', 'esteroidogenesis',
      '¿En la teoria de las dos células del folículo ovárico, que aporta la granulosa?',
      ['CYP17A1 para fabricar andrógenos', 'Aromatasa para convertir los andrógenos en estrógenos',
       'StAR para transportar colesterol', '21-hidroxilasa'], 1,
      'La teca tiene CYP17A1 pero no aromatasa; la granulosa, al reves. Ninguna de las dos produce '
      'estradiol por si sola.', ['tis:teca', 'tis:granulosa'], 2, SPEROFF),
    q('q:0007', 'esteroidogenesis',
      '¿Qué hace el citocromo b5 sobre CYP17A1?',
      ['Le cede electrones para la hidroxilación', 'Potencia su actividad 17,20-liasa',
       'La inhibe de forma competitiva', 'La transporta al retículo'], 1,
      'El citocromo b5 no aporta electrones: actua como modulador alostérico y desplaza la enzima '
      'hacia la actividad liasa. Es lo que diferencia la zona reticular de la fasciculada.',
      ['enz:CYB5A', 'tis:reticular'], 3, MILLER),
    q('q:0008', 'organos',
      'Una persona 46,XY con déficit de 5α-reductasa tipo 2 presenta al nacer',
      ['Genitales masculinos normales', 'Genitales externos femeninos o ambiguos con estructuras '
       'wolffianas normales', 'Ausencia de testículos', 'Genitales femeninos con útero'], 1,
      'La testosterona mantiene los conductos de Wolff, pero la virilización de los genitales '
      'externos depende de la dihidrotestosterona. En la pubertad se viriliza por el ascenso de '
      'testosterona.', ['cond:def_5ar2', 'org:genitales_externos'], 2, MILLER),
    q('q:0009', 'organos',
      '¿Qué demuestra el déficit de aromatasa en el varon?',
      ['Que la testosterona cierra el cartílago de crecimiento',
       'Que el cierre epifisario depende del estrógeno también en el varon',
       'Que el estrógeno no interviene en el hueso masculino',
       'Que la hormona de crecimiento es prescindible'], 1,
      'Los varones con déficit de aromatasa o con receptor de estrógenos no funcionante tienen '
      'talla alta con epifisis abiertas y osteoporosis, y el estrógeno sustitutivo lo corrige.',
      ['cond:def_aromatasa', 'org:hueso'], 2, MILLER),
    q('q:0010', 'farmacos',
      '¿Por qué la abiraterona se administra junto con un glucocorticoide?',
      ['Para evitar náuseas', 'Para contener el exceso de mineralocorticoides que produce el bloqueo '
       'de la 17α-hidroxilasa', 'Para potenciar su efecto antitumoral', 'Para proteger el hígado'], 1,
      'Al bloquear CYP17A1 sube la ACTH y se acumulan precursores con actividad mineralocorticoide, '
      'con hipertensión, hipopotasemia y edema. El glucocorticoide frena la ACTH.',
      ['drug:abiraterona', 'enz:CYP17A1'], 2, TURCU),
    q('q:0011', 'farmacos',
      '¿Qué diferencia farmacológica explica la potencia del etinilestradiol frente al estradiol?',
      ['Su mayor afinidad por el receptor de progesterona',
       'El grupo etinilo en el carbono 17, que impide su oxidación por la 17β-HSD2',
       'Su unión a la SHBG', 'Su metabolismo renal'], 1,
      'El etinilo bloquea la inactivación en la posición 17 y prolonga mucho la semivida, con un '
      'efecto hepático de primer paso muy marcado.',
      ['drug:etinilestradiol', 'enz:HSD17B2'], 2, STANCZYK),
    q('q:0012', 'farmacos',
      '¿Qué progestágeno tiene actividad antimineralocorticoide?',
      ['Levonorgestrel', 'Noretisterona', 'Drospirenona', 'Acetato de medroxiprogesterona'], 2,
      'La drospirenona deriva de la espironolactona y conserva su antagonismo del receptor '
      'mineralocorticoide, además de ser antiandrogénica.',
      ['drug:drospirenona', 'rec:MR'], 2, SITRUK),
    q('q:0013', 'elegibilidad',
      '¿Qué categoría de la OMS corresponde al anticonceptivo combinado en una mujer con migraña con aura?',
      ['Categoría 1', 'Categoría 2', 'Categoría 3', 'Categoría 4'], 3,
      'Es categoría 4, es decir, riesgo inaceptable, por el aumento del riesgo de ictus isquemico. '
      'Los métodos de solo gestágeno son una alternativa.', [], 2, OMS),
    q('q:0014', 'ciclo',
      '¿Qué desencadena el pico ovulatorio de LH?',
      ['La caida de la progesterona', 'El estradiol sostenido por encima de un umbral, que invierte '
       'la retroalimentación a positiva', 'El ascenso de la FSH', 'La inhibina B'], 1,
      'Es el único momento del ciclo en que el estradiol estimula en vez de frenar. Requiere una '
      'concentración mantenida durante alrededor de dos días.', ['mol:estradiol'], 2, SPEROFF),
    q('q:0015', 'ciclo',
      '¿Qué confirma que ha habido ovulación en un ciclo?',
      ['Un estradiol elevado en fase folicular', 'Una progesterona en fase lútea media por encima '
       'de 3 ng/mL', 'Una LH basal elevada', 'Un grosor endometrial de 8 mm'], 1,
      'La progesterona solo la produce el cuerpo lúteo, que solo existe si ha habido ovulación.',
      ['lab:progesterona'], 1, SPEROFF),
    q('q:0016', 'laboratorio',
      '¿Qué relación analítica orienta al déficit de 3β-HSD2?',
      ['Testosterona / dihidrotestosterona', '17-hidroxipregnenolona / 17-hidroxiprogesterona',
       'Aldosterona / renina', 'Androstenediona / testosterona'], 1,
      'El bloqueo impide pasar de la serie Δ5 a la Δ4, de modo que se acumulan los precursores Δ5 '
      'con respecto a sus equivalentes Δ4.', ['cond:def_3bhsd', 'lab:17oh_pregnenolona'], 3, MILLER),
    q('q:0017', 'atlas',
      '¿Qué cambio estructural convierte la testosterona en dihidrotestosterona?',
      ['La aromatización del anillo A', 'La reducción del doble enlace Δ4 del anillo A',
       'La hidroxilación en el carbono 17', 'La pérdida del carbono 19'], 1,
      'La 5α-reductasa satura el doble enlace entre los carbonos 4 y 5. La composición apenas '
      'cambia, pero la afinidad por el receptor y la duracion del efecto suben mucho.',
      ['rx:t_dht', 'mol:dht'], 1, MILLER),
    q('q:0018', 'atlas',
      '¿Qué tienen en comun todos los estrógenos naturales?',
      ['Un grupo cetona en el carbono 3', 'Un anillo A aromático y ausencia del carbono 19',
       'Una cadena lateral de dos carbonos en el 17', 'Un doble enlace Δ4'], 1,
      'La aromatización del anillo A obliga a perder el metilo del carbono 19 y convierte el '
      'hidroxilo del carbono 3 en fenol.', ['mol:estradiol', 'enz:CYP19A1'], 1, MILLER),
    q('q:0019', 'esteroidogenesis',
      '¿De donde procede el estriol que se mide en la gestación?',
      ['Del ovario materno', 'De la unidad fetoplacentaria, a partir de precursores 16α-hidroxilados '
       'de origen fetal', 'Del hígado materno', 'De la suprarrenal materna en exclusiva'], 1,
      'La placenta no tiene CYP17A1 y depende del sulfato de DHEA fetal, que el hígado del feto '
      '16α-hidroxila; la placenta lo desulfata y lo aromatiza.',
      ['rx:16ohdhea_e3', 'tis:sincitiotrofoblasto'], 3, MILLER),
    q('q:0020', 'farmacos',
      '¿Qué ocurre con la espermatogénesis al administrar testosterona exógena?',
      ['Mejora, por el aporte de sustrato', 'Se suprime, porque cae la concentración '
       'intratesticular al frenarse la LH', 'No se modifica', 'Solo se afecta con dosis muy altas'], 1,
      'La espermatogénesis necesita concentraciones intratesticulares muy superiores a las '
      'plasmáticas, que solo mantiene la producción propia estimulada por LH.',
      ['org:testiculo', 'drug:enantato_testosterona'], 2, HANDELSMAN),
]


def main():
    # Las fichas farmacologicas se incorporan a la molecula correspondiente.
    folder = os.path.join(DATA, 'molecules')
    applied = 0
    for name in os.listdir(folder):
        if not name.endswith('.json'):
            continue
        path = os.path.join(folder, name)
        with open(path, encoding='utf-8') as fh:
            rec = json.load(fh)
        sheet = PHARM.get(rec['id'])
        if not sheet:
            continue
        rec['pharm'] = dict(**{'class': sheet['cls']}, mechanism=sheet['mechanism'],
                            indications=sheet['indications'],
                            contraindications=sheet['contraindications'],
                            adverse=sheet['adverse'], pk=sheet['pk'], source=sheet['source'])
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(json.dumps(rec, ensure_ascii=False, separators=(',', ':')))
        applied += 1

    curves = cycle_curves()
    cycle = dict(CYCLE)
    cycle['curves'] = curves
    cycle['phases'] = [dict(id=p['id'], label=p['label'], from_=p['from_'], to=p['to'], text=p['text'])
                       for p in CYCLE['phases']]
    cycle['tissuesByDay'] = [dict(from_=t['from_'], to=t['to'], tissues=t['tissues'])
                             for t in CYCLE['tissuesByDay']]

    files = {
        'interactions.json': INTERACTIONS,
        'labs.json': LABS,
        'eligibility.json': ELIGIBILITY,
        'questions.json': QUESTIONS,
        'cycle.json': cycle,
    }
    for name, payload in files.items():
        data = json.dumps(payload, ensure_ascii=False, separators=(',', ':'))
        with open(os.path.join(DATA, name), 'w', encoding='utf-8') as fh:
            fh.write(data)
        n = len(payload) if isinstance(payload, list) else 1
        print('  %-20s %4d registros  %6.1f KB' % (name, n, len(data.encode('utf-8')) / 1024))

    path = os.path.join(DATA, 'readings.json')
    with open(path, encoding='utf-8') as fh:
        readings = json.load(fh)
    known = {r['id'] for r in readings}
    for r in EXTRA_READINGS:
        if r['id'] not in known:
            readings.append(r)
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(readings, ensure_ascii=False, separators=(',', ':')))
    print('  %d fichas farmacológicas incorporadas, %d lecturas' % (applied, len(readings)))


if __name__ == '__main__':
    main()
