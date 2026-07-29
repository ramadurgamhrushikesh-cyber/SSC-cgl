/* progress.js — localStorage progress tracking
 * Keys:
 *   ssc_cgl_progress   { topicId: { page: n, pagesRead:[], practiceDone:bool, accuracy:n, attempts:n }, ... }
 *   ssc_cgl_mocks      { "<section>:<n>": { best:n, last:n, attempts:n }, ... }
 *   ssc_cgl_theme      "dark" | "light"
 */
(function () {
  "use strict";

  const K_PROG = "ssc_cgl_progress";
  const K_MOCK = "ssc_cgl_mocks";
  const K_THEME = "ssc_cgl_theme";

  function read(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  function allProgress() { return read(K_PROG, {}); }
  function topic(id) { const p = allProgress(); return p[id] || { page: 0, pagesRead: [], practiceDone: false, accuracy: 0, attempts: 0 }; }

  function saveTopic(id, data) {
    const p = allProgress();
    p[id] = Object.assign({}, p[id], data);
    write(K_PROG, p);
  }

  function setTopicPage(id, pageIndex) {
    const t = topic(id);
    t.page = pageIndex;
    t.pagesRead = t.pagesRead || [];
    if (!t.pagesRead.includes(pageIndex)) t.pagesRead.push(pageIndex);
    saveTopic(id, t);
  }

  function markPracticeDone(id, accuracy) {
    const t = topic(id);
    t.practiceDone = true;
    t.attempts = (t.attempts || 0) + 1;
    t.accuracy = Math.max(t.accuracy || 0, Math.round(accuracy));
    saveTopic(id, t);
  }

  function isTopicRead(id) {
    // "read" = at least opened the last reading page or attempted practice
    const t = topic(id);
    return t.practiceDone === true || (t.pagesRead && t.pagesRead.length > 0);
  }
  // "completed" = practice finished — used for TRUE syllabus completion %.
  // This is stricter than isTopicRead (which counts mere browsing) so the
  // syllabus progress bar reflects genuinely finished topics, not just opened ones.
  function isTopicCompleted(id) {
    const t = topic(id);
    return t.practiceDone === true;
  }

  // --- per-section syllabus % (drives mock unlock) ---
  // manifest is injected by app.js via Progress.bind(manifest)
  let MANIFEST = null;
  function bind(manifest) { MANIFEST = manifest; }

  function sectionStats(sectionId) {
    if (!MANIFEST) return { total: 0, read: 0, completed: 0, pct: 0, populated: 0 };
    const topics = (MANIFEST.sections.find(s => s.id === sectionId) || {}).topics || [];
    const total = topics.length;
    const populated = topics.filter(t => t.populated).length;
    const read = topics.filter(t => t.populated && isTopicRead(t.id)).length;       // browsed
    const completed = topics.filter(t => t.populated && isTopicCompleted(t.id)).length; // finished
    // syllabus pct = completed / TOTAL topics in the section (full syllabus, not just populated)
    const pct = total ? Math.round((completed / total) * 100) : 0;
    return { total, read, completed, populated, pct };
  }

  function sectionUnlocked(sectionId) {
    const s = sectionStats(sectionId);
    return s.populated > 0 && s.completed === s.populated;
  }

  function overallPct() {
    if (!MANIFEST) return 0;
    let totalTopics = 0, totalCompleted = 0;
    MANIFEST.sections.forEach(sec => {
      const st = sectionStats(sec.id);
      totalTopics += st.total; totalCompleted += st.completed;
    });
    // syllabus pct = completed / TOTAL topics across all sections (full syllabus)
    return totalTopics ? Math.round((totalCompleted / totalTopics) * 100) : 0;
  }

  // --- mocks ---
  function mockKey(section, n) { return section + ":" + n; }
  function saveMockResult(section, n, score) {
    const m = read(K_MOCK, {});
    const key = mockKey(section, n);
    const prev = m[key] || { best: 0, last: 0, attempts: 0 };
    prev.attempts += 1;
    prev.last = score;
    prev.best = Math.max(prev.best, score);
    m[key] = prev;
    write(K_MOCK, m);
  }
  function mockRecord(section, n) {
    return (read(K_MOCK, {}))[mockKey(section, n)] || null;
  }

  // --- theme ---
  function getTheme() { return localStorage.getItem(K_THEME) || "light"; }
  function setTheme(t) {
    localStorage.setItem(K_THEME, t);
    document.documentElement.setAttribute("data-theme", t);
  }

  // --- daily goal tracking ---
  // Each day gets a FIXED task list (the next DAILY_GOAL unread topics),
  // snapshotted that morning. The list does NOT pile up: if you miss a day,
  // the next day simply gets a fresh snapshot. Missed tasks do not roll over.
  const K_DAILY = "ssc_cgl_daily";
  const DAILY_GOAL = 3;

  function todayStr() {
    const d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  }

  // All unread populated topics, in syllabus order.
  function unreadTopics() {
    if (!MANIFEST) return [];
    const out = [];
    MANIFEST.sections.forEach(s => {
      if (s.contentStatus === "soon") return;
      s.topics.forEach(t => { if (t.populated && !isTopicRead(t.id)) out.push(t.id); });
    });
    return out;
  }

  function dailyData() {
    const d = read(K_DAILY, {});
    const today = todayStr();
    if (d.date !== today) {
      // New day: take a fresh snapshot of today's tasks. NO pile-up —
      // we simply pick the next DAILY_GOAL unread topics this morning.
      const pool = unreadTopics();
      const tasks = pool.slice(0, DAILY_GOAL);
      d.date = today;
      d.tasks = tasks;          // fixed list of topic ids assigned today
      d.completed = [];         // which of today's tasks got done
      d.celebrated = false;
      write(K_DAILY, d);
    }
    if (!d.tasks) d.tasks = [];
    if (!d.completed) d.completed = [];
    return d;
  }

  function recordDailyCompletion(topicId) {
    const d = dailyData();
    if (d.tasks.includes(topicId) && !d.completed.includes(topicId)) {
      d.completed.push(topicId);
      write(K_DAILY, d);
    }
  }
  function dailyGoalDone() {
    const d = dailyData();
    return d.tasks.length > 0 && d.completed.length >= d.tasks.length;
  }
  function markDailyCelebrated() {
    const d = dailyData(); d.celebrated = true; write(K_DAILY, d);
  }
  function dailyStats() {
    const d = dailyData();
    return {
      tasks: d.tasks.slice(),            // array of today's assigned topic ids
      completedIds: d.completed.slice(), // array of completed topic ids (for membership checks)
      completed: d.completed.length,     // count (number)
      goal: d.tasks.length || DAILY_GOAL,
      celebrated: d.celebrated === true,
      done: dailyGoalDone(),
      totalRemaining: unreadTopics().length
    };
  }

  // history of past days for the calendar (date -> {tasks, completed})
  const K_HISTORY = "ssc_cgl_history";
  function archiveTodayIfComplete() {
    const d = dailyData();
    if (d.tasks.length === 0) return;
    const h = read(K_HISTORY, {});
    h[d.date] = { tasks: d.tasks.length, completed: d.completed.length };
    write(K_HISTORY, h);
  }
  function dayHistory(dateStr) {
    return (read(K_HISTORY, {}))[dateStr] || null;
  }
  function allHistory() { return read(K_HISTORY, {}); }

  // expose
  window.Progress = {
    bind, allProgress, topic, saveTopic, setTopicPage, markPracticeDone, isTopicRead, isTopicCompleted,
    sectionStats, sectionUnlocked, overallPct,
    saveMockResult, mockRecord,
    getTheme, setTheme,
    recordDailyCompletion, dailyGoalDone, dailyStats, markDailyCelebrated, DAILY_GOAL,
    archiveTodayIfComplete, dayHistory, allHistory, todayStr
  };
})();
