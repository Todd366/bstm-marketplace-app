
# WARNING MODE (non-breaking alias)
WARNING = 'PARTIALLY BROKEN'


#!/usr/bin/env python3
"""
BSTM — SYSTEM ARCHITECTURE AUDIT v3.0 (MERGED / HARDENED)
Read-only static + structural analyzer for the BSTM Marketplace codebase.

Combines and fixes issues found in the two earlier audit scripts:
  - v1 mapped every HTML page to js/pages/<basename>.js using os.path.basename(),
    which silently collapses pages that share a filename in different folders
    (e.g. products/shop.html and admin/shop.html both resolved to
    js/pages/shop.js). This version resolves the FULL relative path first and
    only falls back to a flat js/pages/<basename>.js match, while explicitly
    flagging any basename collisions so nothing is silently merged.
  - v2 fixed the path bug but dropped the function/onclick extraction detail
    and the missing/present/unused module breakdown from v1. Both are
    restored here.
  - Both versions call `x in content` on JS filenames, which will
    false-positive on comments/strings. This version uses an actual
    <script src="..."> regex match instead.
  - Severity scoring is now a single weighted model (not two competing
    systems) and is tunable via --strict.

USAGE:
  cd ~/bstm-marketplace-app
  python3 bstm-architecture-audit-v3.py                 # console + .txt report
  python3 bstm-architecture-audit-v3.py --json           # also write .json
  python3 bstm-architecture-audit-v3.py --md             # also write .md summary
  python3 bstm-architecture-audit-v3.py --strict         # tighter readiness gate
  python3 bstm-architecture-audit-v3.py --no-color       # plain text output
  python3 bstm-architecture-audit-v3.py --root /path/to/project
"""

import re
import os
import sys
import glob
import json
import argparse
from datetime import datetime
from collections import defaultdict

# ─────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────

DEFAULT_SKIP_DIRS = {
    'node_modules', '.git', 'backup-legacy', 'legacy_archive',
    'supabase_fix_backup', '.mega-audit-work', '.deep-audit-work',
    '.audit-work', 'dist', 'build', '.vercel', '.next'
}

class Color:
    RED = '\033[91m'
    YEL = '\033[93m'
    GRN = '\033[92m'
    CYN = '\033[96m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    END = '\033[0m'

    @classmethod
    def off(cls):
        for k in ('RED', 'YEL', 'GRN', 'CYN', 'BOLD', 'DIM', 'END'):
            setattr(cls, k, '')


# ─────────────────────────────────────────────────────────────
# REGEX (compiled once)
# ─────────────────────────────────────────────────────────────

# Matches non-src <script> blocks, tolerant of type="module"/extra attrs
RE_INLINE_SCRIPT = re.compile(
    r'<script(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script>', re.S | re.I
)
RE_ANY_SCRIPT_TAG = re.compile(r'<script[^>]*>.*?</script>', re.S | re.I)
RE_STYLE_TAG = re.compile(r'<style[^>]*>.*?</style>', re.S | re.I)
RE_ON_EVENT = re.compile(
    r'on(?:click|submit|change|input|keyup|keydown|load|mouseover|focus|blur)\s*=\s*"([^"]+)"',
    re.I
)
RE_FUNCTION = re.compile(r'function\s+(\w+)\s*\(([^)]*)\)')
RE_SCRIPT_SRC = re.compile(r'<script[^>]+src\s*=\s*["\']([^"\']+)["\']', re.I)
RE_BARE_JS_LINE = re.compile(
    r'^(function\s+\w+|const\s+\w+|let\s+\w+|var\s+\w+|document\.|window\.|setTimeout\(|setInterval\()'
)
RE_ANSI = re.compile(r'\033\[[0-9;]*m')


def strip_ansi(s):
    return RE_ANSI.sub('', s)


# ─────────────────────────────────────────────────────────────
# FILE DISCOVERY
# ─────────────────────────────────────────────────────────────

def find_html_files(root, skip_dirs):
    files = []
    for root_dir, dirs, filenames in os.walk(root):
        dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith('.audit')]
        for f in filenames:
            if f.endswith('.html') and not f.endswith('.bak.html') and not f.endswith('.fix.bak'):
                rel = os.path.relpath(os.path.join(root_dir, f), root).replace(os.sep, '/')
                if '/components/' in '/' + rel or rel.startswith('components/'):
                    continue
                files.append(rel)
    return sorted(files)


