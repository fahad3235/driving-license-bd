// Driving Licence BD - app logic (browser only). All text via i18n.js.
(function () {
  'use strict';
  var D = window.DLData;
  var I = window.DLI18n.STR;
  var KEY = 'driving-license-bd-v1';

  var params = new URLSearchParams(window.location.search);
  var TODAY = D.todayISO(params.get('asof'));

  function loadState() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return D.defaultState();
      var s = JSON.parse(raw);
      if (D.validateImport(s) !== null) return D.defaultState();
      var d = D.defaultState();
      d.lang = s.lang || 'en';
      d.checklist = s.checklist || d.checklist;
      d.licences = s.licences || [];
      d.quizBest = (typeof s.quizBest === 'number') ? s.quizBest : null;
      return d;
    } catch (e) { return D.defaultState(); }
  }

  var state = loadState();
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function t(k) { return (I[state.lang] && I[state.lang][k]) || I.en[k] || k; }
  function fmt(n) { return D.formatBDT(n, state.lang); }
  function num(n) { return D.formatNum(n, state.lang); }

  var ui = { tab: 'fees', checkType: 'learner', quiz: { idx: -1, answers: [], picked: null } };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  // ---------- static chrome ----------
  function renderChrome() {
    document.querySelector('h1').textContent = t('app_title');
    document.getElementById('subtitle').textContent = t('app_sub');
    document.getElementById('lang-toggle').textContent =
      state.lang === 'en' ? t('lang_bn') : t('lang_en');
    var tabs = ['fees', 'steps', 'cats', 'check', 'track', 'quiz', 'data'];
    var keys = ['tab_fees', 'tab_steps', 'tab_cats', 'tab_check', 'tab_track', 'tab_quiz', 'tab_data'];
    for (var i = 0; i < tabs.length; i++) {
      var b = document.getElementById('tab-' + tabs[i]);
      b.textContent = t(keys[i]);
      b.classList.toggle('active', ui.tab === tabs[i]);
      document.getElementById('panel-' + tabs[i]).classList.toggle('active', ui.tab === tabs[i]);
    }
    document.getElementById('foot-disc').textContent = t('footer_disclaimer');
    document.getElementById('foot-verify').textContent = t('footer_verify');
  }

  // ---------- fees ----------
  function renderFees() {
    var sel = document.getElementById('fee-type');
    if (sel.options.length === 0) {
      D.FEES.forEach(function (f) {
        var o = document.createElement('option');
        o.value = f.id;
        o.textContent = t('fee_' + f.id);
        sel.appendChild(o);
      });
      sel.value = 'smart_np';
    } else {
      var cur = sel.value;
      Array.prototype.forEach.call(sel.options, function (o) { o.textContent = t('fee_' + o.value); });
      sel.value = cur;
    }
    document.getElementById('fee-type-label').textContent = t('fee_type_label');
    document.getElementById('fee-late-label').textContent = t('fee_late_label');
    document.getElementById('fee-late-hint').textContent = t('fee_late_hint');
    document.getElementById('fee-total-label').textContent = t('fee_total_label');
    document.getElementById('fee-note-label').textContent = t('fee_note_label');
    document.getElementById('fee-verify').textContent = t('fee_verify');
    document.getElementById('chart-title').textContent = t('chart_title');
    document.getElementById('chart-hint').textContent = t('chart_hint');
    document.getElementById('th-type').textContent = t('chart_col_type');
    document.getElementById('th-fee').textContent = t('chart_col_fee');
    document.getElementById('th-note').textContent = t('chart_col_note');
    updateFee();
    renderChart();
  }

  function updateFee() {
    var sel = document.getElementById('fee-type');
    var row = D.feeById(sel.value);
    var lateWrap = document.getElementById('late-wrap');
    var lateInput = document.getElementById('late-years');
    lateWrap.hidden = !row.late;
    var total = D.getFee(sel.value, lateInput.value);
    document.getElementById('fee-amount').textContent = fmt(total);
    var note = t('fee_' + sel.value + '_n');
    if (row.late && parseInt(lateInput.value, 10) > 0) {
      note += ' ' + t('fee_late_hint');
    }
    document.getElementById('fee-note').textContent = note;
  }

  function renderChart() {
    var body = document.getElementById('chart-body');
    body.innerHTML = '';
    D.FEES.forEach(function (f) {
      var tr = document.createElement('tr');
      tr.dataset.fee = f.id;
      tr.tabIndex = 0;
      var td1 = el('td', null, t('fee_' + f.id));
      var td2 = el('td', 'num', fmt(f.base));
      var td3 = el('td', null, t('fee_' + f.id + '_n'));
      tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
      tr.addEventListener('click', function () {
        document.getElementById('fee-type').value = f.id;
        switchTab('fees');
        updateFee();
      });
      body.appendChild(tr);
    });
  }

  // ---------- steps ----------
  function renderSteps() {
    document.getElementById('steps-title').textContent = t('steps_title');
    var list = document.getElementById('steps-list');
    list.innerHTML = '';
    D.STEPS.forEach(function (n) {
      var li = el('li', 'step');
      li.appendChild(el('div', 'step-num', num(n)));
      var body = el('div', 'step-body');
      body.appendChild(el('h3', null, t('step' + n + 't')));
      body.appendChild(el('p', null, t('step' + n + 'd')));
      body.appendChild(el('p', 'step-meta', t('docs_label') + ': ' + t('step' + n + 'docs')));
      body.appendChild(el('p', 'step-meta warn', t('mistake_label') + ': ' + t('step' + n + 'm')));
      li.appendChild(body);
      list.appendChild(li);
    });
    var notes = document.getElementById('notes-list');
    notes.innerHTML = '';
    notes.appendChild(el('h3', null, t('note_good')));
    ['note_mobile', 'note_drink', 'note_belt'].forEach(function (k) {
      notes.appendChild(el('li', null, t(k)));
    });
  }

  // ---------- categories ----------
  function renderCats() {
    document.getElementById('cats-title').textContent = t('cats_title');
    var wrap = document.getElementById('cats-list');
    wrap.innerHTML = '';
    D.CATEGORIES.forEach(function (c) {
      var card = el('article', 'cat-card');
      card.appendChild(el('h3', null, t('cat_' + c + '_t')));
      card.appendChild(el('p', null, t('cat_' + c + '_d')));
      var dl = el('dl');
      var pre = { nonprof: 'np', prof: 'p', learner: 'l', idp: 'i' }[c];
      [['cat_age', 'cat_' + pre + '_age'], ['cat_valid', 'cat_' + pre + '_valid'], ['cat_req', 'cat_' + pre + '_req']]
        .forEach(function (pair) {
          dl.appendChild(el('dt', null, t(pair[0])));
          dl.appendChild(el('dd', null, t(pair[1])));
        });
      card.appendChild(dl);
      wrap.appendChild(card);
    });
  }

  // ---------- checklists ----------
  function renderCheck() {
    document.getElementById('check-title').textContent = t('check_title');
    document.getElementById('check-type-label').textContent = t('check_type_label');
    var seg = document.getElementById('check-types');
    seg.innerHTML = '';
    D.CHECKLIST_TYPES.forEach(function (ty) {
      var b = el('button', 'seg-btn' + (ui.checkType === ty ? ' active' : ''), t('check_' + ty));
      b.dataset.value = ty;
      b.type = 'button';
      b.addEventListener('click', function () { ui.checkType = ty; renderCheck(); });
      seg.appendChild(b);
    });
    var list = document.getElementById('checklist-list');
    list.innerHTML = '';
    var done = state.checklist[ui.checkType] || [];
    D.CHECKLISTS[ui.checkType].forEach(function (item) {
      var label = el('label', 'check-item');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = done.indexOf(item) !== -1;
      cb.addEventListener('change', function () {
        var arr = state.checklist[ui.checkType];
        var i = arr.indexOf(item);
        if (cb.checked && i === -1) arr.push(item);
        if (!cb.checked && i !== -1) arr.splice(i, 1);
        save();
        renderCheck();
      });
      label.appendChild(cb);
      label.appendChild(el('span', null, t('item_' + item)));
      list.appendChild(label);
    });
    var p = D.checklistProgress(done, ui.checkType);
    document.getElementById('check-progress').textContent =
      t('check_progress') + ': ' + num(p.done) + '/' + num(p.total) + ' ' + t('check_done') + ' (' + num(p.pct) + '%)';
    var o = D.overallProgress(state.checklist);
    document.getElementById('check-overall').textContent =
      t('check_overall') + ': ' + num(o.done) + '/' + num(o.total) + ' (' + num(o.pct) + '%)';
    document.getElementById('overall-bar').style.width = o.pct + '%';
  }

  // ---------- tracker ----------
  function renderTrack() {
    document.getElementById('track-title').textContent = t('track_title');
    document.getElementById('lbl-label').textContent = t('track_label');
    document.getElementById('lbl-type').textContent = t('track_type');
    document.getElementById('lbl-issue').textContent = t('track_issue');
    document.getElementById('lbl-expiry').textContent = t('track_expiry');
    document.getElementById('add-licence').textContent = t('track_add');
    var typeSel = document.getElementById('l-type');
    if (typeSel.options.length === 0) {
      D.LICENCE_TYPES.forEach(function (ty) {
        var o = document.createElement('option');
        o.value = ty;
        o.textContent = t('track_type_' + ty);
        typeSel.appendChild(o);
      });
    } else {
      Array.prototype.forEach.call(typeSel.options, function (o) { o.textContent = t('track_type_' + o.value); });
    }
    var list = document.getElementById('licence-list');
    list.innerHTML = '';
    var empty = document.getElementById('tracker-empty');
    empty.hidden = state.licences.length > 0;
    empty.textContent = t('track_empty');
    D.sortLicences(state.licences).forEach(function (lic) {
      var days = D.daysUntil(lic.expiry, TODAY);
      var status = D.expiryStatus(days);
      var card = el('article', 'lic-card');
      var head = el('div', 'lic-head');
      head.appendChild(el('strong', null, lic.label));
      var badgeMap = { ok: 'badge_valid', renew: 'badge_renew', expired: 'badge_expired' };
      var badge = el('span', 'badge badge-' + status, t(badgeMap[status]));
      head.appendChild(badge);
      card.appendChild(head);
      var meta = el('p', 'lic-meta',
        t('track_type_' + lic.type) + ' - ' + lic.issue + ' to ' + lic.expiry);
      card.appendChild(meta);
      var daysText = days < 0
        ? t('badge_expired') + ' ' + num(-days) + ' ' + t('track_days_ago')
        : num(days) + ' ' + t('track_days_left');
      card.appendChild(el('p', 'lic-days', daysText));
      var del = el('button', 'btn-danger', t('track_delete'));
      del.type = 'button';
      del.addEventListener('click', function () {
        state.licences = state.licences.filter(function (x) { return x.id !== lic.id; });
        save();
        renderTrack();
      });
      card.appendChild(del);
      list.appendChild(card);
    });
  }

  function submitLicence(e) {
    e.preventDefault();
    var label = document.getElementById('l-label').value;
    var type = document.getElementById('l-type').value;
    var issue = document.getElementById('l-issue').value;
    var expiry = document.getElementById('l-expiry').value;
    var errs = D.validateLicence(label, type, issue, expiry);
    var map = { label: 'err-label', 'label-long': 'err-label', type: 'err-type', issue: 'err-issue', expiry: 'err-expiry', order: 'err-order' };
    ['err-label', 'err-type', 'err-issue', 'err-expiry', 'err-order'].forEach(function (id) {
      document.getElementById(id).hidden = true;
    });
    if (errs.length > 0) {
      errs.forEach(function (code) {
        var id = map[code];
        var node = document.getElementById(id);
        node.textContent = t('err_' + code.replace('-', '_'));
        node.hidden = false;
      });
      return;
    }
    state.licences.push({
      id: 'lic-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      label: label.trim(), type: type, issue: issue, expiry: expiry
    });
    save();
    document.getElementById('l-label').value = '';
    document.getElementById('l-issue').value = '';
    document.getElementById('l-expiry').value = '';
    renderTrack();
  }

  // ---------- quiz ----------
  function renderQuiz() {
    document.getElementById('quiz-title').textContent = t('quiz_title');
    document.getElementById('quiz-intro').textContent = t('quiz_intro');
    var best = document.getElementById('quiz-best');
    best.textContent = t('quiz_best') + ': ' +
      (state.quizBest === null ? t('quiz_best_none') : num(state.quizBest) + '/' + num(D.QUIZ.length));
    var area = document.getElementById('quiz-area');
    area.innerHTML = '';
    var q = ui.quiz;
    if (q.idx === -1) {
      var start = el('button', 'btn-primary', t('quiz_start'));
      start.type = 'button';
      start.addEventListener('click', function () {
        ui.quiz = { idx: 0, answers: [], picked: null };
        renderQuiz();
      });
      area.appendChild(start);
      return;
    }
    if (q.idx >= D.QUIZ.length) {
      var res = D.quizScore(q.answers);
      if (state.quizBest === null || res.score > state.quizBest) {
        state.quizBest = res.score;
        save();
      }
      document.getElementById('quiz-best').textContent = t('quiz_best') + ': ' +
        num(state.quizBest) + '/' + num(D.QUIZ.length);
      area.appendChild(el('p', 'quiz-result', t('quiz_score') + ': ' + num(res.score) + '/' + num(res.total)));
      area.appendChild(el('p', null, t('quiz_best') + ': ' + num(state.quizBest) + '/' + num(res.total)));
      var again = el('button', 'btn-primary', t('quiz_restart'));
      again.type = 'button';
      again.addEventListener('click', function () {
        ui.quiz = { idx: -1, answers: [], picked: null };
        renderQuiz();
      });
      area.appendChild(again);
      return;
    }
    var item = D.QUIZ[q.idx];
    area.appendChild(el('p', 'quiz-progress',
      t('quiz_progress') + ' ' + num(q.idx + 1) + ' ' + t('quiz_of') + ' ' + num(D.QUIZ.length)));
    area.appendChild(el('h3', null, t(item.id)));
    var opts = el('div', 'quiz-opts');
    for (var oi = 0; oi < 4; oi++) {
      (function (oi) {
        var b = el('button', 'quiz-opt', t(item.id + 'o' + (oi + 1)));
        b.type = 'button';
        if (q.picked !== null) {
          b.disabled = true;
          if (oi === item.correct) b.classList.add('correct');
          else if (oi === q.picked) b.classList.add('wrong');
        }
        b.addEventListener('click', function () {
          q.picked = oi;
          q.answers[q.idx] = oi;
          renderQuiz();
        });
        opts.appendChild(b);
      })(oi);
    }
    area.appendChild(opts);
    if (q.picked !== null) {
      var fb = el('p', 'quiz-feedback ' + (q.picked === item.correct ? 'good' : 'bad'),
        (q.picked === item.correct ? t('quiz_correct') : t('quiz_wrong')) + ' ' + t('quiz_explain') + ' ' + t(item.id + 'ex'));
      area.appendChild(fb);
      var next = el('button', 'btn-primary',
        q.idx === D.QUIZ.length - 1 ? t('quiz_finish') : t('quiz_next'));
      next.type = 'button';
      next.addEventListener('click', function () {
        q.idx++;
        q.picked = null;
        renderQuiz();
      });
      area.appendChild(next);
    }
  }

  // ---------- data ----------
  function renderData() {
    document.getElementById('data-title').textContent = t('data_title');
    document.getElementById('data-export').textContent = t('data_export');
    document.getElementById('data-export-note').textContent = t('data_export_note');
    document.getElementById('data-import').textContent = t('data_import');
    document.getElementById('data-import-label').textContent = t('data_import_label');
    document.getElementById('import-btn').textContent = t('data_import_btn');
    document.getElementById('data-erase').textContent = t('data_erase');
    document.getElementById('data-erase-hint').textContent = t('data_erase_hint');
    document.getElementById('erase-input').placeholder = t('data_erase_ph');
    document.getElementById('erase-btn').textContent = t('data_erase_btn');
  }

  function exportData() {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'driving-license-bd-data.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    var msg = document.getElementById('data-msg');
    msg.textContent = t('data_export_done');
    msg.hidden = false;
  }

  function importData(file) {
    var msg = document.getElementById('data-msg');
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (D.validateImport(data) !== null) throw new Error('bad import');
        var d = D.defaultState();
        d.lang = data.lang || 'en';
        d.checklist = data.checklist || d.checklist;
        d.licences = data.licences || [];
        d.quizBest = (typeof data.quizBest === 'number') ? data.quizBest : null;
        state = d;
        save();
        msg.textContent = t('data_import_ok');
        msg.hidden = false;
        renderAll();
      } catch (e) {
        msg.textContent = t('data_import_bad');
        msg.hidden = false;
      }
    };
    reader.readAsText(file);
  }

  function eraseAll() {
    var msg = document.getElementById('data-msg');
    var input = document.getElementById('erase-input');
    if (input.value !== 'DELETE') return;
    var lang = state.lang;
    state = D.defaultState();
    state.lang = lang;
    save();
    input.value = '';
    msg.textContent = t('data_erased');
    msg.hidden = false;
    ui.quiz = { idx: -1, answers: [], picked: null };
    renderAll();
  }

  // ---------- tabs ----------
  function switchTab(name) {
    ui.tab = name;
    renderChrome();
    if (name === 'fees') renderFees();
    if (name === 'steps') renderSteps();
    if (name === 'cats') renderCats();
    if (name === 'check') renderCheck();
    if (name === 'track') renderTrack();
    if (name === 'quiz') renderQuiz();
    if (name === 'data') renderData();
  }

  function renderAll() {
    renderChrome();
    renderFees();
    renderSteps();
    renderCats();
    renderCheck();
    renderTrack();
    renderQuiz();
    renderData();
  }

  // ---------- wire up ----------
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { switchTab(b.dataset.tab); });
  });
  document.getElementById('lang-toggle').addEventListener('click', function () {
    state.lang = state.lang === 'en' ? 'bn' : 'en';
    save();
    renderAll();
  });
  document.getElementById('fee-type').addEventListener('change', updateFee);
  document.getElementById('late-years').addEventListener('input', updateFee);
  document.getElementById('add-licence-form').addEventListener('submit', submitLicence);
  document.getElementById('export-btn').addEventListener('click', exportData);
  document.getElementById('import-btn').addEventListener('click', function () {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', function (e) {
    if (e.target.files.length > 0) importData(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('erase-btn').addEventListener('click', eraseAll);

  renderAll();
})();
