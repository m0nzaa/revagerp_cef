const phone = document.querySelector('.phone');

let phoneOpen = false;

// блокируем правый клик (контекстное меню "Копировать" и т.д.) по всему телефону —
// вместе с user-select: none в CSS это убирает возможность скопировать текст
phone.addEventListener('contextmenu', (e) => e.preventDefault());

function formatMoney(amount) {
    // 44444 -> "$44.444"
    const n = Number(amount) || 0;
    return '$' + n.toLocaleString('ru-RU').replace(/,/g, '.');
}

function setPlayerName(name) {
    const safe = name && name.length ? name : '—';
    document.getElementById('playerName').textContent = safe;
    document.getElementById('settingsPlayerName').textContent = safe;

    const letter = safe.charAt(0).toUpperCase();
    document.getElementById('avatarLetter').textContent = letter;
    document.getElementById('settingsAvatarLetter').textContent = letter;
}

function setBankBalance(amount) {
    const formatted = formatMoney(amount);
    document.getElementById('bankBalanceMain').textContent = formatted;
    document.getElementById('bankBalanceHero').textContent = formatted;
}

function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const target = document.querySelector(`.screen[data-screen="${name}"]`);
    if (target) target.classList.add('active');
}

function openPhone() {
    phone.classList.add('open');
    phoneOpen = true;
    showScreen('main');
}

function closePhone() {
    phone.classList.remove('open');
    phoneOpen = false;
    showScreen('main'); // сброс на главный экран при следующем открытии
}

// переходы между экранами по клику на иконки (data-open) и кнопке "назад" (data-close)
document.querySelectorAll('[data-open]').forEach(el => {
    el.addEventListener('click', () => showScreen(el.dataset.open));
});

// нижняя полоска (home-indicator) работает как "смахивание вверх" на реальном iPhone —
// тап по ней из любого приложения возвращает на главный экран.
// Экран активного звонка намеренно исключён: сворачивание телефона не должно сбрасывать звонок.
document.querySelectorAll('.home-indicator').forEach(el => {
    el.addEventListener('click', () => {
        const currentScreen = el.closest('.screen');
        if (currentScreen && currentScreen.dataset.screen === 'callActive') return;
        showScreen('main');
    });
});
document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => showScreen('main'));
});

// ESC закрывает телефон и сообщает серверу снять фокус с браузера,
// иначе курсор/ввод остаются перехваченными и экран "залипает".
//
// ВАЖНО: используем keyup, а не keydown. Официальная документация samp-cef
// для cef_always_listen_keys прямо показывает пример именно с keyup —
// плагин инжектит клавиатурный ввод в CEF через свой собственный механизм,
// и keydown может не долетать до DOM надёжно даже при focus+always_listen_keys,
// тогда как keyup стабильно работает по документации и практике плагина.
function handlePhoneEscape(e) {
    if ((e.code === 'Escape' || e.key === 'Escape') && phoneOpen) {
        e.preventDefault();
        closePhone();
        if (typeof cef !== 'undefined') {
            // сервер читает событие как строку через sscanf("i", ...), поэтому шлём 0/1, а не JS-boolean
            cef.emit('phone:toggle', 0);
        }
    }
}

document.addEventListener('keyup', handlePhoneEscape);
// keydown оставляем как резервный путь на случай, если конкретная сборка клиента всё же шлёт его
document.addEventListener('keydown', handlePhoneEscape);

// сервер открывает/закрывает телефон по команде /phone или /p
if (typeof cef !== 'undefined') {
    cef.on('phone:show', () => openPhone());
    cef.on('phone:hide', () => closePhone());

    // сервер присылает актуальные данные игрока при каждом открытии телефона
    cef.on('phone:data', (name, bankMoney) => {
        setPlayerName(name);
        setBankBalance(bankMoney);
    });
}

/* ============================================================
   TRADEX — биржа: курсы с CoinGecko, покупка/продажа/вывод
   ============================================================ */

// CoinGecko ID для крипты, и отдельный источник для фиатных курсов к рублю
const TX_COINGECKO_IDS = { BTC: 'bitcoin' };
const TX_FIAT_CODES = { USD: 'usd', EUR: 'eur', UAH: 'uah' };

