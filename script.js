// canvas setup
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// game objects
let spaceship = { x: 0, y: 0, size: 22, speed: 0, angle: 0 };
let lives = 3;
let elapsedTime = 0;
let camera = { x: 0, y: 0, smooth: 0.08 };
let lastTime = 0;
let keys = {};
let planets = [];
let gameStarted = false;
let startTime = 0;

// planet settings
const planetSpacing = { min: 450, max: 850 };
const planetSize = { min: 40, max: 120 };
const palette = ["#6fa8ff","#6b5bff","#4fc3f7","#8ca5ff","#5f7bff","#7fb4ff"];
const gravityStrength = 0.00027;

// input
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// random color
function randomColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

// generate a planet
function generatePlanet(lastX) {
  const x = lastX + planetSpacing.min + Math.random()*(planetSpacing.max - planetSpacing.min);
  const y = 100 + Math.random()*(canvas.height - 200);
  const size = planetSize.min + Math.random()*(planetSize.max - planetSize.min);
  return { x, y, size, color: randomColor() };
}

// generate planet field
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
  // start directly across from first planet
  const firstPlanet = planets[0] || { x: 600, y: canvas.height/2 };
  spaceship.x = firstPlanet.x - 180;
  spaceship.y = firstPlanet.y;
  spaceship.speed = 0;
  spaceship.angle = 0;
  camera.x = spaceship.x;
  camera.y = spaceship.y;
}

// update physics
function update(dtMs) {
  const dt = Math.min(dtMs / 16.666, 2); // prevent lag spikes

  // rotation
  if(keys["a"]) spaceship.angle -= 0.004*dtMs;
  if(keys["d"]) spaceship.angle += 0.004*dtMs;

  // thrust/brake
  if(keys["w"]) spaceship.speed += 0.0007*dtMs;
  if(keys["s"]) spaceship.speed -= 0.0004*dtMs;

  // apply movement
  spaceship.x += Math.cos(spaceship.angle)*spaceship.speed*dtMs;
  spaceship.y += Math.sin(spaceship.angle)*spaceship.speed*dtMs;

  // gravity wells
  for(let p of planets){
    const dx = p.x - spaceship.x;
    const dy = p.y - spaceship.y;
    const dist = Math.hypot(dx, dy);
    if(dist < p.size*5){
      const force = gravityStrength * (p.size*2) / dist;
      spaceship.x += dx*force*dtMs;
      spaceship.y += dy*force*dtMs;
    }
  }

  // camera smooth follow
  camera.x += (spaceship.x - camera.x) * camera.smooth;
  camera.y += (spaceship.y - camera.y) * camera.smooth;

  // regenerate planets
  const last = planets[planets.length-1];
  if(last.x < spaceship.x + canvas.width*1.5){
    planets.push(generatePlanet(last.x));
  }

  // timer
  elapsedTime = Math.floor((performance.now()-startTime)/1000);
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
function drawPlanets() {
  for(let p of planets){
    const glow = ctx.createRadialGradient(p.x,p.y,p.size*0.6,p.x,p.y,p.size*2);
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

// draw spaceship with thrust flame
function drawShip() {
  ctx.save();
  // camera offset
  ctx.translate(-camera.x + canvas.width/2, -camera.y + canvas.height/2);

  // ship position
  ctx.translate(spaceship.x, spaceship.y);
  ctx.rotate(spaceship.angle);

  // body
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(spaceship.size,0);
  ctx.lineTo(-spaceship.size, spaceship.size*0.65);
  ctx.lineTo(-spaceship.size, -spaceship.size*0.65);
  ctx.closePath();
  ctx.fill();

  // thrust flame
  if(keys["w"]){
    ctx.fillStyle = "#ff9566";
    ctx.beginPath();
    ctx.moveTo(-spaceship.size,0);
    ctx.lineTo(-spaceship.size-12,6);
    ctx.lineTo(-spaceship.size-12,-6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// draw everything
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawPlanets();
  drawShip();
}

// main loop
function loop(ts){
  if(!gameStarted) return;
  if(!lastTime) lastTime = ts;
  const dt = ts - lastTime;
  lastTime = ts;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// start button
document.getElementById("startBtn").onclick = ()=>{
  document.getElementById("startOverlay").classList.add("hidden");
  gameStarted = true;
  startTime = performance.now();
  lastTime = startTime;
  generateField();
  resetPlayer();
  loop();
};

// info button
document.getElementById("infoBtnGame").onclick = ()=>{
  document.getElementById("infoOverlay").classList.remove("hidden");
};

// close info
document.getElementById("closeInfoBtn").onclick = ()=>{
  document.getElementById("infoOverlay").classList.add("hidden");
};

// reset button
document.getElementById("resetBtn").onclick = ()=>{
  resetPlayer();
  startTime = performance.now();
};
