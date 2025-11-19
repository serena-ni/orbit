// canvas setup
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// HUD elements
const hud = document.getElementById("hud");
const livesDisplay = document.getElementById("livesDisplay");
const timerDisplay = document.getElementById("timerDisplay");
const infoBtn = document.getElementById("infoBtn");
const resetBtn = document.getElementById("resetBtn");

// overlay elements
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const overlayStart = document.getElementById("overlayStart");

// game variables
let spaceship = { x: 200, y: canvas.height/2, size: 25, speed: 0, angle: 0 };
let lives = 3;
let elapsedTime = 0;
let startTime = 0;
let lastTime = 0;
let keys = {};
let paused = true;
let gameStarted = false;

let cameraX = 0;
let checkpoints = [{ x: 200, y: canvas.height/2 }];

// planet system
let planets = [];
const palette = ["#6fa8ff","#6b5bff","#4fc3f7","#8ca5ff","#5f7bff","#7fb4ff"];

function randomColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

function hexToRGBA(hex, a) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

function generatePlanet(xStart = 600) {
  const x = (planets.length === 0)
    ? xStart
    : planets[planets.length-1].x + 300 + Math.random()*700;

  const y = 100 + Math.random()*(canvas.height - 200);
  const size = 40 + Math.random()*80;

  planets.push({ x, y, size, color: randomColor() });
}

for (let i=0; i<7; i++) generatePlanet(600);

// input
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup",   e => keys[e.key.toLowerCase()] = false);

// ---------------------------
// Overlays
// ---------------------------
function showStartScreen() {
  overlay.classList.remove("hidden");
  overlayTitle.textContent = "orbit";
  overlayText.textContent = "a gravity drifting game";
  overlayStart.textContent = "start";

  hud.style.display = "none";
  paused = true;
  gameStarted = false;
}
showStartScreen();

overlayStart.addEventListener("click", () => {
  if (!gameStarted) fullReset();

  overlay.classList.add("hidden");
  paused = false;
  gameStarted = true;
  hud.style.display = "flex";

  startTime = performance.now();
  lastTime = startTime;
  requestAnimationFrame(loop);
});

infoBtn.addEventListener("click", () => {
  paused = true;
  overlayTitle.textContent = "controls";
  overlayText.innerHTML = `
    <strong>W / ↑</strong> — thrust<br>
    <strong>S / ↓</strong> — brake<br>
    <strong>A / ←</strong> — rotate left<br>
    <strong>D / →</strong> — rotate right<br><br>
    drift smoothly. avoid planets. reach new checkpoints.
  `;
  overlayStart.textContent = "resume";
  overlay.classList.remove("hidden");
});

overlayStart.addEventListener("click", () => {
  if (overlayTitle.textContent === "controls") {
    overlay.classList.add("hidden");
    paused = false;
  }
});

function showGameOver() {
  overlayTitle.textContent = "game over";
  overlayText.textContent = `you survived ${Math.floor(elapsedTime)}s`;
  overlayStart.textContent = "play again";
  overlay.classList.remove("hidden");

  hud.style.display = "none";
  paused = true;
  gameStarted = false;
}

// ---------------------------
// Reset systems
// ---------------------------
function fullReset() {
  spaceship = { x: 200, y: canvas.height/2, size: 25, speed: 0, angle: 0 };
  lives = 3;
  checkpoints = [{ x: 200, y: canvas.height/2 }];
  planets = [];
  for (let i=0; i<7; i++) generatePlanet(600);
  startTime = performance.now();
}

resetBtn.addEventListener("click", () => fullReset());

// ---------------------------
// Game logic
// ---------------------------
function resetToCheckpoint() {
  const cp = checkpoints[checkpoints.length - 1];
  spaceship.x = cp.x;
  spaceship.y = cp.y;
  spaceship.speed = 0;
  spaceship.angle = 0;

  // ensure there is always a planet nearby
  if (planets.length < 1 || Math.abs(planets[0].x - cp.x) > 300) {
    generatePlanet(cp.x + 300);
  }
}

function update(dt) {
  if (paused) return;

  // rotation
  if (keys["a"] || keys["arrowleft"])  spaceship.angle -= 0.004 * dt;
  if (keys["d"] || keys["arrowright"]) spaceship.angle += 0.004 * dt;

  // thrust/brake
  if (keys["w"] || keys["arrowup"])    spaceship.speed += 0.012 * dt;
  if (keys["s"] || keys["arrowdown"])  spaceship.speed -= 0.006 * dt;

  // movement
  spaceship.x += Math.cos(spaceship.angle) * spaceship.speed;
  spaceship.y += Math.sin(spaceship.angle) * spaceship.speed;

  cameraX = spaceship.x - 200;

  // new planets
  while (planets[planets.length-1].x < spaceship.x + canvas.width) {
    generatePlanet();
  }

  planets = planets.filter(p => p.x + p.size > spaceship.x - 600);

  // update HUD
  const now = performance.now();
  elapsedTime = (now - startTime) / 1000;
  timerDisplay.textContent = `time: ${Math.floor(elapsedTime)}s`;
  livesDisplay.textContent = `lives: ${lives}`;

  // collision
  for (const p of planets) {
    const dx = p.x - spaceship.x;
    const dy = p.y - spaceship.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist < p.size + spaceship.size/2) {
      lives--;
      if (lives <= 0) {
        showGameOver();
        return;
      }
      resetToCheckpoint();
    }
  }

  // checkpoint marking
  for (const p of planets) {
    if (!p.passed && spaceship.x > p.x + p.size) {
      p.passed = true;
      checkpoints.push({ x: p.x + 80, y: p.y });
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-cameraX, 0);

  // planets
  planets.forEach(p => {
    const glow = ctx.createRadialGradient(
      p.x, p.y, p.size * 0.4,
      p.x, p.y, p.size * 1.6
    );
    glow.addColorStop(0, hexToRGBA(p.color, 0.6));
    glow.addColorStop(1, hexToRGBA(p.color, 0.0));

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 1.6, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
    ctx.fill();
  });

  // spaceship
  ctx.save();
  ctx.translate(spaceship.x, spaceship.y);
  ctx.rotate(spaceship.angle);

  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.moveTo(spaceship.size, 0);
  ctx.lineTo(-spaceship.size/2, spaceship.size/2);
  ctx.lineTo(-spaceship.size/2, -spaceship.size/2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.restore();
}

function loop(timestamp) {
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}
