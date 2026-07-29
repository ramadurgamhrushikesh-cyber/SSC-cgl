/* celebrate.js — celebratory completion messages for candidate "Lekha"
 * Fires a confetti burst + a personalised "Eureka, Lekha!" message when a
 * topic practice is completed or a mock is submitted.
 */
(function () {
  "use strict";

  const NAME = "Lekha";

  // Varied appreciation messages. Pick one at random, or by accuracy/score.
  // Each entry: { title, sub, quote }
  const MESSAGES = {
    topic: [
      { title: `Eureka, ${NAME}!`, sub: "Topic conquered. Another step closer to Tier-I! 🚀", quote: "\"Success is the sum of small efforts, repeated day in and day out.\" — Robert Collier" },
      { title: `Brilliant, ${NAME}!`, sub: "That topic is now firmly in your toolkit. 🧠", quote: "\"The expert in anything was once a beginner.\" — Helen Hayes" },
      { title: `You did it, ${NAME}!`, sub: "Concepts locked in. Keep this momentum going! 🔥", quote: "\"Don't watch the clock; do what it does. Keep going.\" — Sam Levenson" },
      { title: `Fantastic work, ${NAME}!`, sub: "Every topic you finish is a mark secured in Tier-I. 📈", quote: "\"The future depends on what you do today.\" — Mahatma Gandhi" },
      { title: `Top notch, ${NAME}!`, sub: "Your preparation is taking real shape. 💪", quote: "\"Hard work beats talent when talent doesn't work hard.\" — Tim Notke" },
      { title: `Stellar, ${NAME}!`, sub: "That's how Tier-I champions are built — one topic at a time. 🏆", quote: "\"Believe you can and you're halfway there.\" — Theodore Roosevelt" }
    ],
    highAccuracy: [
      { title: `Outstanding, ${NAME}!`, sub: "Near-perfect accuracy — you've truly mastered this! 🌟", quote: "\"Excellence is not a skill. It is an attitude.\" — Ralph Marston" },
      { title: `Masterful, ${NAME}!`, sub: "That score shows real command of the topic. 🎯", quote: "\"Quality is not an act, it is a habit.\" — Aristotle" }
    ],
    mock: [
      { title: `Eureka, ${NAME}! Mock complete!`, sub: "Every mock sharpens your edge for the real Tier-I. ⚔️", quote: "\"It's not whether you get knocked down, it's whether you get up.\" — Vince Lombardi" },
      { title: `Well played, ${NAME}!`, sub: "Mocks reveal where to focus next. You're getting exam-ready. 📚", quote: "\"The more you practice, the luckier you get." }
    ],
    daily: [
      { title: `DAILY GOAL CRUSHED! 🏆`, sub: `All of today's tasks are done. You're on fire, ${NAME}! 🔥`, quote: "\"Discipline is choosing between what you want now and what you want most.\" — Abraham Lincoln" },
      { title: `PERFECT DAY, ${NAME}! 🌟`, sub: "Every topic on today's plan — complete. This is how toppers are made.", quote: "\"You don't have to be great to start, but you have to start to be great.\" — Zig Ziglar" },
      { title: `MISSION ACCOMPLISHED! 🎯`, sub: `Today's plan: cleared. Rest up, ${NAME} — you earned it. 💜`, quote: "\"Success is doing ordinary things extraordinarily well.\" — Jim Rohn" },
      { title: `UNSTOPPABLE, ${NAME}! 💪`, sub: "A perfect day of preparation. Consistency like this clears Tier-I.", quote: "\"Small disciplines repeated with consistency every day lead to great achievements.\" — John C. Maxwell" }
    ]
  };

  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  const COLORS = ["#f59e0b", "#22c55e", "#6d28d9", "#ec4899", "#0ea5e9", "#fbbf24"];

  // Standard celebratory burst for a single topic/mock.
  function fireConfetti() {
    if (typeof confetti !== "function") return;
    // burst from center
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 }, colors: COLORS });
    // side cannons
    setTimeout(() => confetti({ particleCount: 60, angle: 60, spread: 55, origin: { x: 0 }, colors: COLORS }), 200);
    setTimeout(() => confetti({ particleCount: 60, angle: 120, spread: 55, origin: { x: 1 }, colors: COLORS }), 350);
  }

  // Big animated finale: continuous confetti rain + fireworks for a few seconds.
  // Used when the DAILY goal is met.
  let finaleTimer = null;
  function fireFinale(durationMs) {
    if (typeof confetti !== "function") return;
    const end = Date.now() + (durationMs || 4000);
    // continuous gentle rain from the top
    const rain = setInterval(() => {
      if (Date.now() > end) { clearInterval(rain); return; }
      confetti({ particleCount: 5, angle: 90, spread: 120, startVelocity: 25, origin: { x: Math.random(), y: 0 }, gravity: 0.8, colors: COLORS, ticks: 300 });
    }, 200);
    // fireworks bursting from random points along the bottom
    const fireworks = setInterval(() => {
      if (Date.now() > end) { clearInterval(fireworks); return; }
      confetti({ particleCount: 50, spread: 360, startVelocity: 35, origin: { x: Math.random() * 0.6 + 0.2, y: Math.random() * 0.5 + 0.3 }, colors: COLORS, scalar: 0.9 });
    }, 500);
    // initial big cannons
    fireConfetti();
    setTimeout(fireConfetti, 400);
    setTimeout(fireConfetti, 900);
  }

  function openCard(msg, sub, opts) {
    document.getElementById("celebrateTitle").textContent = msg.title;
    document.getElementById("celebrateSub").textContent = sub || msg.sub;
    document.getElementById("celebrateQuote").textContent = msg.quote;
    const card = document.querySelector(".celebrate-card");
    // daily variant gets a bigger, golden glow
    if (opts && opts.daily) card.classList.add("daily");
    else card.classList.remove("daily");
    document.getElementById("celebrateOverlay").classList.add("show");
  }

  function show(opts) {
    opts = opts || {};
    let msg;
    if (opts.type === "mock") msg = pick(MESSAGES.mock);
    else if (opts.accuracy >= 90) msg = pick(MESSAGES.highAccuracy);
    else msg = pick(MESSAGES.topic);

    openCard(msg, opts.sub, opts);
    fireConfetti();
    // a second confetti wave for delight
    setTimeout(fireConfetti, 600);
  }

  // Big celebration when the daily goal is fully completed.
  function showDaily(opts) {
    opts = opts || {};
    const msg = pick(MESSAGES.daily);
    const sub = opts.completed && opts.goal
      ? `You completed all ${opts.goal} of today's topics. Rest well — tomorrow we go again! 💜`
      : msg.sub;
    openCard(msg, sub, { daily: true });
    fireFinale(4000); // richer animation: rain + fireworks for 4 seconds
  }

  function hide() {
    document.getElementById("celebrateOverlay").classList.remove("show");
    document.querySelector(".celebrate-card").classList.remove("daily");
    if (finaleTimer) { clearInterval(finaleTimer); finaleTimer = null; }
  }

  window.Celebrate = { show, showDaily, hide, NAME };

  document.addEventListener("DOMContentLoaded", () => {
    const close = document.getElementById("celebrateClose");
    if (close) close.addEventListener("click", hide);
    document.getElementById("celebrateOverlay").addEventListener("click", (e) => {
      if (e.target.id === "celebrateOverlay") hide();
    });
  });
})();
