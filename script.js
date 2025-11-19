// canvas setup
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// game state
let width = canvas.width;
let height = canvas.height;

let spaceship = { x: 240, y: height/2, vx: 0, vy: 0, angle: -Math.PI/2, radius: 12 };
let planets = [];
let checkpoints = [{ x: 240, y: height/2 }];
let checkpointIndex = -1;

let lives = 3;
let startTime = 0;
let elapsedTime = 0;
let lastTime = 0;
let gameStarted = false;
let paused = false;

// camera
const camera = { x: spaceship.x, y: spaceship.y, smooth: 0.12 };

// planet settings
const planetSpacing = { min: 420, max: 800 };
const planetSize = { min: 36, max: 110 };
const minY = 80;
const maxY = () => Math.max(220, canvas.height - 140);

// input
const keys = {};
window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// particles & screen shake
let particles = [];
let shakeTime = 0;
let shakeMagnitude = 0;

// palette
const palette = ["#6fa8ff","#6b5bff","#4fc3f7","#8ca5ff","#5f7bff","#7fb4ff"];

// UI elements
const startOverlay = document.getElementById("startOverlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startBtn = document.getElementById("startBtn");
const infoBtn = document.getElementById("infoBtn");
const resetBtn = document.getElementById("resetBtn");
const timerDisplay = document.getElementById("timerDisplay");
const livesDisplay = document.getElementById("livesDisplay");

// helpers
function randomColor() { return palette[Math.floor(Math.random()*palette.length)]; }
function hexToRGBA(hex, a) { 
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16); 
  return `rgba(${r},${g},${b},${a})`; 
}
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

// planets
function generateInitialPlanets(){
  planets = [];
  let x = 600;
  for(let i=0;i<8;i++){
    const size = planetSize.min + Math.random()*(planetSize.max - planetSize.min);
    const yBase = minY + Math.random()*(maxY() - minY);
    const y = clamp(yBase + 40*Math.sin(x/280) + (Math.random()-0.5)*120, minY, maxY());
    planets.push({ x, y, size, color: randomColor() });
    x += planetSpacing.min + Math.random()*(planetSpacing.max - planetSpacing.min);
  }
}

function generatePlanet(){
  const last = planets[planets.length-1];
  const newX = last.x + planetSpacing.min + Math.random()*(planetSpacing.max - planetSpacing.min);
  const yBase = minY + Math.random()*(maxY() - minY);
  const newY = clamp(yBase + 60*Math.sin(newX/250) + (Math.random()-0.5)*140, minY, maxY());
  const newSize = planetSize.min + Math.random()*(planetSize.max - planetSize.min);
  planets.push({ x:newX, y:newY, size:newSize, color: randomColor() });
}

function removeFarPlanets(){
  const left = spaceship.x - 1200;
  planets = planets.filter(p => (p.x + p.size) > left);
}

// checkpoints/respawn
function setCheckpointFromPlanetIndex(i){
  const p = planets[i];
  const cp = { x: p.x - Math.max(180, p.size + 60), y: clamp(p.y - p.size - 36, minY, maxY()) };
  checkpoints.push(cp);
  checkpointIndex = checkpoints.length - 1;
}

function isOverlappingPlanet(x,y,margin=0){
  for(const p of planets){
    if(Math.hypot(p.x-x,p.y-y) < p.size + spaceship.radius + margin) return true;
  }
  return false;
}

function findSafeSpawnAround(tx,ty){
  const maxTries = 60;
  const step = 36;
  for(let t=0;t<maxTries;t++){
    const ang = Math.random()*Math.PI*2;
    const r = (t+1)*step*Math.random();
    const sx = tx + Math.cos(ang)*r;
    const sy = clamp(ty + Math.sin(ang)*r, minY, maxY());
    if(!isOverlappingPlanet(sx,sy,8)) return { x: sx, y: sy };
  }
  return { x: tx, y: clamp(ty - 160, minY, maxY()) };
}

function respawnAtCheckpoint(){
  let cp = checkpoints[checkpointIndex >= 0 ? checkpointIndex : 0] || { x:240, y:height/2 };
  let nearest = null;
  for(const p of planets){
    const d = Math.hypot(p.x - cp.x, p.y - cp.y);
    if(!nearest || d < nearest.d){ nearest = { p, d }; }
  }
  if(nearest){
    cp.x = nearest.p.x - nearest.p.size - 18;
    cp.y = nearest.p.y - nearest.p.size - 36;
  }
  const safe = findSafeSpawnAround(cp.x, cp.y);
  spaceship.x = safe.x; spaceship.y = safe.y;
  spaceship.vx = 0; spaceship.vy = 0; spaceship.angle = -Math.PI/2;
  camera.x = spaceship.x; camera.y = spaceship.y;
  for(const k in keys) keys[k] = false;
}

