import { test, open, url, text, bodyText, dbOf, scen, settle } from "../run.mjs";
import { U, world, onlineOrder, groupFor, iso } from "../fixtures.mjs";

const loaded = (page) => page.waitForSelector("#ap-main:not(.ap-hidden)");
const flash = (page) => text(page, "#ap-flash");
const card = (page, gid) => page.locator(`#ap-queue [data-group="${gid}"]`);
const prov = (page, slug) => page.locator(`#ap-providers [data-provider="${slug}"]`);
const dlgOk = (page) => page.locator("#ap-dlg-ok");

function queueWorld() {
  const db = world();
  const oRev = onlineOrder(db, { provider: "dpo", pay: "review" });
  const gRev = groupFor(db, { provider: "dpo", status: "review", orders: [oRev], reason: "amount_mismatch" });
  const oAwait = onlineOrder(db, { provider: "mascom_myzaka", pay: "pending", amount: 150 });
  const gAwait = groupFor(db, { provider: "mascom_myzaka", status: "awaiting_confirmation", orders: [oAwait], reference: "MZ-777" });
  const oPend = onlineOrder(db, { buyer: U.buyer2, provider: "mascom_myzaka", pay: "pending", amount: 30 });
  const gPend = groupFor(db, { buyer: U.buyer2, provider: "mascom_myzaka", status: "pending", orders: [oPend] });
  const oGw = onlineOrder(db, { provider: "dpo", pay: "pending" });
  const gGw = groupFor(db, { provider: "dpo", status: "pending", orders: [oGw] });   // gateway pending: NOT a staff task
  return { db, oRev, gRev, oAwait, gAwait, oPend, gPend, oGw, gGw };
}

test("admin-payments: queue shows only what needs a person, review first, with the right buttons", async (t) => {
  const w = queueWorld();
  const page = await open(t, "/admin-payments.html", { user: U.admin, db: w.db });
  await loaded(page);
  const ids = await page.locator("#ap-queue [data-group]").evaluateAll((e) => e.map((x) => x.dataset.group));
  t.eq(ids, [w.gRev.id, w.gAwait.id, w.gPend.id], "order: review, awaiting confirmation, waiting for buyer; gateway pending is not listed");
  const rev = await card(page, w.gRev.id).innerText();
  t.has(rev, "Held for review", "review pill"); t.has(rev, "amount_mismatch", "reason shown"); t.has(rev, "Mark as refunded", "refund button on review");
  t.eq(await card(page, w.gRev.id).locator("button[data-act=approve], button[data-act=reject]").count(), 0, "no confirm/reject on a gateway review");
  const aw = await card(page, w.gAwait.id).innerText();
  t.has(aw, "MZ-777", "buyer's reference"); t.has(aw, "P150.00", "amount"); t.has(aw, "buyer@test.bw", "buyer email");
  t.eq(await card(page, w.gAwait.id).locator("button[data-act=approve]").count(), 1, "confirm button");
  t.eq(await card(page, w.gAwait.id).locator("button[data-act=reject]").count(), 1, "reject button");
  t.has(await card(page, w.gPend.id).innerText(), "No reference sent yet.", "pending manual payment says no reference yet");
  t.eq(await page.locator("#ap-queue [data-group]").count(), 3, "three cards");
});

test("admin-payments: confirm needs the 'I have seen the money' tick, then confirms the order and clears the card", async (t) => {
  const w = queueWorld();
  const page = await open(t, "/admin-payments.html", { user: U.admin, db: w.db });
  await loaded(page);
  await card(page, w.gAwait.id).locator("button[data-act=approve]").click();
  await page.waitForSelector("#ap-modal");
  t.has(await text(page, "#ap-modal"), "MZ-777", "dialog repeats the reference");
  t.eq(await dlgOk(page).isDisabled(), true, "Confirm disabled until the box is ticked");
  await page.check("#ap-dlg-check");
  t.eq(await dlgOk(page).isDisabled(), false, "enabled after ticking");
  await dlgOk(page).click();
  await page.waitForSelector("#ap-modal", { state: "detached" });
  t.has(await flash(page), "Payment confirmed", "flash");
  const d = await dbOf(page);
  const o = d.orders.find((x) => x.id === w.oAwait.id);
  t.eq([d.payment_groups.find((g) => g.id === w.gAwait.id).status, o.payment_status, o.status], ["succeeded", "paid", "confirmed"], "group succeeded, order paid + confirmed");
  t.eq(await card(page, w.gAwait.id).count(), 0, "card removed from the queue");
});

