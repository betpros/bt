const express = require("express");
const supabase = require("../supabaseClient");

const router = express.Router();

/**
 * GET /api/pesapal/status/:orderTrackingId
 * Lets the frontend poll for an order's current status straight from
 * Supabase (cheap, no PesaPal call) — handy if you ever want an in-page
 * "waiting for confirmation" spinner instead of relying purely on the
 * redirect flow.
 */
router.get("/status/:orderTrackingId", async (req, res) => {
  const { orderTrackingId } = req.params;
  const { data, error } = await supabase
    .from("orders")
    .select("status, amount, customer_name, pesapal_payment_method")
    .eq("pesapal_order_tracking_id", orderTrackingId)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: "Order not found." });
  }
  return res.json(data);
});

module.exports = router;
