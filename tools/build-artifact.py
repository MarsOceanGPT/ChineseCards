#!/usr/bin/env python3
"""
Build the hosted-artifact fragment from index.html.

Some hosts (claude.ai artifacts among them) wrap the file you give them in
their own <!doctype html><head>...</head><body> skeleton. Handing them a full
document nests one inside the other, and the <head> — including the viewport
meta the phone layout depends on — ends up parsed into the body and ignored.

So this strips the wrapper down to <style> + markup + <script>, and pins the
viewport from script instead. Output is generated; edit index.html, not it.

    python3 tools/build-artifact.py
"""

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "index.html"
OUT = ROOT / ".artifact" / "cellsea.html"

SHIM = """<script>
// The artifact host owns the document head, so pin the viewport from script
// rather than a meta tag that would be parsed into the body and ignored.
(function () {
  var m = document.querySelector('meta[name="viewport"]');
  if (!m) { m = document.createElement('meta'); m.name = 'viewport'; document.head.appendChild(m); }
  m.setAttribute('content',
    'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
  document.title = 'Cellsea';
})();
</script>
<style>
/* defend against whatever reset the host applies to the document body */
html, body { margin: 0 !important; padding: 0 !important; max-width: none !important; border: 0 !important; }
</style>
"""


def main() -> None:
    src = SRC.read_text()
    style = re.search(r"<style>.*?</style>", src, re.S)
    body = re.search(r"<body>(.*?)</body>", src, re.S)
    if not style or not body:
        raise SystemExit("index.html is missing its <style> or <body> block")

    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(SHIM + style.group(0) + "\n" + body.group(1).strip() + "\n")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
