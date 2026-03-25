const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoresListEl = document.getElementById("scores-list");
const unlockPanelEl = document.getElementById("unlock-panel");
const playAgainEl = document.getElementById("play-again");
const mobileHintEl = document.getElementById("mobile-hint");
const resultLineEl = document.getElementById("result-line");
const rankLineEl = document.getElementById("rank-line");
const scoreFormEl = document.getElementById("score-form");
const scoreNameEl = document.getElementById("score-name");
const scoreSubmitEl = document.getElementById("score-submit");

const SUPABASE_URL = "https://jntwuuukbagxaoobvmni.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpudHd1dXVrYmFneGFvb2J2bW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODI1NjUsImV4cCI6MjA4OTk1ODU2NX0.6GFot144kvxzBuAIk8kIsdzf-EA9-MwF0DUQ-Kxr33A";

const player = { x: 0, y: 0, w: 46, h: 12, speed: 6, cooldown: 0 };
const keys = { left: false, right: false, shoot: false };
const tilt = { enabled: false, gamma: 0 };

const bullets = [];
const enemyBullets = [];
const explosions = [];
const powerups = [];
const comboPopups = [];
let pixels = [];
let touchPointerId = null;
let hintHidden = false;
let unlocked = false;
let submittedForRun = false;

let score = 0;
let shotsFired = 0;
let startedAt = 0;
let totalPixelCount = 0;
let pendingFinalScore = null;
let lives = 2;
let wave = 1;
let rapidFireFrames = 0;
let respawnInvuln = 0;
let slowFieldFrames = 0;
let comboCount = 0;
let comboFrames = 0;
let mode = "swarm";
let boss = null;

const maxWaves = 1;
const comboWindow = 90;
const maxLives = 2;

const swarm = { dir: 1, speed: 0.95, drop: 14, shootTick: 0, shootRate: 34 };

const GLYPHS = {
  D: ["1111000", "1000100", "1000010", "1000010", "1000010", "1000010", "1111100", "0000000"],
  a: ["0000000", "0011100", "0000010", "0011110", "0100010", "0100010", "0011110", "0000000"],
  v: ["0000000", "0100010", "0100010", "0100010", "0010100", "0010100", "0001000", "0000000"],
  i: ["0000000", "0001000", "0000000", "0011000", "0001000", "0001000", "0011100", "0000000"],
  d: ["0000010", "0000010", "0011110", "0100010", "0100010", "0100010", "0011110", "0000000"]
};

function normalizeName(input) {
  const cleaned = (input || "").trim().replace(/\s+/g, " ");
  return cleaned ? cleaned.slice(0, 12) : "anon";
}

function renderScores(rows) {
  scoresListEl.innerHTML = "";
  if (!rows || rows.length === 0) {
    const li = document.createElement("li");
    li.textContent = "no scores yet";
    scoresListEl.appendChild(li);
    return;
  }
  rows.forEach((row) => {
    const li = document.createElement("li");
    const nameEl = document.createElement("span");
    nameEl.className = "score-name";
    nameEl.textContent = row.name;

    const scoreEl = document.createElement("span");
    scoreEl.className = "score-value";
    scoreEl.textContent = row.score;

    li.appendChild(nameEl);
    li.appendChild(scoreEl);
    scoresListEl.appendChild(li);
  });
}

async function fetchTopScores() {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/scores?select=name,score&order=score.desc,created_at.asc&limit=10`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );
    if (!res.ok) {
      renderScores([]);
      return [];
    }
    const rows = await res.json();
    renderScores(rows);
    return rows;
  } catch (_error) {
    renderScores([]);
    return [];
  }
}

async function submitScore(name, value) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/scores`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({ name, score: value })
    });
  } catch (_error) {}
}

function handleWin() {
  if (submittedForRun) {
    return;
  }
  submittedForRun = true;

  const elapsedMs = Math.max(1, performance.now() - startedAt);
  const accuracy = Math.max(0, totalPixelCount * 4 - shotsFired);
  pendingFinalScore = Math.max(1, Math.round(score + accuracy + 60000 / elapsedMs));

  resultLineEl.textContent = `final score: ${pendingFinalScore}`;
  rankLineEl.textContent = "";
  scoreNameEl.value = "";
  scoreFormEl.classList.remove("hidden");
  scoreSubmitEl.disabled = false;
  unlockPanelEl.classList.remove("hidden");
  fetchTopScores();
  window.setTimeout(() => scoreNameEl.focus(), 30);
}

