const phone = document.querySelector('.phone');

let phoneOpen = false;

function openPhone() {
    phone.classList.add('open');
    phoneOpen = true;
}

function closePhone() {
    phone.classList.remove('open');
    phoneOpen = false;
}

// сервер открывает/закрывает телефон по команде /phone или /p
if (typeof cef !== 'undefined') {
    cef.on('phone:show', () => openPhone());
    cef.on('phone:hide', () => closePhone());
}
