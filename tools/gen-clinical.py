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

PENDIENTE = ('Referencia transcrita sin acceso a la red desde el entorno de compilacion; '
             'el identificador esta pendiente de comprobacion en linea.')

EXTRA_READINGS = [
    dict(id='read:sitrukware2004', kind='revision',
         citation='Sitruk-Ware R. Pharmacological profile of progestins. Maturitas. 2004;47(4):277-283.',
         doi='10.1016/j.maturitas.2004.01.001', verified=False, note=PENDIENTE,
         tags=['progestagenos', 'perfil de actividad'],
         summary='Perfil de actividad residual de los progestagenos sinteticos sobre los receptores '
                 'de androgenos, glucocorticoides y mineralocorticoides.'),
    dict(id='read:stanczyk2013', kind='revision',
         citation='Stanczyk FZ, Archer DF, Bhavnani BR. Ethinyl estradiol and 17β-estradiol in '
                  'combined oral contraceptives: pharmacokinetics, pharmacodynamics and risk '
                  'assessment. Contraception. 2013;87(6):706-727.',
         doi='10.1016/j.contraception.2012.12.011', verified=False, note=PENDIENTE,
         tags=['anticoncepcion', 'estrogenos', 'farmacocinetica'],
         summary='Diferencias farmacologicas entre etinilestradiol y estradiol en la anticoncepcion '
                 'combinada y su repercusion sobre el riesgo.'),
    dict(id='read:handelsman2020', kind='revision',
         citation='Handelsman DJ. Androgen physiology, pharmacology, use and misuse. En: Feingold KR '
                  'et al., eds. Endotext. South Dartmouth: MDText.com; 2020.',
         doi=None, verified=False, note=PENDIENTE,
         tags=['androgenos', 'farmacologia'],
         summary='Revision de la farmacologia de los androgenos y sus preparados, con las '
                 'diferencias entre esteres y vias de administracion.'),
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
       'Inhibidor competitivo del enzima, con formacion de un complejo practicamente irreversible.',
       'Reduce la dihidrotestosterona circulante y prostatica sin bajar la testosterona; util en '
       'hiperplasia benigna de prostata y alopecia androgenica.', 'alta', source=HANDELSMAN),
    ix('drug:dutasterida', 'enz:SRD5A2', 'inhibicion_enzimatica',
       'Inhibe las isoformas 1 y 2 de la 5α-reductasa.',
       'Baja la dihidrotestosterona mas que la finasterida y tiene semivida muy larga.',
       'alta', source=HANDELSMAN),
    ix('drug:dutasterida', 'enz:SRD5A1', 'inhibicion_enzimatica',
       'Inhibe tambien la isoforma hepatica y cutanea.', None, 'alta', source=HANDELSMAN),
    ix('drug:anastrozol', 'enz:CYP19A1', 'inhibicion_enzimatica',
       'Inhibidor no esteroideo competitivo del hemo de la aromatasa.',
       'Suprime el estradiol circulante en la posmenopausia; en la premenopausia el eje responde '
       'aumentando las gonadotropinas.', 'alta', source=SPEROFF),
    ix('drug:letrozol', 'enz:CYP19A1', 'inhibicion_enzimatica',
       'Inhibidor no esteroideo competitivo, mas potente que el anastrozol in vitro.',
       'Ademas del uso oncologico se emplea para induccion de la ovulacion.', 'alta', source=SPEROFF),
    ix('drug:exemestano', 'enz:CYP19A1', 'inhibicion_enzimatica',
       'Inhibidor esteroideo que inactiva la enzima de forma irreversible: es un sustrato suicida.',
       'No hay resistencia cruzada completa con los inhibidores no esteroideos.', 'alta', source=SPEROFF),
    ix('drug:abiraterona', 'enz:CYP17A1', 'inhibicion_enzimatica',
       'Inhibidor irreversible que bloquea a la vez la actividad 17α-hidroxilasa y la 17,20-liasa.',
       'Suprime los androgenos suprarrenales y tumorales; obliga a asociar glucocorticoide para '
       'contener el exceso de mineralocorticoides.', 'alta', source=TURCU),
    ix('drug:ketoconazol', 'enz:CYP17A1', 'inhibicion_enzimatica',
       'Inhibicion poco selectiva de varios citocromos P450 esteroidogenicos.',
       'Se usa para frenar el hipercortisolismo; exige vigilar la funcion hepatica.', 'media',
       source=TURCU),
    ix('drug:ketoconazol', 'enz:CYP3A4', 'inhibicion_cyp',
       'Inhibidor potente de CYP3A4.',
       'Aumenta la exposicion a los esteroides y farmacos metabolizados por esta via.', 'alta',
       source=STANCZYK),
    ix('drug:metirapona', 'enz:CYP11B1', 'inhibicion_enzimatica',
       'Inhibe la 11β-hidroxilacion y acumula 11-desoxicortisol.',
       'Base de la prueba de reserva hipofisaria de ACTH y tratamiento del hipercortisolismo.',
       'alta', source=TURCU),
    ix('drug:osilodrostat', 'enz:CYP11B1', 'inhibicion_enzimatica',
       'Inhibidor potente de la 11β-hidroxilasa.',
       'Normaliza el cortisol con rapidez; puede producir hipopotasemia e hipertension por acumulo '
       'de precursores con actividad mineralocorticoide.', 'alta', source=TURCU),
    ix('drug:osilodrostat', 'enz:CYP11B2', 'inhibicion_enzimatica',
       'Inhibe tambien la aldosterona sintasa.', None, 'media', source=TURCU),

    # Metabolismo hepatico
    ix('drug:etinilestradiol', 'enz:CYP3A4', 'sustrato',
       'Se metaboliza sobre todo por hidroxilacion mediada por CYP3A4 y por conjugacion con '
       'circulacion enterohepatica.',
       'Los inductores de CYP3A4 reducen su exposicion y pueden hacer fallar la anticoncepcion.',
       'alta', source=STANCZYK),
    ix('drug:levonorgestrel', 'enz:CYP3A4', 'sustrato',
       'Metabolizado por CYP3A4.',
       'Con inductores enzimaticos se recomienda un metodo no dependiente de esa via.', 'alta',
       source=STANCZYK),
    ix('drug:ulipristal_ac', 'enz:CYP3A4', 'sustrato',
       'Sustrato de CYP3A4.',
       'Los inductores reducen su eficacia como anticonceptivo de urgencia.', 'alta', source=STANCZYK),
    ix('mol:cortisol', 'enz:CYP3A4', 'sustrato',
       'Inactivacion hepatica por oxidacion y conjugacion.', None, 'media', source=MILLER),
    ix('drug:dexametasona', 'enz:CYP3A4', 'sustrato',
       'Sustrato e inductor debil de CYP3A4.', None, 'media', source=MILLER),

    # Desplazamiento y transporte
    ix('drug:etinilestradiol', 'enz:CYP19A1', 'otro',
       'No es sustrato de la aromatasa: el anillo A ya esta aromatizado, y por eso su efecto no '
       'depende de esa enzima.', None, 'baja', source=STANCZYK),

    # Relaciones clinicas entre farmacos y hormonas
    ix('drug:espironolactona', 'mol:aldosterona', 'antagonismo',
       'Compite con la aldosterona por el receptor mineralocorticoide.',
       'Diuretico ahorrador de potasio; su actividad antiandrogenica se aprovecha en hirsutismo y '
       'acne, y explica la ginecomastia como efecto adverso.', 'alta', source=SPEROFF),
    ix('drug:drospirenona', 'mol:aldosterona', 'antagonismo',
       'Derivado de la espironolactona con actividad antimineralocorticoide.',
       'Reduce la retencion hidrica; exige precaucion con el potasio en insuficiencia renal o con '
       'otros farmacos hiperpotasemiantes.', 'media', source=SITRUK),
    ix('drug:mifepristona', 'mol:progesterona', 'antagonismo',
       'Antagonista competitivo del receptor de progesterona con afinidad superior a la de la '
       'hormona natural.',
       'Interrumpe la gestacion al retirar el soporte de progesterona sobre la decidua.', 'alta',
       source=SPEROFF),
    ix('drug:tamoxifeno', 'mol:estradiol', 'modulacion_selectiva',
       'Compite con el estradiol por el receptor y actua como antagonista en mama y agonista '
       'parcial en endometrio y hueso.',
       'De ahi el beneficio en cancer de mama y a la vez el aumento del riesgo de patologia '
       'endometrial.', 'alta', source=SPEROFF),
    ix('drug:clomifeno', 'mol:estradiol', 'modulacion_selectiva',
       'Bloquea la retroalimentacion negativa del estradiol en el hipotalamo.',
       'Aumenta las gonadotropinas endogenas y se usa para inducir la ovulacion.', 'alta',
       source=SPEROFF),
    ix('drug:finasterida', 'mol:dht', 'inhibicion_enzimatica',
       'Reduce la formacion de dihidrotestosterona a partir de testosterona.',
       'La testosterona se mantiene o sube ligeramente.', 'alta', direction='a->b', source=HANDELSMAN),
    ix('drug:enantato_testosterona', 'mol:testosterona', 'precursor',
       'Ester que se hidroliza a testosterona tras la inyeccion intramuscular.',
       'La esterificacion prolonga la liberacion y evita el primer paso hepatico.', 'alta',
       source=HANDELSMAN),
    ix('drug:undecanoato_testosterona', 'mol:testosterona', 'precursor',
       'Ester de cadena larga con absorcion linfatica parcial.',
       'Permite intervalos de administracion muy largos.', 'alta', source=HANDELSMAN),
    ix('drug:valerato_estradiol', 'mol:estradiol', 'precursor',
       'Ester que se hidroliza a estradiol.',
       'Aporta estradiol identico al endogeno, a diferencia del etinilestradiol.', 'alta',
       source=STANCZYK),
    ix('drug:tibolona', 'mol:estradiol', 'sinergia_clinica',
       'Sus metabolitos tienen actividad estrogenica, progestagenica y androgenica segun el tejido.',
       'Alivia sintomas climatericos sin estimular el endometrio, con efecto androgenico sobre la '
       'libido.', 'media', source=SPEROFF),
    ix('drug:mpa', 'mol:cortisol', 'sinergia_clinica',
       'Actividad glucocorticoide residual apreciable.',
       'A dosis altas puede producir efectos de tipo corticoideo y frenar el eje suprarrenal.',
       'media', source=SITRUK),
    ix('drug:ciproterona_ac', 'mol:testosterona', 'antagonismo',
       'Bloquea el receptor de androgenos y ademas frena las gonadotropinas.',
       'Doble mecanismo antiandrogenico; vigilar la funcion hepatica y el riesgo de meningioma con '
       'exposicion acumulada alta.', 'alta', source=SPEROFF),
]

