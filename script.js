// canvas setup
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// game objects & settings
let spaceship = { x: 240, y: canvas.height / 2, vx: 0, vy: 0, angle: -Math.PI / 2, radius: 12 };
let lives = 3;
let elapsedTime = 0;
let startTime = 0;
let lastTime = 0;
let gameStarted = false;

// camera smoothing
const camera = { x: spaceship.x, y: spaceship.y, smooth: 0.12 };

// planet generation settings
const planetSpacing = { min: 420, max: 700 };
const planetSize = { min: 40, max: 100 };
const minY = 100;
const maxY = () => Math.max(200, canvas.height - 120);

// theme palette
const palette = ["#6fa8ff","#6b5bff","#4fc3f7","#8ca5ff","#5f7bff","#7fb4ff"];

// planets array
let planets = [];
let checkpoints = [{ x: 240, y: canvas.height / 2 }];
let checkpointIndex = -1;

// input
const keys = {};
window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// UI elements
const startOverlay = document.getElementById("startOverlay");
const startBtn = document.getElementById("startBtn");
const infoBtn = document.getElementById("infoBtn");
const resetBtn = document.getElementById("resetBtn");
const timerDisplay = document.getElementById("timerDisplay");
const livesDisplay = document.getElementById("livesDisplay");

// particles + screen shake
let particles = [];
let shakeTime = 0;
let shakeMagnitude = 0;

// helpers
function randomColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// planet generation
function generateInitialPlanets() {
  planets = [];
  let x = 600;
  for (let i=0; i<6; i++) {
    const size = planetSize.min + Math.random()*(planetSize.max - planetSize.min);
    const y = minY + Math.random()*(maxY() - minY);
    planets.push({ x, y, size, color: randomColor() });
    x += planetSpacing.min + Math.random()*(planetSpacing.max - planetSpacing.min);
  }
}

function generatePlanet() {
  const last = planets[planets.length - 1];
  const newX = last.x + planetSpacing.min + Math.random()*(planetSpacing.max - planetSpacing.min);
  const yOffset = 60 * Math.sin(newX/250) + (minY + Math.random()*(maxY() - minY));
  const newY = clamp(yOffset, minY, maxY());
  const newSize = planetSize.min + Math.random()*(planetSize.max - planetSize.min);
  planets.push({ x:newX, y:newY, size:newSize, color: randomColor() });
}

function removeFarPlanets() {
  const leftLimit = spaceship.x - 800;
  planets = planets.filter(p => (p.x + p.size) > leftLimit);
}

// safe spawn
function isOverlappingPlanet(x,y,margin=0) {
  for (const p of planets) {
    const dx = p.x - x;
    const dy = p.y - y;
    if (Math.hypot(dx,dy) < p.size + spaceship.radius + margin) return true;
  }
  return false;
}

function findSafeSpawnAround(targetX,targetY) {
  const maxTries = 40;
  const radiusStep = 48;
  for (let t=0;t<maxTries;t++) {
    const angle = Math.random()*Math.PI*2;
    const r = (t+1)*radiusStep*Math.random();
    const sx = targetX + Math.cos(angle)*r;
    const sy = clamp(targetY + Math.sin(angle)*r, minY, maxY());
    if (!isOverlappingPlanet(sx, sy, 8)) return { x: sx, y: sy };
  }
  return { x: targetX, y: clamp(targetY - 180, minY, maxY()) };
}

// checkpoint / respawn
function setCheckpointFromPlanetIndex(i) {
  const p = planets[i];
  const cp = { x: p.x - Math.max(180,p.size+60), y: clamp(p.y - p.size - 36, minY, maxY()) };
  checkpoints.push(cp);
  checkpointIndex = checkpoints.length - 1;
}

