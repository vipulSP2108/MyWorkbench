/**
 * SQL Practice Platform — Interactive Minimal Frontend Application
 * Minimal, clean LeetCode / NxtWave split-view aesthetic.
 */

// Application State
const state = {
  questions: [],
  filteredQuestions: [],
  currentQuestion: null,
  currentView: "practice", // "practice" | "home" | "notes" | "settings"
  selectedDifficulty: "all", // "all" | "easy" | "medium" | "hard" | "starred"
  selectedCompany: "all",
  selectedSort: "default",
  searchQuery: "",
  drawerOpen: false,
  testcaseCollapsed: false,
  activeDocTab: "desc",
  editor: null,
  testResults: null,
  activeTestCaseIndex: 0,
  editingTestCaseIndex: null,
  testcaseEditMode: "table", // "table" | "json"

  // Home Sheet State (Screenshot 2, 3, 4)
  homeSegment: "all", // "all" | "starred" | "notes"
  homeStatusFilters: new Set(), // Set of "solved" | "in-progress" | "unsolved"
  homeDiffFilters: new Set(), // Set of "easy" | "medium" | "hard"
  homeCompany: "all",
  homeSearch: "",

  // Persistent Collections
  solvedSlugs: new Set(JSON.parse(localStorage.getItem("sqlmaster_solved") || "[]")),
  attemptedSlugs: new Set(JSON.parse(localStorage.getItem("sqlmaster_attempted") || "[]")),
  starredSlugs: new Set(JSON.parse(localStorage.getItem("sqlmaster_starred") || "[]")),
  userNotes: JSON.parse(localStorage.getItem("sqlmaster_user_notes") || "{}"),

  // Theme & Code Style
  theme: localStorage.getItem("sqlmaster_theme") || "light",
  codeTheme: localStorage.getItem("sqlmaster_code_theme") || "leetcode", // "leetcode" | "hackerrank" | "dracula"
  plainMode: localStorage.getItem("sqlmaster_plain_mode") === "true",    // Interview Assessment Mode (Pure White in Dark, Pure Black in Light)

  layout: {
    descWidth: localStorage.getItem("sqlmaster_desc_width") ? parseInt(localStorage.getItem("sqlmaster_desc_width"), 10) : null,
    editorHeight: localStorage.getItem("sqlmaster_editor_height") ? parseInt(localStorage.getItem("sqlmaster_editor_height"), 10) : null,
    descCollapsed: localStorage.getItem("sqlmaster_desc_collapsed") === "true",
    descMaximized: false,
    editorMaximized: false,
    testcaseMaximized: false,
    testcaseCollapsed: localStorage.getItem("sqlmaster_testcase_collapsed") === "true"
  },

  // Settings
  settings: {
    shortcutRun: "cmd-enter",       // "cmd-enter" | "shift-enter" | "cmd-s"
    shortcutPreview: "cmd-quote",    // "cmd-quote" | "cmd-b" | "alt-enter"
    attemptTrigger: "run",          // "run" (default) | "submit" | "open"
    showTopicTags: false,           // Default hidden to remove clutter like "ecommerce", "date-manipulation"
    fontSize: "14px",
    autoFormat: true,
    autoStartTimer: false,          // Default false: stopwatch stays idle until manually started
    autocompleteMode: localStorage.getItem("sqlmaster_autocomplete_mode") || "standard", // "standard" | "editor_only" | "off"
    codeTheme: localStorage.getItem("sqlmaster_code_theme") || "leetcode",
    plainMode: localStorage.getItem("sqlmaster_plain_mode") === "true",
    ...JSON.parse(localStorage.getItem("sqlmaster_settings") || "{}")
  }
};

const DIFFICULTY_ORDER = {
  easy: 1,
  medium: 2,
  hard: 3
};

function isQuestionSolved(slug) {
  return state.solvedSlugs.has(slug);
}

function isQuestionAttempted(slug) {
  if (state.solvedSlugs.has(slug)) return false;
  return state.attemptedSlugs.has(slug);
}

function recordAttempt(slug, triggerType) {
  if (!slug || state.solvedSlugs.has(slug)) return;
  const configured = state.settings.attemptTrigger || "run";
  let shouldMark = false;

  if (configured === "open") {
    shouldMark = true;
  } else if (configured === "run") {
    shouldMark = (triggerType === "run" || triggerType === "submit");
  } else if (configured === "submit") {
    shouldMark = (triggerType === "submit");
  }

  if (shouldMark && !state.attemptedSlugs.has(slug)) {
    state.attemptedSlugs.add(slug);
    localStorage.setItem("sqlmaster_attempted", JSON.stringify(Array.from(state.attemptedSlugs)));
    updateProgressUI();
    renderQuestionList();
    if (state.currentQuestion && state.currentQuestion.slug === slug) {
      renderQuestionDetail(state.currentQuestion);
    }
    renderHomeProblemsTable();
  }
}

// DOM Elements Safe Getters
function el(id) {
  return document.getElementById(id);
}

// ============================================================================
// Theme Controls (Light / Dark Mode)
// ============================================================================
function applyTheme(themeName) {
  state.theme = themeName;
  localStorage.setItem("sqlmaster_theme", themeName);
  document.documentElement.setAttribute("data-theme", themeName);
  document.body.setAttribute("data-theme", themeName);
  document.documentElement.setAttribute("data-code-theme", state.codeTheme);
  document.body.setAttribute("data-code-theme", state.codeTheme);

  const iconEl = el("theme-toggle-icon");
  if (iconEl) {
    iconEl.innerHTML = themeName === "dark"
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`;
  }

  const themeSelect = el("setting-theme");
  if (themeSelect) {
    themeSelect.value = themeName;
  }
}

function toggleTheme() {
  const next = state.theme === "dark" ? "light" : "dark";
  applyTheme(next);
  showToast(`Switched to ${next === "dark" ? "Dark Mode" : "Light Mode"}`);
}

// ============================================================================
// Code Syntax Styles & Interview Assessment Mode (Plain B&W)
// ============================================================================
function applyCodeTheme(themeName, isPlain = null) {
  if (themeName) {
    state.codeTheme = themeName;
    state.settings.codeTheme = themeName;
    localStorage.setItem("sqlmaster_code_theme", themeName);
  }

  if (isPlain !== null) {
    state.plainMode = isPlain;
    state.settings.plainMode = isPlain;
    localStorage.setItem("sqlmaster_plain_mode", String(isPlain));
  }

  saveSettings();

  document.documentElement.setAttribute("data-theme", state.theme);
  document.body.setAttribute("data-theme", state.theme);
  document.documentElement.setAttribute("data-code-theme", state.codeTheme);
  document.body.setAttribute("data-code-theme", state.codeTheme);
  document.documentElement.setAttribute("data-syntax-mode", state.plainMode ? "plain" : "highlighted");
  document.body.setAttribute("data-syntax-mode", state.plainMode ? "plain" : "highlighted");

  // Update top bar theme button label
  const themeLabel = el("theme-btn-label");
  if (themeLabel) {
    const labelMap = {
      leetcode: "LeetCode",
      hackerrank: "HackerRank",
      dracula: "Dracula"
    };
    themeLabel.textContent = labelMap[state.codeTheme] || "LeetCode";
  }

  // Update bottom bar indicators
  const themeIndicator = el("editor-theme-indicator");
  if (themeIndicator) {
    const labelMap = {
      leetcode: "LeetCode Style",
      hackerrank: "HackerRank Style",
      dracula: "Dracula Style"
    };
    themeIndicator.textContent = labelMap[state.codeTheme] || "LeetCode Style";
  }

  const plainBadge = el("editor-plain-badge");
  if (plainBadge) {
    plainBadge.style.display = state.plainMode ? "inline-block" : "none";
  }

  // Update plain mode button active state
  const plainBtn = el("btn-toggle-plain-mode");
  const plainText = el("plain-btn-text");
  if (plainBtn) {
    plainBtn.classList.toggle("active", state.plainMode);
  }
  if (plainText) {
    plainText.textContent = state.plainMode ? "Plain (ON)" : "Plain B&W";
  }

  // Update active state in theme dropdown menu
  document.querySelectorAll(".theme-menu-item").forEach(item => {
    item.classList.toggle("active", item.dataset.themeId === state.codeTheme);
  });

  // Update settings page controls
  const settingCodeTheme = el("setting-code-theme");
  if (settingCodeTheme) settingCodeTheme.value = state.codeTheme;

  const settingPlainMode = el("setting-plain-mode");
  if (settingPlainMode) settingPlainMode.checked = state.plainMode;

  if (state.editor) {
    state.editor.refresh();
  }
}

function togglePlainMode() {
  const next = !state.plainMode;
  applyCodeTheme(null, next);
  if (next) {
    showToast(state.theme === "dark" ? "Interview Mode: Plain White text enabled (No syntax hints)" : "Interview Mode: Plain Black text enabled (No syntax hints)");
  } else {
    showToast(`Syntax colors restored (${state.codeTheme === "leetcode" ? "LeetCode" : state.codeTheme === "hackerrank" ? "HackerRank" : "Dracula"})`);
  }
}

// ============================================================================
// Practice Stopwatch / Countdown Timer Popover (Matches Screenshots 3, 4, 5)
// ============================================================================
let timerSeconds = 0;
let timerRunning = false;
let timerInterval = null;
let timerMode = "stopwatch"; // "stopwatch" | "timer"
let timerPopoverMode = "stopwatch";
let timerCountdownTarget = 3600; // in seconds
let isTimerCollapsed = true;

function setupTimerControls() {
  const triggerBtn = el("btn-timer-trigger");
  const popover = el("timer-popover");
  const tileStopwatch = el("popover-tile-stopwatch");
  const tileTimer = el("popover-tile-timer");
  const popoverActionBtn = el("btn-timer-popover-action");
  const toggleRunBtn = el("btn-timer-toggle-run");
  const resetBarBtn = el("btn-timer-reset-bar");
  const collapseBarBtn = el("btn-timer-collapse-bar");

  // Toggle popover on trigger click
  triggerBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (timerRunning && isTimerCollapsed) {
      // If timer is running and collapsed, expand it
      isTimerCollapsed = false;
      updateTimerUI();
      return;
    }
    const isHidden = !popover || popover.style.display === "none";
    if (popover) popover.style.display = isHidden ? "block" : "none";
  });

  // Mode tile selection in popover
  tileStopwatch?.addEventListener("click", () => {
    timerPopoverMode = "stopwatch";
    tileStopwatch.classList.add("active");
    tileTimer.classList.remove("active");
    if (popoverActionBtn) {
      popoverActionBtn.textContent = (timerRunning && timerMode === "stopwatch") ? "Resume Stopwatch" : "Start Stopwatch";
    }
  });

  tileTimer?.addEventListener("click", () => {
    timerPopoverMode = "timer";
    tileTimer.classList.add("active");
    tileStopwatch.classList.remove("active");
    if (popoverActionBtn) {
      popoverActionBtn.textContent = "Start Timer";
    }
  });

  // Action button inside popover
  popoverActionBtn?.addEventListener("click", () => {
    if (timerPopoverMode === "stopwatch") {
      timerMode = "stopwatch";
      startTimer();
      showToast("Stopwatch started");
    } else {
      const hr = parseInt(el("timer-input-hr")?.value || "0", 10) || 0;
      const min = parseInt(el("timer-input-min")?.value || "0", 10) || 0;
      const totalSec = (hr * 3600) + (min * 60);
      timerCountdownTarget = totalSec > 0 ? totalSec : 3600;
      timerSeconds = timerCountdownTarget;
      timerMode = "timer";
      startTimer();
      showToast(`Countdown timer started (${hr}h ${min}m)`);
    }
    if (popover) popover.style.display = "none";
  });

  // Pause / Resume button in running bar
  toggleRunBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleTimer();
  });

  // Reset button in running bar
  resetBarBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    resetTimer();
    showToast(timerMode === "timer" ? "Timer reset" : "Stopwatch reset");
  });

  // Collapse button in running bar
  collapseBarBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    isTimerCollapsed = true;
    updateTimerUI();
  });

  // Close popover when clicking outside
  document.addEventListener("click", (e) => {
    if (popover && !popover.contains(e.target) && !triggerBtn?.contains(e.target)) {
      popover.style.display = "none";
    }
  });
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerRunning = true;
  isTimerCollapsed = false;
  updateTimerUI();

  timerInterval = setInterval(() => {
    if (timerRunning) {
      if (timerMode === "stopwatch") {
        timerSeconds++;
      } else {
        if (timerSeconds > 0) {
          timerSeconds--;
        } else {
          pauseTimer();
          showToast("Target practice time completed");
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(587.33, ctx.currentTime);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
            osc.start();
            osc.stop(ctx.currentTime + 0.6);
          } catch (e) {}
        }
      }
      updateTimerUI();
    }
  }, 1000);
}

function pauseTimer() {
  timerRunning = false;
  updateTimerUI();
}

function resumeTimer() {
  timerRunning = true;
  updateTimerUI();
}

function toggleTimer() {
  if (timerRunning) {
    pauseTimer();
    showToast("Practice Timer paused");
  } else {
    resumeTimer();
    showToast("Practice Timer running");
  }
}

function resetTimer() {
  if (timerMode === "stopwatch") {
    timerSeconds = 0;
  } else {
    timerSeconds = timerCountdownTarget;
  }
  updateTimerUI();
}

function updateTimerUI() {
  const triggerBtn = el("btn-timer-trigger");
  const runningDot = el("timer-trigger-badge");
  const activeBar = el("timer-active-bar");
  const digits = el("timer-digits-display");
  const iconPause = el("timer-icon-pause");
  const iconPlay = el("timer-icon-play");

  const hrs = String(Math.floor(timerSeconds / 3600)).padStart(2, "0");
  const mins = String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, "0");
  const secs = String(timerSeconds % 60).padStart(2, "0");
  const formatted = `${hrs}:${mins}:${secs}`;

  if (digits) digits.textContent = formatted;

  if (iconPause && iconPlay) {
    iconPause.style.display = timerRunning ? "block" : "none";
    iconPlay.style.display = timerRunning ? "none" : "block";
  }

  if (triggerBtn) {
    triggerBtn.classList.toggle("running", timerRunning);
  }

  if (runningDot) {
    runningDot.style.display = (timerRunning && isTimerCollapsed) ? "block" : "none";
  }

  if (isTimerCollapsed) {
    if (activeBar) activeBar.style.display = "none";
    if (triggerBtn) triggerBtn.style.display = "inline-flex";
  } else {
    if (activeBar) activeBar.style.display = "inline-flex";
    if (triggerBtn) triggerBtn.style.display = "none";
  }
}

// ============================================================================
// Initialization
// ============================================================================
async function init() {
  restorePreferences();
  initEditor();
  setupEventListeners();
  setupTimerControls();
  updateProgressUI();
  updateNotesCountBadge();
  if (state.settings.autoStartTimer) {
    startTimer();
  } else {
    updateTimerUI();
  }
  await loadQuestions();
}

function syncAttemptedSlugs() {
  try {
    let changed = false;
    for (const slug of Array.from(state.attemptedSlugs)) {
      if (state.solvedSlugs.has(slug)) {
        state.attemptedSlugs.delete(slug);
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem("sqlmaster_attempted", JSON.stringify(Array.from(state.attemptedSlugs)));
    }
  } catch (err) {
    console.warn("Could not sync attempted slugs:", err);
  }
}

function restorePreferences() {
  syncAttemptedSlugs();

  // Theme preference
  const savedTheme = localStorage.getItem("sqlmaster_theme") || "light";
  applyTheme(savedTheme);

  // Sort preference
  const savedSort = localStorage.getItem("sqlmaster_sort");
  const sortSelect = el("sort-select");
  if (savedSort && sortSelect) {
    sortSelect.value = savedSort;
    state.selectedSort = savedSort;
  }

  // Populate settings form controls
  const sRun = el("setting-shortcut-run");
  const sPrev = el("setting-shortcut-preview");
  const sTags = el("setting-show-tags");
  const sFont = el("setting-font-size");
  const sAuto = el("setting-auto-format");
  const sTheme = el("setting-theme");
  const sCodeTheme = el("setting-code-theme");
  const sPlainMode = el("setting-plain-mode");
  const sAutoTimer = el("setting-auto-start-timer");
  const sAutoMode = el("setting-autocomplete-mode");
  const sAttemptTrigger = el("setting-attempt-trigger");

  if (sTheme) sTheme.value = state.theme;
  if (sCodeTheme) sCodeTheme.value = state.codeTheme;
  if (sPlainMode) sPlainMode.checked = state.plainMode;
  if (sAutoMode) sAutoMode.value = state.settings.autocompleteMode || "standard";
  if (sAttemptTrigger) {
    sAttemptTrigger.value = state.settings.attemptTrigger || "run";
    sAttemptTrigger.addEventListener("change", (e) => {
      state.settings.attemptTrigger = e.target.value;
      saveSettings();
      const labels = {
        run: "On First Run (Default)",
        submit: "On First Submit Only",
        open: "When Question is Opened"
      };
      showToast(`Attempt trigger set to: ${labels[e.target.value] || e.target.value}`);
    });
  }

  const btnResetAttempted = el("btn-reset-attempted");
  if (btnResetAttempted) {
    btnResetAttempted.addEventListener("click", () => {
      state.attemptedSlugs.clear();
      localStorage.setItem("sqlmaster_attempted", "[]");
      updateProgressUI();
      renderQuestionList();
      if (state.currentQuestion) renderQuestionDetail(state.currentQuestion);
      renderHomeProblemsTable();
      showToast("Attempted questions list has been reset");
    });
  }

  if (sAutoTimer) {
    sAutoTimer.checked = !!state.settings.autoStartTimer;
    sAutoTimer.addEventListener("change", (e) => {
      state.settings.autoStartTimer = e.target.checked;
      localStorage.setItem("sqlmaster_settings", JSON.stringify(state.settings));
      showToast(`Auto-start Stopwatch ${e.target.checked ? "enabled" : "disabled"}`);
    });
  }
  if (sRun) sRun.value = state.settings.shortcutRun;
  if (sPrev) sPrev.value = state.settings.shortcutPreview;
  if (sTags) sTags.checked = state.settings.showTopicTags;
  if (sFont) sFont.value = state.settings.fontSize;
  if (sAuto) sAuto.checked = state.settings.autoFormat;

  applyCodeTheme(state.codeTheme, state.plainMode);
  applySettingsToEditor();
}

function applySettingsToEditor() {
  const cmEl = document.querySelector(".CodeMirror");
  if (cmEl) {
    cmEl.style.fontSize = state.settings.fontSize;
  }
}

// ============================================================================
// Problem Drawer Controls (Slide-out)
// ============================================================================
function openDrawer() {
  state.drawerOpen = true;
  const drawer = el("problem-drawer");
  const backdrop = el("drawer-backdrop");
  if (drawer) drawer.classList.add("open");
  if (backdrop) backdrop.classList.add("open");
  const searchInput = el("search-input");
  if (searchInput) setTimeout(() => searchInput.focus(), 150);
}

function closeDrawer() {
  state.drawerOpen = false;
  const drawer = el("problem-drawer");
  const backdrop = el("drawer-backdrop");
  if (drawer) drawer.classList.remove("open");
  if (backdrop) backdrop.classList.remove("open");
}

function toggleDrawer() {
  if (state.drawerOpen) {
    closeDrawer();
  } else {
    openDrawer();
  }
}

// ============================================================================
// View Navigation (Practice / Home / Notes / Settings)
// ============================================================================
function switchView(viewName, updateHash = true) {
  state.currentView = viewName;

  const views = [
    { name: "practice", el: el("view-practice") },
    { name: "home", el: el("view-home") },
    { name: "notes", el: el("view-notes") },
    { name: "settings", el: el("view-settings") }
  ];

  views.forEach(v => {
    if (v.el) v.el.classList.toggle("active", v.name === viewName);
  });

  // Top Bar controls visibility: ONLY show drawer button, prev/next arrows, Run, Submit on practice view!
  const isPractice = viewName === "practice";
  const headerEditorNav = el("header-editor-nav");
  const headerPracticeActions = el("header-practice-actions");

  if (headerEditorNav) headerEditorNav.style.display = isPractice ? "flex" : "none";
  if (headerPracticeActions) headerPracticeActions.style.display = isPractice ? "flex" : "none";

  // Active state for top nav links
  el("nav-btn-home")?.classList.toggle("active", viewName === "home");
  el("nav-btn-notes")?.classList.toggle("active", viewName === "notes");
  el("nav-btn-settings")?.classList.toggle("active", viewName === "settings");

  closeDrawer();
  try {
    localStorage.setItem("sqlmaster_current_view", viewName);
  } catch (e) {}

  if (updateHash) {
    if (viewName === "practice" && state.currentQuestion) {
      if (window.location.hash !== `#${state.currentQuestion.slug}`) {
        window.location.hash = state.currentQuestion.slug;
      }
    } else if (viewName === "home") {
      if (window.location.hash !== "#home" && window.location.hash !== "") {
        window.location.hash = "home";
      }
    } else if (viewName === "notes") {
      if (window.location.hash !== "#notes") {
        window.location.hash = "notes";
      }
    } else if (viewName === "settings") {
      if (window.location.hash !== "#settings") {
        window.location.hash = "settings";
      }
    }
  }

  if (viewName === "practice") {
    if (state.editor) {
      setTimeout(() => state.editor.refresh(), 50);
    }
  } else if (viewName === "home") {
    renderHomeDashboard();
  } else if (viewName === "notes") {
    renderNotesHub();
  } else if (viewName === "settings") {
    updateStorageUsageUI();
  }
}

// ============================================================================
// Editor & CodeMirror
// ============================================================================
function toggleSqlComment(cm) {
  if (!cm) {
    const tx = el("sql-editor");
    if (tx) toggleSqlCommentTextarea(tx);
    return;
  }

  const from = cm.getCursor("from");
  const to = cm.getCursor("to");
  const startLine = from.line;
  let endLine = to.line;
  const hasSelection = cm.somethingSelected();

  // If selection spans multiple lines and ends at column 0 of endLine, omit that empty trailing line
  if (hasSelection && endLine > startLine && to.ch === 0) {
    endLine--;
  }

  // Check if all non-empty lines are commented
  let allCommented = true;
  let hasNonBlank = false;
  for (let i = startLine; i <= endLine; i++) {
    const lineText = cm.getLine(i);
    const trimmed = lineText.trim();
    if (trimmed.length > 0) {
      hasNonBlank = true;
      if (!trimmed.startsWith("--")) {
        allCommented = false;
      }
    }
  }

  const shouldComment = !hasNonBlank || !allCommented;
  const originalCursor = cm.getCursor();
  let cursorDelta = 0;

  cm.operation(() => {
    if (!shouldComment) {
      // Uncomment lines: strip leading `-- ` or `--` preserving existing indentation
      for (let i = startLine; i <= endLine; i++) {
        const lineText = cm.getLine(i);
        const match = lineText.match(/^(\s*)--\s?(.*)$/);
        if (match) {
          const removedLen = lineText.length - (match[1] + match[2]).length;
          cm.replaceRange(match[1] + match[2], { line: i, ch: 0 }, { line: i, ch: lineText.length });
          if (!hasSelection && i === originalCursor.line) {
            cursorDelta = -removedLen;
          }
        }
      }
    } else {
      // Comment lines: insert `-- ` after indentation
      for (let i = startLine; i <= endLine; i++) {
        const lineText = cm.getLine(i);
        if (hasSelection && lineText.trim().length === 0) continue;
        const match = lineText.match(/^(\s*)(.*)$/);
        const indent = match ? match[1] : "";
        const rest = match ? match[2] : lineText;
        cm.replaceRange(`${indent}-- ${rest}`, { line: i, ch: 0 }, { line: i, ch: lineText.length });
        if (!hasSelection && i === originalCursor.line) {
          cursorDelta = 3;
        }
      }
    }
  });

  // Preserve selection or cursor
  if (hasSelection) {
    cm.setSelection(
      { line: startLine, ch: 0 },
      { line: endLine, ch: cm.getLine(endLine).length }
    );
  } else {
    cm.setCursor({
      line: originalCursor.line,
      ch: Math.max(0, originalCursor.ch + cursorDelta)
    });
  }

  const count = endLine - startLine + 1;
  const toastMsg = shouldComment
    ? (count > 1 ? `Commented ${count} lines (--)` : "Commented line (--)")
    : (count > 1 ? `Uncommented ${count} lines (--)` : "Uncommented line (--)");
  showToast(toastMsg);
}

