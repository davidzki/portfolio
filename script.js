const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoresListEl = document.getElementById("scores-list");
const unlockPanelEl = document.getElementById("unlock-panel");
const playAgainEl = document.getElementById("play-again");
const mobileHintEl = document.getElementById("mobile-hint");
const resultLineEl = document.getElementById("result-line");
const rankLineEl = document.getElementById("rank-line");

const SUPABASE_URL = "https://jntwuuukbagxaoobvmni.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpudHd1dXVrYmFneGFvb2J2bW5pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODI1NjUsImV4cCI6MjA4OTk1ODU2NX0.6GFot144kvxzBuAIk8kIsdzf-EA9-MwF0DUQ-Kxr33A";

const player = { x: 0, y: 0, w: 46, h: 12, speed: 6, cooldown: 0 };
const keys = { left: false, right: false, shoot: false };
const tilt = { enabled: false, gamma: 0 };

const bullets = [];
const enemyBullets = [];
let pixels = [];
let touchPointerId = null;
let hintHidden = false;
let unlocked = false;
let submittedForRun = false;

let score = 0;
let shotsFired = 0;
let startedAt = 0;
let totalPixelCount = 0;

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
  return cleaned ? cleaned.slice(0, 24) : "anon";
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
    li.textContent = `${row.name} - ${row.score}`;
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

async function handleWin() {
  if (submittedForRun) {
    return;
  }
  submittedForRun = true;

  const elapsedMs = Math.max(1, performance.now() - startedAt);
  const accuracy = Math.max(0, totalPixelCount * 4 - shotsFired);
  const finalScore = Math.max(1, Math.round(score + accuracy + 60000 / elapsedMs));

  const name = normalizeName(window.prompt(`You won! Enter name for score (${finalScore})`, "anon"));
  await submitScore(name, finalScore);
  const rows = await fetchTopScores();

  const rank = rows.findIndex((row) => row.name === name && row.score === finalScore);
  resultLineEl.textContent = `final score: ${finalScore}`;
  rankLineEl.textContent = rank >= 0 ? `rank: #${rank + 1}` : "rank: outside top 10";
  unlockPanelEl.classList.remove("hidden");
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

function resetRun() {
  unlocked = false;
  submittedForRun = false;
  score = 0;
  shotsFired = 0;
  startedAt = performance.now();

  unlockPanelEl.classList.add("hidden");
  resultLineEl.textContent = "";
  rankLineEl.textContent = "";

  buildWord();
  bullets.length = 0;
  enemyBullets.length = 0;
  swarm.dir = 1;
  swarm.shootTick = 0;

  player.x = canvas.width * 0.5 - player.w * 0.5;
  player.y = canvas.height - 42;
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  resetRun();
}

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function update() {
  if (keys.left) {
    player.x -= player.speed;
  }
  if (keys.right) {
    player.x += player.speed;
  }
  if (tilt.enabled) {
    const clamped = Math.max(-32, Math.min(32, tilt.gamma));
    if (Math.abs(clamped) > 2.5) {
      player.x += (clamped / 32) * player.speed * 1.9;
    }
  }
  player.x = Math.max(8, Math.min(canvas.width - player.w - 8, player.x));

  if (player.cooldown > 0) {
    player.cooldown -= 1;
  }
  if (keys.shoot && player.cooldown <= 0) {
    bullets.push({ x: player.x + player.w * 0.5 - 2, y: player.y - 8, w: 4, h: 10, vy: -9 });
    player.cooldown = 8;
    shotsFired += 1;
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.y += bullet.vy;
    if (bullet.y < -16) {
      bullets.splice(i, 1);
      continue;
    }

    for (let j = 0; j < pixels.length; j += 1) {
      const pixel = pixels[j];
      if (!pixel.alive) {
        continue;
      }
      if (aabb(bullet, { x: pixel.x, y: pixel.y, w: pixel.s, h: pixel.s })) {
        pixel.alive = false;
        bullets.splice(i, 1);
        score += 10;
        break;
      }
    }
  }

  const alivePixels = pixels.filter((pixel) => pixel.alive);
  if (!unlocked && alivePixels.length > 0) {
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
      resetRun();
      return;
    }

    swarm.shootTick += 1;
    if (swarm.shootTick >= swarm.shootRate) {
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
        enemyBullets.push({ x: shooter.x + shooter.s * 0.5 - 2, y: shooter.y + shooter.s, w: 4, h: 10, vy: 4.2 });
      }
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
      resetRun();
      return;
    }
  }

  if (!unlocked && pixels.length > 0 && pixels.every((pixel) => !pixel.alive)) {
    unlocked = true;
    enemyBullets.length = 0;
    handleWin();
  }
}

function draw() {
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#000";
  ctx.font = "14px 'Press Start 2P'";
  ctx.fillText(`score ${score}`, 12, 26);

  pixels.forEach((pixel) => {
    if (pixel.alive) {
      ctx.fillRect(pixel.x, pixel.y, pixel.s, pixel.s);
    }
  });

  ctx.fillRect(player.x, player.y + 4, player.w, player.h - 4);
  ctx.fillRect(player.x + 17, player.y, 12, 5);

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

resize();
initMobileHint();
requestAnimationFrame(tick);
