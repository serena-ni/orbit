// canvas
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// resize
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

// camera
let cameraX = 0;
let cameraY = 0;

// input
const keys = {};
document.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;

  // pause via space
  if (e.key === " " && alive && gameStarted) {
    paused = !paused;
    showOverlay(paused ? pauseOverlay : null);
  }
});
document.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// player
const ship = {
  x: 0,
  y: 0,
  angle: 0,
  speed: 0,
  size: 22
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
    description: "orbit 3 different planets",
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
    description: "reach max score multiplier",
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

// setup planets
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
    orbitData.set(p, { angle: 0, last: null, done: false, time: 0 });
    x += 600;
  }
}

// reset player
function resetPlayer(spawnPlanet = planets[0]) {
  ship.x = spawnPlanet.x - spawnPlanet.size - 80;
  ship.y = spawnPlanet.y;
  ship.angle = 0;
  ship.speed = 0;

  cameraX = ship.x - canvas.width / 2;
  cameraY = ship.y - canvas.height / 2;

  alive = true;
  paused = false;
}

// achievements
function showAchievement(name) {
  const el = document.createElement("div");
  el.className = "achievement-popup";
  el.textContent = `achievement unlocked - ${name}`;
  document.body.appendChild(el);

  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => el.remove(), 2400);
}

function updateAchievementProgress() {
  const unlocked = achievements.filter(a => a.unlocked).length;
  const bar = document.getElementById("achievementsProgressBar");
  if (bar) bar.style.width = `${(unlocked / achievements.length) * 100}%`;
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
  "too fast. every time.",
  "newton sends his regards.",
  "space is unforgiving.",
  "that planet looked friendly.",
  "note to self: brake earlier.",
  "hull integrity compromised.",
  "oops... wrong trajectory.",
  "space always collects its toll.",
  "maybe slow down next time.",
  "the stars are watching.",
  "not your day to orbit.",
  "collision detected, try again.",
  "planets are not soft.",
  "you underestimated the void.",
  "thrusters offline.",
  "crash course in gravity.",
  "your ship disagrees.",
  "asteroid envy.",
  "planetary hug gone wrong.",
  "lost in the void again.",
  "trajectory miscalculated.",
  "speed kills... literally.",
  "orbital mechanics, 1 - you, 0.",
  "that’s one small misstep for you.",
  "gravity has plans.",
  "the void calls.",
  "not even close to escape velocity.",
  "contact detected... with a planet.",
  "planetary welcome committee engaged.",
  "too close for comfort.",
  "crash landing imminent.",
  "space doesn’t negotiate.",
  "wrong vector.",
  "better aim next time."
];

function die() {
  if (!alive) return;

  lives--;

  if (lives > 0) {
    const nearest = planets.reduce((a, b) =>
      Math.hypot(ship.x - a.x, ship.y - a.y) <
      Math.hypot(ship.x - b.x, ship.y - b.y) ? a : b
    );
    resetPlayer(nearest);
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

  // control ship
  if (keys["w"]) ship.speed += 0.0007 * dt;
  if (keys["a"]) ship.angle -= 0.004 * dt;
  if (keys["d"]) ship.angle += 0.004 * dt;

  ship.x += Math.cos(ship.angle) * ship.speed * dt;
  ship.y += Math.sin(ship.angle) * ship.speed * dt;

  // only count time if moving
  if (ship.speed > 0) {
    elapsedTime = ((performance.now() - startTime) / 1000).toFixed(1);
  }

  // orbit detection
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

  // hud hearts
  const full = "♥".repeat(lives);
  const empty = "♡".repeat(3 - lives);
  document.getElementById("timerDisplay").textContent =
    `hull: ${full}${empty} • ${elapsedTime}s • x${multiplier.toFixed(1)}`;
}

// draw
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(-cameraX, -cameraY);

  // planets
  planets.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });

  // ship
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);

  // draw ship
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-22, 14);
  ctx.lineTo(-22, -14);
  ctx.closePath();
  ctx.fill();

  // small orange thrust flame if pressing W
  if (keys["w"]) {
    ctx.fillStyle = "#ff9566";
    ctx.beginPath();
    ctx.moveTo(-22, 6);
    ctx.lineTo(-34, 0);
    ctx.lineTo(-22, -6);
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
  achievements.forEach(a => a.unlocked = false);
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
