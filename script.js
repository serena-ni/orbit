// canvas setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let W, H;

function resize() {
  W = canvas.width = window.innerWidth;
  H = canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// game state
let running = false;
let paused = false;
let time = 0;
let lives = 3;

// input state
let keys = {};
document.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
document.addEventListener("keyup",   e => keys[e.key.toLowerCase()] = false);

// single-press handlers for q/e/g
document.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();
  if (k === "q") ship.angle -= Math.PI / 8; // quick rotate left
  if (k === "e") ship.angle += Math.PI / 8; // quick rotate right
  if (k === "g") showGravity = !showGravity; // toggle gravity viz
  if (k === "p") { // optional p to pause/resume
    paused = !paused;
    if (!paused && running) last = performance.now(); // reset timing
  }
});

// ship
const ship = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  angle: 0,
  size: 18
};

// planets
const planets = [];
function generatePlanets() {
  planets.length = 0;
  for (let i = 0; i < 14; i++) {
    planets.push({
      x: (Math.random() - 0.5) * 3000,
      y: (Math.random() - 0.5) * 3000,
      r: 40 + Math.random() * 40,
      color: ["#6fa8ff", "#6b5bff", "#4fc3f7"][Math.floor(Math.random()*3)]
    });
  }
}

// particle pool
const MAX_PARTICLES = 300;
const particles = Array.from({ length: MAX_PARTICLES }, () => ({
  active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0
}));

// spawn a thrust particle (world coords)
function spawnParticle() {
  for (let p of particles) {
    if (!p.active) {
      p.active = true;
      p.x = ship.x - Math.cos(ship.angle) * (ship.size + 2);
      p.y = ship.y - Math.sin(ship.angle) * (ship.size + 2);
      const speed = 0.9 + Math.random() * 0.9;
      const ang = ship.angle + Math.PI + (Math.random() - 0.5) * 0.6;
      p.vx = Math.cos(ang) * speed;
      p.vy = Math.sin(ang) * speed;
      p.life = p.max = 18 + Math.floor(Math.random() * 12);
      return;
    }
  }
}

// camera & zoom
let camX = 0, camY = 0, zoom = 1;

// screen shake (x/y)
let shakeX = 0, shakeY = 0;
function doShake(strength = 12) {
  shakeX = (Math.random() - 0.5) * strength;
  shakeY = (Math.random() - 0.5) * strength;
}

// gravity viz toggle
let showGravity = false;

