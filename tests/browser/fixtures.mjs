// Test world: users, rooms, products, payment providers. Pure data, no behaviour.
export const iso = (minutes = 0) => new Date(Date.now() + minutes * 60000).toISOString();
export const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const U = {
  buyer: { id: id(1), email: "buyer@test.bw", role: "buyer", phone: "+26771111111" },
  admin: { id: id(2), email: "admin@test.bw", role: "admin", phone: "+26772222222" },
  seller: { id: id(3), email: "seller@test.bw", role: "seller", phone: "+26773333333" },
  seller2: { id: id(4), email: "seller2@test.bw", role: "seller", phone: "+26774444444" },
  agent: { id: id(5), email: "agent@test.bw", role: "agent", phone: null },
  superAdmin: { id: id(6), email: "super@test.bw", role: "super_admin", phone: null },
  buyer2: { id: id(7), email: "buyer2@test.bw", role: "buyer", phone: null },
  seller3: { id: id(8), email: "seller3@test.bw", role: "seller", phone: null },
};

export const R = { r1: id(101), r2: id(102), r3: id(103) };
export const P = { p1: id(201), p2: id(202), p3: id(203) };

export function sessionFor(user) {
  return { access_token: "test-token-" + user.id.slice(-4), user: { id: user.id, email: user.email, user_metadata: {} } };
}

export function providers() {
  return [
    { slug: "dpo", display_name: "DPO Pay", kind: "gateway", status: "sandbox", enabled: true, sort_order: 10, description: "Card and mobile money", config: {}, requires_secrets: ["DPO_COMPANY_TOKEN"], hold_minutes: 120, created_at: iso(-9000), updated_at: iso(-9000) },
    { slug: "mascom_myzaka", display_name: "MyZaka (Mascom)", kind: "manual", status: "sandbox", enabled: true, sort_order: 20, description: "Pay from your MyZaka wallet", config: { instructions: "Send the amount to the MyZaka number below, then send us your reference.", account_label: "MyZaka number", account: "71234567", ussd: "*444#" }, requires_secrets: [], hold_minutes: 1440, created_at: iso(-9000), updated_at: iso(-9000) },
    { slug: "bank_eft", display_name: "Bank transfer (EFT)", kind: "manual", status: "not_onboarded", enabled: false, sort_order: 30, description: "Pay by bank transfer", config: { instructions: "", bank: "FNB", branch_code: "280", account: "62000000" }, requires_secrets: [], hold_minutes: 2880, created_at: iso(-9000), updated_at: iso(-9000) },
    { slug: "orange_money", display_name: "Orange Money", kind: "gateway", status: "not_onboarded", enabled: false, sort_order: 40, description: "Orange Money wallet", config: {}, requires_secrets: ["ORANGE_CLIENT_ID"], hold_minutes: 120, created_at: iso(-9000), updated_at: iso(-9000) },
  ];
}

export function world({ providersOff = false } = {}) {
  const prov = providers();
  if (providersOff) prov.forEach((p) => (p.enabled = false));
  const profiles = Object.values(U).map((u) => ({ ...u, thb_balance: 0, created_at: iso(-20000), location: null, notification_prefs: null, wallet_address: null }));
  return {
    profiles,
    rooms: [
      { id: R.r1, seller_id: U.seller.id, room_number: 1, name: "Room One", description: "", category: null, banner_emoji: "🏬", banner_color: "#7C3AED", status: "active", created_at: iso(-9000) },
      { id: R.r2, seller_id: U.seller2.id, room_number: 2, name: "Room Two", description: "", category: null, banner_emoji: "🏬", banner_color: "#7C3AED", status: "active", created_at: iso(-9000) },
      { id: R.r3, seller_id: U.seller3.id, room_number: 3, name: "Room Three", description: "", category: null, banner_emoji: "🏬", banner_color: "#7C3AED", status: "active", created_at: iso(-9000) },
    ],
    products: [
      { id: P.p1, name: "Alpha Mug", price: 100, image: null, seller_id: U.seller.id, created_at: iso(-8000), description: "", category: null, condition: "new", quantity: 10, location: "Gaborone", status: "active", room_id: R.r1, product_type: "physical", shelf: null },
      { id: P.p2, name: "Beta Lamp", price: 50.5, image: null, seller_id: U.seller2.id, created_at: iso(-8000), description: "", category: null, condition: "new", quantity: 5, location: "Gaborone", status: "active", room_id: R.r2, product_type: "physical", shelf: null },
      { id: P.p3, name: "Gamma Chair", price: 33.33, image: null, seller_id: U.seller3.id, created_at: iso(-8000), description: "", category: null, condition: "new", quantity: 5, location: "Gaborone", status: "active", room_id: R.r3, product_type: "physical", shelf: null },
    ],
    payment_providers: prov,
    orders: [], order_items: [], payment_groups: [], payment_transactions: [], delivery_requests: [], wallet_ledger: [],
    room_roles: [], user_roles: [], roles: [], notifications: [], categories: [], events: [], admin_audit_log: [], kyc_submissions: [],
  };
}

