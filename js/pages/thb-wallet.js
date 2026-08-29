// js/pages/thb-wallet.js
import { supabase } from "../core/supabase-client.js";

let currentUserId = null;
let currentBalance = 0;

function labelForEntry(entry) {
  const map = {
    order: "Purchase Reward",
    transfer: entry.type === "credit" ? "Received from a friend" : "Sent to a friend",
    withdrawal: "Withdrawal to bank/mobile money",
    adjustment: "Balance adjustment",
  };
  return map[entry.reference_type] || (entry.type === "credit" ? "Credit" : "Debit");
}

async function refreshBalance() {
  const { data: profile } = await supabase
    .from("profiles")
    .select("thb_balance")
    .eq("id", currentUserId)
    .single();

  currentBalance = profile?.thb_balance || 0;

  const el = (id) => document.getElementById(id);
  if (el("walletTHBBalance")) el("walletTHBBalance").textContent = currentBalance.toFixed(1);
  if (el("walletBWPEquivalent")) el("walletBWPEquivalent").textContent = (currentBalance / 10).toFixed(2);
  if (el("availableTHB")) el("availableTHB").textContent = currentBalance.toFixed(1);
}

async function loadTransactions() {
  const { data: entries, error } = await supabase
    .from("wallet_ledger")
    .select("*")
    .eq("user_id", currentUserId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[BSTM Wallet] Failed to load ledger:", error);
    return;
  }

  const rows = entries || [];
  const el = (id) => document.getElementById(id);

  // Monthly / lifetime earned, computed from real ledger credits
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const credits = rows.filter((r) => r.type === "credit");
  const debits = rows.filter((r) => r.type === "debit");

  const lifetimeEarned = credits.reduce((sum, r) => sum + r.amount_thb, 0);
  const monthlyEarned = credits
    .filter((r) => new Date(r.created_at) >= monthStart)
    .reduce((sum, r) => sum + r.amount_thb, 0);
  const monthlySpent = debits
    .filter((r) => new Date(r.created_at) >= monthStart)
    .reduce((sum, r) => sum + r.amount_thb, 0);

  if (el("monthlyEarned")) el("monthlyEarned").textContent = monthlyEarned.toFixed(1);
  if (el("monthlySpent")) el("monthlySpent").textContent = monthlySpent.toFixed(1);
  if (el("lifetimeEarned")) el("lifetimeEarned").textContent = lifetimeEarned.toFixed(1);

  const listEl = el("transactionsList");
  if (!listEl) return;

  if (rows.length === 0) {
    listEl.innerHTML =
      '<p class="text-center text-gray-500 py-12">No transactions yet. Start earning THB!</p>';
    return;
  }

  listEl.innerHTML = rows
    .map((entry) => {
      const isCredit = entry.type === "credit";
      const date = new Date(entry.created_at).toLocaleString("en-BW", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      return `
      <div class="flex items-center justify-between p-4 ${isCredit ? "bg-green-50" : "bg-red-50"} rounded-xl">
        <div class="flex items-center space-x-4">
          <div class="w-12 h-12 ${isCredit ? "bg-green-500" : "bg-red-500"} rounded-full flex items-center justify-center">
            <i class="fas ${isCredit ? "fa-arrow-down" : "fa-arrow-up"} text-white"></i>
          </div>
          <div>
            <p class="font-semibold text-gray-800">${labelForEntry(entry)}</p>
            <p class="text-xs text-gray-500">${date}</p>
          </div>
        </div>
        <span class="${isCredit ? "text-green-600" : "text-red-600"} font-bold text-xl">
          ${isCredit ? "+" : "-"}${entry.amount_thb} THB
        </span>
      </div>`;
    })
    .join("");
}

window.BSTM.ready().then(async function (session) {
  const wall = document.getElementById("auth-wall");
  const content = document.getElementById("wallet-content");

  if (!session) {
    if (wall) wall.style.display = "flex";
    if (content) content.style.display = "none";
    return;
  }

  if (wall) wall.style.display = "none";
  if (content) content.style.display = "block";

  currentUserId = session.user.id;
  const email = session.user.email;
  const name = session.user.user_metadata?.full_name || email.split("@")[0];

  document.querySelectorAll(".wallet-user-name").forEach((el) => (el.textContent = name));
  document.querySelectorAll(".wallet-user-email").forEach((el) => (el.textContent = email));

  const uid = session.user.id.replace(/-/g, "");

  await refreshBalance();
  await loadTransactions();

  const { count: orderCount } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("buyer_id", currentUserId);
  const orderCountEl = document.getElementById("order-count");
  if (orderCountEl && typeof orderCount === "number") orderCountEl.textContent = orderCount;

  await initWalletConnect(session.user.id);
});

// ---------- MetaMask Connect (Stage 1: identity link only, no token movement) ----------

async function initWalletConnect(userId) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("wallet_address")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.wallet_address) {
    showConnectedState(profile.wallet_address);
  }

  const connectBtn = document.getElementById("connect-wallet-btn");
  const disconnectBtn = document.getElementById("disconnect-wallet-btn");
  const errEl = document.getElementById("wallet-connect-error");

  if (connectBtn) {
    connectBtn.addEventListener("click", async () => {
      errEl?.classList.add("hidden");

      if (!window.ethereum) {
        if (errEl) {
          errEl.textContent =
            "No wallet found. Open this page inside the MetaMask app's browser, or install the MetaMask extension on desktop.";
          errEl.classList.remove("hidden");
        }
        return;
      }

      connectBtn.disabled = true;
      connectBtn.textContent = "Connecting…";

      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        const address = accounts[0];

        const { error } = await supabase
          .from("profiles")
          .update({ wallet_address: address })
          .eq("id", userId);

        if (error) throw error;

        showConnectedState(address);
      } catch (err) {
        console.error("[BSTM Wallet] Connect failed:", err);
        if (errEl) {
          errEl.textContent =
            err.code === 4001 ? "Connection request was rejected." : "Couldn't connect wallet. Please try again.";
          errEl.classList.remove("hidden");
        }
      } finally {
        connectBtn.disabled = false;
        connectBtn.textContent = "Connect MetaMask";
      }
    });
  }

  if (disconnectBtn) {
    disconnectBtn.addEventListener("click", async () => {
      await supabase.from("profiles").update({ wallet_address: null }).eq("id", userId);
      document.getElementById("wallet-connected").classList.add("hidden");
      document.getElementById("wallet-not-connected").classList.remove("hidden");
    });
  }
}