// particles
function createCollisionParticles(x,y){
  for(let i=0;i<18;i++){
    const ang = Math.random()*Math.PI*2;
    const spd = 120 + Math.random()*180;
    particles.push({ x,y,vx:Math.cos(ang)*spd, vy:Math.sin(ang)*spd, life:400, maxLife:400 });
  }
}

// update
function update(dtMs){
  if(paused) return;
  const s = clamp(dtMs/1000, 0, 0.06);

  // rotation
  const rotSpeed = 2.8;
  if(keys["a"] || keys["arrowleft"]) spaceship.angle -= rotSpeed*s;
  if(keys["d"] || keys["arrowright"]) spaceship.angle += rotSpeed*s;

  // thrust / brake
  const thrustAccel = 360;
  const brakeFactor = 0.92;
  if(keys["w"] || keys["arrowup"]){
    spaceship.vx += Math.cos(spaceship.angle)*thrustAccel*s;
    spaceship.vy += Math.sin(spaceship.angle)*thrustAccel*s;

    if(Math.random() < 0.6) particles.push({
      x: spaceship.x - Math.cos(spaceship.angle)*spaceship.radius*1.05,
      y: spaceship.y - Math.sin(spaceship.angle)*spaceship.radius*1.05,
      vx: Math.cos(spaceship.angle+Math.PI + (Math.random()-0.5)*0.8)*(18+Math.random()*40),
      vy: Math.sin(spaceship.angle+Math.PI + (Math.random()-0.5)*0.8)*(18+Math.random()*40),
      life: 160 + Math.random()*120, maxLife: 160 + Math.random()*120, type: 'engine'
    });
  }
  if(keys["s"] || keys["arrowdown"]){
    spaceship.vx *= brakeFactor; spaceship.vy *= brakeFactor;
  }

  // cap speed
  const maxSpeed = 1100;
  const spd = Math.hypot(spaceship.vx, spaceship.vy);
  if(spd > maxSpeed){
    const sc = maxSpeed / spd;
    spaceship.vx *= sc; spaceship.vy *= sc;
  }

  // drag & integrate
  spaceship.vx *= 0.998; spaceship.vy *= 0.998;
  spaceship.x += spaceship.vx * s; spaceship.y += spaceship.vy * s;

  // camera
  camera.x += (spaceship.x - camera.x) * camera.smooth;
  camera.y += (spaceship.y - camera.y) * camera.smooth;

  // planet generation + cleanup
  while(planets.length === 0 || planets[planets.length-1].x < spaceship.x + canvas.width * 1.2) generatePlanet();
  removeFarPlanets();

  // timer/lives
  elapsedTime = (performance.now() - startTime) / 1000;
  timerDisplay.innerHTML = `<strong>time:</strong> ${Math.floor(elapsedTime)}s`;
  livesDisplay.innerHTML = `<strong>lives:</strong> ${lives}`;

  // particles
  for(let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.life -= dtMs;
    if(p.life <= 0){ particles.splice(i,1); continue; }
    const dt = dtMs/1000;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if(p.type === 'engine'){ p.vx *= 0.92; p.vy *= 0.92; } else { p.vx *= 0.975; p.vy *= 0.975; }
  }

  // collisions & checkpoints
  for(let i=0;i<planets.length;i++){
    const p = planets[i];
    const dx = p.x - spaceship.x;
    const dy = p.y - spaceship.y;
    const dist = Math.hypot(dx, dy);
    if(dist < p.size + spaceship.radius){
      lives = Math.max(0, lives - 1);
      createCollisionParticles(spaceship.x, spaceship.y);
      shakeTime = 220; shakeMagnitude = 10;
      if(checkpointIndex < i) setCheckpointFromPlanetIndex(i);
      respawnAtCheckpoint();
      break;
    }
    if(spaceship.x > p.x + p.size && checkpointIndex < i){
      setCheckpointFromPlanetIndex(i);
    }
  }

  if(lives <= 0){
    overlayTitle.textContent = "game over";
    overlayText.innerHTML = `you survived for ${Math.floor(elapsedTime)}s. press start to try again.`;
    startOverlay.style.display = "flex";
    infoBtn.style.display = "none";
    resetBtn.style.display = "none";
    paused = true;
    gameStarted = false;
  }
}

