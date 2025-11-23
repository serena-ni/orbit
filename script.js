// script.js (clean comments, all lowercase)

// canvas
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener("resize", fitCanvas);

// state
let lastTime = 0;
let gameStarted = false;
let startTime = 0;
let elapsedSeconds = 0;
let lives = 3;

// input
const keys = {};
window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// ship data
const spaceship = {
  x: 200,
  y: canvas.height / 2,
  vx: 0,
  vy: 0,
  angle: 0,
  size: 22,
  thrustAccel: 400,
  rotateSpeed: 3.2,
  drag: 0.997,
  maxSpeed: 900
};

// camera
let cameraX = 0;
const cameraOffsetX = 250;
const cameraSmooth = 0.12;

// planet data
const planetSpacing = { min: 450, max: 850 };
const planetSize = { min: 40, max: 120 };
const palette = ["#6fa8ff", "#6b5bff", "#4fc3f7", "#8ca5ff", "#5f7bff", "#7fb4ff"];
let planets = [];

// ui refs
const timerEl = document.getElementById("timerDisplay");
const livesEl = document.getElementById("livesDisplay");
const startOverlay = document.getElementById("startOverlay");
const startBtn = document.getElementById("startBtn");
const infoBtnStart = document.getElementById("infoBtnStart");
const infoBtnGame = document.getElementById("infoBtnGame");
const infoOverlay = document.getElementById("infoOverlay");
const closeInfoBtn = document.getElementById("closeInfoBtn");
const resetBtn = document.getElementById("resetBtn");

// collision cooldown
const collisionCooldown = 500;
let lastCollisionTime = -9999;

// utils
function rand(min, max) { return min + Math.random() * (max - min); }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function randomColor() { return palette[Math.floor(Math.random() * palette.length)]; }

// planet generation
function generatePlanet(lastX) {
  const x = lastX + rand(planetSpacing.min, planetSpacing.max);
  const y = 100 + Math.random() * (canvas.height - 200);
  const size = rand(planetSize.min, planetSize.max);
  return { x, y, size, color: randomColor(), passed: false };
}

function generateField() {
  planets = [];
  let x = 600;
  for (let i = 0; i < 12; i++) {
    const p = generatePlanet(x);
    x = p.x;
    planets.push(p);
  }
}

// player reset
function resetPlayer() {
  spaceship.x = 200;
  spaceship.y = canvas.height / 2;
  spaceship.vx = 0;
  spaceship.vy = 0;
  spaceship.angle = 0;
  cameraX = 0;
  lastCollisionTime = -9999;
}

// check overlap
function isOverlappingPlanet(x, y, margin = 0) {
  for (const p of planets) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < p.size + spaceship.size + margin) return true;
  }
  return false;
}

// safe spawn
function safeRespawn() {
  const baseX = cameraX + 200;
  const baseY = canvas.height / 2;
  for (let t = 0; t < 40; t++) {
    const ang = Math.random() * Math.PI * 2;
    const r = (t + 1) * 48 * Math.random();
    const sx = baseX + Math.cos(ang) * r;
    const sy = clamp(baseY + Math.sin(ang) * r, 100, canvas.height - 100);
    if (!isOverlappingPlanet(sx, sy, 8)) {
      spaceship.x = sx;
      spaceship.y = sy;
      spaceship.vx = 0;
      spaceship.vy = 0;
      spaceship.angle = 0;
      cameraX = spaceship.x - cameraOffsetX;
      return;
    }
  }
  resetPlayer();
}

