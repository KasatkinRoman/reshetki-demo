/* Two tiers of scissors in every model: three-tier grilles are not made. */
const SCISSOR_ROWS = 2;

/*
 * Catalog and prices for the calculator (RUB).
 * Source tags:
 *   "price-list" — our selling prices from the price workbook of 2026-10-22;
 *   "owner"      — prices set by the owner (welded grilles, delivery; 2026-11-06);
 *   "competitor" — DEMO placeholder copied from amra-m.ru (prices without VAT, 2026-10-26),
 *                  to be replaced with our own prices before launch.
 */

const CATEGORIES = [
  { id: "home", name: "Квартира и дом", hint: "окна, балконы, двери" },
  { id: "secure", name: "Повышенная защита", hint: "первые этажи, склады, магазины" },
  { id: "bank", name: "Банки и кассы", hint: "сертифицированный класс защиты" },
  { id: "decor", name: "Витрины и интерьер", hint: "декоративные и нержавейка" },
];

const MODELS = [
  {
    id: "econom", category: "home", name: "Эконом", tagline: "нижний ролик",
    perM2: 7480, source: "competitor", protection: 1, weight: 10,
    about: "Полотно катится по нижней направляющей. Самый доступный вариант для окон и балконов.",
  },
  {
    id: "standard", category: "home", name: "Стандарт", tagline: "верхний подвес",
    perM2: 10000, source: "price-list", protection: 2, weight: 13,
    about: "Полотно подвешено на роликах к верхней направляющей — ход лёгкий, порог почти не мешает.",
  },
  {
    id: "silent", category: "secure", name: "Бесшумная", tagline: "двухроликовые каретки",
    perM2: 14200, source: "competitor", protection: 3, weight: 15,
    about: "Каретки с двумя роликами и ползуны: плавный и тихий ход. Для квартир и офисов.",
  },
  {
    id: "strong", category: "secure", name: "Усиленная", tagline: "II класс по ГОСТ Р 51242",
    perM2: 16900, source: "competitor", protection: 4, weight: 18,
    about: "Профиль рамы 60×40 мм, стойки 20×20 мм. Для первых этажей, складов и магазинов.",
  },
  {
    id: "bank", category: "bank", name: "Банковская", tagline: "I класс по ГОСТ Р 51113",
    perM2: 26200, source: "competitor", protection: 5, weight: 25, bankLock: true,
    about: "Рама 60×40×4 мм, стойки из полосы 40×6 мм. Для касс, банков, хранилищ.",
  },
  {
    id: "screen", category: "decor", name: "Ширма", tagline: "на колесе, без направляющих",
    perM2: 6400, source: "competitor", protection: 0, weight: 9, screen: true,
    about: "Декоративная, не защитная. Катится по полу на одном колесе под крайней стойкой, ничего не нужно крепить к полу и потолку.",
  },
  {
    id: "art", category: "decor", name: "Художественная", tagline: "окраска с патиной",
    perM2: 19200, source: "competitor", protection: 2, weight: 14, patina: true,
    about: "Художественный профиль и патина (золото, серебро, бронза, медь). Для витрин и интерьеров.",
  },
  {
    id: "steel", category: "decor", name: "Нержавейка", tagline: "AISI 304, без окраски",
    perM2: 59900, source: "competitor", protection: 2, weight: 13, stainless: true,
    about: "Матовая нержавеющая сталь: не красится и не ржавеет. Для фасадов и влажных помещений.",
  },
];

const FINISHES = [
  { id: "white", name: "Белый RAL 9016", perM2: 0, source: "competitor" },
  { id: "ral", name: "Любой цвет RAL, гладкий", perM2: 3900, source: "competitor" },
  { id: "texture", name: "Структурированная (шагрень)", perM2: 6400, source: "competitor" },
];
const ZINC_PER_M2 = 9200;            // competitor
const PATINAS = ["Золото", "Серебро", "Бронза", "Медь"];

const LOCKS = [
  { id: "none", name: "Без замка", price: 0 },
  { id: "kale", name: "Врезной KALE, 3 ключа", price: 3900, source: "competitor" },
  { id: "prefer", name: "Ригельный PREFER, 6 ключей", price: 7900, source: "competitor", extraBolts: true },
  { id: "bank", name: "Ригельный банковский, 5 ключей", price: 8900, source: "competitor", bankOnly: true },
];
const MASTER_KEY_PER_LOCK = 1200;    // competitor
const EXTRA_BOLTS_PAIR = 2875;       // competitor

/*
 * Per-item options. byWidth / byHeight (number of posts) / byArea: price per running metre
 * or per m² of the opening instead of per piece. maxQty > 1 shows a quantity stepper.
 */