test("admin-payments: cancel / Escape / backdrop close the dialog and change nothing", async (t) => {
  const w = queueWorld();
  const page = await open(t, "/admin-payments.html", { user: U.admin, db: w.db });
  await loaded(page);
  const before = JSON.stringify((await dbOf(page)).payment_groups);
  for (const how of ["cancel", "escape", "backdrop"]) {
    await card(page, w.gAwait.id).locator("button[data-act=approve]").click();
    await page.waitForSelector("#ap-modal");
    if (how === "cancel") await page.click("#ap-dlg-cancel");
    else if (how === "escape") await page.keyboard.press("Escape");
    else await page.mouse.click(5, 5);
    await page.waitForSelector("#ap-modal", { state: "detached" });
  }
  t.eq(JSON.stringify((await dbOf(page)).payment_groups), before, "database untouched");
});

test("admin-payments: reject needs a reason (3+ chars); the order stays reserved and failed", async (t) => {
  const w = queueWorld();
  const page = await open(t, "/admin-payments.html", { user: U.admin, db: w.db });
  await loaded(page);
  await card(page, w.gAwait.id).locator("button[data-act=reject]").click();
  await page.waitForSelector("#ap-modal");
  t.eq(await dlgOk(page).isDisabled(), true, "disabled with no reason");
  await page.fill("#ap-dlg-note", "ab");
  t.eq(await dlgOk(page).isDisabled(), true, "still disabled with 2 chars");
  await page.fill("#ap-dlg-note", "No such transfer");
  t.eq(await dlgOk(page).isDisabled(), false, "enabled with a reason");
  await dlgOk(page).click();
  await page.waitForSelector("#ap-modal", { state: "detached" });
  t.has(await flash(page), "Payment rejected", "flash");
  const d = await dbOf(page);
  const g = d.payment_groups.find((x) => x.id === w.gAwait.id); const o = d.orders.find((x) => x.id === w.oAwait.id);
  t.eq([g.status, g.failure_reason, o.payment_status, o.status], ["failed", "No such transfer", "failed", "pending"], "group failed with the reason; order failed but still pending (buyer can retry)");
});

test("admin-payments: server says the order changed meanwhile -> 'Not applied', payment moves to review", async (t) => {
  const w = queueWorld();
  const page = await open(t, "/admin-payments.html", { user: U.admin, db: w.db, scen: { confirmNeedsReview: true } });
  await loaded(page);
  await card(page, w.gAwait.id).locator("button[data-act=approve]").click();
  await page.check("#ap-dlg-check"); await dlgOk(page).click();
  await page.waitForSelector("#ap-modal", { state: "detached" });
  t.has(await flash(page), "Not applied: it was moved to review", "honest message");
  t.has(await card(page, w.gAwait.id).innerText(), "Held for review", "the card is now in review");
});

test("admin-payments: resolve a review as refunded needs the tick and a note; open orders go back to failed so the buyer can retry", async (t) => {
  const w = queueWorld();
  const page = await open(t, "/admin-payments.html", { user: U.admin, db: w.db });
  await loaded(page);
  await card(page, w.gRev.id).locator("button[data-act=refund]").click();
  await page.waitForSelector("#ap-modal");
  t.eq(await dlgOk(page).isDisabled(), true, "disabled at first");
  await page.check("#ap-dlg-check");
  t.eq(await dlgOk(page).isDisabled(), true, "tick alone is not enough");
  await page.fill("#ap-dlg-note", "Refunded via DPO dashboard");
  t.eq(await dlgOk(page).isDisabled(), false, "tick + note enables it");
  await dlgOk(page).click();
  await page.waitForSelector("#ap-modal", { state: "detached" });
  t.has(await flash(page), "Marked as refunded", "flash");
  const d = await dbOf(page);
  t.eq([d.payment_groups.find((g) => g.id === w.gRev.id).status, d.orders.find((o) => o.id === w.oRev.id).payment_status], ["refunded", "failed"], "group refunded; order available for retry");
  t.eq(await card(page, w.gRev.id).count(), 0, "gone from the queue");
});

