// js/pages/settings.js
import { supabase } from "../core/supabase-client.js";
import { getProfile } from "../bstm-core.js";

window.BSTM.ready().then(async function (session) {
  const wall = document.getElementById("auth-wall");
  const content = document.getElementById("settings-content");

  if (!session) {
    if (wall) wall.style.display = "flex";
    if (content) content.style.display = "none";
    return;
  }

  if (wall) wall.style.display = "none";
  if (content) content.style.display = "block";

  const email = session.user.email;
  const name = session.user.user_metadata?.full_name || email.split("@")[0];

  document.getElementById("settings-name-display").textContent = name;
  document.getElementById("settings-email-display").textContent = email;
  document.getElementById("settings-name").value = name;
  document.getElementById("settings-email").value = email;

  const avatar = document.getElementById("settings-avatar");
  if (avatar) avatar.textContent = name.charAt(0).toUpperCase();

  const { data: profile } = await getProfile(session.user.id);
  if (profile) {
    const role = profile.role || "buyer";
    document.getElementById("settings-role-badge").textContent =
      role.charAt(0).toUpperCase() + role.slice(1);
    if (profile.phone) document.getElementById("settings-phone").value = profile.phone;
    if (profile.location) document.getElementById("settings-location").value = profile.location;

    const thbEl = document.getElementById("settings-thb-balance");
    if (thbEl) thbEl.textContent = Number(profile.thb_balance || 0).toFixed(1);

    const prefs = profile.notification_prefs || {};
    const setToggle = (id, key, defaultVal) => {
      const el = document.getElementById(id);
      if (el) el.checked = prefs[key] ?? defaultVal;
    };
    setToggle("pref-order-updates", "order_updates", true);
    setToggle("pref-messages", "messages", true);
    setToggle("pref-promotions", "promotions", false);
    setToggle("pref-price-drops", "price_drops", true);
  }
});

window.saveNotificationPref = async function (key, value) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("notification_prefs")
    .eq("id", userId)
    .maybeSingle();

  const prefs = { ...(profile?.notification_prefs || {}), [key]: value };

  await supabase.from("profiles").update({ notification_prefs: prefs }).eq("id", userId);
};

window.requestPasswordReset = async function () {
  const btn = document.getElementById("change-password-btn");
  const { data: sessionData } = await supabase.auth.getSession();
  const email = sessionData?.session?.user?.email;
  if (!email) return;

  if (btn) btn.textContent = "Sending…";

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/login.html",
  });

  if (btn) {
    btn.textContent = error ? "❌ Failed — try again" : "✅ Check your email";
    setTimeout(() => (btn.textContent = "Send Link"), 3000);
  }
};

window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};

window.saveProfile = async function () {
  const btn = document.getElementById("save-profile-btn");
  const name = document.getElementById("settings-name").value.trim();
  const phone = document.getElementById("settings-phone").value.trim();
  const location = document.getElementById("settings-location").value;

  if (btn) btn.textContent = "Saving…";

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) return;

  const { error: authErr } = await supabase.auth.updateUser({
    data: { full_name: name },
  });

  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ phone, location })
    .eq("id", userId);

  if (authErr || profileErr) {
    console.error("[BSTM Settings] Save failed:", authErr || profileErr);
    if (btn) btn.textContent = "❌ Failed — try again";
    setTimeout(() => btn && (btn.textContent = "Save Changes"), 2000);
    return;
  }

  document.getElementById("settings-name-display").textContent = name;
  if (btn) btn.textContent = "✅ Saved!";
  setTimeout(() => btn && (btn.textContent = "Save Changes"), 2000);
};
