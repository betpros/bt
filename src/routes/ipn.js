const express = require("express");
const updateOrderStatus = require("../updateOrderStatus");

const router = express.Router();

/**
 * GET /api/pesapal/ipn
 * This is the URL you register with PesaPal (see scripts/register-ipn.js).
 * PesaPal calls it server-to-server whenever a transaction's status changes,
 * with OrderTrackingId / OrderMerchantReference / OrderNotificationType as
 * query params. It expects a specific JSON response shape back.
 */
router.get("/ipn", async (req, res) => {
  const { OrderTrackingId, OrderMerchantReference, OrderNotificationType } = req.query;

  if (!OrderTrackingId) {
    return res.status(400).json({ error: "Missing OrderTrackingId" });
  }

  try {
    await updateOrderStatus(OrderTrackingId);

    return res.json({
      orderNotificationType: OrderNotificationType || "IPNCHANGE",
      orderTrackingId: OrderTrackingId,
      orderMerchantReference: OrderMerchantReference,
      status: 200,
    });
  } catch (err) {
    console.error("[GET /api/pesapal/ipn]", err);
    // Still respond 200 with status 500 payload per PesaPal's expected shape,
    // so PesaPal doesn't hammer retries indefinitely on our bug.
    return res.status(200).json({
      orderNotificationType: OrderNotificationType || "IPNCHANGE",
      orderTrackingId: OrderTrackingId,
      orderMerchantReference: OrderMerchantReference,
      status: 500,
    });
  }
});

module.exports = router;
