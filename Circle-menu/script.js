// ============================================================
//  Набор линейных SVG-иконок (без emoji/Font Awesome).
//  Каждая иконка - путь(и) в viewBox 0 0 24 24, stroke-стиль
//  задаётся в CSS (.icon-slot svg / .center-icon).
// ============================================================
const ICONS = {
    car: `<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11"/>
          <rect x="3.5" y="11" width="17" height="6" rx="1.6"/>
          <circle cx="7.5" cy="17.5" r="1.6"/>
          <circle cx="16.5" cy="17.5" r="1.6"/>`,
    user: `<circle cx="12" cy="8" r="3.4"/>
           <path d="M5.5 19.5c0-3.3 2.9-6 6.5-6s6.5 2.7 6.5 6"/>`,
    home: `<path d="M4 11.5L12 4l8 7.5"/>
           <path d="M6 10v8.5a1 1 0 0 0 1 1h3.2v-5.2h3.6V19.5h3.2a1 1 0 0 0 1-1V10"/>`,
    wallet: `<rect x="3.5" y="6.5" width="17" height="12" rx="2"/>
             <path d="M3.5 10h17"/>
             <circle cx="16.5" cy="14.3" r="1.1"/>`,
    bag: `<path d="M8 8V6.5a4 4 0 0 1 8 0V8"/>
          <rect x="4.5" y="8" width="15" height="12" rx="2"/>
          <path d="M4.5 12.5h15"/>`,
    phone: `<rect x="7.5" y="3" width="9" height="18" rx="2"/>
            <path d="M10.3 18.2h3.4"/>`,
    gear: `<circle cx="12" cy="12" r="3"/>
           <path d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.7 6.3l-1.6 1.6M7.9 16.1l-1.6 1.6M17.7 17.7l-1.6-1.6M7.9 7.9 6.3 6.3"/>`,
    run: `<circle cx="14.3" cy="4.8" r="1.7"/>
          <path d="M9 21l2.2-5.1-2-1.6 1-4.3 3 1.2 1.7 2.6 3.1 1"/>
          <path d="M11.2 15.9 7.6 17.3M12.4 11.6 9 10.4"/>`
};

function buildIconSVG(name) {
    return ICONS[name] || '';
}

// ============================================================
//  Пункты главного кругового меню. ident - это то, что уходит
//  в Pawn через cef.emit('circlemenu:select', ident) - gamemode
//  сам решает, какую команду/систему вызвать по этому ident
//  (см. таблицу соответствий в ответе чата).
// ============================================================
const MAIN_MENU_ITEMS = [
    { title: 'Транспорт', description: 'Список доступных машин', icon: 'car', ident: 'vehicles' },
    { title: 'Персонаж', description: 'Паспорт, статистика, документы', icon: 'user', ident: 'character' },
    { title: 'Недвижимость', description: 'Управление домом', icon: 'home', ident: 'property' },
    { title: 'Финансы', description: 'Быстрый перевод денег', icon: 'wallet', ident: 'finance' },
    { title: 'Инвентарь', description: 'Личные вещи и предметы', icon: 'bag', ident: 'inventory' },
    { title: 'Телефон', description: 'Звонки и сообщения', icon: 'phone', ident: 'phone' },
    { title: 'Настройки', description: 'Интерфейс и управление', icon: 'gear', ident: 'settings' },
    { title: 'Анимации', description: 'Список доступных анимаций', icon: 'run', ident: 'animations' }
];

// ============================================================
//  MainMenu - главное восьмисекторное кольцо.
// ============================================================
class MainMenu {
    constructor() {
        this.centerX = 260;
        this.centerY = 260;
        this.outerRadius = 248;
        this.innerRadius = 168;
        this.iconRadius = 208;
        this.items = MAIN_MENU_ITEMS;

        this.root = document.getElementById('mainMenu');
        this.sectorsGroup = document.getElementById('sectors');
        this.ticksGroup = document.getElementById('ticks');
        this.iconsContainer = document.getElementById('icons');
        this.centerWrap = document.getElementById('centerWrap');
        this.centerIcon = document.getElementById('centerIcon');
        this.centerTitle = document.getElementById('centerTitle');
        this.centerDesc = document.getElementById('centerDesc');
        this.circleSvgSelector = '#mainMenu .circle-svg';

        this.sectors = [];
        this.iconSlots = [];
        this.activeIndex = -1;
        this.built = false;
    }

