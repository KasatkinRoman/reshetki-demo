/*
 * Shared UI helpers: formatting, chips, file attachments, form validation, the ordering-mode
 * picker, the measurer form, checkout dialog, the diagram dialog and the sticky mobile total.
 * Nothing is sent anywhere: forms only show what the production version would do.
 */
(function () {
  const { ATTACHMENTS } = window.GrilleData;
  const MB = 1024 * 1024;
  const MAX_INPUT = 99999;
  const MIN_PHONE_DIGITS = 10;
  const MIN_ADDRESS_LEN = 5;

  const MODES = [
    { id: "self", name: "Знаю размеры, монтаж не нужен", note: "Изготовим по вашим размерам, доставим или отдадим самовывозом.", pay: "Оплата 70% на сайте, остаток при получении" },
    { id: "install", name: "Знаю размеры, нужен монтаж", note: "Привезём и установим. За точность размеров отвечаете вы.", pay: "Оплата 70% на сайте, остаток после монтажа" },
    { id: "measure", name: "Не знаю размеров", note: "Бесплатный замер — точную цену посчитает замерщик.", pay: "Оплата после замера" },
  ];

  const rub = (n) => new Intl.NumberFormat("ru-RU").format(Math.round(n)) + "\u00a0₽"; // no-break space before ₽
  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const demoTag = (item) => (item && item.source === "competitor" ? '<span class="demo-tag" title="Демо-цена: ориентир по конкурентам">демо</span>' : "");

  const chip = (act, val, label, pressed, extra = "") =>
    `<button type="button" class="chip" data-act="${act}" data-val="${val}" aria-pressed="${pressed}" ${extra}>${label}</button>`;

  function stepper(act, id, qty, max) {
    return `<span class="stepper" role="group" aria-label="Количество">
      <button type="button" data-act="${act}" data-val="${id}" data-delta="-1" aria-label="Меньше">−</button>
      <output>${qty}</output>
      <button type="button" data-act="${act}" data-val="${id}" data-delta="1" aria-label="Больше" ${qty >= max ? "disabled" : ""}>+</button>
    </span>`;
  }

  const syncInput = (input, value) => { if (document.activeElement !== input) input.value = value; };
  const readInt = (input) => {
    const value = parseInt(input.value, 10);
    return Number.isFinite(value) && value > 0 ? Math.min(value, MAX_INPUT) : 0;
  };

  function modesHtml(current) {
    return MODES.map((m) => `
      <button type="button" class="mode" data-act="mode" data-val="${m.id}" aria-pressed="${current === m.id}">
        <b>${m.name}</b><small>${m.note}</small><span class="mode-pay">${m.pay}</span>
      </button>`).join("");
  }

  /** Delegated clicks on [data-act] inside `root`, dispatched to `action(val, delta)`.
   * `actions` is an object of handlers or a function `act → handler | null`. */
  function delegate(root, actions) {
    const find = typeof actions === "function" ? actions : (act) => actions[act];
    root.addEventListener("click", (e) => {
      const target = e.target.closest("[data-act]");
      if (!target || target.disabled || !root.contains(target)) return;
      const action = find(target.dataset.act);
      if (!action) return;
      if (target.tagName !== "A") e.preventDefault();
      if (target.dataset.act === "remove") e.stopPropagation();
      const { act, val } = target.dataset;
      const hadFocus = document.activeElement === target;
      action(val, Number(target.dataset.delta || 0), target);
      // Steps are re-rendered with innerHTML; return keyboard focus to the same control.
      if (hadFocus && !target.isConnected && val !== undefined) {
        const same = root.querySelector(`[data-act="${CSS.escape(act)}"][data-val="${CSS.escape(val)}"]`);
        if (same) same.focus({ preventScroll: true });
      }
    });
  }

  /* ---------- Attachments (task files, drawings, photos) ---------- */

  const acceptedExt = ATTACHMENTS.accept.split(",");

  /** Mounts a file picker into `container`; returns a getter for the selected files. */
  function mountAttachments(container) {
    let files = [];
    let error = "";
    container.innerHTML = `
      <label class="attach"><input type="file" multiple accept="${ATTACHMENTS.accept}">
        <b>Прикрепить задание (ТЗ), чертёж или фото</b><br>или перетащите файлы сюда · до ${ATTACHMENTS.maxFiles} файлов, ${ATTACHMENTS.maxTotalMb} МБ</label>
      <ul class="files"></ul><div class="err" role="alert"></div>`;
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
        remove.setAttribute("aria-label", `Убрать файл ${f.name}`);
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

  const phoneOk = (v) => v.replace(/\D/g, "").length >= MIN_PHONE_DIGITS;
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

  /** Builds the «call a measurer» panel into `container`. */
  function mountMeasurePanel(container, prefix, placeholder) {
    container.innerHTML = `
      <div class="card">
        <h3 style="margin-bottom:8px">Вызвать замерщика</h3>
        <p class="sub" style="margin-bottom:16px">Перезвоним в течение часа в рабочее время и согласуем день.</p>
        <form class="form-grid" novalidate>
          <label class="field">Имя<input type="text" name="name" autocomplete="name" required></label>
          <label class="field">Телефон<input type="tel" name="phone" autocomplete="tel" placeholder="+7" required></label>
          <label class="field">Адрес объекта<input type="text" name="address" autocomplete="street-address" required></label>
          <label class="field">Что нужно закрыть решётками<textarea name="comment" placeholder="${esc(placeholder)}"></textarea></label>
          <div data-attach></div>
          <label class="toggle"><input type="checkbox" name="consent"> Согласен на обработку персональных данных</label>
          <div class="err" role="alert"></div>
          <button class="btn btn-accent" type="submit">Вызвать замерщика</button>
          <div class="result" role="status" hidden></div>
        </form>
      </div>
      <div class="card">
        <h3 style="margin-bottom:12px">Как проходит замер</h3>
        <ul class="check-list">
          <li>Замер бесплатный, по Москве и области.</li>
          <li>Замерщик привезёт образцы и поможет выбрать модель, открывание и опции.</li>
          <li>На месте посчитает точную цену — она фиксируется в договоре.</li>
          <li>После замера пришлём ссылку на оплату 70% — картой или по СБП.</li>
          <li>Монтаж — в согласованный день, остаток 30% после монтажа.</li>
        </ul>
      </div>`;
    const form = container.querySelector("form");
    form.id = `${prefix}MeasureForm`;
    bindForm(form, [need("name", "Укажите имя."), needPhone, need("address", "Укажите адрес объекта."), needConsent],
      (f, files) => `<b>Заявка на замер принята</b><span class="hint">Перезвоним в течение часа в рабочее время.${filesNote(files)}</span>`);
  }

  /* ---------- Checkout (one for the whole order) ----------
   * Production version creates a YooKassa payment for the prepayment on the server and
   * redirects to its confirmation_url; the order and files go to the sales inbox. */

  let order = null; // snapshot of the order being paid: { title, positions, total, prepay, rest, pieces, mode, needsAddress }
  const dlg = el("checkout");
  const checkoutForm = el("checkoutForm");
  const isOrg = (form) => form.elements.payer.value === "org";
  const innError = (form) => (isOrg(form) ? window.Inn.validateInn(value(form, "inn")).message : "");

  const checkout = bindForm(checkoutForm, [
    (form) => (isOrg(form) && value(form, "orgName").length < 2 ? "Укажите название организации." : ""),
    innError,
    need("name", "Укажите имя."),
    needPhone,
    (form) => (emailOk(value(form, "email")) ? "" : `Укажите почту — на неё придёт ${isOrg(form) ? "счёт" : "чек"}.`),
    (form) => (order.needsAddress && value(form, "address").length < MIN_ADDRESS_LEN ? "Укажите адрес доставки или монтажа." : ""),
    (form) => (checked(form, "sizes") ? "" : "Подтвердите, что размеры указаны верно."),
    needConsent,
  ], (form, files) => (isOrg(form)
    ? `<b>Спасибо! Счёт на ${rub(order.prepay)} пришлём на почту в течение рабочего дня (заглушка прототипа)</b>
    <span class="hint">${esc(value(form, "orgName"))}, ИНН ${esc(value(form, "inn"))}. Почта: ${esc(value(form, "email"))}.${filesNote(files)}</span>`
    : `<b>Здесь откроется страница оплаты ЮKassa</b>
    <span class="hint">Сумма ${rub(order.prepay)} — карта, СБП, SberPay. Чек придёт на ${esc(value(form, "email"))}.${filesNote(files)}</span>`));

  /** Texts and fields that depend on the payer (person pays by card, organisation gets an invoice). */
  function applyPayer() {
    const org = isOrg(checkoutForm);
    el("orgFields").hidden = !org;
    el("emailLabel").textContent = org ? "Почта для счёта" : "Почта для чека";
    el("payBtn").textContent = org ? "Получить счёт на оплату" : `Оплатить ${rub(order.prepay)} через ЮKassa`;
    el("dlgSum").textContent = checkoutSummaryText(org);
    checkout.reset();
  }

  function checkoutSummaryText(org) {
    const rest = order.mode === "install" ? "после монтажа" : "при получении";
    return `${order.title}: позиций ${order.positions}, ${order.pieces} шт. на ${rub(order.total)}. `
      + `${org ? "Предоплата по счёту" : "Сейчас оплачиваете"} ${rub(order.prepay)}, ${rub(order.rest)} — ${rest}.`;
  }

  function openCheckout(summary) {
    order = summary;
    el("addrField").hidden = !summary.needsAddress;
    applyPayer();
    dlg.showModal();
  }
  checkoutForm.querySelectorAll('input[name="payer"]').forEach((r) => r.addEventListener("change", applyPayer));
  checkoutForm.querySelector('[data-flow="close"]').addEventListener("click", () => dlg.close());

  bindForm(el("feedbackForm"), [
    need("name", "Укажите имя или компанию."),
    (form) => (phoneOk(value(form, "phone")) || emailOk(value(form, "email")) ? "" : "Оставьте телефон или почту для ответа."),
    (form) => (value(form, "inn") ? window.Inn.validateInn(value(form, "inn")).message : ""),
    (form, files) => (value(form, "comment") || files.length ? "" : "Напишите сообщение или прикрепите задание (ТЗ)."),
    needConsent,
  ], (form, files) => `<b>Отправлено</b><span class="hint">Посчитаем и пришлём расчёт (КП)${checked(form, "invoice") ? ", счёт или договор" : ""} в течение рабочего дня.${filesNote(files)}</span>`);

  /* ---------- Sticky mobile total ----------
   * The order calculator registers its section and a getter returning its checkout summary
   * (or null in the «measure» mode / for an empty order). The bar shows while the section is on screen. */

  let source = null;

  function refreshMobileTotal() {
    const summary = source && source.visible && source.get();
    el("mobileTotal").hidden = !summary;
    document.body.classList.toggle("has-total", Boolean(summary));
    if (!summary) return;
    el("mTitle").textContent = summary.short;
    el("mTotal").textContent = rub(summary.total);
    el("mPrepay").textContent = rub(summary.prepay);
    // Keep the page content clear of the fixed bar whatever height it has on this screen.
    document.body.style.setProperty("--total-h", `${el("mobileTotal").offsetHeight}px`);
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (source && entry.target === source.section) source = { ...source, visible: entry.isIntersecting }; });
    refreshMobileTotal();
  });

  function registerTotal(section, get) {
    source = { section, get, visible: false };
    observer.observe(section);
  }

  el("mCheckout").addEventListener("click", () => {
    const summary = source && source.get();
    if (summary) openCheckout(summary);
  });

  /* ---------- Diagram dialog («Как устроено») ----------
   * `draw(root)` fills the dialog body and may return a function that stops its animation. */

  const diagram = el("grilleDialog");
  let stopDiagram = null;

  function openDiagram(draw) {
    const root = el("grilleAnim");
    root.className = "";
    stopDiagram = draw(root) || null;
    diagram.showModal();
  }

  diagram.addEventListener("close", () => {
    if (stopDiagram) stopDiagram();
    stopDiagram = null;
    el("grilleAnim").innerHTML = "";
  });
  diagram.querySelector(".dlg-close").addEventListener("click", () => diagram.close());

  window.UI = {
    MODES, rub, el, esc, demoTag, chip, stepper, syncInput, readInt, modesHtml, delegate,
    mountMeasurePanel, openCheckout, registerTotal, refreshMobileTotal, openDiagram,
  };
})();
