#!/usr/bin/env python3
"""Serve the game from one stable local origin; never choose a different port."""
import functools
import http.server
from pathlib import Path

root = Path(__file__).resolve().parent.parent
handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(root))
try:
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 8000), handler)
except OSError as exc:
    raise SystemExit('無法使用固定連接埠 8000。請關閉佔用該連接埠的伺服器後重試，避免換網址而讀到不同存檔。') from exc
print('遊戲入口：http://127.0.0.1:8000/index.html', flush=True)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
