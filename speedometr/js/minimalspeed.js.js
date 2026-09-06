var defspeed = 504.295;
var deffuel  = 208.907;
var defheal  = 118.296;
var SPEED_MAX = 280;

function setSpeed(speed) {
    var clamped = Math.min(speed, SPEED_MAX);
    var offset  = defspeed - (defspeed * clamped / SPEED_MAX);
    $("#hud-speedometer").css({
        "stroke-dasharray":  defspeed + ", " + defspeed,
        "stroke-dashoffset": offset
    });
    $("#textspeed").text(speed);
}

function setFuel(fuel) {
    var clamped = Math.min(fuel, 100);
    var offset  = deffuel - (deffuel * clamped / 100);
    $("#hud-fuel").css({
        "stroke-dasharray":  deffuel + ", " + deffuel,
        "stroke-dashoffset": offset
    });
}

function setHP(hp) {
    var clamped = Math.min(hp, 100);
    var offset  = defheal - (defheal * clamped / 100);
    $("#hud-engine").css({
        "stroke-dasharray":  defheal + ", " + defheal,
        "stroke-dashoffset": offset
    });
    $("#healproc").text(hp + "%");
}

// SAMP-CEF: события от сервера приходят как обычные JS-аргументы функции
// cef_emit_event(playerid, "speedo_data", speed, fuel, hp, engine, doors, belt, lights)
window.addEventListener("speedo_data", function(speed, fuel, hp, engine, doors, belt, lights) {
    setSpeed(speed);
    setFuel(fuel);
    setHP(hp);
    $("#eng").attr("class",  "hud-speedomter-footer-item ctrl "  + (engine ? "on" : "off"));
    $("#door").attr("class", "hud-speedomter-footer-item door "  + (doors  ? "on" : "off"));
});

window.addEventListener("speedo_show", function() {
    $(".hud-speedometer").show();
    $(".hud-speedomter-footer").show();
});

window.addEventListener("speedo_hide", function() {
    $(".hud-speedometer").hide();
    $(".hud-speedomter-footer").hide();
    setSpeed(0);
    setFuel(0);
    setHP(0);
});
