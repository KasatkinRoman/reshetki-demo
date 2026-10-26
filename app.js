/* Calculator, ordering scenarios and forms for the sliding grilles prototype.
 * Catalog and prices live in data.js. Nothing is sent anywhere: forms only show
 * what would happen in the production version. */

const MODES = [
  { id: "self", name: "Знаю размеры, монтаж не нужен", note: "Изготовим по вашим размерам, доставим или отдадим самовывозом.", pay: "Оплата на сайте" },
  { id: "install", name: "Знаю размеры, нужен монтаж", note: "Привезём и установим. За точность размеров отвечаете вы.", pay: "Оплата на сайте" },
  { id: "measure", name: "Не знаю размеров", note: "Бесплатный замер — точную цену посчитает замерщик.", pay: "Оплата после замера" },
];

const rub = (n) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + " ₽";
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const el = (id) => document.getElementById(id);
const byId = (list, id) => list.find((item) => item.id === id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const demoTag = (item) => (item && item.source === "competitor" ? '<span class="demo-tag" title="Демо-цена: ориентир по конкуренту">демо</span>' : "");

/* ---------- State ---------- */

let nextId = 1;
const newOpening = () => ({
  id: nextId++, width: 1200, height: 1500, qty: 1, model: "standard",
  finish: "white", zinc: false, patina: PATINAS[0],
  lock: "none", lockQty: 1, masterKey: false, extraBolts: false,
  threshold: "fixed", swivel: "none", options: {}, groove: false,
});

let state = { mode: "install", openings: [newOpening()], active: 0, cat: "home", delivery: "moscow", km: 0 };

const allowedLocks = (model) => LOCKS.filter((l) => l.id === "none" || (model.bankLock ? l.bankOnly : !l.bankOnly));
const optionAllowed = (opt, model) =>
  !(opt.notFor && opt.notFor.includes(model.id)) && !(opt.onlyFor && !opt.onlyFor.includes(model.id));
const allowedDelivery = (mode) => DELIVERY.filter((d) => !(mode === "install" && d.noInstall));

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

function setState(patch) {
  state = { ...state, ...patch };
  if (!allowedDelivery(state.mode).some((d) => d.id === state.delivery)) state = { ...state, delivery: "moscow" };
  render();
}

function updateActive(patch) {
  const openings = state.openings.map((o, i) => (i === state.active ? normalizeOpening({ ...o, ...patch }) : o));
  setState({ openings });
}

const active = () => state.openings[state.active];

/* ---------- Pricing ---------- */

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
  const paint = model.stainless ? 0 : byId(FINISHES, o.finish).perM2 + (o.zinc ? ZINC_PER_M2 : 0);
  const base = area * (model.perM2 + paint) * (isLowHeight(o) ? 1 + PRICING.lowHeightSurcharge : 1);
  const product = Math.max(PRICING.minProductPrice, base);

  const lock = byId(LOCKS, o.lock);
  const lockSum = lock.id === "none" ? 0
    : o.lockQty * (lock.price + (o.masterKey ? MASTER_KEY_PER_LOCK : 0) + (o.extraBolts ? EXTRA_BOLTS_PAIR : 0));
  const swivel = byId(SWIVELS, o.swivel);
  const threshold = swivel.includesThreshold ? 0 : byId(THRESHOLDS, o.threshold).price;
  const extras = lockSum + swivel.price + threshold + optionsPrice(o, w, h, area);

  const install = mode === "install" ? area * PRICING.installPerM2 + (o.groove ? w * PRICING.groovePerM : 0) : 0;
  const qty = clamp(o.qty || 1, 1, PRICING.maxQty);
  return { qty, area: area * qty, product: product * qty, extras: extras * qty, install: install * qty };
}

function deliveryPrice() {
  const d = byId(DELIVERY, state.delivery);
  if (state.mode === "install" && d.freeWithInstall) return 0;
  return d.price + (d.perKm ? state.km * d.perKm : 0);
}

function totals() {
  const items = state.openings.map((o) => priceOpening(o, state.mode));
  const sum = (key) => items.reduce((s, it) => s + it[key], 0);
  const delivery = deliveryPrice();
  const total = sum("product") + sum("extras") + sum("install") + delivery;
  return {
    pieces: sum("qty"), area: sum("area"), product: sum("product"), extras: sum("extras"), install: sum("install"),
    delivery, total, prepay: total * PRICING.prepayShare, rest: total * (1 - PRICING.prepayShare),
    lowHeight: state.openings.some(isLowHeight),
  };
}

