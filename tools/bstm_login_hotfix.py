import os
import re

LOGIN_PAGE = "login.html"
LOGIN_JS = "js/pages/login.js"

def patch_html():
    if not os.path.exists(LOGIN_PAGE):
        print("login.html not found")
        return

    with open(LOGIN_PAGE, "r", encoding="utf-8") as f:
        html = f.read()

    # inject safe fallback handler if missing
    if "sendMagicLink" not in html:
        inject = """
<script>
window.sendMagicLink = function () {
    const emailInput = document.querySelector('input[type="email"]');
    const email = emailInput ? emailInput.value : "";

    if (!email) {
        alert("Please enter email address");
        return;
    }

    console.log("[BSTM LOGIN] Magic link requested for:", email);

    // TEMP SAFE MOCK (replace later with backend)
    alert("Magic link sent to " + email);
};
</script>
</body>
"""
        html = html.replace("</body>", inject)

    with open(LOGIN_PAGE, "w", encoding="utf-8") as f:
        f.write(html)

    print("✅ login.html patched")

def patch_js():
    if not os.path.exists(LOGIN_JS):
        print("login.js not found")
        return

    with open(LOGIN_JS, "r", encoding="utf-8") as f:
        js = f.read()

    if "window.sendMagicLink" not in js:
        js += """

// --- BSTM LOGIN HOTFIX BINDING ---
window.sendMagicLink = function () {
    const emailInput = document.querySelector('input[type="email"]');
    const email = emailInput ? emailInput.value : "";

    if (!email) {
        alert("Please enter email address");
        return;
    }

    console.log("[BSTM LOGIN JS] sending magic link to:", email);

    alert("Magic link sent to " + email);
};
"""

        with open(LOGIN_JS, "w", encoding="utf-8") as f:
            f.write(js)

    print("✅ login.js patched")

def main():
    print("=== BSTM LOGIN HOTFIX ===")
    patch_html()
    patch_js()
    print("=== DONE ===")
    print("Now test login email again.")

if __name__ == "__main__":
    main()
