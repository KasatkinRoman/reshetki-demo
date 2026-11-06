/* Home page glue: hero entry cards and the «Что вам нужно?» advisor.
 * Calculators live in app-sliding.js and app-weld.js. */
(function () {
  const { el, esc } = window.UI;
  const { QUESTIONS, recommend } = window.Advisor;
  const HERO_PREVIEW_COLOR = "#f2a516";

  el("heroSliding").innerHTML = `<svg viewBox="0 0 220 150" aria-hidden="true">${window.SlidingUI.grilleSvg(1600, 1200, 220, 150, HERO_PREVIEW_COLOR)}</svg>`;
  el("safetyScheme").innerHTML = window.WeldAnim.scheme({ type: "hatch", pattern: "grid" })
    + '<p class="hint">Люк-створка в глухой решётке: нажмите «Открыть».</p>';
  el("heroWeld").innerHTML = window.WeldAnim.svg({ type: "double", pattern: "diamond", decorative: true });

  let answers = {};

  function renderAdvisor() {
    el("advisorQuestions").innerHTML = QUESTIONS.map((q) => `
      <fieldset class="adv-q">
        <legend>${q.title}</legend>
        <div class="chips">${q.answers.map((a) => `
          <button type="button" class="chip chip-dark" data-q="${q.id}" data-a="${a.id}" aria-pressed="${answers[q.id] === a.id}">${a.name}</button>`).join("")}
        </div>
      </fieldset>`).join("");
    const result = recommend(answers);
    el("advisorResult").innerHTML = result
      ? `<b>Подойдёт: ${esc(result.title)}</b><p>${esc(result.text)}</p>
         <button type="button" class="btn btn-accent" data-go="1">Посчитать этот вариант</button>`
      : '<p class="adv-wait">Ответьте на три вопроса — подскажем тип решётки и вариант открывания.</p>';
  }

  function go(target) {
    if (target.kind === "sliding") {
      window.SlidingUI.pick(null, target.cat);
      el("calc").scrollIntoView({ behavior: "smooth" });
    } else {
      window.WeldUI.pickType(target.type);
      el("wcalc").scrollIntoView({ behavior: "smooth" });
    }
  }

  el("advisor").addEventListener("click", (e) => {
    const answer = e.target.closest("[data-q]");
    if (answer) {
      const { q, a } = answer.dataset;
      answers = { ...answers, [q]: a };
      renderAdvisor();
      // Re-rendering replaces the buttons; keep keyboard focus on the chosen answer.
      el("advisorQuestions").querySelector(`[data-q="${q}"][data-a="${a}"]`).focus();
      return;
    }
    if (e.target.closest("[data-go]")) go(recommend(answers).target);
  });

  renderAdvisor();
})();