function toggleSqlCommentTextarea(tx) {
  if (!tx) return;
  const start = tx.selectionStart;
  const end = tx.selectionEnd;
  const val = tx.value;

  const lineStart = val.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = val.indexOf("\n", end);
  if (lineEnd === -1) lineEnd = val.length;

  const textChunk = val.substring(lineStart, lineEnd);
  const lines = textChunk.split("\n");

  let allCommented = true;
  let hasNonBlank = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      hasNonBlank = true;
      if (!trimmed.startsWith("--")) {
        allCommented = false;
      }
    }
  }

  const shouldComment = !hasNonBlank || !allCommented;
  const newLines = lines.map(line => {
    if (!shouldComment) {
      return line.replace(/^(\s*)--\s?/, "$1");
    } else {
      if (lines.length > 1 && line.trim().length === 0) return line;
      const m = line.match(/^(\s*)(.*)$/);
      return m ? `${m[1]}-- ${m[2]}` : `-- ${line}`;
    }
  });

  const replaced = newLines.join("\n");
  tx.value = val.substring(0, lineStart) + replaced + val.substring(lineEnd);
  tx.selectionStart = lineStart;
  tx.selectionEnd = lineStart + replaced.length;

  const count = lines.length;
  showToast(shouldComment ? (count > 1 ? `Commented ${count} lines (--)` : "Commented line (--)") : (count > 1 ? `Uncommented ${count} lines (--)` : "Uncommented line (--)"));
}

// ============================================================================
// SQL Autocomplete & OA Exam-Mode Completion Engine
// ============================================================================
const SQL_AUTOCOMPLETE_FUNCTIONS = [
  { text: "CONCAT()", insert: "CONCAT()", cursorOffset: -1, type: "func", desc: "Concatenate strings" },
  { text: "COUNT()", insert: "COUNT()", cursorOffset: -1, type: "func", desc: "Count rows or values" },
  { text: "ROUND()", insert: "ROUND()", cursorOffset: -1, type: "func", desc: "Round to N decimals" },
  { text: "DATE_FORMAT()", insert: "DATE_FORMAT()", cursorOffset: -1, type: "func", desc: "Format date" },
  { text: "COALESCE()", insert: "COALESCE()", cursorOffset: -1, type: "func", desc: "First non-null value" },
  { text: "SUM()", insert: "SUM()", cursorOffset: -1, type: "func", desc: "Sum numeric column" },
  { text: "AVG()", insert: "AVG()", cursorOffset: -1, type: "func", desc: "Average numeric column" },
  { text: "MIN()", insert: "MIN()", cursorOffset: -1, type: "func", desc: "Minimum value" },
  { text: "MAX()", insert: "MAX()", cursorOffset: -1, type: "func", desc: "Maximum value" },
  { text: "DENSE_RANK() OVER ()", insert: "DENSE_RANK() OVER ()", cursorOffset: -1, type: "func", desc: "Rank without gaps" },
  { text: "ROW_NUMBER() OVER ()", insert: "ROW_NUMBER() OVER ()", cursorOffset: -1, type: "func", desc: "Sequential row number" },
  { text: "RANK() OVER ()", insert: "RANK() OVER ()", cursorOffset: -1, type: "func", desc: "Rank with gaps" },
  { text: "LAG() OVER ()", insert: "LAG() OVER ()", cursorOffset: -1, type: "func", desc: "Access preceding row" },
  { text: "LEAD() OVER ()", insert: "LEAD() OVER ()", cursorOffset: -1, type: "func", desc: "Access following row" },
  { text: "IFNULL()", insert: "IFNULL()", cursorOffset: -1, type: "func", desc: "Replace null with value" },
  { text: "NULLIF()", insert: "NULLIF()", cursorOffset: -1, type: "func", desc: "Null if expressions equal" },
  { text: "SUBSTRING()", insert: "SUBSTRING()", cursorOffset: -1, type: "func", desc: "Extract substring" },
  { text: "TRIM()", insert: "TRIM()", cursorOffset: -1, type: "func", desc: "Strip whitespace" },
  { text: "UPPER()", insert: "UPPER()", cursorOffset: -1, type: "func", desc: "Convert to uppercase" },
  { text: "LOWER()", insert: "LOWER()", cursorOffset: -1, type: "func", desc: "Convert to lowercase" },
  { text: "REPLACE()", insert: "REPLACE()", cursorOffset: -1, type: "func", desc: "Replace substrings" },
  { text: "CAST()", insert: "CAST( AS )", cursorOffset: -6, type: "func", desc: "Convert data type" },
  { text: "EXTRACT()", insert: "EXTRACT( FROM )", cursorOffset: -6, type: "func", desc: "Extract date field" },
  { text: "YEAR()", insert: "YEAR()", cursorOffset: -1, type: "func", desc: "Extract year integer" },
  { text: "MONTH()", insert: "MONTH()", cursorOffset: -1, type: "func", desc: "Extract month integer" },
  { text: "DAY()", insert: "DAY()", cursorOffset: -1, type: "func", desc: "Extract day integer" },
  { text: "DATEDIFF()", insert: "DATEDIFF()", cursorOffset: -1, type: "func", desc: "Days between dates" },
  { text: "DATE_ADD()", insert: "DATE_ADD(, INTERVAL 1 DAY)", cursorOffset: -18, type: "func", desc: "Add date interval" },
  { text: "DATE_SUB()", insert: "DATE_SUB(, INTERVAL 1 DAY)", cursorOffset: -18, type: "func", desc: "Subtract date interval" },
  { text: "ABS()", insert: "ABS()", cursorOffset: -1, type: "func", desc: "Absolute value" },
  { text: "CEIL()", insert: "CEIL()", cursorOffset: -1, type: "func", desc: "Ceiling integer" },
  { text: "FLOOR()", insert: "FLOOR()", cursorOffset: -1, type: "func", desc: "Floor integer" },
  { text: "POWER()", insert: "POWER()", cursorOffset: -1, type: "func", desc: "Exponential power" },
  { text: "SQRT()", insert: "SQRT()", cursorOffset: -1, type: "func", desc: "Square root" },
  { text: "NTILE() OVER ()", insert: "NTILE() OVER ()", cursorOffset: -1, type: "func", desc: "Divide ordered rows" },
  { text: "FIRST_VALUE() OVER ()", insert: "FIRST_VALUE() OVER ()", cursorOffset: -1, type: "func", desc: "First window value" },
  { text: "LAST_VALUE() OVER ()", insert: "LAST_VALUE() OVER ()", cursorOffset: -1, type: "func", desc: "Last window value" },
  { text: "NOW()", insert: "NOW()", cursorOffset: 0, type: "func", desc: "Current timestamp" },
  { text: "CURDATE()", insert: "CURDATE()", cursorOffset: 0, type: "func", desc: "Current date" }
];

const SQL_AUTOCOMPLETE_KEYWORDS = [
  "SELECT", "FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT",
  "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "CROSS JOIN", "ON",
  "AS", "AND", "OR", "NOT", "IN", "NOT IN", "EXISTS", "NOT EXISTS",
  "BETWEEN", "UNION", "UNION ALL", "WITH", "DISTINCT", "CASE", "WHEN",
  "THEN", "ELSE", "END", "OVER", "PARTITION BY", "DESC", "ASC",
  "IS NULL", "IS NOT NULL", "LIKE", "ILIKE", "OFFSET"
];

let autocompleteState = {
  isOpen: false,
  selectedIndex: 0,
  suggestions: [],
  prefixInfo: null
};

function escapeSqlHint(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getOrCreateAutocompletePopup() {
  let popup = el("editor-autocomplete-popup");
  if (!popup) {
    popup = document.createElement("div");
    popup.id = "editor-autocomplete-popup";
    popup.className = "editor-autocomplete-popup";
    popup.style.display = "none";
    document.body.appendChild(popup);
  }
  return popup;
}

function isAutocompleteOpen() {
  const popup = el("editor-autocomplete-popup");
  return popup && popup.style.display !== "none" && autocompleteState.isOpen && autocompleteState.suggestions.length > 0;
}

function closeAutocompletePopup() {
  autocompleteState.isOpen = false;
  autocompleteState.suggestions = [];
  autocompleteState.prefixInfo = null;
  autocompleteState.selectedIndex = 0;
  const popup = el("editor-autocomplete-popup");
  if (popup) {
    popup.style.display = "none";
    popup.innerHTML = "";
  }
}

function getAutocompletePrefix(cm) {
  const cur = cm.getCursor();
  const line = cm.getLine(cur.line);
  let startCh = cur.ch;
  while (startCh > 0 && /[a-zA-Z0-9_]/.test(line.charAt(startCh - 1))) {
    startCh--;
  }
  const prefix = line.slice(startCh, cur.ch);

  // Check if preceded by a dot and table/alias qualifier: e.g. "e." or "employee."
  let qualifier = null;
  if (startCh > 0 && line.charAt(startCh - 1) === ".") {
    let qStart = startCh - 1;
    while (qStart > 0 && /[a-zA-Z0-9_]/.test(line.charAt(qStart - 1))) {
      qStart--;
    }
    if (qStart < startCh - 1) {
      qualifier = line.slice(qStart, startCh - 1);
    }
  }

  return { prefix, startCh, endCh: cur.ch, line: cur.line, qualifier };
}

function scoreAutocompleteMatch(target, query, freq = 0) {
  const t = target.toLowerCase();
  const q = (query || "").toLowerCase();
  if (!q) return 10 + freq * 20;

  // 1. Exact match
  if (t === q) return 1000 + freq * 30;

  // 2. Exact prefix match (e.g. "can" -> "candidate_id", "s" -> "salary")
  if (t.startsWith(q)) {
    return 800 + (60 - Math.min(50, t.length)) + freq * 35;
  }

  // 3. Exact substring match (e.g. "id" -> "candidate_id") - ONLY for query length >= 2
  if (q.length >= 2 && t.includes(q)) {
    return 500 + (30 - Math.min(25, t.indexOf(q))) + freq * 20;
  }

  // 4. Repeated character typo tolerance (e.g. "candii" -> "candi", "candid" matches "candidate_id")
  const dedupQ = q.replace(/(.)\1+/g, "$1");
  if (dedupQ.length >= 2 && t.startsWith(dedupQ)) {
    return 450 + (40 - Math.min(30, t.length)) + freq * 25;
  }
  if (dedupQ.length >= 2 && t.includes(dedupQ)) {
    return 400 + freq * 20;
  }

  // 5. One character edit distance against prefix - ONLY for query length >= 3
  if (q.length >= 3) {
    const tPrefix = t.slice(0, Math.min(t.length, q.length));
    let diff = 0;
    for (let i = 0; i < Math.min(tPrefix.length, q.length); i++) {
      if (tPrefix[i] !== q[i]) diff++;
    }
    diff += Math.abs(tPrefix.length - q.length);
    if (diff <= 1 && t.length >= q.length - 1) {
      return 350 + freq * 20;
    }
  }

  // 6. Subsequence match - ONLY for query length >= 3
  if (q.length >= 3) {
    let ti = 0, qi = 0;
    while (ti < t.length && qi < q.length) {
      if (t[ti] === q[qi]) qi++;
      ti++;
    }
    if (qi === q.length) {
      return 300 + freq * 15;
    }
  }

  return 0;
}

function highlightAutocompleteMatch(target, query) {
  const t = target;
  const tLower = target.toLowerCase();
  const qLower = (query || "").toLowerCase();
  if (!qLower) return escapeSqlHint(t);

  // Exact prefix match
  if (tLower.startsWith(qLower)) {
    const matched = t.slice(0, query.length);
    const rest = t.slice(query.length);
    return `<strong class="ac-match">${escapeSqlHint(matched)}</strong>${escapeSqlHint(rest)}`;
  }

  // Deduplicated consecutive letters (e.g. candii -> candi)
  const dedupQ = qLower.replace(/(.)\1+/g, "$1");
  if (dedupQ.length >= 2 && tLower.startsWith(dedupQ)) {
    const matched = t.slice(0, dedupQ.length);
    const rest = t.slice(dedupQ.length);
    return `<strong class="ac-match">${escapeSqlHint(matched)}</strong>${escapeSqlHint(rest)}`;
  }

  // Substring match
  const idx = tLower.indexOf(qLower);
  if (idx !== -1) {
    const before = t.slice(0, idx);
    const matched = t.slice(idx, idx + query.length);
    const after = t.slice(idx + query.length);
    return `${escapeSqlHint(before)}<strong class="ac-match">${escapeSqlHint(matched)}</strong>${escapeSqlHint(after)}`;
  }

  // Subsequence or typo match: highlight characters from start that match
  let matchLen = 0;
  while (matchLen < t.length && matchLen < query.length && tLower[matchLen] === qLower[matchLen]) {
    matchLen++;
  }
  if (matchLen > 0) {
    return `<strong class="ac-match">${escapeSqlHint(t.slice(0, matchLen))}</strong>${escapeSqlHint(t.slice(matchLen))}`;
  }

  return escapeSqlHint(t);
}

function resolveTableForQualifier(qualifier, editorContent, tables) {
  if (!qualifier || !tables || tables.length === 0) return null;
  const qLower = qualifier.toLowerCase();

  // 1. Direct table name match: e.g. "employee_pay."
  for (const tbl of tables) {
    if (tbl.table_name && tbl.table_name.toLowerCase() === qLower) {
      return tbl;
    }
  }

  // 2. Look for SQL aliases in editor content: FROM tbl [AS] alias or JOIN tbl [AS] alias
  const aliasRegex = /(?:FROM|JOIN)\s+([a-zA-Z0-9_]+)(?:\s+AS)?\s+([a-zA-Z0-9_]+)/gi;
  let match;
  while ((match = aliasRegex.exec(editorContent)) !== null) {
    const rawTbl = match[1].toLowerCase();
    const rawAlias = match[2].toLowerCase();
    if (["on", "where", "join", "left", "right", "inner", "cross", "group", "order", "limit"].includes(rawAlias)) {
      continue;
    }
    if (rawAlias === qLower) {
      const found = tables.find(t => t.table_name && t.table_name.toLowerCase() === rawTbl);
      if (found) return found;
    }
  }

  // 3. Prefix or initials match: e.g. "e" matches "employee_pay", "ep" matches "employee_pay"
  for (const tbl of tables) {
    const tName = (tbl.table_name || "").toLowerCase();
    if (tName.startsWith(qLower)) return tbl;
    const initials = tName.split("_").map(part => part[0]).join("");
    if (initials === qLower) return tbl;
  }

  // 4. If single table in question, default to that table
  if (tables.length === 1) {
    return tables[0];
  }

  return null;
}

function getAutocompleteSuggestions(cm, prefixInfo, isManualTrigger) {
  const info = typeof prefixInfo === "string" ? { prefix: prefixInfo } : (prefixInfo || {});
  const prefix = info.prefix || "";
  const qualifier = info.qualifier || null;
  const lowerPrefix = prefix.toLowerCase();

  // Determine if in test / exam mode: Plain Mode (ON) or Autocomplete Mode = "editor_only"
  const isTestMode = state.plainMode || state.settings.autocompleteMode === "editor_only";
  const isOff = state.settings.autocompleteMode === "off";
  if (isOff) return [];

  const suggestions = [];
  const seenTexts = new Set();

  // Extract all words from current editor buffer
  const editorContent = cm.getValue();
  const allWords = editorContent.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
  const wordFrequency = {};
  for (const w of allWords) {
    wordFrequency[w] = (wordFrequency[w] || 0) + 1;
    wordFrequency[w.toLowerCase()] = (wordFrequency[w.toLowerCase()] || 0) + 1;
  }

  // =========================================================================
  // TEST / EXAM MODE (Plain Mode or OA Exam Mode):
  // STRICTLY ONLY suggest words that the user has actually typed in editor buffer!
  // NO database schema leaks, NO external SQL function cheating!
  // =========================================================================
  if (isTestMode) {
    const uniqueWords = Array.from(new Set(allWords));
    for (const w of uniqueWords) {
      if (w.toLowerCase() === lowerPrefix && w.length === lowerPrefix.length) continue;
      if (qualifier && w.toLowerCase() === qualifier.toLowerCase()) continue;
      const freq = wordFrequency[w] || 1;
      const score = scoreAutocompleteMatch(w, prefix, freq);
      if (score > 0) {
        suggestions.push({
          text: w,
          insert: w,
          type: "editor",
          typeIcon: "abc",
          badge: "",
          highlightedHtml: highlightAutocompleteMatch(w, prefix),
          score: score
        });
      }
    }

    suggestions.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));
    return suggestions.slice(0, 15);
  }

  // =========================================================================
  // OPEN / PRACTICE MODE (Standard):
  // =========================================================================

  // Case A: User typed a table/alias dot qualifier (e.g. "e." or "e.s")
  // Show ONLY columns belonging to that table!
  if (qualifier && state.currentQuestion) {
    const tables = state.currentQuestion.tables || [];
    const matchedTable = resolveTableForQualifier(qualifier, editorContent, tables);
    const targetTables = matchedTable ? [matchedTable] : tables;

    for (const tbl of targetTables) {
      for (const col of (tbl.columns || [])) {
        const colName = col.column_name;
        if (!colName || seenTexts.has(colName.toLowerCase())) continue;
        const freq = wordFrequency[colName.toLowerCase()] || 0;
        // If prefix is empty (user just typed "e."), suggest all columns of this table
        const score = !prefix ? 900 : scoreAutocompleteMatch(colName, prefix, freq) + 50;
        if (score > 0) {
          suggestions.push({
            text: colName,
            insert: colName,
            type: "column",
            typeIcon: "abc",
            badge: "COL",
            highlightedHtml: highlightAutocompleteMatch(colName, prefix),
            score: score
          });
          seenTexts.add(colName.toLowerCase());
        }
      }
    }

    if (suggestions.length > 0) {
      suggestions.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));
      return suggestions.slice(0, 15);
    }
  }

  // Case B: General Standard Autocomplete (No dot qualifier)
  // 1. SQL Functions
  for (const fn of SQL_AUTOCOMPLETE_FUNCTIONS) {
    const nameOnly = fn.text.replace(/\(.*$/, "");
    const freq = wordFrequency[nameOnly.toLowerCase()] || 0;
    const score = scoreAutocompleteMatch(nameOnly, prefix, freq) + 20;
    if (score > 20) {
      suggestions.push({
        text: fn.text,
        insert: fn.insert,
        cursorOffset: fn.cursorOffset,
        type: "func",
        typeIcon: "fn",
        badge: "FUNC",
        desc: fn.desc,
        highlightedHtml: highlightAutocompleteMatch(fn.text, prefix),
        score: score
      });
      seenTexts.add(nameOnly.toUpperCase());
    }
  }

  // 2. Schema Tables & Columns (from current question)
  if (state.currentQuestion) {
    const tables = state.currentQuestion.tables || [];
    for (const tbl of tables) {
      const tblName = tbl.table_name;
      if (tblName && !seenTexts.has(tblName.toLowerCase())) {
        const freq = wordFrequency[tblName.toLowerCase()] || 0;
        const score = scoreAutocompleteMatch(tblName, prefix, freq) + 15;
        if (score > 15) {
          suggestions.push({
            text: tblName,
            insert: tblName,
            type: "table",
            typeIcon: "tbl",
            badge: "TABLE",
            highlightedHtml: highlightAutocompleteMatch(tblName, prefix),
            score: score
          });
          seenTexts.add(tblName.toLowerCase());
        }
      }
      for (const col of (tbl.columns || [])) {
        const colName = col.column_name;
        if (colName && !seenTexts.has(colName.toLowerCase())) {
          const freq = wordFrequency[colName.toLowerCase()] || 0;
          const score = scoreAutocompleteMatch(colName, prefix, freq) + 15;
          if (score > 15) {
            suggestions.push({
              text: colName,
              insert: colName,
              type: "column",
              typeIcon: "abc",
              badge: "COL",
              highlightedHtml: highlightAutocompleteMatch(colName, prefix),
              score: score
            });
            seenTexts.add(colName.toLowerCase());
          }
        }
      }
    }
  }

  // 3. SQL Keywords
  for (const kw of SQL_AUTOCOMPLETE_KEYWORDS) {
    if (!seenTexts.has(kw) && !seenTexts.has(kw.toLowerCase())) {
      const freq = wordFrequency[kw.toLowerCase()] || 0;
      const score = scoreAutocompleteMatch(kw, prefix, freq);
      if (score > 0) {
        suggestions.push({
          text: kw,
          insert: kw + " ",
          type: "keyword",
          typeIcon: "kw",
          badge: "KW",
          highlightedHtml: highlightAutocompleteMatch(kw, prefix),
          score: score
        });
        seenTexts.add(kw);
      }
    }
  }

  // 4. Editor Buffer Words (CTEs, aliases, user identifiers)
  for (const w of Array.from(new Set(allWords))) {
    if (w.toLowerCase() === lowerPrefix && w.length === lowerPrefix.length) continue;
    if (!seenTexts.has(w) && !seenTexts.has(w.toUpperCase()) && !seenTexts.has(w.toLowerCase())) {
      const freq = wordFrequency[w] || 1;
      const score = scoreAutocompleteMatch(w, prefix, freq);
      if (score > 0) {
        suggestions.push({
          text: w,
          insert: w,
          type: "editor",
          typeIcon: "abc",
          badge: "BUFFER",
          highlightedHtml: highlightAutocompleteMatch(w, prefix),
          score: score
        });
        seenTexts.add(w.toLowerCase());
      }
    }
  }

  suggestions.sort((a, b) => b.score - a.score || a.text.localeCompare(b.text));
  return suggestions.slice(0, 15);
}

function updateAutocompletePosition(cm) {
  const popup = el("editor-autocomplete-popup");
  if (!popup || !cm) return;
  const coords = cm.cursorCoords(true, "page");

  let left = coords.left;
  let top = coords.bottom + 4;

  if (left + 280 > window.innerWidth) {
    left = window.innerWidth - 290;
  }
  if (top + 220 > window.innerHeight) {
    top = Math.max(10, coords.top - 225);
  }

  popup.style.left = `${Math.max(10, left)}px`;
  popup.style.top = `${Math.max(10, top)}px`;
}

function renderAutocompletePopup(cm, suggestions, prefixInfo) {
  const popup = getOrCreateAutocompletePopup();
  autocompleteState.isOpen = true;
  autocompleteState.suggestions = suggestions;
  autocompleteState.prefixInfo = prefixInfo;
  autocompleteState.selectedIndex = 0;

  popup.innerHTML = "";
  const isTestMode = state.plainMode || state.settings.autocompleteMode === "editor_only";
  suggestions.forEach((item, index) => {
    const itemEl = document.createElement("div");
    itemEl.className = `autocomplete-item${index === 0 ? " active" : ""}`;
    itemEl.dataset.index = index;

    const iconHtml = `<span class="ac-icon">${escapeSqlHint(item.typeIcon || "abc")}</span>`;
    const textHtml = `<span class="autocomplete-item-text">${item.highlightedHtml || escapeSqlHint(item.text)}</span>`;
    const badgeHtml = item.badge && !isTestMode ? `<span class="autocomplete-badge badge-${item.type}">${escapeSqlHint(item.badge)}</span>` : "";

    itemEl.innerHTML = `
      <div class="autocomplete-item-main">
        ${iconHtml}
        ${textHtml}
      </div>
      ${badgeHtml}
    `;

    itemEl.addEventListener("mouseenter", () => {
      autocompleteState.selectedIndex = index;
      updateAutocompleteActiveHighlight();
    });

    itemEl.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      applyAutocompleteItem(cm, item, prefixInfo);
    });

    popup.appendChild(itemEl);
  });

  updateAutocompletePosition(cm);
  popup.style.display = "flex";
}

function updateAutocompleteActiveHighlight() {
  const popup = el("editor-autocomplete-popup");
  if (!popup) return;
  const items = popup.querySelectorAll(".autocomplete-item");
  items.forEach((it, idx) => {
    if (idx === autocompleteState.selectedIndex) {
      it.classList.add("active");
      it.scrollIntoView({ block: "nearest" });
    } else {
      it.classList.remove("active");
    }
  });
}

function moveAutocompleteSelection(dir) {
  if (!autocompleteState.isOpen || autocompleteState.suggestions.length === 0) return;
  const total = autocompleteState.suggestions.length;
  autocompleteState.selectedIndex = (autocompleteState.selectedIndex + dir + total) % total;
  updateAutocompleteActiveHighlight();
}

