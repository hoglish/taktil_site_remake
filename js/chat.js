/* ==========================================================================
   Тактиль — chat.js
   Чат-помощник: быстрые команды-кнопки + свободный ввод с поиском по ключевым словам.
   Без библиотек. Сайт полностью работает и без этого скрипта (прогрессивное улучшение).
   ========================================================================== */
(function () {
  'use strict';
  if (window.__tactChat) return;
  window.__tactChat = true;

  var PHONE = '+7 (968) 472-35-65', PHONE_TEL = '+79684723565', MAIL = 'info@taktil.ru';
  var KEY = 'tactile:chat';
  var D = window.TACT || {};
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rub(n) { return Number(n).toLocaleString('ru-RU') + ' ₽'; }
  function norm(s) { return String(s).toLowerCase().replace(/ё/g, 'е'); }
  function store(v) {
    try { if (v === undefined) return JSON.parse(sessionStorage.getItem(KEY)); sessionStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* хранилище недоступно */ }
    return null;
  }

  /* ---------------- База знаний ---------------- */
  var FREE = D.FREE_SHIP || 7000, SHIP = D.SHIP_COST || 390;
  var MENU = ['delivery', 'warranty', 'pick', 'switches', 'promo', 'service', 'lab', 'contacts'];

  var TOPICS = {
    delivery: {
      label: 'Доставка и оплата',
      keys: ['достав', 'курьер', 'срок', 'отправ', 'посылк', 'оплат', 'карт', 'сбп', 'наличн', 'счет'],
      html: '<p><strong>Доставка:</strong> по Москве — 1–2 дня, по России — от 3 до 7 дней. Заказы от ' + rub(FREE) + ' доставляем бесплатно, иначе — ' + rub(SHIP) + '.</p>' +
        '<p><strong>Оплата:</strong> банковская карта, СБП, при получении или по счёту для организаций. Способ выбирается при оформлении.</p>',
      next: ['promo', 'warranty', 'contacts']
    },
    warranty: {
      label: 'Гарантия и возврат',
      keys: ['гаранти', 'возврат', 'вернуть', 'обмен', 'замен', 'брак', 'сломал'],
      html: '<p>Вернуть товар можно в течение <strong>14 дней</strong> после получения, если сохранены товарный вид и упаковка.</p>' +
        '<p>На клавиатуры и сборки действует гарантия 12 месяцев: бракованные детали заменим или отремонтируем.</p>',
      next: ['contacts', 'service', 'delivery']
    },
    pick: {
      label: 'Подобрать клавиатуру',
      keys: ['подобрать', 'подбор', 'посоветуй', 'совет', 'какую клавиатуру', 'что взять', 'что выбрать', 'выбрать клавиатуру', 'лучшая'],
      html: '<p>Давайте подберём. Для чего вам нужна клавиатура?</p>',
      next: ['pick_work', 'pick_game', 'pick_quiet', 'pick_budget']
    },
    pick_work: {
      label: 'Для работы и кода',
      keys: ['работ', 'код', 'программир', 'офис', 'печат'],
      html: '<p>Для текста и кода подойдёт <a href="catalog.html">Nova 65</a> с тактильными «Клёнами»: удобный бугорок и компактная раскладка со стрелками. Если нужно больше клавиш — <a href="catalog.html">Atlas 80</a>.</p>',
      next: ['switches', 'configurator', 'menu']
    },
    pick_game: {
      label: 'Для игр',
      keys: ['игр', 'гейм', 'шутер', 'киберспорт'],
      html: '<p>Для игр берут линейные переключатели «Лён»: плавный ход без бугорка и быстрый отклик. Компактная <a href="catalog.html">Mini 60</a> освобождает место для мыши.</p>',
      next: ['switches', 'configurator', 'menu']
    },
    pick_quiet: {
      label: 'Тихую для офиса',
      keys: ['тих', 'бесшум', 'ночью', 'офис', 'не шумел'],
      html: '<p>Выбирайте бесшумные переключатели «Тишина»: ощущение остаётся механическим, а звук почти не слышен. Подойдёт и для ночи, и для общей комнаты.</p>',
      next: ['switches', 'lab', 'menu']
    },
    pick_budget: {
      label: 'Недорогую',
      keys: ['дешев', 'бюджет', 'недорог', 'подешевле'],
      dynamic: function () {
        var kb = (D.PRODUCTS || []).filter(function (p) { return p.type === 'keyboard'; }).sort(function (a, b) { return a.price - b.price; })[0];
        return '<p>Самая доступная клавиатура — ' + (kb ? '<a href="catalog.html">' + esc(kb.title) + '</a> за ' + rub(kb.price) : '<a href="catalog.html">Mini 60</a>') + '. Hot-swap позволит позже поменять переключатели без пайки.</p>';
      },
      next: ['promo', 'configurator', 'menu']
    },
    switches: {
      label: 'Какие переключатели выбрать?',
      keys: ['переключател', 'свитч', 'switch', 'линейн', 'тактильн', 'clicky', 'щелч', 'клик'],
      html: '<ul><li><strong>Линейные</strong> — плавные и тихие, для игр и печати.</li><li><strong>Тактильные</strong> — с «бугорком», удобны для текста и кода.</li>' +
        '<li><strong>Clicky</strong> — с щелчком, для любителей звука.</li><li><strong>Бесшумные</strong> — для ночи и общих комнат.</li></ul><p>Разницу можно <a href="lab.html">послушать в Лаборатории</a>.</p>',
      next: ['lab', 'pick', 'menu']
    },
    promo: {
      label: 'Промокоды и скидки',
      keys: ['промокод', 'скидк', 'купон', 'акци', 'tact10', 'welcome', 'дешевле'],
      html: '<p>Сейчас работают два промокода — введите их в корзине:</p><ul><li><strong>TACT10</strong> — скидка 10%;</li><li><strong>WELCOME</strong> — −500 ₽ при заказе от 3 000 ₽.</li></ul>',
      next: ['delivery', 'pick', 'menu']
    },
    service: {
      label: 'Сборка и ремонт',
      keys: ['сборк', 'ремонт', 'смазк', 'прошивк', 'услуг', 'тюнинг', 'lube', 'пайк', 'мастер'],
      html: '<p>Мастерская собирает клавиатуры под ключ, смазывает переключатели и стабилизаторы, прошивает QMK/VIA, настраивает звук и ремонтирует платы. Цены и сроки — на <a href="service.html">странице услуг</a>.</p>',
      next: ['contacts', 'warranty', 'menu']
    },
    lab: {
      label: 'Послушать звук',
      keys: ['лаборатор', 'звук', 'послушать', 'услышать', 'тест печат', 'скорост'],
      html: '<p>В <a href="lab.html">Лаборатории</a> можно послушать четыре типа переключателей, сравнить кривые усилия и проверить скорость печати.</p>',
      next: ['switches', 'configurator', 'menu']
    },
    configurator: {
      label: 'Собрать свою',
      keys: ['конфигуратор', 'собрать свою', 'своя сборка', 'кастом'],
      html: '<p>В <a href="configurator.html">конфигураторе</a> выберите раскладку, корпус, кейкапы и переключатели — цена и срок сборки считаются на лету.</p>',
      next: ['promo', 'service', 'menu']
    },
    contacts: {
      label: 'Связаться с менеджером',
      keys: ['телефон', 'позвон', 'номер', 'почт', 'email', 'e-mail', 'mail', 'связаться', 'менеджер', 'адрес', 'где наход', 'как добрат', 'режим', 'график', 'работаете', 'человек', 'оператор'],
      html: '<p><strong>Телефон:</strong> <a href="tel:' + PHONE_TEL + '">' + PHONE + '</a><br><strong>E-mail:</strong> <a href="mailto:' + MAIL + '">' + MAIL + '</a></p>' +
        '<p>Работаем ежедневно с 10:00 до 20:00. Мастерская: Москва, Фрунзенская наб., 12. Всё это есть на странице <a href="contacts.html">«Контакты»</a>.</p>',
      next: ['delivery', 'warranty', 'menu']
    },
    status: {
      label: 'Статус заказа',
      keys: ['статус', 'где мой заказ', 'отследить', 'трек', 'мой заказ'],
      html: '<p>После оформления менеджер свяжется с вами в течение часа в рабочее время и сообщит сроки. Если заказ уже оформлен, позвоните <a href="tel:' + PHONE_TEL + '">' + PHONE + '</a> или напишите на <a href="mailto:' + MAIL + '">' + MAIL + '</a> и назовите e-mail из заказа.</p>',
      next: ['contacts', 'delivery', 'menu']
    },
    hotswap: {
      label: 'Что такое hot-swap?',
      keys: ['hot-swap', 'hotswap', 'хотсвап', 'хот-свап', 'горяч'],
      html: '<p>Hot-swap — плата с гнёздами под переключатели: свитчи вставляются и вынимаются без пайки. Можно за вечер поменять звук клавиатуры.</p>',
      next: ['switches', 'service', 'menu']
    },
    layout: {
      label: 'Раскладки 60/65/75%',
      keys: ['раскладк', 'размер', 'компакт', '60%', '65%', '75%', '80%', 'tkl'],
      html: '<p><strong>60%</strong> — самая компактная, без стрелок. <strong>65%</strong> — со стрелками, золотая середина. <strong>75%</strong> и 80% — плюс функциональный ряд. Сравнить виды можно в <a href="configurator.html">конфигураторе</a>.</p>',
      next: ['pick', 'configurator', 'menu']
    },
    wireless: {
      label: 'Беспроводные',
      keys: ['bluetooth', 'блютуз', 'беспровод', 'wireless'],
      html: '<p>Nova 65 работает по Bluetooth и по кабелю USB-C. Подробности о каждой модели — в <a href="catalog.html">каталоге</a>.</p>',
      next: ['pick', 'menu']
    },
    privacy: {
      label: 'Конфиденциальность',
      keys: ['конфиденц', 'персональн', 'данные', 'cookie', 'куки'],
      html: '<p>Корзина, избранное и отзывы хранятся только в вашем браузере. Подробности и кнопка удаления данных — на странице <a href="privacy.html">«Конфиденциальность»</a>.</p>',
      next: ['menu']
    },
    greet: { keys: ['привет', 'здравств', 'добрый', 'добрая', 'хай', 'hello', 'hi '], html: '<p>Здравствуйте! Я помощник «Тактиля». Выберите тему ниже или напишите свой вопрос.</p>', next: MENU },
    thanks: { keys: ['спасибо', 'благодар', 'thanks'], html: '<p>Рады помочь! Если появятся ещё вопросы — я здесь.</p>', next: ['menu'] },
    bye: { keys: ['пока', 'до свидан', 'удачи'], html: '<p>Хорошего дня! Если что — пишите.</p>', next: ['menu'] }
  };

  function productKeys(p) {
    var ALIAS = { 'nova-65': ['нова'], 'retro-75': ['ретро'], 'mini-60': ['мини'], 'atlas-80': ['атлас'], 'sakura-keycaps': ['сакура'], 'midnight-keycaps': ['миднайт'], 'matcha-keycaps': ['матча'] };
    var STOP = ['набор', 'витой', 'коврик', 'подставка', 'линейные', 'тактильные', 'бесшумные', 'clicky'];
    var words = norm(p.title.split('—')[0]).replace(/[«»"]/g, ' ').split(/\s+/).filter(function (w) { return w.length >= 4 && STOP.indexOf(w) < 0 && !/^\d+$/.test(w); });
    return words.concat(ALIAS[p.id] || []);
  }
  function findProduct(q) {
    var best = null, len = 0;
    (D.PRODUCTS || []).forEach(function (p) {
      productKeys(p).forEach(function (k) { if (q.indexOf(k) >= 0 && k.length > len) { best = p; len = k.length; } });
    });
    return best;
  }
  function productHtml(p) {
    var old = p.old ? ' <s>' + rub(p.old) + '</s>' : '';
    return '<p><strong>' + esc(p.title) + '</strong> — ' + rub(p.price) + old + '.</p><p>' + esc(p.short || '') + '</p><p><a href="catalog.html">Посмотреть в каталоге</a></p>';
  }
  function guess(q) {
    var best = null, score = 0;
    Object.keys(TOPICS).forEach(function (id) {
      var t = TOPICS[id], s = 0;
      t.keys.forEach(function (k) { if (q.indexOf(k) >= 0) s += k.length > 5 ? 2 : 1; });
      if (s > score) { score = s; best = id; }
    });
    return best;
  }

  /* ---------------- Интерфейс ---------------- */
  var toggle, panel, log, chips, input, history = [], busy = false, started = false, refocus = false;

  function h(tag, attrs, html) {
    var e = document.createElement(tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (html != null) e.innerHTML = html;
    return e;
  }
  function icon(name) { return '<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-' + name + '"></use></svg>'; }

  function build() {
    toggle = h('button', { class: 'chat-toggle', type: 'button', id: 'chatToggle', 'aria-expanded': 'false', 'aria-controls': 'chatPanel' },
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/></svg>' +
      '<span class="chat-toggle__label">Помощник</span><span class="chat-toggle__dot" aria-hidden="true"></span>');
    panel = h('section', { class: 'chat', id: 'chatPanel', role: 'dialog', 'aria-labelledby': 'chatTitle', hidden: '' });
    panel.innerHTML =
      '<header class="chat__head"><span class="chat__avatar" aria-hidden="true">Т</span><div><h2 class="chat__title" id="chatTitle">Помощник «Тактиль»</h2>' +
      '<p class="chat__status"><span class="chat-toggle__dot" aria-hidden="true"></span>Отвечает сразу</p></div>' +
      '<button class="chat__close" type="button" aria-label="Закрыть чат">' + icon('close') + '</button></header>' +
      '<div class="chat__log" id="chatLog" role="log" aria-live="polite" aria-relevant="additions"></div>' +
      '<div class="chat__chips" id="chatChips" role="group" aria-label="Быстрые команды"></div>' +
      '<form class="chat__form" id="chatForm" autocomplete="off"><label class="visually-hidden" for="chatInput">Ваше сообщение</label>' +
      '<input class="chat__input" id="chatInput" name="message" type="text" maxlength="200" placeholder="Напишите вопрос…" enterkeyhint="send">' +
      '<button class="chat__send" type="submit" aria-label="Отправить">' + icon('arrow-right') + '</button></form>';
    document.body.append(toggle, panel);
    log = panel.querySelector('#chatLog'); chips = panel.querySelector('#chatChips'); input = panel.querySelector('#chatInput');

    toggle.addEventListener('click', function () { setOpen(true); });
    panel.querySelector('.chat__close').addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden && !document.querySelector('dialog[open]')) setOpen(false); });
    panel.querySelector('#chatForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      if (!v || busy) return;
      input.value = '';
      ask(v);
    });
    chips.addEventListener('click', function (e) {
      var b = e.target.closest('[data-topic]');
      if (!b || busy) return;
      refocus = e.detail === 0; // нажатие с клавиатуры — вернём фокус на новые кнопки
      if (b.dataset.topic === 'reset') return reset();
      ask(b.textContent.trim(), b.dataset.topic);
    });
  }

  function scrollDown() { log.scrollTop = log.scrollHeight; }
  function addMsg(role, html, save) {
    var m = h('div', { class: 'chat__msg chat__msg--' + role });
    if (role === 'user') m.textContent = html; else m.innerHTML = html;
    log.append(m); scrollDown();
    if (save !== false) { history.push({ r: role, h: html }); history = history.slice(-40); persist(); }
    return m;
  }
  function setChips(ids) {
    chips.textContent = '';
    ids.forEach(function (id) {
      var label = id === 'menu' ? 'Все темы' : TOPICS[id] && TOPICS[id].label;
      if (!label) return;
      var b = h('button', { class: 'chat__chip', type: 'button', 'data-topic': id === 'menu' ? 'menu' : id });
      b.textContent = label; chips.append(b);
    });
    if (history.length > 2) { var r = h('button', { class: 'chat__chip', type: 'button', 'data-topic': 'reset' }); r.textContent = 'Начать заново'; chips.append(r); }
  }
  function persist() { store({ open: !panel.hidden, log: history }); }

  function reply(html, next) {
    busy = true;
    var dots = addMsg('bot', '<span class="chat__typing" aria-hidden="true"><i></i><i></i><i></i></span>', false);
    setTimeout(function () {
      dots.remove();
      addMsg('bot', html); setChips(next); busy = false;
      if (refocus) { refocus = false; var f = chips.querySelector('button'); if (f) f.focus({ preventScroll: true }); }
    }, reduce ? 0 : 450);
  }
  function answer(id) {
    var t = TOPICS[id];
    return { html: t.dynamic ? t.dynamic() : t.html, next: (t.next || []).map(function (n) { return n; }) };
  }
  function ask(text, topicId) {
    addMsg('user', text);
    var q = norm(text).trim(), id = topicId;
    if (id === 'menu' || /^\/?(меню|помощь|menu|help|команды|все темы)$/.test(q)) return reply('<p>Выберите тему или напишите вопрос своими словами.</p>', MENU);
    if (!id) {
      var p = findProduct(q), g = guess(q);
      if (p && (!g || /цен|стоит|сколько|налич|есть/.test(q) || ['pick', 'pick_work', 'pick_game', 'pick_quiet', 'pick_budget'].indexOf(g) >= 0)) {
        return reply(productHtml(p), ['switches', 'promo', 'delivery', 'menu']);
      }
      id = g;
    }
    if (!id) {
      return reply('<p>Не нашёл точного ответа на «' + esc(text.slice(0, 80)) + '». Выберите тему ниже или свяжитесь с менеджером: ' +
        '<a href="tel:' + PHONE_TEL + '">' + PHONE + '</a>, <a href="mailto:' + MAIL + '">' + MAIL + '</a> (ежедневно 10:00–20:00).</p>', MENU);
    }
    var a = answer(id);
    reply(a.html, a.next);
  }
  function reset() {
    history = []; log.textContent = ''; persist(); start(true);
  }
  function start(force) {
    if (started && !force) return;
    started = true;
    if (!history.length) {
      addMsg('bot', '<p>Здравствуйте! Я помощник «Тактиль» — подскажу по доставке, оплате, выбору клавиатуры и переключателей.</p><p>Нажмите на тему ниже или напишите свой вопрос.</p>');
      setChips(MENU);
    }
  }
  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.classList.toggle('chat-open', open);
    if (open) { start(); scrollDown(); setTimeout(function () { input.focus({ preventScroll: true }); }, 30); }
    else toggle.focus({ preventScroll: true });
    persist();
  }

  function init() {
    build();
    var saved = store();
    if (saved && saved.log && saved.log.length) {
      history = saved.log;
      history.forEach(function (m) { addMsg(m.r, m.h, false); });
      started = true; setChips(MENU);
      if (saved.open) { panel.hidden = false; toggle.setAttribute('aria-expanded', 'true'); document.body.classList.add('chat-open'); scrollDown(); }
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
