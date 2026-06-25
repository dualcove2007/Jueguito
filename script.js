// ============================================================
//  NEON RUNNER - Cyberpunk Platformer
//  Canvas 2D | JavaScript Vanilla | Sin librerías externas
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ---------- Dimensiones del juego ----------
const GAME_W = 960;
const GAME_H = 540;
const GROUND_Y = 448;
const TILE = 40;

canvas.width = GAME_W;
canvas.height = GAME_H;

// ---------- Sistema de sonido ----------
let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(freq, type, duration, volume, ramp, detune) {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (detune) osc.detune.setValueAtTime(detune, t);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(ramp || 0.001, t + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + duration);
}

function sfxJump() {
    playSound(180, 'square', 0.12, 0.09, 0.01, null);
    setTimeout(() => playSound(300, 'square', 0.08, 0.06, 0.01, null), 40);
}

function sfxShoot() {
    playSound(600, 'sawtooth', 0.08, 0.06, 0.01, -200);
    setTimeout(() => playSound(800, 'sawtooth', 0.06, 0.04, 0.01, null), 30);
}

function sfxEnemyDie() {
    playSound(120, 'square', 0.15, 0.07, 0.01, null);
    setTimeout(() => playSound(80, 'sawtooth', 0.2, 0.05, 0.01, null), 50);
}

function sfxHit() {
    playSound(60, 'sawtooth', 0.2, 0.1, 0.01, null);
    playSound(50, 'square', 0.25, 0.08, 0.01, null);
}

function sfxPickup() {
    playSound(500, 'square', 0.06, 0.05, 0.01, null);
    setTimeout(() => playSound(700, 'square', 0.06, 0.05, 0.01, null), 40);
    setTimeout(() => playSound(900, 'square', 0.08, 0.06, 0.01, null), 80);
}

function sfxPowerUp() {
    for (let i = 0; i < 5; i++) {
        setTimeout(() => playSound(300 + i * 150, 'square', 0.1, 0.06, 0.01, null), i * 60);
    }
}

function sfxPause() {
    playSound(200, 'triangle', 0.1, 0.06, 0.01, null);
    setTimeout(() => playSound(150, 'triangle', 0.15, 0.05, 0.01, null), 80);
}

function sfxVictory() {
    const notes = [400, 500, 600, 700, 800, 900, 1000, 1200];
    for (let i = 0; i < notes.length; i++) {
        setTimeout(() => playSound(notes[i], 'square', 0.15, 0.06, 0.01, null), i * 80);
    }
}

function sfxGameOver() {
    playSound(200, 'sawtooth', 0.3, 0.08, 0.01, null);
    setTimeout(() => playSound(150, 'sawtooth', 0.4, 0.07, 0.01, null), 200);
    setTimeout(() => playSound(100, 'sawtooth', 0.5, 0.06, 0.01, null), 400);
}

function sfxDeathSad() {
    playSound(400, 'triangle', 0.3, 0.07, 0.005, null);
    setTimeout(() => playSound(350, 'triangle', 0.3, 0.06, 0.005, null), 150);
    setTimeout(() => playSound(280, 'triangle', 0.4, 0.06, 0.005, null), 300);
    setTimeout(() => playSound(200, 'triangle', 0.5, 0.05, 0.005, null), 450);
}

