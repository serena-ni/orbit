// collision
for (let p of planets) {
  const dist = Math.hypot(spaceship.x - p.x, spaceship.y - p.y);
  if (dist < p.size + spaceship.size) {
    lives--;

    // stop ship immediately
    spaceship.speed = 0;

    // prevent further movement until restart
    paused = true;

    // trigger screen shake
    shakeTime = 160;
    shakeStrength = 8;

    // show death message and final time
    const msg = deathMessages[Math.floor(Math.random() * deathMessages.length)];
    document.getElementById("deathMessage").textContent = msg;
    document.getElementById("finalTime").textContent = `final time: ${elapsedTime}s`;
    document.getElementById("deathOverlay").classList.remove("hidden");

    // reset player for next restart, but ship won't move until restart
    resetPlayer();

    return; // exit update
  }
}

// pause toggle
function togglePause() {
  // don't allow unpausing if death screen is visible
  if (!document.getElementById("deathOverlay").classList.contains("hidden")) return;

  paused = !paused;
  if (paused) {
    savedSpeed = spaceship.speed;
    spaceship.speed = 0;
  } else {
    spaceship.speed = savedSpeed;
    // adjust timer so elapsedTime is correct after pause
    startTime = performance.now() - elapsedTime * 1000;
  }
  pauseOverlay.classList.toggle("hidden", !paused);
}