let txCurrentCurrency = 'BTC';
let txCurrentAction = 'buy'; // buy | sell | withdraw
let txRates = { BTC: 0, USD: 0, EUR: 0, UAH: 0 };
let txPrevRates = { BTC: 0, USD: 0, EUR: 0, UAH: 0 };
let txChangePercent = { BTC: 0, USD: 0, EUR: 0, UAH: 0 };
let txBalances = { BTC: 0, USD: 0, EUR: 0, UAH: 0 };
let txBankBalance = 0;
let txSparklineHistory = { BTC: [], USD: [], EUR: [], UAH: [] };
let txRatesLoaded = false;

const TX_COIN_LABELS = {
    BTC: { name: 'Bitcoin',  code: 'BTC/RUB' },
    USD: { name: 'US Dollar', code: 'USD/RUB' },
    EUR: { name: 'Euro',      code: 'EUR/RUB' },
    UAH: { name: 'Hryvnia',   code: 'UAH/RUB' }
};

// --- Получение курсов с CoinGecko (BTC и фиат к рублю напрямую одним запросом) ---
async function txFetchRates() {
    try {
        const res = await fetch(
            'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=rub,usd,eur,uah&include_24hr_change=true'
        );
        const data = await res.json();

        const btcRub = data.bitcoin.rub;
        const btcChange = data.bitcoin.rub_24h_change || 0;

        // курс рубля к доллару/евро/гривне получаем через кросс-курс:
        // bitcoin.rub / bitcoin.usd = сколько рублей в одном долларе
        const rubPerUsd = data.bitcoin.rub / data.bitcoin.usd;
        const rubPerEur = data.bitcoin.rub / data.bitcoin.eur;
        const rubPerUah = data.bitcoin.rub / data.bitcoin.uah;

        txPrevRates = { ...txRates };

        txRates.BTC = btcRub;
        txRates.USD = rubPerUsd;
        txRates.EUR = rubPerEur;
        txRates.UAH = rubPerUah;

        txChangePercent.BTC = btcChange;
        // для фиата считаем изменение сами относительно прошлого опроса (CoinGecko не даёт 24h change для кросс-курса напрямую)
        if (txPrevRates.USD > 0) txChangePercent.USD = ((txRates.USD - txPrevRates.USD) / txPrevRates.USD) * 100;
        if (txPrevRates.EUR > 0) txChangePercent.EUR = ((txRates.EUR - txPrevRates.EUR) / txPrevRates.EUR) * 100;
        if (txPrevRates.UAH > 0) txChangePercent.UAH = ((txRates.UAH - txPrevRates.UAH) / txPrevRates.UAH) * 100;

        txRatesLoaded = true;

        // копим историю для спарклайна (последние 30 точек)
        ['BTC', 'USD', 'EUR', 'UAH'].forEach(cur => {
            txSparklineHistory[cur].push(txRates[cur]);
            if (txSparklineHistory[cur].length > 30) txSparklineHistory[cur].shift();
        });

        // отправляем курсы на сервер — сервер хранит их как единственный источник правды для расчётов
        if (typeof cef !== 'undefined') {
            cef.emit('tradex:rates', txRates.BTC, txRates.USD, txRates.EUR, txRates.UAH);
        }

        txRenderPrice();
    } catch (err) {
        // сеть недоступна/лимит запросов — просто не обновляем в этот раз
        console.warn('TradeX rates fetch failed', err);
    }
}

function txRenderPrice() {
    const cur = txCurrentCurrency;
    const label = TX_COIN_LABELS[cur];
    document.getElementById('txCoinName').textContent = label.name;
    document.getElementById('txCoinCode').textContent = label.code;

    const priceEl = document.getElementById('txPriceValue');
    const rate = txRates[cur] || 0;
    const prevRate = txPrevRates[cur] || rate;

    priceEl.textContent = txFormatRub(rate);

    if (rate > prevRate) {
        priceEl.classList.remove('flash-down');
        priceEl.classList.add('flash-up');
        setTimeout(() => priceEl.classList.remove('flash-up'), 600);
    } else if (rate < prevRate) {
        priceEl.classList.remove('flash-up');
        priceEl.classList.add('flash-down');
        setTimeout(() => priceEl.classList.remove('flash-down'), 600);
    }

    const changeEl = document.getElementById('txPriceChange');
    const change = txChangePercent[cur] || 0;
    changeEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
    changeEl.classList.toggle('up', change >= 0);
    changeEl.classList.toggle('down', change < 0);

    txRenderSparkline();
    txRenderBalance();
}

