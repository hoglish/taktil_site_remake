/* Тактиль — catalog.js: фильтры, поиск, сортировка, вид, синхронизация с адресной строкой */
(function () {
  'use strict';
  const T = window.Tact;
  T.ready(() => {
    const { $, $$, esc, fmt, plural, D } = T;
    const grid = $('#productGrid'); if (!grid) return;
    const cards = $$('.product-card', grid);
    const form = $('.filters-form');
    const search = $('#catalog-search'), sortSel = $('#catalog-sort'), status = $('#catalogStatus'), empty = $('#catalogEmpty'), chips = $('#activeFilters');
    const priceFrom = $('#price-from'), priceTo = $('#price-to'), range = $('#range-max');
    const TYPE_NAMES = D.TYPES;
    const state = { cats: new Set(), types: new Set(), from: '', to: '', q: '', sort: 'popular', view: 'grid' };

    const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е');
    cards.forEach((c, i) => { c._i = i; c._hay = norm([c.dataset.title, c.dataset.type, TYPE_NAMES[c.dataset.type], c.textContent].join(' ')); });
    const score = (c) => ({ popular: 2, new: 1 }[c.dataset.category] || 0) * 10 + parseFloat(c.dataset.rating);

    function readUrl() {
      const p = new URLSearchParams(location.search);
      (p.get('cat') || p.get('category') || '').split(',').filter((x) => x && x !== 'all').forEach((x) => state.cats.add(x));
      (p.get('type') || '').split(',').filter(Boolean).forEach((x) => state.types.add(x));
      state.from = p.get('from') || ''; state.to = p.get('to') || ''; state.q = p.get('q') || '';
      state.sort = p.get('sort') || 'popular'; state.view = p.get('view') || 'grid';
    }
    function writeUrl() {
      const p = new URLSearchParams();
      if (state.cats.size) p.set('cat', [...state.cats].join(','));
      if (state.types.size) p.set('type', [...state.types].join(','));
      if (state.from) p.set('from', state.from); if (state.to) p.set('to', state.to);
      if (state.q) p.set('q', state.q); if (state.sort !== 'popular') p.set('sort', state.sort); if (state.view !== 'grid') p.set('view', state.view);
      const s = p.toString();
      try { history.replaceState(null, '', location.pathname + (s ? '?' + s : '')); } catch (_) { /* file:// */ }
    }
    function syncControls() {
      const all = $('input[name="category"][value="all"]', form);
      $$('input[name="category"]', form).forEach((i) => { if (i.value !== 'all') i.checked = state.cats.has(i.value); });
      all.checked = !state.cats.size;
      $$('input[name="type"]', form).forEach((i) => { i.checked = state.types.has(i.value); });
      priceFrom.value = state.from; priceTo.value = state.to; range.value = state.to || range.max;
      search.value = state.q; sortSel.value = state.sort;
      grid.classList.toggle('product-grid--list', state.view === 'list');
      $$('[data-view]').forEach((b) => { const on = b.dataset.view === state.view; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    }
    function match(c) {
      const price = +c.dataset.price;
      if (state.cats.size && !state.cats.has(c.dataset.category)) return false;
      if (state.types.size && !state.types.has(c.dataset.type)) return false;
      if (state.from !== '' && price < +state.from) return false;
      if (state.to !== '' && price > +state.to) return false;
      if (state.q) { const t = norm(state.q).trim().split(/\s+/); if (!t.every((w) => c._hay.indexOf(w) > -1)) return false; }
      return true;
    }
    const sorters = {
      popular: (a, b) => score(b) - score(a) || a._i - b._i,
      'price-asc': (a, b) => +a.dataset.price - +b.dataset.price,
      'price-desc': (a, b) => +b.dataset.price - +a.dataset.price,
      rating: (a, b) => parseFloat(b.dataset.rating) - parseFloat(a.dataset.rating) || a._i - b._i,
      name: (a, b) => a.dataset.title.localeCompare(b.dataset.title, 'ru')
    };
    function apply(animate = true) {
      const was = new Set(cards.filter((c) => !c.classList.contains('is-hidden')));
      const shown = cards.filter(match).sort(sorters[state.sort] || sorters.popular);
      cards.forEach((c) => c.classList.add('is-hidden'));
      shown.forEach((c, i) => {
        grid.append(c); c.classList.remove('is-hidden');
        c.classList.remove('is-entering');
        if (animate && !T.reduceMotion) { c.style.setProperty('--i', Math.min(i, 10)); void c.offsetWidth; c.classList.add('is-entering'); }
      });
      empty.hidden = shown.length > 0; grid.hidden = !shown.length;
      status.textContent = `Найдено: ${shown.length} из ${cards.length} ${plural(cards.length, ['товара', 'товаров', 'товаров'])}`;
      renderChips(); writeUrl();
    }
    function renderChips() {
      const list = [];
      state.cats.forEach((c) => list.push([{ popular: 'Популярные', new: 'Новинки' }[c] || c, () => state.cats.delete(c)]));
      state.types.forEach((t) => list.push([TYPE_NAMES[t], () => state.types.delete(t)]));
      if (state.from) list.push([`от ${fmt(+state.from)}`, () => { state.from = ''; }]);
      if (state.to) list.push([`до ${fmt(+state.to)}`, () => { state.to = ''; }]);
      if (state.q) list.push([`«${state.q}»`, () => { state.q = ''; }]);
      chips.textContent = '';
      list.forEach(([label, rm]) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chip-btn'; b.setAttribute('aria-pressed', 'true'); b.setAttribute('aria-label', 'Убрать фильтр: ' + label); b.textContent = label;
        b.addEventListener('click', () => { rm(); syncControls(); apply(); }); chips.append(b);
      });
    }
    function readForm() {
      state.cats = new Set($$('input[name="category"]:checked', form).map((i) => i.value).filter((v) => v !== 'all'));
      state.types = new Set($$('input[name="type"]:checked', form).map((i) => i.value));
      state.from = priceFrom.value; state.to = priceTo.value;
    }
    form.addEventListener('change', (e) => {
      if (e.target.name === 'category') {
        if (e.target.value === 'all' && e.target.checked) $$('input[name="category"]:not([value="all"])', form).forEach((i) => { i.checked = false; });
        else if (e.target.value !== 'all' && e.target.checked) $('input[name="category"][value="all"]', form).checked = false;
      }
      readForm(); if (!state.cats.size) $('input[name="category"][value="all"]', form).checked = true; apply();
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); readForm(); apply(); closeFilters(); });
    priceFrom.addEventListener('input', () => { state.from = priceFrom.value; apply(false); });
    priceTo.addEventListener('input', () => { state.to = priceTo.value; range.value = state.to || range.max; apply(false); });
    range.addEventListener('input', () => { state.to = +range.value >= +range.max ? '' : range.value; priceTo.value = state.to; apply(false); });
    let tm; search.addEventListener('input', () => { clearTimeout(tm); tm = setTimeout(() => { state.q = search.value; apply(false); }, 180); });
    sortSel.addEventListener('change', () => { state.sort = sortSel.value; apply(); });
    $$('[data-view]').forEach((b) => b.addEventListener('click', () => { state.view = b.dataset.view; syncControls(); apply(false); }));
    function resetAll() { state.cats.clear(); state.types.clear(); state.from = state.to = state.q = ''; state.sort = 'popular'; syncControls(); apply(); }
    $('#filtersReset').addEventListener('click', (e) => { e.preventDefault(); resetAll(); });
    $('#emptyReset').addEventListener('click', resetAll);

    // мобильная панель фильтров
    const panel = $('.catalog-filters'), back = $('#filtersBackdrop');
    function openFilters() { panel.classList.add('is-open'); back.classList.add('is-open'); }
    function closeFilters() { panel.classList.remove('is-open'); back.classList.remove('is-open'); }
    $('#filtersOpen').addEventListener('click', openFilters); $('#filtersClose').addEventListener('click', closeFilters); back.addEventListener('click', closeFilters);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFilters(); });

    readUrl(); syncControls(); apply();
  });
})();
