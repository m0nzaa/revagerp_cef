/* ============================================================
   МВД — Информационный терминал
   JS-сторона. Общение с Pawn через глобальный объект cef
   (cef.on(event, handler) / cef.emit(event, ...args)),
   который инжектирует плагин CEF в каждую страницу браузера.

   События ОТ сервера (Pawn -> JS):
     mvd:show                              - показать терминал
     mvd:hide                              - скрыть терминал
     mvd:profile     name, wanted(0-7)     - шапка: имя + звёзды розыска
     mvd:tickets     json[]                - неоплаченные штрафы
     mvd:history     json[]                - оплаченные штрафы (история)
     mvd:penalties   json[]                - административные взыскания
     mvd:balance     amount(int)           - баланс банковской карты
     mvd:payResult   ticketId, ok, message - результат оплаты одного штрафа

   События ОТ клиента (JS -> Pawn), как в OnPhoneToggle/OnCallsDial:
     mvd:toggle      "0"/"1"               - терминал закрыт/открыт (ESC/крестик)
     mvd:requestData (без аргументов)      - запрос актуальных данных при входе на экран
     mvd:pay         ticketId(string)      - оплатить штраф с данным id

   Формат json[] для tickets/history/penalties — это ОДНА строка,
   сериализованный JSON-массив объектов, т.к. cef_emit_event передаёт
   аргументы как CEFSTR/CEFINT по отдельности, а не массивы/объекты
   напрямую. Поэтому список штрафов сервер шлёт одной CEFSTR(json).
   Пример для mvd:tickets:
     [{"id":"14","reason":"Превышение скорости","amount":2500,"date":"06.11.2026","issuer":"Иванов"}]
   Пример для mvd:history (те же поля + "paidDate"):
     [{"id":"9","reason":"Проезд на красный","amount":1500,"date":"01.11.2026","issuer":"Петров","paidDate":"02.11.2026"}]
   Пример для mvd:penalties:
     [{"title":"Предупреждение","desc":"Неповиновение сотруднику МВД","date":"05.11.2026"}]
   ============================================================ */

