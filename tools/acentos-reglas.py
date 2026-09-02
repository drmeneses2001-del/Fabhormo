#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Aplica las reglas ortograficas regulares del espanol a las cadenas de texto.

Terminaciones que siempre llevan tilde en singular y la pierden en plural
(-cion, -sion), y sufijos esdrujulos habituales (-logia, -grafia, -atico,
-ogico). Complementa al diccionario de palabras: entre los dos cubren el
vocabulario sin tener que enumerarlo entero.

No toca cadenas en ingles (citas bibliograficas), ni rutas, ni identificadores.
"""
import os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

RULES = [
    (re.compile(r'([a-zñáéíóú])cion\b'), r'\1ción'),
    (re.compile(r'([a-zñáéíóú])sion\b'), r'\1sión'),
    (re.compile(r'([a-zñ])logia\b'), r'\1logía'),
    (re.compile(r'([a-zñ])logias\b'), r'\1logías'),
    (re.compile(r'([a-zñ])grafia\b'), r'\1grafía'),
    (re.compile(r'([a-zñ])atico\b'), r'\1ático'),
    (re.compile(r'([a-zñ])atica\b'), r'\1ática'),
    (re.compile(r'([a-zñ])aticos\b'), r'\1áticos'),
    (re.compile(r'([a-zñ])aticas\b'), r'\1áticas'),
    (re.compile(r'([a-zñ])ogico\b'), r'\1ógico'),
    (re.compile(r'([a-zñ])ogica\b'), r'\1ógica'),
    (re.compile(r'([a-zñ])ogicos\b'), r'\1ógicos'),
    (re.compile(r'([a-zñ])ogicas\b'), r'\1ógicas'),
    (re.compile(r'\bOrganizacion\b'), 'Organización'),
    (re.compile(r'\bRevision\b'), 'Revisión'),
    (re.compile(r'\bVision\b'), 'Visión'),
]

# Marcas de que la cadena es una cita en ingles y no debe tocarse.
ENGLISH = re.compile(r'\b(the|of|and|et al|receptor|deficiency|hydroxylase|clinical|'
                     r'practice|guideline|steroidogenesis|physiology|Endocrinol|'
                     r'Contraception|Maturitas|Elsevier|Wolters|MDText|eds)\b')
STR_RE = re.compile(r"(?P<q>['\"])(?P<body>(?:\\.|(?!(?P=q))[^\\\n])*)(?P=q)")
SKIP = re.compile(r"^(#|/|[a-z]+:[A-Za-z0-9_]*$|https?://|\d)")


def process(path):
    src = open(path, encoding='utf-8').read()
    changed = [0]

    def repl(m):
        body = m.group('body')
        if not body or SKIP.match(body) or ENGLISH.search(body):
            return m.group(0)
        new = body
        for pattern, rep in RULES:
            new = pattern.sub(rep, new)
        if new != body:
            changed[0] += 1
        return m.group('q') + new + m.group('q')

    out = STR_RE.sub(repl, src)
    if out != src:
        open(path, 'w', encoding='utf-8').write(out)
    return changed[0]


def main():
    total, files = 0, 0
    for base, dirs, names in os.walk(os.path.join(ROOT, 'src')):
        dirs[:] = [d for d in dirs if d != 'data']
        for n in names:
            if n.endswith('.js'):
                c = process(os.path.join(base, n))
                if c:
                    files += 1
                    total += c
    for n in ['gen-pathway.py', 'gen-organs.py', 'gen-clinical.py']:
        c = process(os.path.join(ROOT, 'tools', n))
        if c:
            files += 1
            total += c
    print('  %d cadenas corregidas por regla en %d archivos' % (total, files))


if __name__ == '__main__':
    main()
