import { test, open, text, bodyText, settle } from "../run.mjs";
import { U, world, iso, id } from "../fixtures.mjs";

test("ecosystem hub: header numbers come from the database, no invented figures or stale links", async (t) => {
  const page = await open(t, "/ecosystem-hub.html", { user: null, db: world() });
  await page.waitForSelector("#hubRooms"); await settle(page, 900);
  t.eq(await text(page, "#hubRooms"), "3", "open rooms = real count (3)");
  t.eq(await text(page, "#hubProducts"), "3", "products listed = real count (3)");
  const body = await bodyText(page);
  t.ok(!body.includes("15,847") && !body.includes("Total Citizens") && !body.includes("Planned Rooms"), "no invented citizens / planned rooms");
  const hrefs = await page.$$eval("a", (as) => as.map((a) => a.getAttribute("href") || ""));
  t.ok(!hrefs.some((h) => h.includes("github.io/bstm-marketplace-app") || h.includes("github.io/CabLink-pwa")), "no stale GitHub Pages links to this app or CabLink");
});

test("thb-wallet: Earn History shows only real ledger credits (no invented transactions, no referrals or staking)", async (t) => {
  const empty = await open(t, "/thb-wallet.html", { user: U.buyer, db: world() });
  await empty.waitForSelector("#walletTHBBalance"); await settle(empty, 900);
  const b0 = await empty.locator("#earnHistoryList").innerText();
  t.ok(b0.includes("No rewards earned yet"), "empty ledger -> honest empty message");
  t.ok(!b0.includes("Fresh Tomatoes") && !b0.includes("CabLink Ride") && !b0.includes("Referral Bonus"), "no hard-coded sample rows");
  const page0 = await bodyText(empty);
  t.ok(!/Staking|Stake THB|Referrals|Refer Friends|Coming soon/i.test(page0), "no staking / referral / coming-soon placeholders");

  const db = world();
  db.wallet_ledger.push({ id: id(900), user_id: U.buyer.id, amount_thb: 2.5, currency: "THB", type: "credit", reference_type: "order", reference_id: id(901), meta: {}, created_at: iso(-30) });
  const real = await open(t, "/thb-wallet.html", { user: U.buyer, db });
  await real.waitForSelector("#walletTHBBalance"); await settle(real, 900);
  const b1 = await real.locator("#earnHistoryList").innerText();
  t.ok(b1.includes("Purchase Reward") && b1.includes("2.5 THB"), "real ledger credit is listed");
});

test("settings, checkout, buyer dashboard and marketplace carry no 'coming soon' placeholders", async (t) => {
  for (const [path, label] of [["/settings.html", "settings"], ["/checkout.html", "checkout"], ["/buyer-dashboard.html", "buyer dashboard"], ["/marketplace.html", "marketplace"]]) {
    const page = await open(t, path, { user: U.buyer, db: world() });
    await settle(page, 900);
    const body = await bodyText(page);
    t.ok(!/coming soon/i.test(body), `${label}: no 'coming soon' text`);
  }
});
