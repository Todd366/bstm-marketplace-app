#!/data/data/com.termux/files/usr/bin/bash

echo "======================================="
echo "        BSTM FULL QA AUDIT"
echo "======================================="

echo
echo "1. HTML Pages"
find . -name "*.html" | sort

echo
echo "2. JavaScript Syntax"
find . -name "*.js" -exec node --check {} \; || true

echo
echo "3. Duplicate Navigation Loaders"
grep -R "components/nav.html" . --include="*.html"

echo
echo "4. Smart Loader Usage"
grep -R "smart-loader.js" . --include="*.html"

echo
echo "5. Footer Usage"
grep -R "universal-footer" . --include="*.html"

echo
echo "6. Firebase References"
grep -R "firebase" . --include="*.js" --include="*.html"

echo
echo "7. Supabase References"
grep -R "supabase" . --include="*.js" --include="*.html"

echo
echo "8. TODO/FIXME"
grep -RInE "TODO|FIXME" .

echo
echo "9. Missing Images"
grep -Rho 'src="[^"]*"' . \
| cut -d'"' -f2 \
| while read f; do
    [[ "$f" =~ ^https?:// ]] && continue
    [[ "$f" =~ ^data: ]] && continue
    [ -f "$f" ] || echo "Missing: $f"
done

echo
echo "10. Missing CSS"
grep -Rho 'href="[^"]*\.css"' . \
| cut -d'"' -f2 \
| while read f; do
    [[ "$f" =~ ^https?:// ]] && continue
    [ -f "$f" ] || echo "Missing CSS: $f"
done

echo
echo "11. Missing JS"
grep -Rho 'src="[^"]*\.js"' . \
| cut -d'"' -f2 \
| while read f; do
    [[ "$f" =~ ^https?:// ]] && continue
    [ -f "$f" ] || echo "Missing JS: $f"
done

echo
echo "12. Backup Files"
find . \( \
-name "*.bak" -o \
-name "*.bak2" -o \
-name "*.backup" -o \
-name "*.broken" \
\)

echo
echo "13. Duplicate HTML IDs"
grep -Rho 'id="[^"]*"' . --include="*.html" \
| sort | uniq -d

echo
echo "14. Pages Missing Navigation Placeholder"
for f in $(find . -name "*.html"); do
    grep -q 'id="bstm-nav"' "$f" || echo "$f"
done

echo
echo "15. Pages Missing Footer Placeholder"
for f in $(find . -name "*.html"); do
    grep -q 'id="bstm-footer"' "$f" || echo "$f"
done

echo
echo "16. Pages Without DOCTYPE"
for f in $(find . -name "*.html"); do
    head -n1 "$f" | grep -q DOCTYPE || echo "$f"
done

echo
echo "17. Summary"
echo "✔ HTML scanned"
echo "✔ JS syntax checked"
echo "✔ Navigation checked"
echo "✔ Footer checked"
echo "✔ Firebase checked"
echo "✔ Supabase checked"
echo "✔ Missing assets checked"
echo "✔ Duplicate IDs checked"
echo "✔ Backup files listed"
echo
echo "========= AUDIT COMPLETE ========="
