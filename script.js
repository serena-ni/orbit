// canvas
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// state
let gameStarted = false;
let paused = false;
let alive = true;
let lastTime = 0;
let startTime = 0;
let elapsedTime = 0;

// lives
let lives = 3;
let invulnTime = 0;

// camera
let cameraX = 0;
let cameraY = 0;

// input
const keys = {};

// input
document.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;

  if (e.key === " " && alive && gameStarted) {
    paused = !paused;
    showOverlay(paused ? pauseOverlay : null);
  }
});

document.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

// player
const ship = {
  x: 0,
  y: 0,
  angle: 0,
  speed: 0,
  size: 22,
  trail: []
};

// score
let score = 0;
let multiplier = 1;
let orbitCounter = 0;

// planets
const planets = [];
const orbitData = new Map();

// achievements
const achievements = [
  {
    name: "first orbit",
    description: "complete your first orbit",
    unlocked: false,
    check: () => orbitCounter >= 1
  },
  {
    name: "planet hopper",
    description: "orbit 3 planets",
    unlocked: false,
    check: () => orbitCounter >= 3
  },
  {
    name: "survivor",
    description: "survive 60 seconds",
    unlocked: false,
    check: () => elapsedTime >= 60
  },
  {
    name: "multiplier master",
    description: "reach x3 multiplier",
    unlocked: false,
    check: () => multiplier >= 3
  },
  {
    name: "endurance orbit",
    description: "orbit one planet for 60 seconds",
    unlocked: false,
    check: () => {
      for (let data of orbitData.values()) {
        if (data.time >= 60000) return true;
      }
      return false;
    }
  }
];

// overlays
const startOverlay = document.getElementById("startOverlay");
const pauseOverlay = document.getElementById("pauseOverlay");
const endOverlay = document.getElementById("endOverlay");
const achievementsOverlay = document.getElementById("achievementsOverlay");
const infoOverlay = document.getElementById("infoOverlay");

