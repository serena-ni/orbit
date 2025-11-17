const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const G = 600; // slightly stronger gravity
let dt = 0.016;

// Player
let player = {
    x: canvas.width / 4,
    y: canvas.height / 2,
    vx: 0,
    vy: 0,
    radius: 8,
    trail: []
};

// Planets
let planets = [
    { x: canvas.width/2, y: canvas.height/2, mass: 2500, radius: 30, color: '#4fc3f7' },
    { x: canvas.width/1.5, y: canvas.height/3, mass: 1500, radius: 20, color: '#f06292' }
];

// Keys
let keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

// Overlay buttons
window.addEventListener('DOMContentLoaded', () => {
    const infoBtn = document.getElementById("infoBtn");
    const overlay = document.getElementById("overlay");
    const closeOverlay = document.getElementById("closeOverlay");

    infoBtn.addEventListener('click', () => overlay.style.display = 'flex');
    closeOverlay.addEventListener('click', () => overlay.style.display = 'none');
});

// Update game
function update() {
    let ax = 0;
    let ay = 0;

    for (let body of planets) {
        let dx = body.x - player.x;
        let dy = body.y - player.y;
        let distSq = dx*dx + dy*dy;
        let dist = Math.sqrt(distSq);
        if(dist > body.radius) {
            let force = (G * body.mass) / distSq;
            ax += force * dx / dist;
            ay += force * dy / dist;
        }
    }

    // Thrust controls (very gentle)
    let thrust = 50;
    if(keys['ArrowUp'] || keys['w']) ay -= thrust*dt;
    if(keys['ArrowDown'] || keys['s']) ay += thrust*dt;
    if(keys['ArrowLeft'] || keys['a']) ax -= thrust*dt;
    if(keys['ArrowRight'] || keys['d']) ax += thrust*dt;

    // Update velocity
    player.vx += ax*dt;
    player.vy += ay*dt;

    // Velocity cap
    let maxV = 3;
    let speed = Math.sqrt(player.vx*player.vx + player.vy*player.vy);
    if(speed > maxV) {
        player.vx = (player.vx / speed) * maxV;
        player.vy = (player.vy / speed) * maxV;
    }

    // Update position (slower for orbiting)
    player.x += player.vx*dt*15;
    player.y += player.vy*dt*15;

    // Trail
    player.trail.push({x: player.x, y: player.y});
    if(player.trail.length > 150) player.trail.shift();

    // Collision
    for(let body of planets) {
        let dx = body.x - player.x;
        let dy = body.y - player.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        if(dist < body.radius + player.radius) {
            player.x = canvas.width / 4;
            player.y = canvas.height / 2;
            player.vx = 0;
            player.vy = 0;
            player.trail = [];
        }
    }
}

// Draw
function draw() {
    ctx.fillStyle = "#0b0c1a";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // Stars
    for(let i=0; i<200; i++){
        ctx.fillStyle = `rgba(255,255,255,${Math.random()})`;
        ctx.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, 1,1);
    }

    // Planets
    for(let body of planets){
        ctx.fillStyle = body.color;
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius, 0, Math.PI*2);
        ctx.fill();
    }

    // Trail
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    for(let i=0; i<player.trail.length; i++){
        let p = player.trail[i];
        if(i===0) ctx.moveTo(p.x,p.y);
        else ctx.lineTo(p.x,p.y);
    }
    ctx.stroke();

    // Player marker
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2);
    ctx.fill();

    // Outline marker
    ctx.strokeStyle = '#6b5bff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius+3, 0, Math.PI*2);
    ctx.stroke();
}

function loop(){
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
