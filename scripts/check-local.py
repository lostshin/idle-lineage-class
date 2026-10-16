#!/usr/bin/env python3
"""Run every local check that does not need a browser; exit non-zero on any failure.

Failure cases: JavaScript syntax errors, whitespace errors in the diff, stale ?v=
resource stamps in index.html, mirrored add-on files edited or missing, and failing
Node integration harnesses. Reports go to tmp/test-runs; tracked files are not written.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess

root = Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text()
results = []

def check(name, ok, detail=''):
    results.append((name, ok, detail))

def run(cmd):
    return subprocess.run(cmd, cwd=root, capture_output=True, text=True)

scripts = [s.split('?')[0] for s in re.findall(r'<script[^>]+src="([^"]+)"', html) if not s.startswith(('http:', 'https:', '//'))]
for path in scripts + sorted(str(p.relative_to(root)) for p in (root / 'tests').glob('*.js')):
    if not (root / path).is_file():
        check('syntax ' + path, False, 'missing file')
        continue
    r = run(['node', '--check', path])
    if r.returncode:
        check('syntax ' + path, False, next((l for l in r.stderr.splitlines() if 'Error' in l), 'node --check failed'))
check('syntax (' + str(len(scripts)) + ' loaded scripts + tests)', not any(n.startswith('syntax ') for n, ok, _ in results if not ok))

r = run(['git', 'diff', 'HEAD', '--check'])
check('git diff --check', r.returncode == 0, r.stdout.strip().splitlines()[0] if r.stdout.strip() else r.stderr.strip())

# Same stamping rule as scripts/update-cache.py, compared instead of written.
stale = []
for url in re.findall(r'(?:src|href)="([^" ]+\.(?:js|css)(?:\?[^" ]*)?)"', html):
    resource = root / url.split('?')[0]
    if url.startswith(('http:', 'https:', '//')) or not resource.is_file():
        continue
    if url != url.split('?')[0] + '?v=' + hashlib.sha256(resource.read_bytes()).hexdigest()[:10]:
        stale.append(url.split('?')[0])
check('index.html ?v= stamps', not stale, 'run python3 scripts/update-cache.py: ' + ', '.join(stale) if stale else '')

source = json.loads((root / 'tests/addon-source.json').read_text())
bad = []
for entry in source['files']:
    local_path = entry.get('localPath', entry['path'])
    resource = root / local_path
    if not resource.is_file() or hashlib.sha256(resource.read_bytes()).hexdigest() != entry['sha256']:
        bad.append(local_path)
check('mirrored add-ons (' + str(len(source['files'])) + ' files)', not bad, 'changed or missing: ' + ', '.join(bad) if bad else '')

for path in sorted(str(p.relative_to(root)) for p in (root / 'tests').glob('*.integration.js')):
    r = run(['node', path])
    check('integration ' + path, r.returncode == 0, '' if r.returncode == 0 else f'exit code {r.returncode}; rerun node {path} for details')

for name, ok, detail in results:
    print(('PASS  ' if ok else 'FAIL  ') + name + ('  — ' + detail if detail else ''))
failed = sum(1 for _, ok, _ in results if not ok)
print(f'{len(results) - failed}/{len(results)} passed')
raise SystemExit(1 if failed else 0)
