#!/usr/bin/env python3
"""Run responsive UI E2E in an isolated Ego task space."""
import argparse
import functools
import http.server
import json
from pathlib import Path
import subprocess
import threading

SUITES = ['rwd','ui-scale','gameplay','account-gameplay','visual-account-gameplay','companion-commands','game-tools','pwa','visual-game-tools','addon-defaults','compact-layout','party-refinements','party-equipment','visual-party-equipment','village-clan-warehouse','visual-village-clan-warehouse','ally-skill-stop','visual-ally-skill-stop','skill-cards','visual-skill-cards','town-buffs-enhance','visual-town-buffs-enhance','summon-display','visual-summon-display','play-fixes','desktop-feedback','visual-desktop-feedback']
REQUIRED = ['rwd','ui-scale','gameplay','account-gameplay','companion-commands']
SUITES += ['desktop-acceptance','visual-desktop-acceptance','ability-cleanup','tooltip-stability','clan-ability','offline-rewards','effect-details','visual-effect-details']
SUITES += ['warehouse-list','performance','ui-performance','mobile-status','party-header','field-reports']
SUITES += ['optional-addons','comfort-release','creation-id','guild-settlement']
SUITES += ['gear-accelerator']
SUITES += ['ken-reports']
SUITES += ['precise-shot']
SUITES += ['player-feedback']
SUITES += ['main-backpack']
SUITES += ['equipment-trials']
SUITES += ['backpack-a']
SUITES += ['guild-inventory-filters']
SUITES += ['backpack-feedback']
SUITES += ['item-window-controls']
SUITES += ['ken-offline-settings']
SUITES += ['loot-nav']
SUITES += ['social-lobby']
SUITES += ['lobby-camp']
SUITES += ['lobby-fit']
SUITES += ['ken-market']
SUITES += ['feedback-1020']
SUITES += ['lobby-live-actors']
SUITES += ['lobby-presence']
SUITES += ['feedback-reliability','lobby-rest','offline-team']
SUITES += ['site-presence','lobby-recent','lobby-actions','lobby-adventure']
SUITES += ['same-batch-enhance']
SUITES += ['same-batch-ux']
SUITES += ['feedback-1022']
SUITES += ['guild-poly','catchup-progress','catchup-equivalence','item-effects','item-breathing']
SUITES += ['feedback-1023','player-poly','player-reports-1023','player-ui','player-ui-desktop','player-ui-touch','mobile-live','mobile-manual']
SUITES += ['save-recovery','player-reports-1028','offline-survival']

parser = argparse.ArgumentParser()
parser.add_argument('--desktop-only', action='store_true', help='Skip mobile and tablet viewport checks')
parser.add_argument('--baseline', action='store_true')
parser.add_argument('--soak-minutes', type=float, default=30, help='UI performance wall-clock map soak duration (default: 30 minutes)')
parser.add_argument('--protocol', choices=['http','file','both'], default='http')
parser.add_argument('--suite', nargs='+', choices=SUITES + ['required'], default=['rwd'], help="One or more suites run in order; 'required' expands to " + ' '.join(REQUIRED))
parser.add_argument('--space', type=int)
parser.add_argument('--page', default='p1')
parser.add_argument('--keep-space', action='store_true')
parser.add_argument('--skip-screenshots', action='store_true', help='Run all behavior checks when browser image capture is unavailable')
output = parser.add_mutually_exclusive_group()
output.add_argument('--record', action='store_true', help='Write reports to tests/artifacts instead of tmp/test-runs')
output.add_argument('--artifacts', type=Path, help='Write reports to this directory (relative to the project root or absolute)')
args = parser.parse_args()
if not 0 <= args.soak_minutes <= 1440:
    parser.error('--soak-minutes must be between 0 and 1440')
suites = [s for name in args.suite for s in (REQUIRED if name == 'required' else [name])]
protocols = ['http','file'] if args.protocol == 'both' else [args.protocol]
runs = [(protocol, suite) for protocol in protocols for suite in suites]
if len(runs) > 1 and args.space is None:
    parser.error('running several suites or protocols requires --space so every run shares one task space')
for i, (protocol, suite) in enumerate(runs):
    if suite.startswith('visual-') and args.space is None:
        parser.error(suite + ' requires --space from a ' + suite[len('visual-'):] + ' --keep-space run')
    if suite.startswith('visual-') and i > 0 and runs[i - 1] != (protocol, suite[len('visual-'):]):
        parser.error(suite + ' must directly follow ' + suite[len('visual-'):] + ' in the same protocol')
root = Path(__file__).resolve().parent.parent
artifacts = (root / (args.artifacts or ('tests/artifacts' if args.record else 'tmp/test-runs'))).resolve()
artifacts.mkdir(parents=True, exist_ok=True)

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
returncode = 0
try:
    for protocol, suite in runs:
        if len(runs) > 1:
            print(f'== {suite} ({protocol})', flush=True)
        options = {'root': str(root), 'artifacts': str(artifacts), 'baseline': args.baseline, 'desktopOnly': args.desktop_only,
                   'space': args.space, 'page': args.page, 'soakMinutes': args.soak_minutes, 'keepSpace': args.keep_space or len(runs) > 1, 'skipScreenshots': args.skip_screenshots, 'protocol': protocol, 'url': (root / 'index.html').as_uri() if protocol == 'file' else f'http://127.0.0.1:{server.server_port}/index.html'}
        test = root / ('tests/' + suite + '.js' if suite.startswith('visual-') else 'tests/' + suite + '.e2e.js')
        source = 'const options = ' + json.dumps(options) + ';\n' + test.read_text()
        result = subprocess.run(['ego-browser', 'nodejs'], input=source, text=True)
        if result.returncode:
            returncode = result.returncode
            if len(runs) > 1:
                print(f'== {suite} ({protocol}) failed with exit code {result.returncode}; stopping', flush=True)
            break
finally:
    server.shutdown()
raise SystemExit(returncode)
