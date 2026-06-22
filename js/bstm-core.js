import { supabase } from "./core/supabase-client.js";

export { supabase };

// ============================================
// AUTH
// ============================================
export async function signInWithMagicLink(email) {
  const result = await supabase.auth.signInWithOtp({ email });
  if (result.error) console.error("signInWithMagicLink error:", result.error);
  return result;
}

export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) console.error("getUser error:", error);
  return data?.user || null;
}

export async function logout() {
  return await supabase.auth.signOut();
}

// ============================================
// PROFILE
// Live columns: id, email, role, thb_balance
// ============================================
export async function getProfile(userId) {
  const result = await supabase
    .from("profiles")
    .select("id, email, role, thb_balance")
    .eq("id", userId)
    .single();
  if (result.error) console.error("getProfile error:", result.error);
  return result;
}

export async function updateProfile(userId, updates) {
  // Only pass columns that exist: role, thb_balance
  const safeUpdates = {};
  if (updates.role !== undefined) safeUpdates.role = updates.role;
  if (updates.thb_balance !== undefined) safeUpdates.thb_balance = updates.thb_balance;
  const result = await supabase
    .from("profiles")
    .update(safeUpdates)
    .eq("id", userId);
  if (result.error) console.error("updateProfile error:", result.error);
  return result;
}

// ============================================
// PRODUCTS
// Live columns: id, name, price, image, seller_id, created_at
// ============================================
export async function getProducts(filters = {}) {
  let query = supabase
    .from("products")
    .select("id, name, price, image, seller_id, created_at");

  // Only filter by columns that actually exist
  if (filters.seller_id) query = query.eq("seller_id", filters.seller_id);

  const result = await query.order("created_at", { ascending: false });
  if (result.error) console.error("getProducts error:", result.error);
  return result;
}

export async function getProductById(productId) {
  const result = await supabase
    .from("products")
    .select("id, name, price, image, seller_id, created_at")
    .eq("id", productId)
    .single();
  if (result.error) console.error("getProductById error:", result.error);
  return result;
}

// Normalize a product row for consistent use across all pages
// The live DB uses 'name' — we expose 'title' in the UI for readability
export function normalizeProduct(p) {
  if (!p) return null;
  return {
    id: p.id,
    title: p.name,        // DB: name → UI: title
    name: p.name,
    price: p.price,
    image: p.image || null,
    seller_id: p.seller_id,
    created_at: p.created_at
  };
}

// ============================================
// ORDERS
// Live columns: id, buyer_id, status, created_at
// ============================================
export async function createOrder(order) {
  // Only insert columns that exist
  const safeOrder = {
    buyer_id: order.buyer_id,
    status: order.status || "pending"
  };
  const result = await supabase.from("orders").insert([safeOrder]);
  if (result.error) console.error("createOrder error:", result.error);
  return result;
}

export async function getOrders(userId) {
  const result = await supabase
    .from("orders")
    .select("id, buyer_id, status, created_at")
    .eq("buyer_id", userId)
    .order("created_at", { ascending: false });
  if (result.error) console.error("getOrders error:", result.error);
  return result;
}

// ============================================
// WISHLIST
// Live columns: user_id, product_id, created_at (NO id column)
// ============================================
export async function getWishlist(userId) {
  const result = await supabase
    .from("wishlist")
    .select("user_id, product_id, created_at, products(id, name, price, image)")
    .eq("user_id", userId);
  if (result.error) console.error("getWishlist error:", result.error);
  return result;
}

export async function addToWishlist(userId, productId) {
  const result = await supabase
    .from("wishlist")
    .insert([{ user_id: userId, product_id: productId }]);
  if (result.error) console.error("addToWishlist error:", result.error);
  return result;
}

export async function removeFromWishlist(userId, productId) {
  const result = await supabase
    .from("wishlist")
    .delete()
    .eq("user_id", userId)
    .eq("product_id", productId);
  if (result.error) console.error("removeFromWishlist error:", result.error);
  return result;
}
