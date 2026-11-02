const phone = document.querySelector('.phone');

let phoneOpen = false;

function openPhone() {
    phone.classList.add('open');
    phoneOpen = true;

    // сообщаем серверу, чтобы он сфокусировал браузер (появился курсор)
    if (typeof cef !== 'undefined') {
        cef.emit('phone:toggle', true);
    }
}

function closePhone() {
    phone.classList.remove('open');
    phoneOpen = false;

    if (typeof cef !== 'undefined') {
        cef.emit('phone:toggle', false);
    }
}

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
