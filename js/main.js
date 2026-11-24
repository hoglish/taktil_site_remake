/* ==========================================================================
   Тактиль — main.js
   Чистый JavaScript (ES2020), без библиотек и фреймворков.
   Содержимое: хранилище, тема, звук, интерфейс, корзина, избранное, сравнение,
   быстрый просмотр, формы, командная палитра, подбор за минуту.
   ========================================================================== */
(function () {
  'use strict';

  const D = window.TACT || { PRODUCTS: [], TYPES: {}, PROMOS: {}, FREE_SHIP: 7000, SHIP_COST: 390, CFG: {}, REVIEWS: [], SERVICES: [] };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Math.round(n).toLocaleString('ru-RU').replace(/[\u202f\u00a0]/g, '\u00a0') + '\u00a0₽';
  const ic = (n, c = '') => `<svg class="icon ${c}" aria-hidden="true" focusable="false"><use href="#i-${n}"></use></svg>`;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const page = document.body.dataset.page;
  const BY_ID = {};
  D.PRODUCTS.forEach((p) => { BY_ID[p.id] = p; });
  const plural = (n, f) => { n = Math.abs(n) % 100; const m = n % 10; return n > 10 && n < 20 ? f[2] : m > 1 && m < 5 ? f[1] : m === 1 ? f[0] : f[2]; };

  /* ------------------------------------------------------------------
     Простая шина событий
     ------------------------------------------------------------------ */
  const bus = {};
  const on = (name, fn) => { (bus[name] = bus[name] || []).push(fn); };
  const emit = (name, data) => { (bus[name] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); };

  /* ------------------------------------------------------------------
     Хранилище: localStorage + запасной вариант для file:// (window.name)
     Чувствительные данные (заказы, отзывы) в window.name не попадают.
     ------------------------------------------------------------------ */
  const BAG_P = '__tactile__:';
  const BAG_KEYS = ['theme', 'sound', 'notice', 'fav', 'cart', 'compare', 'promo', 'recent'];
  const IS_FILE = location.protocol === 'file:';
  const mem = {};
  const bagRead = () => { try { const n = window.name || ''; if (n.indexOf(BAG_P) === 0) return JSON.parse(n.slice(BAG_P.length)) || {}; } catch (_) { /* пусто */ } return {}; };
  const bagWrite = (o) => { try { window.name = BAG_P + JSON.stringify(o); } catch (_) { /* пусто */ } };
  const lsGet = (k) => { try { const raw = localStorage.getItem('tactile:' + k); return raw === null ? undefined : JSON.parse(raw); } catch (_) { return undefined; } };
  const Store = {
    get(k, def) {
      const useBag = BAG_KEYS.indexOf(k) > -1;
      if (IS_FILE && useBag) { const b = bagRead(); if (k in b) return b[k]; }
      const v = lsGet(k);
      if (v !== undefined) return v;
      if (k in mem) return mem[k];
      if (useBag) { const b = bagRead(); if (k in b) return b[k]; }
      return def;
    },
    set(k, v) {
      mem[k] = v;
      let ok = false;
      try { localStorage.setItem('tactile:' + k, JSON.stringify(v)); ok = true; } catch (_) { /* приватный режим */ }
      if (BAG_KEYS.indexOf(k) > -1 && (IS_FILE || !ok)) { const b = bagRead(); b[k] = v; bagWrite(b); }
      emit('store:' + k, v);
      return ok;
    },
    clearAll() {
      try { Object.keys(localStorage).filter((k) => k.indexOf('tactile:') === 0).forEach((k) => localStorage.removeItem(k)); } catch (_) { /* пусто */ }
      Object.keys(mem).forEach((k) => delete mem[k]);
      try { window.name = ''; } catch (_) { /* пусто */ }
    }
  };
  window.addEventListener('storage', (e) => {
    if (!e.key || e.key.indexOf('tactile:') !== 0) return;
    const k = e.key.slice(8);
    try { mem[k] = JSON.parse(e.newValue); } catch (_) { delete mem[k]; }
    emit('store:' + k, Store.get(k));
    if (k === 'theme') document.documentElement.toggleAttribute('data-theme', false);
  });

  /* ------------------------------------------------------------------
     Тема (светлая/тёмная) с круговой анимацией
     ------------------------------------------------------------------ */
  function applyTheme(t) {
    const h = document.documentElement;
    if (t === 'dark') h.setAttribute('data-theme', 'dark'); else h.removeAttribute('data-theme');
    Store.set('theme', t);
    $$('#themeToggle').forEach((b) => {
      b.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
      b.setAttribute('aria-label', t === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
    });
    const m = $('#metaTheme');
    if (m) m.setAttribute('content', t === 'dark' ? '#0b0c11' : '#efe9dc');
    emit('theme', t);
  }
  function setTheme(t, origin) {
    const h = document.documentElement;
    const cur = h.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    if (cur === t) { applyTheme(t); return; }
    if (reduceMotion) { applyTheme(t); return; }
    if (document.startViewTransition && origin) {
      const r = Math.hypot(Math.max(origin.x, innerWidth - origin.x), Math.max(origin.y, innerHeight - origin.y));
      const vt = document.startViewTransition(() => applyTheme(t));
      vt.ready.then(() => {
        h.animate({ clipPath: [`circle(0px at ${origin.x}px ${origin.y}px)`, `circle(${r}px at ${origin.x}px ${origin.y}px)`] },
          { duration: 700, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' });
      }).catch(() => {});
    } else {
      h.classList.add('theme-anim');
      applyTheme(t);
      setTimeout(() => h.classList.remove('theme-anim'), 650);
    }
  }
  function initTheme() {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    $$('#themeToggle').forEach((b) => {
      b.setAttribute('aria-pressed', cur === 'dark' ? 'true' : 'false');
      b.setAttribute('aria-label', cur === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему');
      b.addEventListener('click', (ev) => {
        const r = b.getBoundingClientRect();
        const x = ev.clientX || r.left + r.width / 2, y = ev.clientY || r.top + r.height / 2;
        b.classList.remove('is-spinning'); void b.offsetWidth; b.classList.add('is-spinning');
        Sound.ui('tap');
        setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', { x, y });
      });
    });
    on('store:theme', (t) => {
      if (t === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); else document.documentElement.removeAttribute('data-theme');
    });
  }

  /* ------------------------------------------------------------------
     Звуковой движок (Web Audio): синтез нажатия клавиш без аудиофайлов
     ------------------------------------------------------------------ */
  const Sound = {
    ctx: null, master: null, enabled: false, vol: 0.6, _noise: null,
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 6;
        this.master = this.ctx.createGain();
        this.master.gain.value = this.vol;
        this.master.connect(comp); comp.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.25, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this._noise = buf;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    },
    setVol(v) { this.vol = v; if (this.master) this.master.gain.value = v; },
    _noiseHit(t, { f = 1000, q = 1, type = 'bandpass', dur = 0.05, gain = 0.3, delay = 0 }) {
      const c = this.ctx, src = c.createBufferSource();
      src.buffer = this._noise;
      src.playbackRate.value = 0.9 + Math.random() * 0.2;
      const flt = c.createBiquadFilter(); flt.type = type; flt.frequency.value = f; flt.Q.value = q;
      const g = c.createGain(), t0 = t + delay;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(flt); flt.connect(g); g.connect(this.master);
      src.start(t0, Math.random() * 0.1); src.stop(t0 + dur + 0.05);
    },
    _thump(t, { f0 = 170, f1 = 80, dur = 0.09, gain = 0.5, type = 'sine', delay = 0 }) {
      const c = this.ctx, o = c.createOscillator(), g = c.createGain(), t0 = t + delay;
      o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(gain, t0 + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
    },
    /** Нажатие клавиши. kind: linear | tactile | clicky | silent; pitch — множитель высоты (по размеру клавиши) */
    press(kind, pitch = 1, force = false) {
      if (!(this.enabled || force) || !this.ensure()) return;
      const t = this.ctx.currentTime, p = pitch * (0.94 + Math.random() * 0.12);
      if (kind === 'silent') {
        this._thump(t, { f0: 130 * p, f1: 70 * p, dur: 0.07, gain: 0.22 });
        this._noiseHit(t, { f: 500 * p, q: 0.8, dur: 0.04, gain: 0.1 });
      } else if (kind === 'tactile') {
        this._thump(t, { f0: 190 * p, f1: 95 * p, dur: 0.1, gain: 0.5 });
        this._noiseHit(t, { f: 1100 * p, q: 1.1, dur: 0.05, gain: 0.34 });
        this._noiseHit(t, { f: 2300 * p, q: 2, dur: 0.02, gain: 0.2, delay: 0.012 });
      } else if (kind === 'clicky') {
        this._thump(t, { f0: 210 * p, f1: 110 * p, dur: 0.08, gain: 0.38 });
        this._noiseHit(t, { f: 4200 * p, q: 0.7, type: 'highpass', dur: 0.03, gain: 0.5 });
        this._noiseHit(t, { f: 2700 * p, q: 3, dur: 0.045, gain: 0.34, delay: 0.004 });
      } else {
        this._thump(t, { f0: 165 * p, f1: 78 * p, dur: 0.11, gain: 0.52 });
        this._noiseHit(t, { f: 900 * p, q: 1.2, dur: 0.055, gain: 0.34 });
      }
    },
    release(kind, pitch = 1, force = false) {
      if (!(this.enabled || force) || !this.ensure()) return;
      const t = this.ctx.currentTime, p = pitch * (0.95 + Math.random() * 0.1);
      if (kind === 'clicky') this._noiseHit(t, { f: 3600 * p, q: 2.5, dur: 0.03, gain: 0.3 });
      else if (kind === 'silent') this._noiseHit(t, { f: 700 * p, q: 1, dur: 0.025, gain: 0.05 });
      else this._noiseHit(t, { f: 1500 * p, q: 1.4, dur: 0.03, gain: kind === 'tactile' ? 0.16 : 0.12 });
    },
    /** Интерфейсные звуки */
    ui(name) {
      if (!this.enabled || !this.ensure()) return;
      const t = this.ctx.currentTime;
      if (name === 'tap') { this._thump(t, { f0: 520, f1: 300, dur: 0.05, gain: 0.12, type: 'triangle' }); }
      else if (name === 'add') { this._thump(t, { f0: 420, f1: 640, dur: 0.09, gain: 0.18, type: 'triangle' }); this._thump(t, { f0: 640, f1: 880, dur: 0.1, gain: 0.14, type: 'triangle', delay: 0.07 }); }
      else if (name === 'success') { [523, 659, 784, 1046].forEach((f, i) => this._thump(t, { f0: f, f1: f * 0.99, dur: 0.22, gain: 0.16, type: 'triangle', delay: i * 0.09 })); }
      else if (name === 'error') { this._thump(t, { f0: 220, f1: 150, dur: 0.16, gain: 0.2, type: 'sawtooth' }); }
    }
  };
  function setSound(on_) {
    Sound.enabled = !!on_;
    if (on_) Sound.ensure();
    Store.set('sound', Sound.enabled);
    $$('[data-sound-toggle]').forEach((b) => {
      b.setAttribute('aria-pressed', Sound.enabled ? 'true' : 'false');
      const lab = $('[data-sound-label]', b);
      if (lab) lab.textContent = Sound.enabled ? 'Звук включён' : 'Включить звук';
      if (b.classList.contains('icon-btn')) b.setAttribute('aria-label', Sound.enabled ? 'Выключить звук клавиш' : 'Включить звук клавиш');
    });
    emit('sound', Sound.enabled);
  }
  function initSound() {
    Sound.enabled = !!Store.get('sound', false);
    setSound(Sound.enabled && false); // громкость ждёт жеста пользователя: аудио стартует после первого клика
    Sound.enabled = false;
    $$('[data-sound-toggle]').forEach((b) => b.addEventListener('click', () => {
      setSound(!Sound.enabled);
      if (Sound.enabled) { Sound.press('linear', 1); toast('Звук включён: попробуйте нажать клавишу', { icon: 'sound-on' }); }
    }));
  }

  /* ------------------------------------------------------------------
     Уведомления, диалоги, подтверждение
     ------------------------------------------------------------------ */
  let toastBox = null;
  function toast(msg, opts = {}) {
    if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toast-stack'; toastBox.setAttribute('aria-live', 'polite'); if ('popover' in toastBox) toastBox.setAttribute('popover', 'manual'); document.body.append(toastBox); }
    const el = document.createElement('div');
    el.className = 'toast'; el.setAttribute('role', 'status');
    el.innerHTML = `${ic(opts.icon || 'check')}<span class="toast__msg">${esc(msg)}</span>${opts.action ? `<button class="toast__action" type="button">${esc(opts.action)}</button>` : ''}`;
    toastBox.append(el);
    if (toastBox.showPopover) { try { toastBox.hidePopover(); } catch (_) { /* не открыт */ } try { toastBox.showPopover(); } catch (_) { /* пусто */ } }
    while (toastBox.children.length > 3) toastBox.firstChild.remove();
    const kill = () => { el.classList.add('is-out'); setTimeout(() => el.remove(), 320); };
    if (opts.action) $('.toast__action', el).addEventListener('click', () => { kill(); opts.onAction && opts.onAction(); });
    setTimeout(kill, opts.ms || 3800);
  }

  function showDialog(dlg) {
    if (!dlg || dlg.open) return;
    dlg.showModal();
    document.body.classList.add('is-locked');
  }
  function wireDialog(dlg) {
    if (!dlg || dlg.__wired) return;
    dlg.__wired = true;
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', () => { if (!$('dialog[open]')) document.body.classList.remove('is-locked'); });
  }

  function confirmDialog({ title = 'Подтвердите действие', text = '', ok = 'Да', cancel = 'Отмена' }) {
    return new Promise((resolve) => {
      const dlg = document.createElement('dialog');
      dlg.className = 'order-dialog'; dlg.style.width = 'min(94vw, 440px)';
      dlg.innerHTML = `<h2 class="order-dialog__title">${esc(title)}</h2><p>${esc(text)}</p><div class="form-actions"><button class="button button--secondary" type="button" data-v="0">${esc(cancel)}</button><button class="button" type="button" data-v="1">${esc(ok)}</button></div>`;
      document.body.append(dlg); wireDialog(dlg);
      let val = false;
      dlg.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { val = b.dataset.v === '1'; dlg.close(); } });
      dlg.addEventListener('close', () => { dlg.remove(); resolve(val); });
      showDialog(dlg);
    });
  }

  /* ------------------------------------------------------------------
     Конфетти и «полёт» картинки в корзину
     ------------------------------------------------------------------ */
  function confetti(n = 140) {
    if (reduceMotion) return;
    const c = document.createElement('canvas');
    c.className = 'confetti'; c.setAttribute('aria-hidden', 'true');
    document.body.append(c);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = innerWidth * dpr; c.height = innerHeight * dpr;
    const ctx = c.getContext('2d');
    const cs = getComputedStyle(document.documentElement);
    const colors = [cs.getPropertyValue('--accent').trim() || '#e8590c', '#f6c453', '#35e0e6', '#ffffff', '#7c5cff', '#3ddc84'];
    const P = Array.from({ length: n }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * 220, y: innerHeight * 0.4,
      vx: (Math.random() - 0.5) * 16, vy: -Math.random() * 14 - 4, w: 6 + Math.random() * 8, h: 4 + Math.random() * 7,
      r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: colors[(Math.random() * colors.length) | 0]
    }));
    let last = performance.now();
    (function frame(now) {
      const dt = Math.min(32, now - last) / 16; last = now;
      ctx.clearRect(0, 0, c.width, c.height);
      let alive = 0;
      P.forEach((p) => {
        p.vy += 0.36 * dt; p.vx *= 0.995; p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        if (p.y < innerHeight + 30) alive++;
        ctx.save(); ctx.translate(p.x * dpr, p.y * dpr); ctx.rotate(p.r); ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2 * dpr, -p.h / 2 * dpr, p.w * dpr, p.h * dpr); ctx.restore();
      });
      if (alive) requestAnimationFrame(frame); else c.remove();
    })(last);
  }

  function flyTo(fromEl, toEl, src) {
    if (reduceMotion || !fromEl || !toEl || !src) return;
    const a = fromEl.getBoundingClientRect(), b = toEl.getBoundingClientRect();
    const img = document.createElement('img');
    img.className = 'fly'; img.src = src; img.alt = '';
    img.style.cssText = `left:${a.left}px;top:${a.top}px;width:${a.width}px;height:${a.height}px`;
    document.body.append(img);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2);
    const anim = img.animate([
      { transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 },
      { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 90}px) scale(0.6) rotate(-8deg)`, opacity: 1, offset: 0.55 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.08) rotate(12deg)`, opacity: 0.4 }
    ], { duration: 750, easing: 'cubic-bezier(.5,0,.3,1)' });
    anim.onfinish = () => img.remove();
  }

  /* ------------------------------------------------------------------
     Интерфейс: шапка, прогресс, «наверх», появление, счётчики, наклон карточек
     ------------------------------------------------------------------ */
  function initChrome() {
    const header = $('#header'), burger = $('#burger'), nav = $('#nav');
    const bar = $('#scrollProgress i'), top = $('#scrollToTop');
    let raf = 0;
    const onScroll = () => {
      raf = 0;
      const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
      if (header) header.classList.toggle('is-scrolled', y > 8);
      if (bar) bar.style.transform = `scaleX(${h > 0 ? Math.min(1, y / h) : 0})`;
      if (top) top.classList.toggle('is-visible', y > 600);
    };
    addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(onScroll); }, { passive: true });
    onScroll();
    if (top) top.addEventListener('click', () => { Sound.ui('tap'); top.classList.add('is-clicked'); setTimeout(() => top.classList.remove('is-clicked'), 320); scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); });

    if (burger && nav) {
      const set = (open) => { burger.setAttribute('aria-expanded', open ? 'true' : 'false'); nav.classList.toggle('is-open', open); };
      burger.addEventListener('click', () => set(burger.getAttribute('aria-expanded') !== 'true'));
      nav.addEventListener('click', (e) => { if (e.target.closest('a, button')) set(false); });
      document.addEventListener('click', (e) => { if (!nav.contains(e.target) && !burger.contains(e.target)) set(false); });
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
    }

    // Появление при прокрутке
    const rev = $$('.reveal');
    if ('IntersectionObserver' in window && !reduceMotion) {
      const io = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); } }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
      rev.forEach((el, i) => { el.style.setProperty('--i', i % 6); io.observe(el); });
    } else rev.forEach((el) => el.classList.add('is-in'));

    // Счётчики
    const counters = $$('[data-count-to]');
    const run = (el) => {
      const to = parseFloat(el.dataset.countTo), dec = +(el.dataset.decimals || 0), suf = el.dataset.suffix || '';
      if (reduceMotion) { el.textContent = to.toFixed(dec).replace('.', ',') + suf; return; }
      const t0 = performance.now(), dur = 1600;
      (function step(now) {
        const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
        el.textContent = (to * e).toFixed(dec).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + suf;
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    };
    if ('IntersectionObserver' in window) {
      const io2 = new IntersectionObserver((es) => es.forEach((en) => { if (en.isIntersecting) { run(en.target); io2.unobserve(en.target); } }), { threshold: 0.6 });
      counters.forEach((c) => io2.observe(c));
    } else counters.forEach(run);

    // Наклон карточек и подсветка за курсором
    if (finePointer && !reduceMotion) {
      let ticking = false, ev = null;
      document.addEventListener('pointermove', (e) => {
        ev = e;
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          const card = ev.target.closest && ev.target.closest('.product-card');
          if (card) {
            const r = card.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
            card.style.setProperty('--ry', ((x - 0.5) * 7).toFixed(2) + 'deg');
            card.style.setProperty('--rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
            card.style.setProperty('--mx', (x * 100).toFixed(1) + '%');
            card.style.setProperty('--my', (y * 100).toFixed(1) + '%');
          }
          const hero = ev.target.closest && ev.target.closest('.hero');
          if (hero) {
            const r = hero.getBoundingClientRect();
            const bg = $('.hero__bg', hero);
            if (bg) { bg.style.setProperty('--px', ((ev.clientX - r.left) / r.width - 0.5) * 2); bg.style.setProperty('--py', ((ev.clientY - r.top) / r.height - 0.5) * 2); }
          }
        });
      }, { passive: true });
      document.addEventListener('pointerout', (e) => {
        const card = e.target.closest && e.target.closest('.product-card');
        if (card && !card.contains(e.relatedTarget)) { card.style.setProperty('--rx', '0deg'); card.style.setProperty('--ry', '0deg'); }
      });
    }

    // Звук нажатия на кнопки-«клавиши» (если включён)
    document.addEventListener('pointerdown', (e) => {
      if (!Sound.enabled) return;
      const b = e.target.closest('.button, .icon-btn, .chip-btn, .seg__btn, .opt, .tabs__tab');
      if (b && !b.closest('.kb') && !b.hasAttribute('data-silent')) Sound.press('linear', 1.35);
    });
  }

  /* ------------------------------------------------------------------
     Валидация форм (общая для заявки, отзывов, обратной связи, оформления)
     ------------------------------------------------------------------ */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_RE = /^\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}$/;
  function maskPhone(v) {
    let d = v.replace(/\D/g, '');
    if (d[0] === '7' || d[0] === '8') d = d.slice(1);
    d = d.slice(0, 10);
    if (!d.length) return '';
    let s = '+7 (' + d.slice(0, 3);
    if (d.length >= 3) s += ')';
    if (d.length > 3) s += ' ' + d.slice(3, 6);
    if (d.length > 6) s += '-' + d.slice(6, 8);
    if (d.length > 8) s += '-' + d.slice(8, 10);
    return s;
  }
  function messageFor(el) {
    const v = (el.value || '').trim();
    if (el.type === 'checkbox') return el.checked || !el.required ? '' : 'Необходимо согласие на обработку данных';
    if (el.type === 'radio') {
      if (!el.required && !el.form.querySelector(`input[name="${el.name}"][required]`)) return '';
      return Array.from(el.form.querySelectorAll(`input[name="${el.name}"]`)).some((r) => r.checked) ? '' : 'Поставьте оценку';
    }
    if (el.required && !v) return el.tagName === 'SELECT' ? 'Выберите вариант' : 'Заполните это поле';
    if (!v) return '';
    const min = +el.getAttribute('minlength') || 0;
    if (min && v.length < min) return `Минимум ${min} симв. (сейчас ${v.length})`;
    if (el.type === 'email' && !EMAIL_RE.test(v)) return 'Введите корректный e-mail, например name@mail.ru';
    if (el.type === 'tel' && !PHONE_RE.test(v)) return 'Телефон в формате +7 (900) 000-00-00';
    if (el.type === 'date' && el.min && v < el.min) return 'Дата не может быть в прошлом';
    return '';
  }
  function showError(el, msg) {
    const wrap = el.closest('.form-field');
    if (!wrap) return;
    let err = $('.form-field__error', wrap);
    if (!err) { err = document.createElement('p'); err.className = 'form-field__error'; err.id = 'err-' + (el.id || el.name || Math.random().toString(36).slice(2)); wrap.append(err); }
    err.textContent = msg;
    wrap.classList.toggle('is-invalid', !!msg);
    wrap.classList.toggle('is-valid', !msg && !!(el.value || '').trim() && el.type !== 'checkbox' && el.type !== 'radio');
    if (el.type === 'radio') { $$(`input[name="${el.name}"]`, el.form).forEach((r) => r.setAttribute('aria-invalid', msg ? 'true' : 'false')); }
    el.setAttribute('aria-invalid', msg ? 'true' : 'false');
    if (msg) el.setAttribute('aria-describedby', err.id); else el.removeAttribute('aria-describedby');
  }
  function validateForm(form) {
    let first = null;
    const seen = {};
    $$('input, select, textarea', form).forEach((el) => {
      if (el.type === 'hidden' || el.disabled || el.closest('[hidden]')) return;
      if (el.type === 'radio') { if (seen[el.name]) return; seen[el.name] = true; }
      const msg = messageFor(el);
      showError(el, msg);
      if (msg && !first) first = el;
    });
    if (first) { first.focus(); Sound.ui('error'); if (!reduceMotion) first.closest('.form-field')?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 300 }); }
    return !first;
  }
  function liveValidate(form) {
    if (form.__live) return;
    form.__live = true;
    form.addEventListener('focusout', (e) => { const el = e.target; if (el.matches && el.matches('input, select, textarea') && el.type !== 'hidden') showError(el, messageFor(el)); });
    form.addEventListener('input', (e) => {
      const el = e.target;
      if (el.type === 'tel') { el.value = maskPhone(el.value); }
      const w = el.closest && el.closest('.form-field');
      if (w && w.classList.contains('is-invalid')) showError(el, messageFor(el));
    });
    form.addEventListener('change', (e) => { const el = e.target; if (el.matches && el.matches('select, input[type=checkbox], input[type=radio], input[type=date]')) showError(el, messageFor(el)); });
    $$('input[type="date"]', form).forEach((d) => { d.min = new Date().toISOString().slice(0, 10); });
  }
  function resetForm(form) {
    form.reset();
    $$('.form-field', form).forEach((w) => { w.classList.remove('is-invalid', 'is-valid'); const e = $('.form-field__error', w); if (e) e.textContent = ''; });
    $$('[aria-invalid]', form).forEach((el) => el.removeAttribute('aria-invalid'));
  }

  /* ------------------------------------------------------------------
     Избранное
     ------------------------------------------------------------------ */
  const Fav = {
    list: () => Store.get('fav', []),
    has(id) { return this.list().indexOf(id) > -1; },
    toggle(id) {
      const l = this.list(), i = l.indexOf(id);
      if (i > -1) l.splice(i, 1); else l.push(id);
      Store.set('fav', l);
      return i === -1;
    }
  };
  function syncFavButtons() {
    $$('[data-fav]').forEach((b) => {
      const on_ = Fav.has(b.dataset.fav), p = BY_ID[b.dataset.fav];
      b.setAttribute('aria-pressed', on_ ? 'true' : 'false');
      b.setAttribute('aria-label', (on_ ? 'Убрать из избранного: ' : 'В избранное: ') + (p ? p.title : ''));
      b.classList.toggle('is-fav', on_);
    });
    const df = $('#product-details-fav');
    if (df && df.dataset.id) { const on_ = Fav.has(df.dataset.id); df.setAttribute('aria-pressed', on_ ? 'true' : 'false'); df.classList.toggle('is-fav', on_); }
  }

  /* ------------------------------------------------------------------
     Сравнение
     ------------------------------------------------------------------ */
  const Compare = {
    list: () => Store.get('compare', []),
    has(id) { return this.list().indexOf(id) > -1; },
    toggle(id) {
      const l = this.list(), i = l.indexOf(id);
      if (i > -1) { l.splice(i, 1); Store.set('compare', l); return 'removed'; }
      if (l.length >= 3) return 'full';
      l.push(id); Store.set('compare', l); return 'added';
    }
  };
  function syncCompareButtons() {
    $$('[data-compare]').forEach((b) => b.setAttribute('aria-pressed', Compare.has(b.dataset.compare) ? 'true' : 'false'));
  }
  function openCompare() {
    let dlg = $('#compare-dialog');
    if (!dlg) {
      dlg = document.createElement('dialog');
      dlg.id = 'compare-dialog'; dlg.className = 'compare'; dlg.setAttribute('aria-labelledby', 'compare-title');
      document.body.append(dlg); wireDialog(dlg);
      dlg.addEventListener('click', (e) => {
        if (e.target.closest('[data-cmp-close]')) dlg.close();
        const rm = e.target.closest('[data-cmp-rm]');
        if (rm) { Compare.toggle(rm.dataset.cmpRm); renderCompare(); }
        const add = e.target.closest('[data-cmp-cart]');
        if (add) addToCart(add.dataset.cmpCart, add);
        if (e.target.closest('[data-cmp-clear]')) { Store.set('compare', []); renderCompare(); }
      });
    }
    renderCompare();
    showDialog(dlg);
  }
  function renderCompare() {
    const dlg = $('#compare-dialog');
    if (!dlg) return;
    const items = Compare.list().map((id) => BY_ID[id]).filter(Boolean);
    let html = `<div class="compare__head"><h2 id="compare-title">Сравнение товаров</h2><div class="hero__actions">${items.length ? `<button class="button button--ghost button--sm" type="button" data-cmp-clear>Очистить</button>` : ''}<button class="icon-btn" type="button" data-cmp-close aria-label="Закрыть">${ic('close')}</button></div></div>`;
    if (items.length < 2) {
      html += `<div class="cart-empty"><div class="empty__art">${ic('compare')}</div><h3>${items.length ? 'Добавьте ещё один товар' : 'Сравнивать пока нечего'}</h3><p>Нажмите «Сравнить» на карточках товаров — можно выбрать до трёх.</p><a class="button" href="catalog.html" data-cmp-close>Перейти в каталог</a></div>`;
      if (items.length === 1) html += `<p><strong>${esc(items[0].title)}</strong> — ${fmt(items[0].price)}. <button class="chip-btn" type="button" data-cmp-rm="${items[0].id}">Убрать</button></p>`;
    } else {
      const keys = [];
      items.forEach((p) => Object.keys(p.specs || {}).forEach((k) => { if (keys.indexOf(k) < 0) keys.push(k); }));
      const minPrice = Math.min(...items.map((p) => p.price)), maxRating = Math.max(...items.map((p) => p.rating));
      html += `<div class="compare__scroll"><table class="compare__table"><caption class="visually-hidden">Сравнение выбранных товаров по характеристикам</caption><thead><tr><th scope="col"></th>${items.map((p) => `<th scope="col"><img src="${p.image}" alt="" loading="lazy"><span class="compare__name">${esc(p.title)}</span><button class="chip-btn compare__rm" type="button" data-cmp-rm="${p.id}">Убрать</button></th>`).join('')}</tr></thead><tbody>`;
      html += `<tr><th scope="row">Цена</th>${items.map((p) => `<td class="compare__price ${p.price === minPrice ? 'compare__best' : ''}">${fmt(p.price)}${p.price === minPrice ? ' · дешевле' : ''}</td>`).join('')}</tr>`;
      html += `<tr><th scope="row">Рейтинг</th>${items.map((p) => `<td class="${p.rating === maxRating ? 'compare__best' : ''}">★ ${p.rating.toFixed(1)}</td>`).join('')}</tr>`;
      html += `<tr><th scope="row">Тип</th>${items.map((p) => `<td>${esc(D.TYPES[p.type] || '')}</td>`).join('')}</tr>`;
      keys.forEach((k) => { html += `<tr><th scope="row">${esc(k)}</th>${items.map((p) => `<td>${esc((p.specs || {})[k] || '—')}</td>`).join('')}</tr>`; });
      html += `<tr><th scope="row"></th>${items.map((p) => `<td><button class="button button--sm" type="button" data-cmp-cart="${p.id}">${ic('cart')} В корзину</button></td>`).join('')}</tr>`;
      html += '</tbody></table></div>';
    }
    dlg.innerHTML = html;
  }

  /* ------------------------------------------------------------------
     Корзина
     ------------------------------------------------------------------ */
  const Cart = {
    raw: () => Store.get('cart', []),
    save(l) { Store.set('cart', l); },
    add(id, qty = 1) {
      const l = this.raw(), it = l.find((x) => x.id === id && !x.build);
      if (it) it.qty = Math.min(10, it.qty + qty); else l.push({ id, qty });
      this.save(l);
    },
    addBuild(b) {
      const l = this.raw(), it = l.find((x) => x.id === b.id);
      if (it) it.qty = Math.min(5, it.qty + 1); else l.push({ id: b.id, build: true, title: b.title, price: b.price, qty: 1, meta: b.meta, cfg: b.cfg });
      this.save(l);
    },
    setQty(id, q) { let l = this.raw(); if (q <= 0) l = l.filter((x) => x.id !== id); else { const it = l.find((x) => x.id === id); if (it) it.qty = Math.min(10, q); } this.save(l); },
    remove(id) { this.save(this.raw().filter((x) => x.id !== id)); },
    clear() { this.save([]); },
    items() {
      return this.raw().map((x) => {
        if (x.build) return { id: x.id, title: x.title, price: x.price, qty: x.qty, build: true, meta: x.meta, image: null, type: 'build' };
        const p = BY_ID[x.id];
        return p ? { id: p.id, title: p.title, price: p.price, qty: x.qty, image: p.image, type: p.type, meta: D.TYPES[p.type] } : null;
      }).filter(Boolean);
    },
    count() { return this.raw().reduce((s, x) => s + x.qty, 0); },
    sub() { return this.items().reduce((s, x) => s + x.price * x.qty, 0); },
    promo() { const c = Store.get('promo', ''); return D.PROMOS[c] ? c : ''; },
    totals(delivery) {
      const sub = this.sub(), code = this.promo(), pr = code ? D.PROMOS[code] : null;
      let discount = 0;
      if (pr && (!pr.min || sub >= pr.min)) discount = pr.type === 'percent' ? Math.round(sub * pr.value / 100) : Math.min(pr.value, sub);
      const after = sub - discount;
      let shipping = after >= D.FREE_SHIP ? 0 : D.SHIP_COST;
      if (!sub) shipping = 0;
      if (delivery === 'pickup') shipping = 0;
      return { sub, discount, shipping, total: after + shipping, code: discount ? code : '', promoText: pr ? pr.text : '' };
    }
  };
  function addToCart(id, srcEl) {
    const p = BY_ID[id];
    if (!p) return;
    Cart.add(id, 1);
    const card = srcEl && srcEl.closest ? srcEl.closest('.product-card, dialog') : null;
    const img = card && $('img', card);
    flyTo(img, $('.icon-btn--cart'), p.image);
    Sound.ui('add');
    toast(`«${p.title}» в корзине`, { icon: 'cart', action: 'Открыть', onAction: () => openDrawer('cart') });
  }

  /* ------------------------------------------------------------------
     Счётчики в шапке
     ------------------------------------------------------------------ */
  function updateCounts(bump) {
    const c = { cart: Cart.count(), fav: Fav.list().length, compare: Compare.list().length };
    Object.keys(c).forEach((k) => $$(`[data-count="${k}"]`).forEach((b) => {
      const was = +b.textContent || 0;
      b.textContent = c[k]; b.hidden = !c[k];
      if (bump && bump === k && c[k] > was) { b.classList.remove('is-bump'); void b.offsetWidth; b.classList.add('is-bump'); }
    }));
    $$('[data-open-fav]').forEach((b) => b.setAttribute('aria-label', 'Избранное' + (c.fav ? ` (${c.fav})` : '')));
  }

  /* ------------------------------------------------------------------
     Боковая панель: корзина и избранное
     ------------------------------------------------------------------ */
  let drawer = null, drawerPanel = 'cart';
  function ensureDrawer() {
    if (drawer) return drawer;
    drawer = document.createElement('dialog');
    drawer.className = 'drawer'; drawer.id = 'drawer'; drawer.setAttribute('aria-labelledby', 'drawerTitle');
    drawer.innerHTML = `<div class="drawer__head"><h2 class="drawer__title" id="drawerTitle">Корзина</h2><button class="icon-btn" type="button" data-drawer-close aria-label="Закрыть">${ic('close')}</button></div>
      <div class="seg drawer__tabs" role="group" aria-label="Раздел"><button class="seg__btn" type="button" data-panel="cart">${ic('cart')} Корзина</button><button class="seg__btn" type="button" data-panel="fav">${ic('heart')} Избранное</button></div>
      <div class="drawer__body" id="drawerBody"></div><div class="drawer__foot" id="drawerFoot"></div>`;
    document.body.append(drawer);
    drawer.addEventListener('click', (e) => {
      if (e.target === drawer || e.target.closest('[data-drawer-close]')) return closeDrawer();
      const tab = e.target.closest('[data-panel]');
      if (tab) { drawerPanel = tab.dataset.panel; renderDrawer(); return; }
      const inc = e.target.closest('[data-inc]'), dec = e.target.closest('[data-dec]'), rm = e.target.closest('[data-rm]');
      if (inc) { const it = Cart.raw().find((x) => x.id === inc.dataset.inc); Cart.setQty(inc.dataset.inc, (it ? it.qty : 0) + 1); }
      if (dec) { const it = Cart.raw().find((x) => x.id === dec.dataset.dec); if (it && it.qty <= 1) removeItem(dec.dataset.dec); else Cart.setQty(dec.dataset.dec, (it ? it.qty : 1) - 1); }
      if (rm) removeItem(rm.dataset.rm);
      const favRm = e.target.closest('[data-fav-rm]');
      if (favRm) { Fav.toggle(favRm.dataset.favRm); }
      const favAdd = e.target.closest('[data-fav-cart]');
      if (favAdd) addToCart(favAdd.dataset.favCart, favAdd);
      if (e.target.closest('[data-fav-all]')) { Fav.list().forEach((id) => Cart.add(id, 1)); toast('Всё из избранного добавлено в корзину', { icon: 'cart' }); Sound.ui('add'); }
      if (e.target.closest('[data-checkout]')) { closeDrawer(); setTimeout(openCheckout, 350); }
      if (e.target.closest('[data-cart-clear]')) confirmDialog({ title: 'Очистить корзину?', text: 'Все товары будут удалены.', ok: 'Очистить' }).then((v) => { if (v) Cart.clear(); });
      if (e.target.closest('[data-qv]')) { const id = e.target.closest('[data-qv]').dataset.qv; closeDrawer(); setTimeout(() => openDetails(id), 350); }
    });
    drawer.addEventListener('submit', (e) => {
      const f = e.target.closest('.promo');
      if (!f) return;
      e.preventDefault();
      const code = $('input', f).value.trim().toUpperCase(), pr = D.PROMOS[code], msg = $('#promoMsg');
      if (!code) { Store.set('promo', ''); return; }
      if (!pr) { msg.textContent = 'Такого промокода нет'; msg.className = 'promo__msg is-bad'; Sound.ui('error'); return; }
      if (pr.min && Cart.sub() < pr.min) { msg.textContent = `Действует от ${fmt(pr.min)}`; msg.className = 'promo__msg is-bad'; Sound.ui('error'); return; }
      Store.set('promo', code); Sound.ui('success'); toast(pr.text, { icon: 'tag' });
    });
    drawer.addEventListener('cancel', (e) => { e.preventDefault(); closeDrawer(); });
    wireDialog(drawer);
    drawer.addEventListener('close', () => drawer.classList.remove('is-open'));
    return drawer;
  }
  function removeItem(id) {
    const row = $(`.cart-item[data-id="${id}"]`, drawer);
    const snap = Cart.raw().find((x) => x.id === id);
    const done = () => { Cart.remove(id); toast('Товар удалён', { icon: 'trash', action: 'Вернуть', onAction: () => { const l = Cart.raw(); l.push(snap); Cart.save(l); } }); };
    if (row && !reduceMotion) { row.classList.add('is-removing'); setTimeout(done, 280); } else done();
  }
  function openDrawer(panel) {
    ensureDrawer();
    drawerPanel = panel || 'cart';
    renderDrawer();
    if (!drawer.open) { showDialog(drawer); requestAnimationFrame(() => requestAnimationFrame(() => drawer.classList.add('is-open'))); }
  }
  function closeDrawer() {
    if (!drawer || !drawer.open) return;
    drawer.classList.remove('is-open');
    setTimeout(() => drawer.open && drawer.close(), reduceMotion ? 0 : 380);
  }
  function renderDrawer() {
    if (!drawer || !drawer.open && !drawer.classList.contains('is-open') && false) return;
    $$('[data-panel]', drawer).forEach((b) => { const on_ = b.dataset.panel === drawerPanel; b.classList.toggle('is-active', on_); b.setAttribute('aria-pressed', on_ ? 'true' : 'false'); });
    $('#drawerTitle').textContent = drawerPanel === 'cart' ? 'Корзина' : 'Избранное';
    const body = $('#drawerBody'), foot = $('#drawerFoot');
    if (drawerPanel === 'cart') {
      const items = Cart.items();
      if (!items.length) {
        const orders = Store.get('orders', []).slice(-3).reverse();
        body.innerHTML = `<div class="cart-empty"><div class="empty__art">${ic('cart')}</div><h3>В корзине пока пусто</h3><p>Добавьте клавиатуру, кейкапы или переключатели — или соберите свою в конфигураторе.</p><a class="button" href="catalog.html">Перейти в каталог</a></div>` +
          (orders.length ? `<div class="orders-block"><h3>Последние заказы</h3><ul>${orders.map((o) => `<li><span><strong>${esc(o.id)}</strong> · ${esc(o.date)}</span><span>${fmt(o.total)}</span></li>`).join('')}</ul></div>` : '');
        foot.hidden = true;
        return;
      }
      foot.hidden = false;
      const t = Cart.totals(), left = Math.max(0, D.FREE_SHIP - (t.sub - t.discount)), pct = Math.min(100, (t.sub - t.discount) / D.FREE_SHIP * 100);
      body.innerHTML = `<p class="free-ship ${left ? '' : 'is-done'}">${left ? `До бесплатной доставки осталось <strong>${fmt(left)}</strong>` : `${ic('check')} Доставка бесплатная!`}<span class="free-ship__bar"><i style="width:${pct}%"></i></span></p>` +
        items.map((it) => `<div class="cart-item" data-id="${esc(it.id)}">
          ${it.image ? `<img class="cart-item__img" src="${it.image}" alt="" width="76" height="57">` : `<span class="cart-item__img cart-item__img--build">${ic('keyboard')}</span>`}
          <div><p class="cart-item__title">${it.image ? `<a href="#" data-qv="${esc(it.id)}" style="text-decoration:none">${esc(it.title)}</a>` : esc(it.title)}</p><p class="cart-item__meta">${esc(it.meta || '')}</p>
            <div class="cart-item__row"><div class="qty" role="group" aria-label="Количество"><button type="button" data-dec="${esc(it.id)}" aria-label="Меньше">${ic('minus')}</button><span aria-live="polite">${it.qty}</span><button type="button" data-inc="${esc(it.id)}" aria-label="Больше">${ic('plus')}</button></div></div></div>
          <div><button class="cart-item__remove" type="button" data-rm="${esc(it.id)}" aria-label="Удалить ${esc(it.title)}">${ic('trash')}</button><div class="cart-item__price">${fmt(it.price * it.qty)}</div></div></div>`).join('');
      foot.innerHTML = `<form class="promo" novalidate><label class="visually-hidden" for="promoInput">Промокод</label><input id="promoInput" placeholder="Промокод" value="${esc(Cart.promo())}" autocomplete="off"><button class="button button--secondary button--sm" type="submit">Применить</button></form>
        <p class="promo__msg ${t.code ? 'is-ok' : ''}" id="promoMsg">${t.code ? esc(t.promoText) + ' применён' : 'Попробуйте TACT10 или WELCOME'}</p>
        <dl class="totals"><div><dt>Товары</dt><dd>${fmt(t.sub)}</dd></div>${t.discount ? `<div class="is-discount"><dt>Скидка</dt><dd>−${fmt(t.discount)}</dd></div>` : ''}<div><dt>Доставка</dt><dd>${t.shipping ? fmt(t.shipping) : 'бесплатно'}</dd></div><div class="is-total"><dt>Итого</dt><dd>${fmt(t.total)}</dd></div></dl>
        <button class="button" type="button" data-checkout>Оформить заказ ${ic('arrow-right')}</button>
        <button class="chip-btn" type="button" data-cart-clear style="margin-top:.7rem">${ic('trash')} Очистить корзину</button>`;
    } else {
      const favs = Fav.list().map((id) => BY_ID[id]).filter(Boolean);
      if (!favs.length) { body.innerHTML = `<div class="cart-empty"><div class="empty__art">${ic('heart')}</div><h3>Избранное пусто</h3><p>Нажимайте на сердечко на карточках товаров, чтобы сохранить понравившееся.</p><a class="button" href="catalog.html">Перейти в каталог</a></div>`; foot.hidden = true; return; }
      foot.hidden = false;
      body.innerHTML = favs.map((p) => `<div class="mini-item"><img src="${p.image}" alt="" width="76" height="57"><div><p class="mini-item__title"><a href="#" data-qv="${p.id}" style="text-decoration:none">${esc(p.title)}</a></p><p class="mini-item__price">${fmt(p.price)}</p></div><div class="mini-item__actions"><button class="icon-btn" type="button" data-fav-cart="${p.id}" aria-label="В корзину: ${esc(p.title)}">${ic('cart')}</button><button class="icon-btn" type="button" data-fav-rm="${p.id}" aria-label="Убрать из избранного: ${esc(p.title)}">${ic('trash')}</button></div></div>`).join('');
      foot.innerHTML = `<button class="button" type="button" data-fav-all>${ic('cart')} Всё в корзину (${favs.length})</button>`;
    }
  }

  /* ------------------------------------------------------------------
     Оформление заказа
     ------------------------------------------------------------------ */
  function openCheckout() {
    if (!Cart.count()) { openDrawer('cart'); return; }
    let dlg = $('#checkout-dialog');
    if (dlg) dlg.remove();
    dlg = document.createElement('dialog');
    dlg.id = 'checkout-dialog'; dlg.className = 'order-dialog'; dlg.setAttribute('aria-labelledby', 'co-title');
    const prof = Store.get('profile', {});
    dlg.innerHTML = `<h2 class="order-dialog__title" id="co-title">Оформление заказа</h2>
      <ul class="checkout__summary" id="coSummary"></ul>
      <form class="order-form" id="checkout-form" novalidate>
        <div class="form-field"><label class="form-field__label" for="co-name">Имя и фамилия</label><input class="form-field__input" id="co-name" name="name" type="text" minlength="2" autocomplete="name" value="${esc(prof.name || '')}" required></div>
        <div class="form-field"><label class="form-field__label" for="co-phone">Телефон</label><input class="form-field__input" id="co-phone" name="phone" type="tel" inputmode="tel" placeholder="+7 (900) 000-00-00" autocomplete="tel" value="${esc(prof.phone || '')}" required></div>
        <div class="form-field"><label class="form-field__label" for="co-email">E-mail</label><input class="form-field__input" id="co-email" name="email" type="email" autocomplete="email" value="${esc(prof.email || '')}" required></div>
        <div class="form-field"><span class="form-field__label">Доставка</span><div class="radio-cards" id="coDelivery">
          <label><input type="radio" name="delivery" value="courier" checked>Курьером<small>1–2 дня</small></label>
          <label><input type="radio" name="delivery" value="post">Почта / ПВЗ<small>3–7 дней</small></label>
          <label><input type="radio" name="delivery" value="pickup">Самовывоз<small>бесплатно</small></label></div></div>
        <div class="form-field" id="coAddrWrap"><label class="form-field__label" for="co-addr">Адрес доставки</label><input class="form-field__input" id="co-addr" name="address" type="text" minlength="8" placeholder="Город, улица, дом, квартира" autocomplete="street-address" required></div>
        <div class="form-field"><span class="form-field__label">Оплата</span><div class="radio-cards">
          <label><input type="radio" name="pay" value="card" checked>Картой<small>онлайн</small></label>
          <label><input type="radio" name="pay" value="sbp">СБП<small>по QR-коду</small></label>
          <label><input type="radio" name="pay" value="cod">При получении<small>наличными</small></label></div></div>
        <div class="form-field"><label class="form-field__label" for="co-comment">Комментарий</label><textarea class="form-field__textarea" id="co-comment" name="comment" rows="2" placeholder="Пожелания к сборке или доставке"></textarea></div>
        <div class="form-field form-field--checkbox"><label class="form-field__checkbox-label"><input class="form-field__checkbox" name="agreement" type="checkbox" required> Я согласен на обработку данных (<a href="privacy.html" target="_blank" rel="noopener">подробнее</a>)</label></div>
        <div class="form-actions"><button class="button button--secondary" type="button" data-close>Назад в корзину</button><button class="button" type="submit">Подтвердить заказ</button></div>
      </form>`;
    document.body.append(dlg); wireDialog(dlg);
    const form = $('#checkout-form', dlg);
    liveValidate(form);
    const renderSum = () => {
      const delivery = (new FormData(form).get('delivery')) || 'courier', t = Cart.totals(delivery);
      $('#coSummary', dlg).innerHTML = Cart.items().map((i) => `<li><span>${esc(i.title)} × ${i.qty}</span><strong>${fmt(i.price * i.qty)}</strong></li>`).join('') +
        (t.discount ? `<li><span>Скидка (${esc(t.code)})</span><strong>−${fmt(t.discount)}</strong></li>` : '') + `<li><span>Доставка</span><strong>${t.shipping ? fmt(t.shipping) : 'бесплатно'}</strong></li><li class="is-total"><span>Итого</span><strong>${fmt(t.total)}</strong></li>`;
      const pick = delivery === 'pickup';
      $('#coAddrWrap', dlg).hidden = pick; $('#co-addr', dlg).required = !pick;
    };
    form.addEventListener('change', renderSum); renderSum();
    dlg.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) { dlg.close(); openDrawer('cart'); } });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateForm(form)) return;
      const fd = Object.fromEntries(new FormData(form).entries()), t = Cart.totals(fd.delivery);
      const order = { id: 'T-' + Date.now().toString(36).slice(-5).toUpperCase(), date: new Date().toLocaleDateString('ru-RU'), items: Cart.items().map((i) => ({ id: i.id, title: i.title, qty: i.qty, price: i.price })), total: t.total, delivery: fd.delivery, pay: fd.pay, customer: { name: fd.name, phone: fd.phone, email: fd.email, address: fd.address || '' } };
      const orders = Store.get('orders', []); orders.push(order); Store.set('orders', orders.slice(-10));
      Store.set('profile', { name: fd.name, phone: fd.phone, email: fd.email });
      Cart.clear(); Store.set('promo', '');
      dlg.close(); dlg.remove();
      showOrderDone(order);
    });
    showDialog(dlg);
  }
  function showOrderDone(order) {
    const dlg = document.createElement('dialog');
    dlg.className = 'order-dialog'; dlg.setAttribute('aria-labelledby', 'done-title');
    const steps = ['Заказ принят', 'Менеджер позвонит в течение часа', 'Собираем и проверяем каждую клавишу', 'Отправляем и присылаем трек-номер'];
    dlg.innerHTML = `<div class="order-done"><div class="order-done__tick">${ic('check')}</div><h2 id="done-title" style="margin:0">Спасибо за заказ!</h2><p style="margin:0">Номер вашего заказа</p><div class="order-done__num">${esc(order.id)}</div>
      <ul class="timeline">${steps.map((s, i) => `<li style="--i:${i}">${s}</li>`).join('')}</ul><p style="color:var(--muted);font-size:.88rem">Это демонстрационная версия: заказ сохранён только на вашем устройстве.</p>
      <div class="hero__actions" style="justify-content:center"><a class="button" href="catalog.html">Продолжить покупки</a><button class="button button--secondary" type="button" data-close>Закрыть</button></div></div>`;
    document.body.append(dlg); wireDialog(dlg);
    dlg.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) dlg.close(); });
    dlg.addEventListener('close', () => dlg.remove());
    showDialog(dlg);
    setTimeout(() => { confetti(); Sound.ui('success'); }, 250);
  }

  /* ------------------------------------------------------------------
     Быстрый просмотр товара
     ------------------------------------------------------------------ */
  function openDetails(id) {
    const p = BY_ID[id], dlg = $('#product-details-dialog');
    if (!p || !dlg) return;
    $('#product-details-image').src = p.image; $('#product-details-image').alt = p.alt || p.title;
    $('#product-details-type').textContent = D.TYPES[p.type] || '';
    $('#product-details-title').textContent = p.title;
    $('#product-details-price').innerHTML = `<span class="visually-hidden">Цена: </span>${fmt(p.price)}${p.old ? ` <s class="price__old">${fmt(p.old)}</s>` : ''}`;
    $('#product-details-description').textContent = p.full;
    $('#product-details-specs').innerHTML = Object.entries(p.specs || {}).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
    const fav = $('#product-details-fav'); fav.dataset.id = id; fav.dataset.fav = id;
    $('#product-details-order').dataset.product = p.title;
    $('#product-details-cart').dataset.cartAdd = id;
    let rel = $('.product-details__related', dlg);
    if (!rel) { rel = document.createElement('div'); rel.className = 'product-details__related'; $('.product-details__content', dlg).append(rel); }
    const others = D.PRODUCTS.filter((x) => x.id !== id).sort((a, b) => (b.type === p.type) - (a.type === p.type) || b.rating - a.rating).slice(0, 4);
    rel.innerHTML = `<h3>Вам может понравиться</h3><div class="related">${others.map((o) => `<button class="related__item" type="button" data-related="${o.id}"><img src="${o.image}" alt="" loading="lazy"><span><strong>${esc(o.title)}</strong><span>${fmt(o.price)}</span></span></button>`).join('')}</div>`;
    const rec = Store.get('recent', []).filter((x) => x !== id); rec.unshift(id); Store.set('recent', rec.slice(0, 6));
    syncFavButtons();
    if (!dlg.open) showDialog(dlg);
    dlg.scrollTop = 0;
  }
  function initDetails() {
    const dlg = $('#product-details-dialog');
    if (!dlg) return;
    wireDialog(dlg);
    $('#close-product-details').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', (e) => {
      const r = e.target.closest('[data-related]');
      if (r) openDetails(r.dataset.related);
    });
    $('#product-details-order').addEventListener('click', (e) => { dlg.close(); openOrder({ product: e.currentTarget.dataset.product, topic: 'product' }); });
  }

  /* ------------------------------------------------------------------
     Диалог заявки (заказ товара / услуги)
     ------------------------------------------------------------------ */
  function openOrder({ product, service, topic }) {
    const dlg = $('#order-dialog'), form = $('#order-form');
    if (!dlg || !form) return;
    const label = $('#selected-product-label'), hid = $('#selected-product');
    const name = product || service || '';
    if (hid) hid.value = name;
    if (label) { label.hidden = !name; label.textContent = name ? (service ? 'Услуга: ' : 'Товар: ') + name : ''; }
    const sel = $('#order-topic'); if (sel && topic) sel.value = topic;
    const prof = Store.get('profile', {});
    ['name', 'email', 'phone'].forEach((n) => { const el = form.elements[n]; if (el && !el.value && prof[n]) el.value = prof[n]; });
    showDialog(dlg);
  }
  function initOrderForm() {
    const dlg = $('#order-dialog'), form = $('#order-form');
    if (!dlg || !form) return;
    wireDialog(dlg); liveValidate(form);
    const close = $('#close-order-dialog'); if (close) close.addEventListener('click', () => dlg.close());
    const reset = $('[data-reset]', form); if (reset) reset.addEventListener('click', () => resetForm(form));
    if (page === 'review') return; // отправку отзывов обрабатывает reviews.js
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateForm(form)) return;
      const fd = Object.fromEntries(new FormData(form).entries());
      const reqs = Store.get('requests', []); reqs.push({ ...fd, ts: Date.now() }); Store.set('requests', reqs.slice(-20));
      Store.set('profile', { name: fd.name, phone: fd.phone, email: fd.email });
      dlg.close(); resetForm(form);
      const msg = $('#success-message');
      if (msg) { msg.hidden = false; setTimeout(() => { msg.hidden = true; }, 4500); }
      Sound.ui('success'); confetti(70);
    });
  }

  /* ------------------------------------------------------------------
     Командная палитра (Ctrl+K или «/»)
     ------------------------------------------------------------------ */
  const PAGES = [['index.html', 'Главная', 'Витрина, популярное, FAQ'], ['catalog.html', 'Каталог', 'Все товары с фильтрами'], ['configurator.html', 'Конфигуратор', 'Соберите клавиатуру онлайн'],
    ['lab.html', 'Лаборатория', 'Звук, усилие, тест печати'], ['service.html', 'Услуги', 'Сборка, смазка, ремонт'], ['review.html', 'Отзывы', 'Мнения покупателей'], ['contacts.html', 'Контакты', 'Адрес, телефон, форма'],
    ['privacy.html', 'Конфиденциальность', 'Какие данные хранит сайт']];
  const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е');
  let palette = null, palItems = [], palIdx = 0;
  function paletteSource() {
    const act = [
      { kind: 'Действие', t: 'Переключить тему', sub: 'Светлая / тёмная', icon: 'moon', run: () => { const b = $('#themeToggle'); const r = b.getBoundingClientRect(); b.classList.remove('is-spinning'); setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', { x: r.left + r.width / 2, y: r.top + r.height / 2 }); } },
      { kind: 'Действие', t: 'Включить / выключить звук', sub: 'Звук нажатий клавиш', icon: 'sound-on', run: () => { setSound(!Sound.enabled); if (Sound.enabled) Sound.press('linear', 1); } },
      { kind: 'Действие', t: 'Открыть корзину', sub: `${Cart.count()} шт.`, icon: 'cart', run: () => openDrawer('cart') },
      { kind: 'Действие', t: 'Открыть избранное', sub: `${Fav.list().length} шт.`, icon: 'heart', run: () => openDrawer('fav') },
      { kind: 'Действие', t: 'Сравнение товаров', sub: 'До трёх позиций', icon: 'compare', run: () => openCompare() },
      { kind: 'Действие', t: 'Подобрать клавиатуру за минуту', sub: 'Три вопроса', icon: 'sparkle', run: () => openQuiz() }
    ];
    const rec = Store.get('recent', []);
    const prods = D.PRODUCTS.map((p) => ({ kind: 'Товар', t: p.title, sub: `${D.TYPES[p.type]} · ${fmt(p.price)}`, img: p.image, id: p.id, hay: norm([p.title, D.TYPES[p.type], p.short, p.type].join(' ')), recent: rec.indexOf(p.id) > -1, run: () => { if ($('#product-details-dialog')) openDetails(p.id); else location.href = 'catalog.html?q=' + encodeURIComponent(p.title); } }));
    const pages = PAGES.map(([h, t, s]) => ({ kind: 'Страница', t, sub: s, icon: 'arrow-right', hay: norm(t + ' ' + s), run: () => { location.href = h; } }));
    const srv = D.SERVICES.map((s) => ({ kind: 'Услуга', t: s.title, sub: `от ${fmt(s.price)} · ${s.time}`, icon: 'wrench', hay: norm(s.title), run: () => { location.href = 'service.html'; } }));
    act.forEach((a) => { a.hay = norm(a.t + ' ' + a.sub); });
    return { act, prods, pages, srv };
  }
  function renderPalette(q) {
    const src = paletteSource();
    q = norm(q || '').trim();
    let list;
    if (!q) list = [...src.prods.filter((p) => p.recent).slice(0, 3), ...src.act.slice(0, 4), ...src.pages.slice(0, 4)];
    else {
      const tokens = q.split(/\s+/);
      const rank = (i) => ({ 'Товар': 0, 'Услуга': 1, 'Страница': 2, 'Действие': 3 }[i.kind]) - (norm(i.t).replace(/^[^a-zа-я0-9]+/, '').startsWith(q) ? 0.5 : 0);
      list = [...src.prods, ...src.srv, ...src.pages, ...src.act].filter((i) => tokens.every((t) => i.hay.indexOf(t) > -1)).sort((a, b) => rank(a) - rank(b)).slice(0, 9);
    }
    palItems = list; palIdx = Math.min(palIdx, Math.max(0, list.length - 1));
    const box = $('.palette__list', palette);
    if (!list.length) { box.innerHTML = '<p class="palette__empty">Ничего не найдено. Попробуйте «Nova», «Лён» или «тема».</p>'; return; }
    let last = '', html = '';
    list.forEach((it, i) => {
      if (it.kind !== last) { html += `<div class="palette__group" role="presentation">${it.kind === 'Товар' && !q ? 'Недавно смотрели' : it.kind}</div>`; last = it.kind; }
      html += `<div class="palette__item" role="option" id="pal-${i}" data-i="${i}" aria-selected="${i === palIdx}">${it.img ? `<img class="palette__thumb" src="${it.img}" alt="">` : `<span class="palette__thumb">${ic(it.icon || 'arrow-right')}</span>`}<div><p class="palette__title">${esc(it.t)}</p><p class="palette__sub">${esc(it.sub)}</p></div><span class="palette__kind">${it.kind}</span></div>`;
    });
    box.innerHTML = html;
  }
  function paletteMark() {
    $$('.palette__item', palette).forEach((el) => el.setAttribute('aria-selected', +el.dataset.i === palIdx ? 'true' : 'false'));
    const cur = $('#pal-' + palIdx, palette); if (cur) cur.scrollIntoView({ block: 'nearest' });
    $('.palette__input', palette).setAttribute('aria-activedescendant', 'pal-' + palIdx);
  }
  function runPalette(i) {
    const it = palItems[i];
    if (!it) return;
    palette.close();
    setTimeout(() => it.run(), 60);
  }
  function openPalette() {
    if (!palette) {
      palette = document.createElement('dialog');
      palette.className = 'palette'; palette.setAttribute('aria-label', 'Быстрый поиск');
      palette.innerHTML = `<div class="palette__bar">${ic('search')}<input class="palette__input" type="text" enterkeyhint="search" spellcheck="false" placeholder="Товар, страница или действие…" aria-label="Поиск" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="palList"><kbd>Esc</kbd></div><div class="palette__list" id="palList" role="listbox" aria-label="Результаты"></div><p class="palette__hint"><span><kbd>↑</kbd> <kbd>↓</kbd> выбор</span><span><kbd>Enter</kbd> открыть</span><span><kbd>Ctrl</kbd> + <kbd>K</kbd> в любой момент</span></p>`;
      document.body.append(palette); wireDialog(palette);
      const input = $('.palette__input', palette);
      input.addEventListener('input', () => { palIdx = 0; renderPalette(input.value); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); palIdx = (palIdx + 1) % Math.max(1, palItems.length); paletteMark(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); palIdx = (palIdx - 1 + palItems.length) % Math.max(1, palItems.length); paletteMark(); }
        else if (e.key === 'Enter') { e.preventDefault(); runPalette(palIdx); }
      });
      palette.addEventListener('click', (e) => { const it = e.target.closest('.palette__item'); if (it) runPalette(+it.dataset.i); });
      palette.addEventListener('mousemove', (e) => { const it = e.target.closest('.palette__item'); if (it && +it.dataset.i !== palIdx) { palIdx = +it.dataset.i; paletteMark(); } });
    }
    if (palette.open) return;
    $('.palette__input', palette).value = ''; palIdx = 0; renderPalette('');
    showDialog(palette); $('.palette__input', palette).focus();
  }

  /* ------------------------------------------------------------------
     «Подобрать за минуту»
     ------------------------------------------------------------------ */
  const QUIZ = [
    { q: 'Для чего вам клавиатура?', k: 'use', o: [['text', 'Работа и тексты', 'много печатаю каждый день', 'headset'], ['game', 'Игры', 'важен быстрый отклик', 'bolt'], ['code', 'Программирование', 'нужна точность и удобные слои', 'keyboard'], ['all', 'Всё сразу', 'и ещё чтобы красиво смотрелась', 'sparkle']] },
    { q: 'Какой звук вам по душе?', k: 'sound', o: [['silent', 'Тихий', 'чтобы не мешать другим', 'sound-off'], ['linear', 'Мягкий и глубокий', 'плавный «ток»', 'waves'], ['tactile', 'Чёткий', 'чувствуется момент срабатывания', 'target'], ['clicky', 'Громкий щелчок', 'как у печатной машинки', 'sound-on']] },
    { q: 'Какой размер удобнее?', k: 'size', o: [['60', 'Компактный 60%', 'освободит место на столе', 'box'], ['65', 'Золотая середина 65%', 'есть стрелки и ряд цифр', 'keyboard'], ['75', 'С функциональным рядом 75%', 'F1–F12 под рукой', 'grid'], ['any', 'Не знаю', 'подскажите', 'sparkle']] },
    { q: 'Какой бюджет на клавиатуру?', k: 'budget', o: [['low', 'До 8 000 ₽', 'хороший старт', 'tag'], ['mid', '8 000 – 12 000 ₽', 'оптимальный баланс', 'tag'], ['high', 'От 12 000 ₽', 'лучшее без компромиссов', 'trophy']] }
  ];
  function recommend(a) {
    let kb = a.size === '60' ? 'mini-60' : a.size === '65' ? 'nova-65' : a.size === '75' ? (a.budget === 'high' ? 'atlas-80' : 'retro-75') : (a.budget === 'low' ? 'mini-60' : a.budget === 'mid' ? 'retro-75' : 'nova-65');
    if (a.budget === 'low' && (kb === 'nova-65' || kb === 'atlas-80')) kb = 'mini-60';
    const sw = { silent: 'tishina-silent', linear: 'len-linear', tactile: 'klen-tactile', clicky: 'shchelchok-clicky' }[a.sound];
    const caps = a.use === 'game' || a.use === 'code' ? 'midnight-keycaps' : a.use === 'all' ? 'artisan-cat' : 'sakura-keycaps';
    const why = {
      kb: { 'mini-60': 'Компактная и доступная — стол свободен', 'nova-65': 'Алюминий, gasket и глубокий звук', 'retro-75': 'Ретро-стиль с функциональным рядом', 'atlas-80': 'Флагман с ручкой и подсветкой' }[kb],
      sw: { silent: 'Тихие демпфированные переключатели', linear: 'Плавный ход и мягкий звук', tactile: 'Ощутимый «бугорок» срабатывания', clicky: 'Звонкий щелчок на каждое нажатие' }[a.sound],
      caps: caps === 'artisan-cat' ? 'Акцент на Esc — для характера' : caps === 'midnight-keycaps' ? 'Тёмный набор — идеален с подсветкой' : 'Нежные цвета — приятно работать каждый день'
    };
    return [['Клавиатура', kb, why.kb], ['Переключатели', sw, why.sw], ['Кейкапы', caps, why.caps]];
  }
  function openQuiz() {
    let dlg = $('#quiz-dialog');
    if (dlg) dlg.remove();
    dlg = document.createElement('dialog');
    dlg.id = 'quiz-dialog'; dlg.className = 'quiz'; dlg.setAttribute('aria-labelledby', 'quiz-q');
    document.body.append(dlg); wireDialog(dlg);
    const ans = {}; let step = 0;
    const render = () => {
      const bar = (step / QUIZ.length) * 100;
      if (step < QUIZ.length) {
        const s = QUIZ[step];
        dlg.innerHTML = `<div class="quiz__top"><span class="quiz__step">Вопрос ${step + 1} из ${QUIZ.length}</span><button class="icon-btn" type="button" data-qclose aria-label="Закрыть">${ic('close')}</button></div><div class="quiz__bar"><i style="width:${bar}%"></i></div>
          <h2 class="quiz__q" id="quiz-q">${s.q}</h2><div class="quiz__opts">${s.o.map((o) => `<button class="quiz__opt" type="button" data-a="${o[0]}"><span class="quiz__emoji">${ic(o[3])}</span><span>${o[1]}<small>${o[2]}</small></span></button>`).join('')}</div>`;
        requestAnimationFrame(() => { const i = $('.quiz__bar i', dlg); if (i) i.style.width = ((step + 1) / QUIZ.length * 100) + '%'; });
      } else {
        const rec = recommend(ans);
        const total = rec.reduce((s, r) => s + BY_ID[r[1]].price, 0);
        dlg.innerHTML = `<div class="quiz__top"><span class="quiz__step">Готово</span><button class="icon-btn" type="button" data-qclose aria-label="Закрыть">${ic('close')}</button></div><div class="quiz__bar"><i style="width:100%"></i></div>
          <h2 class="quiz__q" id="quiz-q">Ваша идеальная связка</h2><div class="quiz__result">${rec.map((r) => { const p = BY_ID[r[1]]; return `<div class="quiz__rec"><img src="${p.image}" alt=""><div><p class="quiz__why">${r[0]}</p><h3>${esc(p.title)}</h3><p>${esc(r[2])}</p><button class="chip-btn" type="button" data-qopen="${p.id}">Подробнее · ${fmt(p.price)}</button></div></div>`; }).join('')}
          <div class="form-actions" style="justify-content:space-between"><button class="button button--ghost" type="button" data-qagain>Пройти заново</button><button class="button" type="button" data-qcart>${ic('cart')} Всё в корзину · ${fmt(total)}</button></div></div>`;
        Sound.ui('success');
      }
    };
    dlg.addEventListener('click', (e) => {
      if (e.target.closest('[data-qclose]')) return dlg.close();
      const a = e.target.closest('[data-a]');
      if (a) { ans[QUIZ[step].k] = a.dataset.a; step++; render(); }
      if (e.target.closest('[data-qagain]')) { step = 0; render(); }
      const op = e.target.closest('[data-qopen]');
      if (op) { dlg.close(); const id = op.dataset.qopen; if ($('#product-details-dialog')) openDetails(id); else location.href = 'catalog.html?q=' + encodeURIComponent(BY_ID[id].title); }
      if (e.target.closest('[data-qcart]')) { recommend(ans).forEach((r) => Cart.add(r[1], 1)); dlg.close(); Sound.ui('add'); toast('Подборка добавлена в корзину', { icon: 'cart', action: 'Открыть', onAction: () => openDrawer('cart') }); }
    });
    render(); showDialog(dlg);
  }

  /* ------------------------------------------------------------------
     Уведомление о хранении данных, подписка, обратная связь
     ------------------------------------------------------------------ */
  function initNotice() {
    if (Store.get('notice', false)) return;
    const n = document.createElement('div');
    n.className = 'notice'; n.setAttribute('role', 'region'); n.setAttribute('aria-label', 'Уведомление о данных');
    n.innerHTML = `<p>Сайт хранит корзину, избранное и настройки только в вашем браузере. Данные никуда не отправляются. <a href="privacy.html">Подробнее</a></p><button class="button button--sm" type="button" id="noticeOk">Понятно</button>`;
    setTimeout(() => document.body.append(n), 1200);
    n.addEventListener('click', (e) => { if (e.target.closest('#noticeOk')) { Store.set('notice', true); n.remove(); } });
  }
  function initSubscribe() {
    const f = $('#subscribe-form');
    if (!f) return;
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      const i = $('input', f), v = i.value.trim();
      if (!EMAIL_RE.test(v)) { i.classList.add('is-invalid'); i.focus(); Sound.ui('error'); toast('Введите корректный e-mail', { icon: 'mail' }); return; }
      i.classList.remove('is-invalid');
      const list = Store.get('subscribed', []); if (list.indexOf(v) < 0) list.push(v); Store.set('subscribed', list);
      f.reset(); Sound.ui('success'); toast('Спасибо! Вы подписаны на новости', { icon: 'mail' }); confetti(60);
    });
    $('input', f).addEventListener('input', (e) => e.target.classList.remove('is-invalid'));
  }
  function initFeedback() {
    const f = $('#feedback-form');
    if (!f) return;
    liveValidate(f);
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateForm(f)) return;
      const fd = Object.fromEntries(new FormData(f).entries());
      const list = Store.get('feedback', []); list.push({ ...fd, ts: Date.now() }); Store.set('feedback', list.slice(-20));
      resetForm(f); Sound.ui('success'); toast('Сообщение отправлено — ответим в течение рабочего дня', { icon: 'mail', ms: 5000 }); confetti(80);
    });
  }

  /* ------------------------------------------------------------------
     Общая делегация кликов и запуск
     ------------------------------------------------------------------ */
  function wireClicks() {
    document.addEventListener('click', (e) => {
      const t = e.target;
      let el;
      if ((el = t.closest('[data-open-cart]'))) { e.preventDefault(); return openDrawer('cart'); }
      if ((el = t.closest('[data-open-fav]'))) { e.preventDefault(); return openDrawer('fav'); }
      if ((el = t.closest('[data-open-compare]'))) { e.preventDefault(); return openCompare(); }
      if ((el = t.closest('[data-open-palette]'))) { e.preventDefault(); return openPalette(); }
      if ((el = t.closest('[data-open-quiz]'))) { e.preventDefault(); return openQuiz(); }
      if ((el = t.closest('[data-fav]')) && !el.id) {
        const id = el.dataset.fav, added = Fav.toggle(id), p = BY_ID[id];
        el.classList.remove('is-pop'); void el.offsetWidth; el.classList.add('is-pop');
        Sound.ui(added ? 'add' : 'tap');
        toast(added ? `«${p.title}» в избранном` : 'Убрано из избранного', { icon: 'heart', action: added ? 'Открыть' : 'Вернуть', onAction: () => { if (added) openDrawer('fav'); else Fav.toggle(id); } });
        return;
      }
      if (t.closest('#product-details-fav')) {
        const b = $('#product-details-fav'), id = b.dataset.id, added = Fav.toggle(id);
        toast(added ? 'Добавлено в избранное' : 'Убрано из избранного', { icon: 'heart' }); return;
      }
      if ((el = t.closest('[data-compare]'))) {
        const r = Compare.toggle(el.dataset.compare);
        if (r === 'full') { Sound.ui('error'); return toast('Можно сравнить не более трёх товаров', { icon: 'compare' }); }
        Sound.ui('tap');
        toast(r === 'added' ? 'Добавлено к сравнению' : 'Убрано из сравнения', { icon: 'compare', action: Compare.list().length > 1 ? 'Сравнить' : '', onAction: openCompare });
        return;
      }
      if ((el = t.closest('[data-cart-add]'))) { e.preventDefault(); return addToCart(el.dataset.cartAdd, el); }
      if ((el = t.closest('.product-card__button'))) { return openOrder({ product: el.dataset.product, topic: 'product' }); }
      if ((el = t.closest('[data-service]'))) { return openOrder({ service: el.dataset.service, topic: 'service' }); }
      if ((el = t.closest('.product-card__details-button, .product-card__media img'))) { const card = el.closest('.product-card'); if (card) return openDetails(card.dataset.id); }
    });
    document.addEventListener('keydown', (e) => {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      const typing = /INPUT|TEXTAREA|SELECT/.test(tag) || (document.activeElement && document.activeElement.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (palette && palette.open) palette.close(); else openPalette(); }
      else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey && !$('dialog[open]')) { e.preventDefault(); openPalette(); }
    });
  }

  function initPrivacy() {
    const b = $('#clearData');
    if (!b) return;
    b.addEventListener('click', () => confirmDialog({ title: 'Удалить данные?', text: 'Корзина, избранное, отзывы, заказы и настройки на этом устройстве будут удалены.', ok: 'Удалить' }).then((v) => { if (v) { Store.clearAll(); updateCounts(); syncFavButtons(); toast('Данные удалены', { icon: 'trash' }); } }));
  }

  function registerSW() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
      addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }
  }

  // Публичный интерфейс для страничных скриптов
  const Tact = { D, $, $$, esc, fmt, ic, plural, Store, Sound, setSound, toast, confetti, flyTo, confirmDialog, showDialog, wireDialog, on, emit, reduceMotion, finePointer,
    Cart, Fav, Compare, BY_ID, addToCart, openDrawer, openCompare, openDetails, openOrder, openQuiz, openPalette, validateForm, liveValidate, resetForm, showError, messageFor, maskPhone,
    ready(fn) { if (booted) fn(); else readyQ.push(fn); } };
  window.Tact = Tact;
  let booted = false; const readyQ = [];

  function boot() {
    initTheme(); initSound(); initChrome();
    wireClicks(); initDetails(); initOrderForm(); initSubscribe(); initFeedback(); initPrivacy(); initNotice();
    ['cart', 'fav', 'compare'].forEach((k) => on('store:' + k, () => {
      updateCounts(k);
      if (k === 'fav') syncFavButtons();
      if (k === 'compare') { syncCompareButtons(); if ($('#compare-dialog') && $('#compare-dialog').open) renderCompare(); }
      if (drawer && drawer.open) renderDrawer();
    }));
    on('store:promo', () => { if (drawer && drawer.open) renderDrawer(); });
    updateCounts(); syncFavButtons(); syncCompareButtons();
    booted = true; readyQ.splice(0).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    registerSW();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