function respawnAtCheckpoint() {
  // nearest planet to checkpoint
  let cp = checkpoints[checkpointIndex>=0?checkpointIndex:0] || { x: 240, y: canvas.height/2 };
  let nearestPlanet = planets.reduce((nearest, p) => {
    const d = Math.hypot(p.x - cp.x, p.y - cp.y);
    return (!nearest || d < nearest.dist) ? { planet: p, dist: d } : nearest;
  }, null);

  if (nearestPlanet) {
    cp.x = nearestPlanet.planet.x - nearestPlanet.planet.size - 20;
    cp.y = nearestPlanet.planet.y - nearestPlanet.planet.size - 36;
  }

  const safe = findSafeSpawnAround(cp.x, cp.y);
  spaceship.x = safe.x;
  spaceship.y = safe.y;
  spaceship.vx = 0;
  spaceship.vy = 0;
  spaceship.angle = -Math.PI/2;
  camera.x = spaceship.x;
  camera.y = spaceship.y;
}

function resetToCheckpoint() { respawnAtCheckpoint(); }

// particles
function createCollisionParticles(x,y) {
  const count = 18;
  for (let i=0;i<count;i++){
    const ang = Math.random()*Math.PI*2;
    const spd = 120 + Math.random()*180;
    particles.push({ x,y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,life:400,maxLife:400 });
  }
}

// update physics
function update(dtMs){
  const s = clamp(dtMs/1000,0,0.06);

  const rotSpeed = 2.8;
  if (keys["a"] || keys["arrowleft"]) spaceship.angle -= rotSpeed*s;
  if (keys["d"] || keys["arrowright"]) spaceship.angle += rotSpeed*s;

  const thrustAccel = 360;
  const brakeFactor = 0.92;

  if (keys["w"] || keys["arrowup"]){
    spaceship.vx += Math.cos(spaceship.angle)*thrustAccel*s;
    spaceship.vy += Math.sin(spaceship.angle)*thrustAccel*s;
  }
  if (keys["s"] || keys["arrowdown"]){
    spaceship.vx *= brakeFactor;
    spaceship.vy *= brakeFactor;
  }

  const maxSpeed = 900;
  const spd = Math.hypot(spaceship.vx, spaceship.vy);
  if (spd>maxSpeed){
    const scale = maxSpeed/spd;
    spaceship.vx *= scale;
    spaceship.vy *= scale;
  }

  spaceship.vx *= 0.999;
  spaceship.vy *= 0.999;
  spaceship.x += spaceship.vx*s;
  spaceship.y += spaceship.vy*s;

  // camera
  camera.x += (spaceship.x - camera.x)*camera.smooth;
  camera.y += (spaceship.y - camera.y)*camera.smooth;

  // planets
  while(planets.length===0 || planets[planets.length-1].x < spaceship.x + canvas.width*1.1){
    generatePlanet();
  }
  removeFarPlanets();

  // timer
  const now = performance.now();
  elapsedTime = (now - startTime)/1000;
  timerDisplay.textContent = `time: ${Math.floor(elapsedTime)}s`;
  livesDisplay.textContent = `lives: ${lives}`;

  // particles
  for (let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.life -= dtMs;
    if(p.life<=0){particles.splice(i,1); continue;}
    const ss = dtMs/1000;
    p.x += p.vx*ss; p.y += p.vy*ss;
    p.vx *= 0.96; p.vy *= 0.96;
  }

  // collisions & checkpoints
  for (let i=0;i<planets.length;i++){
    const p = planets[i];
    const dx = p.x - spaceship.x;
    const dy = p.y - spaceship.y;
    const dist = Math.hypot(dx,dy);

    if(dist < p.size + spaceship.radius){
      lives = Math.max(0,lives-1);
      shakeTime = 220;
      shakeMagnitude = 8;
      createCollisionParticles(spaceship.x,spaceship.y);
      respawnAtCheckpoint();
      break;
    }

    if(spaceship.x > p.x + p.size && checkpointIndex < i){
      setCheckpointFromPlanetIndex(i);
    }
  }

  if(lives<=0){
    alert("game over");
    lives=3;
    checkpoints=[{x:240,y:canvas.height/2}];
    checkpointIndex=-1;
    generateInitialPlanets();
    respawnAtCheckpoint();
    startTime = performance.now();
    elapsedTime = 0;
    startOverlay.style.display="flex";
    gameStarted=false;
  }
}

