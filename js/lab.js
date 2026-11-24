/* ==========================================================================
   Тактиль — lab.js
   Лаборатория: звук переключателей и кривые усилия, тест скорости печати
   (с тепловой картой ошибок), тестер клавиш (rollover).
   ========================================================================== */
(function () {
  'use strict';
  const T = window.Tact;
  T.ready(() => {
    const { $, $$, esc, Store, D, Sound, toast, confetti, BY_ID } = T;
    if (!$('#switchCards')) return;

    /* ==================== Вкладки ==================== */
    const tabs = $$('.tabs__tab'), panels = { sound: $('#panel-sound'), typing: $('#panel-typing'), tester: $('#panel-tester') };
    let current = 'sound';
    function showTab(id, focus) {
      current = id;
      tabs.forEach((t) => { const on = t.dataset.tab === id; t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
      Object.keys(panels).forEach((k) => { panels[k].hidden = k !== id; });
      typing.active = false; $('#typeBox').classList.remove('is-active');
      try { history.replaceState(null, '', '#' + id); } catch (_) { /* file:// */ }
      if (id === 'sound') drawChart();
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => showTab(t.dataset.tab));
      t.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const n = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length; showTab(tabs[n].dataset.tab, true); }
      });
    });

    /* ==================== 1. Звук и усилие ==================== */
    const META = {
      linear: { name: 'Лён', type: 'Линейный', prod: 'len-linear', force: 45, travel: 4.0, loud: 4, tact: 1, color: '#E63946' },
      tactile: { name: 'Клён', type: 'Тактильный', prod: 'klen-tactile', force: 55, travel: 4.0, loud: 5, tact: 8, color: '#C9803A' },
      clicky: { name: 'Щелчок', type: 'Clicky', prod: 'shchelchok-clicky', force: 50, travel: 3.6, loud: 9, tact: 7, color: '#3A86FF' },
      silent: { name: 'Тишина', type: 'Бесшумный', prod: 'tishina-silent', force: 40, travel: 3.8, loud: 1, tact: 1, color: '#8E87B8' }
    };
    const cards = $('#switchCards');
    Object.keys(META).forEach((k) => {
      const m = META[k];
      const card = document.createElement('article');
      card.className = 'switch-card'; card.style.setProperty('--sc', m.color);
      const bar = (label, v, max, unit) => `<div class="spec-bar"><span>${label}</span><span class="spec-bar__track" title="${v}${unit}"><i style="--v:${Math.round(v / max * 100)}%"></i></span></div>`;
      card.innerHTML = `<button class="switch-card__pad" type="button" data-silent aria-label="Нажмите и удерживайте, чтобы послушать «${m.name}»"><span class="switch-card__stem"></span><span class="switch-card__hint">нажмите и держите</span></button>
        <h3 class="switch-card__name">${m.name}</h3><p class="switch-card__type">${m.type}</p>
        <div class="spec-bars">${bar('Усилие', m.force, 70, ' г')}${bar('Ход', m.travel, 4.5, ' мм')}${bar('Громкость', m.loud, 10, '/10')}${bar('Тактильность', m.tact, 10, '/10')}</div>`;
      const pad = $('.switch-card__pad', card);
      let down = false;
      const press = () => { if (down) return; down = true; pad.classList.add('is-down'); Sound.press(k, 1, true); };
      const rel = () => { if (!down) return; down = false; pad.classList.remove('is-down'); Sound.release(k, 1, true); };
      pad.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => pad.addEventListener(ev, rel));
      pad.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press(); } });
      pad.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') rel(); });
      cards.append(card);
    });
    const vol = $('#labVol');
    vol.addEventListener('input', () => { Sound.ensure(); Sound.setVol(vol.value / 100); });
    Sound.setVol(vol.value / 100);

    // График усилия
    const chosen = new Set(['linear', 'tactile']);
    const legend = $('#forceLegend');
    Object.keys(META).forEach((k) => {
      const m = META[k], l = document.createElement('label');
      l.style.setProperty('--c', m.color);
      l.innerHTML = `<input type="checkbox" value="${k}" ${chosen.has(k) ? 'checked' : ''}><i></i> ${m.name}`;
      $('input', l).addEventListener('change', (e) => { if (e.target.checked) chosen.add(k); else chosen.delete(k); drawChart(); });
      legend.append(l);
    });
    function curve(pts) {
      let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let i = 0; i < pts.length - 1; i++) {
        const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
        d += ` C${(p1[0] + (p2[0] - p0[0]) / 6).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) / 6).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) / 6).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) / 6).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
      }
      return d;
    }
    function drawChart() {
      const svg = $('#forceChart'), L = 52, R = 26, Tp = 22, B = 46, W = 640, H = 320;
      const X = (mm) => L + mm / 4 * (W - L - R), Y = (g) => H - B - g / 70 * (H - Tp - B);
      let h = '<g class="force__grid">';
      [0, 20, 40, 60].forEach((g) => { h += `<line x1="${L}" x2="${W - R}" y1="${Y(g)}" y2="${Y(g)}"></line>`; });
      h += '</g><g class="force__axis">';
      [0, 20, 40, 60].forEach((g) => { h += `<text x="${L - 10}" y="${Y(g) + 4}" text-anchor="end">${g} г</text>`; });
      [0, 1, 2, 3, 4].forEach((m) => { h += `<text x="${X(m)}" y="${H - B + 22}" text-anchor="middle">${m} мм</text>`; });
      h += `<text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle">Ход клавиши</text></g>`;
      h += `<line x1="${X(2)}" x2="${X(2)}" y1="${Tp}" y2="${H - B}" stroke="var(--line-2)" stroke-width="2" stroke-dasharray="6 6"></line><text x="${X(2) + 6}" y="${Tp + 10}" class="force__axis" font-size="11" fill="var(--muted)" style="font:600 11px var(--font-mono)">срабатывание</text>`;
      const marks = [];
      chosen.forEach((k) => {
        const f = BY_ID[META[k].prod].force, pts = f.map((g, i) => [X(i * 4 / 7), Y(g)]);
        const at = f[3] + (f[4] - f[3]) * ((2 - 3 * 4 / 7) / (4 / 7));
        h += `<path class="force__curve" d="${curve(pts)}" stroke="${META[k].color}"></path>`;
        h += `<circle class="force__dot" cx="${X(2)}" cy="${Y(at)}" r="7" fill="${META[k].color}"></circle>`;
        marks.push({ y: Y(at), g: at, c: META[k].color });
      });
      marks.sort((a, b) => a.y - b.y);
      marks.forEach((m, i) => { m.ly = i && m.y - marks[i - 1].ly < 18 ? marks[i - 1].ly + 18 : m.y; h += `<text class="force__label" x="${X(2) + 14}" y="${m.ly + 4}" fill="${m.c}">${Math.round(m.g)} г</text>`; });
      svg.innerHTML = h;
    }

    /* ==================== 2. Тест скорости печати ==================== */
    const TEXTS = {
      ru: ['Хорошая клавиатура делает печать приятной, а работу быстрее.', 'Линейные переключатели нажимаются плавно и без лишнего шума.', 'Тактильный бугорок подсказывает, что нажатие уже засчитано.', 'Тихий вечер, любимая музыка и мягкий звук клавиш за окном.',
        'Каждый кейкап отлит из плотного пластика и не блестит со временем.', 'Собери клавиатуру своей мечты и услышь, как она звучит.', 'Смазанные свитчи шуршат меньше и работают долго и ровно.', 'Короткий ход помогает печатать быстрее и не уставать к вечеру.',
        'Звук клавиатуры зависит от корпуса, пены, плейта и переключателей.', 'Хороший ритм печати приходит с практикой и внимательностью.'],
      en: ['A good keyboard makes typing feel great and work go faster.', 'Linear switches move smoothly and quietly from top to bottom.', 'A tactile bump tells your finger that the keypress has registered.', 'Quiet evening, favorite music and the soft sound of keys nearby.',
        'Every keycap is molded from thick plastic and never gets shiny.', 'Build the keyboard of your dreams and listen to how it sounds.', 'Lubed switches rustle less and keep working evenly for years.', 'A short travel helps you type faster and feel less tired at night.',
        'The sound depends on the case, foam, plate and the switches.', 'A steady typing rhythm comes with practice and attention.']
    };
    const typing = { lang: 'ru', time: 30, chars: [], i: 0, started: 0, correct: 0, errors: 0, running: false, done: false, perKey: {}, timer: null, active: false, mismatch: 0 };
    const box = $('#typeBox'), textEl = $('#typeText'), hint = $('#typeHint'), warn = $('#typeWarn'), res = $('#typeResult');
    const board = new T.Keyboard($('#typeBoard'), { layout: '75', caseId: 'graphite', theme: 'classic', interactive: false, ru: true,
      onPress: (c) => Sound.press('tactile', T.Keyboard.pitch(c)), onRelease: (c) => Sound.release('tactile', T.Keyboard.pitch(c)) });
    board.listenWindow({ armed: () => typing.active && current === 'typing' });
    const hist = () => Store.get('typing', { best: 0, history: [] });
    const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
    function makeText() {
      let out = '';
      while (out.length < 320) out += (out ? ' ' : '') + shuffle(TEXTS[typing.lang]).join(' ');
      return out.slice(0, 340).replace(/\s+\S*$/, '');
    }
    function renderText() {
      textEl.innerHTML = typing.chars.map((c, i) => `<span class="ch${i === 0 ? ' is-cur' : ''}" data-i="${i}">${c === ' ' ? ' ' : esc(c)}</span>`).join('');
      textEl.scrollTop = 0;
    }
    function restart(newText = true) {
      clearInterval(typing.timer);
      Object.assign(typing, { i: 0, started: 0, correct: 0, errors: 0, running: false, done: false, perKey: {}, mismatch: 0 });
      if (newText || !typing.chars.length) typing.chars = makeText().split('');
      renderText();
      $('#typeLeft').textContent = typing.time; $('#typeWpm').textContent = '0'; $('#typeAcc').textContent = '100%';
      res.hidden = true; warn.hidden = true; board.clearHeat(); board.markNext(T.Keyboard.codeFor(typing.chars[0]));
      const b = hist().best; $('#typeBest').textContent = b ? b + ' зн/мин' : '—';
      renderHistory();
    }
    function tick() {
      const el = (performance.now() - typing.started) / 1000, left = Math.max(0, typing.time - el);
      $('#typeLeft').textContent = Math.ceil(left);
      const cpm = el > 3 ? Math.round(typing.correct / (el / 60)) : 0;
      $('#typeWpm').textContent = cpm;
      const tot = typing.correct + typing.errors; $('#typeAcc').textContent = tot ? Math.round(typing.correct / tot * 100) + '%' : '100%';
      if (left <= 0) finish();
    }
    function rank(cpm) { return cpm < 100 ? 'Новичок' : cpm < 180 ? 'Уверенный пользователь' : cpm < 260 ? 'Быстрые пальцы' : cpm < 360 ? 'Мастер печати' : 'Легенда клавиатуры'; }
    function finish() {
      clearInterval(typing.timer); typing.running = false; typing.done = true; typing.active = false; box.classList.remove('is-active');
      const cpm = Math.round(typing.correct / (typing.time / 60)), tot = typing.correct + typing.errors, acc = tot ? Math.round(typing.correct / tot * 100) : 100;
      const h = hist(), isBest = cpm > h.best;
      h.history.push({ cpm, acc, ts: Date.now(), lang: typing.lang, time: typing.time }); h.history = h.history.slice(-10); if (isBest) h.best = cpm;
      Store.set('typing', h);
      $('#typeBest').textContent = h.best + ' зн/мин';
      res.hidden = false;
      res.innerHTML = `<p class="eyebrow">Результат</p><div class="typing__big">${cpm}</div><p>знаков в минуту · ≈ ${Math.round(cpm / 5)} слов/мин</p><p class="typing__rank">${rank(cpm)}${isBest && h.history.length > 1 ? ' · новый рекорд! 🏆' : ''}</p>
        <div class="typing__result-row"><span>Точность: ${acc}%</span><span>Верных: ${typing.correct}</span><span>Ошибок: ${typing.errors}</span></div>
        <div class="hero__actions" style="justify-content:center"><button class="button" type="button" id="typeAgain">${T.ic('reset')} Ещё раз</button><button class="button button--secondary" type="button" id="typeNew">Другой текст</button></div>`;
      $('#typeAgain').addEventListener('click', () => { restart(false); focusBox(); });
      $('#typeNew').addEventListener('click', () => { restart(true); focusBox(); });
      // тепловая карта ошибок
      const max = Math.max(1, ...Object.values(typing.perKey));
      Object.keys(typing.perKey).forEach((c) => { const t = typing.perKey[c] / max; board.setHeat(c, `color-mix(in srgb, #ff5a4d ${Math.round(35 + t * 65)}%, #ffe3df)`); });
      board.markNext('');
      renderHistory(); Sound.ui('success');
      if (isBest && h.history.length > 1) confetti(110);
      res.scrollIntoView({ behavior: T.reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
    }
    function renderHistory() {
      const h = hist().history, wrap = $('#typeHistory');
      wrap.hidden = h.length < 2; if (h.length < 2) return;
      const W = 400, Hh = 80, max = Math.max(...h.map((x) => x.cpm), 1), min = Math.min(...h.map((x) => x.cpm));
      const pts = h.map((x, i) => [10 + i * (W - 20) / (h.length - 1), Hh - 14 - (x.cpm - min) / Math.max(1, max - min) * (Hh - 34)]);
      $('#typeSpark').innerHTML = `<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` +
        pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="4.5" fill="var(--accent)"/><text x="${p[0]}" y="${p[1] - 9}" text-anchor="middle" style="font:700 10px var(--font-mono)" fill="var(--ink-2)">${h[i].cpm}</text>`).join('');
    }
    function focusBox() { box.focus(); typing.active = true; box.classList.add('is-active'); }
    box.addEventListener('click', focusBox);
    box.addEventListener('focus', () => { typing.active = true; box.classList.add('is-active'); });
    box.addEventListener('blur', () => { if (!typing.done) { typing.active = false; box.classList.remove('is-active'); } });
    $('#typeTime').addEventListener('click', (e) => { const b = e.target.closest('[data-time]'); if (!b) return; typing.time = +b.dataset.time; $$('#typeTime .seg__btn').forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); restart(false); });
    $('#typeLang').addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (!b) return; typing.lang = b.dataset.lang; $$('#typeLang .seg__btn').forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); restart(true); });
    window.addEventListener('keydown', (e) => {
      if (!typing.active || current !== 'typing' || typing.done || document.querySelector('dialog[open]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') { box.blur(); return; }
      if (e.key === 'Tab') { e.preventDefault(); restart(true); return; }
      const spans = textEl.children;
      if (e.key === 'Backspace') { e.preventDefault(); if (typing.i > 0) { spans[typing.i] && spans[typing.i].classList.remove('is-cur'); typing.i--; spans[typing.i].className = 'ch is-cur'; board.markNext(T.Keyboard.codeFor(typing.chars[typing.i])); } return; }
      if (e.key.length !== 1) return;
      e.preventDefault();
      if (!typing.running) { typing.running = true; typing.started = performance.now(); typing.timer = setInterval(tick, 100); hint.hidden = true; }
      const want = typing.chars[typing.i], span = spans[typing.i];
      if (e.key === want) { typing.correct++; span.className = 'ch is-ok'; typing.mismatch = 0; }
      else {
        typing.errors++; span.className = 'ch is-bad';
        const code = T.Keyboard.codeFor(want); if (code) typing.perKey[code] = (typing.perKey[code] || 0) + 1;
        const wantCyr = /[а-яё]/i.test(want), gotLat = /[a-z]/i.test(e.key), wantLat = /[a-z]/i.test(want), gotCyr = /[а-яё]/i.test(e.key);
        typing.mismatch = (wantCyr && gotLat) || (wantLat && gotCyr) ? typing.mismatch + 1 : 0;
        if (typing.mismatch >= 3) { warn.hidden = false; warn.textContent = wantCyr ? 'Похоже, включена английская раскладка. Переключите её на русскую или выберите «English».' : 'Похоже, включена русская раскладка. Переключите её на английскую или выберите «Русский».'; }
      }
      typing.i++;
      if (typing.i >= typing.chars.length) { typing.chars = typing.chars.concat((' ' + makeText()).split('')); textEl.insertAdjacentHTML('beforeend', typing.chars.slice(typing.i).map((c, k) => `<span class="ch" data-i="${typing.i + k}">${c === ' ' ? ' ' : esc(c)}</span>`).join('')); }
      const cur = spans[typing.i]; cur.classList.add('is-cur');
      const lh = parseFloat(getComputedStyle(textEl).lineHeight) || 40;
      if (cur.offsetTop - textEl.offsetTop > lh * 1.2) textEl.scrollTop = cur.offsetTop - textEl.offsetTop - lh * 1.2;
      board.markNext(T.Keyboard.codeFor(typing.chars[typing.i]));
    });

    /* ==================== 3. Тестер клавиш ==================== */
    const tb = new T.Keyboard($('#testBoard'), { layout: '75', caseId: 'navy', theme: 'ocean', interactive: false, ru: false,
      onPress: (c) => Sound.press('tactile', T.Keyboard.pitch(c)), onRelease: (c) => Sound.release('tactile', T.Keyboard.pitch(c)) });
    const tested = new Set(); let held = 0, maxHeld = 0;
    const total = Object.keys(tb.keys).length;
    const upd = () => { $('#testCount').textContent = tested.size + ' / ' + total; $('#testHeld').textContent = held; $('#testMax').textContent = maxHeld; };
    tb.listenWindow({
      armed: () => current === 'tester',
      prevent: () => true,
      onKeyDown: (e) => {
        if (!e.repeat) { held = tb.down.size; maxHeld = Math.max(maxHeld, held); }
        if (tb.keys[e.code]) { tested.add(e.code); tb.markTested(e.code); }
        $('#testLast').textContent = `${e.code} · «${e.key === ' ' ? 'пробел' : e.key}»`;
        upd();
      },
      onKeyUp: () => { held = tb.down.size; upd(); }
    });
    window.addEventListener('keyup', () => { held = tb.down.size; upd(); });
    $('#testReset').addEventListener('click', () => { tested.clear(); tb.clearTested(); held = 0; maxHeld = 0; $('#testLast').textContent = '—'; upd(); });
    upd();

    /* ==================== старт ==================== */
    restart(true);
    const start = (location.hash || '').slice(1);
    showTab(panels[start] ? start : 'sound');
  });
})();