function showConnectedState(address) {
  const short = address.slice(0, 6) + "..." + address.slice(-4);
  const addrEl = document.getElementById("connected-wallet-address");
  if (addrEl) {
    addrEl.innerHTML = `<i class="fas fa-check-circle text-green-400 mr-2"></i>${short}`;
  }
  document.getElementById("wallet-not-connected")?.classList.add("hidden");
  document.getElementById("wallet-connected")?.classList.remove("hidden");
}

// --- Send THB (real transfer between two users, by email) ---
window.sendTHB = async function (e) {
  e.preventDefault();
  const recipientEmail = document.getElementById("recipientAddress").value.trim();
  const amount = Math.round(parseFloat(document.getElementById("sendAmount").value));

  if (!amount || amount <= 0) return alert("Enter a valid amount.");
  if (amount > currentBalance) return alert("Insufficient balance.");

  const { error } = await supabase.rpc("transfer_thb", {
    recipient_email: recipientEmail,
    amount: amount,
  });

  if (error) {
    console.error("[BSTM Wallet] Send failed:", error);
    alert("Transfer failed: " + error.message);
    return;
  }

  alert(`${amount} THB sent to ${recipientEmail}!`);
  window.closeSendModal?.();
  await refreshBalance();
  await loadTransactions();
};

// --- Withdraw (records a real pending request — no payout provider connected yet) ---
window.withdrawTHB = async function (e) {
  e.preventDefault();
  const amount = Math.round(parseFloat(document.getElementById("withdrawAmount").value));
  const details = document.getElementById("withdrawDetails")?.value.trim();

  if (!amount || amount <= 0) return alert("Enter a valid amount.");
  if (amount > currentBalance) return alert("Insufficient balance.");
  if (!details) return alert("Enter mobile money number or bank account details.");

  const { error } = await supabase.from("wallet_ledger").insert({
    user_id: currentUserId,
    amount_thb: amount,
    type: "debit",
    reference_type: "withdrawal",
    meta: { payout_details: details, status: "pending_manual_review" },
  });

  if (error) {
    console.error("[BSTM Wallet] Withdrawal failed:", error);
    alert("Withdrawal request failed: " + error.message);
    return;
  }

  alert(
    `Withdrawal request recorded for P${(amount / 10).toFixed(2)} BWP.\n\n` +
      "BSTM will contact you to confirm payout within 1-2 business days " +
      "(automatic payouts aren't connected yet)."
  );
  window.closeWithdrawModal?.();
  await refreshBalance();
  await loadTransactions();
};

window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