export const cartItem = (p, room, seller, qty = 1) => ({ id: p.id, name: p.name, price: p.price, qty, room_id: room, room_name: "Room", seller_id: seller, product_type: "physical", image: null });
export const CART = {
  one: [cartItem({ id: P.p1, name: "Alpha Mug", price: 100 }, R.r1, U.seller.id, 1)],
  two: [cartItem({ id: P.p1, name: "Alpha Mug", price: 100 }, R.r1, U.seller.id, 1), cartItem({ id: P.p2, name: "Beta Lamp", price: 50.5 }, R.r2, U.seller2.id, 2)],
  three: [cartItem({ id: P.p1, name: "Alpha Mug", price: 100 }, R.r1, U.seller.id, 1), cartItem({ id: P.p2, name: "Beta Lamp", price: 50.5 }, R.r2, U.seller2.id, 1), cartItem({ id: P.p3, name: "Gamma Chair", price: 33.33 }, R.r3, U.seller3.id, 1)],
};

// An online order (+ optional payment group) for status-page / dashboard scenarios.
let seq = 1000;
export function onlineOrder(db, { buyer = U.buyer, seller = U.seller, room = R.r1, provider = "dpo", status = "pending", pay = "pending", amount = 100, group = null, delivery = "cablink", dueIn = 90, withRequest = true } = {}) {
  const oid = id(++seq);
  db.orders.push({ id: oid, buyer_id: buyer.id, product_id: P.p1, status, created_at: iso(-10), total_amount: amount, delivery_name: "Test Buyer", delivery_phone: "+26771111111", delivery_address: "Plot 1", delivery_city: "Gaborone", delivery_notes: null, delivery_method: delivery, payment_method: provider, room_id: room, seller_id: seller.id, payment_status: pay, payment_group_id: group ? group.id : null, payment_due_at: iso(dueIn) });
  db.order_items.push({ id: id(++seq), order_id: oid, product_id: P.p1, product_name: "Alpha Mug", quantity: 1, unit_price: amount, created_at: iso(-10) });
  if (withRequest && delivery === "cablink") db.delivery_requests.push({ id: id(++seq), order_id: oid, buyer_id: buyer.id, pickup_room_id: room, dropoff_address: "Plot 1", dropoff_city: "Gaborone", dropoff_phone: "+26771111111", status: "pending", cablink_ride_id: null, requested_at: iso(-10), updated_at: iso(-10) });
  return db.orders[db.orders.length - 1];
}

export function groupFor(db, { buyer = U.buyer, provider = "dpo", status = "pending", orders = [], reference = null, reason = null, expiresIn = 90 } = {}) {
  const gid = id(++seq);
  const p = db.payment_providers.find((x) => x.slug === provider);
  const amount = Math.round(orders.reduce((s, o) => s + Number(o.total_amount), 0) * 100) / 100;
  const g = { id: gid, buyer_id: buyer.id, provider, amount, currency_code: "BWP", status, idempotency_key: "k-" + gid, provider_reference: null, checkout_url: p.kind === "gateway" && status === "pending" ? "https://pay.test/checkout/" + gid : null, payer_reference: reference, provider_status: null, failure_reason: reason, expires_at: iso(expiresIn), completed_at: null, confirmed_by: null, metadata: {}, created_at: iso(-12), updated_at: iso(-12) };
  db.payment_groups.push(g);
  orders.forEach((o) => { o.payment_group_id = gid; db.payment_transactions.push({ id: id(++seq), order_id: o.id, provider, idempotency_key: "t-" + o.id, provider_reference: null, status: "pending", amount: Number(o.total_amount), currency_code: "BWP", created_at: iso(-12), completed_at: null, wallet_user_id: null, group_id: gid, failure_reason: null, provider_status: null, metadata: {}, updated_at: iso(-12) }); });
  return g;
}
