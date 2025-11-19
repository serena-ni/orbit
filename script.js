const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ui
const startScreen = document.getElementById("start-screen");
const infoOverlay = document.getElementById("info-overlay");
const pauseOverlay = document.getElementById("pause-overlay");
const gameoverOverlay = document.getElementById("gameover-overlay");

const startBtn = document.getElementById("start-btn");
const infoBtn = document.getElementById("info-btn");
const closeInfoBtn = document.getElementById("close-info");
const resumeBtn = document.getElementById("resume-btn");
const restartBtn = document.getElementById("restart-btn");
const resetBtn = document.getElementById("reset-btn");

const hud = document.getElementById("hud");
const livesDisplay = document.getElementById("lives-display");
const timeDisplay = document.getElementById("time-display");
const finalStats = document.getElementById("final-stats");

// camera
let camX = 0;
let camY = 0;

// player
let player = {
  x: 0,
  y: 0,
  angle: 0,
  vx: 0,
  vy: 0,
  maxSpeed: 4,
};

// input
let keys = {};

// planets
let planets = [];
let checkpoints = [];
const planetCount = 16;

// game state
let playing = false;
let paused = false;
let lives = 3;
let time = 0;
let lastTime = performance.now();
let lastCheckpoint = 0;

// events
document.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key === " ") pauseGame();
});
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// start
startBtn.onclick = startGame;

// info
infoBtn.onclick = () => infoOverlay.classList.remove("hidden");
closeInfoBtn.onclick = () => infoOverlay.classList.add("hidden");

// pause
resumeBtn.onclick = () => {
  paused = false;
  pauseOverlay.classList.add("hidden");
  lastTime = performance.now();
};

// restart
restartBtn.onclick = () => startGame();
resetBtn.onclick = () => startGame();

// game functions

function startGame() {
  startScreen.classList.add("hidden");
  infoOverlay.classList.add("hidden");
  pauseOverlay.classList.add("hidden");
  gameoverOverlay.classList.add("hidden");

  hud.classList.remove("hidden");

  // reset
  lives = 3;
  time = 0;
  lastCheckpoint = 0;

  // place player
  player.x = 0;
  player.y = 0;
  player.vx = 0;
  player.vy = 0;
  player.angle = 0;

  // generate planets in a spread 2D cluster
  planets = [];
  checkpoints = [];

  for (let i = 0; i < planetCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 400 + Math.random() * 1400;

    const px = Math.cos(angle) * dist;
    const py = Math.sin(angle) * dist;

    const radius = 35 + Math.random() * 45;

    const color = randomPlanetColor();

    planets.push({ x: px, y: py, r: radius, color });
    checkpoints.push({ x: px, y: py });
  }

  playing = true;
  paused = false;
  lastTime = performance.now();
  loop();
}

function pauseGame() {
  if (!playing) return;
  paused = !paused;
  pauseOverlay.classList.toggle("hidden", !paused);
}

// random theme colors
function randomPlanetColor() {
  const palette = [
    "#a8c7ff", "#9fdcff", "#ffc9e6", "#ffe5a3", "#ccd7ff",
    "#97b1ff", "#e3aaff", "#8eeeff"
  ];
  return palette[Math.floor(Math.random() * palette.length)];
}

// physics

