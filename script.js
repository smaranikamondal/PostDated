/**
 * PostDated — letters to a future self, sealed until their date.
 * All state lives in localStorage. No network, no libraries.
 */

(function () {
  "use strict";

  var STORAGE_KEY = "postdated.letters.v1";
  var CHECK_INTERVAL_MS = 60 * 1000;
  var TAGS = { prediction: true, goal: true, reminder: true };

  var state = {
    letters: [],
    filter: "all",
    previouslySealedIds: {},
  };

  var els = {};

  /* ---------- boot ---------- */

  function init() {
    cacheElements();
    setDatePickerFloor();
    state.letters = loadLetters();
    bindEvents();
    refresh();
    window.setInterval(tickUnlocks, CHECK_INTERVAL_MS);
  }

  function cacheElements() {
    els.form = document.getElementById("letter-form");
    els.text = document.getElementById("letter-text");
    els.date = document.getElementById("unlock-date");
    els.error = document.getElementById("form-error");
    els.sealedList = document.getElementById("sealed-list");
    els.deliveredList = document.getElementById("delivered-list");
    els.sealedEmpty = document.getElementById("sealed-empty");
    els.deliveredEmpty = document.getElementById("delivered-empty");
    els.statTotal = document.getElementById("stat-total");
    els.statSealed = document.getElementById("stat-sealed");
    els.statDelivered = document.getElementById("stat-delivered");
    els.statAccuracy = document.getElementById("stat-accuracy");
    els.statAccuracyWrap = document.getElementById("stat-accuracy-wrap");
  }

  function bindEvents() {
    els.form.addEventListener("submit", onSubmit);
    els.date.addEventListener("change", function () {
      hideError();
    });

    document.getElementById("filter-form").addEventListener("submit", onFilterSubmit);
    els.sealedList.addEventListener("submit", onCardSubmit);
    els.deliveredList.addEventListener("submit", onCardSubmit);
  }

  /* ---------- storage (fail-safe) ---------- */

  function loadLetters() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(normalizeLetter).filter(Boolean);
    } catch (err) {
      return [];
    }
  }

  function saveLetters(letters) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(letters));
      return true;
    } catch (err) {
      showError("This browser would not keep the letter. Storage may be full or blocked.");
      return false;
    }
  }

  function normalizeLetter(item) {
    if (!item || typeof item !== "object") return null;
    if (typeof item.id !== "string" || !item.id) return null;
    if (typeof item.text !== "string" || !item.text.trim()) return null;
    if (!TAGS[item.tag]) return null;
    if (!isIsoDate(item.createdAt) || !isIsoDate(item.unlockDate)) return null;

    var letter = {
      id: item.id,
      text: item.text,
      tag: item.tag,
      createdAt: item.createdAt,
      unlockDate: item.unlockDate,
    };

    if (typeof item.outcome === "string" && item.outcome) {
      letter.outcome = item.outcome;
    }

    return letter;
  }

  /* ---------- dates ---------- */

  function todayYmd() {
    var now = new Date();
    return toYmd(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  function toYmd(year, month, day) {
    var mm = String(month).padStart(2, "0");
    var dd = String(day).padStart(2, "0");
    return year + "-" + mm + "-" + dd;
  }

  function isIsoDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function parseYmd(ymd) {
    var parts = ymd.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function isUnlocked(letter, today) {
    return letter.unlockDate <= (today || todayYmd());
  }

  function daysUntil(unlockDate, today) {
    var start = parseYmd(today || todayYmd());
    var end = parseYmd(unlockDate);
    return Math.round((end - start) / (24 * 60 * 60 * 1000));
  }

  function formatLongDate(ymd) {
    return parseYmd(ymd).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function setDatePickerFloor() {
    var today = todayYmd();
    els.date.min = today;
    if (!els.date.value) els.date.value = today;
  }

  /* ---------- form ---------- */

  function onSubmit(event) {
    event.preventDefault();
    hideError();
    setDatePickerFloor();

    var text = els.text.value.trim();
    var unlockDate = els.date.value;
    var tagInput = els.form.querySelector('input[name="tag"]:checked');

    if (!text) {
      showError("Write a few words before you seal the envelope.");
      els.text.focus();
      return;
    }

    if (!tagInput) {
      showError("Choose a stamp: Prediction, Goal, or Reminder.");
      return;
    }

    if (!isIsoDate(unlockDate)) {
      showError("Pick a delivery date.");
      els.date.focus();
      return;
    }

    if (unlockDate < todayYmd()) {
      showError("That date has already gone by. Choose today or a day still ahead.");
      els.date.focus();
      return;
    }

    var letter = {
      id: createId(),
      text: text,
      tag: tagInput.value,
      createdAt: todayYmd(),
      unlockDate: unlockDate,
    };

    state.letters.unshift(letter);
    if (!saveLetters(state.letters)) {
      state.letters.shift();
      return;
    }

    els.form.reset();
    setDatePickerFloor();
    refresh();
  }

  function showError(message) {
    els.error.hidden = false;
    els.error.textContent = message;
  }

  function hideError() {
    els.error.hidden = true;
    els.error.textContent = "";
  }

  function createId() {
    return "ltr-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- unlock check ---------- */

  function tickUnlocks() {
    setDatePickerFloor();
    refresh();
  }

  function snapshotSealedIds() {
    var today = todayYmd();
    var map = {};
    state.letters.forEach(function (letter) {
      if (!isUnlocked(letter, today)) map[letter.id] = true;
    });
    return map;
  }

  /* ---------- render ---------- */

  function refresh() {
    var justUnlocked = [];
    var today = todayYmd();
    var prev = state.previouslySealedIds;

    if (Object.keys(prev).length) {
      state.letters.forEach(function (letter) {
        if (prev[letter.id] && isUnlocked(letter, today)) {
          justUnlocked.push(letter.id);
        }
      });
    }

    renderStats();
    renderLists(justUnlocked);
    state.previouslySealedIds = snapshotSealedIds();
  }

  function matchesFilter(letter) {
    return state.filter === "all" || letter.tag === state.filter;
  }

  function renderStats() {
    var today = todayYmd();
    var sealed = 0;
    var delivered = 0;
    var right = 0;
    var answered = 0;

    state.letters.forEach(function (letter) {
      if (isUnlocked(letter, today)) delivered += 1;
      else sealed += 1;

      if (letter.tag === "prediction" && (letter.outcome === "right" || letter.outcome === "wrong")) {
        answered += 1;
        if (letter.outcome === "right") right += 1;
      }
    });

    els.statTotal.textContent = String(state.letters.length);
    els.statSealed.textContent = String(sealed);
    els.statDelivered.textContent = String(delivered);

    if (answered > 0) {
      var pct = Math.round((right / answered) * 100);
      els.statAccuracy.textContent = pct + "%";
      els.statAccuracyWrap.hidden = false;
    } else {
      els.statAccuracyWrap.hidden = true;
    }
  }

  function renderLists(justUnlocked) {
    justUnlocked = justUnlocked || [];
    var today = todayYmd();
    var sealedHtml = [];
    var deliveredHtml = [];

    state.letters.forEach(function (letter) {
      if (!matchesFilter(letter)) return;
      if (isUnlocked(letter, today)) {
        deliveredHtml.push(renderDeliveredCard(letter, justUnlocked.indexOf(letter.id) !== -1));
      } else {
        sealedHtml.push(renderSealedCard(letter));
      }
    });

    els.sealedList.innerHTML = sealedHtml.join("");
    els.deliveredList.innerHTML = deliveredHtml.join("");
    els.sealedEmpty.hidden = sealedHtml.length > 0;
    els.deliveredEmpty.hidden = deliveredHtml.length > 0;
  }

  function renderSealedCard(letter) {
    var remaining = daysUntil(letter.unlockDate);
    var countdown;
    if (remaining === 1) countdown = "Opens in 1 day";
    else countdown = "Opens in " + remaining + " days";

    return (
      '<form class="letter-card envelope" data-id="' +
      escapeAttr(letter.id) +
      '">' +
      '<div class="card-top">' +
      stampMarkup(letter.tag) +
      postmarkMarkup("Written", letter.createdAt) +
      "</div>" +
      '<p class="countdown">' +
      escapeHtml(countdown) +
      "</p>" +
      '<p class="letter-meta">Delivery set for ' +
      escapeHtml(formatLongDate(letter.unlockDate)) +
      "</p>" +
      '<button type="submit" class="delete-btn" name="action" value="delete">Discard</button>' +
      "</form>"
    );
  }

  function renderDeliveredCard(letter, animate) {
    var extraClass = animate ? " just-unlocked" : "";
    return (
      '<form class="letter-card' +
      extraClass +
      '" data-id="' +
      escapeAttr(letter.id) +
      '">' +
      '<div class="card-top">' +
      stampMarkup(letter.tag) +
      postmarkMarkup("Arrived", letter.unlockDate) +
      "</div>" +
      '<p class="letter-body">' +
      escapeHtml(letter.text) +
      "</p>" +
      '<p class="letter-meta">Written ' +
      escapeHtml(formatLongDate(letter.createdAt)) +
      " · Opens " +
      escapeHtml(formatLongDate(letter.unlockDate)) +
      "</p>" +
      renderOutcome(letter) +
      '<button type="submit" class="delete-btn" name="action" value="delete">Discard</button>' +
      "</form>"
    );
  }

  function stampMarkup(tag) {
    var labels = { prediction: "Prediction", goal: "Goal", reminder: "Reminder" };
    return '<span class="stamp stamp-' + tag + '">' + labels[tag] + "</span>";
  }

  function postmarkMarkup(caption, ymd) {
    var d = parseYmd(ymd);
    var month = d.toLocaleDateString(undefined, { month: "short" }).toUpperCase();
    var day = String(d.getDate());
    var year = String(d.getFullYear());
    return (
      '<div class="postmark" aria-label="' +
      escapeAttr(caption + " " + formatLongDate(ymd)) +
      '">' +
      "<span>" +
      escapeHtml(caption) +
      "</span>" +
      "<span>" +
      escapeHtml(month + " " + day) +
      "</span>" +
      "<span>" +
      escapeHtml(year) +
      "</span></div>"
    );
  }

  function renderOutcome(letter) {
    if (letter.outcome) {
      return '<p class="outcome-saved">' + escapeHtml(outcomeLabel(letter)) + "</p>";
    }

    if (letter.tag === "prediction") {
      return (
        '<div class="outcome-row">' +
        '<button type="submit" class="outcome-btn" name="outcome" value="right">I was right</button>' +
        '<button type="submit" class="outcome-btn" name="outcome" value="wrong">I was wrong</button>' +
        "</div>"
      );
    }

    if (letter.tag === "goal") {
      return (
        '<div class="outcome-row">' +
        '<button type="submit" class="outcome-btn" name="outcome" value="achieved">Achieved</button>' +
        '<button type="submit" class="outcome-btn" name="outcome" value="not-yet">Not yet</button>' +
        "</div>"
      );
    }

    return (
      '<div class="outcome-row">' +
      '<button type="submit" class="outcome-btn" name="outcome" value="done">Done</button>' +
      "</div>"
    );
  }

  function outcomeLabel(letter) {
    if (letter.tag === "prediction") {
      return letter.outcome === "right" ? "You marked this prediction right." : "You marked this prediction wrong.";
    }
    if (letter.tag === "goal") {
      return letter.outcome === "achieved" ? "Marked achieved." : "Still in progress.";
    }
    return "Marked done.";
  }

  /* ---------- card and filter actions (submit, so a real click still works) ---------- */

  function onFilterSubmit(event) {
    event.preventDefault();
    var btn = event.submitter;
    if (!btn || !btn.value) return;
    state.filter = btn.value;
    document.querySelectorAll(".filter-btn").forEach(function (node) {
      node.classList.toggle("is-active", node === btn);
    });
    renderLists();
  }

  function onCardSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget.tagName === "FORM" ? event.currentTarget : event.target;
    if (form.tagName !== "FORM") form = form.closest("form");
    var id = form.getAttribute("data-id");
    var btn = event.submitter;
    if (!id || !btn) return;

    if (btn.name === "action" && btn.value === "delete") {
      if (window.confirm("Discard this letter for good?")) {
        deleteLetter(id);
      }
      return;
    }

    if (btn.name === "outcome") {
      setOutcome(id, btn.value);
    }
  }

  function deleteLetter(id) {
    state.letters = state.letters.filter(function (letter) {
      return letter.id !== id;
    });
    saveLetters(state.letters);
    refresh();
  }

  function setOutcome(id, value) {
    var allowed = {
      prediction: { right: true, wrong: true },
      goal: { achieved: true, "not-yet": true },
      reminder: { done: true },
    };

    state.letters = state.letters.map(function (letter) {
      if (letter.id !== id) return letter;
      if (!allowed[letter.tag] || !allowed[letter.tag][value]) return letter;
      if (letter.outcome) return letter;
      return Object.assign({}, letter, { outcome: value });
    });

    saveLetters(state.letters);
    refresh();
  }

  /* ---------- escaping ---------- */

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