function txFormatRub(value) {
    return Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽';
}

function txRenderSparkline() {
    const svg = document.getElementById('txSparkline');
    const history = txSparklineHistory[txCurrentCurrency];
    if (history.length < 2) {
        svg.innerHTML = '';
        return;
    }

    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = (max - min) || 1;
    const w = 300, h = 70;
    const step = w / (history.length - 1);

    const points = history.map((v, i) => {
        const x = i * step;
        const y = h - ((v - min) / range) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');

    const isUp = history[history.length - 1] >= history[0];
    const color = isUp ? '#0ecb81' : '#f6465d';

    svg.innerHTML = `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`;
}

function txRenderBalance() {
    const cur = txCurrentCurrency;
    const bal = txBalances[cur] || 0;
    const digits = cur === 'BTC' ? 8 : 2;
    document.getElementById('txBalanceValue').textContent = bal.toFixed(digits) + ' ' + cur;
}

// --- переключение валюты ---
document.querySelectorAll('.tx-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tx-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        txCurrentCurrency = tab.dataset.currency;
        document.getElementById('txInputSuffix').textContent = txCurrentAction === 'buy' ? '₽' : txCurrentCurrency;
        document.getElementById('txAmountInput').value = '';
        txRenderPrice();
        txUpdateCalcHint();
    });
});

// --- переключение режима (купить/продать/вывести) ---
document.querySelectorAll('.tx-action-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tx-action-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        txCurrentAction = tab.dataset.action;

        const input = document.getElementById('txAmountInput');
        const suffix = document.getElementById('txInputSuffix');
        const btn = document.getElementById('txSubmitBtn');
        const feeBox = document.getElementById('txFeeBox');

        input.value = '';
        btn.classList.remove('mode-sell', 'mode-withdraw');

        if (txCurrentAction === 'buy') {
            suffix.textContent = '₽';
            btn.textContent = 'Купить';
            feeBox.classList.add('hidden');
        } else if (txCurrentAction === 'sell') {
            suffix.textContent = txCurrentCurrency;
            btn.textContent = 'Продать';
            btn.classList.add('mode-sell');
            feeBox.classList.add('hidden');
        } else {
            suffix.textContent = txCurrentCurrency;
            btn.textContent = 'Вывести на карту';
            btn.classList.add('mode-withdraw');
            feeBox.classList.remove('hidden');
        }

        txUpdateCalcHint();
    });
});

// --- подсказка под полем ввода ---
function txUpdateCalcHint() {
    const hint = document.getElementById('txCalcHint');
    const amount = parseFloat(document.getElementById('txAmountInput').value.replace(',', '.')) || 0;
    const rate = txRates[txCurrentCurrency] || 0;

    if (amount <= 0 || rate <= 0) {
        hint.textContent = txCurrentAction === 'buy' ? 'Введите сумму в рублях' : 'Введите количество';
        return;
    }

    if (txCurrentAction === 'buy') {
        const fee = amount * 0.03;
        const net = amount - fee;
        const bought = net / rate;
        const digits = txCurrentCurrency === 'BTC' ? 8 : 4;
        hint.textContent = `Вы получите ≈ ${bought.toFixed(digits)} ${txCurrentCurrency} (комиссия 3%: ${fee.toFixed(2)} ₽)`;
    } else if (txCurrentAction === 'sell') {
        const gross = amount * rate;
        const fee = gross * 0.03;
        const net = gross - fee;
        hint.textContent = `Вы получите ≈ ${txFormatRub(net)} (комиссия 3%: ${txFormatRub(fee)})`;
    } else {
        // withdraw — просим сервер посчитать точно ("как в банке"), но можно и прикинуть локально для мгновенного отклика
        const gross = amount * rate;
        const afterConvert = gross * 0.97;
        const final = afterConvert * 0.98;
        hint.textContent = `Итого к зачислению ≈ ${txFormatRub(final)}`;

        document.getElementById('txWithdrawTotal').textContent = txFormatRub(final);

        if (typeof cef !== 'undefined') {
            cef.emit('tradex:withdrawPreview', txCurrentCurrency, amount);
        }
    }
}

