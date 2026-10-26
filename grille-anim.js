/*
 * Interactive diagram of a sliding grille: drag the end post (or use the arrow keys),
 * "Открыть" / "Закрыть", and "Как устроено" with moving labels and explanation cards.
 * Based on the owner's grille.html sample; every model in data.js has its own KIND.
 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const ACCENT = "#f2a516"; // styles.css --accent
  const N = 10;
  const X0 = 48;
  const XMAX = 740;
  const KEY_STEP = 40;
  const PALETTES = {
    paint: { post: ["#7d868b", "#c9d0d3"], bars: ["#8a9397", "#a5adb1"], dark: "#5b6367", line: "#6f787d", rail: ["#c9d0d3", "#7d868b"] },
    steel: { post: ["#9aa4aa", "#f1f4f6"], bars: ["#b4bcc1", "#d6dcdf"], dark: "#7b858b", line: "#8d969b", rail: ["#eef2f4", "#9aa4aa"] },
    patina: { post: ["#3e3124", "#b8924c"], bars: ["#5c4630", "#9a7840"], dark: "#2f251b", line: "#4a3a2a", rail: ["#9a7840", "#4a3a2a"] },
  };

  /* support: "top" — hung on carriages in the top rail; "bottom" — rolls on a bottom roller; "wheels" — free-standing screen. */
  const KINDS = {
    econom: { support: "bottom", rollers: 1, rows: 4, postW: 12, barW: 5, palette: "paint", lock: "lock",
      cards: ["bottomRoller", "topGuide", "scissors", "lock"] },
    standard: { support: "top", rollers: 1, rows: 5, postW: 14, barW: 6, palette: "paint", lock: "lock",
      cards: ["topCarriage", "bottomPin", "scissors", "lock"] },
    silent: { support: "top", rollers: 2, rows: 5, postW: 14, barW: 6, palette: "paint", lock: "lock",
      cards: ["twinCarriage", "bottomPin", "scissors", "lock"] },
    strong: { support: "top", rollers: 2, rows: 6, postW: 18, barW: 7, palette: "paint", lock: "lock", heavy: true,
      cards: ["twinCarriage", "heavyFrame", "scissors", "lock"] },
    bank: { support: "top", rollers: 2, rows: 7, postW: 22, barW: 8, palette: "paint", lock: "bankLock", heavy: true,
      cards: ["twinCarriage", "bankPost", "heavyFrame", "bankLock"] },
    screen: { support: "wheels", rollers: 0, rows: 5, postW: 12, barW: 5, palette: "paint", lock: "latch",
      cards: ["wheel", "noRails", "scissors", "latch"] },
    art: { support: "top", rollers: 1, rows: 5, postW: 14, barW: 6, palette: "patina", lock: "lock", decor: true,
      cards: ["topCarriage", "patina", "scissors", "lock"] },
    steel: { support: "top", rollers: 1, rows: 5, postW: 14, barW: 6, palette: "steel", lock: "lock",
      cards: ["topCarriage", "stainless", "scissors", "lock"] },
  };

  const POST = 'fill="#c9d0d3" stroke="#555d61" stroke-width="2"';
  const ROLLER = 'fill="#e6eaec" stroke="#555d61" stroke-width="2"';
  const CARDS = {
    topCarriage: ["Верхняя направляющая и каретка",
      `<path d="M30 20H170V70H150V40H50V70H30Z" ${POST}/><rect x="80" y="44" width="40" height="14" rx="3" fill="${ACCENT}"/>
       <circle cx="68" cy="62" r="10" ${ROLLER}/><circle cx="132" cy="62" r="10" ${ROLLER}/>
       <rect x="94" y="58" width="12" height="40" fill="#6f787d"/><rect x="86" y="98" width="28" height="50" ${POST}/>`,
      "Каждая стойка подвешена на каретке с роликами. Ролики катятся внутри закрытого профиля — решётка идёт легко и не выпадает."],
    twinCarriage: ["Каретка с двумя роликами",
      `<path d="M20 20H180V70H160V40H40V70H20Z" ${POST}/><rect x="60" y="44" width="80" height="14" rx="3" fill="${ACCENT}"/>
       <circle cx="52" cy="62" r="10" ${ROLLER}/><circle cx="82" cy="62" r="10" ${ROLLER}/>
       <circle cx="118" cy="62" r="10" ${ROLLER}/><circle cx="148" cy="62" r="10" ${ROLLER}/>
       <rect x="94" y="58" width="12" height="40" fill="#6f787d"/><rect x="86" y="98" width="28" height="50" ${POST}/>`,
      "Вес стойки распределён на два ролика, а ползуны гасят люфт. Поэтому ход плавный и почти бесшумный даже у тяжёлой решётки."],
    bottomPin: ["Нижняя направляющая",
      `<rect x="86" y="10" width="28" height="80" ${POST}/><rect x="96" y="90" width="8" height="28" fill="${ACCENT}"/>
       <path d="M40 140V108H90V128H110V108H160V140Z" ${POST}/>`,
      "Штырь внизу стойки идёт по пазу в полу: стойки не болтаются, и решётку нельзя отжать снизу."],
    bottomRoller: ["Нижний ролик",
      `<rect x="86" y="10" width="28" height="74" ${POST}/><rect x="94" y="84" width="12" height="12" fill="#6f787d"/>
       <circle cx="100" cy="108" r="14" fill="${ACCENT}" stroke="#555d61" stroke-width="2"/>
       <path d="M40 140V112H72V126H128V112H160V140Z" ${POST}/>`,
      "Здесь вес решётки лежит на роликах внизу — они катятся по нижней направляющей. Конструкция проще и дешевле, но порог из направляющей заметнее."],
    topGuide: ["Верхняя направляющая",
      `<path d="M30 20H170V60H150V40H50V60H30Z" ${POST}/><rect x="96" y="34" width="8" height="30" fill="${ACCENT}"/>
       <rect x="86" y="64" width="28" height="80" ${POST}/>`,
      "Сверху стойки только держатся штырями в направляющей, чтобы не завалиться. Тянуть решётку легко: вес она держит снизу."],
    scissors: ["Ножницы и шарнирные заклёпки",
      `<line x1="40" y1="20" x2="160" y2="130" stroke="#8a9397" stroke-width="10" stroke-linecap="round"/>
       <line x1="160" y1="20" x2="40" y2="130" stroke="#a5adb1" stroke-width="10" stroke-linecap="round"/>
       <circle cx="100" cy="75" r="8" fill="${ACCENT}" stroke="#fff" stroke-width="2"/>
       <circle cx="40" cy="20" r="6" fill="${ACCENT}"/><circle cx="160" cy="130" r="6" fill="${ACCENT}"/>
       <circle cx="160" cy="20" r="6" fill="${ACCENT}"/><circle cx="40" cy="130" r="6" fill="${ACCENT}"/>`,
      "Планки соединены заклёпками в центре и на стойках. При сдвиге меняется только угол: ромбы сжимаются, и решётка складывается в пакет."],
    lock: ["Замок и ручка",
      `<rect x="70" y="10" width="28" height="130" ${POST}/><rect x="120" y="10" width="20" height="130" fill="#8a9397" stroke="#555d61"/>
       <rect x="98" y="60" width="26" height="22" rx="3" fill="${ACCENT}"/><circle cx="111" cy="71" r="4" fill="#fff"/>`,
      "Крайняя стойка с ручкой заходит в ответную планку на раме и запирается замком."],
    bankLock: ["Банковский ригельный замок",
      `<rect x="56" y="10" width="40" height="130" ${POST}/><rect x="128" y="10" width="22" height="130" fill="#8a9397" stroke="#555d61"/>
       <rect x="90" y="48" width="34" height="46" rx="3" fill="${ACCENT}"/>
       <rect x="120" y="56" width="22" height="8" fill="#555d61"/><rect x="120" y="78" width="22" height="8" fill="#555d61"/>
       <circle cx="107" cy="71" r="4" fill="#fff"/>`,
      "Несколько ригелей уходят глубоко в ответную планку. Такой замок рассчитан на I класс защиты."],
    heavyFrame: ["Усиленная рама",
      `<rect x="30" y="20" width="60" height="40" fill="none" stroke="#555d61" stroke-width="10"/>
       <rect x="120" y="30" width="20" height="20" fill="#8a9397" stroke="#555d61" stroke-width="2"/>
       <text x="60" y="84" text-anchor="middle" font-size="12">рама 60×40</text><text x="130" y="84" text-anchor="middle" font-size="12">стойка</text>
       <rect x="30" y="100" width="140" height="10" fill="${ACCENT}"/><text x="100" y="132" text-anchor="middle" font-size="12">анкеры в стену</text>`,
      "Толстостенный профиль рамы и массивные стойки: решётку не выгнуть ломом и не вырвать из проёма."],
    bankPost: ["Стойки из стальной полосы",
      `<rect x="40" y="20" width="16" height="110" fill="#8a9397" stroke="#555d61" stroke-width="2"/>
       <rect x="92" y="20" width="16" height="110" fill="#8a9397" stroke="#555d61" stroke-width="2"/>
       <rect x="144" y="20" width="16" height="110" fill="#8a9397" stroke="#555d61" stroke-width="2"/>
       <line x1="48" y1="40" x2="152" y2="110" stroke="${ACCENT}" stroke-width="8"/><line x1="152" y1="40" x2="48" y2="110" stroke="${ACCENT}" stroke-width="8"/>`,
      "Стойки — полоса 40×6 мм, ячейка мельче. Сквозь решётку нельзя просунуть руку или инструмент."],
    wheel: ["Колёсные опоры",
      `<rect x="86" y="10" width="28" height="90" ${POST}/><path d="M84 100H116L110 116H90Z" fill="#6f787d"/>
       <circle cx="100" cy="126" r="14" fill="${ACCENT}" stroke="#555d61" stroke-width="2"/><line x1="20" y1="142" x2="180" y2="142" stroke="#555d61" stroke-width="3"/>`,
      "Ширма катится по полу на колёсах. Её можно отодвинуть в любое место и переставить в другой проём."],
    noRails: ["Без направляющих",
      `<line x1="20" y1="30" x2="180" y2="30" stroke="#c9d0d3" stroke-width="6" stroke-dasharray="10 8"/>
       <line x1="20" y1="130" x2="180" y2="130" stroke="#c9d0d3" stroke-width="6" stroke-dasharray="10 8"/>
       <text x="100" y="86" text-anchor="middle" font-size="14" fill="#2b2f33">ничего не крепится</text>`,
      "Ни к полу, ни к потолку ничего не прикручивают. Ширма декоративная: она отделяет пространство, но не защищает от взлома."],
    latch: ["Фиксатор и ручка",
      `<rect x="70" y="10" width="28" height="130" ${POST}/><rect x="98" y="62" width="30" height="10" rx="3" fill="${ACCENT}"/>
       <circle cx="130" cy="67" r="6" fill="${ACCENT}"/>`,
      "Ширму удобно тянуть за ручку на крайней стойке. Фиксатор держит её в нужном положении."],
    patina: ["Окраска с патиной",
      `<rect x="20" y="20" width="160" height="110" rx="8" fill="#3e3124"/>
       <path d="M20 60Q60 30 100 60T180 60" stroke="#b8924c" stroke-width="10" fill="none"/>
       <path d="M20 100Q60 70 100 100T180 100" stroke="#d6b06a" stroke-width="6" fill="none"/>`,
      "Сначала тёмная база, затем по выступам — золото, серебро, бронза или медь. Металл выглядит состаренным и подходит к интерьеру."],
    stainless: ["Нержавеющая сталь",
      `<rect x="20" y="20" width="160" height="110" rx="8" fill="#c9d0d3"/>
       <g stroke="#eef2f4" stroke-width="2">${[30, 44, 58, 72, 86, 100, 114].map((y) => `<line x1="28" y1="${y}" x2="172" y2="${y}"/>`).join("")}</g>`,
      "Матовая сталь AISI 304 не окрашивается, поэтому нечему облезать. Не ржавеет на фасаде и во влажных помещениях."],
  };

  function create(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    parent.appendChild(node);
    return node;
  }

  function geometry(kind) {
    if (kind.support === "bottom") return { top: 37, bot: 384, frame: true };
    if (kind.support === "wheels") return { top: 30, bot: 384, frame: false };
    return { top: 47, bot: 398, frame: true };
  }

  function gradient(defs, id, stops, attrs) {
    const node = create("linearGradient", { id, ...attrs }, defs);
    stops.forEach(([offset, color]) => create("stop", { offset, "stop-color": color }, node));
  }

  function drawStatic(svg, kind, g, uid) {
    const pal = PALETTES[kind.palette];
    const defs = create("defs", {}, svg);
    gradient(defs, `${uid}post`, [[0, pal.post[0]], [0.45, pal.post[1]], [1, pal.post[0]]], { x1: 0, x2: 1 });
    gradient(defs, `${uid}rail`, [[0, pal.rail[0]], [1, pal.rail[1]]], { x1: 0, x2: 0, y1: 0, y2: 1 });
    const rail = (y, height) => create("rect", { x: 35, y, width: 730, height, fill: `url(#${uid}rail)`, stroke: pal.line }, svg);
    if (g.frame) {
      create("rect", { x: 30, y: 20, width: 740, height: 400, fill: "none", stroke: "#8a9397", "stroke-width": kind.heavy ? 18 : 10 }, svg);
    }
    if (kind.support === "top") {
      rail(25, 22);
      rail(398, 12);
      create("line", { x1: 35, y1: 404, x2: 765, y2: 404, stroke: pal.dark, "stroke-width": 2 }, svg);
    } else if (kind.support === "bottom") {
      rail(25, 12);
      rail(384, 26);
    } else {
      create("line", { x1: 10, y1: 412, x2: 790, y2: 412, stroke: "#8a9397", "stroke-width": 3 }, svg);
    }
  }

  function drawPost(group, kind, g, uid, pal) {
    const w = kind.postW;
    if (kind.support === "top") {
      const span = kind.rollers === 2 ? 16 : 8;
      create("rect", { x: -span / 2 - 2, y: g.top - 14, width: span + 4, height: 14, fill: pal.dark }, group);
      (kind.rollers === 2 ? [-6, 6] : [0]).forEach((cx) =>
        create("circle", { cx, cy: g.top - 8, r: 4, fill: "#e6eaec", stroke: "#555d61" }, group));
      create("rect", { x: -2, y: g.bot - 4, width: 4, height: 10, fill: pal.dark }, group);
    } else if (kind.support === "bottom") {
      create("rect", { x: -2, y: g.top - 8, width: 4, height: 12, fill: pal.dark }, group);
      create("circle", { cx: 0, cy: g.bot + 13, r: 7, fill: "#e6eaec", stroke: "#555d61" }, group);
    } else {
      create("path", { d: `M${-w / 2} ${g.bot} H${w / 2} L${w / 2 - 3} ${g.bot + 10} H${-w / 2 + 3}Z`, fill: pal.dark }, group);
      create("circle", { cx: 0, cy: g.bot + 18, r: 9, fill: "#e6eaec", stroke: "#555d61", "stroke-width": 2 }, group);
    }
    create("rect", { x: -w / 2, y: g.top + 4, width: w, height: g.bot - g.top - 8, fill: `url(#${uid}post)`, stroke: pal.line }, group);
  }

  function drawHandle(group, kind, g) {
    const w = kind.postW;
    create("rect", { x: -20 - w / 2, y: g.top, width: 40 + w, height: g.bot - g.top, fill: "transparent" }, group); // wide hit area
    if (kind.lock === "bankLock") {
      create("rect", { x: w / 2, y: 196, width: 14, height: 54, rx: 3, fill: ACCENT }, group);
      create("rect", { x: w / 2 + 14, y: 204, width: 8, height: 6, fill: "#555d61" }, group);
      create("rect", { x: w / 2 + 14, y: 236, width: 8, height: 6, fill: "#555d61" }, group);
    } else {
      create("rect", { x: w / 2 + 1, y: 200, width: 8, height: 46, rx: 3, fill: ACCENT }, group);
    }
  }

  /* Each label: point on the grille (x, y), box centre (tx, ty), text. Points follow the grille as it moves. */
  function labelSpecs(kind, s, h, xR, g) {
    const handleText = { lock: "Ручка и замок", bankLock: "Банковский замок", latch: "Ручка и фиксатор" }[kind.lock];
    const handle = [xR + kind.postW / 2 + 5, 223, Math.min(xR - 60, 690), 300, handleText];
    const rivet = [X0 + s * 0.5, g.top + 12 + h * 2.5, Math.max(X0 + s * 0.5 + 120, 260), 190,
      kind.decor ? "Заклёпки с патиной" : "Шарнирная заклёпка"];
    if (kind.support === "bottom") {
      return [[X0 + s * 1.5, g.top - 4, X0 + s * 1.5 + 150, 80, "Верхняя направляющая"], rivet,
        [X0 + s * 2, g.bot + 13, X0 + s * 2 + 130, 350, "Нижний ролик в направляющей"], handle];
    }
    if (kind.support === "wheels") {
      return [[X0 + s * 2, g.bot + 18, X0 + s * 2 + 120, 350, "Колёсная опора"], rivet, handle];
    }
    const top = kind.rollers === 2 ? "Каретка с двумя роликами" : "Верхняя направляющая с кареткой";
    return [[X0 + s * 1.5, g.top - 8, X0 + s * 1.5 + 150, 80, top], rivet,
      [X0 + s * 2, g.bot + 4, X0 + s * 2 + 120, 370, "Нижняя направляющая"], handle];
  }

  function markup(name) {
    return `
      <div class="hg-head">
        <div><p class="hg-title">${name}: как открывается</p><p class="hg-hint">Потяните за крайнюю стойку с ручкой ← →</p></div>
        <div class="hg-btns">
          <button type="button" class="hg-btn" data-hg="open">Открыть</button>
          <button type="button" class="hg-btn" data-hg="close">Закрыть</button>
          <button type="button" class="hg-btn" data-hg="how" aria-pressed="false">Как устроено</button>
        </div>
      </div>
      <svg class="hg-svg" viewBox="0 0 800 440" role="img" aria-label="Интерактивная схема решётки «${name}»"></svg>
      <div class="hg-explain"></div>`;
  }

  function cardsHtml(kind) {
    return kind.cards.map((id) => {
      const [title, art, text] = CARDS[id];
      return `<div class="hg-card"><h4>${title}</h4><svg viewBox="0 0 200 150" aria-hidden="true">${art}</svg><p>${text}</p></div>`;
    }).join("");
  }

  /** Renders the diagram for one model into `root`; returns a function that stops its animation. */
  function mount(root, modelId, name) {
    const kind = KINDS[modelId] || KINDS.standard;
    const pal = PALETTES[kind.palette];
    const g = geometry(kind);
    const uid = `hg${modelId}`;
    const xMin = X0 + (N - 1) * (kind.postW + 2);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    root.classList.add("hg-wrap");
    root.innerHTML = markup(name);
    const svg = root.querySelector(".hg-svg");
    const explain = root.querySelector(".hg-explain");
    explain.innerHTML = cardsHtml(kind);

    drawStatic(svg, kind, g, uid);
    const gBars = create("g", {}, svg);
    const gPosts = create("g", {}, svg);
    const gRivets = create("g", {}, svg);
    const gLabels = create("g", { style: "display:none" }, svg);

    const bars = [];
    const rivets = [];
    for (let i = 0; i < (N - 1) * kind.rows; i += 1) {
      bars.push(create("line", { stroke: pal.bars[0], "stroke-width": kind.barW, "stroke-linecap": "round" }, gBars));
      bars.push(create("line", { stroke: pal.bars[1], "stroke-width": kind.barW, "stroke-linecap": "round" }, gBars));
      rivets.push(create("circle", { r: kind.decor ? 5 : 3.2, fill: kind.decor ? "#d6b06a" : pal.dark }, gRivets));
    }
    const posts = Array.from({ length: N }, () => {
      const group = create("g", {}, gPosts);
      drawPost(group, kind, g, uid, pal);
      return group;
    });
    const handle = posts[N - 1];
    handle.classList.add("hg-handle");
    handle.setAttribute("tabindex", "0");
    handle.setAttribute("role", "slider");
    handle.setAttribute("aria-label", "Крайняя стойка: стрелки влево и вправо двигают решётку");
    handle.setAttribute("aria-valuemin", "0");
    handle.setAttribute("aria-valuemax", "100");
    drawHandle(handle, kind, g);
    const postRivets = Array.from({ length: N * (kind.rows + 1) }, () => create("circle", { r: 2.6, fill: pal.dark }, gRivets));

    let xR = XMAX;
    let frame = null;
    let how = false;
    let drag = null;

    function setLine(line, x1, y1, x2, y2) {
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
    }

    function label(x, y, tx, ty, text) {
      const w = text.length * 7.4 + 14;
      create("line", { x1: x, y1: y, x2: tx, y2: ty, stroke: ACCENT, "stroke-width": 1.5 }, gLabels);
      create("circle", { cx: x, cy: y, r: 4, fill: ACCENT }, gLabels);
      const group = create("g", { class: "hg-label" }, gLabels);
      create("rect", { x: tx - w / 2, y: ty - 12, width: w, height: 24, rx: 6 }, group);
      create("text", { x: tx, y: ty + 4.5, "text-anchor": "middle" }, group).textContent = text;
    }

    function render() {
      const s = (xR - X0) / (N - 1);
      const h = (g.bot - g.top - 24) / kind.rows;
      const y0 = g.top + 12;
      let b = 0;
      let q = 0;
      for (let i = 0; i < N - 1; i += 1) {
        const xa = X0 + i * s;
        const xb = xa + s;
        for (let r = 0; r < kind.rows; r += 1) {
          const ya = y0 + r * h;
          const yb = ya + h;
          setLine(bars[b++], xa, ya, xb, yb);
          setLine(bars[b++], xa, yb, xb, ya);
          rivets[q].setAttribute("cx", (xa + xb) / 2);
          rivets[q++].setAttribute("cy", (ya + yb) / 2);
        }
      }
      let m = 0;
      posts.forEach((post, i) => {
        const x = X0 + i * s;
        post.setAttribute("transform", `translate(${x},0)`);
        for (let r = 0; r <= kind.rows; r += 1) {
          postRivets[m].setAttribute("cx", x);
          postRivets[m++].setAttribute("cy", y0 + r * h);
        }
      });
      handle.setAttribute("aria-valuenow", String(Math.round(((xR - xMin) / (XMAX - xMin)) * 100)));
      if (how) {
        gLabels.replaceChildren();
        labelSpecs(kind, s, h, xR, g).forEach((spec) => label(...spec));
      }
    }

    function stop() {
      if (frame) cancelAnimationFrame(frame);
      frame = null;
    }

    function animateTo(target) {
      stop();
      const from = xR;
      if (reduceMotion) {
        xR = target;
        render();
        return;
      }
      const t0 = performance.now();
      const duration = (900 * Math.abs(target - from)) / (XMAX - xMin) + 150;
      const step = (now) => {
        const t = Math.min(1, (now - t0) / duration);
        const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        xR = from + (target - from) * eased;
        render();
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }

    function toSvgX(event) {
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      return point.matrixTransform(svg.getScreenCTM().inverse()).x;
    }
    const clampX = (x) => Math.max(xMin, Math.min(XMAX, x));

    handle.addEventListener("pointerdown", (event) => {
      stop();
      drag = { dx: xR - toSvgX(event) };
      handle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    handle.addEventListener("pointermove", (event) => {
      if (!drag) return;
      xR = clampX(toSvgX(event) + drag.dx);
      render();
    });
    ["pointerup", "pointercancel"].forEach((type) => handle.addEventListener(type, () => { drag = null; }));
    handle.addEventListener("keydown", (event) => {
      const delta = { ArrowLeft: -KEY_STEP, ArrowRight: KEY_STEP }[event.key];
      if (!delta) return;
      event.preventDefault();
      stop();
      xR = clampX(xR + delta);
      render();
    });

    root.querySelector(".hg-btns").addEventListener("click", (event) => {
      const button = event.target.closest("[data-hg]");
      if (!button) return;
      if (button.dataset.hg === "open") animateTo(xMin); // open = folded to the left
      if (button.dataset.hg === "close") animateTo(XMAX); // close = spans the opening
      if (button.dataset.hg === "how") {
        how = !how;
        button.setAttribute("aria-pressed", String(how));
        gLabels.style.display = how ? "" : "none";
        explain.classList.toggle("on", how);
        render();
      }
    });

    render();
    return stop;
  }

  window.GrilleAnim = { mount };
})();
