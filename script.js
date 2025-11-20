// canvas setup
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resize();
window.addEventListener('resize', resize);

// dom
const hud = document.getElementById('hud');
const livesDisplay = document.getElementById('livesDisplay');
const timerDisplay = document.getElementById('timerDisplay');
const infoBtn = document.getElementById('infoBtn');
const resetBtn = document.getElementById('resetBtn');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayText = document.getElementById('overlayText');
const overlayStart = document.getElementById('overlayStart');

// game state
let gameStarted = false;
let paused = true;
let lastTs = 0;
let startTime = 0;
let elapsed = 0;

// ship
const ship = {
  x: 240, y: canvas.height / 2, vx: 0, vy: 0, angle: -Math.PI/2, radius: 12
};

// camera & zoom (hybrid soft-edge)
let cameraX = ship.x, cameraY = ship.y;
const cameraSmooth = 0.12;
const edgeBuffer = 140;
const edgePushStrength = 0.16;
let cameraZoom = 1.0; // soft zoom target applied during draw
let cameraZoomTarget = 1.0;

// planets / checkpoints / particles
let planets = [];
let checkpoints = [{ x: 240, y: canvas.height / 2 }];
let checkpointIndex = -1;
let particles = [];

// particles/shake
let shakeTime = 0, shakeMag = 0;

// palettes / helpers
const biomes = {
  lava: ['#ff7a5c','#ff4b2b','#ffb28c'],
  ocean: ['#59b8ff','#2fb3ff','#7fd8ff'],
  ice: ['#bff0ff','#7fe9ff','#dff8ff'],
  forest: ['#a1ff8a','#58d06a','#7ef0a3'],
  gas: ['#d0d8ff','#9fb4ff','#8fcfff']
};
function rand(a,b){ return a + Math.random()*(b-a); }
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function hexToRGBA(hex, a){ const r=parseInt(hex.slice(1,3),16); const g=parseInt(hex.slice(3,5),16); const b=parseInt(hex.slice(5,7),16); return `rgba(${r},${g},${b},${a})`; }

// input
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === ' ') togglePause();
});
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

// starfield layers for parallax
const starLayers = [
  { count: 80, speed: 0.06, alpha: 0.16, stars: [] },
  { count: 120, speed: 0.14, alpha: 0.10, stars: [] },
  { count: 160, speed: 0.30, alpha: 0.06, stars: [] }
];
function seedStars(){
  for (const layer of starLayers){
    layer.stars = [];
    for (let i=0;i<layer.count;i++){
      layer.stars.push({ x: Math.random()*canvas.width*2, y: Math.random()*canvas.height*2, tw: Math.random()*1.2 });
    }
  }
}
seedStars();

// planet creation with biome & type
function createPlanet(x){
  const size = rand(36, 110);
  const yBase = rand(120, canvas.height - 160);
  const y = clamp(yBase + 80 * Math.sin(x / 240) + rand(-120,120), 80, canvas.height - 120);

  // biome weights
  const r = Math.random();
  let biome = 'gas';
  if (r < 0.18) biome = 'lava';
  else if (r < 0.40) biome = 'ocean';
  else if (r < 0.65) biome = 'ice';
  else if (r < 0.86) biome = 'forest';
  else biome = 'gas';

  const color = pick(biomes[biome]);
  let type = 'plain';
  const t = Math.random();
  if (t < 0.18) type = 'ring';
  else if (t < 0.5) type = 'banded';
  else if (t < 0.82) type = 'cratered';
  else type = 'plain';

  return { x, y, size, color, biome, type, passed: false, rings: Math.random() < 0.45 };
}

// seed initial planets
function seedPlanets(){
  planets = [];
  let x = 600;
  for (let i=0;i<12;i++){
    planets.push(createPlanet(x));
    x += rand(320, 720);
  }
}
seedPlanets();

// extend & cleanup
function extendPlanetsIfNeeded(){
  while (planets.length === 0 || planets[planets.length-1].x < ship.x + canvas.width * 1.2) {
    const last = planets[planets.length-1] || { x: 300 };
    planets.push(createPlanet(last.x + rand(320, 720)));
  }
}
function cleanupPlanets(){
  const left = ship.x - 1400;
  planets = planets.filter(p => p.x + p.size > left);
}

