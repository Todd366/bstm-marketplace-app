#!/usr/bin/env bash
echo "🧠 BSTM THERA CHECK — Full System Diagnosis ($(date))"
echo "=================================================="

echo "1. Structural Issues (Script Tags)"
grep -c "<script" *.html | sort
echo ""
echo "2. JS Leaking Pages (Critical)"
for f in *.html; do
    if grep -q "smart-loader.js" "$f"; then
        leaked=$(grep -cE 'function |addToCart|proceedToPayment|withdrawTHB|depositTHB|showKYC|submitKYC|nextStep' "$f" 2>/dev/null || echo 0)
        if [ "$leaked" -gt 10 ]; then
            echo "❌ $f — \~$leaked leaked patterns"
        fi
    fi
done

echo ""
echo "3. Pages Missing Page Module"
for f in *.html; do
    base=$(basename "$f" .html)
    if [ -f "js/pages/\( {base}.js" ] && ! grep -q "js/pages/ \){base}.js" "$f"; then
        echo "⚠️  $f — module exists but not loaded"
    fi
done

echo ""
echo "4. Quick Live Readiness"
echo "Smart-loader present on:" $(grep -l "smart-loader.js" *.html | wc -l) pages
echo "Pages with raw JS risk:" $(grep -lE 'function |onclick=' *.html | wc -l)

echo ""
echo "5. Top Problem Pages (from previous audits)"
echo "- KYC, Wallet, Settings, Terms, Product Detail, Room22, etc."

echo "=================================================="
echo "Thera Check Complete. Paste this output to me."
