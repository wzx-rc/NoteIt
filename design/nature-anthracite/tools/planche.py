"""Construit apercu/planche.html (planche d'aperçu de tout le pack) à partir des fichiers présents.
Puis : node tools/capture.mjs  → apercu/planche.png
"""
import glob, html, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)


def files(pattern):
    return sorted(p for p in glob.glob(pattern))


def label(p):
    b = os.path.basename(p)
    for suf in ('@1x.png', '@2x.png', '@4x.png', '-48.png', '.png'):
        if b.endswith(suf):
            return b[: -len(suf)]
    return b


def grid(paths, cls='', h=None, cap=True, src_fn=lambda p: p):
    out = []
    for p in paths:
        st = f' style="height:{h}px"' if h else ''
        out.append(f'<figure class="{cls}"><img src="../{src_fn(p)}"{st} loading="eager">'
                   + (f'<figcaption>{html.escape(label(p))}</figcaption>' if cap else '') + '</figure>')
    return '<div class="grid">' + ''.join(out) + '</div>'


def section(num, title, sub, body):
    return f'<section><header><span class="num">{num}</span><h2>{title}</h2><p>{sub}</p></header>{body}</section>'


tok = json.load(open('tokens/couleurs.json', encoding='utf-8'))
swatch = ''.join(f'<div class="sw"><i style="background:{v}"></i><b>{k}</b><em>{v}</em></div>' for k, v in tok['interface'].items())
pig = ''.join(f'<div class="sw"><i style="background:{v}"></i><b>{k}</b><em>{v}</em></div>' for k, v in tok['pigments'].items())

S = []
S.append(section('01', 'Roue chromatique', 'Vecteur : touches de pastel posées une à une, teintes et bords irréguliers. À droite, la roue extraite du concept.',
    '<div class="row">'
    '<figure class="hero"><img src="../png/couleur/roue/roue-pastel-complete@2x.png" style="width:440px"><figcaption>roue-pastel-complete.svg</figcaption></figure>'
    '<figure class="hero"><img src="../extraits-concept/roue/roue-complete-concept@2x.png" style="width:440px"><figcaption>extrait du concept</figcaption></figure>'
    '<div class="col">'
    '<figure><img src="../png/couleur/roue/anneau-pastel@1x.png" style="width:200px"><figcaption>anneau-pastel.svg</figcaption></figure>'
    '<figure><img src="../png/couleur/roue/selecteur-triangle@1x.png" style="width:150px"><figcaption>selecteur-triangle.svg</figcaption></figure>'
    '</div><div class="col">'
    '<figure><img src="../png/couleur/roue/mini-roue-harmonie@1x.png" style="width:150px"><figcaption>mini-roue-harmonie.svg</figcaption></figure>'
    '<figure><img src="../png/couleur/roue/orbite-harmonie@1x.png" style="width:180px"><figcaption>orbite-harmonie.svg</figcaption></figure>'
    '</div></div>'))
S.append(section('02', 'Taches de pastel', 'Vecteur : 46 taches frottées et 46 pastilles, une par couleur échantillonnée dans le concept, plus des masques blancs à teinter en CSS.',
    grid(files('png/couleur/taches/*@1x.png'), 'sm', 64)
    + grid(files('png/couleur/pastilles/*@1x.png'), 'sm', 52)
    + '<div class="grid">' + ''.join(
        f'<figure class="sm"><div class="mk" style="--m:url(../{p});background:{c}"></div><figcaption>{html.escape(label(p))}</figcaption></figure>'
        for p, c in zip(files('png/couleur/masques/*@1x.png'), ['#bfae98', '#6d7d68', '#9e492d', '#50628a', '#e7c281', '#7f4b57'] * 2)) + '</div>'
    + grid(files('png/couleur/nuanciers/*@1x.png'), '', 46)))
S.append(section('03', 'Taches extraites du concept', 'Détourées dans l\'image d\'origine : couronne de la roue, historique, palettes, variations, favoris.',
    grid([p for p in files('extraits-concept/taches-pastel/*.png') if '@2x' not in p], 'sm', 48)))
S.append(section('04', 'Pinceau', 'Traits vectoriels (hachures de pastel, fusain, fibres) et, à droite, le trait et les tuiles Forme / Texture / Dynamique extraits du concept.',
    '<div class="row"><div>' + grid(files('png/pinceau/traits/*@1x.png'), 'wide', 74) + '</div>'
    '<div>' + grid(['extraits-concept/pinceau/trait-crayon-naturel@2x.png'], 'wide', 74)
    + grid([p for p in files('extraits-concept/pinceau/*.png') if '@2x' not in p and not os.path.basename(p).startswith('trait')], 'sm', 52) + '</div></div>'))
S.append(section('05', 'Botanique', 'Feuilles et rameaux vectoriels, puis les feuillages détourés du concept (rendu peint impossible à refaire fidèlement en vecteur).',
    grid(files('png/botanique/*/*@1x.png'), '', None)
    + grid([p for p in files('extraits-concept/botanique/*.png') if '@2x' not in p], '', None)))
S.append(section('06', 'Icônes', 'Trait 1,6 px, bouts arrondis, crème #e9dfc9. SVG 24 × 24 et PNG 24, 48, 96, 192 px.',
    grid(files('png/icones/*/*-48.png'), 'ic', 48)))
