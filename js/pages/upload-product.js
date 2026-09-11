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

  const { data: myRoom } = await supabase
    .from("rooms")
    .select("id")
    .eq("seller_id", user.id)
    .maybeSingle();

  if (!myRoom) {
    const form = document.getElementById("productForm");
    if (form) {
      form.innerHTML =
        '<div style="text-align:center;padding:40px 20px;">' +
        '<div style="font-size:48px;margin-bottom:12px;">🏪</div>' +
        '<p style="color:#6B7280;margin-bottom:20px;">You need to open a room before listing products.</p>' +
        '<a href="open-room.html" style="background:linear-gradient(135deg,#7C3AED,#4F46E5);color:#fff;padding:14px 28px;border-radius:14px;font-weight:800;text-decoration:none;">Open My Room →</a></div>';
    }
    return;
  }

  const form = document.getElementById("productForm");
  if (!form) {
    console.warn("[BSTM Upload] #productForm not found on this page");
    return;
  }

  // Toggle condition/quantity for service listings — a haircut or a
  // consulting session doesn't have a "condition" or stock count.
  const conditionField = document.getElementById("condition-field");
  const quantityField = document.getElementById("quantity-field");
  const conditionInput = document.getElementById("condition");
  const quantityInput = document.getElementById("quantity");

  function applyListingType() {
    const isService = document.getElementById("type-service").checked;
    if (conditionField) conditionField.style.display = isService ? "none" : "block";
    if (quantityField) quantityField.style.display = isService ? "none" : "block";
    if (conditionInput) conditionInput.required = !isService;
    if (quantityInput) quantityInput.required = !isService;

    document.querySelectorAll('input[name="productType"]').forEach((r) => {
      const label = r.closest("label");
      if (!label) return;
      if (r.checked) {
        label.classList.add("border-purple-300", "bg-purple-50");
        label.classList.remove("border-gray-300");
      } else {
        label.classList.remove("border-purple-300", "bg-purple-50");
        label.classList.add("border-gray-300");
      }
    });
  }
  document.querySelectorAll('input[name="productType"]').forEach((r) =>
    r.addEventListener("change", applyListingType)
  );
  applyListingType();

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const productType = document.querySelector('input[name="productType"]:checked')?.value || "physical";
    const isService = productType === "service";

    const btn = document.getElementById("submit-btn");
    const name = document.getElementById("title").value.trim();
    const description = document.getElementById("description").value.trim();
    const category = document.getElementById("category").value;
    const condition = isService ? null : document.getElementById("condition").value;
    const price = parseFloat(document.getElementById("price").value);
    const quantity = isService ? 1 : parseInt(document.getElementById("quantity").value, 10);
    const location = document.getElementById("location").value.trim();
    const files = window.__bstm_uploadedFiles || [];

    if (!name || !price || price <= 0 || !category || (!isService && (!condition || !quantity))) {
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
        product_type: productType,
        location,
        image: imageUrls[0] || null,
        seller_id: user.id,
        room_id: myRoom.id,
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
      window.location.href = "room.html?id=" + myRoom.id;
    }, 1500);
  });
});

window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
