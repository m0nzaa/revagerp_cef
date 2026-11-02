const phone = document.querySelector('.phone'),
      startScreen = document.querySelector('.screen-start'),
      mainScreen = document.querySelector('.main-menu');

let phoneOpen = false;

function openPhone() {
    startScreen.style.display = 'none';
    mainScreen.style.display = 'block';
    phoneOpen = true;

    // сообщаем серверу, чтобы он сфокусировал браузер (появился курсор)
    if (typeof cef !== 'undefined') {
        cef.emit('phone:toggle', true);
    }
}

function closePhone() {
    startScreen.style.display = 'block';
    mainScreen.style.display = 'none';
    phoneOpen = false;

    if (typeof cef !== 'undefined') {
        cef.emit('phone:toggle', false);
    }
}

// открытие по клику (как было раньше)
phone.addEventListener('click', () => {
    if (!phoneOpen) openPhone();
});

// открытие/закрытие по клавише P (физическая клавиша, не зависит от RU/EN раскладки)
document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP') {
        if (phoneOpen) {
            closePhone();
        } else {
            openPhone();
        }
    }
});

// сервер может сам попросить открыть/закрыть (например по команде /phone)
if (typeof cef !== 'undefined') {
    cef.on('phone:show', () => openPhone());
    cef.on('phone:hide', () => closePhone());
}
