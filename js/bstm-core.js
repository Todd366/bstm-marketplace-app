import { supabase } from "./core/supabase-client.js";

export { supabase };

// AUTH
export async function signInWithMagicLink(email) {
  return await supabase.auth.signInWithOtp({ email });
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

export async function logout() {
  return await supabase.auth.signOut();
}

// PRODUCTS
export async function getProducts(filters = {}) {
  let query = supabase.from("products").select("*");
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.seller_id) query = query.eq("seller_id", filters.seller_id);
  return await query.order("created_at", { ascending: false });
}

// ORDERS
export async function createOrder(order) {
  return await supabase.from("orders").insert([order]);
}

export async function getOrders(userId) {
  return await supabase.from("orders").select("*").eq("buyer_id", userId).order("created_at", { ascending: false });
}

// PROFILE
export async function getProfile(userId) {
  return await supabase.from("profiles").select("*").eq("id", userId).single();
}

export async function updateProfile(userId, updates) {
  return await supabase.from("profiles").update(updates).eq("id", userId);
}

// WISHLIST
export async function getWishlist(userId) {
  return await supabase.from("wishlist").select("*, products(*)").eq("user_id", userId);
}

export async function addToWishlist(userId, productId) {
  return await supabase.from("wishlist").insert([{ user_id: userId, product_id: productId }]);
}

export async function removeFromWishlist(userId, productId) {
  return await supabase.from("wishlist").delete().eq("user_id", userId).eq("product_id", productId);
}
