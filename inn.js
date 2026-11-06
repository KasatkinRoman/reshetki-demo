/*
 * Russian taxpayer number (ИНН) check, pure function without DOM.
 * validateInn(value) → { valid, message }; message is "" when valid, otherwise a short text for the customer.
 * Checks digits only, length 10 (organisation) or 12 (sole proprietor / person) and the check digits
 * by the FNS algorithm: sum of digits × weights, remainder of division by 11, then by 10.
 * Browser: window.Inn, Node: module.exports.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Inn = factory();
})(typeof self !== "undefined" ? self : this, function () {
  const ORG_LENGTH = 10;
  const PERSON_LENGTH = 12;
  const MOD_BIG = 11;
  const MOD_DIGIT = 10;
  /* Weights of the FNS algorithm: one set for the 10-digit number, two for the 12-digit one. */
  const W10 = [2, 4, 10, 3, 5, 9, 4, 6, 8];
  const W11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
  const W12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];

  const MESSAGES = {
    empty: "Укажите ИНН.",
    digits: "ИНН состоит только из цифр.",
    length: "В ИНН 10 цифр (организация) или 12 (ИП).",
    checksum: "ИНН не прошёл проверку — проверьте цифры.",
  };

  const checkDigit = (digits, weights) =>
    (weights.reduce((sum, w, i) => sum + w * digits[i], 0) % MOD_BIG) % MOD_DIGIT;

  function checksumOk(digits) {
    if (digits.length === ORG_LENGTH) return checkDigit(digits, W10) === digits[9];
    return checkDigit(digits, W11) === digits[10] && checkDigit(digits, W12) === digits[11];
  }

  function validateInn(value) {
    const text = String(value == null ? "" : value).trim();
    const fail = (key) => ({ valid: false, message: MESSAGES[key] });
    if (!text) return fail("empty");
    if (!/^\d+$/.test(text)) return fail("digits");
    if (text.length !== ORG_LENGTH && text.length !== PERSON_LENGTH) return fail("length");
    if (!checksumOk([...text].map(Number))) return fail("checksum");
    return { valid: true, message: "" };
  }

  return { validateInn, MESSAGES };
});
