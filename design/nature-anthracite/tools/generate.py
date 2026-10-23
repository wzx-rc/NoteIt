"""Génère les éléments vectoriels du pack Nature Anthracite (SVG autonomes).

Tout est tiré au hasard avec des graines fixes : relancer le script redonne
exactement les mêmes fichiers. Les couleurs viennent d'échantillons pris dans
l'image concept (voir tokens/couleurs.json).

Le côté « fait main » ne vient pas d'un filtre posé après coup : chaque tache
est un polygone aux bords déchiquetés, avec des passages de pastel plus clairs ou
plus sombres à l'intérieur. Le filtre de grain (#grain) ajoute en plus des
manques de pigment et des éclats ; les logiciels qui ignorent les filtres SVG
gardent la forme, les couleurs et les passages.

Usage : python3 tools/generate.py   (depuis design/nature-anthracite)
"""
import colorsys, json, math, os, random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SVG = os.path.join(ROOT, 'svg')

# ---------------------------------------------------------------- couleurs
# Anneau de la roue du concept, échantillonné tous les 15° (0° = haut, sens horaire)
WHEEL = ['#fbc146', '#fbbb3d', '#fa9430', '#ec642a', '#e76158', '#d94f56', '#b23a4e', '#8a366a',
         '#73439c', '#664cad', '#5456b8', '#4268b9', '#477ec7', '#2f6fbe', '#2799c9', '#2a95b8',
         '#489485', '#64964b', '#95bb4e', '#a7b749', '#ca9f2c', '#d19327', '#e7a036', '#fabf47']

UI = {
    'fond': '#212222', 'fond-vignette': '#2f2f2e', 'panneau': '#1e1f1f', 'panneau-haut': '#262727',
    'panneau-bas': '#1a1b1b', 'bord': '#3a3a38', 'bord-clair': '#4a4843', 'creux': '#151616',
    'bouton': '#2a2a29', 'bouton-haut': '#333331', 'actif': '#827565', 'actif-haut': '#978a77',
    'creme': '#e9dfc9', 'creme-doux': '#cfc4ae', 'texte': '#e6ddcb', 'texte-doux': '#a39b8c',
    'bronze': '#bfae98', 'bronze-fonce': '#6f6250', 'curseur': '#d9ccb4', 'piste': '#3b3a37',
    'ombre': '#0b0c0c',
}

PIGMENTS = {
    # couronne de la roue
    'ocre': '#ad6b23', 'jaune-safran': '#f7b43f', 'corail': '#ec6f59', 'vieux-rose': '#b6625e',
    'prune': '#7f4b57', 'bleu-ciel': '#5592bd', 'bleu-azur': '#6f98ba', 'sable': '#ceaa7e',
    'beige-rose': '#b09071', 'rouge-brique': '#8f413e', 'vert-sauge': '#7b9175', 'bleu-roi': '#28577c',
    # palettes
    'lichen': '#bab78e', 'olive': '#7d7d30', 'mousse': '#596c4e', 'ecorce': '#443933',
    'framboise': '#984c5b', 'terre-brulee': '#2f211d', 'paille': '#bf9f72', 'sapin': '#536750',
    'petrole': '#29556c', 'lavande': '#6d76a1', 'aubergine': '#463950', 'pierre': '#aca091',
    'peche': '#cda78e', 'bordeaux': '#663537', 'argile': '#9e6c5d', 'ardoise': '#324347',
    'lin': '#e1d0ba', 'caramel': '#ab8461', 'taupe': '#6b5745', 'cacao': '#57372b', 'rouille': '#9e492d',
    # historique et favoris
    'miel': '#e7c281', 'canard': '#295561', 'indigo': '#50628a', 'rose-poudre': '#bf9d95',
    'vert-de-gris': '#6d7d68', 'orange-brule': '#964725', 'feuillage': '#4e6238', 'craie': '#bbb5aa',
    'bleu-nuit': '#264353', 'mauve': '#967c97', 'cobalt': '#2d719c', 'charbon': '#2e2d2f',
}

HARMONY_BAR = ['#5b6460', '#4b4b55', '#a3a58a', '#d8cc9a', '#8a8257', '#d97a3a', '#cf5160', '#2f4a73']
VARIATIONS = ['#e4cdaa', '#b1a781', '#7e7657', '#695e48', '#4f4034', '#42332a']


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def rgb2hex(c):
    return '#%02x%02x%02x' % tuple(max(0, min(255, round(v * 255))) for v in c)


def shade(h, dl=0.0, ds=0.0, dh=0.0):
    r, g, b = hex2rgb(h)
    hh, l, s = colorsys.rgb_to_hls(r, g, b)
    return rgb2hex(colorsys.hls_to_rgb((hh + dh) % 1, max(0, min(1, l + dl)), max(0, min(1, s + ds))))


def mix(a, b, t):
    a, b = hex2rgb(a), hex2rgb(b)
    return rgb2hex(tuple(x + (y - x) * t for x, y in zip(a, b)))


