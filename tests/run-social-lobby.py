#!/usr/bin/env python3
"""Run the real lobby browser flow against isolated local workerd/D1, never remote data."""
# Failure cases: missing dependencies, occupied ports, migration/startup failures,
# a server dying during a test, leaked children and synthetic records in a real database.
import argparse
import functools
import http.server
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import time

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--space', type=int, required=True, help='Reuse the current Ego TaskSpace')
parser.add_argument('--suite', choices=['social-lobby','lobby-camp'], default='social-lobby')
parser.add_argument('--keep-space', action='store_true')
parser.add_argument('--skip-screenshots', action='store_true')
parser.add_argument('--artifacts', type=Path, default=Path('tmp/test-runs/social-lobby-live'))
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
backend = root / 'backend/lobby'
wrangler = backend / 'node_modules/.bin/wrangler'
if not wrangler.is_file():
    parser.error('Run npm ci --prefix backend/lobby first')
artifacts = (root / args.artifacts).resolve()
artifacts.mkdir(parents=True, exist_ok=True)

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def handle(self):
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError):
            pass

def free_port():
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        return probe.getsockname()[1]

class Server(http.server.ThreadingHTTPServer):
    request_queue_size = 128

server = Server(('127.0.0.1', 0), functools.partial(Handler, directory=str(root)))
worker = None
exit_code = 1
try:
    threading.Thread(target=server.serve_forever, daemon=True).start()
    origin = 'http://127.0.0.1:' + str(server.server_port)
    api_port, inspector_port = free_port(), free_port()
    with tempfile.TemporaryDirectory(prefix='local-d1-', dir=artifacts) as persist, (artifacts / 'workerd.log').open('w') as log:
        env = dict(os.environ, CLOUDFLARE_SEND_METRICS='false')
        subprocess.run([str(wrangler), 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', persist], cwd=backend, env=env, check=True, stdout=log, stderr=log)
        worker = subprocess.Popen([str(wrangler), 'dev', '--local', '--port', str(api_port), '--inspector-port', str(inspector_port), '--persist-to', persist, '--var', 'ALLOWED_ORIGINS:' + origin + ',https://lostshin.github.io', '--var', 'ALLOW_LOCAL_CLIENTS:true'], cwd=backend, env=env, stdout=log, stderr=log)
        deadline = time.monotonic() + 30
        while True:
            if worker.poll() is not None:
                raise RuntimeError('Local Worker exited; see ' + str(artifacts / 'workerd.log'))
            try:
                with socket.create_connection(('127.0.0.1', api_port), timeout=.2):
                    break
            except OSError:
                if time.monotonic() >= deadline:
                    raise RuntimeError('Local Worker startup timed out')
                time.sleep(.2)
        options = {'root': str(root), 'artifacts': str(artifacts), 'space': args.space, 'protocol': 'http', 'url': origin + '/index.html', 'lobbyApi': 'http://127.0.0.1:' + str(api_port), 'keepSpace': args.keep_space, 'skipScreenshots': args.skip_screenshots}
        try:
            result = subprocess.run(['ego-browser', 'nodejs'], input='const options=' + json.dumps(options) + ';\n' + (root / ('tests/' + args.suite + '.e2e.js')).read_text(), text=True)
            exit_code = result.returncode
        finally:
            worker.terminate()
            try:
                worker.wait(timeout=10)
            except subprocess.TimeoutExpired:
                worker.kill()
                worker.wait()
            worker = None
finally:
    if worker is not None:
        worker.terminate()
        worker.wait(timeout=10)
    server.shutdown()
    server.server_close()
raise SystemExit(exit_code)
