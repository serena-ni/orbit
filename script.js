// canvas setup
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// game variables
let spaceship = { x: 200, y: canvas.height/2, size: 25, speed: 0, angle: 0, thrust: 0 };
let lives = 3;
let checkpoints = [{ x: 200, y: canvas.height/2 }];

let planets = [
  { x: 600, y: 300, size: 40 },
  { x: 1100, y: 500, size: 60 },
  { x: 1700, y: 260, size: 75 },
  { x: 2300, y: 430, size: 50 },
  { x: 3000, y: 350, size: 100 }
];

let cameraX = 0;
let keys = {};
let lastTime = 0;
let gameStarted = false;

// input
document.addEventListener("keydown", e => keys[e.key] = true);
document.addEventListener("keyup",   e => keys[e.key] = false);

// reset to last checkpoint
function resetToCheckpoint() {
  const cp = checkpoints[checkpoints.length-1];
  spaceship.x = cp.x;
  spaceship.y = cp.y;
  spaceship.speed = 0;
  spaceship.angle = 0;
}

// update physics
function update(dt) {
  // rotation
  if (keys["a"] || keys["ArrowLeft"]) spaceship.angle -= 0.05*dt;
  if (keys["d"] || keys["ArrowRight"]) spaceship.angle += 0.05*dt;

  // thrust/brake
  if (keys["w"] || keys["ArrowUp"]) spaceship.speed += 0.1*dt;
  if (keys["s"] || keys["ArrowDown"]) spaceship.speed -= 0.05*dt;

  // movement
  spaceship.x += Math.cos(spaceship.angle)*spaceship.speed;
  spaceship.y += Math.sin(spaceship.angle)*spaceship.speed;

  // camera
  cameraX = spaceship.x - 200;

  // collisions
  planets.forEach(p => {
    const dx = p.x - spaceship.x;
    const dy = p.y - spaceship.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < p.size + spaceship.size/2) {
      lives--;
      resetToCheckpoint();
    } else if (spaceship.x > p.x + p.size) {
      if (!checkpoints.includes(p)) checkpoints.push({x:p.x+50,y:p.y});
    }
  });

  if (lives <= 0) {
    alert("game over");
    lives = 3;
    checkpoints = [{ x:200, y:canvas.height/2 }];
    resetToCheckpoint();
  }
}

// draw world
function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();
  ctx.translate(-cameraX,0);

  // planets
  planets.forEach(p => {
    ctx.beginPath();
    ctx.fillStyle = "#4466ff";
    ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
    ctx.fill();
  });

  // spaceship
  ctx.save();
  ctx.translate(spaceship.x, spaceship.y);
  ctx.rotate(spaceship.angle);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(spaceship.size,0);
  ctx.lineTo(-spaceship.size/2, spaceship.size/2);
  ctx.lineTo(-spaceship.size/2, -spaceship.size/2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.restore();

  // HUD
  ctx.fillStyle = "white";
  ctx.font = "20px Figtree";
  ctx.fillText(`X: ${Math.floor(spaceship.x)}`, 20, 40);
  ctx.fillText(`Y: ${Math.floor(spaceship.y)}`, 20, 65);
  ctx.fillText(`Lives: ${lives}`, 20, 90);
}

// main loop
function loop(timestamp) {
  if (!gameStarted) return;
  let dt = (timestamp - lastTime) * 0.06;
  lastTime = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

// button hooks
document.getElementById("resetBtn").onclick = () => resetToCheckpoint();
document.getElementById("infoBtn").onclick = () => document.getElementById("startOverlay").style.display="flex";

// start screen
const startOverlay = document.getElementById("startOverlay");
const startBtn = document.getElementById("startBtn");
startBtn.addEventListener("click", () => {
  startOverlay.style.display = "none";
  gameStarted = true;
  lastTime = performance.now();
  loop();
});