test("admin-payments: a database refusal is shown inside the dialog and nothing closes", async (t) => {
  const w = queueWorld();
  const page = await open(t, "/admin-payments.html", { user: U.admin, db: w.db });
  await loaded(page);
  await card(page, w.gAwait.id).locator("button[data-act=approve]").click();
  await page.check("#ap-dlg-check");
  // another admin handled it a moment ago
  await page.evaluate((id) => { window.__DB.payment_groups.find((g) => g.id === id).status = "succeeded"; }, w.gAwait.id);
  await dlgOk(page).click();
  await page.waitForSelector("#ap-dlg-err:not(.ap-hidden)");
  t.has(await text(page, "#ap-dlg-err"), "no longer open", "friendly message");
  t.eq(await page.locator("#ap-modal").count(), 1, "dialog stays open");
  t.eq(await page.locator("#ap-dlg-cancel").isDisabled(), false, "can still cancel");
});

test("admin-payments: methods list shows state, hold time and gateway secret health", async (t) => {
  const page = await open(t, "/admin-payments.html", { user: U.admin });
  await loaded(page);
  t.eq(await page.locator("#ap-providers [data-provider]").evaluateAll((e) => e.map((x) => x.dataset.provider)), ["dpo", "mascom_myzaka", "bank_eft", "orange_money"], "all four in sort order");
  const dpo = await prov(page, "dpo").innerText();
  t.has(dpo, "On", "dpo is on"); t.has(dpo, "Sandbox (test)", "mode"); t.has(dpo, "buyers have 2 h to pay", "hold time"); t.has(dpo, "Secrets missing", "health: secrets missing"); t.has(dpo, "DPO_COMPANY_TOKEN, DPO_SERVICE_TYPE", "names (not values) of missing secrets");
  t.has(await prov(page, "orange_money").innerText(), "No adapter", "gateway without a connector says so");
  t.has(await prov(page, "mascom_myzaka").innerText(), "buyers have 24 h to pay", "24h");
  t.eq(await page.locator("#ap-health").isVisible(), true, "health banner shown");
  t.has(await text(page, "#ap-health"), "dpo", "banner names the gateway");
});

test("admin-payments: health check unreachable -> says so, does not claim anything about secrets", async (t) => {
  const page = await open(t, "/admin-payments.html", { user: U.admin, scen: { edgeDown: true } });
  t.allowErrors(/payment/i);
  await loaded(page);
  t.has(await text(page, "#ap-health"), "Couldn't check which gateway secrets are set", "banner");
  t.has(await prov(page, "dpo").innerText(), "Couldn't check this gateway's secrets just now", "per-gateway text");
  t.eq((await prov(page, "dpo").innerText()).includes("Secrets set"), false, "never claims 'Secrets set' without evidence");
});

test("admin-payments: switch a method off and on (confirm dialog, real RPC)", async (t) => {
  const page = await open(t, "/admin-payments.html", { user: U.admin });
  await loaded(page);
  await prov(page, "mascom_myzaka").locator("button[data-act=toggle]").click();
  await page.waitForSelector("#ap-modal");
  t.has(await text(page, "#ap-modal"), "Switch off MyZaka (Mascom)?", "dialog title");
  await dlgOk(page).click();
  await page.waitForSelector("#ap-modal", { state: "detached" });
  t.has(await flash(page), "MyZaka (Mascom) is now off", "flash");
  t.eq((await dbOf(page)).payment_providers.find((p) => p.slug === "mascom_myzaka").enabled, false, "switched off in the database");
  t.has(await prov(page, "mascom_myzaka").innerText(), "Switch on", "button now says Switch on");
  await prov(page, "mascom_myzaka").locator("button[data-act=toggle]").click();
  await page.waitForSelector("#ap-modal");
  t.has(await text(page, "#ap-modal"), "Sandbox (test) mode", "warns about sandbox when switching on");
  await dlgOk(page).click();
  await page.waitForSelector("#ap-modal", { state: "detached" });
  t.eq((await dbOf(page)).payment_providers.find((p) => p.slug === "mascom_myzaka").enabled, true, "switched back on");
});

