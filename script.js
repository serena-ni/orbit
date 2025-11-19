// canvas setup
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resize();
window.addEventListener("resize", resize);

// game objects & settings
let spaceship = { x: 240, y: canvas.height/2, vx: 0, vy: 0, angle: -Math.PI/2, radius: 12 };
let lives = 3;
let elapsedTime = 0;
let startTime = 0;
let lastTime = 0;
let gameStarted = false;

// camera
const camera = { x: spaceship.x, y: spaceship.y, smooth: 0.12 };

// planet generation
const planetSpacing = { min: 420, max: 700 };
const planetSize = { min: 40, max: 100 };
const minY = 100;
const maxY = () => Math.max(200, canvas.height-120);
const palette = ["#6fa8ff","#6b5bff","#4fc3f7","#8ca5ff","#5f7bff","#7fb4ff"];
let planets = [];

// checkpoints
let checkpoints = [{ x: 240, y: canvas.height/2 }];
let checkpointIndex = -1;

// input
const keys = {};
window.addEventListener("keydown", e => keys[e.key.toLowerCase()] = true);
window.addEventListener("keyup", e => keys[e.key.toLowerCase()] = false);

// UI
const startOverlay = document.getElementById("startOverlay");
const startBtn = document.getElementById("startBtn");
const infoBtn = document.getElementById("infoBtn");
const resetBtn = document.getElementById("resetBtn");
const timerDisplay = document.getElementById("timerDisplay");
const livesDisplay = document.getElementById("livesDisplay");

// particles + shake + comet background
let particles = [];
let shakeTime = 0;
let shakeMagnitude = 0;
let comets = [];
const cometCount = 12;

// initialize comets
for(let i=0;i<cometCount;i++){
  comets.push({
    x: Math.random()*canvas.width*3,
    y: Math.random()*canvas.height,
    vx: -50 - Math.random()*100,
    size: 2 + Math.random()*3
  });
}

// HELPERS
function randomColor() { return palette[Math.floor(Math.random()*palette.length)]; }
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function hexToRGBA(hex,alpha){const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);return `rgba(${r},${g},${b},${alpha})`;}

// PLANETS
function generateInitialPlanets(){
  planets=[]; let x=600;
  for(let i=0;i<6;i++){
    const size=planetSize.min+Math.random()*(planetSize.max-planetSize.min);
    const y=minY+Math.random()*(maxY()-minY);
    planets.push({x,y,size,color:randomColor()});
    x += planetSpacing.min + Math.random()*(planetSpacing.max-planetSpacing.min);
  }
}

function generatePlanet(){
  const last = planets[planets.length-1];
  const x = last.x + planetSpacing.min + Math.random()*(planetSpacing.max-planetSpacing.min);
  const y = minY + Math.random()*(maxY()-minY);
  const size = planetSize.min + Math.random()*(planetSize.max-planetSize.min);
  planets.push({x,y,size,color:randomColor()});
}

function removeFarPlanets(){
  const leftLimit = spaceship.x-800;
  planets = planets.filter(p=> (p.x+p.size)>leftLimit);
}

function isOverlappingPlanet(x,y,margin=0){
  for(const p of planets){
    if(Math.hypot(p.x-x,p.y-y)<p.size+spaceship.radius+margin) return true;
  }
  return false;
}

function findSafeSpawnAround(tx,ty){
  for(let t=0;t<40;t++){
    const ang=Math.random()*Math.PI*2;
    const r=(t+1)*48*Math.random();
    const sx=tx+Math.cos(ang)*r;
    const sy=clamp(ty+Math.sin(ang)*r,minY,maxY());
    if(!isOverlappingPlanet(sx,sy,8)) return {x:sx,y:sy};
  }
  return {x:tx,y:clamp(ty-180,minY,maxY())};
}

// checkpoint
function setCheckpointFromPlanetIndex(i){
  const p=planets[i];
  const cp={x:p.x-Math.max(180,p.size+60), y:clamp(p.y-p.size-36,minY,maxY())};
  checkpoints.push(cp);
  checkpointIndex=checkpoints.length-1;
}

