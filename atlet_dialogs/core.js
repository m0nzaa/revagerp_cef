// ============================================================
//  core.js — простые всплывающие CEF-уведомления (SA-MP CEF plugin)
//
//  Сервер шлёт:
//      cef_emit_event(playerid, "push_notify",
//          "{\"type\":0,\"title\":\"...\",\"text\":\"...\",\"duration\":4000}");
//
//  type: 0 = info (жёлтый), 1 = error (красный), 2 = success (зелёный)
// ============================================================

const TYPE_CLASS = { 0: 'yellow', 1: 'red', 2: 'green' };
const TYPE_ICON  = { 0: 'info-icon', 1: 'no-icon', 2: 'good-icon' };

const block = document.getElementById('notBlock');

function showNotify(data) {
    const type = (data.type in TYPE_CLASS) ? data.type : 0;
    const duration = data.duration || 4000;

    const el = document.createElement('div');
    el.className = 'notif';
    el.innerHTML =
        '<div class="loading ' + TYPE_CLASS[type] + '" style="width:100%"></div>' +
        '<div class="' + TYPE_ICON[type] + ' icon"></div>' +
        '<div class="notification">' +
            '<div class="not-title"></div>' +
            '<div class="not-text"></div>' +
        '</div>';

    el.querySelector('.not-title').textContent = data.title || '';
    el.querySelector('.not-text').textContent  = data.text  || '';

    block.appendChild(el);

    // полоска-таймер: 100% -> 0% за duration мс
    const bar = el.querySelector('.loading');
    requestAnimationFrame(() => {
        bar.style.transitionDuration = duration + 'ms';
        bar.style.width = '0%';
    });

    // через duration плавно убираем, потом удаляем из DOM
    setTimeout(() => {
        el.classList.add('hide');
        setTimeout(() => el.remove(), 300);
    }, duration);
}

// ── Приём событий от сервера ───────────────
if (typeof cef !== 'undefined') {
    cef.on('push_notify', function(json) {
        try {
            showNotify(JSON.parse(json));
        } catch (e) {
            console.log('[Notify][ERROR] bad json:', json, e);
        }
    });
}
