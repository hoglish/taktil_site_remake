/* Тактиль — home.js: интерактивная клавиатура в hero, быстрая проверка звука, демо-конфигуратор */
(function () {
  'use strict';
  const T = window.Tact;
  T.ready(() => {
    const { $, $$, Sound, D, esc } = T;
    const SW_COLORS = { linear: '#E63946', tactile: '#C9803A', clicky: '#3A86FF', silent: '#BDB6A2' };
    let kind = 'linear';

    /* ---------- Клавиатура в hero ---------- */
    const host = $('#heroBoard');
    if (host) {
      const typedEl = $('#heroTyped');
      let text = '';
      const show = () => { typedEl.innerHTML = '<bdi>' + (text ? esc(text) : 'Нажмите любую клавишу…') + '</bdi>'; };
      const add = (ch) => { text = (text + ch).slice(-36); show(); };
      let inView = true;
      const kb = new T.Keyboard(host, {
        layout: '65', caseId: 'graphite', theme: 'classic', glow: false, mobile: true,
        onPress: (code) => Sound.press(kind, T.Keyboard.pitch(code)),
        onRelease: (code) => Sound.release(kind, T.Keyboard.pitch(code)),
        onPointerKey: (code) => {
          if (code === 'Backspace') { text = text.slice(0, -1); show(); }
          else if (code === 'Enter') { text = ''; show(); }
          else { const c = kb.charFor(code); if (c) add(c); }
        }
      });
      kb.listenWindow({
        armed: () => inView,
        prevent: (e) => (e.code === 'Space' || e.code.indexOf('Arrow') === 0 || e.code === 'Tab' || e.code === 'Backspace' || e.code === 'Slash' || e.code === 'Quote') && (host.matches(':hover') || host.contains(document.activeElement) || document.activeElement === host),
        onKeyDown: (e) => {
          if (e.key === 'Backspace') { text = text.slice(0, -1); show(); }
          else if (e.key === 'Enter') { text = ''; show(); }
          else if (e.key.length === 1) add(e.key);
        }
      });
      if ('IntersectionObserver' in window) new IntersectionObserver((es) => { inView = es[0].isIntersecting; }, { threshold: 0.2 }).observe(host);
      setTimeout(() => kb.wave(14), 500);

      // тип переключателя
      $$('#heroSwitch .seg__btn').forEach((b) => b.addEventListener('click', () => {
        kind = b.dataset.kind;
        $$('#heroSwitch .seg__btn').forEach((x) => { const on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        Sound.press(kind, 1);
      }));
      // цвет кейкапов
      const themeBox = $('#heroTheme');
      if (themeBox) {
        ['classic', 'sakura', 'midnight', 'matcha', 'sunset', 'ocean'].forEach((id, i) => {
          const th = D.THEMES[id], b = document.createElement('button');
          b.type = 'button'; b.className = 'seg__btn' + (i === 0 ? ' is-active' : ''); b.style.setProperty('--sw', `linear-gradient(135deg, ${th.alpha} 55%, ${th.accent} 55%)`);
          b.setAttribute('aria-label', 'Цвет кейкапов: ' + (D.CFG.themes.find((t) => t.id === id) || {}).name); b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
          b.addEventListener('click', () => {
            kb.setTheme(id); kb.setGlow(id === 'midnight' || id === 'ocean');
            $$('.seg__btn', themeBox).forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
            Sound.ui('tap');
          });
          themeBox.append(b);
        });
        $$('.seg__btn', themeBox).forEach((b) => { b.style.background = b.style.getPropertyValue('--sw'); });
      }
    }

    /* ---------- Быстрая проверка звука ---------- */
    const cards = $('#soundCards');
    if (cards) {
      D.CFG.switches.forEach((s) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'mini-switch'; b.style.setProperty('--sc', SW_COLORS[s.id]); b.setAttribute('data-silent', '');
        b.innerHTML = `<span class="mini-switch__stem"></span><span class="mini-switch__name">${esc(s.name)}</span><span class="mini-switch__hint">${esc(s.hint)}</span><span class="mini-switch__wave"><i></i><i></i><i></i><i></i></span>`;
        let down = false;
        const press = () => { if (down) return; down = true; b.classList.add('is-down'); Sound.press(s.id, 1, true); };
        const rel = () => { if (!down) return; down = false; b.classList.remove('is-down'); Sound.release(s.id, 1, true); };
        b.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
        ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, rel));
        b.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); press(); } });
        b.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') rel(); });
        b.setAttribute('aria-label', `Послушать переключатель «${s.name}» (${s.hint})`);
        cards.append(b);
      });
    }

    /* ---------- Демо-конфигуратор (автосмена цветов) ---------- */
    const tb = $('#teaserBoard');
    if (tb) {
      const kb2 = new T.Keyboard(tb, { layout: '65', caseId: 'white', theme: 'sakura', interactive: false });
      tb.style.pointerEvents = 'none';
      const combos = [['white', 'sakura'], ['graphite', 'midnight'], ['beige', 'classic'], ['navy', 'ocean'], ['mint', 'matcha'], ['pink', 'sunset'], ['graphite', 'cosmos']];
      let i = 0, vis = false;
      if ('IntersectionObserver' in window) new IntersectionObserver((es) => { vis = es[0].isIntersecting; }, { threshold: 0.3 }).observe(tb);
      setInterval(() => { if (!vis || document.hidden) return; i = (i + 1) % combos.length; kb2.setCase(combos[i][0]); kb2.setTheme(combos[i][1]); kb2.setGlow(combos[i][1] === 'midnight' || combos[i][1] === 'cosmos'); }, 2600);
    }
  });
})();
