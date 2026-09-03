#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Organos, territorios diana y receptores.

Cada efecto hormona-receptor-organo lleva su fuente. Las posiciones ('anchor')
son coordenadas de la silueta esquematica del cuerpo, con 0 en los pies y 100 en
el vertice del craneo; x positivo a la derecha del observador.
"""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'src', 'data')

PENDIENTE = ('Referencia transcrita sin acceso a la red desde el entorno de compilación; '
             'el identificador está pendiente de comprobación en línea.')

EXTRA_READINGS = [
    dict(id='read:hall2020', kind='libro',
         citation='Hall JE, Hall ME. Guyton and Hall Textbook of Medical Physiology. 14th ed. '
                  'Elsevier; 2020. Capitulos de fisiología endocrina y reproductiva.',
         doi=None, verified=False, note=PENDIENTE, tags=['fisiología', 'órganos blanco'],
         summary='Texto de fisiología de referencia para los efectos de las hormonas esteroideas '
                 'sobre cada órgano diana.'),
    dict(id='read:speroff2020', kind='libro',
         citation='Taylor HS, Pal L, Seli E. Speroff’s Clinical Gynecologic Endocrinology and '
                  'Infertility. 9th ed. Wolters Kluwer; 2020.',
         doi=None, verified=False, note=PENDIENTE,
         tags=['endocrinología ginecológica', 'ciclo', 'anticoncepción'],
         summary='Referencia clínica para el ciclo hormonal, los efectos endometriales y ovaricos '
                 'y la anticoncepción hormonal.'),
    dict(id='read:mooradian1987', kind='revision',
         citation='Mooradian AD, Morley JE, Korenman SG. Biological actions of androgens. '
                  'Endocr Rev. 1987;8(1):1-28.',
         doi='10.1210/edrv-8-1-1', verified=False, note=PENDIENTE,
         tags=['andrógenos', 'órganos blanco'],
         summary='Revisión clásica de las acciones biológicas de los andrógenos por tejido.'),
    dict(id='read:oms2015', kind='guia',
         citation='Organización Mundial de la Salud. Medical eligibility criteria for contraceptive '
                  'use. 5th ed. Ginebra: OMS; 2015.',
         doi=None, verified=False, note=PENDIENTE, tags=['anticoncepción', 'elegibilidad'],
         summary='Criterios médicos de elegibilidad para el uso de anticonceptivos, con las '
                 'categorías 1 a 4 por método y condición.'),
]

HALL = 'read:hall2020'
SPEROFF = 'read:speroff2020'
MOORADIAN = 'read:mooradian1987'
MILLER = 'read:miller2011'

# ------------------------------------------------------------------ receptores ---
RECEPTORS = [
    dict(id='rec:AR', gene='AR', es='Receptor de andrógenos', en='Androgen receptor', corto='AR',
         cls='nuclear', isoforms=['AR-A', 'AR-B'],
         mechanism='Receptor nuclear de la familia de esteroides. Sin ligando permanece en el '
                   'citoplasma unido a chaperonas; al unir testosterona o dihidrotestosterona se '
                   'dimeriza, entra al núcleo y se une a elementos de respuesta a andrógenos. La '
                   'dihidrotestosterona se disocia más despacio, y de ahi su mayor potencia.',
         ligands=[('mol:dht', 'agonista'), ('mol:testosterona', 'agonista'),
                  ('mol:11ceto_testosterona', 'agonista'), ('mol:androstenediona', 'agonista_parcial'),
                  ('drug:bicalutamida', 'antagonista'), ('drug:enzalutamida', 'antagonista'),
                  ('drug:flutamida', 'antagonista'), ('drug:apalutamida', 'antagonista'),
                  ('drug:darolutamida', 'antagonista'), ('drug:ciproterona_ac', 'antagonista'),
                  ('drug:espironolactona', 'antagonista'), ('drug:drospirenona', 'antagonista'),
                  ('drug:nandrolona', 'agonista'), ('drug:oxandrolona', 'agonista'),
                  ('drug:estanozolol', 'agonista'), ('drug:mesterolona', 'agonista'),
                  ('drug:danazol', 'agonista_parcial'), ('drug:levonorgestrel', 'agonista_parcial')],
         source=[MILLER, MOORADIAN]),
    dict(id='rec:ERa', gene='ESR1', es='Receptor de estrógenos alfa', en='Estrogen receptor alpha',
         corto='ERα', cls='nuclear', isoforms=None,
         mechanism='Media la mayor parte de los efectos proliferativos del estradiol en mama, '
                   'útero, hueso e hígado. Los moduladores selectivos se comportan como agonistas '
                   'en unos tejidos y antagonistas en otros según los coactivadores presentes.',
         ligands=[('mol:estradiol', 'agonista'), ('mol:estrona', 'agonista_parcial'),
                  ('mol:estriol', 'agonista_parcial'), ('mol:estetrol', 'agonista_parcial'),
                  ('drug:etinilestradiol', 'agonista'), ('drug:tamoxifeno', 'modulador'),
                  ('drug:raloxifeno', 'modulador'), ('drug:clomifeno', 'modulador'),
                  ('drug:bazedoxifeno', 'modulador'), ('drug:ospemifeno', 'modulador'),
                  ('drug:fulvestrant', 'antagonista'), ('drug:tibolona', 'agonista_parcial')],
         source=[MILLER, SPEROFF]),
    dict(id='rec:ERb', gene='ESR2', es='Receptor de estrógenos beta', en='Estrogen receptor beta',
         corto='ERβ', cls='nuclear', isoforms=None,
         mechanism='Distribucion distinta de la del receptor alfa, con papel destacado en ovario, '
                   'próstata, sistema nervioso central, endotelio y colon. A menudo se opone a la '
                   'señal proliferativa del receptor alfa.',
         ligands=[('mol:estradiol', 'agonista'), ('mol:estriol', 'agonista_parcial'),
                  ('mol:androstanodiol', 'agonista_parcial'), ('drug:raloxifeno', 'modulador')],
         source=[MILLER]),
    dict(id='rec:PR', gene='PGR', es='Receptor de progesterona', en='Progesterone receptor',
         corto='PR', cls='nuclear', isoforms=['PR-A', 'PR-B'],
         mechanism='Su expresión depende del estímulo estrogénico previo: sin estrógeno no hay '
                   'receptor, y por eso la progesterona solo actua sobre un tejido ya preparado. '
                   'PR-B activa la transcripción y PR-A la reprime.',
         ligands=[('mol:progesterona', 'agonista'), ('drug:levonorgestrel', 'agonista'),
                  ('drug:noretisterona', 'agonista'), ('drug:dienogest', 'agonista'),
                  ('drug:drospirenona', 'agonista'), ('drug:mpa', 'agonista'),
                  ('drug:etonogestrel', 'agonista'), ('drug:gestodeno', 'agonista'),
                  ('drug:nomegestrol_ac', 'agonista'), ('drug:clormadinona_ac', 'agonista'),
                  ('drug:ciproterona_ac', 'agonista'), ('drug:didrogesterona', 'agonista'),
                  ('drug:mifepristona', 'antagonista'), ('drug:ulipristal_ac', 'modulador')],
         source=[SPEROFF]),
    dict(id='rec:GR', gene='NR3C1', es='Receptor de glucocorticoides', en='Glucocorticoid receptor',
         corto='GR', cls='nuclear', isoforms=None,
         mechanism='Ubicuo. Media la acción metabólica y antiinflamatoria del cortisol y explica '
                   'los efectos adversos de los progestágenos con actividad glucocorticoide.',
         ligands=[('mol:cortisol', 'agonista'), ('drug:dexametasona', 'agonista'),
                  ('drug:prednisolona', 'agonista'), ('drug:mpa', 'agonista_parcial'),
                  ('drug:mifepristona', 'antagonista')],
         source=[MILLER]),
    dict(id='rec:MR', gene='NR3C2', es='Receptor de mineralocorticoides', en='Mineralocorticoid receptor',
         corto='MR', cls='nuclear', isoforms=None,
         mechanism='Une aldosterona y cortisol con afinidad parecida. La selectividad la impone la '
                   '11β-HSD2 del tubulo renal, que inactiva el cortisol antes de que llegue al '
                   'receptor.',
         ligands=[('mol:aldosterona', 'agonista'), ('mol:cortisol', 'agonista'),
                  ('mol:doc', 'agonista'), ('drug:espironolactona', 'antagonista'),
                  ('drug:drospirenona', 'antagonista')],
         source=[MILLER]),
    dict(id='rec:GPER1', gene='GPER1', es='Receptor de estrógenos acoplado a proteína G',
         en='G protein-coupled estrogen receptor', corto='GPER1', cls='membrana', isoforms=None,
         mechanism='Receptor de membrana que explica efectos rápidos del estradiol, en segundos o '
                   'minutos, incompatibles con la vía genomica clásica.',
         ligands=[('mol:estradiol', 'agonista'), ('drug:tamoxifeno', 'agonista_parcial')],
         source=[MILLER]),
]

# --------------------------------------------------------------------- organos ---
def organ(oid, es, en, anchor, sex, kind, targets, synthesizes=None, note=None):
    return dict(id=oid, names={'es': es, 'en': en, 'corto': es}, anchor=anchor, sex=sex,
                kind=kind, note=note, synthesizes=synthesizes or [],
                targets=[dict(hormone=h, receptor=r, effect=e, clinical=c, weight=w,
                              stage=st, source=[s])
                         for h, r, e, c, w, st, s in targets])

# (hormona, receptor, efecto, correlato clinico, peso, etapas, fuente)
ORGANS = [
    organ('org:hipotalamo', 'Hipotálamo', 'Hypothalamus', [-1.6, 93.5, 1.1], 'ambos', 'neuroendocrino', [
        ('mol:estradiol', 'rec:ERa', 'Modula la frecuencia de los pulsos de GnRH; el ascenso '
         'sostenido de estradiol preovulatorio invierte la retroalimentación de negativa a positiva.',
         'La retroalimentación positiva es la que desencadena el pico de LH y la ovulación.', 1,
         ['pubertad', 'adulto'], SPEROFF),
        ('mol:testosterona', 'rec:AR', 'Frena la secreción de GnRH de forma directa y, tras '
         'aromatización local, también a través del receptor de estrógenos.',
         'El andrógeno exógeno suprime el eje y causa hipogonadismo hipogonadotropo con atrofia '
         'testicular y azoospermia.', 1, ['pubertad', 'adulto'], MOORADIAN),
        ('mol:progesterona', 'rec:PR', 'Enlentece los pulsos de GnRH en la fase lútea.',
         'Es la base del efecto anticonceptivo central de los progestágenos.', 0.8,
         ['adulto'], SPEROFF),
    ]),
    organ('org:hipofisis', 'Hipófisis', 'Pituitary gland', [1.4, 90.6, 1.1], 'ambos', 'neuroendocrino', [
        ('mol:estradiol', 'rec:ERa', 'Aumenta la sensibilidad del gonadotropo a la GnRH y la '
         'reserva de LH liberable.', 'Sin ese efecto no se produce el pico ovulatorio de LH.', 1,
         ['pubertad', 'adulto'], SPEROFF),
        ('mol:testosterona', 'rec:AR', 'Reduce la amplitud de los pulsos de LH.',
         'Explica la supresión de gonadotropinas con testosterona exógena.', 0.9,
         ['pubertad', 'adulto'], MOORADIAN),
    ]),
    organ('org:cerebro', 'Sistema nervioso central', 'Central nervous system', [0, 96.4, 2.2],
          'ambos', 'diana', [
        ('mol:estradiol', 'rec:ERa', 'Efectos sobre memoria verbal, estado de animo, '
         'termorregulación y flujo sanguíneo cerebral; participa en la diferenciación sexual del '
         'cerebro por aromatización local de la testosterona.',
         'La caida de estradiol en la menopausia se asocia a sofocos y alteración del sueno.', 1,
         ['fetal', 'pubertad', 'adulto', 'climaterio'], HALL),
        ('mol:alopregnanolona', 'rec:GPER1', 'Modulador alostérico positivo del receptor GABA-A, '
         'con efecto ansiolitico, sedante y anticonvulsivo.',
         'Su caida brusca tras el parto participa en la depresión posparto; es la diana de la '
         'brexanolona.', 0.9, ['adulto'], MILLER),
        ('mol:testosterona', 'rec:AR', 'Efectos sobre libido, agresividad y cognición espacial.',
         'El hipogonadismo cursa con pérdida de libido y de energía.', 0.8,
         ['pubertad', 'adulto'], MOORADIAN),
    ]),
    organ('org:mama', 'Mama', 'Breast', [5.6, 75.5, 2.6], 'ambos', 'diana', [
        ('mol:estradiol', 'rec:ERa', 'Crecimiento y ramificación del sistema ductal y deposito de '
         'grasa; en la pubertad femenina es el motor de la telarquia.',
         'El estímulo estrogénico mantenido es el principal factor hormonal del cáncer de mama con '
         'receptor positivo.', 1, ['pubertad', 'adulto', 'gestacion'], SPEROFF),
        ('mol:progesterona', 'rec:PR', 'Desarrollo lobulillo-alveolar, que prepara la glándula para '
         'la lactancia.', 'La mastalgia ciclica de la fase lútea responde a este estímulo.', 0.9,
         ['adulto', 'gestacion'], SPEROFF),
        ('mol:estrona', 'rec:ERa', 'Fuente principal de estímulo estrogénico tras la menopausia, '
         'generada por aromatización en el estroma mamario y en el adiposo.',
         'Justifica el uso de inhibidores de aromatasa en el cáncer de mama posmenopáusico.', 0.7,
         ['climaterio'], SPEROFF),
    ], synthesizes=['tis:mama_estroma']),
    organ('org:utero', 'Útero', 'Uterus', [0, 49.5, 2.3], 'xx', 'diana', [
        ('mol:estradiol', 'rec:ERa', 'Proliferación del endometrio y crecimiento del miometrio; '
         'induce la expresión del receptor de progesterona.',
         'El estímulo estrogénico sin oposición produce hiperplasia endometrial y aumenta el riesgo '
         'de carcinoma.', 1, ['pubertad', 'adulto', 'gestacion'], SPEROFF),
        ('mol:progesterona', 'rec:PR', 'Transforma el endometrio proliferativo en secretor, frena '
         'la mitosis y mantiene la quiescencia del miometrio.',
         'Su retirada al final del ciclo desencadena la menstruación; su mantenimiento sostiene la '
         'gestacion.', 1, ['adulto', 'gestacion'], SPEROFF),
        ('mol:estradiol', 'rec:ERb', 'Aumenta la contractilidad y la sensibilidad a la oxitocina al '
         'final de la gestación.', 'Participa en el inicio del parto.', 0.6, ['gestacion'], SPEROFF),
    ]),
    organ('org:ovario', 'Ovario', 'Ovary', [5.2, 52.5, 1.7], 'xx', 'ambos', [
        ('mol:estradiol', 'rec:ERb', 'Actua de forma local sobre la maduración folicular y la '
         'supervivencia de la granulosa.', 'La atresia folicular depende del equilibrio local entre '
         'andrógeno y estrógeno.', 0.8, ['adulto'], SPEROFF),
        ('mol:testosterona', 'rec:AR', 'En cantidad moderada favorece el reclutamiento folicular; '
         'en exceso induce atresia y detiene la maduración.',
         'Es el mecanismo del ovario poliquistico en el hiperandrogenismo.', 0.9,
         ['adulto'], SPEROFF),
    ], synthesizes=['tis:teca', 'tis:granulosa', 'tis:cuerpo_luteo']),
    organ('org:testiculo', 'Testículo', 'Testis', [3.2, 43.5, 1.9], 'xy', 'ambos', [
        ('mol:testosterona', 'rec:AR', 'Concentración intratesticular muy superior a la plasmática; '
         'es imprescindible para la espermatogénesis.',
         'La testosterona exógena suprime la producción intratesticular y causa infertilidad, al '
         'contrario de lo que muchos esperan.', 1, ['pubertad', 'adulto'], MOORADIAN),
    ], synthesizes=['tis:leydig']),
    organ('org:prostata', 'Próstata', 'Prostate', [0, 47.5, 1.7], 'xy', 'ambos', [
        ('mol:dht', 'rec:AR', 'Crecimiento y mantenimiento del epitelio glandular; es el andrógeno '
         'dominante en este tejido por la 5α-reductasa tipo 2 local.',
         'La hiperplasia benigna y el cáncer de próstata dependen de esta señal: de ahi los '
         'inhibidores de 5α-reductasa y los antiandrógenos.', 1, ['pubertad', 'adulto'], MOORADIAN),
    ], synthesizes=['tis:prostata_estroma']),
    organ('org:genitales_externos', 'Genitales externos', 'External genitalia', [0, 44.2, 2],
          'ambos', 'diana', [
        ('mol:dht', 'rec:AR', 'Virilización en la vida fetal: fusión de los pliegues labioescrotales, '
         'formación de la uretra peneana y crecimiento del falo.',
         'El déficit de 5α-reductasa tipo 2 produce genitales ambiguos en el 46,XY pese a tener '
         'testosterona normal.', 1, ['fetal', 'pubertad'], MILLER),
        ('mol:testosterona', 'rec:AR', 'Mantiene los conductos de Wolff: epidídimo, conducto '
         'deferente y vesiculas seminales.',
         'Distingue lo que depende de testosterona de lo que depende de dihidrotestosterona.', 0.9,
         ['fetal'], MILLER),
    ], synthesizes=['tis:piel_genital']),
    organ('org:piel', 'Piel y anejos', 'Skin and adnexa', [13.6, 70, 2.2], 'ambos', 'diana', [
        ('mol:dht', 'rec:AR', 'Estimula la glándula sebácea y transforma el vello en pelo terminal '
         'en las zonas androgenodependientes; en el cuero cabelludo con predisposición genética '
         'produce miniaturización del folículo.',
         'Acné, hirsutismo y alopecia androgénica pueden aparecer con andrógenos circulantes '
         'normales, porque lo que decide es la conversión local.', 1,
         ['pubertad', 'adulto'], MOORADIAN),
        ('mol:estradiol', 'rec:ERa', 'Mantiene el grosor dermico, el colageno y la hidratación.',
         'Su caida en el climaterio se asocia a atrofia cutánea.', 0.7, ['climaterio'], HALL),
    ], synthesizes=['tis:foliculo_piloso']),
    organ('org:hueso', 'Hueso y cartílago de crecimiento', 'Bone and growth plate', [4.6, 24, 2.2],
          'ambos', 'diana', [
        ('mol:estradiol', 'rec:ERa', 'Frena la resorción osteoclastica, mantiene la masa ósea y '
         'cierra el cartílago de crecimiento en ambos sexos.',
         'El déficit de aromatasa cursa con talla alta y epifisis abiertas en el varon adulto; la '
         'menopausia acelera la pérdida de masa ósea.', 1,
         ['pubertad', 'adulto', 'climaterio'], MILLER),
        ('mol:testosterona', 'rec:AR', 'Aumenta el tamaño óseo perioestico y la masa muscular '
         'asociada.', 'Explica la diferencia de talla y de estructura ósea entre sexos.', 0.8,
         ['pubertad', 'adulto'], MOORADIAN),
    ], synthesizes=['tis:hueso_osteoblasto']),
    organ('org:musculo', 'Músculo esquelético', 'Skeletal muscle', [13.2, 59, 2.4], 'ambos', 'diana', [
        ('mol:testosterona', 'rec:AR', 'Aumenta la síntesis proteica y el número de núcleos por '
         'fibra, con hipertrofia dosis dependiente.',
         'Es el efecto buscado con los anabolizantes y el que se pierde en el hipogonadismo.', 1,
         ['pubertad', 'adulto'], MOORADIAN),
    ]),
    organ('org:adiposo', 'Tejido adiposo', 'Adipose tissue', [7.2, 56, 2.6], 'ambos', 'ambos', [
        ('mol:estradiol', 'rec:ERa', 'Favorece el deposito subcutaneo gluteofemoral.',
         'Marca el patron de distribución de la grasa según el perfil hormonal.', 0.8,
         ['pubertad', 'adulto'], HALL),
        ('mol:testosterona', 'rec:AR', 'Reduce la masa grasa total y favorece el patron visceral.',
         'El hipogonadismo se asocia a aumento de grasa visceral y resistencia a la insulina.', 0.8,
         ['adulto'], MOORADIAN),
    ], synthesizes=['tis:adiposo']),
    organ('org:higado', 'Hígado', 'Liver', [4.4, 66.5, 2.6], 'ambos', 'ambos', [
        ('mol:estradiol', 'rec:ERa', 'Aumenta la síntesis de SHBG, de factores de coagulación y de '
         'angiotensinogeno, y modifica el perfil lipidico.',
         'El primer paso hepático explica por que el estrógeno oral eleva más la SHBG y el riesgo '
         'trombótico que la vía transdermica.', 1, ['adulto'], SPEROFF),
        ('mol:testosterona', 'rec:AR', 'Reduce la síntesis de SHBG.',
         'Al bajar la SHBG aumenta la fracción libre de los andrógenos, lo que amplifica el efecto.',
         0.7, ['adulto'], MOORADIAN),
    ], synthesizes=['tis:hepatocito']),
    organ('org:rinon', 'Riñón', 'Kidney', [6.6, 61.5, 1.8], 'ambos', 'diana', [
        ('mol:aldosterona', 'rec:MR', 'Aumenta la reabsorción de sodio y la excreción de potasio e '
         'hidrogeniones en el tubulo colector.',
         'Su exceso produce hipertensión con hipopotasemia y alcalosis metabólica.', 1,
         ['adulto'], MILLER),
        ('mol:doc', 'rec:MR', 'Actividad mineralocorticoide propia cuando se acumula.',
         'Es la causa de la hipertensión en los déficits de 11β-hidroxilasa y de 17α-hidroxilasa.',
         0.8, ['adulto'], MILLER),
    ]),
    organ('org:endotelio', 'Corazón y vasos', 'Heart and vessels', [-2.6, 71.5, 2.2], 'ambos', 'diana', [
        ('mol:estradiol', 'rec:ERa', 'Favorece la vasodilatación dependiente de oxido nitrico y '
         'mejora el perfil lipidico.',
         'La ventana de oportunidad cardiovascular explica por que el momento de iniciar la terapia '
         'hormonal cambia el balance de riesgo.', 0.9, ['adulto', 'climaterio'], SPEROFF),
    ]),
    organ('org:suprarrenal', 'Glándula suprarrenal', 'Adrenal gland', [3.4, 64.5, 1.5],
          'ambos', 'sintesis', [
        ('mol:cortisol', 'rec:GR', 'Retroalimentación negativa sobre la propia corteza a través del '
         'eje hipotálamo-hipófisis.',
         'Su interrupción brusca tras tratamiento prolongado produce insuficiencia suprarrenal.', 0.7,
         ['adulto'], MILLER),
    ], synthesizes=['tis:glomerulosa', 'tis:fasciculada', 'tis:reticular']),
    organ('org:placenta', 'Placenta', 'Placenta', [0, 55.5, 2.4], 'xx', 'sintesis', [
        ('mol:progesterona', 'rec:PR', 'Mantiene la quiescencia uterina durante toda la gestación.',
         'La caida funcional de la señal de progesterona participa en el inicio del parto; es la '
         'diana de la mifepristona.', 1, ['gestacion'], SPEROFF),
    ], synthesizes=['tis:sincitiotrofoblasto']),
    organ('org:laringe', 'Laringe', 'Larynx', [0, 85.8, 1.4], 'ambos', 'diana', [
        ('mol:testosterona', 'rec:AR', 'Alarga las cuerdas vocales y engrosa el cartílago tiroides.',
         'El cambio de voz de la pubertad masculina es irreversible.', 0.9, ['pubertad'], MOORADIAN),
    ]),
]


def main():
    receptors = []
    for r in RECEPTORS:
        receptors.append(dict(
            id=r['id'], gene=r['gene'],
            names={'es': r['es'], 'en': r['en'], 'corto': r['corto']},
            **{'class': r['cls']},
            isoforms=r['isoforms'], mechanism=r['mechanism'],
            ligands=[dict(mol=m, kind=k) for m, k in r['ligands']],
            source=r['source'],
        ))
    with open(os.path.join(DATA, 'receptors.json'), 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(receptors, ensure_ascii=False, separators=(',', ':')))
    with open(os.path.join(DATA, 'organs.json'), 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(ORGANS, ensure_ascii=False, separators=(',', ':')))

    path = os.path.join(DATA, 'readings.json')
    with open(path, encoding='utf-8') as fh:
        readings = json.load(fh)
    known = {r['id'] for r in readings}
    for r in EXTRA_READINGS:
        if r['id'] not in known:
            readings.append(r)
    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(readings, ensure_ascii=False, separators=(',', ':')))

    targets = sum(len(o['targets']) for o in ORGANS)
    print('  %d órganos con %d efectos, %d receptores, %d lecturas'
          % (len(ORGANS), targets, len(receptors), len(readings)))


if __name__ == '__main__':
    main()
