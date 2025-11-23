// canvas setup
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// spaceship
let spaceship = { x: 0, y: 0, size: 22, speed: 0, angle: 0 };
let lives = 3;
let elapsedTime = 0;
let cameraX = 0;
let keys = {};
let lastTime = 0;

// gravity
const gravityStrength = 0.00027;

// planets
const planetSpacing = { min: 450, max: 850 };
const planetSize = { min: 40, max: 120 };
const palette = ["#6fa8ff","#6b5bff","#4fc3f7","#8ca5ff","#5f7bff","#7fb4ff"];
let planets = [];

// game state
let gameStarted = false;
let startTime = 0;

// input
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// random planet color
function randomColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

// generate a planet
function generatePlanet(lastX) {
  const x = lastX + planetSpacing.min + Math.random()*(planetSpacing.max-planetSpacing.min);
  const y = 100 + Math.random()*(canvas.height-200);
  const size = planetSize.min + Math.random()*(planetSize.max-planetSize.min);
  return { x, y, size, color: randomColor() };
}

// generate initial planets
function generateField() {
  planets = [];
  let x = 600;
  for(let i=0;i<12;i++){
    const p = generatePlanet(x);
    x = p.x;
    planets.push(p);
  }
}

// reset player
function resetPlayer() {
  spaceship.x = planets[0].x - 200;
  spaceship.y = planets[0].y;
  spaceship.speed = 0;
  spaceship.angle = 0;
}

// update physics
function update(dt){
  // thrust
  if(keys["w"]) spaceship.speed += 0.0007*dt;
  if(keys["s"]) spaceship.speed -= 0.0004*dt;

  // rotation
  if(keys["a"]) spaceship.angle -= 0.004*dt;
  if(keys["d"]) spaceship.angle += 0.004*dt;

  // movement
  spaceship.x += Math.cos(spaceship.angle)*spaceship.speed;
  spaceship.y += Math.sin(spaceship.angle)*spaceship.speed;

  // gravity wells
  for(let p of planets){
    const dx = p.x - spaceship.x;
    const dy = p.y - spaceship.y;
    const dist = Math.hypot(dx, dy);
    if(dist < p.size*5){
      const force = gravityStrength*(p.size*2)/dist;
      spaceship.x += dx*force*dt;
      spaceship.y += dy*force*dt;
    }
  }

  // camera smooth follow
  cameraX += (spaceship.x - cameraX - canvas.width/3)*0.08;

  // generate new planets
  const last = planets[planets.length-1];
  if(last.x < spaceship.x + canvas.width*1.5) planets.push(generatePlanet(last.x));

  // timer
  elapsedTime = Math.floor((performance.now() - startTime)/1000);
  document.getElementById("timerDisplay").textContent = `time: ${elapsedTime}s`;
  document.getElementById("livesDisplay").textContent = `lives: ${lives}`;

  // collision
  for(let p of planets){
    const dist = Math.hypot(spaceship.x - p.x, spaceship.y - p.y);
    if(dist < p.size + spaceship.size){
      lives--;
      if(lives <= 0){
        lives = 3;
        generateField();
      }
      resetPlayer();
      startTime = performance.now();
      return;
    }
  }
}

// draw planets
function drawPlanets(){
  for(let p of planets){
    const glow = ctx.createRadialGradient(p.x, p.y, p.size*0.6, p.x, p.y, p.size*2.1);
    glow.addColorStop(0,p.color+"88");
    glow.addColorStop(1,p.color+"00");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.size*2,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
    ctx.fill();
  }
}

// draw spaceship
function drawShip(){
  ctx.save();
  ctx.translate(spaceship.x, spaceship.y);
  ctx.rotate(spaceship.angle);

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(spaceship.size,0);
  ctx.lineTo(-spaceship.size,spaceship.size*0.65);
  ctx.lineTo(-spaceship.size,-spaceship.size*0.65);
  ctx.closePath();
  ctx.fill();

  if(keys["w"]){
    ctx.fillStyle = "#ff9566";
    ctx.beginPath();
    ctx.moveTo(-spaceship.size,0);
    ctx.lineTo(-spaceship.size-10,6);
    ctx.lineTo(-spaceship.size-10,-6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// draw all
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(-cameraX,0);
  drawPlanets();
  drawShip();
  ctx.restore();
}

// main loop
function loop(t){
  if(!gameStarted) return;
  let dt = t-lastTime;
  lastTime = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// start game
document.getElementById("startBtn").onclick = () => {
  document.getElementById("startOverlay").classList.add("hidden");
  gameStarted = true;
  generateField();
  resetPlayer();
  startTime = performance.now();
  lastTime = startTime;
  loop();
};

// info buttons
document.getElementById("infoBtnStart").onclick = () => document.getElementById("infoOverlay").classList.remove("hidden");
document.getElementById("infoBtnGame").onclick = () => document.getElementById("infoOverlay").classList.remove("hidden");
document.getElementById("closeInfoBtn").onclick = () => document.getElementById("infoOverlay").classList.add("hidden");

// reset button
document.getElementById("resetBtn").onclick = () => {
  resetPlayer();
  startTime = performance.now();
};
