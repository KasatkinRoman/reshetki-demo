/*
 * Soft advice about the opening size (never blocks the order). Pure function, no DOM.
 * sizeAdvice(opening) → array of hint strings; an empty array means everything is fine.
 * opening = { kind: "sliding" | "weld", width (mm), type (weld), options (sliding) }.
 * The hatch size has its own note in editor-weld.js, so it is not repeated here.
 * Browser: window.SizeAdvice, Node: module.exports.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SizeAdvice = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const SINGLE_MAX_WIDTH_MM = 1200;
  const DOUBLE_MIN_WIDTH_MM = 900;
  const SLIDING_SPLIT_RAIL_WIDTH_MM = 3000;

  const TEXT = {
    singleTooWide: "Для такой ширины лучше две створки: одна створка получится тяжёлой и будет провисать",
    doubleTooNarrow: "Для такого проёма хватит одной створки — выйдет дешевле",
    slidingTooWide: "Широкий проём: добавьте разборную верхнюю направляющую (в опциях)",
  };

  function weldAdvice(o) {
    if (o.type === "single" && o.width > SINGLE_MAX_WIDTH_MM) return [TEXT.singleTooWide];
    if (o.type === "double" && o.width < DOUBLE_MIN_WIDTH_MM) return [TEXT.doubleTooNarrow];
    return [];
  }

  function slidingAdvice(o) {
    const chosen = Boolean(o.options && o.options.splitRail);
    return o.width > SLIDING_SPLIT_RAIL_WIDTH_MM && !chosen ? [TEXT.slidingTooWide] : [];
  }

  function sizeAdvice(opening) {
    if (!opening || !(opening.width > 0)) return [];
    if (opening.kind === "weld") return weldAdvice(opening);
    if (opening.kind === "sliding") return slidingAdvice(opening);
    return [];
  }

  return { sizeAdvice, TEXT, SINGLE_MAX_WIDTH_MM, DOUBLE_MIN_WIDTH_MM, SLIDING_SPLIT_RAIL_WIDTH_MM };
});
