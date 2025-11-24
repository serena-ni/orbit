/* canvas setup */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

/* resize canvas */
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

/* player */
let spaceship = { x: 0, y: 0, size: 22, speed: 0, angle: 0 };
let lives = 3;
let elapsedTime = 0;
let cameraX = 0;
let keys = {};
let lastTime = 0;
let gameStarted = false;
let paused = false;
let startTime = 0;

/* gravity */
const gravityStrength = 0.00027;

/* planet config */
const planetSpacing = { min: 450, max: 850 };
const planetSize = { min: 40, max: 120 };
const palette = ["#6fa8ff", "#6b5bff", "#4fc3f7", "#8ca5ff", "#5f7bff", "#7fb4ff"];
let planets = [];

/* input */
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

/* random color */
function randomColor() {
  return palette[Math.floor(Math.random() * palette.length)];
}

/* generate a planet */
function generatePlanet(lastX) {
  const safeHeight = Math.max(canvas.height, 400);
  const x = lastX + planetSpacing.min + Math.random() * (planetSpacing.max - planetSpacing.min);
  const y = 100 + Math.random() * (safeHeight - 200);
  const size = planetSize.min + Math.random() * (planetSize.max - planetSize.min);
  return { x, y, size, color: randomColor() };
}

/* generate planet field */
function generateField() {
  planets = [];
  let x = 600;
  for (let i = 0; i < 12; i++) {
    const p = generatePlanet(x);
    x = p.x;
    planets.push(p);
  }
}

/* reset player */
function resetPlayer() {
  const first = planets[0];
  spaceship.x = first.x - 250;
  spaceship.y = first.y;
  spaceship.speed = 0;
  spaceship.angle = 0;
  cameraX = spaceship.x - 250;
}

/* update physics */
function update(dt) {
  if (paused) return;

  /* thrust */
  if (keys["w"]) spaceship.speed += 0.0007 * dt;
  if (keys["s"]) spaceship.speed -= 0.0004 * dt;

  /* rotate */
  if (keys["a"]) spaceship.angle -= 0.004 * dt;
  if (keys["d"]) spaceship.angle += 0.004 * dt;

  /* move */
  spaceship.x += Math.cos(spaceship.angle) * spaceship.speed;
  spaceship.y += Math.sin(spaceship.angle) * spaceship.speed;

  /* gravity pull */
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

  /* camera follow */
  cameraX += (spaceship.x - cameraX - 250) * 0.05;

  /* generate new planets */
  const last = planets[planets.length - 1];
  if (last.x < spaceship.x + canvas.width * 1.5) {
    planets.push(generatePlanet(last.x));
  }

  /* collision */
  for (let p of planets) {
    const dist = Math.hypot(spaceship.x - p.x, spaceship.y - p.y);
    if (dist < p.size + spaceship.size) {
      lives--;
      if (lives <= 0) {
        lives = 3;
        generateField();
      }
      resetPlayer();
      startTime = performance.now();
      return;
    }
  }

  /* timer */
  elapsedTime = Math.floor((performance.now() - startTime) / 1000);
  document.getElementById("timerDisplay").textContent = `time: ${elapsedTime}s`;
  document.getElementById("livesDisplay").textContent = `lives: ${lives}`;
}

/* draw planets */
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

/* draw ship */
function drawShip() {
  ctx.save();
  ctx.translate(spaceship.x, spaceship.y);
  ctx.rotate(spaceship.angle);

  /* body */
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(spaceship.size, 0);
  ctx.lineTo(-spaceship.size, spaceship.size * 0.65);
  ctx.lineTo(-spaceship.size, -spaceship.size * 0.65);
  ctx.closePath();
  ctx.fill();

  /* flame */
  if (keys["w"]) {
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

/* draw everything */
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-cameraX, 0);
  drawPlanets();
  drawShip();
  ctx.restore();
}

/* main loop */
function loop(t) {
  if (!gameStarted) return;
  const dt = t - lastTime;
  lastTime = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

/* start game */
document.getElementById("startBtn").onclick = () => {
  resizeCanvas();
  document.getElementById("startOverlay").classList.add("hidden");

  generateField();
  resetPlayer();

  gameStarted = true;
  startTime = performance.now();
  lastTime = startTime;

  loop();
};

/* pause controls */
const pauseOverlay = document.getElementById("pauseOverlay");
const pauseBtn = document.getElementById("pauseBtnGame");
const resumeBtn = document.getElementById("pauseBtn");

pauseBtn.onclick = () => {
  paused = true;
  pauseOverlay.classList.remove("hidden");
};

resumeBtn.onclick = () => {
  paused = false;
  pauseOverlay.classList.add("hidden");
};

/* info controls */
const infoOverlay = document.getElementById("infoOverlay");

document.getElementById("infoBtnStart").onclick =
document.getElementById("infoBtnGame").onclick = () => {
  infoOverlay.classList.remove("hidden");
};

document.getElementById("closeInfoBtn").onclick = () => {
  infoOverlay.classList.add("hidden");
};

/* restart button */
document.getElementById("resetBtn").onclick = () => {
  resetPlayer();
  startTime = performance.now();
};
