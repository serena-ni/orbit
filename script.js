// canvas setup
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// spaceship
let spaceship = { x: 0, y: 0, size:22, speed:0, angle:0 };
let lives = 3;
let elapsedTime = 0;
let keys = {};
let lastTime = 0;

// camera
let camera = { x: 0, y: 0, shakeX:0, shakeY:0 };

// gravity wells
const gravityStrength = 0.00027;

// planet params
const planetSpacing = { min: 450, max:850 };
const planetSize = { min:40, max:120 };

// palette
const palette = ["#6fa8ff","#6b5bff","#4fc3f7","#8ca5ff","#5f7bff","#7fb4ff"];

// planets list
let planets = [];

// thrust particles
let particles = [];

// game state
let gameStarted = false;
let gamePaused = false;
let startTime = 0;

// input
document.addEventListener("keydown", e => keys[e.key.toLowerCase()]=true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()]=false);

// random planet color
function randomColor(){ return palette[Math.floor(Math.random()*palette.length)]; }

// generate planet
function generatePlanet(lastX){
  const x = lastX + planetSpacing.min + Math.random()*(planetSpacing.max-planetSpacing.min);
  const y = 100 + Math.random()*(canvas.height-200);
  const size = planetSize.min + Math.random()*(planetSize.max-planetSize.min);
  return { x, y, size, color: randomColor() };
}

// generate planet field
function generateField(){
  planets = [];
  let x = 600;
  for(let i=0;i<12;i++){
    const p = generatePlanet(x);
    x = p.x;
    planets.push(p);
  }
}

// reset player
function resetPlayer(){
  spaceship.x = 200;
  spaceship.y = canvas.height/2;
  spaceship.speed=0;
  spaceship.angle=0;
  camera.x = spaceship.x;
  camera.y = spaceship.y;
}

// update physics
function update(dt){
  if(gamePaused) return;

  // thrust/brake
  if(keys["w"]) spaceship.speed += 0.0007*dt;
  if(keys["s"]) spaceship.speed -= 0.0004*dt;

  // rotate
  if(keys["a"]) spaceship.angle -= 0.004*dt;
  if(keys["d"]) spaceship.angle += 0.004*dt;

  // move ship
  spaceship.x += Math.cos(spaceship.angle)*spaceship.speed;
  spaceship.y += Math.sin(spaceship.angle)*spaceship.speed;

  // gravity wells
  for(let p of planets){
    const dx = p.x - spaceship.x;
    const dy = p.y - spaceship.y;
    const dist = Math.hypot(dx,dy);
    if(dist < p.size*5){
      const force = gravityStrength * (p.size*2)/dist;
      spaceship.x += dx*force*dt;
      spaceship.y += dy*force*dt;
    }
  }

  // camera follow with shake
  camera.x += ((spaceship.x - camera.x) + camera.shakeX) * 0.05;
  camera.y += ((spaceship.y - camera.y) + camera.shakeY) * 0.05;
  camera.shakeX *= 0.85;
  camera.shakeY *= 0.85;

  // generate more planets
  const last = planets[planets.length-1];
  if(last.x < spaceship.x + canvas.width*1.5) planets.push(generatePlanet(last.x));

  // timer
  elapsedTime = Math.floor((performance.now()-startTime)/1000);
  document.getElementById("timerDisplay").textContent = `time: ${elapsedTime}s`;
  document.getElementById("livesDisplay").textContent = `lives: ${lives}`;

  // collision
  for(let p of planets){
    const dist = Math.hypot(spaceship.x-p.x, spaceship.y-p.y);
    if(dist < p.size+spaceship.size){
      lives--;
      if(lives<=0){
        lives=3;
        generateField();
      }
      camera.shakeX = (Math.random()-0.5)*20;
      camera.shakeY = (Math.random()-0.5)*20;
      resetPlayer();
      startTime = performance.now();
      return;
    }
  }

  // thrust particles
  if(keys["w"]){
    for(let i=0;i<2;i++){
      particles.push({
        x: spaceship.x - Math.cos(spaceship.angle)*spaceship.size,
        y: spaceship.y - Math.sin(spaceship.angle)*spaceship.size,
        vx: (-Math.cos(spaceship.angle)*0.5 + (Math.random()-0.5)*0.5),
        vy: (-Math.sin(spaceship.angle)*0.5 + (Math.random()-0.5)*0.5),
        life: 20 + Math.random()*10
      });
    }
  }

  particles = particles.filter(p => p.life>0);
  for(let p of particles){
    p.x += p.vx*dt*0.1;
    p.y += p.vy*dt*0.1;
    p.life -= 1;
  }
}

// draw everything
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(-camera.x + canvas.width/2, -camera.y + canvas.height/2);

  // planets
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

  // thrust particles
  for(let p of particles){
    ctx.fillStyle = `rgba(255,149,102,${p.life/30})`;
    ctx.beginPath();
    ctx.arc(p.x,p.y,2,0,Math.PI*2);
    ctx.fill();
  }

  // ship
  ctx.save();
  ctx.translate(spaceship.x, spaceship.y);
  ctx.rotate(spaceship.angle);

  ctx.fillStyle="#fff";
  ctx.beginPath();
  ctx.moveTo(spaceship.size,0);
  ctx.lineTo(-spaceship.size, spaceship.size*0.65);
  ctx.lineTo(-spaceship.size, -spaceship.size*0.65);
  ctx.closePath();
  ctx.fill();

  if(keys["w"]){
    ctx.fillStyle="#ff9566";
    ctx.beginPath();
    ctx.moveTo(-spaceship.size,0);
    ctx.lineTo(-spaceship.size-12,6);
    ctx.lineTo(-spaceship.size-12,-6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
  ctx.restore();
}

// main loop
function loop(t){
  if(!gameStarted) return;
  let dt = t-lastTime;
  lastTime = t;
  if(!gamePaused){
    update(dt);
    draw();
  }
  requestAnimationFrame(loop);
}

// start button
document.getElementById("startBtn").onclick = () => {
  document.getElementById("startOverlay").classList.add("hidden");
  gameStarted=true;
  startTime = performance.now();
  lastTime=startTime;
  generateField();
  resetPlayer();
  loop();
};

// info button
document.getElementById("infoBtnStart").onclick = () => document.getElementById("infoOverlay").classList.remove("hidden");
document.getElementById("infoBtnGame").onclick = () => document.getElementById("infoOverlay").classList.remove("hidden");
document.getElementById("closeInfoBtn").onclick = () => document.getElementById("infoOverlay").classList.add("hidden");

// pause button
document.getElementById("pauseBtn").onclick = () => {
  gamePaused = !gamePaused;
  document.getElementById("pauseOverlay").classList.toggle("hidden");
};

// reset button
document.getElementById("resetBtn").onclick = () => {
  generateField();
  resetPlayer();
  startTime = performance.now();
};
