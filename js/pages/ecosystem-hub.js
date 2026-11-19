// ecosystem-hub.js
// Live numbers for the hub header. Platform count is computed inline on the page from
// BSTMEcosystem.properties; rooms and products are real counts from the database.
// Nothing here is a placeholder: if a count cannot be read the dash stays.
import { supabase } from "../core/supabase-client.js";

async function setCount(id, table, filters) {
  const el = document.getElementById(id);
  if (!el) return;
  let q = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [col, val] of filters) q = q.eq(col, val);
  const { count, error } = await q;
  if (error) {
    console.error("[BSTM Hub] count failed for " + table + ":", error.message);
    return;
  }
  if (typeof count === "number") el.textContent = count.toLocaleString("en-BW");
}

document.addEventListener("DOMContentLoaded", () => {
  setCount("hubRooms", "rooms", [["status", "active"]]);
  setCount("hubProducts", "products", [["status", "active"]]);
});
