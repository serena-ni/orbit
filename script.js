const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const dt = 0.016;

// planets with glow
const planets = [
  { x: canvas.width / 2, y: canvas.height / 2, pull: 0.5, radius: 40, color: '#4fc3f7', glow: '#81d4fa' },
  { x: canvas.width / 1.5, y: canvas.height / 3, pull: 0.3, radius: 30, color: '#f06292', glow: '#f48fb1' }
];

// player
const startPos = { x: canvas.width / 2 - 250, y: canvas.height / 2 };
const player = {
  x: startPos.x,
  y: startPos.y,
  vx: 12,   // initial speed
  vy: -9,
  radius: 10,
  trail: []
};

// keys
let keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

// buttons
window.addEventListener('DOMContentLoaded', () => {
  const infoBtn = document.getElementById("infoBtn");
  const overlay = document.getElementById("overlay");
  const closeOverlay = document.getElementById("closeOverlay");
  const resetBtn = document.getElementById("resetBtn");

  infoBtn.addEventListener('click', () => overlay.style.display = 'flex');
  closeOverlay.addEventListener('click', () => overlay.style.display = 'none');

  resetBtn.addEventListener('click', () => {
    player.x = startPos.x;
    player.y = startPos.y;
    player.vx = 12;
    player.vy = -9;
    player.trail = [];
  });
});

// update
function update() {
  let ax = 0;
  let ay = 0;

  // gravity
  for (const p of planets) {
    const dx = p.x - player.x;
    const dy = p.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > p.radius) {
      const force = p.pull;
      ax += force * dx / dist;
      ay += force * dy / dist;
    }
  }

  // thrust (player control)
  const thrust = 0.4; // more responsive
  if (keys['ArrowUp'] || keys['w']) ax += thrust;
  if (keys['ArrowDown'] || keys['s']) ax -= thrust;
  if (keys['ArrowLeft'] || keys['a']) ay -= thrust;
  if (keys['ArrowRight'] || keys['d']) ay += thrust;

  // update velocity and position
  player.vx += ax * dt;
  player.vy += ay * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // trail
  player.trail.push({ x: player.x, y: player.y });
  if (player.trail.length > 200) player.trail.shift();

  // collision with planets
  for (const p of planets) {
    const dx = p.x - player.x;
    const dy = p.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < p.radius + player.radius) {
      // reset
      player.x = startPos.x;
      player.y = startPos.y;
      player.vx = 12;
      player.vy = -9;
      player.trail = [];
    }
  }
}

// draw
function draw() {
  ctx.fillStyle = "#0b0c1a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // stars
  for (let i = 0; i < 150; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random()})`;
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
  }

  // planets with glow
  for (const p of planets) {
    const gradient = ctx.createRadialGradient(p.x, p.y, p.radius / 2, p.x, p.y, p.radius * 1.5);
    gradient.addColorStop(0, p.glow);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // gradient trail
  for (let i = 1; i < player.trail.length; i++) {
    const t1 = player.trail[i - 1];
    const t2 = player.trail[i];
    const alpha = i / player.trail.length;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(t1.x, t1.y);
    ctx.lineTo(t2.x, t2.y);
    ctx.stroke();
  }

  // player triangle
  const angle = Math.atan2(player.vy, player.vx);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(player.x + Math.cos(angle) * 12, player.y + Math.sin(angle) * 12);
  ctx.lineTo(player.x + Math.cos(angle + 2.5) * 6, player.y + Math.sin(angle + 2.5) * 6);
  ctx.lineTo(player.x + Math.cos(angle - 2.5) * 6, player.y + Math.sin(angle - 2.5) * 6);
  ctx.closePath();
  ctx.fill();

  // HUD - glowing left-centered
  const hudX = 20;
  const hudY = canvas.height / 2;

  // gradient
  const gradient = ctx.createLinearGradient(0, hudY - 20, 0, hudY + 40);
  gradient.addColorStop(0, '#81d4fa');
  gradient.addColorStop(1, '#f48fb1');

  ctx.font = '18px Figtree, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = gradient;
  ctx.shadowColor = 'rgba(255,255,255,0.7)';
  ctx.shadowBlur = 8;

  ctx.fillText('Controls: Arrow Keys / WASD to apply thrust', hudX, hudY - 10);
  ctx.fillText('Objective: Curve around planets using gravity', hudX, hudY + 15);

  ctx.shadowBlur = 0;
}

// game loop
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

loop();
