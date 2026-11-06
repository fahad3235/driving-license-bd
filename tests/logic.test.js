// Unit tests for Driving Licence BD logic. Run: node tests/logic.test.js
const assert = require('assert');
const L = require('../js/data.js');
const I18n = require('../js/i18n.js');

let passed = 0;
function check(name, fn) { fn(); passed += 1; console.log('ok - ' + name); }

// 1. Fee table: all 9 fees exact.
check('fee table has all 9 rows with exact BDT values', () => {
  const expected = {
    learner1: 518, learner2: 748, smart_np: 4212, smart_p: 2487,
    ren_np10: 4150, ren_np5: 2000, ren_p: 1400, dup: 875, idp: 2500
  };
  const rows = L.feeRows();
  assert.strictEqual(rows.length, 9);
  for (const r of rows) {
    assert.strictEqual(r.base, expected[r.id], 'fee mismatch ' + r.id);
  }
});
check('getFee returns null for unknown fee id', () => {
  assert.strictEqual(L.getFee('nope'), null);
  assert.strictEqual(L.getFee(''), null);
});
check('late fee adds 400 per year only for renewal fees', () => {
  assert.strictEqual(L.getFee('ren_np10', 0), 4150);
  assert.strictEqual(L.getFee('ren_np10', 1), 4550);
  assert.strictEqual(L.getFee('ren_np10', 2), 4950);
  assert.strictEqual(L.getFee('ren_np5', 3), 3200);
  assert.strictEqual(L.getFee('ren_p', 1), 1800);
  assert.strictEqual(L.getFee('smart_np', 2), 4212); // non-renewal ignores late years
  assert.strictEqual(L.getFee('learner1', 5), 518);
  assert.strictEqual(L.getFee('ren_np10', -1), 4150); // negative clamps to 0
  assert.strictEqual(L.getFee('ren_np10', 'x'), 4150); // non-numeric clamps to 0
  assert.strictEqual(L.getFee('ren_np10', 11), 8150); // capped at 10 years
});

// 2. Dates.
check('daysUntil is exact incl. leap year and boundaries', () => {
  assert.strictEqual(L.daysUntil('2026-11-06', '2026-11-06'), 0);
  assert.strictEqual(L.daysUntil('2026-11-07', '2026-11-06'), 1);
  assert.strictEqual(L.daysUntil('2026-11-05', '2026-11-06'), -1);
  assert.strictEqual(L.daysUntil('2027-11-06', '2026-11-06'), 365);
  assert.strictEqual(L.daysUntil('2028-02-29', '2028-02-28'), 1);
  assert.strictEqual(L.daysUntil('2028-03-01', '2028-02-28'), 2);
  assert.strictEqual(L.daysUntil('not-a-date', '2026-11-06'), null);
  assert.strictEqual(L.daysUntil('2026-02-30', '2026-11-06'), null);
  assert.strictEqual(L.daysUntil('2026-13-01', '2026-11-06'), null);
});
check('parseDate rejects malformed dates', () => {
  assert.strictEqual(L.parseDate('2026-2-3'), null);
  assert.strictEqual(L.parseDate('06/11/2026'), null);
  assert.strictEqual(L.parseDate(20261106), null);
  assert.ok(L.parseDate('2026-11-06') instanceof Date);
});
check('todayISO honours the asof override', () => {
  assert.strictEqual(L.todayISO('2026-11-06'), '2026-11-06');
  assert.strictEqual(L.todayISO('bad'), L.todayISO(null));
});
check('expiryStatus thresholds (180-day renew rule)', () => {
  assert.strictEqual(L.expiryStatus(-5), 'expired');
  assert.strictEqual(L.expiryStatus(-1), 'expired');
  assert.strictEqual(L.expiryStatus(0), 'renew');
  assert.strictEqual(L.expiryStatus(1), 'renew');
  assert.strictEqual(L.expiryStatus(179), 'renew');
  assert.strictEqual(L.expiryStatus(180), 'renew');
  assert.strictEqual(L.expiryStatus(181), 'ok');
  assert.strictEqual(L.expiryStatus(900), 'ok');
  assert.strictEqual(L.expiryStatus(null), null);
});

