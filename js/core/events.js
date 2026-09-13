// js/core/events.js
// Real event logging — the "Data Collection" stage of the intended
// Mall -> ELOS pipeline. Nothing reads these yet; this just makes sure
// real events actually start accumulating before any intelligence layer
// gets built on top. Logging failures are always swallowed — an
// analytics write must never break the user-facing action it's attached to.
import { supabase } from "./supabase-client.js";

/**
 * @param {string} eventType - e.g. "product_view", "add_to_cart", "order_placed", "room_view", "search"
 * @param {{userId?: string|null, roomId?: string|null, productId?: string|null, orderId?: string|null, metadata?: object}} [details]
 */
export async function logEvent(eventType, details = {}) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    await supabase.from("events").insert({
      event_type: eventType,
      user_id: details.userId ?? session?.user?.id ?? null,
      room_id: details.roomId ?? null,
      product_id: details.productId ?? null,
      order_id: details.orderId ?? null,
      metadata: details.metadata ?? {},
    });
  } catch (err) {
    console.warn("[BSTM Events] logEvent failed (non-fatal):", eventType, err);
  }
}
