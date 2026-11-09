import { test, open, url, text, settle } from "../run.mjs";
import { U, world } from "../fixtures.mjs";

test("thb-wallet: logged-out visitor is sent to log in and brought back; signed-in buyer sees the wallet", async (t) => {
  const out = await open(t, "/thb-wallet.html", { user: null, db: world() });
  await out.waitForURL(/login\.html/);
  t.eq(url(out).searchParams.get("redirect"), "thb-wallet.html", "redirect param brings them back");
  const inn = await open(t, "/thb-wallet.html", { user: U.buyer, db: world() });
  await inn.waitForSelector("#walletTHBBalance"); await settle(inn, 800);
  t.eq(url(inn).pathname, "/thb-wallet.html", "stays on the wallet");
  t.eq(await text(inn, "#walletTHBBalance"), "0.0", "balance rendered");
});