async function handleScoreSubmit(event) {
  event.preventDefault();
  if (pendingFinalScore == null || scoreSubmitEl.disabled) {
    return;
  }

  scoreSubmitEl.disabled = true;
  const name = normalizeName(scoreNameEl.value);
  await submitScore(name, pendingFinalScore);
  const rows = await fetchTopScores();

  const rank = rows.findIndex((row) => row.name === name && row.score === pendingFinalScore);
  rankLineEl.textContent = rank >= 0 ? `rank: #${rank + 1}` : "rank: outside top 10";
  scoreFormEl.classList.add("hidden");
}

function hideMobileHint() {
  if (!hintHidden) {
    hintHidden = true;
    mobileHintEl.classList.add("hidden");
  }
}

function initMobileHint() {
  const isTouchLike = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  if (!isTouchLike) {
    hideMobileHint();
    return;
  }
  window.setTimeout(hideMobileHint, 2400);
}

function buildWord() {
  const text = "David";
  const points = [];
  const letterWidths = [];
  const letterGap = 0;

  text.split("").forEach((char) => {
    letterWidths.push(GLYPHS[char][0].length);
  });

  const gridWidth = letterWidths.reduce((sum, w) => sum + w, 0) + (text.length - 1) * letterGap;
  let cursorX = 0;

  text.split("").forEach((char) => {
    const glyph = GLYPHS[char];
    for (let y = 0; y < glyph.length; y += 1) {
      for (let x = 0; x < glyph[y].length; x += 1) {
        if (glyph[y][x] === "1") {
          points.push({ x: cursorX + x, y });
        }
      }
    }
    cursorX += glyph[0].length + letterGap;
  });

  const pixelSize = Math.max(8, Math.min(28, Math.floor((canvas.width * 0.9) / gridWidth)));
  const wordWidth = gridWidth * pixelSize;
  const startX = Math.round((canvas.width - wordWidth) / 2);
  const startY = Math.round(Math.max(48, canvas.height * 0.13));

  pixels = points.map((p) => ({
    x: startX + p.x * pixelSize,
    y: startY + p.y * pixelSize,
    s: pixelSize,
    alive: true
  }));
  totalPixelCount = pixels.length;
}

function setupWave() {
  mode = "swarm";
  buildWord();
  boss = null;
  bullets.length = 0;
  enemyBullets.length = 0;
  explosions.length = 0;
  powerups.length = 0;
  comboPopups.length = 0;
  swarm.dir = 1;
  swarm.shootTick = 0;
  swarm.speed = 1.55;
  swarm.drop = 18;
  swarm.shootRate = 22;

  player.x = canvas.width * 0.5 - player.w * 0.5;
  player.y = canvas.height - 42;
  player.cooldown = 0;
  respawnInvuln = 45;
}

function loseLife() {
  if (respawnInvuln > 0 || unlocked) {
    return;
  }

  lives -= 1;
  rapidFireFrames = 0;
  slowFieldFrames = 0;
  comboCount = 0;
  comboFrames = 0;
  if (lives <= 0) {
    resetRun();
    return;
  }
  setupWave();
}

function resetRun() {
  unlocked = false;
  submittedForRun = false;
  score = 0;
  shotsFired = 0;
  startedAt = performance.now();
  pendingFinalScore = null;
  lives = maxLives;
  wave = 1;
  rapidFireFrames = 0;
  respawnInvuln = 0;
  slowFieldFrames = 0;
  comboCount = 0;
  comboFrames = 0;
  mode = "swarm";
  boss = null;

  unlockPanelEl.classList.add("hidden");
  resultLineEl.textContent = "";
  rankLineEl.textContent = "";
  scoreNameEl.value = "";
  scoreFormEl.classList.add("hidden");
  scoreSubmitEl.disabled = false;

  setupWave();
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  resetRun();
}

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function spawnPixelExplosion(pixel) {
  const centerX = pixel.x + pixel.s * 0.5;
  const centerY = pixel.y + pixel.s * 0.5;
  const count = 7;
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const speed = 1.2 + Math.random() * 2;
    const maxLife = 12 + Math.floor(Math.random() * 8);
    explosions.push({
      x: centerX,
      y: centerY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: maxLife,
      maxLife,
      size: Math.max(2, Math.floor(pixel.s * 0.22)),
      color: i % 2 === 0 ? "#d40000" : "#000"
    });
  }
}

