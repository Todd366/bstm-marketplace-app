from pathlib import Path

ROOT = Path(".")

SCRIPT_TAG = '<script src="components/smart-loader.js"></script>'
SKIP = {"node_modules", ".git"}

def should_skip(path):
    return any(part in SKIP for part in path.parts)

def ensure_loader(html: str) -> str:
    if "smart-loader.js" in html:
        return html

    if "</body>" in html:
        return html.replace("</body>", f"  {SCRIPT_TAG}\n</body>")

    return html + "\n" + SCRIPT_TAG + "\n"

def clean_inline_js(html: str) -> str:
    # aggressive cleanup (safe mode)
    import re

    # remove inline script blocks (basic but effective)
    html = re.sub(r"<script(?![^>]*src=)[^>]*>.*?</script>", "", html, flags=re.S)

    # remove on* handlers
    html = re.sub(r"\s(on\w+)=['\"][^'\"]*['\"]", "", html)

    return html

count = 0

for f in ROOT.rglob("*.html"):
    if should_skip(f):
        continue

    html = f.read_text(encoding="utf-8", errors="ignore")

    new_html = clean_inline_js(html)
    new_html = ensure_loader(new_html)

    if new_html != html:
        f.write_text(new_html, encoding="utf-8")
        print("FIXED:", f)

        count += 1

print("\nDONE:", count, "FILES STABILIZED")