    build() {
        if (this.built) return;
        this.built = true;

        this.items.forEach((item, index) => {
            const sector = this.createSector(index);
            const iconSlot = this.createIconSlot(index, item);

            this.sectors.push(sector);
            this.iconSlots.push(iconSlot);
            this.sectorsGroup.appendChild(sector.element);
            this.iconsContainer.appendChild(iconSlot.element);
            this.ticksGroup.appendChild(this.createTick(index, this.items.length));

            setTimeout(() => iconSlot.element.classList.add('visible'), 60 + index * 35);
        });

        setTimeout(() => {
            this.centerWrap.classList.add('ready');
            this.setCenterContent(this.items[0]);
        }, 60 + this.items.length * 35 + 80);

        this.handleEvents();
    }

    createTick(index, total) {
        const angle = (index / total) * 2 * Math.PI;
        const r1 = this.outerRadius;
        const r2 = this.outerRadius - 10;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', this.centerX + r1 * Math.cos(angle));
        line.setAttribute('y1', this.centerY + r1 * Math.sin(angle));
        line.setAttribute('x2', this.centerX + r2 * Math.cos(angle));
        line.setAttribute('y2', this.centerY + r2 * Math.sin(angle));
        line.classList.add('tick');
        return line;
    }

    createSector(index) {
        const total = this.items.length;
        const startAngle = (index / total) * 2 * Math.PI;
        const endAngle = ((index + 1) / total) * 2 * Math.PI;
        const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

        const x1Outer = this.centerX + this.outerRadius * Math.cos(startAngle);
        const y1Outer = this.centerY + this.outerRadius * Math.sin(startAngle);
        const x2Outer = this.centerX + this.outerRadius * Math.cos(endAngle);
        const y2Outer = this.centerY + this.outerRadius * Math.sin(endAngle);
        const x1Inner = this.centerX + this.innerRadius * Math.cos(startAngle);
        const y1Inner = this.centerY + this.innerRadius * Math.sin(startAngle);
        const x2Inner = this.centerX + this.innerRadius * Math.cos(endAngle);
        const y2Inner = this.centerY + this.innerRadius * Math.sin(endAngle);

        const pathData = [
            `M ${x1Inner},${y1Inner}`,
            `L ${x1Outer},${y1Outer}`,
            `A ${this.outerRadius},${this.outerRadius} 0 ${largeArcFlag},1 ${x2Outer},${y2Outer}`,
            `L ${x2Inner},${y2Inner}`,
            `A ${this.innerRadius},${this.innerRadius} 0 ${largeArcFlag},0 ${x1Inner},${y1Inner}`,
            'Z'
        ].join(' ');

        const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        el.setAttribute('d', pathData);
        el.classList.add('sector');
        el.addEventListener('mouseenter', () => this.setActive(index));
        el.addEventListener('click', (e) => { this.handleSelect(index); e.stopPropagation(); });
        return { element: el };
    }

    createIconSlot(index, item) {
        const total = this.items.length;
        const anglePerItem = (2 * Math.PI) / total;
        const midAngle = anglePerItem * index + anglePerItem / 2;
        const iconX = this.centerX + this.iconRadius * Math.cos(midAngle);
        const iconY = this.centerY + this.iconRadius * Math.sin(midAngle);

        const wrapper = document.createElement('div');
        wrapper.classList.add('icon-slot');
        wrapper.style.left = `${iconX}px`;
        wrapper.style.top = `${iconY}px`;
        wrapper.innerHTML = `
            <svg viewBox="0 0 24 24">${buildIconSVG(item.icon)}</svg>
            <span class="icon-label">${item.title}</span>
        `;
        wrapper.addEventListener('mouseenter', () => this.setActive(index));
        wrapper.addEventListener('click', (e) => { this.handleSelect(index); e.stopPropagation(); });
        return { element: wrapper };
    }

    setActive(index) {
        if (this.activeIndex === index) return;
        if (this.activeIndex !== -1) {
            this.sectors[this.activeIndex].element.classList.remove('active');
            this.iconSlots[this.activeIndex].element.classList.remove('active-icon');
        }
        this.sectors[index].element.classList.add('active');
        this.iconSlots[index].element.classList.add('active-icon');
        this.activeIndex = index;
        this.setCenterContent(this.items[index]);
    }