def wheel_at(deg):
    deg %= 360
    i = int(deg // 15)
    return mix(WHEEL[i], WHEEL[(i + 1) % 24], (deg % 15) / 15)


# ---------------------------------------------------------------- outils SVG
def f(v):
    return ('%.2f' % v).rstrip('0').rstrip('.')


def poly(pts):
    return 'M' + ' L'.join(f'{f(x)} {f(y)}' for x, y in pts) + ' Z'


def smooth_path(pts, closed=True):
    """Catmull-Rom → Bézier : contour doux qui passe par tous les points."""
    n = len(pts)
    d = f'M{f(pts[0][0])} {f(pts[0][1])}'
    rng = range(n) if closed else range(n - 1)
    for i in rng:
        p0 = pts[(i - 1) % n] if closed or i > 0 else pts[0]
        p1, p2 = pts[i], pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if closed or i + 2 < n else pts[-1]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f' C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}'
    return d + (' Z' if closed else '')


class Wobble:
    """Bruit périodique (somme de sinus) pour les bords irréguliers."""

    def __init__(self, rng, octaves=((2, 1), (3, .6), (5, .35), (9, .2), (17, .12))):
        self.w = [(k, a, rng.uniform(0, math.tau)) for k, a in octaves]
        self.norm = sum(a for _, a, _ in self.w)

    def __call__(self, t):  # t en tours (0..1)
        return sum(a * math.sin(k * t * math.tau + p) for k, a, p in self.w) / self.norm


def svg_doc(w, h, body, defs='', extra=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{f(w)}" height="{f(h)}" '
            f'viewBox="0 0 {f(w)} {f(h)}"{extra}>\n'
            + (f'<defs>\n{defs}\n</defs>\n' if defs else '') + body + '\n</svg>\n')


def grain_filter(fid='grain', seed=3, holes=0.0, spark=0.22, rough=2.4, freq=0.9):
    """Pastel sec : bords mangés (déplacement), pigment marbré, rares manques, éclats clairs.
    holes règle la quantité de manques (0 = aucun), spark l'opacité des éclats."""
    hk = 14 * holes
    return f'''<filter id="{fid}" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="3" seed="{seed}" result="lo"/>
  <feDisplacementMap in="SourceGraphic" in2="lo" scale="{f(rough)}" xChannelSelector="R" yChannelSelector="G" result="rough"/>
  <feTurbulence type="fractalNoise" baseFrequency="{f(freq * 0.12)}" numOctaves="4" seed="{seed + 3}" result="m"/>
  <feColorMatrix in="m" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -1.1 0 0 0 .62" result="mott"/>
  <feComposite in="mott" in2="rough" operator="in" result="mott2"/>
  <feTurbulence type="fractalNoise" baseFrequency="{f(freq * 0.6)}" numOctaves="2" seed="{seed + 7}" result="n"/>
  <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  {f(hk)} 0 0 0 {f(1 - hk * 0.33)}" result="keep"/>
  <feComposite in="rough" in2="keep" operator="in" result="eaten"/>
  <feTurbulence type="fractalNoise" baseFrequency="{f(freq * 1.2)}" numOctaves="1" seed="{seed + 13}" result="n2"/>
  <feColorMatrix in="n2" type="matrix" values="0 0 0 0 1  0 0 0 0 0.97  0 0 0 0 0.9  12 0 0 0 -8.1" result="sp"/>
  <feComposite in="sp" in2="eaten" operator="in" result="sp2"/>
  <feComponentTransfer in="sp2" result="sp3"><feFuncA type="linear" slope="{f(spark)}"/></feComponentTransfer>
  <feComposite in="mott2" in2="eaten" operator="in" result="mott3"/>
  <feComponentTransfer in="mott3" result="mott4"><feFuncA type="linear" slope=".2"/></feComponentTransfer>
  <feMerge><feMergeNode in="eaten"/><feMergeNode in="mott4"/><feMergeNode in="sp3"/></feMerge>
</filter>'''


def soft_shadow(fid='ombre', dy=6, blur=8, op=0.55):
    return f'''<filter id="{fid}" x="-30%" y="-30%" width="160%" height="170%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="{f(blur)}"/><feOffset dy="{f(dy)}" result="b"/>
  <feFlood flood-color="#000" flood-opacity="{f(op)}"/><feComposite in2="b" operator="in" result="s"/>
  <feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>'''


WRITTEN = []


def write(rel, content):
    p = os.path.join(SVG, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as fh:
        fh.write(content)
    WRITTEN.append(rel)


# ---------------------------------------------------------------- taches de pastel
def streaks(rng, cx, cy, R, base, n, angle, clip_id, spread=1.0, alpha=(0.18, 0.5), length=(0.5, 1.3)):
    """Passages de bâton de pastel : fines bandes claires/sombres dans un sens commun."""
    out = []
    for _ in range(n):
        a = angle + rng.gauss(0, 0.22)
        L = R * rng.uniform(*length)
        w = R * rng.uniform(0.04, 0.16)
        ox, oy = rng.uniform(-R, R) * 0.8 * spread, rng.uniform(-R, R) * 0.8 * spread
        dx, dy = math.cos(a), math.sin(a)
        nx, ny = -dy, dx
        pts = []
        k = 9
        for i in range(k + 1):
            t = i / k - 0.5
            ww = w * (1 - (2 * abs(t)) ** 2.2) + 0.15
            j = rng.uniform(-0.25, 0.25) * w
            pts.append((cx + ox + dx * L * t + nx * (ww + j), cy + oy + dy * L * t + ny * (ww + j)))
        for i in range(k, -1, -1):
            t = i / k - 0.5
            ww = w * (1 - (2 * abs(t)) ** 2.2) + 0.15
            j = rng.uniform(-0.25, 0.25) * w
            pts.append((cx + ox + dx * L * t - nx * (ww + j), cy + oy + dy * L * t - ny * (ww + j)))
        light = rng.random() < 0.6
        col = shade(base, rng.uniform(0.04, 0.12) if light else -rng.uniform(0.05, 0.13), rng.uniform(-0.04, 0.06))
        out.append(f'<path d="{poly(pts)}" fill="{col}" opacity="{f(rng.uniform(*alpha))}"/>')
    return f'<g clip-path="url(#{clip_id})">' + ''.join(out) + '</g>'


def blob(rng, cx, cy, R, style='tache', squash=None, rot=None):
    """Contour d'une tache. 'tache' = pastel frotté (bords effilochés), 'pastille' = touche ronde."""
    wob = Wobble(rng)
    n = 120
    sq = squash if squash is not None else rng.uniform(0.82, 0.96)
    ro = rot if rot is not None else rng.uniform(0, math.pi)
    jag = 0.045 if style == 'tache' else 0.02
    low = 0.09 if style == 'tache' else 0.05
    pts = []
    for i in range(n):
        t = i / n
        a = t * math.tau
        r = R * (1 + low * wob(t)) + R * rng.uniform(-jag, jag * 0.5)
        if style == 'tache' and rng.random() < 0.05:
            r += R * rng.uniform(0.04, 0.12) * rng.choice((-1, 1))  # éclats et fibres
        x, y = r * math.cos(a), r * math.sin(a) * sq
        pts.append((cx + x * math.cos(ro) - y * math.sin(ro), cy + x * math.sin(ro) + y * math.cos(ro)))
    return pts


def dab_svg(name, color, seed, style='tache', size=96, grain=True):
    rng = random.Random(seed)
    c = size / 2
    R = size * (0.36 if style == 'tache' else 0.4)
    pts = blob(rng, c, c, R, style)
    cid = f'clip-{name}'
    shape = poly(pts) if style == 'tache' else smooth_path(pts[::3])
    angle = rng.uniform(-0.9, -0.4) if style == 'tache' else rng.uniform(-0.5, 0.5)
    body = [f'<clipPath id="{cid}"><path d="{shape}"/></clipPath>']
    body.append(f'<g filter="url(#grain-{name})">' if grain else '<g>')
    body.append(f'<path d="{shape}" fill="{color}"/>')
    # sous-couche : bord légèrement plus sombre, comme une touche appuyée
    body.append(f'<path d="{shape}" fill="none" stroke="{shade(color, -0.07)}" stroke-width="{f(size * 0.03)}" opacity=".55" clip-path="url(#{cid})"/>')
    body.append(streaks(rng, c, c, R, color, 9 if style == 'tache' else 6, angle, cid,
                        alpha=(0.2, 0.55) if style == 'tache' else (0.12, 0.32)))
    body.append('</g>')
    defs = grain_filter(f'grain-{name}', seed=seed % 97, holes=0.0, spark=0.18,
                        rough=size * (0.022 if style == 'tache' else 0.012), freq=0.9 * 96 / size) if grain else ''
    return svg_doc(size, size, '\n'.join(body), defs)


def make_dabs():
    for i, (name, col) in enumerate(PIGMENTS.items()):
        write(f'couleur/taches/tache-{name}.svg', dab_svg(name, col, 100 + i, 'tache'))
        write(f'couleur/pastilles/pastille-{name}.svg', dab_svg('p-' + name, col, 300 + i, 'pastille', 72))
    # masques neutres : pour colorer en CSS (mask-image) avec n'importe quelle couleur
    for k in range(1, 7):
        rng = random.Random(900 + k)
        pts = blob(rng, 48, 48, 34, 'tache')
        write(f'couleur/masques/masque-tache-{k}.svg',
              svg_doc(96, 96, f'<path d="{poly(pts)}" fill="#fff" filter="url(#g)"/>',
                      grain_filter('g', seed=k * 11, holes=0.0, spark=0.0, rough=2.4)))
        pts = blob(rng, 36, 36, 29, 'pastille')
        write(f'couleur/masques/masque-pastille-{k}.svg',
              svg_doc(72, 72, f'<path d="{smooth_path(pts[::3])}" fill="#fff" filter="url(#g)"/>',
                      grain_filter('g', seed=k * 13, holes=0.0, spark=0.0, rough=1.6)))


# ---------------------------------------------------------------- roue chromatique
def ring_patch(rng, cx, cy, r0, r1, a0, a1, jag_in=4.0, jag_out=1.1):
    """Un aplat de pastel posé sur l'anneau, entre les angles a0 et a1 (radians, 0 = haut)."""
    wo, wi = Wobble(rng), Wobble(rng)
    pts = []
    steps = max(8, int((a1 - a0) * r1 / 2.2))
    def P(r, a):
        return (cx + r * math.sin(a), cy - r * math.cos(a))
    # bord extérieur
    for i in range(steps + 1):
        t = i / steps
        a = a0 + (a1 - a0) * t
        r = r1 + jag_out * wo(t * 0.4) + rng.uniform(-jag_out, jag_out * 0.4)
        pts.append(P(r, a))
    # côté de fin : légèrement penché, irrégulier
    side = 7
    tilt = rng.uniform(-0.05, 0.05)
    for i in range(1, side):
        t = i / side
        r = r1 + (r0 - r1) * t
        pts.append(P(r, a1 + tilt * t + rng.uniform(-0.012, 0.012)))
    # bord intérieur, plus déchiqueté (comme sur le concept)
    for i in range(steps + 1):
        t = i / steps
        a = a1 - (a1 - a0) * t
        r = r0 - jag_in * (0.5 + 0.5 * wi(t * 0.4)) - (rng.uniform(0, jag_in * 1.4) if rng.random() < 0.18 else 0)
        pts.append(P(r, a))
    tilt = rng.uniform(-0.05, 0.05)
    for i in range(1, side):
        t = i / side
        r = r0 + (r1 - r0) * t
        pts.append(P(r, a0 + tilt * t + rng.uniform(-0.012, 0.012)))
    return pts


def wheel_ring(rng, cx, cy, r0, r1, blocks=16, prefix='w'):
    """Anneau en touches de pastel posées à la main : blocs qui se chevauchent,
    teintes qui ne suivent pas un dégradé régulier, passages internes."""
    body, clips = [], []
    span = 360 / blocks
    order = list(range(blocks))
    rng.shuffle(order)
    # une première passe large pour qu'aucun jour ne laisse voir le fond
    under = []
    for b in range(blocks * 2):
        mid = b * span / 2
        col = shade(wheel_at(mid), -0.04)
        a0, a1 = math.radians(mid - span * 0.4), math.radians(mid + span * 0.4)
        under.append(f'<path d="{poly(ring_patch(rng, cx, cy, r0 + 3, r1 - 2, a0, a1, 1.5, 1.2))}" fill="{col}"/>')
    body.append('<g>' + ''.join(under) + '</g>')
    for k, b in enumerate(order):
        mid = b * span + rng.uniform(-2.5, 2.5)
        col = shade(wheel_at(mid + rng.uniform(-4, 4)), rng.uniform(-0.05, 0.04), rng.uniform(-0.08, 0.02))
        w = span * rng.uniform(1.05, 1.3)
        a0, a1 = math.radians(mid - w / 2), math.radians(mid + w / 2)
        pts = ring_patch(rng, cx, cy, r0 + rng.uniform(-1, 2), r1 + rng.uniform(-1.5, 1), a0, a1)
        cid = f'{prefix}c{k}'
        clips.append(f'<clipPath id="{cid}"><path d="{poly(pts)}"/></clipPath>')
        body.append(f'<path d="{poly(pts)}" fill="{col}"/>')
        # passages tangentiels clairs et sombres
        mr = (r0 + r1) / 2
        ma = math.radians(mid)
        px, py = cx + mr * math.sin(ma), cy - mr * math.cos(ma)
        body.append(streaks(rng, px, py, (r1 - r0) * 0.75, col, 12, ma + math.pi / 2 + rng.uniform(-0.35, 0.35), cid,
                            spread=1.0, alpha=(0.18, 0.5), length=(0.7, 1.9)))
    return clips, body


def wheel_svg(size=400, with_well=True, with_selector=True, name='roue'):
    rng = random.Random(42)
    cx = cy = size / 2
    s = size / 400
    r0, r1 = 128 * s, 178 * s
    clips, ring = wheel_ring(rng, cx, cy, r0, r1, prefix=name)
    defs = [grain_filter('grain', seed=5, holes=0.0, spark=0.16, rough=1.1 * s, freq=0.7), soft_shadow('ombre', 4 * s, 6 * s, 0.6)] + clips
    defs.append(f'''<radialGradient id="puits" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="#2b2b2a"/><stop offset=".75" stop-color="#151616"/><stop offset="1" stop-color="#0e0f0f"/></radialGradient>
<linearGradient id="lunette" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2b2a"/><stop offset=".5" stop-color="#161717"/><stop offset="1" stop-color="#202120"/></linearGradient>''')
    body = []
    # lunette extérieure (anneau sombre)
    body.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r1 + 14 * s)}" fill="url(#lunette)" filter="url(#ombre)"/>')
    body.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r1 + 13.5 * s)}" fill="none" stroke="#ffffff" stroke-opacity=".06"/>')
    body.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r1 + 4 * s)}" fill="#141515"/>')
    body.append('<g filter="url(#grain)">' + ''.join(ring) + '</g>')
    if with_well:
        body.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r0 - 6 * s)}" fill="#1b1c1c" stroke="#0c0d0d" stroke-width="{f(3 * s)}"/>')
        body.append(f'<circle cx="{f(cx)}" cy="{f(cy)}" r="{f(r0 - 20 * s)}" fill="url(#puits)" stroke="#ffffff" stroke-opacity=".05"/>')
    if with_selector:
        tri = triangle_svg(int(2 * (r0 - 20 * s)))
        inner = tri[tri.index('<defs>'):tri.rindex('</svg>')].replace('id="t1"', 'id="rt1"').replace('url(#t1)', 'url(#rt1)') \
            .replace('id="t2"', 'id="rt2"').replace('url(#t2)', 'url(#rt2)').replace('id="o"', 'id="ro"').replace('url(#o)', 'url(#ro)')
        off = cx - (r0 - 20 * s)
        body.append(f'<g transform="translate({f(off)} {f(off)})">{inner}</g>')
    return svg_doc(size, size, '\n'.join(body), '\n'.join(defs))