// draw function remains mostly the same, with HUD for controls
function draw(){
  ctx.fillStyle="#0b0c1a";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  const camX = Math.round(camera.x - canvas.width/2);
  const camY = Math.round(camera.y - canvas.height/2);

  let shakeX=0, shakeY=0;
  if(shakeTime>0){
    shakeTime-=16;
    shakeX=(Math.random()-0.5)*shakeMagnitude;
    shakeY=(Math.random()-0.5)*shakeMagnitude;
    shakeMagnitude*=0.95;
    if(shakeTime<=0) shakeMagnitude=0;
  }

  // stars
  ctx.fillStyle="#ffffff22";
  const count=120;
  for(let i=0;i<count;i++){
    const rx=((i*9301+49297)%233280)/233280;
    const ry=((i*49297+9301)%233280)/233280;
    const x=Math.floor(rx*(canvas.width*2)) - camX*0.28;
    const y=Math.floor(ry*(canvas.height*2)) - camY*0.28;
    ctx.fillRect((x%canvas.width+canvas.width)%canvas.width,(y%canvas.height+canvas.height)%canvas.height,1,1);
  }

  ctx.save();
  ctx.translate(-camX+shakeX, -camY+shakeY);

  // planets
  for(const p of planets){
    const glowRadius = p.size*1.8;
    const grad = ctx.createRadialGradient(p.x,p.y,p.size*0.5,p.x,p.y,glowRadius);
    grad.addColorStop(0, hexToRGBA(p.color,0.55));
    grad.addColorStop(1, hexToRGBA(p.color,0.0));
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.arc(p.x,p.y,glowRadius,0,Math.PI*2);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
    ctx.fill();
  }

  // particles
  for(const p of particles){
    const alpha=p.life/p.maxLife;
    ctx.fillStyle=`rgba(255,180,80,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x,p.y,3,0,Math.PI*2);
    ctx.fill();
  }

  // spaceship
  ctx.save();
  ctx.translate(spaceship.x, spaceship.y);
  ctx.rotate(spaceship.angle);

  // thrust flame
  if(keys["w"] || keys["arrowup"]){
    const flameLength = 8 + Math.random()*4;
    ctx.fillStyle="#ffb86c";
    ctx.beginPath();
    ctx.moveTo(-spaceship.radius*0.9,0);
    ctx.lineTo(-spaceship.radius*0.9-flameLength,4);
    ctx.lineTo(-spaceship.radius*0.9-flameLength,-4);
    ctx.closePath();
    ctx.fill();
  }

  // spaceship body
  ctx.fillStyle="#ffffff";
  ctx.beginPath();
  ctx.moveTo(spaceship.radius*1.1,0);
  ctx.lineTo(-spaceship.radius*0.8,spaceship.radius);
  ctx.lineTo(-spaceship.radius*0.8,-spaceship.radius);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.restore();

  // HUD
  ctx.font="16px Figtree, sans-serif";
  ctx.textAlign="left";
  ctx.fillStyle="#ffffff";
  ctx.fillText(`lives: ${lives}`, 20, 60);
  ctx.fillText(`time: ${Math.floor(elapsedTime)}s`, 20, 82);
  ctx.fillText("controls: W/A/S/D = thrust/brake/rotate", 20, 110);
}

// main loop
function loop(ts){
  if(!gameStarted) return;
  if(!lastTime) lastTime=ts;
  const dt = ts - lastTime;
  lastTime=ts;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// UI hooks
startBtn.addEventListener("click",()=>{
  generateInitialPlanets();
  respawnAtCheckpoint();
  startTime = performance.now();
  lastTime=0;
  elapsedTime=0;
  startOverlay.style.display="none";
  gameStarted=true;
  requestAnimationFrame(loop);
});

resetBtn.addEventListener("click", ()=>{
  generateInitialPlanets();
  checkpoints=[{x:240,y:canvas.height/2}];
  checkpointIndex=-1;
  lives=3;
  respawnAtCheckpoint();
  particles=[];
  startTime = performance.now();
  elapsedTime = 0;
});

infoBtn.addEventListener("click", ()=>{
  startOverlay.style.display = "flex";
});

generateInitialPlanets();
respawnAtCheckpoint();
