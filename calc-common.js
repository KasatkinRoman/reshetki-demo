/*
 * Shared pure helpers: one delivery for the whole order and the 70/30 payment split.
 * Works in the browser (window.CalcCommon) and in Node (module.exports) for tests.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./data.js"));
  else root.CalcCommon = factory(root.GrilleData);
})(typeof self !== "undefined" ? self : this, function (D) {
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const byId = (list, id) => list.find((item) => item.id === id);
  const DEFAULT_DELIVERY = "moscow";

  /** Delivery options available in the ordering mode (install excludes carrier and pickup). */
  const allowedDelivery = (mode) => D.DELIVERY.filter((d) => !(mode === "install" && d.noInstall));

  /** Falls back to Moscow delivery when the chosen option is not available in this mode. */
  const validDeliveryId = (mode, deliveryId) =>
    (allowedDelivery(mode).some((d) => d.id === deliveryId) ? deliveryId : DEFAULT_DELIVERY);

  /** Price of the single order delivery; perKm is charged for the km beyond the MKAD. */
  function deliveryPrice(mode, deliveryId, km) {
    const d = byId(D.DELIVERY, validDeliveryId(mode, deliveryId));
    return d.price + (d.perKm ? clamp(Number(km) || 0, 0, D.MAX_KM) * d.perKm : 0);
  }

  /** Splits the total into the online prepayment and the rest, in whole roubles. */
  function paymentSplit(total) {
    const whole = Math.round(total);
    const prepay = Math.round(whole * D.PRICING.prepayShare);
    return { prepay, rest: whole - prepay };
  }

  return { clamp, byId, allowedDelivery, validDeliveryId, deliveryPrice, paymentSplit };
});