// 3. Licence validation + sorting.
check('validateLicence catches empty label / bad dates / wrong order', () => {
  assert.deepStrictEqual(L.validateLicence('', 'nonprof', '2020-01-01', '2030-01-01'), ['label']);
  assert.deepStrictEqual(L.validateLicence('   ', 'nonprof', '2020-01-01', '2030-01-01'), ['label']);
  assert.deepStrictEqual(L.validateLicence('Mine', 'nope', '2020-01-01', '2030-01-01'), ['type']);
  assert.deepStrictEqual(L.validateLicence('Mine', 'nonprof', 'bad', '2030-01-01'), ['issue']);
  assert.deepStrictEqual(L.validateLicence('Mine', 'nonprof', '2020-01-01', 'bad'), ['expiry']);
  assert.deepStrictEqual(L.validateLicence('Mine', 'nonprof', '2030-01-01', '2020-01-01'), ['order']);
  assert.deepStrictEqual(L.validateLicence('Mine', 'nonprof', '2020-01-01', '2020-01-01'), ['order']);
  assert.deepStrictEqual(L.validateLicence('Mine', 'nonprof', '2020-01-01', '2030-01-01'), []);
  assert.deepStrictEqual(L.validateLicence('x'.repeat(61), 'nonprof', '2020-01-01', '2030-01-01'), ['label-long']);
});
check('sortLicences orders by nearest expiry', () => {
  const list = [
    { label: 'C', expiry: '2031-01-01' },
    { label: 'A', expiry: '2027-01-01' },
    { label: 'B', expiry: '2029-06-01' }
  ];
  assert.deepStrictEqual(L.sortLicences(list).map((x) => x.label), ['A', 'B', 'C']);
  assert.strictEqual(list[0].label, 'C'); // does not mutate input
});

// 4. Checklists.
check('checklist types cover all five application types', () => {
  assert.deepStrictEqual(L.CHECKLIST_TYPES, ['learner', 'smart', 'renewal', 'duplicate', 'international']);
  assert.strictEqual(L.CHECKLISTS.learner.length, 5);
  assert.strictEqual(L.CHECKLISTS.smart.length, 6);
  assert.strictEqual(L.CHECKLISTS.renewal.length, 5);
  assert.strictEqual(L.CHECKLISTS.duplicate.length, 4);
  assert.strictEqual(L.CHECKLISTS.international.length, 5);
  for (const type of L.CHECKLIST_TYPES) {
    for (const id of L.CHECKLISTS[type]) {
      assert.ok(I18n.STR.en['item_' + id], 'missing EN item_' + id);
      assert.ok(I18n.STR.bn['item_' + id], 'missing BN item_' + id);
    }
  }
});
check('checklistProgress math incl. rounding', () => {
  assert.deepStrictEqual(L.checklistProgress([], 'learner'), { done: 0, total: 5, pct: 0 });
  assert.deepStrictEqual(L.checklistProgress(['nid'], 'learner'), { done: 1, total: 5, pct: 20 });
  assert.deepStrictEqual(L.checklistProgress(['nid', 'photos', 'edu'], 'learner'), { done: 3, total: 5, pct: 60 });
  assert.deepStrictEqual(L.checklistProgress(['nid', 'photos', 'edu', 'medical', 'address'], 'learner'), { done: 5, total: 5, pct: 100 });
  assert.deepStrictEqual(L.checklistProgress(['nid', 'bogus'], 'learner'), { done: 1, total: 5, pct: 20 });
  assert.deepStrictEqual(L.checklistProgress(['nid'], 'duplicate'), { done: 1, total: 4, pct: 25 });
  assert.deepStrictEqual(L.checklistProgress(['nid', 'photos'], 'smart'), { done: 2, total: 6, pct: 33 });
});
check('overallProgress sums all five checklists', () => {
  const st = { learner: ['nid'], smart: [], renewal: ['nid', 'photos'], duplicate: [], international: [] };
  assert.deepStrictEqual(L.overallProgress(st), { done: 3, total: 25, pct: 12 });
  const full = {};
  for (const t of L.CHECKLIST_TYPES) full[t] = L.CHECKLISTS[t].slice();
  assert.deepStrictEqual(L.overallProgress(full), { done: 25, total: 25, pct: 100 });
});

