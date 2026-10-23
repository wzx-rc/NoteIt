"""Textures raccordables (bords qui se répètent sans couture) : grain anthracite et grain papier."""
import os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'png', 'textures')
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)


def noise(n, sigmas):
    acc = np.zeros((n, n))
    for s, a in sigmas:
        acc += a * ndi.gaussian_filter(rng.standard_normal((n, n)), s, mode='wrap') * (s ** 0.9 if s else 1)
    acc -= acc.mean()
    return acc / acc.std()


# 1. fond anthracite opaque, grain fin + marbrure douce
n = noise(512, [(0, .5), (1, .6), (6, .5), (40, .8)])
base = np.array([33, 34, 34], float)
img = np.clip(base[None, None, :] + n[..., None] * 2.6 + rng.normal(0, .8, (512, 512, 1)), 0, 255).astype(np.uint8)
Image.fromarray(img, 'RGB').save(os.path.join(OUT, 'fond-anthracite-512.png'), optimize=True)

# 2. voile de grain papier (blanc, transparent) à poser sur un panneau
g = noise(512, [(0, 1), (.7, .6), (3, .3)])
a = np.clip((g - 0.6) * 22, 0, 40).astype(np.uint8)
rgba = np.dstack([np.full((512, 512), 255, np.uint8)] * 3 + [a])
Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, 'voile-grain-papier-512.png'), optimize=True)

# 3. voile d'ombre marbrée (noir, transparent) pour casser les aplats
m = noise(512, [(12, 1), (30, .8)])
a = np.clip((m + 0.3) * 18, 0, 46).astype(np.uint8)
rgba = np.dstack([np.zeros((512, 512), np.uint8)] * 3 + [a])
Image.fromarray(rgba, 'RGBA').save(os.path.join(OUT, 'voile-marbrure-512.png'), optimize=True)

# 4. papier pastel (dents du papier) pour masquer un trait : blanc = pigment accroché
t = noise(256, [(0, 1), (.8, .7), (2, .4)])
a = np.clip(128 + t * 90, 0, 255).astype(np.uint8)
Image.fromarray(np.dstack([np.full((256, 256), 255, np.uint8)] * 3 + [a]), 'RGBA').save(
    os.path.join(OUT, 'dents-papier-256.png'), optimize=True)
print('textures OK')
