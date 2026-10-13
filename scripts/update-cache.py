#!/usr/bin/env python3
"""Stamp local resource URLs without changing the mirrored service worker."""
import hashlib
from pathlib import Path
import re

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
path.write_text(html)
print('Stamped local JavaScript/CSS resource hashes; mirrored sw.js preserved.')