function resizeCanvas() {
    const scale = Math.min(
        window.innerWidth / GAME_W,
        window.innerHeight / GAME_H
    );
    canvas.style.width = (GAME_W * scale) + 'px';
    canvas.style.height = (GAME_H * scale) + 'px';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ---------- Estados del juego ----------
const STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover', VICTORY: 'victory' };
let gameState = STATE.MENU;
let paused = false;
let menuAlpha = 0;
let menuSelected = 0;
let instructionsShown = false;

// ---------- Entrada ----------
const keys = {};
window.addEventListener('keydown', e => {
    initAudio();
    keys[e.code] = true;
    e.preventDefault();
});
window.addEventListener('keyup', e => {
    keys[e.code] = false;
    e.preventDefault();
});

// ---------- Cámara ----------
let camera = { x: 0, y: 0, targetX: 0, targetY: 0 };

// ---------- Temporizador / Puntaje / Vidas ----------
let gameTime = 300;
let timerAccum = 0;
let score = 0;
let invincibleTimer = 0;

// ---------- Partículas ----------
let particles = [];

function spawnParticles(x, y, count, color, speed) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const spd = speed * (0.5 + Math.random());
        particles.push({
            x, y,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd - 2,
            life: 1,
            decay: 0.02 + Math.random() * 0.04,
            size: 2 + Math.random() * 4,
            color
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1;
        p.life -= p.decay;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles(ctx, cam) {
    for (const p of particles) {
        const sx = p.x - cam.x;
        const sy = p.y - cam.y;
        if (sx < -20 || sx > GAME_W + 20 || sy < -20 || sy > GAME_H + 20) continue;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
}

// ---------- Fondo con parallax ----------
let bgStars = [];
let bgBuildingsFar = [];
let bgBuildingsNear = [];
let bgRain = [];
let bgNeonSigns = [];

function initBackground() {
    bgStars = [];
    for (let i = 0; i < 200; i++) {
        bgStars.push({
            x: Math.random() * GAME_W * 8,
            y: Math.random() * GAME_H * 0.6,
            size: Math.random() * 2 + 0.5,
            twinkle: Math.random() * Math.PI * 2,
            speed: 0.01 + Math.random() * 0.03
        });
    }

    function seededRandom(seed) {
        const x = Math.sin(seed * 9301 + 49297) * 49297;
        return x - Math.floor(x);
    }

    bgBuildingsFar = [];
    for (let i = 0; i < 40; i++) {
        const b = {
            x: i * 180 + seededRandom(i * 3) * 60,
            w: 60 + seededRandom(i * 7 + 1) * 140,
            h: 100 + seededRandom(i * 11 + 2) * 260,
            winCount: Math.floor(seededRandom(i * 13 + 3) * 20) + 5,
            winData: []
        };
        for (let j = 0; j < b.winCount; j++) {
            const col = j % Math.max(1, Math.floor(b.w / 12));
            const row = Math.floor(j / Math.max(1, Math.floor(b.w / 12)));
            b.winData.push({
                rx: 8 + col * 14,
                ry: 20 + row * 25,
                lit: seededRandom(i * 100 + j) > 0.4
            });
        }
        bgBuildingsFar.push(b);
    }

    bgBuildingsNear = [];
    for (let i = 0; i < 25; i++) {
        const b = {
            x: i * 300 + seededRandom(i * 5 + 10) * 80,
            w: 80 + seededRandom(i * 8 + 11) * 180,
            h: 180 + seededRandom(i * 9 + 12) * 300,
            winCount: Math.floor(seededRandom(i * 14 + 13) * 15) + 3,
            winData: [],
            signColor: ['#ff00ff', '#00ffff', '#ffff00', '#ff6600'][Math.floor(seededRandom(i * 17) * 4)],
            signY: seededRandom(i * 19) * 0.3 + 0.2
        };
        for (let j = 0; j < b.winCount; j++) {
            const col = j % Math.max(1, Math.floor(b.w / 10));
            const row = Math.floor(j / Math.max(1, Math.floor(b.w / 10)));
            b.winData.push({
                rx: 6 + col * 12,
                ry: 15 + row * 22,
                lit: seededRandom(i * 100 + j + 50) > 0.3
            });
        }
        bgBuildingsNear.push(b);
    }

    bgRain = [];
    for (let i = 0; i < 120; i++) {
        bgRain.push({
            x: Math.random() * GAME_W * 4,
            y: Math.random() * GAME_H,
            speed: 4 + Math.random() * 8,
            len: 8 + Math.random() * 20,
            alpha: 0.05 + Math.random() * 0.15
        });
    }

    bgNeonSigns = [];
    for (let i = 0; i < 15; i++) {
        bgNeonSigns.push({
            x: i * 500 + Math.random() * 200,
            y: GAME_H * 0.3 + Math.random() * GAME_H * 0.4,
            w: 30 + Math.random() * 60,
            h: 10 + Math.random() * 20,
            color: ['#ff00ff', '#00ffff', '#ffff00', '#ff3366', '#00ff88'][Math.floor(Math.random() * 5)]
        });
    }
}

function drawBackground(ctx, cam) {
    // Gradiente del cielo
    const skyGrad = ctx.createLinearGradient(0, 0, 0, GAME_H);
    skyGrad.addColorStop(0, '#05051a');
    skyGrad.addColorStop(0.4, '#0a0a2e');
    skyGrad.addColorStop(0.7, '#0f1035');
    skyGrad.addColorStop(1, '#151540');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Capa 3: Estrellas (parallax 0.05)
    for (const s of bgStars) {
        const sx = (s.x - cam.x * 0.05) % (GAME_W * 8);
        if (sx < -5 || sx > GAME_W + 5) continue;
        s.twinkle += s.speed;
        const alpha = 0.3 + Math.sin(s.twinkle) * 0.4 + 0.4;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx, s.y, s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // Capa 2: Edificios lejanos (parallax 0.15)
    for (const b of bgBuildingsFar) {
        const bx = (b.x - cam.x * 0.15) % (GAME_W * 9);
        if (bx < -200 || bx > GAME_W + 200) continue;
        const by = GAME_H - b.h;
        ctx.fillStyle = '#0a0a20';
        ctx.fillRect(bx, by, b.w, b.h);
        ctx.strokeStyle = '#1a1a40';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, b.w, b.h);
        // Ventanas
        for (const wd of b.winData) {
            const wx = bx + wd.rx;
            const wy = by + wd.ry;
            if (wy > by + b.h - 10) continue;
            ctx.fillStyle = wd.lit ? '#ffdd44' : '#44aaff';
            ctx.globalAlpha = wd.lit ? 0.5 : 0.3;
            ctx.fillRect(wx, wy, 8, 10);
        }
        ctx.globalAlpha = 1;
    }

    // Capa 1: Edificios cercanos (parallax 0.35)
    for (const b of bgBuildingsNear) {
        const bx = (b.x - cam.x * 0.35) % (GAME_W * 9);
        if (bx < -200 || bx > GAME_W + 200) continue;
        const by = GAME_H - b.h;
        const grad = ctx.createLinearGradient(bx, by, bx, GAME_H);
        grad.addColorStop(0, '#0d0d28');
        grad.addColorStop(1, '#151535');
        ctx.fillStyle = grad;
        ctx.fillRect(bx, by, b.w, b.h);
        ctx.strokeStyle = b.signColor;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.strokeRect(bx, by, b.w, b.h);
        // Ventanas
        for (const wd of b.winData) {
            const wx = bx + wd.rx;
            const wy = by + wd.ry;
            if (wy > by + b.h - 8) continue;
            ctx.fillStyle = wd.lit ? b.signColor : '#0a0a18';
            ctx.globalAlpha = wd.lit ? 0.5 : 0.8;
            ctx.fillRect(wx, wy, 6, 8);
        }
        // Letrero de neón
        const sx = bx + b.w / 2 - b.w * 0.2;
        const sy = by + b.h * b.signY;
        ctx.globalAlpha = 0.6 + Math.sin(Date.now() * 0.003 + bx) * 0.3;
        ctx.fillStyle = b.signColor;
        ctx.shadowColor = b.signColor;
        ctx.shadowBlur = 12;
        ctx.fillRect(sx, sy, b.w * 0.4, 8);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    // Lluvia (parallax 0.4)
    for (const r of bgRain) {
        const rx = ((r.x - cam.x * 0.4) % (GAME_W * 4) + GAME_W * 4) % (GAME_W * 4);
        const ry = r.y;
        if (rx < -10 || rx > GAME_W + 10) continue;
        ctx.strokeStyle = '#aaddff';
        ctx.globalAlpha = r.alpha;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 2, ry + r.len);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

// ---------- Datos del nivel ----------
// Suelo: lista de segmentos {startX, endX}
let groundSegments = [];
// Plataformas: {x, y, w, h}
let platforms = [];
// Conductos de datos (reemplazan tuberías): {x, w, h}
let dataConduits = [];
// Enemigos: {x, y, type, ...}
let spawnEnemies = [];
// Fragmentos de datos (coleccionables): {x, y}
let spawnShards = [];
// Power-ups: {x, y}
let spawnPowerUps = [];
// Meta
let goalX = 0;

function buildLevel() {
    groundSegments = [];
    platforms = [];
    dataConduits = [];
    spawnEnemies = [];
    spawnShards = [];
    spawnPowerUps = [];
    goalX = 0;

    // Suelo: segmentos continuos con huecos
    const groundData = [
        { s: 0, e: 1040 },
        { s: 1160, e: 1800 },
        { s: 1920, e: 2480 },
        { s: 2600, e: 3160 },
        { s: 3280, e: 4000 },
        { s: 4120, e: 4800 },
        { s: 4920, e: 5560 },
        { s: 5680, e: 6280 },
        { s: 6400, e: 6960 },
        { s: 7080, e: 7200 }
    ];
    for (const g of groundData) {
        groundSegments.push({ startX: g.s, endX: g.e });
    }

    // Plataformas flotantes
    const platData = [
        // Sección 1: inicio suave
        { x: 280, y: 360, w: 120, h: 20 },
        { x: 500, y: 300, w: 140, h: 20 },
        { x: 720, y: 360, w: 100, h: 20 },
        { x: 880, y: 280, w: 120, h: 20 },
        // Sección 2: después del primer hueco
        { x: 1240, y: 360, w: 160, h: 20 },
        { x: 1480, y: 300, w: 120, h: 20 },
        { x: 1680, y: 360, w: 100, h: 20 },
        // Sección 3: zona de plataformas
        { x: 2000, y: 320, w: 160, h: 20 },
        { x: 2240, y: 260, w: 100, h: 20 },
        { x: 2400, y: 360, w: 120, h: 20 },
        // Sección 4
        { x: 2720, y: 340, w: 140, h: 20 },
        { x: 2960, y: 280, w: 120, h: 20 },
        { x: 3120, y: 360, w: 100, h: 20 },
        // Sección 5: zona compleja
        { x: 3400, y: 320, w: 160, h: 20 },
        { x: 3640, y: 250, w: 120, h: 20 },
        { x: 3840, y: 340, w: 140, h: 20 },
        // Sección 6: power-up
        { x: 4240, y: 340, w: 140, h: 20 },
        { x: 4480, y: 260, w: 100, h: 20 },
        { x: 4640, y: 360, w: 120, h: 20 },
        // Sección 7
        { x: 5040, y: 320, w: 160, h: 20 },
        { x: 5280, y: 250, w: 120, h: 20 },
        { x: 5440, y: 350, w: 100, h: 20 },
        // Sección 8: final
        { x: 5800, y: 340, w: 160, h: 20 },
        { x: 6040, y: 270, w: 120, h: 20 },
        { x: 6200, y: 360, w: 100, h: 20 },
        // Sección 9: aproximación a meta
        { x: 6520, y: 340, w: 160, h: 20 },
        { x: 6760, y: 280, w: 120, h: 20 },
        { x: 6920, y: 360, w: 100, h: 20 }
    ];
    for (const p of platData) {
        platforms.push({ x: p.x, y: p.y, w: p.w, h: p.h });
    }

    // Conductos de datos (tuberías cyberpunk)
    const conduitData = [
        { x: 440, w: 50, h: 80 },
        { x: 1060, w: 50, h: 120 },
        { x: 1360, w: 50, h: 90 },
        { x: 1940, w: 60, h: 140 },
        { x: 2520, w: 50, h: 100 },
        { x: 3200, w: 60, h: 130 },
        { x: 4040, w: 50, h: 110 },
        { x: 4840, w: 60, h: 140 },
        { x: 5600, w: 50, h: 100 },
        { x: 6320, w: 60, h: 120 },
        { x: 7000, w: 50, h: 100 }
    ];
    for (const c of conduitData) {
        dataConduits.push({ x: c.x, w: c.w, h: c.h, topY: GROUND_Y - c.h });
    }

    // Enemigos tipo "Glitch Drone" (patrulla, camina y gira en bordes)
    const droneSpawns = [
        { x: 350, y: GROUND_Y },
        { x: 700, y: GROUND_Y },
        { x: 1100, y: GROUND_Y },
        { x: 1400, y: GROUND_Y },
        { x: 1700, y: GROUND_Y },
        { x: 2050, y: GROUND_Y },
        { x: 2350, y: GROUND_Y },
        { x: 2750, y: GROUND_Y },
        { x: 3050, y: GROUND_Y },
        { x: 3450, y: GROUND_Y },
        { x: 3750, y: GROUND_Y },
        { x: 4300, y: GROUND_Y },
        { x: 4600, y: GROUND_Y },
        { x: 5100, y: GROUND_Y },
        { x: 5400, y: GROUND_Y },
        { x: 5900, y: GROUND_Y },
        { x: 6150, y: GROUND_Y },
        { x: 6550, y: GROUND_Y },
        { x: 6850, y: GROUND_Y }
    ];
    for (const d of droneSpawns) {
        spawnEnemies.push({ x: d.x, y: d.y, type: 'drone' });
    }

    // Enemigos tipo "Pulse Turret" (estacionario, dispara proyectiles)
    const turretSpawns = [
        { x: 880, y: GROUND_Y },
        { x: 1680, y: GROUND_Y },
        { x: 2400, y: GROUND_Y },
        { x: 3120, y: GROUND_Y },
        { x: 3840, y: GROUND_Y },
        { x: 4640, y: GROUND_Y },
        { x: 5440, y: GROUND_Y },
        { x: 6200, y: GROUND_Y }
    ];
    for (const t of turretSpawns) {
        spawnEnemies.push({ x: t.x, y: t.y, type: 'turret' });
    }

    // Fragmentos de datos (coleccionables)
    function addShardArc(cx, cy, count, spread) {
        for (let i = 0; i < count; i++) {
            const angle = Math.PI - (i / (count - 1)) * Math.PI;
            const sx = cx + Math.cos(angle) * spread;
            const sy = cy - Math.sin(angle) * spread * 1.5;
            spawnShards.push({ x: sx, y: sy });
        }
    }
    function addShardLine(sx, sy, count, step) {
        for (let i = 0; i < count; i++) {
            spawnShards.push({ x: sx + i * step, y: sy });
        }
    }

    addShardArc(130, GROUND_Y - 60, 5, 80);
    addShardArc(400, GROUND_Y - 80, 4, 60);
    addShardLine(600, 360, 4, 35);
    addShardArc(1000, GROUND_Y - 70, 5, 70);
    addShardLine(1280, 360, 3, 50);
    addShardArc(1600, GROUND_Y - 80, 4, 65);
    addShardArc(2100, GROUND_Y - 90, 5, 80);
    addShardLine(2280, 260, 3, 40);
    addShardArc(2800, GROUND_Y - 70, 4, 60);
    addShardLine(3000, 280, 3, 40);
    addShardArc(3500, GROUND_Y - 85, 5, 75);
    addShardLine(3680, 250, 3, 35);
    addShardArc(4200, GROUND_Y - 75, 4, 60);
    addShardLine(4520, 260, 2, 40);
    addShardArc(5000, GROUND_Y - 80, 5, 70);
    addShardLine(5320, 250, 3, 40);
    addShardArc(5900, GROUND_Y - 85, 4, 65);
    addShardLine(6080, 270, 3, 35);
    addShardArc(6600, GROUND_Y - 75, 5, 70);
    addShardLine(6800, 280, 2, 40);
    addShardArc(6950, GROUND_Y - 60, 3, 50);

    // Power-up: Overclock Module
    spawnPowerUps.push({ x: 4500, y: 220 });

    // Meta
    goalX = 7120;
}

// ---------- Rejilla de neón del suelo ----------
function drawGroundGrid(ctx, cam) {
    const gridY = GROUND_Y;
    for (const seg of groundSegments) {
        const sx = seg.startX - cam.x;
        const ex = seg.endX - cam.x;
        const sy = gridY - cam.y;
        if (ex < 0 || sx > GAME_W) continue;

        // Base metálica oscura
        const grad = ctx.createLinearGradient(0, sy, 0, sy + GAME_H - sy);
        grad.addColorStop(0, '#1a1a35');
        grad.addColorStop(0.3, '#151530');
        grad.addColorStop(1, '#0a0a20');
        ctx.fillStyle = grad;
        ctx.fillRect(Math.max(0, sx), sy, Math.min(GAME_W, ex) - Math.max(0, sx), GAME_H - sy);

        // Borde superior brillante
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(Math.max(0, sx), sy);
        ctx.lineTo(Math.min(GAME_W, ex), sy);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Rejilla de neón
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.08)';
        ctx.lineWidth = 0.5;
        const startGridX = Math.floor(Math.max(0, sx) / TILE) * TILE;
        const endGridX = Math.min(GAME_W, ex);
        for (let gx = startGridX; gx < endGridX; gx += TILE) {
            ctx.beginPath();
            ctx.moveTo(gx, sy);
            ctx.lineTo(gx, GAME_H);
            ctx.stroke();
        }
        for (let gy = sy + TILE; gy < GAME_H; gy += TILE) {
            ctx.beginPath();
            ctx.moveTo(Math.max(0, sx), gy);
            ctx.lineTo(Math.min(GAME_W, ex), gy);
            ctx.stroke();
        }
    }
}

// ---------- Plataformas flotantes ----------
function drawPlatform(ctx, p, cam) {
    const sx = p.x - cam.x;
    const sy = p.y - cam.y;
    if (sx + p.w < 0 || sx > GAME_W || sy + p.h < 0 || sy > GAME_H) return;

    // Sombra de neón debajo
    ctx.fillStyle = 'rgba(0, 255, 255, 0.08)';
    ctx.fillRect(sx - 3, sy - 3, p.w + 6, p.h + 6);

    // Cuerpo de la plataforma
    const grad = ctx.createLinearGradient(0, sy, 0, sy + p.h);
    grad.addColorStop(0, '#2a2a50');
    grad.addColorStop(1, '#1a1a35');
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, p.w, p.h);

    // Borde superior brillante
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + p.w, sy);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Bordes laterales
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, p.w, p.h);

    // Líneas de circuito en la plataforma
    ctx.strokeStyle = 'rgba(0, 200, 255, 0.15)';
    ctx.lineWidth = 0.5;
    const midY = sy + p.h / 2;
    ctx.beginPath();
    ctx.moveTo(sx + 8, midY);
    ctx.lineTo(sx + p.w - 8, midY);
    ctx.stroke();
}

// ---------- Conductos de datos ----------
function drawDataConduit(ctx, c, cam) {
    const sx = c.x - cam.x;
    const sy = c.topY - cam.y;
    if (sx + c.w < 0 || sx > GAME_W || sy + c.h < 0 || sy > GAME_H) return;

    // Sombra
    ctx.fillStyle = 'rgba(0, 255, 255, 0.05)';
    ctx.fillRect(sx - 4, sy - 4, c.w + 8, c.h + 8);

    // Cuerpo del conducto
    const grad = ctx.createLinearGradient(sx, 0, sx + c.w, 0);
    grad.addColorStop(0, '#1a1a40');
    grad.addColorStop(0.5, '#252555');
    grad.addColorStop(1, '#1a1a40');
    ctx.fillStyle = grad;
    ctx.fillRect(sx, sy, c.w, c.h);

    // Bordes de neón
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 10;
    ctx.strokeRect(sx, sy, c.w, c.h);
    ctx.shadowBlur = 0;

    // Borde superior (donde se puede pisar)
    ctx.strokeStyle = '#ff00ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + c.w, sy);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Flujo de datos animado
    const t = Date.now() * 0.002;
    ctx.fillStyle = '#ff00ff';
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < 4; i++) {
        const dotY = sy + ((t * 30 + i * c.h / 4) % c.h);
        ctx.beginPath();
        ctx.arc(sx + c.w / 2, dotY, 3, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;
}

// ---------- Jugador: NEON ----------
const player = {
    x: 80, y: GROUND_Y - 44,
    w: 30, h: 44,
    vx: 0, vy: 0,
    speed: 4.5,
    jumpForce: -12,
    jumpHoldForce: -1.3,
    jumpHoldFrames: 0,
    maxJumpHoldFrames: 6,
    maxFallSpeed: 14,
    gravity: 0.65,
    onGround: false,
    facing: 1, // 1 = derecha, -1 = izquierda
    isJumping: false,
    jumpHeld: false,
    isPowered: false,
    canDoubleJump: false,
    hasDoubleJumped: false,
    animFrame: 0,
    animTimer: 0,
    animSpeed: 0.12,
    shootCooldown: 0,
    ignorePlatformsTimer: 0,
    deathTimer: 0
};

function resetPlayer() {
    player.x = 80;
    player.y = GROUND_Y - player.h;
    player.vx = 0;
    player.vy = 0;
    player.onGround = false;
    player.facing = 1;
    player.isJumping = false;
    player.jumpHeld = false;
    player.jumpHoldFrames = 0;
    player.isPowered = false;
    player.canDoubleJump = false;
    player.hasDoubleJumped = false;
    player.animFrame = 0;
    player.animTimer = 0;
    player.shootCooldown = 0;
    player.ignorePlatformsTimer = 0;
    player.deathTimer = 0;
    player.w = 30;
    player.h = 44;
}

function playerJump() {
    if (player.onGround) {
        player.vy = player.jumpForce;
        player.onGround = false;
        player.isJumping = true;
        player.jumpHeld = true;
        player.hasDoubleJumped = false;
        player.jumpHoldFrames = 0;
        sfxJump();
    } else if (player.canDoubleJump && !player.hasDoubleJumped) {
        player.vy = player.jumpForce * 0.85;
        player.hasDoubleJumped = true;
        player.isJumping = true;
        player.jumpHeld = true;
        player.jumpHoldFrames = 0;
        spawnParticles(player.x + player.w / 2, player.y + player.h, 8, '#00ffff', 3);
        sfxJump();
    }
}

function updatePlayer() {
    // Animacion de muerte
    if (player.deathTimer > 0) {
        player.deathTimer--;
        player.vy += player.gravity;
        player.y += player.vy;
        spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 1, '#ff3366', 2);
        if (player.deathTimer <= 0) {
            startGame();
        }
        return;
    }

    // Movimiento horizontal
    let moveX = 0;
    if (keys['ArrowLeft'] || keys['KeyA']) moveX = -1;
    if (keys['ArrowRight'] || keys['KeyD']) moveX = 1;

    if (moveX !== 0) {
        player.vx += moveX * 0.5;
        player.facing = moveX;
        player.animTimer += player.animSpeed;
        if (player.animTimer >= 1) {
            player.animTimer = 0;
            player.animFrame = (player.animFrame + 1) % 4;
        }
    } else {
        player.vx *= 0.8;
        if (Math.abs(player.vx) < 0.1) player.vx = 0;
        player.animFrame = 0;
        player.animTimer = 0;
    }

    player.vx = Math.max(-player.speed, Math.min(player.speed, player.vx));

    // Disparo
    if (player.shootCooldown > 0) player.shootCooldown--;
    if (keys['Space'] && player.shootCooldown <= 0) {
        const bx = player.x + player.w / 2 + player.facing * (player.w / 2 + 4);
        const by = player.y + player.h * 0.35;
        playerBullets.push(new PlayerBullet(bx, by, player.facing * 8));
        player.shootCooldown = 12;
        sfxShoot();
        spawnParticles(bx, by + player.facing * 2, 2, '#00ffff', 2);
    }

    // Salto
    const jumpKey = keys['ArrowUp'] || keys['KeyW'];
    if (jumpKey) {
        if (!player.isJumping) {
            playerJump();
        } else if (player.jumpHeld && player.vy < -2 && player.jumpHoldFrames < player.maxJumpHoldFrames) {
            player.vy += player.jumpHoldForce;
            player.jumpHoldFrames++;
        }
    } else {
        player.jumpHeld = false;
        if (player.vy < -3) {
            player.vy = -3; // Soltar salto: cortar altura
        }
    }
    if (!jumpKey) {
        player.isJumping = false;
    }

    // Gravedad
    player.vy += player.gravity;
    if (player.vy > player.maxFallSpeed) player.vy = player.maxFallSpeed;

    // Movimiento
    player.x += player.vx;
    player.y += player.vy;

    // Límite izquierdo
    if (player.x < 0) player.x = 0;

    // Caer en hueco
    if (player.y > GAME_H + 100) {
        playerDie();
        return;
    }

    // Bajar de plataformas
    if (player.ignorePlatformsTimer > 0) player.ignorePlatformsTimer--;
    const pressDown = keys['ArrowDown'] || keys['KeyS'];
    if (pressDown && player.onGround) {
        let standingOnPlatform = false;
        for (const p of platforms) {
            if (player.x + player.w > p.x && player.x < p.x + p.w &&
                player.y + player.h >= p.y - 2 && player.y + player.h <= p.y + p.h + 5) {
                standingOnPlatform = true;
                break;
            }
        }
        if (standingOnPlatform) {
            player.y += 8;
            player.onGround = false;
            player.isJumping = false;
            player.jumpHeld = false;
            player.ignorePlatformsTimer = 10;
        }
    }

    // Colisión con suelo
    player.onGround = false;
    for (const seg of groundSegments) {
        if (player.x + player.w > seg.startX && player.x < seg.endX) {
            if (player.vy >= 0 && player.y + player.h >= GROUND_Y && player.y + player.h - player.vy <= GROUND_Y + 10) {
                player.y = GROUND_Y - player.h;
                player.vy = 0;
                player.onGround = true;
                player.isJumping = false;
                player.jumpHeld = false;
                player.jumpHoldFrames = 0;
                player.hasDoubleJumped = false;
            }
        }
    }

    // Colisión con plataformas
    if (player.ignorePlatformsTimer <= 0) {
    for (const p of platforms) {
        if (player.x + player.w > p.x && player.x < p.x + p.w) {
            if (player.vy >= 0 &&
                player.y + player.h >= p.y &&
                player.y + player.h - player.vy <= p.y + 10 &&
                player.y + player.h <= p.y + p.h + 5) {
                player.y = p.y - player.h;
                player.vy = 0;
                player.onGround = true;
                player.isJumping = false;
                player.jumpHeld = false;
                player.jumpHoldFrames = 0;
                player.hasDoubleJumped = false;
            }
        }
    }
    }

    // Colisión con conductos de datos (top)
    for (const c of dataConduits) {
        if (player.x + player.w > c.x && player.x < c.x + c.w) {
            if (player.vy >= 0 &&
                player.y + player.h >= c.topY &&
                player.y + player.h - player.vy <= c.topY + 10) {
                player.y = c.topY - player.h;
                player.vy = 0;
                player.onGround = true;
                player.isJumping = false;
                player.jumpHeld = false;
                player.jumpHoldFrames = 0;
                player.hasDoubleJumped = false;
            }
        }
    }

    // Invencibilidad temporal
    if (invincibleTimer > 0) invincibleTimer--;

    // Animación de idle
    if (player.onGround && player.vx === 0) {
        player.animTimer += 0.03;
    }
}

function playerDie() {
    if (invincibleTimer > 0 || player.deathTimer > 0) return;
    sfxDeathSad();
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 35, '#ff3366', 6);
    player.deathTimer = 90;
    player.vy = -6;
    player.vx = player.facing * -2;
}

function powerUpPlayer() {
    player.isPowered = true;
    player.canDoubleJump = true;
    player.w = 36;
    player.h = 54;
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 25, '#ffff00', 5);
}

