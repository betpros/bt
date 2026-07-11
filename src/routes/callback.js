const express = require("express");
const updateOrderStatus = require("../updateOrderStatus");

const router = express.Router();

/**
 * GET /api/pesapal/callback
 * The customer's BROWSER lands here after finishing (or abandoning) PesaPal
 * checkout. We re-check the real status (never trust query params alone),
 * then bounce the customer back to the pricing page with the outcome so the
 * frontend can show a friendly confirmation.
 */
router.get("/callback", async (req, res) => {
  const { OrderTrackingId, OrderMerchantReference } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || "/";

  if (!OrderTrackingId) {
    return res.redirect(`${frontendUrl}/pricing.html?payment=error`);
  }

  try {
    const { status } = await updateOrderStatus(OrderTrackingId);
    const outcome =
      status === "COMPLETED" ? "success" : status === "PENDING" ? "pending" : "failed";
    return res.redirect(
      `${frontendUrl}/pricing.html?payment=${outcome}&ref=${encodeURIComponent(
        OrderMerchantReference || ""
      )}`
    );
  } catch (err) {
    console.error("[GET /api/pesapal/callback]", err);
    return res.redirect(`${frontendUrl}/pricing.html?payment=error`);
  }
});

module.exports = router;
