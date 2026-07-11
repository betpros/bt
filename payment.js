/* BetPro — Pricing & Payment page logic
   -----------------------------------------------------------------------
   Both the "M-Pesa" and "PesaPal" buttons go through the same PesaPal
   checkout — PesaPal's own hosted page offers M-Pesa STK push as one of
   the payment options, so there's only one real integration here. The
   `method` value is just kept for display/records. Never call the
   PesaPal API directly from the browser: secrets must stay server-side.
   ------------------------------------------------------------------- */
(function () {
  "use strict";

  const form = document.getElementById("payment-form");
  if (!form) return;

  const amountChips = document.querySelectorAll(".amount-chip[data-amount]");
  const customAmountInput = document.getElementById("custom-amount");
  const methodCards = document.querySelectorAll(".pay-method[data-method]");
  const summaryAmount = document.getElementById("summary-amount");
  const summaryMethod = document.getElementById("summary-method");
  const summaryService = document.getElementById("summary-service");
  const hiddenAmount = document.getElementById("selected-amount");
  const hiddenMethod = document.getElementById("selected-method");
  const payButton = document.getElementById("pay-button");

  const overlay = document.getElementById("confirm-overlay");
  const confirmClose = document.getElementById("confirm-close");
  const confirmDetails = document.getElementById("confirm-details-body");
  const confirmStatus = document.getElementById("confirm-status");
  const confirmIcon = document.getElementById("confirm-icon");
  const confirmTitle = document.getElementById("confirm-title");
  const confirmMsg = document.getElementById("confirm-msg");

  let state = { amount: null, method: "mpesa" };

  function formatKsh(n) {
    return "KSh " + Number(n).toLocaleString("en-KE");
  }

  function updateSummary() {
    summaryAmount.textContent = state.amount ? formatKsh(state.amount) : "—";
    summaryMethod.textContent = state.method === "mpesa" ? "M-Pesa" : "PesaPal";
    const serviceField = document.getElementById("service-description");
    summaryService.textContent = serviceField && serviceField.value.trim()
      ? serviceField.value.trim()
      : "General tailoring service";
    hiddenAmount.value = state.amount || "";
    hiddenMethod.value = state.method;
    payButton.disabled = !state.amount;
  }

  amountChips.forEach((chip) => {
    chip.addEventListener("click", () => {
      amountChips.forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      customAmountInput.value = "";
      state.amount = Number(chip.dataset.amount);
      updateSummary();
    });
  });

  if (customAmountInput) {
    customAmountInput.addEventListener("input", () => {
      amountChips.forEach((c) => c.classList.remove("selected"));
      const val = Number(customAmountInput.value);
      state.amount = val > 0 ? val : null;
      updateSummary();
    });
  }

  methodCards.forEach((card) => {
    card.addEventListener("click", () => {
      methodCards.forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      state.method = card.dataset.method;
      updateSummary();
    });
  });

  const serviceField = document.getElementById("service-description");
  if (serviceField) serviceField.addEventListener("input", updateSummary);

  updateSummary();

  const API_BASE = window.BETPRO_API_BASE || null;
  const LIVE = Boolean(API_BASE);

  /* ---------------------------------------------------------------------
     PesaPal Checkout
     Live: browser -> backend (/api/pesapal/order) -> PesaPal, which returns
     a hosted redirect_url. We send the customer there to enter payment
     details; PesaPal redirects back to PESAPAL_CALLBACK_URL afterwards.
     --------------------------------------------------------------------- */
  async function initiatePesapalPayment(payload) {
    if (!LIVE) {
      return new Promise((resolve) =>
        setTimeout(() => resolve({ status: "pending", orderTrackingId: "PESAPAL_DEMO_" + Date.now(), demo: true }), 1200)
      );
    }

    const res = await fetch(`${API_BASE}/api/pesapal/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "PesaPal request failed.");
    return { status: "redirecting", orderTrackingId: data.orderTrackingId, redirectUrl: data.redirectUrl };
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const nameField = document.getElementById("customer-name");
    const phoneField = document.getElementById("customer-phone");
    let valid = true;

    [nameField, phoneField].forEach((input) => {
      const field = input.closest(".field");
      const value = input.value.trim();
      const errorEl = field.querySelector(".field-error");
      if (!value) {
        field.classList.add("invalid");
        if (errorEl) errorEl.textContent = "This field is required.";
        valid = false;
      } else if (input === phoneField) {
        const phoneRe = /^(?:\+254|0)7\d{8}$|^(?:\+254|0)1\d{8}$/;
        if (!phoneRe.test(value.replace(/\s+/g, ""))) {
          field.classList.add("invalid");
          if (errorEl) errorEl.textContent = "Enter a valid Safaricom number, e.g. 07XXXXXXXX.";
          valid = false;
        } else {
          field.classList.remove("invalid");
        }
      } else {
        field.classList.remove("invalid");
      }
    });

    if (!state.amount) valid = false;
    if (!valid) return;

    const payload = {
      name: nameField.value.trim(),
      phone: phoneField.value.trim(),
      serviceDescription: serviceField ? serviceField.value.trim() : "",
      amount: state.amount,
      method: state.method,
    };

    payButton.disabled = true;
    payButton.textContent = "Processing…";

    openConfirmModal(payload, "pending");

    try {
      // Both buttons go through PesaPal's hosted checkout — it offers
      // M-Pesa STK push as a payment option there too, so the customer's
      // choice on this page is just which option is pre-selected for them.
      const result = await initiatePesapalPayment(payload);
      if (LIVE && result.redirectUrl) {
        confirmTitle.textContent =
          state.method === "mpesa" ? "Redirecting to complete your M-Pesa payment…" : "Redirecting to PesaPal…";
        confirmMsg.textContent = "Hold on — we're taking you to a secure checkout page to finish paying.";
        window.location.href = result.redirectUrl;
        return; // page is navigating away
      }
      showPendingState(payload, result);
    } catch (err) {
      showFailedState();
    } finally {
      payButton.disabled = false;
      payButton.textContent = "Pay with " + (state.method === "mpesa" ? "M-Pesa" : "PesaPal");
    }
  });

  function openConfirmModal(payload) {
    confirmDetails.innerHTML = `
      <div class="summary-row"><span>Customer</span><b>${escapeHtml(payload.name)}</b></div>
      <div class="summary-row"><span>Phone</span><b>${escapeHtml(payload.phone)}</b></div>
      <div class="summary-row"><span>Service</span><b>${escapeHtml(payload.serviceDescription || "General tailoring service")}</b></div>
      <div class="summary-row"><span>Amount</span><b>${formatKsh(payload.amount)}</b></div>
      <div class="summary-row"><span>Method</span><b>${payload.method === "mpesa" ? "M-Pesa" : "PesaPal"}</b></div>
    `;
    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
  }

  function showPendingState(payload, result) {
    confirmStatus.innerHTML = `<span class="spinner"></span> Awaiting confirmation`;
    confirmTitle.textContent =
      payload.method === "mpesa" ? "Check your phone" : "Complete payment on PesaPal";
    confirmMsg.textContent =
      payload.method === "mpesa"
        ? "We've sent an M-Pesa STK prompt to " + payload.phone + ". Enter your PIN to complete the payment."
        : "You'll be redirected to PesaPal's secure checkout to complete this payment.";
    confirmIcon.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>';

    /* Demo mode only: simulate a successful confirmation after a short delay.
       In live mode, M-Pesa is confirmed via pollMpesaStatus() and PesaPal
       confirms via the redirect back from their hosted checkout page. */
    if (!LIVE || result?.demo) {
      setTimeout(() => {
        confirmStatus.style.display = "none";
        confirmIcon.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
        confirmTitle.textContent = "Payment received";
        confirmMsg.textContent =
          "Thank you, " + payload.name + ". Your payment of " + formatKsh(payload.amount) + " has been confirmed. We'll be in touch shortly about your order.";
      }, 3200);
    }
  }

  function showFailedState() {
    confirmStatus.style.display = "none";
    confirmIcon.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    confirmTitle.textContent = "Payment could not be completed";
    confirmMsg.textContent = "Something went wrong. Please try again or contact us on WhatsApp for help.";
  }

  if (confirmClose) {
    confirmClose.addEventListener("click", () => {
      overlay.classList.remove("show");
      overlay.setAttribute("aria-hidden", "true");
      confirmStatus.style.display = "flex";
    });
  }
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) confirmClose.click();
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ---------------------------------------------------------------------
     Handle the customer landing back here after PesaPal's hosted checkout.
     Our backend's /api/pesapal/callback verifies the real status with
     PesaPal, then redirects here with ?payment=success|pending|failed|error
     --------------------------------------------------------------------- */
  (function handlePaymentReturn() {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("payment");
    if (!outcome) return;

    overlay.classList.add("show");
    overlay.setAttribute("aria-hidden", "false");
    confirmDetails.innerHTML = "";
    confirmStatus.style.display = "none";

    if (outcome === "success") {
      confirmIcon.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
      confirmTitle.textContent = "Payment received";
      confirmMsg.textContent = "Thank you! Your payment has been confirmed. We'll be in touch shortly about your order.";
    } else if (outcome === "pending") {
      confirmIcon.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>';
      confirmTitle.textContent = "Payment pending";
      confirmMsg.textContent = "We haven't received final confirmation yet. If you completed the payment, we'll update this shortly — feel free to contact us if you're unsure.";
    } else {
      confirmIcon.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
      confirmTitle.textContent = "Payment could not be completed";
      confirmMsg.textContent = "Something went wrong or the payment was cancelled. Please try again or contact us on WhatsApp for help.";
    }

    // Clean the query params out of the URL without reloading the page
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
  })();
})();
