# Builds the pictures of pages/thabat.html (images/thabat/). Sources: the uploaded
# artwork (kept outside the repo) and images/video-maker/*.webp.
#   covers/<key>.webp    banner, 1200x800 (shown ~270px tall, sharp up to 3x)
#   covers/<key>-s.webp  thumbnail, 256x256 (cards and the picker)
#   growth/g1..g7.webp   transparent sprout stages, 420px tall
#   hero.webp, moment.webp
# Run: python3 scripts/build-thabat-images.py <uploads-dir>
import os, sys
from PIL import Image
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
UP = sys.argv[1] if len(sys.argv) > 1 else ''
VM = os.path.join(ROOT, 'images', 'video-maker')
OUT = os.path.join(ROOT, 'images', 'thabat')
os.makedirs(os.path.join(OUT, 'covers'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'growth'), exist_ok=True)

def fit(im, w, h, cx=.5, cy=.5):
    """cover-crop to w x h around (cx, cy)"""
    W, H = im.size; r = max(w / W, h / H)
    im = im.resize((round(W * r), round(H * r)), Image.LANCZOS)
    W, H = im.size
    l = min(max(0, round(W * cx - w / 2)), W - w); t = min(max(0, round(H * cy - h / 2)), H - h)
    return im.crop((l, t, l + w, t + h))

# key: (source, banner focus x/y, thumb focus x/y)  — new artwork first, then the earlier landscapes
COVERS = [
  ('ember',     ('up', '96d703c1-image.png'), (.42, .5), (.33, .5)),
  ('new-start', ('up', '138f70fb-image.png'), (.56, .5), (.22, .45)),
  ('dawn',      ('up', '5bbe950a-image.png'), (.5, .55), (.47, .62)),
  ('lutf',      ('up', 'd5642a22-image.png'), (.5, .5),  (.5, .45)),
  ('path',      ('up', 'cfdc2ff6-image.png'), (.5, .5),  (.62, .5)),
  ('mushaf',    ('up', '78caa464-image.png'), (.45, .6), (.4, .62)),
  ('c1', ('vm', '3.webp'), (.5, .5), (.5, .5)), ('c2', ('vm', '4.webp'), (.5, .5), (.5, .5)),
  ('c3', ('vm', '9.webp'), (.5, .5), (.5, .5)), ('c4', ('vm', '8.webp'), (.5, .5), (.5, .5)),
  ('c5', ('vm', '21.webp'), (.5, .5), (.5, .5)), ('c6', ('vm', '1.webp'), (.5, .5), (.5, .5)),
  ('c7', ('vm', '6.webp'), (.5, .5), (.5, .5)), ('c8', ('vm', '15.webp'), (.5, .5), (.5, .5)),
]
def src(s):
    return Image.open(os.path.join(UP, s[1]) if s[0] == 'up' else os.path.join(VM, s[1])).convert('RGB')

for key, s, (bx, by), (tx, ty) in COVERS:
    if s[0] == 'up' and not UP: continue
    im = src(s)
    fit(im, 1200, 800, bx, by).save(os.path.join(OUT, 'covers', key + '.webp'), 'WEBP', quality=82, method=6)
    fit(im, 256, 256, tx, ty).save(os.path.join(OUT, 'covers', key + '-s.webp'), 'WEBP', quality=84, method=6)

# hero: the full-size original (it is shown taller than wide on phones)
src(('vm', '23.webp')).save(os.path.join(OUT, 'hero.webp'), 'WEBP', quality=80, method=6)

if UP:
    # the moment a weak moment is overcome: the sprout at sunrise (portrait artwork)
    im = Image.open(os.path.join(UP, '7b7201cb-image.png')).convert('RGB')
    fit(im, 960, 720, .5, .55).save(os.path.join(OUT, 'moment.webp'), 'WEBP', quality=80, method=6)
    # growth stages, smallest to the tree in flower; transparent margins trimmed
    STAGES = ['093c6ad8-image.png', 'bbb2d236-image.png', '9a17cd6a-image.png', '798ba72c-image.png',
              'a557f5be-image.png', 'e8f24977-image.png', '2a72d226-image.png']
    for i, f in enumerate(STAGES, 1):
        im = Image.open(os.path.join(UP, f)).convert('RGBA')
        box = im.getchannel('A').point(lambda a: 255 if a > 24 else 0).getbbox()
        im = im.crop(box)
        h = 420; w = round(im.width * h / im.height)
        im.resize((w, h), Image.LANCZOS).save(os.path.join(OUT, 'growth', f'g{i}.webp'), 'WEBP', quality=86, method=6)

for d in ('', 'covers', 'growth'):
    p = os.path.join(OUT, d)
    for f in sorted(os.listdir(p)):
        if f.endswith('.webp'): print(os.path.join(d, f), os.path.getsize(os.path.join(p, f)) // 1024, 'KB')
