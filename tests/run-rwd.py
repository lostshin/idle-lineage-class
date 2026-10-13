#!/usr/bin/env python3
"""Run responsive UI E2E in an isolated Ego task space."""
import argparse
import functools
import http.server
import json
from pathlib import Path
import subprocess
import threading

parser = argparse.ArgumentParser()
parser.add_argument('--baseline', action='store_true')
parser.add_argument('--protocol', choices=['http','file'], default='http')
parser.add_argument('--suite', choices=['rwd','ui-scale','gameplay','account-gameplay','visual-account-gameplay','companion-commands','game-tools','pwa','visual-game-tools','addon-defaults'], default='rwd')
parser.add_argument('--space', type=int)
parser.add_argument('--page', default='p1')
parser.add_argument('--keep-space', action='store_true')
parser.add_argument('--skip-screenshots', action='store_true', help='Run all behavior checks when browser image capture is unavailable')
args = parser.parse_args()
if args.suite in ['visual-account-gameplay','visual-game-tools'] and not args.space:
    parser.error('visual-account-gameplay requires --space from an account-gameplay --keep-space run')
root = Path(__file__).resolve().parent.parent
artifacts = root / 'tests/artifacts'
artifacts.mkdir(exist_ok=True)

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
options = {'root': str(root), 'artifacts': str(artifacts), 'baseline': args.baseline,
           'space': args.space, 'page': args.page, 'keepSpace': args.keep_space, 'skipScreenshots': args.skip_screenshots, 'protocol': args.protocol, 'url': (root / 'index.html').as_uri() if args.protocol == 'file' else f'http://127.0.0.1:{server.server_port}/index.html'}
source = 'const options = ' + json.dumps(options) + ';\n' + (root / {'rwd':'tests/rwd.e2e.js','ui-scale':'tests/ui-scale.e2e.js','gameplay':'tests/gameplay.e2e.js','account-gameplay':'tests/account-gameplay.e2e.js','visual-account-gameplay':'tests/visual-account-gameplay.js','companion-commands':'tests/companion-commands.e2e.js','game-tools':'tests/game-tools.e2e.js','pwa':'tests/pwa.e2e.js','addon-defaults':'tests/addon-defaults.e2e.js','visual-game-tools':'tests/visual-game-tools.js'}[args.suite]).read_text()
try:
    result = subprocess.run(['ego-browser', 'nodejs'], input=source, text=True)
finally:
    server.shutdown()
raise SystemExit(result.returncode)
