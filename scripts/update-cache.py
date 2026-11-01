#!/usr/bin/env python3
"""Stamp local resource URLs without changing the mirrored service worker."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parent.parent
path = root / 'index.html'
html = path.read_text()
def stamp(match):
    url = match.group(2)
    resource = root / url.split('?')[0]
    if url.startswith(('http:', 'https:', '//')) or not resource.is_file():
        return match.group(0)
    version = hashlib.sha256(resource.read_bytes()).hexdigest()[:10]
    return match.group(1) + url.split('?')[0] + '?v=' + version + match.group(3)
html = re.sub(r'((?:src|href)=")([^" ]+\.(?:js|css)(?:\?[^" ]*)?)(")', stamp, html)
# The release identity belongs to this exact HTML and its referenced code, not the SW.
release_path = root / 'comfort-update.json'
release = json.loads(release_path.read_text())
release['version'] = re.search(r"const FORK_VERSION = '(v\d+\.\d+\.\d+)'", (root / 'js/00-data.js').read_text()).group(1)
normalized = re.sub(r'(<meta name="comfort-(?:build|published)" content=")[^"]*(">)', r'\1\2', html)
digest = hashlib.sha256(normalized.encode())
for url in sorted(set(re.findall(r'(?:src|href)="([^" ]+\.(?:js|css)(?:\?[^" ]*)?)"', html))):
    resource = root / url.split('?')[0]
    if not url.startswith(('http:', 'https:', '//')) and resource.is_file():
        digest.update(url.split('?')[0].encode())
        digest.update(resource.read_bytes())
digest.update(json.dumps({key: release[key] for key in ['schema', 'product', 'version', 'notes']}, ensure_ascii=False, sort_keys=True).encode())
identity = digest.hexdigest()
if release.get('build') != identity:
    release['build'] = identity
    release['publishedAt'] = datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
for name, value in [('build', release['build']), ('published', release['publishedAt'])]:
    html = re.sub(r'(<meta name="comfort-' + name + r'" content=")[^"]*(">)', lambda match: match[1] + value + match[2], html)
release_text = json.dumps(release, ensure_ascii=False, indent=2) + '\n'
if '--check' in sys.argv:
    if html != path.read_text() or release_text != release_path.read_text():
        raise SystemExit('Release identity or resource stamps are stale; run python3 scripts/update-cache.py')
    print('Release identity and resource stamps match.')
else:
    path.write_text(html)
    release_path.write_text(release_text)
    print('Stamped resources and comfort release identity; mirrored sw.js preserved.')
