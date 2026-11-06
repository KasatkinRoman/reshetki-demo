/*
 * One order with sliding and welded positions: pure calculation, no DOM, inputs are never mutated.
 * order = { mode, positions: [{ kind: "sliding" | "weld", ...fields }], active, delivery, km }
 *
 *   each position → calc-sliding.pricePosition / calc-weld.priceWeldPosition (install at the type's rate)
 *   delivery      → one per order (calc-common.deliveryPrice), 0 for an empty order
 *   total         → Σ position subtotals + delivery, whole roubles
 *   prepay / rest → 70% / 30% of the total, whole roubles
 * Browser: window.CalcOrder, Node: module.exports.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./calc-common.js"), require("./calc-sliding.js"), require("./calc-weld.js"));
  } else {
    root.CalcOrder = factory(root.CalcCommon, root.CalcSliding, root.CalcWeld);
  }
})(typeof self !== "undefined" ? self : this, function (C, S, W) {
  const KINDS = ["sliding", "weld"];
  const PRICERS = {
    sliding: (p, mode) => S.pricePosition(p, mode),
    weld: (p, mode) => W.priceWeldPosition(p, mode),
  };

  const sum = (items, key) => items.reduce((s, it) => s + it[key], 0);

  /** Prices one position by its kind; unknown kinds are rejected loudly instead of priced as zero. */
  function pricePosition(position, mode) {
    const pricer = PRICERS[position && position.kind];
    if (!pricer) throw new Error(`Unknown position kind: ${position && position.kind}`);
    return { kind: position.kind, id: position.id, ...pricer(position, mode) };
  }

  /** Totals of the whole order; works for an empty order (everything is 0). */
  function calcOrder(order) {
    const positions = (order && order.positions) || [];
    const mode = order && order.mode;
    const items = positions.map((p) => pricePosition(p, mode));
    const subtotal = sum(items, "subtotal");
    const delivery = items.length ? C.deliveryPrice(mode, order.delivery, order.km) : 0;
    const total = Math.round(subtotal + delivery);
    const byKind = (kind) => sum(items.filter((it) => it.kind === kind), "install");
    return {
      items,
      pieces: sum(items, "qty"),
      area: sum(items, "area"),
      install: sum(items, "install"),
      installByKind: Object.fromEntries(KINDS.map((k) => [k, byKind(k)])),
      subtotal,
      delivery,
      total,
      ...C.paymentSplit(total),
    };
  }

  return { KINDS, pricePosition, calcOrder };
});
