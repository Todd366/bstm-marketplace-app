#!/usr/bin/env python3
"""
BSTM — 4-PHASE SYSTEM ARCHITECTURE AUDIT (IMPROVED VERSION)
Read-only static + structural analyzer with reduced false positives.
"""

import re, os, glob
from datetime import datetime
from collections import defaultdict

ROOT = os.getcwd()
STAMP = datetime.now().strftime("%Y%m%d-%H%M")
REPORT_PATH = os.path.join(ROOT, f"system-audit-{STAMP}.txt")

SKIP_DIRS = {
    'node_modules', '.git', 'backup-legacy', 'legacy_archive',
    'supabase_fix_backup', '.mega-audit-work', '.deep-audit-work',
    '.audit-work', 'dist', 'build'
}

# ─────────────────────────────────────────────
# FILE DISCOVERY
# ─────────────────────────────────────────────

def find_html_files():
    files = []
    for root_dir, dirs, filenames in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in filenames:
            if f.endswith('.html') and not f.endswith('.bak.html'):
                rel = os.path.join(root_dir, f).lstrip('./')
                if not rel.endswith('.fix.bak'):
                    files.append(rel)
    return sorted(files)

def find_js_modules():
    return sorted(glob.glob('js/pages/**/*.js', recursive=True)) + sorted(glob.glob('js/pages/*.js'))

def read(path):
    try:
        return open(path, encoding='utf-8', errors='replace').read()
    except Exception:
        return ""

# ─────────────────────────────────────────────
# ANALYSIS HELPERS
# ─────────────────────────────────────────────

SCRIPT_BLOCK = re.compile(r'<script(?![^>]*src).*?</script>', re.S)
ON_EVENT = re.compile(r'on\w+="([^"]+)"', re.I)

def extract_inline_scripts(content):
    return [s for s in SCRIPT_BLOCK.findall(content) if s.strip()]

def extract_on_events(content):
    return ON_EVENT.findall(content)

def has_bare_js(content):
    """
    Improved heuristic:
    ignores HTML noise and requires stronger JS signals
    """
    stripped = re.sub(r'<script[^>]*>.*?</script>', '', content, flags=re.S)
    stripped = re.sub(r'<style[^>]*>.*?</style>', '', stripped, flags=re.S)

    for line in stripped.splitlines():
        s = line.strip()

        if not s:
            continue

        if re.match(r'^(function\s+\w+|const\s+\w+|let\s+\w+|var\s+\w+)\s*', s):
            return True

        if re.match(r'^(document\.|window\.|setTimeout\(|setInterval\()', s):
            return True

    return False

# ─────────────────────────────────────────────
# MODULE MAPPING (FIXED)
# ─────────────────────────────────────────────

def module_name(html_file):
    base = html_file.replace('.html', '')
    return f"js/pages/{base}.js"

# ─────────────────────────────────────────────
# CLASSIFICATION
# ─────────────────────────────────────────────

def classify(content):
    loader = 'smart-loader.js' in content
    inline = extract_inline_scripts(content)
    events = extract_on_events(content)
    bare = has_bare_js(content)

    issues = []
    severity = 0

    if not loader:
        issues.append("NO smart-loader.js")
        severity += 1

    if events:
        issues.append(f"{len(events)} on* handler(s)")
        severity += 1

    if inline:
        issues.append(f"{len(inline)} inline script block(s)")
        severity += 2

    if bare:
        issues.append("BARE JS outside <script>")
        severity += 2

    if severity == 0:
        status = "CLEAN"
    elif severity >= 4:
        status = "HEAVILY BROKEN"
    else:
        status = "PARTIALLY BROKEN"

    return {
        "has_loader": loader,
        "inline": inline,
        "events": events,
        "bare": bare,
        "issues": issues,
        "status": status
    }

# ─────────────────────────────────────────────
# CONNECTIVITY (SMARTER)
# ─────────────────────────────────────────────

def check_connectivity(html_file, content, cls):
    mod = module_name(html_file)
    exists = os.path.exists(mod)

    # detect explicit import OR loader-based usage
    loaded = (
        f"src=\"{mod}\"" in content or
        f"src='{mod}'" in content or
        "smart-loader.js" in content
    )

    broken = []

    if not cls["has_loader"]:
        broken.append("missing loader")

    if not exists:
        broken.append("module missing")

    if exists and not loaded:
        broken.append("module not explicitly referenced (may be loader-based)")

    return {
        "module": mod,
        "exists": exists,
        "loaded": loaded,
        "ok": exists and cls["has_loader"],
        "broken": broken
    }

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    out = []
    pr = lambda *a: (out.append(" ".join(map(str, a))), print(*a))[0]
    line = lambda: pr("═" * 80)

    html_files = find_html_files()
    js_modules = find_js_modules()

    data = {}

    for f in html_files:
        c = read(f)
        cls = classify(c)
        conn = check_connectivity(f, c, cls)
        data[f] = {"cls": cls, "conn": conn}

    line()
    pr("BSTM SYSTEM ARCHITECTURE AUDIT — IMPROVED")
    pr(f"Root: {ROOT}")
    pr(f"HTML: {len(html_files)} | JS: {len(js_modules)}")
    line()

    counts = defaultdict(int)
    ok = 0

    for f, d in sorted(data.items()):
        cls = d["cls"]
        conn = d["conn"]

        counts[cls["status"]] += 1
        if conn["ok"]:
            ok += 1

        pr(f"{f:40} {cls['status']:18} | {','.join(cls['issues']) or 'None'}")

    line()
    pr("SUMMARY")
    pr(counts)
    pr(f"Fully connected: {ok}/{len(html_files)}")

    ready = counts["HEAVILY BROKEN"] == 0
    pr("READY:", ready)

    with open(REPORT_PATH, "w") as f:
        f.write("\n".join(map(str, out)))

    line()
    pr("Saved:", REPORT_PATH)
    line()

if __name__ == "__main__":
    main()
