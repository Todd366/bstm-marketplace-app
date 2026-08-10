// js/pages/open-room.js
import { supabase } from "../core/supabase-client.js";

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

  const { data: existingRoom } = await supabase
    .from("rooms")
    .select("id, name, room_number")
    .eq("seller_id", userId)
    .maybeSingle();

  if (existingRoom) {
    document.getElementById("already-has-room").style.display = "block";
    document.getElementById("existing-room-name").textContent =
      `Room ${existingRoom.room_number} — ${existingRoom.name}`;
    return;
  }

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
