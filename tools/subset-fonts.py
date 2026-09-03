#!/usr/bin/env python3
"""Genera subconjuntos woff2 de las fuentes del atlas y los deja en raw/fonts/.

Las fuentes de origen son los paquetes @fontsource (licencia OFL) instalados como
devDependency. El subconjunto cubre latin basico + acentos del espanol + griego
usado en nomenclatura quimica + simbolos de flecha/comparacion/subindices.
"""
import os, subprocess, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'raw', 'fonts')
os.makedirs(OUT, exist_ok=True)

CHARS = (
    ''.join(chr(c) for c in range(0x20, 0x7F))          # ASCII imprimible
    + 'áéíóúüñÁÉÍÓÚÜÑ¿¡ªº'                              # espanol
    + 'àèìòùâêîôûäëïöçÀÈÉÊÔÇ'                           # frances/otros en citas
    + 'αβγΔδεκλμπρστφχψωΩΣΛΘ'                           # griego quimico
    + '→←↑↓↔⇄⇌⇒•·…–—«»“”‘’′″°±×÷≈≠≤≥∞√'                  # simbolos
    + '₀₁₂₃₄₅₆₇₈₉⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻'                         # sub/superindices
    + '△▲▼◆◇●○■□★☆✓✗†‡§¶©®™'                            # glifos de leyenda
)

FACES = [
    ('source-serif-4', 'latin', 600, 'AtlasSerif', 600),
    ('source-serif-4', 'latin', 400, 'AtlasSerif', 400),
    ('source-sans-3', 'latin', 400, 'AtlasSans', 400),
    ('source-sans-3', 'latin', 600, 'AtlasSans', 600),
    ('jetbrains-mono', 'latin', 400, 'AtlasMono', 400),
]

def main():
    txt = os.path.join(OUT, '_charset.txt')
    with open(txt, 'w', encoding='utf-8') as f:
        f.write(CHARS)
    manifest, total = [], 0
    for pkg, subset, weight, family, css_weight in FACES:
        src = os.path.join(ROOT, 'node_modules', '@fontsource', pkg, 'files',
                           '%s-%s-%d-normal.woff2' % (pkg, subset, weight))
        if not os.path.exists(src):
            print('FALTA ' + src, file=sys.stderr); sys.exit(1)
        dst = os.path.join(OUT, '%s-%d.woff2' % (family, css_weight))
        subprocess.run([sys.executable, '-m', 'fontTools.subset', src,
                        '--text-file=' + txt, '--flavor=woff2',
                        '--layout-features=kern,liga,calt',
                        '--no-hinting', '--desubroutinize',
                        '--output-file=' + dst], check=True)
        size = os.path.getsize(dst); total += size
        manifest.append({'family': family, 'weight': css_weight,
                         'file': os.path.relpath(dst, ROOT), 'bytes': size,
                         'source': '@fontsource/%s (SIL Open Font License 1.1)' % pkg})
        print('%s %d: %d -> %d bytes' % (family, css_weight, os.path.getsize(src), size))
    with open(os.path.join(OUT, 'manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=2)
    print('total subconjuntos: %d bytes (%d en base64)' % (total, total * 4 // 3))

if __name__ == '__main__':
    main()
