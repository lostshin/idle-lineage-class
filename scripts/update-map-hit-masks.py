"""Generate compact, lazy-loaded sprite hit masks for file:// (Canvas is tainted)."""
import base64
import json
import re
import zlib
from collections import defaultdict
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
names = set()
for module in ['22-pets.js', '23-summons.js', '31-castle-guards.js']:
    text = (root / 'js' / module).read_text()
    names.update(re.findall(r'(?:n|form)\s*:\s*[\'"]([^\'"]+)[\'"]', text))
    if module == '22-pets.js':
        names.update(re.findall(r'^\s*[\'"]([^\'"]+)[\'"]\s*:\s*\{', text, re.M))
for element in '水火風地':
    names.update([element + '屬性精靈', '強力' + element + '屬性精靈'])
folders = [p for kind in ['classanim', 'morphanim'] for p in (root / 'assets' / kind).iterdir() if p.is_dir()]
folders += [root / 'assets/anim' / name for name in names if (root / 'assets/anim' / name).is_dir()]
groups = defaultdict(dict)
for folder in sorted(folders):
    kind = folder.parent.name
    family = re.sub(r'(?:d[0-7]|2|F)$', '', folder.name) if kind != 'anim' else folder.name
    for path in sorted(folder.rglob('*.png')):
        if re.search(r'_(?:s|w)_\d+\.png$', path.name):
            continue
        with Image.open(path) as image:
            alpha = image.convert('RGBA').getchannel('A')
            mask = alpha.point(lambda a: 255 if a else 0).convert('1', dither=Image.Dither.NONE)
            groups[kind + '/' + family][str(path.relative_to(root / 'assets' / kind))] = [image.width, image.height, base64.b64encode(mask.tobytes()).decode()]
out = root / 'assets/map-hit-masks'
count = size = 0
for group, frames in sorted(groups.items()):
    indexes, masks, unique = {}, [], {}
    for path, mask in frames.items():
        key = tuple(mask)
        if key not in unique:
            unique[key] = len(masks)
            masks.append(mask)
        indexes[path] = unique[key]
    packed = base64.b64encode(zlib.compress(json.dumps({'frames': indexes, 'masks': masks}, ensure_ascii=False, separators=(',', ':')).encode(), 9)).decode()
    target = out / (group + '.js')
    target.parent.mkdir(parents=True, exist_ok=True)
    text = 'registerMapHitMasks(' + json.dumps(group, ensure_ascii=False) + ',' + json.dumps(packed) + ');\n'
    target.write_text(text)
    count += len(frames)
    size += len(text.encode())
print(f'Generated {count} exact alpha masks in {len(groups)} lazy-loaded groups ({size:,} bytes); original sprites unchanged.')
