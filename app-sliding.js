/* Sliding grilles: calculator UI, model catalog and the grille diagram dialog.
 * Prices are computed by calc-sliding.js (pure functions); this file only keeps UI state. */
(function () {
  const D = window.GrilleData;
  const S = window.CalcSliding;
  const { clamp, byId, allowedDelivery, validDeliveryId } = window.CalcCommon;
  const { rub, el, esc, demoTag, chip, stepper, syncInput, readInt } = window.UI;
  const { MODELS, CATEGORIES, FINISHES, PATINAS, LOCKS, OPTIONS, THRESHOLDS, SWIVELS, PRICING } = D;
  const TWO_WAY_HINT_MM = 1500;
  const MAX_LOCKS = 2;
  const PREVIEW_COLOR = "#2b3138";

  let state = { mode: "install", openings: [S.newOpening()], active: 0, cat: "home", delivery: "moscow", km: 0 };

  function setState(patch) {
    const next = { ...state, ...patch };
    state = { ...next, delivery: validDeliveryId(next.mode, next.delivery) };
    render();
  }

  function updateActive(patch) {
    const openings = state.openings.map((o, i) => (i === state.active ? S.normalizeOpening({ ...o, ...patch }) : o));
    setState({ openings });
  }

  const active = () => state.openings[state.active];
  const totals = () => S.totals(state);

  /* ---------- Drawing ---------- */

  function grilleSvg(wMm, hMm, boxW, boxH, color) {
    const ratio = clamp(wMm / hMm, 0.3, 3);
    const h = boxH - 16;
    const w = Math.min(boxW - 16, h * ratio);
    const x0 = (boxW - w) / 2, y0 = 8;
    const cols = Math.max(3, Math.round(w / 18));
    const step = w / cols;
    const rows = D.SCISSOR_ROWS, rowH = h / rows;
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

  function renderTabs() {
    const tabs = state.openings.map((o, i) => `
      <button type="button" class="tab" role="tab" aria-selected="${i === state.active}" data-act="tab" data-val="${i}">
        ${i + 1}. ${esc(byId(MODELS, o.model).name)} ${o.width}×${o.height}${o.qty > 1 ? ` ×${o.qty}` : ""}
        ${state.openings.length > 1 ? `<span class="x" data-act="remove" data-val="${i}" aria-label="Удалить проём ${i + 1}">×</span>` : ""}
      </button>`).join("");
    el("tabs").innerHTML = tabs + '<button type="button" class="tab add" data-act="add">+ Добавить проём</button>';
  }

  function renderSize(o) {
    syncInput(el("width"), o.width);
    syncInput(el("height"), o.height);
    syncInput(el("qty"), o.qty);
    const hint = el("sizeHint");
    const tooSmall = o.width < PRICING.minSizeMm || o.height < PRICING.minSizeMm;
    const tooBig = o.width > PRICING.maxWidthMm || o.height > PRICING.maxHeightMm;
    const notes = [];
    if (tooSmall) notes.push(`Минимальный размер — ${PRICING.minSizeMm} мм, считаем по нему.`);
    if (tooBig) notes.push(`Больше ${PRICING.maxWidthMm}×${PRICING.maxHeightMm} мм — посчитаем индивидуально, отправьте ТЗ.`);
    if (!tooSmall && S.isLowHeight(o)) notes.push(`Высота меньше ${PRICING.lowHeightMm} мм — наценка ${PRICING.lowHeightSurcharge * 100}%.`);
    if (!tooSmall) notes.push(`В сложенном виде займёт около ${Math.round(S.pricedWidth(o) * PRICING.foldedShare)} мм сбоку.`);
    if (o.width >= TWO_WAY_HINT_MM && !o.options.twoWay) notes.push("Для такой ширины удобно «Раздвигание в две стороны».");
    hint.textContent = notes.join(" ");
    hint.classList.toggle("warn", tooSmall || tooBig || S.isLowHeight(o));
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
        <span class="ctl">+${rub(D.ZINC_PER_M2)}/м² <input type="checkbox" data-check="zinc" ${o.zinc ? "checked" : ""}></span>
      </label>${patina}`;
  }

  function renderLock(o) {
    const model = byId(MODELS, o.model);
    el("lockStep").hidden = Boolean(model.screen);
    if (model.screen) return;
    const lock = byId(LOCKS, o.lock);
    const chips = S.allowedLocks(model).map((l) =>
      chip("lock", l.id, l.name + (l.price ? ` — ${rub(l.price)}` : ""), o.lock === l.id)).join("");
    const extras = lock.id === "none" ? '<p class="hint">Без замка можно запирать на навесной — добавьте проушины в опциях.</p>' : `
      <div class="opts" style="margin-top:10px">
        <div class="opt"><span><b>Количество замков</b><small>второй замок — для высоких решёток</small></span><span class="ctl">${stepper("lockQty", "lock", o.lockQty, MAX_LOCKS)}</span></div>
        <label class="opt ${o.masterKey ? "is-on" : ""}"><span><b>«Мастер-ключ»${demoTag({ source: "competitor" })}</b><small>один ключ ко всем решёткам в доме или офисе</small></span>
          <span class="ctl">+${rub(D.MASTER_KEY_PER_LOCK)}/замок <input type="checkbox" data-check="masterKey" ${o.masterKey ? "checked" : ""}></span></label>
        ${lock.extraBolts || lock.bankOnly ? `<label class="opt ${o.extraBolts ? "is-on" : ""}"><span><b>Дополнительная пара язычков${demoTag({ source: "competitor" })}</b><small>больше точек запирания по высоте</small></span>
          <span class="ctl">+${rub(D.EXTRA_BOLTS_PAIR)}/замок <input type="checkbox" data-check="extraBolts" ${o.extraBolts ? "checked" : ""}></span></label>` : ""}
      </div>`;
    el("lock").innerHTML = `<div class="chips">${chips}</div>${extras}`;
  }

  function renderConstruction(o) {
    const model = byId(MODELS, o.model);
    if (model.screen) {
      el("construction").innerHTML = '<p class="hint" style="margin:0 0 10px">Ширма катится на одном колесе под крайней стойкой: направляющих, порога и поворота нет.</p>';
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
    const visible = OPTIONS.filter((opt) => S.optionAllowed(opt, model));
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
    syncInput(el("km"), state.km);
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
    el("preview").innerHTML = grilleSvg(S.pricedWidth(o), S.pricedHeight(o), 220, 150, PREVIEW_COLOR);
    const rows = [
      [`Решётки (${t.pieces} шт., ${t.area.toFixed(2)} м²)`, rub(t.product)],
      ...(t.lowHeight ? [[`в т.ч. наценка за высоту < ${PRICING.lowHeightMm} мм`, "учтена"]] : []),
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
  }

  function renderNotice() {
    el("sizeNotice").innerHTML = state.mode === "install"
      ? 'Вы указываете размеры сами — <b>ответственность за их точность на вас</b>. Не уверены? <a href="#calc" data-act="mode" data-val="measure">Вызовите замерщика</a>.'
      : 'Изготовим строго по вашим размерам — <b>ответственность за их точность на вас</b>. Размеры — в миллиметрах.';
  }

  function render() {
    el("modes").innerHTML = window.UI.modesHtml(state.mode);
    const measuring = state.mode === "measure";
    el("calcPanel").hidden = measuring;
    el("measurePanel").hidden = !measuring;
    window.UI.refreshMobileTotal();
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
    window.UI.refreshMobileTotal();
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
            <h4 class="card-title">${m.name}${demoTag(m)}</h4>
            <span class="hint">${m.tagline}</span>
            <p>${m.about}</p>
            <ul class="spec">
              <li><span>Защита</span>${m.protection ? `<span class="bar" role="img" aria-label="${m.protection} из 5"><i style="width:${m.protection * 20}%"></i></span>` : "<span>декоративная</span>"}</li>
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
  el("grilleDialog").querySelector(".dlg-close").addEventListener("click", () => el("grilleDialog").close());

  /* ---------- Events ---------- */

  /** Selects a model (or just a category) and scrolls to the calculator. */
  function pick(modelId, cat) {
    const model = modelId ? byId(MODELS, modelId) : null;
    state = { ...state, mode: state.mode === "measure" ? "install" : state.mode, cat: model ? model.category : cat || state.cat };
    if (model) updateActive({ model: model.id });
    else render();
  }

  window.UI.delegate(el("sliding"), {
    anim: (val) => openGrilleAnim(val),
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
    add: () => setState({ openings: [...state.openings, S.newOpening()], active: state.openings.length, cat: "home" }),
    cat: (val) => setState({ cat: val }),
    model: (val) => updateActive({ model: val }),
    pick: (val) => { pick(val); el("calc").scrollIntoView({ behavior: "smooth" }); },
    finish: (val) => updateActive({ finish: val }),
    patina: (val) => updateActive({ patina: val }),
    lock: (val) => updateActive({ lock: val }),
    lockQty: (_, delta) => updateActive({ lockQty: clamp(active().lockQty + delta, 1, MAX_LOCKS) }),
    threshold: (val) => updateActive({ threshold: val }),
    swivel: (val) => updateActive({ swivel: val }),
    optQty: (val, delta) => {
      const opt = byId(OPTIONS, val);
      const qty = clamp((active().options[val] || 0) + delta, 0, opt.maxQty || 1);
      updateActive({ options: { ...active().options, [val]: qty } });
    },
    delivery: (val) => setState({ delivery: val }),
  });

  el("sliding").addEventListener("change", (e) => {
    const key = e.target.dataset && e.target.dataset.check;
    if (!key) return;
    if (key.startsWith("opt:")) {
      const id = key.slice(4);
      updateActive({ options: { ...active().options, [id]: e.target.checked ? 1 : 0 } });
    } else {
      updateActive({ [key]: e.target.checked });
    }
  });

  el("width").addEventListener("input", (e) => updateActive({ width: readInt(e.target) }));
  el("height").addEventListener("input", (e) => updateActive({ height: readInt(e.target) }));
  el("qty").addEventListener("input", (e) => updateActive({ qty: clamp(readInt(e.target) || 1, 1, PRICING.maxQty) }));
  el("km").addEventListener("input", (e) => setState({ km: clamp(readInt(e.target), 0, D.MAX_KM) }));

  const needsAddress = () => state.mode === "install" || ["moscow", "region"].includes(state.delivery);
  function summary() {
    if (state.mode === "measure") return null;
    const t = totals();
    return { title: "Раздвижные решётки", short: "Раздвижные", total: t.total, prepay: t.prepay, rest: t.rest, pieces: t.pieces, mode: state.mode, needsAddress: needsAddress() };
  }
  el("toCheckout").addEventListener("click", () => window.UI.openCheckout(summary()));
  window.UI.registerTotal(el("calc"), summary);
  window.UI.mountMeasurePanel(el("measurePanel"), "sliding", "Например: 3 окна на первом этаже и входная дверь в магазин");

  renderCatalog();
  render();

  window.SlidingUI = { grilleSvg, pick };
})();
