#!/usr/bin/env python3
"""Assembler: build site/index.html from section fragments (P1). Idempotent."""
import re, os
ROOT = "/root/sparkler-lab/site"
ORDER = ["s1-hero", "s2-explain", "s3-lab", "s4-heads", "s5-editor", "s6-gallery", "s7-method"]
parts = []
for name in ORDER:
    p = f"{ROOT}/sections/{name}.html"
    parts.append(f"<!-- ==== {name} ==== -->\n" + open(p).read())
body = "\n".join(parts)
# Strip the per-fragment <style> blocks out of body and merge into one head style
styles = re.findall(r"<style>.*?</style>", body, flags=re.S)
body = re.sub(r"<style>.*?</style>\s*", "", body, flags=re.S)
merged_styles = "\n".join(s.replace("<style>", "").replace("</style>", "") for s in styles)

NAV = """
<header id="topnav">
  <nav aria-label="Primary">
    <a class="brand" href="#s1hero">⚡ Sparkler Exit Lab</a>
    <a href="#s1explain">Explain</a>
    <a href="#s2shoot">Shoot</a>
    <a href="#s2lab">Lab</a>
    <a href="#s3heads">Heads</a>
    <a href="#s4editor">Editor</a>
    <a href="#s5gallery">Gallery</a>
    <a href="#s5method">Method</a>
  </nav>
</header>"""

FOOTER = """
<footer>
  <p>Built as a static, client-side lab — no accounts, no uploads, no tracking. Imagery on this site is procedurally synthesized; see <a href="#s5method">Method &amp; Limitations</a>.</p>
  <p>MIT licensed · <a href="https://github.com/BenkoMatt/sparkler-exit-lab" rel="noopener" target="_blank">source on GitHub</a></p>
</footer>"""

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Sparkler Exit Lab — why sparklers vanish in flash photos, and a browser lab to fix them</title>
<meta name="description" content="Why sparkler tunnels vanish in flash photos — and a 100% client-side lab to examine your night shots and re-light the wands with customizable sparkler heads.">
<style>
:root {{
  --bg:#0b0d12; --panel:#141824; --text:#e8e6df; --muted:#9aa0ae;
  --accent:#ffb347; --accent2:#7ec8ff; --border:#232936;
  --good:#7ddf8e; --bad:#ff6b6b;
}}
* {{ box-sizing:border-box; }}
html {{ scroll-behavior:smooth; }}
body {{
  margin:0; background:var(--bg,#0b0d12); color:var(--text,#e8e6df);
  font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  line-height:1.6;
}}
img {{ max-width:100%; }}
a {{ color:var(--accent,#ffb347); }}
main {{ max-width:1080px; margin:0 auto; padding:0 20px; }}
header#topnav {{
  position:sticky; top:0; z-index:50; background:rgba(11,13,18,.92);
  border-bottom:1px solid var(--border,#232936); backdrop-filter:blur(6px);
}}
header#topnav nav {{ max-width:1080px; margin:0 auto; padding:10px 20px; display:flex; gap:18px; align-items:center; flex-wrap:wrap; }}
header#topnav a {{ color:var(--text,#e8e6df); text-decoration:none; font-size:.92rem; }}
header#topnav a:hover {{ color:var(--accent,#ffb347); }}
header#topnav .brand {{ font-weight:700; color:var(--accent,#ffb347); }}
footer {{
  border-top:1px solid var(--border,#232936); margin-top:64px;
  padding:28px 20px; color:var(--muted,#9aa0ae); font-size:.9rem; text-align:center;
}}
@media (prefers-reduced-motion: reduce) {{ html {{ scroll-behavior:auto; }} }}
</style>
<style>
/* ==== merged fragment styles ==== */
{merged_styles}
</style>
</head>
<body>
{NAV}
<main>
{body}
</main>
{FOOTER}
<script type="module" src="assets/js/app.js"></script>
</body>
</html>
"""
out = f"{ROOT}/index.html"
open(out, "w").write(html)
print("assembled", out, os.path.getsize(out), "bytes; fragments merged:", len(styles))