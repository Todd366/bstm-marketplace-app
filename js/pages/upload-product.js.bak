import { supabase } from "../core/supabase-client.js";

window.BSTM.ready().then(async function(session) {
  if (!session) {
    window.location.href = "login.html";
    return;
  }

  var user = session.user;

  // Show seller name wherever it appears
  document.querySelectorAll(".seller-name, #seller-name").forEach(function(el) {
    el.textContent = user.email.split("@")[0];
  });

  var form = document.getElementById("upload-form")
          || document.getElementById("product-form")
          || document.querySelector("form");

  if (!form) {
    console.warn("No product form found on this page");
    return;
  }

  form.addEventListener("submit", async function(e) {
    e.preventDefault();

    var btn = form.querySelector("button[type=submit]") || form.querySelector("button");
    if (btn) { btn.disabled = true; btn.textContent = "Uploading..."; }

    // Read form fields — match IDs used in upload-product.html
    var name  = (document.getElementById("product-name")  || document.getElementById("title"))?.value?.trim();
    var price = parseFloat((document.getElementById("product-price") || document.getElementById("price"))?.value || 0);
    var image = (document.getElementById("product-image") || document.getElementById("image"))?.value?.trim() || null;

    if (!name || !price || price <= 0) {
      showMsg("Please fill in product name and a valid price.", "error");
      if (btn) { btn.disabled = false; btn.textContent = "Upload Product"; }
      return;
    }

    // Insert only columns that exist in the live DB
    var { data, error } = await supabase
      .from("products")
      .insert([{
        name: name,
        price: price,
        image: image,
        seller_id: user.id
      }])
      .select();

    if (error) {
      console.error("Upload error:", error);
      showMsg("Failed to upload: " + error.message, "error");
      if (btn) { btn.disabled = false; btn.textContent = "Upload Product"; }
      return;
    }

    showMsg("✅ Product listed successfully!", "success");
    form.reset();
    if (btn) { btn.textContent = "✅ Listed!"; }

    // Redirect to seller dashboard after 2s
    setTimeout(function() {
      window.location.href = "seller-dashboard.html";
    }, 2000);
  });
});

function showMsg(msg, type) {
  var el = document.getElementById("upload-status") || document.getElementById("status");
  if (!el) {
    el = document.createElement("div");
    el.id = "upload-status";
    document.querySelector("form")?.prepend(el);
  }
  el.textContent = msg;
  el.style.cssText = "padding:12px 16px;border-radius:12px;font-weight:600;font-size:14px;margin-bottom:16px;display:block;" +
    (type === "success"
      ? "background:#DCFCE7;color:#166534;border:1px solid #BBF7D0;"
      : "background:#FEE2E2;color:#991B1B;border:1px solid #FECACA;");
}