S.append(section('07', 'Interface', 'Panneaux, boutons, onglets, curseurs, liste, champ hexa, loupe, barres d\'outils.',
    '<div class="row wrap">'
    + ''.join(f'<figure><img src="../{p}"><figcaption>{html.escape(label(p))}</figcaption></figure>' for p in files('png/interface/boutons/*@1x.png'))
    + ''.join(f'<figure><img src="../{p}"><figcaption>{html.escape(label(p))}</figcaption></figure>' for p in files('png/interface/controles/*@1x.png') if 'loupe' not in p)
    + '<figure><div class="loupe"><img class="in" src="../extraits-concept/pipette/loupe-feuille-concept@2x.png"><img class="fr" src="../png/interface/controles/cadre-loupe@2x.png"></div><figcaption>cadre-loupe + loupe-feuille-concept</figcaption></figure>'
    + ''.join(f'<figure><img src="../{p}"><figcaption>{html.escape(label(p))}</figcaption></figure>' for p in files('png/interface/rails/*@1x.png'))
    + ''.join(f'<figure><img src="../{p}" style="max-height:330px"><figcaption>{html.escape(label(p))}</figcaption></figure>' for p in files('png/interface/panneaux/*@1x.png'))
    + '</div>'))
S.append(section('08', 'Vignettes, loupe et annotations', 'Paysages des palettes, loupe et écriture à la craie extraits du concept ; flèches à la craie en vecteur.',
    grid([p for p in files('extraits-concept/vignettes/*.png') + files('extraits-concept/pipette/*.png') if '@2x' not in p], '', 90)
    + grid([p for p in files('extraits-concept/annotations/*.png') if '@2x' not in p], '', None)
    + grid(files('png/annotations/*@1x.png'), '', 70)))
S.append(section('09', 'Couleurs', 'Échantillonnées dans le concept. Fichiers tokens/couleurs.css et tokens/couleurs.json.',
    f'<h3>Interface</h3><div class="sws">{swatch}</div><h3>Pigments</h3><div class="sws">{pig}</div>'))

page = f'''<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Nature Anthracite</title>
<style>
@font-face{{font-family:Figtree;src:url(../fonts/figtree-latin.woff2)}}
@font-face{{font-family:Caveat;src:url(../fonts/caveat-latin.woff2)}}
:root{{--bg:#212222;--panel:#1c1d1d;--line:rgba(255,255,255,.07);--text:#e6ddcb;--muted:#a39b8c;--cream:#e9dfc9}}
*{{box-sizing:border-box}}
body{{margin:0;background:radial-gradient(1200px 800px at 30% 0,#2c2d2c,var(--bg));color:var(--text);font:14px/1.45 Figtree,sans-serif;padding:56px 64px;width:1680px}}
h1{{font-weight:500;font-size:46px;margin:0;letter-spacing:.5px}}
.lead{{color:var(--muted);font-size:17px;margin:6px 0 0}}
.hand{{font-family:Caveat,cursive;color:#cfc6b4;font-size:28px;margin-top:12px}}
section{{background:linear-gradient(#262727,#1c1d1d);border:1px solid var(--line);border-radius:20px;padding:26px 30px 30px;margin-top:34px;box-shadow:0 14px 30px rgba(0,0,0,.5)}}
header{{display:flex;align-items:baseline;gap:14px;margin-bottom:16px}}
.num{{font-family:Caveat,cursive;font-size:30px;color:#bfae98}}
h2{{font-weight:500;font-size:24px;margin:0}}
h3{{font-weight:500;font-size:15px;color:var(--muted);margin:18px 0 8px}}
header p{{margin:0;color:var(--muted)}}
.grid{{display:flex;flex-wrap:wrap;gap:14px 18px;align-items:flex-end;margin:10px 0}}
.row{{display:flex;gap:26px;align-items:center}} .row.wrap{{flex-wrap:wrap;align-items:flex-end}}
.col{{display:flex;flex-direction:column;gap:14px}}
figure{{margin:0;display:flex;flex-direction:column;align-items:center;gap:6px}}
figcaption{{font-size:11px;color:#8d8678;max-width:220px;text-align:center;word-break:break-all}}
.sm figcaption,.ic figcaption{{max-width:84px}}
.mk{{width:60px;height:60px;-webkit-mask:var(--m) center/contain no-repeat;mask:var(--m) center/contain no-repeat}}
.loupe{{position:relative;width:200px;height:200px}} .loupe img{{position:absolute}} .loupe .in{{width:162px;left:19px;top:19px}} .loupe .fr{{width:200px;left:0;top:0}}
.sws{{display:flex;flex-wrap:wrap;gap:10px}}
.sw{{display:grid;grid-template-columns:34px auto;column-gap:8px;width:190px;font-size:12px}}
.sw i{{grid-row:span 2;width:34px;height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.12)}}
.sw em{{color:#8d8678;font-style:normal}}
</style></head><body>
<h1>Nature Anthracite</h1>
<p class="lead">Pack de design de l'atelier de dessin Notely : éléments isolés en SVG et PNG transparents, tirés du concept.</p>
<p class="hand">pastel sec, feuilles discrètes, boutons sombres, sélection crème et bronze</p>
{''.join(S)}
</body></html>'''
os.makedirs('apercu', exist_ok=True)
open('apercu/planche.html', 'w', encoding='utf-8').write(page)
print('apercu/planche.html')