test("admin-payments: cannot switch on a manual method with no instructions, or a gateway that isn't set up", async (t) => {
  const page = await open(t, "/admin-payments.html", { user: U.admin });
  await loaded(page);
  await prov(page, "bank_eft").locator("button[data-act=toggle]").click();
  t.has(await flash(page), "Add the payment instructions", "manual without instructions refused");
  t.eq(await page.locator("#ap-bank_eft-instructions").count(), 1, "its settings panel opens so the admin can fix it");
  t.eq(await page.locator("#ap-modal").count(), 0, "no confirm dialog");
  await prov(page, "orange_money").locator("button[data-act=toggle]").click();
  t.has(await flash(page), "Set the status to Sandbox or Live", "not-onboarded gateway refused");
  t.eq((await dbOf(page)).payment_providers.filter((p) => p.enabled).map((p) => p.slug).sort(), ["dpo", "mascom_myzaka"], "nothing got switched on");
});

test("admin-payments: a gateway with missing secrets cannot be switched on from the page", async (t) => {
  const db = world(); db.payment_providers.find((p) => p.slug === "dpo").enabled = false;
  const page = await open(t, "/admin-payments.html", { user: U.admin, db });
  await loaded(page);
  await prov(page, "dpo").locator("button[data-act=toggle]").click();
  t.has(await flash(page), "can't be switched on yet: missing secrets DPO_COMPANY_TOKEN, DPO_SERVICE_TYPE", "names the missing secrets");
  t.eq(await page.locator("#ap-modal").count(), 0, "no dialog offered");
  const ok = await open(t, "/admin-payments.html", { user: U.admin, db: (() => { const d = world(); d.payment_providers.find((p) => p.slug === "dpo").enabled = false; return d; })(), scen: { health: [{ slug: "dpo", configured: true, missing: [] }] } });
  await loaded(ok);
  await prov(ok, "dpo").locator("button[data-act=toggle]").click();
  await ok.waitForSelector("#ap-modal");
  t.has(await text(ok, "#ap-modal"), "Switch on DPO Pay?", "with all secrets present the dialog is offered");
});

test("admin-payments: edit and save settings; validation errors are shown inline and nothing is sent", async (t) => {
  const page = await open(t, "/admin-payments.html", { user: U.admin });
  await loaded(page);
  await prov(page, "bank_eft").locator("button[data-act=edit]").click();
  const id = (k) => "#ap-bank_eft-" + k;
  await page.fill(id("display_name"), "x"); await prov(page, "bank_eft").locator("button[data-act=save]").click();
  t.has(await text(page, id("err")), "Enter a name", "short name");
  await page.fill(id("display_name"), "Bank transfer (EFT)"); await page.fill(id("hold_minutes"), "10");
  await prov(page, "bank_eft").locator("button[data-act=save]").click();
  t.has(await text(page, id("err")), "between 15 and 10080", "hold time out of range");
  await page.fill(id("hold_minutes"), "2880"); await page.fill(id("sort_order"), "1.5");
  await prov(page, "bank_eft").locator("button[data-act=save]").click();
  t.has(await text(page, id("err")), "whole number", "sort order not an integer");
  t.eq((await dbOf(page)).payment_providers.find((p) => p.slug === "bank_eft").status, "not_onboarded", "database untouched by invalid saves");
  await page.fill(id("sort_order"), "30"); await page.fill(id("instructions"), "Pay into FNB 62000000 and quote your PAY- reference.");
  await page.selectOption(id("status"), "sandbox");
  await prov(page, "bank_eft").locator("button[data-act=save]").click();
  await page.waitForFunction(() => document.getElementById("ap-flash").textContent.includes("saved"));
  const p = (await dbOf(page)).payment_providers.find((x) => x.slug === "bank_eft");
  t.eq([p.status, p.config.instructions, p.config.bank, p.config.branch_code], ["sandbox", "Pay into FNB 62000000 and quote your PAY- reference.", "FNB", "280"], "saved: mode, instructions; bank + branch kept");
  t.eq(await page.locator("#ap-bank_eft-instructions").count(), 0, "settings panel closes after saving");
  await prov(page, "bank_eft").locator("button[data-act=toggle]").click();   // now allowed
  await page.waitForSelector("#ap-modal");
  t.has(await text(page, "#ap-modal"), "Switch on Bank transfer (EFT)?", "can now be switched on");
});

