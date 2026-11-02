const phone = document.querySelector('.phone');

let phoneOpen = false;

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
}
