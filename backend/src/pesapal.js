/**
 * Minimal PesaPal API v3 client.
 * Docs: https://developer.pesapal.com/how-to-integrate/e-commerce/api-30-json/api-reference
 *
 * Flow used by this backend:
 *   1. getAuthToken()      -> bearer token (cached, expires ~5 min)
 *   2. registerIPN()       -> run once via `npm run register-ipn`, gives PESAPAL_IPN_ID
 *   3. submitOrder()       -> creates a checkout order, returns redirect_url
 *   4. getTransactionStatus() -> called from the IPN handler and the callback route
 */

const BASE_URL =
  process.env.PESAPAL_ENV === "live"
    ? "https://pay.pesapal.com/v3"
    : "https://cybqa.pesapal.com/pesapalv3";

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getAuthToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  const res = await fetch(`${BASE_URL}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      consumer_key: process.env.PESAPAL_CONSUMER_KEY,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.token) {
    throw new Error(`PesaPal auth failed: ${data.message || res.statusText}`);
  }

  cachedToken = data.token;
  // PesaPal tokens are valid ~5 minutes; refresh a bit early to be safe
  cachedTokenExpiresAt = Date.now() + 4 * 60 * 1000;
  return cachedToken;
}

async function registerIPN(ipnUrl) {
  const token = await getAuthToken();
  const res = await fetch(`${BASE_URL}/api/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url: ipnUrl, ipn_notification_type: "GET" }),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`PesaPal RegisterIPN failed: ${JSON.stringify(data.error || data)}`);
  }
  return data; // { url, ipn_id, ... }
}

async function submitOrder({
  merchantReference,
  amount,
  description,
  callbackUrl,
  notificationId,
  customerEmail,
  customerPhone,
  firstName,
  lastName,
}) {
  const token = await getAuthToken();
  const res = await fetch(`${BASE_URL}/api/Transactions/SubmitOrderRequest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      id: merchantReference,
      currency: "KES",
      amount,
      description: description || "BetPro tailoring service",
      callback_url: callbackUrl,
      notification_id: notificationId,
      billing_address: {
        email_address: customerEmail || "customer@betpro.example",
        phone_number: customerPhone,
        first_name: firstName || "Customer",
        last_name: lastName || "",
      },
    }),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`PesaPal SubmitOrderRequest failed: ${JSON.stringify(data.error || data)}`);
  }
  return data; // { order_tracking_id, merchant_reference, redirect_url }
}

async function getTransactionStatus(orderTrackingId) {
  const token = await getAuthToken();
  const res = await fetch(
    `${BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(
      orderTrackingId
    )}`,
    {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    }
  );
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`PesaPal GetTransactionStatus failed: ${JSON.stringify(data.error || data)}`);
  }
  return data;
  // data.payment_status_description: "Completed" | "Failed" | "Invalid" | "Pending"
  // data.confirmation_code, data.payment_method, data.amount, etc.
}

/** Normalizes PesaPal's status text into our own order status. */
function normalizeStatus(pesapalStatusDescription) {
  switch ((pesapalStatusDescription || "").toUpperCase()) {
    case "COMPLETED":
      return "COMPLETED";
    case "FAILED":
      return "FAILED";
    case "INVALID":
      return "INVALID";
    default:
      return "PENDING";
  }
}

module.exports = {
  BASE_URL,
  getAuthToken,
  registerIPN,
  submitOrder,
  getTransactionStatus,
  normalizeStatus,
};
