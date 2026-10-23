"""Exporte les assets du pack utilisés par le style « Nature » de Notely Hub, en variables CSS (data URI WebP).
Usage : python3 tools/nature-assets.py <dossier src de Notely Hub>   → <src>/skin-nature-assets.css
"""
import base64, io, os, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = sys.argv[1] if len(sys.argv) > 1 else '.'


def webp(rel, q=80):
    im = Image.open(os.path.join(ROOT, rel)).convert('RGBA')
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=q, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode(), im.size


B = 'extraits-concept/botanique/'
ASSETS = {
    'bouquet': B + 'bouquet-pinceau-haut@2x.png', 'branche': B + 'branche-palettes-droite@2x.png',
    'feuille': B + 'feuille-roue-haut@2x.png', 'vigne': B + 'vigne-harmonie-gauche@2x.png',
    'couronne': B + 'couronne-roue-bas@2x.png', 'palettes': B + 'bouquet-palettes-haut@2x.png',
    'tache1': 'png/couleur/masques/masque-tache-1@1x.png', 'tache2': 'png/couleur/masques/masque-tache-2@1x.png',
    'tache3': 'png/couleur/masques/masque-tache-3@1x.png', 'pastille': 'png/couleur/masques/masque-pastille-1@1x.png',
}
lines = ['/* Style Nature : images du pack design/nature-anthracite (feuillages détourés du concept, masques de taches).',
         '   Généré par design/nature-anthracite/tools/nature-assets.py, ne pas éditer à la main. */',
         ':root {']
for k, rel in ASSETS.items():
    u, (w, h) = webp(rel)
    lines.append(f'  --nt-{k}: url("{u}"); /* {w}×{h} */')
lines.append('}')
out = os.path.join(DEST, 'skin-nature-assets.css')
open(out, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print(out, os.path.getsize(out) // 1024, 'KB')
