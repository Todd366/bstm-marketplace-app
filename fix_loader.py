from pathlib import Path

ROOT = "."
SCRIPT_TAG = '<script src="components/smart-loader.js"></script>'

html_files = list(Path(ROOT).rglob("*.html"))

for file in html_files:
    text = file.read_text(encoding="utf-8", errors="ignore")

    # Skip if already properly injected
    if "components/smart-loader.js" in text:
        continue

    # Inject before </body>
    if "</body>" in text:
        new_text = text.replace("</body>", f"  {SCRIPT_TAG}\n</body>")
        file.write_text(new_text, encoding="utf-8")
        print(f"INJECTED: {file}")