def find_js_modules(root):
    pattern = os.path.join(root, 'js', 'pages', '**', '*.js')
    return sorted({
        os.path.relpath(p, root).replace(os.sep, '/')
        for p in glob.glob(pattern, recursive=True)
    })


def read_file(path):
    try:
        with open(path, encoding='utf-8', errors='replace') as fh:
            return fh.read()
    except OSError as e:
        return f"__READ_ERROR__:{e}"


# ─────────────────────────────────────────────────────────────
# EXTRACTION HELPERS
# ─────────────────────────────────────────────────────────────

def extract_inline_scripts(content):
    return [b for b in RE_INLINE_SCRIPT.findall(content) if b.strip()]


def extract_functions(inline_blocks):
    fns = []
    for blk in inline_blocks:
        fns += RE_FUNCTION.findall(blk)
    return fns


def extract_onclick_calls(content):
    return RE_ON_EVENT.findall(content)


def extract_script_srcs(content):
    return RE_SCRIPT_SRC.findall(content)


def normalize_src(path):
    """
    Light normalization only: drop query string / fragment, and collapse
    backslashes/repeated slashes. Does NOT strip leading '.', '..', or '/'
    — that requires knowing what the path is relative to, which is why
    resolve_src() below exists. Used for external-URL detection and as
    a building block, not for equality comparisons across relative paths.
    """
    p = path.split('?', 1)[0].split('#', 1)[0]
    p = p.replace('\\', '/')
    p = re.sub(r'/+', '/', p)
    return p


def is_external_url(src):
    return bool(re.match(r'^[a-zA-Z][a-zA-Z0-9+.-]*://', src)) or src.startswith('//')


def resolve_src(html_file, src):
    """
    Resolve a <script src="..."> value the way a browser actually would:
    - absolute/protocol-relative URLs are left alone (caller should skip these)
    - a leading '/' is root-relative (relative to the project root)
    - otherwise it's relative to the HTML file's OWN directory, so
      '../js/pages/a.js' from 'admin/page.html' resolves to 'js/pages/a.js'
      while the same string from 'admin/sub/page.html' correctly resolves
      to 'admin/js/pages/a.js' instead of being blindly collapsed to the
      same target regardless of traversal depth.
    Returns a project-root-relative, forward-slash path.
    """
    clean = normalize_src(src)
    if clean.startswith('/'):
        resolved = clean.lstrip('/')
    else:
        base_dir = os.path.dirname(html_file)
        resolved = os.path.normpath(os.path.join(base_dir, clean))
    return resolved.replace(os.sep, '/').replace('\\', '/')


def detect_loader(content):
    """
    Detect the shared loader via an actual <script src="...smart-loader.js">
    tag, not a raw substring match (which would false-positive on the
    filename appearing in an HTML comment, a code sample, or a string).
    """
    for src in extract_script_srcs(content):
        clean = src.split('?', 1)[0].split('#', 1)[0]
        if os.path.basename(clean).lower() == 'smart-loader.js':
            return True
    return False


def has_bare_js(content):
    """Detect JS-looking statements sitting outside any <script> tag."""
    stripped = RE_ANY_SCRIPT_TAG.sub('', content)
    stripped = RE_STYLE_TAG.sub('', stripped)
    for line in stripped.splitlines():
        s = line.strip()
        if s and RE_BARE_JS_LINE.match(s):
            return True
    return False


# ─────────────────────────────────────────────────────────────
# MODULE RESOLUTION (fixes v1's basename-collision bug)
# ─────────────────────────────────────────────────────────────

