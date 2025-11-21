const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let W, H;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

/* game state */
let running = false;
let paused = false;
let time = 0;
let lives = 3;

let keys = {};
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup", e => keys[e.key] = false);

/* ship */
const ship = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  angle: 0,
  size: 18
};

/* planets */
const planets = [];
function generatePlanets() {
  planets.length = 0;
  for (let i = 0; i < 14; i++) {
    planets.push({
      x: (Math.random() - 0.5) * 3000,
      y: (Math.random() - 0.5) * 3000,
      r: 40 + Math.random() * 40
    });
  }
}

/* particle pool */
const MAX_PARTICLES = 250;
const particles = Array.from({ length: MAX_PARTICLES }, () => ({
  active: false,
  x: 0, y: 0, vx: 0, vy: 0, life: 0
}));

function spawnParticle() {
  for (let p of particles) {
    if (!p.active) {
      p.active = true;
      p.x = ship.x - Math.cos(ship.angle) * ship.size;
      p.y = ship.y - Math.sin(ship.angle) * ship.size;
      p.vx = -Math.cos(ship.angle) * (1 + Math.random() * 0.5);
      p.vy = -Math.sin(ship.angle) * (1 + Math.random() * 0.5);
      p.life = 15;
      return;
    }
  }
}

/* camera */
let camX = 0, camY = 0, zoom = 1;

/* screen shake */
let shake = 0;
function doShake() { shake = 12; }

/* draw ship */
function drawShip() {
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);

  ctx.beginPath();
  ctx.moveTo(ship.size, 0);
  ctx.lineTo(-ship.size, 10);
  ctx.lineTo(-ship.size, -10);
  ctx.closePath();
  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

/* draw particles */
function drawParticles() {
  ctx.fillStyle = "rgba(255,140,0,0.9)";
  for (let p of particles) {
    if (!p.active) continue;

    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* update game */
function update(dt) {
  if (keys["a"]) ship.angle -= 0.05;
  if (keys["d"]) ship.angle += 0.05;

  if (keys["w"]) {
    ship.vx += Math.cos(ship.angle) * 0.18;
    ship.vy += Math.sin(ship.angle) * 0.18;

    spawnParticle();
    zoom = 1.03;
  } else {
    zoom += (1 - zoom) * 0.1;
  }

  ship.x += ship.vx;
  ship.y += ship.vy;

  // screen bounce
  if (ship.x < -W/2) { ship.x = -W/2; ship.vx *= -0.6; doShake(); }
  if (ship.x >  W/2) { ship.x =  W/2; ship.vx *= -0.6; doShake(); }
  if (ship.y < -H/2) { ship.y = -H/2; ship.vy *= -0.6; doShake(); }
  if (ship.y >  H/2) { ship.y =  H/2; ship.vy *= -0.6; doShake(); }

  // particles
  for (let p of particles) {
    if (!p.active) continue;
    p.x += p.vx;
    p.y += p.vy;
    p.life--;
    if (p.life <= 0) p.active = false;
  }

  // shake falloff
  shake *= 0.85;
}

/* render loop */
let last = 0;
function loop(t) {
  if (!running) return;
  requestAnimationFrame(loop);

  const dt = (t - last) / 16;
  last = t;

  if (!paused) {
    time += dt * 0.016;
    update(dt);
  }

  // camera follows ship
  camX += ((ship.x - W / 2) - camX) * 0.06;
  camY += ((ship.y - H / 2) - camY) * 0.06;

  ctx.setTransform(zoom, 0, 0, zoom, -camX + shake, -camY + shake);
  ctx.clearRect(camX - 2000, camY - 2000, 4000, 4000);

  // planets
  ctx.strokeStyle = "white";
  for (let p of planets) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawParticles();
  drawShip();

  document.getElementById("timer").textContent = `Time: ${time.toFixed(1)}`;
}

/* control handlers */
document.getElementById("startBtn").onclick = () => {
  document.getElementById("startScreen").classList.add("hidden");
  document.getElementById("hud").classList.remove("hidden");

  resetGame();
};

document.getElementById("restartBtn").onclick = resetGame;

document.getElementById("infoBtn").onclick = () => {
  document.getElementById("infoModal").classList.remove("hidden");
};

document.getElementById("closeInfo").onclick = () => {
  document.getElementById("infoModal").classList.add("hidden");
};

document.addEventListener("keydown", (e) => {
  if (e.key === " ") paused = !paused;
});

/* reset game */
function resetGame() {
  ship.x = 0;
  ship.y = 0;
  ship.vx = 0;
  ship.vy = 0;
  ship.angle = 0;

  time = 0;
  lives = 3;

  generatePlanets();
  running = true;
  paused = false;
  loop(0);
}
