"""Découpe dans l'image concept tout ce qui ne se redessine pas fidèlement en vecteur.

Entrée : reference/concept-original.png (1536×1024, raster unique, pas de calques).
Sortie : extraits-concept/<famille>/<nom>.png (fond transparent) en taille native
et en @2x (agrandissement Lanczos : plus confortable, mais aucun détail ajouté).

Le fond anthracite n'est pas uniforme (vignettage 30 à 50), donc on estime un fond
local par convolution normalisée sur les pixels neutres, puis on détoure par écart
au fond (luminance + chroma) avec bouchage des trous et bord adouci.

Usage : python3 tools/extract.py   (depuis design/nature-anthracite)
"""
import json, math, os
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'reference', 'concept-original.png')
OUT = os.path.join(ROOT, 'extraits-concept')

IM = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
H, W, _ = IM.shape


def local_background():
    mx, mn = IM.max(2), IM.min(2)
    neutral = ((mx - mn) < 9) & (mx > 18) & (mx < 62)
    w = neutral.astype(np.float32)
    bg = np.zeros_like(IM)
    den = ndi.gaussian_filter(w, 28) + 1e-4
    for c in range(3):
        bg[..., c] = ndi.gaussian_filter(IM[..., c] * w, 28) / den
    return bg


BG = local_background()


def smooth(t0, t1, x):
    t = np.clip((x - t0) / (t1 - t0), 0, 1)
    return t * t * (3 - 2 * t)


def difference(box, dark_w=0.55):
    x0, y0, x1, y1 = box
    c = IM[y0:y1, x0:x1]
    b = BG[y0:y1, x0:x1]
    light = np.clip(c - b, 0, None).max(2)
    dark = np.clip(b - c, 0, None).max(2)
    chroma = (c.max(2) - c.min(2)) - (b.max(2) - b.min(2))
    return light + dark_w * dark + 1.6 * np.clip(chroma, 0, None)


def cut(box, t0=9, t1=26, keep='center', min_px=60, circle=None, fill=True,
        exclude=(), feather=0.8, solid=None, dark_w=0.55):
    """Détoure une zone. keep: 'center' (composante au centre), 'big' (toutes > min_px)."""
    x0, y0, x1, y1 = box
    d = difference(box, dark_w)
    a = smooth(t0, t1, d)
    yy, xx = np.mgrid[y0:y1, x0:x1]
    if circle:
        cx, cy, r = circle
        rr = np.hypot(xx - cx, yy - cy)
        a *= smooth(r + 1.5, r - 1.5, rr)
    for ex in exclude:
        if len(ex) == 3:  # disque (cx, cy, r)
            a[np.hypot(xx - ex[0], yy - ex[1]) < ex[2]] = 0
            continue
        ex0, ey0, ex1, ey1 = ex
        a[(xx >= ex0) & (xx < ex1) & (yy >= ey0) & (yy < ey1)] = 0
    m = a > 0.45
    lab, n = ndi.label(m)
    if n:
        if keep == 'center':
            cy_, cx_ = (y1 - y0) // 2, (x1 - x0) // 2
            l = lab[cy_, cx_]
            if l == 0:
                # composante la plus proche du centre
                ys, xs = np.nonzero(lab)
                i = np.argmin((ys - cy_) ** 2 + (xs - cx_) ** 2)
                l = lab[ys[i], xs[i]]
            m = lab == l
        else:
            sizes = ndi.sum(m, lab, range(1, n + 1))
            m = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= min_px])
    if fill:
        m = ndi.binary_fill_holes(m)
    if solid is not None:
        m = m | solid
    grown = ndi.binary_dilation(m, iterations=2)
    a = np.where(m, np.maximum(a, 1.0), np.where(grown, a, 0))
    if feather:
        a = np.clip(ndi.gaussian_filter(a, feather) * 1.08, 0, 1) * grown
    rgba = np.dstack([IM[y0:y1, x0:x1], a * 255]).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')
    bb = img.getbbox()
    return img.crop(bb) if bb else img


