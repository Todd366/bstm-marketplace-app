import { supabase } from "./supabase-client.js";

export async function getUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

export async function isLoggedIn() {
  const session = await getSession();
  return !!session;
}

export async function logout() {
  return await supabase.auth.signOut();
}

export async function requireAuth(redirectTo = "login.html") {
  const session = await getSession();
  if (!session) {
    window.location.href = redirectTo;
    return null;
  }
  return session;
}