// particles: engine + impact
function spawnEngineParticle(){
  const angle = ship.angle + Math.PI + rand(-0.28, 0.28);
  const speed = rand(40, 160);
  particles.push({
    x: ship.x - Math.cos(ship.angle) * (ship.radius*0.95),
    y: ship.y - Math.sin(ship.angle) * (ship.radius*0.95),
    vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed,
    life: rand(120,260), maxLife: rand(120,260), type: 'engine'
  });
}
function spawnImpact(x,y){
  for (let i=0;i<20;i++){
    const a = Math.random()*Math.PI*2;
    const s = rand(80, 320);
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: rand(220,420), maxLife: rand(220,420), type: 'impact' });
  }
}
function updateParticles(dt){
  for (let i=particles.length-1;i>=0;i--){
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { particles.splice(i,1); continue; }
    const s = dt/1000;
    p.x += p.vx * s; p.y += p.vy * s;
    p.vx *= (p.type === 'engine' ? 0.92 : 0.975);
    p.vy *= (p.type === 'engine' ? 0.92 : 0.975);
  }
}

// respawn safe location near a planet
function isOverlappingPlanet(x,y,margin=0){
  for (const p of planets){
    if (Math.hypot(p.x-x, p.y-y) < p.size + ship.radius + margin) return true;
  }
  return false;
}
function findSafeSpawn(tx,ty){
  for (let t=0; t<40; t++){
    const ang = Math.random()*Math.PI*2;
    const r = (t+1)*40*Math.random();
    const sx = tx + Math.cos(ang)*r;
    const sy = clamp(ty + Math.sin(ang)*r, 80, canvas.height-120);
    if (!isOverlappingPlanet(sx, sy, 8)) return { x: sx, y: sy };
  }
  return { x: tx, y: clamp(ty - 160, 80, canvas.height-120) };
}
function respawnAtCheckpoint(){
  const cp = checkpoints[checkpointIndex >= 0 ? checkpointIndex : 0] || { x: 240, y: canvas.height/2 };
  let nearest = null;
  for (const p of planets){
    const d = Math.hypot(p.x - cp.x, p.y - cp.y);
    if (!nearest || d < nearest.d) nearest = { p, d };
  }
  let spawn = { x: cp.x, y: cp.y };
  if (nearest){
    spawn.x = nearest.p.x - nearest.p.size - 18;
    spawn.y = nearest.p.y - nearest.p.size - 36;
  }
  const safe = findSafeSpawn(spawn.x, spawn.y);
  ship.x = safe.x; ship.y = safe.y; ship.vx = 0; ship.vy = 0; ship.angle = -Math.PI/2;
  cameraX = ship.x; cameraY = ship.y;
  for (const k in keys) keys[k] = false;
}

