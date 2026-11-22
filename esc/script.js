/* ============================================================
   ESC MENU — script.js
   Все функции, которые дергают логику игры/CEF, собраны в объект
   window.GameBridge. Сейчас это заглушки (console.log) — в ASI
   нужно заменить тело каждой функции на реальный вызов CEF-моста
   (например cef.call("menu:resume") или аналог твоей библиотеки).
   ============================================================ */

// Отправка события на сервер (Pawn: cef_subscribe). Вне игры (в браузере) молчит.
function cefEmit(event, ...args){
  if(typeof cef !== 'undefined' && cef.emit) cef.emit(event, ...args);
}

window.GameBridge = {

  // Продолжить — закрыть меню и возобновить игру
  resumeGame(){
    console.log('[GameBridge] resumeGame()');
    cefEmit('cef_esc_resume');
    // TODO(ASI): вызвать cef -> client: снять паузу, скрыть CEF-окно
  },

  // Переподключиться — реконнект на тот же сервер
  reconnect(){
    console.log('[GameBridge] reconnect()');
    cefEmit('cef_esc_reconnect');
    // TODO(ASI): вызвать cef -> client: SAMP reconnect к текущему IP:порту
  },

  // Выйти из игры
  exitGame(){
    console.log('[GameBridge] exitGame()');
    cefEmit('cef_esc_exit');
    // TODO(ASI): вызвать cef -> client: закрыть процесс игры
  },

  // Открыть панель настроек (UI, без обращения к игре)
  openSettings(){
    console.log('[GameBridge] openSettings()');
  },

  // Закрыть панель настроек и вернуться в главное меню
  closeSettings(){
    console.log('[GameBridge] closeSettings()');
  },

  // Сохранить все текущие настройки — вызывается по кнопке "Сохранить"
  saveSettings(settings){
    console.log('[GameBridge] saveSettings()', settings);
    cefEmit('cef_esc_save', JSON.stringify(settings));
    // TODO(ASI): отправить объект settings в клиент (cef -> client),
    // клиент должен применить и сохранить в конфиг (ini/json/реестр)
  },

  // Изменение одного конкретного параметра "на лету" (например, для live-превью)
  // key — машинное имя параметра (см. DATA-KEY в HTML), value — новое значение
  setSetting(key, value){
    console.log('[GameBridge] setSetting()', key, value);
    // TODO(ASI): применить один параметр сразу, не дожидаясь "Сохранить"
    // (полезно для громкости, FOV и т.п., где хочется видеть эффект сразу)
  },

  // Привязка Discord — кнопка в разделе "Аккаунт"
  linkDiscord(){
    console.log('[GameBridge] linkDiscord()');
    // TODO(ASI): открыть окно/браузер авторизации Discord OAuth
  }

};


/* ============================================================
   СБОР ВСЕХ НАСТРОЕК СО СТРАНИЦЫ В ОДИН ОБЪЕКТ
   Любой input/toggle/pill с атрибутом data-key автоматически
   попадёт в этот объект под своим ключом.
   ============================================================ */
function collectSettings(){
  const result = {};

  document.querySelectorAll('[data-key]').forEach(el => {
    const key = el.dataset.key;

    if(el.type === 'checkbox'){
      result[key] = el.checked;
    } else if(el.type === 'range'){
      result[key] = Number(el.value);
    } else if(el.classList.contains('pill-group')){
      const activePill = el.querySelector('.pill.active');
      result[key] = activePill ? activePill.dataset.value : null;
    }
  });

  return result;
}


/* ============================================================
   AFK ТАЙМЕР
   ============================================================ */
let afkSeconds = 2;
let afkIntervalId = null;

function startAfkTimer(){
  stopAfkTimer();
  afkIntervalId = setInterval(() => {
    afkSeconds++;
    renderAfkTimer();
  }, 1000);
}

function stopAfkTimer(){
  if(afkIntervalId !== null){
    clearInterval(afkIntervalId);
    afkIntervalId = null;
  }
}

function resetAfkTimer(){
  afkSeconds = 0;
  renderAfkTimer();
}

function renderAfkTimer(){
  const el = document.getElementById('afkClock');
  if(!el) return;
  const m = String(Math.floor(afkSeconds / 60)).padStart(2, '0');
  const s = String(afkSeconds % 60).padStart(2, '0');
  el.textContent = `${m}:${s}`;
}


/* ============================================================
   ОТКРЫТИЕ / ЗАКРЫТИЕ ПАНЕЛЕЙ
   ============================================================ */
const mainMenu = document.getElementById('mainMenu');
const settingsRoot = document.getElementById('settingsRoot');

function showMainMenu(){
  mainMenu.style.display = 'flex';
}

function hideMainMenu(){
  mainMenu.style.display = 'none';
}

function openSettingsPanel(){
  hideMainMenu();
  settingsRoot.classList.add('active');
  GameBridge.openSettings();
}

function closeSettingsPanel(){
  settingsRoot.classList.remove('active');
  showMainMenu();
  GameBridge.closeSettings();
}

/* Открыть/закрыть всё ESC-меню целиком (вызывается из ASI через ESC).
   В реальном проекте эта функция будет дёргаться не кликом, а приходом
   события от клиента (CEF show/hide), но оставляю и ручной вызов для теста. */
