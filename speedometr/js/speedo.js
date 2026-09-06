var defspeed = 504.295;
var deffuel  = 208.907;
var defheal  = 118.296;
var SPEED_MAX = 280;

function setSpeed(speed) {
    speed = parseInt(speed) || 0;
    var clamped = Math.min(speed, SPEED_MAX);
    var offset  = defspeed - (defspeed * clamped / SPEED_MAX);
    $("#hud-speedometer").css({
        "stroke-dasharray":  defspeed + ", " + defspeed,
        "stroke-dashoffset": offset
    });
    $("#textspeed").text(speed);
}

function setFuel(fuel) {
    fuel = parseInt(fuel) || 0;
    var clamped = Math.min(fuel, 100);
    var offset  = deffuel - (deffuel * clamped / 100);
    $("#hud-fuel").css({
        "stroke-dasharray":  deffuel + ", " + deffuel,
        "stroke-dashoffset": offset
    });
}

function setHP(hp) {
    hp = parseInt(hp) || 0;
    var clamped = Math.min(hp, 100);
    var offset  = defheal - (defheal * clamped / 100);
    $("#hud-engine").css({
        "stroke-dasharray":  defheal + ", " + defheal,
        "stroke-dashoffset": offset
    });
    $("#healproc").text(hp + "%");
}

// ── Основные функции ─────────────────────────────────────────
function speedo_show() {
    $(".hud-speedometer").show();
    $(".hud-speedomter-footer").show();
}

function speedo_hide() {
    $(".hud-speedometer").hide();
    $(".hud-speedomter-footer").hide();
    setSpeed(0);
    setFuel(0);
    setHP(0);
}

function speedo_data(speed, fuel, hp, engine, doors, belt, lights) {
    setSpeed(speed);
    setFuel(fuel);
    setHP(hp);
    $("#eng").attr("class",  "hud-speedomter-footer-item ctrl "  + (engine ? "on" : "off"));
    $("#door").attr("class", "hud-speedomter-footer-item door "  + (doors  ? "on" : "off"));
}

// ── Вешаем на window явно (некоторые версии CEF ищут там) ───
window.speedo_show = speedo_show;
window.speedo_hide = speedo_hide;
window.speedo_data = speedo_data;

// ── Слушаем CustomEvent от samp-cef ─────────────────────────
// Сервер шлёт данные одной JSON-строкой через cef_emit_event:
// cef_emit_event(playerid, "speedo_data", "{...json...}")
// Она приходит в e.detail — парсим и передаём в speedo_data()

window.addEventListener("speedo_show", function() {
    speedo_show();
});

window.addEventListener("speedo_hide", function() {
    speedo_hide();
});

window.addEventListener("speedo_data", function(e) {
    if (!e || e.detail === undefined || e.detail === null) return;
    try {
        var raw = e.detail;

        // Если это строка — парсим JSON
        if (typeof raw === "string") {
            var d = JSON.parse(raw);
            speedo_data(d.speed, d.fuel, d.hp, d.engine, d.doors, d.belt, d.lights);
            return;
        }

        // Если объект с именованными ключами {speed, fuel, ...}
        if (typeof raw === "object" && raw.speed !== undefined) {
            speedo_data(raw.speed, raw.fuel, raw.hp, raw.engine, raw.doors, raw.belt, raw.lights);
            return;
        }

        // Фолбэк: объект с числовыми ключами {0: speed, 1: fuel, ...}
        if (typeof raw === "object") {
            speedo_data(raw[0], raw[1], raw[2], raw[3], raw[4], raw[5], raw[6]);
            return;
        }
    } catch(err) {
        // JSON.parse упал — игнорируем
    }
});
