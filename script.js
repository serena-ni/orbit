// canvas setup
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// game variables
let spaceship = {
    x: 200,
    y: canvas.height / 2,
    size: 40,
    speed: 2.5
};

let planets = [
    { x: 600,  y: 300, size: 80 },
    { x: 1100, y: 500, size: 120 },
    { x: 1700, y: 260, size: 150 },
    { x: 2300, y: 430, size: 100 },
    { x: 3000, y: 350, size: 200 }
];

let cameraX = 0;  // shifts world
let cameraStartX = planets[1].x; // start camera after 2nd planet

let keys = {};
let lastTime = 0;

// input handling
document.addEventListener("keydown", (e) => { keys[e.key] = true; });
document.addEventListener("keyup",   (e) => { keys[e.key] = false; });

// reset
function resetGame() {
    spaceship.x = 200;
    spaceship.y = canvas.height / 2;
    cameraX = 0;
}

// update
function update(dt) {
    // movement
    if (keys["ArrowUp"])    spaceship.y -= spaceship.speed * dt;
    if (keys["ArrowDown"])  spaceship.y += spaceship.speed * dt;
    if (keys["ArrowRight"]) spaceship.x += spaceship.speed * dt;
    if (keys["ArrowLeft"])  spaceship.x -= spaceship.speed * dt;

    // camera starts tracking after 2nd planet
    if (spaceship.x > cameraStartX) {
        cameraX = spaceship.x - cameraStartX;
    }
}

// draw world objects (translated)
function drawWorld() {
    ctx.save();
    ctx.translate(-cameraX, 0);  // everything in world scrolls

    // draw planets
    planets.forEach(p => {
        ctx.beginPath();
        ctx.fillStyle = "#4466ff";
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // draw spaceship
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(spaceship.x, spaceship.y - spaceship.size / 2);
    ctx.lineTo(spaceship.x - spaceship.size / 2, spaceship.y + spaceship.size / 2);
    ctx.lineTo(spaceship.x + spaceship.size / 2, spaceship.y + spaceship.size / 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
}

// draw HUD
function drawHUD() {
    ctx.fillStyle = "white";
    ctx.font = "20px monospace";
    ctx.fillText(`X: ${Math.floor(spaceship.x)}`, 40, canvas.height / 2 - 20);
    ctx.fillText(`Y: ${Math.floor(spaceship.y)}`, 40, canvas.height / 2 + 10);
}

// main loop
function gameLoop(timestamp) {
    let dt = (timestamp - lastTime) * 0.06;
    lastTime = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    update(dt);
    drawWorld();
    drawHUD();

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

// button hooks
document.getElementById("resetBtn").onclick = resetGame;
document.getElementById("infoBtn").onclick = () => alert("Game Info Coming Soon");