/* ---------- Drawing ---------- */

function grilleSvg(wMm, hMm, boxW, boxH, color) {
  const ratio = clamp(wMm / hMm, 0.3, 3);
  const h = boxH - 16;
  const w = Math.min(boxW - 16, h * ratio);
  const x0 = (boxW - w) / 2, y0 = 8;
  const cols = Math.max(3, Math.round(w / 18));
  const step = w / cols;
  const rows = SCISSOR_ROWS, rowH = h / rows;
  let lattice = "", posts = "";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * step, y = y0 + r * rowH;
      lattice += `M${x},${y}L${x + step},${y + rowH}M${x + step},${y}L${x},${y + rowH}`;
    }
  }
  for (let c = 0; c <= cols; c++) posts += `M${x0 + c * step},${y0}V${y0 + h}`;
  return `<rect x="${x0 - 4}" y="${y0 - 4}" width="${w + 8}" height="${h + 8}" rx="3" fill="none" stroke="${color}" stroke-width="3"/>
    <path d="${posts}" stroke="${color}" stroke-width="2.4"/>
    <path d="${lattice}" stroke="${color}" stroke-width="1.4" fill="none" opacity=".85"/>`;
}

/* ---------- Rendering ---------- */

const chip = (act, val, label, pressed, extra = "") =>
  `<button type="button" class="chip" data-act="${act}" data-val="${val}" aria-pressed="${pressed}" ${extra}>${label}</button>`;

function stepper(act, id, qty, max) {
  return `<span class="stepper" role="group" aria-label="Количество">
    <button type="button" data-act="${act}" data-val="${id}" data-delta="-1" aria-label="Меньше">−</button>
    <output>${qty}</output>
    <button type="button" data-act="${act}" data-val="${id}" data-delta="1" aria-label="Больше" ${qty >= max ? "disabled" : ""}>+</button>
  </span>`;
}

function renderModes() {
  el("modes").innerHTML = MODES.map((m) => `
    <button type="button" class="mode" data-act="mode" data-val="${m.id}" aria-pressed="${state.mode === m.id}">
      <b>${m.name}</b><small>${m.note}</small><span class="mode-pay">${m.pay}</span>
    </button>`).join("");
}

function renderTabs() {
  const tabs = state.openings.map((o, i) => `
    <button type="button" class="tab" role="tab" aria-selected="${i === state.active}" data-act="tab" data-val="${i}">
      ${i + 1}. ${esc(byId(MODELS, o.model).name)} ${o.width}×${o.height}${o.qty > 1 ? ` ×${o.qty}` : ""}
      ${state.openings.length > 1 ? `<span class="x" data-act="remove" data-val="${i}" aria-label="Удалить проём ${i + 1}">×</span>` : ""}
    </button>`).join("");
  el("tabs").innerHTML = tabs + '<button type="button" class="tab add" data-act="add">+ Добавить проём</button>';
}

const syncInput = (id, value) => { if (document.activeElement !== el(id)) el(id).value = value; };

function renderSize(o) {
  syncInput("width", o.width);
  syncInput("height", o.height);
  syncInput("qty", o.qty);
  const hint = el("sizeHint");
  const tooSmall = o.width < PRICING.minSizeMm || o.height < PRICING.minSizeMm;
  const tooBig = o.width > PRICING.maxWidthMm || o.height > PRICING.maxHeightMm;
  const notes = [];
  if (tooSmall) notes.push(`Минимальный размер — ${PRICING.minSizeMm} мм, считаем по нему.`);
  if (tooBig) notes.push(`Больше ${PRICING.maxWidthMm}×${PRICING.maxHeightMm} мм — посчитаем индивидуально, отправьте ТЗ.`);
  if (!tooSmall && isLowHeight(o)) notes.push(`Высота меньше ${PRICING.lowHeightMm} мм — наценка 30%.`);
  if (!tooSmall) notes.push(`В сложенном виде займёт около ${Math.round(pricedWidth(o) * PRICING.foldedShare)} мм сбоку.`);
  if (o.width >= 1500 && !o.options.twoWay) notes.push("Для такой ширины удобно «Раздвигание в две стороны».");
  hint.textContent = notes.join(" ");
  hint.classList.toggle("warn", tooSmall || tooBig || isLowHeight(o));
}

