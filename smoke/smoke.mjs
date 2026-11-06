// Driving Licence BD headless-Chrome smoke test (raw CDP, headless_shell).
// Run: node smoke/smoke.mjs
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const PAGE = 'file://' + path.resolve(DIR, '..', 'index.html') + '?asof=2026-11-06';
const CHROME = process.env.HEADLESS_SHELL ||
  (process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell');
const PORT = 9231;
const TAKA = '\u09f3';

const results = [];
function check(name, cond, extra) {
  results.push([name, !!cond]);
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (extra !== undefined ? ' :: ' + extra : ''));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if (await fn()) return true; } catch (e) { /* retry */ }
    await sleep(200);
  }
  throw new Error('timeout waiting for: ' + label);
}

async function main() {
  const child = spawn(CHROME, [
    '--headless', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--remote-debugging-address=127.0.0.1',
    'about:blank',
  ], { stdio: 'ignore' });
  try {
    let version = null;
    await waitFor(async () => {
      const res = await fetch('http://127.0.0.1:' + PORT + '/json/version');
      if (!res.ok) return false;
      version = await res.json();
      return true;
    }, 20000, 'debugger port');
    const ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0;
    const pending = new Map();
    const consoleErrors = [];
    const exceptions = [];
    const onMsg = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        exceptions.push(msg.params.exceptionDetails.exception?.description || 'exception');
      }
    };
    ws.onmessage = onMsg;
    const send = (method, params) => new Promise((res, rej) => {
      const mid = ++id;
      pending.set(mid, { res, rej });
      ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    });
    const target = await (await fetch('http://127.0.0.1:' + PORT + '/json/new?about:blank', { method: 'PUT' })).json();
    const tws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { tws.onopen = res; tws.onerror = rej; });
    const tpending = new Map();
    let tid = 0;
    tws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && tpending.has(msg.id)) {
        const { res, rej } = tpending.get(msg.id);
        tpending.delete(msg.id);
        if (msg.error) rej(new Error(JSON.stringify(msg.error))); else res(msg.result);
      }
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        exceptions.push(msg.params.exceptionDetails.exception?.description || 'exception');
      }
    };
    const tsend = (method, params) => new Promise((res, rej) => {
      const mid = ++tid;
      tpending.set(mid, { res, rej });
      tws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    });
    const teval = async (expr) => {
      const r = await tsend('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'eval failed');
      return r.result.value;
    };
    await tsend('Runtime.enable');
    await tsend('Page.enable');
    await tsend('Page.navigate', { url: PAGE });
    await waitFor(async () => (await teval('document.getElementById("fee-amount").textContent.length')) > 1, 10000, 'app renders');

    // 1. Initial render: title, 7 tabs, default fee smart non-prof = 4,212.
    check('title correct', await teval('document.querySelector("h1").textContent') === 'Driving Licence BD');
    check('7 tabs render', (await teval('document.querySelectorAll("#tabs button").length')) === 7);
    check('default fee is 4,212', await teval('document.getElementById("fee-amount").textContent') === TAKA + '4,212');
    check('verify-fees note mentions bsp.brta.gov.bd', await teval('document.getElementById("fee-verify").textContent.includes("bsp.brta.gov.bd")'));

    // 2. Calculator: learner 1 cat = 518; learner 2 cat = 748; smart prof = 2,487.
    await teval(`document.getElementById('fee-type').value = 'learner1'; document.getElementById('fee-type').dispatchEvent(new Event('change', {bubbles: true}));`);
    await sleep(200);
    check('learner 1 category = 518', await teval('document.getElementById("fee-amount").textContent') === TAKA + '518');
    await teval(`document.getElementById('fee-type').value = 'learner2'; document.getElementById('fee-type').dispatchEvent(new Event('change', {bubbles: true}));`);
    await sleep(200);
    check('learner 2 categories = 748', await teval('document.getElementById("fee-amount").textContent') === TAKA + '748');
    await teval(`document.getElementById('fee-type').value = 'smart_p'; document.getElementById('fee-type').dispatchEvent(new Event('change', {bubbles: true}));`);
    await sleep(200);
    check('smart professional = 2,487', await teval('document.getElementById("fee-amount").textContent') === TAKA + '2,487');

    // 3. Renewal + late fee: ren_np10 + 2 late years = 4,150 + 800 = 4,950.
    await teval(`document.getElementById('fee-type').value = 'ren_np10'; document.getElementById('fee-type').dispatchEvent(new Event('change', {bubbles: true}));`);
    await sleep(200);
    check('renewal 10y base = 4,150', await teval('document.getElementById("fee-amount").textContent') === TAKA + '4,150');
    check('late-years input shown for renewal', await teval('!document.getElementById("late-wrap").hidden'));
    await teval(`document.getElementById('late-years').value = '2'; document.getElementById('late-years').dispatchEvent(new Event('input', {bubbles: true}));`);
    await sleep(200);
    check('renewal + 2 late years = 4,950', await teval('document.getElementById("fee-amount").textContent') === TAKA + '4,950');
    await teval(`document.getElementById('fee-type').value = 'smart_np'; document.getElementById('fee-type').dispatchEvent(new Event('change', {bubbles: true}));`);
    await sleep(200);
    check('late-years hidden for smart card', await teval('document.getElementById("late-wrap").hidden'));

    // 4. Chart: 9 rows; clicking the IDP row loads 2,500 into the calculator.
    check('chart has 9 rows', (await teval('document.querySelectorAll("#chart-body tr").length')) === 9);
    check('chart row shows 2,500', await teval('document.getElementById("chart-body").textContent.includes("2,500")'));
    await teval(`[...document.querySelectorAll('#chart-body tr')].find(tr => tr.textContent.includes('2,500')).click();`);
    await sleep(300);
    check('row click loads 2,500 fee', await teval('document.getElementById("fee-amount").textContent') === TAKA + '2,500');
    check('row click shows IDP note', await teval('document.getElementById("fee-note").textContent.includes("passport")'));

    // 5. Steps: 6 steps + 3 good-to-know notes; mentions bsp.brta.gov.bd.
    await teval(`document.getElementById('tab-steps').click();`);
    await sleep(300);
    check('6 steps render', (await teval('document.querySelectorAll("#steps-list li").length')) === 6);
    check('3 good-to-know notes render', (await teval('document.querySelectorAll("#notes-list li").length')) === 3);
    check('steps mention bsp.brta.gov.bd', await teval('document.getElementById("steps-list").textContent.includes("bsp.brta.gov.bd")'));
    check('steps mention 2 to 3 months', await teval('document.getElementById("steps-list").textContent.includes("2 to 3 months")'));

    // 6. Categories: 4 cards; professional mentions dope test; non-prof age 18.
    await teval(`document.getElementById('tab-cats').click();`);
    await sleep(300);
    check('4 category cards render', (await teval('document.querySelectorAll("#cats-list .cat-card").length')) === 4);
    check('professional mentions dope test', await teval('document.getElementById("cats-list").textContent.toLowerCase().includes("dope test")'));
    check('non-professional validity 10 years', await teval('document.getElementById("cats-list").textContent.includes("10 years")'));

    // 7. Checklists: Learner = 5 items, tick one -> 1/5; Smart = 6 items incl. dope test.
    await teval(`document.getElementById('tab-check').click();`);
    await sleep(300);
    check('Learner checklist has 5 items', (await teval('document.querySelectorAll("#checklist-list .check-item").length')) === 5);
    await teval(`document.querySelector('#checklist-list input[type="checkbox"]').click();`);
    await sleep(300);
    check('progress shows 1/5 done', await teval('document.getElementById("check-progress").textContent.includes("1/5")'));
    check('overall progress shows 1/25', await teval('document.getElementById("check-overall").textContent.includes("1/25")'));
    await teval(`[...document.querySelectorAll('#check-types button')].find(b => b.dataset.value === 'smart').click();`);
    await sleep(300);
    check('Smart checklist has 6 items', (await teval('document.querySelectorAll("#checklist-list .check-item").length')) === 6);
    check('Smart list mentions dope test', await teval('document.getElementById("checklist-list").textContent.toLowerCase().includes("dope test")'));

    // 8. Tracker: empty state; validation blocks empty label + bad order; badges.
    await teval(`document.getElementById('tab-track').click();`);
    await sleep(300);
    check('tracker empty state visible', await teval('!document.getElementById("tracker-empty").hidden'));
    await teval(`document.getElementById('l-label').value = ''; document.getElementById('l-issue').value = '2020-01-01'; document.getElementById('l-expiry').value = '2030-01-01';
      document.querySelector('#add-licence-form button[type="submit"]').click();`);
    await sleep(300);
    check('empty label shows inline error', await teval('!document.getElementById("err-label").hidden'));
    await teval(`document.getElementById('l-label').value = 'Bad'; document.getElementById('l-issue').value = '2030-01-01'; document.getElementById('l-expiry').value = '2020-01-01';
      document.querySelector('#add-licence-form button[type="submit"]').click();`);
    await sleep(300);
    check('expiry-before-issue shows order error', await teval('!document.getElementById("err-order").hidden'));
    await teval(`document.getElementById('l-label').value = 'Mine'; document.getElementById('l-issue').value = '2021-01-01'; document.getElementById('l-expiry').value = '2031-01-01';
      document.querySelector('#add-licence-form button[type="submit"]').click();`);
    await sleep(300);
    check('valid licence added with Valid badge', (await teval('document.querySelectorAll(".lic-card").length')) === 1
      && await teval('document.querySelector(".lic-card .badge").textContent') === 'Valid');
    await teval(`document.getElementById('l-label').value = 'Old'; document.getElementById('l-issue').value = '2010-01-01'; document.getElementById('l-expiry').value = '2020-01-01';
      document.querySelector('#add-licence-form button[type="submit"]').click();`);
    await sleep(300);
    check('expired licence shows Expired badge', (await teval('document.querySelectorAll(".lic-card").length')) === 2
      && await teval('[...document.querySelectorAll(".lic-card .badge")].some(b => b.textContent === "Expired")'));
    await teval(`document.getElementById('l-label').value = 'Soon'; document.getElementById('l-issue').value = '2022-01-01'; document.getElementById('l-expiry').value = '2027-03-01';
      document.querySelector('#add-licence-form button[type="submit"]').click();`);
    await sleep(300);
    check('115-days-out licence shows Renew soon badge', await teval('[...document.querySelectorAll(".lic-card .badge")].some(b => b.textContent === "Renew soon")'));
    check('nearest expiry sorts first', await teval('document.querySelector(".lic-card strong").textContent') === 'Old');

    // 9. Quiz: start, answer all 10 correctly, score 10/10, best score shown.
    await teval(`document.getElementById('tab-quiz').click();`);
    await sleep(300);
    await teval(`document.querySelector('#quiz-area button').click();`);
    await sleep(300);
    check('quiz question 1 renders 4 options', (await teval('document.querySelectorAll(".quiz-opt").length')) === 4);
    const correct = [1, 1, 1, 0, 2, 2, 0, 1, 1, 0];
    for (let i = 0; i < 10; i++) {
      await teval(`document.querySelectorAll('.quiz-opt')[${correct[i]}].click();`);
      await sleep(250);
      if (i === 0) check('correct answer shows Correct feedback', await teval('document.querySelector(".quiz-feedback").textContent.includes("Correct")'));
      await teval(`document.querySelector('#quiz-area .btn-primary').click();`);
      await sleep(250);
    }
    check('quiz result shows 10/10', await teval('document.querySelector(".quiz-result").textContent.includes("10/10")'));
    check('best score saved as 10/10', await teval('document.getElementById("quiz-best").textContent.includes("10/10")'));

    // 10. Bangla toggle: title + Bengali digits in fee; persists after reload.
    await teval(`document.getElementById('tab-fees').click();`);
    await sleep(200);
    await teval(`document.getElementById('lang-toggle').click();`);
    await sleep(300);
    check('Bangla title shown', await teval('document.querySelector("h1").textContent') !== 'Driving Licence BD');
    check('Bengali digits in fee', await teval('/[\\u09e6-\\u09ef]/.test(document.getElementById("fee-amount").textContent)'));
    await tsend('Page.navigate', { url: PAGE });
    await waitFor(async () => (await teval('document.getElementById("fee-amount").textContent.length')) > 1, 10000, 'app after reload');
    await sleep(300);
    check('language persists after reload', await teval('document.querySelector("h1").textContent') !== 'Driving Licence BD');
    check('licences persist after reload', (await teval('document.querySelectorAll(".lic-card").length')) === 3);
    await teval(`document.getElementById('tab-check').click();`);
    await sleep(300);
    check('checklist tick persists after reload', await teval('document.querySelector("#checklist-list input[type=\\"checkbox\\"]").checked') === true);
    await teval(`document.getElementById('lang-toggle').click();`);
    await sleep(200);
    check('toggle back to English title', await teval('document.querySelector("h1").textContent') === 'Driving Licence BD');

    // 11. Data tab: typed-DELETE erase clears licences.
    await teval(`document.getElementById('tab-data').click();`);
    await sleep(300);
    await teval(`document.getElementById('erase-input').value = 'DELETE'; document.getElementById('erase-btn').click();`);
    await sleep(300);
    check('erase clears licences', (await teval('document.querySelectorAll(".lic-card").length')) === 0);
    await teval(`document.getElementById('tab-track').click();`);
    await sleep(300);
    check('tracker empty again after erase', await teval('!document.getElementById("tracker-empty").hidden'));

    // 12. Mobile 390px: no horizontal overflow on any tab.
    await tsend('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await sleep(500);
    const tabs = ['fees', 'steps', 'cats', 'check', 'track', 'quiz', 'data'];
    for (const tb of tabs) {
      await teval(`document.getElementById('tab-${tb}').click();`);
      await sleep(250);
      check('no overflow at 390px (' + tb + ')', await teval('document.documentElement.scrollWidth <= 391'));
    }

    // 13. No console errors / exceptions.
    check('zero console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
    check('zero page exceptions', exceptions.length === 0, exceptions.join(' | '));

    tws.close(); ws.close();
  } finally {
    child.kill();
  }
  const failed = results.filter((r) => !r[1]).length;
  console.log(failed === 0 ? 'SMOKE PASS: ' + results.length + '/' + results.length : 'SMOKE FAIL: ' + failed + ' failures');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error('SMOKE ERROR:', e.message); process.exit(1); });
