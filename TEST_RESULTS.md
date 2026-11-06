# TEST RESULTS - driving-license-bd (run #257, 16:00 slot, 2026-11-06)

## Unit tests - 27/27 PASS
Command: `node tests/logic.test.js`

- Fee table: all 9 rows exact - learner1 518, learner2 748, smart_np 4,212, smart_p 2,487, ren_np10 4,150, ren_np5 2,000, ren_p 1,400, duplicate 875, IDP 2,500.
- Late fee: renewal +400/year (ren_np10 + 2y = 4,950; ren_np5 + 3y = 3,200); non-renewal fees ignore late years; negative/non-numeric clamp to 0; capped at 10 years.
- daysUntil: same-day 0, +1/-1, +365, leap day 2028-02-28 to 2028-02-29 = 1, invalid dates (2026-02-30, 2026-13-01, free text) return null.
- expiryStatus: -5 expired, 0 renew, 179 renew, 180 renew, 181 ok, 900 ok.
- validateLicence: empty/blank label, bad type, bad issue/expiry dates, expiry <= issue rejected; 61-char label rejected; valid entry passes; multiple errors reported at once.
- sortLicences: orders by nearest expiry without mutating input.
- Checklists: 5 types (learner 5, smart 6, renewal 5, duplicate 4, international 5 items); every item id has EN + BN strings; progress math (1/5 = 20%, 2/6 = 33% rounded, unknown items ignored); overall 3/25 = 12%, full = 25/25 = 100%.
- Quiz: 10 questions, correct indices [1,1,1,0,2,2,0,1,1,0] matching the safe-facts spec (ages 18/20, validity 10y/5y, learner accompanied, red = stop, overtake right, seatbelt always, helmet rider + pillion, zebra = pedestrians); all-zeros answers score 3 (q4/q7/q10 correct index 0); all-correct scores 10/10.
- Steps (6) and categories (4) complete; every step title/desc/docs/mistake has EN + BN strings.
- validateImport: good file passes; null/array/wrong-app/missing-version/bad-checklist-type/bad-checklist-item/non-array licences/bad-licence/quizBest 11/bad-lang all rejected with distinct codes; export/import round-trip preserves data exactly.
- i18n: EN/BN key sets identical (228 keys each), no empty strings.
- formatBDT: 4212 -> Tk 4,212; 13800 -> Tk 13,800; bnDigits converts 4212 -> 4212 and dates; formatBDT(4212, 'bn') uses Bengali digits.

## Headless-Chrome smoke - 55/55 PASS (after 1 repair cycle)
Command: `node smoke/smoke.mjs` (raw CDP, headless shell 1187, file:// + ?asof=2026-11-06)

- Title "Driving Licence BD", 7 tabs, default fee Tk 4,212 (smart non-professional); verify note mentions bsp.brta.gov.bd.
- Calculator: learner 1 cat = Tk 518; 2 cats = Tk 748; smart professional = Tk 2,487.
- Renewal: base Tk 4,150; late-years input appears for renewal only; + 2 late years = Tk 4,950; hidden again for smart card.
- Chart: 9 rows, contains Tk 2,500; row click loads Tk 2,500 into the calculator and shows the IDP note.
- Steps: 6 items, 3 good-to-know notes, mentions bsp.brta.gov.bd and "2 to 3 months".
- Categories: 4 cards; professional mentions dope test; non-professional validity "10 years".
- Checklists: Learner 5 items, tick -> "1/5 done", overall "1/25"; Smart 6 items incl. dope test.
- Tracker: empty state visible; empty-label submit shows inline error; expiry-before-issue shows order error; add 2031-01-01 -> Valid badge; add 2020-01-01 -> Expired badge; add 2027-03-01 (~115 days out) -> Renew soon badge; nearest expiry sorts first.
- Quiz: 4 options per question; correct answer shows "Correct" feedback; all 10 answered correctly -> result 10/10, best score 10/10.
- BN toggle: title changes, fee shows Bengali digits; after reload language, 3 licences, and checklist tick all persist; toggle back restores English.
- Typed-DELETE erase clears licences; tracker empty again.
- Mobile 390px: no horizontal overflow on all 7 tabs.
- Zero console errors, zero page exceptions.

## Repairs (1 cycle, 3 real bugs fixed)

1. **Badge key mismatch (app.js):** tracker rendered `t('badge_' + status)` but status `ok` has no `badge_ok` key - the badge showed the literal text "badge_ok" instead of "Valid". Fixed with an explicit status-to-key map (`ok -> badge_valid`, `renew -> badge_renew`, `expired -> badge_expired`). Caught by smoke check "valid licence added with Valid badge".
2. **Wrong element id (app.js renderData):** referenced `data-import-btn`, but the button's id in index.html is `import-btn`. Threw `TypeError: Cannot set properties of null` on every render (7 page exceptions in the first smoke run). Fixed the id. Caught by the zero-exceptions check.
3. **Stale best-score display (app.js renderQuiz):** `#quiz-best` was only refreshed at the top of renderQuiz, before the new best score was saved, so it still showed "No attempt yet" after a 10/10 finish. Now refreshed in the result branch after saving. Caught by smoke check "best score saved as 10/10".

Also fixed during unit testing (not a repair cycle): one test expectation - all-zero quiz answers score 3, not 2, because q4/q7/q10 have correct index 0. The test was wrong, the code was right.

## ASCII check

`grep -P '[^\x00-\x7F]'` over index.html, style.css, js/data.js, js/i18n.js, js/app.js, tests/logic.test.js, smoke/smoke.mjs returns **zero matches** (Bengali is stored as \uXXXX escapes in js/i18n.js and numeric/escape forms elsewhere). README.md and TEST_RESULTS.md also ASCII.