def ring_only_svg(size=400):
    rng = random.Random(42)
    c = size / 2
    s = size / 400
    clips, ring = wheel_ring(rng, c, c, 128 * s, 178 * s, prefix='a')
    return svg_doc(size, size, '<g filter="url(#grain)">' + ''.join(ring) + '</g>',
                   '\n'.join([grain_filter('grain', seed=5, holes=0.0, spark=0.16, rough=1.1 * s, freq=0.7)] + clips))


def triangle_svg(size=240, hue='#ec642a'):
    """Sélecteur central du concept : quadrilatère blanc → teinte → noir, deux poignées crème."""
    k = size / 240
    W = (56 * k, 34 * k)      # blanc, en haut à gauche
    A = (196 * k, 106 * k)    # teinte pure, à droite (poignée)
    D = (194 * k, 204 * k)    # teinte sombre, en bas à droite
    B = (34 * k, 186 * k)     # noir, en bas à gauche
    defs = f'''<linearGradient id="t1" gradientUnits="userSpaceOnUse" x1="{f(W[0])}" y1="{f(W[1])}" x2="{f(A[0])}" y2="{f(A[1] + 20 * k)}"><stop offset="0" stop-color="#f6eee2"/><stop offset=".55" stop-color="{shade(hue, 0.12)}"/><stop offset="1" stop-color="{hue}"/></linearGradient>
<linearGradient id="t2" gradientUnits="userSpaceOnUse" x1="{f(150 * k)}" y1="{f(70 * k)}" x2="{f(70 * k)}" y2="{f(200 * k)}"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".5" stop-color="#120c0a" stop-opacity=".45"/><stop offset="1" stop-color="#050505"/></linearGradient>
<linearGradient id="t3" gradientUnits="userSpaceOnUse" x1="{f(180 * k)}" y1="{f(150 * k)}" x2="{f(196 * k)}" y2="{f(200 * k)}"><stop offset="0" stop-color="#c9a6c9" stop-opacity="0"/><stop offset="1" stop-color="#d8b6d4" stop-opacity=".45"/></linearGradient>
{soft_shadow('o', 2, 3, .6)}'''
    quad = poly([W, A, D, B])
    sel = (82 * k, 168 * k)
    body = f'''<path d="{quad}" fill="url(#t1)"/><path d="{quad}" fill="url(#t2)"/><path d="{quad}" fill="url(#t3)"/>
<path d="{quad}" fill="none" stroke="#fff" stroke-opacity=".1"/>
<line x1="{f(sel[0])}" y1="{f(sel[1])}" x2="{f(A[0])}" y2="{f(A[1])}" stroke="{UI['creme']}" stroke-width="{f(2.2 * k)}" stroke-linecap="round"/>
<g filter="url(#o)"><circle cx="{f(A[0])}" cy="{f(A[1])}" r="{f(9 * k)}" fill="{UI['curseur']}" stroke="#8f8069" stroke-width="1"/>
<circle cx="{f(sel[0])}" cy="{f(sel[1])}" r="{f(7.5 * k)}" fill="{UI['curseur']}" stroke="#8f8069" stroke-width="1"/></g>'''
    return svg_doc(size, size, body, defs)


def harmony_wheel_svg(size=200):
    """Mini-roue du module Harmonie : secteurs de pastel, rayons crème."""
    rng = random.Random(7)
    c = size / 2
    R = size * 0.46
    body, clips = [], []
    n = 24
    for k in range(n):
        mid = k * 360 / n
        col = shade(wheel_at(mid), rng.uniform(0.0, 0.08), rng.uniform(-0.18, -0.05))
        a0, a1 = math.radians(mid - 9.5), math.radians(mid + 9.5)
        pts = [(c, c)]
        steps = 8
        for i in range(steps + 1):
            a = a0 + (a1 - a0) * i / steps
            r = R + rng.uniform(-1.2, 0.6)
            pts.append((c + r * math.sin(a), c - r * math.cos(a)))
        body.append(f'<path d="{poly(pts)}" fill="{col}"/>')
        # voile intérieur plus clair : couleurs plus rompues vers le centre
    defs = [grain_filter('grain', seed=9, holes=0.0, spark=0.2, rough=1.4),
            f'<radialGradient id="cv"><stop offset="0" stop-color="#f3eadb" stop-opacity=".55"/><stop offset=".55" stop-color="#f3eadb" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></radialGradient>']
    spokes = ''.join(
        f'<line x1="{f(c)}" y1="{f(c)}" x2="{f(c + R * 0.62 * math.sin(math.radians(a)))}" y2="{f(c - R * 0.62 * math.cos(math.radians(a)))}" stroke="{UI["creme"]}" stroke-width="{f(size * 0.01)}" stroke-linecap="round"/>'
        for a in (35, 200, 165))
    out = (f'<g filter="url(#grain)">{"".join(body)}</g><circle cx="{f(c)}" cy="{f(c)}" r="{f(R)}" fill="url(#cv)"/>'
           f'{spokes}<circle cx="{f(c)}" cy="{f(c)}" r="{f(size * 0.035)}" fill="{UI["creme"]}"/>')
    return svg_doc(size, size, out, '\n'.join(defs))


def harmony_orbit_svg(size=360):
    """Orbite du module Harmonie : cercle fin + pastilles des couleurs proposées."""
    c = size / 2
    R = size * 0.42
    rng = random.Random(77)
    items = [(-60, '#e2633f', 1), (-15, '#2f2b2b', 1), (60, None, 0), (100, '#8c8670', 1), (150, '#d8c79c', 1.1),
             (-100, '#c7a984', 1), (-130, '#d97a3a', 1)]
    defs = [soft_shadow('o', 2, 3, .55)]
    body = [f'<circle cx="{f(c)}" cy="{f(c)}" r="{f(R)}" fill="none" stroke="{UI["creme-doux"]}" stroke-opacity=".75" stroke-width="1.4"/>']
    for k, (a, col, sc) in enumerate(items):
        x, y = c + R * math.sin(math.radians(a)), c - R * math.cos(math.radians(a))
        r = size * 0.075 * (sc or 1)
        if col:
            pts = blob(rng, x, y, r, 'pastille')
            body.append(f'<path d="{smooth_path(pts[::3])}" fill="{col}" stroke="{UI["creme-doux"]}" stroke-opacity=".5" stroke-width="1.2" filter="url(#o)"/>')
        else:
            body.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="#1b1c1c" stroke="{UI["creme-doux"]}" stroke-width="1.6"/>')
    return svg_doc(size, size, ''.join(body), '\n'.join(defs))


def make_wheel():
    write('couleur/roue/roue-pastel-complete.svg', wheel_svg())
    write('couleur/roue/roue-pastel-sans-selecteur.svg', wheel_svg(with_selector=False))
    write('couleur/roue/anneau-pastel.svg', ring_only_svg())
    write('couleur/roue/selecteur-triangle.svg', triangle_svg())
    write('couleur/roue/mini-roue-harmonie.svg', harmony_wheel_svg())
    write('couleur/roue/orbite-harmonie.svg', harmony_orbit_svg())
    # nuancier de la barre d'harmonie et des variations
    for name, cols, seed in (('barre-harmonie', HARMONY_BAR, 50), ('bandeau-variations', VARIATIONS, 60)):
        rng = random.Random(seed)
        parts, defs = [], [grain_filter('grain', seed=seed % 31, holes=0.0, spark=0.18, rough=1.4)]
        for i, col in enumerate(cols):
            x = 26 + i * 44
            pts = blob(rng, x, 26, 19, 'pastille', squash=rng.uniform(0.92, 1), rot=0)
            cid = f'c{i}'
            defs.append(f'<clipPath id="{cid}"><path d="{smooth_path(pts[::3])}"/></clipPath>')
            parts.append(f'<path d="{smooth_path(pts[::3])}" fill="{col}"/>' + streaks(rng, x, 26, 19, col, 5, 0.3, cid, alpha=(0.1, 0.28)))
        write(f'couleur/nuanciers/{name}.svg', svg_doc(len(cols) * 44 + 8, 52, '<g filter="url(#grain)">' + ''.join(parts) + '</g>', '\n'.join(defs)))
    # palettes du concept, en rangées de taches
    pal = {
        'forest-dawn': ['lichen', 'olive', 'mousse', 'ecorce', 'framboise', 'terre-brulee'],
        'autumn': ['paille', 'sapin', 'petrole', 'lavande', 'aubergine'],
        'mountain': ['pierre', 'peche', 'bordeaux', 'argile', 'ardoise', 'ecorce'],
        'earth': ['lin', 'caramel', 'taupe', 'cacao', 'rouille'],
    }
    for k, (name, keys) in enumerate(pal.items()):
        rng = random.Random(70 + k)
        parts, defs = [], [grain_filter('grain', seed=11 + k, holes=0.0, spark=0.22, rough=1.8)]
        for i, key in enumerate(keys):
            x = 24 + i * 38
            col = PIGMENTS[key]
            # touches carrées frottées, comme les palettes du concept
            pts = blob(rng, x, 24, 18, 'tache', squash=rng.uniform(0.9, 1.0), rot=rng.uniform(-0.2, 0.2))
            pts = [(x + (px - x) * (1 + 0.18 * abs(math.cos(2 * math.atan2(py - 24, px - x)))), 24 + (py - 24) * (1 + 0.18 * abs(math.cos(2 * math.atan2(py - 24, px - x))))) for px, py in pts]
            cid = f'c{i}'
            defs.append(f'<clipPath id="{cid}"><path d="{poly(pts)}"/></clipPath>')
            parts.append(f'<path d="{poly(pts)}" fill="{col}"/>' + streaks(rng, x, 24, 18, col, 6, -0.2, cid))
        write(f'couleur/nuanciers/palette-{name}.svg', svg_doc(len(keys) * 38 + 10, 48, '<g filter="url(#grain)">' + ''.join(parts) + '</g>', '\n'.join(defs)))


