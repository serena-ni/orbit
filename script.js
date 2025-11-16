const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const G = 400; // gravity strength
let dt = 0.016; // time step

// player
let player = {
    x: canvas.width / 4,
    y: canvas.height / 2,
    vx: 0,
    vy: 0,
    radius: 8,
    trail: []
};

// planets
let planets = [
    { x: canvas.width/2, y: canvas.height/2, mass: 2000, radius: 30, color: '#4fc3f7' },
    { x: canvas.width/1.5, y: canvas.height/3, mass: 1000, radius: 20, color: '#f06292' }
];

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

// update game
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

    // thrust controls
    let thrust = 120; // reduce thrust for slower feel
    if(keys['ArrowUp'] || keys['w']) ay -= thrust*dt;
    if(keys['ArrowDown'] || keys['s']) ay += thrust*dt;
    if(keys['ArrowLeft'] || keys['a']) ax -= thrust*dt;
    if(keys['ArrowRight'] || keys['d']) ax += thrust*dt;

    // update velocity and position (slower scaling)
    player.vx += ax*dt;
    player.vy += ay*dt;
    player.x += player.vx*dt*40; // reduced from 60
    player.y += player.vy*dt*40;

    // trail
    player.trail.push({x: player.x, y: player.y});
    if(player.trail.length > 100) player.trail.shift();

    // collision
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

// draw
function draw() {
    ctx.fillStyle = "#0b0c1a";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    // stars
    for(let i=0; i<200; i++){
        ctx.fillStyle = `rgba(255,255,255,${Math.random()})`;
        ctx.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, 1,1);
    }

    // planets
    for(let body of planets){
        ctx.fillStyle = body.color;
        ctx.beginPath();
        ctx.arc(body.x, body.y, body.radius, 0, Math.PI*2);
        ctx.fill();
    }

    // trail
    ctx.strokeStyle = '#fff';
    ctx.beginPath();
    for(let i=0; i<player.trail.length; i++){
        let p = player.trail[i];
        if(i===0) ctx.moveTo(p.x,p.y);
        else ctx.lineTo(p.x,p.y);
    }
    ctx.stroke();

    // player marker
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2);
    ctx.fill();

    // outline marker for visibility
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