def resolve_module(html_file, root):
    """
    Try the path-preserving mapping first (page.html -> js/pages/page.js,
    subdir/page.html -> js/pages/subdir/page.js). If that file doesn't
    exist, fall back to the flat js/pages/<basename>.js convention used
    elsewhere in the codebase. Returns (module_path, resolution_mode).
    """
    stem = html_file[:-5] if html_file.endswith('.html') else html_file
    nested = f"js/pages/{stem}.js"
    if os.path.exists(os.path.join(root, nested)):
        return nested, 'nested'

    basename = os.path.basename(stem)
    flat = f"js/pages/{basename}.js"
    if os.path.exists(os.path.join(root, flat)):
        return flat, 'flat'

    # Doesn't exist under either convention — report the nested (canonical) path
    return nested, 'missing'


def detect_basename_collisions(html_files):
    """Flag HTML pages that would collide under the flat basename convention."""
    by_basename = defaultdict(list)
    for f in html_files:
        base = os.path.basename(f)
        by_basename[base].append(f)
    return {b: paths for b, paths in by_basename.items() if len(paths) > 1}


# ─────────────────────────────────────────────────────────────
# CLASSIFICATION (single weighted severity model)
# ─────────────────────────────────────────────────────────────

def classify(content, strict):
    has_loader = detect_loader(content)
    inline_blocks = extract_inline_scripts(content)
    onclick_list = extract_onclick_calls(content)
    bare = has_bare_js(content)
    all_fns = extract_functions(inline_blocks)

    issues = []
    score = 0

    
    if onclick_list:
        issues.append(f"{len(onclick_list)} on* handler(s)")
        score += 1
    if inline_blocks:
        issues.append(f"{len(inline_blocks)} inline <script> block(s)")
        score += 2 if len(inline_blocks) <= 2 else 3
    if all_fns:
        names = ', '.join(f[0] for f in all_fns[:4])
        suffix = f" (+{len(all_fns) - 4} more)" if len(all_fns) > 4 else ""
        issues.append(f"{len(all_fns)} function(s): {names}{suffix}")
        score += 1 if len(all_fns) <= 4 else 3
    if bare:
        issues.append("BARE JS outside <script>")
        score += 3

    heavy_threshold = 3 if strict else 4
    if score == 0:
        status = 'CLEAN'
    elif score >= heavy_threshold:
        status = 'HEAVILY BROKEN'
    else:
        status = 'PARTIALLY BROKEN'

    return {
        'has_loader': has_loader,
        'inline_blocks': inline_blocks,
        'onclick_list': onclick_list,
        'all_fns': all_fns,
        'bare': bare,
        'issues': issues,
        'status': status,
        'score': score,
    }


def check_connectivity(html_file, content, cls, root):
    module, mode = resolve_module(html_file, root)
    # Recomputed directly (not derived from `mode`) so this stays correct
    # even if resolve_module()'s internal logic changes later.
    exists = os.path.exists(os.path.join(root, module))
    local_srcs = [s for s in extract_script_srcs(content) if not is_external_url(s)]
    resolved_srcs = [resolve_src(html_file, s) for s in local_srcs]
    module_key = module.replace('\\', '/')
    explicitly_loaded = module_key in resolved_srcs

    broken = []
    
    if not exists:
        broken.append(f"{module} does not exist (checked nested + flat)")
    elif not explicitly_loaded:
        broken.append(f"{module} exists but is not <script src> loaded and no loader present")

    ok = exists
    return {
        'module': module,
        'resolution_mode': mode,
        'exists': exists,
        'explicitly_loaded': explicitly_loaded,
        'ok': ok,
        'broken': broken,
    }


# ─────────────────────────────────────────────────────────────
# REPORT BUILDING
# ─────────────────────────────────────────────────────────────

