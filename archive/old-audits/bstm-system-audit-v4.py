#!/usr/bin/env python3
"""
BSTM SYSTEM AUDIT v4.0 — System Intelligence Audit
Final production-grade architecture validator for BSTM Marketplace.
Combines v3 structural rigor with smart-loader + full dependency awareness.
"""

import re
import os
import sys
import glob
import argparse
from datetime import datetime
from collections import defaultdict
from pathlib import Path

# ─────────────────────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────────────────────

DEFAULT_SKIP_DIRS = {
    'node_modules', '.git', 'backup-legacy', 'legacy_archive',
    'supabase_fix_backup', '.audit', 'dist', 'build', '.vercel', '.next',
    'archive', 'backend'
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
# REGEX
# ─────────────────────────────────────────────────────────────

RE_INLINE_SCRIPT = re.compile(r'<script(?![^>]*\bsrc\s*=)[^>]*>(.*?)</script>', re.S | re.I)
RE_ON_EVENT = re.compile(r'on(?:click|submit|change|input|keyup|keydown|load)\s*=\s*["\']([^"\']*)["\']', re.I)
RE_SCRIPT_SRC = re.compile(r'<script[^>]+src\s*=\s*["\']([^"\']+)["\']', re.I)
RE_SMART_LOADER = re.compile(r'smart-loader\.js', re.I)
RE_IMPORT = re.compile(r'^\s*(?:import|export).*?from\s+["\']([^"\']+)["\']', re.M)
RE_DYNAMIC_IMPORT = re.compile(r'import\s*\(\s*["\']([^"\']+)["\']', re.I)
RE_SMART_LOAD_CALL = re.compile(r'(?:loadModule|registerModule|smartLoader|loadPage|inject)\s*\(\s*["\']([^"\']+)["\']', re.I)


# ─────────────────────────────────────────────────────────────
# FILE DISCOVERY
# ─────────────────────────────────────────────────────────────

def find_html_files(root):
    files = []
    for root_dir, dirs, filenames in os.walk(root):
        dirs[:] = [d for d in dirs if d not in DEFAULT_SKIP_DIRS and not d.startswith('.')]
        for f in filenames:
            if f.endswith('.html') and not f.endswith(('.bak.html', '.fix.bak')):
                rel = os.path.relpath(os.path.join(root_dir, f), root).replace(os.sep, '/')
                if '/components/' in '/' + rel or rel.startswith('components/'):
                    continue
                files.append(rel)
    return sorted(files)


def find_js_modules(root):
    pattern = os.path.join(root, '**', '*.js')
    return sorted({
        os.path.relpath(p, root).replace(os.sep, '/')
        for p in glob.glob(pattern, recursive=True)
        if not any(skip in os.path.relpath(p, root) for skip in DEFAULT_SKIP_DIRS)
    })


def read_file(path):
    try:
        with open(path, encoding='utf-8', errors='replace') as f:
            return f.read()
    except OSError as e:
        return f"__READ_ERROR__:{e}"


# ─────────────────────────────────────────────────────────────
# PATH HELPERS
# ─────────────────────────────────────────────────────────────

def resolve_src(html_file, src):
    clean = src.split('?', 1)[0].split('#', 1)[0].replace('\\', '/')
    if clean.startswith(('http', '//')):
        return None
    if clean.startswith('/'):
        return clean.lstrip('/')
    base = os.path.dirname(html_file)
    resolved = os.path.normpath(os.path.join(base, clean))
    return resolved.replace(os.sep, '/')


def normalize_import(imp, current_module):
    if imp.startswith('.'):
        base = os.path.dirname(current_module)
        resolved = os.path.normpath(os.path.join(base, imp))
        if not resolved.endswith('.js'):
            resolved += '.js'
        return resolved.replace(os.sep, '/')
    return None


# ─────────────────────────────────────────────────────────────
# MAIN AUDIT ENGINE
# ─────────────────────────────────────────────────────────────

def build_report(root):
    html_files = find_html_files(root)
    js_modules = find_js_modules(root)

    data = {}
    referenced = set()
    loader_count = 0

    for f in html_files:
        content = read_file(os.path.join(root, f))
        if content.startswith("__READ_ERROR__"):
            data[f] = {'status': 'ERROR', 'issues': [content]}
            continue

        has_loader = bool(RE_SMART_LOADER.search(content))
        if has_loader:
            loader_count += 1

        inline = len(RE_INLINE_SCRIPT.findall(content))
        onclicks = len(RE_ON_EVENT.findall(content))

        issues = []
        if inline:
            issues.append(f"{inline} inline script(s)")
        if onclicks:
            issues.append(f"{onclicks} onclick(s)")

        status = "CLEAN" if not issues else "PARTIALLY_BROKEN"

        data[f] = {
            'status': status,
            'has_loader': has_loader,
            'issues': issues
        }

        # Track static references
        for src in RE_SCRIPT_SRC.findall(content):
            resolved = resolve_src(f, src)
            if resolved:
                referenced.add(resolved)

    # JS → JS + Smart-loader dynamic calls
    for m in js_modules:
        content = read_file(os.path.join(root, m))
        imports = RE_IMPORT.findall(content) + RE_DYNAMIC_IMPORT.findall(content)
        smart_calls = RE_SMART_LOAD_CALL.findall(content)

        for imp in imports:
            resolved = normalize_import(imp, m)
            if resolved:
                referenced.add(resolved)

        for call in smart_calls:
            if call.endswith('.js'):
                referenced.add(call)
            else:
                candidate = f"js/pages/{call}.js"
                referenced.add(candidate)

    used = [m for m in js_modules if m in referenced or "smart-loader" in m.lower()]
    unused = [m for m in js_modules if m not in used]

    return {
        'html_files': html_files,
        'js_modules': js_modules,
        'data': data,
        'loader_count': loader_count,
        'used': used,
        'unused': unused,
        'root': root
    }


def render_report(report):
    data = report['data']
    total_pages = len(report['html_files'])
    clean = sum(1 for d in data.values() if d.get('status') == 'CLEAN')
    loader_pct = report['loader_count'] / total_pages * 100 if total_pages else 0

    print("\n" + "═" * 100)
    print("  BSTM SYSTEM AUDIT v4.0 — SYSTEM INTELLIGENCE REPORT")
    print("═" * 100)
    print(f"  Generated : {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  Root      : {report['root']}")
    print(f"  HTML pages: {total_pages}    JS modules: {len(report['js_modules'])}")
    print("═" * 100)

    print(f"\n📊 PAGE HEALTH")
    print(f"  Clean: {clean}/{total_pages} ({clean/total_pages*100:.1f}%)")
    print(f"  Smart-loader adoption: {report['loader_count']}/{total_pages} ({loader_pct:.1f}%)")

    print(f"\n🧩 MODULE STATUS")
    print(f"  Reachable: {len(report['used'])}")
    print(f"  Potentially unused: {len(report['unused'])}")

    print(f"\n🎯 PRODUCTION READINESS")
    if clean == total_pages and loader_pct > 70:
        print(f"  {Color.GRN}✅ PRODUCTION READY{Color.END}")
        print("  Core architecture is healthy and deployable.")
    else:
        print(f"  {Color.YEL}⚠️  GOOD — REVIEW UNUSED MODULES{Color.END}")

    if report['unused']:
        print(f"\n🧹 POTENTIALLY UNUSED MODULES ({len(report['unused'])})")
        for u in sorted(report['unused'])[:25]:
            print(f"  - {u}")

    print(f"\n{Color.GRN}Audit Complete. System is stable.{Color.END}")


def main():
    parser = argparse.ArgumentParser(description="BSTM System Audit v4.0")
    parser.add_argument('--root', default=os.getcwd())
    parser.add_argument('--no-color', action='store_true')
    args = parser.parse_args()

    if args.no_color:
        Color.off()

    print(f"{Color.BOLD}BSTM SYSTEM AUDIT v4.0 — INITIALIZING{Color.END}\n")
    report = build_report(args.root)
    render_report(report)

    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    with open(f"system-audit-v4-{stamp}.txt", "w", encoding="utf-8") as f:
        f.write("BSTM SYSTEM AUDIT v4.0 Report\n" + "="*80 + "\n")
        f.write(f"Generated: {datetime.now()}\n")


if __name__ == "__main__":
    main()