document.getElementById('txAmountInput').addEventListener('input', txUpdateCalcHint);

// --- кнопка подтверждения операции ---
document.getElementById('txSubmitBtn').addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('txAmountInput').value.replace(',', '.')) || 0;
    if (amount <= 0) return;

    if (typeof cef === 'undefined') return;

    if (txCurrentAction === 'buy') {
        cef.emit('tradex:buy', txCurrentCurrency, amount);
    } else if (txCurrentAction === 'sell') {
        cef.emit('tradex:sell', txCurrentCurrency, amount);
    } else {
        cef.emit('tradex:withdraw', txCurrentCurrency, amount);
    }
});

// --- всплывающее уведомление об успехе/ошибке ---
function txShowToast(text, isError) {
    const old = document.querySelector('.tx-toast');
    if (old) old.remove();

    const toast = document.createElement('div');
    toast.className = 'tx-toast ' + (isError ? 'error' : 'success');
    toast.textContent = text;
    document.querySelector('.tradex-screen').appendChild(toast);

    setTimeout(() => toast.remove(), 2800);
}

// --- история операций ---
function txRenderHistory(items) {
    const list = document.getElementById('txHistoryList');
    if (!items || items.length === 0) {
        list.innerHTML = '<div class="tx-history-empty">Операций пока нет</div>';
        return;
    }

    const typeLabels = { buy: 'Покупка', sell: 'Продажа', withdraw: 'Вывод на карту' };
    const typeIcons = { buy: '↓', sell: '↑', withdraw: '🏦' };

    list.innerHTML = items.map(item => {
        const digits = item.currency === 'BTC' ? 6 : 2;
        return `
            <div class="tx-history-item">
                <div class="tx-history-icon ${item.type}">${typeIcons[item.type] || '•'}</div>
                <div class="tx-history-info">
                    <div class="tx-history-type">${typeLabels[item.type] || item.type} ${item.currency}</div>
                    <div class="tx-history-date">${item.date || ''}</div>
                </div>
                <div class="tx-history-amount">${Number(item.amount).toFixed(digits)} ${item.currency}</div>
            </div>
        `;
    }).join('');
}

// --- подписки на ответы сервера ---
if (typeof cef !== 'undefined') {
    cef.on('tradex:balances', (btc, usd, eur, uah, bankMoney) => {
        txBalances.BTC = parseFloat(btc) || 0;
        txBalances.USD = parseFloat(usd) || 0;
        txBalances.EUR = parseFloat(eur) || 0;
        txBalances.UAH = parseFloat(uah) || 0;
        txBankBalance = parseFloat(bankMoney) || 0;
        txRenderBalance();
    });

    cef.on('tradex:success', (type, currency, amount, newCurrencyBalance, newBankBalance, finalWithdrawAmount) => {
        txBalances[currency] = parseFloat(newCurrencyBalance) || 0;
        txBankBalance = parseFloat(newBankBalance) || 0;
        setBankBalance(txBankBalance);
        txRenderBalance();

        document.getElementById('txAmountInput').value = '';
        txUpdateCalcHint();

        const labels = { buy: 'Покупка выполнена', sell: 'Продажа выполнена', withdraw: 'Вывод выполнен' };
        txShowToast(labels[type] || 'Операция выполнена', false);
    });

    cef.on('tradex:error', (message) => {
        txShowToast(message || 'Ошибка операции', true);
    });

    cef.on('tradex:withdrawPreview', (finalAmount) => {
        document.getElementById('txWithdrawTotal').textContent = txFormatRub(parseFloat(finalAmount) || 0);
    });

    cef.on('tradex:history', (json) => {
        try {
            const items = JSON.parse(json);
            txRenderHistory(items);
        } catch (e) {
            txRenderHistory([]);
        }
    });
}

// запрашиваем баланс и историю при открытии экрана TradeX
document.querySelector('[data-open="tradex"]').addEventListener('click', () => {
    if (typeof cef !== 'undefined') {
        cef.emit('tradex:balancesRequest');
    }
    txUpdateCalcHint();
});

document.querySelector('[data-open="tradexHistory"]').addEventListener('click', () => {
    if (typeof cef !== 'undefined') {
        cef.emit('tradex:historyRequest');
    }
});

