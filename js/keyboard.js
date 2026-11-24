/* ==========================================================================
   Тактиль — keyboard.js
   Интерактивная SVG-клавиатура: раскладки 60/65/75%, цветовые темы кейкапов,
   подсветка нажатий, тепловая карта, звук через Tact.Sound.
   ========================================================================== */
(function () {
  'use strict';
  const T = window.Tact;
  const D = T.D;
  const NS = 'http://www.w3.org/2000/svg';
  const U = 60, GAP = 4, PAD = 26;
  const RU = { KeyQ: 'й', KeyW: 'ц', KeyE: 'у', KeyR: 'к', KeyT: 'е', KeyY: 'н', KeyU: 'г', KeyI: 'ш', KeyO: 'щ', KeyP: 'з', BracketLeft: 'х', BracketRight: 'ъ',
    KeyA: 'ф', KeyS: 'ы', KeyD: 'в', KeyF: 'а', KeyG: 'п', KeyH: 'р', KeyJ: 'о', KeyK: 'л', KeyL: 'д', Semicolon: 'ж', Quote: 'э',
    KeyZ: 'я', KeyX: 'ч', KeyC: 'с', KeyV: 'м', KeyB: 'и', KeyN: 'т', KeyM: 'ь', Comma: 'б', Period: 'ю' };
  const MOD = new Set(D.MOD_CODES), ACC = new Set(D.ACCENT_CODES);
  const CHAR = { Space: ' ', Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", Backquote: '`', BracketLeft: '[', BracketRight: ']', Backslash: '\\' };

  /* Компактная раскладка для телефонов: 10 крупных клавиш в ряду (≈ 36 px на экране 375 px) */
  function mobileRows() {
    const k = (c, l, w) => [c, l, w || 1];
    const row = (s) => s.split('').map((ch) => k('Key' + ch, ch));
    return [
      '1234567890'.split('').map((d) => k('Digit' + d, d)),
      row('QWERTYUIOP'),
      row('ASDFGHJKL').concat([k('Backspace', '⌫')]),
      row('ZXCVBNM').concat([k('Comma', ','), k('Period', '.'), k('Enter', '↵')]),
      [k('Space', '', 10)]
    ];
  }

  function hex2rgb(h) { h = h.replace('#', ''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); }
  function rgb2hex(a) { return '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
  function shade(hex, f) { const c = hex2rgb(hex); return rgb2hex(f >= 0 ? c.map((v) => v + (255 - v) * f) : c.map((v) => v * (1 + f))); }
  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.append(e);
    return e;
  }
  /** Множитель высоты звука: длинные клавиши звучат ниже */
  function pitch(code) {
    if (code === 'Space') return 0.62;
    if (/^(Backspace|Enter|ShiftLeft|ShiftRight|Tab|CapsLock)$/.test(code)) return 0.8;
    return 0.95 + Math.random() * 0.1;
  }

  class Keyboard {
    constructor(host, o = {}) {
      this.host = host;
      this.o = Object.assign({ layout: '65', caseId: 'graphite', theme: 'classic', legends: true, ru: true, interactive: true, knob: false, glow: false }, o);
      this.layout = this.o.layout;
      this.keys = {};
      this.down = new Set();
      // o.mobile: на узких экранах рисуем крупную компактную клавиатуру
      this.mq = this.o.mobile && window.matchMedia ? window.matchMedia('(max-width: 640px)') : null;
      this.mobile = !!(this.mq && this.mq.matches);
      this.render();
      this.setTheme(this.o.theme);
      this.setCase(this.o.caseId);
      this.setGlow(this.o.glow);
      if (this.o.interactive) this.bindPointer();
      if (this.mq) {
        const on = (e) => { if (e.matches !== this.mobile) { this.mobile = e.matches; this.redraw(); } };
        if (this.mq.addEventListener) this.mq.addEventListener('change', on); else if (this.mq.addListener) this.mq.addListener(on);
      }
    }

    /** Перерисовать с сохранением темы, корпуса и подсветки */
    redraw() {
      const th = this.theme || this.themeObj, cs = this.caseId, glow = this.svg.classList.contains('has-glow');
      this.releaseAll();
      this.render();
      this.setTheme(th); this.setCase(cs); this.setGlow(glow);
      if (this.o.interactive && this._held) this.bindSvg();
    }

    render() {
      const rows = this.mobile ? mobileRows() : D.LAYOUTS[this.layout];
      const pad = this.mobile ? 12 : PAD, rh = this.mobile ? 80 : U;
      this.rh = rh;
      const wu = Math.max(...rows.map((r) => r.reduce((s, k) => s + k[2], 0)));
      const W = wu * U + pad * 2, H = rows.length * rh + pad * 2;
      this.W = W; this.H = H;
      this.host.textContent = '';
      const svg = el('svg', { class: 'kb' + (this.o.legends ? '' : ' kb--nolegend') + (this.mobile ? ' kb--mobile' : ''), viewBox: `0 0 ${W} ${H + 22}`, role: 'img', 'aria-label': this.mobile ? 'Экранная клавиатура' : `Клавиатура ${this.layout}%` });
      this.svg = svg;
      el('rect', { class: 'kb__shadow', x: 18, y: H - 12, width: W - 36, height: 26, rx: 13 }, svg);
      el('rect', { class: 'kb__glow', x: -8, y: 8, width: W + 16, height: H, rx: 36 }, svg);
      el('rect', { class: 'kb__case-base', x: 0, y: 0, width: W, height: H, rx: 30 }, svg);
      el('rect', { class: 'kb__case-top', x: 0, y: 0, width: W, height: H - 8, rx: 30 }, svg);
      el('rect', { class: 'kb__plate', x: 12, y: 12, width: W - 24, height: H - 32, rx: 20, opacity: 0.55 }, svg);
      this.keys = {};
      rows.forEach((row, r) => {
        let x = pad;
        row.forEach(([code, label, w]) => {
          if (code) this.addKey(svg, code, label, x, pad + r * rh, w * U);
          x += w * U;
        });
      });
      this.host.append(svg);
    }

    addKey(svg, code, label, px, py, pw) {
      const g = el('g', { class: 'kb__key' + (ACC.has(code) ? ' is-accent' : MOD.has(code) ? ' is-mod' : ''), 'data-code': code }, svg);
      const x = px + GAP / 2, y = py + GAP / 2, w = pw - GAP, h = this.rh - GAP;
      if (this.o.knob && code === 'Delete') {
        g.classList.add('is-mod');
        const cx = px + pw / 2, cy = py + U / 2;
        el('circle', { cx, cy: cy + 4, r: 26, fill: '#16181d' }, g);
        const cap = el('g', { class: 'kb__cap' }, g);
        el('circle', { class: 'kb__knob', cx, cy, r: 26 }, cap);
        el('circle', { cx, cy, r: 18, fill: '#555a66' }, cap);
        el('rect', { x: cx - 2, y: cy - 18, width: 4, height: 11, rx: 2, fill: 'var(--kb-accent)' }, cap);
        this.keys[code] = g;
        return;
      }
      el('rect', { class: 'kb__base', x, y, width: w, height: h, rx: 9 }, g);
      const cap = el('g', { class: 'kb__cap' }, g);
      el('rect', { class: 'kb__top', x: x + 4, y: y + 2, width: w - 8, height: h - 12, rx: 7 }, cap);
      el('rect', { class: 'kb__hl', x: x + 6, y: y + 3, width: w - 12, height: 2.5, rx: 1.2 }, cap);
      if (label) {
        const t = el('text', { class: 'kb__legend' + (label.length > 1 ? ' kb__legend--sm' : ''), x: x + w / 2, y: y + 2 + (h - 12) / 2 + (this.mobile ? (label.length > 1 ? 8 : 9.5) : (label.length > 1 ? 4.5 : 6)) }, cap);
        t.textContent = label.length === 1 ? label.toUpperCase() === label ? label : label : label;
      }
      if (this.o.ru && RU[code]) {
        const r = el('text', { class: 'kb__ru', x: x + w - (this.mobile ? 6 : 10), y: y + (this.mobile ? 21 : 17) }, cap);
        r.textContent = RU[code];
      }
      this.keys[code] = g;
    }

    /* ---------- цвета ---------- */
    setTheme(t) {
      const th = typeof t === 'string' ? D.THEMES[t] : t;
      if (!th) return;
      this.theme = typeof t === 'string' ? t : null;
      const s = this.svg.style;
      s.setProperty('--kb-alpha', th.alpha); s.setProperty('--kb-alpha-d', shade(th.alpha, -0.28)); s.setProperty('--kb-alpha-l', shade(th.alpha, 0.6));
      s.setProperty('--kb-mod', th.mod); s.setProperty('--kb-mod-d', shade(th.mod, -0.3)); s.setProperty('--kb-mod-l', shade(th.mod, 0.5));
      s.setProperty('--kb-accent', th.accent); s.setProperty('--kb-accent-d', shade(th.accent, -0.3)); s.setProperty('--kb-accent-l', shade(th.accent, 0.5));
      s.setProperty('--kb-legend', th.legend);
      s.setProperty('--kb-glow-c', th.accent);
      this.themeObj = th;
    }
    setCase(c) {
      const hex = D.CASES[c] || c;
      this.caseId = c;
      const s = this.svg.style;
      s.setProperty('--kb-case', hex); s.setProperty('--kb-case-d', shade(hex, -0.35)); s.setProperty('--kb-plate', shade(hex, -0.5));
    }
    setGlow(on) { this.svg.classList.toggle('has-glow', !!on); }
    setLayout(l) {
      if (l === this.layout) return;
      this.layout = l; this.redraw();
    }

    /* ---------- нажатия ---------- */
    press(code, silent) {
      const k = this.keys[code];
      if (!k || this.down.has(code)) return false;
      this.down.add(code); k.classList.add('is-down');
      if (!silent && this.o.onPress) this.o.onPress(code);
      return true;
    }
    release(code, silent) {
      const k = this.keys[code];
      if (!k || !this.down.has(code)) return false;
      this.down.delete(code); k.classList.remove('is-down');
      if (!silent && this.o.onRelease) this.o.onRelease(code);
      return true;
    }
    releaseAll() { Array.from(this.down).forEach((c) => this.release(c, true)); }
    charFor(code) {
      if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
      if (/^Digit\d$/.test(code)) return code.slice(5);
      return CHAR[code] != null ? CHAR[code] : null;
    }

    bindPointer() {
      const held = this._held = new Map();
      this.bindSvg();
      const up = (e) => { const c = held.get(e.pointerId); if (c) { held.delete(e.pointerId); this.release(c); } };
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    }
    /** Навешивает обработчик нажатий на текущий SVG (вызывается после каждой перерисовки) */
    bindSvg() {
      const find = (e) => { const g = e.target.closest && e.target.closest('.kb__key'); return g ? g.dataset.code : null; };
      this.svg.addEventListener('pointerdown', (e) => {
        const code = find(e);
        if (!code) return;
        e.preventDefault();
        if (this.o.onPointerKey) this.o.onPointerKey(code);
        if (this.press(code)) this._held.set(e.pointerId, code);
      });
    }

    /** Подписка на физические клавиши. opts: armed(), prevent(e), onKeyDown(e), onKeyUp(e) */
    listenWindow(opts = {}) {
      const skip = (e) => {
        const t = e.target;
        if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName) || (t && t.isContentEditable)) return true;
        if (e.ctrlKey || e.metaKey || e.altKey) return true;
        if (document.querySelector('dialog[open]')) return true;
        return opts.armed && !opts.armed();
      };
      const kd = (e) => {
        if (skip(e)) return;
        if (opts.prevent && opts.prevent(e)) e.preventDefault();
        if (!e.repeat) this.press(e.code);
        if (opts.onKeyDown) opts.onKeyDown(e);
      };
      const ku = (e) => { this.release(e.code); if (opts.onKeyUp && !skip(e)) opts.onKeyUp(e); };
      window.addEventListener('keydown', kd);
      window.addEventListener('keyup', ku);
      window.addEventListener('blur', () => this.releaseAll());
      this._unlisten = () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
    }

    /* ---------- визуальные состояния ---------- */
    setHeat(code, color) { const k = this.keys[code]; if (k) k.style.setProperty('--heat', color); }
    clearHeat() { Object.values(this.keys).forEach((k) => k.style.removeProperty('--heat')); }
    markTested(code) { const k = this.keys[code]; if (k) k.classList.add('is-tested'); }
    clearTested() { Object.values(this.keys).forEach((k) => k.classList.remove('is-tested')); }
    markNext(code) { Object.values(this.keys).forEach((k) => k.classList.remove('is-next')); const k = this.keys[code]; if (k) k.classList.add('is-next'); }
    /** Волна нажатий по всей клавиатуре (приветственная анимация) */
    wave(stepMs = 16) {
      if (T.reduceMotion) return;
      const codes = Object.keys(this.keys);
      codes.forEach((c, i) => setTimeout(() => { this.press(c, true); setTimeout(() => this.release(c, true), 130); }, i * stepMs));
    }
  }

  Keyboard.pitch = pitch;
  Keyboard.RU = RU;
  Keyboard.shade = shade;
  /** Код клавиши для символа (для подсказки следующей клавиши в тесте печати) */
  Keyboard.codeFor = function (ch) {
    if (ch === ' ') return 'Space';
    const lower = ch.toLowerCase();
    if (/[a-z]/.test(lower)) return 'Key' + lower.toUpperCase();
    if (/\d/.test(ch)) return 'Digit' + ch;
    for (const c in RU) if (RU[c] === lower) return c;
    for (const c in CHAR) if (CHAR[c] === ch) return c;
    return null;
  };
  T.Keyboard = Keyboard;
})();
