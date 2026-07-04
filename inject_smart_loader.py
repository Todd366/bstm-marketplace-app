from pathlib import Path

ROOT = Path(".")

TARGET_SCRIPT = '<script src="components/smart-loader.js"></script>'

SKIP_DIRS = {"node_modules", ".git"}

def should_skip(path):
    return any(part in SKIP_DIRS for part in path.parts)

for f in ROOT.rglob("*.html"):
    if should_skip(f):
        continue

    html = f.read_text(encoding="utf-8", errors="ignore")

    # already has loader
    if "smart-loader.js" in html:
        continue

    # inject before </body>
    if "</body>" in html:
        html = html.replace("</body>", f"  {TARGET_SCRIPT}\n</body>")
        f.write_text(html, encoding="utf-8")
        print("INJECTED:", f)

print("DONE: SMART LOADER INJECTION COMPLETE")
