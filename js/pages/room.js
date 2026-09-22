// js/pages/room.js
import { supabase } from "../core/supabase-client.js";
import { getRoomTemplate } from "../core/room-templates.js";
import { escapeHtml } from "../core/sanitize.js";
import { logEvent } from "../core/events.js";

function renderCard(p, tpl) {
  const img = p.image
    ? `<img src="${escapeHtml(p.image)}" style="width:100%;height:100%;object-fit:cover;">`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px;">📦</div>`;

  if (tpl.cardStyle === "market") {
    return `
      <a href="product-detail.html?id=${p.id}" style="display:block;background:#fff;border:2px solid #D9C9A3;border-radius:10px;overflow:hidden;text-decoration:none;">
        <div style="aspect-ratio:1;background:#F3EEE0;">${img}</div>
        <div style="padding:10px;font-family:${tpl.font};">
          <div style="font-weight:700;color:#292524;font-size:13px;">${escapeHtml(p.name)}</div>
          <div style="color:${tpl.accent};font-weight:900;margin-top:4px;">P${Number(p.price).toFixed(2)}</div>
        </div>
      </a>`;
  }

  if (tpl.cardStyle === "tech") {
    return `
      <a href="product-detail.html?id=${p.id}" style="display:block;background:#1E293B;border:1px solid #334155;border-radius:8px;overflow:hidden;text-decoration:none;">
        <div style="aspect-ratio:1;background:#0F172A;">${img}</div>
        <div style="padding:10px;font-family:${tpl.font};">
          <div style="font-weight:600;color:#E2E8F0;font-size:12px;">${escapeHtml(p.name)}</div>
          <div style="color:${tpl.accent};font-weight:900;margin-top:6px;font-size:14px;">P${Number(p.price).toFixed(2)}</div>
        </div>
      </a>`;
  }

  if (tpl.cardStyle === "boutique") {
    return `
      <a href="product-detail.html?id=${p.id}" style="display:block;text-decoration:none;">
        <div style="aspect-ratio:3/4;background:#F5E6EC;border-radius:2px;overflow:hidden;">${img}</div>
        <div style="padding:12px 4px;font-family:${tpl.font};text-align:center;">
          <div style="color:#57534E;font-size:13px;letter-spacing:0.5px;">${escapeHtml(p.name)}</div>
          <div style="color:${tpl.accent};font-weight:700;margin-top:4px;">P${Number(p.price).toFixed(2)}</div>
        </div>
      </a>`;
  }

  if (tpl.cardStyle === "showroom") {
    return `
      <a href="product-detail.html?id=${p.id}" style="display:block;background:#1F2937;border-radius:14px;overflow:hidden;text-decoration:none;">
        <div style="aspect-ratio:16/9;background:#111827;">${img}</div>
        <div style="padding:16px;">
          <div style="color:#F3F4F6;font-weight:700;font-size:15px;">${escapeHtml(p.name)}</div>
          <div style="color:${tpl.accent};font-weight:900;margin-top:6px;font-size:18px;">P${Number(p.price).toFixed(2)}</div>
        </div>
      </a>`;
  }

  if (tpl.cardStyle === "service-list") {
    return `
      <a href="product-detail.html?id=${p.id}" style="display:flex;align-items:center;gap:16px;background:#fff;border-radius:12px;padding:16px;text-decoration:none;box-shadow:0 1px 4px rgba(0,0,0,0.06);">
        <div style="width:64px;height:64px;border-radius:10px;overflow:hidden;flex-shrink:0;background:#EFF6FF;">${img}</div>
        <div style="flex:1;">
          <div style="color:#1F2937;font-weight:700;">${escapeHtml(p.name)}</div>
        </div>
        <div style="color:${tpl.accent};font-weight:900;">P${Number(p.price).toFixed(2)}</div>
      </a>`;
  }

  // catalog (default / home)
  return `
    <a href="product-detail.html?id=${p.id}" style="display:block;background:#fff;border-radius:14px;overflow:hidden;text-decoration:none;box-shadow:0 1px 6px rgba(0,0,0,0.06);">
      <div style="aspect-ratio:1;background:#F3F4F6;">${img}</div>
      <div style="padding:12px;">
        <div style="color:#374151;font-weight:700;font-size:13px;">${escapeHtml(p.name)}</div>
        <div style="color:${tpl.accent};font-weight:900;margin-top:4px;">P${Number(p.price).toFixed(2)}</div>
      </div>
    </a>`;
}

document.addEventListener("DOMContentLoaded", async () => {
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
    .eq("status", "active")
    .single();

  if (error || !room) {
    document.getElementById("room-not-found").classList.remove("hidden");
    return;
  }

  const tpl = getRoomTemplate(room.category);

  document.title = `${room.name} — BSTM Mall`;
  logEvent("room_view", { roomId: room.id, metadata: { room_name: room.name, category: room.category } });
  document.body.style.background = tpl.bodyBg;
  if (tpl.dark) document.body.classList.add("dark-room");

  document.getElementById("room-content").classList.remove("hidden");
  document.getElementById("room-banner").style.background = tpl.bannerBg;
  document.getElementById("room-emoji").textContent = room.banner_emoji || "🏪";
  document.getElementById("room-number-label").textContent = `ROOM ${room.room_number} · ${tpl.tagline}`;
  document.getElementById("room-name").textContent = room.name;
  document.getElementById("room-name").style.fontFamily = tpl.font;
  document.getElementById("room-description").textContent = room.description || "";

  if (params.get("welcome") === "1") {
    document.getElementById("welcome-banner").classList.remove("hidden");
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, image, status, shelf")
    .eq("room_id", roomId)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const grid = document.getElementById("room-products");

  if (!products || products.length === 0) {
    grid.className = `grid ${tpl.cardGrid} gap-5`;
    grid.innerHTML = `<p style="color:${tpl.dark ? "#9CA3AF" : "#9CA3AF"};font-size:14px;grid-column:1/-1;">No products yet.</p>`;
  } else {
    const hasShelves = products.some((p) => p.shelf);
    if (!hasShelves) {
      grid.className = `grid ${tpl.cardGrid} gap-5`;
      grid.innerHTML = products.map((p) => renderCard(p, tpl)).join("");
    } else {
      // Group by shelf, keeping un-shelved products under a plain "More"
      // heading rather than dropping them — every product still shows up.
      grid.className = "";
      const shelves = new Map();
      for (const p of products) {
        const key = p.shelf || "More";
        if (!shelves.has(key)) shelves.set(key, []);
        shelves.get(key).push(p);
      }
      grid.innerHTML = Array.from(shelves.entries())
        .map(
          ([shelfName, items]) => `
          <div style="margin-bottom:32px;">
            <h3 style="font-size:18px;font-weight:800;margin-bottom:12px;color:${tpl.dark ? "#F3F4F6" : "#1F2937"};">${escapeHtml(shelfName)}</h3>
            <div class="grid ${tpl.cardGrid} gap-5">
              ${items.map((p) => renderCard(p, tpl)).join("")}
            </div>
          </div>`
        )
        .join("");
    }
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
    { icon: "📞", value: room.contact_phone },
    { icon: "✉️", value: room.contact_email },
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