// helpers
function showOverlay(target) {
  [startOverlay, pauseOverlay, endOverlay, achievementsOverlay, infoOverlay]
    .forEach(o => o.classList.add("hidden"));
  if (target) target.classList.remove("hidden");
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// setup
function generatePlanets() {
  planets.length = 0;
  orbitData.clear();
  orbitCounter = 0;

  let x = 600;
  for (let i = 0; i < 10; i++) {
    const p = {
      x,
      y: 200 + Math.random() * (canvas.height - 400),
      size: 60 + Math.random() * 50,
      color: "#6fa8ff"
    };
    planets.push(p);
    orbitData.set(p, {
      angle: 0,
      last: null,
      done: false,
      time: 0
    });
    x += 600;
  }
}

function resetPlayer(spawnPlanet = planets[0]) {
  ship.x = spawnPlanet.x - spawnPlanet.size - 80;
  ship.y = spawnPlanet.y;
  ship.angle = 0;
  ship.speed = 0;
  ship.trail.length = 0;

  cameraX = ship.x - canvas.width / 2;
  cameraY = ship.y - canvas.height / 2;

  alive = true;
  paused = false;
  invulnTime = 1000; // brief grace, but NOT transparent forever
}

// achievement UI
function showAchievement(name) {
  const el = document.createElement("div");
  el.style.position = "fixed";
  el.style.top = "18px";
  el.style.right = "18px";
  el.style.padding = "10px 16px";
  el.style.background = "rgba(20,24,50,0.75)";
  el.style.border = "1px solid rgba(255,255,255,0.1)";
  el.style.borderRadius = "12px";
  el.style.backdropFilter = "blur(8px)";
  el.style.fontSize = "13px";
  el.style.opacity = "0";
  el.style.transition = "0.3s";
  el.textContent = `achievement unlocked — ${name}`;

  document.body.appendChild(el);

  requestAnimationFrame(() => (el.style.opacity = "1"));
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

function updateAchievementProgress() {
  const unlocked = achievements.filter(a => a.unlocked).length;
  document.getElementById("achievementsProgressBar").style.width =
    `${(unlocked / achievements.length) * 100}%`;
}

function checkAchievements() {
  achievements.forEach(a => {
    if (!a.unlocked && a.check()) {
      a.unlocked = true;
      showAchievement(a.name);
      updateAchievementProgress();
    }
  });
}

// death
const deathMessages = [
  "gravity wins again.",
  "orbit, not speed.",
  "newton sends his regards.",
  "space is unforgiving.",
  "wrong vector.",
  "planetary hug gone wrong."
];

function die() {
  if (invulnTime > 0) return;

  lives--;

  if (lives > 0) {
    resetPlayer(planets[0]);
    return;
  }

  alive = false;
  paused = true;

  document.getElementById("deathMessage").textContent =
    deathMessages[Math.floor(Math.random() * deathMessages.length)];

  document.getElementById("finalTimeDisplay").textContent =
    `time survived: ${elapsedTime}s • score: ${score}`;

  showOverlay(endOverlay);
}

// update
function update(dt) {
  if (!alive || paused) return;

  if (invulnTime > 0) invulnTime -= dt;

  if (keys["w"]) ship.speed += 0.0007 * dt;
  if (keys["a"]) ship.angle -= 0.004 * dt;
  if (keys["d"]) ship.angle += 0.004 * dt;

  ship.x += Math.cos(ship.angle) * ship.speed * dt;
  ship.y += Math.sin(ship.angle) * ship.speed * dt;

  ship.trail.push({ x: ship.x, y: ship.y, life: 20 });
  if (ship.trail.length > 30) ship.trail.shift();

  planets.forEach(p => {
    const dx = p.x - ship.x;
    const dy = p.y - ship.y;
    const dist = Math.hypot(dx, dy);
    const data = orbitData.get(p);

    if (dist < p.size * 4) {
      const ang = Math.atan2(ship.y - p.y, ship.x - p.x);

      if (data.last !== null) {
        data.angle += Math.abs(normalizeAngle(ang - data.last));
        data.time += dt;
      }

      data.last = ang;

      if (!data.done && data.angle >= Math.PI * 2 * 0.9) {
        data.done = true;
        orbitCounter++;
        score += Math.floor(100 * multiplier);
        multiplier = Math.min(multiplier + 0.3, 3);
        checkAchievements();
      }
    } else {
      data.last = null;
      data.time = 0;
    }

    if (dist < p.size + ship.size) die();
  });

  cameraX += (ship.x - cameraX - canvas.width / 2) * 0.06;
  cameraY += (ship.y - cameraY - canvas.height / 2) * 0.06;

  elapsedTime = ((performance.now() - startTime) / 1000).toFixed(1);

  document.getElementById("timerDisplay").textContent =
    `hull: ${"♥".repeat(lives)} • ${elapsedTime}s • x${multiplier.toFixed(1)}`;
}

// draw
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-cameraX, -cameraY);

  planets.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  ship.trail.forEach(t => {
    ctx.fillStyle = `rgba(255,255,255,${t.life / 40})`;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 2, 0, Math.PI * 2);
    ctx.fill();
    t.life--;
  });

  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);

  // ship
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-22, 14);
  ctx.lineTo(-22, -14);
  ctx.closePath();
  ctx.fill();

  // thrust flame (smol orange triangle)
  if (keys["w"]) {
    ctx.fillStyle = "#ff9f43";
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(-34, 6);
    ctx.lineTo(-34, -6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
  ctx.restore();
}

// loop
function loop(t) {
  const dt = t - lastTime;
  lastTime = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// buttons
document.getElementById("startBtn").onclick = () => {
  showOverlay(null);
  gameStarted = true;
  lives = 3;
  generatePlanets();
  resetPlayer();
  score = 0;
  multiplier = 1;
  achievements.forEach(a => (a.unlocked = false));
  updateAchievementProgress();
  startTime = performance.now();
  lastTime = startTime;
  requestAnimationFrame(loop);
};

document.getElementById("pauseBtn").onclick = () => {
  if (!alive) return;
  paused = !paused;
  showOverlay(paused ? pauseOverlay : null);
};

document.getElementById("deathRestartBtn").onclick = () => {
  showOverlay(null);
  lives = 3;
  generatePlanets();
  resetPlayer();
  score = 0;
  multiplier = 1;
  startTime = performance.now();
};

document.getElementById("achievementsBtn").onclick = () => {
  const list = document.getElementById("achievementsList");
  list.innerHTML = "";

  achievements.forEach(a => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="achievement-text">
        <strong>${a.name}</strong>
        <span>${a.description}</span>
      </div>
      <div class="achievement-status">${a.unlocked ? "✓ unlocked" : "locked"}</div>
    `;
    list.appendChild(li);
  });

  updateAchievementProgress();
  showOverlay(achievementsOverlay);
};

document.getElementById("closeAchievements").onclick = () =>
  showOverlay(endOverlay);

document.getElementById("infoBtnStart").onclick = () =>
  showOverlay(infoOverlay);

document.getElementById("closeInfoBtn").onclick = () =>
  showOverlay(startOverlay);
