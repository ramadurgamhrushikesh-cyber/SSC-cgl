/* practice.js — renders inline topic practice questions (ungraded study mode)
 * Renders into a container given a practice array from a topic JSON.
 */
(function () {
  "use strict";

  function render(container, practice, opts) {
    opts = opts || {};
    const html = [];
    html.push(`<div class="practice-section" id="practiceSection">`);
    html.push(`<h2>📝 Practice Questions</h2>`);
    html.push(`<p class="practice-hint">${practice.length} questions · study mode · pick an option to see the explanation instantly. No timer, no scoring.</p>`);

    practice.forEach((q, i) => {
      const optsHtml = q.options.map((o, oi) => {
        const key = String.fromCharCode(65 + oi); // A,B,C,D
        return `<div class="opt" data-q="${i}" data-o="${oi}"><span class="opt-key">${key}.</span><span class="opt-text">${o}</span></div>`;
      }).join("");

      html.push(`
        <div class="question" id="q-${i}">
          <div class="q-num">Q${i + 1}</div>
          <div class="q-text">${q.question}</div>
          <div class="options">${optsHtml}</div>
          <div class="q-explanation" id="qe-${i}">
            <strong>Explanation:</strong> ${q.explanation}
            ${q.source ? `<span class="src">Source: ${q.source}</span>` : ""}
          </div>
        </div>`);
    });

    html.push(`<div style="margin-top:18px;text-align:center">
      <button class="btn btn-primary" id="practiceDoneBtn">✓ Mark this topic complete</button>
    </div>`);
    html.push(`</div>`);

    container.insertAdjacentHTML("beforeend", html.join(""));

    // wire up option clicks
    container.querySelectorAll(".practice-section .opt").forEach(el => {
      el.addEventListener("click", () => onOptionClick(el, practice));
    });

    if (opts.onDone) {
      const doneBtn = container.querySelector("#practiceDoneBtn");
      if (doneBtn) doneBtn.addEventListener("click", opts.onDone);
    }
  }

  function onOptionClick(el, practice) {
    const qEl = el.closest(".question");
    if (qEl.classList.contains("answered")) return; // one-shot per question
    const qi = parseInt(el.dataset.q, 10);
    const oi = parseInt(el.dataset.o, 10);
    const correct = practice[qi].answer;

    qEl.classList.add("answered");
    qEl.querySelectorAll(".opt").forEach(o => {
      o.classList.add("disabled");
      const oIdx = parseInt(o.dataset.o, 10);
      if (oIdx === correct) o.classList.add("correct");
    });
    if (oi !== correct) el.classList.add("wrong");
    qEl.querySelector("#qe-" + qi).classList.add("show");

    // scroll explanation into view smoothly
    qEl.querySelector("#qe-" + qi).scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  window.Practice = { render };
})();
