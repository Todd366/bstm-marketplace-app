// js/pages/notifications-all.js
import { supabase } from "../core/supabase-client.js";

let currentUserId = null;
let allNotifications = [];
let currentFilter = "all";

const ICONS = {
  order: { icon: "box", color: "purple" },
  message: { icon: "comment", color: "blue" },
};

function render() {
  const container = document.getElementById("notificationsList");
  const filtered =
    currentFilter === "all"
      ? allNotifications
      : allNotifications.filter((n) => n.type === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-2xl p-12 text-center">
        <i class="fas fa-inbox text-gray-300 text-6xl mb-4"></i>
        <p class="text-gray-600">No ${currentFilter === "all" ? "" : currentFilter} notifications</p>
      </div>`;
    return;
  }

  container.innerHTML = filtered
    .map((n) => {
      const style = ICONS[n.type] || { icon: "bell", color: "gray" };
      const link = n.data?.link || "#";
      return `
      <a href="${link}" data-id="${n.id}" class="notif-item block bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all overflow-hidden ${!n.is_read ? "border-l-4 border-" + style.color + "-500" : ""}">
        <div class="p-6">
          <div class="flex items-start space-x-4">
            <div class="w-12 h-12 bg-${style.color}-100 rounded-full flex items-center justify-center flex-shrink-0">
              <i class="fas fa-${style.icon} text-${style.color}-600"></i>
            </div>
            <div class="flex-1">
              <div class="flex justify-between items-start mb-2">
                <p class="font-bold text-gray-800">${n.title}</p>
                ${!n.is_read ? `<span class="w-2 h-2 bg-${style.color}-500 rounded-full"></span>` : ""}
              </div>
              <p class="text-gray-600 mb-2">${n.body || ""}</p>
              <p class="text-xs text-gray-500">${formatTime(n.created_at)}</p>
            </div>
            <i class="fas fa-chevron-right text-gray-400"></i>
          </div>
        </div>
      </a>`;
    })
    .join("");

  container.querySelectorAll(".notif-item").forEach((el) => {
    el.addEventListener("click", () => markRead(el.dataset.id));
  });
}

async function markRead(id) {
  await supabase.from("notifications").update({ is_read: true }).eq("id", id);
}

window.filterNotifications = function (filter) {
  currentFilter = filter;
  document.querySelectorAll(".notif-filter").forEach((btn) => {
    btn.classList.remove("active", "text-purple-600", "border-purple-600", "border-b-2");
    btn.classList.add("text-gray-600");
  });
  event.target.classList.add("active", "text-purple-600", "border-purple-600", "border-b-2");
  event.target.classList.remove("text-gray-600");
  render();
};

window.markAllAsRead = async function () {
  if (!currentUserId) return;
  await supabase.from("notifications").update({ is_read: true }).eq("user_id", currentUserId);
  allNotifications = allNotifications.map((n) => ({ ...n, is_read: true }));
  render();
  const badge = document.getElementById("notifBadge");
  if (badge) badge.textContent = "0";
};

window.BSTM.ready().then(async function (session) {
  if (!session) {
    window.location.href = "login.html?redirect=notifications-all.html";
    return;
  }

  currentUserId = session.user.id;

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", currentUserId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[BSTM Notifications] Failed to load:", error);
  }

  allNotifications = data || [];
  render();
});
