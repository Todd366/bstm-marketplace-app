function renderSafeFallback() {
  const root = document.getElementById("bstm-page");

  if (!root) {
    document.body.innerHTML = "<h2>Critical error: missing app root</h2>";
    return;
  }

  root.innerHTML = `
    <div style="padding:20px;font-family:Arial">
      <h2>🏪 BSTM Marketplace</h2>
      <p>System is running (safe mode)</p>

      <button onclick="location.href='marketplace.html'">
        Enter Marketplace
      </button>

      <button onclick="location.href='login.html'">
        Login
      </button>
    </div>
  `;
}

function boot() {
  try {
    console.log("[BSTM] boot start");

    const page = location.pathname.split("/").pop();

    const root = document.getElementById("bstm-page");

    if (!root) {
      renderSafeFallback();
      return;
    }

    if (page === "marketplace.html") {
      // try marketplace module safely
      import("./pages/marketplace.js")
        .then(m => m.initMarketplace?.())
        .catch(err => {
          console.error("[BSTM marketplace error]", err);
          root.innerHTML = "<p>Marketplace failed to load</p>";
        });
      return;
    }

    renderSafeFallback();

  } catch (err) {
    console.error("[BSTM CRASH]", err);
    document.body.innerHTML = `
      <h2 style="color:red">App crashed safely recovered</h2>
      <pre>${err.message}</pre>
    `;
  }
}

document.addEventListener("DOMContentLoaded", boot);