function update(dt) {
  // controls
  if (keys["w"]) {
    player.vx += Math.cos(player.angle) * 0.09;
    player.vy += Math.sin(player.angle) * 0.09;
  }
  if (keys["s"]) {
    player.vx *= 0.96;
    player.vy *= 0.96;
  }
  if (keys["a"]) player.angle -= 0.055;
  if (keys["d"]) player.angle += 0.055;

  // clamp speed
  const speed = Math.hypot(player.vx, player.vy);
  if (speed > player.maxSpeed) {
    player.vx *= player.maxSpeed / speed;
    player.vy *= player.maxSpeed / speed;
  }

  // move
  player.x += player.vx;
  player.y += player.vy;

  // update timer
  time += dt / 1000;

  // collisions
  for (let i = 0; i < planets.length; i++) {
    let p = planets[i];
    let d = Math.hypot(player.x - p.x, player.y - p.y);

    if (d < p.r + 14) {
      // collision
      lives--;
      screenFlash();
      screenShake();

      if (lives <= 0) {
        gameOver();
        return;
      }

      // respawn at nearest checkpoint
      respawnAtCheckpoint();
      return;
    }
  }

  // reach next checkpoint
  const cp = checkpoints[lastCheckpoint];
  if (Math.hypot(player.x - cp.x, player.y - cp.y) < 80) {
    lastCheckpoint = Math.min(lastCheckpoint + 1, checkpoints.length - 1);
  }

  updateHUD();
}

function respawnAtCheckpoint() {
  const cp = checkpoints[lastCheckpoint];
  player.x = cp.x;
  player.y = cp.y - 120;
  player.vx = 0;
  player.vy = 0;
  player.angle = Math.PI / 2;
}

function gameOver() {
  playing = false;
  hud.classList.add("hidden");
  finalStats.textContent = `you survived ${time.toFixed(1)} seconds`;
  gameoverOverlay.classList.remove("hidden");
}

function updateHUD() {
  livesDisplay.textContent = `lives: ${lives}`;
  timeDisplay.textContent = `time: ${time.toFixed(1)}s`;
}

// drawing

function draw() {
  ctx.save();

  // camera follow
  camX = player.x - canvas.width / 2;
  camY = player.y - canvas.height / 2;
  ctx.translate(-camX, -camY);

  // background stars
  drawStars();

  // planets
  planets.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();

    // glow atmosphere
    const g = ctx.createRadialGradient(p.x, p.y, p.r, p.x, p.y, p.r + 35);
    g.addColorStop(0, p.color + "00");
    g.addColorStop(1, p.color + "33");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 35, 0, Math.PI * 2);
    ctx.fill();
  });

  // player ship
  drawShip();

  ctx.restore();
}

function drawShip() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  // body
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-12, -10);
  ctx.lineTo(-12, 10);
  ctx.closePath();
  ctx.fill();

  // thrust flame
  if (keys["w"]) {
    ctx.fillStyle = "#ffa447";
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.lineTo(-25, 0);
    ctx.lineTo(-12, 6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawStars() {
  ctx.fillStyle = "#000";
  ctx.fillRect(camX, camY, canvas.width, canvas.height);

  ctx.fillStyle = "white";
  for (let i = 0; i < 120; i++) {
    const x = camX + Math.random() * canvas.width;
    const y = camY + Math.random() * canvas.height;
    ctx.fillRect(x, y, 2, 2);
  }
}

// effects
function screenFlash() {
  const flash = document.createElement("div");
  flash.style.position = "fixed";
  flash.style.top = 0;
  flash.style.left = 0;
  flash.style.width = "100%";
  flash.style.height = "100%";
  flash.style.background = "rgba(255,255,255,0.25)";
  flash.style.pointerEvents = "none";
  flash.style.transition = "opacity 0.3s";
  document.body.appendChild(flash);
  setTimeout(() => flash.style.opacity = 0, 20);
  setTimeout(() => flash.remove(), 320);
}

function screenShake() {
  let intensity = 12;
  let duration = 180;
  let start = performance.now();

  function shake() {
    let now = performance.now();
    let elapsed = now - start;

    if (elapsed > duration) {
      document.body.style.transform = "";
      return;
    }

    let dx = (Math.random() - 0.5) * intensity;
    let dy = (Math.random() - 0.5) * intensity;
    document.body.style.transform = `translate(${dx}px, ${dy}px)`;

    requestAnimationFrame(shake);
  }
  shake();
}

// main loop
function loop() {
  if (!playing) return;
  if (paused) return requestAnimationFrame(loop);

  let now = performance.now();
  let dt = now - lastTime;
  lastTime = now;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}