function renderModels(o) {
  const model = byId(MODELS, o.model);
  el("cats").innerHTML = CATEGORIES.map((c) => chip("cat", c.id, c.name, state.cat === c.id)).join("");
  el("models").innerHTML = MODELS.filter((m) => m.category === state.cat).map((m) => `
    <button type="button" class="model" aria-pressed="${o.model === m.id}" data-act="model" data-val="${m.id}">
      <b>${m.name}${demoTag(m)}</b><span>${m.tagline}</span><span class="p">${rub(m.perM2)}/м²</span>
    </button>`).join("");
  el("modelAbout").innerHTML = `<b>${model.name}:</b> ${model.about}`;
  showCalcAnim(model);
}

function renderFinish(o) {
  const model = byId(MODELS, o.model);
  if (model.stainless) {
    el("finish").innerHTML = '<p class="hint" style="margin:0">Нержавеющая сталь не окрашивается — покраска не нужна.</p>';
    return;
  }
  const finishes = FINISHES.map((f) =>
    chip("finish", f.id, f.name + (f.perM2 ? ` +${rub(f.perM2)}/м²` : " — в цене"), o.finish === f.id)).join("");
  const patina = model.patina
    ? `<div class="sub-title">Патина (входит в цену)</div><div class="chips">${PATINAS.map((p) => chip("patina", p, p, o.patina === p)).join("")}</div>`
    : "";
  el("finish").innerHTML = `<div class="chips">${finishes}</div>
    <label class="opt ${o.zinc ? "is-on" : ""}" style="margin-top:10px">
      <span><b>Гальваническое цинкование${demoTag({ source: "competitor" })}</b><small>дополнительная защита от коррозии, для улицы</small></span>
      <span class="ctl">+${rub(ZINC_PER_M2)}/м² <input type="checkbox" data-check="zinc" ${o.zinc ? "checked" : ""}></span>
    </label>${patina}`;
}

function renderLock(o) {
  const model = byId(MODELS, o.model);
  el("lockStep").hidden = Boolean(model.screen);
  if (model.screen) return;
  const lock = byId(LOCKS, o.lock);
  const chips = allowedLocks(model).map((l) =>
    chip("lock", l.id, l.name + (l.price ? ` — ${rub(l.price)}` : ""), o.lock === l.id)).join("");
  const extras = lock.id === "none" ? '<p class="hint">Без замка можно запирать на навесной — добавьте проушины в опциях.</p>' : `
    <div class="opts" style="margin-top:10px">
      <div class="opt"><span><b>Количество замков</b><small>второй замок — для высоких решёток</small></span><span class="ctl">${stepper("lockQty", "lock", o.lockQty, 2)}</span></div>
      <label class="opt ${o.masterKey ? "is-on" : ""}"><span><b>«Мастер-ключ»${demoTag({ source: "competitor" })}</b><small>один ключ ко всем решёткам в доме или офисе</small></span>
        <span class="ctl">+${rub(MASTER_KEY_PER_LOCK)}/замок <input type="checkbox" data-check="masterKey" ${o.masterKey ? "checked" : ""}></span></label>
      ${lock.extraBolts || lock.bankOnly ? `<label class="opt ${o.extraBolts ? "is-on" : ""}"><span><b>Дополнительная пара язычков${demoTag({ source: "competitor" })}</b><small>больше точек запирания по высоте</small></span>
        <span class="ctl">+${rub(EXTRA_BOLTS_PAIR)}/замок <input type="checkbox" data-check="extraBolts" ${o.extraBolts ? "checked" : ""}></span></label>` : ""}
    </div>`;
  el("lock").innerHTML = `<div class="chips">${chips}</div>${extras}`;
}

function renderConstruction(o) {
  const model = byId(MODELS, o.model);
  if (model.screen) {
    el("construction").innerHTML = '<p class="hint" style="margin:0 0 10px">Ширма катится на колёсах: направляющих, порога и поворота нет.</p>';
    return;
  }
  const swivel = byId(SWIVELS, o.swivel);
  const priced = (item) => item.name + (item.price ? ` +${rub(item.price)}` : "");
  el("construction").innerHTML = `
    <div class="sub-title" style="margin-top:0">Нижний порог</div>
    <div class="chips">${THRESHOLDS.map((t) => chip("threshold", t.id, priced(t), o.threshold === t.id, swivel.includesThreshold ? "disabled" : "")).join("")}</div>
    ${swivel.includesThreshold ? '<p class="hint">Откидной порог уже входит в поворотное устройство.</p>' : ""}
    <div class="sub-title">Поворот решётки</div>
    <div class="chips">${SWIVELS.map((s) => chip("swivel", s.id, priced(s), o.swivel === s.id)).join("")}</div>
    <p class="hint">${swivel.hint || "Решётка только раздвигается."}</p>
    <div class="sub-title">Опции</div>`;
}