function applySelectedAutocomplete(cm) {
  if (!autocompleteState.isOpen || autocompleteState.suggestions.length === 0) return;
  const item = autocompleteState.suggestions[autocompleteState.selectedIndex];
  if (item) {
    applyAutocompleteItem(cm, item, autocompleteState.prefixInfo);
  }
}

function applyAutocompleteItem(cm, item, prefixInfo) {
  if (!cm || !item) return;
  const info = prefixInfo || getAutocompletePrefix(cm);

  const from = { line: info.line, ch: info.startCh };
  const to = { line: info.line, ch: info.endCh };

  cm.replaceRange(item.insert, from, to);

  if (typeof item.cursorOffset === "number" && item.cursorOffset < 0) {
    const newCh = info.startCh + item.insert.length + item.cursorOffset;
    cm.setCursor({ line: info.line, ch: Math.max(0, newCh) });
  } else {
    cm.setCursor({ line: info.line, ch: info.startCh + item.insert.length });
  }

  closeAutocompletePopup();
  cm.focus();
}

function handleAutocompleteInput(cm) {
  if (state.settings.autocompleteMode === "off") {
    closeAutocompletePopup();
    return;
  }
  const prefixInfo = getAutocompletePrefix(cm);
  if (!prefixInfo.prefix && !prefixInfo.qualifier) {
    closeAutocompletePopup();
    return;
  }
  const suggestions = getAutocompleteSuggestions(cm, prefixInfo, false);
  if (suggestions.length === 0) {
    closeAutocompletePopup();
    return;
  }
  renderAutocompletePopup(cm, suggestions, prefixInfo);
}

function triggerAutocomplete(cm, isManual) {
  if (!cm) cm = state.editor;
  if (!cm) return;

  if (state.settings.autocompleteMode === "off") {
    if (isManual) showToast("Autocomplete is disabled in Settings");
    closeAutocompletePopup();
    return;
  }

  const prefixInfo = getAutocompletePrefix(cm);
  const suggestions = getAutocompleteSuggestions(cm, prefixInfo, isManual);
  if (suggestions.length === 0) {
    if (isManual) {
      const isTest = state.plainMode || state.settings.autocompleteMode === "editor_only";
      showToast(isTest ? "No words in editor buffer match" : "No suggestions match");
    }
    closeAutocompletePopup();
    return;
  }
  renderAutocompletePopup(cm, suggestions, prefixInfo);
}

function initEditor() {
  const editorTextarea = el("sql-editor");
  if (!editorTextarea) return;

  const extraKeys = {
    "Cmd-Enter": () => handleEditorRun(),
    "Ctrl-Enter": () => handleEditorRun(),
    "Cmd-'": () => handleEditorPreview(),
    "Ctrl-'": () => handleEditorPreview(),
    "Cmd-B": () => {
      if (state.settings.shortcutPreview === "cmd-b") handleEditorPreview();
    },
    "Ctrl-B": () => {
      if (state.settings.shortcutPreview === "cmd-b") handleEditorPreview();
    },
    "Shift-Enter": () => {
      if (state.settings.shortcutRun === "shift-enter") handleEditorRun();
    },
    "Cmd-S": () => {
      if (state.settings.shortcutRun === "cmd-s") handleEditorRun();
    },
    "Ctrl-S": () => {
      if (state.settings.shortcutRun === "cmd-s") handleEditorRun();
    },
    "Cmd-/": (cm) => toggleSqlComment(cm),
    "Ctrl-/": (cm) => toggleSqlComment(cm),
    "Ctrl-Space": (cm) => triggerAutocomplete(cm, true),
    "Tab": (cm) => {
      if (cm.somethingSelected()) {
        cm.indentSelection("add");
      } else {
        cm.replaceSelection("  ", "end");
      }
    },
    "Shift-Tab": (cm) => {
      cm.indentSelection("subtract");
    },
    "Enter": (cm) => {
      const cursor = cm.getCursor();
      const lineText = cm.getLine(cursor.line);
      const leadingSpace = (lineText.match(/^[\t ]*/) || [""])[0];
      const textBefore = lineText.slice(0, cursor.ch).trim();
      const textAfter = lineText.slice(cursor.ch).trim();

      // If user pressed enter between brackets/parentheses e.g. ( | )
      if ((textBefore.endsWith("(") && textAfter.startsWith(")")) ||
          (textBefore.endsWith("{") && textAfter.startsWith("}"))) {
        cm.replaceSelection("\n" + leadingSpace + "  \n" + leadingSpace, "start");
        cm.setCursor({ line: cursor.line + 1, ch: leadingSpace.length + 2 });
        return;
      }

      // If line ends with opening block like (, {, CASE, BEGIN
      let extra = "";
      if (textBefore.endsWith("(") || textBefore.endsWith("{") || /\b(case|begin)$/i.test(textBefore)) {
        extra = "  ";
      }

      cm.replaceSelection("\n" + leadingSpace + extra, "end");
    }
  };

  if (window.CodeMirror) {
    state.editor = CodeMirror.fromTextArea(editorTextarea, {
      mode: "text/x-mysql",
      theme: "dracula",
      lineNumbers: true,
      lineWrapping: true,
      indentWithTabs: false,
      smartIndent: false,
      electricChars: false,
      indentUnit: 2,
      tabSize: 2,
      extraKeys: extraKeys
    });
    applySettingsToEditor();
    applyCodeTheme(state.codeTheme, state.plainMode);

    // Cursor position tracking (Matches LeetCode & HackerRank Ln X, Col Y)
    state.editor.on("cursorActivity", () => {
      const pos = state.editor.getCursor();
      const posEl = el("editor-cursor-pos");
      if (posEl) posEl.textContent = `Ln ${pos.line + 1}, Col ${pos.ch + 1}`;
      if (isAutocompleteOpen()) {
        const prefixInfo = getAutocompletePrefix(state.editor);
        if (!prefixInfo.prefix && !prefixInfo.qualifier) {
          closeAutocompletePopup();
        }
      }
    });

    // Autocomplete input listener
    state.editor.on("inputRead", (cm, change) => {
      if (state.settings.autocompleteMode === "off") return;
      if (!change.text || change.text.length === 0) return;
      const ch = change.text[0];
      if (!/[a-zA-Z0-9_.]/.test(ch)) {
        closeAutocompletePopup();
        return;
      }
      handleAutocompleteInput(cm);
    });

    // Intercept navigation & selection keys when autocomplete popup is open
    state.editor.on("keydown", (cm, e) => {
      // Direct intercept for Cmd+/ and Ctrl+/ to comment/uncomment current line or selection
      if ((e.metaKey || e.ctrlKey) && (e.key === "/" || e.code === "Slash" || e.keyCode === 191)) {
        e.preventDefault();
        e.stopPropagation();
        toggleSqlComment(cm);
        return;
      }

      if (isAutocompleteOpen()) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          moveAutocompleteSelection(1);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          moveAutocompleteSelection(-1);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          e.stopPropagation();
          applySelectedAutocomplete(cm);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          closeAutocompletePopup();
          return;
        }
      }
    });

    // Close autocomplete on blur or scroll
    state.editor.on("blur", () => {
      setTimeout(() => {
        closeAutocompletePopup();
      }, 200);
    });

    state.editor.on("scroll", () => {
      if (isAutocompleteOpen()) {
        updateAutocompletePosition(state.editor);
      }
    });

    // Autosave draft on edit + indicator
    let saveTimeout = null;
    state.editor.on("change", () => {
      const saveEl = el("editor-status-saved");
      if (saveEl) {
        saveEl.textContent = "Saving...";
        saveEl.classList.remove("saved");
      }
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        if (state.currentQuestion) {
          localStorage.setItem(`sqlmaster_draft_${state.currentQuestion.slug}`, state.editor.getValue());
        }
        if (saveEl) {
          saveEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> <span>Saved</span>`;
          saveEl.classList.add("saved");
        }
      }, 300);
    });
  } else {
    editorTextarea.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "/" || e.code === "Slash")) {
        e.preventDefault();
        toggleSqlCommentTextarea(editorTextarea);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleEditorRun();
      } else if ((e.metaKey || e.ctrlKey) && (e.key === "'" || e.key === "\"")) {
        e.preventDefault();
        handleEditorPreview();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const start = editorTextarea.selectionStart;
        const val = editorTextarea.value;
        const lastNewLine = val.lastIndexOf("\n", start - 1);
        const lineText = val.substring(lastNewLine + 1, start);
        const match = lineText.match(/^[\t ]*/);
        const indent = match ? match[0] : "";
        const textBefore = lineText.trim();
        const extra = (textBefore.endsWith("(") || textBefore.endsWith("{")) ? "  " : "";
        const insertText = "\n" + indent + extra;
        const end = editorTextarea.selectionEnd;
        editorTextarea.value = val.substring(0, start) + insertText + val.substring(end);
        editorTextarea.selectionStart = editorTextarea.selectionEnd = start + insertText.length;
      } else if (e.key === "Tab") {
        e.preventDefault();
        const start = editorTextarea.selectionStart;
        const end = editorTextarea.selectionEnd;
        editorTextarea.value = editorTextarea.value.substring(0, start) + "  " + editorTextarea.value.substring(end);
        editorTextarea.selectionStart = editorTextarea.selectionEnd = start + 2;
      }
    });
  }
}

function handleEditorRun() {
  runTests();
}

function handleEditorPreview() {
  quickRunPreview();
}

function getQueryCode() {
  return state.editor ? state.editor.getValue() : (el("sql-editor")?.value || "");
}

function setQueryCode(code) {
  if (state.editor) {
    state.editor.setValue(code);
  } else if (el("sql-editor")) {
    el("sql-editor").value = code;
  }
}

function formatEditorSQL() {
  const raw = getQueryCode();
  const formatted = raw.replace(/\b(select|from|where|group by|order by|having|join|left join|right join|inner join|cross join|outer join|on|as|and|or|in|not in|with|limit|union all|union|count|sum|avg|max|min|round|distinct|over|partition by|case|when|then|else|end|coalesce|cast|extract|date_format|null|is null|is not null|between|exists|not exists)\b/gi, (m) => m.toUpperCase());
  setQueryCode(formatted);
  showToast("Formatted SQL keywords");
}

// ============================================================================
// Data Loading & API
// ============================================================================
async function loadQuestions() {
  let data = null;
  try {
    const res = await fetch("/api/questions");
    if (res.ok) {
      data = await res.json();
      try {
        localStorage.setItem("sqlmaster_cached_questions", JSON.stringify(data));
      } catch (e) {}
    }
  } catch (err) {
    console.warn("Could not fetch questions over network, trying offline cache:", err);
  }

  // Graceful offline fallback
  if (!data || !Array.isArray(data) || data.length === 0) {
    const cached = localStorage.getItem("sqlmaster_cached_questions");
    if (cached) {
      try {
        data = JSON.parse(cached);
        showToast("Loaded 100 questions from local offline cache");
      } catch (e) {}
    }
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    console.error("Failed to load questions from network or cache");
    showToast("Failed to load questions. Please check connection.");
    return;
  }

  state.questions = data;

  const countBadge = el("question-count-badge");
  if (countBadge) countBadge.textContent = data.length;

  // Populate drawer company dropdown
  const companySelect = el("company-select");
  if (companySelect) {
    companySelect.innerHTML = `<option value="all">All Companies</option>`;
    const companies = Array.from(new Set(data.map(q => q.company).filter(Boolean))).sort();
    companies.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      companySelect.appendChild(opt);
    });
  }

  // Populate home sheet company dropdown
  const homeCompanySelect = el("home-sheet-company-select");
  if (homeCompanySelect) {
    homeCompanySelect.innerHTML = `<option value="all">Company: All</option>`;
    const companies = Array.from(new Set(data.map(q => q.company).filter(Boolean))).sort();
    companies.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      homeCompanySelect.appendChild(opt);
    });
  }

  filterAndSortQuestions();

  // Determine initial route from URL hash
  handleHashNavigation();

  // Background precache for full offline support if idle
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => {
      if (!localStorage.getItem("sqlmaster_cached_all_questions")) {
        precacheAllQuestionsForOffline(false);
      }
    });
  }
}

function handleHashNavigation() {
  const rawHash = (window.location.hash || "").replace(/^#/, "").trim();
  if (!rawHash || rawHash === "home") {
    switchView("home", false);
    return;
  }
  if (rawHash === "notes") {
    switchView("notes", false);
    return;
  }
  if (rawHash === "settings") {
    switchView("settings", false);
    return;
  }
  if (rawHash === "practice") {
    const savedSlug = localStorage.getItem("sqlmaster_current_slug");
    const target = (savedSlug && state.questions.find(item => item.slug === savedSlug)) || 
                   state.currentQuestion || 
                   state.questions[0];
    if (target) {
      switchView("practice", false);
      if (!state.currentQuestion || state.currentQuestion.slug !== target.slug) {
        loadQuestionDetail(target.slug, true);
      }
    } else {
      switchView("home", false);
    }
    return;
  }

  // Question slug in URL hash
  const q = state.questions.find(item => item.slug === rawHash);
  if (q) {
    switchView("practice", false);
    loadQuestionDetail(q.slug, false);
  } else {
    // Unrecognized hash - stay on home
    switchView("home", false);
  }
}

async function loadQuestionDetail(slug, updateHash = true) {
  try {
    let q = null;
    try {
      const res = await fetch(`/api/questions/${slug}`);
      if (res.ok) {
        q = await res.json();
        try {
          localStorage.setItem(`sqlmaster_cached_q_${slug}`, JSON.stringify(q));
        } catch (e) {}
      }
    } catch (err) {
      console.warn(`Fetch for question ${slug} failed, checking offline cache:`, err);
    }

  // Offline fallback
  if (!q) {
    const cached = localStorage.getItem(`sqlmaster_cached_q_${slug}`);
    if (cached) {
      try {
        q = JSON.parse(cached);
      } catch (e) {}
    }
    if (!q) {
      const allCached = localStorage.getItem("sqlmaster_cached_all_questions");
      if (allCached) {
        try {
          const allObj = JSON.parse(allCached);
          if (allObj[slug]) q = allObj[slug];
        } catch (e) {}
      }
    }
  }

  if (!q) {
    showToast(`Could not load details for '${slug}'`);
    return;
  }

  q.original_test_cases = JSON.parse(JSON.stringify(q.test_cases || []));
  state.currentQuestion = q;
  state.editingTestCaseIndex = null;

  try {
    localStorage.setItem("sqlmaster_current_slug", slug);
    localStorage.setItem("sqlmaster_current_view", "practice");
  } catch (e) {}

  if (updateHash && state.currentView === "practice") {
    if (window.location.hash !== `#${slug}`) {
      window.location.hash = slug;
    }
  }

  // Trigger attempt recording on open if configured
  recordAttempt(slug, "open");

  renderQuestionDetail(q);
  renderQuestionList();

    // Restore draft or starter template
    const savedDraft = localStorage.getItem(`sqlmaster_draft_${slug}`);
    if (savedDraft) {
      setQueryCode(savedDraft);
    } else {
      setStarterTemplate(q);
    }

    // Load personal note
    loadPersonalNote(q.slug);

    // Reset console & tabs (immediately renders testcases before running!)
    resetConsole();

    // Reset practice stopwatch / timer
    if (state.settings.autoStartTimer) {
      timerMode = "stopwatch";
      timerSeconds = 0;
      startTimer();
    } else {
      timerMode = "stopwatch";
      timerSeconds = 0;
      timerRunning = false;
      if (timerInterval) clearInterval(timerInterval);
      isTimerCollapsed = true;
      updateTimerUI();
    }

    // Default to Description tab
    setDocTab("desc");
  } catch (err) {
    console.error("Failed to load question details:", err);
    const titleEl = el("problem-title");
    if (titleEl) titleEl.textContent = "Question details could not be loaded";
    showToast("Failed to load question details");
  }
}

function setStarterTemplate(q) {
  const tableNames = (q.tables || []).map(t => t.table_name).join(", ");
  const firstTbl = (q.tables && q.tables[0]) ? q.tables[0].table_name : "table_name";
  const template = `-- MySQL 8.0 Solution for: ${q.title}
-- Tables available: ${tableNames}

SELECT
  *
FROM ${firstTbl};
`;
  setQueryCode(template);
}

// ============================================================================
// Filtering & Sorting (strictly maintains order for navigation)
// ============================================================================
function filterAndSortQuestions() {
  const query = state.searchQuery.toLowerCase().trim();

  // 1. Filter
  let list = state.questions.filter(q => {
    let matchesDiff = true;
    if (state.selectedDifficulty === "starred") {
      matchesDiff = state.starredSlugs.has(q.slug);
    } else if (state.selectedDifficulty === "attempted") {
      matchesDiff = isQuestionAttempted(q.slug);
    } else if (state.selectedDifficulty === "solved") {
      matchesDiff = isQuestionSolved(q.slug);
    } else if (state.selectedDifficulty !== "all") {
      matchesDiff = q.difficulty.toLowerCase() === state.selectedDifficulty;
    }

    const matchesCompany = state.selectedCompany === "all" || q.company === state.selectedCompany;
    const matchesSearch = !query ||
      q.title.toLowerCase().includes(query) ||
      q.slug.toLowerCase().includes(query) ||
      (q.company && q.company.toLowerCase().includes(query)) ||
      (q.tags && q.tags.some(t => t.toLowerCase().includes(query)));

    return matchesDiff && matchesCompany && matchesSearch;
  });

  // 2. Sort
  const sortKey = state.selectedSort;
  list.sort((a, b) => {
    if (sortKey === "diff-asc") {
      const dA = DIFFICULTY_ORDER[a.difficulty.toLowerCase()] || 2;
      const dB = DIFFICULTY_ORDER[b.difficulty.toLowerCase()] || 2;
      return dA - dB || a.title.localeCompare(b.title);
    }
    if (sortKey === "diff-desc") {
      const dA = DIFFICULTY_ORDER[a.difficulty.toLowerCase()] || 2;
      const dB = DIFFICULTY_ORDER[b.difficulty.toLowerCase()] || 2;
      return dB - dA || a.title.localeCompare(b.title);
    }
    if (sortKey === "title-asc") {
      return a.title.localeCompare(b.title);
    }
    if (sortKey === "company-asc") {
      const cA = a.company || "ZZZ";
      const cB = b.company || "ZZZ";
      return cA.localeCompare(cB) || a.title.localeCompare(b.title);
    }
    if (sortKey === "status") {
      const getStatusRank = (slug) => {
        if (isQuestionSolved(slug)) return 0;
        if (isQuestionAttempted(slug)) return 1;
        return 2;
      };
      return getStatusRank(a.slug) - getStatusRank(b.slug) || a.title.localeCompare(b.title);
    }
    if (sortKey === "starred") {
      const sA = state.starredSlugs.has(a.slug) ? 0 : 1;
      const sB = state.starredSlugs.has(b.slug) ? 0 : 1;
      return sA - sB || a.title.localeCompare(b.title);
    }
    // Default: Original order in question bank
    return (state.questions.indexOf(a) - state.questions.indexOf(b));
  });

  state.filteredQuestions = list;
  const countBadge = el("question-count-badge");
  if (countBadge) countBadge.textContent = `${list.length}/${state.questions.length}`;
  renderQuestionList();
}

function renderQuestionList() {
  const qListEl = el("question-list");
  if (!qListEl) return;
  qListEl.innerHTML = "";

  if (state.filteredQuestions.length === 0) {
    qListEl.innerHTML = `<div class="empty-list-notice" style="padding: 20px; text-align: center; color: var(--text-dark-muted); font-size: 0.85rem;">No matching questions found.</div>`;
    return;
  }

  state.filteredQuestions.forEach((q) => {
    const item = document.createElement("div");
    const isActive = state.currentQuestion && state.currentQuestion.slug === q.slug;
    const isSolved = isQuestionSolved(q.slug);
    const isAttempted = isQuestionAttempted(q.slug);
    const isStarred = state.starredSlugs.has(q.slug);
    const hasNote = Boolean(state.userNotes[q.slug]);

    item.className = `drawer-q-item ${isActive ? "active" : ""}`;

    const qNum = state.questions.findIndex(item => item.slug === q.slug) + 1;

    const statusIcon = isSolved
      ? `<span class="solved-icon" title="Solved"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>`
      : isAttempted
      ? `<span class="attempted-icon" title="Attempted"><svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="7"/></svg></span>`
      : "";

    item.innerHTML = `
      <div class="drawer-q-num">${qNum}.</div>
      <div class="drawer-q-main">
        <div class="drawer-q-title-row">
          ${statusIcon}
          <span class="drawer-q-title" title="${escapeHTML(q.title)}">${escapeHTML(q.title)}</span>
          ${isStarred ? `<span class="drawer-star-icon" title="Starred"><svg width="13" height="13" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></span>` : ""}
          ${hasNote ? `<span class="drawer-note-icon" title="Has Personal Note"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></span>` : ""}
        </div>
        <div class="drawer-q-meta">
          <span>${q.company || "General"}</span>
          <span>· ${q.test_case_count} tests</span>
        </div>
      </div>
      <span class="doc-diff-pill ${q.difficulty.toLowerCase()}">${q.difficulty}</span>
    `;

    item.addEventListener("click", () => {
      switchView("practice");
      loadQuestionDetail(q.slug);
      closeDrawer();
    });

    qListEl.appendChild(item);
  });
}

