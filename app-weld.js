/* Welded grilles: configurator UI (7 steps) and the catalog of opening variants.
 * Prices are computed by calc-weld.js (pure functions); every number comes from WELD in data.js. */
(function () {
  const D = window.GrilleData;
  const W = D.WELD;
  const CW = window.CalcWeld;
  const { clamp, byId, allowedDelivery, validDeliveryId } = window.CalcCommon;
  const { rub, el, esc, demoTag, chip, syncInput, readInt } = window.UI;
  const M2_DIGITS = 2;

  let state = { mode: "install", openings: [CW.newWeldOpening()], active: 0, delivery: "moscow", km: 0 };

  function setState(patch) {
    const next = { ...state, ...patch };
    state = { ...next, delivery: validDeliveryId(next.mode, next.delivery, W.delivery) };
    render();
  }

  function updateActive(patch) {
    const openings = state.openings.map((o, i) => (i === state.active ? CW.normalizeWeldOpening({ ...o, ...patch }) : o));
    setState({ openings });
  }

  const active = () => state.openings[state.active];
  const totals = () => CW.calcWeld(state);
  const typeOf = (o) => byId(W.openings, o.type);

  /** «5 500 ₽/м²» or «5 500 ₽/м² + 4 000 ₽ за открывание». */
  const typePrice = (t) => `${rub(W.basePerM2)}/м²${t.openPrice ? ` + ${rub(t.openPrice)} за открывание` : ""}`;
  const DEMO_NOTE = '<p class="demo-note">Цены рисунка и замков ориентировочные, подтвердим при заказе</p>';

  /* ---------- Steps ---------- */

  function renderTabs() {
    const tabs = state.openings.map((o, i) => `
      <button type="button" class="tab" role="tab" aria-selected="${i === state.active}" data-act="tab" data-val="${i}">
        ${i + 1}. ${esc(typeOf(o).name)} ${o.width}×${o.height}${o.qty > 1 ? ` ×${o.qty}` : ""}
        ${state.openings.length > 1 ? `<span class="x" data-act="remove" data-val="${i}" aria-label="Удалить проём ${i + 1}">×</span>` : ""}
      </button>`).join("");
    el("wTabs").innerHTML = tabs + '<button type="button" class="tab add" data-act="add">+ Добавить проём</button>';
  }

  function renderSize(o) {
    syncInput(el("wWidth"), o.width);
    syncInput(el("wHeight"), o.height);
    syncInput(el("wQty"), o.qty);
    const tooSmall = o.width < W.minSizeMm || o.height < W.minSizeMm;
    const tooBig = o.width > W.maxWidthMm || o.height > W.maxHeightMm;
    const area = (CW.pricedWidth(o) * CW.pricedHeight(o)) / 1e6;
    const notes = [];
    if (tooSmall) notes.push(`Минимальный размер — ${W.minSizeMm} мм, считаем по нему.`);
    if (tooBig) notes.push(`Больше ${W.maxWidthMm}×${W.maxHeightMm} мм — посчитаем индивидуально, отправьте ТЗ.`);
    if (!tooSmall && area < W.minAreaM2) notes.push(`Площадь меньше ${W.minAreaM2} м² считаем как ${W.minAreaM2} м².`);
    if (o.type === "hatch" && !CW.hatchFits(o)) {
      notes.push(`Люк ${W.hatch.widthMm}×${W.hatch.heightMm} мм не помещается в такой проём — посмотрите вариант «Одна створка».`);
    }
    const hint = el("wSizeHint");
    hint.textContent = notes.join(" ");
    hint.classList.toggle("warn", notes.length > 0);
  }

  function renderTypes(o) {
    el("wTypes").innerHTML = W.openings.map((t) => `
      <button type="button" class="type-card" data-act="type" data-val="${t.id}" aria-pressed="${o.type === t.id}">
        ${window.WeldAnim.svg({ type: t.id, hinge: t.id === "single" ? o.hinge : "left", pattern: "grid", decorative: true })}
        <b>${t.name}${demoTag(t)}</b><span>${t.short}</span><span class="p">${typePrice(t)}</span>
      </button>`).join("");
    const type = typeOf(o);
    el("wHinge").innerHTML = type.hingeChoice
      ? `<div class="sub-title">Сторона петель (смотрим с улицы)</div><div class="chips" role="group" aria-label="Сторона петель">${W.hinges.map((h) => chip("hinge", h.id, h.name, o.hinge === h.id)).join("")}</div>`
      : "";
    el("wTypeAbout").innerHTML = `<b>${type.name}:</b> ${type.about} <br><b>Кому подходит:</b> ${type.fits}`
      + (type.id === "hatch" ? `<br><b>Размер люка:</b> ${W.hatch.widthMm}×${W.hatch.heightMm} мм — размер уточняем на замере.` : "");
    showScheme(o);
  }

  /* The big animated scheme is rebuilt only when its look changes, so «Открыть» survives other edits. */
  let schemeKey = "";
  function showScheme(o) {
    const key = `${o.type}|${o.hinge}|${o.pattern}`;
    if (key === schemeKey) return;
    schemeKey = key;
    el("wScheme").innerHTML = window.WeldAnim.scheme({ type: o.type, hinge: o.hinge, pattern: o.pattern });
  }

  function renderPatterns(o) {
    el("wPatterns").innerHTML = W.patterns.map((p) => `
      <button type="button" class="pattern-card" data-act="pattern" data-val="${p.id}" aria-pressed="${o.pattern === p.id}">
        ${window.WeldAnim.patternPreview(p.id)}
        <b>${p.name}${demoTag(p)}</b><span>${p.hint}</span><span class="p">${p.perM2 ? `+${rub(p.perM2)}/м²` : "в цене"}</span>
      </button>`).join("");
  }

  function renderMount(o) {
    el("wMount").innerHTML = `<div class="chips" role="group" aria-label="Установка">${W.mounts.map((m) => chip("mount", m.id, m.name, o.mount === m.id)).join("")}</div>
      <p class="hint">${byId(W.mounts, o.mount).hint}. На цену не влияет — способ подтвердим на замере или по фото.</p>`;
  }

  function renderLock(o) {
    if (!CW.hasSash(o)) {
      el("wLock").innerHTML = '<p class="hint" style="margin:0">Глухая решётка не открывается — замок не нужен.</p>';
      return;
    }
    const locks = W.locks.map((l) => chip("lock", l.id, l.name + (l.price ? ` — ${rub(l.price)}` : "") + demoTag(l), o.lock === l.id)).join("");
    el("wLock").innerHTML = `<div class="chips" role="group" aria-label="Замок">${locks}</div>
      <label class="opt ${o.eyelets ? "is-on" : ""}" style="margin-top:10px">
        <span><b>${W.eyelets.name}${demoTag(W.eyelets)}</b><small>можно запирать без врезного замка</small></span>
        <span class="ctl">${rub(W.eyelets.price)} <input type="checkbox" data-check="eyelets" ${o.eyelets ? "checked" : ""}></span>
      </label>
      <p class="hint">Если через эту решётку возможна эвакуация, изнутри она должна открываться без ключа — подберём такой замок или запор.</p>`;
  }

  function renderFinish(o) {
    el("wFinish").innerHTML = `<div class="chips" role="group" aria-label="Покраска">${W.finishes.map((f) =>
      chip("finish", f.id, `${f.name} — +${rub(f.perM2)}/м²`, o.finish === f.id)).join("")}</div>
      <p class="hint">${byId(W.finishes, o.finish).hint}. Любой цвет RAL — без доплаты: укажите номер в комментарии к заказу.</p>`;
  }

  function renderDelivery() {
    el("wDeliveryTitle").textContent = state.mode === "install" ? "Монтаж и доставка" : "Доставка";
    el("wDelivery").innerHTML = allowedDelivery(state.mode, W.delivery).map((d) => {
      const price = d.perKm ? `${rub(d.price)} + ${d.perKm} ₽/км` : d.price ? rub(d.price) : "0 ₽";
      return chip("delivery", d.id, `${d.name} — ${price}${demoTag(d)}`, state.delivery === d.id);
    }).join("");
    el("wKmField").hidden = state.delivery !== "region";
    syncInput(el("wKm"), state.km);
    el("wInstall").innerHTML = state.mode === "install" ? `
      <div class="opts" style="margin-top:12px">
        <div class="opt"><span><b>Монтаж</b><small>фиксированная ставка за м², не процент от цены; анкеры включены</small></span><span class="ctl">${rub(W.installPerM2)}/м²</span></div>
      </div>` : "";
  }

  function summaryRows(t) {
    return [
      [`Решётки (${t.pieces} шт., ${t.area.toFixed(M2_DIGITS)} м²)`, rub(t.product)],
      ["в т.ч. каркас", rub(t.frame)],
      ...(t.pattern ? [["в т.ч. рисунок", rub(t.pattern)]] : []),
      ...(t.opening ? [["в т.ч. открывание (створки, люк)", rub(t.opening)]] : []),
      ...(t.topUp ? [[`в т.ч. до минимальной цены ${rub(W.minProductPrice)}`, rub(t.topUp)]] : []),
      ["Покраска", rub(t.paint)],
      ["Замки и проушины", t.hardware ? rub(t.hardware) : "—"],
      ...(state.mode === "install" ? [["Монтаж", rub(t.install)]] : []),
      ["Доставка", t.delivery ? rub(t.delivery) : "бесплатно"],
      ["Замер", "не нужен — ваши размеры"],
    ];
  }

  function renderSummary() {
    const t = totals();
    const o = active();
    el("wPreview").innerHTML = window.WeldAnim.svg({ type: o.type, hinge: o.hinge, pattern: o.pattern, decorative: true });
    el("wLines").innerHTML = summaryRows(t).map(([k, v]) => `<li${k.startsWith("в т.ч.") ? ' class="sub-line"' : ""}><span>${k}</span><span>${v}</span></li>`).join("");
    el("wTotal").textContent = rub(t.total);
    el("wPrepay").textContent = rub(t.prepay);
    el("wRest").textContent = rub(t.rest);
    el("wRestLabel").textContent = state.mode === "install" ? "После монтажа 30%" : "При получении 30%";
  }

  function renderNotice() {
    el("wSizeNotice").innerHTML = state.mode === "install"
      ? 'Вы указываете размеры сами — <b>ответственность за их точность на вас</b>. Не уверены? <a href="#wcalc" data-act="mode" data-val="measure">Вызовите замерщика</a>.'
      : 'Изготовим строго по вашим размерам — <b>ответственность за их точность на вас</b>. Размеры — в миллиметрах.';
  }

  function render() {
    el("wModes").innerHTML = window.UI.modesHtml(state.mode);
    const measuring = state.mode === "measure";
    el("wCalcPanel").hidden = measuring;
    el("wMeasurePanel").hidden = !measuring;
    if (!measuring) {
      const o = active();
      renderNotice();
      renderTabs();
      renderSize(o);
      renderTypes(o);
      renderPatterns(o);
      renderMount(o);
      renderLock(o);
      renderFinish(o);
      renderDelivery();
      renderSummary();
    }
    window.UI.refreshMobileTotal();
  }

  /* ---------- Catalog of opening variants ---------- */

  function renderCatalog() {
    el("weldCatalog").innerHTML = W.openings.map((t) => `
      <article class="card weld-card">
        ${window.WeldAnim.scheme({ type: t.id, hinge: "left", pattern: "grid" })}
        <h3 class="card-title">${t.name}${demoTag(t)}</h3>
        <span class="hint">${t.short}</span>
        <p><b>Кому подходит:</b> ${t.fits}</p>
        <p class="price">от ${typePrice(t)}</p>
        ${DEMO_NOTE}
        <a class="btn btn-dark" href="#wcalc" data-act="pickType" data-val="${t.id}" style="width:100%">Посчитать</a>
      </article>`).join("");
  }

  /* ---------- Events ---------- */

  /** Selects an opening type for the active opening and scrolls to the configurator. */
  function pickType(type) {
    state = { ...state, mode: state.mode === "measure" ? "install" : state.mode };
    updateActive({ type });
  }

  window.UI.delegate(el("weld"), {
    mode: (val) => setState({ mode: val }),
    tab: (val) => setState({ active: Number(val) }),
    remove: (val) => {
      const openings = state.openings.filter((_, j) => j !== Number(val));
      setState({ openings, active: Math.min(state.active, openings.length - 1) });
    },
    add: () => setState({ openings: [...state.openings, CW.newWeldOpening()], active: state.openings.length }),
    type: (val) => updateActive({ type: val }),
    hinge: (val) => updateActive({ hinge: val }),
    pattern: (val) => updateActive({ pattern: val }),
    mount: (val) => updateActive({ mount: val }),
    lock: (val) => updateActive({ lock: val }),
    finish: (val) => updateActive({ finish: val }),
    delivery: (val) => setState({ delivery: val }),
    pickType: (val) => { pickType(val); el("wcalc").scrollIntoView({ behavior: "smooth" }); },
  });

  el("weld").addEventListener("change", (e) => {
    const key = e.target.dataset && e.target.dataset.check;
    if (key) updateActive({ [key]: e.target.checked });
  });

  el("wWidth").addEventListener("input", (e) => updateActive({ width: readInt(e.target) }));
  el("wHeight").addEventListener("input", (e) => updateActive({ height: readInt(e.target) }));
  el("wQty").addEventListener("input", (e) => updateActive({ qty: clamp(readInt(e.target) || 1, 1, W.maxQty) }));
  el("wKm").addEventListener("input", (e) => setState({ km: clamp(readInt(e.target), 0, D.MAX_KM) }));

  const needsAddress = () => state.mode === "install" || ["moscow", "region"].includes(state.delivery);
  function summary() {
    if (state.mode === "measure") return null;
    const t = totals();
    return { title: "Сварные решётки", short: "Сварные", total: t.total, prepay: t.prepay, rest: t.rest, pieces: t.pieces, mode: state.mode, needsAddress: needsAddress() };
  }
  el("wToCheckout").addEventListener("click", () => window.UI.openCheckout(summary()));
  window.UI.registerTotal(el("wcalc"), summary);
  window.UI.mountMeasurePanel(el("wMeasurePanel"), "weld", "Например: 4 окна на первом этаже, одно — с люком для выхода");

  renderCatalog();
  render();

  window.WeldUI = { pickType };
})();