# ---------------------------------------------------------------- traits de pinceau
def fiber_stroke(name, spine, width, color, seed, fibers=46, dry=0.35, w=360, h=90, taper=(0.18, 0.25), grain=True, paper=0.9):
    rng = random.Random(seed)
    # échantillonne la colonne vertébrale (Catmull-Rom)
    def cr(p0, p1, p2, p3, t):
        return tuple(0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t * t
                            + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t ** 3) for i in (0, 1))
    P = [spine[0]] + spine + [spine[-1]]
    pts = []
    for i in range(1, len(P) - 2):
        for k in range(14):
            pts.append(cr(P[i - 1], P[i], P[i + 1], P[i + 2], k / 14))
    pts.append(spine[-1])
    N = len(pts)
    norms = []
    for i in range(N):
        a, b = pts[max(0, i - 1)], pts[min(N - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy) or 1
        norms.append((-dy / L, dx / L))
    out = []
    for k in range(fibers):
        off = rng.uniform(-1, 1)
        sw = rng.uniform(0.6, 2.3) * width / 24
        op = rng.uniform(0.3, 0.92)
        col = shade(color, rng.uniform(-0.06, 0.06))
        ph = rng.uniform(0, 6)
        cover = max(0.15, 1 - dry * (0.12 + 0.7 * off * off))
        # chaque poil commence et finit à sa place : extrémités effilochées
        t = rng.uniform(0, 0.05 + 0.12 * abs(off))
        t_end = 1 - rng.uniform(0, 0.08 + 0.2 * abs(off))
        segs = []
        while t < t_end:
            run = rng.uniform(0.04, 0.45) * cover
            gap = rng.uniform(0.004, 0.07) * (1 - cover) * 2.5
            a0, a1 = t, min(t_end, t + run)
            seg = []
            i0, i1 = int(a0 * (N - 1)), int(a1 * (N - 1))
            for i in range(i0, i1 + 1):
                tt = i / (N - 1)
                tp = min(1, tt / taper[0], (1 - tt) / taper[1]) if taper[0] and taper[1] else 1
                tp = max(0.05, tp) ** 0.7
                o = off * width / 2 * tp + math.sin(tt * 9 + ph) * width * 0.03
                seg.append((pts[i][0] + norms[i][0] * o, pts[i][1] + norms[i][1] * o))
            if len(seg) > 1:
                segs.append(seg)
            t = a1 + gap
        for sg in segs:
            out.append(f'<path d="M{" L".join(f"{f(x)} {f(y)}" for x, y in sg)}" stroke="{col}" stroke-width="{f(sw)}" stroke-opacity="{f(op)}"/>')
    body = f'<g fill="none" stroke-linecap="round" stroke-linejoin="round"{" filter=\"url(#grain)\"" if grain else ""}>' + ''.join(out) + '</g>'
    defs = grain_filter('grain', seed=seed % 50, holes=paper, spark=0.0, rough=1.4, freq=1.1) if grain else ''
    return svg_doc(w, h, body, defs)


def hatch_stroke(name, spine, width, color, seed, w=360, h=80, angle=58, density=1.6, taper=(0.2, 0.3), ragged=0.35, base=0.55, paper=0.0):
    """Bâton de pastel ou de fusain traîné sur papier : hachures courtes et obliques,
    serrées au centre, clairsemées et en pointes sur les bords."""
    rng = random.Random(seed)
    P = [spine[0]] + spine + [spine[-1]]
    def cr(p0, p1, p2, p3, t):
        return tuple(0.5 * ((2 * p1[i]) + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t * t
                            + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t ** 3) for i in (0, 1))
    pts = []
    for i in range(1, len(P) - 2):
        for k in range(40):
            pts.append(cr(P[i - 1], P[i], P[i + 1], P[i + 2], k / 40))
    pts.append(spine[-1])
    # rééchantillonnage à pas constant
    L = [0.0]
    for i in range(1, len(pts)):
        L.append(L[-1] + math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
    total = L[-1]
    wob = Wobble(rng, ((3, 1), (7, .5), (13, .3)))
    out, left, right = [], [], []
    j = 0
    step = 1 / density
    d = 0.0
    while d < total:
        while j < len(L) - 2 and L[j + 1] < d:
            j += 1
        t = d / total
        seg = max(1e-6, L[j + 1] - L[j])
        u = (d - L[j]) / seg
        x = pts[j][0] + (pts[j + 1][0] - pts[j][0]) * u
        y = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * u
        tx, ty = (pts[j + 1][0] - pts[j][0]) / seg, (pts[j + 1][1] - pts[j][1]) / seg
        nx, ny = -ty, tx
        tp = max(0.04, min(1, t / taper[0], (1 - t) / taper[1])) ** 0.8
        ww = width * tp * (1 + 0.18 * wob(t))
        if rng.random() < 0.5:
            left.append((x + nx * ww * rng.uniform(0.22, 0.42), y + ny * ww * rng.uniform(0.22, 0.42)))
            right.append((x - nx * ww * rng.uniform(0.22, 0.42), y - ny * ww * rng.uniform(0.22, 0.42)))
        for _ in range(2):
            off = rng.gauss(0, 0.42)
            if abs(off) > 0.5 + ragged * rng.random():
                continue
            o = off * ww
            cx, cy = x + nx * o, y + ny * o
            edge = min(1, abs(off) * 2)
            ln = ww * rng.uniform(0.25, 0.75) * (1 - 0.5 * edge)
            th = math.radians(angle + rng.gauss(0, 9))
            dx, dy = tx * math.cos(th) - nx * math.sin(th), ty * math.cos(th) - ny * math.sin(th)
            col = shade(color, rng.uniform(-0.07, 0.07))
            op = rng.uniform(0.18, 0.62) * (1 - 0.45 * edge)
            out.append(f'<path d="M{f(cx - dx * ln / 2)} {f(cy - dy * ln / 2)} L{f(cx + dx * ln / 2)} {f(cy + dy * ln / 2)}" '
                       f'stroke="{col}" stroke-width="{f(rng.uniform(0.5, 1.5))}" stroke-opacity="{f(op)}"/>')
        d += step * rng.uniform(0.6, 1.4)
    ribbon = f'<path d="{poly(left + right[::-1])}" fill="{color}" opacity="{f(base)}" stroke="none"/>' if base else ''
    body = f'<g fill="none" stroke-linecap="round" filter="url(#grain)">' + ribbon + ''.join(out) + '</g>'
    return svg_doc(w, h, body, grain_filter('grain', seed=seed % 50, holes=paper, spark=0.0, rough=1.0, freq=1.0))


def make_strokes():
    hero = [(12, 62), (40, 56), (78, 40), (60, 58), (110, 50), (150, 36), (128, 54), (190, 44), (250, 30), (300, 22),
            (322, 26), (300, 40), (262, 52), (300, 50), (360, 44), (420, 40)]
    write('pinceau/traits/trait-crayon-naturel.svg', hatch_stroke('naturel', hero, 22, '#e6dcc8', 11, w=432, h=80, density=4, ragged=0.15, base=0.7))
    wave = [(14, 50), (70, 34), (130, 50), (190, 30), (250, 46), (300, 34), (346, 40)]
    write('pinceau/traits/trait-pastel-sec.svg', hatch_stroke('pastel', wave, 24, '#e3d6bd', 21, density=4, angle=70, ragged=0.2, base=0.6))
    write('pinceau/traits/trait-charbon.svg', hatch_stroke('charbon', wave, 18, '#b9b1a5', 31, density=3, angle=40, ragged=0.45, base=0.35, paper=0.35))
    write('pinceau/traits/trait-encre-fine.svg', fiber_stroke('encre', [(14, 52), (90, 40), (170, 50), (250, 32), (346, 38)], 4, '#efe6d4', 41, fibers=6, dry=0.0, w=360, h=80, taper=(0.1, 0.3), grain=False))
    write('pinceau/traits/trait-gouache.svg', fiber_stroke('gouache', wave, 26, '#d9c7a4', 51, fibers=110, dry=0.2, w=360, h=80, taper=(0.06, 0.12), paper=0.0))
    write('pinceau/traits/trait-feutre.svg', fiber_stroke('feutre', wave, 10, '#e9dfc9', 61, fibers=18, dry=0.05, w=360, h=80, taper=(0.03, 0.05), grain=False))


# ---------------------------------------------------------------- botanique
LEAF_GREENS = [('#2c3620', '#5f6f3c', '#a7ad7c'), ('#26301f', '#4f6238', '#93a173'), ('#33361f', '#6b6e3a', '#b5b07a'),
               ('#2a2f24', '#56604a', '#a2a58e'), ('#3a3225', '#6d5a3c', '#b39c76')]


def leaf(rng, x, y, L, W, ang, palette, gid, serrated=True, veins=True):
    """Feuille dentelée peinte : dégradé de l'ombre vers la lumière, nervures crème."""
    dark, mid, light = palette
    pts_l, pts_r = [], []
    n = 22
    asym = rng.uniform(0.85, 1.12)
    for i in range(n + 1):
        t = i / n
        prof = math.sin(math.pi * t ** 0.85) * (1 - 0.15 * t)
        tooth = (0.12 if serrated and 0.15 < t < 0.92 and i % 2 else 0) * prof
        wl = W / 2 * (prof + tooth) * asym
        wr = W / 2 * (prof + (0.12 * prof if serrated and 0.15 < t < 0.92 and i % 2 == 0 else 0)) / asym
        pts_l.append((-wl, -L * t))
        pts_r.append((wr, -L * t))
    bend = rng.uniform(-0.12, 0.12) * L
    def tr(p):
        px, py = p
        t = -py / L
        px += bend * t * t
        c, s = math.cos(ang), math.sin(ang)
        return (x + px * c - py * s, y + px * s + py * c)
    outline = [tr(p) for p in pts_l] + [tr(p) for p in reversed(pts_r)]
    base, tip = tr((0, 0)), tr((0, -L))
    g = f'''<linearGradient id="{gid}" gradientUnits="userSpaceOnUse" x1="{f(tr((-W / 2, -L * .5))[0])}" y1="{f(tr((-W / 2, -L * .5))[1])}" x2="{f(tr((W / 2, -L * .4))[0])}" y2="{f(tr((W / 2, -L * .4))[1])}">
<stop offset="0" stop-color="{dark}"/><stop offset=".55" stop-color="{mid}"/><stop offset="1" stop-color="{light}" stop-opacity=".95"/></linearGradient>'''
    parts = [f'<path d="{poly(outline)}" fill="url(#{gid})" stroke="{dark}" stroke-width=".6" stroke-opacity=".8"/>']
    # moitié à l'ombre
    shadow_side = [tr(p) for p in pts_l] + [tr((bend * 0, -L * t / n)) for t in range(n, -1, -1)]
    parts.append(f'<path d="{poly(shadow_side)}" fill="{dark}" opacity=".35"/>')
    mid_line = [tr((0, -L * t / 10)) for t in range(11)]
    parts.append(f'<path d="M{" L".join(f"{f(a)} {f(b)}" for a, b in mid_line)}" fill="none" stroke="{light}" stroke-opacity=".7" stroke-width="{f(max(0.6, W * 0.045))}" stroke-linecap="round"/>')
    if veins:
        for k in range(1, 7):
            t = k / 7.5
            for sgn in (-1, 1):
                a = tr((0, -L * t))
                b = tr((sgn * W * 0.42 * math.sin(math.pi * t), -L * (t + 0.12)))
                parts.append(f'<path d="M{f(a[0])} {f(a[1])} L{f(b[0])} {f(b[1])}" stroke="{light}" stroke-opacity=".35" stroke-width="{f(max(0.4, W * 0.022))}" stroke-linecap="round"/>')
    return g, ''.join(parts), base, tip


def twig(points, w0, w1, col='#3b3328', hi='#6a5c47'):
    """Tige effilée (polygone) + reflet."""
    n = len(points)
    L, R = [], []
    for i, (x, y) in enumerate(points):
        a, b = points[max(0, i - 1)], points[min(n - 1, i + 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        d = math.hypot(dx, dy) or 1
        nx, ny = -dy / d, dx / d
        w = (w0 + (w1 - w0) * i / (n - 1)) / 2
        L.append((x + nx * w, y + ny * w))
        R.append((x - nx * w, y - ny * w))
    hl = ' L'.join(f'{f(x + 0.3)} {f(y - 0.3)}' for x, y in points)
    return (f'<path d="{smooth_path(L + R[::-1])}" fill="{col}"/>'
            f'<path d="M{hl}" fill="none" stroke="{hi}" stroke-opacity=".5" stroke-width="{f(max(0.5, w0 * 0.2))}" stroke-linecap="round"/>')


def make_botanical():
    shapes = [(80, 34), (70, 26), (92, 40), (60, 30), (84, 28), (66, 36)]
    for k, (L, W) in enumerate(shapes, 1):
        rng = random.Random(500 + k)
        g, body, _, _ = leaf(rng, 50, L + 8, L, W, 0, LEAF_GREENS[k % len(LEAF_GREENS)], 'g', serrated=k != 4)
        write(f'botanique/feuilles/feuille-{k}.svg', svg_doc(100, L + 14, body, g + soft_shadow('o', 2, 2.5, .5), ''))

    def compose(name, w, h, stem, leaves_at, seed, stem_w=(3.2, 0.8)):
        rng = random.Random(seed)
        defs, parts = [soft_shadow('o', 3, 3, .55), grain_filter('grain', seed=seed % 40, holes=0.0, spark=0.12, rough=0.8)], []
        parts.append(twig(stem, *stem_w))
        for i, (t, side, L, W) in enumerate(leaves_at):
            idx = min(len(stem) - 2, int(t * (len(stem) - 1)))
            (x0, y0), (x1, y1) = stem[idx], stem[idx + 1]
            ang = math.atan2(y1 - y0, x1 - x0) + math.pi / 2 + side * rng.uniform(0.7, 1.15)
            g, body, _, _ = leaf(rng, x0, y0, L, W, ang, LEAF_GREENS[rng.randrange(len(LEAF_GREENS))], f'l{i}')
            defs.append(g)
            parts.append(body)
        write(f'botanique/compositions/{name}.svg', svg_doc(w, h, f'<g filter="url(#o)"><g filter="url(#grain)">{"".join(parts)}</g></g>', '\n'.join(defs)))

    compose('rameau-coin-haut-droit', 240, 170,
            [(20, 40), (70, 34), (120, 40), (160, 58), (196, 92), (214, 140), (220, 165)],
            [(0.05, -1, 46, 18), (0.2, 1, 54, 22), (0.35, -1, 40, 17), (0.5, -1, 58, 24), (0.62, 1, 44, 19),
             (0.78, -1, 50, 21), (0.9, 1, 36, 16)], 601)
    compose('liane-verticale', 110, 420,
            [(60, 6), (52, 60), (66, 120), (50, 190), (64, 260), (54, 330), (62, 412)],
            [(t / 12, (-1) ** k, 36 + (k * 7) % 18, 15 + (k * 5) % 7) for k, t in enumerate(range(0, 12))], 602, (2.6, 1.6))
    compose('liane-horizontale', 420, 110,
            [(6, 60), (70, 52), (140, 64), (210, 50), (280, 62), (350, 52), (414, 58)],
            [(t / 11, (-1) ** k, 34 + (k * 7) % 16, 14 + (k * 3) % 6) for k, t in enumerate(range(0, 11))], 603, (2.4, 1.4))
    arc = [(200 + 186 * math.cos(math.radians(a)), 200 + 186 * math.sin(math.radians(a))) for a in range(100, 261, 16)]
    compose('couronne-arc', 400, 400, arc,
            [(t / 14, (-1) ** k, 30 + (k * 9) % 18, 13 + (k * 5) % 6) for k, t in enumerate(range(0, 14))], 604, (3.4, 1.2))
    compose('brin', 120, 160, [(60, 154), (58, 110), (64, 70), (60, 30), (66, 8)],
            [(0.1, -1, 34, 14), (0.25, 1, 38, 16), (0.45, -1, 32, 13), (0.6, 1, 30, 12), (0.8, -1, 24, 10)], 605, (2.2, 0.8))


# ---------------------------------------------------------------- icônes
ICON = {
    # barre d'outils verticale (ordre du concept)
    'plume': '<path d="M13.6 4.6 19.4 10.4 12.4 16 7.9 16.1 8 11.6z"/><path d="M8.2 15.8 3.8 20.2"/><circle cx="12.2" cy="11.8" r="1.4"/>',
    'crayon': '<path d="M4 20l1-4.3L15.6 5.1a2.2 2.2 0 0 1 3.1 0l.2.2a2.2 2.2 0 0 1 0 3.1L8.3 19z"/><path d="M13.7 7l3.3 3.3"/><path d="M5 15.7 8.3 19"/>',
    'feutre': '<path d="M6.3 17.7 4 20.2l3.3-.5"/><path d="M7.4 19.7 4.3 16.6l9.6-9.6a2.6 2.6 0 0 1 3.7 0l-.6-.6a2.6 2.6 0 0 1 0 3.7z"/><path d="M11.4 9.5l3.1 3.1"/><path d="M15 6 18 9"/>',
    'selection-lasso': '<path d="M12 4.2c4.4 0 8 2.3 8 5.1S16.4 14.4 12 14.4 4 12.1 4 9.3 7.6 4.2 12 4.2z" stroke-dasharray="2.4 2.2"/><path d="M7.2 13.4c-1.6 1.4-1.3 3.4.8 3.8 1.6.3 2.1 1.6 1.3 3"/>',
    'gomme': '<path d="M8.6 20H20"/><path d="M5.2 15.6 13.8 7a2 2 0 0 1 2.8 0l3.2 3.2a2 2 0 0 1 0 2.8L12.8 20H8.8l-3.6-3.6a.6.6 0 0 1 0-.8z"/><path d="M9.6 11.2l5.2 5.2"/>',
    'estompe': '<path d="M9 21v-5.8l-2.6-2.8a1.6 1.6 0 0 1 2.3-2.2L10 11.4V5.6a1.5 1.5 0 0 1 3 0V10m0-.6a1.5 1.5 0 0 1 3 0v1.2m0-.2a1.5 1.5 0 0 1 3 0v5.2c0 2.9-2 4.8-5 4.8"/>',
    'forme': '<circle cx="9.5" cy="9.5" r="5.7"/><rect x="11.2" y="11.2" width="8.8" height="8.8" rx="1.6"/>',
    'symetrie': '<path d="M12 3v18" stroke-dasharray="1.6 2.2"/><path d="M9 7.5 4 17h5zM15 7.5 20 17h-5z"/>',
    'remplissage': '<path d="M5 11.5 11.5 5l7 7-6.5 6.5a1.4 1.4 0 0 1-2 0L5 13.5a1.4 1.4 0 0 1 0-2z"/><path d="M5.4 12.4h12.4"/><path d="M19.6 15.4s1.6 2 1.6 3a1.6 1.6 0 0 1-3.2 0c0-1 1.6-3 1.6-3z"/><path d="M8.6 3.6l3 3"/>',
    'main': '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12m0-6.5V4.5a1.5 1.5 0 0 1 3 0V12m0-6a1.5 1.5 0 0 1 3 0v6m0-3.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.4a6 6 0 0 1-4.6-2.2L4.6 15.6a1.6 1.6 0 0 1 2.4-2.1L8 14.6"/>',
    # roue
    'pipette': '<path d="M13.6 6.4l4 4"/><path d="M15.4 4.6a2.4 2.4 0 0 1 3.4 0l.6.6a2.4 2.4 0 0 1 0 3.4L17 11l-4-4z"/><path d="M14.2 9.8 7 17l-2.6.6L5 15l7.2-7.2"/><path d="M7.6 14.2h4.2"/>',
    'pipette-pleine': '<path d="M13.6 6.4l4 4"/><path d="M15.4 4.6a2.4 2.4 0 0 1 3.4 0l.6.6a2.4 2.4 0 0 1 0 3.4L17 11l-4-4z" fill="currentColor"/><path d="M14.2 9.8 7 17l-2.6.6L5 15l7.2-7.2"/><path d="M5.6 15.2 7.8 13h4.6L8 17.4z" fill="currentColor" stroke="none"/>',
    'melange': '<circle cx="9" cy="9.5" r="4.6"/><circle cx="15" cy="9.5" r="4.6"/><circle cx="12" cy="14.6" r="4.6"/>',
    'roue': '<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="3.6"/><path d="M12 3.8v4.6M12 15.6v4.6M3.8 12h4.6M15.6 12h4.6M6.2 6.2l3.3 3.3M14.5 14.5l3.3 3.3M17.8 6.2l-3.3 3.3M9.5 14.5l-3.3 3.3"/>',
    # réglages pinceau
    'taille': '<circle cx="12" cy="12" r="5.6"/>',
    'opacite': '<path d="M12 3.6c3 3.6 6 6.9 6 10.1a6 6 0 0 1-12 0c0-3.2 3-6.5 6-10.1z"/><path d="M12 19.7a6 6 0 0 1-6-6c0-3.2 3-6.5 6-10.1z" fill="currentColor" stroke="none" opacity=".55"/>',
    'flux': '<path d="M12 4.4l2.1 5.5 5.5 2.1-5.5 2.1L12 19.6l-2.1-5.5L4.4 12l5.5-2.1z"/>',
    'espacement': '<circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/>',
    'durete': '<circle cx="12" cy="12" r="7.6"/><path d="M12 4.4a7.6 7.6 0 0 1 0 15.2z" fill="currentColor" stroke="none" opacity=".55"/>',
    'dyn-zigzag': '<path d="M3.6 16.2 6.8 8.6l2.6 7 3-8.4 2.6 7.6 3-6.2 2.4 5"/>',
    'dyn-pression': '<path d="M14.6 3.8l3.6 3.6-6.8 6.8-4.2.6.6-4.2z"/><path d="M4 19.5c2.6-.2 3.8-2.4 6-2.4s2.6 1.9 5 1.9 3.4-1.4 5-2.2"/>',
    'dyn-inclinaison': '<path d="M16.6 3.6l2.8 2.8-9.6 9.6-3.6.8.8-3.6z"/><path d="M4 20h9"/><path d="M4 20a7 7 0 0 1 2.2-5.1" stroke-dasharray="1.4 1.8"/>',
    'dyn-vitesse': '<path d="M17.4 4l2.6 2.6-8.4 8.4-3.4.8.8-3.4z"/><path d="M3.6 10h4M2.8 13.6h3.6M4.4 17.2h5.4"/>',
    # harmonies
    'harm-complementaire': '<circle cx="12" cy="12" r="7.6" opacity=".55"/><circle cx="12" cy="4.4" r="2.4" fill="currentColor"/><circle cx="12" cy="19.6" r="2.4" fill="currentColor"/>',
    'harm-analogique': '<circle cx="12" cy="12" r="7.6" opacity=".55"/><circle cx="12" cy="4.4" r="2.2" fill="currentColor"/><circle cx="6.6" cy="6.6" r="2.2" fill="currentColor"/><circle cx="17.4" cy="6.6" r="2.2" fill="currentColor"/>',
    'harm-triade': '<circle cx="12" cy="12" r="7.6" opacity=".55"/><circle cx="12" cy="4.4" r="2.3" fill="currentColor"/><circle cx="18.6" cy="15.8" r="2.3" fill="currentColor"/><circle cx="5.4" cy="15.8" r="2.3" fill="currentColor"/>',
    'harm-tetradique': '<circle cx="12" cy="12" r="7.6" opacity=".55"/><circle cx="6.6" cy="6.6" r="2.1" fill="currentColor"/><circle cx="17.4" cy="6.6" r="2.1" fill="currentColor"/><circle cx="17.4" cy="17.4" r="2.1" fill="currentColor"/><circle cx="6.6" cy="17.4" r="2.1" fill="currentColor"/>',
    'harm-monochrome': '<circle cx="12" cy="12" r="7.6" opacity=".55"/><circle cx="12" cy="5.6" r="2.4" fill="currentColor"/><circle cx="12" cy="11.6" r="1.9" fill="currentColor" opacity=".75"/><circle cx="12" cy="16.6" r="1.4" fill="currentColor" opacity=".5"/>',
    # général
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'moins': '<path d="M5 12h14"/>',
    'plus-cercle': '<circle cx="12" cy="12" r="8.4"/><path d="M12 8v8M8 12h8"/>',
    'fermer': '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    'valider': '<path d="M5 12.5l4.4 4.4L19 7.4"/>',
    'chevron-bas': '<path d="M6.5 9.5 12 15l5.5-5.5"/>',
    'chevron-haut': '<path d="M6.5 14.5 12 9l5.5 5.5"/>',
    'chevron-droite': '<path d="M9.5 6.5 15 12l-5.5 5.5"/>',
    'chevron-gauche': '<path d="M14.5 6.5 9 12l5.5 5.5"/>',
    'coeur': '<path d="M12 19.6s-7.4-4.4-7.4-9.6A4.1 4.1 0 0 1 12 7.7 4.1 4.1 0 0 1 19.4 10c0 5.2-7.4 9.6-7.4 9.6z"/>',
    'coeur-plein': '<path d="M12 19.6s-7.4-4.4-7.4-9.6A4.1 4.1 0 0 1 12 7.7 4.1 4.1 0 0 1 19.4 10c0 5.2-7.4 9.6-7.4 9.6z" fill="currentColor"/>',
    'etoile': '<path d="M12 3.8l2.5 5.2 5.6.7-4.1 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.7z"/>',
    'etoile-pleine': '<path d="M12 3.8l2.5 5.2 5.6.7-4.1 3.9 1 5.6-5-2.7-5 2.7 1-5.6-4.1-3.9 5.6-.7z" fill="currentColor"/>',
    'deplacer': '<circle cx="12" cy="6" r="1.5" fill="currentColor"/><circle cx="12" cy="18" r="1.5" fill="currentColor"/><circle cx="6" cy="12" r="1.5" fill="currentColor"/><circle cx="18" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    'options': '<circle cx="5.5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor"/>',
    'options-vertical': '<circle cx="12" cy="5.5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="18.5" r="1.4" fill="currentColor"/>',
    'historique': '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.4V12l3 2"/>',
    'copier': '<rect x="8.4" y="8.4" width="11" height="11" rx="2.2"/><path d="M15.6 8.2V6.6a2 2 0 0 0-2-2H6.6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h1.6"/>',
    'reinitialiser': '<path d="M5 12a7 7 0 1 0 2.1-5"/><path d="M4.6 4.4v3.4H8"/>',
    'annuler': '<path d="M9 8.5H15a4.5 4.5 0 0 1 0 9h-4"/><path d="M12 5.2 8.6 8.5 12 11.8"/>',
    'retablir': '<path d="M15 8.5H9a4.5 4.5 0 0 0 0 9h4"/><path d="M12 5.2l3.4 3.3L12 11.8"/>',
    'enregistrer': '<path d="M5.4 4.6h10.4l2.8 2.8v10.6a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 18V6a1.4 1.4 0 0 1 1.4-1.4z"/><path d="M8 4.8v4h7v-4M7.6 19.2v-5.2h8.8v5.2"/>',
    'image': '<rect x="3.8" y="5" width="16.4" height="14" rx="2.2"/><circle cx="9" cy="10" r="1.6"/><path d="M4.4 17.4 9.8 13l3.2 2.6 3-2.4 4 3.4"/>',
    'reglages': '<path d="M5 7h8M17 7h2M5 17h2M11 17h8"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/><path d="M5 12h3M12 12h7"/><circle cx="10" cy="12" r="2"/>',
    'recherche': '<circle cx="10.6" cy="10.6" r="6"/><path d="M15.2 15.2l4.6 4.6"/>',
    'corbeille': '<path d="M5 7h14M10 4.6h4M7 7l.8 11.4a1.6 1.6 0 0 0 1.6 1.4h5.2a1.6 1.6 0 0 0 1.6-1.4L17 7"/><path d="M10.4 10.6v5.6M13.6 10.6v5.6"/>',
    'calques': '<path d="M12 4.4 20 8.6l-8 4.2-8-4.2z"/><path d="M4 12.4l8 4.2 8-4.2"/><path d="M4 16l8 4.2 8-4.2"/>',
    'dupliquer': '<rect x="4.4" y="4.4" width="10.4" height="10.4" rx="2"/><rect x="9.2" y="9.2" width="10.4" height="10.4" rx="2"/><path d="M14.4 12.4v4M12.4 14.4h4"/>',
    'importer': '<path d="M12 4v10.4M7.8 10.4 12 14.6l4.2-4.2"/><path d="M5 16.6v1.6a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8v-1.6"/>',
    'exporter': '<path d="M12 14.6V4.2M7.8 8.4 12 4.2l4.2 4.2"/><path d="M5 16.6v1.6a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8v-1.6"/>',
    'grille': '<rect x="4.4" y="4.4" width="6.2" height="6.2" rx="1.4"/><rect x="13.4" y="4.4" width="6.2" height="6.2" rx="1.4"/><rect x="4.4" y="13.4" width="6.2" height="6.2" rx="1.4"/><rect x="13.4" y="13.4" width="6.2" height="6.2" rx="1.4"/>',
    'oeil': '<path d="M3 12s3.4-6.2 9-6.2S21 12 21 12s-3.4 6.2-9 6.2S3 12 3 12z"/><circle cx="12" cy="12" r="2.8"/>',
    'verrou': '<rect x="5.4" y="10.6" width="13.2" height="9.4" rx="2"/><path d="M8.4 10.6V8a3.6 3.6 0 0 1 7.2 0v2.6"/>',
    'feuille': '<path d="M5 19.2C5 11.4 10 6 19.2 4.8 19 14 14 19 5.8 19.2z"/><path d="M5 19.2 13.4 10.8"/>',
    'pinceau': '<path d="M19.4 4.4c-2.2.6-7.4 5.8-8.8 8.2l1.6 1.6c2.4-1.4 7.6-6.6 8.2-8.8a.8.8 0 0 0-1-1z"/><path d="M10.4 13.2c-2.2 0-3.8 1.4-4 3.6-.1 1.5-.9 2.5-2.4 3.2 3.3.7 7.6.4 8.4-3.2.3-1.4-.4-2.8-2-3.6z"/>',
    'palette': '<path d="M12 3.6a8.4 8.4 0 0 0 0 16.8c1.3 0 1.9-.8 1.9-1.7 0-1.4-1.3-1.7-1.3-3 0-1 .8-1.7 1.9-1.7h2.2a3.7 3.7 0 0 0 3.7-3.7C20.4 6.6 16.7 3.6 12 3.6z"/><circle cx="7.6" cy="11" r="1.1"/><circle cx="10" cy="7.3" r="1.1"/><circle cx="14.4" cy="7.3" r="1.1"/>',
    'loupe-plus': '<circle cx="10.6" cy="10.6" r="6"/><path d="M15.2 15.2l4.6 4.6M10.6 8v5.2M8 10.6h5.2"/>',
    'loupe-moins': '<circle cx="10.6" cy="10.6" r="6"/><path d="M15.2 15.2l4.6 4.6M8 10.6h5.2"/>',
    'partager': '<circle cx="17" cy="6" r="2.2"/><circle cx="7" cy="12" r="2.2"/><circle cx="17" cy="18" r="2.2"/><path d="M9 11l6-3.8M9 13l6 3.8"/>',
    'planche': '<rect x="3.6" y="4.4" width="16.8" height="15.2" rx="2.2"/><path d="M3.6 9.6h16.8M10.4 9.6v10"/>',
}

ICON_GROUPS = {
    'outils': ['plume', 'crayon', 'feutre', 'selection-lasso', 'gomme', 'estompe', 'forme', 'symetrie', 'remplissage', 'main'],
    'couleur': ['pipette', 'pipette-pleine', 'melange', 'roue', 'palette', 'historique', 'feuille'],
    'pinceau': ['pinceau', 'taille', 'opacite', 'flux', 'espacement', 'durete', 'dyn-zigzag', 'dyn-pression', 'dyn-inclinaison', 'dyn-vitesse'],
    'harmonies': ['harm-complementaire', 'harm-analogique', 'harm-triade', 'harm-tetradique', 'harm-monochrome'],
    'general': [k for k in ICON if k not in ()],
}


def make_icons():
    done = set()
    for grp, names in ICON_GROUPS.items():
        for n in names:
            if n in done:
                continue
            done.add(n)
            write(f'icones/{grp}/{n}.svg',
                  f'<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" '
                  f'stroke="{UI["creme"]}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" color="{UI["creme"]}">'
                  f'{ICON[n]}</svg>\n')


# ---------------------------------------------------------------- composants d'interface
def panel_svg(w, h, r=20, title=None):
    defs = f'''<linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{UI['panneau-haut']}"/><stop offset="1" stop-color="{UI['panneau-bas']}"/></linearGradient>
<linearGradient id="pb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".11"/><stop offset=".4" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#fff" stop-opacity=".07"/></linearGradient>
<filter id="ps" x="-20%" y="-20%" width="140%" height="150%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="14"/><feOffset dy="12"/><feComponentTransfer><feFuncA type="linear" slope=".7"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>'''
    m = 34
    W, Hh = w + m * 2, h + m * 2
    body = (f'<g transform="translate({m} {m - 8})"><rect width="{w}" height="{h}" rx="{r}" fill="url(#pg)" filter="url(#ps)"/>'
            f'<rect x=".5" y=".5" width="{w - 1}" height="{h - 1}" rx="{r - .5}" fill="none" stroke="url(#pb)"/>')
    if title:
        body += f'<text x="24" y="44" font-family="Figtree, \'Segoe UI\', sans-serif" font-size="21" fill="{UI["texte"]}">{title}</text>'
    body += '</g>'
    return svg_doc(W, Hh, body, defs)


def button_svg(kind, w=48, h=48, active=False, icon=None, label=None, r=None):
    r = r if r is not None else (h / 2 if kind == 'rond' else 12)
    fill_a, fill_b = (UI['actif-haut'], UI['actif']) if active and kind == 'onglet' else (UI['bouton-haut'], UI['bouton'])
    stroke = UI['creme-doux'] if active else '#ffffff'
    sop = '.9' if active else '.07'
    sw = 1.6 if active else 1
    defs = f'''<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{fill_a}"/><stop offset="1" stop-color="{fill_b}"/></linearGradient>
<filter id="bs" x="-30%" y="-30%" width="160%" height="180%" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="3"/><feOffset dy="3"/><feComponentTransfer><feFuncA type="linear" slope=".55"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>'''
    m = 8
    body = (f'<g transform="translate({m} {m - 2})"><rect width="{w}" height="{h}" rx="{f(r)}" fill="url(#bg)" filter="url(#bs)"/>'
            f'<rect x="{f(sw / 2)}" y="{f(sw / 2)}" width="{f(w - sw)}" height="{f(h - sw)}" rx="{f(r - sw / 2)}" fill="none" stroke="{stroke}" stroke-opacity="{sop}" stroke-width="{sw}"/>'
            f'<path d="M{f(r)} 1.2 H{f(w - r)}" stroke="#fff" stroke-opacity=".08"/>')
    if icon:
        s = 24 / 24
        body += (f'<g transform="translate({f(w / 2 - 12)} {f(h / 2 - 12)})" fill="none" stroke="{UI["creme"]}" stroke-width="1.6" '
                 f'stroke-linecap="round" stroke-linejoin="round" color="{UI["creme"]}">{ICON[icon]}</g>')
    if label:
        col = UI['texte'] if not active or kind != 'onglet' else '#f6efe2'
        body += (f'<text x="{f(w / 2)}" y="{f(h / 2 + 5)}" text-anchor="middle" font-family="Figtree, \'Segoe UI\', sans-serif" '
                 f'font-size="14" fill="{col}">{label}</text>')
    body += '</g>'
    return svg_doc(w + m * 2, h + m * 2, body, defs)


def slider_svg(w=200, value=0.5):
    x = 10 + (w - 20) * value
    defs = soft_shadow('o', 2, 2.5, .6) + f'<linearGradient id="k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8dcc5"/><stop offset="1" stop-color="#b8a98f"/></linearGradient>'
    body = (f'<rect x="10" y="17" width="{w - 20}" height="4" rx="2" fill="{UI["piste"]}"/>'
            f'<rect x="10" y="17" width="{f(x - 10)}" height="4" rx="2" fill="{UI["bronze"]}"/>'
            f'<circle cx="{f(x)}" cy="19" r="9" fill="url(#k)" stroke="#7d705d" stroke-width="1" filter="url(#o)"/>'
            f'<circle cx="{f(x)}" cy="19" r="4" fill="#9b8e7d" opacity=".55"/>')
    return svg_doc(w, 38, body, defs)


def dropdown_svg(w=292, h=40, label='Crayon naturel'):
    defs = '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c1d1d"/><stop offset="1" stop-color="#232424"/></linearGradient>'
    body = (f'<rect x=".5" y=".5" width="{w - 1}" height="{h - 1}" rx="11" fill="url(#g)" stroke="#fff" stroke-opacity=".12"/>'
            f'<text x="16" y="{h / 2 + 5}" font-family="Figtree, \'Segoe UI\', sans-serif" font-size="14" fill="{UI["texte"]}">{label}</text>'
            f'<g transform="translate({w - 34} {h / 2 - 12})" fill="none" stroke="{UI["creme"]}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{ICON["chevron-bas"]}</g>')
    return svg_doc(w, h, body, defs)


def tile_frame_svg(s=52, active=True):
    defs = '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2b2a"/><stop offset="1" stop-color="#1d1e1e"/></linearGradient>'
    body = f'<rect x="1" y="1" width="{s - 2}" height="{s - 2}" rx="8" fill="url(#g)" stroke="{UI["creme-doux"] if active else "#fff"}" stroke-opacity="{".95" if active else ".08"}" stroke-width="{1.8 if active else 1}"/>'
    return svg_doc(s, s, body, defs)


def rail_svg(w=58, h=420, slots=8, active=1):
    defs = f'''<linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b2c2b"/><stop offset="1" stop-color="#232424"/></linearGradient>
{soft_shadow('o', 8, 10, .6)}
<linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f5951"/><stop offset="1" stop-color="#48443e"/></linearGradient>'''
    m = 24
    body = [f'<g transform="translate({m} {m - 6})"><rect width="{w}" height="{h}" rx="16" fill="url(#g)" filter="url(#o)"/>',
            f'<rect x=".5" y=".5" width="{w - 1}" height="{h - 1}" rx="15.5" fill="none" stroke="#fff" stroke-opacity=".08"/>']
    step = (h - 24) / slots
    icons = ['plume', 'crayon', 'feutre', 'selection-lasso', 'gomme', 'estompe', 'forme', 'symetrie']
    for i in range(slots):
        y = 12 + i * step
        if i == active:
            body.append(f'<rect x="7" y="{f(y + 2)}" width="{w - 14}" height="{f(step - 4)}" rx="11" fill="url(#a)" stroke="#fff" stroke-opacity=".1"/>')
        body.append(f'<g transform="translate({f(w / 2 - 15)} {f(y + step / 2 - 15)}) scale(1.25)" fill="none" stroke="{UI["creme"]}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" color="{UI["creme"]}">{ICON[icons[i % len(icons)]]}</g>')
    body.append('</g>')
    return svg_doc(w + m * 2, h + m * 2, ''.join(body), defs)


def favorites_rail_svg(w=60, h=330):
    keys = ['miel', 'canard', 'indigo', 'rose-poudre', 'vert-de-gris']
    rng = random.Random(88)
    defs = [f'<linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2b2c2b"/><stop offset="1" stop-color="#232424"/></linearGradient>',
            soft_shadow('o', 8, 10, .6), grain_filter('grain', seed=17, holes=0.0, spark=0.2, rough=1.4)]
    m = 24
    body = [f'<g transform="translate({m} {m - 6})"><rect width="{w}" height="{h}" rx="14" fill="url(#g)" filter="url(#o)"/>',
            f'<rect x=".5" y=".5" width="{w - 1}" height="{h - 1}" rx="13.5" fill="none" stroke="#fff" stroke-opacity=".08"/>',
            f'<rect x="10" y="10" width="{w - 20}" height="{w - 20}" rx="10" fill="#2f302f" stroke="#fff" stroke-opacity=".1"/>',
            f'<g transform="translate({w / 2 - 12} {10 + (w - 20) / 2 - 12})" fill="none" stroke="{UI["creme"]}" stroke-width="1.6" stroke-linejoin="round">{ICON["etoile"]}</g>']
    dabs = []
    for i, k in enumerate(keys):
        cy = 82 + i * 41
        pts = blob(rng, w / 2, cy, 16, 'pastille', squash=0.95, rot=0)
        pts = [(w / 2 + (x - w / 2) * (1 + 0.14 * abs(math.cos(2 * math.atan2(y - cy, x - w / 2)))), cy + (y - cy) * (1 + 0.14 * abs(math.cos(2 * math.atan2(y - cy, x - w / 2))))) for x, y in pts]
        cid = f'c{i}'
        defs.append(f'<clipPath id="{cid}"><path d="{smooth_path(pts[::3])}"/></clipPath>')
        dabs.append(f'<path d="{smooth_path(pts[::3])}" fill="{PIGMENTS[k]}"/>' + streaks(rng, w / 2, cy, 16, PIGMENTS[k], 5, 0.2, cid, alpha=(0.1, 0.3)))
    body.append('<g filter="url(#grain)">' + ''.join(dabs) + '</g>')
    body.append(f'<rect x="10" y="{h - w + 10}" width="{w - 20}" height="{w - 20}" rx="10" fill="#2a2b2a" stroke="#fff" stroke-opacity=".08"/>'
                f'<g transform="translate({w / 2 - 12} {h - w + 10 + (w - 20) / 2 - 12})" fill="none" stroke="{UI["creme"]}" stroke-width="1.6" stroke-linecap="round">{ICON["plus"]}</g></g>')
    return svg_doc(w + m * 2, h + m * 2, ''.join(body), '\n'.join(defs))


def loupe_frame_svg(s=200):
    c = s / 2
    R = s * 0.45
    defs = f'''<linearGradient id="rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a7a63"/><stop offset=".35" stop-color="#4a3f31"/><stop offset=".7" stop-color="#2a241b"/><stop offset="1" stop-color="#6d5f4b"/></linearGradient>
<radialGradient id="glass" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></radialGradient>
{soft_shadow('o', 6, 8, .6)}'''
    body = (f'<g filter="url(#o)"><circle cx="{c}" cy="{c}" r="{f(R)}" fill="none" stroke="url(#rim)" stroke-width="{f(s * 0.045)}"/></g>'
            f'<circle cx="{c}" cy="{c}" r="{f(R - s * 0.024)}" fill="url(#glass)"/>'
            f'<circle cx="{c}" cy="{c}" r="{f(R + s * 0.022)}" fill="none" stroke="#000" stroke-opacity=".5"/>'
            f'<rect x="{f(c - s * 0.05)}" y="{f(c - s * 0.05)}" width="{f(s * 0.1)}" height="{f(s * 0.1)}" rx="2" fill="none" stroke="{UI["creme"]}" stroke-width="1.8"/>'
            f'<path d="M{f(c - R + 8)} {c}H{f(c - s * 0.07)}M{f(c + s * 0.07)} {c}H{f(c + R - 8)}" stroke="{UI["creme"]}" stroke-opacity=".25"/>')
    return svg_doc(s, s, body, defs)


def hex_field_svg(w=190, h=56, color='#6e8f6a', label='#6E8F6A'):
    defs = soft_shadow('o', 4, 6, .55) + '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#262727"/><stop offset="1" stop-color="#1c1d1d"/></linearGradient>'
    m = 16
    body = (f'<g transform="translate({m} {m - 4})"><rect width="{w}" height="{h}" rx="14" fill="url(#g)" filter="url(#o)"/>'
            f'<rect x=".5" y=".5" width="{w - 1}" height="{h - 1}" rx="13.5" fill="none" stroke="#fff" stroke-opacity=".09"/>'
            f'<rect x="12" y="10" width="36" height="36" rx="8" fill="{color}" stroke="{UI["creme-doux"]}" stroke-width="1.6"/>'
            f'<text x="64" y="{h / 2 + 5}" font-family="Figtree, \'Segoe UI\', sans-serif" font-size="15" fill="{UI["texte"]}">{label}</text>'
            f'<g transform="translate({w - 38} {h / 2 - 12})" fill="none" stroke="{UI["creme"]}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{ICON["copier"]}</g></g>')
    return svg_doc(w + m * 2, h + m * 2, body, defs)


def palette_row_svg(w=350, h=84):
    defs = '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#252626"/><stop offset="1" stop-color="#1e1f1f"/></linearGradient>'
    body = (f'<rect x=".5" y=".5" width="{w - 1}" height="{h - 1}" rx="12" fill="url(#g)" stroke="#fff" stroke-opacity=".08"/>'
            f'<rect x="6" y="6" width="96" height="{h - 12}" rx="9" fill="#151616" stroke="#fff" stroke-opacity=".05"/>'
            f'<line x1="108" y1="8" x2="108" y2="{h - 8}" stroke="#000" stroke-opacity=".35"/>')
    return svg_doc(w, h, body, defs)


def wheel_side_button_svg(icon):
    return button_svg('rond', 46, 46, False, icon)


def make_ui():
    write('interface/panneaux/panneau-470x300.svg', panel_svg(470, 300))
    write('interface/panneaux/panneau-palettes-370x540.svg', panel_svg(370, 540, title='Palettes'))
    write('interface/panneaux/panneau-pinceau-340x580.svg', panel_svg(340, 580, title='Pinceau'))
    write('interface/panneaux/panneau-carre-230x280.svg', panel_svg(230, 280, title='Color History'))
    write('interface/panneaux/rangee-palette-350x84.svg', palette_row_svg())
    for act in (False, True):
        s = 'actif' if act else 'repos'
        write(f'interface/boutons/bouton-rond-{s}.svg', button_svg('rond', 46, 46, act, 'pipette'))
        write(f'interface/boutons/bouton-outil-{s}.svg', button_svg('carre', 48, 48, act, 'crayon', r=12))
        write(f'interface/boutons/onglet-{s}.svg', button_svg('onglet', 72, 30, act, label='Perso' if act else 'Nature', r=9))
        write(f'interface/boutons/tuile-cadre-{s}.svg', tile_frame_svg(52, act))
    write('interface/boutons/bouton-vide-rond.svg', button_svg('rond', 46, 46))
    write('interface/boutons/bouton-vide-carre.svg', button_svg('carre', 48, 48, r=12))
    write('interface/boutons/bouton-plus-cercle.svg', svg_doc(48, 48, f'<circle cx="24" cy="24" r="21" fill="#1d1e1e" stroke="{UI["creme-doux"]}" stroke-width="1.6"/><path d="M24 15v18M15 24h18" stroke="{UI["creme"]}" stroke-width="1.8" stroke-linecap="round"/>'))
    write('interface/boutons/bouton-reinitialiser.svg', button_svg('carre', 104, 34, label='Réinitialiser', r=11))
    write('interface/boutons/bouton-nouvelle-palette.svg', button_svg('carre', 352, 38, label='+  Nouvelle palette', r=11))
    write('interface/boutons/bouton-option-harmonie-actif.svg', button_svg('onglet', 144, 36, True, r=10))
    for k, v in (('42', 0.45), ('85', 0.85), ('70', 0.7), ('12', 0.12)):
        write(f'interface/controles/curseur-{k}.svg', slider_svg(200, v))
    write('interface/controles/liste-deroulante.svg', dropdown_svg())
    write('interface/controles/champ-hexa.svg', hex_field_svg())
    write('interface/controles/cadre-loupe.svg', loupe_frame_svg())
    write('interface/rails/barre-outils-verticale.svg', rail_svg())
    write('interface/rails/rail-favoris.svg', favorites_rail_svg())
    for ic in ('pipette', 'pipette-pleine', 'melange', 'plus'):
        write(f'interface/boutons/roue-bouton-{ic}.svg', wheel_side_button_svg(ic))


# ---------------------------------------------------------------- annotations
def chalk_arrow(name, pts, head=True, seed=1, w=200, h=120):
    rng = random.Random(seed)
    d = smooth_path(pts, closed=False)
    (x1, y1), (x2, y2) = pts[-2], pts[-1]
    a = math.atan2(y2 - y1, x2 - x1)
    hd = ''
    if head:
        L = 11
        p1 = (x2 - L * math.cos(a - 0.5), y2 - L * math.sin(a - 0.5))
        p2 = (x2 - L * math.cos(a + 0.5), y2 - L * math.sin(a + 0.5))
        hd = f'<path d="M{f(p1[0])} {f(p1[1])} L{f(x2)} {f(y2)} L{f(p2[0])} {f(p2[1])}"/>'
    defs = grain_filter('craie', seed=seed, holes=0.0, spark=0, rough=1.2, freq=1.1)
    return svg_doc(w, h, f'<g fill="none" stroke="#cfc6b4" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" filter="url(#craie)"><path d="{d}"/>{hd}</g>', defs)


def make_annotations():
    write('annotations/fleche-courbe-droite.svg', chalk_arrow('a', [(10, 90), (60, 104), (120, 96), (160, 70), (176, 40)], seed=3))
    write('annotations/fleche-courbe-gauche.svg', chalk_arrow('b', [(190, 90), (140, 104), (80, 96), (40, 70), (24, 40)], seed=4))
    write('annotations/fleche-montante.svg', chalk_arrow('c', [(60, 110), (66, 80), (64, 46), (54, 12)], seed=5, w=120))
    write('annotations/fleche-crochet.svg', chalk_arrow('d', [(14, 30), (60, 18), (100, 26), (118, 50), (110, 80)], seed=6, w=140))
    write('annotations/fleche-vague.svg', chalk_arrow('e', [(10, 60), (50, 44), (90, 64), (130, 46), (180, 58)], seed=7, w=200, h=100))


# ---------------------------------------------------------------- jetons
def make_tokens():
    os.makedirs(os.path.join(ROOT, 'tokens'), exist_ok=True)
    data = {'interface': UI, 'roue': {f'{i * 15}deg': c for i, c in enumerate(WHEEL)},
            'pigments': PIGMENTS, 'harmonie': HARMONY_BAR, 'variations': VARIATIONS,
            'typo': {'interface': 'Figtree', 'annotations': 'Caveat'},
            'rayons': {'panneau': 20, 'carte': 12, 'bouton': 12, 'onglet': 9, 'tuile': 8, 'rond': '50%'},
            'ombres': {'panneau': '0 12px 28px rgba(0,0,0,.7)', 'bouton': '0 3px 6px rgba(0,0,0,.55)'}}
    with open(os.path.join(ROOT, 'tokens', 'couleurs.json'), 'w', encoding='utf-8') as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    css = [':root {']
    css += [f'  --na-{k}: {v};' for k, v in UI.items()]
    css += [f'  --na-roue-{i * 15}: {c};' for i, c in enumerate(WHEEL)]
    css += [f'  --na-{k}: {v};' for k, v in PIGMENTS.items()]
    css += ['  --na-rayon-panneau: 20px;', '  --na-rayon-bouton: 12px;', '  --na-rayon-onglet: 9px;',
            '  --na-ombre-panneau: 0 12px 28px rgba(0,0,0,.7);', '  --na-ombre-bouton: 0 3px 6px rgba(0,0,0,.55);',
            "  --na-police: 'Figtree', 'Segoe UI', sans-serif;", "  --na-police-main: 'Caveat', cursive;", '}']
    with open(os.path.join(ROOT, 'tokens', 'couleurs.css'), 'w', encoding='utf-8') as fh:
        fh.write('/* Nature Anthracite : couleurs échantillonnées dans le concept */\n' + '\n'.join(css) + '\n')


def main():
    make_dabs()
    make_wheel()
    make_strokes()
    make_botanical()
    make_icons()
    make_ui()
    make_annotations()
    make_tokens()
    with open(os.path.join(SVG, 'liste.json'), 'w', encoding='utf-8') as fh:
        json.dump(WRITTEN, fh, ensure_ascii=False, indent=0)
    print(len(WRITTEN), 'SVG')


if __name__ == '__main__':
    main()