function randomPowerupType() {
  const roll = Math.random();
  if (roll < 0.55) {
    return "rapid";
  }
  return "slow";
}

function spawnPowerup(x, y) {
  powerups.push({
    x,
    y,
    w: 16,
    h: 16,
    vy: 2.1,
    type: randomPowerupType()
  });
}

function spawnComboPopup(x, y, value) {
  comboPopups.push({
    x,
    y,
    value,
    life: 34,
    maxLife: 34
  });
}

function addScore(base, x = player.x + player.w * 0.5, y = player.y - 20) {
  if (comboFrames > 0) {
    comboCount += 1;
  } else {
    comboCount = 1;
  }
  comboFrames = comboWindow;
  score += base * comboCount;

  if (comboCount > 1) {
    spawnComboPopup(x, y, comboCount);
  }
}

function applyPowerup(type) {
  if (type === "rapid") {
    rapidFireFrames = Math.max(rapidFireFrames, 600);
    return;
  }
  slowFieldFrames = Math.max(slowFieldFrames, 480);
}

function setupBoss() {
  const width = Math.max(120, Math.min(220, Math.round(canvas.width * 0.26)));
  const height = Math.round(width * 0.5);
  boss = {
    x: canvas.width * 0.5 - width * 0.5,
    y: Math.max(62, canvas.height * 0.12),
    w: width,
    h: height,
    hp: 36,
    maxHp: 36,
    dir: 1,
    speed: 1.7,
    drop: 22,
    shootTick: 0,
    shootRate: 26
  };
}

