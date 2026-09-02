#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera src/data/molecules/*.json desde el manifiesto.

Verificacion en dos puertas antes de escribir nada:
  1. La formula molecular que calcula RDKit debe coincidir con la esperada.
  2. Si la entrada trae clave InChI de referencia, la calculada debe coincidir.
Una entrada que falle cualquiera de las dos no se escribe y el script termina
con error: ninguna molecula incorrecta llega al artefacto.

La conformacion 3D se genera con ETKDG v3 y se relaja con MMFF94s. Es una
conformacion calculada, igual que la que publica PubChem, y asi queda declarado
en el campo 'conformer' de cada ficha. tools/fetch-pubchem.js sustituye estas
conformaciones por las de PubChem cuando hay acceso a la red.
"""
import json, os, sys, importlib.util
import numpy as np
from rdkit import Chem, RDLogger
from rdkit.Chem import AllChem, rdMolDescriptors, Descriptors

RDLogger.DisableLog('rdApp.*')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'src', 'data', 'molecules')
SEED = 0xA71A5

spec = importlib.util.spec_from_file_location('manifest', os.path.join(ROOT, 'tools', 'molecules-manifest.py'))
manifest = importlib.util.module_from_spec(spec)
spec.loader.exec_module(manifest)

# Nucleo esteroide en orden de numeracion C1..C17. Admite heteroatomo en las
# posiciones 1-4 (4-azaesteroides), anillo A aromatico (estrogenos) y ausencia
# de C19 (19-nor): por eso los enlaces son '~' y los atomos permiten N.
CORE_SMARTS = ('[#6,#7,#8]1~[#6,#7,#8]~[#6,#7,#8]~[#6,#7,#8]~[#6]2~[#6]~[#6]~[#6]3~[#6](~[#6]~1~2)'
               '~[#6]~[#6]~[#6]4~[#6]~3~[#6]~[#6]~[#6]~4')
CORE = Chem.MolFromSmarts(CORE_SMARTS)

RINGS = {'A': [1, 2, 3, 4, 5, 10], 'B': [5, 6, 7, 8, 9, 10],
         'C': [8, 9, 11, 12, 13, 14], 'D': [13, 14, 15, 16, 17]}

GROUP_SMARTS = [
    ('hidroxilo', '[OX2H][#6]'),
    ('cetona', '[#6][CX3](=O)[#6]'),
    ('aldehido', '[CX3H1](=O)[#6]'),
    ('ester', '[CX3](=[OX1])[OX2][#6]'),
    ('lactona', '[C;R](=[OX1])[O;R]'),
    ('eter', '[OD2]([#6])[#6]'),
    ('sulfato', '[OX2][SX4](=[OX1])(=[OX1])[OX2H,OX1-]'),
    ('sulfoxido', '[#6][SX3](=[OX1])[#6]'),
    ('tioester', '[#6][SX2][CX3](=[OX1])'),
    ('etinilo', '[CX2]#[CX2H1,CX2]'),
    ('nitrilo', '[NX1]#[CX2]'),
    ('amida', '[NX3][CX3](=[OX1])'),
    ('nitro', '[NX3](=O)=O'),
    ('halogeno', '[F,Cl,Br,I]'),
    ('amina_terciaria', '[NX3;H0;!$(NC=O)]'),
    ('fenol', '[OX2H]c'),
    ('trifluorometilo', '[CX4](F)(F)F'),
    ('ciclopropano', '[CX4;R3]1[CX4;R3][CX4;R3]1'),
]
GROUP_QUERIES = [(name, Chem.MolFromSmarts(s)) for name, s in GROUP_SMARTS]


def canonical_pose(conf_positions):
    """Centra en el centroide y alinea el eje mayor con X: todas las moleculas
    entran a escena con la misma pose, lo que hace comparables las vistas."""
    p = conf_positions - conf_positions.mean(axis=0)
    cov = np.cov(p.T)
    vals, vecs = np.linalg.eigh(cov)
    order = np.argsort(vals)[::-1]
    R = vecs[:, order].T
    if np.linalg.det(R) < 0:
        R[2] = -R[2]
    return p @ R.T


def heavy_degree(atom):
    return sum(1 for nb in atom.GetNeighbors() if nb.GetSymbol() != 'H')


def pick_core_match(mol, matches):
    """Entre varias coincidencias del nucleo elige la que respeta la numeracion
    convencional: metilo angular en C13, oxigeno en C3 y sustitucion en C17."""
    best, best_score = None, -1e9
    for match in matches:
        pos = {i + 1: idx for i, idx in enumerate(match)}
        core_set = set(match)
        score = 0
        a13 = mol.GetAtomWithIdx(pos[13])
        for nb in a13.GetNeighbors():
            if nb.GetIdx() not in core_set and nb.GetSymbol() == 'C':
                score += 6 if heavy_degree(nb) == 1 else 3
        a10 = mol.GetAtomWithIdx(pos[10])
        for nb in a10.GetNeighbors():
            if nb.GetIdx() not in core_set and nb.GetSymbol() == 'C' and heavy_degree(nb) == 1:
                score += 4
        for nb in mol.GetAtomWithIdx(pos[3]).GetNeighbors():
            if nb.GetIdx() not in core_set and nb.GetSymbol() == 'O':
                score += 5
        for nb in mol.GetAtomWithIdx(pos[17]).GetNeighbors():
            if nb.GetIdx() not in core_set:
                score += 2
        # El anillo A aromatico de los estrogenos ancla el extremo C1-C4.
        if all(mol.GetAtomWithIdx(pos[i]).GetIsAromatic() for i in (1, 2, 3, 4)):
            score += 3
        if score > best_score:
            best, best_score = match, score
    return best


def annotate_steroid(mol):
    matches = mol.GetSubstructMatches(CORE, uniquify=True, useChirality=False)
    if not matches:
        return None
    match = pick_core_match(mol, matches)
    pos = {i + 1: idx for i, idx in enumerate(match)}
    core_set = set(match)
    numbering = {}
    for number, idx in pos.items():
        numbering[idx] = number

    # C18 (metilo sobre C13) y C19 (metilo sobre C10).
    for number, anchor in ((18, 13), (19, 10)):
        for nb in mol.GetAtomWithIdx(pos[anchor]).GetNeighbors():
            if nb.GetIdx() in core_set or nb.GetSymbol() != 'C':
                continue
            if heavy_degree(nb) == 1 and nb.GetIdx() not in numbering:
                numbering[nb.GetIdx()] = number
                break

    # Cadena lateral: todo lo que cuelga de C17 y no es del nucleo.
    side, stack = [], [n.GetIdx() for n in mol.GetAtomWithIdx(pos[17]).GetNeighbors()
                       if n.GetIdx() not in core_set and n.GetIdx() not in numbering]
    seen = set(stack)
    while stack:
        idx = stack.pop()
        side.append(idx)
        for nb in mol.GetAtomWithIdx(idx).GetNeighbors():
            j = nb.GetIdx()
            if j not in core_set and j not in seen and j not in numbering:
                seen.add(j); stack.append(j)

    aromatic_a = all(mol.GetAtomWithIdx(pos[i]).GetIsAromatic() for i in RINGS['A'][:4])
    nor19 = 19 not in numbering.values()
    return {
        'numbering': numbering,
        'positions': pos,
        'rings': {k: [pos[i] for i in v] for k, v in RINGS.items()},
        'sideChain': sorted(side),
        'aromaticA': aromatic_a,
        'nor19': nor19,
    }


def describe_positions(mol, steroid):
    """Sustituyentes con su posicion esteroidea: '3-ceto', '17β-hidroxilo', etc.
    Es lo que alimenta el comparador de estructuras y el coloreado por grupos."""
    if not steroid:
        return []
    out = []
    pos = steroid['positions']
    core_set = set(pos.values())
    for number, idx in sorted(pos.items()):
        atom = mol.GetAtomWithIdx(idx)
        for nb in atom.GetNeighbors():
            j = nb.GetIdx()
            if j in core_set or steroid['numbering'].get(j) in (18, 19):
                continue
            sym = nb.GetSymbol()
            bond = mol.GetBondBetweenAtoms(idx, j)
            if sym == 'O':
                kind = 'ceto' if bond.GetBondTypeAsDouble() == 2 else (
                    'ester' if any(n.GetIdx() != idx and n.GetSymbol() == 'C' for n in nb.GetNeighbors())
                    else 'hidroxilo')
                out.append({'position': str(number), 'group': kind, 'atoms': [idx, j]})
            elif sym in ('F', 'Cl', 'Br', 'I'):
                out.append({'position': str(number), 'group': 'halogeno', 'atoms': [idx, j]})
            elif sym == 'N':
                out.append({'position': str(number), 'group': 'nitrogeno', 'atoms': [idx, j]})
            elif sym == 'S':
                out.append({'position': str(number), 'group': 'azufre', 'atoms': [idx, j]})
    # Insaturaciones del nucleo: Δ4, Δ5, Δ9(11), etc.
    for bond in mol.GetBonds():
        i, j = bond.GetBeginAtomIdx(), bond.GetEndAtomIdx()
        if i in core_set and j in core_set and bond.GetBondTypeAsDouble() == 2 and not bond.GetIsAromatic():
            ni, nj = steroid['numbering'][i], steroid['numbering'][j]
            out.append({'position': 'Δ%d(%d)' % (min(ni, nj), max(ni, nj)) if abs(ni - nj) != 1 else 'Δ%d' % min(ni, nj),
                        'group': 'doble enlace', 'atoms': [i, j]})
    return out


def build(entry):
    mol = Chem.MolFromSmiles(entry['smiles'])
    if mol is None:
        raise ValueError('SMILES invalido')
    formula = rdMolDescriptors.CalcMolFormula(mol)
    if formula != entry['formula']:
        raise ValueError('formula %s, esperada %s' % (formula, entry['formula']))
    inchikey = Chem.MolToInchiKey(mol)
    if entry.get('ik') and inchikey != entry['ik']:
        raise ValueError('clave InChI %s, esperada %s' % (inchikey, entry['ik']))

    molh = Chem.AddHs(mol)
    embedded = False
    for random_coords, small_rings, iters in ((False, True, 600), (True, False, 200)):
        params = AllChem.ETKDGv3()
        params.randomSeed = SEED
        params.useSmallRingTorsions = small_rings
        params.useRandomCoords = random_coords
        params.maxIterations = iters
        if AllChem.EmbedMolecule(molh, params) == 0:
            embedded = True
            break
    if embedded:
        try:
            AllChem.MMFFOptimizeMolecule(molh, mmffVariant='MMFF94s', maxIters=2000)
        except Exception:
            AllChem.UFFOptimizeMolecule(molh, maxIters=2000)
        conf = molh.GetConformer()
        xyz = canonical_pose(np.array([list(conf.GetAtomPosition(i)) for i in range(molh.GetNumAtoms())]))
    else:
        # Sin conformacion valida no se inventa geometria: la ficha existe, la
        # vista 3D queda desactivada y el aviso viaja en el propio registro.
        xyz = None

    steroid = annotate_steroid(molh)
    groups = []
    for name, query in GROUP_QUERIES:
        if query is None:
            continue
        hits = molh.GetSubstructMatches(query)
        if hits:
            groups.append({'type': name, 'atoms': sorted({i for h in hits for i in h})})

    elements = [a.GetSymbol() for a in molh.GetAtoms()]
    bonds_a, bonds_b, bonds_o = [], [], []
    for b in molh.GetBonds():
        bonds_a.append(b.GetBeginAtomIdx())
        bonds_b.append(b.GetEndAtomIdx())
        bonds_o.append(4 if b.GetIsAromatic() else int(b.GetBondTypeAsDouble()))

    numbering = [None] * molh.GetNumAtoms()
    if steroid:
        for idx, number in steroid['numbering'].items():
            numbering[idx] = number

    record = {
        'id': entry['id'],
        'names': {'es': entry['es'], 'en': entry['en'], 'corto': entry.get('corto', entry['es'])},
        'family': entry['family'],
        'role': entry['role'],
        'cid': entry.get('cid'),
        'formula': formula,
        'mw': round(Descriptors.MolWt(mol), 2),
        'inchikey': inchikey,
        'smiles': Chem.MolToSmiles(mol),
        'heavyAtoms': mol.GetNumHeavyAtoms(),
        'atoms': {
            'el': elements,
            'xyz': [int(round(v * 1000)) for v in xyz.flatten()] if xyz is not None else [],
            'n': numbering,
        },
        'bonds': {'a': bonds_a, 'b': bonds_b, 'order': bonds_o},
        'groups': groups,
        'conformer': {
            'kind': 'rdkit_etkdgv3_mmff94s' if xyz is not None else 'none',
            'note': ('Conformacion calculada (ETKDG v3 + MMFF94s, semilla fija). '
                     'Pendiente de sustituir por la conformacion 3D de PubChem.'
                     if xyz is not None else
                     'Sin conformacion 3D: la geometria de distancias no converge para esta '
                     'estructura. Ficha disponible sin vista 3D hasta obtener la conformacion '
                     'de PubChem.'),
        },
        'source': [{
            'db': 'PubChem', 'id': 'CID %s' % entry.get('cid'),
            'url': 'https://pubchem.ncbi.nlm.nih.gov/compound/%s' % entry.get('cid'),
            'verified': bool(entry.get('ik')),
            'note': ('Clave InChI comprobada contra el valor de referencia.'
                     if entry.get('ik') else
                     'CID y clave InChI pendientes de comprobacion en linea.'),
        }],
    }
    if steroid:
        record['steroid'] = {
            'rings': steroid['rings'],
            'sideChain': steroid['sideChain'],
            'aromaticA': steroid['aromaticA'],
            'nor19': steroid['nor19'],
            'substituents': describe_positions(molh, steroid),
        }
    return record


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.json'):
            os.remove(os.path.join(OUT, f))
    ok, failed, bytes_total, no3d = 0, [], 0, []
    for entry in manifest.ALL:
        try:
            record = build(entry)
        except Exception as err:
            failed.append((entry['id'], str(err)))
            continue
        name = entry['id'].replace(':', '_') + '.json'
        data = json.dumps(record, ensure_ascii=False, separators=(',', ':'))
        with open(os.path.join(OUT, name), 'w', encoding='utf-8') as fh:
            fh.write(data)
        bytes_total += len(data.encode('utf-8'))
        ok += 1
        flag = '' if entry.get('ik') else '  clave InChI sin verificar'
        if record['conformer']['kind'] == 'none':
            flag += '  SIN 3D'
            no3d.append(entry['id'])
        core = 'esteroide' if 'steroid' in record else 'no esteroide'
        print('  %-32s %-12s %5d atomos  %-13s%s' % (entry['id'], record['formula'],
              len(record['atoms']['el']), core, flag))
    print('\n  %d moleculas escritas, %.1f KB' % (ok, bytes_total / 1024))
    if no3d:
        print('  sin conformacion 3D (%d): %s' % (len(no3d), ', '.join(no3d)))
    if failed:
        print('\n  FALLOS:')
        for mid, err in failed:
            print('   %-30s %s' % (mid, err))
        sys.exit(1)


if __name__ == '__main__':
    main()
