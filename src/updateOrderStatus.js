const supabase = require("./supabaseClient");
const pesapal = require("./pesapal");

/**
 * Looks up the live status of an order from PesaPal and writes it to Supabase.
 * Used by both the IPN webhook and the browser callback route, since PesaPal
 * doesn't tell us the actual outcome in the callback — we have to ask.
 */
async function updateOrderStatus(orderTrackingId) {
  const statusData = await pesapal.getTransactionStatus(orderTrackingId);
  const status = pesapal.normalizeStatus(statusData.payment_status_description);

  const { data, error } = await supabase
    .from("orders")
    .update({
      status,
      pesapal_confirmation_code: statusData.confirmation_code || null,
      pesapal_payment_method: statusData.payment_method || null,
    })
    .eq("pesapal_order_tracking_id", orderTrackingId)
    .select()
    .single();

  if (error) throw error;
  return { order: data, statusData, status };
}

module.exports = updateOrderStatus;
