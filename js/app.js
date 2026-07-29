/* app.js — main SPA router & view renderer
 * Routes:
 *   #/                 dashboard
 *   #/section/:id      section topic list
 *   #/topic/:id        topic reader + practice
 *   #/mock/:section/:n mock test (if unlocked)
 */
(function () {
  "use strict";

  const App = {
    container: null,
    manifest: null,
    topicCache: {},  // id -> topic JSON

    async init() {
      this.container = document.getElementById("app");
      const log = (msg) => { try { console.log("[init]", msg); } catch(e){} };
      log("init started");
      // theme (default light/colorful, toggles to dark with smooth transition)
      try {
        document.body.classList.add("no-transition");
        Progress.setTheme(Progress.getTheme());
        requestAnimationFrame(() => document.body.classList.remove("no-transition"));
      } catch (e) { log("theme error: " + e.message); }
      const toggleTheme = () => {
        Progress.setTheme(Progress.getTheme() === "dark" ? "light" : "dark");
      };
      this._wire("themeToggle", el => el.addEventListener("click", toggleTheme));
      this._wire("themeToggleSidebar", el => el.addEventListener("click", toggleTheme));
      this._wire("homeBtn", el => el.addEventListener("click", () => this.route("#/")));

      // sidebar
      const openSidebar = () => document.body.classList.add("sidebar-open");
      const closeSidebar = () => document.body.classList.remove("sidebar-open");
      this._wire("hamburgerBtn", el => el.addEventListener("click", () => {
        document.body.classList.contains("sidebar-open") ? closeSidebar() : openSidebar();
      }));
      this._wire("sidebarOverlay", el => el.addEventListener("click", closeSidebar));
      // sidebar nav items route + close
      document.querySelectorAll(".sidebar-item[data-route]").forEach(el => {
        el.addEventListener("click", () => {
          this.route(el.dataset.route);
          closeSidebar();
        });
      });
      // reset progress — opens the styled confirmation modal
      this._wire("resetProgress", el => el.addEventListener("click", () => {
        document.getElementById("resetConfirmOverlay").classList.add("show");
      }));
      this._wire("resetCancel", el => el.addEventListener("click", () => {
        document.getElementById("resetConfirmOverlay").classList.remove("show");
      }));
      this._wire("resetConfirmOverlay", el => el.addEventListener("click", (e) => {
        if (e.target.id === "resetConfirmOverlay") e.currentTarget.classList.remove("show");
      }));
      this._wire("resetConfirm", el => el.addEventListener("click", () => {
        localStorage.removeItem("ssc_cgl_progress");
        localStorage.removeItem("ssc_cgl_mocks");
        localStorage.removeItem("ssc_cgl_daily");
        localStorage.removeItem("ssc_cgl_history");
        location.reload();
      }));

      // load manifest
      try {
        log("fetching manifest");
        const res = await fetch("data/manifest.json");
        log("manifest response: " + res.status);
        if (!res.ok) throw new Error("HTTP " + res.status);
        this.manifest = await res.json();
        log("manifest parsed, " + this.manifest.sections.length + " sections");
        Progress.bind(this.manifest);
        this.preloadPools();
      } catch (e) {
        log("manifest FAILED: " + e.message);
        this.container.innerHTML = `<div class="empty-state"><div class="es-icon">⚠️</div><h2>Could not load app data</h2>
          <p class="muted">Failed to load <code>data/manifest.json</code> — ${e.message}.</p>
          <p class="dim">This happens when the page is opened directly as a file (file://). Run it via a local server:<br>
          <code>python -m http.server 8765</code><br>then open <code>http://localhost:8765/</code></p></div>`;
        return;
      }

      window.addEventListener("hashchange", () => this.router());
      this.router();
      log("init complete");
    },

    // safely wire an element; log if missing instead of crashing
    _wire(id, fn) {
      const el = document.getElementById(id);
      if (el) fn(el);
      else console.warn("[init] missing element: #" + id);
    },

    // sync sidebar active state with current route
    syncSidebar(route) {
      const items = document.querySelectorAll(".sidebar-item[data-route]");
      let best = null;
      items.forEach(el => {
        el.classList.remove("active");
        const r = el.dataset.route;
        // match section routes when on a topic, plus exact dashboard match
        if (r === route) best = el;
      });
      // section match for topic/mock sub-routes
      const sectionMatch = route.match(/^#\/section\/(\w+)/);
      if (sectionMatch) {
        const el = document.querySelector(`.sidebar-item[data-route="#/section/${sectionMatch[1]}"]`);
        if (el) best = el;
      }
      if (!best) best = document.querySelector('.sidebar-item[data-route="#/"]');
      if (best) best.classList.add("active");
    },

    // hash router
    route(hash) {
      if (hash) location.hash = hash;
      else this.router();
    },
    router() {
      Clock.start();
      const h = location.hash.replace(/^#/, "") || "/";
      this.syncSidebar("#/" + h.replace(/^\//, ""));
      const parts = h.split("/").filter(Boolean); // e.g. ["topic","average"]
      if (parts.length === 0) return this.viewDashboard();
      if (parts[0] === "section" && parts[1]) return this.viewSection(parts[1]);
      if (parts[0] === "topic" && parts[1]) return this.viewTopic(parts[1]);
      if (parts[0] === "mock" && parts[1] && parts[2]) return this.viewMock(parts[1], parseInt(parts[2], 10));
      return this.viewDashboard();
    },

    mount(html) { this.container.innerHTML = html; this.renderMath(); window.scrollTo(0, 0); },
    renderMath() {
      if (window.renderMathInElement) {
        try {
          renderMathInElement(this.container, {
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false }
            ],
            throwOnError: false
          });
        } catch (e) {}
      }
    },

    setBreadcrumb(crumbs) {
      const el = document.getElementById("breadcrumb");
      // Back button: navigates to the parent crumb (second-to-last).
      // Hidden on the dashboard (single crumb).
      let backBtn = "";
      if (crumbs.length > 1) {
        const parent = crumbs[crumbs.length - 2];
        const href = parent.href || "#/";
        backBtn = `<button class="back-btn" onclick="App.route('${href}')" title="Back to ${parent.label}">
          <span class="back-arrow">←</span> <span class="back-text">Back</span>
        </button>`;
      }
      const parts = crumbs.map((c, i) => {
        if (i === crumbs.length - 1) return `<span class="current">${c.label}</span>`;
        return `<a href="${c.href || "#"}">${c.label}</a>`;
      });
      el.innerHTML = backBtn + '<span class="crumb-trail">' + parts.join('<span class="sep">/</span>') + '</span>';
    },

    sectionById(id) { return this.manifest.sections.find(s => s.id === id); },
    topicById(id) {
      for (const s of this.manifest.sections) {
        const t = s.topics.find(t => t.id === id);
        if (t) return { section: s, topic: t };
      }
      return null;
    },

    // ---------- DASHBOARD ----------
    viewDashboard() {
      this.setBreadcrumb([{ label: "Dashboard", current: true }]);
      const overall = Progress.overallPct();

      const cards = this.manifest.sections.map(s => {
        const st = Progress.sectionStats(s.id);
        const pct = st.pct;
        return `
          <div class="section-card acc-${s.id}" onclick="App.route('#/section/${s.id}')">
            <div class="sc-head">
              <div>
                <div class="sc-title">${s.name}</div>
                <div class="sc-sub">${s.contentStatus === 'soon' ? 'content coming soon' : st.completed + ' / ' + s.topics.length + ' topics completed'}</div>
              </div>
              <div class="sc-icon">${s.icon}</div>
            </div>
            <div class="sc-prog">
              <div class="pct">${pct}%</div>
              <div class="lbl">${s.contentStatus === 'soon' ? 'Syllabus pending' : 'syllabus progress'}</div>
              <div class="progress-bar"><span style="width:${pct}%"></span></div>
            </div>
          </div>`;
      }).join("");

      const mocksPanel = this.manifest.sections.map(s => {
        const unlocked = Progress.sectionUnlocked(s.id);
        const tiles = [];
        for (let n = 1; n <= 10; n++) {
          const rec = Progress.mockRecord(s.id, n);
          if (unlocked) {
            tiles.push(`<div class="mock-tile unlocked acc-${s.id}" onclick="App.route('#/mock/${s.id}/${n}')">
              <div class="mt-num">${n}</div><div class="mt-lbl">Mock ${n}</div>
              ${rec ? `<div class="mt-score">Best: ${rec.best.toFixed(1)}</div>` : `<div class="mt-lbl">25Q · 15m</div>`}
            </div>`);
          } else {
            tiles.push(`<div class="mock-tile locked acc-${s.id}">
              <div class="mt-num">${n}</div><div class="mt-lbl">Mock ${n}</div>
              <div class="mock-lock-overlay"><span class="lock-icon">🔒</span>Complete syllabus first</div>
            </div>`);
          }
        }
        return `<div class="panel mocks-panel acc-${s.id}">
          <h2>${s.icon} ${s.name} — Mock Tests</h2>
          <p class="muted" style="margin:0">10 mock tests · 25 questions each · 15 minutes · +2/-0.50 marking.
            ${unlocked ? '<strong style="color:var(--green)">Unlocked ✓</strong>' : `Locked — complete ${Progress.sectionStats(s.id).populated - Progress.sectionStats(s.id).completed} more topic(s) to unlock.`}</p>
          <div class="mock-grid">${tiles.join("")}</div>
        </div>`;
      }).join("");

      const todayPlan = this.buildTodayPlan();

      this.mount(`
        <div class="hero-banner">
          <h1>Welcome back, Lekha! 👋</h1>
          <p>Your SSC CGL Tier-I journey — read the concepts, practice questions, then unlock subject mock tests once a syllabus is complete.</p>
          <div class="hero-overall">
            <svg class="hero-ring" viewBox="0 0 46 46">
              <circle cx="23" cy="23" r="19" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="4"/>
              <circle cx="23" cy="23" r="19" fill="none" stroke="#fff" stroke-width="4"
                stroke-linecap="round" stroke-dasharray="${(2*Math.PI*19*overall/100).toFixed(1)} 999"
                transform="rotate(-90 23 23)"/>
              <text x="23" y="27" text-anchor="middle" fill="#fff" font-size="11" font-weight="800">${overall}%</text>
            </svg>
            Overall syllabus progress
          </div>
        </div>
        <div class="overall-grid">${cards}</div>

        <div class="panel">
          <h2>📅 Today's Plan</h2>
          ${todayPlan}
        </div>

        ${mocksPanel}
      `);
    },

    buildTodayPlan() {
      // Today's tasks are a FIXED list snapshotted this morning (no pile-up).
      const ds = Progress.dailyStats();
      const header = `<div class="daily-goal-head">
        <span class="dg-label">📅 Today's Tasks</span>
        <span class="dg-progress">${ds.completed}/${ds.goal} done${ds.done ? ' · ✅ CLEARED!' : ''}</span>
        <div class="daily-pips">${ds.tasks.length ? ds.tasks.map((_, i) => `<span class="pip ${i < ds.completed ? 'on' : ''}"></span>`).join('') : ''}</div>
      </div>`;

      if (ds.tasks.length === 0) {
        return header + `<div class="daily-done-banner">
          <div class="ddb-emoji">🎓</div>
          <div><strong>All caught up, Lekha!</strong><br><span class="muted">There are no unread topics left right now. Practice mocks or revisit topics!</span></div>
        </div>`;
      }
      if (ds.done) {
        // archive this day's result for the calendar
        Progress.archiveTodayIfComplete();
        return header + `<div class="daily-done-banner">
          <div class="ddb-emoji">🏆</div>
          <div><strong>Perfect day, Lekha!</strong><br><span class="muted">You've cleared all of today's tasks. Rest up — a fresh list arrives tomorrow.</span></div>
        </div>`;
      }
      // render the fixed task list with per-item done/pending status
      const items = ds.tasks.map(tid => {
        const found = this.topicById(tid);
        if (!found) return "";
        const { topic, section } = found;
        const isDone = ds.completedIds.includes(tid) || Progress.isTopicRead(tid);
        const check = isDone ? "✅" : "⬜";
        const style = isDone ? "opacity:.55" : "cursor:pointer";
        return `<li onclick="${isDone ? '' : `App.route('#/topic/${tid}')`}" style="${style}">
          <span class="pl-dot" style="${isDone ? 'background:var(--green)' : ''}">${check}</span>
          <div><strong>${topic.name}</strong> <span class="dim">· ${section.name}</span><div class="dim" style="font-size:12px">${isDone ? 'Completed ✓' : `${topic.timeline_days} day(s) · ${topic.difficulty}`}</div></div>
        </li>`;
      }).join("");
      return header + `<ul class="plan-list">${items}</ul>`;
    },

    // ---------- SECTION ----------
    viewSection(id) {
      const s = this.sectionById(id);
      if (!s) return this.viewDashboard();
      this.setBreadcrumb([{ label: "Dashboard", href: "#/" }, { label: s.name, current: true }]);

      if (s.contentStatus === "soon") {
        this.mount(`
          <div class="section-head acc-${s.id}"><span class="sh-icon">${s.icon}</span><h1 style="margin:0">${s.name}</h1></div>
          <div class="empty-state">
            <div class="es-icon">📖</div>
            <h2>Content coming soon</h2>
            <p class="muted">This section's syllabus is being prepared. Once source material is added, topics and mock tests will appear here.</p>
            <p class="dim">Tier-I weight: 25 questions / 50 marks</p>
          </div>
        `);
        return;
      }

      const st = Progress.sectionStats(id);
      const rows = s.topics.map(t => {
        const tp = Progress.topic(t.id);
        let status = "notstarted", label = "Not started";
        if (tp.practiceDone) { status = "done"; label = "Completed"; }
        else if (tp.pagesRead && tp.pagesRead.length) { status = "reading"; label = "Reading"; }
        if (!t.populated) {
          return `<div class="topic-row" style="opacity:.55;cursor:default" title="Coming soon">
            <div><div class="tr-title">${t.name}</div><div class="tr-meta"><span class="chip">${t.difficulty}</span><span class="chip weight-high">${t.tier1_weight} weight</span><span class="chip">⏳ ${t.timeline_days}d</span></div></div>
            <div class="tr-right"><span class="status-pill status-notstarted">COMING SOON</span></div>
          </div>`;
        }
        return `<div class="topic-row acc-${id}" onclick="App.route('#/topic/${t.id}')">
          <div>
            <div class="tr-title">${t.name}</div>
            <div class="tr-meta">
              <span class="chip diff-${t.difficulty}">${t.difficulty}</span>
              <span class="chip weight-high">Tier-I: ${t.tier1_weight}</span>
              <span class="chip">⏳ ${t.timeline_days} day(s)</span>
              ${tp.accuracy ? `<span class="chip" style="color:var(--green)">best ${tp.accuracy}%</span>` : ""}
            </div>
          </div>
          <div class="tr-right"><span class="status-pill status-${status}">${label}</span><div>est ${t.est_hours}h</div></div>
        </div>`;
      }).join("");

      this.mount(`
        <div class="section-head acc-${id}"><span class="sh-icon">${s.icon}</span><div><h1 style="margin:0">${s.name}</h1><div class="muted" style="font-size:13px">${s.description}</div></div></div>
        <div class="panel" style="display:flex;justify-content:space-between;align-items:center">
          <div><strong>Syllabus progress: ${st.completed}/${st.populated} topics completed</strong></div>
          <div style="width:200px"><div class="progress-bar"><span style="width:${st.pct}%"></span></div><div class="dim" style="font-size:11px;text-align:right;margin-top:4px">${st.pct}% toward mock unlock</div></div>
        </div>
        ${rows}
      `);
    },

    // ---------- TOPIC READER ----------
    async viewTopic(id) {
      const found = this.topicById(id);
      if (!found) return this.viewDashboard();
      const { section, topic } = found;

      if (!topic.populated) {
        this.setBreadcrumb([{ label: "Dashboard", href: "#/" }, { label: section.name, href: "#/section/" + section.id }, { label: topic.name, current: true }]);
        this.mount(`<div class="empty-state"><div class="es-icon">🚧</div><h2>Coming soon</h2><p class="muted">This topic is queued for population. Available topics are open in the ${section.name} section.</p>
          <button class="btn" onclick="App.route('#/section/${section.id}')">← Back to ${section.name}</button></div>`);
        return;
      }

      // load topic JSON (cached)
      let data = this.topicCache[id];
      if (!data) {
        try {
          const res = await fetch(`data/${section.id}/${id}.json`);
          data = await res.json();
          this.topicCache[id] = data;
          // feed pool for mock
          Mock.loadPool(section.id, (data.practice || []).map(q => Object.assign({ topic: id }, q)));
        } catch (e) {
          this.mount(`<div class="empty-state"><div class="es-icon">⚠️</div><p>Could not load topic file <code>data/${section.id}/${id}.json</code>.</p></div>`);
          return;
        }
      }

      const totalReadingPages = data.pages.length;
      // resume page from progress
      let pageIdx = (Progress.topic(id).page || 0);
      if (pageIdx > totalReadingPages) pageIdx = 0; // clamp (0..n-1 are pages; n is practice)
      this.renderTopicPage(id, data, section, pageIdx);
    },

    renderTopicPage(id, data, section, pageIdx) {
      const totalReadingPages = data.pages.length;
      // pageIdx 0..n-1 => reading pages; pageIdx === n => practice page
      const onPractice = pageIdx === totalReadingPages;

      Progress.setTopicPage(id, pageIdx);

      const crumbs = [
        { label: "Dashboard", href: "#/" },
        { label: section.name, href: "#/section/" + section.id },
        { label: data.name, current: true }
      ];
      this.setBreadcrumb(crumbs);

      // ---- TOC (sidebar) ----
      const tocItems = [];
      data.pages.forEach((p, i) => {
        const tp = Progress.topic(id);
        const read = tp.pagesRead && tp.pagesRead.includes(i);
        const active = i === pageIdx ? "active" : "";
        tocItems.push(`<a class="${active}" onclick="App.renderTopicPage('${id}',App.topicCache['${id}'],App.sectionById('${section.id}'),${i})">${read ? '<span class="tick">✓</span>' : '<span style="opacity:.4">○</span>'} ${p.title}</a>`);
      });
      tocItems.push(`<a class="${onPractice ? 'active' : ''}" onclick="App.renderTopicPage('${id}',App.topicCache['${id}'],App.sectionById('${section.id}'),${totalReadingPages})">📝 Practice (${data.practice.length} Qs)</a>`);

      // ---- main content ----
      let main;
      if (onPractice) {
        main = `<div class="reader-main" id="readerMain"><h2 class="page-title">📝 Practice Questions</h2><p class="practice-hint">${data.practice.length} questions · study mode · no timer, no scoring. Pick an option to reveal the explanation.</p></div>`;
      } else {
        const page = data.pages[pageIdx];
        main = `<div class="reader-main"><h2 class="page-title">${page.title}</h2><div class="reader-body">${page.body}</div></div>`;
      }

      // ---- dots ----
      const dots = [];
      for (let i = 0; i <= totalReadingPages; i++) {
        const cls = i === pageIdx ? "active" : (Progress.topic(id).pagesRead.includes(i) ? "done" : "");
        dots.push(`<span class="${cls}" onclick="App.renderTopicPage('${id}',App.topicCache['${id}'],App.sectionById('${section.id}'),${i})"></span>`);
      }

      // ---- nav ----
      const prevBtn = pageIdx > 0
        ? `<button class="btn" onclick="App.renderTopicPage('${id}',App.topicCache['${id}'],App.sectionById('${section.id}'),${pageIdx - 1})">← Previous</button>`
        : `<span></span>`;
      const nextLabel = pageIdx === totalReadingPages - 1 ? "Practice →" : "Next →";
      const nextBtn = pageIdx < totalReadingPages
        ? `<button class="btn btn-primary" onclick="App.renderTopicPage('${id}',App.topicCache['${id}'],App.sectionById('${section.id}'),${pageIdx + 1})">${nextLabel}</button>`
        : `<span></span>`;

      this.mount(`
        <div class="reader-layout">
          <aside class="reader-toc">
            <h4>${data.name}</h4>
            ${tocItems.join("")}
            <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border)">
              <div class="chip diff-${data.difficulty}" style="margin-bottom:6px">${data.difficulty}</div>
              <div class="dim" style="font-size:11px">⏳ ${data.timeline_days} day(s) · ~${data.est_hours}h<br>Tier-I: ${data.tier1_weight} weight</div>
            </div>
          </aside>
          <div>
            ${main}
            <div class="reader-nav">
              ${prevBtn}
              <div class="page-dots">${dots.join("")}</div>
              ${nextBtn}
            </div>
          </div>
        </div>
      `);

      // if practice page, render practice engine
      if (onPractice) {
        const host = document.getElementById("readerMain");
        Practice.render(host, data.practice, {
          onDone: () => {
            // Tally real accuracy: a question is correct only if the user's
            // selected option is the correct one (selected WITHOUT .wrong).
            const answered = host.querySelectorAll(".question.answered");
            let correct = 0;
            answered.forEach(q => {
              const wrong = q.querySelector(".opt.wrong");
              if (!wrong) correct++; // no wrong selection => user picked the correct option
            });
            const acc = answered.length ? Math.round((correct / answered.length) * 100) : 0;
            Progress.markPracticeDone(id, acc);

            // record for daily goal + decide celebration tier
            const wasCompleteBefore = !!host.__prevDone;
            Progress.recordDailyCompletion(id);
            const ds = Progress.dailyStats();

            // Celebrate the completion 🎉
            const subTxt = `You finished "${data.name}" — practice accuracy: ${correct}/${answered.length} (${acc}%).`;
            const dailyDoneNow = ds.done && !ds.celebrated;
            if (dailyDoneNow) {
              // daily goal met — fire the big celebration instead of the per-topic one
              Progress.markDailyCelebrated();
              Celebrate.showDaily({ completed: ds.completed, goal: ds.goal });
            } else {
              Celebrate.show({ sub: subTxt, accuracy: acc, type: "topic" });
            }
            // navigate back after a short pause (celebration overlay stays on top)
            setTimeout(() => App.route("#/section/" + section.id), 1200);
          }
        });
      }
    },

    // ---------- MOCK ----------
    viewMock(section, n) {
      if (!Progress.sectionUnlocked(section)) {
        this.setBreadcrumb([{ label: "Dashboard", href: "#/" }, { label: "Mock", current: true }]);
        this.mount(`<div class="empty-state"><div class="es-icon">🔒</div><h2>Locked</h2><p class="muted">Complete the entire ${section.toUpperCase()} syllabus first.</p><button class="btn" onclick="App.route('#/section/${section}')">Go to syllabus</button></div>`);
        return;
      }
      if (!Mock.hasPool(section)) {
        // try to load by visiting topics; otherwise prompt
        this.mount(`<div class="empty-state"><div class="es-icon">⏳</div><h2>Building question pool…</h2><p class="muted">Please open each topic once to load its questions into the mock pool, then return.</p><button class="btn" onclick="App.route('#/section/${section}')">Open topics</button></div>`);
        return;
      }
      Mock.start(section, n, this);
    },

    // preload mock pools by fetching all populated topic JSONs at startup
    async preloadPools() {
      const tasks = [];
      this.manifest.sections.forEach(s => {
        if (s.contentStatus === "soon") return;
        s.topics.forEach(t => {
          if (t.populated) {
            tasks.push(
              fetch(`data/${s.id}/${t.id}.json`).then(r => r.json()).then(data => {
                this.topicCache[t.id] = data;
                Mock.loadPool(s.id, (data.practice || []).map(q => Object.assign({ topic: t.id }, q)));
              }).catch(() => {})
            );
          }
        });
      });
      await Promise.all(tasks);
    }
  };

  window.App = App;
  document.addEventListener("DOMContentLoaded", () => App.init());
})();
