/*
 * Welded grille schemes: SVG elevation of the opening with the grille, opening arrows
 * and an «Открыть / Закрыть» button. The sash turns on its hinges via a CSS transform
 * (scaleX + skewY around the hinge edge, see styles.css); prefers-reduced-motion
 * switches the transition off. Returns markup strings; one delegated click handler.
 */
(function () {
  const VIEW_W = 200;
  const VIEW_H = 240;
  const PAD = 20;                   // wall around the opening
  const FRAME = 5;                  // fixed frame profile
  const BAR_STEP = 20;              // vertical bar spacing
  const DIAMOND_STEP = 26;
  const CURL_R = 5;
  const HATCH_BOTTOM_GAP = 10;      // hatch sits low, above the sill
  /* The scheme opening is 1200×1500 mm, so the 600×800 hatch is drawn to scale. */
  const SCHEME_OPENING_MM = { w: 1200, h: 1500 };
  const HATCH_MM = { w: 600, h: 800 };
  const COLORS = { metal: "#2b3138", wall: "#e4e6e9", glass: "#cfdde6", arrow: "#a35f00", hinge: "#f2a516" };

  let uid = 0;
  const nextId = (prefix) => `${prefix}${(uid += 1)}`;

  function bars(x, y, w, h, step) {
    const count = Math.max(1, Math.round(w / step));
    const gap = w / count;
    let d = "";
    for (let i = 1; i < count; i += 1) d += `M${x + i * gap},${y}V${y + h}`;
    return { d, gap, count };
  }

  /** Infill of a grille field: simple bars, diamond lattice or forged curls. */
  function infill(x, y, w, h, pattern, clipId) {
    const frame = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${COLORS.metal}" stroke-width="3"/>`;
    if (pattern === "diamond") {
      const inset = 7;
      let d = "";
      for (let k = -h; k < w + h; k += DIAMOND_STEP) {
        d += `M${x + k},${y}L${x + k + h},${y + h}M${x + k + h},${y}L${x + k},${y + h}`;
      }
      return `${frame}<rect x="${x + inset}" y="${y + inset}" width="${w - 2 * inset}" height="${h - 2 * inset}" fill="none" stroke="${COLORS.metal}" stroke-width="2"/>
        <clipPath id="${clipId}"><rect x="${x + inset}" y="${y + inset}" width="${w - 2 * inset}" height="${h - 2 * inset}"/></clipPath>
        <path d="${d}" stroke="${COLORS.metal}" stroke-width="1.6" clip-path="url(#${clipId})"/>`;
    }
    const v = bars(x, y, w, h, BAR_STEP);
    const rails = `M${x},${y + h / 3}H${x + w}M${x},${y + (2 * h) / 3}H${x + w}`;
    let decor = "";
    if (pattern === "forged") {
      for (let i = 0; i < v.count; i += 1) {
        const cx = x + (i + 0.5) * v.gap;
        [y + h / 3, y + (2 * h) / 3].forEach((cy) => {
          decor += `<path d="M${cx - v.gap / 2},${cy}c0,-${CURL_R * 2} ${v.gap / 2},-${CURL_R * 2} ${v.gap / 2},-${CURL_R}s-${CURL_R},${CURL_R} 0,${CURL_R}" fill="none" stroke="${COLORS.metal}" stroke-width="1.6"/>`;
        });
      }
      for (let i = 1; i < v.count; i += 1) {
        const bx = x + i * v.gap;
        decor += `<path d="M${bx - 3},${y + 7}L${bx},${y + 1}L${bx + 3},${y + 7}Z" fill="${COLORS.metal}"/>`;
      }
    }
    return `${frame}<path d="${v.d}${rails}" stroke="${COLORS.metal}" stroke-width="2"/>${decor}`;
  }

  function hinges(x, y, h, side) {
    const hx = side === "left" ? x - 2 : x - 4;
    return [0.2, 0.8].map((k) => `<rect x="${hx}" y="${y + h * k - 6}" width="6" height="12" rx="2" fill="${COLORS.hinge}" stroke="${COLORS.metal}"/>`).join("");
  }

  /** Dashed «V» from the free edge to the hinge side (drawing convention) + swing arrow. */
  function arrows(x, y, w, h, side, markerId) {
    const hingeX = side === "left" ? x : x + w;
    const freeX = side === "left" ? x + w : x;
    const dir = side === "left" ? 1 : -1;
    const ay = y + h * 0.5;
    return `<g class="ws-arrows">
      <path d="M${freeX},${y + 4}L${hingeX},${ay}L${freeX},${y + h - 4}" fill="none" stroke="${COLORS.arrow}" stroke-width="1.6" stroke-dasharray="5 4"/>
      <path d="M${freeX - dir * 10},${y + h * 0.35}q${dir * 14},${h * 0.15} ${dir * 4},${h * 0.3}" fill="none" stroke="${COLORS.arrow}" stroke-width="2.4" marker-end="url(#${markerId})"/>
    </g>`;
  }

  function sash(x, y, w, h, side, pattern, markerId) {
    const handleX = side === "left" ? x + w - 9 : x + 4;
    return `<g class="ws-sash ws-hinge-${side}">
        <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="rgba(255,255,255,.01)"/>
        ${infill(x, y, w, h, pattern, nextId("wc"))}
        <rect x="${handleX}" y="${y + h / 2 - 9}" width="5" height="18" rx="2" fill="${COLORS.hinge}" stroke="${COLORS.metal}"/>
      </g>${hinges(side === "left" ? x : x + w, y, h, side)}${arrows(x, y, w, h, side, markerId)}`;
  }

  function hatchRect(ox, oy, ow, oh) {
    const w = (ow * HATCH_MM.w) / SCHEME_OPENING_MM.w;
    const h = (oh * HATCH_MM.h) / SCHEME_OPENING_MM.h;
    return { x: ox + (ow - w) / 2, y: oy + oh - h - HATCH_BOTTOM_GAP, w, h };
  }

  function body(type, hinge, pattern, markerId) {
    const ox = PAD;
    const oy = PAD;
    const ow = VIEW_W - 2 * PAD;
    const oh = VIEW_H - 2 * PAD;
    const ix = ox + FRAME;
    const iy = oy + FRAME;
    const iw = ow - 2 * FRAME;
    const ih = oh - 2 * FRAME;
    const fixedFrame = `<rect x="${ox + FRAME / 2}" y="${oy + FRAME / 2}" width="${ow - FRAME}" height="${oh - FRAME}" fill="none" stroke="${COLORS.metal}" stroke-width="${FRAME}"/>`;
    if (type === "blind") return infill(ox, oy, ow, oh, pattern, nextId("wc"));
    if (type === "single") return fixedFrame + sash(ix, iy, iw, ih, hinge, pattern, markerId);
    if (type === "double") {
      const half = iw / 2;
      return fixedFrame + sash(ix, iy, half, ih, "left", pattern, markerId) + sash(ix + half, iy, half, ih, "right", pattern, markerId);
    }
    const r = hatchRect(ox, oy, ow, oh);
    const clipId = nextId("wh");
    return `<clipPath id="${clipId}"><path clip-rule="evenodd" d="M${ox - 2},${oy - 2}h${ow + 4}v${oh + 4}h-${ow + 4}z M${r.x},${r.y}v${r.h}h${r.w}v-${r.h}z"/></clipPath>
      <g clip-path="url(#${clipId})">${infill(ox, oy, ow, oh, pattern, nextId("wc"))}</g>
      <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="${COLORS.metal}" stroke-width="4"/>
      ${sash(r.x + 3, r.y + 3, r.w - 6, r.h - 6, "left", pattern, markerId)}`;
  }

  const TYPE_LABEL = {
    blind: "глухая решётка, не открывается",
    single: "одна створка",
    double: "две створки, открываются от центра",
    hatch: "глухая решётка с люком-створкой 600×800 мм",
  };

  /** SVG markup only (for previews and cards). */
  function svg({ type, hinge = "left", pattern = "grid", label, decorative = false }) {
    const markerId = nextId("wa");
    const aria = label || `Схема: ${TYPE_LABEL[type]}${type === "single" ? `, петли ${hinge === "left" ? "слева" : "справа"}` : ""}`;
    const a11y = decorative ? 'aria-hidden="true"' : `role="img" aria-label="${aria}"`;
    return `<svg class="ws-svg" viewBox="0 0 ${VIEW_W} ${VIEW_H}" ${a11y}>
      <defs><marker id="${markerId}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M0,0L10,5L0,10Z" fill="${COLORS.arrow}"/></marker></defs>
      <rect width="${VIEW_W}" height="${VIEW_H}" fill="${COLORS.wall}"/>
      <rect x="${PAD}" y="${PAD}" width="${VIEW_W - 2 * PAD}" height="${VIEW_H - 2 * PAD}" fill="${COLORS.glass}"/>
      ${body(type, hinge, pattern, markerId)}
    </svg>`;
  }

  /** Scheme with the «Открыть / Закрыть» button (a blind grille gets a note instead). */
  function scheme(opts) {
    const control = opts.type === "blind"
      ? '<p class="ws-fixed">Не открывается — максимум прочности</p>'
      : '<button type="button" class="btn btn-ghost ws-toggle" data-weld-toggle aria-pressed="false">Открыть</button>';
    return `<div class="weld-scheme ${opts.size === "sm" ? "ws-sm" : ""}">${svg(opts)}${opts.noControl ? "" : control}</div>`;
  }

  /** Small preview of an infill pattern for the «Рисунок» step. */
  function patternPreview(pattern) {
    const w = 120;
    const h = 80;
    return `<svg class="ws-pattern" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <rect width="${w}" height="${h}" fill="${COLORS.glass}"/>${infill(4, 4, w - 8, h - 8, pattern, nextId("wp"))}</svg>`;
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-weld-toggle]");
    if (!button) return;
    const root = button.closest(".weld-scheme");
    const open = !root.classList.contains("is-open");
    root.classList.toggle("is-open", open);
    button.setAttribute("aria-pressed", String(open));
    button.textContent = open ? "Закрыть" : "Открыть";
  });

  window.WeldAnim = { svg, scheme, patternPreview };
})();
