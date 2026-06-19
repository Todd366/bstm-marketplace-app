export async function sendMagicLink(email) {
  const token =
    Math.random().toString(36).substring(2) +
    Date.now().toString(36);

  const magicLink =
    "https://todd366.github.io/bstm-marketplace-app/verify.html?token=" +
    token +
    "&email=" +
    encodeURIComponent(email);

  localStorage.setItem(
    "bstm_pending_" + token,
    JSON.stringify({
      email,
      name: email.split("@")[0],
      expires: Date.now() + 900000
    })
  );

  return { token, magicLink };
}

export function showStatus(msg, type) {
  const el = document.getElementById("status");
  if (!el) return;

  el.textContent = msg;
  el.style.display = "block";

  el.style.background =
    type === "success" ? "#DCFCE7" : "#FEE2E2";

  el.style.color =
    type === "success" ? "#166534" : "#991B1B";

  el.style.border =
    "1px solid " +
    (type === "success" ? "#BBF7D0" : "#FECACA");
}
