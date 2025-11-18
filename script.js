// canvas setup
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// resize canvas
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// camera and world
const camera = { x: 0, y: 0, smooth: 0.16 }; // smoother camera (higher = snappier smoothing)

// planets (smallish-medium, medium spread)
const planets = [
  { x: 700,  y: 260, r: 60, color: '#4fc3f7', glow: '#81d4fa', pull: 0.45 },
  { x: 1350, y: 420, r: 50, color: '#f06292', glow: '#f48fb1', pull: 0.34 },
  { x: 2100, y: 300, r: 70, color: '#88ee88', glow: '#b9f6ca', pull: 0.38 },
  { x: 2850, y: 460, r: 55, color: '#ffd166', glow: '#ffe39a', pull: 0.30 },
  { x: 3500, y: 320, r: 65, color: '#b39ddb', glow: '#d7bff7', pull: 0.36 }
];

// player / ship (rotation + thrust style, tuned for responsiveness)
const ship = {
  x: 240,
  y: canvas.height / 2,
  vx: 0,
  vy: 0,
  angle: 0,
  radius: 12,
  thrust: 0.6,         // increased thrust for responsiveness
  rotateSpeed: 0.12,   // increased rotation speed
  damping: 0.994
};

// trail
const trail = [];
const maxTrail = 220;