// draw
function draw(){
  ctx.fillStyle = "#0b0c1a";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  const camX = Math.round(camera.x - canvas.width / 2);
  const camY = Math.round(camera.y - canvas.height / 2);

  // shake
  let shakeX = 0, shakeY = 0;
  if(shakeTime > 0){
    shakeTime -= 16;
    shakeX = (Math.random() - 0.5) * shakeMagnitude;
    shakeY = (Math.random() - 0.5) * shakeMagnitude;
    shakeMagnitude *= 0.94;
    if(shakeTime <= 0) shakeMagnitude = 0;
  }

  // stars
  ctx.fillStyle = "#ffffff22";
  for(let i=0;i<120;i++){
    const rx = ((i*9301+49297)%233280)/233280;
    const ry = ((i*49297+9301)%233280)/233280;
    const x = Math.floor(rx*(canvas.width*2)) - camX*0.28;
    const y = Math.floor(ry*(canvas.height*2)) - camY*0.28;
    ctx.fillRect((x%canvas.width+canvas.width)%canvas.width,(y%canvas.height+canvas.height)%canvas.height,1,1);
  }

  ctx.save();
  ctx.translate(-camX + shakeX, -camY + shakeY);

  // planets
  for(const p of planets){
    const glowRadius = p.size * 1.9;
    const grad = ctx.createRadialGradient(p.x, p.y, p.size*0.4, p.x, p.y, glowRadius);
    grad.addColorStop(0, hexToRGBA(p.color, 0.66));
    grad.addColorStop(1, hexToRGBA(p.color, 0.0));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(p.x, p.y, glowRadius, 0, Math.PI*2); ctx.fill();

    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();
  }

  // particles
  for(const p of particles){
    const a = Math.max(0, p.life / p.maxLife);
    if(p.type === 'engine'){
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = `rgba(255,190,120,${0.6 * a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1 + (1-a)*3, 0, Math.PI*2); ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    } else {
      ctx.fillStyle = `rgba(255,180,80,${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.4 + (1-a)*2.6, 0, Math.PI*2); ctx.fill();
    }
  }

  // spaceship
  ctx.save();
  ctx.translate(spaceship.x, spaceship.y);
  ctx.rotate(spaceship.angle);

  if(keys["w"] || keys["arrowup"]){
    const flameLength = 8 + Math.random()*4;
    ctx.fillStyle = "#ffb86c";
    ctx.beginPath();
    ctx.moveTo(-spaceship.radius*0.9, 0);
    ctx.lineTo(-spaceship.radius*0.9-flameLength, 6);
    ctx.lineTo(-spaceship.radius*0.9-flameLength, -6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(spaceship.radius*1.1, 0);
  ctx.lineTo(-spaceship.radius*0.8, spaceship.radius);
  ctx.lineTo(-spaceship.radius*0.8, -spaceship.radius);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.restore();
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

// UI events
startBtn.addEventListener("click", () => {
  if (overlayTitle.textContent === "orbit" || overlayTitle.textContent === "game over") {
    generateInitialPlanets();
    checkpoints = [{ x: 240, y: height / 2 }];
    checkpointIndex = -1;
    lives = 3;
    elapsedTime = 0;
    startTime = performance.now();
    respawnAtCheckpoint();
    particles = [];
    startOverlay.style.display = "none";
    infoBtn.style.display = "inline-block";
    resetBtn.style.display = "inline-block";
    paused = false;
    gameStarted = true;
    requestAnimationFrame(loop);
  }
});

infoBtn.addEventListener("click", () => {
  overlayTitle.textContent = "controls & instructions";
  overlayText.innerHTML = `
    <strong>W / ↑</strong> — thrust forward<br>
    <strong>S / ↓</strong> — brake / slow down<br>
    <strong>A / ←</strong> — rotate left<br>
    <strong>D / →</strong> — rotate right<br><br>
    Pass planets to set checkpoints. Colliding respawns you at the last checkpoint.
  `;
  startOverlay.style.display = "flex";
  infoBtn.style.display = "none";
  resetBtn.style.display = "none";
  paused = true;
  gameStarted = false;
});

// close overlay on background click (only for info)
startOverlay.addEventListener("click", (e) => {
  if(e.target === startOverlay && overlayTitle.textContent === "controls & instructions"){
    startOverlay.style.display = "none";
    infoBtn.style.display = "inline-block";
    resetBtn.style.display = "inline-block";
    paused = false;
    gameStarted = true;
    requestAnimationFrame(loop);
  }
});

resetBtn.addEventListener("click", () => {
  generateInitialPlanets();
  checkpoints = [{ x:240, y:height/2 }];
  checkpointIndex = -1;
  lives = 3;
  elapsedTime = 0;
  startTime = performance.now();
  respawnAtCheckpoint();
  particles = [];
  startOverlay.style.display = "none";
  infoBtn.style.display = "inline-block";
  resetBtn.style.display = "inline-block";
  paused = false;
  gameStarted = true;
  for(const k in keys) keys[k] = false;
  requestAnimationFrame(loop);
});

// BOOTSTRAP
generateInitialPlanets();
respawnAtCheckpoint();
startOverlay.style.display = "flex";
infoBtn.style.display = "none";
resetBtn.style.display = "none";