function respawnAtCheckpoint(){
  let cp = checkpoints[checkpointIndex>=0?checkpointIndex:0];
  let nearestPlanet = planets.find(p=>p.x>cp.x-100) || planets[0];
  const safe = findSafeSpawnAround(cp.x,nearestPlanet.y);
  spaceship.x = safe.x; spaceship.y = safe.y;
  spaceship.vx=0; spaceship.vy=0; spaceship.angle=-Math.PI/2;
  camera.x=spaceship.x; camera.y=spaceship.y;
}

// particles
function createCollisionParticles(x,y){
  for(let i=0;i<18;i++){
    const ang=Math.random()*Math.PI*2;
    const spd=120+Math.random()*180;
    particles.push({x,y,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd,life:400,maxLife:400});
  }
}

// UPDATE
function update(dtMs){
  const s = clamp(dtMs/1000,0,0.06);

  // rotation
  if(keys["a"] || keys["arrowleft"]) spaceship.angle -= 2.8*s;
  if(keys["d"] || keys["arrowright"]) spaceship.angle += 2.8*s;

  // thrust
  if(keys["w"] || keys["arrowup"]){
    spaceship.vx += Math.cos(spaceship.angle)*360*s;
    spaceship.vy += Math.sin(spaceship.angle)*360*s;
  }
  if(keys["s"] || keys["arrowdown"]){
    spaceship.vx *= 0.92;
    spaceship.vy *= 0.92;
  }

  // speed clamp
  let spd=Math.hypot(spaceship.vx,spaceship.vy);
  if(spd>900){ const scale=900/spd; spaceship.vx*=scale; spaceship.vy*=scale; }

  spaceship.vx*=0.999; spaceship.vy*=0.999;
  spaceship.x+=spaceship.vx*s; spaceship.y+=spaceship.vy*s;

  // camera
  camera.x+=(spaceship.x-camera.x)*camera.smooth;
  camera.y+=(spaceship.y-camera.y)*camera.smooth;

  // planets
  while(planets.length===0 || planets[planets.length-1].x<spaceship.x+canvas.width*1.1){
    generatePlanet();
  }
  removeFarPlanets();

  // timer
  const now=performance.now();
  elapsedTime=(now-startTime)/1000;
  timerDisplay.textContent=`time: ${Math.floor(elapsedTime)}s`;
  livesDisplay.textContent=`lives: ${lives}`;

  // particles
  for(let i=particles.length-1;i>=0;i--){
    const p=particles[i];
    p.life-=dtMs;
    if(p.life<=0){particles.splice(i,1);continue;}
    const ss=dtMs/1000;
    p.x+=p.vx*ss; p.y+=p.vy*ss;
    p.vx*=0.96; p.vy*=0.96;
  }

  // collisions & checkpoints
  for(let i=0;i<planets.length;i++){
    const p=planets[i];
    const dist=Math.hypot(p.x-spaceship.x,p.y-spaceship.y);
    if(dist<p.size+spaceship.radius){
      lives=Math.max(0,lives-1);
      shakeTime=220; shakeMagnitude=8;
      createCollisionParticles(spaceship.x,spaceship.y);
      respawnAtCheckpoint();
      break;
    }
    if(spaceship.x>p.x+p.size && checkpointIndex<i){
      setCheckpointFromPlanetIndex(i);
    }
  }

  if(lives<=0){
    startOverlay.querySelector("h1").textContent="Game Over";
    startOverlay.querySelector("p").textContent=`You survived for ${Math.floor(elapsedTime)}s`;
    startOverlay.style.display="flex";
    lives=3; elapsedTime=0; startTime=performance.now();
    checkpoints=[{x:240,y:canvas.height/2}];
    checkpointIndex=-1;
    generateInitialPlanets();
    respawnAtCheckpoint();
    gameStarted=false;
  }

  // update comet positions
  for(const c of comets){
    c.x += c.vx*s;
    if(c.x<camera.x-200) {
      c.x = camera.x+canvas.width+200;
      c.y = Math.random()*canvas.height;
      c.vx = -50 - Math.random()*100;
      c.size = 2 + Math.random()*3;
    }
  }
}