// ============================================================================
// Render Problem Detail (Clean Light Aesthetic - Target Image 2)
// ============================================================================
function renderQuestionDetail(q) {
  const qNum = state.questions.findIndex(item => item.slug === q.slug) + 1;
  const total = state.questions.length || 100;

  // Title
  const titleEl = el("problem-title");
  if (titleEl) {
    titleEl.textContent = `${qNum ? qNum + ". " : ""}${q.title}`;
  }

  // Bottom counter
  const bottomCounter = el("bottom-q-counter");
  if (bottomCounter) {
    bottomCounter.textContent = `${qNum || 1} / ${total}`;
  }

  // Solved status
  const isSolved = isQuestionSolved(q.slug);
  const isAttempted = isQuestionAttempted(q.slug);
  const statusBadge = el("problem-status-badge");
  const statusText = el("problem-status-text");
  if (statusBadge && statusText) {
    if (isSolved) {
      statusBadge.className = "status-indicator-badge solved";
      statusText.textContent = "Solved";
    } else if (isAttempted) {
      statusBadge.className = "status-indicator-badge attempted";
      statusText.textContent = "Attempted";
    } else {
      statusBadge.className = "status-indicator-badge";
      statusText.textContent = "Not Attempted";
    }
  }

  // Difficulty & Company Pills
  const diffPill = el("problem-diff-pill");
  if (diffPill) {
    diffPill.className = `doc-diff-pill ${q.difficulty.toLowerCase()}`;
    diffPill.textContent = q.difficulty;
  }

  const compPill = el("problem-company-pill");
  if (compPill) {
    compPill.textContent = q.company || "General";
  }

  // Star status button
  const isStarred = state.starredSlugs.has(q.slug);
  const starBtn = el("btn-star-question");
  const bottomStar = el("btn-bottom-star");
  const starSvgFilled = `<svg width="15" height="15" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  const starSvgOutline = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

  if (starBtn) {
    starBtn.className = `panel-icon-btn ${isStarred ? "starred" : ""}`;
    starBtn.innerHTML = `<span>${isStarred ? starSvgFilled : starSvgOutline}</span>`;
    starBtn.title = isStarred ? "Starred (Click to remove)" : "Star / Bookmark Question";
  }
  if (bottomStar) {
    bottomStar.innerHTML = isStarred ? starSvgFilled : starSvgOutline;
  }

  // Problem description
  const descEl = el("problem-description");
  if (descEl) {
    descEl.innerHTML = formatTextToParagraphs(q.question);
  }

  // Tables flow: Table schema followed by Example input
  renderContinuousTables(q);

  // Expected Sample Output Box (Soft pastel blue box matching Image 2!)
  const sampleOutputEl = el("problem-sample-output");
  if (sampleOutputEl) {
    sampleOutputEl.innerHTML = createTableHTML(q.expected_output);
  }

  // Notes from problem statement
  const notesSec = el("notes-section");
  const probNotes = el("problem-notes");
  if (notesSec && probNotes) {
    if (q.notes && q.notes.length > 0) {
      notesSec.style.display = "block";
      probNotes.innerHTML = q.notes.map(n => `
        <div class="note-item">
          <span class="note-bullet">•</span>
          <span>${escapeHTML(n)}</span>
        </div>
      `).join("");
    } else {
      notesSec.style.display = "none";
    }
  }

  // Reference Solution Query & Approach
  const refCode = el("reference-sql-code");
  if (refCode) {
    refCode.textContent = q.reference_sql || "-- Solution not available.";
  }

  const editorialApproach = el("editorial-approach-content");
  if (editorialApproach) {
    const tableNames = (q.tables || []).map(t => `<span class="table-badge subtle" style="padding: 1px 7px; font-size: 0.82em;"><code class="table-name-code">${escapeHTML(t.table_name)}</code></span>`).join(", ");
    let notesSummary = "";
    if (q.notes && q.notes.length > 0) {
      notesSummary = `
        <div style="margin-top: 14px; padding: 12px 16px; background: rgba(59, 130, 246, 0.08); border-left: 3px solid #3b82f6; border-radius: 4px;">
          <strong>Problem Notes & Assumptions:</strong>
          <ul style="margin: 6px 0 0 18px; padding: 0;">
            ${q.notes.map(n => `<li>${escapeHTML(n)}</li>`).join("")}
          </ul>
        </div>
      `;
    }
    editorialApproach.innerHTML = `
      <p>To solve <strong>${escapeHTML(q.title)}</strong>, we analyze the required target entities across ${tableNames || "the schema"}.</p>
      <p>Focus on applying the necessary joins or aggregations, verify handling of edge cases, and inspect the verified MySQL 8.0 query below:</p>
      ${notesSummary}
    `;
  }
}

function renderContinuousTables(q) {
  const container = el("problem-tables-container");
  if (!container) return;
  container.innerHTML = "";

  const tables = q.tables || [];

  tables.forEach((tbl) => {
    const tableBlock = document.createElement("div");
    tableBlock.className = "table-block";

    const sampleRows = (q.sample_data && q.sample_data[tbl.table_name]) || [];

    tableBlock.innerHTML = `
      <h3 class="flow-heading flow-header-row">
        <span class="flow-label">Table:</span>
        <span class="table-badge">
          <svg class="table-badge-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>
          </svg>
          <code class="table-name-code">${escapeHTML(tbl.table_name)}</code>
        </span>
      </h3>
      <div class="table-container">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width: 50%;">Column Name</th>
              <th style="width: 50%;">Type</th>
            </tr>
          </thead>
          <tbody>
            ${tbl.columns.map(c => `
              <tr>
                <td><strong class="col-name">${escapeHTML(c.column_name)}</strong></td>
                <td><span class="data-type-label">${escapeHTML(c.data_type)}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>

      <h4 class="flow-subheading flow-header-row sub">
        <span class="flow-label">Example Input:</span>
        <span class="table-badge subtle">
          <svg class="table-badge-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>
          </svg>
          <code class="table-name-code">${escapeHTML(tbl.table_name)}</code>
        </span>
      </h4>
      <div class="table-container">
        ${createTableHTML(sampleRows)}
      </div>
    `;

    container.appendChild(tableBlock);
  });
}

function formatTextToParagraphs(text) {
  if (!text) return "";
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
  return paragraphs.map(p => {
    // Convert backtick code tokens to <code> tags
    const formatted = escapeHTML(p.trim()).replace(/`([^`]+)`/g, "<code>$1</code>");
    return `<p class="problem-p">${formatted}</p>`;
  }).join("");
}

function escapeHTML(str) {
  if (typeof str !== "string") return String(str);
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

function createTableHTML(rows) {
  if (!rows || rows.length === 0) {
    return `<div style="padding: 10px; color: var(--text-dark-muted); font-size: 0.8rem; font-style: italic;">(0 rows / empty result set)</div>`;
  }

  const cols = Object.keys(rows[0]);
  let html = `<table class="data-table"><thead><tr>`;
  cols.forEach(c => html += `<th>${escapeHTML(c)}</th>`);
  html += `</tr></thead><tbody>`;

  rows.forEach(r => {
    html += `<tr>`;
    cols.forEach(c => {
      const val = r[c];
      const isNum = typeof val === "number";
      let displayVal;
      if (val === null || val === undefined) {
        displayVal = `<span class="null-val">NULL</span>`;
      } else {
        displayVal = escapeHTML(String(val));
      }
      html += `<td class="${isNum ? "num" : ""}">${displayVal}</td>`;
    });
    html += `</tr>`;
  });

  html += `</tbody></table>`;
  return html;
}

// ============================================================================
// Doc Tabs (Description / Editorial / Notes - Distinct Sub-Pages)
// ============================================================================
function setDocTab(tabName) {
  state.activeDocTab = tabName;

  const descTab = el("tab-doc-desc");
  const editTab = el("tab-doc-editorial");
  const notesTab = el("tab-doc-notes");

  if (descTab) descTab.classList.toggle("active", tabName === "desc");
  if (editTab) editTab.classList.toggle("active", tabName === "editorial");
  if (notesTab) notesTab.classList.toggle("active", tabName === "notes");

  const paneDesc = el("subpage-desc");
  const paneEditorial = el("subpage-editorial");
  const paneNotes = el("subpage-notes");

  if (paneDesc) {
    paneDesc.style.display = tabName === "desc" ? "flex" : "none";
    if (tabName === "desc") paneDesc.scrollTop = 0;
  }
  if (paneEditorial) {
    paneEditorial.style.display = tabName === "editorial" ? "flex" : "none";
    if (tabName === "editorial") paneEditorial.scrollTop = 0;
  }
  if (paneNotes) {
    paneNotes.style.display = tabName === "notes" ? "flex" : "none";
    if (tabName === "notes") {
      const txt = el("user-note-input");
      if (txt) txt.focus();
    }
  }

  syncRailActiveTab();
}

// ============================================================================
// Star / Bookmark Management
// ============================================================================
function toggleStarCurrentQuestion() {
  if (!state.currentQuestion) return;
  const slug = state.currentQuestion.slug;
  const isStarred = state.starredSlugs.has(slug);

  if (isStarred) {
    state.starredSlugs.delete(slug);
    showToast("Removed from Starred");
  } else {
    state.starredSlugs.add(slug);
    showToast("Added to Starred");
  }

  localStorage.setItem("sqlmaster_starred", JSON.stringify(Array.from(state.starredSlugs)));
  renderQuestionDetail(state.currentQuestion);
  renderQuestionList();
}

// ============================================================================
// Personal Notes Management
// ============================================================================
function loadPersonalNote(slug) {
  const note = state.userNotes[slug] || "";
  const input = el("user-note-input");
  const delBtn = el("btn-delete-note");
  const saveStatus = el("note-save-status");

  if (input) input.value = note;
  if (delBtn) delBtn.style.display = note ? "inline-flex" : "none";
  if (saveStatus) saveStatus.textContent = "";
}

function savePersonalNote() {
  if (!state.currentQuestion) return;
  const slug = state.currentQuestion.slug;
  const input = el("user-note-input");
  const delBtn = el("btn-delete-note");
  const saveStatus = el("note-save-status");
  if (!input) return;

  const note = input.value.trim();

  if (note) {
    state.userNotes[slug] = note;
    if (delBtn) delBtn.style.display = "inline-flex";
    if (saveStatus) saveStatus.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> <span>Saved</span>`;
    showToast("Personal note saved");
  } else {
    delete state.userNotes[slug];
    if (delBtn) delBtn.style.display = "none";
    if (saveStatus) saveStatus.textContent = "";
  }

  localStorage.setItem("sqlmaster_user_notes", JSON.stringify(state.userNotes));
  setTimeout(() => { if (saveStatus) saveStatus.textContent = ""; }, 2000);
  updateNotesCountBadge();
  renderQuestionList();
}

function deletePersonalNote(slug) {
  slug = slug || (state.currentQuestion ? state.currentQuestion.slug : null);
  if (!slug) return;

  if (confirm("Delete this personal note?")) {
    delete state.userNotes[slug];
    localStorage.setItem("sqlmaster_user_notes", JSON.stringify(state.userNotes));

    if (state.currentQuestion && state.currentQuestion.slug === slug) {
      const input = el("user-note-input");
      const delBtn = el("btn-delete-note");
      const saveStatus = el("note-save-status");
      if (input) input.value = "";
      if (delBtn) delBtn.style.display = "none";
      if (saveStatus) {
        saveStatus.textContent = "Deleted";
        setTimeout(() => saveStatus.textContent = "", 2000);
      }
    }
    updateNotesCountBadge();
    renderQuestionList();
    if (state.currentView === "notes") renderNotesHub();
    showToast("Note deleted");
  }
}

function updateNotesCountBadge() {
  const count = Object.keys(state.userNotes).length;
  const badge = el("notes-badge-count");
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? "inline-flex" : "none";
  }
}

// ============================================================================
// Execution & Testing (Run / Submit)
// ============================================================================
async function runTests() {
  if (!state.currentQuestion) return;
  const sql = getQueryCode().trim();
  if (!sql) {
    alert("Please write a SQL query before submitting.");
    return;
  }

  localStorage.setItem(`sqlmaster_draft_${state.currentQuestion.slug}`, sql);

  const submitBtn = el("btn-submit");
  const spinner = el("btn-submit-spinner");
  const statusBadge = el("console-status-badge");
  const resultsEl = el("console-results");
  const placeholder = el("console-placeholder");

  if (submitBtn) submitBtn.disabled = true;
  if (spinner) spinner.style.display = "inline-block";
  if (statusBadge) {
    statusBadge.className = "testcase-status-badge ready";
    statusBadge.textContent = "Running All Tests...";
  }

  try {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        slug: state.currentQuestion.slug, 
        sql,
        test_cases: state.currentQuestion.test_cases
      })
    });
    const data = await res.json();
    state.testResults = data;
    renderTestcasePanel(state.activeTestCaseIndex || 0);

    // Record submission and update attempt status
    recordSubmission();
    recordAttempt(state.currentQuestion.slug, "submit");

    if (data.all_passed) {
      state.solvedSlugs.add(state.currentQuestion.slug);
      state.attemptedSlugs.delete(state.currentQuestion.slug);
      localStorage.setItem("sqlmaster_solved", JSON.stringify(Array.from(state.solvedSlugs)));
      localStorage.setItem("sqlmaster_attempted", JSON.stringify(Array.from(state.attemptedSlugs)));
      updateProgressUI();
      renderQuestionList();
      renderQuestionDetail(state.currentQuestion);
      renderHomeProblemsTable();
      showToast("All Test Cases Passed! Question Solved!");
    } else {
      updateProgressUI();
      renderQuestionList();
      renderQuestionDetail(state.currentQuestion);
      renderHomeProblemsTable();
      showToast("Test suite finished: Some tests failed (Marked as Attempted)");
    }
  } catch (err) {
    console.error("Test execution failed:", err);
    recordSubmission();
    if (state.currentQuestion) {
      recordAttempt(state.currentQuestion.slug, "submit");
      updateProgressUI();
      renderQuestionList();
      renderQuestionDetail(state.currentQuestion);
      renderHomeProblemsTable();
    }
    if (statusBadge) {
      statusBadge.className = "testcase-status-badge fail";
      statusBadge.textContent = "Error";
    }
    if (resultsEl) {
      if (placeholder) placeholder.style.display = "none";
      resultsEl.style.display = "block";
      resultsEl.innerHTML = `<div class="runtime-error-box">Execution error: ${escapeHTML(err.message)}</div>`;
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (spinner) spinner.style.display = "none";
  }
}

async function quickRunPreview() {
  if (!state.currentQuestion) return;
  const sql = getQueryCode().trim();
  if (!sql) return;

  const placeholder = el("console-placeholder");
  const resultsEl = el("console-results");
  const statusBadge = el("console-status-badge");
  const runBtn = el("btn-quick-run");

  if (placeholder) placeholder.style.display = "none";
  if (resultsEl) resultsEl.style.display = "block";
  if (runBtn) runBtn.disabled = true;

  if (statusBadge) {
    statusBadge.className = "testcase-status-badge ready";
    statusBadge.textContent = "Running Tests...";
  }

  try {
    // Run all test cases in fast in-memory DuckDB
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        slug: state.currentQuestion.slug, 
        sql,
        test_cases: state.currentQuestion.test_cases
      })
    });
    const data = await res.json();

    // Record attempt on run according to configured setting
    recordAttempt(state.currentQuestion.slug, "run");

    if (data.error) {
      if (statusBadge) {
        statusBadge.className = "testcase-status-badge fail";
        statusBadge.textContent = "Error";
      }
      if (resultsEl) {
        resultsEl.innerHTML = `
          <div class="runtime-error-box">
            <strong>Execution Error:</strong>
            <pre class="error-pre">${escapeHTML(data.error)}</pre>
          </div>
        `;
      }
      updateProgressUI();
      renderQuestionList();
      renderQuestionDetail(state.currentQuestion);
      renderHomeProblemsTable();
      return;
    }

    state.testResults = data;
    renderTestcasePanel(0);

    // Quick run does NOT mark problem as solved - only formal Submit does!
    updateProgressUI();
    renderQuestionList();
    renderQuestionDetail(state.currentQuestion);
    renderHomeProblemsTable();

    showToast(data.all_passed ? "All test cases passed! (Submit code to mark as Solved)" : "Test run finished: Some tests failed");
  } catch (err) {
    console.error("Run failed:", err);
    if (state.currentQuestion) {
      recordAttempt(state.currentQuestion.slug, "run");
      updateProgressUI();
      renderQuestionList();
      renderQuestionDetail(state.currentQuestion);
      renderHomeProblemsTable();
    }
    const resultsEl = el("console-results");
    if (resultsEl) {
      resultsEl.innerHTML = `<div class="runtime-error-box">Run failed: ${escapeHTML(err.message)}</div>`;
    }
  } finally {
    if (runBtn) runBtn.disabled = false;
  }
}

// ============================================================================
// Testcase Drawer Rendering (Matches Image 2)
// ============================================================================
function formatTestCaseInputLines(tc) {
  const inputTables = (tc && (tc.input_data || tc.tables)) || 
                      (state.currentQuestion && state.currentQuestion.sample_data) || {};
  
  if (Object.keys(inputTables).length === 0) {
    return `<div class="tc-line-row"><span class="tc-line-num">1</span><span class="tc-line-content">No input tables defined.</span></div>`;
  }
  let lineIdx = 1;
  let html = "";
  for (const [tblName, rows] of Object.entries(inputTables)) {
    html += `
      <div class="tc-line-row tc-table-header-row" style="color: var(--accent-cyan); font-weight: 600; margin-top: ${lineIdx > 1 ? '8px' : '0'}; margin-bottom: 2px;">
        <span class="tc-line-num">${lineIdx++}</span>
        <span class="tc-line-content">-- Table: ${escapeHTML(tblName)}</span>
      </div>
    `;
    if (rows && rows.length > 0) {
      const cols = Object.keys(rows[0]);
      // Column names row
      html += `
        <div class="tc-line-row tc-cols-header-row" style="opacity: 0.8; font-weight: 600;">
          <span class="tc-line-num">${lineIdx++}</span>
          <span class="tc-line-content">${escapeHTML(cols.join("   "))}</span>
        </div>
      `;
      rows.forEach(r => {
        const lineStr = cols.map(c => r[c] !== null && r[c] !== undefined ? String(r[c]) : "NULL").join("   ");
        html += `
          <div class="tc-line-row">
            <span class="tc-line-num">${lineIdx++}</span>
            <span class="tc-line-content">${escapeHTML(lineStr)}</span>
          </div>
        `;
      });
    } else {
      html += `
        <div class="tc-line-row">
          <span class="tc-line-num">${lineIdx++}</span>
          <span class="tc-line-content" style="color: var(--text-editor-muted); font-style: italic;">(0 rows / empty table)</span>
        </div>
      `;
    }
  }
  return html;
}

function formatRowsToLines(rows) {
  if (!rows || rows.length === 0) {
    return `<div class="tc-line-row"><span class="tc-line-num">1</span><span class="tc-line-content" style="color: var(--text-editor-muted); font-style: italic;">(0 rows / empty result set)</span></div>`;
  }
  const cols = Object.keys(rows[0]);
  let html = "";
  let lineIdx = 1;
  // Header row
  html += `
    <div class="tc-line-row tc-cols-header-row" style="opacity: 0.8; font-weight: 600;">
      <span class="tc-line-num">${lineIdx++}</span>
      <span class="tc-line-content">${escapeHTML(cols.join("   |   "))}</span>
    </div>
  `;
  rows.forEach((r) => {
    const lineStr = cols.map(c => {
      const val = r[c];
      return val === null || val === undefined ? "NULL" : String(val);
    }).join("   |   ");
    html += `
      <div class="tc-line-row">
        <span class="tc-line-num">${lineIdx++}</span>
        <span class="tc-line-content">${escapeHTML(lineStr)}</span>
      </div>
    `;
  });
  return html;
}

function renderTestCaseEditor(activeTc, idx) {
  const isTable = state.testcaseEditMode === "table";
  const inputData = activeTc.input_data || {};
  const tableNames = Object.keys(inputData);

  let editorContentHtml = "";
  if (isTable) {
    if (tableNames.length === 0) {
      editorContentHtml = `<div style="color: var(--text-editor-muted); font-size: 0.85rem; padding: 10px;">No tables defined in testcase. Switch to JSON mode to define tables.</div>`;
    } else {
      tableNames.forEach(tbl => {
        const rows = inputData[tbl] || [];
        const cols = (rows.length > 0) ? Object.keys(rows[0]) : (
          (state.currentQuestion.tables || []).find(t => t.table_name === tbl)?.columns.map(c => c.column_name) || []
        );

        let tableHeaderCols = cols.map(c => `<th>${escapeHTML(c)}</th>`).join("");
        tableHeaderCols += `<th style="width: 32px; text-align: center;"></th>`;

        let tableBodyRows = "";
        rows.forEach((r, rIdx) => {
          let rowCells = cols.map(c => {
            const val = r[c] !== null && r[c] !== undefined ? String(r[c]) : "";
            return `<td><input type="text" class="tc-cell-input" data-table="${escapeHTML(tbl)}" data-row="${rIdx}" data-col="${escapeHTML(c)}" value="${escapeHTML(val)}" placeholder="NULL" /></td>`;
          }).join("");
          tableBodyRows += `
            <tr data-row-idx="${rIdx}">
              ${rowCells}
              <td style="text-align: center;">
                <button type="button" class="tc-row-del-btn" data-table="${escapeHTML(tbl)}" data-row="${rIdx}" title="Delete Row">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </td>
            </tr>
          `;
        });

        editorContentHtml += `
          <div class="tc-edit-table-block" data-table-name="${escapeHTML(tbl)}">
            <div class="tc-edit-table-header">
              <span class="tc-edit-table-name">Table: ${escapeHTML(tbl)}</span>
              <button type="button" class="tc-btn-add-row" data-table="${escapeHTML(tbl)}">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                <span>Add Row</span>
              </button>
            </div>
            <div style="overflow-x: auto;">
              <table class="tc-table-grid">
                <thead><tr>${tableHeaderCols}</tr></thead>
                <tbody>${tableBodyRows || `<tr><td colspan="${cols.length + 1}" style="text-align: center; color: var(--text-editor-muted); padding: 8px; font-style: italic;">No rows. Click '+ Add Row' to insert data.</td></tr>`}</tbody>
              </table>
            </div>
          </div>
        `;
      });
    }
  } else {
    // JSON Mode
    const jsonStr = JSON.stringify(inputData, null, 2);
    editorContentHtml = `
      <textarea id="tc-json-editor" class="tc-json-textarea" spellcheck="false" placeholder="Enter input tables JSON here...">${escapeHTML(jsonStr)}</textarea>
    `;
  }

  return `
    <div class="tc-edit-container">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
        <span style="font-size: 0.78rem; color: var(--text-editor-muted); font-weight: 500;">
          Modify input table rows or paste raw JSON. Ground-truth expected output is automatically calculated upon saving.
        </span>
        <div style="display: flex; gap: 4px;">
          <button id="btn-tc-mode-table" class="tc-edit-action-btn ${isTable ? 'active' : ''}">Table Mode</button>
          <button id="btn-tc-mode-json" class="tc-edit-action-btn ${!isTable ? 'active' : ''}">JSON Mode</button>
        </div>
      </div>

      ${editorContentHtml}

      <div class="tc-edit-bottom-bar">
        <button id="btn-tc-cancel-edit" class="tc-edit-action-btn">Cancel</button>
        <button id="btn-tc-save-edit" class="tc-edit-action-btn success">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Save & Derive Expected Output</span>
        </button>
      </div>
    </div>
  `;
}

function attachTestCaseEditorListeners(activeTc, idx) {
  el("btn-tc-mode-table")?.addEventListener("click", () => {
    state.testcaseEditMode = "table";
    renderTestcasePanel(idx);
  });

  el("btn-tc-mode-json")?.addEventListener("click", () => {
    state.testcaseEditMode = "json";
    renderTestcasePanel(idx);
  });

  el("btn-tc-cancel-edit")?.addEventListener("click", () => {
    state.editingTestCaseIndex = null;
    renderTestcasePanel(idx);
  });

  // Table Add Row buttons
  document.querySelectorAll(".tc-btn-add-row").forEach(btn => {
    btn.addEventListener("click", () => {
      const tbl = btn.dataset.table;
      if (!tbl || !activeTc.input_data[tbl]) return;
      const rows = activeTc.input_data[tbl];
      const newRow = {};
      const cols = rows.length > 0 ? Object.keys(rows[0]) : (
        (state.currentQuestion.tables || []).find(t => t.table_name === tbl)?.columns.map(c => c.column_name) || []
      );
      cols.forEach(c => newRow[c] = null);
      rows.push(newRow);
      renderTestcasePanel(idx);
    });
  });

  // Table Row Delete buttons
  document.querySelectorAll(".tc-row-del-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tbl = btn.dataset.table;
      const rIdx = parseInt(btn.dataset.row, 10);
      if (tbl && activeTc.input_data[tbl] && !isNaN(rIdx)) {
        activeTc.input_data[tbl].splice(rIdx, 1);
        renderTestcasePanel(idx);
      }
    });
  });

  // Table Cell Input Changes (Live update into activeTc.input_data)
  document.querySelectorAll(".tc-cell-input").forEach(input => {
    input.addEventListener("input", (e) => {
      const tbl = e.target.dataset.table;
      const rIdx = parseInt(e.target.dataset.row, 10);
      const col = e.target.dataset.col;
      if (tbl && activeTc.input_data[tbl] && activeTc.input_data[tbl][rIdx]) {
        const val = e.target.value.trim();
        activeTc.input_data[tbl][rIdx][col] = val === "" ? null : val;
      }
    });
  });

  // Save & Calculate Expected Output
  el("btn-tc-save-edit")?.addEventListener("click", async () => {
    const saveBtn = el("btn-tc-save-edit");
    if (saveBtn) saveBtn.disabled = true;

    try {
      if (state.testcaseEditMode === "json") {
        const jsonEl = el("tc-json-editor");
        if (jsonEl) {
          const parsed = JSON.parse(jsonEl.value);
          activeTc.input_data = parsed;
        }
      }
      activeTc.is_edited = true;

      // Call server to dynamically derive expected output
      const res = await fetch("/api/testcase/derive-expected", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: state.currentQuestion.slug, input_data: activeTc.input_data })
      });
      const d = await res.json();
      if (d.success) {
        activeTc.expected_output = d.expected_output;
      }

      state.editingTestCaseIndex = null;
      renderTestcasePanel(idx);
      showToast("Testcase updated & expected output derived!");
    } catch (err) {
      console.error("Save testcase failed:", err);
      showToast(`Error updating testcase: ${err.message}`);
      if (saveBtn) saveBtn.disabled = false;
    }
  });
}

function deleteCustomCase(idx) {
  if (!state.currentQuestion || !state.currentQuestion.test_cases) return;
  const cases = state.currentQuestion.test_cases;
  if (!cases[idx]) return;
  cases.splice(idx, 1);
  state.editingTestCaseIndex = null;
  const nextIdx = Math.max(0, Math.min(idx, cases.length - 1));
  renderTestcasePanel(nextIdx);
  showToast("Custom testcase deleted");
}

