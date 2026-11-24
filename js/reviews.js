/* Тактиль — reviews.js: отзывы (демо-данные + свои отзывы в localStorage), фильтры, форма */
(function () {
  'use strict';
  const T = window.Tact;
  T.ready(() => {
    const { $, $$, esc, Store, D, BY_ID, toast, confetti, Sound, plural } = T;
    const grid = $('#reviewGrid'); if (!grid) return;
    const PAGE = 9;
    const st = { product: '', stars: 0, sort: 'new', shown: PAGE, fresh: null };
    const seed = D.REVIEWS.map((r, i) => ({ id: 's' + i, name: r.name, product: r.product, rating: r.rating, text: r.text, ts: Date.now() - r.ago * 864e5, own: false }));
    const mine = () => Store.get('reviews', []).map((r) => Object.assign({ own: true }, r));
    const all = () => seed.concat(mine());
    const stars = (n) => `<span class="stars" role="img" aria-label="Оценка ${n} из 5">${[1, 2, 3, 4, 5].map((i) => `<span class="stars__s${i <= n ? ' is-on' : ''}">★</span>`).join('')}</span>`;
    const when = (ts) => { const d = Math.floor((Date.now() - ts) / 864e5); return d < 1 ? 'сегодня' : d < 2 ? 'вчера' : d < 31 ? d + ' ' + plural(d, ['день', 'дня', 'дней']) + ' назад' : new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }); };

    function card(r) {
      const p = BY_ID[r.product];
      return `<article class="review_examp${r.id === st.fresh ? ' is-new' : ''}" style="--hue:${(r.name.charCodeAt(0) * 37) % 360}" data-id="${r.id}">
        <header class="review_examp__head"><span class="review_examp__avatar" aria-hidden="true">${esc(r.name[0].toUpperCase())}</span><div><p class="review_examp__name">${esc(r.name)}</p><p class="review_examp__product">${esc(p ? p.title : '')}</p></div><span class="review_examp__stars">${stars(r.rating)}</span></header>
        <p class="review_examp__text">${esc(r.text)}</p><p class="review_examp__date">${when(r.ts)}${r.own ? ' · ваш отзыв' : ''}</p>
        ${r.own ? `<button class="chip-btn review_examp__del" type="button" data-del="${r.id}">${T.ic('trash')} Удалить</button>` : ''}</article>`;
    }
    function summary(list) {
      const n = list.length, avg = n ? list.reduce((s, r) => s + r.rating, 0) / n : 0, cnt = [0, 0, 0, 0, 0, 0];
      list.forEach((r) => cnt[r.rating]++);
      $('#reviewSummary').innerHTML = `<div class="review-summary__score"><div class="review-summary__num">${avg ? avg.toFixed(1).replace('.', ',') : '—'}</div>${stars(Math.round(avg))}<div class="review-summary__count">${n} ${plural(n, ['отзыв', 'отзыва', 'отзывов'])}</div></div>
        <div class="review-bars">${[5, 4, 3, 2, 1].map((s) => `<div class="review-bars__row"><span>${s}★</span><span class="review-bars__track"><i class="review-bars__fill" data-w="${n ? cnt[s] / n * 100 : 0}"></i></span><span>${cnt[s]}</span></div>`).join('')}</div>`;
      requestAnimationFrame(() => requestAnimationFrame(() => $$('.review-bars__fill').forEach((f) => { f.style.width = f.dataset.w + '%'; })));
    }
    function render() {
      const base = all().filter((r) => !st.product || r.product === st.product);
      summary(base);
      let list = base.filter((r) => !st.stars || r.rating === st.stars);
      list.sort(st.sort === 'high' ? (a, b) => b.rating - a.rating || b.ts - a.ts : st.sort === 'low' ? (a, b) => a.rating - b.rating || b.ts - a.ts : (a, b) => b.ts - a.ts);
      grid.innerHTML = list.slice(0, st.shown).map(card).join('');
      $('#reviewEmpty').hidden = list.length > 0; $('#reviewMore').hidden = list.length <= st.shown;
      $('#reviewMore').textContent = `Показать ещё (${Math.max(0, list.length - st.shown)})`;
    }
    $('#rev-product').addEventListener('change', (e) => { st.product = e.target.value; st.shown = PAGE; render(); });
    $('#rev-sort').addEventListener('change', (e) => { st.sort = e.target.value; render(); });
    $('#rev-stars').addEventListener('click', (e) => {
      const b = e.target.closest('[data-stars]'); if (!b) return;
      st.stars = +b.dataset.stars; st.shown = PAGE;
      $$('#rev-stars .seg__btn').forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      render();
    });
    $('#reviewMore').addEventListener('click', () => { st.shown += PAGE; render(); });
    grid.addEventListener('click', (e) => {
      const d = e.target.closest('[data-del]'); if (!d) return;
      T.confirmDialog({ title: 'Удалить отзыв?', text: 'Ваш отзыв будет удалён с этого устройства.', ok: 'Удалить' }).then((v) => {
        if (v) { Store.set('reviews', Store.get('reviews', []).filter((r) => r.id !== d.dataset.del)); render(); toast('Отзыв удалён', { icon: 'trash' }); }
      });
    });

    /* ---- форма ---- */
    const dlg = $('#order-dialog'), form = $('#order-form'), counter = $('#review-counter'), text = $('#review-text');
    const openForm = () => { const pf = Store.get('profile', {}); if (!form.elements.name.value && pf.name) form.elements.name.value = pf.name; if (!form.elements.email.value && pf.email) form.elements.email.value = pf.email; T.showDialog(dlg); };
    $('#reviewButton').addEventListener('click', openForm);
    text.addEventListener('input', () => { counter.textContent = text.value.length; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!T.validateForm(form)) return;
      const fd = new FormData(form);
      const r = { id: 'u' + Date.now(), name: String(fd.get('name')).trim(), product: fd.get('reviewProduct'), rating: +fd.get('rating'), text: String(fd.get('reviewText')).trim(), ts: Date.now() };
      Store.set('reviews', Store.get('reviews', []).concat([r]).slice(-30));
      Store.set('profile', Object.assign(Store.get('profile', {}), { name: r.name, email: String(fd.get('email')) }));
      dlg.close(); T.resetForm(form); counter.textContent = '0';
      st.product = ''; st.stars = 0; st.sort = 'new'; st.fresh = r.id; $('#rev-product').value = ''; $('#rev-sort').value = 'new';
      $$('#rev-stars .seg__btn').forEach((x) => { const on = x.dataset.stars === '0'; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
      render(); Sound.ui('success'); confetti(80); toast('Спасибо за отзыв!', { icon: 'star' });
      const el = $(`[data-id="${r.id}"]`, grid); if (el) el.scrollIntoView({ behavior: T.reduceMotion ? 'auto' : 'smooth', block: 'center' });
    });
    const pre = new URLSearchParams(location.search).get('product');
    if (pre && BY_ID[pre]) { $('#review-product').value = pre; $('#rev-product').value = pre; st.product = pre; }
    render();
  });
})();
