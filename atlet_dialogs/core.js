// ============================================================
//  core.js — очередь всплывающих CEF-уведомлений (SA-MP CEF plugin)
//
//  Сервер шлёт:
//      cef_emit_event(playerid, "push_notify",
//          "{\"type\":0,\"title\":\"...\",\"text\":\"...\",\"duration\":4000}");
//
//  Никакого mp.* здесь нет — это чистый CEF-плагин для SA-MP,
//  события приходят через глобальный объект `cef` (инжектится плагином).
// ============================================================

const TYPE_INFO    = 0;
const TYPE_ERROR   = 1;
const TYPE_SUCCESS = 2;

const TYPE_CLASS = { 0: 'yellow', 1: 'red', 2: 'green' };
const TYPE_ICON  = { 0: 'info-icon', 1: 'no-icon', 2: 'good-icon' };

const MAX_VISIBLE = 4;      // одновременно на экране
const queue = [];
let activeCount = 0;

const block = document.getElementById('notBlock');

function pushNotify(data) {
    queue.push(data);
    tryRenderNext();
}

function tryRenderNext() {
    if (activeCount >= MAX_VISIBLE) return;
    const data = queue.shift();
    if (!data) return;
    activeCount++;
    renderToast(data);
}

function renderToast(data) {
    const type = (data.type in TYPE_CLASS) ? data.type : TYPE_INFO;
    const duration = data.duration || 4000;

    const el = document.createElement('div');
    el.className = 'notif entering';
    el.innerHTML =
        '<div class="loading ' + TYPE_CLASS[type] + '" style="width:100%"></div>' +
        '<div class="' + TYPE_ICON[type] + ' icon"></div>' +
        '<div class="notification">' +
            '<div class="not-title"></div>' +
            '<div class="not-text"></div>' +
        '</div>';

    // textContent, не innerHTML — сообщения приходят из игры (имена игроков,
    // суммы и т.п.), не должны интерпретироваться как разметка.
    el.querySelector('.not-title').textContent = data.title || '';
    el.querySelector('.not-text').textContent  = data.text  || '';

    block.appendChild(el);

    // запускаем анимацию появления на следующем кадре
    requestAnimationFrame(() => el.classList.remove('entering'));

    // progress-bar: 100% -> 0% за duration мс
    const bar = el.querySelector('.loading');
    requestAnimationFrame(() => {
        bar.style.transition = 'width ' + duration + 'ms linear';
        bar.style.width = '0%';
    });

    const timer = setTimeout(() => closeToast(el), duration);

    // клик по тосту — закрыть раньше срока
    el.addEventListener('click', () => {
        clearTimeout(timer);
        closeToast(el);
    });
}

function closeToast(el) {
    if (!el.parentNode) return;
    el.classList.add('leaving');
    el.addEventListener('animationend', () => {
        el.remove();
        activeCount = Math.max(0, activeCount - 1);
        tryRenderNext();
    }, { once: true });
}

// ── Приём событий от сервера ───────────────
if (typeof cef !== 'undefined') {
    cef.on('push_notify', function(json) {
        try {
            const data = JSON.parse(json);
            pushNotify(data);
        } catch (e) {
            console.log('[Notify][ERROR] bad json:', json, e);
        }
    });
} else {
    // Локальный тест в обычном браузере (F5 не через игру)
    console.log('[Notify] cef undefined — demo mode');
    setTimeout(() => pushNotify({type:0, title:'Уведомление', text:'Демо-режим (нет cef)'}), 500);
}
