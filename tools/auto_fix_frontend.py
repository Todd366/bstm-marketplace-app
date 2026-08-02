from pathlib import Path

ROOT = Path(".")

NAV_SNIPPET = '<div id="bstm-nav"></div>'
FOOTER_SNIPPET = '<div id="bstm-footer"></div>'
LOADER_SCRIPT = '<script src="components/smart-loader.js"></script>'

MOBILE_CSS = """
<style>
html, body {
  width: 100%;
  overflow-x: hidden;
  margin: 0;
  padding: 0;
}

img, div, section {
  max-width: 100%;
}

#bstm-page {
  min-height: 80vh;
}
</style>
"""

SKIP_DIRS = {"node_modules", ".git", "components"}


def should_skip(path):
    return any(part in SKIP_DIRS for part in path.parts)


def ensure_contains(body, snippet):
    return snippet in body


def inject_body_structure(html):
    if "</body>" not in html:
        return html

    # inject only once
    if "bstm-nav" in html and "bstm-footer" in html:
        return html

    body_content = ""

    # wrap content if missing structure
    if "<main" not in html:
        body_content = "\n  <main id='bstm-page'>\n    <!-- AUTO WRAPPED CONTENT -->\n  </main>\n"
    else:
        body_content = ""

    if NAV_SNIPPET not in html:
        body_content = NAV_SNIPPET + "\n" + body_content

    if FOOTER_SNIPPET not in html:
        body_content = body_content + "\n" + FOOTER_SNIPPET

    if LOADER_SCRIPT not in html:
        body_content += "\n" + LOADER_SCRIPT

    if MOBILE_CSS not in html:
        body_content += MOBILE_CSS

    return html.replace("</body>", body_content + "\n</body>")


def fix_file(file):
    html = file.read_text(encoding="utf-8", errors="ignore")

    new_html = inject_body_structure(html)

    if new_html != html:
        file.write_text(new_html, encoding="utf-8")
        print("FIXED:", file.name)


def main():
    for f in ROOT.rglob("*.html"):
        if should_skip(f):
            continue
        fix_file(f)

    print("\nDONE: FULL FRONTEND AUTO FIX COMPLETE")


if __name__ == "__main__":
    main()
