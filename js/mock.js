/* mock.js — subject mock test engine
 * 25 questions / 15 minutes, +2 correct, -0.50 wrong.
 * Locked until the subject's syllabus is complete (Progress.sectionUnlocked).
 * Builds the question pool from all populated topics in that section
 * (topics must be pre-loaded into a cache via Mock.loadPool(section, items)).
 */
(function () {
  "use strict";
  const MOCK_TIME = 15 * 60; // 15 minutes in seconds
  const MARK_CORRECT = 2, MARK_WRONG = 0.5;

  let POOLS = {}; // { sectionId: [ {question,options,answer,explanation,topic}, ... ] }
  function loadPool(section, items) { POOLS[section] = (POOLS[section] || []).concat(items); }

  function hasPool(section) { return (POOLS[section] || []).length >= 25; }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  let state = null; // { section, n, questions, answers:{}, timeLeft, timerId, submitted }

  function start(section, n, app) {
    const pool = POOLS[section] || [];
    if (pool.length < 25) {
      alert("Not enough questions in pool yet for this subject. (" + pool.length + "/25)");
      return;
    }
    const questions = shuffle(pool).slice(0, 25);
    state = { section, n, questions, answers: {}, timeLeft: MOCK_TIME, timerId: null, submitted: false, app };
    render();
    state.timerId = setInterval(tick, 1000);
  }

  function tick() {
    if (!state || state.submitted) return;
    state.timeLeft--;
    const tEl = document.getElementById("mockTimer");
    if (tEl) {
      const m = Math.floor(state.timeLeft / 60), s = state.timeLeft % 60;
      tEl.textContent = `${m}:${s < 10 ? "0" + s : s}`;
      if (state.timeLeft <= 60) tEl.classList.add("warn"); else tEl.classList.remove("warn");
    }
    if (state.timeLeft <= 0) submit();
  }

  function render() {
    const app = state.app;
    app.setBreadcrumb([{ label: state.section.toUpperCase() + " Mock", current: true }]);
    const html = [];
    html.push(`<div class="mock-screen">`);
    html.push(`<div class="mock-timer">
      <div><strong>Mock Test ${state.n}</strong> · ${state.section.toUpperCase()} · 25 Q · +2/-0.50</div>
      <div class="t" id="mockTimer">15:00</div>
    </div>`);

    state.questions.forEach((q, i) => {
      const opts = q.options.map((o, oi) => {
        const key = String.fromCharCode(65 + oi);
        return `<label class="opt" data-q="${i}" data-o="${oi}"><input type="radio" name="mq-${i}" value="${oi}" style="margin-right:8px"><span class="opt-key">${key}.</span><span class="opt-text">${o}</span></label>`;
      }).join("");
      html.push(`
        <div class="question">
          <div class="q-num">Q${i + 1}</div>
          <div class="q-text">${q.question}</div>
          <div class="options">${opts}</div>
        </div>`);
    });

    html.push(`<div style="text-align:center;margin:24px 0"><button class="btn btn-primary" id="mockSubmitBtn">Submit Mock Test</button></div>`);
    html.push(`</div>`);

    app.mount(html.join(""));

    app.container.querySelectorAll(".mock-screen .opt").forEach(el => {
      el.addEventListener("click", () => {
        const qi = parseInt(el.dataset.q, 10);
        state.answers[qi] = parseInt(el.dataset.o, 10);
        el.closest(".options").querySelectorAll(".opt").forEach(o => o.classList.remove("selected"));
        el.classList.add("selected");
      });
    });
    document.getElementById("mockSubmitBtn").addEventListener("click", submit);
  }

  function submit() {
    if (!state || state.submitted) return;
    state.submitted = true;
    clearInterval(state.timerId);

    let correct = 0, wrong = 0, attempted = 0;
    state.questions.forEach((q, i) => {
      if (state.answers[i] === undefined) return;
      attempted++;
      if (state.answers[i] === q.answer) correct++; else wrong++;
    });
    const score = (correct * MARK_CORRECT) - (wrong * MARK_WRONG);
    const maxScore = 25 * MARK_CORRECT;

    Progress.saveMockResult(state.section, state.n, score);

    const html = [];
    html.push(`<div class="mock-screen scorecard">`);
    html.push(`<h2>Mock Test ${state.n} · ${state.section.toUpperCase()} — Result</h2>`);
    html.push(`<div class="big-score">${score.toFixed(2)} <span class="muted" style="font-size:18px">/ ${maxScore.toFixed(0)}</span></div>`);
    html.push(`<div class="scorecard-stat-grid">
      <div class="stat-box"><div class="stat-val" style="color:var(--green)">${correct}</div><div class="stat-lbl">Correct (+2)</div></div>
      <div class="stat-box"><div class="stat-val" style="color:var(--red)">${wrong}</div><div class="stat-lbl">Wrong (-0.50)</div></div>
      <div class="stat-box"><div class="stat-val">${25 - attempted}</div><div class="stat-lbl">Unattempted</div></div>
      <div class="stat-box"><div class="stat-val">${Math.round((correct / 25) * 100)}%</div><div class="stat-lbl">Accuracy</div></div>
    </div>`);

    html.push(`<h3 style="text-align:left;margin-top:30px">Review with Explanations</h3>`);
    state.questions.forEach((q, i) => {
      const yourAns = state.answers[i];
      const isCorrect = yourAns === q.answer;
      const yourText = yourAns !== undefined ? q.options[yourAns] : "(not attempted)";
      html.push(`
        <div class="question">
          <div class="q-num">Q${i + 1} ${isCorrect ? '<span style="color:var(--green)">✓ Correct</span>' : '<span style="color:var(--red)">✗ ' + (yourAns === undefined ? 'Skipped' : 'Wrong') + '</span>'}</div>
          <div class="q-text">${q.question}</div>
          ${q.options.map((o, oi) => {
            let cls = "opt disabled";
            if (oi === q.answer) cls += " correct";
            return `<div class="${cls}"><span class="opt-key">${String.fromCharCode(65 + oi)}.</span><span class="opt-text">${o}</span></div>`;
          }).join("")}
          <div class="q-explanation show"><strong>Your answer:</strong> ${yourText} &nbsp;·&nbsp; <strong>Correct:</strong> ${String.fromCharCode(65 + q.answer)}. ${q.options[q.answer]}<br>${q.explanation}${q.source ? `<span class="src">Source: ${q.source}</span>` : ""}</div>
        </div>`);
    });

    html.push(`<div style="text-align:center;margin:24px 0"><button class="btn" id="mockBackBtn">Back to Dashboard</button></div>`);
    html.push(`</div>`);

    state.app.mount(html.join(""));
    document.getElementById("mockBackBtn").addEventListener("click", () => { state = null; state.app.route("#/"); });

    // Celebrate the mock completion 🎉
    const accuracy = Math.round((correct / 25) * 100);
    if (typeof Celebrate !== "undefined") {
      Celebrate.show({
        sub: `Mock ${state.n} done — ${score.toFixed(1)}/${maxScore.toFixed(0)} marks, ${accuracy}% accuracy.`,
        accuracy: accuracy,
        type: "mock"
      });
    }
  }

  window.Mock = { loadPool, hasPool, start };
})();
