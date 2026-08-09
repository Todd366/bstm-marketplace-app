// js/core/cart.js
// ============================================
// BSTM CART (REAL IMPLEMENTATION)
// Single source of truth for the shopping cart.
// Replaces the no-op addToCart() that was silently
// swallowed by the safe-runtime-bridge fallback.
// ============================================

const CART_KEY = "bstm_cart";

function readCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch (e) {
    return [];
  }
}

function writeCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  window.dispatchEvent(
    new CustomEvent("bstm:cartUpdated", { detail: { cart } })
  );
}

export function getCart() {
  return readCart();
}

export function getCartCount() {
  return readCart().reduce((sum, item) => sum + item.qty, 0);
}

export function getCartTotal() {
  return readCart().reduce((sum, item) => sum + item.price * item.qty, 0);
}

/**
 * Add an item to the cart.
 * @param {{id: string, name: string, price: number, image?: string, qty?: number}} item
 */
export function addToCart(item) {
  if (!item || !item.id || !item.name || typeof item.price !== "number") {
    console.error("[BSTM Cart] Invalid item passed to addToCart:", item);
    return null;
  }

  const cart = readCart();
  const existing = cart.find((i) => i.id === item.id);

  if (existing) {
    existing.qty += item.qty || 1;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      image: item.image || "",
      qty: item.qty || 1,
    });
  }

  writeCart(cart);
  return cart;
}

export function removeFromCart(id) {
  const cart = readCart().filter((i) => i.id !== id);
  writeCart(cart);
  return cart;
}

export function updateQty(id, qty) {
  const cart = readCart();
  const item = cart.find((i) => i.id === id);
  if (!item) return cart;

  if (qty <= 0) {
    return removeFromCart(id);
  }

  item.qty = qty;
  writeCart(cart);
  return cart;
}

export function clearCart() {
  writeCart([]);
}

// Wire up window.addToCart globally so existing onclick="addToCart(...)"
// handlers in HTML keep working without editing every button by hand.
// Pages call this with a plain object built from data-* attributes.
window.addToCart = function (item) {
  addToCart(item);
  const count = getCartCount();

  // Lightweight toast — no dependency on toast-notifications.js internals
  const toast = document.createElement("div");
  toast.textContent = `Added to cart (${count} item${count === 1 ? "" : "s"})`;
  toast.style.cssText =
    "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);" +
    "background:#1E1B4B;color:#fff;padding:12px 20px;border-radius:12px;" +
    "font-weight:600;font-size:14px;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,0.2);";
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
};

window.getCartCount = getCartCount;