function update() {
  const moveSpeed = slowFieldFrames > 0 ? player.speed * 0.45 : player.speed;

  if (keys.left) {
    player.x -= moveSpeed;
  }
  if (keys.right) {
    player.x += moveSpeed;
  }
  if (tilt.enabled) {
    const clamped = Math.max(-32, Math.min(32, tilt.gamma));
    if (Math.abs(clamped) > 2.5) {
      player.x += (clamped / 32) * moveSpeed * 1.9;
    }
  }
  player.x = Math.max(8, Math.min(canvas.width - player.w - 8, player.x));

  if (respawnInvuln > 0) {
    respawnInvuln -= 1;
  }
  if (rapidFireFrames > 0) {
    rapidFireFrames -= 1;
  }
  if (slowFieldFrames > 0) {
    slowFieldFrames -= 1;
  }
  if (comboFrames > 0) {
    comboFrames -= 1;
    if (comboFrames <= 0) {
      comboCount = 0;
    }
  }

  if (player.cooldown > 0) {
    player.cooldown -= 1;
  }
  const shootDelay = rapidFireFrames > 0 ? 4 : 8;
  if (keys.shoot && player.cooldown <= 0) {
    bullets.push({ x: player.x + player.w * 0.5 - 2, y: player.y - 8, w: 4, h: 10, vy: -9 });
    player.cooldown = shootDelay;
    shotsFired += 1;
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.y += bullet.vy;
    if (bullet.y < -16) {
      bullets.splice(i, 1);
      continue;
    }

    let hitSomething = false;

    if (mode === "swarm") {
      for (let j = 0; j < pixels.length; j += 1) {
        const pixel = pixels[j];
        if (!pixel.alive) {
          continue;
        }
        if (aabb(bullet, { x: pixel.x, y: pixel.y, w: pixel.s, h: pixel.s })) {
          pixel.alive = false;
          spawnPixelExplosion(pixel);
          if (Math.random() < 0.16) {
            spawnPowerup(pixel.x + pixel.s * 0.5 - 6, pixel.y + pixel.s * 0.5 - 6);
          }
          addScore(10, pixel.x + pixel.s * 0.5, pixel.y + pixel.s * 0.5);
          hitSomething = true;
          break;
        }
      }
    } else if (boss && aabb(bullet, boss)) {
      boss.hp -= 1;
      spawnPixelExplosion({ x: bullet.x - 4, y: bullet.y - 4, s: 12 });
      if (Math.random() < 0.1) {
        spawnPowerup(bullet.x - 6, bullet.y - 6);
      }
      addScore(14, bullet.x, bullet.y);
      hitSomething = true;
    }

    if (hitSomething) {
      bullets.splice(i, 1);
      continue;
    }
  }

  for (let i = powerups.length - 1; i >= 0; i -= 1) {
    const powerup = powerups[i];
    powerup.y += powerup.vy;
    if (powerup.y > canvas.height + 20) {
      powerups.splice(i, 1);
      continue;
    }
    if (aabb(powerup, player)) {
      powerups.splice(i, 1);
      applyPowerup(powerup.type);
      addScore(8, powerup.x + powerup.w * 0.5, powerup.y + powerup.h * 0.5);
    }
  }

  for (let i = explosions.length - 1; i >= 0; i -= 1) {
    const particle = explosions[i];
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vx *= 0.98;
    particle.vy = particle.vy * 0.98 + 0.06;
    particle.life -= 1;
    if (particle.life <= 0) {
      explosions.splice(i, 1);
    }
  }

  for (let i = comboPopups.length - 1; i >= 0; i -= 1) {
    const popup = comboPopups[i];
    popup.y -= 0.45;
    popup.life -= 1;
    if (popup.life <= 0) {
      comboPopups.splice(i, 1);
    }
  }

  if (!unlocked && mode === "swarm") {
    const alivePixels = pixels.filter((pixel) => pixel.alive);
    if (alivePixels.length > 0) {
      let left = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;

      alivePixels.forEach((pixel) => {
        pixel.x += swarm.dir * swarm.speed;
        left = Math.min(left, pixel.x);
        right = Math.max(right, pixel.x + pixel.s);
        bottom = Math.max(bottom, pixel.y + pixel.s);
      });

      if (left < 14 || right > canvas.width - 14) {
        swarm.dir *= -1;
        alivePixels.forEach((pixel) => {
          pixel.y += swarm.drop;
        });
      }

      if (bottom >= player.y) {
        loseLife();
        return;
      }

      swarm.shootTick += 1;
      const effectiveRate = slowFieldFrames > 0 ? swarm.shootRate + 10 : swarm.shootRate;
      if (swarm.shootTick >= effectiveRate) {
        swarm.shootTick = 0;
        const byColumn = new Map();
        alivePixels.forEach((pixel) => {
          const col = Math.round(pixel.x / 18);
          const current = byColumn.get(col);
          if (!current || pixel.y > current.y) {
            byColumn.set(col, pixel);
          }
        });
        const shooters = [...byColumn.values()];
        if (shooters.length > 0) {
          const shooter = shooters[Math.floor(Math.random() * shooters.length)];
          const bulletSpeed = slowFieldFrames > 0 ? 3.1 : 5.2;
          enemyBullets.push({ x: shooter.x + shooter.s * 0.5 - 2, y: shooter.y + shooter.s, w: 4, h: 10, vy: bulletSpeed });
          if (shooters.length > 3 && Math.random() < 0.45) {
            const second = shooters[Math.floor(Math.random() * shooters.length)];
            enemyBullets.push({
              x: second.x + second.s * 0.5 - 2,
              y: second.y + second.s,
              w: 4,
              h: 10,
              vy: bulletSpeed - 0.4
            });
          }
        }
      }
    }
  }

  if (!unlocked && mode === "boss" && boss) {
    boss.x += boss.dir * boss.speed;
    if (boss.x < 14 || boss.x + boss.w > canvas.width - 14) {
      boss.dir *= -1;
      boss.y += boss.drop;
    }

    if (boss.y + boss.h >= player.y) {
      loseLife();
      return;
    }

    boss.shootTick += 1;
    const bossRate = slowFieldFrames > 0 ? boss.shootRate + 10 : boss.shootRate;
    if (boss.shootTick >= bossRate) {
      boss.shootTick = 0;
      const bulletSpeed = slowFieldFrames > 0 ? 2.9 : 4.8;
      const centerX = boss.x + boss.w * 0.5;
      enemyBullets.push({ x: centerX - 2, y: boss.y + boss.h, w: 4, h: 12, vy: bulletSpeed });
      enemyBullets.push({ x: boss.x + 24, y: boss.y + boss.h - 2, w: 4, h: 10, vy: bulletSpeed - 0.4 });
      enemyBullets.push({ x: boss.x + boss.w - 28, y: boss.y + boss.h - 2, w: 4, h: 10, vy: bulletSpeed - 0.4 });
    }
  }

  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    const bullet = enemyBullets[i];
    bullet.y += bullet.vy;
    if (bullet.y > canvas.height + 20) {
      enemyBullets.splice(i, 1);
      continue;
    }
    if (aabb(bullet, player)) {
      enemyBullets.splice(i, 1);
      loseLife();
      return;
    }
  }

  const swarmCleared = mode === "swarm" && pixels.length > 0 && pixels.every((pixel) => !pixel.alive);
  const bossCleared = mode === "boss" && boss && boss.hp <= 0;

  if (!unlocked && (swarmCleared || bossCleared)) {
    enemyBullets.length = 0;
    powerups.length = 0;
    comboCount = 0;
    comboFrames = 0;
    if (wave < maxWaves) {
      score += wave * 80;
      wave += 1;
      setupWave();
      return;
    }
    unlocked = true;
    boss = null;
    handleWin();
  }
}

