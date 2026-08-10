// ============================================
// INDEX PAGE LOGIC
// ============================================
import { supabase } from "../core/supabase-client.js";

document.addEventListener("DOMContentLoaded", () => {
  console.log("[BSTM] index.js loaded");

  window.addEventListener("bstm:ready", () => {
    console.log("[BSTM] UI ready (index)");
  });

  supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("status", "active")
    .then(({ count }) => {
      const el = document.getElementById("open-rooms-stat");
      if (el && typeof count === "number") el.textContent = count;
    });
});
