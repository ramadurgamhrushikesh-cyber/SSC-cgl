/* thought.js — "Thought for the Day" banner
 * Picks ONE thought per day, deterministically (same all day, changes next day).
 * Types it out once on load with a typewriter effect, then stays.
 */
(function () {
  "use strict";

  let THOUGHTS = null;

  // Deterministic day index: days since a fixed epoch.
  // Same value all day, increments at local midnight.
  function dayIndex() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // days since 1970-01-01
    return Math.floor(d.getTime() / 86400000);
  }

  function pickThought() {
    if (!THOUGHTS || !THOUGHTS.length) return { text: "", author: null };
    const i = dayIndex() % THOUGHTS.length;
    return THOUGHTS[i];
  }

  // Type the text into the element character-by-character, then stop.
  // Cursor blinks while typing and disappears after.
  function typeText(el, text, speed, done) {
    el.textContent = "";
    el.classList.add("typing");
    let i = 0;
    const tick = setInterval(() => {
      el.textContent = text.slice(0, i + 1);
      i++;
      if (i >= text.length) {
        clearInterval(tick);
        el.classList.remove("typing");
        if (done) done();
      }
    }, speed);
  }

  async function loadAndRender() {
    const banner = document.getElementById("thoughtBanner");
    if (!banner) return;
    try {
      if (!THOUGHTS) {
        const res = await fetch("data/thoughts.json");
        THOUGHTS = await res.json();
      }
    } catch (e) {
      banner.style.display = "none";
      return;
    }

    const t = pickThought();
    const textEl = document.getElementById("thoughtText");
    const authorEl = document.getElementById("thoughtAuthor");

    // type speed scales with length so all thoughts take a similar time
    const totalChars = (t.text + (t.author || "")).length;
    const speed = Math.max(22, Math.min(55, 2600 / totalChars));

    typeText(textEl, "\u201C" + t.text + "\u201D", speed, () => {
      // reveal the author after the text finishes typing
      if (t.author) {
        authorEl.textContent = "— " + t.author;
        authorEl.classList.add("show");
      }
    });
  }

  window.Thought = { loadAndRender };

  if (document.readyState !== "loading") loadAndRender();
  else document.addEventListener("DOMContentLoaded", loadAndRender);
})();
