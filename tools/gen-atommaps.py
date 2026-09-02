#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Calcula la correspondencia atomo a atomo de cada reaccion de la via.

Para cada par sustrato-producto busca la subestructura comun maxima y anota que
atomos se conservan, cuales desaparecen y cuales aparecen. Es lo que permite que
la vista del paso enzimatico anime la transformacion en vez de mostrar dos
dibujos sueltos, y que el coloreado 'por cambio' senale exactamente los atomos
que la enzima toca.

El emparejamiento se ancla primero en la numeracion esteroidea (misma posicion
del nucleo = mismo atomo) y solo despues se completa con la subestructura comun.
"""
import json, os, sys
from rdkit import Chem, RDLogger
from rdkit.Chem import rdFMCS

RDLogger.DisableLog('rdApp.*')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'src', 'data')


def load_molecules():
    out = {}
    folder = os.path.join(DATA, 'molecules')
    for name in os.listdir(folder):
        if not name.endswith('.json'):
            continue
        with open(os.path.join(folder, name), encoding='utf-8') as fh:
            rec = json.load(fh)
        out[rec['id']] = rec
    return out


def heavy_index_map(record):
    """Indices de atomos pesados en el orden del registro, y su numeracion."""
    heavy = [i for i, el in enumerate(record['atoms']['el']) if el != 'H']
    return heavy, record['atoms'].get('n') or []


def mol_from_record(record):
    """Reconstruye la molecula con enlaces a partir del registro guardado, sin
    hidrogenos: es lo que compara la subestructura comun."""
    rw = Chem.RWMol()
    old_to_new = {}
    for i, el in enumerate(record['atoms']['el']):
        if el == 'H':
            continue
        old_to_new[i] = rw.AddAtom(Chem.Atom(el))
    orders = {1: Chem.BondType.SINGLE, 2: Chem.BondType.DOUBLE,
              3: Chem.BondType.TRIPLE, 4: Chem.BondType.AROMATIC}
    for a, b, o in zip(record['bonds']['a'], record['bonds']['b'], record['bonds']['order']):
        if a not in old_to_new or b not in old_to_new:
            continue
        rw.AddBond(old_to_new[a], old_to_new[b], orders.get(o, Chem.BondType.SINGLE))
    mol = rw.GetMol()
    try:
        Chem.SanitizeMol(mol, Chem.SanitizeFlags.SANITIZE_ALL ^ Chem.SanitizeFlags.SANITIZE_PROPERTIES)
    except Exception:
        pass
    return mol, {v: k for k, v in old_to_new.items()}


def pair_atoms(sub, prod):
    pairs = {}
    # 1. Ancla por numeracion esteroidea.
    sn = sub['atoms'].get('n') or []
    pn = prod['atoms'].get('n') or []
    by_number = {}
    for i, number in enumerate(pn):
        if number:
            by_number[number] = i
    for i, number in enumerate(sn):
        if number and number in by_number:
            pairs[i] = by_number[number]

    # 2. Completa con la subestructura comun maxima sobre atomos pesados.
    ms, ms_back = mol_from_record(sub)
    mp, mp_back = mol_from_record(prod)
    try:
        res = rdFMCS.FindMCS([ms, mp], timeout=8, matchValences=False,
                             ringMatchesRingOnly=True, completeRingsOnly=False,
                             atomCompare=rdFMCS.AtomCompare.CompareElements,
                             bondCompare=rdFMCS.BondCompare.CompareAny)
    except Exception:
        res = None
    if res and res.numAtoms:
        query = Chem.MolFromSmarts(res.smartsString)
        hit_s = ms.GetSubstructMatch(query)
        hit_p = mp.GetSubstructMatch(query)
        if hit_s and hit_p and len(hit_s) == len(hit_p):
            for a, b in zip(hit_s, hit_p):
                orig_s, orig_p = ms_back[a], mp_back[b]
                if orig_s not in pairs and orig_p not in pairs.values():
                    pairs[orig_s] = orig_p
    return pairs


def main():
    molecules = load_molecules()
    path = os.path.join(DATA, 'reactions.json')
    with open(path, encoding='utf-8') as fh:
        reactions = json.load(fh)

    mapped, skipped = 0, []
    for r in reactions:
        sub = molecules.get(r['substrate'])
        prod = molecules.get(r['product'])
        if not sub or not prod or not sub['atoms']['xyz'] or not prod['atoms']['xyz']:
            skipped.append(r['id'])
            continue
        pairs = pair_atoms(sub, prod)
        sub_heavy = [i for i, el in enumerate(sub['atoms']['el']) if el != 'H']
        prod_heavy = [i for i, el in enumerate(prod['atoms']['el']) if el != 'H']
        matched_prod = set(pairs.values())
        removed = [i for i in sub_heavy if i not in pairs]
        added = [i for i in prod_heavy if i not in matched_prod]
        r['atomMap'] = {
            'pairs': [[a, b] for a, b in sorted(pairs.items())],
            'removed': removed,
            'added': added,
        }
        mapped += 1
        print('  %-28s %3d conservados  %2d salen  %2d entran' %
              (r['id'], len(pairs), len(removed), len(added)))

    with open(path, 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(reactions, ensure_ascii=False, separators=(',', ':')))
    size = os.path.getsize(path) / 1024
    print('\n  %d reacciones con correspondencia atomica, %.1f KB' % (mapped, size))
    if skipped:
        print('  sin correspondencia (falta conformacion 3D): %s' % ', '.join(skipped))


if __name__ == '__main__':
    main()