// draw ship (outline + thrust)
function drawShip() {
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);

  // ship body (stroke)
  ctx.beginPath();
  ctx.moveTo(ship.size, 0);
  ctx.lineTo(-ship.size, 10);
  ctx.lineTo(-ship.size, -10);
  ctx.closePath();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // thrust flame (particles already drawn) - small cone for immediate feedback
  if (keys["w"]) {
    ctx.fillStyle = "rgba(255,149,102,0.95)";
    ctx.beginPath();
    ctx.moveTo(-ship.size - 2, 0);
    ctx.lineTo(-ship.size - 12, 6);
    ctx.lineTo(-ship.size - 12, -6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// draw particles (world coords)
function drawParticles() {
  for (let p of particles) {
    if (!p.active) continue;
    const a = Math.max(0, p.life / p.max);
    ctx.fillStyle = `rgba(255,140,0,${0.9 * a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 + (1 - a) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// update physics
function update(dt) {
  // rotation controls
  if (keys["a"]) ship.angle -= 0.05 * dt;
  if (keys["d"]) ship.angle += 0.05 * dt;

  // thrust/brake
  if (keys["w"]) {
    // thrust impulse (frame-rate independent)
    ship.vx += Math.cos(ship.angle) * 0.18 * dt;
    ship.vy += Math.sin(ship.angle) * 0.18 * dt;

    // spawn particles and small shake on sustained boost
    if (Math.random() < 0.9) spawnParticle();
    shakeX += (Math.random() - 0.5) * 0.6;
    shakeY += (Math.random() - 0.5) * 0.6;
    zoom = 1.03;
  } else {
    zoom += (1 - zoom) * 0.08;
  }

  if (keys["s"]) {
    ship.vx *= 0.94;
    ship.vy *= 0.94;
  }

  // integrate velocity
  ship.x += ship.vx;
  ship.y += ship.vy;

  // bounce off screen edges (world bounds are +/-W/2, +/-H/2)
  if (ship.x < -W/2) { ship.x = -W/2; ship.vx *= -0.6; doShake(10); }
  if (ship.x >  W/2) { ship.x =  W/2; ship.vx *= -0.6; doShake(10); }
  if (ship.y < -H/2) { ship.y = -H/2; ship.vy *= -0.6; doShake(10); }
  if (ship.y >  H/2) { ship.y =  H/2; ship.vy *= -0.6; doShake(10); }

  // particles update
  for (let p of particles) {
    if (!p.active) continue;
    p.x += p.vx * (dt * 0.9);
    p.y += p.vy * (dt * 0.9);
    p.life -= dt;
    if (p.life <= 0) p.active = false;
  }

  // planet collisions
  for (let p of planets) {
    const dx = ship.x - p.x;
    const dy = ship.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < p.r + ship.size) {
      // collision
      lives = Math.max(0, lives - 1);
      // big shake + particles burst
      doShake(18);
      for (let i = 0; i < 30; i++) {
        // burst particles
        for (let q of particles) {
          if (!q.active) {
            q.active = true;
            q.x = ship.x;
            q.y = ship.y;
            const ang = Math.random() * Math.PI * 2;
            const spd = 1 + Math.random() * 4;
            q.vx = Math.cos(ang) * spd;
            q.vy = Math.sin(ang) * spd;
            q.life = q.max = 20 + Math.random() * 30;
            break;
          }
        }
      }
      // respawn near center (safe) and reset velocity
      ship.x = 0; ship.y = 0; ship.vx = 0; ship.vy = 0; ship.angle = 0;
      time = 0;
      break;
    }
  }

  // shake decay
  shakeX *= 0.86;
  shakeY *= 0.86;
}

// draw loop / render
let last = 0;
function loop(t) {
  if (!running) return;
  requestAnimationFrame(loop);

  const dtRaw = (t - last) || 16;
  const dt = dtRaw / 16;
  last = t;

  if (!paused) {
    time += dt * 0.016;
    update(dt);
  }

  // camera follows ship with smoothing
  const targetCamX = ship.x - W / 2;
  const targetCamY = ship.y - H / 2;
  camX += (targetCamX - camX) * 0.06;
  camY += (targetCamY - camY) * 0.06;

  // apply transform (zoom + shake)
  ctx.setTransform(zoom, 0, 0, zoom, -camX + shakeX, -camY + shakeY);

  // clear world area efficiently
  ctx.clearRect(camX - 2200, camY - 2200, 4400, 4400);

  // draw planets
  ctx.lineWidth = 1.5;
  for (let p of planets) {
    // planet glow (soft)
    const grad = ctx.createRadialGradient(p.x, p.y, p.r * 0.4, p.x, p.y, p.r * 2.2);
    grad.addColorStop(0, p.color + "66");
    grad.addColorStop(1, p.color + "00");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // planet core
    ctx.strokeStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // draw particles and ship (world coords)
  drawParticles();
  drawShip();

  // draw precise velocity vector (indicator)
  const vMag = Math.hypot(ship.vx, ship.vy);
  if (vMag > 0.02) {
    // color by speed
    ctx.strokeStyle = vMag > 8 ? "rgba(255,100,60,0.95)" : vMag > 4 ? "rgba(255,180,80,0.95)" : "rgba(120,220,255,0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ship.x, ship.y);
    // scale vector so it's visible but not huge
    const scale = 10;
    ctx.lineTo(ship.x + ship.vx * scale, ship.y + ship.vy * scale);
    ctx.stroke();

    // small arrowhead
    const ax = ship.x + ship.vx * scale;
    const ay = ship.y + ship.vy * scale;
    const ang = Math.atan2(ship.vy, ship.vx);
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - Math.cos(ang - 0.4) * 8, ay - Math.sin(ang - 0.4) * 8);
    ctx.lineTo(ax - Math.cos(ang + 0.4) * 8, ay - Math.sin(ang + 0.4) * 8);
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  }

  // gravity visualization lines
  if (showGravity) {
    ctx.lineWidth = 1;
    for (let p of planets) {
      const dx = p.x - ship.x;
      const dy = p.y - ship.y;
      const dist = Math.hypot(dx, dy);
      const strength = (p.r * 2) / Math.max(40, dist);
      ctx.strokeStyle = `rgba(200,200,120,${Math.min(0.9, strength)})`;
      ctx.beginPath();
      ctx.moveTo(ship.x, ship.y);
      ctx.lineTo(ship.x + dx * 0.18, ship.y + dy * 0.18);
      ctx.stroke();
    }
  }

  // update hud timer (assumes #timer exists)
  const timerEl = document.getElementById("timer");
  if (timerEl) timerEl.textContent = `Time: ${time.toFixed(1)}`;
}

// control handlers (assumes html ids exist)
document.getElementById("startBtn").onclick = () => {
  const s = document.getElementById("startScreen");
  const h = document.getElementById("hud");
  if (s) s.classList.add("hidden");
  if (h) h.classList.remove("hidden");
  resetGame();
};

document.getElementById("restartBtn").onclick = resetGame;

document.getElementById("infoBtn").onclick = () => {
  const m = document.getElementById("infoModal");
  if (m) m.classList.remove("hidden");
};

document.getElementById("closeInfo").onclick = () => {
  const m = document.getElementById("infoModal");
  if (m) m.classList.add("hidden");
};

// space toggles pause/resume
document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    paused = !paused;
    // if resuming, reset time baseline
    if (!paused) last = performance.now();
  }
});

// reset game
function resetGame() {
  ship.x = 0; ship.y = 0; ship.vx = 0; ship.vy = 0; ship.angle = 0;
  time = 0;
  lives = 3;
  zoom = 1;
  generatePlanets();
  running = true;
  paused = false;
  last = performance.now();
  loop(last);
}

// bootstrap initial field
generatePlanets();
