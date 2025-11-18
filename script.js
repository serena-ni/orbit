// canvas setup
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// game variables
let spaceship = { x: 200, y: canvas.height/2, size: 25, speed: 0, angle: 0 };
let lives = 3;
let checkpoints = [{ x: 200, y: canvas.height/2 }];
let elapsedTime = 0;

let cameraX = 0;
let keys = {};
let lastTime = 0;
let gameStarted = false;
let startTime = 0;

// planet generation settings
const planetSpacing = { min: 400, max: 700 };
const planetSize = { min: 40, max: 100 };
const minY = 100;
const maxY = canvas.height - 100;

// theme color palette (passes vibe check)
const palette = [
  "#6fa8ff",
  "#6b5bff",
  "#4fc3f7",
  "#8ca5ff",
  "#5f7bff",
  "#7fb4ff"
];

// generate initial planets with colors
let planets = [
  { x: 600,  y: 300, size: 40,  color: randomColor() },
  { x: 1100, y: 500, size: 60,  color: randomColor() },
  { x: 1700, y: 260, size: 75,  color: randomColor() },
  { x: 2300, y: 430, size: 50,  color: randomColor() },
  { x: 3000, y: 350, size: 100, color: randomColor() }
];

// get random theme color
function randomColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

// hex → rgba converter
function hexToRGBA(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// input
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup",   e => keys[e.key.toLowerCase()] = false);

// reset to last checkpoint
function resetToCheckpoint() {
  const cp = checkpoints[checkpoints.length - 1];
  spaceship.x = cp.x;
  spaceship.y = cp.y;
  spaceship.speed = 0;
  spaceship.angle = 0;
}

// generate a new planet
function generatePlanet() {
  const last = planets[planets.length - 1];
  const newX = last.x + planetSpacing.min + Math.random() * (planetSpacing.max - planetSpacing.min);
  const newY = minY + Math.random() * (maxY - minY);
  const newSize = planetSize.min + Math.random() * (planetSize.max - planetSize.min);

  planets.push({
    x: newX,
    y: newY,
    size: newSize,
    color: randomColor()
  });
}

// update physics
function update(dt) {
  // rotation
  if (keys["a"] || keys["arrowleft"])  spaceship.angle -= 0.05 * dt;
  if (keys["d"] || keys["arrowright"]) spaceship.angle += 0.05 * dt;

  // thrust and brake
  if (keys["w"] || keys["arrowup"])    spaceship.speed += 0.1 * dt;
  if (keys["s"] || keys["arrowdown"])  spaceship.speed -= 0.05 * dt;

  // movement
  spaceship.x += Math.cos(spaceship.angle) * spaceship.speed;
  spaceship.y += Math.sin(spaceship.angle) * spaceship.speed;

  // camera follow
  cameraX = spaceship.x - 200;

  // generate planets ahead
  while (planets[planets.length - 1].x < spaceship.x + canvas.width) {
    generatePlanet();
  }

  // remove far-off planets
  planets = planets.filter(p => p.x + p.size > spaceship.x - 500);

  // update timer
  const now = performance.now();
  elapsedTime = (now - startTime) / 1000;
  document.getElementById("timerDisplay").textContent = `time: ${Math.floor(elapsedTime)}s`;
  document.getElementById("livesDisplay").textContent = `lives: ${lives}`;

  // collision + checkpoint logic
  planets.forEach(p => {
    const dx = p.x - spaceship.x;
    const dy = p.y - spaceship.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist < p.size + spaceship.size/2) {
      lives--;
      resetToCheckpoint();
    } else if (spaceship.x > p.x + p.size && !checkpoints.includes(p)) {
      checkpoints.push({ x: p.x + 50, y: p.y });
    }
  });

  if (lives <= 0) {
    alert("game over");
    lives = 3;
    checkpoints = [{ x:200, y:canvas.height/2 }];
    resetToCheckpoint();
    elapsedTime = 0;
    startTime = performance.now();
  }
}

// draw world
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-cameraX, 0);

  // draw planets
  planets.forEach(p => {
    const glowRadius = p.size * 1.8;

    const glow = ctx.createRadialGradient(
      p.x, p.y, p.size * 0.6,
      p.x, p.y, glowRadius
    );

    glow.addColorStop(0, hexToRGBA(p.color, 0.6));
    glow.addColorStop(1, hexToRGBA(p.color, 0.0));

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // spaceship
  ctx.save();
  ctx.translate(spaceship.x, spaceship.y);
  ctx.rotate(spaceship.angle);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(spaceship.size, 0);
  ctx.lineTo(-spaceship.size/2, spaceship.size/2);
  ctx.lineTo(-spaceship.size/2, -spaceship.size/2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();
}

// main loop
function loop(timestamp) {
  if (!gameStarted) return;
  let dt = timestamp - lastTime;
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

// buttons
document.getElementById("resetBtn").onclick = () => resetToCheckpoint();
document.getElementById("infoBtn").onclick = () =>
  document.getElementById("startOverlay").style.display = "flex";

// start overlay
const startOverlay = document.getElementById("startOverlay");
const startBtn = document.getElementById("startBtn");

startBtn.addEventListener("click", () => {
  startOverlay.style.display = "none";
  gameStarted = true;
  startTime = performance.now();
  lastTime = startTime;
  loop();
});
