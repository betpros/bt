/* BetPro — Pricing & Payment page logic
   -----------------------------------------------------------------------
   This file wires up the on-page UI for M-Pesa (Daraja STK Push) and
   PesaPal Checkout. The fetch() calls below point at placeholder backend
   endpoints — swap them for your real server routes when ready. Never
   call the Safaricom Daraja or PesaPal APIs directly from the browser:
   secrets must stay server-side.
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
     M-Pesa STK Push
     Live: browser -> backend (/api/mpesa/stk-push) -> Daraja API.
     The backend then polls Safaricom's callback and this page polls the
     backend until the customer enters their PIN (or cancels/times out).
     --------------------------------------------------------------------- */
  async function initiateMpesaPayment(payload) {
    if (!LIVE) {
      return new Promise((resolve) =>
        setTimeout(() => resolve({ status: "pending", checkoutRequestId: "ws_CO_DEMO_" + Date.now(), demo: true }), 1200)
      );
    }

    const res = await fetch(`${API_BASE}/api/mpesa/stk-push`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "M-Pesa request failed.");
    return { status: "pending", checkoutRequestId: data.checkoutRequestId };
  }

  async function pollMpesaStatus(checkoutRequestId, onSettled) {
    const started = Date.now();
    const timeoutMs = 60000; // give the customer up to 60s to enter their PIN

    (async function tick() {
      if (Date.now() - started > timeoutMs) {
        onSettled({ status: "TIMEOUT" });
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/api/mpesa/status/${encodeURIComponent(checkoutRequestId)}`);
        const data = await res.json();
        if (data.status === "COMPLETED" || data.status === "FAILED") {
          onSettled(data);
          return;
        }
      } catch (_) {
        /* keep polling — network hiccups shouldn't kill the flow */
      }
      setTimeout(tick, 3000);
    })();
  }

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
      if (state.method === "pesapal") {
        const result = await initiatePesapalPayment(payload);
        if (LIVE && result.redirectUrl) {
          confirmTitle.textContent = "Redirecting to PesaPal…";
          confirmMsg.textContent = "Hold on — we're taking you to PesaPal's secure checkout to finish paying.";
          window.location.href = result.redirectUrl;
          return; // page is navigating away
        }
        showPendingState(payload, result);
      } else {
        const result = await initiateMpesaPayment(payload);
        showPendingState(payload, result);
        if (LIVE && result.checkoutRequestId) {
          pollMpesaStatus(result.checkoutRequestId, (final) => {
            if (final.status === "COMPLETED") {
              confirmStatus.style.display = "none";
              confirmIcon.innerHTML =
                '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
              confirmTitle.textContent = "Payment received";
              confirmMsg.textContent =
                "Thank you, " + payload.name + ". Your M-Pesa payment of " + formatKsh(payload.amount) + " has been confirmed.";
            } else {
              showFailedState();
            }
          });
        }
      }
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
})();
