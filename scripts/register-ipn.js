/**
 * Run this ONCE after your backend is deployed and reachable at BACKEND_URL:
 *   npm run register-ipn
 *
 * It registers your /api/pesapal/ipn endpoint with PesaPal and prints the
 * ipn_id you need to paste into PESAPAL_IPN_ID (then redeploy).
 */
require("dotenv").config();
const pesapal = require("../src/pesapal");

(async () => {
  const backendUrl = process.env.BACKEND_URL;
  if (!backendUrl) {
    console.error("Set BACKEND_URL in your .env first (your Render URL).");
    process.exit(1);
  }

  const ipnUrl = `${backendUrl}/api/pesapal/ipn`;
  console.log(`Registering IPN URL: ${ipnUrl}`);

  try {
    const result = await pesapal.registerIPN(ipnUrl);
    console.log("\nSuccess! PesaPal returned:");
    console.log(result);
    console.log(`\n→ Copy this into PESAPAL_IPN_ID: ${result.ipn_id}\n`);
  } catch (err) {
    console.error("Failed to register IPN:", err.message);
    process.exit(1);
  }
})();
