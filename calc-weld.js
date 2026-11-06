/*
 * Welded grilles: pure pricing functions (no DOM, inputs are never mutated).
 * All prices come from WELD in data.js (owner's prices). Delivery is one per order (calc-order.js).
 *
 * Per opening:
 *   area     = max(minAreaM2, w × h)
 *   frame    = area × base ₽/m²
 *   pattern  = area × pattern ₽/m²
 *   opening  = flat price for the sash opening (0 for blind, 4 000 per sash, hatch counts as one)
 *   topUp    = up to the minimum product price
 *   product  = frame + pattern + opening + topUp
 *   paint    = area × paint ₽/m²
 *   hardware = lock + eyelets (only for types with a sash)
 *   install  = area × installPerM2 (fixed rate, not a percentage)
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./data.js"), require("./calc-common.js"));
  else root.CalcWeld = factory(root.GrilleData, root.CalcCommon);
})(typeof self !== "undefined" ? self : this, function (D, C) {
  const { clamp, byId } = C;
  const W = D.WELD;
  const MM_IN_M = 1000;

  let nextId = 1;
  const newWeldOpening = () => ({
    id: nextId++, width: 1200, height: 1500, qty: 1,
    type: "single", hinge: "left", pattern: "grid", mount: "inside",
    finish: "enamel", lock: "none", eyelets: false,
  });

  const hasSash = (o) => byId(W.openings, o.type).sashes > 0;

  /** Drops choices that make no sense for the opening type (a blind grille has no lock). */
  function normalizeWeldOpening(o) {
    const sash = hasSash(o);
    return {
      ...o,
      hinge: o.type === "single" ? o.hinge : "left",
      lock: sash ? o.lock : "none",
      eyelets: sash && Boolean(o.eyelets),
    };
  }

  const pricedWidth = (o) => clamp(o.width, W.minSizeMm, W.maxWidthMm);
  const pricedHeight = (o) => clamp(o.height, W.minSizeMm, W.maxHeightMm);

  /** True when the default hatch with side margins fits into the opening. */
  const hatchFits = (o) =>
    o.width >= W.hatch.widthMm + 2 * W.hatch.marginMm && o.height >= W.hatch.heightMm + 2 * W.hatch.marginMm;

  /** Price of one opening type × qty; returns a new breakdown object. */
  function priceWeldOpening(input, mode) {
    const o = normalizeWeldOpening(input);
    const type = byId(W.openings, o.type);
    const pattern = byId(W.patterns, o.pattern);
    const finish = byId(W.finishes, o.finish);
    const lock = byId(W.locks, o.lock);
    const area = Math.max(W.minAreaM2, (pricedWidth(o) / MM_IN_M) * (pricedHeight(o) / MM_IN_M));

    const frame = area * W.basePerM2;
    const patternSum = area * pattern.perM2;
    const opening = type.openPrice;
    const topUp = Math.max(0, W.minProductPrice - (frame + patternSum + opening));
    const product = frame + patternSum + opening + topUp;
    const paint = area * finish.perM2;
    const hardware = lock.price + (o.eyelets ? W.eyelets.price : 0);
    const install = mode === "install" ? area * W.installPerM2 : 0;

    const qty = clamp(Math.round(o.qty) || 1, 1, W.maxQty);
    const times = (n) => n * qty;
    return {
      qty, area: times(area), frame: times(frame), pattern: times(patternSum), opening: times(opening),
      topUp: times(topUp), product: times(product), paint: times(paint), hardware: times(hardware),
      install: times(install),
    };
  }

  /** One order position: the breakdown plus its subtotal (without delivery). */
  function priceWeldPosition(o, mode) {
    const p = priceWeldOpening(o, mode);
    return { ...p, subtotal: p.product + p.paint + p.hardware + p.install };
  }

  const KEYS = ["qty", "area", "frame", "pattern", "opening", "topUp", "product", "paint", "hardware", "install", "subtotal"];

  /** Sums for a group of welded openings in one mode; `order` = { openings, mode }. No delivery. */
  function calcWeld({ openings, mode }) {
    const items = openings.map((o) => priceWeldPosition(o, mode));
    const sums = Object.fromEntries(KEYS.map((k) => [k, items.reduce((s, it) => s + it[k], 0)]));
    return { items, ...sums, pieces: sums.qty };
  }

  return { newWeldOpening, hasSash, normalizeWeldOpening, pricedWidth, pricedHeight, hatchFits, priceWeldOpening, priceWeldPosition, calcWeld };
});