function optionRow(opt, o) {
  const qty = o.options[opt.id] || 0;
  const counted = (opt.maxQty || 1) > 1;
  const control = counted
    ? stepper("optQty", opt.id, qty, opt.maxQty)
    : `<input type="checkbox" data-check="opt:${opt.id}" ${qty ? "checked" : ""} aria-label="${esc(opt.name)}">`;
  // A <label> around a stepper would forward every click on the row to its first button.
  const tag = counted ? "div" : "label";
  return `<${tag} class="opt ${qty ? "is-on" : ""}">
    <span><b>${opt.name}${demoTag(opt)}</b><small>${opt.hint}</small></span>
    <span class="ctl">${rub(opt.price)}/${opt.unit} ${control}</span>
  </${tag}>`;
}

function renderOptions(o) {
  const model = byId(MODELS, o.model);
  const visible = OPTIONS.filter((opt) => optionAllowed(opt, model));
  el("optsBasic").innerHTML = visible.filter((opt) => opt.group === "basic").map((opt) => optionRow(opt, o)).join("");
  const more = visible.filter((opt) => opt.group === "more");
  el("optsMore").innerHTML = more.map((opt) => optionRow(opt, o)).join("");
  const chosen = more.filter((opt) => o.options[opt.id]).length;
  el("moreCount").textContent = chosen ? `(выбрано: ${chosen})` : `(${more.length})`;
}

function renderDelivery(o) {
  const model = byId(MODELS, o.model);
  el("deliveryTitle").textContent = state.mode === "install" ? "Монтаж и доставка" : "Доставка";
  el("delivery").innerHTML = allowedDelivery(state.mode).map((d) => {
    const free = state.mode === "install" && d.freeWithInstall;
    const price = free ? "бесплатно" : d.perKm ? `${rub(d.price)} + ${d.perKm} ₽/км` : d.price ? rub(d.price) : "0 ₽";
    return chip("delivery", d.id, `${d.name} — ${price}${demoTag({ source: "competitor" })}`, state.delivery === d.id);
  }).join("");
  el("kmField").hidden = state.delivery !== "region";
  syncInput("km", state.km);
  el("installExtras").innerHTML = state.mode === "install" && !model.screen ? `
    <div class="opts" style="margin-top:12px">
      <div class="opt"><span><b>Монтаж</b><small>по вашим размерам, замерщик не приезжает</small></span><span class="ctl">${rub(PRICING.installPerM2)}/м²</span></div>
      <label class="opt ${o.groove ? "is-on" : ""}"><span><b>Штроба в полу под порог${demoTag({ source: "competitor" })}</b><small>порог вровень с полом, не спотыкаться</small></span>
        <span class="ctl">${rub(PRICING.groovePerM)}/п. м <input type="checkbox" data-check="groove" ${o.groove ? "checked" : ""}></span></label>
    </div>` : "";
}

function renderSummary() {
  const t = totals();
  const o = active();
  el("preview").innerHTML = grilleSvg(pricedWidth(o), pricedHeight(o), 220, 150, "#2b3138");
  const rows = [
    [`Решётки (${t.pieces} шт., ${t.area.toFixed(2)} м²)`, rub(t.product)],
    ...(t.lowHeight ? [["в т.ч. наценка за высоту < 1200 мм", "учтена"]] : []),
    ["Замки и опции", t.extras ? rub(t.extras) : "—"],
    ...(state.mode === "install" ? [["Монтаж", rub(t.install)]] : []),
    ["Доставка", t.delivery ? rub(t.delivery) : "бесплатно"],
    ["Замер", "не нужен — ваши размеры"],
  ];
  el("lines").innerHTML = rows.map(([k, v]) => `<li><span>${k}</span><span>${v}</span></li>`).join("");
  el("total").textContent = rub(t.total);
  el("prepay").textContent = rub(t.prepay);
  el("rest").textContent = rub(t.rest);
  el("restLabel").textContent = state.mode === "install" ? "После монтажа 30%" : "При получении 30%";
  el("summaryFine").textContent = state.mode === "install"
    ? "Монтаж по вашим размерам. Сомневаетесь в размерах — выберите «Не знаю размеров», замер бесплатный."
    : "Изготовим строго по вашим размерам. Срок изготовления сообщим после оплаты.";
  el("mTotal").textContent = rub(t.total);
  el("mPrepay").textContent = rub(t.prepay);
}