// DRAW
function draw(){
  ctx.fillStyle="#0b0c1a";
  ctx.fillRect(0,0,canvas.width,canvas.height);

  const camX=Math.round(camera.x-canvas.width/2);
  const camY=Math.round(camera.y-canvas.height/2);

  let shakeX=0, shakeY=0;
  if(shakeTime>0){
    shakeTime-=16;
    shakeX=(Math.random()-0.5)*shakeMagnitude;
    shakeY=(Math.random()-0.5)*shakeMagnitude;
    shakeMagnitude*=0.95;
    if(shakeTime<=0) shakeMagnitude=0;
  }

  // stars
  ctx.fillStyle="#ffffff22";
  for(let i=0;i<120;i++){
    const rx=((i*9301+49297)%233280)/233280;
    const ry=((i*49297+9301)%233280)/233280;
    const x=Math.floor(rx*(canvas.width*2))-camX*0.28;
    const y=Math.floor(ry*(canvas.height*2))-camY*0.28;
    ctx.fillRect((x%canvas.width+canvas.width)%canvas.width,(y%canvas.height+canvas.height)%canvas.height,1,1);
  }

  // draw comets
  ctx.fillStyle="#fffcaa";
  for(const c of comets){
    ctx.beginPath();
    ctx.arc(c.x-camX, c.y-camY, c.size,0,Math.PI*2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(-camX+shakeX,-camY+shakeY);

  // planets
  for(const p of planets){
    const glowRadius=p.size*1.8;
    const grad=ctx.createRadialGradient(p.x,p.y,p.size*0.5,p.x,p.y,glowRadius);
    grad.addColorStop(0,hexToRGBA(p.color,0.55));
    grad.addColorStop(1,hexToRGBA(p.color,0));
    ctx.fillStyle=grad;
    ctx.beginPath(); ctx.arc(p.x,p.y,glowRadius,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill();
  }

  // particles
  for(const p of particles){
    ctx.fillStyle=`rgba(255,180,80,${p.life/p.maxLife})`;
    ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill();
  }

  // spaceship
  ctx.save();
  ctx.translate(spaceship.x,spaceship.y);
  ctx.rotate(spaceship.angle);

  // thrust flame
  if(keys["w"]||keys["arrowup"]){
    const flameLength = 8+Math.random()*4;
    ctx.fillStyle="#ffb86c";
    ctx.beginPath();
    ctx.moveTo(-spaceship.radius*0.9,0);
    ctx.lineTo(-spaceship.radius*0.9-flameLength,4);
    ctx.lineTo(-spaceship.radius*0.9-flameLength,-4);
    ctx.closePath();
    ctx.fill();
  }

  // body
  ctx.fillStyle="#ffffff";
  ctx.beginPath();
  ctx.moveTo(spaceship.radius*1.1,0);
  ctx.lineTo(-spaceship.radius*0.8,spaceship.radius);
  ctx.lineTo(-spaceship.radius*0.8,-spaceship.radius);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
  ctx.restore();
}

// main loop
function loop(ts){
  if(!gameStarted) return;
  if(!lastTime) lastTime=ts;
  const dt=ts-lastTime;
  lastTime=ts;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// UI hooks
startBtn.addEventListener("click",()=>{
  generateInitialPlanets();
  respawnAtCheckpoint();
  startTime=performance.now();
  lastTime=0;
  elapsedTime=0;
  startOverlay.style.display="none";
  gameStarted=true;
  requestAnimationFrame(loop);
});

resetBtn.addEventListener("click",()=>{
  generateInitialPlanets();
  checkpoints=[{x:240,y:canvas.height/2}];
  checkpointIndex=-1;
  lives=3;
  elapsedTime=0;
  startTime=performance.now();
  respawnAtCheckpoint();
  particles=[];
});

infoBtn.addEventListener("click",()=>{
  startOverlay.querySelector("h1").textContent="Orbit Simulator";
  startOverlay.querySelector("p").textContent="Navigate your spaceship around planets. Avoid collisions and reach new checkpoints!";
  startOverlay.style.display="flex";
});

// bootstrap
generateInitialPlanets();
respawnAtCheckpoint();
