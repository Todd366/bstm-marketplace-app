// js/pages/upload-product.js
import { supabase } from "../core/supabase-client.js";

function showMsg(msg, type) {
  var el = document.getElementById("upload-status");
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
  el.style.cssText +=
    ";padding:14px;border-radius:12px;font-weight:600;font-size:14px;margin-bottom:16px;" +
    (type === "success"
      ? "background:#DCFCE7;color:#166534;border:1px solid #BBF7D0;"
      : "background:#FEE2E2;color:#991B1B;border:1px solid #FECACA;");
}

async function uploadImages(files, userId) {
  const urls = [];
  for (const file of files) {
    const path = `${userId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: false });

    if (error) {
      console.error("[BSTM Upload] Image upload failed:", error);
      continue; // skip this image, don't fail the whole listing over one photo
    }

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

window.BSTM.ready().then(async function (session) {
  if (!session) {
    window.location.href = "login.html?redirect=upload-product.html";
    return;
  }

  const user = session.user;
  document.querySelectorAll(".seller-name, #seller-name").forEach((el) => {
    el.textContent = user.email.split("@")[0];
  });

  const form = document.getElementById("productForm");
  if (!form) {
    console.warn("[BSTM Upload] #productForm not found on this page");
    return;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const btn = document.getElementById("submit-btn");
    const name = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const category = document.getElementById("category").value;
    const condition = document.getElementById("condition").value;
    const price = parseFloat(document.getElementById("price").value);
    const quantity = parseInt(document.getElementById("quantity").value, 10);
    const location = document.getElementById("location").value.trim();
    const files = window.__bstm_uploadedFiles || [];

    if (!name || !price || price <= 0 || !category || !condition || !quantity) {
      showMsg("Please fill in all required fields.", "error");
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = "Publishing…";
    }

    let imageUrls = [];
    if (files.length > 0) {
      imageUrls = await uploadImages(files, user.id);
    }

    const { data, error } = await supabase
      .from("products")
      .insert({
        name,
        description,
        category,
        condition,
        price,
        quantity,
        location,
        image: imageUrls[0] || null,
        seller_id: user.id,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      console.error("[BSTM Upload] Insert failed:", error);
      showMsg("Failed to list product: " + error.message, "error");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Publish Product";
      }
      return;
    }

    // Extra photos beyond the first go into product_images
    if (imageUrls.length > 1 && data) {
      const extra = imageUrls.slice(1).map((url) => ({
        product_id: data.id,
        seller_id: user.id,
        storage_path: url,
      }));
      await supabase.from("product_images").insert(extra);
    }

    showMsg("✅ Product listed successfully!", "success");
    form.reset();
    if (btn) btn.textContent = "✅ Listed!";

    setTimeout(function () {
      window.location.href = "seller-dashboard.html";
    }, 1500);
  });
});

window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
