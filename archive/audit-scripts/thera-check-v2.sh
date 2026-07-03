#!/usr/bin/env bash
echo "🧠 BSTM THERA CHECK v2 — Full Diagnosis ($(date))"
echo "=================================================="

echo "1. Pages with Raw JS (High Risk)"
echo "--------------------------------"
for f in *.html; do
    if grep -q "smart-loader.js" "$f"; then
        count=$(grep -cE '\<(script|function |onclick=|addToCart|proceedToPayment|withdrawTHB|depositTHB|showKYC|submitKYC|nextStep|initPage\)' "$f" 2>/dev/null || echo 0)
        if [ "$count" -gt 5 ]; then
            echo "❌ $f — $count risky patterns"
        fi
    fi
done

echo ""
echo "2. Smart-Loader Coverage"
grep -l "smart-loader.js" *.html | wc -l | xargs echo "Smart-loader present on:"
echo "Total HTML files:" $(ls *.html | wc -l)

echo ""
echo "3. Top Offenders (detailed)"
for f in thb-wallet.html kyc-verification.html settings.html product-detail.html terms.html ecosystem-hub.html gov-dashboard.html; do
    [ -f "$f" ] || continue
    echo "→ $f:"
    grep -oE 'function |onclick=|addToCart|withdrawTHB|depositTHB|showKYC' "$f" | head -8
    echo ""
done

echo "=================================================="
echo "Thera Check v2 Complete. Paste full output."
