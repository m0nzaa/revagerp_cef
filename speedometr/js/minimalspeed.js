var defspeed = 504.295;
var deffuel = 208.896;
var defheal = 118.296;
var speed = 0;
var fuel = 0;
var heal = 0;
var speedtogl = true;
var fueltogl = true;
var healtogl = true;  
function minimalSpeed () {
   setInterval(function(){
	   if(speedtogl == true){
	   var newspeed = speed + 1;
	   var setspeed = defspeed + newspeed;
	   if(speed == 504){speedtogl = false
	   $('#cruise').attr('class', "hud-speedomter-footer-item cruise off");}
	   }else{
		var newspeed = speed - 1;
		var setspeed = defspeed + newspeed;
		if(speed == 0){speedtogl = true
		$('#cruise').attr('class', "hud-speedomter-footer-item cruise on");}
	   }
	   $("#hud-speedometer").css("stroke-dasharray", setspeed);
	   $("#textspeed").text(newspeed);
	   speed = newspeed
	   ///benz
	   if(fueltogl == true){
	   var newfuel = fuel + 1;
	   var setfuel = deffuel + newfuel;
	   if(fuel == 208){fueltogl = false
	   $('#eng').attr('class', "hud-speedomter-footer-item ctrl off");}
	   }else{
		var newfuel = fuel - 1;
		var setfuel = deffuel + newfuel;
		if(fuel == 0){fueltogl = true
		$('#eng').attr('class', "hud-speedomter-footer-item ctrl on");}
	   }
	   $("#hud-fuel").css("stroke-dasharray", setfuel);
	   fuel = newfuel
		///heal
	   if(healtogl == true){
	   var newheal = heal + 1;
	   var setheal = defheal + newheal;
	   if(heal == 118){healtogl = false
	   $('#door').attr('class', "hud-speedomter-footer-item door off");}
	   }else{
		var newheal = heal - 1;
		var setheal = defheal + newheal;
		if(heal == 0){healtogl = true
		$('#door').attr('class', "hud-speedomter-footer-item door on");}
	   }
	   $("#hud-engine").css("stroke-dasharray", setheal);
	   $("#healproc").text(newheal + "%");
	   heal = newheal
   }, 40);
  
}
document.addEventListener('DOMContentLoaded', function() {
	minimalSpeed();
}, false);