// первая загрузка курсов сразу при старте страницы, затем каждые 15 секунд
txFetchRates();
setInterval(txFetchRates, 15000);

/* ============================================================
   ЗВОНКИ — набор номера, состояния вызова, таймер разговора
   ============================================================ */

let callDialedNumber = '';
let callTimerInterval = null;
let callSecondsElapsed = 0;
let callIsOutgoing = false;

// --- набор номера ---
document.querySelectorAll('.dial-key').forEach(key => {
    key.addEventListener('click', () => {
        if (key.id === 'dialBackspace') return;
        callDialedNumber += key.dataset.key;
        document.getElementById('dialInput').value = callDialedNumber;
    });
});

document.getElementById('dialBackspace').addEventListener('click', () => {
    callDialedNumber = callDialedNumber.slice(0, -1);
    document.getElementById('dialInput').value = callDialedNumber;
});

// --- кнопка "позвонить" ---
document.getElementById('dialCallBtn').addEventListener('click', () => {
    if (!callDialedNumber) return;
    if (typeof cef === 'undefined') return;

    callIsOutgoing = true;
    cef.emit('calls:dial', callDialedNumber);

    // переходим на экран звонка в состоянии "вызов идёт" —
    // сервер подтвердит/опровергнет через calls:ringing / calls:error
    callShowOutgoing(callDialedNumber);
});

function callShowOutgoing(number) {
    showScreen('callActive');
    document.getElementById('callAvatarLetter').textContent = '?';
    document.getElementById('callPeerName').textContent = number;
    document.getElementById('callStatus').textContent = 'Вызов...';
    document.getElementById('callTimer').classList.add('hidden');
    document.getElementById('callChat').classList.add('hidden');
    document.getElementById('callAcceptBtn').classList.add('hidden'); // у звонящего нет кнопки "принять"
}

function callShowIncoming(callerName, callerLetter) {
    callIsOutgoing = false;
    showScreen('callActive');
    document.getElementById('callAvatarLetter').textContent = callerLetter || '?';
    document.getElementById('callPeerName').textContent = callerName || 'Неизвестный номер';
    document.getElementById('callStatus').textContent = 'Входящий вызов...';
    document.getElementById('callTimer').classList.add('hidden');
    document.getElementById('callChat').classList.add('hidden');
    document.getElementById('callAcceptBtn').classList.remove('hidden');
}

function callStartTimer() {
    callSecondsElapsed = 0;
    const timerEl = document.getElementById('callTimer');
    timerEl.classList.remove('hidden');
    callTimerUpdate();

    callTimerInterval = setInterval(() => {
        callSecondsElapsed++;
        callTimerUpdate();
    }, 1000);
}

function callTimerUpdate() {
    const h = Math.floor(callSecondsElapsed / 3600);
    const m = Math.floor((callSecondsElapsed % 3600) / 60);
    const s = callSecondsElapsed % 60;
    const pad = (n) => String(n).padStart(2, '0');
    document.getElementById('callTimer').textContent = h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function callStopTimer() {
    if (callTimerInterval) {
        clearInterval(callTimerInterval);
        callTimerInterval = null;
    }
}

function callEnd() {
    callStopTimer();
    document.getElementById('callChatMessages').innerHTML = '';
    callDialedNumber = '';
    document.getElementById('dialInput').value = '';
    showScreen('calls');
}

// --- кнопки принять/сбросить ---
document.getElementById('callAcceptBtn').addEventListener('click', () => {
    if (typeof cef !== 'undefined') cef.emit('calls:accept');
});

document.getElementById('callDeclineBtn').addEventListener('click', () => {
    if (typeof cef !== 'undefined') cef.emit('calls:end');
    callEnd();
});

// --- мини-чат во время разговора ---
function callAddChatMessage(text, isMe) {
    const container = document.getElementById('callChatMessages');
    const msg = document.createElement('div');
    msg.className = 'call-chat-msg ' + (isMe ? 'me' : 'peer');
    msg.textContent = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

function callSendChatMessage() {
    const input = document.getElementById('callChatInput');
    const text = input.value.trim();
    if (!text) return;

    if (typeof cef !== 'undefined') {
        cef.emit('calls:chat', text);
    }
    callAddChatMessage(text, true);
    input.value = '';
}

document.getElementById('callChatSend').addEventListener('click', callSendChatMessage);
document.getElementById('callChatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') callSendChatMessage();
});

