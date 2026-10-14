// js/pages/open-room.js
import { supabase } from "../core/supabase-client.js";
import { escapeHtml } from "../core/sanitize.js";
import { loadMyRooms } from "../core/my-rooms.js";
import { loadCategories, fillCategorySelect } from "../core/categories.js";

let selectedEmoji = "🏪";

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".emoji-option").forEach((el) => {
    el.addEventListener("click", () => {
      document.querySelectorAll(".emoji-option").forEach((e) => e.classList.remove("selected"));
      el.classList.add("selected");
      selectedEmoji = el.dataset.emoji;
    });
  });
});

function showError(msg) {
  const el = document.getElementById("room-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

window.BSTM.ready().then(async function (session) {
  if (!session) {
    document.getElementById("auth-wall").style.display = "flex";
    return;
  }

  const userId = session.user.id;

  // One owner can run several businesses, each in its own room (the database
  // caps it at 10 per owner). Show what they already run, then the form.
  const { rooms } = await loadMyRooms(userId);
  const owned = rooms.filter((r) => r.isOwner);
  const note = document.getElementById("other-rooms-note");
  if (note && owned.length > 0) {
    const list = owned
      .map((r) => `<li>Room ${escapeHtml(r.room_number)} — ${escapeHtml(r.name)}</li>`)
      .join("");
    note.innerHTML =
      `<p class="font-semibold text-gray-800 mb-2">You already run ${owned.length} room${owned.length === 1 ? "" : "s"}:</p>` +
      `<ul class="list-disc list-inside text-gray-600 mb-2">${list}</ul>` +
      '<p class="text-gray-500">Each room is a separate business with its own products, sales and daily sheet. ' +
      '<a href="seller-dashboard.html" class="text-purple-700 font-semibold">Go to my dashboard</a></p>';
    note.style.display = "block";
  }

  fillCategorySelect(document.getElementById("roomCategory"), await loadCategories());

  document.getElementById("room-form-content").style.display = "block";

  document.getElementById("roomForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("roomName").value.trim();
    const category = document.getElementById("roomCategory").value;
    const description = document.getElementById("roomDescription").value.trim();

    if (!name || !category) {
      showError("Please fill in the room name and category.");
      return;
    }

    const btn = document.getElementById("openRoomBtn");
    btn.disabled = true;
    btn.textContent = "Opening your room…";

    const { data: room, error } = await supabase
      .from("rooms")
      .insert({
        seller_id: userId,
        name,
        category,
        description,
        banner_emoji: selectedEmoji,
      })
      .select()
      .single();

    if (error) {
      console.error("[BSTM] Failed to create room:", error);
      showError("Couldn't open your room: " + error.message);
      btn.disabled = false;
      btn.textContent = "Open My Room";
      return;
    }

    window.location.href = `room.html?id=${room.id}&welcome=1`;
  });
});
