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
let alive = true;
let startTime = 0;

// score + style
let score = 0;
let multiplier = 1.0;

// gravity
const gravityStrength = 0.00027;

// planets
const planetSpacing = { min: 450, max: 850 };
const planetSize = { min: 40, max: 120 };
const palette = ["#6fa8ff", "#6b5bff", "#4fc3f7", "#8ca5ff", "#5f7bff", "#7fb4ff"];
let planets = [];

// orbit tracking (per planet)
const orbitData = new Map();

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
  "note to self: brake earlier.",
  "hull integrity compromised.",
  "trajectory miscalculated.",
  "physics does not negotiate.",
  "momentum betrayed you.",
  "collision inevitable.",
  "you flew too close.",
  "orbital decay complete.",
  "space pushes back."
];

// input
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// helpers
function randomColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// planet generation
function generatePlanet(lastX) {
  const x = lastX + planetSpacing.min + Math.random() * (planetSpacing.max - planetSpacing.min);
  const y = 100 + Math.random() * (canvas.height - 200);
  const size = planetSize.min + Math.random() * (planetSize.max - planetSize.min);
  return { x, y, size, color: randomColor() };
}

function generateField() {
  planets = [];
  orbitData.clear();
  let x = 600;
  for (let i = 0; i < 12; i++) {
    const p = generatePlanet(x);
    x = p.x;
    planets.push(p);
    orbitData.set(p, {
      active: false,
      orbitAngle: 0,
      lastAngle: null,
      completed: false
    });
  }
}

// reset player
function resetPlayer() {
  const p = planets[0];
  spaceship.x = p.x - 250;
  spaceship.y = p.y;
  spaceship.speed = 0;
  spaceship.angle = 0;
  cameraX = spaceship.x - canvas.width / 2;
  cameraY = spaceship.y - canvas.height / 2;
  alive = true;
  paused = false;
}

// update
function update(dt) {
  if (paused || !alive) return;

  // thrust
  if (keys["w"] || keys["arrowup"]) spaceship.speed += 0.0007 * dt;
  if (keys["s"] || keys["arrowdown"]) spaceship.speed -= 0.0004 * dt;

  // rotate
  if (keys["a"] || keys["arrowleft"]) spaceship.angle -= 0.004 * dt;
  if (keys["d"] || keys["arrowright"]) spaceship.angle += 0.004 * dt;

  // move
  spaceship.x += Math.cos(spaceship.angle) * spaceship.speed * dt;
  spaceship.y += Math.sin(spaceship.angle) * spaceship.speed * dt;

  // gravity + orbit detection
  let nearestPlanet = null;
  let nearestDist = Infinity;

  for (let p of planets) {
    const dx = p.x - spaceship.x;
    const dy = p.y - spaceship.y;
    const dist = Math.hypot(dx, dy);

    if (dist < nearestDist) {
      nearestDist = dist;
      nearestPlanet = p;
    }

    // gravity
    if (dist < p.size * 5) {
      const force = gravityStrength * (p.size * 2) / dist;
      spaceship.x += dx * force * dt;
      spaceship.y += dy * force * dt;
    }

    // orbit logic
    const data = orbitData.get(p);
    if (dist < p.size * 4) {
      const angle = Math.atan2(spaceship.y - p.y, spaceship.x - p.x);
      if (data.lastAngle !== null) {
        const delta = normalizeAngle(angle - data.lastAngle);
        data.orbitAngle += Math.abs(delta);
      }
      data.lastAngle = angle;
      data.active = true;

      if (!data.completed && data.orbitAngle >= Math.PI * 2 * 0.9) {
        data.completed = true;
        score += Math.floor(100 * multiplier);
        multiplier = Math.min(multiplier + 0.3, 3.0);
      }
    } else {
      data.lastAngle = null;
    }
  }

  // soft camera lock toward planets
  if (nearestPlanet && nearestDist > 650) {
    const dx = nearestPlanet.x - spaceship.x;
    const dy = nearestPlanet.y - spaceship.y;
    spaceship.x += dx * 0.00015 * dt;
    spaceship.y += dy * 0.00015 * dt;
    multiplier = 1.0;
  }

  // camera follow
  cameraX += (spaceship.x - cameraX - canvas.width / 2) * 0.05;
  cameraY += (spaceship.y - cameraY - canvas.height / 2) * 0.05;

  // collision
  for (let p of planets) {
    const dist = Math.hypot(spaceship.x - p.x, spaceship.y - p.y);
    if (dist < p.size + spaceship.size && alive) { // trigger once
      alive = false;
      paused = true;
      spaceship.speed = 0;
      shakeTime = 0;

      const deathOverlay = document.getElementById("deathOverlay");
      const deathMessage = document.getElementById("deathMessage");
      const finalTimeDisplay = document.getElementById("finalTimeDisplay");

      deathMessage.textContent = deathMessages[Math.floor(Math.random() * deathMessages.length)];
      finalTimeDisplay.textContent = `survived: ${elapsedTime}s | score: ${score} x${multiplier.toFixed(1)}`;
      deathOverlay.classList.remove("hidden");

      multiplier = 1.0;

      return;
    }
  }

  // timer
  elapsedTime = ((performance.now() - startTime) / 1000).toFixed(1);
  document.getElementById("timerDisplay").textContent =
    `survived: ${elapsedTime}s | score: ${score} x${multiplier.toFixed(1)}`;

  // reactive ui
  document.body.classList.toggle("thrusting", keys["w"] || keys["arrowup"]);
}

// drawing
function drawPlanets() {
  for (let p of planets) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

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

  // old flame trail
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

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-cameraX, -cameraY);
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

// start
document.getElementById("startBtn").onclick = () => {
  document.getElementById("startOverlay").classList.add("hidden");
  gameStarted = true;
  alive = true;
  paused = false;
  score = 0;
  multiplier = 1.0;
  generateField();
  resetPlayer();
  startTime = performance.now();
  lastTime = startTime;
  loop(startTime);
};

// pause button
const pauseBtn = document.getElementById("pauseBtn");
const pauseOverlay = document.getElementById("pauseOverlay");

pauseBtn.onclick = () => {
  paused = !paused;
  if (paused) savedSpeed = spaceship.speed;
  else spaceship.speed = savedSpeed;
  pauseOverlay.classList.toggle("hidden", !paused);
};

// spacebar pause/resume
document.addEventListener("keydown", e => {
  if (e.key === " " && gameStarted && alive) {
    paused = !paused;
    if (paused) savedSpeed = spaceship.speed;
    else spaceship.speed = savedSpeed;
    pauseOverlay.classList.toggle("hidden", !paused);
  }
});

// info overlays
document.getElementById("infoBtnStart").onclick = () => {
  document.getElementById("infoOverlay").classList.remove("hidden");
  paused = true;
};

document.getElementById("closeInfoBtn").onclick = () => {
  document.getElementById("infoOverlay").classList.add("hidden");
  paused = false;
};

// death restart
document.getElementById("deathRestartBtn").onclick = () => {
  document.getElementById("deathOverlay").classList.add("hidden");
  alive = true;
  paused = false;
  score = 0;
  multiplier = 1.0;
  generateField();
  resetPlayer();
  startTime = performance.now();
};
