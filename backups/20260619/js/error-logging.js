// Global error handler
window.addEventListener('error', (event) => {
    logError({
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error?.stack
    });
});

// Log errors to Supabase
async function logError(error) {
    try {
        await SupabaseAPI.logError({
            ...error,
            user_id: BSTMAuth.getCurrentUser()?.id,
            url: window.location.href,
            user_agent: navigator.userAgent,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error('Failed to log error:', e);
    }
}
