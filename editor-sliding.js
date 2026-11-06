/* Editor of one sliding position: model, paint, lock, construction and options.
 * Renders into the static #slidingSteps skeleton; prices come from calc-sliding.js.
 * Actions return a patch for the active position (or null when only the view changes);
 * order-ui.js applies it to the shared order. */
(function () {
  const D = window.GrilleData;
  const S = window.CalcSliding;
  const { clamp, byId } = window.CalcCommon;
  const { rub, el, esc, demoTag, chip, stepper } = window.UI;
  const { MODELS, CATEGORIES, FINISHES, PATINAS, LOCKS, OPTIONS, THRESHOLDS, SWIVELS, PRICING } = D;
  const TWO_WAY_HINT_MM = 1500;
  const MAX_LOCKS = 2;
  const PREVIEW_COLOR = "#2b3138";
  const M2_DIGITS = 2;
  /* The advisor picks a category; this is the model a new position gets for it. */
  const CATEGORY_DEFAULT = { home: "standard", secure: "strong", bank: "bank", decor: "screen" };

  /* View-only state: the category being browsed for the active position.
   * It follows the model whenever another position or another model is shown. */
  let view = { forId: null, forModel: null, cat: "home" };
  const syncView = (o) => {
    if (view.forId !== o.id || view.forModel !== o.model) view = { forId: o.id, forModel: o.model, cat: byId(MODELS, o.model).category };
  };

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

  const previewSvg = (o) =>
    `<svg viewBox="0 0 220 150" width="100%" height="150" aria-hidden="true">${grilleSvg(S.pricedWidth(o), S.pricedHeight(o), 220, 150, PREVIEW_COLOR)}</svg>`;

  /* ---------- Steps ---------- */

  function sizeNotes(o) {
    const tooSmall = o.width < PRICING.minSizeMm || o.height < PRICING.minSizeMm;
    const tooBig = o.width > PRICING.maxWidthMm || o.height > PRICING.maxHeightMm;
    const notes = [];
    if (tooSmall) notes.push(`Минимальный размер — ${PRICING.minSizeMm} мм, считаем по нему.`);
    if (tooBig) notes.push(`Больше ${PRICING.maxWidthMm}×${PRICING.maxHeightMm} мм — посчитаем индивидуально, отправьте задание (ТЗ).`);
    if (!tooSmall && S.isLowHeight(o)) notes.push(`Высота меньше ${PRICING.lowHeightMm} мм — наценка ${PRICING.lowHeightSurcharge * 100}%.`);
    if (!tooSmall) notes.push(`В сложенном виде займёт около ${Math.round(S.pricedWidth(o) * PRICING.foldedShare)} мм сбоку.`);
    if (o.width >= TWO_WAY_HINT_MM && !o.options.twoWay) notes.push("Для такой ширины удобно «Раздвигание в две стороны».");
    return { text: notes.join(" "), warn: tooSmall || tooBig || S.isLowHeight(o) };
  }

  function renderModels(o) {
    const model = byId(MODELS, o.model);
    el("cats").innerHTML = CATEGORIES.map((c) => chip("cat", c.id, c.name, view.cat === c.id)).join("");
    el("models").innerHTML = MODELS.filter((m) => m.category === view.cat).map((m) => `
      <button type="button" class="model" aria-pressed="${o.model === m.id}" data-act="model" data-val="${m.id}">
        <b>${m.name}${demoTag(m)}</b><span>${m.tagline}</span><span class="p">${rub(m.perM2)}/м²</span>
      </button>`).join("");
    el("modelAbout").innerHTML = `<p><b>${model.name}:</b> ${model.about}</p>
      <button type="button" class="btn btn-ghost btn-sm" data-act="anim" data-val="${model.id}">▶ Как открывается и устроена</button>`;
  }

  function renderFinish(o) {
    const model = byId(MODELS, o.model);
    if (model.stainless) {
      el("finish").innerHTML = '<p class="hint" style="margin:0">Нержавеющая сталь не окрашивается — покраска не нужна.</p>';
      return;
    }
    const finishes = FINISHES.map((f) =>
      chip("finish", f.id, f.name + (f.perM2 ? ` — +${rub(f.perM2)}/м²` : " — в цене"), o.finish === f.id)).join("");
    const patina = model.patina
      ? `<div class="sub-title">Патина (входит в цену)</div><div class="chips">${PATINAS.map((p) => chip("patina", p, p, o.patina === p)).join("")}</div>`
      : "";
    const colorNote = o.finish === "white" ? ""
      : '<p class="hint">Номер цвета по каталогу RAL укажите в комментарии к заказу.</p>';
    el("finish").innerHTML = `<div class="chips" role="group" aria-label="Вид покраски">${finishes}</div>${colorNote}
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
      chip("lock", l.id, l.name + (l.price ? ` — ${rub(l.price)}` : "") + demoTag(l), o.lock === l.id)).join("");
    const extras = lock.id === "none" ? '<p class="hint">Без замка можно запирать на навесной — добавьте «петли под навесной замок» в опциях.</p>' : `
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
    const priced = (item) => item.name + (item.price ? ` +${rub(item.price)}` : "") + demoTag(item);
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

  function renderOptions(o, mode) {
    const model = byId(MODELS, o.model);
    const visible = OPTIONS.filter((opt) => S.optionAllowed(opt, model));
    el("optsBasic").innerHTML = visible.filter((opt) => opt.group === "basic").map((opt) => optionRow(opt, o)).join("");
    const more = visible.filter((opt) => opt.group === "more");
    el("optsMore").innerHTML = more.map((opt) => optionRow(opt, o)).join("");
    const chosen = more.filter((opt) => o.options[opt.id]).length;
    el("moreCount").textContent = chosen ? `(выбрано: ${chosen})` : `(${more.length})`;
    el("slideInstall").innerHTML = mode === "install" && !model.screen ? `
      <label class="opt ${o.groove ? "is-on" : ""}"><span><b>Штроба в полу под порог${demoTag({ source: "competitor" })}</b><small>при монтаже: порог вровень с полом, не спотыкаться</small></span>
        <span class="ctl">${rub(PRICING.groovePerM)}/п. м <input type="checkbox" data-check="groove" ${o.groove ? "checked" : ""}></span></label>` : "";
  }

  function render(o, { mode }) {
    syncView(o);
    renderModels(o);
    renderFinish(o);
    renderLock(o);
    renderConstruction(o);
    renderOptions(o, mode);
  }

  /** Summary rows of one priced position: [label, value, isSubLine]. */
  function summaryRows(item, mode) {
    return [
      [`Решётка (${item.qty} шт., ${item.area.toFixed(M2_DIGITS)} м²)`, rub(item.product)],
      ...(item.lowHeight ? [[`в т.ч. наценка за высоту < ${PRICING.lowHeightMm} мм`, "учтена", true]] : []),
      ["Замки и опции", item.extras ? rub(item.extras) : "—"],
      ...(mode === "install" ? [[`Монтаж, ${rub(PRICING.installPerM2)}/м²`, rub(item.install)]] : []),
    ];
  }

  /* ---------- Actions ---------- */

  const actions = {
    cat: (val) => { view = { ...view, cat: val }; return null; },
    model: (val) => ({ model: val }),
    finish: (val) => ({ finish: val }),
    patina: (val) => ({ patina: val }),
    lock: (val) => ({ lock: val }),
    lockQty: (_, delta, o) => ({ lockQty: clamp(o.lockQty + delta, 1, MAX_LOCKS) }),
    threshold: (val) => ({ threshold: val }),
    swivel: (val) => ({ swivel: val }),
    optQty: (val, delta, o) => {
      const opt = byId(OPTIONS, val);
      return { options: { ...o.options, [val]: clamp((o.options[val] || 0) + delta, 0, opt.maxQty || 1) } };
    },
    anim: (val) => {
      const model = byId(MODELS, val);
      window.UI.openDiagram((root) => window.GrilleAnim.mount(root, model.id, model.name));
      return null;
    },
  };

  function onCheck(key, checked, o) {
    if (key.startsWith("opt:")) return { options: { ...o.options, [key.slice(4)]: checked ? 1 : 0 } };
    return { [key]: checked };
  }

  /** Patch for a new position recommended by the advisor ({ cat }). */
  const fromAdvice = (target) => ({ model: CATEGORY_DEFAULT[target.cat] || "standard" });

  window.SlidingEditor = {
    kind: "sliding",
    name: "Раздвижная",
    root: "slidingSteps",
    limits: { maxWidth: PRICING.maxWidthMm, maxHeight: PRICING.maxHeightMm, maxQty: PRICING.maxQty },
    installPerM2: PRICING.installPerM2,
    variantName: (o) => byId(MODELS, o.model).name,
    grilleSvg, previewSvg, sizeNotes, render, summaryRows, actions, onCheck, fromAdvice,
  };
})();