// --- события от сервера ---
if (typeof cef !== 'undefined') {
    // исходящий звонок принят линией (идут гудки на стороне сервера) — просто подтверждение, UI уже показан
    cef.on('calls:ringing', () => {
        document.getElementById('callStatus').textContent = 'Вызов...';
    });

    // входящий звонок к этому игроку
    cef.on('calls:incoming', (callerName, callerNumber) => {
        callShowIncoming(callerName, callerName ? callerName.charAt(0).toUpperCase() : '?');
    });

    // собеседник принял вызов — запускаем таймер (не раньше!)
    cef.on('calls:accepted', (peerName) => {
        document.getElementById('callStatus').textContent = 'Соединено';
        document.getElementById('callPeerName').textContent = peerName || document.getElementById('callPeerName').textContent;
        document.getElementById('callChat').classList.remove('hidden');
        document.getElementById('callAcceptBtn').classList.add('hidden');
        callStartTimer();
    });

    // вызов завершён (любой стороной, не ответили, занято, ошибка) — сервер говорит почему
    cef.on('calls:ended', (reason) => {
        const reasons = {
            busy: 'Абонент занят',
            noanswer: 'Нет ответа',
            notfound: 'Номер не найден',
            offline: 'Абонент не в сети',
            declined: 'Вызов отклонён',
            ended: 'Вызов завершён'
        };
        document.getElementById('callStatus').textContent = reasons[reason] || 'Вызов завершён';
        setTimeout(callEnd, 1200);
    });

    cef.on('calls:error', (message) => {
        document.getElementById('callStatus').textContent = message || 'Ошибка вызова';
        setTimeout(callEnd, 1500);
    });

    // входящее сообщение от собеседника во время разговора
    cef.on('calls:chatMessage', (text) => {
        callAddChatMessage(text, false);
    });

    // счётчик непрочитанных вызовов (пропущенные) для бейджа на главном экране
    cef.on('calls:missedCount', (count) => {
        const badge = document.getElementById('callsBadge');
        const n = parseInt(count) || 0;
        if (n > 0) {
            badge.textContent = n;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    });
}

/* ============================================================
   SMS — поиск по ID, переписка (не хранится в БД, только в памяти вкладки)
   ============================================================ */

// переписки хранятся только в памяти текущей сессии браузера,
// как и предупреждал оператор — при закрытии/перезагрузке страницы пропадают
let smsChats = {}; // { targetId: { name, letter, number, messages: [{text, me}] } }
let smsCurrentTargetId = null;

document.getElementById('smsNewBtn').addEventListener('click', () => {
    document.getElementById('smsSearchInput').value = '';
    document.getElementById('smsSearchResult').innerHTML = '';
    showScreen('smsSearch');
});

document.getElementById('smsSearchBtn').addEventListener('click', smsDoSearch);
document.getElementById('smsSearchInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') smsDoSearch();
});

function smsDoSearch() {
    const id = document.getElementById('smsSearchInput').value.trim();
    if (!id) return;

    if (typeof cef !== 'undefined') {
        cef.emit('sms:search', id);
    }
}

function smsRenderSearchResult(found, targetId, name, number) {
    const container = document.getElementById('smsSearchResult');

    if (!found) {
        container.innerHTML = '<div class="sms-search-not-found">Игрок с таким ID не найден или не в сети</div>';
        return;
    }

    const letter = name ? name.charAt(0).toUpperCase() : '?';
    container.innerHTML = `
        <div class="sms-search-found" id="smsOpenFoundChat">
            <div class="sms-chat-item-avatar">${letter}</div>
            <div class="sms-chat-item-info">
                <div class="sms-chat-item-name">${name}</div>
                <div class="sms-chat-item-preview">${number || ''}</div>
            </div>
        </div>
    `;

    document.getElementById('smsOpenFoundChat').addEventListener('click', () => {
        smsOpenChat(targetId, name, number);
    });
}