    setCenterContent(item) {
        this.centerIcon.innerHTML = buildIconSVG(item.icon);
        this.centerTitle.textContent = item.title;
        this.centerDesc.textContent = item.description;
    }

    handleSelect(index) {
        const item = this.items[index];
        console.log(`Выбран пункт меню: ${item.ident}`);
        playSound();

        // gamemode подпишется на это событие и сам решит, какую
        // команду/систему открыть по item.ident (см. таблицу в чате)
        if (typeof cef !== 'undefined') {
            cef.emit('circlemenu:select', item.ident);
        }

        if (item.ident === 'finance') {
            // Финансы - не закрываем всё меню, а переключаемся на
            // подменю с вводом ID и выбором суммы
            switchToPayMenu();
        } else {
            closeCircleMenu();
        }
    }

    handleEvents() {
        document.addEventListener('mousemove', (event) => {
            if (!this.root.classList.contains('active')) return;
            const rect = document.querySelector(this.circleSvgSelector).getBoundingClientRect();
            const x = event.clientX - rect.left - this.centerX;
            const y = event.clientY - rect.top - this.centerY;
            const dist = Math.sqrt(x * x + y * y);
            if (dist < this.innerRadius || dist > this.outerRadius) return;

            const angle = Math.atan2(y, x);
            const adjustedAngle = angle < 0 ? angle + 2 * Math.PI : angle;
            const index = Math.floor((adjustedAngle / (2 * Math.PI)) * this.items.length);
            this.setActive(index);
        });

        document.addEventListener('click', () => {
            if (!this.root.classList.contains('active')) return;
            if (this.activeIndex !== -1) this.handleSelect(this.activeIndex);
        });
    }
}

// ============================================================
//  PayMenu - подменю "Финансы": центр - ввод ID получателя,
//  вокруг - 4 сектора с фиксированными суммами.
// ============================================================
const PAY_AMOUNTS = [1000, 5000, 10000, 50000];

class PayMenu {
    constructor() {
        this.centerX = 260;
        this.centerY = 260;
        this.outerRadius = 248;
        this.innerRadius = 168;
        this.amountRadius = 208;
        this.amounts = PAY_AMOUNTS;

        this.root = document.getElementById('payMenu');
        this.sectorsGroup = document.getElementById('paySectors');
        this.ticksGroup = document.getElementById('payTicks');
        this.amountsLayer = document.getElementById('payAmountsLayer');
        this.idInput = document.getElementById('payIdInput');
        this.hint = document.getElementById('payHint');
        this.circleSvgSelector = '#payMenu .circle-svg';

        this.sectors = [];
        this.amountSlots = [];
        this.activeIndex = -1;
        this.built = false;
    }