def build_report(root, skip_dirs, strict):
    html_files = find_html_files(root, skip_dirs)
    js_modules = find_js_modules(root)
    collisions = detect_basename_collisions(html_files)

    data = {}
    all_referenced_srcs = set()       # normalized full paths, e.g. "js/pages/x.js"
    all_referenced_basenames = set()  # basenames only, e.g. "x.js" — fallback match

    for f in html_files:
        content = read_file(os.path.join(root, f))
        if content.startswith("__READ_ERROR__:"):
            data[f] = {'error': content.replace("__READ_ERROR__:", "")}
            continue
        cls = classify(content, strict)
        conn = check_connectivity(f, content, cls, root)
        data[f] = {'cls': cls, 'conn': conn}

        for raw_src in extract_script_srcs(content):
            if is_external_url(raw_src):
                continue
            resolved = resolve_src(f, raw_src)
            all_referenced_srcs.add(resolved)
            all_referenced_basenames.add(os.path.basename(resolved))

    # A module is "unused" only if neither its resolved path (exact,
    # directory-aware match) nor its basename (a looser fallback signal)
    # shows up in any actual <script src="..."> tag anywhere — a real
    # reference check, not a raw substring scan that would false-positive
    # on comments/strings and false-negative on path variants.
    unused = [
        m for m in js_modules
        if m.replace('\\', '/') not in all_referenced_srcs
        and os.path.basename(m) not in all_referenced_basenames
    ]

    missing, present = [], []
    for f in html_files:
        if 'error' in data[f]:
            continue
        conn = data[f]['conn']
        (missing if not conn['exists'] else present).append((f, conn['module']))

    # Classify each collision group as REAL (both files fall back to the
    # same flat module path -> genuine ambiguity) or COSMETIC (same
    # filename, different folders, but nested resolution keeps them
    # distinct -> no functional collision).
    classified_collisions = {}
    for base, paths in collisions.items():
        modes = [
            data[p]['conn']['resolution_mode']
            for p in paths if 'error' not in data.get(p, {})
        ]
        # Real risk = 2+ pages in the group would resolve (or already
        # resolve) to the identical flat js/pages/<basename>.js path,
        # because they aren't distinguished by a nested subfolder module.
        real = len(paths) - modes.count('nested') >= 2
        classified_collisions[base] = {
            'paths': paths,
            'severity': 'REAL' if real else 'COSMETIC',
        }

    return {
        'root': root,
        'html_files': html_files,
        'js_modules': js_modules,
        'collisions': collisions,
        'collision_details': classified_collisions,
        'data': data,
        'missing': missing,
        'present': present,
        'unused': unused,
    }


# ─────────────────────────────────────────────────────────────
# CONSOLE / TEXT RENDERING
# ─────────────────────────────────────────────────────────────