// physics
function updatePhysics(dt) {
  // rotate
  if (keys["a"] || keys["arrowleft"]) spaceship.angle -= spaceship.rotateSpeed * dt;
  if (keys["d"] || keys["arrowright"]) spaceship.angle += spaceship.rotateSpeed * dt;

  // thrust
  if (keys["w"] || keys["arrowup"]) {
    spaceship.vx += Math.cos(spaceship.angle) * spaceship.thrustAccel * dt;
    spaceship.vy += Math.sin(spaceship.angle) * spaceship.thrustAccel * dt;
  }

  // brake
  if (keys["s"] || keys["arrowdown"]) {
    spaceship.vx *= 0.96;
    spaceship.vy *= 0.96;
  }

  // gravity (size based)
  for (const p of planets) {
    const dx = p.x - spaceship.x;
    const dy = p.y - spaceship.y;
    const dist = Math.hypot(dx, dy);
    const influence = p.size * 4;
    if (dist < influence && dist > 5) {
      const mass = p.size * p.size;
      const soft = p.size * 1.8;
      const force = (mass * 0.0000009) / ((dist + soft) * (dist + soft));
      spaceship.vx += (dx / dist) * force * dt * 1000;
      spaceship.vy += (dy / dist) * force * dt * 1000;
    }
  }

  // drag
  spaceship.vx *= Math.pow(spaceship.drag, dt * 60);
  spaceship.vy *= Math.pow(spaceship.drag, dt * 60);

  // speed cap
  const spd = Math.hypot(spaceship.vx, spaceship.vy);
  if (spd > spaceship.maxSpeed) {
    const s = spaceship.maxSpeed / spd;
    spaceship.vx *= s;
    spaceship.vy *= s;
  }

  // move
  spaceship.x += spaceship.vx * dt;
  spaceship.y += spaceship.vy * dt;

  // camera follow
  cameraX += ((spaceship.x - cameraOffsetX) - cameraX) * cameraSmooth;

  // extend world
  const last = planets[planets.length - 1];
  if (last && last.x < spaceship.x + canvas.width * 1.5) {
    planets.push(generatePlanet(last.x));
  }

  // timer
  if (startTime) elapsedSeconds = Math.floor(performance.now() / 1000 - startTime / 1000);
  if (timerEl) timerEl.textContent = `time: ${elapsedSeconds}s`;
  if (livesEl) livesEl.textContent = `lives: ${lives}`;
}

// collisions
function handleCollisions() {
  const now = performance.now();
  if (now - lastCollisionTime < collisionCooldown) return;

  for (const p of planets) {
    const dx = spaceship.x - p.x;
    const dy = spaceship.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < p.size + spaceship.size) {
      lastCollisionTime = now;
      lives = Math.max(0, lives - 1);
      if (lives <= 0) {
        lives = 3;
        generateField();
      }
      safeRespawn();
      startTime = performance.now();
      return;
    }
  }
}

// draw planets
function drawPlanets() {
  for (const p of planets) {
    const sx = p.x - cameraX;
    const sy = p.y;

    const glowR = p.size * 1.8;
    const g = ctx.createRadialGradient(sx, sy, p.size * 0.5, sx, sy, glowR);
    g.addColorStop(0, p.color + "88");
    g.addColorStop(1, p.color + "00");

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(sx, sy, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// draw ship
function drawShip() {
  const sx = spaceship.x - cameraX;
  const sy = spaceship.y;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(spaceship.angle);

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(spaceship.size, 0);
  ctx.lineTo(-spaceship.size * 0.7, spaceship.size * 0.6);
  ctx.lineTo(-spaceship.size * 0.7, -spaceship.size * 0.6);
  ctx.closePath();
  ctx.fill();

  if (keys["w"] || keys["arrowup"]) {
    ctx.fillStyle = "#ff9566";
    ctx.beginPath();
    ctx.moveTo(-spaceship.size * 0.7, 0);
    ctx.lineTo(-spaceship.size * 1.1, 6);
    ctx.lineTo(-spaceship.size * 1.1, -6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// main draw
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-cameraX, 0);
  drawPlanets();
  drawShip();
  ctx.restore();
}

// loop
function loop(ts) {
  if (!gameStarted) return;
  if (!lastTime) lastTime = ts;
  const dt = Math.min(0.06, (ts - lastTime) / 1000);
  lastTime = ts;

  updatePhysics(dt);
  handleCollisions();
  draw();
  requestAnimationFrame(loop);
}

// ui
if (startBtn) {
  startBtn.onclick = () => {
    if (startOverlay) startOverlay.classList.add("hidden");
    gameStarted = true;
    startTime = performance.now();
    lastTime = 0;
    elapsedSeconds = 0;
    generateField();
    resetPlayer();
    requestAnimationFrame(loop);
  };
}

if (infoBtnStart) infoBtnStart.onclick = () => infoOverlay?.classList.remove("hidden");
if (infoBtnGame) infoBtnGame.onclick = () => infoOverlay?.classList.remove("hidden");
if (closeInfoBtn) closeInfoBtn.onclick = () => infoOverlay?.classList.add("hidden");

if (resetBtn) {
  resetBtn.onclick = () => {
    resetPlayer();
    startTime = performance.now();
    elapsedSeconds = 0;
  };
}

// init
generateField();
resetPlayer();
if (timerEl) timerEl.textContent = "time: 0s";
if (livesEl) livesEl.textContent = "lives: 3";
