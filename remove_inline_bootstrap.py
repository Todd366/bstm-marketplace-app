from pathlib import Path
import re

ROOT = Path(".")

pattern = re.compile(r"<script>(.*?)</script>", re.DOTALL)

for f in ROOT.rglob("*.html"):
    html = f.read_text(encoding="utf-8", errors="ignore")

    scripts = pattern.findall(html)

    # only remove inline scripts that are NOT loader-related
    if scripts:
        cleaned = pattern.sub("", html)
        f.write_text(cleaned, encoding="utf-8")
        print("CLEANED INLINE JS:", f)

print("DONE INLINE CLEANUP")
