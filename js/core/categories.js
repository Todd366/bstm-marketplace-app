// js/core/categories.js
// Categories live in the database (public.categories), so a new kind of
// business needs a row, not a code change. The built-in list below is only a
// fallback so a failed fetch never leaves a form without options.
import { supabase } from "./supabase-client.js";

export const FALLBACK_CATEGORIES = [
  { id: "fresh-produce", label: "Fresh Produce" },
  { id: "agriculture", label: "Agriculture & Livestock" },
  { id: "electronics", label: "Electronics & Gadgets" },
  { id: "fashion", label: "Fashion & Accessories" },
  { id: "home", label: "Home & Living" },
  { id: "vehicles", label: "Vehicles & Auto Parts" },
  { id: "services", label: "Services & Skills" },
];

export async function loadCategories() {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("id, label, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) {
      console.warn("[BSTM] Couldn't load categories, using built-in list:", error);
    } else if (data && data.length > 0) {
      return data;
    }
  } catch (e) {
    console.warn("[BSTM] Couldn't load categories, using built-in list:", e);
  }
  return FALLBACK_CATEGORIES;
}

// Rebuilds a <select>'s options from the list, keeping the placeholder
// (the option with an empty value) and the current selection if still valid.
export function fillCategorySelect(select, categories) {
  if (!select || !categories || categories.length === 0) return;
  const current = select.value;
  const placeholder = Array.from(select.options).find((o) => o.value === "");
  select.textContent = "";
  if (placeholder) select.appendChild(placeholder);
  categories.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.label;
    select.appendChild(opt);
  });
  if (current && categories.some((c) => c.id === current)) select.value = current;
}
