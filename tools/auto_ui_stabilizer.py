from pathlib import Path

ROOT = "."

VIEWPORT_TAG = '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
LOADER_TAG = '<script src="components/smart-loader.js"></script>'

def ensure_viewport(html: str) -> str:
    if "<meta name=\"viewport\"" not in html:
        html = html.replace("<head>", "<head>\n    " + VIEWPORT_TAG)
    return html

def ensure_loader(html: str) -> str:
    if "smart-loader.js" not in html and "</body>" in html:
        html = html.replace("</body>", f"    {LOADER_TAG}\n</body>")
    return html

def ensure_mount_safety(html: str) -> str:
    # prevents navbar/footer blank issues by forcing stable DOM hooks
    safety_script = """
<script>
document.addEventListener("DOMContentLoaded", function () {
    function safe(el, fallback = "") {
        return document.getElementById(el) ? true : false;
    }

    // ensure layout containers exist (prevents silent failures)
    if (!document.getElementById("nav")) {
        const n = document.createElement("div");
        n.id = "nav";
        document.body.prepend(n);
    }

    if (!document.getElementById("footer")) {
        const f = document.createElement("div");
        f.id = "footer";
        document.body.appendChild(f);
    }
});
</script>
"""

    if "</body>" in html and "auto-ui-stabilizer" not in html:
        html = html.replace("</body>", safety_script + "\n</body>")
    return html


def patch_file(file: Path):
    html = file.read_text(encoding="utf-8", errors="ignore")

    original = html

    html = ensure_viewport(html)
    html = ensure_loader(html)
    html = ensure_mount_safety(html)

    if html != original:
        file.write_text(html, encoding="utf-8")
        print("FIXED:", file)


for file in Path(ROOT).rglob("*.html"):
    patch_file(file)

print("\nDONE: UI stabilized (navbar + footer + mobile + loader safe mode)")