def render_text(report, strict):
    out = []
    pr = lambda *a: out.append(' '.join(str(x) for x in a))
    ruler = lambda c='═', n=88: pr(c * n)

    data = report['data']
    html_files = report['html_files']
    js_modules = report['js_modules']

    counts = defaultdict(int)
    for f in html_files:
        d = data[f]
        if 'error' in d:
            counts['ERROR'] += 1
        else:
            counts[d['cls']['status']] += 1

    def color_status(status):
        c = {'CLEAN': Color.GRN, 'PARTIALLY BROKEN': Color.YEL,
             'HEAVILY BROKEN': Color.RED}.get(status, '')
        return f"{c}{status}{Color.END}" if c else status

    ruler()
    pr("  BSTM SYSTEM ARCHITECTURE AUDIT v3.0 — MERGED / HARDENED")
    pr(f"  Generated : {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    pr(f"  Root      : {report['root']}")
    pr(f"  HTML pages: {len(html_files)}    JS modules: {len(js_modules)}    Mode: {'STRICT' if strict else 'STANDARD'}")
    ruler()

    # PHASE 0 — basename collisions
    ruler('─')
    pr("  PHASE 0 — BASENAME COLLISION CHECK")
    ruler('─')
    details = report['collision_details']
    real_collisions = {b: v for b, v in details.items() if v['severity'] == 'REAL'}
    cosmetic_collisions = {b: v for b, v in details.items() if v['severity'] == 'COSMETIC'}

    if real_collisions:
        pr(f"\n  ❌ {len(real_collisions)} REAL collision(s) — these would resolve to the")
        pr("  identical js/pages/<basename>.js target and silently overwrite each other:")
        for base, v in real_collisions.items():
            pr(f"    - {base}: {', '.join(v['paths'])}")
    if cosmetic_collisions:
        pr(f"\n  ℹ️  {len(cosmetic_collisions)} cosmetic collision(s) — same filename, different")
        pr("  folders, but nested-path resolution keeps their modules distinct:")
        for base, v in cosmetic_collisions.items():
            pr(f"    - {base}: {', '.join(v['paths'])}")
    if not real_collisions and not cosmetic_collisions:
        pr("\n  ✅ No basename collisions detected.")

    # PHASE 1 — full file analysis
    ruler('─')
    pr("  PHASE 1 — FULL FILE SYSTEM ANALYSIS")
    ruler('─')
    pr(f"\n  {'FILE':<38} {'STATUS':<18} {'SCORE':<6} ISSUES")
    pr("  " + "-" * 100)
    for f in sorted(html_files):
        d = data[f]
        if 'error' in d:
            pr(f"  ⛔ {f:<36} {'READ ERROR':<18} {'-':<6} {d['error']}")
            continue
        cls = d['cls']
        sym = {'CLEAN': '✅', 'PARTIALLY BROKEN': '⚠️ ', 'HEAVILY BROKEN': '❌'}[cls['status']]
        iss = ' | '.join(cls['issues']) if cls['issues'] else 'None'
        status_padded = f"{cls['status']:<18}".replace(cls['status'], color_status(cls['status']), 1)
        pr(f"  {sym} {f:<36} {status_padded} {cls['score']:<6} {iss[:55]}")

    pr(f"\n  TOTALS: {counts['CLEAN']} CLEAN  |  {counts['PARTIALLY BROKEN']} PARTIALLY BROKEN  |  "
       f"{counts['HEAVILY BROKEN']} HEAVILY BROKEN  |  {counts['ERROR']} READ ERRORS")

    # PHASE 2 — inline JS extraction map
    ruler('─')
    pr("  PHASE 2 — INLINE JS EXTRACTION MAP")
    ruler('─')
    for f in sorted(html_files):
        d = data[f]
        if 'error' in d or d['cls']['status'] == 'CLEAN':
            continue
        cls = d['cls']
        conn = d['conn']
        fns, clicks = cls['all_fns'], cls['onclick_list']
        if not fns and not clicks:
            continue
        pr(f"\n  FILE: {f}")
        pr(f"  → Target module ({conn['resolution_mode']}): {conn['module']}")
        if fns:
            pr("  Functions to extract:")
            for name, args in fns:
                pr(f"    - {name}({args}) → {conn['module']}")
        if clicks:
            pr(f"  onclick/event references ({len(clicks)}):")
            for c in clicks[:8]:
                pr(f"    - {c[:90]}")
            if len(clicks) > 8:
                pr(f"    ... and {len(clicks) - 8} more")

    # PHASE 3 — missing / present / unused modules
    ruler('─')
    pr("  PHASE 3 — MODULE MAPPING (path-aware, collision-safe)")
    ruler('─')
    pr(f"\n  MISSING MODULES ({len(report['missing'])}) — HTML page exists, JS module does not:")
    for f, m in report['missing']:
        pr(f"  ❌  {f:<38} → MISSING {m}")
    pr(f"\n  PRESENT MODULES ({len(report['present'])}):")
    for f, m in report['present']:
        pr(f"  ✅  {f:<38} → {m}")
    pr(f"\n  UNUSED MODULES ({len(report['unused'])}) — js/pages/*.js not referenced in any HTML:")
    for m in report['unused']:
        pr(f"  ⚠️   {m}")

    # PHASE 4 — connectivity simulation
    ruler('─')
    pr("  PHASE 4 — LIVE CONNECTIVITY SIMULATION")
    ruler('─')
    pr(f"\n  {'PAGE':<38} {'LOADED?':<10} BROKEN DEPENDENCIES")
    pr("  " + "-" * 100)
    ok_count = 0
    for f in sorted(html_files):
        d = data[f]
        if 'error' in d:
            continue
        conn = d['conn']
        sym = '✅ YES' if conn['ok'] else '❌ NO '
        deps = ' | '.join(conn['broken']) if conn['broken'] else 'None'
        pr(f"  {f:<38} {sym:<10} {deps}")
        if conn['ok']:
            ok_count += 1

    # FINAL SUMMARY
    total = len(html_files)
    ruler()
    pr("  FINAL SYSTEM REPORT")
    ruler()
    clean_pct = counts['CLEAN'] / total * 100 if total else 0
    partial_pct = counts['PARTIALLY BROKEN'] / total * 100 if total else 0
    heavy_pct = counts['HEAVILY BROKEN'] / total * 100 if total else 0
    conn_pct = ok_count / total * 100 if total else 0

    pr(f"\n  SYSTEM HEALTH SCORE")
    pr(f"  ─────────────────────────────────────────")
    pr(f"  Clean Pages:            {counts['CLEAN']}/{total}  ({clean_pct:.0f}%)")
    pr(f"  Partially Broken:       {counts['PARTIALLY BROKEN']}/{total}  ({partial_pct:.0f}%)")
    pr(f"  Heavily Broken:         {counts['HEAVILY BROKEN']}/{total}  ({heavy_pct:.0f}%)")
    pr(f"  Basename Collisions:    {len(real_collisions)} real, {len(cosmetic_collisions)} cosmetic")
    pr(f"  Missing Modules:        {len(report['missing'])}")
    pr(f"  Unused Modules:         {len(report['unused'])}")
    pr(f"  Fully Connected Pages:  {ok_count}/{total}  ({conn_pct:.0f}%)")

    readiness_limit = 0 if strict else 3
    ready = (counts['HEAVILY BROKEN'] == 0 and
             len(report['missing']) == 0 and
             len(real_collisions) == 0 and
             counts['PARTIALLY BROKEN'] <= readiness_limit)
    ready_label = f"{Color.GRN}✅ READY{Color.END}" if ready else f"{Color.RED}❌ NOT READY{Color.END}"
    pr(f"\n  PRODUCTION READINESS: {ready_label}  ({'strict' if strict else 'standard'} gate)")

    pr(f"\n  CRITICAL FIX LIST (PRIORITY ORDER)")
    pr(f"  ─────────────────────────────────────────")
    rank = 1
    if real_collisions:
        pr(f"  {rank}. [HIGH]  Rename {len(real_collisions)} REAL colliding filename(s) — these silently overwrite each other's module target")
        rank += 1
    if cosmetic_collisions:
        pr(f"  {rank}. [LOW]   {len(cosmetic_collisions)} cosmetic filename collision(s) exist but are not currently ambiguous")
        rank += 1
    if counts['HEAVILY BROKEN']:
        pr(f"  {rank}. [HIGH]  Remove/extract inline JS from {counts['HEAVILY BROKEN']} heavily broken page(s)")
        rank += 1
    if report['missing']:
        pr(f"  {rank}. [HIGH]  Create {len(report['missing'])} missing JS module(s) in js/pages/")
        rank += 1
    if counts['PARTIALLY BROKEN']:
        pr(f"  {rank}. [MED]   Clean inline JS from {counts['PARTIALLY BROKEN']} partially broken page(s)")
        rank += 1
    if report['unused']:
        pr(f"  {rank}. [LOW]   Audit/remove {len(report['unused'])} unused module file(s)")
        rank += 1
    if counts['ERROR']:
        pr(f"  {rank}. [LOW]   Investigate {counts['ERROR']} file(s) that failed to read")
        rank += 1
    if ready:
        pr("  → No critical fixes required. System is production-ready.")

    return '\n'.join(out), {
        'counts': dict(counts), 'ok_count': ok_count, 'total': total, 'ready': ready
    }


def render_json(report, summary):
    def slim(d):
        return {
            'status': d['cls']['status'] if 'cls' in d else 'ERROR',
            'score': d['cls']['score'] if 'cls' in d else None,
            'issues': d['cls']['issues'] if 'cls' in d else [d.get('error')],
            'module': d['conn']['module'] if 'conn' in d else None,
            'module_resolution': d['conn']['resolution_mode'] if 'conn' in d else None,
            'connected': d['conn']['ok'] if 'conn' in d else False,
            'broken': d['conn']['broken'] if 'conn' in d else [],
        }
    return json.dumps({
        'generated': datetime.now().isoformat(),
        'root': report['root'],
        'summary': summary,
        'basename_collisions': report['collision_details'],
        'missing_modules': report['missing'],
        'unused_modules': report['unused'],
        'pages': {f: slim(d) for f, d in report['data'].items()},
    }, indent=2)


def render_markdown(report, summary):
    lines = ["# BSTM Architecture Audit\n", f"_Generated {datetime.now().strftime('%Y-%m-%d %H:%M')}_\n"]
    c = summary['counts']
    lines.append(f"- **Clean:** {c.get('CLEAN', 0)}")
    lines.append(f"- **Partially broken:** {c.get('PARTIALLY BROKEN', 0)}")
    lines.append(f"- **Heavily broken:** {c.get('HEAVILY BROKEN', 0)}")
    lines.append(f"- **Missing modules:** {len(report['missing'])}")
    lines.append(f"- **Unused modules:** {len(report['unused'])}")
    real_n = sum(1 for v in report['collision_details'].values() if v['severity'] == 'REAL')
    cosmetic_n = len(report['collision_details']) - real_n
    lines.append(f"- **Basename collisions:** {real_n} real, {cosmetic_n} cosmetic")
    lines.append(f"- **Fully connected:** {summary['ok_count']}/{summary['total']}")
    lines.append(f"\n**Production readiness: {'✅ READY' if summary['ready'] else '❌ NOT READY'}**\n")
    if report['missing']:
        lines.append("## Missing modules\n")
        for f, m in report['missing']:
            lines.append(f"- `{f}` → missing `{m}`")
    if report['collision_details']:
        lines.append("\n## Basename collisions\n")
        for base, v in report['collision_details'].items():
            lines.append(f"- `{base}` [{v['severity']}]: {', '.join(v['paths'])}")
    return '\n'.join(lines)


# ─────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="BSTM system architecture audit v3.0")
    parser.add_argument('--root', default=os.getcwd(), help="Project root (default: cwd)")
    parser.add_argument('--strict', action='store_true', help="Tighter thresholds for HEAVILY BROKEN / readiness gate")
    parser.add_argument('--json', action='store_true', help="Also write a .json report")
    parser.add_argument('--md', action='store_true', help="Also write a .md summary")
    parser.add_argument('--no-color', action='store_true', help="Disable ANSI colors")
    parser.add_argument('--skip', nargs='*', default=[], help="Additional directory names to skip")
    args = parser.parse_args()

    if args.no_color or not sys.stdout.isatty():
        Color.off()

    skip_dirs = DEFAULT_SKIP_DIRS | set(args.skip)
    root = os.path.abspath(args.root)
    stamp = datetime.now().strftime("%Y%m%d-%H%M")

    report = build_report(root, skip_dirs, args.strict)
    text, summary = render_text(report, args.strict)
    print(text)

    txt_path = os.path.join(root, f"system-audit-{stamp}.txt")
    with open(txt_path, 'w', encoding='utf-8') as fh:
        fh.write(strip_ansi(text))
    print(f"\n  Report saved: {txt_path}")

    if args.json:
        json_path = os.path.join(root, f"system-audit-{stamp}.json")
        with open(json_path, 'w', encoding='utf-8') as fh:
            fh.write(render_json(report, summary))
        print(f"  JSON saved:   {json_path}")

    if args.md:
        md_path = os.path.join(root, f"system-audit-{stamp}.md")
        with open(md_path, 'w', encoding='utf-8') as fh:
            fh.write(render_markdown(report, summary))
        print(f"  Markdown saved: {md_path}")


if __name__ == "__main__":
    main()
