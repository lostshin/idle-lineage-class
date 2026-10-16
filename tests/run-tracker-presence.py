#!/usr/bin/env python3
"""Run real game/browser presence E2E against a loopback BitTorrent tracker."""
import argparse
import functools
import http.server
import json
from pathlib import Path
import subprocess
import tempfile
import threading

parser = argparse.ArgumentParser()
parser.add_argument('--space', type=int, required=True)
parser.add_argument('--protocol', choices=['http', 'file', 'both'], default='both')
parser.add_argument('--artifacts', default='tmp/test-runs/tracker-presence')
parser.add_argument('--tracker-module', type=Path)
parser.add_argument('--skip-screenshots', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
artifacts = (root / args.artifacts).resolve()
artifacts.mkdir(parents=True, exist_ok=True)
module = args.tracker_module
if module is None:
    dependencies = Path(tempfile.gettempdir()) / 'idle-lineage-tracker-e2e-11.2.3'
    module = dependencies / 'node_modules/bittorrent-tracker/server.js'
    if not module.is_file():
        subprocess.run(['npm', 'install', '--ignore-scripts', '--no-audit', '--no-fund', '--no-save',
                        '--package-lock=false', '--prefix', str(dependencies), 'bittorrent-tracker@11.2.3'], check=True)

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def handle(self):
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError):
            pass

class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128

server = Server(('127.0.0.1', 0), functools.partial(Handler, directory=str(root)))
threading.Thread(target=server.serve_forever, daemon=True).start()
fixture = subprocess.Popen(['node', str(root / 'tests/tracker-presence-fixture.mjs'), str(module.resolve())], stdout=subprocess.PIPE, text=True)
try:
    endpoints = json.loads(fixture.stdout.readline())
    for protocol in (['http', 'file'] if args.protocol == 'both' else [args.protocol]):
        options = {'root': str(root), 'artifacts': str(artifacts), 'space': args.space,
                   'protocol': protocol, 'skipScreenshots': args.skip_screenshots, **endpoints,
                   'url': (root / 'index.html').as_uri() if protocol == 'file' else f'http://127.0.0.1:{server.server_port}/index.html'}
        source = 'const options = ' + json.dumps(options) + ';\n' + (root / 'tests/tracker-presence.e2e.js').read_text()
        result = subprocess.run(['ego-browser', 'nodejs'], input=source, text=True, cwd=root)
        if result.returncode:
            raise SystemExit(result.returncode)
finally:
    fixture.terminate()
    fixture.wait(timeout=10)
    server.shutdown()
