/*
 * Sliding grilles: pure pricing functions (no DOM, no state mutation).
 * Logic moved unchanged from the v1 app.js; tests/calc.test.js guards the old results.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./data.js"), require("./calc-common.js"));
  else root.CalcSliding = factory(root.GrilleData, root.CalcCommon);
})(typeof self !== "undefined" ? self : this, function (D, C) {
  const { clamp, byId } = C;
  const { MODELS, LOCKS, OPTIONS, SWIVELS, THRESHOLDS, FINISHES, PRICING } = D;

  let nextId = 1;
  const newOpening = () => ({
    id: nextId++, width: 1200, height: 1500, qty: 1, model: "standard",
    finish: "white", zinc: false, patina: D.PATINAS[0],
    lock: "none", lockQty: 1, masterKey: false, extraBolts: false,
    threshold: "fixed", swivel: "none", options: {}, groove: false,
  });

  const allowedLocks = (model) => LOCKS.filter((l) => l.id === "none" || (model.bankLock ? l.bankOnly : !l.bankOnly));
  const optionAllowed = (opt, model) =>
    !(opt.notFor && opt.notFor.includes(model.id)) && !(opt.onlyFor && !opt.onlyFor.includes(model.id));

  /** Drops choices the selected model does not support, so prices never include them. */
  function normalizeOpening(o) {
    const model = byId(MODELS, o.model);
    const lock = model.screen || !allowedLocks(model).some((l) => l.id === o.lock) ? "none" : o.lock;
    const lockDef = byId(LOCKS, lock);
    const swivel = model.screen ? "none" : o.swivel;
    const threshold = model.screen ? "fixed" : byId(SWIVELS, swivel).includesThreshold ? "folding" : o.threshold;
    const options = Object.fromEntries(
      Object.entries(o.options).filter(([id, qty]) => qty > 0 && optionAllowed(byId(OPTIONS, id), model)),
    );
    return {
      ...o,
      lock, swivel, threshold, options,
      lockQty: lock === "none" ? 1 : o.lockQty,
      masterKey: lock !== "none" && o.masterKey,
      extraBolts: Boolean(lockDef.extraBolts) && o.extraBolts,
      finish: model.stainless ? "white" : o.finish,
      zinc: !model.stainless && o.zinc,
      groove: !model.screen && o.groove,
    };
  }

  const pricedWidth = (o) => clamp(o.width, PRICING.minSizeMm, PRICING.maxWidthMm);
  const pricedHeight = (o) => clamp(o.height, PRICING.minSizeMm, PRICING.maxHeightMm);
  const isLowHeight = (o) => !byId(MODELS, o.model).screen && pricedHeight(o) < PRICING.lowHeightMm;

  function optionsPrice(o, w, h, area) {
    return OPTIONS.reduce((sum, opt) => {
      const qty = o.options[opt.id] || 0;
      if (!qty) return sum;
      const factor = opt.byWidth ? w : opt.byHeight ? h * opt.byHeight : opt.byArea ? area : 1;
      return sum + opt.price * qty * factor;
    }, 0);
  }

  function priceOpening(o, mode) {
    const model = byId(MODELS, o.model);
    const w = pricedWidth(o) / 1000;
    const h = pricedHeight(o) / 1000;
    const area = Math.max(PRICING.minAreaM2, w * h);
    const paint = model.stainless ? 0 : byId(FINISHES, o.finish).perM2 + (o.zinc ? D.ZINC_PER_M2 : 0);
    const base = area * (model.perM2 + paint) * (isLowHeight(o) ? 1 + PRICING.lowHeightSurcharge : 1);
    const product = Math.max(PRICING.minProductPrice, base);

    const lock = byId(LOCKS, o.lock);
    const lockSum = lock.id === "none" ? 0
      : o.lockQty * (lock.price + (o.masterKey ? D.MASTER_KEY_PER_LOCK : 0) + (o.extraBolts ? D.EXTRA_BOLTS_PAIR : 0));
    const swivel = byId(SWIVELS, o.swivel);
    const threshold = swivel.includesThreshold ? 0 : byId(THRESHOLDS, o.threshold).price;
    const extras = lockSum + swivel.price + threshold + optionsPrice(o, w, h, area);

    const install = mode === "install" ? area * PRICING.installPerM2 + (o.groove ? w * PRICING.groovePerM : 0) : 0;
    const qty = clamp(o.qty || 1, 1, PRICING.maxQty);
    return { qty, area: area * qty, product: product * qty, extras: extras * qty, install: install * qty };
  }

  /** Order totals for a list of openings; `order` = { openings, mode, delivery, km }. */
  function totals(order) {
    const items = order.openings.map((o) => priceOpening(normalizeOpening(o), order.mode));
    const sum = (key) => items.reduce((s, it) => s + it[key], 0);
    const delivery = C.deliveryPrice(order.mode, order.delivery, order.km);
    const total = sum("product") + sum("extras") + sum("install") + delivery;
    return {
      pieces: sum("qty"), area: sum("area"), product: sum("product"), extras: sum("extras"), install: sum("install"),
      delivery, total, ...C.paymentSplit(total),
      lowHeight: order.openings.some(isLowHeight),
    };
  }

  return {
    newOpening, allowedLocks, optionAllowed, normalizeOpening,
    pricedWidth, pricedHeight, isLowHeight, priceOpening, totals,
  };
});