const OPTIONS = [
  // Basic — shown right away
  { id: "eyelets", group: "basic", name: "Проушины под навесной замок", hint: "две пары", price: 1000, unit: "компл.", source: "price-list" },
  { id: "twoWay", group: "basic", name: "Раздвигание в две стороны", hint: "легче открывать проёмы шире 1,5 м", price: 2800, unit: "шт.", source: "price-list" },
  { id: "handle", group: "basic", name: "Ручка", hint: "не прищемить пальцы при открывании", price: 290, unit: "шт.", source: "competitor", maxQty: 4 },
  // Advanced — under «Ещё опции»
  { id: "floating", group: "more", name: "«Плавающее» раздвигание", hint: "полотно сдвигается и вправо, и влево", price: 2200, unit: "шт.", source: "competitor", notFor: ["econom", "screen"] },
  { id: "hook", group: "more", name: "Крючок-запор", hint: "запирание без замка", price: 500, unit: "шт.", source: "competitor" },
  { id: "bundle", group: "more", name: "Фиксатор собранного полотна", hint: "стягивает сложенную решётку", price: 400, unit: "шт.", source: "competitor", maxQty: 2 },
  { id: "topRail", group: "more", name: "Усиленная верхняя направляющая", hint: "для тяжёлых и широких решёток", price: 1700, unit: "п. м", byWidth: true, source: "price-list", notFor: ["screen"] },
  { id: "splitRail", group: "more", name: "Сборно-разборная верхняя направляющая", hint: "нужна при ширине больше 3 м", price: 3400, unit: "шт.", source: "competitor", notFor: ["screen"] },
  { id: "section", group: "more", name: "Сборно-разборная секция", hint: "можно снять решётку целиком", price: 1500, unit: "шт.", source: "price-list" },
  { id: "sideFrame", group: "more", name: "Усиленные боковые стойки рамы 40×40", hint: "считается по высоте, две стойки", price: 1800, unit: "п. м", byHeight: 2, source: "competitor", notFor: ["screen"] },
  { id: "topFold", group: "more", name: "Откидная верхняя направляющая", hint: "складывается вверх", price: 2400, unit: "шт.", source: "competitor", notFor: ["screen"] },
  { id: "support", group: "more", name: "Промежуточная опора для ширмы", hint: "одно колесо, жёсткость полотна", price: 3500, unit: "шт.", source: "competitor", onlyFor: ["screen"], maxQty: 6 },
  { id: "support2", group: "more", name: "Двухсторонняя опора для ширмы", hint: "для ширм выше 2 м", price: 4940, unit: "шт.", source: "competitor", onlyFor: ["screen"], maxQty: 6 },
  { id: "packing", group: "more", name: "Упаковка в гофрокартон и плёнку", hint: "для отправки транспортной компанией", price: 180, unit: "м²", byArea: true, source: "competitor" },
];

/* Mutually exclusive choices — radio groups. */
const THRESHOLDS = [
  { id: "fixed", name: "Обычный", price: 0 },
  { id: "folding", name: "Откидной", hint: "поднимается, проход свободен", price: 1500, source: "price-list" },
  { id: "removable", name: "Съёмный", hint: "снимается и хранится отдельно", price: 1900, source: "competitor" },
];
const SWIVELS = [
  { id: "none", name: "Без поворота", price: 0 },
  { id: "swivel", name: "Поворотный механизм", hint: "решётка отходит от окна — удобно мыть", price: 2500, source: "price-list" },
  { id: "swivelThreshold", name: "Поворот с откидным порогом", hint: "для дверей: порог уже включён", price: 5800, source: "competitor", includesThreshold: true },
];

const PRICING = {
  minProductPrice: 14400,        // price-list
  minAreaM2: 1,                  // competitor: smaller openings are priced as 1 m²
  lowHeightMm: 1200,             // competitor: +30% when height < 1200 mm (not for screens)
  lowHeightSurcharge: 0.3,
  installPerM2: 3500,            // price-list
  groovePerM: 2400,              // competitor: floor groove for a flush threshold, per m of width
  prepayShare: 0.7,
  foldedShare: 0.18,
  minSizeMm: 300,
  maxWidthMm: 6000,
  maxHeightMm: 4000,
  maxQty: 50,
};

/*
 * One delivery for the whole order, the same for every grille type (owner, 2026-11-06).
 * No free delivery with installation. perKm applies outside the MKAD.
 * Carrier price is still a DEMO placeholder (competitor level).
 */
