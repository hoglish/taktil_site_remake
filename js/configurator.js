/* ==========================================================================
   Тактиль — configurator.js
   Конфигуратор: живая SVG-клавиатура, расчёт цены, звук переключателей,
   ссылка на сборку (#b=...), сохранение сборок, случайная сборка, корзина.
   ========================================================================== */
(function () {
  'use strict';
  const T = window.Tact;
  T.ready(() => {
    const { $, $$, esc, fmt, Store, D, Sound, toast, confetti, Cart } = T;
    const CFG = D.CFG;
    if (!$('#cfgBoard')) return;
    const SW_COLORS = { linear: '#E63946', tactile: '#C9803A', clicky: '#3A86FF', silent: '#BDB6A2' };
    const DEF = { layout: '65', case: 'graphite', theme: 'classic', sw: 'tactile', alu: false, extras: [] };
    let s = Object.assign({}, DEF, { extras: [] });
    const find = (arr, id) => arr.find((x) => x.id === id) || arr[0];

    /* ---------- ссылка на сборку ---------- */
    const toHash = (c) => `b=${c.layout}.${c.case}.${c.theme}.${c.sw}.${c.alu ? 1 : 0}.${c.extras.join('-')}`;
    function fromHash(h) {
      const m = /b=([^#&]+)/.exec(h || '');
      if (!m) return null;
      const p = m[1].split('.');
      if (p.length < 5) return null;
      const c = { layout: p[0], case: p[1], theme: p[2], sw: p[3], alu: p[4] === '1', extras: (p[5] || '').split('-').filter(Boolean) };
      if (!CFG.layouts.some((x) => x.id === c.layout) || !CFG.cases.some((x) => x.id === c.case) || !CFG.themes.some((x) => x.id === c.theme) || !CFG.switches.some((x) => x.id === c.sw)) return null;
      c.extras = c.extras.filter((id) => CFG.extras.some((x) => x.id === id));
      return c;
    }

    /* ---------- цена и описание ---------- */
    function calc(c) {
      const lay = find(CFG.layouts, c.layout), cs = find(CFG.cases, c.case), th = find(CFG.themes, c.theme), sw = find(CFG.switches, c.sw);
      const packs = Math.ceil(lay.keys / 70);
      const lines = [[`Клавиатура ${lay.name}: плата, плейт, корпус`, lay.price]];
      if (c.alu) lines.push(['Алюминиевый корпус', CFG.aluminum]);
      if (cs.price) lines.push([`Цвет корпуса «${cs.name}»`, cs.price]);
      lines.push([`Кейкапы «${th.name}»`, th.price]);
      lines.push([`Переключатели «${sw.name}» × ${packs}`, sw.price * packs]);
      c.extras.forEach((id) => { const e = find(CFG.extras, id); lines.push([e.name, e.price]); });
      const total = lines.reduce((a, l) => a + l[1], 0);
      const days = 3 + (c.extras.includes('lube') ? 1 : 0) + (c.extras.includes('foam') ? 1 : 0) + (c.alu ? 1 : 0);
      return { lines, total, name: `${lay.name} · ${cs.name} · ${th.name}`, days, lay, sw, th, cs };
    }
    function etaDate(days) {
      const d = new Date();
      let n = days;
      while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n--; }
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    }

    /* ---------- клавиатура ---------- */
    let typed = '';
    const typedEl = $('#cfgTyped');
    const showTyped = () => { typedEl.textContent = typed || 'Нажимайте клавиши — это звучит выбранный переключатель'; };
    const kb = new T.Keyboard($('#cfgBoard'), {
      layout: s.layout, caseId: s.case, theme: s.theme, interactive: true,
      onPress: (code) => Sound.press(s.sw, T.Keyboard.pitch(code)),
      onRelease: (code) => Sound.release(s.sw, T.Keyboard.pitch(code)),
      onPointerKey: (code) => { if (code === 'Backspace') typed = typed.slice(0, -1); else { const ch = kb.charFor(code); if (ch) typed = (typed + ch).slice(-44); } showTyped(); }
    });
    kb.listenWindow({
      prevent: (e) => (e.code === 'Space' || e.code.indexOf('Arrow') === 0 || e.code === 'Slash' || e.code === 'Quote') && ($('#cfgBoard').matches(':hover') || document.activeElement === $('#cfgBoard')),
      onKeyDown: (e) => { if (e.key === 'Backspace') typed = typed.slice(0, -1); else if (e.key.length === 1) typed = (typed + e.key).slice(-44); showTyped(); }
    });

    /* ---------- панели выбора ---------- */
    const box = $('#cfgOptions');
    const groups = [
      { k: 'layout', t: 'Раскладка', h: 'размер', items: CFG.layouts.map((l) => ({ id: l.id, name: l.name, sub: l.keys + ' клавиш', price: 'от ' + fmt(l.price) })) },
      { k: 'alu', t: 'Материал корпуса', h: 'вес и звук', items: [{ id: 'plastic', name: 'Пластик', sub: 'лёгкий', price: 'включено' }, { id: 'alu', name: 'Алюминий', sub: 'тяжёлый, глубокий звук', price: '+ ' + fmt(CFG.aluminum) }] },
      { k: 'case', t: 'Цвет корпуса', h: '6 цветов', items: CFG.cases.map((c) => ({ id: c.id, name: c.name, price: c.price ? '+ ' + fmt(c.price) : 'включено', swatch: D.CASES[c.id] })) },
      { k: 'theme', t: 'Кейкапы', h: '8 тем', items: CFG.themes.map((t) => ({ id: t.id, name: t.name, price: fmt(t.price), theme: D.THEMES[t.id] })) },
      { k: 'sw', t: 'Переключатели', h: 'звук и ощущения', items: CFG.switches.map((w) => ({ id: w.id, name: w.name, sub: w.hint, price: fmt(w.price) + ' / 70 шт.', color: SW_COLORS[w.id] })) }
    ];
    function buildOptions() {
      box.innerHTML = '';
      groups.forEach((g) => {
        const sec = document.createElement('section'); sec.className = 'opt-group';
        sec.innerHTML = `<h2 class="opt-group__title">${g.t}<small>${g.h}</small></h2><div class="opt-grid" role="radiogroup" aria-label="${g.t}">${g.items.map((it) => `
          <button class="opt" type="button" role="radio" aria-checked="false" data-g="${g.k}" data-v="${it.id}" data-silent>
            ${it.swatch ? `<span class="opt__swatch" style="background:${it.swatch}"></span>` : ''}
            ${it.theme ? `<span class="opt__swatch opt__swatch--theme"><i style="background:${it.theme.alpha}"></i><i style="background:${it.theme.mod}"></i><i style="background:${it.theme.accent}"></i></span>` : ''}
            ${it.color ? `<span class="opt__swatch opt__swatch--switch" style="--sc:${it.color}"></span>` : ''}
            <span class="opt__name">${esc(it.name)}</span>${it.sub ? `<span class="opt__price">${esc(it.sub)}</span>` : ''}<span class="opt__price">${esc(it.price)}</span></button>`).join('')}</div>`;
        box.append(sec);
      });
      const ex = document.createElement('section'); ex.className = 'opt-group';
      ex.innerHTML = `<h2 class="opt-group__title">Дополнительно<small>по желанию</small></h2><div class="opt-grid opt-grid--list">${CFG.extras.map((e) => `
        <button class="opt opt--toggle" type="button" role="checkbox" aria-checked="false" data-x="${e.id}" data-silent><span class="opt__check">${T.ic('check')}</span><span class="opt__name">${esc(e.name)}</span><span class="opt__price">+ ${fmt(e.price)}</span></button>`).join('')}</div>`;
      box.append(ex);
    }
    function paintOptions() {
      $$('.opt[data-g]', box).forEach((b) => {
        const g = b.dataset.g, v = b.dataset.v;
        const cur = g === 'alu' ? (s.alu ? 'alu' : 'plastic') : s[g];
        b.setAttribute('aria-checked', cur === v ? 'true' : 'false');
      });
      $$('.opt[data-x]', box).forEach((b) => b.setAttribute('aria-checked', s.extras.includes(b.dataset.x) ? 'true' : 'false'));
    }

    /* ---------- применение состояния ---------- */
    let lastTotal = 0;
    function apply(opts = {}) {
      const c = calc(s);
      if (kb.layout !== s.layout) { kb.setLayout(s.layout); if (!opts.silent) kb.wave(8); }
      kb.setCase(s.case); kb.setTheme(s.theme); kb.setGlow(s.extras.includes('rgb'));
      paintOptions();
      $('#cfgName').textContent = c.name;
      $('#cfgLines').innerHTML = c.lines.map((l) => `<li class="cfg__line"><span>${esc(l[0])}</span><span>${fmt(l[1])}</span></li>`).join('');
      const tot = $('#cfgTotal'); tot.textContent = fmt(c.total);
      if (c.total !== lastTotal && !T.reduceMotion) { tot.classList.remove('is-tick'); void tot.offsetWidth; tot.classList.add('is-tick'); }
      lastTotal = c.total;
      $('#cfgEta').textContent = `Соберём и проверим за ${c.days} ${T.plural(c.days, ['рабочий день', 'рабочих дня', 'рабочих дней'])}. Отправим до ${etaDate(c.days)}.`;
      try { history.replaceState(null, '', '#' + toHash(s)); } catch (_) { /* file:// */ }
    }
    box.addEventListener('click', (e) => {
      const o = e.target.closest('.opt'); if (!o) return;
      if (o.dataset.x) {
        const id = o.dataset.x, i = s.extras.indexOf(id);
        if (i > -1) s.extras.splice(i, 1); else s.extras.push(id);
        Sound.ui('tap');
      } else {
        const g = o.dataset.g, v = o.dataset.v;
        if (g === 'alu') s.alu = v === 'alu'; else s[g] = v;
        if (g === 'sw') { Sound.press(s.sw, 1, true); setTimeout(() => Sound.release(s.sw, 1, true), 90); } else Sound.ui('tap');
      }
      apply();
    });

    /* ---------- действия ---------- */
    $('#cfgAdd').addEventListener('click', (e) => {
      const c = calc(s), id = 'build-' + toHash(s).replace(/[^a-z0-9]/gi, '');
      Cart.addBuild({ id, title: 'Своя сборка ' + c.name, price: c.total, meta: `Переключатели «${c.sw.name}»${s.extras.length ? ' · +' + s.extras.length + ' опц.' : ''}`, cfg: Object.assign({}, s) });
      T.flyTo($('#cfgBoard'), $('.icon-btn--cart'), 'images/icon.svg');
      Sound.ui('add'); confetti(50);
      toast('Сборка добавлена в корзину', { icon: 'cart', action: 'Открыть', onAction: () => T.openDrawer('cart') });
    });
    $('#cfgShare').addEventListener('click', async () => {
      const url = location.href.split('#')[0] + '#' + toHash(s);
      try { if (navigator.share && matchMedia('(pointer: coarse)').matches) { await navigator.share({ title: 'Моя сборка в Тактиль', url }); return; } } catch (_) { return; }
      try { await navigator.clipboard.writeText(url); toast('Ссылка на сборку скопирована', { icon: 'copy' }); }
      catch (_) { window.prompt('Скопируйте ссылку:', url); }
    });
    function saved() { return Store.get('builds', []); }
    function renderSaved() {
      const list = saved();
      $('#cfgSavedWrap').hidden = !list.length;
      $('#cfgSaved').innerHTML = list.map((b) => `<li><div><strong>${esc(b.name)}</strong><small>${fmt(b.price)} · ${new Date(b.ts).toLocaleDateString('ru-RU')}</small></div><div class="saved-list__actions"><button class="chip-btn" type="button" data-load="${b.id}">Открыть</button><button class="icon-btn" type="button" data-del="${b.id}" aria-label="Удалить сборку">${T.ic('trash')}</button></div></li>`).join('');
    }
    $('#cfgSave').addEventListener('click', () => {
      const c = calc(s), list = saved();
      list.push({ id: 'b' + Date.now(), name: c.name, price: c.total, cfg: Object.assign({}, s), ts: Date.now() });
      Store.set('builds', list.slice(-8)); renderSaved(); Sound.ui('add'); toast('Сборка сохранена', { icon: 'save' });
    });
    $('#cfgSaved').addEventListener('click', (e) => {
      const l = e.target.closest('[data-load]'), d = e.target.closest('[data-del]');
      if (l) { const b = saved().find((x) => x.id === l.dataset.load); if (b) { s = Object.assign({}, DEF, b.cfg, { extras: (b.cfg.extras || []).slice() }); apply(); window.scrollTo({ top: 0, behavior: T.reduceMotion ? 'auto' : 'smooth' }); } }
      if (d) { Store.set('builds', saved().filter((x) => x.id !== d.dataset.del)); renderSaved(); }
    });
    $('#cfgRandom').addEventListener('click', (e) => {
      const b = e.currentTarget, pick = (a) => a[Math.floor(Math.random() * a.length)];
      b.classList.remove('dice-roll'); void b.offsetWidth; b.classList.add('dice-roll');
      s = { layout: pick(CFG.layouts).id, case: pick(CFG.cases).id, theme: pick(CFG.themes).id, sw: pick(CFG.switches).id, alu: Math.random() > 0.6, extras: CFG.extras.filter(() => Math.random() > 0.65).map((x) => x.id) };
      Sound.ui('add'); apply(); kb.wave(6);
    });
    $('#cfgReset').addEventListener('click', () => { s = Object.assign({}, DEF, { extras: [] }); typed = ''; showTyped(); apply(); });

    const fromUrl = fromHash(location.hash);
    if (fromUrl) { s = Object.assign({}, DEF, fromUrl); toast('Открыта сборка по ссылке', { icon: 'share' }); }
    window.addEventListener('hashchange', () => { const c = fromHash(location.hash); if (c && toHash(c) !== toHash(s)) { s = Object.assign({}, DEF, c); apply(); } });
    buildOptions(); renderSaved(); kb.setLayout(s.layout); apply({ silent: true });
    setTimeout(() => kb.wave(10), 300);
  });
})();