function powerDownPlayer() {
    player.isPowered = false;
    player.canDoubleJump = false;
    player.w = 30;
    player.h = 44;
    invincibleTimer = 90;
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 15, '#ff6600', 4);
}

// ---------- Dibujar jugador ----------
function roundedRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}

function drawPlayer(ctx, cam) {
    if (invincibleTimer > 0 && Math.floor(invincibleTimer / 4) % 2 === 0) return;

    const sx = Math.round(player.x - cam.x);
    const sy = Math.round(player.y - cam.y);
    const w = player.w;
    const h = player.h;
    const f = player.facing;

    if (sx + w < -50 || sx > GAME_W + 50 || sy + h < -50 || sy > GAME_H + 50) return;

    ctx.save();
    ctx.translate(sx + w / 2, sy + h / 2);
    ctx.scale(f, 1);

    // Muerte: explosion y acostado
    const dying = player.deathTimer > 0;
    if (dying) {
        const deathProgress = 1 - player.deathTimer / 90;
        const deathAngle = deathProgress * (Math.PI / 2);
        ctx.rotate(deathAngle * f);

        // Explosion glow creciente
        const glowRadius = deathProgress * 30;
        const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
        glowGrad.addColorStop(0, 'rgba(255, 51, 102, 0.5)');
        glowGrad.addColorStop(0.7, 'rgba(255, 51, 102, 0.1)');
        glowGrad.addColorStop(1, 'rgba(255, 51, 102, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1 - deathProgress * 0.8;
    }

    const bodyColor = player.isPowered ? '#2a2a55' : '#1a1a3a';
    const neonColor = player.isPowered ? '#00ffff' : '#00ccff';
    const accentColor = player.isPowered ? '#ff00ff' : '#ff66aa';

    // Sombra corporal
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, 2, w / 2 + 2, h / 2 + 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Animacion
    const inAir = !player.onGround;
    const jumping = inAir && player.vy < -2;
    const falling = inAir && player.vy > 2;

    const legsSwing = player.onGround
        ? Math.sin(player.animFrame * Math.PI / 2) * 4 * (player.vx !== 0 ? 1 : 0)
        : (jumping ? 6 : falling ? -5 : (player.vy < 0 ? 4 : -3));

    const jumpTuck = jumping ? 3 : 0;
    const fallStretch = falling ? 2 : 0;

    // Piernas
    const legW = 8;
    const legH = 13;
    const footW = 9;
    const footH = 3;
    const legTopY = h / 2 - legH - footH + 1;

    ctx.fillStyle = '#111130';

    function drawLeg(lx, ly) {
        roundedRect(ctx, lx - legW / 2, ly, legW, legH, 3);
        ctx.fill();
        ctx.strokeStyle = neonColor;
        ctx.lineWidth = 1;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Pie
        roundedRect(ctx, lx - footW / 2, ly + legH - 1, footW, footH, 1.5);
        ctx.fill();
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    drawLeg(-w / 3, legTopY + legsSwing - jumpTuck + fallStretch);
    drawLeg(w / 3, legTopY - legsSwing - jumpTuck + fallStretch);

    // Cuerpo (torso trapezoidal: hombros anchos, cintura estrecha)
    const shoulderW = w - 6;
    const waistW = w - 16;
    const torsoTop = -h / 2 + 20;
    const torsoH = h * 0.41;

    ctx.fillStyle = '#1e1e45';
    ctx.beginPath();
    ctx.moveTo(-shoulderW / 2, torsoTop);
    ctx.lineTo(shoulderW / 2, torsoTop);
    ctx.lineTo(waistW / 2, torsoTop + torsoH);
    ctx.lineTo(-waistW / 2, torsoTop + torsoH);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = neonColor;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = neonColor;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Detalles del torso (lineas de circuito)
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(-waistW / 3, torsoTop + 6);
    ctx.lineTo(waistW / 3, torsoTop + 6);
    ctx.moveTo(-waistW / 3, torsoTop + torsoH - 8);
    ctx.lineTo(waistW / 3, torsoTop + torsoH - 8);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Brazos
    const armSwing = (jumping || falling) ? -8
        : Math.sin(player.animFrame * Math.PI / 2) * 5 * (player.vx !== 0 ? 1 : 0);
    const armW = 7;
    const armH = 16;
    const isShooting = player.shootCooldown > 4;
    const genkiDama = (jumping || falling) && !isShooting;

    function drawArm(ax, ay) {
        roundedRect(ctx, ax - armW / 2, ay, armW, armH, 3);
        ctx.fillStyle = '#15153a';
        ctx.fill();
        ctx.strokeStyle = neonColor;
        ctx.lineWidth = 1;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
        // Mano
        ctx.fillStyle = '#1a1a40';
        ctx.beginPath();
        ctx.arc(ax, ay + armH, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = neonColor;
        ctx.lineWidth = 1;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    if (genkiDama) {
        // Genki Dama: ambos brazos estirados hacia arriba
        const shoulderLX = -shoulderW / 2 - 1;
        const shoulderRX = shoulderW / 2 + 1;
        const shoulderY = torsoTop + 2;
        const handY = shoulderY - 20;
        const handSpread = 6;

        function drawGenkiArm(sx, sy, hx, hy) {
            // Brazo
            ctx.strokeStyle = '#15153a';
            ctx.lineWidth = armW;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(hx, hy);
            ctx.stroke();
            ctx.strokeStyle = neonColor;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = neonColor;
            ctx.shadowBlur = 4;
            ctx.stroke();
            ctx.shadowBlur = 0;
            // Mano abierta arriba
            ctx.fillStyle = '#1a1a40';
            ctx.beginPath();
            ctx.arc(hx, hy - 2, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = neonColor;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = neonColor;
            ctx.shadowBlur = 4;
            ctx.stroke();
            ctx.shadowBlur = 0;
            // Dedos abiertos
            ctx.strokeStyle = neonColor;
            ctx.lineWidth = 0.8;
            ctx.globalAlpha = 0.6;
            for (let d = -2; d <= 2; d++) {
                ctx.beginPath();
                ctx.moveTo(hx, hy - 2);
                ctx.lineTo(hx + d * 2, hy - 8);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        drawGenkiArm(shoulderLX, shoulderY, shoulderLX - 2, handY);
        drawGenkiArm(shoulderRX, shoulderY, shoulderRX + 2, handY);

    } else if (isShooting) {
        const shootProgress = 1 - (player.shootCooldown - 4) / 8;
        const shoulderX = shoulderW / 2 + 1;
        const shoulderY = torsoTop + 2;
        const elbowX = shoulderX + 6 + shootProgress * 2;
        const elbowY = shoulderY - 4;
        const palmX = elbowX + 10;
        const palmY = elbowY - 2;

        // Brazo superior
        ctx.strokeStyle = neonColor;
        ctx.lineWidth = armW;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(shoulderX, shoulderY);
        ctx.lineTo(elbowX, elbowY);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Antebrazo
        ctx.strokeStyle = '#15153a';
        ctx.lineWidth = armW;
        ctx.beginPath();
        ctx.moveTo(elbowX, elbowY);
        ctx.lineTo(palmX, palmY);
        ctx.stroke();
        ctx.strokeStyle = neonColor;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = neonColor;
        ctx.shadowBlur = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Palma abierta con brillo
        const palmGlow = 0.5 + shootProgress * 0.5;
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10 * palmGlow;
        ctx.beginPath();
        ctx.arc(palmX + 2, palmY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Centro blanco del disparo
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(palmX + 2, palmY, 2 * palmGlow, 0, Math.PI * 2);
        ctx.fill();

        // Rayos de energia
        const t = Date.now() * 0.01;
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4 * palmGlow;
        for (let i = 0; i < 3; i++) {
            const a = t + (i / 3) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(palmX + 2, palmY);
            ctx.lineTo(palmX + 2 + Math.cos(a) * 7, palmY + Math.sin(a) * 7);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    } else {
        drawArm(-shoulderW / 2 - 1, torsoTop + 2 + armSwing);
        drawArm(shoulderW / 2 + 1, torsoTop + 2 - armSwing);
    }

    // Cuello
    ctx.fillStyle = '#1a1a40';
    roundedRect(ctx, -5, -h / 2 + 13, 10, 8, 2);
    ctx.fill();
    ctx.strokeStyle = neonColor;
    ctx.lineWidth = 1;
    ctx.shadowColor = neonColor;
    ctx.shadowBlur = 4;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Cabeza (ovalada)
    const headCenterX = 0;
    const headCenterY = -h / 2 + 5;
    const headRx = w / 2 - 1;
    const headRy = 8;

    ctx.fillStyle = '#1a1a40';
    ctx.beginPath();
    ctx.ellipse(headCenterX, headCenterY, headRx, headRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = neonColor;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = neonColor;
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Visor
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.ellipse(headCenterX, headCenterY + 2, headRx - 4, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Overclock corona (si esta potenciado)
    if (player.isPowered) {
        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(0, headCenterY - headRy - 2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Lineas de energia
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.6;
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2 + Date.now() * 0.005;
            ctx.beginPath();
            ctx.moveTo(0, headCenterY - headRy - 2);
            ctx.lineTo(Math.cos(a) * 8, headCenterY - headRy - 2 + Math.sin(a) * 8);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    ctx.restore();
}

// ---------- Enemigos ----------
let enemies = [];
let projectiles = [];
let playerBullets = [];

class PlayerBullet {
    constructor(x, y, vx) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.w = 12;
        this.h = 4;
        this.alive = true;
        this.life = 60;
    }

    update() {
        this.x += this.vx;
        this.life--;
        if (this.life <= 0 || this.x < camera.x - 50 || this.x > camera.x + GAME_W + 50) {
            this.alive = false;
        }
    }

    draw(ctx, cam) {
        const sx = this.x - cam.x;
        const sy = this.y - cam.y;
        if (sx < -20 || sx > GAME_W + 20) return;

        const trailX = sx - this.vx * 1.5;
        ctx.fillStyle = '#00ffff';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.fillRect(sx - this.w / 2, sy - this.h / 2, this.w, this.h);
        ctx.shadowBlur = 0;

        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(sx - this.w / 4, sy - this.h / 2 + 1, this.w * 0.5, this.h - 2);
        ctx.globalAlpha = 1;

        ctx.fillStyle = '#00ccff';
        ctx.globalAlpha = 0.4;
        ctx.fillRect(trailX - this.w / 3, sy - this.h / 2, this.w * 0.5, this.h);
        ctx.globalAlpha = 1;
    }
}

class GlitchDrone {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 28;
        this.h = 28;
        this.vx = -2;
        this.vy = 0;
        this.onGround = true;
        this.groundY = y;
        this.alive = true;
        this.animTimer = 0;
        this.glitchOffset = 0;
    }

    update(ground) {
        if (!this.alive) return;
        this.x += this.vx;
        this.animTimer += 0.08;
        this.glitchOffset = (Math.random() - 0.5) * 2;

        // Verificar borde: girar si no hay suelo debajo adelante
        const checkX = this.vx > 0 ? this.x + this.w + 2 : this.x - 2;
        let hasGround = false;
        for (const seg of ground) {
            if (checkX > seg.startX && checkX < seg.endX) {
                hasGround = true;
                break;
            }
        }
        if (!hasGround) {
            this.vx *= -1;
        }

        // Colisión con plataformas para enemigos en plataformas
        this.y = this.groundY - this.h;
    }

    draw(ctx, cam) {
        if (!this.alive) return;
        const sx = Math.round(this.x - cam.x + this.glitchOffset);
        const sy = Math.round(this.y - cam.y);
        if (sx + this.w < 0 || sx > GAME_W || sy + this.h < 0 || sy > GAME_H) return;

        const wobble = Math.sin(this.animTimer * 3) * 2;
        const cx = sx + this.w / 2;
        const cy = sy + this.h / 2 + wobble;
        const skullColor = '#ff3366';
        const skullFill = '#2a1030';

        // Sombra
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(cx, sy + this.h, this.w / 2 + 1, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Craneo (parte superior redonda)
        ctx.fillStyle = skullFill;
        ctx.beginPath();
        ctx.arc(cx, cy - 2, this.w / 2 - 3, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = skullColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = skullColor;
        ctx.shadowBlur = 8;
        ctx.stroke();

        // Mandibula
        ctx.fillStyle = skullFill;
        ctx.fillRect(cx - this.w / 2 + 5, cy + 2, this.w - 10, this.h / 2 - 4);
        ctx.strokeStyle = skullColor;
        ctx.shadowColor = skullColor;
        ctx.shadowBlur = 6;
        ctx.strokeRect(cx - this.w / 2 + 5, cy + 2, this.w - 10, this.h / 2 - 4);
        ctx.shadowBlur = 0;

        // Cuencas de los ojos
        ctx.fillStyle = '#0a0a1a';
        ctx.shadowColor = skullColor;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.ellipse(cx - 5, cy - 3, 4, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(cx + 5, cy - 3, 4, 4.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Pupilas brillantes
        const pupilX = this.vx * 0.8;
        ctx.fillStyle = '#ff0000';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(cx - 5 + pupilX, cy - 3, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + 5 + pupilX, cy - 3, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Nariz
        ctx.fillStyle = '#0a0a1a';
        ctx.beginPath();
        ctx.moveTo(cx - 3, cy + 1);
        ctx.lineTo(cx + 3, cy + 1);
        ctx.lineTo(cx, cy + 5);
        ctx.closePath();
        ctx.fill();

        // Dientes
        ctx.strokeStyle = skullColor;
        ctx.lineWidth = 0.5;
        ctx.globalAlpha = 0.7;
        const teethY = cy + 6;
        for (let i = -3; i <= 3; i++) {
            ctx.beginPath();
            ctx.moveTo(cx + i * 3, teethY);
            ctx.lineTo(cx + i * 3, teethY + 4);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Particulas de glitch alrededor
        ctx.fillStyle = '#ff3366';
        ctx.globalAlpha = 0.4;
        for (let i = 0; i < 3; i++) {
            const px = sx + Math.random() * this.w;
            const py = sy + Math.random() * this.h;
            ctx.fillRect(px, py, 2, 2);
        }
        ctx.globalAlpha = 1;
    }
}

class PulseTurret {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 24;
        this.h = 32;
        this.groundY = y;
        this.alive = true;
        this.shootTimer = 60 + Math.random() * 120;
        this.shootCooldown = 120;
        this.chargeAnim = 0;
        this.animTimer = 0;
        this.facing = -1; // Dispara hacia la izquierda por defecto
    }

    update(ground, playerRef) {
        if (!this.alive) return;
        this.y = this.groundY - this.h;
        this.animTimer += 0.05;

        // Apunta hacia el jugador
        if (playerRef.x > this.x) this.facing = 1;
        else this.facing = -1;

        this.shootTimer--;
        if (this.shootTimer <= 0) {
            this.shootTimer = this.shootCooldown;
            this.chargeAnim = 15;
            // Disparar proyectil
            projectiles.push(new EnergyProjectile(
                this.x + this.w / 2,
                this.y + this.h / 2,
                this.facing * 4,
                0
            ));
        }
        if (this.chargeAnim > 0) this.chargeAnim--;
    }

    draw(ctx, cam) {
        if (!this.alive) return;
        const sx = Math.round(this.x - cam.x);
        const sy = Math.round(this.y - cam.y);
        if (sx + this.w < 0 || sx > GAME_W || sy + this.h < 0 || sy > GAME_H) return;

        const t = this.animTimer || 0;
        const cx = sx + this.w / 2;
        const devilColor = '#ff9900';
        const devilFill = '#1a1020';
        const facing = this.facing;

        // Sombra
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        ctx.ellipse(cx, sy + this.h, this.w / 2 + 1, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cuerpo del diablito
        const bodyTop = sy + this.h * 0.4;
        const bodyH = this.h * 0.55;
        ctx.fillStyle = devilFill;
        ctx.beginPath();
        ctx.moveTo(cx - this.w / 3, bodyTop);
        ctx.lineTo(cx + this.w / 3, bodyTop);
        ctx.lineTo(cx + this.w / 2, bodyTop + bodyH);
        ctx.lineTo(cx - this.w / 2, bodyTop + bodyH);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = devilColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = devilColor;
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Cola puntiaguda
        ctx.strokeStyle = devilColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = devilColor;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(cx - facing * this.w / 3, sy + this.h - 4);
        ctx.quadraticCurveTo(cx - facing * 10, sy + this.h - 2, cx - facing * 14, sy + this.h - 8);
        ctx.stroke();
        ctx.fillStyle = devilColor;
        ctx.beginPath();
        ctx.moveTo(cx - facing * 14, sy + this.h - 8);
        ctx.lineTo(cx - facing * 18, sy + this.h - 14);
        ctx.lineTo(cx - facing * 12, sy + this.h - 9);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Cabeza
        const headY = bodyTop - 12;
        const headR = 8;
        ctx.fillStyle = devilFill;
        ctx.beginPath();
        ctx.arc(cx, headY, headR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = devilColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = devilColor;
        ctx.shadowBlur = 6;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Cuernos
        ctx.fillStyle = devilColor;
        ctx.shadowColor = devilColor;
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(cx - headR + 3, headY - 3);
        ctx.lineTo(cx - headR - 2, headY - 16);
        ctx.lineTo(cx - headR + 6, headY - 4);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + headR - 3, headY - 3);
        ctx.lineTo(cx + headR + 2, headY - 16);
        ctx.lineTo(cx + headR - 6, headY - 4);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;

        // Orejas puntiagudas
        ctx.beginPath();
        ctx.moveTo(cx - headR, headY);
        ctx.lineTo(cx - headR - 5, headY - 5);
        ctx.lineTo(cx - headR + 2, headY - 2);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + headR, headY);
        ctx.lineTo(cx + headR + 5, headY - 5);
        ctx.lineTo(cx + headR - 2, headY - 2);
        ctx.closePath();
        ctx.fill();

        // Ojos
        const charging = this.chargeAnim > 0;
        ctx.fillStyle = charging ? '#ffffff' : '#ff4400';
        ctx.shadowColor = charging ? '#ffff00' : '#ff4400';
        ctx.shadowBlur = charging ? 8 : 4;
        ctx.beginPath();
        ctx.arc(cx - facing * 3, headY - 1, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + facing * 3, headY - 1, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Boca malvada
        ctx.strokeStyle = devilColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, headY + 3, 4, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();

        // Brazos
        const armWave = charging ? Math.sin(Date.now() * 0.05) * 3 : 0;
        ctx.strokeStyle = devilColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = devilColor;
        ctx.shadowBlur = 3;
        ctx.beginPath();
        ctx.moveTo(cx - this.w / 3, bodyTop + 3);
        ctx.lineTo(cx - this.w / 2 - 3, bodyTop + 10 + armWave);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + this.w / 3, bodyTop + 3);
        ctx.lineTo(cx + this.w / 2 + 3, bodyTop + 10 - armWave);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Tridente al cargar
        if (charging) {
            ctx.strokeStyle = '#ffff00';
            ctx.lineWidth = 1;
            ctx.shadowColor = '#ffff00';
            ctx.shadowBlur = 6;
            const tridentX = cx + facing * 14;
            const tridentY = bodyTop + 8;
            ctx.beginPath();
            ctx.moveTo(tridentX, tridentY - 6);
            ctx.lineTo(tridentX, tridentY + 8);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(tridentX - 4, tridentY - 4);
            ctx.lineTo(tridentX + 4, tridentY - 4);
            ctx.moveTo(tridentX, tridentY - 6);
            ctx.lineTo(tridentX, tridentY - 10);
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        // Particulas de fuego
        ctx.fillStyle = '#ff6600';
        ctx.globalAlpha = 0.3;
        for (let i = 0; i < 2; i++) {
            const px = cx - 4 + Math.random() * 8;
            const py = sy + this.h - 4 + Math.random() * 6;
            ctx.fillRect(px, py, 2, 2);
        }
        ctx.globalAlpha = 1;
    }
}

class EnergyProjectile {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.w = 10;
        this.h = 6;
        this.alive = true;
        this.life = 180; // frames
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life--;
        if (this.life <= 0) this.alive = false;
    }

    draw(ctx, cam) {
        const sx = this.x - cam.x;
        const sy = this.y - cam.y;
        if (sx < -20 || sx > GAME_W + 20) return;

        ctx.fillStyle = '#ffff00';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 12;
        ctx.fillRect(sx - this.w / 2, sy - this.h / 2, this.w, this.h);

        // Estela
        ctx.fillStyle = '#ff9900';
        ctx.shadowColor = '#ff9900';
        ctx.shadowBlur = 6;
        ctx.fillRect(sx - this.vx * 2 - this.w / 2, sy - this.h / 2 + 1, this.w * 0.6, this.h - 2);
        ctx.shadowBlur = 0;
    }
}

function spawnEnemiesFromData() {
    enemies = [];
    projectiles = [];
    for (const e of spawnEnemies) {
        if (e.type === 'drone') {
            enemies.push(new GlitchDrone(e.x, e.y));
        } else if (e.type === 'turret') {
            enemies.push(new PulseTurret(e.x, e.y));
        }
    }
}

function checkPlayerBulletCollisions() {
    for (const bullet of playerBullets) {
        if (!bullet.alive) continue;
        for (const enemy of enemies) {
            if (!enemy.alive) continue;
            if (bullet.x + bullet.w / 2 > enemy.x && bullet.x - bullet.w / 2 < enemy.x + enemy.w &&
                bullet.y + bullet.h / 2 > enemy.y && bullet.y - bullet.h / 2 < enemy.y + enemy.h) {
                bullet.alive = false;
                enemy.alive = false;
                score += (enemy instanceof PulseTurret) ? 500 : 200;
                const color = (enemy instanceof PulseTurret) ? '#ff9900' : '#ff3366';
                spawnParticles(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, 12, color, 4);
                sfxEnemyDie();
                break;
            }
        }
    }
}

// ---------- Coleccionables: Fragmentos de datos ----------
let shards = [];

class DataShard {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 16;
        this.h = 16;
        this.collected = false;
        this.animTimer = Math.random() * Math.PI * 2;
        this.color = ['#00ffff', '#ff00ff', '#ffff00', '#00ff88', '#ff6600'][Math.floor(Math.random() * 5)];
    }

    update() {
        this.animTimer += 0.04;
    }

    draw(ctx, cam) {
        if (this.collected) return;
        const sx = this.x - cam.x - this.w / 2;
        const sy = this.y - cam.y - this.h / 2;
        if (sx + this.w < 0 || sx > GAME_W || sy + this.h < 0 || sy > GAME_H) return;

        const bob = Math.sin(this.animTimer) * 3;
        const rot = this.animTimer * 0.5;
        const midX = sx + this.w / 2;
        const midY = sy + this.h / 2 + bob;

        ctx.save();
        ctx.translate(midX, midY);
        ctx.rotate(rot);

        // Hexágono de datos
        ctx.fillStyle = this.color;
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        const r = 7;
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
            const px = Math.cos(a) * r;
            const py = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // Brillo interno
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        ctx.restore();
    }
}

function spawnShardsFromData() {
    shards = [];
    for (const s of spawnShards) {
        shards.push(new DataShard(s.x, s.y));
    }
}

// ---------- Power-ups ----------
let powerUps = [];

class OverclockModule {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.w = 24;
        this.h = 24;
        this.collected = false;
        this.animTimer = 0;
    }

    update() {
        this.animTimer += 0.06;
    }

    draw(ctx, cam) {
        if (this.collected) return;
        const sx = this.x - cam.x - this.w / 2;
        const sy = this.y - cam.y - this.h / 2;
        if (sx + this.w < 0 || sx > GAME_W || sy + this.h < 0 || sy > GAME_H) return;

        const bob = Math.sin(this.animTimer) * 4;
        const pulse = 0.7 + Math.sin(this.animTimer * 1.5) * 0.3;

        // Aura
        ctx.fillStyle = '#ffff00';
        ctx.globalAlpha = 0.15;
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 25;
        ctx.fillRect(sx - 6, sy - 6 + bob, this.w + 12, this.h + 12);
        ctx.shadowBlur = 0;

        // Cubo principal
        ctx.fillStyle = '#1a1a40';
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2.5;
        ctx.globalAlpha = pulse;
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 14;
        ctx.strokeRect(sx, sy + bob, this.w, this.h);
        ctx.shadowBlur = 0;

        // Circuito interno
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 1;
        ctx.globalAlpha = pulse * 0.7;
        ctx.beginPath();
        ctx.moveTo(sx + 4, sy + bob + this.h / 2);
        ctx.lineTo(sx + this.w / 2, sy + bob + 4);
        ctx.lineTo(sx + this.w - 4, sy + bob + this.h / 2);
        ctx.moveTo(sx + this.w / 2, sy + bob + 4);
        ctx.lineTo(sx + this.w / 2, sy + bob + this.h - 4);
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Núcleo
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ffff00';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(sx + this.w / 2, sy + bob + this.h / 2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Partículas orbitales
        for (let i = 0; i < 3; i++) {
            const a = this.animTimer * 2 + (i / 3) * Math.PI * 2;
            const px = sx + this.w / 2 + Math.cos(a) * 14;
            const py = sy + bob + this.h / 2 + Math.sin(a) * 14;
            ctx.fillStyle = '#ffff00';
            ctx.globalAlpha = 0.8;
            ctx.fillRect(px - 1, py - 1, 2, 2);
        }
        ctx.globalAlpha = 1;
    }
}

function spawnPowerUpsFromData() {
    powerUps = [];
    for (const pu of spawnPowerUps) {
        powerUps.push(new OverclockModule(pu.x, pu.y));
    }
}

// ---------- Meta: Punto de extracción ----------
function drawGoal(ctx, cam) {
    const gx = goalX - cam.x;
    const gy = GROUND_Y - cam.y;
    if (gx < -150 || gx > GAME_W + 150) return;

    const portalY = gy - 160;
    const t = Date.now() * 0.003;

    // Haz de luz vertical
    const beamGrad = ctx.createLinearGradient(0, portalY, 0, gy);
    beamGrad.addColorStop(0, 'rgba(0, 255, 255, 0)');
    beamGrad.addColorStop(0.5, 'rgba(0, 255, 255, 0.2)');
    beamGrad.addColorStop(1, 'rgba(0, 255, 255, 0.5)');
    ctx.fillStyle = beamGrad;
    ctx.fillRect(gx - 30, portalY, 60, gy - portalY);

    // Anillo del portal
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 20;
    const ringPulse = 1 + Math.sin(t * 2) * 0.1;
    ctx.beginPath();
    ctx.ellipse(gx, portalY + 50, 35 * ringPulse, 25 * ringPulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Anillo interior
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(gx, portalY + 50, 25 * ringPulse, 17 * ringPulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Centro brillante
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(gx, portalY + 50, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Partículas flotando hacia arriba
    for (let i = 0; i < 8; i++) {
        const py = portalY + 50 + ((t * 40 + i * 20) % 160);
        const alpha = 1 - (py - portalY - 50) / 160;
        ctx.fillStyle = '#00ffff';
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillRect(gx - 20 + i * 5, py, 2, 4);
    }
    ctx.globalAlpha = 1;

    // Base del portal
    ctx.fillStyle = '#1a1a40';
    ctx.fillRect(gx - 20, gy - 10, 40, 10);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 10;
    ctx.strokeRect(gx - 20, gy - 10, 40, 10);
    ctx.shadowBlur = 0;

    // Texto "EXIT"
    ctx.fillStyle = '#00ffff';
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EXTRACTION', gx, portalY - 10);
    ctx.textAlign = 'start';
}

// ---------- Colisiones ----------
function checkEnemyCollisions() {
    for (const enemy of enemies) {
        if (!enemy.alive) continue;

        const pLeft = player.x;
        const pRight = player.x + player.w;
        const pTop = player.y;
        const pBottom = player.y + player.h;
        const eLeft = enemy.x;
        const eRight = enemy.x + enemy.w;
        const eTop = enemy.y;
        const eBottom = enemy.y + enemy.h;

        if (pRight > eLeft && pLeft < eRight && pBottom > eTop && pTop < eBottom) {
            // ¿Pisando al enemigo?
            if (player.vy > 0 && pBottom - player.vy <= eTop + 8) {
                // Derrotar enemigo
                enemy.alive = false;
                player.vy = -8; // Rebote
                score += (enemy instanceof PulseTurret) ? 500 : 200;
                const color = (enemy instanceof PulseTurret) ? '#ff9900' : '#ff3366';
                spawnParticles(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, 15, color, 4);
                sfxEnemyDie();
            } else if (invincibleTimer <= 0) {
                // Jugador recibe daño
                sfxHit();
                if (player.isPowered) {
                    powerDownPlayer();
                } else {
                    playerDie();
                }
                break;
            }
        }
    }

    // Colisión con proyectiles
    for (const proj of projectiles) {
        if (!proj.alive) continue;
        const pLeft = player.x;
        const pRight = player.x + player.w;
        const pTop = player.y;
        const pBottom = player.y + player.h;
        const prLeft = proj.x - proj.w / 2;
        const prRight = proj.x + proj.w / 2;
        const prTop = proj.y - proj.h / 2;
        const prBottom = proj.y + proj.h / 2;

        if (pRight > prLeft && pLeft < prRight && pBottom > prTop && pTop < prBottom) {
            proj.alive = false;
            spawnParticles(proj.x, proj.y, 5, '#ffff00', 3);
            if (invincibleTimer <= 0) {
                sfxHit();
                if (player.isPowered) {
                    powerDownPlayer();
                } else {
                    playerDie();
                }
                break;
            }
        }
    }
}

function checkShardCollisions() {
    for (const shard of shards) {
        if (shard.collected) continue;
        const pLeft = player.x;
        const pRight = player.x + player.w;
        const pTop = player.y;
        const pBottom = player.y + player.h;
        const sLeft = shard.x - shard.w / 2;
        const sRight = shard.x + shard.w / 2;
        const sTop = shard.y - shard.h / 2;
        const sBottom = shard.y + shard.h / 2;

        if (pRight > sLeft && pLeft < sRight && pBottom > sTop && pTop < sBottom) {
            shard.collected = true;
            score += 100;
            spawnParticles(shard.x, shard.y, 8, shard.color, 3);
            sfxPickup();
        }
    }
}

function checkPowerUpCollisions() {
    for (const pu of powerUps) {
        if (pu.collected) continue;
        const pLeft = player.x;
        const pRight = player.x + player.w;
        const pTop = player.y;
        const pBottom = player.y + player.h;
        const puLeft = pu.x - pu.w / 2;
        const puRight = pu.x + pu.w / 2;
        const puTop = pu.y - pu.h / 2;
        const puBottom = pu.y + pu.h / 2;

        if (pRight > puLeft && pLeft < puRight && pBottom > puTop && pTop < puBottom) {
            pu.collected = true;
            sfxPowerUp();
            if (!player.isPowered) {
                powerUpPlayer();
            }
            score += 1000;
            spawnParticles(pu.x, pu.y, 20, '#ffff00', 5);
        }
    }
}

// ---------- HUD ----------
function drawHUD(ctx) {
    // Fondo semitransparente
    ctx.fillStyle = 'rgba(5, 5, 20, 0.7)';
    ctx.fillRect(0, 0, GAME_W, 40);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4;
    ctx.strokeRect(0, 0, GAME_W, 40);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(0, 40);
    ctx.lineTo(GAME_W, 40);
    ctx.strokeStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 4;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "Courier New", monospace';

    // Puntaje
    ctx.fillStyle = '#00ffff';
    ctx.fillText('DATA: ' + String(score).padStart(6, '0'), 20, 28);

    // Tiempo
    const mins = Math.floor(gameTime / 60);
    const secs = Math.floor(gameTime % 60);
    ctx.fillStyle = gameTime < 60 ? '#ff3366' : '#ffff00';
    ctx.fillText('TIME: ' + String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0'), 600, 28);

    // Power-up activo
    if (player.isPowered) {
        ctx.fillStyle = '#ffff00';
        ctx.fillText('OVERCLOCK', 780, 28);
    }
}

// ---------- Pantallas ----------
function drawMenu(ctx) {
    // Fondo animado
    drawBackground(ctx, { x: 0, y: 0 });
    drawGroundGrid(ctx, { x: 0, y: 0 });

    // Overlay oscuro
    ctx.fillStyle = 'rgba(5, 5, 20, 0.75)';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    if (instructionsShown) {
        drawInstructions(ctx);
        return;
    }

    // Título
    const t = Date.now() * 0.002;
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 30;
    ctx.font = 'bold 52px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NEON RUNNER', GAME_W / 2, 160);
    ctx.font = 'bold 16px "Courier New", monospace';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ff00ff';
    ctx.shadowColor = '#ff00ff';
    ctx.fillText('.beta', GAME_W / 2 + 202, 158);
    ctx.shadowBlur = 0;

    // Subtítulo
    ctx.fillStyle = '#ff00ff';
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 15;
    ctx.font = 'bold 18px "Courier New", monospace';
    ctx.fillText('CYBERPUNK PLATFORMER', GAME_W / 2, 200);
    ctx.shadowBlur = 0;

    // Personaje decorativo
    ctx.save();
    ctx.translate(GAME_W / 2, 270);
    const charBob = Math.sin(t * 3) * 5;
    // Cabeza
    ctx.fillStyle = '#1a1a40';
    ctx.fillRect(-16, -20 + charBob, 32, 16);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 8;
    ctx.strokeRect(-16, -20 + charBob, 32, 16);
    ctx.shadowBlur = 0;
    // Visor
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(-13, -15 + charBob, 26, 5);
    // Cuerpo
    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(-12, -4 + charBob, 24, 20);
    ctx.strokeStyle = '#00ffff';
    ctx.strokeRect(-12, -4 + charBob, 24, 20);
    // Piernas
    ctx.fillStyle = '#111130';
    ctx.fillRect(-12, 16 + charBob, 8, 14);
    ctx.fillRect(4, 16 + charBob, 8, 14);
    ctx.restore();

    // Opciones de menú
    const options = ['START GAME', 'CONTROLS', 'INSTRUCTIONS'];
    const optionY = [370, 410, 450];

    for (let i = 0; i < options.length; i++) {
        const alpha = i === menuSelected ? 1 : 0.5;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = i === menuSelected ? '#ffff00' : '#aaaaaa';
        ctx.shadowColor = i === menuSelected ? '#ffff00' : 'transparent';
        ctx.shadowBlur = i === menuSelected ? 10 : 0;
        ctx.font = 'bold 22px "Courier New", monospace';
        ctx.fillText((i === menuSelected ? '> ' : '  ') + options[i], GAME_W / 2, optionY[i]);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.textAlign = 'start';

    // Controles
    if (menuSelected === 1) {
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '14px "Courier New", monospace';
        ctx.textAlign = 'center';
        const controlsY = 482;
        ctx.fillText('ARROWS / WASD - Move  |  UP / W - Jump  |  SPACE - Shoot  |  P - Pause', GAME_W / 2, controlsY);
        ctx.fillText('Hold jump for higher  |  Stomp enemies to defeat', GAME_W / 2, controlsY + 22);
        ctx.textAlign = 'start';
    }

    // Pie
    ctx.fillStyle = '#666666';
    ctx.font = '11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press ENTER to select', GAME_W / 2, GAME_H - 20);
    ctx.textAlign = 'start';
}

function drawInstructions(ctx) {
    ctx.fillStyle = 'rgba(5, 5, 20, 0.85)';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    // Título
    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 20;
    ctx.font = 'bold 32px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('INSTRUCTIONS', GAME_W / 2, 55);
    ctx.shadowBlur = 0;

    // Línea decorativa
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(80, 72);
    ctx.lineTo(GAME_W - 80, 72);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const col1X = 90;
    const col2X = GAME_W / 2 + 48;
    let y;

    // ===== OBJETIVO =====
    y = 105;
    ctx.fillStyle = '#ff00ff';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.textAlign = 'start';
    ctx.fillText('>>> OBJETIVO', col1X, y);

    y += 27;
    ctx.fillStyle = '#cccccc';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('Alcanza el PUNTO DE EXTRACCION al final del nivel.', col1X + 8, y);
    y += 18;
    ctx.fillText('Recolecta DATA SHARDS (fragmentos hexagonales) para puntos.', col1X + 8, y);
    y += 18;
    ctx.fillText('Sobrevive a enemigos y trampas del mundo ciberpunk.', col1X + 8, y);

    // ===== ACCIONES =====
    y += 32;
    ctx.fillStyle = '#ff00ff';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText('>>> ACCIONES', col1X, y);

    y += 27;
    ctx.fillStyle = '#cccccc';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('Moverse / Saltar / Disparar / Hacer Stomp ', col1X + 8, y);
    y += 18;
    ctx.fillText('Tomar power-ups OVERCLOCK para doble salto.', col1X + 8, y);
    y += 18;
    ctx.fillText('Atravesar conductos de datos con DOWN + SPACE.', col1X + 8, y);

    // ===== ENEMIGOS =====
    y += 32;
    ctx.fillStyle = '#ff00ff';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText('>>> ENEMIGOS', col1X, y);

    y += 27;
    ctx.fillStyle = '#cccccc';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('GLITCH DRONE:  Patrulla - Pisalo o disparale.', col1X + 8, y);
    y += 18;
    ctx.fillText('PULSE TURRET:  Fijo, dispara - Cuidado.', col1X + 8, y);
    y += 18;
    ctx.fillText('STOMP:  Cae sobre ellos desde arriba = +200/+500 pts.', col1X + 8, y);

    // ===== COLUMNA DERECHA =====

    // ===== CONTROLES =====
    y = 105;
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText('>>> CONTROLES', col2X, y);

    y += 27;
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('MOVER:       Flechas / WASD', col2X + 8, y);
    y += 18;
    ctx.fillText('SALTAR:      UP / W  (manten para + alto)', col2X + 8, y);
    y += 18;
    ctx.fillText('DISPARAR:    SPACE', col2X + 8, y);
    y += 18;
    ctx.fillText('PAUSAR:      P', col2X + 8, y);

    // ===== MECANICAS =====
    y += 32;
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText('>>> MECANICAS', col2X, y);

    y += 27;
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('OVERCLOCK:  +tamano, doble salto, 1 golpe extra.', col2X + 8, y);
    y += 18;
    ctx.fillText('Sin OVERCLOCK, un golpe = GAME OVER (reinicio).', col2X + 8, y);
    y += 18;
    ctx.fillText('Con OVERCLOCK, recibir dano lo pierde (invulnerable).', col2X + 8, y);
    y += 18;
    ctx.fillText('DOBLE SALTO solo disponible con OVERCLOCK activo.', col2X + 8, y);

    // ===== PUNTAJE =====
    y += 32;
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 15px "Courier New", monospace';
    ctx.fillText('>>> PUNTAJE', col2X, y);

    y += 27;
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '12px "Courier New", monospace';
    ctx.fillText('SHARD:        +100 pts', col2X + 8, y);
    y += 18;
    ctx.fillText('DRONE:        +200 pts (stomp/shoot)', col2X + 8, y);
    y += 18;
    ctx.fillText('TURRET:       +500 pts (stomp/shoot)', col2X + 8, y);
    y += 18;
    ctx.fillText('OVERCLOCK:    +1000 pts', col2X + 8, y);

    // Pie
    ctx.fillStyle = '#666666';
    ctx.font = '11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press ENTER, ESC or B to go back', GAME_W / 2, GAME_H - 18);
    ctx.textAlign = 'start';
}

function drawGameOver(ctx) {
    ctx.fillStyle = 'rgba(10, 0, 0, 0.8)';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    ctx.fillStyle = '#ff3366';
    ctx.shadowColor = '#ff3366';
    ctx.shadowBlur = 30;
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SYSTEM FAILURE', GAME_W / 2, 200);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText('Score: ' + score, GAME_W / 2, 270);

    ctx.fillStyle = '#aaaaaa';
    ctx.shadowColor = '#aaaaaa';
    ctx.shadowBlur = 8;
    ctx.font = '18px "Courier New", monospace';
    const pulse = 0.6 + Math.sin(Date.now() * 0.004) * 0.3;
    ctx.globalAlpha = pulse;
    ctx.fillText('Press ENTER to reboot', GAME_W / 2, 340);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.textAlign = 'start';
}

function drawPause(ctx) {
    ctx.fillStyle = 'rgba(5, 5, 20, 0.7)';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    const t = Date.now() * 0.003;

    ctx.fillStyle = '#ffff00';
    ctx.shadowColor = '#ffff00';
    ctx.shadowBlur = 25;
    ctx.font = 'bold 42px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', GAME_W / 2, 200);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#00ccff';
    ctx.font = 'bold 18px "Courier New", monospace';
    const pulse = 0.6 + Math.sin(t * 2) * 0.3;
    ctx.globalAlpha = pulse;
    ctx.fillText('Press P to resume', GAME_W / 2, 260);
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '14px "Courier New", monospace';
    ctx.fillText('Press ESC to quit to menu', GAME_W / 2, 300);
    ctx.textAlign = 'start';
}

function drawVictory(ctx) {
    ctx.fillStyle = 'rgba(0, 10, 20, 0.8)';
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    const t = Date.now() * 0.003;

    ctx.fillStyle = '#00ffff';
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 40;
    ctx.font = 'bold 48px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('EXTRACTION COMPLETE', GAME_W / 2, 180);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ff00ff';
    ctx.shadowColor = '#ff00ff';
    ctx.shadowBlur = 20;
    ctx.font = '22px "Courier New", monospace';
    ctx.fillText('Neon has escaped the grid!', GAME_W / 2, 225);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#ffffff';
    ctx.font = '20px "Courier New", monospace';
    ctx.fillText('Final Score: ' + score, GAME_W / 2, 280);

    const timeBonus = Math.floor(gameTime) * 10;
    ctx.fillStyle = '#ffff00';
    ctx.fillText('Time Bonus: +' + timeBonus, GAME_W / 2, 310);
    ctx.fillText('Total: ' + (score + timeBonus), GAME_W / 2, 340);

    ctx.fillStyle = '#aaaaaa';
    ctx.shadowColor = '#aaaaaa';
    ctx.shadowBlur = 8;
    ctx.font = '18px "Courier New", monospace';
    const pulse = 0.6 + Math.sin(t * 2) * 0.3;
    ctx.globalAlpha = pulse;
    ctx.fillText('Press ENTER to play again', GAME_W / 2, 400);
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.textAlign = 'start';
}

// ---------- Actualizar lluvia ----------
function updateRain() {
    for (const r of bgRain) {
        r.y += r.speed;
        if (r.y > GAME_H + 20) {
            r.y = -20 - Math.random() * 40;
            r.x = camera.x + Math.random() * GAME_W * 2;
        }
    }
}

// ---------- Loop principal ----------
function startGame() {
    buildLevel();
    resetPlayer();
    spawnEnemiesFromData();
    spawnShardsFromData();
    spawnPowerUpsFromData();
    score = 0;
    gameTime = 300;
    timerAccum = 0;
    invincibleTimer = 0;
    particles = [];
    projectiles = [];
    playerBullets = [];
    camera.x = 0;
    camera.y = 0;
    camera.targetX = 0;
    camera.targetY = 0;
    paused = false;
    gameState = STATE.PLAYING;
}

function update() {
    if (gameState === STATE.MENU) {
        if (instructionsShown) {
            if ((keys['Enter'] || keys['Escape'] || keys['KeyB']) && !keys._menuNavLock) {
                keys._menuNavLock = true;
                instructionsShown = false;
            } else if (!keys['Enter'] && !keys['Escape'] && !keys['KeyB']) {
                keys._menuNavLock = false;
            }
        } else {
            if (keys['ArrowDown'] || keys['KeyS']) {
                if (!keys._menuNavLock) {
                    menuSelected = (menuSelected + 1) % 3;
                    keys._menuNavLock = true;
                }
            } else if (keys['ArrowUp'] || keys['KeyW']) {
                if (!keys._menuNavLock) {
                    menuSelected = (menuSelected - 1 + 3) % 3;
                    keys._menuNavLock = true;
                }
            } else if (keys['Enter']) {
                if (!keys._menuNavLock) {
                    if (menuSelected === 0) {
                        startGame();
                    } else if (menuSelected === 2) {
                        instructionsShown = true;
                    }
                    keys._menuNavLock = true;
                }
            } else {
                keys._menuNavLock = false;
            }
        }
        // Animación de partículas decorativas en menú
        if (Math.random() < 0.3) {
            const px = Math.random() * GAME_W;
            const py = Math.random() * GAME_H;
            particles.push({
                x: px, y: py, vx: 0, vy: -0.5 - Math.random(),
                life: 1, decay: 0.008, size: 1 + Math.random() * 2,
                color: '#00ffff'
            });
        }
        updateParticles();
        updateRain();
        return;
    }

    if (gameState === STATE.GAMEOVER || gameState === STATE.VICTORY) {
        updateParticles();
        updateRain();
        if (player.deathTimer > 0) {
            player.deathTimer--;
            player.vy += player.gravity;
            player.y += player.vy;
            spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 1, '#ff3366', 2);
        }
        if (keys['Enter'] && !keys._menuNavLock) {
            keys._menuNavLock = true;
            if (gameState === STATE.GAMEOVER) {
                paused = false;
                gameState = STATE.MENU;
            } else {
                startGame();
            }
        } else if (!keys['Enter']) {
            keys._menuNavLock = false;
        }
        return;
    }

    // --- JUGANDO ---
    if (keys['KeyP'] && !keys._pauseLock) {
        keys._pauseLock = true;
        paused = !paused;
        sfxPause();
    }
    if (!keys['KeyP']) {
        keys._pauseLock = false;
    }

    if (paused) {
        if (keys['Escape'] && !keys._pauseLock) {
            keys._pauseLock = true;
            paused = false;
            gameState = STATE.MENU;
        }
        return;
    }
    updatePlayer();
    checkEnemyCollisions();
    checkPlayerBulletCollisions();
    checkShardCollisions();
    checkPowerUpCollisions();

    // Actualizar enemigos
    for (const enemy of enemies) {
        if (enemy instanceof GlitchDrone) enemy.update(groundSegments);
        if (enemy instanceof PulseTurret) enemy.update(groundSegments, player);
    }

    // Actualizar proyectiles enemigos
    for (const proj of projectiles) proj.update();
    projectiles = projectiles.filter(p => p.alive);

    // Actualizar balas del jugador
    for (const b of playerBullets) b.update();
    playerBullets = playerBullets.filter(b => b.alive);

    // Actualizar shards
    for (const shard of shards) shard.update();

    // Actualizar power-ups
    for (const pu of powerUps) pu.update();

    // Limpiar enemigos muertos
    enemies = enemies.filter(e => e.alive);

    // Cámara
    camera.targetX = player.x - GAME_W / 3;
    camera.targetY = Math.min(0, player.y - GAME_H / 2);
    camera.x += (camera.targetX - camera.x) * 0.1;
    camera.y += (camera.targetY - camera.y) * 0.1;
    if (camera.x < 0) camera.x = 0;
    if (camera.y > 0) camera.y = 0;

    // Temporizador
    timerAccum += 1;
    if (timerAccum >= 60) {
        timerAccum = 0;
        gameTime--;
        if (gameTime <= 0) {
            gameState = STATE.GAMEOVER;
            sfxGameOver();
        }
    }

    // Verificar meta
    if (player.x + player.w > goalX && player.x < goalX + 40 && player.y + player.h >= GROUND_Y - 10) {
        gameState = STATE.VICTORY;
        sfxVictory();
        spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 40, '#00ffff', 6);
    }

    // Actualizar partículas
    updateParticles();
    updateRain();
}

function render() {
    ctx.clearRect(0, 0, GAME_W, GAME_H);

    if (gameState === STATE.PLAYING || gameState === STATE.GAMEOVER || gameState === STATE.VICTORY) {
        // Fondo parallax
        drawBackground(ctx, camera);

        // Suelo con rejilla
        drawGroundGrid(ctx, camera);

        // Conductos de datos
        for (const c of dataConduits) {
            drawDataConduit(ctx, c, camera);
        }

        // Plataformas
        for (const p of platforms) {
            drawPlatform(ctx, p, camera);
        }

        // Meta
        drawGoal(ctx, camera);

        // Power-ups
        for (const pu of powerUps) {
            pu.draw(ctx, camera);
        }

        // Fragmentos de datos
        for (const shard of shards) {
            shard.draw(ctx, camera);
        }

        // Enemigos
        for (const enemy of enemies) {
            enemy.draw(ctx, camera);
        }

        // Proyectiles enemigos
        for (const proj of projectiles) {
            proj.draw(ctx, camera);
        }

        // Balas del jugador
        for (const b of playerBullets) {
            b.draw(ctx, camera);
        }

        // Jugador
        drawPlayer(ctx, camera);

        // Partículas
        drawParticles(ctx, camera);

        // HUD
        drawHUD(ctx);

        // Pausa
        if (paused) {
            drawPause(ctx);
        }

        // Overlays post-game
        if (gameState === STATE.GAMEOVER) {
            drawGameOver(ctx);
        } else if (gameState === STATE.VICTORY) {
            drawVictory(ctx);
        }
    } else if (gameState === STATE.MENU) {
        drawMenu(ctx);
        drawParticles(ctx, { x: 0, y: 0 });
    }
}

function gameLoop() {
    update();
    render();
    requestAnimationFrame(gameLoop);
}

// ---------- Inicialización ----------
initBackground();
buildLevel();
spawnEnemiesFromData();
spawnShardsFromData();
spawnPowerUpsFromData();
resetPlayer();

// Precargar datos de nivel para el menú
camera.x = 0;
camera.y = 0;

gameLoop();
