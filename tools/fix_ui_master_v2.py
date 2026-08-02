from pathlib import Path

ROOT = Path(".")

SCRIPT = '<script src="components/smart-loader.js"></script>'

VIEWPORT = '<meta name="viewport" content="width=device-width, initial-scale=1.0">'

def ensure_loader(html: str) -> str:
    if "smart-loader.js" not in html:
        if "</body>" in html:
            html = html.replace("</body>", f"  {SCRIPT}\n</body>")
    return html

def ensure_viewport(html: str) -> str:
    if "name=\"viewport\"" not in html:
        if "<head>" in html:
            html = html.replace("<head>", f"<head>\n  {VIEWPORT}")
    return html

def fix_mobile_css(html: str) -> str:
    # force mobile-safe root scaling
    patch = """
<style>
html, body {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
}

* {
    box-sizing: border-box;
}

@media (max-width: 768px) {
    body {
        font-size: 14px;
    }

    nav, .navbar {
        flex-direction: column !important;
    }

    footer {
        flex-direction: column !important;
    }
}
</style>
"""
    if "overflow-x: hidden" not in html:
        if "</head>" in html:
            html = html.replace("</head>", patch + "\n</head>")
    return html

def fix_file(f: Path):
    html = f.read_text(encoding="utf-8", errors="ignore")

    original = html

    html = ensure_loader(html)
    html = ensure_viewport(html)
    html = fix_mobile_css(html)

    if html != original:
        f.write_text(html, encoding="utf-8")
        print("FIXED:", f)

for file in ROOT.rglob("*.html"):
    fix_file(file)

print("DONE: UI MASTER V2 FIX APPLIED")