function smsOpenChat(targetId, name, number) {
    if (!smsChats[targetId]) {
        smsChats[targetId] = {
            name: name,
            letter: name ? name.charAt(0).toUpperCase() : '?',
            number: number,
            messages: []
        };
    }

    smsCurrentTargetId = targetId;

    document.getElementById('smsChatName').textContent = smsChats[targetId].name;
    document.getElementById('smsChatAvatar').textContent = smsChats[targetId].letter;

    smsRenderChatMessages();
    showScreen('smsChat');
}

function smsRenderChatMessages() {
    const chat = smsChats[smsCurrentTargetId];
    const container = document.getElementById('smsChatMessages');

    if (!chat || chat.messages.length === 0) {
        container.innerHTML = '<div class="sms-chat-empty">Сообщений пока нет</div>';
        return;
    }

    container.innerHTML = chat.messages.map(m =>
        `<div class="sms-msg ${m.me ? 'me' : 'peer'}">${smsEscapeHtml(m.text)}</div>`
    ).join('');

    container.scrollTop = container.scrollHeight;
}

function smsEscapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function smsRenderChatList() {
    const list = document.getElementById('smsChatList');
    const ids = Object.keys(smsChats);

    if (ids.length === 0) {
        list.innerHTML = '<div class="sms-chat-empty">Нет переписок</div>';
        return;
    }

    list.innerHTML = ids.map(id => {
        const chat = smsChats[id];
        const lastMsg = chat.messages[chat.messages.length - 1];
        const preview = lastMsg ? (lastMsg.me ? 'Вы: ' : '') + lastMsg.text : 'Нет сообщений';
        return `
            <div class="sms-chat-item" data-target="${id}">
                <div class="sms-chat-item-avatar">${chat.letter}</div>
                <div class="sms-chat-item-info">
                    <div class="sms-chat-item-name">${chat.name}</div>
                    <div class="sms-chat-item-preview">${smsEscapeHtml(preview)}</div>
                </div>
            </div>
        `;
    }).join('');

    list.querySelectorAll('.sms-chat-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.target;
            smsOpenChat(id, smsChats[id].name, smsChats[id].number);
        });
    });
}

// обновляем список переписок каждый раз при входе на экран SMS
document.querySelector('[data-open="sms"]').addEventListener('click', smsRenderChatList);

// --- отправка сообщения ---
function smsSendMessage() {
    const input = document.getElementById('smsChatInput');
    const text = input.value.trim();
    if (!text || !smsCurrentTargetId) return;

    if (typeof cef !== 'undefined') {
        cef.emit('sms:send', smsCurrentTargetId, text);
    }

    smsChats[smsCurrentTargetId].messages.push({ text, me: true });
    smsRenderChatMessages();
    input.value = '';
}

document.getElementById('smsChatSend').addEventListener('click', smsSendMessage);
document.getElementById('smsChatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') smsSendMessage();
});

// --- события от сервера ---
if (typeof cef !== 'undefined') {
    // результат поиска по ID: found(0/1) targetId name number
    cef.on('sms:searchResult', (found, targetId, name, number) => {
        smsRenderSearchResult(found === '1' || found === 1, targetId, name, number);
    });

    // входящее сообщение от другого игрока
    cef.on('sms:incoming', (fromId, fromName, text) => {
        if (!smsChats[fromId]) {
            smsChats[fromId] = {
                name: fromName,
                letter: fromName ? fromName.charAt(0).toUpperCase() : '?',
                number: '',
                messages: []
            };
        }
        smsChats[fromId].messages.push({ text, me: false });

        // если сейчас открыта именно эта переписка — обновляем её сразу
        if (smsCurrentTargetId === fromId) {
            smsRenderChatMessages();
        }

        // обновим бейдж на главном экране
        const badge = document.getElementById('smsBadge');
        const current = parseInt(badge.textContent) || 0;
        badge.textContent = current + 1;
        badge.classList.remove('hidden');
    });
}

/* ============================================================
   GPS — список точек, выбор запускает маршрут через серверный
   диалог SA-MP (не внутри CEF, по требованию заказчика)
   ============================================================ */

// Те же метки и порядок, что в phone.inc (GPS_LOCATIONS) — индекс важен,
// т.к. при выборе отправляется именно индекс, а не название, чтобы сервер
// однозначно сопоставил точку со своим массивом координат.
const GPS_LOCATIONS = [
    { name: 'Больница',  icon: '🏥' },
    { name: 'Мэрия',     icon: '🏛️' },
    { name: 'Авторынок', icon: '🚗' },
    { name: 'Заправка',  icon: '⛽' },
    { name: 'Полиция',   icon: '🚓' },
    { name: 'Рынок',     icon: '🛒' }
];

