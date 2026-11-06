# Driving Licence BD

An offline, bilingual (English / Bangla) guide to getting a driving licence in Bangladesh - fees, steps, licence categories, document checklists, an expiry tracker, and a written-test practice quiz. Everything runs locally in the browser; all data stays in `localStorage`.

> **Unofficial guide.** This app is not BRTA and is not affiliated with the Bangladesh Road Transport Authority. Fees and steps change - **verify on [bsp.brta.gov.bd](https://bsp.brta.gov.bd) before paying or applying.**

## Features

- **Fee calculator** - pick a fee type and see the exact BDT fee. Renewal fees add the 400 BDT/year late fee automatically. A full fee chart lets you tap any row to load it into the calculator.
- **Step-by-step guide** - the 6 steps from BRTA portal registration to collecting your smart card, each with documents needed and the common mistake to avoid.
- **Licence categories** - non-professional, professional, learner, and international permit, with minimum age, validity, and requirements.
- **Document checklists** - tick-off lists for learner, smart card, renewal, duplicate, and international applications, with per-type and overall progress, saved locally.
- **My Licences (expiry tracker)** - add licences with issue/expiry dates; badges show Valid / Renew soon (within 180 days) / Expired, sorted by nearest expiry.
- **Practice quiz** - 10 hand-checked questions on the written test, with instant feedback, explanations, and a persisted best score.
- **Data** - JSON export, strict import validation (malformed files are rejected, existing data stays intact), and typed-DELETE erase-all.
- **Bilingual** - full English / Bangla toggle (persisted), Bengali digits throughout in Bangla mode. Works at 390px mobile width with no horizontal overflow.

## Fees used (BDT)

Fees as reported in 2025-2026 guides. Verify on bsp.brta.gov.bd before paying.

| Fee | Amount |
|---|---|
| Learner licence - 1 category | 518 |
| Learner licence - 2 categories (motorcycle + light) | 748 |
| Smart card - non-professional (10 years) | 4,212 |
| Smart card - professional (5 years) | 2,487 |
| Renewal - non-professional (10 years) | 4,150 |
| Renewal - non-professional, 5 years (age 55+) | 2,000 |
| Renewal - professional (5 years) | 1,400 |
| Late fee (renewal) | 400 per year |
| Duplicate smart card | 875 |
| International driving permit | 2,500 |

## Stack

Vanilla HTML / CSS / JavaScript - no build step, no dependencies, no network requests. Pure-logic module (`js/data.js`) is shared between the app and the Node tests; UI strings live in `js/i18n.js` (Bengali stored as `\uXXXX` escapes so every source file stays pure ASCII).

## Prerequisites

Any modern browser. For tests: Node.js 18+.

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

For deterministic dates in testing, add `?asof=2026-11-06` to the URL (used by the smoke test).

## Testing

```bash
node tests/logic.test.js   # 27 unit tests, no dependencies
node smoke/smoke.mjs       # 55 headless-Chrome checks (raw CDP, headless shell)
```

See [TEST_RESULTS.md](TEST_RESULTS.md) for the latest real results.

## Project structure

```
index.html          UI shell (7 tabs)
style.css           responsive styles
js/data.js          fees, steps, categories, checklists, quiz, date/status logic
js/i18n.js          English + Bangla strings (ASCII escapes)
js/app.js           rendering, tabs, localStorage, quiz flow
tests/logic.test.js Node unit tests
smoke/smoke.mjs     headless-Chrome smoke tests
```

## Limitations

- Fee figures are from 2025-2026 guides and may have changed; always verify on bsp.brta.gov.bd before paying.
- The quiz covers well-known rules only (ages, validity, learner rules, lights, overtaking, seatbelts, helmets, zebra crossings). It does not cover speed limits, fine amounts, or learner validity periods, which vary or were not verified.
- Data lives only in the browser's `localStorage` - clearing browser data erases it. Export a JSON backup from the Data tab.
- No live BRTA integration; this is a static guide, not an application portal.

## Status

Complete MVP. Tests green (see TEST_RESULTS.md).
