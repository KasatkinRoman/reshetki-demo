/* Editor of one welded position: opening variant, pattern, mount, lock and paint.
 * Renders into the static #weldSteps skeleton; prices come from calc-weld.js (WELD in data.js).
 * Actions return a patch for the active position; order-ui.js applies it to the shared order. */
(function () {
  const W = window.GrilleData.WELD;
  const CW = window.CalcWeld;
  const { byId } = window.CalcCommon;
  const { rub, el, demoTag, chip } = window.UI;
  const M2_DIGITS = 2;
  const MM2_IN_M2 = 1e6;

  const typeOf = (o) => byId(W.openings, o.type);

  /** «5 500 ₽/м²» or «5 500 ₽/м² + 4 000 ₽ за открывание». */
  const typePrice = (t) => `${rub(W.basePerM2)}/м²${t.openPrice ? ` + ${rub(t.openPrice)}` : ""}`;

  const previewSvg = (o) => window.WeldAnim.svg({ type: o.type, hinge: o.hinge, pattern: o.pattern, decorative: true });

  function sizeNotes(o) {
    const tooSmall = o.width < W.minSizeMm || o.height < W.minSizeMm;
    const tooBig = o.width > W.maxWidthMm || o.height > W.maxHeightMm;
    const area = (CW.pricedWidth(o) * CW.pricedHeight(o)) / MM2_IN_M2;
    const notes = [];
    if (tooSmall) notes.push(`Минимальный размер — ${W.minSizeMm} мм, считаем по нему.`);
    if (tooBig) notes.push(`Больше ${W.maxWidthMm}×${W.maxHeightMm} мм — посчитаем индивидуально, отправьте ТЗ.`);
    if (!tooSmall && area < W.minAreaM2) notes.push(`Площадь меньше ${W.minAreaM2} м² считаем как ${W.minAreaM2} м².`);
    if (o.type === "hatch" && !CW.hatchFits(o)) {
      notes.push(`Люк ${W.hatch.widthMm}×${W.hatch.heightMm} мм не помещается в такой проём — посмотрите вариант «Одна створка».`);
    }
    return { text: notes.join(" "), warn: notes.length > 0 };
  }

  function renderTypes(o) {
    el("wTypes").innerHTML = W.openings.map((t) => `
      <button type="button" class="type-card" data-act="type" data-val="${t.id}" aria-pressed="${o.type === t.id}">
        ${window.WeldAnim.svg({ type: t.id, hinge: t.id === "single" ? o.hinge : "left", pattern: "grid", decorative: true })}
        <b>${t.name}</b><span>${t.short}</span><span class="p">${typePrice(t)}</span>
      </button>`).join("");
    const type = typeOf(o);
    el("wHinge").innerHTML = type.hingeChoice
      ? `<div class="sub-title">Сторона петель (смотрим с улицы)</div><div class="chips" role="group" aria-label="Сторона петель">${W.hinges.map((h) => chip("hinge", h.id, h.name, o.hinge === h.id)).join("")}</div>`
      : "";
    el("wTypeAbout").innerHTML = `<p><b>${type.name}:</b> ${type.about} <b>Кому подходит:</b> ${type.fits}`
      + (type.id === "hatch" ? ` <b>Размер люка:</b> ${W.hatch.widthMm}×${W.hatch.heightMm} мм — уточняем на замере.` : "")
      + `</p><button type="button" class="btn btn-ghost btn-sm" data-act="anim" data-val="${type.id}">▶ Как открывается</button>`;
  }

  function renderPatterns(o) {
    el("wPatterns").innerHTML = W.patterns.map((p) => `
      <button type="button" class="pattern-card" data-act="pattern" data-val="${p.id}" aria-pressed="${o.pattern === p.id}">
        ${window.WeldAnim.patternPreview(p.id)}
        <b>${p.name}</b><span>${p.hint}</span><span class="p">${p.perM2 ? `+${rub(p.perM2)}/м²` : "в цене"}</span>
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
    const locks = W.locks.map((l) => chip("lock", l.id, l.name + (l.price ? ` — ${rub(l.price)}` : ""), o.lock === l.id)).join("");
    el("wLock").innerHTML = `<div class="chips" role="group" aria-label="Замок">${locks}</div>
      <label class="opt ${o.eyelets ? "is-on" : ""}" style="margin-top:10px">
        <span><b>${W.eyelets.name}</b><small>можно запирать без врезного замка</small></span>
        <span class="ctl">${rub(W.eyelets.price)} <input type="checkbox" data-check="eyelets" ${o.eyelets ? "checked" : ""}></span>
      </label>
      <p class="hint">Если через эту решётку возможна эвакуация, изнутри она должна открываться без ключа — подберём такой замок или запор.</p>`;
  }

  function renderFinish(o) {
    el("wFinish").innerHTML = `<div class="chips" role="group" aria-label="Покраска">${W.finishes.map((f) =>
      chip("finish", f.id, `${f.name} — +${rub(f.perM2)}/м²`, o.finish === f.id)).join("")}</div>
      <p class="hint">${byId(W.finishes, o.finish).hint}. Любой цвет RAL — без доплаты: укажите номер в комментарии к заказу.</p>`;
  }

  function render(o) {
    renderTypes(o);
    renderPatterns(o);
    renderMount(o);
    renderLock(o);
    renderFinish(o);
  }

  /** Summary rows of one priced position: [label, value, isSubLine]. */
  function summaryRows(item, mode) {
    return [
      [`Решётка (${item.qty} шт., ${item.area.toFixed(M2_DIGITS)} м²)`, rub(item.product)],
      ...(item.pattern ? [["в т.ч. рисунок", rub(item.pattern), true]] : []),
      ...(item.opening ? [["в т.ч. открывание", rub(item.opening), true]] : []),
      ...(item.topUp ? [[`в т.ч. до минимума ${rub(W.minProductPrice)}`, rub(item.topUp), true]] : []),
      ["Покраска", rub(item.paint)],
      ["Замки и проушины", item.hardware ? rub(item.hardware) : "—"],
      ...(mode === "install" ? [[`Монтаж, ${rub(W.installPerM2)}/м²`, rub(item.install)]] : []),
    ];
  }

  /** Big scheme with «Открыть / Закрыть» for the shared diagram dialog. */
  function openScheme(typeId, o) {
    const type = byId(W.openings, typeId);
    window.UI.openDiagram((root) => {
      root.innerHTML = `<div class="hg-head"><div><p class="hg-title">${type.name}: как открывается</p>
        <p class="hg-hint">Пунктир сходится к стороне петель.</p></div></div>
        ${window.WeldAnim.scheme({ type: type.id, hinge: type.id === "single" ? o.hinge : "left", pattern: o.pattern })}
        <p class="hint">${type.about}</p>`;
      root.classList.add("hg-wrap");
      return null;
    });
  }

  const actions = {
    type: (val) => ({ type: val }),
    hinge: (val) => ({ hinge: val }),
    pattern: (val) => ({ pattern: val }),
    mount: (val) => ({ mount: val }),
    lock: (val) => ({ lock: val }),
    finish: (val) => ({ finish: val }),
    anim: (val, _, o) => { openScheme(val, o); return null; },
  };

  const onCheck = (key, checked) => ({ [key]: checked });
  const fromAdvice = (target) => ({ type: target.type });

  window.WeldEditor = {
    kind: "weld",
    name: "Сварная",
    root: "weldSteps",
    limits: { maxWidth: W.maxWidthMm, maxHeight: W.maxHeightMm, maxQty: W.maxQty },
    installPerM2: W.installPerM2,
    variantName: (o) => typeOf(o).name,
    previewSvg, sizeNotes, render, summaryRows, actions, onCheck, fromAdvice,
  };
})();