(function () {
  'use strict';

  // ---------- состояние ----------
  var state = {
    wanted: 0,
    tickets: [],
    history: [],
    penalties: [],
    balance: 0,
    payingId: null // id штрафа, который сейчас в процессе оплаты (анти-даблклик)
  };

  // ---------- helpers ----------
  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return document.querySelectorAll(sel); }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = String(str == null ? '' : str);
    return div.innerHTML;
  }

  function formatMoney(n) {
    n = Number(n) || 0;
    return n.toLocaleString('ru-RU');
  }

  function safeParseList(json) {
    try {
      var arr = JSON.parse(json);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  // ---------- мост к серверу (с fallback для просмотра вне игры) ----------
  var hasCef = (typeof window.cef !== 'undefined' && window.cef && typeof window.cef.emit === 'function');

  function serverEmit(event) {
    var args = Array.prototype.slice.call(arguments, 1);
    if (hasCef) {
      window.cef.emit.apply(window.cef, [event].concat(args));
    } else {
      console.log('[mvd:emit]', event, args);
    }
  }

  function serverOn(event, handler) {
    if (hasCef) {
      window.cef.on(event, handler);
    }
  }

  // ---------- навигация по экранам ----------
  function goto(screenName) {
    $all('.mvd-screen').forEach(function (el) {
      el.classList.toggle('mvd-screen-active', el.getAttribute('data-screen') === screenName);
    });

    // при входе на экран со списками просим сервер прислать свежие данные —
    // штраф мог прийти/оплатиться, пока игрок был в другом разделе терминала
    if (screenName === 'tickets' || screenName === 'pay' || screenName === 'history' || screenName === 'penalties') {
      serverEmit('mvd:requestData');
    }
  }

  // ---------- открытие/закрытие терминала ----------
  function showTerminal() {
    $('#mvdRoot').classList.remove('mvd-hidden');
    goto('menu');
    serverEmit('mvd:requestData');
  }

  function hideTerminal() {
    $('#mvdRoot').classList.add('mvd-hidden');
  }

  function closeAndNotify() {
    hideTerminal();
    serverEmit('mvd:toggle', '0');
  }

  // ---------- рендер шапки (имя + розыск) ----------
  function renderWanted(level) {
    level = Math.max(0, Math.min(7, Number(level) || 0));
    state.wanted = level;

    var starsEl = $('#mvdWantedStars');
    var badgeEl = $('#mvdWantedBadge');

    var html = '';
    for (var i = 0; i < 7; i++) {
      html += '<span class="' + (i < level ? 'mvd-star-on' : '') + '">★</span>';
    }
    starsEl.innerHTML = html;

    badgeEl.classList.toggle('mvd-wanted-active', level > 0 && level < 7);
    badgeEl.classList.toggle('mvd-wanted-max', level >= 7);
  }

  // ---------- рендер карточки штрафа (общая для tickets/pay/history) ----------
  function ticketCardHtml(t, opts) {
    opts = opts || {};
    var isPaid = !!opts.paid;
    var showPayBtn = !!opts.showPayBtn;

    var iconClass = isPaid ? 'mvd-icon-paid' : 'mvd-icon-unpaid';
    var iconChar = isPaid ? '✓' : '!';
    var statusClass = isPaid ? 'mvd-status-paid' : 'mvd-status-unpaid';
    var statusText = isPaid ? 'Оплачен' : 'Не оплачен';

    var metaParts = [];
    metaParts.push('№ ' + escapeHtml(t.id));
    if (t.issuer) metaParts.push('Выписал: ' + escapeHtml(t.issuer));
    if (isPaid && t.paidDate) {
      metaParts.push('Оплачен: ' + escapeHtml(t.paidDate));
    } else if (t.date) {
      metaParts.push('Выписан: ' + escapeHtml(t.date));
    }

    var rightHtml = '<div class="mvd-card-amount">' + formatMoney(t.amount) + ' $</div>';
    if (showPayBtn) {
      var isLoading = (state.payingId === String(t.id));
      rightHtml += '<button class="mvd-pay-btn' + (isLoading ? ' mvd-pay-loading' : '') + '" ' +
        'data-pay-id="' + escapeHtml(t.id) + '"' + (isLoading ? ' disabled' : '') + '>' +
        (isLoading ? 'Оплата…' : 'Оплатить') + '</button>';
    } else {
      rightHtml += '<div class="mvd-card-status ' + statusClass + '">' + statusText + '</div>';
    }

    return (
      '<div class="mvd-card" data-ticket-id="' + escapeHtml(t.id) + '">' +
        '<div class="mvd-card-icon ' + iconClass + '">' + iconChar + '</div>' +
        '<div class="mvd-card-body">' +
          '<div class="mvd-card-title">' + escapeHtml(t.reason || 'Административный штраф') + '</div>' +
          '<div class="mvd-card-meta">' + metaParts.map(function (m) { return '<span>' + m + '</span>'; }).join('') + '</div>' +
        '</div>' +
        '<div class="mvd-card-right">' + rightHtml + '</div>' +
      '</div>'
    );
  }

  function penaltyCardHtml(p) {
    return (
      '<div class="mvd-card">' +
        '<div class="mvd-card-icon mvd-icon-unpaid">!</div>' +
        '<div class="mvd-card-body">' +
          '<div class="mvd-card-title">' + escapeHtml(p.title || 'Взыскание') + '</div>' +
          '<div class="mvd-card-meta">' +
            (p.desc ? '<span>' + escapeHtml(p.desc) + '</span>' : '') +
            (p.date ? '<span>' + escapeHtml(p.date) + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // ---------- рендер списков ----------
  function renderTickets() {
    var listEl = $('#mvdTicketsList');
    var emptyEl = $('#mvdTicketsEmpty');

    if (state.tickets.length === 0) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('mvd-hidden');
    } else {
      emptyEl.classList.add('mvd-hidden');
      listEl.innerHTML = state.tickets.map(function (t) {
        return ticketCardHtml(t, { paid: false, showPayBtn: false });
      }).join('');
    }

    // бейдж "N неоплачено" на кнопке меню
    var badgeEl = $('#mvdUnpaidBadge');
    if (state.tickets.length > 0) {
      badgeEl.textContent = state.tickets.length;
      badgeEl.classList.remove('mvd-hidden');
    } else {
      badgeEl.classList.add('mvd-hidden');
    }
  }

  function renderPayScreen() {
    $('#mvdBalanceValue').textContent = formatMoney(state.balance);

    var listEl = $('#mvdPayList');
    var emptyEl = $('#mvdPayEmpty');

    if (state.tickets.length === 0) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('mvd-hidden');
    } else {
      emptyEl.classList.add('mvd-hidden');
      listEl.innerHTML = state.tickets.map(function (t) {
        return ticketCardHtml(t, { paid: false, showPayBtn: true });
      }).join('');
    }
  }

  function renderHistory() {
    var listEl = $('#mvdHistoryList');
    var emptyEl = $('#mvdHistoryEmpty');

    if (state.history.length === 0) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('mvd-hidden');
    } else {
      emptyEl.classList.add('mvd-hidden');
      listEl.innerHTML = state.history.map(function (t) {
        return ticketCardHtml(t, { paid: true, showPayBtn: false });
      }).join('');
    }
  }

  function renderPenalties() {
    var listEl = $('#mvdPenaltiesList');
    var emptyEl = $('#mvdPenaltiesEmpty');

    if (state.penalties.length === 0) {
      listEl.innerHTML = '';
      emptyEl.classList.remove('mvd-hidden');
    } else {
      emptyEl.classList.add('mvd-hidden');
      listEl.innerHTML = state.penalties.map(penaltyCardHtml).join('');
    }
  }

  // ---------- тост ----------
  var toastTimer = null;
  function showToast(message, type) {
    var el = $('#mvdToast');
    el.textContent = message;
    el.className = 'mvd-toast mvd-toast-show ' + (type === 'error' ? 'mvd-toast-error' : 'mvd-toast-success');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove('mvd-toast-show');
    }, 2600);
  }

  // ---------- оплата штрафа ----------
  function payTicket(ticketId) {
    if (state.payingId) return; // уже идёт оплата другого штрафа — ждём ответа сервера
    state.payingId = String(ticketId);
    renderTickets();
    renderPayScreen();
    serverEmit('mvd:pay', String(ticketId));
  }

  // ---------- обработчики кликов (делегирование, т.к. карточки перерисовываются) ----------
  document.addEventListener('click', function (e) {
    var gotoBtn = e.target.closest('[data-goto]');
    if (gotoBtn) {
      goto(gotoBtn.getAttribute('data-goto'));
      return;
    }

    var payBtn = e.target.closest('[data-pay-id]');
    if (payBtn && !payBtn.disabled) {
      payTicket(payBtn.getAttribute('data-pay-id'));
      return;
    }

    if (e.target.id === 'mvdCloseBtn' || e.target.closest('#mvdCloseBtn')) {
      closeAndNotify();
      return;
    }
  });

  // ESC закрывает терминал (подстраховка на случай, если сервер не слушает
  // клавиши сам — основной путь всё равно через cef.emit('mvd:toggle','0'))
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!$('#mvdRoot').classList.contains('mvd-hidden')) {
        closeAndNotify();
      }
    }
  });

  // ---------- приём событий от сервера ----------
  serverOn('mvd:show', function () {
    showTerminal();
  });

  serverOn('mvd:hide', function () {
    hideTerminal();
  });

  // arguments приходят из cef_emit_event как раздельные типизированные аргументы;
  // плагин передаёт их в обработчик JS как обычные позиционные параметры функции
  serverOn('mvd:profile', function (name, wanted) {
    $('#mvdCitizenName').textContent = name || 'Гражданин';
    renderWanted(wanted);
  });

  serverOn('mvd:tickets', function (json) {
    state.tickets = safeParseList(json);
    renderTickets();
    renderPayScreen();
  });

  serverOn('mvd:history', function (json) {
    state.history = safeParseList(json);
    renderHistory();
  });

  serverOn('mvd:penalties', function (json) {
    state.penalties = safeParseList(json);
    renderPenalties();
  });

  serverOn('mvd:balance', function (amount) {
    state.balance = Number(amount) || 0;
    renderPayScreen();
  });

  serverOn('mvd:payResult', function (ticketId, ok, message) {
    state.payingId = null;

    if (ok === 1 || ok === '1' || ok === true) {
      // штраф оплачен — убираем из локального списка неоплаченных сразу,
      // не дожидаясь отдельного mvd:tickets, чтобы UI не "залипал"
      state.tickets = state.tickets.filter(function (t) { return String(t.id) !== String(ticketId); });
      renderTickets();
      renderPayScreen();
      showToast(message || 'Штраф успешно оплачен', 'success');
    } else {
      renderTickets();
      renderPayScreen();
      showToast(message || 'Не удалось оплатить штраф', 'error');
    }
  });

})();