function renderNotice() {
  el("sizeNotice").innerHTML = state.mode === "install"
    ? 'Вы указываете размеры сами — <b>ответственность за их точность на вас</b>. Не уверены? <a href="#calc" data-act="mode" data-val="measure">Вызовите замерщика</a>.'
    : 'Изготовим строго по вашим размерам — <b>ответственность за их точность на вас</b>. Размеры — в миллиметрах.';
}

function render() {
  renderModes();
  const measuring = state.mode === "measure";
  el("calcPanel").hidden = measuring;
  el("measurePanel").hidden = !measuring;
  el("mobileTotal").hidden = measuring;
  document.body.classList.toggle("has-total", !measuring);
  if (measuring) return;
  const o = active();
  renderNotice();
  renderTabs();
  renderSize(o);
  renderModels(o);
  renderFinish(o);
  renderLock(o);
  renderConstruction(o);
  renderOptions(o);
  renderDelivery(o);
  renderSummary();
}

function renderCatalog() {
  el("catalog").innerHTML = CATEGORIES.map((c) => `
    <div class="cat-block">
      <h3>${c.name}</h3><p>${c.hint}</p>
      <div class="grid-4">${MODELS.filter((m) => m.category === c.id).map((m) => `
        <div class="card model-card">
          <button type="button" class="model-preview" data-act="anim" data-val="${m.id}" aria-label="${m.name}: как открывается и устроена">
            <svg viewBox="0 0 220 120" width="100%" height="120" aria-hidden="true">${grilleSvg(1200, 1000, 220, 120, "#3a424b")}</svg>
            <span class="play">▶ Как открывается</span>
          </button>
          <h3 style="margin-top:12px">${m.name}${demoTag(m)}</h3>
          <span class="hint">${m.tagline}</span>
          <p>${m.about}</p>
          <ul class="spec">
            <li><span>Защита</span>${m.protection ? `<span class="bar"><i style="width:${m.protection * 20}%"></i></span>` : "<span>декоративная</span>"}</li>
            <li><span>Вес</span><span>${m.weight} кг/м²</span></li>
            <li><span>Цена</span><b>от ${rub(m.perM2)}/м²</b></li>
          </ul>
          <button type="button" class="btn btn-ghost" data-act="anim" data-val="${m.id}" style="width:100%;margin-bottom:8px">Как открывается и устроена</button>
          <a class="btn btn-dark" href="#calc" data-act="pick" data-val="${m.id}" style="width:100%">Посчитать</a>
        </div>`).join("")}
      </div>
    </div>`).join("");
}

/* ---------- Grille diagram ---------- */

let stopGrilleAnim = null;
let calcAnim = { id: null, stop: null };

/* The calculator shows the selected model's diagram inline; it is rebuilt only when the model changes. */
function showCalcAnim(model) {
  if (calcAnim.id === model.id) return;
  if (calcAnim.stop) calcAnim.stop();
  calcAnim = { id: model.id, stop: window.GrilleAnim.mount(el("calcAnim"), model.id, model.name) };
}

function openGrilleAnim(modelId) {
  const model = byId(MODELS, modelId);
  stopGrilleAnim = window.GrilleAnim.mount(el("grilleAnim"), model.id, model.name);
  el("grilleDialog").showModal();
}

el("grilleDialog").addEventListener("close", () => {
  if (stopGrilleAnim) stopGrilleAnim();
  stopGrilleAnim = null;
});

/* ---------- Calculator events ---------- */