    build() {
        if (this.built) return;
        this.built = true;

        this.amounts.forEach((amount, index) => {
            const sector = this.createSector(index);
            const slot = this.createAmountSlot(index, amount);

            this.sectors.push(sector);
            this.amountSlots.push(slot);
            this.sectorsGroup.appendChild(sector.element);
            this.amountsLayer.appendChild(slot.element);
            this.ticksGroup.appendChild(this.createTick(index, this.amounts.length));

            setTimeout(() => slot.element.classList.add('visible'), 60 + index * 35);
        });

        this.handleEvents();

        this.idInput.addEventListener('input', () => {
            this.idInput.value = this.idInput.value.replace(/[^0-9]/g, '');
            this.setHint('Выберите сумму в кольце', false);
        });

        this.idInput.addEventListener('click', (e) => e.stopPropagation());
        this.idInput.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    createTick(index, total) {
        const angle = (index / total) * 2 * Math.PI;
        const r1 = this.outerRadius;
        const r2 = this.outerRadius - 10;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', this.centerX + r1 * Math.cos(angle));
        line.setAttribute('y1', this.centerY + r1 * Math.sin(angle));
        line.setAttribute('x2', this.centerX + r2 * Math.cos(angle));
        line.setAttribute('y2', this.centerY + r2 * Math.sin(angle));
        line.classList.add('tick');
        return line;
    }

    createSector(index) {
        const total = this.amounts.length;
        const startAngle = (index / total) * 2 * Math.PI;
        const endAngle = ((index + 1) / total) * 2 * Math.PI;
        const largeArcFlag = endAngle - startAngle > Math.PI ? 1 : 0;

        const x1Outer = this.centerX + this.outerRadius * Math.cos(startAngle);
        const y1Outer = this.centerY + this.outerRadius * Math.sin(startAngle);
        const x2Outer = this.centerX + this.outerRadius * Math.cos(endAngle);
        const y2Outer = this.centerY + this.outerRadius * Math.sin(endAngle);
        const x1Inner = this.centerX + this.innerRadius * Math.cos(startAngle);
        const y1Inner = this.centerY + this.innerRadius * Math.sin(startAngle);
        const x2Inner = this.centerX + this.innerRadius * Math.cos(endAngle);
        const y2Inner = this.centerY + this.innerRadius * Math.sin(endAngle);

        const pathData = [
            `M ${x1Inner},${y1Inner}`,
            `L ${x1Outer},${y1Outer}`,
            `A ${this.outerRadius},${this.outerRadius} 0 ${largeArcFlag},1 ${x2Outer},${y2Outer}`,
            `L ${x2Inner},${y2Inner}`,
            `A ${this.innerRadius},${this.innerRadius} 0 ${largeArcFlag},0 ${x1Inner},${y1Inner}`,
            'Z'
        ].join(' ');

        const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        el.setAttribute('d', pathData);
        el.classList.add('sector');
        el.addEventListener('mouseenter', () => this.setActive(index));
        el.addEventListener('click', (e) => { this.handleSelect(index); e.stopPropagation(); });
        return { element: el };
    }

    createAmountSlot(index, amount) {
        const total = this.amounts.length;
        const anglePerItem = (2 * Math.PI) / total;
        const midAngle = anglePerItem * index + anglePerItem / 2;
        const x = this.centerX + this.amountRadius * Math.cos(midAngle);
        const y = this.centerY + this.amountRadius * Math.sin(midAngle);

        const wrapper = document.createElement('div');
        wrapper.classList.add('amount-slot');
        wrapper.style.left = `${x}px`;
        wrapper.style.top = `${y}px`;
        wrapper.innerHTML = `
            <span class="amount-value">${formatAmount(amount)}</span>
            <span class="amount-currency">руб.</span>
        `;
        wrapper.addEventListener('mouseenter', () => this.setActive(index));
        wrapper.addEventListener('click', (e) => { this.handleSelect(index); e.stopPropagation(); });
        return { element: wrapper };
    }

    setActive(index) {
        if (this.activeIndex === index) return;
        if (this.activeIndex !== -1) {
            this.sectors[this.activeIndex].element.classList.remove('active');
            this.amountSlots[this.activeIndex].element.classList.remove('active-icon');
        }
        this.sectors[index].element.classList.add('active');
        this.amountSlots[index].element.classList.add('active-icon');
        this.activeIndex = index;
    }

    setHint(text, isError) {
        this.hint.textContent = text;
        this.hint.classList.toggle('pay-hint-error', !!isError);
    }

    handleSelect(index) {
        const targetId = this.idInput.value.trim();
        if (!targetId.length) {
            this.setHint('Сначала введите ID игрока', true);
            this.idInput.focus();
            return;
        }

        const amount = this.amounts[index];
        playSound();

        if (typeof cef !== 'undefined') {
            // сервер принимает (targetId, amount) и сам делает /pay-перевод
            cef.emit('circlemenu:pay', parseInt(targetId, 10), amount);
        }

        closeCircleMenu();
    }

    reset() {
        this.idInput.value = '';
        this.setHint('Выберите сумму в кольце', false);
        if (this.activeIndex !== -1) {
            this.sectors[this.activeIndex].element.classList.remove('active');
            this.amountSlots[this.activeIndex].element.classList.remove('active-icon');
            this.activeIndex = -1;
        }
    }

    focusInput() {
        setTimeout(() => this.idInput.focus(), 80);
    }

    handleEvents() {
        document.addEventListener('mousemove', (event) => {
            if (!this.root.classList.contains('active')) return;
            const rect = document.querySelector(this.circleSvgSelector).getBoundingClientRect();
            const x = event.clientX - rect.left - this.centerX;
            const y = event.clientY - rect.top - this.centerY;
            const dist = Math.sqrt(x * x + y * y);
            if (dist < this.innerRadius || dist > this.outerRadius) return;

            const angle = Math.atan2(y, x);
            const adjustedAngle = angle < 0 ? angle + 2 * Math.PI : angle;
            const index = Math.floor((adjustedAngle / (2 * Math.PI)) * this.amounts.length);
            this.setActive(index);
        });

        document.addEventListener('click', (event) => {
            if (!this.root.classList.contains('active')) return;
            if (event.target === this.idInput) return;
            if (this.activeIndex !== -1) this.handleSelect(this.activeIndex);
        });
    }
}

function formatAmount(n) {
    if (n >= 1000) return (n / 1000) + 'k';
    return String(n);
}

function playSound() {
    try {
        const sound = new Audio('selection.mp3');
        sound.play().catch(() => {});
    } catch (e) {}
}

// ============================================================
//  Открытие / закрытие / переключение меню.
//
//  Pawn -> JS:
//    cef_emit_event(playerid, browserId, "openCircleMenu")   -> window.openCircleMenu()
//    cef_emit_event(playerid, browserId, "closeCircleMenu")  -> window.closeCircleMenu()
//  (подписка на эти события настраивается в Pawn через cef_subscribe,
//   по аналогии с тем, как это сделано для телефона - см. phone:show/hide)
//
//  JS -> Pawn (по образцу index.js телефона, где используется
//  глобальный объект cef с методом emit):
//    cef.emit('circlemenu:select', ident)        - выбран обычный пункт
//    cef.emit('circlemenu:pay', targetId, amount) - подтверждён перевод
//    cef.emit('circlemenu:closed')                - меню закрыто (ESC/клик мимо)
// ============================================================
let mainMenu;
let payMenu;

function openCircleMenu() {
    mainMenu.build();
    payMenu.build();

    document.body.classList.add('menu-open');
    mainMenu.root.classList.add('active');
    payMenu.root.classList.remove('active');
    payMenu.reset();
}

function switchToPayMenu() {
    mainMenu.root.classList.remove('active');
    payMenu.root.classList.add('active');
    payMenu.reset();
    payMenu.focusInput();
}

function closeCircleMenu() {
    document.body.classList.remove('menu-open');
    mainMenu.root.classList.remove('active');
    payMenu.root.classList.remove('active');

    if (typeof cef !== 'undefined') {
        cef.emit('circlemenu:closed');
    }
}

// ESC закрывает меню. Используем keyup (как и в телефоне index.js) -
// плагин samp-cef инжектит клавиатурный ввод так, что keyup надёжнее
// долетает до DOM, чем keydown.
function handleCircleMenuEscape(e) {
    if ((e.code === 'Escape' || e.key === 'Escape') && document.body.classList.contains('menu-open')) {
        e.preventDefault();
        // если открыто подменю "Финансы" - сначала возвращаемся в
        // главное меню, а не закрываем всё целиком
        if (payMenu.root.classList.contains('active')) {
            payMenu.root.classList.remove('active');
            mainMenu.root.classList.add('active');
        } else {
            closeCircleMenu();
        }
    }
}
document.addEventListener('keyup', handleCircleMenuEscape);
document.addEventListener('keydown', handleCircleMenuEscape);

document.addEventListener('DOMContentLoaded', () => {
    mainMenu = new MainMenu();
    payMenu = new PayMenu();

    console.log('[CircleMenu] DOMContentLoaded, typeof cef =', typeof cef);

    if (typeof cef !== 'undefined') {
        // v igre (vnutri CEF): menyu skryto po umolchaniyu (sm. styles.css),
        // pokazyvaetsya tolko po realnomu sobytiyu openCircleMenu ot Pawn
        cef.on('openCircleMenu', () => {
            console.log('[CircleMenu] poluchil sobytie openCircleMenu ot Pawn');
            openCircleMenu();
        });
        cef.on('closeCircleMenu', () => closeCircleMenu());
        console.log('[CircleMenu] podpiski cef.on zaregistrirovany');
    } else {
        // obychnyy brauzer (ne CEF) - obekta cef net i sobytiy ot Pawn
        // nikogda ne pridet, poetomu dlya preview/otladki pokazyvaem
        // menyu srazu, chtoby bylo vidno chto stranica vообще rabotaet
        console.warn('[CircleMenu] obekt cef NE naiden - otkryto v obychnom brauzere, pokazyvayu menyu dlya preview');
        openCircleMenu();
    }
});

// доступно для прямого вызова из Pawn-моста / консоли при отладке
window.openCircleMenu = () => openCircleMenu();
window.closeCircleMenu = () => closeCircleMenu();