// input
const keys = {};
window.addEventListener("keydown", (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup",   (e) => keys[e.key.toLowerCase()] = false);

// ui
const infoBtn = document.getElementById("infoBtn");
const resetBtn = document.getElementById("resetBtn");
const overlay = document.getElementById("overlay");
const closeOverlay = document.getElementById("closeOverlay");

infoBtn.addEventListener("click", () => { overlay.style.display = "flex"; overlay.setAttribute("aria-hidden","false"); });
closeOverlay.addEventListener("click", () => { overlay.style.display = "none"; overlay.setAttribute("aria-hidden","true"); });
resetBtn.addEventListener("click", resetToCheckpoint);

// lives & checkpoints
let livesMax = 3;
let lives = livesMax;
let checkpointIndex = -1; // -1 means start position
let respawnPoint = { x: ship.x, y: ship.y };

// collision feedback
let flashAlpha = 0;        // screen flash alpha (0..1)
let flashDecay = 0.03;     // how fast the flash fades
let pulseTimer = 0;        // ship pulse animation on hit
let invulnTimer = 0;       // short invulnerability after respawn (ms)
const invulnDuration = 900; // ms

// timing
let last = performance.now();

// helper: reset to the current checkpoint
function resetToCheckpoint() {
  // if we have a checkpoint, respawn there, else start
  if (checkpointIndex >= 0) {
    const p = planets[checkpointIndex];
    respawnPoint = {
      x: p.x - 120,
      y: p.y - p.r - 24
    };
  } else {
    respawnPoint = { x: 240, y: canvas.height / 2 };
  }

  ship.x = respawnPoint.x;
  ship.y = respawnPoint.y;
  ship.vx = 0;
  ship.vy = 0;
  ship.angle = 0;
  trail.length = 0;
  camera.x = ship.x;
  camera.y = ship.y;
  invulnTimer = invulnDuration;
}

// helper: when collision occurs
function handleCollision() {
  // ignore collisions during invulnerability
  if (invulnTimer > 0) return;

  // flash + pulse
  flashAlpha = 0.95;
  pulseTimer = 260; // milliseconds to pulse

  // lose a life
  lives = Math.max(0, lives - 1);

  // if no lives left -> reset everything (game over style)
  if (lives <= 0) {
    // reset checkpoint and lives
    checkpointIndex = -1;
    lives = livesMax;
    respawnPoint = { x: 240, y: canvas.height / 2 };
    // respawn at start
    resetToCheckpoint();
  } else {
    // respawn at last checkpoint (or start)
    resetToCheckpoint();
  }
}

// gravity (soft arcade pull) and checkpoint activation
function applyGravityAndCheckpoints() {
  for (let i = 0; i < planets.length; i++) {
    const p = planets[i];
    const dx = p.x - ship.x;
    const dy = p.y - ship.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // collision detection
    if (dist <= p.r + ship.radius) {
      handleCollision();
      return; // early out if collided
    }

    // soft pull
    const nx = dx / dist;
    const ny = dy / dist;
    const pull = p.pull / Math.max(1, dist / 200);
    ship.vx += nx * pull * 0.5;
    ship.vy += ny * pull * 0.5;

    // checkpoint logic: when ship crosses planet.x going rightwards, activate it
    // require that checkpointIndex < i (only activate forward planets)
    // and ship.x > p.x
    if (ship.x > p.x && checkpointIndex < i) {
      checkpointIndex = i;
      // set respawn point slightly before/above the planet
      respawnPoint = { x: p.x - 120, y: p.y - p.r - 24 };
      // visual cue: short pulse + small flash
      flashAlpha = Math.min(1, flashAlpha + 0.35);
      pulseTimer = Math.max(pulseTimer, 180);
    }
  }
}

// update loop
function update() {
  const now = performance.now();
  const rawDt = Math.min(40, now - last); // clamp dt in ms
  const dt = rawDt / 16.6667; // normalize to ~60fps units
  last = now;

  // rotation controls
  if (keys['arrowleft'] || keys['a'])  ship.angle -= ship.rotateSpeed * dt;
  if (keys['arrowright'] || keys['d']) ship.angle += ship.rotateSpeed * dt;

  // thrust forward
  if (keys['arrowup'] || keys['w']) {
    ship.vx += Math.cos(ship.angle) * ship.thrust * dt;
    ship.vy += Math.sin(ship.angle) * ship.thrust * dt;
  }

  // brake/backwards slightly with down key
  if (keys['arrowdown'] || keys['s']) {
    ship.vx *= 0.985;
    ship.vy *= 0.985;
  }

  // apply gravity and checkpoints
  applyGravityAndCheckpoints();

  // damping for stability
  ship.vx *= ship.damping;
  ship.vy *= ship.damping;

  // integrate position
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;

  // constrain to reasonable y-range to avoid going offscreen too far
  const margin = 200;
  ship.y = Math.max(-1000, Math.min(1000 + canvas.height, ship.y));

  // trail
  trail.push({ x: ship.x, y: ship.y });
  if (trail.length > maxTrail) trail.shift();

  // update camera (lerp to ship, camera centers ship)
  camera.x += (ship.x - camera.x) * camera.smooth;
  camera.y += (ship.y - camera.y) * camera.smooth;

  // timers: flash & pulse & invulnerability
  if (flashAlpha > 0) {
    flashAlpha = Math.max(0, flashAlpha - flashDecay * (rawDt / 16.6667));
  }
  if (pulseTimer > 0) {
    pulseTimer -= rawDt;
    if (pulseTimer < 0) pulseTimer = 0;
  }
  if (invulnTimer > 0) {
    invulnTimer -= rawDt;
    if (invulnTimer < 0) invulnTimer = 0;
  }
}

// draw helpers
function drawStars(camX, camY) {
  ctx.fillStyle = "#ffffff22";
  const cols = 140;
  for (let i = 0; i < cols; i++) {
    // deterministic-ish pseudo positions
    const rx = ((i * 9301 + 49297) % 233280) / 233280;
    const ry = ((i * 49297 + 9301) % 233280) / 233280;
    const x = Math.floor(rx * (canvas.width * 2)) - camX * 0.36;
    const y = Math.floor(ry * (canvas.height * 2)) - camY * 0.36;
    ctx.fillRect((x % canvas.width + canvas.width) % canvas.width, (y % canvas.height + canvas.height) % canvas.height, 1, 1);
  }
}

// main draw
function draw() {
  // clear and background
  ctx.fillStyle = "#0b0c1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // compute camera offset (world -> screen)
  const camX = Math.round(camera.x - canvas.width / 2);
  const camY = Math.round(camera.y - canvas.height / 2);

  // stars with parallax
  drawStars(camX, camY);

  // world draw (translated)
  ctx.save();
  ctx.translate(-camX, -camY);

  // planets (glow + core)
  for (const p of planets) {
    const g = ctx.createRadialGradient(p.x, p.y, p.r * 0.2, p.x, p.y, p.r * 1.8);
    g.addColorStop(0, p.glow);
    g.addColorStop(0.6, p.color);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // trail (world coords)
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1];
    const b = trail[i];
    const alpha = (i / trail.length) * 0.9;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // ship pulse scale
  const pulseScale = 1 + (pulseTimer > 0 ? 0.18 * (pulseTimer / 260) : 0);

  // draw ship (triangle) at world coords
  ctx.save();
  ctx.translate(ship.x, ship.y);
  ctx.rotate(ship.angle);
  ctx.scale(pulseScale, pulseScale);

  // ship visual (white)
  ctx.fillStyle = invulnTimer > 0 ? "rgba(255,255,255,0.6)" : "#fff"; // semi-transparent if invuln
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-10, 8);
  ctx.lineTo(-10, -8);
  ctx.closePath();
  ctx.fill();

  ctx.restore();

  // restore after world draw
  ctx.restore();

  // hud (fixed)
  const hudX = 18;
  const hudY = canvas.height / 2;
  const grad = ctx.createLinearGradient(0, hudY - 24, 0, hudY + 36);
  grad.addColorStop(0, "#81d4fa");
  grad.addColorStop(1, "#f48fb1");
  ctx.font = "16px Figtree, sans-serif";
  ctx.fillStyle = grad;
  ctx.shadowColor = "rgba(255,255,255,0.6)";
  ctx.shadowBlur = 8;
  ctx.textAlign = "left";
  ctx.fillText("controls: arrow/wasd to rotate & thrust", hudX, hudY - 8);
  ctx.fillText("objective: curve around planets using gravity", hudX, hudY + 14);
  ctx.shadowBlur = 0;

  // lives and checkpoint readout (fixed)
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = "14px Figtree, sans-serif";
  ctx.fillText(`lives: ${lives}`, hudX, hudY + 40);

  const cpText = checkpointIndex >= 0 ? `checkpoint: planet ${checkpointIndex + 1}` : "checkpoint: start";
  ctx.fillText(cpText, hudX, hudY + 60);

  // flash overlay (screen-space)
  if (flashAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

// main loop
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// initialize
resetToCheckpoint();
loop();
