/* The «Заказ» calculator: one order with sliding and welded positions.
 * Holds the only order state; everything shared lives here (ordering mode, position tabs,
 * size step, one delivery, one summary, checkout and the mobile total). Type-specific steps
 * are rendered by SlidingEditor / WeldEditor; prices come from calc-order.js. */
(function () {
  const D = window.GrilleData;
  const St = window.OrderState;
  const { calcOrder } = window.CalcOrder;
  const { clamp, allowedDelivery } = window.CalcCommon;
  const { rub, el, esc, demoTag, chip, syncInput, readInt, modesHtml } = window.UI;
  const EDITORS = { sliding: window.SlidingEditor, weld: window.WeldEditor };
  const KIND_PLURAL = { sliding: "Раздвижные", weld: "Сварные" };

  let order = St.createOrder();

  const active = () => order.positions[order.active] || null;
  const editorOf = (p) => EDITORS[p.kind];

  function commit(next) {
    order = next;
    render();
  }

  const updateActive = (patch) => commit(St.updatePosition(order, order.active, patch));

  /* ---------- Rendering ---------- */

  function positionTitle(p, i) {
    return `${i + 1}. ${editorOf(p).name} ${p.width}×${p.height}${p.qty > 1 ? ` ×${p.qty}` : ""}`;
  }

  function renderTabs() {
    el("tabs").innerHTML = order.positions.map((p, i) => `
      <button type="button" class="tab tab-${p.kind}" role="tab" aria-selected="${i === order.active}" data-act="tab" data-val="${i}">
        ${esc(positionTitle(p, i))}
        <span class="x" data-act="remove" data-val="${i}" aria-hidden="true" title="Удалить позицию">×</span>
      </button>`).join("");
    el("tabs").hidden = order.positions.length === 0;
  }

  function renderSize(p) {
    const ed = editorOf(p);
    el("kindSwitch").innerHTML = Object.values(EDITORS).map((e) => chip("kind", e.kind, e.name, p.kind === e.kind)).join("");
    el("editorTitle").textContent = `Позиция ${order.active + 1}: ${ed.variantName(p)}`;
    [["width", ed.limits.maxWidth, p.width], ["height", ed.limits.maxHeight, p.height], ["qty", ed.limits.maxQty, p.qty]]
      .forEach(([id, max, value]) => { el(id).max = max; syncInput(el(id), value); });
    const notes = ed.sizeNotes(p);
    el("sizeHint").textContent = notes.text;
    el("sizeHint").classList.toggle("warn", notes.warn);
    el("removeActive").dataset.val = String(order.active);
  }

  function renderEditor(p) {
    Object.values(EDITORS).forEach((e) => { el(e.root).hidden = e.kind !== p.kind; });
    editorOf(p).render(p, { mode: order.mode });
  }

  function renderDelivery() {
    const install = order.mode === "install";
    el("deliveryTitle").textContent = install ? "Монтаж и доставка" : "Доставка";
    el("delivery").innerHTML = allowedDelivery(order.mode).map((d) => {
      const price = d.perKm ? `${rub(d.price)} + ${d.perKm} ₽/км` : rub(d.price);
      return chip("delivery", d.id, `${d.name} — ${price}${demoTag(d)}`, order.delivery === d.id);
    }).join("");
    el("kmField").hidden = order.delivery !== "region";
    syncInput(el("km"), order.km);
    const kinds = [...new Set(order.positions.map((p) => p.kind))];
    const rates = kinds.map((k) => `${KIND_PLURAL[k].toLowerCase()} — ${rub(EDITORS[k].installPerM2)}/м²`).join(", ");
    el("installRates").innerHTML = install && kinds.length
      ? `<p class="hint install-rates"><b>Монтаж:</b> ${rates}. Фиксированная ставка за м², не процент; анкеры включены.</p>` : "";
  }

  function summaryHtml(t) {
    const rows = t.items.flatMap((item, i) => {
      const p = order.positions[i];
      const head = `<li class="pos-head"><span>${esc(positionTitle(p, i))} · ${esc(editorOf(p).variantName(p))}</span><span>${rub(item.subtotal)}</span></li>`;
      const lines = editorOf(p).summaryRows(item, order.mode)
        .map(([k, v, sub]) => `<li${sub ? ' class="sub-line"' : ""}><span>${k}</span><span>${v}</span></li>`);
      return [head, ...lines];
    });
    const common = [
      ["Доставка (одна на заказ)", rub(t.delivery)],
      ["Замер", "не нужен — ваши размеры"],
    ].map(([k, v]) => `<li class="common"><span>${k}</span><span>${v}</span></li>`);
    return [...rows, ...common].join("");
  }

  function renderSummary(p) {
    const t = calcOrder(order);
    el("preview").innerHTML = p ? editorOf(p).previewSvg(p) : "";
    el("preview").hidden = !p;
    el("lines").innerHTML = p ? summaryHtml(t) : '<li class="empty-line"><span>Добавьте первую позицию — раздвижную или сварную решётку.</span></li>';
    el("total").textContent = rub(t.total);
    el("prepay").textContent = rub(t.prepay);
    el("rest").textContent = rub(t.rest);
    el("restLabel").textContent = order.mode === "install" ? "После монтажа 30%" : "При получении 30%";
    el("toCheckout").disabled = !p;
  }

  function renderNotice() {
    el("sizeNotice").innerHTML = order.mode === "install"
      ? 'Вы указываете размеры сами — <b>ответственность за их точность на вас</b>. Не уверены? <a href="#order" data-act="mode" data-val="measure">Вызовите замерщика</a>.'
      : 'Изготовим строго по вашим размерам — <b>ответственность за их точность на вас</b>. Размеры — в миллиметрах.';
  }

  function render() {
    el("modes").innerHTML = modesHtml(order.mode);
    const measuring = order.mode === "measure";
    el("calcPanel").hidden = measuring;
    el("measurePanel").hidden = !measuring;
    if (!measuring) {
      const p = active();
      renderNotice();
      renderTabs();
      el("emptyState").hidden = Boolean(p);
      el("editor").hidden = !p;
      if (p) {
        renderSize(p);
        renderEditor(p);
      }
      renderDelivery();
      renderSummary(p);
    }
    window.UI.refreshMobileTotal();
  }

  /* ---------- Public entry points (hero cards and the advisor) ---------- */

  const leaveMeasure = (o) => (o.mode === "measure" ? St.setOrder(o, { mode: "install" }) : o);
  const scrollToOrder = () => el("order").scrollIntoView({ behavior: "smooth" });

  /** Hero card: opens the first position of this kind, or adds one. */
  function enter(kind) {
    const index = order.positions.findIndex((p) => p.kind === kind);
    const base = leaveMeasure(order);
    commit(index >= 0 ? St.setOrder(base, { active: index }) : St.addPosition(base, kind));
    scrollToOrder();
  }

  /** Advisor: puts the recommended type and variant into a new position (or the untouched active one). */
  function advise(target) {
    const patch = EDITORS[target.kind].fromAdvice(target);
    const base = leaveMeasure(order);
    const p = base.positions[base.active];
    commit(p && p.pristine ? St.replacePosition(base, base.active, target.kind, patch) : St.addPosition(base, target.kind, patch));
    scrollToOrder();
  }

  /* ---------- Events ---------- */

  const common = {
    mode: (val) => commit(St.setOrder(order, { mode: val })),
    tab: (val) => commit(St.setOrder(order, { active: Number(val) })),
    remove: (val) => commit(St.removePosition(order, Number(val))),
    add: (val) => commit(St.addPosition(order, val)),
    kind: (val) => commit(St.changeKind(order, order.active, val)),
    delivery: (val) => commit(St.setOrder(order, { delivery: val })),
  };

  /* Common actions first, then the active position's editor; a returned patch edits that position. */
  function resolve(act) {
    if (common[act]) return common[act];
    const p = active();
    const handler = p && editorOf(p).actions[act];
    if (!handler) return null;
    return (val, delta) => {
      const patch = handler(val, delta, p);
      if (patch) updateActive(patch);
      else render();
    };
  }

  window.UI.delegate(el("order"), resolve);

  el("order").addEventListener("change", (e) => {
    const key = e.target.dataset && e.target.dataset.check;
    const p = active();
    if (key && p) updateActive(editorOf(p).onCheck(key, e.target.checked, p));
  });

  el("width").addEventListener("input", (e) => updateActive({ width: readInt(e.target) }));
  el("height").addEventListener("input", (e) => updateActive({ height: readInt(e.target) }));
  el("qty").addEventListener("input", (e) => {
    const p = active();
    updateActive({ qty: clamp(readInt(e.target) || 1, 1, editorOf(p).limits.maxQty) });
  });
  el("km").addEventListener("input", (e) => commit(St.setOrder(order, { km: clamp(readInt(e.target), 0, D.MAX_KM) })));

  /* ---------- Checkout and the mobile total ---------- */

  const needsAddress = () => order.mode === "install" || ["moscow", "region"].includes(order.delivery);

  function checkoutTitle() {
    const kinds = [...new Set(order.positions.map((p) => p.kind))];
    return kinds.length > 1 ? "Раздвижные и сварные решётки" : `${KIND_PLURAL[kinds[0]]} решётки`;
  }

  function summary() {
    if (order.mode === "measure" || !order.positions.length) return null;
    const t = calcOrder(order);
    const n = order.positions.length;
    return {
      title: checkoutTitle(), short: `${n} поз.`, positions: n,
      total: t.total, prepay: t.prepay, rest: t.rest, pieces: t.pieces, mode: order.mode, needsAddress: needsAddress(),
    };
  }

  el("toCheckout").addEventListener("click", () => {
    const s = summary();
    if (s) window.UI.openCheckout(s);
  });
  window.UI.registerTotal(el("order"), summary);
  window.UI.mountMeasurePanel(el("measurePanel"), "order", "Например: 3 окна на первом этаже, одно с люком, и раздвижная решётка на дверь магазина");

  render();

  window.OrderUI = { enter, advise, getOrder: () => order };
})();