const DELIVERY = [
  { id: "moscow", name: "По Москве", price: 5000 },
  { id: "region", name: "За МКАД", price: 5000, perKm: 80 },
  { id: "carrier", name: "До транспортной компании", price: 400, noInstall: true, source: "competitor" },
  { id: "pickup", name: "Самовывоз", price: 0, noInstall: true },
];
const MAX_KM = 300;

const ATTACHMENTS = {
  maxFiles: 5,
  maxTotalMb: 20,
  accept: ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.heic,.dwg,.zip",
};

/*
 * Welded (fixed-frame) grilles. All prices are the owner's (2026-11-06), source: "owner".
 * Delivery is shared with sliding grilles (DELIVERY above).
 */
const WELD = {
  basePerM2: 5500,
  openings: [
    {
      id: "blind", name: "Глухая", short: "не открывается", openPrice: 0, sashes: 0,
      fits: "Окна, которые не нужно открывать: подвалы, склады, задние фасады.",
      about: "Цельная решётка без створок. Самая прочная и доступная, но через неё нельзя выйти.",
    },
    {
      id: "single", name: "Одна створка", short: "петли слева или справа", openPrice: 4000, sashes: 1, hingeChoice: true,
      fits: "Окна до ~1 м шириной, балконы, двери-калитки, когда нужен выход или доступ к окну.",
      about: "Решётка целиком открывается как дверь. Сторону петель выбираете сами.",
    },
    {
      id: "double", name: "Две створки", short: "открываются от центра", openPrice: 8000, sashes: 2,
      fits: "Широкие окна и проёмы от ~1,2 м, витрины, ворота-распашки.",
      about: "Две створки расходятся от центра — каждая уже и легче, им нужно меньше места при открывании.",
    },
    {
      id: "hatch", name: "Люк-створка", short: "дверца в глухой решётке", openPrice: 4000, sashes: 1,
      fits: "Первые этажи и квартиры, где нужна прочная глухая решётка и запасной выход.",
      about: "Глухая решётка со встроенной небольшой дверцей: в обычной жизни закрыто, при необходимости можно выбраться.",
    },
  ],
  /* Default hatch size; the real size is agreed at the measurement visit. */
  hatch: { widthMm: 600, heightMm: 800, marginMm: 100 },
  hinges: [
    { id: "left", name: "Петли слева" },
    { id: "right", name: "Петли справа" },
  ],
  patterns: [
    { id: "grid", name: "Простая сетка из прутка", hint: "пруток 12 мм, ячейка ~150 мм", perM2: 0, source: "owner" },
    { id: "diamond", name: "Рамка с диагональю / ромбом", hint: "рамка и ромбическое заполнение", perM2: 600, source: "owner" },
    { id: "forged", name: "С элементами ковки", hint: "завитки, пики, корзинки", perM2: 2500, source: "owner" },
  ],
  mounts: [
    { id: "inside", name: "В проём", hint: "решётка внутри откосов, анкеры в стены проёма" },
    { id: "overlay", name: "Внакладку", hint: "решётка перекрывает проём и крепится к фасаду — для узких или неровных откосов" },
  ],
  locks: [
    { id: "none", name: "Без замка", price: 0 },
    { id: "mortise", name: "Врезной замок", price: 3900, source: "owner" },
    { id: "rim", name: "Ригельный замок", price: 7900, source: "owner" },
  ],
  eyelets: { name: "Проушины под навесной замок", price: 1000, source: "price-list" },
  finishes: [
    { id: "enamel", name: "Грунт-эмаль", hint: "стандартная покраска в два слоя", perM2: 1000 },
    { id: "zinc", name: "Цинко-грунт", hint: "цинконаполненный грунт: лучше защищает от ржавчины", perM2: 1500 },
    { id: "powder", name: "Порошковая покраска", hint: "прочнее и ровнее", perM2: 2500 },
  ],
  installPerM2: 3000,
  minProductPrice: 8000,
  minAreaM2: 1,
  minSizeMm: 300,
  maxWidthMm: 4000,
  maxHeightMm: 3000,
  maxQty: 50,
};

/* One namespace for the calculators: global in the browser, module.exports in Node (tests). */
const GRILLE_DATA = {
  SCISSOR_ROWS, CATEGORIES, MODELS, FINISHES, ZINC_PER_M2, PATINAS, LOCKS, MASTER_KEY_PER_LOCK, EXTRA_BOLTS_PAIR,
  OPTIONS, THRESHOLDS, SWIVELS, PRICING, DELIVERY, MAX_KM, ATTACHMENTS, WELD,
};
if (typeof module === "object" && module.exports) module.exports = GRILLE_DATA;
else window.GrilleData = GRILLE_DATA;
