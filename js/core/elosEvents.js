// js/core/elosEvents.js
//
// Sends real transaction events into BSTM ELOS (the ecosystem's learning/
// intelligence engine), separate from the internal `events` table logEvent()
// writes to (see events.js — that table has no consumer yet; this is the
// direct push instead of waiting on one). Client-side bundle, so — same as
// FlowLedger's equivalent — no secret key here; ELOS's write endpoints
// accept unauthenticated requests by design for exactly this case.
//
// Fire-and-forget: a slow or unreachable ELOS must never block or fail a
// real checkout for the buyer.

const ELOS_EVENTS_URL = "https://bstm-elos.vercel.app/api/events";

export async function sendElosEvent(eventType, entityId, data) {
  try {
    await fetch(ELOS_EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        source: "marketplace",
        entity_type: "TRANSACTION",
        entity_id: entityId,
        data,
      }),
    });
  } catch (err) {
    console.warn("[BSTM ELOS] event delivery failed (non-fatal):", eventType, err);
  }
}