def disc(box, cx, cy, r, feather=1.2):
    """Découpe circulaire franche (vignettes, loupe)."""
    x0, y0, x1, y1 = box
    yy, xx = np.mgrid[y0:y1, x0:x1]
    a = smooth(r + feather, r - feather, np.hypot(xx - cx, yy - cy))
    rgba = np.dstack([IM[y0:y1, x0:x1], a * 255]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


def ring(cx, cy, r0, r1, pad=4):
    box = (int(cx - r1 - pad), int(cy - r1 - pad), int(cx + r1 + pad), int(cy + r1 + pad))
    x0, y0, x1, y1 = box
    yy, xx = np.mgrid[y0:y1, x0:x1]
    rr = np.hypot(xx - cx, yy - cy)
    a = smooth(r0 - 1.2, r0 + 1.2, rr) * smooth(r1 + 1.2, r1 - 1.2, rr)
    rgba = np.dstack([IM[y0:y1, x0:x1], a * 255]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


def rounded(box, r=8):
    """Tuile carrée à coins arrondis (formes, textures, vignettes de palette)."""
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    yy, xx = np.mgrid[0:h, 0:w] + 0.5
    dx = np.clip(np.maximum(r - xx, xx - (w - r)), 0, None)
    dy = np.clip(np.maximum(r - yy, yy - (h - r)), 0, None)
    a = smooth(r + 0.8, r - 0.8, np.hypot(dx, dy))
    rgba = np.dstack([IM[y0:y1, x0:x1], a * 255]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


MANIFEST = []


def save(img, fam, name, note=''):
    d = os.path.join(OUT, fam)
    os.makedirs(d, exist_ok=True)
    img.save(os.path.join(d, name + '.png'), optimize=True)
    big = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
    big.save(os.path.join(d, name + '@2x.png'), optimize=True)
    MANIFEST.append({'fichier': f'extraits-concept/{fam}/{name}.png', 'taille': list(img.size), 'note': note})


def dab_at(cx, cy, r, name, fam='taches-pastel', t0=10, t1=28, note='', dark_w=0.55):
    box = (cx - r, cy - r, cx + r, cy + r)
    save(cut(box, t0, t1, keep='center', circle=(cx, cy, r - 1), dark_w=dark_w), fam, name, note)


def main():
    # --- Taches de pastel : récentes / favorites autour de la roue
    top = [(258, 105, 'ocre'), (311, 89, 'jaune-safran'), (366, 88, 'corail'), (419, 98, 'vieux-rose'),
           (465, 128, 'prune'), (507, 170, 'bleu-ciel'), (532, 218, 'bleu-azur')]
    for i, (x, y, n) in enumerate(top, 1):
        dab_at(x, y, 28 if 'bleu' in n else 25, f'roue-recente-{i:02d}-{n}', t0=14, t1=34, note='couronne haute de la roue', dark_w=0)
    bottom = [(199, 432, 'sable'), (230, 460, 'beige-rose'), (272, 481, 'rouge-brique'),
              (320, 489, 'vert-sauge'), (369, 490, 'bleu-roi')]
    for i, (x, y, n) in enumerate(bottom, 1):
        dab_at(x, y, 23, f'roue-favorite-{i:02d}-{n}', t0=14, t1=34, note='couronne basse de la roue', dark_w=0)

    # --- Historique (5×5, la 1re case est le bouton horloge)
    cols = [560, 602, 638, 678, 715]
    rows = [710, 752, 792, 832, 872]
    k = 0
    for j, y in enumerate(rows):
        for i, x in enumerate(cols):
            if i == 0 and j == 0:
                continue
            k += 1
            dab_at(x, y, 20, f'historique-{k:02d}', t0=8, t1=22, note='grille Color History')

    # --- Palettes (4 lignes × 5/6 taches)
    pal_rows = {'forest-dawn': (215, 6), 'autumn': (310, 5), 'mountain': (402, 6), 'earth': (497, 5)}
    xs = [745, 782, 820, 857, 895, 932]
    for name, (y, n) in pal_rows.items():
        for i in range(n):
            dab_at(xs[i], y, 21, f'palette-{name}-{i + 1}', t0=8, t1=22, note=f'palette {name}')

    # --- Variations
    for i, x in enumerate([1114, 1155, 1196, 1237, 1277, 1318], 1):
        dab_at(x, 825, 20, f'variation-{i}', note='bandeau Variations')
    # --- Rail des favoris
    for i, y in enumerate([644, 685, 725, 766, 806], 1):
        dab_at(1457, y, 18, f'favori-{i}', note='rail Accès rapide')

    # --- Roue chromatique : anneau peint du concept + couronne complète
    save(ring(341, 290, 104, 156), 'roue', 'anneau-peint-concept', 'anneau seul, fond transparent')
    save(disc((341 - 172, 290 - 172, 341 + 172, 290 + 172), 341, 290, 171), 'roue', 'roue-complete-concept',
         'roue + puits central + sélecteur (disque)')
    save(disc((341 - 106, 290 - 106, 341 + 106, 290 + 106), 341, 290, 105), 'roue', 'puits-triangle-concept',
         'centre : triangle teinte/saturation')
    save(disc((86, 726, 239, 879), 172, 783, 66), 'roue', 'mini-roue-harmonie-concept', 'disque du module Harmony')

    # --- Pinceau : trait d'aperçu + tuiles Forme / Texture / Dynamique
    save(cut((1062, 95, 1334, 145), 14, 40, keep='big', min_px=30, exclude=[(1290, 90, 1340, 112)]), 'pinceau', 'trait-crayon-naturel',
         'trait d\'aperçu du panneau Pinceau')
    formes = ['grain-poudre', 'ligne-fine', 'biseau-clair', 'biseau-ocre', 'plume-douce', 'pointe-effilee']
    fx = [(1067, 1118), (1125, 1166), (1172, 1214), (1221, 1262), (1268, 1311), (1318, 1360)]
    for n, (a, b) in zip(formes, fx):
        save(rounded((a, 386, b, 433), 6), 'pinceau', f'forme-{n}', 'tuile Forme')
    textures = ['poussiere', 'nuage-grains', 'eclat', 'fibres', 'griffures']
    tx = [(1067, 1118), (1129, 1180), (1191, 1242), (1251, 1301), (1311, 1361)]
    for n, (a, b) in zip(textures, tx):
        save(rounded((a, 472, b, 521), 6), 'pinceau', f'texture-{n}', 'tuile Texture')
    dyn = ['zigzag', 'pression', 'inclinaison', 'vitesse']
    dx = [(1067, 1108), (1121, 1162), (1176, 1217), (1229, 1270)]
    for n, (a, b) in zip(dyn, dx):
        save(rounded((a, 562, b, 602), 7), 'pinceau', f'dynamique-{n}', 'bouton Dynamique')

    # --- Vignettes de palettes (paysages peints)
    for n, y in [('forest-dawn', 165), ('autumn', 259), ('mountain', 352), ('earth', 446)]:
        save(rounded((620, y, 712, y + 76), 7), 'vignettes', f'paysage-{n}', 'vignette de palette')

    # --- Pipette : contenu de la loupe
    save(disc((919 - 80, 771 - 80, 919 + 80, 771 + 80), 919, 771, 76), 'pipette', 'loupe-feuille-concept',
         'image dans la loupe (sans cadre)')
    save(disc((919 - 86, 771 - 86, 919 + 86, 771 + 86), 919, 771, 84), 'pipette', 'loupe-complete-concept',
         'loupe avec cadre bronze')

    # --- Botanique (feuillages qui débordent des panneaux)
    # boîtes larges ; les panneaux (gris neutre) disparaissent d'eux-mêmes au détourage,
    # on retire seulement les petites composantes (texte, filets) et quelques zones nommées
    leaves = [
        ('bouquet-palettes-haut', (780, 14, 1010, 160), []),
        ('branche-palettes-droite', (950, 96, 1040, 250), []),
        ('bouquet-pinceau-haut', (1250, 8, 1410, 120), [(1060, 88, 1300, 150)]),
        ('liane-pinceau-droite', (1370, 50, 1442, 610), [(1436, 34, 1500, 476)]),
        ('feuilles-rail-droite', (1386, 220, 1536, 590), [(1436, 34, 1496, 476), (1424, 570, 1492, 890)]),
        ('couronne-roue-gauche', (10, 150, 215, 580), [(341, 290, 172), (199, 432, 30), (110, 125, 205, 410)]),
        ('couronne-roue-bas', (150, 460, 570, 590), [(341, 290, 172), (199, 432, 30), (230, 460, 30), (272, 481, 30), (320, 489, 30), (369, 490, 30), (417, 477, 30), (190, 520, 240, 580), (300, 540, 340, 570)]),
        ('feuille-roue-haut', (250, 6, 335, 70), [(341, 290, 172), (258, 105, 34)]),
        ('vigne-harmonie-gauche', (10, 596, 74, 950), []),
        ('feuilles-harmonie-bas-gauche', (30, 870, 185, 975), [(145, 885, 440, 940)]),
        ('bouquet-harmonie-droite', (355, 586, 512, 840), [(290, 650, 440, 780)]),
        ('bouquet-pipette', (780, 620, 1045, 880), []),
        ('feuilles-variations-gauche', (1005, 640, 1080, 770), []),
    ]
    for name, box, excl in leaves:
        if name == 'bouquet-pipette':
            # on vide la loupe et la barre hexa : seules les feuilles restent
            x0, y0, x1, y1 = box
            d = difference(box)
            a = smooth(10, 30, d)
            yy, xx = np.mgrid[y0:y1, x0:x1]
            a[np.hypot(xx - 919, yy - 771) < 89] = 0
            a[(xx >= 820) & (yy >= 850)] = 0
            m = a > 0.45
            lab, n = ndi.label(m)
            sizes = ndi.sum(m, lab, range(1, n + 1))
            m = np.isin(lab, [i + 1 for i, s in enumerate(sizes) if s >= 160])
            m = ndi.binary_fill_holes(m)
            a = np.clip(ndi.gaussian_filter(np.where(m, 1.0, a * ndi.binary_dilation(m, iterations=2)), 0.8) * 1.08, 0, 1)
            a[np.hypot(xx - 919, yy - 771) < 88] = 0
            rgba = np.dstack([IM[y0:y1, x0:x1], a * 255]).astype(np.uint8)
            img = Image.fromarray(rgba, 'RGBA')
            img = img.crop(img.getbbox())
        else:
            img = cut(box, 10, 30, keep='big', min_px=350, exclude=excl)
        save(img, 'botanique', name, 'feuillage détouré du concept')

    # --- Annotations manuscrites (craie)
    notes = [
        ('radial-color-picker', (28, 40, 176, 160), [(150, 95, 190, 170)]),
        ('couleurs-recentes', (44, 510, 236, 580), [(205, 500, 240, 530)]),
        ('harmonies-de-couleurs', (282, 940, 482, 1000)), ('historique-acces-rapide', (556, 928, 735, 990)),
        ('pipette-sur-le-board', (786, 628, 942, 688)), ('variations-rapides', (1080, 905, 1300, 968)),
        ('acces-rapide-favoris', (1382, 800, 1515, 990), [(1424, 570, 1492, 892)]),
    ]
    for name, box, *ex in notes:
        save(cut(box, 16, 46, keep='big', min_px=4, fill=False, feather=0.6, exclude=ex[0] if ex else ()),
             'annotations', name,
             'écriture à la craie + flèche')

    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(MANIFEST, f, ensure_ascii=False, indent=1)
    print(len(MANIFEST), 'extraits')


if __name__ == '__main__':
    main()
