import { createClient } from "@supabase/supabase-js";
import { BSTM_CONFIG } from "./bstm-config.js";

export const supabase = createClient(
  BSTM_CONFIG.supabaseUrl,
  BSTM_CONFIG.supabaseAnonKey
);

// ==========================
// AUTH LAYER
// ==========================
export async function signInWithMagicLink(email) {
  return await supabase.auth.signInWithOtp({
    email,
  });
}

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

export async function logout() {
  return await supabase.auth.signOut();
}

// ==========================
// PRODUCTS LAYER
// ==========================
export async function getProducts() {
  return await supabase.from("products").select("*");
}

// ==========================
// ORDERS LAYER
// ==========================
export async function createOrder(order) {
  return await supabase.from("orders").insert([order]);
}

// ==========================
// PROFILE LAYER
// ==========================
export async function getProfile(userId) {
  return await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
}
