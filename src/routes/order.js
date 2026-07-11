const express = require("express");
const supabase = require("../supabaseClient");
const pesapal = require("../pesapal");

const router = express.Router();

/**
 * POST /api/pesapal/order
 * Used by BOTH the "M-Pesa" and "PesaPal" buttons on pricing.html.
 * PesaPal's hosted checkout offers M-Pesa STK push as a payment option
 * itself, so there's only one real integration here — `method` is stored
 * purely for your own records.
 */
router.post("/order", async (req, res) => {
  try {
    const { name, phone, serviceDescription, amount, method } = req.body || {};

    if (!name || !phone || !amount) {
      return res.status(400).json({ error: "name, phone and amount are required." });
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number." });
    }

    // 1. Create the order row first so we always have a record, even if
    //    PesaPal's API call fails afterwards.
    const { data: order, error: insertError } = await supabase
      .from("orders")
      .insert({
        customer_name: name,
        customer_phone: phone,
        service_description: serviceDescription || null,
        amount: numericAmount,
        method: method === "mpesa" ? "mpesa" : "pesapal",
        status: "PENDING",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // 2. Ask PesaPal for a hosted checkout redirect URL.
    const [firstName, ...rest] = name.trim().split(/\s+/);
    const pesapalOrder = await pesapal.submitOrder({
      merchantReference: order.id,
      amount: numericAmount,
      description: serviceDescription || "BetPro tailoring service",
      callbackUrl: `${process.env.BACKEND_URL}/api/pesapal/callback`,
      notificationId: process.env.PESAPAL_IPN_ID,
      customerPhone: phone,
      firstName,
      lastName: rest.join(" "),
    });

    // 3. Save the tracking id so the IPN/callback can find this order again.
    const { error: updateError } = await supabase
      .from("orders")
      .update({ pesapal_order_tracking_id: pesapalOrder.order_tracking_id })
      .eq("id", order.id);

    if (updateError) throw updateError;

    return res.json({
      orderTrackingId: pesapalOrder.order_tracking_id,
      redirectUrl: pesapalOrder.redirect_url,
    });
  } catch (err) {
    console.error("[POST /api/pesapal/order]", err);
    return res.status(500).json({ error: "Could not start PesaPal checkout. Please try again." });
  }
});

module.exports = router;
