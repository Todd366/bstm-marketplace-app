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
    document.getElementById("settings-role-badge").textContent =
      profile.role.charAt(0).toUpperCase() + profile.role.slice(1);
    if (profile.phone) document.getElementById("settings-phone").value = profile.phone;
    if (profile.location) document.getElementById("settings-location").value = profile.location;
  }
});

window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};

window.saveProfile = async function () {
  const btn = document.querySelector('button[onclick="saveProfile()"]');
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