# ---------------------------------------------------------- fichas farmacologicas ---
PHARM = {
    'drug:etinilestradiol': dict(
        cls='Estrogeno sintetico', mechanism=(
            'El grupo etinilo en el carbono 17 impide la oxidacion por la 17β-HSD2 y multiplica la '
            'potencia y la semivida frente al estradiol. Ese mismo rasgo explica su fuerte efecto '
            'de primer paso hepatico sobre SHBG, factores de coagulacion y angiotensinogeno.'),
        indications=['Anticoncepcion hormonal combinada', 'Control del ciclo en asociacion con un progestageno'],
        contraindications=['Antecedente de tromboembolismo venoso o trombofilia conocida',
                           'Migrana con aura', 'Hipertension no controlada',
                           'Cancer de mama actual', 'Hepatopatia grave activa',
                           'Lactancia en las primeras semanas posparto'],
        adverse=['Aumento del riesgo tromboembolico venoso y arterial', 'Nauseas y tension mamaria',
                 'Sangrado intermenstrual', 'Elevacion de la tension arterial'],
        pk=dict(route=['oral', 'transdermica', 'vaginal'], halfLife='aproximadamente un dia',
                metabolism='CYP3A4 y conjugacion con circulacion enterohepatica',
                bioavailability='reducida y variable por el primer paso hepatico'),
        source=[STANCZYK]),
    'drug:levonorgestrel': dict(
        cls='Progestageno de segunda generacion, derivado de la 19-nortestosterona', mechanism=(
            'Agonista potente del receptor de progesterona con actividad androgenica residual. '
            'Inhibe el pico de LH, espesa el moco cervical y adelgaza el endometrio.'),
        indications=['Anticoncepcion combinada y de solo gestageno', 'Anticoncepcion de urgencia',
                     'Dispositivo intrauterino liberador', 'Menorragia'],
        contraindications=['Cancer de mama actual', 'Hepatopatia grave activa',
                           'Sangrado genital no filiado'],
        adverse=['Sangrado irregular', 'Acne y seborrea por la actividad androgenica residual',
                 'Cefalea'],
        pk=dict(route=['oral', 'intrauterina', 'subdermica'], halfLife='alrededor de un dia',
                metabolism='CYP3A4', bioavailability='alta por via oral'),
        source=[SITRUK]),
    'drug:drospirenona': dict(
        cls='Progestageno derivado de la espironolactona', mechanism=(
            'Agonista del receptor de progesterona con actividad antimineralocorticoide y '
            'antiandrogenica, sin actividad androgenica residual.'),
        indications=['Anticoncepcion combinada', 'Sindrome premenstrual con retencion hidrica',
                     'Acne asociado a anticoncepcion'],
        contraindications=['Insuficiencia renal o suprarrenal', 'Riesgo de hiperpotasemia',
                           'Antecedente de tromboembolismo'],
        adverse=['Hiperpotasemia en pacientes de riesgo', 'Sangrado irregular'],
        pk=dict(route=['oral'], halfLife='alrededor de 30 horas', metabolism='CYP3A4 minoritario',
                bioavailability='alta'),
        source=[SITRUK]),
    'drug:ciproterona_ac': dict(
        cls='Antiandrogeno esteroideo con actividad progestagenica', mechanism=(
            'Bloquea el receptor de androgenos y suprime las gonadotropinas, de modo que reduce a '
            'la vez la accion y la produccion de androgenos.'),
        indications=['Hirsutismo y acne graves', 'Hiperandrogenismo', 'Cancer de prostata avanzado'],
        contraindications=['Hepatopatia', 'Meningioma actual o previo', 'Tromboembolismo'],
        adverse=['Hepatotoxicidad dosis dependiente', 'Meningioma con exposicion acumulada alta',
                 'Perdida de libido', 'Riesgo tromboembolico'],
        pk=dict(route=['oral'], halfLife='alrededor de dos dias', metabolism='CYP3A4',
                bioavailability='alta'),
        source=[SPEROFF]),
    'drug:finasterida': dict(
        cls='Inhibidor de la 5α-reductasa tipo 2', mechanism=(
            'Reduce la conversion de testosterona en dihidrotestosterona en los tejidos que '
            'expresan la isoforma 2, sobre todo prostata y foliculo piloso.'),
        indications=['Hiperplasia benigna de prostata', 'Alopecia androgenica'],
        contraindications=['Gestacion y mujeres en edad fertil, por riesgo de feminizacion de un '
                           'feto varon'],
        adverse=['Disfuncion erectil y perdida de libido', 'Ginecomastia',
                 'Reduccion del PSA a la mitad, que hay que tener en cuenta en el cribado'],
        pk=dict(route=['oral'], halfLife='de cinco a seis horas', metabolism='CYP3A4',
                bioavailability='alta'),
        source=[HANDELSMAN]),
    'drug:espironolactona': dict(
        cls='Antagonista del receptor mineralocorticoide con actividad antiandrogenica', mechanism=(
            'Compite con la aldosterona por su receptor y, de forma menos selectiva, con los '
            'androgenos por el suyo; ademas reduce la sintesis de androgenos.'),
        indications=['Insuficiencia cardiaca', 'Hiperaldosteronismo', 'Hirsutismo y acne',
                     'Terapia hormonal feminizante'],
        contraindications=['Hiperpotasemia', 'Insuficiencia renal avanzada', 'Gestacion'],
        adverse=['Hiperpotasemia', 'Ginecomastia y mastalgia', 'Irregularidad menstrual'],
        pk=dict(route=['oral'], halfLife='corta, con metabolitos activos de vida larga',
                metabolism='hepatico, con canrenona como metabolito activo', bioavailability='alta'),
        source=[SPEROFF]),
    'drug:tamoxifeno': dict(
        cls='Modulador selectivo del receptor de estrogenos', mechanism=(
            'Antagonista en la mama y agonista parcial en hueso, higado y endometrio, segun los '
            'coactivadores presentes en cada tejido.'),
        indications=['Cancer de mama con receptor hormonal positivo', 'Prevencion en alto riesgo'],
        contraindications=['Antecedente de tromboembolismo', 'Gestacion'],
        adverse=['Sofocos', 'Hiperplasia y carcinoma de endometrio', 'Tromboembolismo venoso',
                 'Cataratas'],
        pk=dict(route=['oral'], halfLife='de cinco a siete dias',
                metabolism='CYP2D6 a endoxifeno, el metabolito activo', bioavailability='alta'),
        source=[SPEROFF]),
    'drug:letrozol': dict(
        cls='Inhibidor no esteroideo de la aromatasa', mechanism=(
            'Bloquea de forma competitiva y reversible el hemo de la aromatasa y suprime la '
            'sintesis periferica de estrogenos.'),
        indications=['Cancer de mama posmenopausico con receptor positivo',
                     'Induccion de la ovulacion'],
        contraindications=['Premenopausia sin supresion ovarica en la indicacion oncologica',
                           'Gestacion'],
        adverse=['Artralgias', 'Perdida de masa osea', 'Sofocos'],
        pk=dict(route=['oral'], halfLife='alrededor de dos dias', metabolism='CYP3A4 y CYP2A6',
                bioavailability='alta'),
        source=[SPEROFF]),
    'drug:abiraterona': dict(
        cls='Inhibidor de CYP17A1', mechanism=(
            'Bloquea la sintesis de androgenos en el testiculo, la suprarrenal y el propio tumor. '
            'Al frenar tambien la 17α-hidroxilasa se acumulan precursores con actividad '
            'mineralocorticoide.'),
        indications=['Cancer de prostata resistente a la castracion',
                     'Cancer de prostata hormonosensible de alto riesgo'],
        contraindications=['Insuficiencia hepatica grave'],
        adverse=['Hipertension, hipopotasemia y edema por exceso de mineralocorticoides',
                 'Hepatotoxicidad', 'Fatiga'],
        pk=dict(route=['oral'], halfLife='alrededor de 12 horas', metabolism='CYP3A4 y SULT2A1',
                bioavailability='muy dependiente de la comida'),
        source=[TURCU]),
    'drug:enantato_testosterona': dict(
        cls='Ester de testosterona de accion intermedia', mechanism=(
            'Se hidroliza a testosterona tras la inyeccion; la esterificacion prolonga la '
            'liberacion y evita el primer paso hepatico.'),
        indications=['Hipogonadismo masculino', 'Terapia hormonal masculinizante'],
        contraindications=['Cancer de prostata o de mama', 'Policitemia', 'Deseo de fertilidad'],
        adverse=['Policitemia', 'Acne', 'Supresion de la espermatogenesis',
                 'Fluctuacion de los niveles entre inyecciones'],
        pk=dict(route=['intramuscular'], halfLife='de cuatro a cinco dias',
                metabolism='hepatico tras hidrolisis del ester', bioavailability='completa por via parenteral'),
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
    ], ['Se mide por la manana por el ritmo circadiano y se confirma con una segunda determinacion.',
        'La SHBG condiciona la fraccion libre: conviene medirla cuando el valor total no encaja con '
        'la clinica.',
        'Cifras muy altas en una mujer, por encima de unos 150 a 200 ng/dL, obligan a descartar un '
        'tumor productor.'], HANDELSMAN),
    lab('lab:dht', 'mol:dht', 'Dihidrotestosterona', 'ng/dL', [
        ('Varon adulto', 'una decima parte aproximadamente de la testosterona total'),
    ], ['Lo informativo es la relacion testosterona / dihidrotestosterona, muy elevada en el deficit '
        'de 5α-reductasa tipo 2.'], MILLER),
    lab('lab:estradiol', 'mol:estradiol', 'Estradiol', 'pg/mL', [
        ('Fase folicular temprana', 'aproximadamente 20 a 80'),
        ('Pico preovulatorio', 'aproximadamente 150 a 400'),
        ('Fase lutea', 'aproximadamente 60 a 200'),
        ('Posmenopausia', 'por debajo de 20'),
    ], ['La interpretacion depende del dia del ciclo: sin ese dato el valor aislado dice poco.',
        'En la posmenopausia procede de la aromatizacion periferica, no del ovario.'], SPEROFF),
    lab('lab:progesterona', 'mol:progesterona', 'Progesterona', 'ng/mL', [
        ('Fase folicular', 'por debajo de 1'),
        ('Fase lutea media', 'por encima de 3 confirma que ha habido ovulacion'),
    ], ['Se mide alrededor del septimo dia tras la ovulacion.'], SPEROFF),
    lab('lab:17ohp', 'mol:17oh_progesterona', '17α-hidroxiprogesterona', 'ng/dL', [
        ('Adulto basal', 'por debajo de unos 200'),
        ('Deficit clasico de 21-hidroxilasa', 'muy elevada, habitualmente por encima de 10 000'),
        ('Forma no clasica', 'basal intermedia; se confirma con prueba de estimulo con ACTH'),
    ], ['Se extrae por la manana y, en la mujer, en fase folicular temprana.',
        'Es el analito del cribado neonatal de la hiperplasia suprarrenal congenita.'], SPEISER),
    lab('lab:11_desoxicortisol', 'mol:11_desoxicortisol', '11-desoxicortisol', 'ng/dL', [
        ('Basal', 'bajo'), ('Deficit de 11β-hidroxilasa', 'muy elevado'),
    ], ['Su acumulo, junto con el de desoxicorticosterona, distingue el deficit de 11β-hidroxilasa '
        'del de 21-hidroxilasa.'], TURCU),
    lab('lab:cortisol', 'mol:cortisol', 'Cortisol', 'µg/dL', [
        ('Basal matutino', 'aproximadamente 6 a 20'),
        ('Insuficiencia suprarrenal', 'basal bajo con respuesta insuficiente al estimulo'),
    ], ['El ritmo circadiano obliga a fijar la hora de extraccion.',
        'La respuesta al estimulo informa mas que el valor basal aislado.'], MILLER),
    lab('lab:aldosterona', 'mol:aldosterona', 'Aldosterona', 'ng/dL', [
        ('Adulto en bipedestacion', 'variable segun postura, sodio y postura previa'),
    ], ['Se interpreta siempre junto con la renina: el cociente aldosterona / renina es lo que '
        'orienta.'], MILLER),
    lab('lab:renina', None, 'Actividad de renina plasmatica', 'ng/mL/h', [
        ('Adulto', 'depende de la postura y del aporte de sodio'),
    ], ['Elevada en el deficit de 21-hidroxilasa con perdida salina.',
        'Suprimida cuando se acumulan precursores con actividad mineralocorticoide, como en el '
        'deficit de 11β-hidroxilasa.'], SPEISER),
    lab('lab:dhea_s', 'mol:dhea_s', 'Sulfato de DHEA', 'µg/dL', [
        ('Adulto joven', 'alto, con descenso progresivo con la edad'),
    ], ['Marcador de produccion androgenica suprarrenal por su vida media larga.',
        'Muy elevado orienta a tumor suprarrenal; muy bajo, a insuficiencia suprarrenal o deficit '
        'de StAR.'], TURCU),
    lab('lab:androstenediona', 'mol:androstenediona', 'Androstenediona', 'ng/dL', [
        ('Mujer adulta', 'variable con el ciclo'),
    ], ['Sube en el deficit de 21-hidroxilasa y en el hiperandrogenismo ovarico.',
        'La relacion androstenediona / testosterona tras estimulo con hCG orienta al deficit de '
        '17β-HSD3.'], SPEISER),
    lab('lab:17oh_pregnenolona', 'mol:17oh_pregnenolona', '17α-hidroxipregnenolona', 'ng/dL', [
        ('Basal', 'bajo'), ('Deficit de 3β-HSD2', 'muy elevada'),
    ], ['La relacion 17-hidroxipregnenolona / 17-hidroxiprogesterona muy alta es la clave del '
        'deficit de 3β-HSD2.'], MILLER),
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
    ], ['Alto en el deficit de 21-hidroxilasa con perdida salina.',
        'Bajo cuando hay exceso de mineralocorticoides.'], SPEISER),
    lab('lab:shbg', None, 'Globulina transportadora de hormonas sexuales', 'nmol/L', [
        ('Adulto', 'variable; sube con estrogeno oral e hipertiroidismo, baja con androgenos, '
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
    names={'es': 'Ciclo ovarico y endometrial', 'en': 'Ovarian and endometrial cycle'},
    days=28, ovulation=14,
    note=('Perfiles normalizados de 0 a 1: representan la forma de cada curva y su relacion '
          'temporal, no concentraciones absolutas. Las cifras de referencia estan en el modulo de '
          'laboratorio.'),
    phases=[
        dict(id='menstrual', label='Menstrual', from_=1, to=5,
             text='Caida de estradiol y progesterona tras la luteolisis: se descama el endometrio. '
                  'La FSH empieza a subir y recluta la nueva cohorte folicular.'),
        dict(id='folicular', label='Folicular', from_=6, to=13,
             text='El foliculo dominante fabrica estradiol en cantidad creciente. La teca aporta '
                  'androgenos y la granulosa los aromatiza. El estradiol prolifera el endometrio y '
                  'frena la FSH, lo que condena al resto de la cohorte.'),
        dict(id='ovulacion', label='Ovulacion', from_=14, to=15,
             text='El estradiol sostenido por encima de un umbral invierte la retroalimentacion: '
                  'la hipofisis responde con el pico de LH y el foliculo se rompe.'),
        dict(id='lutea', label='Lutea', from_=16, to=28,
             text='El cuerpo luteo produce progesterona, que transforma el endometrio en secretor y '
                  'enlentece los pulsos de GnRH. Sin gestacion, la luteolisis retira el soporte y '
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
        dict(id='foliculo', label='Foliculo y cuerpo luteo', color='enz-red', mol=None),
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
    for ch, rep in [(' ', '_'), (',', ''), ('(', ''), (')', ''), ('á', 'a'), ('é', 'e'),
                    ('í', 'i'), ('ó', 'o'), ('ú', 'u'), ('ñ', 'n'), ('/', '_'), ('<', 'lt'),
                    ('>', 'gt'), ('.', ''), ('-', '_'), ('+', 'mas')]:
        key = key.replace(ch, rep)
    return dict(id='elig:' + key[:60], method=method, condition=condition,
                category=category, note=note, source=[OMS])

ELIGIBILITY = [
    elig('Combinado (pildora, parche, anillo)', 'Migrana con aura, cualquier edad', 4,
         'El riesgo de ictus isquemico es el motivo del veto absoluto.'),
    elig('Combinado (pildora, parche, anillo)', 'Migrana sin aura, 35 anos o mas', 3,
         'Categoria 2 si es menor de 35 anos.'),
    elig('Combinado (pildora, parche, anillo)', 'Tabaquismo, 35 anos o mas, 15 o mas cigarrillos al dia', 4),
    elig('Combinado (pildora, parche, anillo)', 'Tabaquismo, 35 anos o mas, menos de 15 cigarrillos al dia', 3),
    elig('Combinado (pildora, parche, anillo)', 'Antecedente de tromboembolismo venoso', 4),
    elig('Combinado (pildora, parche, anillo)', 'Trombofilia conocida', 4),
    elig('Combinado (pildora, parche, anillo)', 'Hipertension con cifras iguales o mayores de 160/100', 4),
    elig('Combinado (pildora, parche, anillo)', 'Hipertension bien controlada', 3),
    elig('Combinado (pildora, parche, anillo)', 'Lactancia, menos de 6 semanas posparto', 4),
    elig('Combinado (pildora, parche, anillo)', 'Lactancia, de 6 semanas a 6 meses posparto', 3),
    elig('Combinado (pildora, parche, anillo)', 'Cancer de mama actual', 4),
    elig('Combinado (pildora, parche, anillo)', 'Cancer de mama pasado y sin recidiva en 5 anos', 3),
    elig('Combinado (pildora, parche, anillo)', 'Diabetes con nefropatia, retinopatia o neuropatia', 3,
         'Puede llegar a 4 segun la gravedad y la duracion.'),
    elig('Combinado (pildora, parche, anillo)', 'Cirrosis descompensada', 4),
    elig('Combinado (pildora, parche, anillo)', 'Lupus con anticuerpos antifosfolipido positivos', 4),
    elig('Combinado (pildora, parche, anillo)', 'Obesidad con indice de masa corporal de 30 o mas', 2),
    elig('Combinado (pildora, parche, anillo)', 'Endometriosis', 1),
    elig('Solo gestageno (pildora)', 'Cancer de mama actual', 4),
    elig('Solo gestageno (pildora)', 'Antecedente de tromboembolismo venoso', 2),
    elig('Solo gestageno (pildora)', 'Migrana con aura', 2,
         'Categoria 3 para continuar si la migrana con aura aparece durante el uso.'),
    elig('Solo gestageno (pildora)', 'Lactancia, menos de 6 semanas posparto', 2),
    elig('Solo gestageno (pildora)', 'Hipertension grave', 2),
    elig('Inyectable de gestageno (acetato de medroxiprogesterona)', 'Menos de 18 anos', 2,
         'Por el efecto sobre la masa osea en un periodo de acumulacion.'),
    elig('Inyectable de gestageno (acetato de medroxiprogesterona)', 'Multiples factores de riesgo cardiovascular', 3),
    elig('Inyectable de gestageno (acetato de medroxiprogesterona)', 'Cancer de mama actual', 4),
    elig('Implante subdermico (etonogestrel)', 'Cancer de mama actual', 4),
    elig('Implante subdermico (etonogestrel)', 'Antecedente de tromboembolismo venoso', 2),
    elig('Implante subdermico (etonogestrel)', 'Uso de inductores enzimaticos potentes', 2),
    elig('DIU de levonorgestrel', 'Cancer de mama actual', 4),
    elig('DIU de levonorgestrel', 'Sepsis puerperal', 4),
    elig('DIU de levonorgestrel', 'Enfermedad trofoblastica gestacional maligna', 4),
    elig('DIU de levonorgestrel', 'Miomas sin distorsion de la cavidad', 1),
    elig('DIU de cobre', 'Sangrado uterino no filiado antes de estudiarlo', 4,
         'Categoria 2 para continuar una vez estudiado.'),
    elig('DIU de cobre', 'Anemia ferropenica', 2),
    elig('DIU de cobre', 'Cancer de mama actual', 1,
         'No contiene hormonas, de ahi la diferencia con el DIU de levonorgestrel.'),
]

# ---------------------------------------------------------------- autoevaluacion ---
def q(qid, module, stem, options, answer, explanation, links, difficulty=2, source=None):
    return dict(id=qid, module=module, stem=stem, options=options, answer=answer,
                explanation=explanation, links=links, difficulty=difficulty,
                source=[source] if source else [])

QUESTIONS = [
    q('q:0001', 'esteroidogenesis',
      'Que paso limita la velocidad de toda la esteroidogenesis?',
      ['La 21-hidroxilacion por CYP21A2',
       'El transporte de colesterol a la membrana mitocondrial interna por StAR',
       'La aromatizacion por CYP19A1',
       'La oxidacion del 3β-hidroxilo por la 3β-HSD'], 1,
      'El paso limitante no es enzimatico: es la llegada del colesterol al lugar donde trabaja '
      'CYP11A1. Por eso las hormonas troficas actuan en minutos sobre StAR.',
      ['enz:StAR', 'rx:col_preg'], 1, MILLER),
    q('q:0002', 'esteroidogenesis',
      'Por que la zona glomerular de la suprarrenal no puede fabricar cortisol?',
      ['Le falta la 21-hidroxilasa', 'Le falta CYP17A1 y no puede hidroxilar en el carbono 17',
       'Le falta la 3β-HSD', 'Le falta la aldosterona sintasa'], 1,
      'Sin CYP17A1 la via no puede llegar a 17-hidroxiprogesterona, que es el precursor obligado '
      'del cortisol. A cambio, es la unica zona con aldosterona sintasa.',
      ['tis:glomerulosa', 'enz:CYP17A1'], 2, MILLER),
    q('q:0003', 'esteroidogenesis',
      'En el deficit clasico de 21-hidroxilasa, que explica la virilizacion?',
      ['La 21-hidroxilasa fabrica androgenos directamente',
       'El flujo represado se desvia hacia la unica salida libre, la via androgenica',
       'El cortisol bajo estimula el ovario', 'La aldosterona baja aumenta la testosterona'], 1,
      'Al bloquear la salida hacia cortisol y aldosterona, la 17-hidroxiprogesterona se acumula y '
      'el exceso encuentra su unica salida por la 17,20-liasa hacia androstenediona.',
      ['cond:def_21oh', 'rx:17ohprog_a4'], 2, SPEISER),
    q('q:0004', 'esteroidogenesis',
      'Que distingue el deficit de 11β-hidroxilasa del de 21-hidroxilasa?',
      ['La virilizacion, que solo aparece en el de 11β',
       'La hipertension por acumulo de desoxicorticosterona en vez de perdida salina',
       'El cortisol, que es normal en el de 11β', 'La herencia, que es dominante en el de 11β'], 1,
      'Los dos virilizan, pero en el deficit de 11β-hidroxilasa se acumula desoxicorticosterona, '
      'que tiene actividad mineralocorticoide: hay hipertension e hipopotasemia con renina baja.',
      ['cond:def_11boh', 'mol:doc'], 2, TURCU),
    q('q:0005', 'esteroidogenesis',
      'Que enzima convierte un androgeno en un estrogeno?',
      ['La 17β-HSD1', 'La 5α-reductasa tipo 2', 'La aromatasa CYP19A1', 'La 3β-HSD2'], 2,
      'La aromatasa elimina el carbono 19 y convierte el anillo A en un fenol aromatico. Es el '
      'unico paso que cambia de familia hormonal.',
      ['enz:CYP19A1', 'rx:t_e2'], 1, MILLER),
    q('q:0006', 'esteroidogenesis',
      'En la teoria de las dos celulas del foliculo ovarico, que aporta la granulosa?',
      ['CYP17A1 para fabricar androgenos', 'Aromatasa para convertir los androgenos en estrogenos',
       'StAR para transportar colesterol', '21-hidroxilasa'], 1,
      'La teca tiene CYP17A1 pero no aromatasa; la granulosa, al reves. Ninguna de las dos produce '
      'estradiol por si sola.', ['tis:teca', 'tis:granulosa'], 2, SPEROFF),
    q('q:0007', 'esteroidogenesis',
      'Que hace el citocromo b5 sobre CYP17A1?',
      ['Le cede electrones para la hidroxilacion', 'Potencia su actividad 17,20-liasa',
       'La inhibe de forma competitiva', 'La transporta al reticulo'], 1,
      'El citocromo b5 no aporta electrones: actua como modulador alosterico y desplaza la enzima '
      'hacia la actividad liasa. Es lo que diferencia la zona reticular de la fasciculada.',
      ['enz:CYB5A', 'tis:reticular'], 3, MILLER),
    q('q:0008', 'organos',
      'Una persona 46,XY con deficit de 5α-reductasa tipo 2 presenta al nacer',
      ['Genitales masculinos normales', 'Genitales externos femeninos o ambiguos con estructuras '
       'wolffianas normales', 'Ausencia de testiculos', 'Genitales femeninos con utero'], 1,
      'La testosterona mantiene los conductos de Wolff, pero la virilizacion de los genitales '
      'externos depende de la dihidrotestosterona. En la pubertad se viriliza por el ascenso de '
      'testosterona.', ['cond:def_5ar2', 'org:genitales_externos'], 2, MILLER),
    q('q:0009', 'organos',
      'Que demuestra el deficit de aromatasa en el varon?',
      ['Que la testosterona cierra el cartilago de crecimiento',
       'Que el cierre epifisario depende del estrogeno tambien en el varon',
       'Que el estrogeno no interviene en el hueso masculino',
       'Que la hormona de crecimiento es prescindible'], 1,
      'Los varones con deficit de aromatasa o con receptor de estrogenos no funcionante tienen '
      'talla alta con epifisis abiertas y osteoporosis, y el estrogeno sustitutivo lo corrige.',
      ['cond:def_aromatasa', 'org:hueso'], 2, MILLER),
    q('q:0010', 'farmacos',
      'Por que la abiraterona se administra junto con un glucocorticoide?',
      ['Para evitar nauseas', 'Para contener el exceso de mineralocorticoides que produce el bloqueo '
       'de la 17α-hidroxilasa', 'Para potenciar su efecto antitumoral', 'Para proteger el higado'], 1,
      'Al bloquear CYP17A1 sube la ACTH y se acumulan precursores con actividad mineralocorticoide, '
      'con hipertension, hipopotasemia y edema. El glucocorticoide frena la ACTH.',
      ['drug:abiraterona', 'enz:CYP17A1'], 2, TURCU),
    q('q:0011', 'farmacos',
      'Que diferencia farmacologica explica la potencia del etinilestradiol frente al estradiol?',
      ['Su mayor afinidad por el receptor de progesterona',
       'El grupo etinilo en el carbono 17, que impide su oxidacion por la 17β-HSD2',
       'Su union a la SHBG', 'Su metabolismo renal'], 1,
      'El etinilo bloquea la inactivacion en la posicion 17 y prolonga mucho la semivida, con un '
      'efecto hepatico de primer paso muy marcado.',
      ['drug:etinilestradiol', 'enz:HSD17B2'], 2, STANCZYK),
    q('q:0012', 'farmacos',
      'Que progestageno tiene actividad antimineralocorticoide?',
      ['Levonorgestrel', 'Noretisterona', 'Drospirenona', 'Acetato de medroxiprogesterona'], 2,
      'La drospirenona deriva de la espironolactona y conserva su antagonismo del receptor '
      'mineralocorticoide, ademas de ser antiandrogenica.',
      ['drug:drospirenona', 'rec:MR'], 2, SITRUK),
    q('q:0013', 'elegibilidad',
      'Que categoria de la OMS corresponde al anticonceptivo combinado en una mujer con migrana con aura?',
      ['Categoria 1', 'Categoria 2', 'Categoria 3', 'Categoria 4'], 3,
      'Es categoria 4, es decir, riesgo inaceptable, por el aumento del riesgo de ictus isquemico. '
      'Los metodos de solo gestageno son una alternativa.', [], 2, OMS),
    q('q:0014', 'ciclo',
      'Que desencadena el pico ovulatorio de LH?',
      ['La caida de la progesterona', 'El estradiol sostenido por encima de un umbral, que invierte '
       'la retroalimentacion a positiva', 'El ascenso de la FSH', 'La inhibina B'], 1,
      'Es el unico momento del ciclo en que el estradiol estimula en vez de frenar. Requiere una '
      'concentracion mantenida durante alrededor de dos dias.', ['mol:estradiol'], 2, SPEROFF),
    q('q:0015', 'ciclo',
      'Que confirma que ha habido ovulacion en un ciclo?',
      ['Un estradiol elevado en fase folicular', 'Una progesterona en fase lutea media por encima '
       'de 3 ng/mL', 'Una LH basal elevada', 'Un grosor endometrial de 8 mm'], 1,
      'La progesterona solo la produce el cuerpo luteo, que solo existe si ha habido ovulacion.',
      ['lab:progesterona'], 1, SPEROFF),
    q('q:0016', 'laboratorio',
      'Que relacion analitica orienta al deficit de 3β-HSD2?',
      ['Testosterona / dihidrotestosterona', '17-hidroxipregnenolona / 17-hidroxiprogesterona',
       'Aldosterona / renina', 'Androstenediona / testosterona'], 1,
      'El bloqueo impide pasar de la serie Δ5 a la Δ4, de modo que se acumulan los precursores Δ5 '
      'con respecto a sus equivalentes Δ4.', ['cond:def_3bhsd', 'lab:17oh_pregnenolona'], 3, MILLER),
    q('q:0017', 'atlas',
      'Que cambio estructural convierte la testosterona en dihidrotestosterona?',
      ['La aromatizacion del anillo A', 'La reduccion del doble enlace Δ4 del anillo A',
       'La hidroxilacion en el carbono 17', 'La perdida del carbono 19'], 1,
      'La 5α-reductasa satura el doble enlace entre los carbonos 4 y 5. La composicion apenas '
      'cambia, pero la afinidad por el receptor y la duracion del efecto suben mucho.',
      ['rx:t_dht', 'mol:dht'], 1, MILLER),
    q('q:0018', 'atlas',
      'Que tienen en comun todos los estrogenos naturales?',
      ['Un grupo cetona en el carbono 3', 'Un anillo A aromatico y ausencia del carbono 19',
       'Una cadena lateral de dos carbonos en el 17', 'Un doble enlace Δ4'], 1,
      'La aromatizacion del anillo A obliga a perder el metilo del carbono 19 y convierte el '
      'hidroxilo del carbono 3 en fenol.', ['mol:estradiol', 'enz:CYP19A1'], 1, MILLER),
    q('q:0019', 'esteroidogenesis',
      'De donde procede el estriol que se mide en la gestacion?',
      ['Del ovario materno', 'De la unidad fetoplacentaria, a partir de precursores 16α-hidroxilados '
       'de origen fetal', 'Del higado materno', 'De la suprarrenal materna en exclusiva'], 1,
      'La placenta no tiene CYP17A1 y depende del sulfato de DHEA fetal, que el higado del feto '
      '16α-hidroxila; la placenta lo desulfata y lo aromatiza.',
      ['rx:16ohdhea_e3', 'tis:sincitiotrofoblasto'], 3, MILLER),
    q('q:0020', 'farmacos',
      'Que ocurre con la espermatogenesis al administrar testosterona exogena?',
      ['Mejora, por el aporte de sustrato', 'Se suprime, porque cae la concentracion '
       'intratesticular al frenarse la LH', 'No se modifica', 'Solo se afecta con dosis muy altas'], 1,
      'La espermatogenesis necesita concentraciones intratesticulares muy superiores a las '
      'plasmaticas, que solo mantiene la produccion propia estimulada por LH.',
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
    print('  %d fichas farmacologicas incorporadas, %d lecturas' % (applied, len(readings)))


if __name__ == '__main__':
    main()
