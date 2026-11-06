/*
 * Order state transitions: every function returns a new order and never mutates its input.
 * order = { mode, positions: [{ id, kind, pristine, ...fields }], active, delivery, km }
 * `pristine` marks a position the customer has not edited yet (the advisor may reuse it).
 * Browser: window.OrderState, Node: module.exports.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./data.js"), require("./calc-common.js"), require("./calc-sliding.js"), require("./calc-weld.js"));
  } else {
    root.OrderState = factory(root.GrilleData, root.CalcCommon, root.CalcSliding, root.CalcWeld);
  }
})(typeof self !== "undefined" ? self : this, function (D, C, S, W) {
  const FACTORY = { sliding: S.newOpening, weld: W.newWeldOpening };
  const NORMALIZE = { sliding: S.normalizeOpening, weld: W.normalizeWeldOpening };
  const KEEP_ON_KIND_CHANGE = ["id", "width", "height", "qty"];

  const MAX_POSITIONS = 30;

  let nextId = 1;

  const createOrder = () => ({ mode: "install", positions: [], active: 0, delivery: "moscow", km: 0 });

  function newPosition(kind, patch = {}) {
    if (!FACTORY[kind]) throw new Error(`Unknown position kind: ${kind}`);
    const base = { ...FACTORY[kind](), id: nextId++, kind, pristine: true };
    return NORMALIZE[kind]({ ...base, ...patch, kind });
  }

  const clampActive = (positions, active) => Math.max(0, Math.min(active, positions.length - 1));

  /** Merges top-level fields (mode, delivery, km, active) and keeps the delivery valid for the mode. */
  function setOrder(order, patch) {
    const next = { ...order, ...patch };
    return {
      ...next,
      active: clampActive(next.positions, next.active),
      delivery: C.validDeliveryId(next.mode, next.delivery),
      km: C.clamp(Number(next.km) || 0, 0, D.MAX_KM),
    };
  }

  const canAddPosition = (order) => order.positions.length < MAX_POSITIONS;

  /** Adds a fresh position at the end and makes it active; at the limit the order is returned unchanged. */
  function addPosition(order, kind, patch) {
    if (!canAddPosition(order)) return order;
    return setOrder(order, { positions: [...order.positions, newPosition(kind, patch)], active: order.positions.length });
  }

  /**
   * Copies position `index` (default: the active one): a deep copy with a new unique id, inserted right
   * after the original and made active. The copy counts as edited (not pristine). At the limit, or for
   * a missing index, the order is returned unchanged.
   */
  function copyPosition(order, index = order.active) {
    const source = order.positions[index];
    if (!source || !canAddPosition(order)) return order;
    const freeId = Math.max(nextId, ...order.positions.map((p) => p.id + 1));
    nextId = freeId + 1;
    const copy = { ...structuredClone(source), id: freeId, pristine: false };
    const positions = [...order.positions.slice(0, index + 1), copy, ...order.positions.slice(index + 1)];
    return setOrder(order, { positions, active: index + 1 });
  }

  function removePosition(order, index) {
    const positions = order.positions.filter((_, i) => i !== index);
    const active = index < order.active ? order.active - 1 : order.active;
    return setOrder(order, { positions, active });
  }

  /** Edits one position; the result is normalized for its kind and is no longer pristine. */
  function updatePosition(order, index, patch) {
    const positions = order.positions.map((p, i) =>
      (i === index ? NORMALIZE[p.kind]({ ...p, ...patch, kind: p.kind, pristine: false }) : p));
    return setOrder(order, { positions });
  }

  /** Puts a fresh (pristine) position of `kind` in place of `index`; size, quantity and id are kept. */
  function replacePosition(order, index, kind, patch = {}) {
    const old = order.positions[index];
    if (!old) return order;
    const kept = Object.fromEntries(KEEP_ON_KIND_CHANGE.map((k) => [k, old[k]]));
    const positions = order.positions.map((p, i) => (i === index ? newPosition(kind, { ...kept, ...patch }) : p));
    return setOrder(order, { positions });
  }

  /** The customer switches a position to the other grille type (counts as an edit). */
  function changeKind(order, index, kind) {
    const old = order.positions[index];
    if (!old || old.kind === kind) return order;
    return updatePosition(replacePosition(order, index, kind), index, {});
  }

  return { MAX_POSITIONS, createOrder, newPosition, setOrder, addPosition, canAddPosition, copyPosition, removePosition, updatePosition, replacePosition, changeKind };
});
