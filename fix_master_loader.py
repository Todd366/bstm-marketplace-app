from pathlib import Path

ROOT = "."

LOADER = '<script src="components/smart-loader.js"></script>'

def has_loader(html):
    return "smart-loader.js" in html

def fix(file):
    html = file.read_text(encoding="utf-8", errors="ignore")

    # ensure ONLY ONE loader
    if not has_loader(html):
        if "</body>" in html:
            html = html.replace("</body>", f"  {LOADER}\n</body>")

    # fix navbar mount safety (REAL issue)
    if "id=\"nav\"" not in html:
        html = html.replace("<body>", "<body>\n<div id='nav'></div>")

    if "id=\"footer\"" not in html:
        html = html.replace("</body>", "<div id='footer'></div>\n</body>")

    file.write_text(html, encoding="utf-8")
    print("FIXED:", file)

for f in Path(ROOT).rglob("*.html"):
    fix(f)

print("DONE: MASTER LOADER FIX APPLIED")
