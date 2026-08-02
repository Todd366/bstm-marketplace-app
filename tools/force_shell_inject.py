from pathlib import Path

ROOT = Path(".")

for f in ROOT.rglob("*.html"):
    if "node_modules" in str(f):
        continue

    txt = f.read_text(encoding="utf-8", errors="ignore")

    if "</body>" not in txt:
        continue

    # prevent duplicates
    if "data-component='nav'" in txt:
        continue

    injection = """
<div data-component='nav'></div>
<div data-component='footer'></div>
"""

    txt = txt.replace("</body>", injection + "\n</body>")
    f.write_text(txt, encoding="utf-8")

    print("SHELL FIXED:", f)

print("DONE: NAV + FOOTER FORCED INTO ALL PAGES")
