// canvas setup
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// player
let spaceship = { x: 0, y: 0, size: 22, speed: 0, angle: 0 };
let savedSpeed = 0;
let lives = 3;
let elapsedTime = 0;
let cameraX = 0;
let cameraY = 0;
let keys = {};
let lastTime = 0;
let gameStarted = false;
let paused = false;
let startTime = 0;

// gravity
const gravityStrength = 0.00027;

// planets
const planetSpacing = { min: 450, max: 850 };
const planetSize = { min: 40, max: 120 };
const palette = ["#6fa8ff", "#6b5bff", "#4fc3f7", "#8ca5ff", "#5f7bff", "#7fb4ff"];
let planets = [];

// screen shake
let shakeTime = 0;
let shakeStrength = 0;

// death messages
const deathMessages = [
  "gravity wins again.",
  "too fast. every time.",
  "orbit, not speed.",
  "newton sends his regards.",
  "space is unforgiving.",
  "that planet looked friendly.",
  "note to self: brake earlier."
];

// input
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// generate planet
function randomColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

function generatePlanet(lastX) {
  const x = lastX + planetSpacing.min + Math.random() * (planetSpacing.max - planetSpacing.min);
  const y = 100 + Math.random() * (canvas.height - 200);
  const size = planetSize.min + Math.random() * (planetSize.max - planetSize.min);
  return { x, y, size, color: randomColor() };
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

function resetPlayer() {
  if (planets.length === 0) generateField();
  spaceship.x = planets[0].x - 250;
  spaceship.y = planets[0].y;
  spaceship.speed = 0;
  spaceship.angle = 0;
  cameraX = spaceship.x - canvas.width / 2 + 250;
  cameraY = spaceship.y - canvas.height / 2;
}

// pause toggle
function togglePause() {
  paused = !paused;
  if (paused) {
    savedSpeed = spaceship.speed;
    spaceship.speed = 0;
    document.getElementById("pauseOverlay").classList.remove("hidden");
  } else {
    spaceship.speed = savedSpeed;
    document.getElementById("pauseOverlay").classList.add("hidden");
  }
}

// start game
function startGame() {
  document.getElementById("startOverlay").classList.add("hidden");
  document.getElementById("deathOverlay").classList.add("hidden");
  document.getElementById("infoOverlay").classList.add("hidden");
  lives = 3;
  elapsedTime = 0;
  generateField();
  resetPlayer();
  startTime = performance.now();
  lastTime = startTime;
  gameStarted = true;
  paused = false;
  loop(startTime);
}

// update physics
function update(dt) {
  if (paused) return;

  // thrust
  if (keys["w"] || keys["arrowup"]) spaceship.speed += 0.0007 * dt;
  if (keys["s"] || keys["arrowdown"]) spaceship.speed -= 0.0004 * dt;

  // rotate
  if (keys["a"] || keys["arrowleft"]) spaceship.angle -= 0.004 * dt;
  if (keys["d"] || keys["arrowright"]) spaceship.angle += 0.004 * dt;

  // move
  spaceship.x += Math.cos(spaceship.angle) * spaceship.speed * dt;
  spaceship.y += Math.sin(spaceship.angle) * spaceship.speed * dt;

  // gravity wells
  for (let p of planets) {
    const dx = p.x - spaceship.x;
    const dy = p.y - spaceship.y;
    const dist = Math.hypot(dx, dy);
    if (dist < p.size * 5) {
      const force = gravityStrength * (p.size * 2) / dist;
      spaceship.x += dx * force * dt;
      spaceship.y += dy * force * dt;
    }
  }

  // camera
  cameraX += (spaceship.x - cameraX - canvas.width / 2) * 0.05;
  cameraY += (spaceship.y - cameraY - canvas.height / 2) * 0.05;

  // screen shake decay
  if (shakeTime > 0) {
    shakeTime -= dt;
    shakeStrength *= 0.9;
  }

  // generate new planets
  const last = planets[planets.length - 1];
  if (last.x < spaceship.x + canvas.width * 1.5) planets.push(generatePlanet(last.x));

  // collision
  for (let p of planets) {
    const dist = Math.hypot(spaceship.x - p.x, spaceship.y - p.y);
    if (dist < p.size + spaceship.size) {
      lives--;
      spaceship.speed = 0;
      shakeTime = 160;
      shakeStrength = 8;

      const msg = deathMessages[Math.floor(Math.random() * deathMessages.length)];
      document.getElementById("deathMessage").textContent = msg;
      document.getElementById("finalTime").textContent = `final survived: ${elapsedTime}s`;
      document.getElementById("deathOverlay").classList.remove("hidden");

      if (lives <= 0) {
        lives = 3;
        generateField();
      }
      resetPlayer();
      startTime = performance.now();
      paused = true; // stop movement
      return;
    }
  }

  // timer
  elapsedTime = ((performance.now() - startTime) / 1000).toFixed(1);
  document.getElementById("timerDisplay").textContent = `survived: ${elapsedTime}s`;
  document.getElementById("livesDisplay").textContent = `hull: ${"♥".repeat(lives)}`;

  // reactive ui
  document.body.classList.toggle(
    "thrusting",
    keys["w"] || keys["arrowup"]
  );
}

// draw planets
function drawPlanets() {
  for (let p of planets) {
    const glow = ctx.createRadialGradient(p.x, p.y, p.size * 0.6, p.x, p.y, p.size * 2.1);
    glow.addColorStop(0, p.color + "88");
    glow.addColorStop(1, p.color + "00");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// draw ship
function drawShip() {
  ctx.save();
  ctx.translate(spaceship.x, spaceship.y);
  ctx.rotate(spaceship.angle);

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(spaceship.size, 0);
  ctx.lineTo(-spaceship.size, spaceship.size * 0.65);
  ctx.lineTo(-spaceship.size, -spaceship.size * 0.65);
  ctx.closePath();
  ctx.fill();

  if (keys["w"] || keys["arrowup"]) {
    ctx.fillStyle = "#ff9566";
    ctx.beginPath();
    ctx.moveTo(-spaceship.size, 0);
    ctx.lineTo(-spaceship.size - 10, 6);
    ctx.lineTo(-spaceship.size - 10, -6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// draw everything
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const shakeX = (shakeTime > 0) ? (Math.random() - 0.5) * shakeStrength : 0;
  const shakeY = (shakeTime > 0) ? (Math.random() - 0.5) * shakeStrength : 0;
  ctx.save();
  ctx.translate(-cameraX + shakeX, -cameraY + shakeY);
  drawPlanets();
  drawShip();
  ctx.restore();
}

// main loop
function loop(t) {
  if (!gameStarted) return;
  const dt = t - lastTime;
  lastTime = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// global keydown for space pause
document.addEventListener("keydown", e => {
  if (e.key === " ") togglePause();
});

// dom ready for buttons
window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("startBtn").onclick = startGame;
  document.getElementById("infoBtnStart").onclick = () => {
    document.getElementById("infoOverlay").classList.remove("hidden");
    if (!paused) togglePause();
  };
  document.getElementById("closeInfoBtn").onclick = () => {
    document.getElementById("infoOverlay").classList.add("hidden");
    if (paused) togglePause();
  };
  document.getElementById("deathRestartBtn").onclick = startGame;
  document.getElementById("resetBtn").onclick = startGame;
  document.getElementById("pauseBtn").onclick = togglePause;
});