function drawHeart(x, y, unit, active) {
  const shape = [
    [1, 0], [2, 0], [4, 0], [5, 0],
    [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2],
    [1, 3], [2, 3], [3, 3], [4, 3],
    [2, 4], [3, 4]
  ];

  ctx.fillStyle = active ? "#d40000" : "#fff";
  shape.forEach((cell) => {
    ctx.fillRect(x + cell[0] * unit, y + cell[1] * unit, unit, unit);
  });
}

function draw() {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#000";
  ctx.font = "16px 'Press Start 2P'";
  ctx.fillText(`score ${score}`, 12, 26);
  ctx.font = "12px 'Press Start 2P'";
  ctx.fillText("lives", 12, 46);
  for (let i = 0; i < maxLives; i += 1) {
    drawHeart(82 + i * 18, 34, 2, i < lives);
  }
  if (comboCount > 1 && comboFrames > 0) {
    ctx.fillStyle = "#d40000";
    ctx.fillText(`combo x${comboCount}`, 12, 66);
    ctx.fillStyle = "#000";
  }
  if (rapidFireFrames > 0) {
    ctx.fillStyle = "#d40000";
    ctx.fillText(`rapid ${Math.ceil(rapidFireFrames / 60)}s`, 12, 86);
    ctx.fillStyle = "#000";
  }
  if (slowFieldFrames > 0) {
    ctx.fillStyle = "#d40000";
    ctx.fillText(`slow ${Math.ceil(slowFieldFrames / 60)}s`, 12, 106);
    ctx.fillStyle = "#000";
  }

  if (comboCount > 1 && comboFrames > 0) {
    ctx.fillStyle = "#d40000";
    ctx.font = "18px 'Press Start 2P'";
    const comboTitle = `x${comboCount} COMBO`;
    const comboWidth = ctx.measureText(comboTitle).width;
    ctx.fillText(comboTitle, (canvas.width - comboWidth) * 0.5, 38);
    ctx.font = "12px 'Press Start 2P'";
    ctx.fillStyle = "#000";
  }

  ctx.fillStyle = "#000";

  pixels.forEach((pixel) => {
    if (pixel.alive) {
      ctx.fillRect(pixel.x, pixel.y, pixel.s, pixel.s);
    }
  });

  if (mode === "boss" && boss) {
    ctx.fillStyle = "#000";
    ctx.fillRect(boss.x, boss.y, boss.w, boss.h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(boss.x + 12, boss.y + 12, boss.w - 24, boss.h - 24);
    ctx.fillStyle = "#000";
    ctx.fillRect(boss.x + 22, boss.y + 20, 14, 14);
    ctx.fillRect(boss.x + boss.w - 36, boss.y + 20, 14, 14);
    ctx.fillRect(boss.x + boss.w * 0.5 - 18, boss.y + boss.h - 20, 36, 8);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.strokeRect(boss.x, boss.y - 12, boss.w, 8);
    ctx.fillStyle = "#d40000";
    ctx.fillRect(boss.x + 1, boss.y - 11, Math.max(2, ((boss.w - 2) * boss.hp) / boss.maxHp), 6);
  }

  explosions.forEach((particle) => {
    ctx.globalAlpha = particle.life / particle.maxLife;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  });
  ctx.globalAlpha = 1;

  powerups.forEach((powerup) => {
    let accent = "#d40000";
    if (powerup.type === "slow") {
      accent = "#0a8f3d";
    }

    const x = powerup.x;
    const y = powerup.y;
    const u = powerup.w;

    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, powerup.w, powerup.h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, powerup.w, powerup.h);
    ctx.fillStyle = accent;
    if (powerup.type === "rapid") {
      ctx.fillRect(x + 3, y + 3, 3, u - 6);
      ctx.fillRect(x + 6, y + 3, 5, 3);
      ctx.fillRect(x + 6, y + 7, 4, 2);
      ctx.fillRect(x + 9, y + 9, 4, 4);
    } else {
      ctx.fillRect(x + 3, y + 3, 10, 2);
      ctx.fillRect(x + 3, y + 5, 2, 3);
      ctx.fillRect(x + 5, y + 7, 6, 2);
      ctx.fillRect(x + 11, y + 9, 2, 3);
      ctx.fillRect(x + 3, y + 12, 10, 2);
    }
  });

  comboPopups.forEach((popup) => {
    ctx.globalAlpha = popup.life / popup.maxLife;
    ctx.fillStyle = "#d40000";
    ctx.font = "12px 'Press Start 2P'";
    const label = `x${popup.value}`;
    const width = ctx.measureText(label).width;
    ctx.fillText(label, popup.x - width * 0.5, popup.y);
    ctx.globalAlpha = 1;
  });

  ctx.fillStyle = "#000";
  const showShip = respawnInvuln <= 0 || Math.floor(respawnInvuln / 4) % 2 === 0;
  if (showShip) {
    ctx.fillRect(player.x, player.y + 4, player.w, player.h - 4);
    ctx.fillRect(player.x + 17, player.y, 12, 5);
  }

  ctx.fillStyle = "#d40000";
  bullets.forEach((bullet) => {
    ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
  });

  ctx.fillStyle = "#000";
  enemyBullets.forEach((bullet) => {
    ctx.fillRect(bullet.x, bullet.y, bullet.w, bullet.h);
  });
}

