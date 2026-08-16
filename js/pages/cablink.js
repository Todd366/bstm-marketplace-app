// js/pages/cablink.js
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";

const STATUS_STYLES = {
  pending: "background:#FEF3C7;color:#92400E;",
  assigned: "background:#DBEAFE;color:#1E40AF;",
  picked_up: "background:#E0E7FF;color:#4338CA;",
  delivered: "background:#D1FAE5;color:#065F46;",
  cancelled: "background:#FEE2E2;color:#991B1B;",
};

function showError(msg) {
  const el = document.getElementById("task-error");
  if (!el) return;
  el.textContent = msg;
  el.classList.remove("hidden");
}

function clearError() {
  const el = document.getElementById("task-error");
  if (!el) return;
  el.classList.add("hidden");
}

async function loadRooms() {
  const select = document.getElementById("pickup-room");
  if (!select) return;

  const { data: rooms, error } = await supabase
    .from("rooms")
    .select("id, name, room_number")
    .eq("status", "active")
    .order("room_number", { ascending: true });

  if (error || !rooms || rooms.length === 0) {
    select.innerHTML = '<option value="">No active rooms yet</option>';
    return;
  }

  select.innerHTML =
    '<option value="">Select a room…</option>' +
    rooms
      .map(
        (r) =>
          `<option value="${r.id}">Room ${escapeHtml(r.room_number ?? "?")} — ${escapeHtml(r.name)}</option>`
      )
      .join("");
}

async function loadTasks(userId) {
  const listEl = document.getElementById("task-list");
  if (!listEl) return;

  const { data: tasks, error } = await supabase
    .from("delivery_requests")
    .select("id, status, dropoff_address, dropoff_city, requested_at, pickup_room_id, rooms(name)")
    .eq("buyer_id", userId)
    .order("requested_at", { ascending: false })
    .limit(20);

  if (error) {
    listEl.innerHTML = '<p class="text-red-500 text-sm">Couldn\'t load your tasks.</p>';
    return;
  }

  if (!tasks || tasks.length === 0) {
    listEl.innerHTML =
      '<p class="text-gray-400 text-sm">No tasks yet. Create one above to get a room\'s order delivered.</p>';
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
      return `
        <div class="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
          <div>
            <p class="font-semibold text-gray-800">${roomName} → ${dropoffCity}</p>
            <p class="text-sm text-gray-500">${dropoffAddress}</p>
            <p class="text-xs text-gray-400 mt-1">${date}</p>
          </div>
          <span class="status-pill" style="${style}">${(t.status || "pending").replace("_", " ")}</span>
        </div>`;
    })
    .join("");
}

async function handleCreateTask(e, session) {
  e.preventDefault();
  clearError();

  const roomId = document.getElementById("pickup-room").value;
  const phone = document.getElementById("dropoff-phone").value.trim();
  const city = document.getElementById("dropoff-city").value.trim();
  const address = document.getElementById("dropoff-address").value.trim();

  if (!roomId) return showError("Please pick which room to collect from.");
  if (!phone || !city || !address)
    return showError("Please fill in all drop-off details.");

  const btn = document.getElementById("create-task-btn");
  btn.disabled = true;
  btn.textContent = "Creating…";

  const { error } = await supabase.from("delivery_requests").insert({
    buyer_id: session.user.id,
    pickup_room_id: roomId,
    dropoff_phone: phone,
    dropoff_city: city,
    dropoff_address: address,
    status: "pending",
  });

  btn.disabled = false;
  btn.textContent = "Create Task";

  if (error) {
    console.error("[BSTM CabLink] Task creation failed:", error);
    showError("Couldn't create the task. Please try again.");
    return;
  }

  document.getElementById("task-form").reset();
  document.getElementById("task-success").classList.remove("hidden");
  loadTasks(session.user.id);
}

window.BSTM.ready().then(async function (session) {
  loadRooms();

  if (!session) {
    const listEl = document.getElementById("task-list");
    if (listEl)
      listEl.innerHTML =
        '<p class="text-gray-500 text-sm"><a href="login.html?redirect=cablink.html" class="text-purple-600 font-semibold">Log in</a> to create and track delivery tasks.</p>';
    const form = document.getElementById("task-form");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        window.location.href = "login.html?redirect=cablink.html";
      });
    }
    return;
  }

  loadTasks(session.user.id);

  const form = document.getElementById("task-form");
  if (form) {
    form.addEventListener("submit", (e) => handleCreateTask(e, session));
  }
});
