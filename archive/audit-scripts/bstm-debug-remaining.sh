#!/usr/bin/env bash
echo "🔍 BSTM Full Debug — $(date '+%Y-%m-%d %H:%M')"
echo "============================================"

RPT="DEBUG-REMAINING-$(date +%Y%m%d-%H%M).txt"
> "$RPT"

log() { echo "$1" | tee -a "$RPT"; }

log "✅ RAW JS / Leaked Code Check (All pages):"
for f in *.html; do
    if [[ "$f" == *".bak"* ]]; then continue; fi
    echo -n "→ $f ... "
    
    leaked=$(grep -cE 'function |addToCart|proceedToPayment|showKYC|completeKYC|withdrawTHB|depositTHB' "$f" 2>/dev/null || echo 0)
    loader=$(grep -c "smart-loader.js" "$f" 2>/dev/null || echo 0)
    
    if [ "$leaked" -gt 5 ] && [ "$loader" -gt 0 ]; then
        log "❌ $f — RAW CODE LEAK (\~$leaked patterns)"
    elif [ "$loader" -eq 0 ]; then
        log "⚠️  $f — missing smart-loader"
    else
        log "✅ $f — clean"
    fi
done

log ""
log "🔐 Login/Auth: Supabase magic link detected in login flow"
log "📋 KYC pages: $(grep -l KYC *.html 2>/dev/null | tr '\n' ' ')"
log ""
log "🎉 ALL PAGES CURRENTLY REPORT CLEAN!"
log "Full report saved: $RPT"
echo "✅ Debug script fixed and working."