test("admin-payments: add a manual method — validation, success, duplicate", async (t) => {
  const page = await open(t, "/admin-payments.html", { user: U.admin });
  await loaded(page);
  const submit = () => page.click("#ap-add-btn");
  await page.fill("#ap-add-name", "S"); await page.fill("#ap-add-slug", "ab"); await submit();
  t.has(await text(page, "#ap-add-err"), "Enter the name", "short name refused");
  await page.fill("#ap-add-name", "Smega"); await page.fill("#ap-add-slug", "Bad Slug!"); await submit();
  t.has(await text(page, "#ap-add-err"), "short code can only use", "bad slug refused");
  await page.fill("#ap-add-slug", "dpo"); await submit();
  t.has(await text(page, "#ap-add-err"), "already used", "existing code refused before calling the server");
  await page.fill("#ap-add-slug", "btc_smega"); await submit();
  await prov(page, "btc_smega").waitFor();
  const added = (await dbOf(page)).payment_providers.find((p) => p.slug === "btc_smega");
  t.eq([added.display_name, added.kind, added.enabled, added.status], ["Smega", "manual", false, "not_onboarded"], "created manual, OFF and not set up");
  t.has(await flash(page), "added (switched off)", "flash");
  t.eq(await page.locator("#ap-btc_smega-instructions").count(), 1, "its settings are open ready for instructions");
  t.eq(await page.inputValue("#ap-add-name"), "", "form cleared");
});

test("admin-payments: only admin / super_admin may open the page", async (t) => {
  const w = queueWorld();
  for (const who of [U.buyer, U.seller, U.agent]) {
    const page = await open(t, "/admin-payments.html", { user: who, db: w.db });
    await page.waitForURL((u) => !u.pathname.endsWith("admin-payments.html"), { timeout: 8000 }).catch(() => {});
    t.eq(url(page).pathname.endsWith("admin-payments.html"), false, `${who.role} is sent away`);
    t.eq((await bodyText(page)).includes("MZ-777"), false, `${who.role} never sees queue data`);
  }
  const out = await open(t, "/admin-payments.html", { user: null, db: w.db });
  await out.waitForURL(/login\.html/, { timeout: 8000 }).catch(() => {});
  t.has(url(out).pathname, "login.html", "logged out -> login");
  const sa = await open(t, "/admin-payments.html", { user: U.superAdmin, db: queueWorld().db });
  await loaded(sa);
  t.ok((await sa.locator("#ap-queue [data-group]").count()) === 3, "super_admin sees the queue");
});

test("admin-payments: queue failing still shows the methods; both failing shows the fatal message", async (t) => {
  t.allowErrors(/queue load failed|provider load failed/);
  const a = await open(t, "/admin-payments.html", { user: U.admin, scen: { queueDown: true } });
  await loaded(a);
  t.has(await text(a, "#ap-queue"), "Couldn't load the payment queue", "queue error banner");
  t.eq(await a.locator("#ap-providers [data-provider]").count(), 4, "methods still listed");
  const b = await open(t, "/admin-payments.html", { user: U.admin, scen: { queueDown: true, providersDown: true } });
  await b.waitForSelector("#ap-fatal:not(.ap-hidden)");
  t.has(await text(b, "#ap-fatal"), "couldn't load payments", "fatal message");
  t.eq(await b.locator("#ap-main").isVisible(), false, "no half-built page");
});

test("admin-payments: hostile text from buyers / providers is escaped", async (t) => {
  const w = queueWorld();
  w.db.profiles.find((p) => p.id === U.buyer.id).email = '<img id=pwn src=x onerror="window.__xss=1">@x.bw';
  w.gAwait.payer_reference = '<b id=pwn2>ref</b>';
  w.db.payment_providers.find((p) => p.slug === "bank_eft").display_name = '<i id=pwn3>Bank</i>';
  const page = await open(t, "/admin-payments.html", { user: U.admin, db: w.db });
  await loaded(page); await settle(page);
  t.eq(await page.evaluate(() => window.__xss), undefined, "no script ran");
  t.eq(await page.locator("#pwn, #pwn2, #pwn3").count(), 0, "no injected elements");
});
