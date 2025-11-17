const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const dt = 0.016;

// planets
const planets = [
    { x: canvas.width/2, y: canvas.height/2, mass: 2000, radius: 40, color: '#4fc3f7' },
    { x: canvas.width/1.5, y: canvas.height/3, mass: 1500, radius: 30, color: '#f06292' }
];

// gravity & caps
const G = 1000;
const maxForce = 0.3; // cap for soft gravity

// player
const player = {
    x: canvas.width/2 - 200,
    y: canvas.height/2,
    vx: 0,
    vy: 0,
    radius: 10,
    trail: []
};

// initial tangential velocity to start curving around first planet
let dx0 = player.x - planets[0].x;
let dy0 = player.y - planets[0].y;
let r0 = Math.sqrt(dx0*dx0 + dy0*dy0);
let vOrbit = Math.sqrt(G * planets[0].mass / r0);
player.vx = -vOrbit * dy0/r0 * 0.7; // reduce slightly for fun
player.vy = vOrbit * dx0/r0 * 0.7;

// keys
let keys = {};
window.addEventListener('keydown', e => keys[e.key] = true);
window.addEventListener('keyup', e => keys[e.key] = false);

// overlay buttons
window.addEventListener('DOMContentLoaded', () => {
    const infoBtn = document.getElementById("infoBtn");
    const overlay = document.getElementById("overlay");
    const closeOverlay = document.getElementById("closeOverlay");

    infoBtn.addEventListener('click', () => overlay.style.display = 'flex');
    closeOverlay.addEventListener('click', () => overlay.style.display = 'none');
});

// update
function update() {
    let ax = 0;
    let ay = 0;

    // gravity from planets (softened)
    for (const p of planets) {
        const dx = p.x - player.x;
        const dy = p.y - player.y;
        const distSq = dx*dx + dy*dy;
        const dist = Math.sqrt(distSq);
        if(dist > p.radius){
            let force = Math.min(G * p.mass / distSq, maxForce);
            ax += force * dx / dist;
            ay += force * dy / dist;
        }
    }

    // thrust
    const thrust = 0.2;
    if(keys['ArrowUp'] || keys['w']) { ax += thrust; }
    if(keys['ArrowDown'] || keys['s']) { ax -= thrust; }
    if(keys['ArrowLeft'] || keys['a']) { ay -= thrust; }
    if(keys['ArrowRight'] || keys['d']) { ay += thrust; }

    // update velocity
    player.vx += ax * dt;
    player.vy += ay * dt;

    // update position
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    // trail
    player.trail.push({x: player.x, y: player.y});
    if(player.trail.length > 200) player.trail.shift();

    // collision
    for(const p of planets){
        const dx = p.x - player.x;
        const dy = p.y - player.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if(dist < p.radius + player.radius){
            // reset
            player.x = canvas.width/2 - 200;
            player.y = canvas.height/2;
            player.trail = [];
            dx0 = player.x - planets[0].x;
            dy0 = player.y - planets[0].y;
            r0 = Math.sqrt(dx0*dx0 + dy0*dy0);
            vOrbit = Math.sqrt(G * planets[0].mass / r0);
            player.vx = -vOrbit * dy0/r0 * 0.7;
            player.vy = vOrbit * dx0/r0 * 0.7;
        }
    }
}

// draw
function draw() {
    ctx.fillStyle = "#0b0c1a";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // stars
    for(let i=0;i<150;i++){
        ctx.fillStyle = `rgba(255,255,255,${Math.random()})`;
        ctx.fillRect(Math.random()*canvas.width,Math.random()*canvas.height,1,1);
    }

    // planets
    for(const p of planets){
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);
        ctx.fill();
    }

    // trail
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    for(let i=0;i<player.trail.length;i++){
        const t = player.trail[i];
        if(i===0) ctx.moveTo(t.x,t.y);
        else ctx.lineTo(t.x,t.y);
    }
    ctx.stroke();

    // player as triangle pointing along velocity
    const angle = Math.atan2(player.vy, player.vx);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(player.x + Math.cos(angle)*12, player.y + Math.sin(angle)*12);
    ctx.lineTo(player.x + Math.cos(angle+2.5)*6, player.y + Math.sin(angle+2.5)*6);
    ctx.lineTo(player.x + Math.cos(angle-2.5)*6, player.y + Math.sin(angle-2.5)*6);
    ctx.closePath();
    ctx.fill();
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

loop();