function tick() {
  update();
  draw();
  requestAnimationFrame(tick);
}

document.addEventListener("keydown", (event) => {
  hideMobileHint();
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") {
    keys.left = true;
  }
  if (key === "arrowright" || key === "d") {
    keys.right = true;
  }
  if (key === " " || key === "spacebar") {
    keys.shoot = true;
    event.preventDefault();
  }
});

document.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") {
    keys.left = false;
  }
  if (key === "arrowright" || key === "d") {
    keys.right = false;
  }
  if (key === " " || key === "spacebar") {
    keys.shoot = false;
  }
});

canvas.addEventListener("pointerdown", (event) => {
  hideMobileHint();
  if (event.pointerType === "touch") {
    touchPointerId = event.pointerId;
    player.x = event.clientX - player.w / 2;
    canvas.setPointerCapture(event.pointerId);
  }
  keys.shoot = true;
});

canvas.addEventListener("pointermove", (event) => {
  if (event.pointerType === "touch" && touchPointerId === event.pointerId) {
    player.x = event.clientX - player.w / 2;
  }
});

canvas.addEventListener("pointerup", (event) => {
  if (touchPointerId === event.pointerId) {
    touchPointerId = null;
  }
  keys.shoot = false;
});

canvas.addEventListener("pointercancel", (event) => {
  if (touchPointerId === event.pointerId) {
    touchPointerId = null;
  }
  keys.shoot = false;
});

function handleOrientation(event) {
  if (typeof event.gamma === "number") {
    tilt.gamma = event.gamma;
  }
}

function enableTiltControl() {
  const Orientation = window.DeviceOrientationEvent;
  if (!Orientation) {
    return;
  }

  if (typeof Orientation.requestPermission === "function") {
    Orientation.requestPermission()
      .then((state) => {
        if (state === "granted") {
          tilt.enabled = true;
          hideMobileHint();
        }
      })
      .catch(() => {});
  } else {
    tilt.enabled = true;
    hideMobileHint();
  }
}

window.addEventListener("resize", resize);
window.addEventListener("deviceorientation", handleOrientation, true);
document.addEventListener("touchstart", enableTiltControl, { once: true, passive: true });
document.addEventListener("click", enableTiltControl, { once: true });
playAgainEl.addEventListener("click", resetRun);
scoreFormEl.addEventListener("submit", handleScoreSubmit);

resize();
initMobileHint();
requestAnimationFrame(tick);
