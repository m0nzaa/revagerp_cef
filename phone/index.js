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
document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => showScreen('main'));
});

// ESC закрывает телефон и сообщает серверу снять фокус с браузера,
// иначе курсор/ввод остаются перехваченными и экран "залипает"
document.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && phoneOpen) {
        e.preventDefault();
        closePhone();
        if (typeof cef !== 'undefined') {
            cef.emit('phone:toggle', false);
        }
    }
});

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