const ACTIONS = {
  anim: (val) => openGrilleAnim(val),
  animClose: () => el("grilleDialog").close(),
  mode: (val) => setState({ mode: val }),
  tab: (val) => {
    const i = Number(val);
    setState({ active: i, cat: byId(MODELS, state.openings[i].model).category });
  },
  remove: (val) => {
    const openings = state.openings.filter((_, j) => j !== Number(val));
    const i = Math.min(state.active, openings.length - 1);
    setState({ openings, active: i, cat: byId(MODELS, openings[i].model).category });
  },
  add: () => setState({ openings: [...state.openings, newOpening()], active: state.openings.length, cat: "home" }),
  cat: (val) => setState({ cat: val }),
  model: (val) => updateActive({ model: val }),
  pick: (val) => {
    state = { ...state, mode: state.mode === "measure" ? "install" : state.mode, cat: byId(MODELS, val).category };
    updateActive({ model: val });
  },
  finish: (val) => updateActive({ finish: val }),
  patina: (val) => updateActive({ patina: val }),
  lock: (val) => updateActive({ lock: val }),
  lockQty: (_, delta) => updateActive({ lockQty: clamp(active().lockQty + delta, 1, 2) }),
  threshold: (val) => updateActive({ threshold: val }),
  swivel: (val) => updateActive({ swivel: val }),
  optQty: (val, delta) => {
    const opt = byId(OPTIONS, val);
    const qty = clamp((active().options[val] || 0) + delta, 0, opt.maxQty || 1);
    updateActive({ options: { ...active().options, [val]: qty } });
  },
  delivery: (val) => setState({ delivery: val }),
};

document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-act]");
  if (!target || target.disabled) return;
  const action = ACTIONS[target.dataset.act];
  if (!action) return;
  if (target.tagName !== "A" || target.dataset.act !== "pick") e.preventDefault();
  if (target.dataset.act === "remove") e.stopPropagation();
  action(target.dataset.val, Number(target.dataset.delta || 0));
});

document.addEventListener("change", (e) => {
  const key = e.target.dataset && e.target.dataset.check;
  if (!key) return;
  if (key.startsWith("opt:")) {
    const id = key.slice(4);
    updateActive({ options: { ...active().options, [id]: e.target.checked ? 1 : 0 } });
  } else {
    updateActive({ [key]: e.target.checked });
  }
});

const readInt = (input) => {
  const value = parseInt(input.value, 10);
  return Number.isFinite(value) && value > 0 ? value : 0;
};
el("width").addEventListener("input", (e) => updateActive({ width: Math.min(readInt(e.target), 99999) }));
el("height").addEventListener("input", (e) => updateActive({ height: Math.min(readInt(e.target), 99999) }));
el("qty").addEventListener("input", (e) => updateActive({ qty: clamp(readInt(e.target) || 1, 1, PRICING.maxQty) }));
el("km").addEventListener("input", (e) => setState({ km: clamp(readInt(e.target), 0, MAX_KM) }));

/* ---------- Attachments (ТЗ, drawings, photos) ---------- */

const MB = 1024 * 1024;
const acceptedExt = ATTACHMENTS.accept.split(",");

/** Mounts a file picker into `container`; returns a getter for the selected files. */
function mountAttachments(container) {
  let files = [];
  let error = "";
  container.innerHTML = `
    <label class="attach"><input type="file" multiple accept="${ATTACHMENTS.accept}">
      <b>Прикрепить ТЗ, чертёж или фото</b><br>или перетащите файлы сюда · до ${ATTACHMENTS.maxFiles} файлов, ${ATTACHMENTS.maxTotalMb} МБ</label>
    <ul class="files"></ul><div class="err"></div>`;
  const input = container.querySelector("input");
  const drop = container.querySelector(".attach");
  const list = container.querySelector(".files");
  const err = container.querySelector(".err");

  function draw() {
    list.replaceChildren(...files.map((f, i) => {
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = `${f.name} · ${(f.size / MB).toFixed(1)} МБ`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "убрать";
      remove.addEventListener("click", () => { files = files.filter((_, j) => j !== i); error = ""; draw(); });
      li.append(name, remove);
      return li;
    }));
    err.textContent = error;
  }

  function add(incoming) {
    const next = [...files];
    const rejected = [];
    for (const f of incoming) {
      const ext = "." + f.name.split(".").pop().toLowerCase();
      const total = next.reduce((s, x) => s + x.size, 0) + f.size;
      if (!acceptedExt.includes(ext)) rejected.push(`«${f.name}» — неподходящий формат`);
      else if (next.length >= ATTACHMENTS.maxFiles) rejected.push(`не больше ${ATTACHMENTS.maxFiles} файлов`);
      else if (total > ATTACHMENTS.maxTotalMb * MB) rejected.push(`всего не больше ${ATTACHMENTS.maxTotalMb} МБ`);
      else next.push(f);
    }
    files = next;
    error = rejected.length ? "Не добавлено: " + [...new Set(rejected)].join("; ") + "." : "";
    draw();
  }

  input.addEventListener("change", () => { add([...input.files]); input.value = ""; });
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("drag"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("drag"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("drag"); add([...e.dataTransfer.files]); });
  return () => files;
}

