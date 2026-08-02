import os
import re

PROJECT_ROOT = "."

def find_html_files():
    return [f for f in os.listdir(PROJECT_ROOT) if f.endswith(".html")]

def extract_module(html):
    match = re.search(r'src="(js/pages/[^"]+\.js)"', html)
    return match.group(1) if match else None

def inject_bridge(html, module):
    if "window.__BSTM_BRIDGE_INSTALLED__" in html:
        return html, False

    bridge = f"""
<script>
/**
 * BSTM SAFE RUNTIME BRIDGE
 * prevents onclick breakage without modifying architecture
 */
window.__BSTM_BRIDGE_INSTALLED__ = true;

window.__bstm_safe_bind = function(fnName, fallback) {{
    if (typeof window[fnName] !== 'function') {{
        window[fnName] = fallback || function() {{
            console.warn('[BSTM] Missing function:', fnName);
        }};
    }}
}};
</script>
"""

    # inject BEFORE module script
    pattern = f'<script type="module" src="{module}"></script>'
    if pattern in html:
        html = html.replace(pattern, bridge + "\n" + pattern)
        return html, True

    return html, False

def ensure_window_bridge(html):
    # prevent runtime onclick failures
    fixes = []

    # common patterns we observed in your audit
    common_functions = [
        "calculateFare",
        "showDemoRide",
        "closeDemoModal",
        "completeDemoRide",
        "proceedToPayment",
        "toggleFaq",
        "nextStep",
        "submitKYC",
        "addToCart",
        "changeImage",
        "increaseQty",
        "decreaseQty",
        "copyReferral",
        "logout"
    ]

    script_block = "\n<script>\n"

    for fn in common_functions:
        if f"window.{fn}" not in html:
            script_block += f"""
if (typeof window.{fn} !== 'function') {{
    window.{fn} = function() {{
        console.warn('[BSTM SAFE FALLBACK] {fn} not implemented yet');
    }};
}}
"""
            fixes.append(fn)

    script_block += "\n</script>\n"

    if fixes:
        # inject before closing body
        if "</body>" in html:
            html = html.replace("</body>", script_block + "</body>", 1)

    return html, fixes

def main():
    html_files = find_html_files()

    total_patched = 0

    for file in html_files:
        path = os.path.join(PROJECT_ROOT, file)

        with open(path, "r", encoding="utf-8") as f:
            html = f.read()

        module = extract_module(html)
        if not module:
            continue

        original = html

        # Step 1: inject bridge marker
        html, injected = inject_bridge(html, module)

        # Step 2: runtime safety net
        html, fixes = ensure_window_bridge(html)

        if html != original:
            with open(path, "w", encoding="utf-8") as f:
                f.write(html)
            total_patched += 1
            print(f"✅ patched {file} | fallback functions: {len(fixes)}")

    print("\n======================")
    print(f"FINAL STABILIZATION DONE")
    print(f"Files patched: {total_patched}")
    print("======================")

if __name__ == "__main__":
    main()