// 5. Quiz.
check('quiz has 10 questions with valid correct indices', () => {
  assert.strictEqual(L.QUIZ.length, 10);
  for (const q of L.QUIZ) {
    assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3, 'bad correct ' + q.id);
    assert.ok(I18n.STR.en[q.id] && I18n.STR.bn[q.id], 'missing text ' + q.id);
    for (let o = 1; o <= 4; o++) {
      assert.ok(I18n.STR.en[q.id + 'o' + o] && I18n.STR.bn[q.id + 'o' + o], 'missing option ' + q.id + 'o' + o);
    }
    assert.ok(I18n.STR.en[q.id + 'ex'] && I18n.STR.bn[q.id + 'ex'], 'missing expl ' + q.id);
  }
});
check('quizScore counts only exact matches', () => {
  const allRight = L.QUIZ.map((q) => q.correct);
  assert.deepStrictEqual(L.quizScore(allRight), { score: 10, total: 10 });
  assert.deepStrictEqual(L.quizScore([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), { score: 3, total: 10 }); // q4, q7, q10 have correct index 0
  assert.deepStrictEqual(L.quizScore([]), { score: 0, total: 10 });
  assert.deepStrictEqual(L.quizScore([1, 1, 1, 0, 2, 2, 0, 1, 1, 0]), { score: 10, total: 10 });
});
check('quiz correct answers match the safe-facts spec', () => {
  // q1 age nonprof 18 (opt idx 1), q2 age prof 20 (1), q3 nonprof 10y (1),
  // q4 prof 5y (0), q5 learner accompanied (2), q6 red=stop (2),
  // q7 overtake right (0), q8 seatbelt always (1), q9 helmet both (1), q10 zebra pedestrians (0)
  assert.deepStrictEqual(L.QUIZ.map((q) => q.correct), [1, 1, 1, 0, 2, 2, 0, 1, 1, 0]);
});

// 6. Steps + categories present.
check('steps and categories ids are complete', () => {
  assert.deepStrictEqual(L.STEPS, [1, 2, 3, 4, 5, 6]);
  assert.deepStrictEqual(L.CATEGORIES, ['nonprof', 'prof', 'learner', 'idp']);
  for (let i = 1; i <= 6; i++) {
    for (const suf of ['t', 'd', 'docs', 'm']) {
      assert.ok(I18n.STR.en['step' + i + suf], 'missing EN step' + i + suf);
      assert.ok(I18n.STR.bn['step' + i + suf], 'missing BN step' + i + suf);
    }
  }
  for (const c of L.CATEGORIES) {
    assert.ok(I18n.STR.en['cat_' + c + '_t'] && I18n.STR.bn['cat_' + c + '_t'], 'missing cat ' + c);
  }
});

// 7. Import validation.
check('validateImport accepts a good file and rejects bad ones', () => {
  const good = { app: 'driving-license-bd', version: 1, lang: 'bn',
    checklist: { learner: ['nid'] }, licences: [{ label: 'Mine', type: 'nonprof', issue: '2020-01-01', expiry: '2030-01-01' }],
    quizBest: 8 };
  assert.strictEqual(L.validateImport(good), null);
  assert.strictEqual(L.validateImport({ app: 'driving-license-bd', version: 1 }), null);
  assert.strictEqual(L.validateImport(null), 'not-object');
  assert.strictEqual(L.validateImport([]), 'not-object');
  assert.strictEqual(L.validateImport({ app: 'other', version: 1 }), 'bad-app');
  assert.strictEqual(L.validateImport({ app: 'driving-license-bd' }), 'bad-version');
  assert.strictEqual(L.validateImport({ app: 'driving-license-bd', version: 1, checklist: { nope: [] } }), 'bad-checklist-type');
  assert.strictEqual(L.validateImport({ app: 'driving-license-bd', version: 1, checklist: { learner: ['nope'] } }), 'bad-checklist-item');
  assert.strictEqual(L.validateImport({ app: 'driving-license-bd', version: 1, licences: 'x' }), 'bad-licences');
  assert.strictEqual(L.validateImport({ app: 'driving-license-bd', version: 1, licences: [{ label: '', type: 'nonprof', issue: '2020-01-01', expiry: '2030-01-01' }] }), 'bad-licence');
  assert.strictEqual(L.validateImport({ app: 'driving-license-bd', version: 1, quizBest: 11 }), 'bad-quizbest');
  assert.strictEqual(L.validateImport({ app: 'driving-license-bd', version: 1, lang: 'fr' }), 'bad-lang');
});
check('export/import round-trip keeps data intact', () => {
  const s = L.defaultState();
  s.lang = 'bn';
  s.checklist.learner = ['nid', 'photos'];
  s.licences = [{ label: 'Mine', type: 'prof', issue: '2021-03-01', expiry: '2026-03-01' }];
  s.quizBest = 9;
  const json = JSON.stringify(s);
  const back = JSON.parse(json);
  assert.strictEqual(L.validateImport(back), null);
  assert.deepStrictEqual(back, s);
});

// 8. i18n parity.
check('i18n EN/BN keys match exactly, none empty', () => {
  const en = Object.keys(I18n.STR.en).sort();
  const bn = Object.keys(I18n.STR.bn).sort();
  assert.deepStrictEqual(bn, en);
  assert.ok(en.length >= 200, 'expected 200+ keys, got ' + en.length);
  for (const k of en) {
    assert.ok(typeof I18n.STR.en[k] === 'string' && I18n.STR.en[k].length > 0, 'empty EN ' + k);
    assert.ok(typeof I18n.STR.bn[k] === 'string' && I18n.STR.bn[k].length > 0, 'empty BN ' + k);
  }
});

// 9. Formatting.
check('formatBDT formats with taka sign and grouping', () => {
  assert.strictEqual(L.formatBDT(4212, 'en'), '\u09f34,212');
  assert.strictEqual(L.formatBDT(13800, 'en'), '\u09f313,800');
  assert.strictEqual(L.formatBDT(518, 'en'), '\u09f3518');
});
check('bnDigits converts Western digits to Bengali digits', () => {
  assert.strictEqual(L.bnDigits('4212'), '\u09ea\u09e8\u09e7\u09e8');
  assert.strictEqual(L.bnDigits('2026-11-06'), '\u09e8\u09e6\u09e8\u09ec-\u09e7\u09e7-\u09e6\u09ec');
  assert.strictEqual(L.bnDigits('no digits'), 'no digits');
  assert.strictEqual(L.formatBDT(4212, 'bn'), '\u09f3' + L.bnDigits('4,212'));
  assert.strictEqual(L.formatNum(10, 'bn'), L.bnDigits('10'));
  assert.strictEqual(L.formatNum(10, 'en'), '10');
});

check('feeById finds rows and returns null for unknown ids', () => {
  assert.strictEqual(L.feeById('smart_np').base, 4212);
  assert.strictEqual(L.feeById('dup').late, false);
  assert.strictEqual(L.feeById('ren_p').late, true);
  assert.strictEqual(L.feeById('zzz'), null);
});
check('getFee coerces string late-years input', () => {
  assert.strictEqual(L.getFee('ren_np10', '2'), 4950);
  assert.strictEqual(L.getFee('ren_np10', ''), 4150);
  assert.strictEqual(L.getFee('ren_np10', null), 4150);
});
check('formatDateISO round-trips parseDate', () => {
  const d = L.parseDate('2026-11-06');
  assert.strictEqual(L.formatDateISO(d), '2026-11-06');
  assert.strictEqual(L.formatDateISO(L.parseDate('2028-02-29')), '2028-02-29');
});
check('defaultState starts empty with English', () => {
  const s = L.defaultState();
  assert.strictEqual(s.app, 'driving-license-bd');
  assert.strictEqual(s.version, 1);
  assert.strictEqual(s.lang, 'en');
  assert.deepStrictEqual(s.licences, []);
  assert.strictEqual(s.quizBest, null);
  assert.deepStrictEqual(Object.keys(s.checklist).sort(), L.CHECKLIST_TYPES.slice().sort());
  for (const t of L.CHECKLIST_TYPES) assert.deepStrictEqual(s.checklist[t], []);
});
check('checklistProgress handles unknown type gracefully', () => {
  assert.deepStrictEqual(L.checklistProgress(['nid'], 'nope'), { done: 0, total: 0, pct: 0 });
  assert.deepStrictEqual(L.overallProgress({}), { done: 0, total: 25, pct: 0 });
});
check('validateLicence reports several errors at once', () => {
  assert.deepStrictEqual(
    L.validateLicence('', 'nope', 'bad', 'bad'),
    ['label', 'type', 'issue', 'expiry']);
  assert.deepStrictEqual(L.validateLicence('OK', 'learner', '2020-01-01', '2035-01-01'), []);
});

console.log('\n' + passed + '/' + passed + ' unit tests passed');