function gpsRenderList() {
    const list = document.getElementById('gpsList');
    list.innerHTML = GPS_LOCATIONS.map((loc, index) => `
        <div class="gps-item" data-index="${index}">
            <div class="gps-item-icon">${loc.icon}</div>
            <div class="gps-item-name">${loc.name}</div>
            <div class="gps-item-arrow">›</div>
        </div>
    `).join('');

    list.querySelectorAll('.gps-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            if (typeof cef !== 'undefined') {
                cef.emit('gps:select', index);
            }
            // телефон сворачивается сразу — дальше с игроком говорит уже серверный диалог SA-MP
            showScreen('main');
        });
    });
}

gpsRenderList();

/* ============================================================
   НАСТРОЙКИ — обои, прозрачность, отключение звонков/SMS,
   выключение телефона. Хранится только в памяти текущей
   вкладки (как и SMS-переписки) — сбрасывается при перезаходе,
   что ожидаемо для CEF-страницы без постоянного хранилища.
   ============================================================ */

const WALLPAPERS = [
    { id: 'ocean',   css: 'linear-gradient(165deg, #4facfe 0%, #00f2fe 100%)' },
    { id: 'sunset',  css: 'linear-gradient(165deg, #fa709a 0%, #fee140 100%)' },
    { id: 'night',   css: 'linear-gradient(165deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
    { id: 'violet',  css: 'linear-gradient(165deg, #7f7fd5 0%, #86a8e7 50%, #91eae4 100%)' },
    { id: 'mono',    css: 'linear-gradient(165deg, #232526 0%, #414345 100%)' },
    { id: 'peach',   css: 'linear-gradient(165deg, #ffecd2 0%, #fcb69f 100%)' }
];

let phoneIsOff = false;

// --- обои ---
function settingsRenderWallpapers() {
    const grid = document.getElementById('wallpaperGrid');
    const current = document.querySelector('.main-menu').style.getPropertyValue('--wallpaper') ||
        getComputedStyle(document.querySelector('.main-menu')).getPropertyValue('--wallpaper');

    grid.innerHTML = WALLPAPERS.map(w => `
        <div class="wallpaper-option" data-wallpaper="${w.id}" style="background:${w.css}"></div>
    `).join('');

    grid.querySelectorAll('.wallpaper-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const wp = WALLPAPERS.find(w => w.id === opt.dataset.wallpaper);
            if (!wp) return;
            document.querySelector('.main-menu').style.setProperty('--wallpaper', wp.css);

            grid.querySelectorAll('.wallpaper-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
        });
    });
}

document.getElementById('settingsWallpaperRow').addEventListener('click', () => {
    settingsRenderWallpapers();
    showScreen('wallpaper');
});

// --- прозрачность (эффект размытия в шапках/доке) ---
document.getElementById('toggleTransparency').addEventListener('change', (e) => {
    phone.classList.toggle('transparency-off', !e.target.checked);
});

// --- отключение звонков / SMS / звука — сообщаем серверу, чтобы он не присылал события вовсе ---
document.getElementById('toggleCalls').addEventListener('change', (e) => {
    if (typeof cef !== 'undefined') {
        cef.emit('settings:callsEnabled', e.target.checked ? 1 : 0);
    }
});

document.getElementById('toggleSms').addEventListener('change', (e) => {
    if (typeof cef !== 'undefined') {
        cef.emit('settings:smsEnabled', e.target.checked ? 1 : 0);
    }
});

let notificationSoundEnabled = true;
document.getElementById('toggleSound').addEventListener('change', (e) => {
    notificationSoundEnabled = e.target.checked;
});

// --- выключение телефона ---
document.getElementById('settingsPowerRow').addEventListener('click', () => {
    phoneIsOff = true;
    document.getElementById('phoneOffOverlay').classList.add('active');
});

document.getElementById('phoneOffOverlay').addEventListener('click', () => {
    phoneIsOff = false;
    document.getElementById('phoneOffOverlay').classList.remove('active');
    showScreen('main');
});