function resetTestCaseToDefault(idx) {
  if (!state.currentQuestion || !state.currentQuestion.test_cases) return;
  const original = state.currentQuestion.original_test_cases && state.currentQuestion.original_test_cases[idx];
  if (!original) return;
  const tc = state.currentQuestion.test_cases[idx];
  tc.input_data = JSON.parse(JSON.stringify(original.input_data));
  tc.expected_output = JSON.parse(JSON.stringify(original.expected_output));
  tc.is_edited = false;
  state.editingTestCaseIndex = null;
  renderTestcasePanel(idx);
  showToast(`Reset Case ${idx + 1} to original values`);
}

function renderTestcasePanel(idx = 0) {
  state.activeTestCaseIndex = idx;
  let cases = (state.testResults && state.testResults.test_cases) || 
              (state.currentQuestion && state.currentQuestion.test_cases) || [];

  if (cases.length === 0 && state.currentQuestion && state.currentQuestion.sample_data) {
    cases = [
      {
        test_case_id: "tc_1_baseline",
        description: "Sample Data Baseline",
        category: "normal",
        input_data: state.currentQuestion.sample_data,
        expected_output: state.currentQuestion.expected_output || []
      }
    ];
  }

  const tabsRow = el("test-case-tabs");
  if (tabsRow) {
    tabsRow.innerHTML = "";
    cases.forEach((tc, i) => {
      const tabBtn = document.createElement("button");
      const isRun = Boolean(state.testResults && state.testResults.test_cases);
      const isPassed = tc.passed;
      let statusClass = "neutral";
      let iconHtml = "";

      if (isRun) {
        statusClass = isPassed ? "pass" : "fail";
        iconHtml = isPassed
          ? `<span class="tc-pill-icon pass"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>`
          : `<span class="tc-pill-icon fail"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>`;
      }

      tabBtn.className = `tc-tab-pill ${statusClass} ${i === idx ? "active" : ""}`;
      const titleLabel = tc.category === "custom" ? (tc.description || `Custom ${i + 1}`) : `Case ${i + 1}`;
      const editedMarker = tc.is_edited ? `<span style="font-size:0.75rem; color:var(--accent-blue); margin-left:3px;" title="User Modified Testcase">*</span>` : "";

      let closeBtnHtml = "";
      if (tc.category === "custom") {
        closeBtnHtml = `<span class="tc-tab-close-btn" title="Delete custom testcase" data-tc-idx="${i}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>`;
      }

      tabBtn.innerHTML = `<span>${escapeHTML(titleLabel)}${editedMarker}</span> ${iconHtml} ${closeBtnHtml}`;
      tabBtn.title = tc.description || `Case ${i + 1}`;
      tabBtn.addEventListener("click", (e) => {
        if (e.target.closest(".tc-tab-close-btn")) {
          e.stopPropagation();
          deleteCustomCase(i);
          return;
        }
        renderTestcasePanel(i);
      });
      tabsRow.appendChild(tabBtn);
    });
  }

  const resultsEl = el("console-results");
  if (!resultsEl) return;

  if (cases.length === 0) {
    resultsEl.innerHTML = `<div style="color: var(--text-editor-muted); font-size: 0.85rem; padding: 12px;">No test cases found for this question.</div>`;
    return;
  }

  const activeTc = cases[idx] || cases[0];
  const isRun = Boolean(state.testResults && state.testResults.test_cases);
  const isEditing = state.editingTestCaseIndex === idx;

  // Status Badge in Header
  const statusBadge = el("console-status-badge");
  const bracketIcon = el("testcase-bracket-icon");
  if (statusBadge) {
    if (isRun) {
      if (state.testResults.all_passed) {
        statusBadge.className = "testcase-status-badge pass";
        statusBadge.textContent = "Accepted";
        if (bracketIcon) bracketIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
      } else {
        statusBadge.className = "testcase-status-badge fail";
        statusBadge.textContent = "Wrong Answer";
        if (bracketIcon) bracketIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
      }
    } else {
      statusBadge.className = "testcase-status-badge ready";
      statusBadge.textContent = "Ready";
      if (bracketIcon) bracketIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
    }
  }

  let verdictHtml = "";
  let errorHtml = "";
  let outputSectionHtml = "";

  if (isRun) {
    if (activeTc.passed) {
      verdictHtml = `<h3 class="testcase-verdict pass">Accepted</h3>`;
    } else if (activeTc.error) {
      verdictHtml = `<h3 class="testcase-verdict fail">Runtime Error</h3>`;
      errorHtml = `
        <div class="runtime-error-box">
          <strong>Execution Error:</strong>
          <pre class="error-pre">${escapeHTML(activeTc.error)}</pre>
        </div>
      `;
    } else {
      verdictHtml = `<h3 class="testcase-verdict fail">Wrong Answer</h3>`;
    }

    outputSectionHtml = `
      <div class="tc-section-label">Your Output</div>
      <div class="testcase-code-box">${formatRowsToLines(activeTc.actual_output)}</div>

      <div class="tc-section-label">Expected</div>
      <div class="testcase-code-box">${formatRowsToLines(activeTc.expected_output)}</div>

      <div style="font-size: 0.76rem; color: var(--text-editor-muted); margin-top: 10px;">
        ${escapeHTML(activeTc.message || "")} · ${activeTc.elapsed_ms || 0} ms
      </div>
    `;
  } else {
    outputSectionHtml = `
      <div class="tc-section-label">Expected Output Preview</div>
      <div class="testcase-code-box">${formatRowsToLines(activeTc.expected_output)}</div>
      <div style="font-size: 0.78rem; color: var(--text-editor-muted); margin-top: 10px;">
        Case ${idx + 1}: ${escapeHTML(activeTc.description || "")} (${activeTc.category || "normal"}). Click <strong>Run</strong> (Cmd + ') or <strong>Submit</strong> (Cmd + Enter) to validate.
      </div>
    `;
  }

  const inputBlockHtml = isEditing 
    ? renderTestCaseEditor(activeTc, idx)
    : `<div class="testcase-code-box">${formatTestCaseInputLines(activeTc)}</div>`;

  resultsEl.innerHTML = `
    ${verdictHtml}
    ${errorHtml}

    <div class="tc-section-header">
      <div class="tc-section-label">
        Input
        ${activeTc.is_edited ? '<span style="color: var(--accent-blue); font-size: 0.72rem; font-weight: normal; margin-left: 6px;">(Modified)</span>' : ''}
      </div>
      <div class="tc-input-actions">
        <button id="btn-toggle-edit-tc" class="tc-edit-action-btn ${isEditing ? 'active' : ''}" title="${isEditing ? 'Cancel Edit' : 'Edit Input Values'}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          <span>${isEditing ? 'Cancel Edit' : 'Edit Testcase'}</span>
        </button>
        ${activeTc.is_edited && activeTc.category !== 'custom' ? `
          <button id="btn-reset-tc" class="tc-edit-action-btn" title="Reset this testcase to original default input">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
            <span>Reset Default</span>
          </button>
        ` : ''}
        ${activeTc.category === 'custom' ? `
          <button id="btn-delete-tc" class="tc-edit-action-btn danger" title="Delete this custom testcase">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            <span>Delete</span>
          </button>
        ` : ''}
      </div>
    </div>

    ${inputBlockHtml}

    ${outputSectionHtml}
  `;

  // Attach interactive listeners for testcase header & editor
  el("btn-toggle-edit-tc")?.addEventListener("click", () => {
    state.editingTestCaseIndex = isEditing ? null : idx;
    renderTestcasePanel(idx);
  });

  el("btn-reset-tc")?.addEventListener("click", () => {
    resetTestCaseToDefault(idx);
  });

  el("btn-delete-tc")?.addEventListener("click", () => {
    deleteCustomCase(idx);
  });

  if (isEditing) {
    attachTestCaseEditorListeners(activeTc, idx);
  }
}

async function addNewCustomCase() {
  if (!state.currentQuestion) return;
  const cases = state.currentQuestion.test_cases = state.currentQuestion.test_cases || [];
  const customCount = cases.filter(c => c.category === "custom").length + 1;
  const sample = JSON.parse(JSON.stringify(state.currentQuestion.sample_data || {}));
  const customCase = {
    test_case_id: `custom_${Date.now()}`,
    category: "custom",
    description: `Custom Case ${customCount}`,
    input_data: sample,
    expected_output: [],
    is_edited: true
  };
  cases.push(customCase);
  const newIdx = cases.length - 1;
  state.editingTestCaseIndex = newIdx;
  renderTestcasePanel(newIdx);

  // Derive initial expected output for this new testcase
  try {
    const res = await fetch("/api/testcase/derive-expected", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: state.currentQuestion.slug, input_data: sample })
    });
    const d = await res.json();
    if (d.success) {
      customCase.expected_output = d.expected_output;
      renderTestcasePanel(newIdx);
    }
  } catch (e) {
    console.error("Derive expected failed:", e);
  }
  showToast(`Added Custom Case ${customCount}`);
}

function resetConsole() {
  state.testResults = null;
  state.activeTestCaseIndex = 0;
  const bracketIcon = el("testcase-bracket-icon");
  if (bracketIcon) bracketIcon.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;

  const statusBadge = el("console-status-badge");
  if (statusBadge) {
    statusBadge.className = "testcase-status-badge ready";
    statusBadge.textContent = "Ready";
  }

  // Render initial test cases immediately on question load!
  renderTestcasePanel(0);
}

function getSubmissionCount() {
  const stored = parseInt(localStorage.getItem("sqlmaster_total_submissions") || "0", 10);
  const solved = state.solvedSlugs.size;
  const attempting = Array.from(state.attemptedSlugs).filter(s => !state.solvedSlugs.has(s)).length;
  return Math.max(stored, solved + attempting);
}

function recordSubmission() {
  const current = getSubmissionCount();
  const next = current + 1;
  localStorage.setItem("sqlmaster_total_submissions", String(next));
  return next;
}

function updateProgressUI() {
  const solvedCount = state.solvedSlugs.size;
  const total = state.questions.length || 100;
  const textEl = el("solved-stats-text");
  if (textEl) {
    textEl.textContent = `${solvedCount} / ${total}`;
  }
  renderHomeDashboard();
}

// Toast popup
function showToast(msg) {
  const toast = el("toast-notification");
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = "block";
  toast.classList.add("visible");
  setTimeout(() => {
    toast.classList.remove("visible");
    setTimeout(() => toast.style.display = "none", 300);
  }, 2200);
}

// ============================================================================
// Navigation (Strictly uses filtered & sorted question order)
// ============================================================================
function navigateQuestion(delta) {
  if (!state.currentQuestion) return;

  const list = state.filteredQuestions.length > 0 ? state.filteredQuestions : state.questions;
  if (list.length === 0) return;

  const currentIdx = list.findIndex(q => q.slug === state.currentQuestion.slug);
  let nextIdx;

  if (currentIdx === -1) {
    nextIdx = delta > 0 ? 0 : list.length - 1;
  } else {
    nextIdx = (currentIdx + delta + list.length) % list.length;
  }

  loadQuestionDetail(list[nextIdx].slug);
}

// ============================================================================
// Home Dashboard & Problems Sheet Rendering (Matches LeetCode & User Reference Recording)
// ============================================================================
function renderHomeDashboard() {
  const total = state.questions.length || 100;
  const solved = state.solvedSlugs.size;
  const attempting = Array.from(state.attemptedSlugs).filter(s => !state.solvedSlugs.has(s)).length;
  const pct = Math.round((solved / total) * 100);

  // 1. Gauge Default View (Solved & Attempting)
  const bigNumEl = el("home-stat-solved-big");
  const denomEl = el("home-stat-total-denom");
  const attemptingEl = el("home-stat-attempting");

  if (bigNumEl) bigNumEl.textContent = solved;
  if (denomEl) denomEl.textContent = `/${total}`;
  if (attemptingEl) {
    attemptingEl.textContent = `${attempting} Attempting`;
  }

  // 2. Gauge Hover View (Acceptance Rate & Total Submissions)
  const totalSubmissions = getSubmissionCount();
  const accIntEl = el("home-stat-acc-int");
  const accDecEl = el("home-stat-acc-dec");
  const subsEl = el("home-stat-submissions");

  let accInt = "0";
  let accDec = ".00%";
  if (totalSubmissions > 0) {
    const rate = (solved / totalSubmissions) * 100;
    const parts = rate.toFixed(2).split(".");
    accInt = parts[0];
    accDec = "." + parts[1] + "%";
  }

  if (accIntEl) accIntEl.textContent = accInt;
  if (accDecEl) accDecEl.textContent = accDec;
  if (subsEl) {
    subsEl.textContent = `${totalSubmissions} submission${totalSubmissions === 1 ? "" : "s"}`;
  }

  // 3. Easy / Med / Hard breakdown
  const easyQuestions = state.questions.filter(q => q.difficulty.toLowerCase() === "easy");
  const medQuestions = state.questions.filter(q => q.difficulty.toLowerCase() === "medium");
  const hardQuestions = state.questions.filter(q => q.difficulty.toLowerCase() === "hard");

  const easyTotal = easyQuestions.length || 34;
  const easySolved = easyQuestions.filter(q => state.solvedSlugs.has(q.slug)).length;
  const medTotal = medQuestions.length || 39;
  const medSolved = medQuestions.filter(q => state.solvedSlugs.has(q.slug)).length;
  const hardTotal = hardQuestions.length || 27;
  const hardSolved = hardQuestions.filter(q => state.solvedSlugs.has(q.slug)).length;

  const sEasy = el("home-stat-easy");
  const sMed = el("home-stat-medium");
  const sHard = el("home-stat-hard");
  if (sEasy) sEasy.textContent = `${easySolved}/${easyTotal}`;
  if (sMed) sMed.textContent = `${medSolved}/${medTotal}`;
  if (sHard) sHard.textContent = `${hardSolved}/${hardTotal}`;

  // 4. Update SVG Arcs (Default State: Solved & Attempted)
  // Path has pathLength="100"
  const solvedArc = el("gauge-arc-solved");
  const attemptedArc = el("gauge-arc-attempted");

  const solvedPct = total > 0 ? (solved / total) * 100 : 0;
  const attemptingPct = total > 0 ? (attempting / total) * 100 : 0;

  if (solvedArc) {
    if (solvedPct <= 0) {
      solvedArc.setAttribute("stroke-dasharray", "0 100");
      solvedArc.setAttribute("stroke-dashoffset", "0");
      solvedArc.style.display = "none";
    } else {
      solvedArc.setAttribute("stroke-dasharray", `${solvedPct} 100`);
      solvedArc.setAttribute("stroke-dashoffset", "0");
      solvedArc.style.display = "";
      solvedArc.style.removeProperty("opacity");
    }
  }

  if (attemptedArc) {
    if (attempting <= 0) {
      attemptedArc.setAttribute("stroke-dasharray", "0 100");
      attemptedArc.style.display = "none";
    } else {
      // Show attempting segment with a clean 1.4% gap after solved arc
      const arcLen = Math.max(attemptingPct, 2.2);
      const gap = solvedPct > 0 ? 1.4 : 0;
      const offset = -(solvedPct + gap);
      attemptedArc.setAttribute("stroke-dasharray", `${arcLen} 100`);
      attemptedArc.setAttribute("stroke-dashoffset", `${offset}`);
      attemptedArc.style.display = "";
      attemptedArc.style.removeProperty("opacity");
    }
  }

  // 5. Update SVG Arcs (Hover State: Multi-color breakdown)
  const arcEasy = el("gauge-arc-easy");
  const arcMed = el("gauge-arc-med");
  const arcHard = el("gauge-arc-hard");

  const easyPctOfTotal = total > 0 ? (easySolved / total) * 100 : 0;
  const medPctOfTotal = total > 0 ? (medSolved / total) * 100 : 0;
  const hardPctOfTotal = total > 0 ? (hardSolved / total) * 100 : 0;

  const segGap = 0.8; // Clean gap between breakdown segments
  let currentOffset = 0;

  // Easy (Teal) comes first at offset 0
  if (arcEasy) {
    if (easySolved > 0) {
      arcEasy.setAttribute("stroke-dasharray", `${easyPctOfTotal} 100`);
      arcEasy.setAttribute("stroke-dashoffset", "0");
      currentOffset += easyPctOfTotal + segGap;
    } else {
      arcEasy.setAttribute("stroke-dasharray", "0 100");
      arcEasy.setAttribute("stroke-dashoffset", "0");
    }
  }

  // Med (Yellow) comes second, strictly after Easy
  if (arcMed) {
    if (medSolved > 0) {
      arcMed.setAttribute("stroke-dasharray", `${medPctOfTotal} 100`);
      arcMed.setAttribute("stroke-dashoffset", `-${currentOffset}`);
      currentOffset += medPctOfTotal + segGap;
    } else {
      arcMed.setAttribute("stroke-dasharray", "0 100");
      arcMed.setAttribute("stroke-dashoffset", "0");
    }
  }

  // Hard (Coral Red) comes third, strictly after Med
  if (arcHard) {
    if (hardSolved > 0) {
      arcHard.setAttribute("stroke-dasharray", `${hardPctOfTotal} 100`);
      arcHard.setAttribute("stroke-dashoffset", `-${currentOffset}`);
    } else {
      arcHard.setAttribute("stroke-dasharray", "0 100");
      arcHard.setAttribute("stroke-dashoffset", "0");
    }
  }

  // Ensure hover event handlers completely isolate default arcs from hover breakdown arcs
  const gaugeCard = el("progress-gauge-card");
  if (gaugeCard && !gaugeCard._hasHoverListeners) {
    gaugeCard._hasHoverListeners = true;
    gaugeCard.addEventListener("mouseenter", () => {
      gaugeCard.classList.add("is-hovered");
      const sA = el("gauge-arc-solved");
      const aA = el("gauge-arc-attempted");
      if (sA) sA.style.display = "none";
      if (aA) aA.style.display = "none";
    });
    gaugeCard.addEventListener("mouseleave", () => {
      gaugeCard.classList.remove("is-hovered");
      const sA = el("gauge-arc-solved");
      const aA = el("gauge-arc-attempted");
      if (sA && state.solvedSlugs.size > 0) sA.style.display = "";
      const attCount = Array.from(state.attemptedSlugs).filter(s => !state.solvedSlugs.has(s)).length;
      if (aA && attCount > 0) aA.style.display = "";
    });
  }

  // Render Streak Calendar Widget (Screenshot 1)
  renderStreakCalendar();

  // Populate Company Options in Filter Popover
  populateCompanyFilterOptions();

  // Update Toolbar Counter (Screenshot 3 & 4)
  const counterPill = el("filter-progress-count");
  if (counterPill) counterPill.textContent = `${solved} / ${total}`;

  // Update Right Sidebar Widgets
  updateHomeCompanyCloud(el("home-company-search-input")?.value || "");
  updateStarredSidebar();
  updateNotesSidebar();

  // Render Active Filter Tags & Table
  renderActiveFilterTags();
  renderHomeProblemsTable();
}

function renderStreakCalendar() {
  const calGrid = el("streak-calendar-grid");
  if (!calGrid) return;

  // October 2026 starts on Thursday (3 empty slots for Mon, Tue, Wed)
  const emptySlots = 3;
  const totalDays = 31;
  let cellsHTML = "";

  for (let i = 0; i < emptySlots; i++) {
    cellsHTML += `<div class="cal-day-cell empty"></div>`;
  }

  for (let day = 1; day <= totalDays; day++) {
    let classes = "cal-day-cell";
    let title = `October ${day}, 2026`;

    if (day >= 1 && day <= 3) {
      classes += " active-streak";
      title += " — Practice Streak Active";
    } else if (day === 4) {
      classes += " today active-streak";
      title += " — Today Practice Active";
    }

    cellsHTML += `<div class="${classes}" title="${title}">${day}</div>`;
  }

  calGrid.innerHTML = cellsHTML;
}

function populateCompanyFilterOptions() {
  const container = el("menu-company-list");
  if (!container) return;

  const companies = Array.from(new Set(state.questions.map(q => q.company).filter(Boolean))).sort();
  const searchVal = (el("menu-search-companies")?.value || "").toLowerCase().trim();

  const filtered = companies.filter(c => !searchVal || c.toLowerCase().includes(searchVal));

  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding: 10px 14px; font-size: 0.78rem; color: var(--text-muted);">No matching companies</div>`;
    return;
  }

  container.innerHTML = `
    <label class="filter-menu-opt">
      <input type="radio" name="company-filter" value="all" ${state.homeCompany === "all" ? "checked" : ""} />
      <span>All Companies</span>
    </label>
    ${filtered.map(c => {
      const cnt = state.questions.filter(q => q.company === c).length;
      return `
        <label class="filter-menu-opt">
          <input type="radio" name="company-filter" value="${escapeHTML(c)}" ${state.homeCompany === c ? "checked" : ""} />
          <span>${escapeHTML(c)}</span>
          <span style="margin-left: auto; font-size: 0.72rem; color: var(--text-muted);">(${cnt})</span>
        </label>
      `;
    }).join("")}
  `;

  container.querySelectorAll('input[name="company-filter"]').forEach(radio => {
    radio.addEventListener("change", () => {
      state.homeCompany = radio.value;
      const menu = el("menu-filter-company");
      if (menu) menu.style.display = "none";
      renderActiveFilterTags();
      renderHomeProblemsTable();
    });
  });
}

function renderActiveFilterTags() {
  const container = el("home-filter-tags-row");
  const resetBtn = el("btn-filter-reset-all");
  if (!container) return;

  const tags = [];
  if (state.homeSegment !== "all") {
    tags.push({ type: "segment", label: state.homeSegment === "starred" ? "Starred" : "Notes", val: state.homeSegment });
  }
  state.homeStatusFilters.forEach(s => {
    const label = s === "solved" ? "Solved" : (s === "attempted" || s === "in-progress") ? "Attempted" : "Not Attempted";
    tags.push({ type: "status", label, val: s });
  });
  state.homeDiffFilters.forEach(d => {
    tags.push({ type: "diff", label: d.charAt(0).toUpperCase() + d.slice(1), val: d });
  });
  if (state.homeCompany && state.homeCompany !== "all") {
    tags.push({ type: "company", label: state.homeCompany, val: state.homeCompany });
  }

  // Highlight dropdown buttons with blue active border/text (Screenshot 4)
  const btnStatus = el("btn-filter-status");
  const btnDiff = el("btn-filter-diff");
  const btnCompany = el("btn-filter-company");
  if (btnStatus) btnStatus.classList.toggle("is-filtered", state.homeStatusFilters.size > 0);
  if (btnDiff) btnDiff.classList.toggle("is-filtered", state.homeDiffFilters.size > 0);
  if (btnCompany) btnCompany.classList.toggle("is-filtered", state.homeCompany !== "all");

  if (resetBtn) {
    resetBtn.style.display = tags.length > 0 ? "inline-flex" : "none";
  }

  if (tags.length === 0) {
    container.style.display = "none";
    container.innerHTML = "";
    return;
  }

  container.style.display = "flex";
  container.innerHTML = tags.map(t => `
    <span class="active-tag-chip">
      <span>${escapeHTML(t.label)}</span>
      <button class="tag-x-btn" data-type="${t.type}" data-val="${t.val}" title="Remove filter">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </span>
  `).join("");

  container.querySelectorAll(".tag-x-btn").forEach(xBtn => {
    xBtn.addEventListener("click", () => {
      const type = xBtn.dataset.type;
      const val = xBtn.dataset.val;
      if (type === "segment") {
        state.homeSegment = "all";
        document.querySelectorAll(".seg-btn").forEach(b => b.classList.toggle("active", b.dataset.segment === "all"));
      } else if (type === "status") {
        state.homeStatusFilters.delete(val);
        const cb = document.querySelector(`.filter-cb-status[value="${val}"]`);
        if (cb) cb.checked = false;
      } else if (type === "diff") {
        state.homeDiffFilters.delete(val);
        const cb = document.querySelector(`.filter-cb-diff[value="${val}"]`);
        if (cb) cb.checked = false;
      } else if (type === "company") {
        state.homeCompany = "all";
        const radio = document.querySelector('input[name="company-filter"][value="all"]');
        if (radio) radio.checked = true;
      }
      renderActiveFilterTags();
      renderHomeProblemsTable();
    });
  });
}

