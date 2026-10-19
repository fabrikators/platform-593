"""Local dev server with caching off, so edited ES modules always reload.

Usage: python3 tools/serve.py [port] [--prod]
  --prod  also sends the production security headers from deploy/security-headers.conf
"""
import functools
import http.server
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTRA = {'.gltf': 'model/gltf+json', '.hdr': 'application/octet-stream', '.bin': 'application/octet-stream'}


def prod_headers():
    text = open(os.path.join(ROOT, 'deploy', 'security-headers.conf'), encoding='utf-8').read()
    return re.findall(r'add_header\s+(\S+)\s+"([^"]*)"', text)


class NoCache(http.server.SimpleHTTPRequestHandler):
    headers_extra = []

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        return EXTRA.get(ext) or super().guess_type(path)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        for k, v in self.headers_extra:
            self.send_header(k, v)
        super().end_headers()

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    port = int(args[0]) if args else 8593
    if '--prod' in sys.argv:
        NoCache.headers_extra = prod_headers()
    handler = functools.partial(NoCache, directory=ROOT)
    http.server.ThreadingHTTPServer(('127.0.0.1', port), handler).serve_forever()
