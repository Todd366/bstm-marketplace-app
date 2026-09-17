// js/pages/room.js
import { supabase } from "../core/supabase-client.js";
import { getRoomTemplate } from "../core/room-templates.js";
import { escapeHtml } from "../core/sanitize.js";
import { logEvent } from "../core/events.js";

function renderCard(p, tpl) {
  const img = p.image
    ? `<img src="${escapeHtml(p.image)}" style="width:100%;height:100%;object-fit:cover;">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px;">📍️</div>`;

  return `
    <a href="product-detail.html?id=${p.id}" style="background:${tpl.cardBg};border-radius:${tpl.cardRadius};overflow:hidden;text-decoration:none;display:block;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <div style="aspect-ratio:1/1;background:#F3F4F6;">${img}</div>
      <div style="padding:12px;">
        <p style="font-weight:700;font-size:13px;color:${tpl.textColor};margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(p.name)}</p>
        <p style="font-weight:900;font-size:15px;color:${tpl.priceColor};">P${Number(p.price || 0).toFixed(2)}</p>
      </div>
    </a>`;
}

document.addEventListener("DOMContentLoaded", async function () {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("id");

  if (!roomId) {
    document.getElementById("room-not-found").classList.remove("hidden");
    return;
  }

  const { data: room, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (error || !room) {
    document.getElementById("room-not-found").classList.remove("hidden");
    return;
  }

  document.getElementById("room-content").classList.remove("hidden");

  const tpl = getRoomTemplate(room.category);

  document.title = `${room.name} — BSTM Mall`;
  logEvent("room_view", { roomId: room.id, metadata: { room_name: room.name, category: room.category } });

  document.body.style.background = tpl.bodyBg;
  if (tpl.dark) document.body.classList.add("dark-room");

  const banner = document.getElementById("room-banner");
  if (banner) banner.style.background = tpl.bannerBg;

  const emoji = document.getElementById("room-emoji");
  if (emoji) emoji.textContent = room.banner_emoji || tpl.defaultEmoji;

  const numLabel = document.getElementById("room-number-label");
  if (numLabel && room.room_number) numLabel.textContent = `Room ${room.room_number}`;

  document.getElementById("room-name").textContent = room.name;
  document.getElementById("room-description").textContent = room.description || "";

  const { data: products } = await supabase
    .from("products")
    .select("*")
    .eq("room_id", roomId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const grid = document.getElementById("room-products");
  if (!products || products.length === 0) {
    grid.innerHTML =
      '<p class="text-gray-400 text-sm col-span-full">No products listed in this room yet.</p>';
  } else {
    grid.innerHTML = products.map((p) => renderCard(p, tpl)).join("");
  }

  const heading = document.getElementById("room-products-heading");
  if (heading) {
    heading.textContent = tpl.cardStyle === "service-list" ? "Services Offered" : "Products";
    heading.style.color = tpl.dark ? "#F3F4F6" : "#1F2937";
    heading.style.fontFamily = tpl.font;
  }

  const session = await window.BSTM.ready();
  const isOwner = !!(session && session.user.id === room.seller_id);
  if (isOwner) {
    document.getElementById("room-owner-actions").classList.remove("hidden");
  }

  let canAnswer = isOwner;
  if (session && !isOwner) {
    const { count: staffCount } = await supabase
      .from("room_roles")
      .select("id", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("user_id", session.user.id)
      .in("role_id", ["ROOM_MANAGER", "EMPLOYEE"]);
    canAnswer = (staffCount || 0) > 0;
  }

  // Business info — only show rows the owner actually filled in.
  const infoRows = [
    { icon: "📟", value: room.contact_phone },
    { icon: "✋️", value: room.contact_email },
    { icon: "📍", value: room.address },
    { icon: "🕒", value: room.business_hours },
    { icon: "📋", value: room.policies },
  ].filter((r) => r.value);

  if (infoRows.length > 0) {
    document.getElementById("room-info-card").classList.remove("hidden");
    document.getElementById("room-info-rows").innerHTML = infoRows
      .map((r) => `<div class="flex items-start gap-2"><span>${r.icon}</span><span>${escapeHtml(r.value)}</span></div>`)
      .join("");
  }

  // Reviews — real aggregate across every product in this room, not per-product.
  const { data: roomReviews, error: reviewsError } = await supabase
    .from("reviews")
    .select("rating, comment, created_at, products!inner(room_id, name)")
    .eq("products.room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(10);

  const summaryEl = document.getElementById("room-reviews-summary");
  const listEl = document.getElementById("room-reviews-list");

  if (reviewsError) {
    summaryEl.textContent = "Couldn't load reviews.";
  } else if (!roomReviews || roomReviews.length === 0) {
    summaryEl.textContent = "No reviews yet.";
  } else {
    const avg = roomReviews.reduce((sum, r) => sum + r.rating, 0) / roomReviews.length;
    summaryEl.innerHTML = `<span style="color:#F59E0B;font-weight:800;">${"★".repeat(Math.round(avg))}${"☆".repeat(5 - Math.round(avg))}</span> ${avg.toFixed(1)} out of 5 · ${roomReviews.length} review${roomReviews.length === 1 ? "" : "s"}`;
    listEl.innerHTML = roomReviews
      .map(
        (r) => `
        <div class="bg-white rounded-xl p-4 shadow-sm">
          <div class="flex justify-between items-center mb-1">
            <span style="color:#F59E0B;">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</span>
            <span class="text-xs text-gray-400">${new Date(r.created_at).toLocaleDateString()}</span>
          </div>
          <p class="text-sm text-gray-500 mb-1">on ${escapeHtml(r.products?.name || "a product")}</p>
          ${r.comment ? `<p class="text-sm text-gray-700">${escapeHtml(r.comment)}</p>` : ""}
        </div>`
      )
      .join("");
  }

  // ===== Q&A / Community =====
  if (session) {
    document.getElementById("qa-ask-box").classList.remove("hidden");
  } else {
    document.getElementById("qa-login-prompt").classList.remove("hidden");
  }

  async function loadQuestions() {
    const { data: questions, error: qError } = await supabase
      .from("room_questions")
      .select("id, question, answer, answered_at, user_id, profiles!room_questions_user_id_fkey(email)")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(20);

    const qaListEl = document.getElementById("room-qa-list");
    if (qError) {
      qaListEl.innerHTML = '<p class="text-sm text-gray-400">Couldn\'t load questions.</p>';
      return;
    }
    if (!questions || questions.length === 0) {
      qaListEl.innerHTML = '<p class="text-sm text-gray-400">No questions yet — be the first to ask.</p>';
      return;
    }

    qaListEl.innerHTML = questions
      .map((q) => {
        const askerName = q.profiles?.email ? q.profiles.email.split("@")[0] : "A buyer";
        const answerBlock = q.answer
          ? `<div class="mt-2 pl-4 border-l-2 border-purple-300">
               <p class="text-xs font-bold text-purple-600 mb-1">Room's answer</p>
               <p class="text-sm text-gray-700">${escapeHtml(q.answer)}</p>
             </div>`
          : canAnswer
          ? `<div class="mt-2 flex gap-2">
               <input type="text" class="qa-answer-input flex-1 px-3 py-2 border rounded-lg text-sm" placeholder="Write an answer…" data-qid="${q.id}">
               <button class="qa-answer-btn bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold" data-qid="${q.id}">Answer</button>
             </div>`
          : `<p class="text-xs text-gray-400 mt-1">Not answered yet.</p>`;

        return `
          <div class="bg-white rounded-xl p-4 shadow-sm">
            <p class="text-sm font-semibold text-gray-800">Q: ${escapeHtml(q.question)}</p>
            <p class="text-xs text-gray-400 mb-1">asked by ${escapeHtml(askerName)}</p>
            ${answerBlock}
          </div>`;
      })
      .join("");

    qaListEl.querySelectorAll(".qa-answer-btn").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const qid = btn.dataset.qid;
        const input = qaListEl.querySelector(`.qa-answer-input[data-qid="${qid}"]`);
        const answerText = input.value.trim();
        if (!answerText) return;
        btn.disabled = true;
        const { error: answerErr } = await supabase
          .from("room_questions")
          .update({ answer: answerText })
          .eq("id", qid);
        if (answerErr) {
          console.error("[BSTM Room] Couldn't save answer:", answerErr);
          alert("Couldn't save your answer. Please try again.");
          btn.disabled = false;
          return;
        }
        loadQuestions();
      });
    });
  }

  loadQuestions();

  const qaSubmitBtn = document.getElementById("qa-submit-btn");
  if (qaSubmitBtn) {
    qaSubmitBtn.addEventListener("click", async () => {
      const input = document.getElementById("qa-question-input");
      const errEl = document.getElementById("qa-error");
      errEl.classList.add("hidden");
      const text = input.value.trim();
      if (!text) {
        errEl.textContent = "Please write a question first.";
        errEl.classList.remove("hidden");
        return;
      }
      qaSubmitBtn.disabled = true;
      const { error: postErr } = await supabase
        .from("room_questions")
        .insert({ room_id: roomId, user_id: session.user.id, question: text });
      qaSubmitBtn.disabled = false;
      if (postErr) {
        console.error("[BSTM Room] Couldn't post question:", postErr);
        errEl.textContent = "Couldn't post your question. Please try again.";
        errEl.classList.remove("hidden");
        return;
      }
      input.value = "";
      loadQuestions();
    });
  }
});