function updateStarredSidebar() {
  const starredList = state.questions.filter(q => state.starredSlugs.has(q.slug));
  const sCount = el("home-starred-count");
  const sList = el("home-starred-list");
  if (sCount) sCount.textContent = starredList.length;
  if (!sList) return;

  if (starredList.length === 0) {
    sList.innerHTML = `<div class="empty-state-notice" style="padding: 14px 10px; color: var(--text-dark-muted); font-size: 0.82rem; text-align: center;">No bookmarked questions yet.<br>Click <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; vertical-align:-1px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> on any problem to pin here.</div>`;
    return;
  }

  sList.innerHTML = starredList.slice(0, 6).map(q => `
    <div class="sidebar-list-item" data-slug="${q.slug}" title="${escapeHTML(q.title)}">
      <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; padding-right: 8px;">
        <div class="sidebar-item-title">${escapeHTML(q.title)}</div>
        <div style="font-size: 0.72rem; color: var(--text-dark-muted);">${escapeHTML(q.company || "General")}</div>
      </div>
      <span class="doc-diff-pill ${q.difficulty.toLowerCase()}">${q.difficulty}</span>
    </div>
  `).join("");

  sList.querySelectorAll(".sidebar-list-item").forEach(item => {
    item.addEventListener("click", () => {
      switchView("practice");
      loadQuestionDetail(item.dataset.slug);
    });
  });
}

function updateNotesSidebar() {
  const notedSlugs = Object.keys(state.userNotes);
  const nCount = el("home-notes-count");
  const nList = el("home-recent-notes-list");
  if (nCount) nCount.textContent = notedSlugs.length;
  if (!nList) return;

  if (notedSlugs.length === 0) {
    nList.innerHTML = `<div class="empty-state-notice" style="padding: 14px 10px; color: var(--text-dark-muted); font-size: 0.82rem; text-align: center;">No personal notes yet.<br>Add notes while practicing to review.</div>`;
    return;
  }

  nList.innerHTML = notedSlugs.slice(0, 6).map(slug => {
    const q = state.questions.find(item => item.slug === slug);
    const title = q ? q.title : slug;
    const note = state.userNotes[slug];
    return `
      <div class="sidebar-list-item" data-slug="${slug}" title="${escapeHTML(title)}">
        <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; padding-right: 8px;">
          <div class="sidebar-item-title">${escapeHTML(title)}</div>
          <div style="font-size: 0.72rem; color: var(--text-dark-muted);">${escapeHTML(note.slice(0, 36))}${note.length > 36 ? "..." : ""}</div>
        </div>
        <span class="btn-sm-clean" style="font-size: 0.74rem;">Notes →</span>
      </div>
    `;
  }).join("");

  nList.querySelectorAll(".sidebar-list-item").forEach(item => {
    item.addEventListener("click", async () => {
      switchView("practice");
      await loadQuestionDetail(item.dataset.slug);
      setDocTab("notes");
    });
  });
}

function updateHomeCompanyCloud(query = "") {
  const cloudEl = el("home-company-tags-cloud");
  if (!cloudEl) return;

  const companyCounts = {};
  state.questions.forEach(q => {
    const c = q.company || "General";
    companyCounts[c] = (companyCounts[c] || 0) + 1;
  });

  const filterLower = (query || "").toLowerCase().trim();
  const sortedCompanies = Object.entries(companyCounts)
    .filter(([comp]) => !filterLower || comp.toLowerCase().includes(filterLower))
    .sort((a, b) => b[1] - a[1]);

  if (sortedCompanies.length === 0) {
    cloudEl.innerHTML = `<div style="font-size: 0.78rem; color: var(--text-dark-muted); padding: 8px;">No companies matching "${escapeHTML(query)}"</div>`;
    return;
  }

  cloudEl.innerHTML = sortedCompanies.map(([comp, cnt]) => `
    <button class="company-chip-btn ${state.homeCompany === comp ? 'active' : ''}" data-company="${escapeHTML(comp)}">
      ${escapeHTML(comp)} <span style="opacity: 0.65; font-size: 0.7rem;">(${cnt})</span>
    </button>
  `).join("");

  cloudEl.querySelectorAll(".company-chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const comp = btn.dataset.company;
      state.homeCompany = state.homeCompany === comp ? "all" : comp;
      const resetBtn = el("btn-reset-company-filter");
      if (resetBtn) resetBtn.style.display = state.homeCompany !== "all" ? "inline-block" : "none";
      updateHomeCompanyCloud(el("home-company-search-input")?.value || "");
      renderActiveFilterTags();
      renderHomeProblemsTable();
    });
  });
}

function renderHomeProblemsTable() {
  const tbody = el("home-problems-tbody");
  const emptyNotice = el("home-problems-empty");
  const counter = el("home-sheet-counter");
  if (!tbody) return;

  const query = (state.homeSearch || "").toLowerCase().trim();

  const filtered = state.questions.filter(q => {
    // 1. Segment Filter (All | Starred | Notes)
    if (state.homeSegment === "starred" && !state.starredSlugs.has(q.slug)) return false;
    if (state.homeSegment === "notes" && !state.userNotes[q.slug]) return false;

    // 2. Status Multi-select Filter
    if (state.homeStatusFilters.size > 0) {
      const isSolved = isQuestionSolved(q.slug);
      const isAttempted = isQuestionAttempted(q.slug);
      let statusKey = isSolved ? "solved" : isAttempted ? "attempted" : "unsolved";
      const matches = state.homeStatusFilters.has(statusKey) || 
                      (statusKey === "attempted" && state.homeStatusFilters.has("in-progress"));
      if (!matches) return false;
    }

    // 3. Difficulty Multi-select Filter
    if (state.homeDiffFilters.size > 0) {
      const diff = q.difficulty.toLowerCase();
      if (!state.homeDiffFilters.has(diff)) return false;
    }

    // 4. Company Filter
    if (state.homeCompany && state.homeCompany !== "all") {
      if (q.company !== state.homeCompany) return false;
    }

    // 5. Search Filter
    if (query) {
      const titleMatch = q.title.toLowerCase().includes(query);
      const companyMatch = q.company && q.company.toLowerCase().includes(query);
      const tagMatch = q.tags && q.tags.some(t => t.toLowerCase().includes(query));
      const slugMatch = q.slug.toLowerCase().includes(query);
      if (!titleMatch && !companyMatch && !tagMatch && !slugMatch) return false;
    }

    return true;
  });

  if (counter) {
    counter.textContent = `${filtered.length} Problems`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = "";
    if (emptyNotice) emptyNotice.style.display = "block";
    return;
  }

  if (emptyNotice) emptyNotice.style.display = "none";

  tbody.innerHTML = filtered.map(q => {
    const isSolved = isQuestionSolved(q.slug);
    const isAttempted = isQuestionAttempted(q.slug);
    const isStarred = state.starredSlugs.has(q.slug);
    const hasNote = !!state.userNotes[q.slug];
    const diff = q.difficulty.toLowerCase();
    const origIndex = state.questions.indexOf(q) + 1;
    const testCount = q.test_case_count || 4;
    const company = q.company || "General";

    const statusClass = isSolved ? "solved" : isAttempted ? "attempted" : "";
    const statusTitle = isSolved ? "Solved" : isAttempted ? "Attempted" : "Not Attempted";
    const statusIconHtml = isSolved
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`
      : isAttempted
      ? `<svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="7"/></svg>`
      : "";

    const noteIconHtml = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`;

    const starIconHtml = isStarred
      ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308" stroke-width="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
      : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;

    return `
      <tr class="home-table-row" data-slug="${q.slug}">
        <td style="text-align: center;">
          <span class="status-circle-icon ${statusClass}" title="${statusTitle}">
            ${statusIconHtml}
          </span>
        </td>
        <td style="color: var(--text-dark-muted); font-size: 0.8rem; font-weight: 500;">
          ${origIndex}
        </td>
        <td>
          <a class="problem-title-link" data-slug="${q.slug}" title="${escapeHTML(q.title)}">
            ${escapeHTML(q.title)}
          </a>
        </td>
        <td>
          <span class="doc-diff-pill ${diff}">${q.difficulty}</span>
        </td>
        <td>
          <span class="doc-meta-pill">${escapeHTML(company)}</span>
        </td>
        <td style="color: var(--text-dark-muted); font-size: 0.78rem;">
          ${testCount} tests
        </td>
        <td style="text-align: center;">
          <button class="btn-solve-pill" data-slug="${q.slug}">Solve →</button>
        </td>
        <td style="text-align: center;">
          <button class="btn-table-icon btn-table-note ${hasNote ? "has-note" : ""}" data-slug="${q.slug}" title="${hasNote ? "Note: " + escapeHTML(state.userNotes[q.slug].slice(0, 40)) : "Add Note"}">
            ${noteIconHtml}
          </button>
        </td>
        <td style="text-align: center;">
          <button class="btn-table-icon btn-table-star ${isStarred ? "starred" : ""}" data-slug="${q.slug}" title="${isStarred ? "Remove Star" : "Add Star"}">
            ${starIconHtml}
          </button>
        </td>
      </tr>
    `;
  }).join("");

  // Attach event handlers to table rows
  tbody.querySelectorAll("tr.home-table-row").forEach(tr => {
    tr.addEventListener("click", (e) => {
      if (e.target.closest(".btn-table-note") || e.target.closest(".btn-table-star")) return;
      const slug = tr.dataset.slug;
      if (slug) {
        switchView("practice");
        loadQuestionDetail(slug);
      }
    });
  });

  tbody.querySelectorAll(".problem-title-link, .btn-solve-pill").forEach(elBtn => {
    elBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const slug = elBtn.dataset.slug;
      switchView("practice");
      loadQuestionDetail(slug);
    });
  });

  tbody.querySelectorAll(".btn-table-note").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const slug = btn.dataset.slug;
      switchView("practice");
      await loadQuestionDetail(slug);
      setDocTab("notes");
    });
  });

  tbody.querySelectorAll(".btn-table-star").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const slug = btn.dataset.slug;
      if (state.starredSlugs.has(slug)) {
        state.starredSlugs.delete(slug);
        showToast("Removed from Starred");
      } else {
        state.starredSlugs.add(slug);
        showToast("Question Starred");
      }
      localStorage.setItem("sqlmaster_starred", JSON.stringify(Array.from(state.starredSlugs)));
      updateStarredSidebar();
      renderActiveFilterTags();
      renderHomeProblemsTable();
    });
  });
}

// ============================================================================
// Notes Hub View (Question-wise Notes)
// ============================================================================
function renderNotesHub() {
  const query = (el("notes-search-input")?.value || "").toLowerCase().trim();
  const notedSlugs = Object.keys(state.userNotes);
  const hubGrid = el("notes-hub-grid");
  if (!hubGrid) return;

  const matched = notedSlugs.filter(slug => {
    const q = state.questions.find(item => item.slug === slug);
    const note = state.userNotes[slug].toLowerCase();
    const title = q ? q.title.toLowerCase() : "";
    const company = q && q.company ? q.company.toLowerCase() : "";
    return !query || note.includes(query) || title.includes(query) || company.includes(query);
  });

  if (matched.length === 0) {
    hubGrid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-dark-muted);">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 12px auto; display: block; opacity: 0.5;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        <h3 style="font-size: 1.1rem; color: var(--text-dark-main);">${notedSlugs.length === 0 ? "No Personal Notes Recorded Yet" : "No Notes Match Your Search"}</h3>
        <p style="font-size: 0.88rem; margin-top: 8px;">
          ${notedSlugs.length === 0 ? "Add your thoughts, edge case notes, or approaches directly in the problem panel during practice!" : "Try clearing your search query."}
        </p>
      </div>
    `;
    return;
  }

  hubGrid.innerHTML = matched.map(slug => {
    const q = state.questions.find(item => item.slug === slug);
    const title = q ? q.title : slug;
    const diff = q ? q.difficulty.toLowerCase() : "medium";
    const company = q ? (q.company || "General") : "General";
    const note = state.userNotes[slug];

    return `
      <div class="note-card" style="background: var(--bg-white); border: 1px solid var(--border-light); border-radius: 10px; padding: 18px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 10px;">
            <h4 style="font-size: 0.94rem; font-weight: 700; color: var(--text-dark-main);">${escapeHTML(title)}</h4>
            <span class="doc-diff-pill ${diff}">${q ? q.difficulty : "Med"}</span>
          </div>
          <div style="font-size: 0.76rem; color: var(--text-dark-muted); margin-bottom: 12px;">${escapeHTML(company)}</div>
          <p style="font-size: 0.86rem; color: var(--text-dark-secondary); white-space: pre-wrap; line-height: 1.5; background: var(--bg-page); padding: 10px; border-radius: 6px; border: 1px solid var(--border-light); max-height: 140px; overflow-y: auto;">${escapeHTML(note)}</p>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px;">
          <button class="btn-sm-clean btn-jump-note" data-slug="${slug}">Practice →</button>
          <button class="btn-sm-clean text-danger btn-delete-note-hub" data-slug="${slug}" title="Delete note">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join("");

  hubGrid.querySelectorAll(".btn-jump-note").forEach(btn => {
    btn.addEventListener("click", () => {
      switchView("practice");
      loadQuestionDetail(btn.dataset.slug);
    });
  });

  hubGrid.querySelectorAll(".btn-delete-note-hub").forEach(btn => {
    btn.addEventListener("click", () => {
      deletePersonalNote(btn.dataset.slug);
    });
  });
}

// ============================================================================
// Workspace Splitter Dragging & Window Collapse / Maximize Implementation
// ============================================================================

function applySavedLayout() {
  const descPanel = el("description-panel");
  const editorWrap = el("editor-wrapper");

  // Restore Description Width if saved
  if (state.layout.descWidth && descPanel) {
    descPanel.style.width = `${state.layout.descWidth}px`;
    descPanel.style.flex = `0 0 ${state.layout.descWidth}px`;
  }

  // Restore Editor Height if saved
  if (state.layout.editorHeight && editorWrap) {
    editorWrap.style.height = `${state.layout.editorHeight}px`;
    editorWrap.style.flex = `0 0 ${state.layout.editorHeight}px`;
  }

  // Restore Collapsed states
  if (state.layout.descCollapsed) {
    setDescCollapsed(true, false);
  }
  if (state.layout.testcaseCollapsed) {
    setTestcaseCollapsed(true, false);
  }
}

function syncRailActiveTab() {
  const activeDocTab = document.querySelector(".doc-tab.active");
  const activeTabName = activeDocTab ? activeDocTab.dataset.tab : "desc";
  document.querySelectorAll(".rail-tab-item").forEach(item => {
    item.classList.toggle("active", item.dataset.tab === activeTabName);
  });
}

function setDescCollapsed(isCollapsed, showNotification = true) {
  state.layout.descCollapsed = isCollapsed;
  localStorage.setItem("sqlmaster_desc_collapsed", String(isCollapsed));

  const descPanel = el("description-panel");
  const rail = el("desc-collapsed-rail");
  const resizerV = el("resizer-vertical");
  const editorPanel = el("editor-panel");

  if (isCollapsed) {
    if (descPanel) descPanel.style.display = "none";
    if (rail) rail.style.display = "flex";
    if (resizerV) resizerV.style.display = "none";
    if (editorPanel) {
      editorPanel.style.width = "";
      editorPanel.style.flex = "1 1 0px";
    }
    if (showNotification) showToast("Question panel collapsed (Click vertical bar to expand)");
  } else {
    if (descPanel) {
      descPanel.style.display = "flex";
      if (state.layout.descWidth) {
        descPanel.style.width = `${state.layout.descWidth}px`;
        descPanel.style.flex = `0 0 ${state.layout.descWidth}px`;
      } else {
        descPanel.style.width = "50%";
        descPanel.style.flex = "0 0 50%";
      }
    }
    if (rail) rail.style.display = "none";
    if (resizerV) resizerV.style.display = "flex";
    if (editorPanel) {
      editorPanel.style.width = "";
      editorPanel.style.flex = "1 1 0px";
    }
    if (showNotification) showToast("Question panel restored");
  }

  syncRailActiveTab();
  if (state.editor) setTimeout(() => state.editor.refresh(), 80);
}

function setDescMaximized(isMax) {
  state.layout.descMaximized = isMax;
  const descPanel = el("description-panel");
  const editorPanel = el("editor-panel");
  const resizerV = el("resizer-vertical");
  const rail = el("desc-collapsed-rail");
  const btn = el("btn-maximize-desc");

  if (isMax) {
    if (descPanel) {
      descPanel.classList.add("maximized");
      descPanel.style.width = "100%";
      descPanel.style.flex = "1 1 100%";
    }
    if (editorPanel) editorPanel.style.display = "none";
    if (resizerV) resizerV.style.display = "none";
    if (rail) rail.style.display = "none";
    if (btn) {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
      btn.title = "Restore Split View";
    }
    showToast("Question panel maximized (Full Space)");
  } else {
    if (descPanel) {
      descPanel.classList.remove("maximized");
      if (state.layout.descWidth) {
        descPanel.style.width = `${state.layout.descWidth}px`;
        descPanel.style.flex = `0 0 ${state.layout.descWidth}px`;
      } else {
        descPanel.style.width = "50%";
        descPanel.style.flex = "0 0 50%";
      }
    }
    if (editorPanel) {
      editorPanel.style.display = "flex";
      editorPanel.style.flex = "1 1 0px";
    }
    if (resizerV) resizerV.style.display = "flex";
    if (btn) {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
      btn.title = "Maximize Question Panel (Full Space)";
    }
  }

  if (state.editor) setTimeout(() => state.editor.refresh(), 80);
}

function setEditorMaximized(isMax) {
  state.layout.editorMaximized = isMax;
  const workspace = el("split-workspace");
  const editorPanel = el("editor-panel");
  const btn = el("btn-maximize-editor");

  if (isMax) {
    workspace?.classList.add("editor-maximized");
    if (editorPanel) {
      editorPanel.style.width = "100%";
      editorPanel.style.flex = "1 1 100%";
    }
    if (btn) {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
      btn.title = "Restore Split View";
    }
    showToast("Code editor maximized to full screen");
  } else {
    workspace?.classList.remove("editor-maximized");
    if (editorPanel) {
      editorPanel.style.width = "";
      editorPanel.style.flex = "1 1 0px";
    }
    if (btn) {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
      btn.title = "Maximize Editor (Full Workspace Space)";
    }
  }

  if (state.editor) setTimeout(() => state.editor.refresh(), 80);
}

