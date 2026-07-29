/* calendar.js — month calendar showing daily task completion history
 * Opens via the 📅 button in the top bar. Days are colour-coded by how many
 * of that day's assigned tasks were completed.
 */
(function () {
  "use strict";

  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const DOW = ["Su","Mo","Tu","We","Th","Fr","Sa"];

  let viewYear, viewMonth; // currently displayed month

  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function dateStr(y, m, d) { return y + "-" + (m + 1) + "-" + d; }

  function open() {
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth();
    document.getElementById("calendarOverlay").classList.add("show");
    render();
  }
  function close() {
    document.getElementById("calendarOverlay").classList.remove("show");
  }

  function render() {
    const title = document.getElementById("calTitle");
    title.textContent = MONTHS[viewMonth] + " " + viewYear;

    const grid = document.getElementById("calGrid");
    const history = Progress.allHistory();
    const today = new Date();
    const todayStr = Progress.todayStr();

    // header row of weekdays
    let html = DOW.map(d => `<div class="cal-dow">${d}</div>`).join("");

    // first day-of-week of the month + number of days
    const firstDow = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // leading blanks
    for (let i = 0; i < firstDow; i++) html += `<div class="cal-cell empty"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
      const ds = dateStr(viewYear, viewMonth, d);
      const rec = history[ds];
      let cls = "cal-cell";
      let badge = "";
      if (rec) {
        if (rec.completed >= rec.tasks && rec.tasks > 0) { cls += " full"; badge = "✓"; }
        else if (rec.completed > 0) { cls += " partial"; badge = rec.completed + "/" + rec.tasks; }
        else { cls += " none"; }
      }
      // future or today highlighting
      const cellDate = new Date(viewYear, viewMonth, d);
      const isToday = ds === todayStr;
      const isFuture = cellDate > today && !isToday;
      if (isToday) cls += " today";
      if (isFuture) cls += " future";
      html += `<div class="${cls}"><span class="cal-num">${d}</span>${badge ? `<span class="cal-badge">${badge}</span>` : ""}</div>`;
    }

    grid.innerHTML = html;

    // footer summary
    const footer = document.getElementById("calFooter");
    // count perfect days in history
    const perfectDays = Object.values(history).filter(r => r.tasks > 0 && r.completed >= r.tasks).length;
    const totalDays = Object.keys(history).length;
    footer.innerHTML = `<strong>${perfectDays}</strong> perfect day${perfectDays === 1 ? "" : "s"}<span class="dim"> · ${totalDays} active day${totalDays === 1 ? "" : "s"} logged</span>`;
  }

  function changeMonth(delta) {
    viewMonth += delta;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    render();
  }

  window.Calendar = { open, close };

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("calendarBtn").addEventListener("click", open);
    document.getElementById("calClose").addEventListener("click", close);
    document.getElementById("calPrev").addEventListener("click", () => changeMonth(-1));
    document.getElementById("calNext").addEventListener("click", () => changeMonth(1));
    document.getElementById("calendarOverlay").addEventListener("click", (e) => {
      if (e.target.id === "calendarOverlay") close();
    });
  });
})();
