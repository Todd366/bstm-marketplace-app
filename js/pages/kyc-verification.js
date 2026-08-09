// js/pages/kyc-verification.js
import { supabase } from "../core/supabase-client.js";

async function uploadDoc(file, userId, label) {
  if (!file) return null;
  const path = `${userId}/${label}-${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("kyc-docs").upload(path, file, {
    upsert: false,
  });
  if (error) {
    console.error(`[BSTM KYC] Failed to upload ${label}:`, error);
    return null;
  }
  return path; // private bucket — store the path, not a public URL
}

window.BSTM.ready().then(function (session) {
  if (!session) {
    window.location.href = "login.html?redirect=kyc-verification.html";
    return;
  }

  const user = session.user;

  window.submitKYC = async function () {
    const agreed = document.getElementById("termsAgree").checked;
    if (!agreed) {
      alert("Please agree to the Terms & Conditions");
      return;
    }

    const fullName = document.getElementById("kycFullName").value.trim();
    const dob = document.getElementById("kycDob").value;
    const omang = document.getElementById("kycOmang").value.trim();
    const phone = document.getElementById("kycPhone").value.trim();
    const address = document.getElementById("kycAddress").value.trim();
    const businessType = document.getElementById("kycBusinessType").value;

    if (!fullName || !dob || !omang || !phone || !address || !businessType) {
      alert("Please complete all required fields in Step 1 before submitting.");
      return;
    }

    if (!window.FormValidator.validateOmang(omang)) {
      alert("Omang number must be exactly 9 digits.");
      return;
    }

    if (!window.FormValidator.validatePhone(phone)) {
      alert("Phone number must be a valid Botswana number, e.g. +26771234567.");
      return;
    }

    const submitBtn = document.getElementById("kycSubmitBtn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Submitting…";
    }

    const files = window.__bstm_kycFiles || {};
    const [omangPath, proofPath, businessPath] = await Promise.all([
      uploadDoc(files.omang, user.id, "omang"),
      uploadDoc(files.proof, user.id, "proof-of-address"),
      uploadDoc(files.business, user.id, "business-registration"),
    ]);

    // document_storage_path is a single column — store all three as JSON-ish
    // paths joined, since the schema only has one slot for now.
    const documentPaths = [omangPath, proofPath, businessPath]
      .filter(Boolean)
      .join(",");

    const { error } = await supabase.from("kyc_submissions").upsert(
      {
        user_id: user.id,
        status: "pending",
        full_name: fullName,
        national_id: omang,
        phone: phone,
        country: "Botswana",
        document_storage_path: documentPaths,
      },
      { onConflict: "user_id" }
    );

    if (error) {
      console.error("[BSTM KYC] Submission failed:", error);
      alert("Failed to submit application: " + error.message);
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Application";
      }
      return;
    }

    alert(
      "KYC Application Submitted!\n\nYour application is under review. You'll receive an email within 24-48 hours."
    );
    window.location.href = "seller-dashboard.html";
  };
});

window.logout = function () {
  if (confirm("Logout?")) window.BSTM.logout();
};