/* ---------- Forms ---------- */

const phoneOk = (v) => v.replace(/\D/g, "").length >= 10;
const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const value = (form, name) => (form.elements[name] ? form.elements[name].value.trim() : "");
const checked = (form, name) => Boolean(form.elements[name] && form.elements[name].checked);

/** Validates with the given rules; each rule returns an error text or "". */
function bindForm(form, rules, onSuccess) {
  const getFiles = mountAttachments(form.querySelector("[data-attach]"));
  const err = form.querySelector(":scope > .err");
  const result = form.querySelector(".result");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const error = rules.map((rule) => rule(form, getFiles())).find(Boolean) || "";
    err.textContent = error;
    if (error) return;
    result.innerHTML = onSuccess(form, getFiles());
    result.hidden = false;
  });
  return { reset: () => { result.hidden = true; err.textContent = ""; } };
}

const need = (name, text) => (form) => (value(form, name).length < 2 ? text : "");
const needPhone = (form) => (phoneOk(value(form, "phone")) ? "" : "Проверьте номер телефона.");
const needConsent = (form) => (checked(form, "consent") ? "" : "Нужно согласие на обработку персональных данных.");
const filesNote = (files) => (files.length ? ` Файлов прикреплено: ${files.length}.` : "");

bindForm(el("measureForm"), [need("name", "Укажите имя."), needPhone, need("address", "Укажите адрес объекта."), needConsent],
  (form, files) => `<b>Заявка на замер принята</b><span class="hint">Перезвоним в течение часа в рабочее время.${filesNote(files)}</span>`);

bindForm(el("feedbackForm"), [
  need("name", "Укажите имя или компанию."),
  (form) => (phoneOk(value(form, "phone")) || emailOk(value(form, "email")) ? "" : "Оставьте телефон или почту для ответа."),
  (form, files) => (value(form, "comment") || files.length ? "" : "Напишите сообщение или прикрепите ТЗ."),
  needConsent,
], (form, files) => `<b>Отправлено</b><span class="hint">Посчитаем и пришлём КП в течение рабочего дня.${filesNote(files)}</span>`);

/* Checkout: production version creates a YooKassa payment for the prepayment on the server
 * and redirects to its confirmation_url; the order and files go to the sales inbox. */
const dlg = el("checkout");
const needsAddress = () => state.mode === "install" || ["moscow", "region"].includes(state.delivery);
const checkout = bindForm(el("checkoutForm"), [
  need("name", "Укажите имя."),
  needPhone,
  (form) => (emailOk(value(form, "email")) ? "" : "Укажите почту — на неё придёт чек."),
  (form) => (needsAddress() && value(form, "address").length < 5 ? "Укажите адрес доставки или монтажа." : ""),
  (form) => (checked(form, "sizes") ? "" : "Подтвердите, что отвечаете за точность размеров."),
  needConsent,
], (form, files) => `<b>Здесь откроется страница оплаты ЮKassa</b>
  <span class="hint">Сумма ${rub(totals().prepay)} — карта, СБП, SberPay. Чек придёт на ${esc(value(form, "email"))}.${filesNote(files)}</span>`);

function openCheckout() {
  const t = totals();
  el("dlgSum").textContent = `Заказ на ${rub(t.total)}: ${t.pieces} шт. Сейчас оплачиваете ${rub(t.prepay)}, `
    + (state.mode === "install" ? `${rub(t.rest)} — после монтажа.` : `${rub(t.rest)} — при получении.`);
  el("addrField").hidden = !needsAddress();
  el("payBtn").textContent = `Оплатить ${rub(t.prepay)} через ЮKassa`;
  checkout.reset();
  dlg.showModal();
}
el("toCheckout").addEventListener("click", openCheckout);
el("mCheckout").addEventListener("click", openCheckout);
el("checkoutForm").querySelector('[data-flow="close"]').addEventListener("click", () => dlg.close());

el("heroGrille").innerHTML = grilleSvg(1600, 1100, 320, 220, "#f2a516");
renderCatalog();
render();
