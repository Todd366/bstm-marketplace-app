// js/pages/messages.js
import { supabase } from "../core/supabase-client.js";

let currentUserId = null;
let currentConversation = null;

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  return Math.floor(hrs / 24) + "d ago";
}

async function loadConversationList() {
  const { data: convos, error } = await supabase
    .from("conversations")
    .select("id, buyer_id, seller_id, product_id, created_at, products(name)")
    .or(`buyer_id.eq.${currentUserId},seller_id.eq.${currentUserId}`)
    .order("created_at", { ascending: false });

  const listEl = document.getElementById("conversation-list");
  if (error) {
    console.error("[BSTM Messages] Failed to load conversations:", error);
    listEl.innerHTML = '<p class="p-4 text-sm text-red-500">Couldn\'t load conversations.</p>';
    return;
  }

  if (!convos || convos.length === 0) {
    listEl.innerHTML =
      '<p class="p-4 text-sm text-gray-500">No conversations yet. Message a seller from any product page to start one.</p>';
    return;
  }

  listEl.innerHTML = convos
    .map((c) => {
      const isSeller = c.seller_id === currentUserId;
      const label = c.products?.name || "Conversation";
      return `
      <div class="p-4 hover:bg-gray-50 cursor-pointer conversation-item" data-id="${c.id}">
        <div class="flex items-center space-x-3">
          <div class="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
            ${isSeller ? "B" : "S"}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-start">
              <h4 class="font-bold text-gray-800 truncate">${label}</h4>
              <span class="text-xs text-gray-500">${timeAgo(c.created_at)}</span>
            </div>
            <p class="text-sm text-gray-500">${isSeller ? "Buyer inquiry" : "You messaged the seller"}</p>
          </div>
        </div>
      </div>`;
    })
    .join("");

  listEl.querySelectorAll(".conversation-item").forEach((el) => {
    el.addEventListener("click", () => openConversation(el.dataset.id, convos));
  });

  // Auto-open conversation from ?conversation= URL param, or the first one
  const params = new URLSearchParams(window.location.search);
  const wanted = params.get("conversation");
  const target = wanted && convos.find((c) => c.id === wanted) ? wanted : convos[0]?.id;
  if (target) openConversation(target, convos);
}

async function openConversation(conversationId, convos) {
  currentConversation = convos.find((c) => c.id === conversationId);
  if (!currentConversation) return;

  document.querySelectorAll(".conversation-item").forEach((el) => {
    el.classList.toggle("bg-purple-50", el.dataset.id === conversationId);
    el.classList.toggle("border-l-4", el.dataset.id === conversationId);
    el.classList.toggle("border-purple-600", el.dataset.id === conversationId);
  });

  const isSeller = currentConversation.seller_id === currentUserId;
  document.getElementById("chat-header").classList.remove("hidden");
  document.getElementById("chat-partner-name").textContent = isSeller ? "Buyer" : "Seller";
  document.getElementById("chat-product-name").textContent =
    currentConversation.products?.name || "";

  document.getElementById("message-input").disabled = false;
  document.getElementById("message-send-btn").disabled = false;

  await loadMessages(conversationId);
}

async function loadMessages(conversationId) {
  const { data: msgs, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const container = document.getElementById("chat-messages");
  if (error) {
    console.error("[BSTM Messages] Failed to load messages:", error);
    container.innerHTML = '<p class="text-center text-red-500 text-sm">Couldn\'t load messages.</p>';
    return;
  }

  if (!msgs || msgs.length === 0) {
    container.innerHTML =
      '<p class="text-center text-gray-400 text-sm">No messages yet. Say hello 👋</p>';
    return;
  }

  container.innerHTML = msgs
    .map((m) => {
      const mine = m.sender_id === currentUserId;
      return `
      <div class="flex items-start ${mine ? "justify-end" : ""}">
        <div>
          <div class="${mine ? "message-sent rounded-tr-none" : "message-received rounded-tl-none"} rounded-2xl px-4 py-3 max-w-md">
            <p>${m.body}</p>
          </div>
          <p class="text-xs text-gray-500 mt-1 ${mine ? "text-right mr-2" : "ml-2"}">
            ${new Date(m.created_at).toLocaleTimeString("en-BW", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>`;
    })
    .join("");

  container.scrollTop = container.scrollHeight;
}

async function sendMessage(e) {
  e.preventDefault();
  if (!currentConversation) return;

  const input = document.getElementById("message-input");
  const body = input.value.trim();
  if (!body) return;

  input.disabled = true;
  const { error } = await supabase.from("messages").insert({
    conversation_id: currentConversation.id,
    sender_id: currentUserId,
    body: body,
  });
  input.disabled = false;

  if (error) {
    console.error("[BSTM Messages] Send failed:", error);
    alert("Message failed to send. Please try again.");
    return;
  }

  input.value = "";
  await loadMessages(currentConversation.id);
}

window.BSTM.ready().then(async function (session) {
  if (!session) {
    window.location.href = "login.html?redirect=messages.html";
    return;
  }

  currentUserId = session.user.id;
  await loadConversationList();

  document.getElementById("message-form").addEventListener("submit", sendMessage);

  // Live updates for the open conversation
  supabase
    .channel("messages-live")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => {
        if (currentConversation && payload.new.conversation_id === currentConversation.id) {
          loadMessages(currentConversation.id);
        }
      }
    )
    .subscribe();
});

window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
