/*
 * Shared pure helpers for both calculators: delivery and the 70/30 payment split.
 * Works in the browser (window.CalcCommon) and in Node (module.exports) for tests.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./data.js"));
  else root.CalcCommon = factory(root.GrilleData);
})(typeof self !== "undefined" ? self : this, function (D) {
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const byId = (list, id) => list.find((item) => item.id === id);

  /** Delivery options available in the ordering mode (install excludes carrier and pickup). */
  const allowedDelivery = (mode, list = D.DELIVERY) => list.filter((d) => !(mode === "install" && d.noInstall));

  /** Falls back to Moscow delivery when the chosen option is not available in this mode. */
  const validDeliveryId = (mode, deliveryId, list = D.DELIVERY) =>
    (allowedDelivery(mode, list).some((d) => d.id === deliveryId) ? deliveryId : "moscow");

  function deliveryPrice(mode, deliveryId, km, list = D.DELIVERY) {
    const d = byId(list, validDeliveryId(mode, deliveryId, list));
    if (mode === "install" && d.freeWithInstall) return 0;
    return d.price + (d.perKm ? clamp(km || 0, 0, D.MAX_KM) * d.perKm : 0);
  }

  /** Splits the total into the online prepayment and the rest, in whole roubles. */
  function paymentSplit(total) {
    const prepay = Math.round(total * D.PRICING.prepayShare);
    return { prepay, rest: Math.round(total) - prepay };
  }

  return { clamp, byId, allowedDelivery, validDeliveryId, deliveryPrice, paymentSplit };
});