// effects: flash & shake
function doFlash(){
  const t0 = performance.now(), dur = 220;
  function frame(now){
    const p = (now - t0) / dur;
    if (p >= 1) return;
    ctx.save();
    ctx.globalAlpha = 0.14 * (1 - p);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.restore();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
function doShake(intensity=10, time=260){ shakeMag = intensity; shakeTime = time; }

// pause / overlay controls
function showOverlay(state){
  overlay.classList.remove('hidden');
  hud.classList.add('hidden');
  if (state === 'start'){
    overlayTitle.textContent = 'orbit';
    overlayText.textContent = 'pilot your ship through planets — avoid collisions and reach checkpoints.';
    overlayStart.textContent = 'start';
  } else if (state === 'controls'){
    overlayTitle.textContent = 'controls & instructions';
    overlayText.innerHTML = 'w / ↑ — thrust<br>s / ↓ — brake<br>a / ← — rotate left<br>d / → — rotate right<br><br>space — pause/resume';
    overlayStart.textContent = 'resume';
  } else if (state === 'gameover'){
    overlayTitle.textContent = 'game over';
    overlayText.textContent = `you survived ${Math.floor(elapsed)}s`;
    overlayStart.textContent = 'play again';
  }
  paused = true; gameStarted = false;
}
function hideOverlayAndStart(){
  overlay.classList.add('hidden');
  hud.classList.remove('hidden');
  paused = false; gameStarted = true;
  startTime = performance.now(); lastTs = 0;
  requestAnimationFrame(loop);
}

// toggle pause
function togglePause(){
  if (!gameStarted) return;
  paused = !paused;
  if (paused) {
    showOverlay('controls');
  } else {
    overlay.classList.add('hidden'); hud.classList.remove('hidden'); lastTs = 0; requestAnimationFrame(loop);
  }
}

// reset / start
function fullReset(){
  ship.x = 200; ship.y = canvas.height/2; ship.vx = 0; ship.vy = 0; ship.angle = -Math.PI/2;
  lives = 3; elapsed = 0; startTime = performance.now();
  checkpoints = [{ x: 200, y: canvas.height/2 }]; checkpointIndex = -1;
  particles = []; seedPlanets();
  hud.classList.remove('hidden');
  livesDisplay.innerHTML = `<strong>lives:</strong> ${lives}`;
  timerDisplay.innerHTML = `<strong>time:</strong> 0s`;
}

// seed planets wrapper
function seedPlanets(){
  planets = [];
  let x = 600;
  for (let i=0;i<12;i++){
    planets.push(createPlanet(x));
    x += rand(320, 720);
  }
}
seedPlanets();

// update loop
let lives = 3;
function update(dtMs){
  if (!gameStarted || paused) return;
  const s = clamp(dtMs/1000, 0, 0.06);

  // rotation
  const rotSpeed = 2.6;
  if (keys['a'] || keys['arrowleft']) ship.angle -= rotSpeed * s;
  if (keys['d'] || keys['arrowright']) ship.angle += rotSpeed * s;

  // thrust / brake
  const thrustAccel = 360;
  const brakeFactor = 0.90;
  if (keys['w'] || keys['arrowup']){
    ship.vx += Math.cos(ship.angle) * thrustAccel * s;
    ship.vy += Math.sin(ship.angle) * thrustAccel * s;
    if (Math.random() < 0.55) spawnEngineParticle();
  }
  if (keys['s'] || keys['arrowdown']){
    ship.vx *= brakeFactor; ship.vy *= brakeFactor;
  }

  // speed cap + drag
  const maxSpeed = 1100;
  const spd = Math.hypot(ship.vx, ship.vy);
  if (spd > maxSpeed){ const sc = maxSpeed / spd; ship.vx *= sc; ship.vy *= sc; }
  ship.vx *= 0.998; ship.vy *= 0.998;

  // integrate
  ship.x += ship.vx * s; ship.y += ship.vy * s;

  // camera follow (smooth)
  cameraX += (ship.x - cameraX - canvas.width / 2) * cameraSmooth;
  cameraY += (ship.y - cameraY - canvas.height / 2) * cameraSmooth;

  // soft zoom target based on thrust
  cameraZoomTarget = (keys['w'] || keys['arrowup']) ? 1.06 : 1.0;
  cameraZoom += (cameraZoomTarget - cameraZoom) * 0.06;

  // soft edge repelling (hybrid)
  const screenX = ship.x - cameraX;
  const screenY = ship.y - cameraY;
  if (screenX < edgeBuffer) { ship.vx += edgePushStrength * (edgeBuffer - screenX) * 0.002; doShake(1.4,60); }
  if (screenX > canvas.width - edgeBuffer) { ship.vx -= edgePushStrength * (screenX - (canvas.width - edgeBuffer)) * 0.002; doShake(1.4,60); }
  if (screenY < edgeBuffer) { ship.vy += edgePushStrength * (edgeBuffer - screenY) * 0.002; doShake(1.4,60); }
  if (screenY > canvas.height - edgeBuffer) { ship.vy -= edgePushStrength * (screenY - (canvas.height - edgeBuffer)) * 0.002; doShake(1.4,60); }

  // planets + particles
  extendPlanetsIfNeeded(); cleanupPlanets();
  updateParticles(dtMs);

  // hud update
  elapsed = (performance.now() - startTime) / 1000;
  timerDisplay.innerHTML = `<strong>time:</strong> ${Math.floor(elapsed)}s`;
  livesDisplay.innerHTML = `<strong>lives:</strong> ${lives}`;

  // collisions & checkpoints
  for (let i=0;i<planets.length;i++){
    const p = planets[i];
    const dx = p.x - ship.x, dy = p.y - ship.y;
    const dist = Math.hypot(dx, dy);
    if (dist < p.size + ship.radius){
      // collision
      lives = Math.max(0, lives - 1);
      spawnImpact(ship.x, ship.y);
      doFlash();
      doShake(12, 280);
      if (checkpointIndex < i) {
        checkpoints.push({ x: p.x - Math.max(180, p.size + 60), y: clamp(p.y - p.size - 36, 80, canvas.height-120) });
        checkpointIndex = checkpoints.length -1;
      }
      if (lives <= 0) {
        // game over
        gameStarted = false; paused = true;
        overlayTitle.textContent = 'game over';
        overlayText.textContent = `you survived ${Math.floor(elapsed)}s`;
        overlayStart.textContent = 'play again';
        overlay.classList.remove('hidden');
        hud.classList.add('hidden');
        return;
      }
      respawnAtCheckpoint();
      break;
    }
    if (!p.passed && ship.x > p.x + p.size) {
      p.passed = true;
      if (Math.random() < 0.5) { checkpoints.push({ x: p.x + 70, y: p.y }); checkpointIndex = checkpoints.length -1; }
    }
  }
}

/* draw */
function draw(){
  // clear
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0); // reset transforms
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#020316';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.restore();

  // compute camera shake
  let shakeX = 0, shakeY = 0;
  if (shakeTime > 0){
    shakeTime -= 16;
    shakeX = (Math.random() - 0.5) * shakeMag;
    shakeY = (Math.random() - 0.5) * shakeMag;
    shakeMag *= 0.94;
    if (shakeTime <= 0) shakeMag = 0;
  }

  // apply global zoom around center, then translate world by camera+shake
  ctx.save();
  ctx.translate(canvas.width/2, canvas.height/2);
  ctx.scale(cameraZoom, cameraZoom);
  ctx.translate(-canvas.width/2, -canvas.height/2);

  ctx.translate(shakeX, shakeY);
  ctx.translate(-Math.round(cameraX), -Math.round(cameraY));

  // draw parallax stars (layers)
  for (const layer of starLayers){
    ctx.fillStyle = `rgba(255,255,255,${layer.alpha})`;
    for (const s of layer.stars){
      const sx = (s.x - cameraX * layer.speed) % (canvas.width*2);
      const sy = (s.y - cameraY * layer.speed) % (canvas.height*2);
      const dx = (sx + canvas.width*2) % (canvas.width*2);
      const dy = (sy + canvas.height*2) % (canvas.height*2);
      ctx.fillRect(dx % canvas.width, dy % canvas.height, 1, 1);
    }
  }

  // draw planets
  for (const p of planets){
    // glow/atmosphere
    const glowR = p.size * 1.9;
    const grad = ctx.createRadialGradient(p.x, p.y, p.size*0.36, p.x, p.y, glowR);
    grad.addColorStop(0, hexToRGBA(p.color, 0.66));
    grad.addColorStop(1, hexToRGBA(p.color, 0.0));
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(p.x, p.y, glowR, 0, Math.PI*2); ctx.fill();

    // core
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); ctx.fill();

    // biome-specific details
    if ((p.type === 'ring' || p.rings) && Math.random() > 0.2){
      ctx.strokeStyle = hexToRGBA('#ffffff', 0.06);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.size*1.5, p.size*0.45, Math.PI/4, 0, Math.PI*2);
      ctx.stroke();
    }
    if (p.type === 'banded'){
      ctx.fillStyle = hexToRGBA('#ffffff', 0.05);
      const bands = 2 + Math.floor(p.size/30);
      for (let b=0;b<bands;b++){
        const yy = p.y + (b - bands/2) * (p.size / (bands*0.75));
        ctx.beginPath(); ctx.ellipse(p.x, yy, p.size*0.98, p.size*0.26, 0, 0, Math.PI*2); ctx.fill();
      }
    }
    if (p.type === 'cratered'){
      ctx.fillStyle = hexToRGBA('#000', 0.12);
      const count = Math.max(3, Math.floor(p.size/12));
      for (let c=0;c<count;c++){
        const ang = Math.random()*Math.PI*2;
        const rr = Math.random()*(p.size*0.56);
        const cx = p.x + Math.cos(ang)*rr;
        const cy = p.y + Math.sin(ang)*rr;
        const cr = Math.random()*(p.size*0.12);
        ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI*2); ctx.fill();
      }
    }
    if (p.biome === 'gas' && p.type !== 'banded'){
      ctx.fillStyle = hexToRGBA('#fff', 0.03);
      for (let b=0;b<3;b++){
        const off = (b - 1) * (p.size*0.25);
        ctx.beginPath(); ctx.ellipse(p.x, p.y + off, p.size*0.9, p.size*0.22, Math.PI/8, 0, Math.PI*2); ctx.fill();
      }
    }
  }

  // draw particles (world coords)
  for (const pr of particles){
    const a = Math.max(0, pr.life / pr.maxLife);
    if (pr.type === 'engine'){
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,200,120,${0.6 * a})`;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 1 + (1-a)*3, 0, Math.PI*2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else {
      ctx.fillStyle = `rgba(255,180,80,${a})`;
      ctx.beginPath(); ctx.arc(pr.x, pr.y, 2 + (1-a)*3, 0, Math.PI*2); ctx.fill();
    }
  }

  // draw ship with tilt & multi-triangle flame
  ctx.save();
  ctx.translate(ship.x, ship.y);

  // bank based on lateral velocity + current rotation intent
  const turnIntent = (keys['a'] || keys['arrowleft']) ? -1 : (keys['d'] || keys['arrowright']) ? 1 : 0;
  const bank = clamp((ship.vx / 200) + turnIntent * 0.6, -0.6, 0.6);
  ctx.rotate(ship.angle + bank * 0.18);

  // thrust flame (three-layer)
  if (keys['w'] || keys['arrowup']){
    const flick = rand(0.8, 1.4);
    // outer
    ctx.fillStyle = '#ff8b4b';
    ctx.beginPath();
    ctx.moveTo(-ship.radius*0.9, 0);
    ctx.lineTo(-ship.radius*0.9 - (11*flick), 8*flick);
    ctx.lineTo(-ship.radius*0.9 - (11*flick), -8*flick);
    ctx.closePath(); ctx.fill();
    // mid
    ctx.fillStyle = '#ffd07a';
    ctx.beginPath();
    ctx.moveTo(-ship.radius*0.9, 0);
    ctx.lineTo(-ship.radius*0.9 - (7*flick), 5*flick);
    ctx.lineTo(-ship.radius*0.9 - (7*flick), -5*flick);
    ctx.closePath(); ctx.fill();
    // inner bright
    ctx.fillStyle = '#fff9e6';
    ctx.beginPath();
    ctx.moveTo(-ship.radius*0.9, 0);
    ctx.lineTo(-ship.radius*0.9 - (3*flick), 2.5*flick);
    ctx.lineTo(-ship.radius*0.9 - (3*flick), -2.5*flick);
    ctx.closePath(); ctx.fill();
  }

  // ship body
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(ship.radius*1.15, 0);
  ctx.lineTo(-ship.radius*0.85, ship.radius);
  ctx.lineTo(-ship.radius*0.85, -ship.radius);
  ctx.closePath(); ctx.fill();

  ctx.restore();

  // restore transforms
  ctx.restore();
}

// main loop
let rafId = null;
function loop(ts){
  if (!lastTs) lastTs = ts;
  const dt = ts - lastTs;
  lastTs = ts;

  update(dt);
  draw();
  if (gameStarted && !paused) rafId = requestAnimationFrame(loop);
}

// ui hooks
overlayStart.addEventListener('click', () => {
  if (overlayTitle.textContent === 'controls & instructions') {
    overlay.classList.add('hidden'); hud.classList.remove('hidden'); paused = false; gameStarted = true; startTime = performance.now(); lastTs = 0; requestAnimationFrame(loop);
  } else {
    // start or play again
    fullReset();
    overlay.classList.add('hidden'); hud.classList.remove('hidden'); paused = false; gameStarted = true; startTime = performance.now(); lastTs = 0; requestAnimationFrame(loop);
  }
});
infoBtn.addEventListener('click', () => { showOverlay('controls'); });
resetBtn.addEventListener('click', () => { fullReset(); overlay.classList.add('hidden'); hud.classList.remove('hidden'); paused = false; gameStarted = true; startTime = performance.now(); lastTs = 0; requestAnimationFrame(loop); });

// initial boot
fullReset();
showOverlay('start');
console.log('orbit loaded - press start to play');
