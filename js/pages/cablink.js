// js/pages/cablink.js
//
// Read-only status view of a buyer's CabLink delivery tasks.
// Tasks themselves are created automatically by checkout.js when
// the buyer chooses CabLink delivery — there is no manual "create
// task" step here anymore. Keeping creation in one place (checkout)
// avoids the two flows drifting out of sync with each other.
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";

const STATUS_STYLES = {
  pending: "background:#FEF3C7;color:#92400E;",
  assigned: "background:#DBEAFE;color:#1E40AF;",
  picked_up: "background:#E0E7FF;color:#4338CA;",
  delivered: "background:#D1FAE5;color:#065F46;",
  cancelled: "background:#FEE2E2;color:#991B1B;",
};

async function loadTasks(userId) {
  const listEl = document.getElementById("task-list");
  if (!listEl) return;

  const { data: tasks, error } = await supabase
    .from("delivery_requests")
    .select("id, status, dropoff_address, dropoff_city, requested_at, pickup_room_id, cablink_ride_id, rooms(name)")
    .eq("buyer_id", userId)
    .order("requested_at", { ascending: false })
    .limit(20);

  if (error) {
    listEl.innerHTML = '<p class="text-red-500 text-sm">Couldn\'t load your tasks.</p>';
    return;
  }

  if (!tasks || tasks.length === 0) {
    listEl.innerHTML =
      '<p class="text-gray-400 text-sm">No delivery tasks yet — choose CabLink delivery at checkout and one will show up here.</p>';
    return;
  }

  listEl.innerHTML = tasks
    .map((t) => {
      const style = STATUS_STYLES[t.status] || STATUS_STYLES.pending;
      const roomName = escapeHtml(t.rooms?.name || "Unknown room");
      const dropoffCity = escapeHtml(t.dropoff_city || "?");
      const dropoffAddress = escapeHtml(t.dropoff_address || "");
      const date = t.requested_at
        ? new Date(t.requested_at).toLocaleDateString()
        : "";
      const sentLabel = t.cablink_ride_id
        ? '<p class="text-xs text-green-600 mt-1">Sent to a CabLink driver</p>'
        : '<p class="text-xs text-amber-600 mt-1">Waiting to be sent to CabLink</p>';
      return `
        <div class="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
          <div>
            <p class="font-semibold text-gray-800">${roomName} → ${dropoffCity}</p>
            <p class="text-sm text-gray-500">${dropoffAddress}</p>
            <p class="text-xs text-gray-400 mt-1">${date}</p>
            ${sentLabel}
          </div>
          <span class="status-pill" style="${style}">${(t.status || "pending").replace("_", " ")}</span>
        </div>`;
    })
    .join("");
}

window.BSTM.ready().then(async function (session) {
  if (!session) {
    const listEl = document.getElementById("task-list");
    if (listEl)
      listEl.innerHTML =
        '<p class="text-gray-500 text-sm"><a href="login.html?redirect=cablink.html" class="text-purple-600 font-semibold">Log in</a> to see your delivery tasks.</p>';
    return;
  }

  loadTasks(session.user.id);
});