function setTestcaseCollapsed(isCollapsed, showNotification = true) {
  state.layout.testcaseCollapsed = isCollapsed;
  localStorage.setItem("sqlmaster_testcase_collapsed", String(isCollapsed));

  const testcasePanel = el("testcase-panel");
  const editorWrap = el("editor-wrapper");
  const btnCollapseEditor = el("btn-collapse-editor");
  const chevronIcon = el("chevron-testcase-icon");

  if (isCollapsed) {
    if (testcasePanel) {
      testcasePanel.classList.add("collapsed");
      testcasePanel.style.height = "";
      testcasePanel.style.flex = "";
    }
    if (editorWrap) {
      editorWrap.classList.add("full-height");
      editorWrap.style.height = "";
      editorWrap.style.flex = "";
    }
    if (chevronIcon) {
      chevronIcon.innerHTML = `<polyline points="18 15 12 9 6 15"/>`; // Points up to expand
    }
    if (btnCollapseEditor) {
      btnCollapseEditor.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
      btnCollapseEditor.title = "Restore Testcase Panel";
    }
    if (showNotification) showToast("Testcase collapsed (Editor given full height)");
  } else {
    if (testcasePanel) {
      testcasePanel.classList.remove("collapsed");
      testcasePanel.style.height = "";
      testcasePanel.style.flex = "";
    }
    if (editorWrap) {
      editorWrap.classList.remove("full-height");
      if (state.layout.editorHeight) {
        editorWrap.style.height = `${state.layout.editorHeight}px`;
        editorWrap.style.flex = `0 0 ${state.layout.editorHeight}px`;
      } else {
        editorWrap.style.height = "52%";
        editorWrap.style.flex = "0 0 52%";
      }
    }
    if (chevronIcon) {
      chevronIcon.innerHTML = `<polyline points="6 9 12 15 18 9"/>`; // Points down to collapse
    }
    if (btnCollapseEditor) {
      btnCollapseEditor.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>`;
      btnCollapseEditor.title = "Collapse Testcase / Full Editor Height";
    }
    if (showNotification) showToast("Testcase panel restored");
  }

  if (state.editor) setTimeout(() => state.editor.refresh(), 80);
}

function setTestcaseMaximized(isMax) {
  state.layout.testcaseMaximized = isMax;
  const testcasePanel = el("testcase-panel");
  const editorWrap = el("editor-wrapper");
  const btn = el("btn-expand-testcase");

  if (isMax) {
    if (testcasePanel) {
      testcasePanel.classList.add("maximized");
      testcasePanel.style.height = "";
      testcasePanel.style.flex = "";
    }
    if (editorWrap) {
      editorWrap.classList.add("minimized");
      editorWrap.style.height = "";
      editorWrap.style.flex = "";
    }
    if (btn) {
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
      btn.title = "Restore Testcase Height";
    }
    showToast("Testcase panel maximized (Full Space)");
  } else {
    if (testcasePanel) {
      testcasePanel.classList.remove("maximized");
      testcasePanel.style.height = "";
      testcasePanel.style.flex = "";
    }
    if (editorWrap) {
      editorWrap.classList.remove("minimized");
      if (state.layout.editorHeight) {
        editorWrap.style.height = `${state.layout.editorHeight}px`;
        editorWrap.style.flex = `0 0 ${state.layout.editorHeight}px`;
      } else {
        editorWrap.style.height = "52%";
        editorWrap.style.flex = "0 0 52%";
      }
    }
    if (btn) {
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
      btn.title = "Maximize Testcase Panel (Full Space)";
    }
  }

  if (state.editor) setTimeout(() => state.editor.refresh(), 80);
}

function initWorkspaceSplitters() {
  const resizerV = el("resizer-vertical");
  const resizerH = el("resizer-horizontal");
  const workspace = el("split-workspace");
  const descPanel = el("description-panel");
  const editorPanel = el("editor-panel");
  const editorWrap = el("editor-wrapper");
  const testcasePanel = el("testcase-panel");

  // 1. Vertical Splitter (Question vs Editor)
  if (resizerV && workspace && descPanel && editorPanel) {
    let isDraggingV = false;

    const onPointerDownV = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      isDraggingV = true;
      try { resizerV.setPointerCapture(e.pointerId); } catch (_) {}
      resizerV.classList.add("active");
      document.body.classList.add("is-resizing-v");
    };

    const onPointerMoveV = (e) => {
      if (!isDraggingV) return;
      const rect = workspace.getBoundingClientRect();
      const rawW = e.clientX - rect.left;
      const minW = 160;
      const maxW = Math.max(minW, rect.width - 180);
      const clampedW = Math.max(minW, Math.min(rawW, maxW));

      descPanel.style.width = `${clampedW}px`;
      descPanel.style.flex = `0 0 ${clampedW}px`;
      state.layout.descWidth = clampedW;
      localStorage.setItem("sqlmaster_desc_width", String(clampedW));

      if (state.editor) state.editor.refresh();
    };

    const onPointerUpV = (e) => {
      if (isDraggingV) {
        isDraggingV = false;
        try { resizerV.releasePointerCapture(e.pointerId); } catch (_) {}
        resizerV.classList.remove("active");
        document.body.classList.remove("is-resizing-v");
        if (state.editor) state.editor.refresh();
      }
    };

    resizerV.addEventListener("pointerdown", onPointerDownV);
    resizerV.addEventListener("pointermove", onPointerMoveV);
    resizerV.addEventListener("pointerup", onPointerUpV);
    resizerV.addEventListener("pointercancel", onPointerUpV);

    // Double click to reset to 50/50
    resizerV.addEventListener("dblclick", () => {
      descPanel.style.width = "50%";
      descPanel.style.flex = "0 0 50%";
      state.layout.descWidth = null;
      localStorage.removeItem("sqlmaster_desc_width");
      if (state.editor) state.editor.refresh();
      showToast("Question / Editor split reset to 50/50");
    });
  }

  // 2. Horizontal Splitter (Editor vs Testcases)
  if (resizerH && editorPanel && editorWrap && testcasePanel) {
    let isDraggingH = false;

    const onPointerDownH = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      if (state.layout.testcaseCollapsed) {
        setTestcaseCollapsed(false, false);
      }
      isDraggingH = true;
      try { resizerH.setPointerCapture(e.pointerId); } catch (_) {}
      resizerH.classList.add("active");
      document.body.classList.add("is-resizing-h");
    };

    const onPointerMoveH = (e) => {
      if (!isDraggingH) return;
      const rect = editorPanel.getBoundingClientRect();
      const topBarH = 42;
      const bottomBarH = 44;
      const resizerHSize = 12;
      const availH = rect.height - topBarH - bottomBarH - resizerHSize;
      if (availH <= 60) return;

      const rawH = (e.clientY - rect.top) - topBarH;
      const clampedEditorH = Math.max(40, Math.min(rawH, availH - 38));

      editorWrap.style.height = `${clampedEditorH}px`;
      editorWrap.style.flex = `0 0 ${clampedEditorH}px`;
      state.layout.editorHeight = clampedEditorH;
      localStorage.setItem("sqlmaster_editor_height", String(clampedEditorH));

      if (state.editor) state.editor.refresh();
    };

    const onPointerUpH = (e) => {
      if (isDraggingH) {
        isDraggingH = false;
        try { resizerH.releasePointerCapture(e.pointerId); } catch (_) {}
        resizerH.classList.remove("active");
        document.body.classList.remove("is-resizing-h");
        if (state.editor) state.editor.refresh();
      }
    };

    resizerH.addEventListener("pointerdown", onPointerDownH);
    resizerH.addEventListener("pointermove", onPointerMoveH);
    resizerH.addEventListener("pointerup", onPointerUpH);
    resizerH.addEventListener("pointercancel", onPointerUpH);

    // Double click to reset to default 52%
    resizerH.addEventListener("dblclick", () => {
      editorWrap.style.height = "52%";
      editorWrap.style.flex = "0 0 52%";
      state.layout.editorHeight = null;
      localStorage.removeItem("sqlmaster_editor_height");
      if (state.editor) state.editor.refresh();
      showToast("Editor / Testcase height reset to default");
    });
  }
}

function initPanelCollapseControls() {
  // Question Panel Controls
  el("btn-collapse-desc")?.addEventListener("click", () => {
    setDescCollapsed(true);
  });

  el("btn-rail-expand")?.addEventListener("click", () => {
    setDescCollapsed(false);
  });

  document.querySelectorAll(".rail-tab-item").forEach(item => {
    item.addEventListener("click", () => {
      const tabName = item.dataset.tab;
      setDescCollapsed(false, false);
      if (tabName) setDocTab(tabName);
    });
  });

  el("btn-maximize-desc")?.addEventListener("click", () => {
    setDescMaximized(!state.layout.descMaximized);
  });

  // Editor Panel Controls
  el("btn-collapse-editor")?.addEventListener("click", () => {
    setTestcaseCollapsed(!state.layout.testcaseCollapsed);
  });

  el("btn-maximize-editor")?.addEventListener("click", () => {
    setEditorMaximized(!state.layout.editorMaximized);
  });

  // Testcase Panel Controls
  el("btn-toggle-testcase")?.addEventListener("click", () => {
    setTestcaseCollapsed(!state.layout.testcaseCollapsed);
  });

  el("btn-expand-testcase")?.addEventListener("click", () => {
    setTestcaseMaximized(!state.layout.testcaseMaximized);
  });
}

// ============================================================================
// Event Listeners & Shortcuts Setup
// ============================================================================
function setupEventListeners() {
  // Brand Logo -> Home
  el("nav-logo")?.addEventListener("click", () => switchView("home"));

  // Top Nav View Buttons
  el("nav-btn-home")?.addEventListener("click", () => switchView("home"));
  el("nav-btn-notes")?.addEventListener("click", () => switchView("notes"));
  el("nav-btn-settings")?.addEventListener("click", () => switchView("settings"));
  el("header-progress-pill")?.addEventListener("click", () => switchView("home"));
  el("btn-theme-toggle")?.addEventListener("click", toggleTheme);

  // Problem List Drawer Triggers
  el("btn-toggle-problem-list")?.addEventListener("click", toggleDrawer);
  el("btn-close-drawer")?.addEventListener("click", closeDrawer);
  el("drawer-backdrop")?.addEventListener("click", closeDrawer);

  // Top Nav Arrows & Random
  el("btn-prev-q")?.addEventListener("click", () => navigateQuestion(-1));
  el("btn-next-q")?.addEventListener("click", () => navigateQuestion(1));
  el("btn-random-q")?.addEventListener("click", () => {
    const list = state.filteredQuestions.length > 0 ? state.filteredQuestions : state.questions;
    if (list.length === 0) return;
    const rand = list[Math.floor(Math.random() * list.length)];
    loadQuestionDetail(rand.slug);
  });

  // Top Center Run & Submit
  el("btn-quick-run")?.addEventListener("click", handleEditorPreview);
  el("btn-submit")?.addEventListener("click", handleEditorRun);

  // Description Panel Header Tabs
  el("tab-doc-desc")?.addEventListener("click", () => setDocTab("desc"));
  el("tab-doc-editorial")?.addEventListener("click", () => setDocTab("editorial"));
  el("tab-doc-notes")?.addEventListener("click", () => setDocTab("notes"));

  // Star question buttons
  el("btn-star-question")?.addEventListener("click", toggleStarCurrentQuestion);
  el("btn-bottom-star")?.addEventListener("click", toggleStarCurrentQuestion);

  // Pinned Bottom Bar buttons
  el("btn-bottom-prev")?.addEventListener("click", () => navigateQuestion(-1));
  el("btn-bottom-next")?.addEventListener("click", () => navigateQuestion(1));
  el("btn-bottom-notes")?.addEventListener("click", () => setDocTab("notes"));

  // Solution Copy button
  el("btn-copy-solution")?.addEventListener("click", () => {
    if (state.currentQuestion && state.currentQuestion.reference_sql) {
      setQueryCode(state.currentQuestion.reference_sql);
      const copyBtn = el("btn-copy-solution");
      if (copyBtn) {
        copyBtn.textContent = "Copied!";
        setTimeout(() => copyBtn.textContent = "Copy to Editor", 1500);
      }
      showToast("Solution copied to editor");
    }
  });

  // Personal Notes Save/Delete
  el("btn-save-note")?.addEventListener("click", savePersonalNote);
  el("btn-delete-note")?.addEventListener("click", () => deletePersonalNote());
  el("user-note-input")?.addEventListener("blur", () => {
    const inputVal = el("user-note-input")?.value.trim() || "";
    const savedVal = state.userNotes[state.currentQuestion?.slug] || "";
    if (inputVal !== savedVal) {
      savePersonalNote();
    }
  });

  // Editor toolbar actions
  el("btn-format-code")?.addEventListener("click", formatEditorSQL);
  el("btn-reset-code")?.addEventListener("click", () => {
    if (!state.currentQuestion) return;
    if (confirm("Reset editor to starter query template?")) {
      setStarterTemplate(state.currentQuestion);
    }
  });
  el("btn-editor-settings")?.addEventListener("click", () => switchView("settings"));

  // Practice Stopwatch / Timer
  el("practice-timer-pill")?.addEventListener("click", (e) => {
    if (e.target.id === "btn-timer-reset" || e.target.closest("#btn-timer-reset")) return;
    toggleTimer();
  });

  el("btn-timer-reset")?.addEventListener("click", (e) => {
    e.stopPropagation();
    resetTimer();
    showToast("Timer reset");
  });

  // ============================================================================
  // Workspace Layout, Resizing & Window Collapse / Maximize Controls
  // ============================================================================
  initWorkspaceSplitters();
  initPanelCollapseControls();
  applySavedLayout();

  // Add Custom Testcase Button
  el("btn-add-custom-case")?.addEventListener("click", addNewCustomCase);

  // Drawer Search & Filter
  el("search-input")?.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    const clearBtn = el("btn-clear-search");
    if (clearBtn) clearBtn.style.display = state.searchQuery ? "block" : "none";
    filterAndSortQuestions();
  });

  el("btn-clear-search")?.addEventListener("click", () => {
    const input = el("search-input");
    if (input) input.value = "";
    state.searchQuery = "";
    const clearBtn = el("btn-clear-search");
    if (clearBtn) clearBtn.style.display = "none";
    filterAndSortQuestions();
  });

  // Drawer Sort dropdown
  el("sort-select")?.addEventListener("change", (e) => {
    state.selectedSort = e.target.value;
    localStorage.setItem("sqlmaster_sort", state.selectedSort);
    filterAndSortQuestions();
  });

  // Drawer Company dropdown
  el("company-select")?.addEventListener("change", (e) => {
    state.selectedCompany = e.target.value;
    filterAndSortQuestions();
  });

  // Drawer Difficulty filter chips
  document.querySelectorAll(".diff-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".diff-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      state.selectedDifficulty = chip.dataset.diff;
      filterAndSortQuestions();
    });
  });

  // Home Practice Jump Buttons ("Practice Easy →", "Practice Medium →", "Practice Hard →")
  document.querySelectorAll(".home-jump-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const diff = (btn.dataset.filter || "").toLowerCase();
      const matching = state.questions.filter(q => q.difficulty.toLowerCase() === diff);
      const target = matching.find(q => !state.solvedSlugs.has(q.slug)) || matching[0];
      if (target) {
        switchView("practice");
        loadQuestionDetail(target.slug);
      } else {
        showToast(`No ${diff} questions found`);
      }
    });
  });

  // Home Dashboard Hero Buttons
  el("home-btn-resume")?.addEventListener("click", () => {
    const savedSlug = localStorage.getItem("sqlmaster_current_slug");
    const target = (savedSlug && state.questions.find(q => q.slug === savedSlug)) ||
                   state.questions.find(q => isQuestionAttempted(q.slug)) || 
                   state.questions.find(q => !isQuestionSolved(q.slug)) || 
                   state.questions[0];
    if (target) {
      switchView("practice");
      loadQuestionDetail(target.slug);
    }
  });

  // Refined Filter Toolbar: Segmented Controls [ All | Starred | Notes ] (Screenshot 2)
  document.querySelectorAll(".seg-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".seg-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.homeSegment = btn.dataset.segment;
      renderActiveFilterTags();
      renderHomeProblemsTable();
    });
  });

  // Refined Filter Dropdowns Popover Toggles (Screenshot 3 & 4)
  const menuStatus = el("menu-filter-status");
  const menuDiff = el("menu-filter-diff");
  const menuCompany = el("menu-filter-company");

  el("btn-filter-status")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = !menuStatus || menuStatus.style.display === "none";
    if (menuDiff) menuDiff.style.display = "none";
    if (menuCompany) menuCompany.style.display = "none";
    if (menuStatus) menuStatus.style.display = isHidden ? "block" : "none";
  });

  el("btn-filter-diff")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = !menuDiff || menuDiff.style.display === "none";
    if (menuStatus) menuStatus.style.display = "none";
    if (menuCompany) menuCompany.style.display = "none";
    if (menuDiff) menuDiff.style.display = isHidden ? "block" : "none";
  });

  el("btn-filter-company")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const isHidden = !menuCompany || menuCompany.style.display === "none";
    if (menuStatus) menuStatus.style.display = "none";
    if (menuDiff) menuDiff.style.display = "none";
    if (menuCompany) {
      menuCompany.style.display = isHidden ? "block" : "none";
      if (isHidden) setTimeout(() => el("menu-search-companies")?.focus(), 100);
    }
  });

  // Close menus when clicking outside
  document.addEventListener("click", (e) => {
    if (menuStatus && !menuStatus.contains(e.target) && !el("btn-filter-status")?.contains(e.target)) {
      menuStatus.style.display = "none";
    }
    if (menuDiff && !menuDiff.contains(e.target) && !el("btn-filter-diff")?.contains(e.target)) {
      menuDiff.style.display = "none";
    }
    if (menuCompany && !menuCompany.contains(e.target) && !el("btn-filter-company")?.contains(e.target)) {
      menuCompany.style.display = "none";
    }
  });

  // Status Filter Checkboxes (Solved, In Progress, Not Attempted)
  document.querySelectorAll(".filter-cb-status").forEach(cb => {
    cb.addEventListener("change", () => {
      if (cb.checked) {
        state.homeStatusFilters.add(cb.value);
      } else {
        state.homeStatusFilters.delete(cb.value);
      }
      renderActiveFilterTags();
      renderHomeProblemsTable();
    });
  });

  // Difficulty Filter Checkboxes (Easy, Medium, Hard)
  document.querySelectorAll(".filter-cb-diff").forEach(cb => {
    cb.addEventListener("change", () => {
      if (cb.checked) {
        state.homeDiffFilters.add(cb.value);
      } else {
        state.homeDiffFilters.delete(cb.value);
      }
      renderActiveFilterTags();
      renderHomeProblemsTable();
    });
  });

  // Company Menu Search
  el("menu-search-companies")?.addEventListener("input", () => {
    populateCompanyFilterOptions();
  });

  // Reset All Button (Matches Screenshot 4)
  el("btn-filter-reset-all")?.addEventListener("click", () => {
    state.homeSegment = "all";
    state.homeStatusFilters.clear();
    state.homeDiffFilters.clear();
    state.homeCompany = "all";
    state.homeSearch = "";

    document.querySelectorAll(".seg-btn").forEach(b => b.classList.toggle("active", b.dataset.segment === "all"));
    document.querySelectorAll(".filter-cb-status, .filter-cb-diff").forEach(cb => cb.checked = false);
    const searchInput = el("home-sheet-search");
    if (searchInput) searchInput.value = "";
    const radioAll = document.querySelector('input[name="company-filter"][value="all"]');
    if (radioAll) radioAll.checked = true;

    renderActiveFilterTags();
    renderHomeProblemsTable();
    showToast("All filters reset");
  });

  // Pick Randomly Buttons (Screenshots 2, 3, 4)
  const handleRandomPractice = () => {
    if (state.questions.length === 0) return;
    const rand = state.questions[Math.floor(Math.random() * state.questions.length)];
    switchView("practice");
    loadQuestionDetail(rand.slug);
  };
  el("home-btn-random")?.addEventListener("click", handleRandomPractice);
  el("btn-pick-randomly")?.addEventListener("click", handleRandomPractice);

  // Home Sheet Search Input
  el("home-sheet-search")?.addEventListener("input", (e) => {
    state.homeSearch = e.target.value;
    renderHomeProblemsTable();
  });

  // Streak Month Nav
  el("btn-streak-prev")?.addEventListener("click", () => showToast("Viewing previous month streak"));
  el("btn-streak-next")?.addEventListener("click", () => showToast("Viewing current month streak"));

  // Sidebar Quick Links
  el("home-btn-view-all-starred")?.addEventListener("click", () => {
    state.homeSegment = "starred";
    document.querySelectorAll(".seg-btn").forEach(b => b.classList.toggle("active", b.dataset.segment === "starred"));
    renderActiveFilterTags();
    renderHomeProblemsTable();
    el("home-sheet-counter")?.scrollIntoView({ behavior: "smooth" });
  });

  el("home-btn-view-all-notes")?.addEventListener("click", () => switchView("notes"));

  // Notes Search Input
  el("notes-search-input")?.addEventListener("input", renderNotesHub);

  // Settings Controls
  el("setting-theme")?.addEventListener("change", (e) => {
    applyTheme(e.target.value);
    showToast(`Switched to ${e.target.value === "dark" ? "Dark Mode" : "Light Mode"}`);
  });

  el("setting-shortcut-run")?.addEventListener("change", (e) => {
    state.settings.shortcutRun = e.target.value;
    saveSettings();
    showToast("Run shortcut updated");
  });

  el("setting-shortcut-preview")?.addEventListener("change", (e) => {
    state.settings.shortcutPreview = e.target.value;
    saveSettings();
    showToast("Preview shortcut updated");
  });

  el("setting-show-tags")?.addEventListener("change", (e) => {
    state.settings.showTopicTags = e.target.checked;
    saveSettings();
    if (state.currentQuestion) renderQuestionDetail(state.currentQuestion);
    showToast(state.settings.showTopicTags ? "Topic tags enabled" : "Topic tags hidden");
  });

  el("setting-font-size")?.addEventListener("change", (e) => {
    state.settings.fontSize = e.target.value;
    saveSettings();
    applySettingsToEditor();
  });

  el("setting-auto-format")?.addEventListener("change", (e) => {
    state.settings.autoFormat = e.target.checked;
    saveSettings();
  });

  el("setting-code-theme")?.addEventListener("change", (e) => {
    applyCodeTheme(e.target.value);
    showToast(`Code theme set to ${e.target.value === "leetcode" ? "LeetCode" : e.target.value === "hackerrank" ? "HackerRank" : "Dracula"}`);
  });

  el("setting-plain-mode")?.addEventListener("change", (e) => {
    applyCodeTheme(null, e.target.checked);
    showToast(e.target.checked ? "Interview Mode: Plain B&W enabled" : "Syntax coloring enabled");
  });

  el("setting-autocomplete-mode")?.addEventListener("change", (e) => {
    state.settings.autocompleteMode = e.target.value;
    saveSettings();
    localStorage.setItem("sqlmaster_autocomplete_mode", e.target.value);
    closeAutocompletePopup();
    const modeLabels = {
      standard: "Standard (Keywords, Functions & Schemas)",
      editor_only: "OA / Exam Mode (Only words in editor)",
      off: "Off (Disabled)"
    };
    showToast(`Autocomplete: ${modeLabels[e.target.value] || e.target.value}`);
  });

  // Header Theme Dropdown & Plain B&W Toggle
  const headerThemeWrap = el("header-theme-wrap");
  const headerThemeMenu = el("header-theme-menu");

  if (headerThemeWrap && headerThemeMenu) {
    headerThemeWrap.addEventListener("mouseenter", () => {
      headerThemeMenu.style.display = "flex";
    });
    headerThemeWrap.addEventListener("mouseleave", () => {
      headerThemeMenu.style.display = "none";
    });
  }

  document.querySelectorAll(".header-theme-option").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const themeVal = btn.dataset.themeVal;
      const codeVal = btn.dataset.codeVal;
      if (themeVal) applyTheme(themeVal);
      if (codeVal) applyCodeTheme(codeVal);
      if (headerThemeMenu) headerThemeMenu.style.display = "none";
      const name = btn.querySelector(".theme-opt-text")?.textContent || themeVal;
      showToast(`Theme switched: ${name}`);
    });
  });

  el("btn-toggle-plain-mode")?.addEventListener("click", togglePlainMode);

  // Close header theme menu on outside click
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#header-theme-wrap")) {
      if (headerThemeMenu) headerThemeMenu.style.display = "none";
    }
  });

  // Bottom Action Bar Run & Submit (Matches LeetCode & HackerRank placement)
  el("btn-bottom-run")?.addEventListener("click", handleEditorPreview);
  el("btn-bottom-submit")?.addEventListener("click", handleEditorRun);

  // Storage & Backup Event Listeners
  el("btn-export-full")?.addEventListener("click", exportFullBackup);
  el("btn-export-compact")?.addEventListener("click", exportCompactBackup);
  el("btn-export-data")?.addEventListener("click", exportCompactBackup);
  el("btn-trigger-import")?.addEventListener("click", () => el("input-import-backup")?.click());
  el("btn-browse-backup")?.addEventListener("click", (e) => {
    e.stopPropagation();
    el("input-import-backup")?.click();
  });
  el("input-import-backup")?.addEventListener("change", handleImportFileSelect);

  const dropzone = el("backup-dropzone");
  if (dropzone) {
    dropzone.addEventListener("click", (e) => {
      if (e.target.id !== "btn-browse-backup" && !e.target.closest("#btn-browse-backup")) {
        el("input-import-backup")?.click();
      }
    });
    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.add("dragover");
    });
    dropzone.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("dragover");
    });
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleImportFileSelect({ target: { files: e.dataTransfer.files } });
      }
    });
  }

  // Global window-level drag-and-drop: drop backup anywhere on screen
  let windowDragCounter = 0;
  window.addEventListener("dragenter", (e) => {
    e.preventDefault();
    windowDragCounter++;
    const overlay = el("global-drag-overlay");
    if (overlay) overlay.style.display = "flex";
  });
  window.addEventListener("dragleave", (e) => {
    e.preventDefault();
    windowDragCounter--;
    if (windowDragCounter <= 0) {
      windowDragCounter = 0;
      const overlay = el("global-drag-overlay");
      if (overlay) overlay.style.display = "none";
    }
  });
  window.addEventListener("dragover", (e) => {
    e.preventDefault();
  });
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    windowDragCounter = 0;
    const overlay = el("global-drag-overlay");
    if (overlay) overlay.style.display = "none";
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.name.toLowerCase().endsWith(".json")) {
        handleImportFileSelect({ target: { files: [file] } });
      } else {
        showToast("Please drop a valid .json SQLMaster backup file");
      }
    }
  });

  el("btn-close-restore-modal")?.addEventListener("click", closeRestoreModal);
  el("btn-cancel-restore")?.addEventListener("click", closeRestoreModal);
  el("btn-apply-restore")?.addEventListener("click", handleApplyRestore);
  el("restore-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "restore-modal") closeRestoreModal();
  });
  el("btn-clear-drafts")?.addEventListener("click", clearDraftsOnly);
  el("btn-factory-reset")?.addEventListener("click", factoryResetAll);
  el("btn-refresh-storage")?.addEventListener("click", () => {
    updateStorageUsageUI();
    showToast("Storage stats recalculated");
  });
  el("btn-free-cache")?.addEventListener("click", freeOfflineCache);
  el("btn-precache-offline")?.addEventListener("click", () => precacheAllQuestionsForOffline(true));

  const handleResetProgress = () => {
    if (confirm("Are you sure you want to reset all solved and attempted progress? (Stars and notes will be preserved)")) {
      state.solvedSlugs.clear();
      state.attemptedSlugs.clear();
      localStorage.removeItem("sqlmaster_solved");
      localStorage.removeItem("sqlmaster_attempted");
      localStorage.removeItem("sqlmaster_total_submissions");
      updateProgressUI();
      renderQuestionList();
      if (state.currentQuestion) renderQuestionDetail(state.currentQuestion);
      renderHomeProblemsTable();
      renderHomeDashboard();
      updateStorageUsageUI();
      showToast("Practice progress reset to 0/100");
    }
  };

  el("btn-reset-progress")?.addEventListener("click", handleResetProgress);
  el("btn-progress-reset")?.addEventListener("click", handleResetProgress);

  // Global Keyboard Shortcuts (Capture phase for Cmd+/ and hotkeys)
  window.addEventListener("keydown", (e) => {
    // Global Comment Shortcut: Cmd+/ / Ctrl+/
    if ((e.metaKey || e.ctrlKey) && (e.key === "/" || e.code === "Slash" || e.keyCode === 191)) {
      e.preventDefault();
      e.stopPropagation();
      if (state.editor) {
        toggleSqlComment(state.editor);
      } else {
        const tx = el("sql-editor");
        if (tx) toggleSqlCommentTextarea(tx);
      }
      return;
    }

    const tag = (e.target.tagName || "").toLowerCase();
    const isInput = tag === "input" || tag === "textarea";

    // Escape closes drawer or restore modal
    if (e.key === "Escape") {
      if (el("restore-modal") && el("restore-modal").style.display === "flex") {
        closeRestoreModal();
        return;
      }
      if (state.drawerOpen) {
        closeDrawer();
        return;
      }
    }

    // Global Run Shortcut: Cmd+Enter / Ctrl+Enter
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      if (state.settings.shortcutRun === "cmd-enter") {
        e.preventDefault();
        handleEditorRun();
        return;
      }
    }

    // Global Preview Shortcut: Cmd+' / Ctrl+'
    if ((e.metaKey || e.ctrlKey) && (e.key === "'" || e.key === "\"")) {
      if (state.settings.shortcutPreview === "cmd-quote") {
        e.preventDefault();
        handleEditorPreview();
        return;
      }
    }

    // Alt + Q: toggle Problem List Drawer
    if (e.altKey && (e.key === "q" || e.key === "Q")) {
      e.preventDefault();
      toggleDrawer();
      return;
    }

    // Alt + [ : previous question
    if (e.altKey && e.key === "[") {
      e.preventDefault();
      navigateQuestion(-1);
      return;
    }

    // Alt + ] : next question
    if (e.altKey && e.key === "]") {
      e.preventDefault();
      navigateQuestion(1);
      return;
    }
  }, true);

  // Click outside to dismiss autocomplete popup
  document.addEventListener("click", (e) => {
    if (isAutocompleteOpen() && !e.target.closest("#editor-autocomplete-popup")) {
      closeAutocompletePopup();
    }
  });

  // URL Hash change navigation
  window.addEventListener("hashchange", handleHashNavigation);
}

function saveSettings() {
  localStorage.setItem("sqlmaster_settings", JSON.stringify(state.settings));
}

// ============================================================================
// Storage Usage, Backup & Offline Persistence (100% Client-Side)
// ============================================================================

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function calculateStorageUsage() {
  let totalBytes = 0;
  const categories = {
    drafts: { count: 0, bytes: 0 },
    notes: { count: 0, bytes: 0 },
    progress: { count: 0, bytes: 0 },
    cache: { count: 0, bytes: 0 },
    settings: { bytes: 0 },
    other: { bytes: 0 }
  };

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key) || "";
      // In JS, localStorage strings are UTF-16, roughly 2 bytes per char
      const itemBytes = (key.length + val.length) * 2;
      totalBytes += itemBytes;

      if (key.startsWith("sqlmaster_draft_")) {
        categories.drafts.count++;
        categories.drafts.bytes += itemBytes;
      } else if (key === "sqlmaster_user_notes" || key === "sqlmaster_notes") {
        try {
          const notesObj = JSON.parse(val);
          categories.notes.count = Object.keys(notesObj).length;
        } catch (e) {
          categories.notes.count = 1;
        }
        categories.notes.bytes += itemBytes;
      } else if (
        key === "sqlmaster_solved" ||
        key === "sqlmaster_attempted" ||
        key === "sqlmaster_starred" ||
        key === "sqlmaster_total_submissions"
      ) {
        categories.progress.bytes += itemBytes;
      } else if (key.startsWith("sqlmaster_cached_") || key.startsWith("sqlmaster_qdetail_")) {
        categories.cache.count++;
        categories.cache.bytes += itemBytes;
      } else if (
        key.startsWith("sqlmaster_settings") ||
        key.startsWith("sqlmaster_theme") ||
        key.startsWith("sqlmaster_code_theme") ||
        key.startsWith("sqlmaster_plain_mode") ||
        key.startsWith("sqlmaster_sort") ||
        key.startsWith("sqlmaster_desc_") ||
        key.startsWith("sqlmaster_editor_") ||
        key.startsWith("sqlmaster_testcase_")
      ) {
        categories.settings.bytes += itemBytes;
      } else if (key.startsWith("sqlmaster_")) {
        categories.other.bytes += itemBytes;
      }
    }
  } catch (err) {
    console.warn("Storage inspection error:", err);
  }

  const quotaBytes = 5 * 1024 * 1024; // 5 MB typical browser quota
  const percentUsed = Math.min(100, (totalBytes / quotaBytes) * 100);

  return { totalBytes, quotaBytes, percentUsed, categories };
}

function updateStorageUsageUI() {
  const usage = calculateStorageUsage();
  const quota = usage.quotaBytes; // 5 * 1024 * 1024
  const freeBytes = Math.max(0, quota - usage.totalBytes);
  const freePct = Math.max(0, (freeBytes / quota) * 100);

  const usedText = el("storage-used-text");
  if (usedText) usedText.textContent = formatBytes(usage.totalBytes);

  const pctText = el("storage-used-pct");
  if (pctText) pctText.textContent = `${usage.percentUsed.toFixed(2)}%`;

  const freeText = el("storage-free-text");
  if (freeText) freeText.textContent = formatBytes(freeBytes);

  const freePctHead = el("storage-free-pct-head");
  if (freePctHead) freePctHead.textContent = `${freePct.toFixed(1)}%`;

  // Scale every segment against the FULL 5.0 MB QUOTA so free space is accurately visible!
  const getSegPctOfQuota = (bytes) => ((bytes / quota) * 100).toFixed(2) + "%";

  const segDrafts = el("seg-drafts");
  if (segDrafts) segDrafts.style.width = getSegPctOfQuota(usage.categories.drafts.bytes);

  const segNotes = el("seg-notes");
  if (segNotes) segNotes.style.width = getSegPctOfQuota(usage.categories.notes.bytes);

  const segProgress = el("seg-progress");
  if (segProgress) segProgress.style.width = getSegPctOfQuota(usage.categories.progress.bytes);

  const segCache = el("seg-cache");
  if (segCache) segCache.style.width = getSegPctOfQuota(usage.categories.cache.bytes);

  const segSettings = el("seg-settings");
  if (segSettings) segSettings.style.width = getSegPctOfQuota(usage.categories.settings.bytes);

  const segFree = el("seg-free");
  if (segFree) {
    segFree.style.width = `${freePct.toFixed(2)}%`;
    segFree.title = `Available Free Space: ${formatBytes(freeBytes)} (${freePct.toFixed(1)}%)`;
  }

  // Cards
  const draftsSize = el("storage-drafts-size");
  if (draftsSize) draftsSize.textContent = formatBytes(usage.categories.drafts.bytes);

  const draftsCount = el("storage-drafts-count");
  if (draftsCount) draftsCount.textContent = `${usage.categories.drafts.count} drafts saved`;

  const notesSize = el("storage-notes-size");
  if (notesSize) notesSize.textContent = formatBytes(usage.categories.notes.bytes);

  const notesCount = el("storage-notes-count");
  if (notesCount) notesCount.textContent = `${usage.categories.notes.count} problem notes`;

  const progressSize = el("storage-progress-size");
  if (progressSize) progressSize.textContent = formatBytes(usage.categories.progress.bytes);

  const progressCount = el("storage-progress-count");
  if (progressCount) {
    progressCount.textContent = `${state.solvedSlugs.size} solved, ${state.attemptedSlugs.size} attempted • ${state.starredSlugs.size} starred`;
  }

  const cacheSize = el("storage-cache-size");
  if (cacheSize) cacheSize.textContent = formatBytes(usage.categories.cache.bytes);

  const cacheCount = el("storage-cache-count");
  if (cacheCount) {
    const hasAll = !!localStorage.getItem("sqlmaster_cached_all_questions");
    cacheCount.textContent = hasAll ? "100 / 100 offline ready" : `${usage.categories.cache.count} cached`;
  }

  const settingsSize = el("storage-settings-size");
  if (settingsSize) settingsSize.textContent = formatBytes(usage.categories.settings.bytes);

  // Free Space Card
  const freeSize = el("storage-free-size");
  if (freeSize) freeSize.textContent = formatBytes(freeBytes);

  const freeSub = el("storage-free-sub");
  if (freeSub) freeSub.textContent = `${freePct.toFixed(1)}% remaining`;

  // Status Badge
  const statusBadge = el("storage-status-badge");
  if (statusBadge) {
    if (usage.percentUsed > 85) {
      statusBadge.textContent = "High Usage";
      statusBadge.style.background = "rgba(239, 68, 68, 0.15)";
      statusBadge.style.color = "#ef4444";
      statusBadge.style.borderColor = "rgba(239, 68, 68, 0.3)";
    } else if (usage.percentUsed > 50) {
      statusBadge.textContent = "Moderate";
      statusBadge.style.background = "rgba(245, 158, 11, 0.15)";
      statusBadge.style.color = "#f59e0b";
      statusBadge.style.borderColor = "rgba(245, 158, 11, 0.3)";
    } else {
      statusBadge.textContent = "Healthy";
      statusBadge.style.background = "rgba(16, 185, 129, 0.12)";
      statusBadge.style.color = "#10b981";
      statusBadge.style.borderColor = "rgba(16, 185, 129, 0.25)";
    }
  }
}

function exportFullBackup() {
  const drafts = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("sqlmaster_draft_")) {
      const slug = key.replace("sqlmaster_draft_", "");
      drafts[slug] = localStorage.getItem(key);
    }
  }

  const subCount = getSubmissionCount();
  localStorage.setItem("sqlmaster_total_submissions", String(subCount));

  const starredList = Array.from(state.starredSlugs);
  const starredDetails = starredList.map(slug => {
    const q = state.questions.find(item => item.slug === slug);
    return {
      slug: slug,
      title: q?.title || slug,
      difficulty: q?.difficulty || "Medium",
      company: q?.company || ""
    };
  });

  const data = {
    version: 2,
    backup_type: "full",
    app: "SQLMaster / MyWorkbench",
    exported_at: new Date().toISOString(),
    summary: {
      solved_count: state.solvedSlugs.size,
      attempted_count: state.attemptedSlugs.size,
      starred_count: state.starredSlugs.size,
      starred_slugs: starredList,
      starred_details: starredDetails,
      notes_count: Object.keys(state.userNotes || {}).length,
      drafts_count: Object.keys(drafts).length,
      total_submissions: subCount
    },
    solved: Array.from(state.solvedSlugs),
    attempted: Array.from(state.attemptedSlugs),
    starred: starredList,
    starred_details: starredDetails,
    notes: state.userNotes,
    drafts: drafts,
    submissions: subCount,
    settings: state.settings,
    ui_preferences: {
      theme: localStorage.getItem("sqlmaster_theme") || "light",
      codeTheme: localStorage.getItem("sqlmaster_code_theme") || "leetcode",
      plainMode: localStorage.getItem("sqlmaster_plain_mode") === "true",
      sort: localStorage.getItem("sqlmaster_sort") || "default",
      descWidth: localStorage.getItem("sqlmaster_desc_width"),
      editorHeight: localStorage.getItem("sqlmaster_editor_height")
    }
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sqlmaster_full_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(`Full Backup downloaded (${Object.keys(drafts).length} drafts, ${state.solvedSlugs.size} solved)`);
}

function exportCompactBackup() {
  const subCount = getSubmissionCount();
  localStorage.setItem("sqlmaster_total_submissions", String(subCount));

  const starredList = Array.from(state.starredSlugs);
  const starredDetails = starredList.map(slug => {
    const q = state.questions.find(item => item.slug === slug);
    return {
      slug: slug,
      title: q?.title || slug,
      difficulty: q?.difficulty || "Medium",
      company: q?.company || ""
    };
  });

  const data = {
    solved: Array.from(state.solvedSlugs),
    attempted: Array.from(state.attemptedSlugs),
    starred: starredList,
    starred_details: starredDetails,
    notes: state.userNotes,
    submissions: subCount,
    settings: state.settings,
    exported_at: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sqlmaster_compact_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Compact Backup downloaded");
}

let pendingRestoreData = null;

function handleImportFileSelect(e) {
  const file = e.target?.files?.[0] || e.dataTransfer?.files?.[0];
  if (!file) return;

  showToast(`📂 Reading backup file: ${file.name}...`);

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (!data || typeof data !== "object") {
        throw new Error("File content is not a valid JSON object");
      }

      pendingRestoreData = { file, data, fileName: file.name };

      const isFull = !!(data.drafts || data.backup_type === "full");
      const solvedList = Array.isArray(data.solved) ? data.solved : (Array.isArray(data.summary?.solved_slugs) ? data.summary.solved_slugs : []);
      const attemptedList = Array.isArray(data.attempted) ? data.attempted : (Array.isArray(data.summary?.attempted_slugs) ? data.summary.attempted_slugs : []);
      const starredList = Array.isArray(data.starred) 
        ? data.starred 
        : (data.summary && Array.isArray(data.summary.starred_slugs))
          ? data.summary.starred_slugs
          : (data.summary && Array.isArray(data.summary.starred_details))
            ? data.summary.starred_details
            : [];
      const notesObj = data.notes || data.userNotes || {};
      const draftsObj = data.drafts || {};

      const solvedCount = solvedList.length;
      const attemptedCount = attemptedList.length;
      const starredCount = starredList.length;
      const notesCount = Object.keys(notesObj).length;
      const draftsCount = Object.keys(draftsObj).length;

      const fileNameEl = el("restore-file-name");
      if (fileNameEl) fileNameEl.textContent = file.name;

      const fileTypeEl = el("restore-file-type");
      if (fileTypeEl) {
        fileTypeEl.textContent = isFull ? "Full Backup (v2)" : "Compact Progress Backup";
        fileTypeEl.className = isFull ? "badge-tag-rec" : "badge-tag-subtle";
      }

      const fileDateEl = el("restore-file-date");
      if (fileDateEl) {
        fileDateEl.textContent = data.exported_at
          ? "Exported: " + new Date(data.exported_at).toLocaleString()
          : "Export date: Unknown";
      }

      const countSolvedEl = el("restore-count-solved");
      if (countSolvedEl) countSolvedEl.textContent = solvedCount;

      const countAttemptedEl = el("restore-count-attempted");
      if (countAttemptedEl) countAttemptedEl.textContent = attemptedCount;

      const countStarredEl = el("restore-count-starred");
      if (countStarredEl) countStarredEl.textContent = starredCount;

      const countNotesEl = el("restore-count-notes");
      if (countNotesEl) countNotesEl.textContent = notesCount;

      const countDraftsEl = el("restore-count-drafts");
      if (countDraftsEl) countDraftsEl.textContent = draftsCount;

      // Update inline dropzone feedback card
      const dropInfo = el("dropzone-file-info");
      if (dropInfo) {
        dropInfo.style.display = "flex";
        dropInfo.innerHTML = `
          <div class="dropzone-file-meta">
            <div class="dropzone-file-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              <span>Ready to Restore: <strong>${escapeHTML(file.name)}</strong> (${formatBytes(file.size)})</span>
            </div>
            <div class="dropzone-file-badges">
              <span class="badge-tag-rec">${isFull ? "Full Backup" : "Compact Progress"}</span>
              <span class="badge-tag-subtle">${solvedCount} Solved</span>
              <span class="badge-tag-subtle">${draftsCount} Drafts</span>
              <span class="badge-tag-subtle">${starredCount} Starred</span>
              <span class="badge-tag-subtle">${notesCount} Notes</span>
            </div>
          </div>
          <div class="dropzone-actions">
            <button id="btn-quick-restore-merge" class="btn-sm btn-primary">Restore (Merge)</button>
            <button id="btn-quick-restore-replace" class="btn-sm btn-ghost text-danger">Replace All</button>
            <button id="btn-open-restore-preview" class="btn-sm btn-secondary">Review Dialog</button>
          </div>
        `;

        el("btn-quick-restore-merge")?.addEventListener("click", () => {
          applyRestoreData(data, "merge");
        });
        el("btn-quick-restore-replace")?.addEventListener("click", () => {
          if (confirm("Replace all local data with this backup? Current unsaved drafts will be overwritten.")) {
            applyRestoreData(data, "replace");
          }
        });
        el("btn-open-restore-preview")?.addEventListener("click", () => {
          const m = el("restore-modal");
          if (m) {
            m.classList.add("active");
            m.style.display = "flex";
          }
        });
      }

      // Open restore modal dialog
      const modal = el("restore-modal");
      if (modal) {
        modal.classList.add("active");
        modal.style.display = "flex";
      }

      showToast(`Backup loaded: ${file.name} (${solvedCount} solved, ${draftsCount} drafts). Click 'Apply Restore' to confirm.`);
    } catch (err) {
      console.error("Backup parse error:", err);
      showToast("Error reading backup file: " + err.message);
    } finally {
      if (e.target && "value" in e.target) {
        e.target.value = "";
      }
    }
  };
  reader.readAsText(file);
}

function closeRestoreModal() {
  const modal = el("restore-modal");
  if (modal) {
    modal.classList.remove("active");
    modal.style.display = "none";
  }
}

function handleApplyRestore() {
  if (!pendingRestoreData) {
    showToast("No backup file loaded to restore");
    return;
  }
  const mode = document.querySelector('input[name="restore-mode"]:checked')?.value || "merge";
  applyRestoreData(pendingRestoreData.data, mode);
  closeRestoreModal();
}

function applyRestoreData(data, mode) {
  try {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid backup data format");
    }

    const isReplace = mode === "replace";

    // 1. Solved
    const solvedList = Array.isArray(data.solved) 
      ? data.solved 
      : Array.isArray(data.solvedSlugs) 
        ? data.solvedSlugs 
        : Array.isArray(data.summary?.solved_slugs) 
          ? data.summary.solved_slugs 
          : [];
    if (isReplace) state.solvedSlugs.clear();
    solvedList.forEach(s => {
      const slug = (typeof s === "object" && s?.slug) ? s.slug : s;
      if (typeof slug === "string") state.solvedSlugs.add(slug);
    });
    localStorage.setItem("sqlmaster_solved", JSON.stringify(Array.from(state.solvedSlugs)));

    // 2. Attempted
    const attemptedList = Array.isArray(data.attempted) 
      ? data.attempted 
      : Array.isArray(data.attemptedSlugs) 
        ? data.attemptedSlugs 
        : Array.isArray(data.summary?.attempted_slugs) 
          ? data.summary.attempted_slugs 
          : [];
    if (isReplace) state.attemptedSlugs.clear();
    attemptedList.forEach(s => {
      const slug = (typeof s === "object" && s?.slug) ? s.slug : s;
      if (typeof slug === "string") state.attemptedSlugs.add(slug);
    });
    localStorage.setItem("sqlmaster_attempted", JSON.stringify(Array.from(state.attemptedSlugs)));

    // 3. Starred
    const starredList = Array.isArray(data.starred)
      ? data.starred
      : Array.isArray(data.starredSlugs)
        ? data.starredSlugs
        : (data.summary && Array.isArray(data.summary.starred_slugs))
          ? data.summary.starred_slugs
          : (data.summary && Array.isArray(data.summary.starred_details))
            ? data.summary.starred_details
            : [];
    if (isReplace) state.starredSlugs.clear();
    starredList.forEach(s => {
      const slug = (typeof s === "object" && s?.slug) ? s.slug : s;
      if (typeof slug === "string") state.starredSlugs.add(slug);
    });
    localStorage.setItem("sqlmaster_starred", JSON.stringify(Array.from(state.starredSlugs)));

    // 4. Notes
    const notes = data.notes || data.userNotes || data.user_notes;
    if (notes && typeof notes === "object") {
      if (isReplace) state.userNotes = {};
      state.userNotes = { ...state.userNotes, ...notes };
      localStorage.setItem("sqlmaster_user_notes", JSON.stringify(state.userNotes));
    }

    // 5. Drafts
    if (isReplace) {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("sqlmaster_draft_")) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    }

    let restoredDraftsCount = 0;
    if (data.drafts && typeof data.drafts === "object") {
      for (const [slug, sql] of Object.entries(data.drafts)) {
        if (typeof sql === "string" && sql.trim().length > 0) {
          localStorage.setItem(`sqlmaster_draft_${slug}`, sql);
          state.attemptedSlugs.add(slug);
          restoredDraftsCount++;
        }
      }
      localStorage.setItem("sqlmaster_attempted", JSON.stringify(Array.from(state.attemptedSlugs)));
    }

    // 6. Submissions
    const subVal = data.submissions ?? data.total_submissions ?? data.summary?.total_submissions;
    if (subVal !== undefined && subVal !== null) {
      const sub = parseInt(subVal, 10);
      if (!isNaN(sub) && sub > 0) {
        const current = getSubmissionCount();
        const finalSub = isReplace ? sub : Math.max(current, sub);
        localStorage.setItem("sqlmaster_total_submissions", String(finalSub));
      }
    }

    // 7. Settings
    if (data.settings && typeof data.settings === "object") {
      state.settings = { ...state.settings, ...data.settings };
      localStorage.setItem("sqlmaster_settings", JSON.stringify(state.settings));
      applySettingsToEditor();
    }

    // 8. UI Preferences
    if (data.ui_preferences && typeof data.ui_preferences === "object") {
      if (data.ui_preferences.theme) applyTheme(data.ui_preferences.theme);
      if (data.ui_preferences.codeTheme) applyCodeTheme(data.ui_preferences.codeTheme);
      if (data.ui_preferences.plainMode !== undefined && state.plainMode !== data.ui_preferences.plainMode) {
        state.plainMode = data.ui_preferences.plainMode;
        localStorage.setItem("sqlmaster_plain_mode", String(state.plainMode));
        applyCodeTheme(state.codeTheme, state.plainMode);
      }
    }

    // 9. If current question is active, refresh editor and notes
    if (state.currentQuestion) {
      const curSlug = state.currentQuestion.slug;
      const draft = localStorage.getItem(`sqlmaster_draft_${curSlug}`);
      if (draft !== null && state.editor) {
        state.editor.setValue(draft);
      }
      loadPersonalNote(curSlug);
    }

    // 10. Update all UI representations
    updateProgressUI();
    renderHomeProblemsTable();
    renderHomeDashboard();
    renderQuestionList();
    updateStorageUsageUI();
    updateNotesCountBadge();

    // 11. Update dropzone feedback card with confirmed success state
    const dropInfo = el("dropzone-file-info");
    if (dropInfo) {
      dropInfo.style.display = "flex";
      dropInfo.innerHTML = `
        <div class="dropzone-file-meta">
          <div class="dropzone-file-title" style="color: #10b981;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Restore Complete! (${state.solvedSlugs.size} Solved, ${restoredDraftsCount} Drafts, ${state.starredSlugs.size} Starred)</span>
          </div>
          <div style="font-size: 12px; color: var(--text-dark-muted); margin-top: 2px;">
            All progress, drafts, and notes from <strong>${escapeHTML(pendingRestoreData?.fileName || "backup")}</strong> have been restored directly into this browser.
          </div>
        </div>
        <div class="dropzone-actions">
          <button class="btn-sm btn-secondary" onclick="switchView('home')">Go to Dashboard →</button>
        </div>
      `;
    }

    showToast(`🎉 Restore successful: ${state.solvedSlugs.size} solved, ${restoredDraftsCount} drafts, ${state.starredSlugs.size} starred`);
  } catch (err) {
    console.error("Apply restore error:", err);
    showToast("Error applying restore: " + err.message);
  }
}

function clearDraftsOnly() {
  const draftKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith("sqlmaster_draft_")) {
      draftKeys.push(key);
    }
  }

  if (draftKeys.length === 0) {
    showToast("No saved SQL drafts found to clear");
    return;
  }

  if (confirm(`Are you sure you want to clear ${draftKeys.length} saved SQL drafts? Your solved/attempted counts, stars, and notes will NOT be affected.`)) {
    draftKeys.forEach(k => localStorage.removeItem(k));
    if (state.currentQuestion && state.editor) {
      state.editor.setValue("");
    }
    updateStorageUsageUI();
    showToast(`Cleared ${draftKeys.length} saved SQL drafts from storage`);
  }
}

function factoryResetAll() {
  const code = prompt('WARNING: This will completely erase ALL solved questions, notes, drafts, and preferences.\n\nType "RESET" to confirm:');
  if (code === "RESET") {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("sqlmaster_")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    state.solvedSlugs.clear();
    state.attemptedSlugs.clear();
    state.starredSlugs.clear();
    state.userNotes = {};
    if (state.editor) state.editor.setValue("");
    updateProgressUI();
    renderHomeProblemsTable();
    renderHomeDashboard();
    renderQuestionList();
    updateStorageUsageUI();
    showToast("Factory reset complete. All local data cleared.");
  }
}

function freeOfflineCache() {
  const cacheKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith("sqlmaster_cached_") || key.startsWith("sqlmaster_qdetail_"))) {
      cacheKeys.push(key);
    }
  }

  if (cacheKeys.length === 0) {
    showToast("No offline question cache in LocalStorage to clear");
    return;
  }

  if (confirm(`Remove offline question cache (${cacheKeys.length} items, ~2.5 MB) from LocalStorage to reclaim space?\n\nYour SQL query drafts, personal notes, and solved progress will remain 100% safe.`)) {
    cacheKeys.forEach(k => localStorage.removeItem(k));
    updateStorageUsageUI();
    showToast("Reclaimed ~2.5 MB of LocalStorage!");
  }
}

async function precacheAllQuestionsForOffline(showFeedback = true) {
  try {
    if (showFeedback) showToast("Caching all 100 questions locally for offline practice...");
    const res = await fetch("/api/questions-all");
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const allData = await res.json();

    // Store the master object efficiently without duplicate per-question keys
    localStorage.setItem("sqlmaster_cached_all_questions", JSON.stringify(allData));
    localStorage.setItem("sqlmaster_cached_all_time", new Date().toISOString());

    // Clean up any old duplicate per-question keys to keep LocalStorage lean
    const dupes = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("sqlmaster_cached_q_")) dupes.push(k);
    }
    dupes.forEach(k => localStorage.removeItem(k));

    const count = Object.keys(allData).length;
    updateStorageUsageUI();
    if (showFeedback) {
      showToast(`Success! All ${count} questions & schemas cached offline.`);
    }
  } catch (err) {
    console.error("Precache failed:", err);
    if (showFeedback) showToast("Precache failed: " + err.message);
  }
}

// Start application
document.addEventListener("DOMContentLoaded", init);
