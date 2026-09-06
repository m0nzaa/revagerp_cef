var defspeed = 504.295;
var deffuel  = 208.907;
var defheal  = 118.296;
var SPEED_MAX = 280;

// ── Защита от undefined/NaN ──────────────────────────────────
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

// ── Глобальные функции — CEF вызывает их напрямую ───────────
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

// ── Явно вешаем на window — на случай если CEF ищет именно там
window.speedo_show = speedo_show;
window.speedo_hide = speedo_hide;
window.speedo_data = speedo_data;

// ── CustomEvent fallback (если плагин шлёт через dispatchEvent) ─
window.addEventListener("speedo_show", function() {
    speedo_show();
});

window.addEventListener("speedo_hide", function() {
    speedo_hide();
});

window.addEventListener("speedo_data", function(e) {
    if (!e || !e.detail) return;
    var d = e.detail;

    // detail может быть массивом, объектом или одним значением
    if (Array.isArray(d)) {
        speedo_data(d[0], d[1], d[2], d[3], d[4], d[5], d[6]);
    } else if (typeof d === "object") {
        speedo_data(d.speed, d.fuel, d.hp, d.engine, d.doors, d.belt, d.lights);
    }
});
