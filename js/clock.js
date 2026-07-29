/* clock.js — live clock, date & day in the top bar */
(function () {
  "use strict";

  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  function tick() {
    const now = new Date();
    const tEl = document.getElementById("clockTime");
    const dEl = document.getElementById("clockDate");
    if (tEl) tEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    if (dEl) dEl.textContent = `${DAYS[now.getDay()]}, ${pad(now.getDate())} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
  }

  // Expose so app.js can ensure it's running after a re-render
  window.Clock = {
    start() {
      tick();
      if (!this._id) this._id = setInterval(tick, 1000);
    },
    stop() {
      if (this._id) { clearInterval(this._id); this._id = null; }
    }
  };

  // Start immediately
  if (document.readyState !== "loading") window.Clock.start();
  else document.addEventListener("DOMContentLoaded", () => window.Clock.start());
})();