// notifyServer=false используется, когда ЗАКРЫТИЕ пришло от самого сервера
// (событие cef_esc_close после повторного /esc) - тогда НЕ шлём cef_esc_resume
// обратно, иначе получится петля "сервер закрыл -> клиент сказал resume ->
// сервер ещё раз обработал закрытие". При клике по кнопке "Продолжить"
// notifyServer остаётся true, как и раньше.
function toggleEscMenu(forceState, notifyServer){
  const isOpening = typeof forceState === 'boolean'
    ? forceState
    : (mainMenu.style.display === 'none' && !settingsRoot.classList.contains('active'));

  if(isOpening){
    closeSettingsPanel();
    showMainMenu();
    resetAfkTimer();
    startAfkTimer();
  } else {
    hideMainMenu();
    settingsRoot.classList.remove('active');
    stopAfkTimer();
    if(notifyServer !== false) GameBridge.resumeGame();
  }
}


/* ============================================================
   ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК НАСТРОЕК
   ============================================================ */
const tabs = document.querySelectorAll('.s-tab');
const panes = document.querySelectorAll('.pane');
const paneTitles = {
  graphics: 'Графика',
  sound: 'Звук',
  controls: 'Управление',
  interface: 'Интерфейс',
  account: 'Аккаунт'
};

function switchSettingsTab(key){
  tabs.forEach(t => t.classList.toggle('active', t.dataset.pane === key));
  panes.forEach(p => p.classList.toggle('active', p.dataset.pane === key));
  const titleEl = document.getElementById('paneTitle');
  if(titleEl) titleEl.textContent = paneTitles[key] || key;
}

tabs.forEach(tab => {
  tab.addEventListener('click', () => switchSettingsTab(tab.dataset.pane));
});


/* ============================================================
   PILL-ГРУППЫ (одиночный выбор, напр. качество графики)
   ============================================================ */
document.querySelectorAll('.pill-group').forEach(group => {
  group.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      group.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const key = group.dataset.key;
      if(key) GameBridge.setSetting(key, pill.dataset.value);
    });
  });
});


/* ============================================================
   СЛАЙДЕРЫ — живое значение + live-применение
   ============================================================ */
document.querySelectorAll('input[type="range"]').forEach(slider => {
  slider.addEventListener('input', () => {
    const row = slider.closest('.s-slider-row');
    const valEl = row ? row.querySelector('.s-slider-val') : null;
    if(valEl){
      const isPercent = valEl.textContent.includes('%');
      valEl.textContent = isPercent ? slider.value + '%' : slider.value + ' м';
    }

    const key = slider.dataset.key;
    if(key) GameBridge.setSetting(key, Number(slider.value));
  });
});


/* ============================================================
   ТУМБЛЕРЫ — live-применение сразу по клику
   ============================================================ */
document.querySelectorAll('.switch input[type="checkbox"]').forEach(toggle => {
  toggle.addEventListener('change', () => {
    const key = toggle.dataset.key;
    if(key) GameBridge.setSetting(key, toggle.checked);
  });
});


/* ============================================================
   ПРИВЯЗКА КНОПОК ГЛАВНОГО МЕНЮ
   ============================================================ */
document.getElementById('btnContinue').addEventListener('click', () => {
  toggleEscMenu(false);
});

document.getElementById('btnSettings').addEventListener('click', openSettingsPanel);

document.getElementById('btnReconnect').addEventListener('click', () => {
  GameBridge.reconnect();
});

document.getElementById('btnExit').addEventListener('click', () => {
  GameBridge.exitGame();
});


/* ============================================================
   ПРИВЯЗКА КНОПОК ПАНЕЛИ НАСТРОЕК
   ============================================================ */
document.getElementById('settingsClose').addEventListener('click', closeSettingsPanel);
document.getElementById('btnBackToMenu').addEventListener('click', closeSettingsPanel);

document.getElementById('btnSaveSettings').addEventListener('click', () => {
  GameBridge.saveSettings(collectSettings());
});

document.getElementById('btnLinkDiscord').addEventListener('click', () => {
  GameBridge.linkDiscord();
});


/* ============================================================
   ESC — переключение меню (демо: клавиша ESC в самом браузере).
   В ASI это будет не keydown-листенер на странице, а перехват ESC
   на стороне клиента (до того, как он доходит до игры), который
   затем кажет/прячет CEF-окно и дергает toggleEscMenu() через JS-bridge.
   ============================================================ */
// В игре ESC обрабатывает ASI (шлёт /esc на сервер), поэтому слушатель нужен
// только при открытии страницы в обычном браузере — иначе будет двойное
// переключение (меню закроется и тут же откроется).
if(typeof cef === 'undefined'){
  document.addEventListener('keydown', (e) => {
    if(e.key === 'Escape'){
      toggleEscMenu();
    }
  });
}


/* ============================================================
   ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ СТРАНИЦЫ
   ============================================================ */
(function init(){
  // [FIX] Меню по умолчанию скрыто (см. style.css) и AFK-таймер НЕ запускается
  // сам по себе - только когда сервер реально просит показать меню (/esc).
  renderAfkTimer();
  hideMainMenu();

  // Сервер (cef_emit_event "cef_esc_open"/"cef_esc_close") просит показать/скрыть меню.
  if(typeof cef !== 'undefined' && cef.on){
    cef.on('cef_esc_open',  () => toggleEscMenu(true));
    cef.on('cef_esc_close', () => toggleEscMenu(false, false));
  }
})();
