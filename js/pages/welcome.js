// The front door: explains the workspaces and sends each person to the door of the one they choose.
import { ORDER, WORKSPACES, SELF_REGISTER, DOORS, doorUrl } from "../core/workspaces.js";
import { safeRedirect } from "../core/door.js";

try {
  localStorage.setItem("bstm_welcomed", "1"); // the start page stops sending this browser here
} catch (e) {
  /* storage blocked */
}

const redirect = safeRedirect(new URLSearchParams(window.location.search).get("redirect"));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function card(id, have, signedIn) {
  const ws = WORKSPACES[id];
  const door = DOORS[id];
  let actions;
  if (have) {
    actions = `<a class="w-btn primary" href="${esc(doorUrl(id, { redirect }))}">Open ${esc(ws.label)} workspace</a>`;
  } else if (signedIn) {
    actions = `<a class="w-btn primary" href="${esc(doorUrl(id, { mode: "register", redirect }))}">Create a ${esc(ws.label)} account</a>`;
  } else {
    actions =
      `<a class="w-btn primary" href="${esc(doorUrl(id, { redirect }))}">Sign in as ${esc(ws.label)}</a>` +
      `<a class="w-btn ghost" href="${esc(doorUrl(id, { mode: "register", redirect }))}">Create a ${esc(ws.label)} account</a>`;
  }
  return `<div class="w-card" data-workspace="${id}"><div style="font-size:34px;">${ws.icon}</div><h3>${esc(ws.label)}</h3><p>${esc(door.blurb)}</p>${actions}</div>`;
}

function render(session, have) {
  const signedIn = !!session;
  const bar = document.getElementById("signed-in-bar");
  if (bar) {
    bar.hidden = !signedIn;
    bar.style.display = signedIn ? "flex" : "none";
    if (signedIn) document.getElementById("who").textContent = session.user.email || "your account";
  }
  document.getElementById("chooser").innerHTML = SELF_REGISTER.map((id) => card(id, have.includes(id), signedIn)).join("");

  const staffIds = ORDER.filter((id) => !SELF_REGISTER.includes(id));
  // a signed-in person only sees the staff workspaces they actually hold
  const shown = signedIn ? staffIds.filter((id) => have.includes(id)) : staffIds;
  const links = document.getElementById("staff-links");
  links.innerHTML = shown.map((id) => `<a href="${esc(doorUrl(id, { redirect }))}">${WORKSPACES[id].icon} ${esc(DOORS[id].cta)}</a>`).join("");
  document.getElementById("staff").hidden = !shown.length;
}

if (new URLSearchParams(window.location.search).get("reason") === "idle") {
  const note = document.getElementById("idle-note");
  if (note) note.hidden = false;
}

document.getElementById("signout").addEventListener("click", () => window.BSTM.logout());

render(null, []);
window.BSTM.ready().then(async (session) => {
  if (!session) return;
  await window.BSTM.accountsReady();
  render(session, window.BSTM.workspaces());
});
