// Driving Licence BD - pure logic + data (no DOM). Node + browser compatible.
// All money is integer BDT. Fees as reported in 2025-2026 guides; the UI and
// README tell users to verify on bsp.brta.gov.bd before paying.
(function (root) {
  'use strict';

  var APP = 'driving-license-bd';
  var VERSION = 1;
  var LATE_FEE_PER_YEAR = 400;
  var RENEW_SOON_DAYS = 180;

  // Fee table. id, base fee (BDT), whether a late fee can apply, category group.
  var FEES = [
    { id: 'learner1', base: 518, late: false, group: 'learner' },
    { id: 'learner2', base: 748, late: false, group: 'learner' },
    { id: 'smart_np', base: 4212, late: false, group: 'smart' },
    { id: 'smart_p', base: 2487, late: false, group: 'smart' },
    { id: 'ren_np10', base: 4150, late: true, group: 'renewal' },
    { id: 'ren_np5', base: 2000, late: true, group: 'renewal' },
    { id: 'ren_p', base: 1400, late: true, group: 'renewal' },
    { id: 'dup', base: 875, late: false, group: 'other' },
    { id: 'idp', base: 2500, late: false, group: 'other' }
  ];

  function feeById(id) {
    for (var i = 0; i < FEES.length; i++) {
      if (FEES[i].id === id) return FEES[i];
    }
    return null;
  }

  // Total fee for a fee id. lateYears only counts for renewal fees.
  function getFee(id, lateYears) {
    var row = feeById(id);
    if (!row) return null;
    var years = 0;
    if (row.late) {
      years = parseInt(lateYears, 10);
      if (isNaN(years) || years < 0) years = 0;
      if (years > 10) years = 10;
    }
    return row.base + years * LATE_FEE_PER_YEAR;
  }

  function feeRows() {
    return FEES.map(function (f) {
      return { id: f.id, base: f.base, late: f.late, group: f.group };
    });
  }

  // ---- dates (UTC, strict YYYY-MM-DD) ----
  function parseDate(s) {
    if (typeof s !== 'string') return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return dt;
  }

  function formatDateISO(dt) {
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return dt.getUTCFullYear() + '-' + p(dt.getUTCMonth() + 1) + '-' + p(dt.getUTCDate());
  }

  function todayISO(asof) {
    if (asof) {
      var d = parseDate(asof);
      if (d) return formatDateISO(d);
    }
    var now = new Date();
    return formatDateISO(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
  }

  // Whole days from `from` to `to` (to - from). Null on bad input.
  function daysUntil(to, from) {
    var a = parseDate(from), b = parseDate(to);
    if (!a || !b) return null;
    return Math.round((b.getTime() - a.getTime()) / 86400000);
  }

  // 'expired' | 'renew' (within 180 days, incl. today) | 'ok'
  function expiryStatus(days) {
    if (days === null || days === undefined || isNaN(days)) return null;
    if (days < 0) return 'expired';
    if (days <= RENEW_SOON_DAYS) return 'renew';
    return 'ok';
  }

  // ---- licence tracker ----
  var LICENCE_TYPES = ['nonprof', 'prof', 'learner'];

  function validateLicence(label, type, issue, expiry) {
    var errs = [];
    if (typeof label !== 'string' || label.trim().length === 0) errs.push('label');
    else if (label.trim().length > 60) errs.push('label-long');
    if (LICENCE_TYPES.indexOf(type) === -1) errs.push('type');
    if (!parseDate(issue)) errs.push('issue');
    if (!parseDate(expiry)) errs.push('expiry');
    if (parseDate(issue) && parseDate(expiry) && parseDate(expiry).getTime() <= parseDate(issue).getTime()) {
      errs.push('order');
    }
    return errs;
  }

  function sortLicences(list) {
    return list.slice().sort(function (a, b) {
      if (a.expiry < b.expiry) return -1;
      if (a.expiry > b.expiry) return 1;
      return 0;
    });
  }

  // ---- checklists ----
  var CHECKLIST_TYPES = ['learner', 'smart', 'renewal', 'duplicate', 'international'];
  var CHECKLISTS = {
    learner: ['nid', 'photos', 'edu', 'medical', 'address'],
    smart: ['nid', 'photos', 'edu', 'medical', 'dopetest', 'address'],
    renewal: ['nid', 'photos', 'medical', 'oldlicence', 'address'],
    duplicate: ['nid', 'photos', 'gd', 'address'],
    international: ['nid', 'photos', 'passport', 'oldlicence', 'medical']
  };
  var CHECKLIST_ITEMS = ['nid', 'photos', 'edu', 'medical', 'address', 'oldlicence', 'gd', 'dopetest', 'passport'];

  function checklistProgress(doneIds, type) {
    var items = CHECKLISTS[type] || [];
    var done = 0;
    for (var i = 0; i < items.length; i++) {
      if (doneIds.indexOf(items[i]) !== -1) done++;
    }
    var pct = items.length === 0 ? 0 : Math.round((done / items.length) * 100);
    return { done: done, total: items.length, pct: pct };
  }

  function overallProgress(checklistState) {
    var done = 0, total = 0;
    for (var i = 0; i < CHECKLIST_TYPES.length; i++) {
      var t = CHECKLIST_TYPES[i];
      var p = checklistProgress(checklistState[t] || [], t);
      done += p.done; total += p.total;
    }
    var pct = total === 0 ? 0 : Math.round((done / total) * 100);
    return { done: done, total: total, pct: pct };
  }

  // ---- quiz ----
  // Safe, well-known facts only. No speed limits, no learner validity, no fines.
  var QUIZ = [
    { id: 'q1', correct: 1 },
    { id: 'q2', correct: 1 },
    { id: 'q3', correct: 1 },
    { id: 'q4', correct: 0 },
    { id: 'q5', correct: 2 },
    { id: 'q6', correct: 2 },
    { id: 'q7', correct: 0 },
    { id: 'q8', correct: 1 },
    { id: 'q9', correct: 1 },
    { id: 'q10', correct: 0 }
  ];

  function quizScore(answers) {
    var score = 0;
    for (var i = 0; i < QUIZ.length; i++) {
      if (answers[i] === QUIZ[i].correct) score++;
    }
    return { score: score, total: QUIZ.length };
  }

  // ---- steps & categories (ids only; text lives in i18n) ----
  var STEPS = [1, 2, 3, 4, 5, 6];
  var CATEGORIES = ['nonprof', 'prof', 'learner', 'idp'];

  // ---- formatting ----
  var BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];

  function bnDigits(s) {
    return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }

  function formatBDT(n, lang) {
    var grouped = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    var out = '\u09f3' + grouped;
    return lang === 'bn' ? bnDigits(out) : out;
  }

  function formatNum(n, lang) {
    var s = String(n);
    return lang === 'bn' ? bnDigits(s) : s;
  }

  // ---- import / export validation ----
  function validateImport(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return 'not-object';
    if (data.app !== APP) return 'bad-app';
    if (data.version !== VERSION) return 'bad-version';
    if (data.checklist !== undefined) {
      if (typeof data.checklist !== 'object' || Array.isArray(data.checklist)) return 'bad-checklist';
      for (var k in data.checklist) {
        if (CHECKLIST_TYPES.indexOf(k) === -1) return 'bad-checklist-type';
        if (!Array.isArray(data.checklist[k])) return 'bad-checklist-value';
        for (var i = 0; i < data.checklist[k].length; i++) {
          if (CHECKLIST_ITEMS.indexOf(data.checklist[k][i]) === -1) return 'bad-checklist-item';
        }
      }
    }
    if (data.licences !== undefined) {
      if (!Array.isArray(data.licences)) return 'bad-licences';
      for (var j = 0; j < data.licences.length; j++) {
        var l = data.licences[j];
        if (!l || typeof l !== 'object') return 'bad-licence';
        if (validateLicence(l.label, l.type, l.issue, l.expiry).length > 0) return 'bad-licence';
      }
    }
    if (data.quizBest !== undefined) {
      if (typeof data.quizBest !== 'number' || data.quizBest < 0 || data.quizBest > QUIZ.length) return 'bad-quizbest';
    }
    if (data.lang !== undefined && data.lang !== 'en' && data.lang !== 'bn') return 'bad-lang';
    return null;
  }

  function defaultState() {
    return {
      app: APP, version: VERSION, lang: 'en',
      checklist: { learner: [], smart: [], renewal: [], duplicate: [], international: [] },
      licences: [], quizBest: null
    };
  }

  var api = {
    APP: APP, VERSION: VERSION, LATE_FEE_PER_YEAR: LATE_FEE_PER_YEAR,
    RENEW_SOON_DAYS: RENEW_SOON_DAYS, FEES: FEES, feeById: feeById,
    getFee: getFee, feeRows: feeRows, parseDate: parseDate,
    formatDateISO: formatDateISO, todayISO: todayISO, daysUntil: daysUntil,
    expiryStatus: expiryStatus, LICENCE_TYPES: LICENCE_TYPES,
    validateLicence: validateLicence, sortLicences: sortLicences,
    CHECKLIST_TYPES: CHECKLIST_TYPES, CHECKLISTS: CHECKLISTS,
    CHECKLIST_ITEMS: CHECKLIST_ITEMS, checklistProgress: checklistProgress,
    overallProgress: overallProgress, QUIZ: QUIZ, quizScore: quizScore,
    STEPS: STEPS, CATEGORIES: CATEGORIES, bnDigits: bnDigits,
    formatBDT: formatBDT, formatNum: formatNum,
    validateImport: validateImport, defaultState: defaultState
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.DLData = api;
})(typeof window !== 'undefined' ? window : globalThis);
