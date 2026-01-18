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
  const key = e.key.toLowerCase();
  keys[key] = true;

  // pause via space
  if (key === " " && alive && gameStarted) {
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

// achievements tracking
let totalWPresses = 0;
let consecutiveOrbits = 0;
let orbitWithoutThrust = false;
let nearMissCounts = new Map();
let rotationWithoutThrust = 0;
let lastAngle = 0;

// achievements
const achievements = [
  { name: "first thrust", description: "press w for the first time", unlocked: false, check: () => totalWPresses > 0 },
  { name: "first rotation", description: "rotate your ship at least once", unlocked: false, check: () => rotationWithoutThrust > 0 },
  { name: "first brake", description: "slow down using s", unlocked: false, check: () => keys["s"] },
  { name: "first orbit", description: "complete your first orbit", unlocked: false, check: () => orbitCounter >= 1 },
  { name: "close call", description: "fly within 10 pixels of a planet without crashing", unlocked: false, check: () => [...nearMissCounts.values()].some(v => v >= 1) },
  { name: "double orbit", description: "orbit the same planet twice in a row", unlocked: false, check: () => consecutiveOrbits >= 2 },
  { name: "triple threat", description: "orbit 3 different planets", unlocked: false, check: () => orbitCounter >= 3 },
  { name: "time traveler", description: "survive 30 seconds", unlocked: false, check: () => elapsedTime >= 30 },
  { name: "speed demon", description: "reach top speed", unlocked: false, check: () => ship.speed >= 10 },
  { name: "perfect alignment", description: "rotate 360° without using thrust", unlocked: false, check: () => rotationWithoutThrust >= Math.PI * 2 },
  { name: "survivor", description: "survive 60 seconds", unlocked: false, check: () => elapsedTime >= 60 },
  { name: "endurance orbit", description: "orbit one planet for 60 seconds", unlocked: false, check: () => { for (let data of orbitData.values()) if (data.time >= 60000) return true; return false; } },
  { name: "gravity master", description: "complete an orbit without pressing w", unlocked: false, check: () => orbitWithoutThrust },
  { name: "loop-de-loop", description: "orbit two planets consecutively without crashing", unlocked: false, check: () => consecutiveOrbits >= 2 },
  { name: "near miss expert", description: "pass within 5 pixels of 3 different planets in one run", unlocked: false, check: () => [...nearMissCounts.values()].filter(v => v >= 1).length >= 3 },
  { name: "multiplier master", description: "reach max score multiplier", unlocked: false, check: () => multiplier >= 3 },
  { name: "pacifist pilot", description: "complete a run without pressing brake", unlocked: false, check: () => !keys["s"] },
  { name: "marathon orbit", description: "orbit planets continuously for 2 minutes", unlocked: false, check: () => consecutiveOrbits >= 120 },
  { name: "space tourist", description: "pass by 5 planets without orbiting", unlocked: false, check: () => [...nearMissCounts.values()].filter(v => v >= 1).length >= 5 },
  { name: "thruster enthusiast", description: "press w more than 100 times in one run", unlocked: false, check: () => totalWPresses >= 100 }
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
  if (keys["w"]) {
    ship.speed += 0.0007 * dt;
    totalWPresses++;
  }
  if (keys["a"]) ship.angle -= 0.004 * dt;
  if (keys["d"]) ship.angle += 0.004 * dt;

  ship.x += Math.cos(ship.angle) * ship.speed * dt;
  ship.y += Math.sin(ship.angle) * ship.speed * dt;

  // rotation without thrust
  if (!keys["w"] && (keys["a"] || keys["d"])) rotationWithoutThrust += Math.abs(ship.angle - lastAngle);
  lastAngle = ship.angle;

  // only count time if moving
  if (ship.speed > 0) elapsedTime = ((performance.now() - startTime) / 1000).toFixed(1);

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

      // track orbit without thrust
      if (!keys["w"]) orbitWithoutThrust = true;

      if (!data.done && data.angle >= Math.PI * 2 * 0.9) {
        data.done = true;
        orbitCounter++;
        score += Math.floor(100 * multiplier);
        multiplier = Math.min(multiplier + 0.3, 3);
        consecutiveOrbits++;
        checkAchievements();
        orbitWithoutThrust = false;
        nearMissCounts.set(p, 0);
      }
    } else {
      data.last = null;
      data.time = 0;

      if (dist < p.size + ship.size + 10 && dist > p.size + ship.size) {
        const prev = nearMissCounts.get(p) || 0;
        nearMissCounts.set(p, prev + 1);
      }
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

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(22, 0);
  ctx.lineTo(-22, 14);
  ctx.lineTo(-22, -14);
  ctx.closePath();
  ctx.fill();

  // thrust flame
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
  checkTutorialProgress();
  requestAnimationFrame(loop);
}

// reset variables on new game
function resetGame() {
  lives = 3;
  score = 0;
  multiplier = 1;
  orbitCounter = 0;
  elapsedTime = 0;
  totalWPresses = 0;
  consecutiveOrbits = 0;
  orbitWithoutThrust = false;
  rotationWithoutThrust = 0;
  lastAngle = 0;
  nearMissCounts.clear();
  achievements.forEach(a => a.unlocked = false);
  updateAchievementProgress();
}

// buttons
document.getElementById("startBtn").onclick = () => {
  resetGame();
  generatePlanets();
  resetPlayer();
  gameStarted = true;
  startTime = performance.now();
  lastTime = startTime;
  showOverlay(null);
  requestAnimationFrame(loop);
};

document.getElementById("pauseBtn").onclick = () => {
  if (!alive) return;
  paused = !paused;
  showOverlay(paused ? pauseOverlay : null);
};

document.getElementById("deathRestartBtn").onclick = () => {
  resetGame();
  generatePlanets();
  resetPlayer();
  showOverlay(null);
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

document.getElementById("closeAchievements").onclick = () => showOverlay(endOverlay);
document.getElementById("infoBtnStart").onclick = () => showOverlay(infoOverlay);
document.getElementById("closeInfoBtn").onclick = () => showOverlay(startOverlay);

// tutorial logic
let tutorialActive = false;
let tutorialIndex = 0;
const sidebar = document.getElementById("tutorialSidebar");
const tutorialTitle = document.getElementById("tutorialTitle");
const tutorialText = document.getElementById("tutorialText");

const tutorialSteps = [
  { title: "thrust", text: "press w to move forward", action: () => keys["w"] },
  { title: "rotate", text: "press a or d to rotate", action: () => keys["a"] || keys["d"] },
  { title: "brake", text: "press s to slow down", action: () => keys["s"] },
  { title: "orbit", text: "try orbiting a planet", action: () => orbitCounter > 0 },
  { title: "done", text: "tutorial complete! returning to start screen", action: () => true }
];

function showTutorialStep(index) {
  const step = tutorialSteps[index];
  tutorialTitle.textContent = step.title;
  tutorialText.textContent = step.text;
}

document.getElementById("startTutorialBtn").onclick = () => {
  tutorialActive = true;
  tutorialIndex = 0;
  showTutorialStep(0);
  sidebar.classList.remove("hidden");
  showOverlay(null);

  // pause game state during tutorial
  paused = false;
  gameStarted = true;
  resetGame();
  generatePlanets();
  resetPlayer();
  startTime = performance.now();
  lastTime = startTime;
  requestAnimationFrame(loop);
};

document.getElementById("skipTutorialBtn").onclick = () => {
  tutorialActive = false;
  sidebar.classList.add("hidden");
  paused = true;
  showOverlay(startOverlay);
};

document.getElementById("nextTutorialBtn").onclick = () => {
  tutorialIndex++;
  if (tutorialIndex >= tutorialSteps.length) {
    tutorialActive = false;
    sidebar.classList.add("hidden");
    paused = true;
    showOverlay(startOverlay);
  } else {
    showTutorialStep(tutorialIndex);
  }
};

function checkTutorialProgress() {
  if (!tutorialActive) return;
  const step = tutorialSteps[tutorialIndex];
  if (step && step.action()) {
    tutorialIndex++;
    if (tutorialIndex >= tutorialSteps.length) {
      tutorialActive = false;
      sidebar.classList.add("hidden");
      paused = true;
      showOverlay(startOverlay);
    } else {
      showTutorialStep(tutorialIndex);
    }
  }
}
