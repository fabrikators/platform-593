"""Print the CSP hash of the inline import map in the pages, and update deploy/security-headers.conf.
Every page must carry the same import map, byte for byte, so one hash covers them all."""
import base64
import hashlib
import os
import re
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = ['index.html', 'photos.html', 'walk2.html']
hashes = {}
for page in PAGES:
    html = open(os.path.join(root, page), encoding='utf-8').read()
    block = re.search(r'<script type="importmap">(.*?)</script>', html, re.S).group(1)
    hashes[page] = 'sha256-' + base64.b64encode(hashlib.sha256(block.encode()).digest()).decode()
if len(set(hashes.values())) != 1:
    sys.exit('the import maps differ: ' + ', '.join(f'{p} {h}' for p, h in hashes.items()))
h = hashes[PAGES[0]]
conf = os.path.join(root, 'deploy', 'security-headers.conf')
text = open(conf, encoding='utf-8').read()
text = re.sub(r"'sha256-[A-Za-z0-9+/=]+'", f"'{h}'", text)
open(conf, 'w', encoding='utf-8').write(text)
print(h)
