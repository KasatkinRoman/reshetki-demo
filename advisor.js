/*
 * «Что вам нужно?» — three questions on the hero screen → grille type and variant.
 * Pure function; browser: window.Advisor, Node: module.exports.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Advisor = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const QUESTIONS = [
    { id: "place", title: "Куда ставим?", answers: [
      { id: "window", name: "Окно" }, { id: "door", name: "Дверь, вход" },
      { id: "balcony", name: "Балкон, лоджия" }, { id: "shop", name: "Витрина, магазин" },
    ] },
    { id: "exit", title: "Нужен ли через решётку запасной выход?", answers: [
      { id: "yes", name: "Да" }, { id: "no", name: "Нет" }, { id: "unsure", name: "Не знаю" },
    ] },
    { id: "open", title: "Решётку нужно открывать?", answers: [
      { id: "slide", name: "Сдвигать в сторону" }, { id: "swing", name: "Открывать как дверь" },
      { id: "fixed", name: "Не открывать" },
    ] },
  ];

  const SLIDING_CATEGORY = { window: "home", door: "home", balcony: "home", shop: "secure" };

  /** Returns { title, text, target } or null until every question is answered. */
  function recommend(answers) {
    const { place, exit, open } = answers || {};
    if (!place || !exit || !open) return null;
    const needsExit = exit !== "no";
    if (open === "slide") {
      return {
        title: "Раздвижная решётка",
        text: "Днём сложена сбоку и не мешает, на ночь закрывается за секунды."
          + (needsExit ? " Если через неё нужен выход — подберём замок, который открывается изнутри без ключа." : ""),
        target: { kind: "sliding", cat: SLIDING_CATEGORY[place] },
      };
    }
    if (open === "swing") {
      const type = place === "shop" ? "double" : "single";
      return {
        title: type === "double" ? "Сварная, две створки" : "Сварная, одна створка",
        text: type === "double"
          ? "Для широкого проёма: створки расходятся от центра и занимают меньше места."
          : "Решётка открывается как дверь — удобно мыть окно и выходить.",
        target: { kind: "weld", type },
      };
    }
    if (needsExit) {
      return {
        title: "Сварная глухая с люком-створкой",
        text: "Глухая решётка, но с небольшой дверцей — запасной выход. Размер люка уточним на замере.",
        target: { kind: "weld", type: "hatch" },
      };
    }
    return {
      title: "Сварная глухая",
      text: "Самый прочный и доступный вариант для окон, которые не нужно открывать.",
      target: { kind: "weld", type: "blind" },
    };
  }

  return { QUESTIONS, recommend };
});
