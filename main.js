const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayBody = document.getElementById('overlay-body');
const startBtn = document.getElementById('start-btn');
const fortniteBtn = document.getElementById('fortnite-btn');
const trackSelect = document.getElementById('track-select');
const worldSelect = document.getElementById('world-select');
const bikeSelect = document.getElementById('bike-select');
const titleScreen = document.getElementById('title-screen');
const titleStartBtn = document.getElementById('title-start-btn');
const modeCards = document.querySelectorAll('.mode-card');
const titleObjective = document.getElementById('title-objective');

const speedEl = document.getElementById('speed');
const distanceEl = document.getElementById('distance');
const bestEl = document.getElementById('best');
const killsEl = document.getElementById('kills');
const powerupsEl = document.getElementById('powerups');
const objectiveText = document.getElementById('objective-text');

const input = { up: false, down: false, left: false, right: false, turbo: false, fire: false };
const camera = { x: 0, y: 0 };

const wheelRadius = 22;
const wheelBase = 88;
const gravity = 360;
const maxSpeed = 520;
const slopeRollForce = 420;
const suspensionStiffness = 32;
const suspensionDamping = 0.38;
const bulletSpeed = 1150;
const fireCooldown = 0.22;
const bulletLifetime = 2.2;
const fortniteBoostDuration = 2.4;
const rapidDuration = 8;

let bestDistance = 0;
let lastTime = 0;
let time = 0;
let fortniteBoost = 0;

let audioCtx;
let musicGain;
let noiseBuffer;
let musicHead = 0;
let musicStarted = false;
let flashTimer = 0;
let nightmare = false;
let shieldFlash = 0;
let trackMode = 'chip'; // chip | jazz
let worldMode = 'neon';
let bikeMode = 'nova';
let chillMode = false;
let currentMode = 'standard';
let modeConfig = null;

const state = {
  status: 'title', // title | ready | running | crashed | win
  distance: 0,
  kills: 0,
  elapsed: 0,
};

class Terrain {
  constructor(step = 18) {
    this.step = step;
    this.points = [];
    this.seed = Math.random() * 1000;
    this.base = 400;
    this.min = 140;
    this.max = 900;
  }

  reset() {
    this.points = [];
    this.seed = Math.random() * 1000;
    this.base = canvas.height * 0.64;
    this.min = canvas.height * 0.14;
    this.max = canvas.height - 20;
    this.ensure(6000);
  }

  rand(n) {
    const x = Math.sin(n + this.seed * 3.13) * 43758.5453123;
    return x - Math.floor(x);
  }

  nextHeight() {
    const i = this.points.length;
    const rolling = Math.sin(i * 0.1) * 140 + Math.sin(i * 0.027) * 220;
    const noise = (this.rand(i * 1.73) - 0.5) * 140;
    const kicker = i % 34 === 0 ? (0.6 + this.rand(i * 0.91)) * 240 : 0;
    const canyon = i % 41 === 0 ? -(this.rand(i * 1.13)) * 200 : 0;
    const target = this.base + rolling + noise + kicker + canyon;
    const prev = this.points[i - 1] ?? this.base;
    const h = clamp(prev * 0.72 + target * 0.28, this.min, this.max);
    return h;
  }

  ensure(x) {
    const needed = Math.ceil(x / this.step) + 6;
    while (this.points.length <= needed) {
      this.points.push(this.nextHeight());
    }
  }

  height(x) {
    if (x < 0) return this.base;
    this.ensure(x);
    const i = Math.floor(x / this.step);
    const t = (x / this.step) - i;
    const a = this.points[i] ?? this.base;
    const b = this.points[i + 1] ?? this.base;
    return a + (b - a) * t;
  }

  slope(x) {
    const h1 = this.height(x - this.step);
    const h2 = this.height(x + this.step);
    return (h2 - h1) / (2 * this.step);
  }
}

const terrain = new Terrain();

const bike = {
  x: 120,
  y: 0,
  vx: 0,
  vy: 0,
  rot: 0,
  rotV: 0,
  onGround: false,
};

const bullets = [];
const enemies = [];
const enemyShots = [];
const powerups = [];
let nextEnemyX = 600;
let lastShotAt = -Infinity;
let nextPowerupX = 900;
let shieldCharges = 0;
let rapidFireTimer = 0;
const modes = {
  chill: {
    spawnFactor: 0.35,
    enemySpeed: 0.55,
    desc: 'Coast endlessly, low pressure.',
    objective: null,
  },
  standard: {
    spawnFactor: 0.8,
    enemySpeed: 0.85,
    desc: 'Ride far and shoot foes.',
    objective: { type: 'distance', target: 1800 },
  },
  nightmare: {
    spawnFactor: 1.3,
    enemySpeed: 1.2,
    desc: 'Tougher enemies; rack up kills.',
    objective: { type: 'kills', target: 12 },
  },
  infiltrator: {
    spawnFactor: 0.7,
    enemySpeed: 0.8,
    desc: 'Enemies ignore you; sneak through.',
    objective: { type: 'distance', target: 1400 },
    friendly: true,
  },
  chaos: {
    spawnFactor: 1.6,
    enemySpeed: 1.35,
    desc: 'Dense spawns, sprint or crash.',
    objective: { type: 'distance', target: 1000 },
  },
};

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  terrain.base = canvas.height * 0.65;
  terrain.min = canvas.height * 0.25;
  terrain.max = canvas.height - 30;
  if (terrain.points.length === 0) {
    terrain.ensure(canvas.width * 2);
  }
}

window.addEventListener('resize', resize);
resize();

function resetBike() {
  bike.x = 120;
  bike.y = terrain.height(bike.x) - wheelRadius;
  bike.vx = 0;
  bike.vy = 0;
  bike.rot = 0;
  bike.rotV = 0;
  bike.onGround = false;
  state.distance = 0;
  state.kills = 0;
  state.elapsed = 0;
  bullets.length = 0;
  enemies.length = 0;
  enemyShots.length = 0;
  powerups.length = 0;
  nextEnemyX = 600;
  nextPowerupX = 900;
  lastShotAt = -Infinity;
  fortniteBoost = 0;
  shieldCharges = 0;
  rapidFireTimer = 0;
}

function startRun() {
  // Mode may have been chosen from the title cards; ensure we use current selection.
  setMode(currentMode);
  setWorldMode(worldSelect.value);
  setBikeMode(bikeSelect.value);
  modeConfig = modes[currentMode] || modes.standard;
  terrain.reset();
  resetBike();
  const messageText = document.getElementById('message-text');
  if (messageText) messageText.textContent = '';
  overlay.classList.add('hidden');
  overlay.classList.remove('death');
  titleScreen.classList.add('hidden');
  overlayTitle.textContent = 'Ride!';
  startBtn.textContent = 'Restart';
  refreshObjectiveText();
  ensureAudio();
  state.status = 'running';
}

function crash() {
  if (state.status === 'crashed') return;
  state.status = 'crashed';
  overlayTitle.textContent = 'You Died';
  const messageText = document.getElementById('message-text');
  if (messageText) messageText.innerHTML = 'The track claimed you.<br>Press R or hit Restart.';
  startBtn.textContent = 'Try Again';
  overlay.classList.add('death');
  overlay.classList.remove('hidden');
}

function win() {
  state.status = 'win';
  overlayTitle.textContent = 'Objective Complete';
  const objectiveMsg = modeConfig?.objective?.type === 'distance'
    ? `You reached ${Math.floor(state.distance / 5)} m.`
    : `You got ${state.kills} kills.`;
  const messageText = document.getElementById('message-text');
  if (messageText) messageText.innerHTML = `${objectiveMsg}<br>Press R or hit Restart.`;
  if (objectiveText) objectiveText.textContent = objectiveMsg;
  startBtn.textContent = 'Go Again';
  overlay.classList.remove('death');
  overlay.classList.remove('hidden');
}

function applyPowerup(type) {
  if (type === 'shield') {
    shieldCharges = Math.min(shieldCharges + 1, 3);
    shieldFlash = 0.35;
  } else if (type === 'rapid') {
    rapidFireTimer = rapidDuration;
  }
}

function tryUseShield(groundY) {
  if (shieldCharges > 0) {
    shieldCharges -= 1;
    shieldFlash = 0.45;
    bike.vy = -260;
    bike.onGround = false;
    if (groundY !== undefined) {
      bike.y = Math.min(bike.y, groundY - 20);
    }
    return true;
  }
  return false;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function createNoise() {
  const buffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 1.2), audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function ensureAudio() {
  if (musicStarted) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  audioCtx = new Ctx();
  musicGain = audioCtx.createGain();
  musicGain.gain.value = 1.4;
  musicGain.connect(audioCtx.destination);
  noiseBuffer = createNoise();
  musicHead = audioCtx.currentTime + 0.05;
  musicStarted = true;
  requestAnimationFrame(scheduleMusic);
}

function playKick(t) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.28);
  g.gain.setValueAtTime(0.55, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  osc.connect(g);
  g.connect(musicGain);
  osc.start(t);
  osc.stop(t + 0.3);
}

function playSnare(t) {
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuffer;
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(1800, t);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.25, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  src.connect(bp);
  bp.connect(g);
  g.connect(musicGain);
  src.start(t);
  src.stop(t + 0.2);
}

function playHat(t) {
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuffer;
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(8000, t);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.09, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  src.connect(hp);
  hp.connect(g);
  g.connect(musicGain);
  src.start(t);
  src.stop(t + 0.06);
}

function playRide(t) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(780, t);
  g.gain.setValueAtTime(0.06, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  osc.connect(g);
  g.connect(musicGain);
  osc.start(t);
  osc.stop(t + 0.2);
}

function playBrush(t) {
  const src = audioCtx.createBufferSource();
  src.buffer = noiseBuffer;
  const bp = audioCtx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(1400, t);
  bp.Q.setValueAtTime(0.8, t);
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  src.connect(bp);
  bp.connect(g);
  g.connect(musicGain);
  src.start(t);
  src.stop(t + 0.24);
}

const bassNotes = [55, 62, 65, 71];
const chordRoots = [55, 62, 65, 71];
const jazzBass = [55, 58, 62, 65];
const jazzChords = [58, 62, 67, 70]; // Bbmaj-ish loop
const bigBandBass = [43, 50, 55, 57]; // F, G#, A, B
const bigBandChords = [55, 62, 65, 69]; // brass hits
const funkBass = [43, 48, 50, 55]; // F minor-ish groove
const funkChords = [55, 58, 62, 65]; // triads for stabs
const worlds = {
  neon: {
    skyTop: '#0f2545',
    skyBottom: '#07101f',
    stars: 'rgba(255,255,255,0.14)',
    clouds: 'rgba(255, 255, 255, 0.18)',
    hillTop: 'rgba(47,90,121,0.45)',
    hillBottom: 'rgba(8,20,35,0.9)',
    terrainFill: '#131c23',
    ridge: '#5bc28b',
  },
  desert: {
    skyTop: '#f1b36b',
    skyBottom: '#d26c3b',
    stars: 'rgba(255,240,200,0.18)',
    clouds: 'rgba(255, 230, 200, 0.22)',
    hillTop: 'rgba(255,200,120,0.6)',
    hillBottom: 'rgba(150,80,30,0.9)',
    terrainFill: '#8c542b',
    ridge: '#ffd38a',
  },
  snow: {
    skyTop: '#b7d8ff',
    skyBottom: '#5d7fb5',
    stars: 'rgba(255,255,255,0.22)',
    clouds: 'rgba(255,255,255,0.4)',
    hillTop: 'rgba(200,230,255,0.7)',
    hillBottom: 'rgba(80,110,150,0.95)',
    terrainFill: '#7a92a8',
    ridge: '#e9f2ff',
  },
  toxic: {
    skyTop: '#1c3b1f',
    skyBottom: '#0b120c',
    stars: 'rgba(180,255,120,0.2)',
    clouds: 'rgba(120, 255, 160, 0.2)',
    hillTop: 'rgba(90,200,90,0.55)',
    hillBottom: 'rgba(20,40,20,0.95)',
    terrainFill: '#0f1c11',
    ridge: '#7cff7c',
  },
};
const bikes = {
  nova: {
    frame: '#ffae3c',
    accent: '#ff7047',
    fork: '#d6f2ff',
    tank: '#1c2b36',
    tankStroke: '#9ae0ff',
    rider: '#8be0ff',
  },
  duner: {
    frame: '#f3c45c',
    accent: '#d97b28',
    fork: '#f9e3b0',
    tank: '#3a2818',
    tankStroke: '#f3c45c',
    rider: '#ffdca4',
  },
  frost: {
    frame: '#9ae0ff',
    accent: '#6cc3ff',
    fork: '#cfe9ff',
    tank: '#1b2736',
    tankStroke: '#8be0ff',
    rider: '#dff4ff',
  },
  shadow: {
    frame: '#9c8cff',
    accent: '#5b4ae0',
    fork: '#c3b5ff',
    tank: '#1c1628',
    tankStroke: '#9c8cff',
    rider: '#d7d1ff',
  },
};
function playBass(t, step) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sawtooth';
  const note = bassNotes[step % bassNotes.length] * 2;
  osc.frequency.setValueAtTime(note, t);
  g.gain.setValueAtTime(0.08, t);
  g.gain.linearRampToValueAtTime(0.0, t + 0.35);
  osc.connect(g);
  g.connect(musicGain);
  osc.start(t);
  osc.stop(t + 0.4);
}

function playUpright(t, note) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(note, t);
  g.gain.setValueAtTime(0.16, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
  const lp = audioCtx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(480, t);
  osc.connect(lp);
  lp.connect(g);
  g.connect(musicGain);
  osc.start(t);
  osc.stop(t + 0.5);
}

function playPianoChord(t, root) {
  if (!audioCtx) return;
  const intervals = [0, 4, 7, 11];
  intervals.forEach((offset, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    const freq = root * Math.pow(2, offset / 12);
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2200 - i * 300, t);
    lp.Q.setValueAtTime(0.7, t);
    const g = audioCtx.createGain();
    const baseGain = 0.08 / (1 + i * 0.2);
    g.gain.setValueAtTime(baseGain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 1.15);
    osc.frequency.setValueAtTime(freq, t);
    osc.connect(lp);
    lp.connect(g);
    g.connect(musicGain);
    osc.start(t);
    osc.stop(t + 1.2);
  });
}

function playHornSection(t, root) {
  if (!audioCtx) return;
  const voices = [
    { offset: 0, detune: -6 },
    { offset: 7, detune: 0 },
    { offset: 12, detune: 5 },
  ];
  voices.forEach((v, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    const freq = root * Math.pow(2, v.offset / 12);
    const g = audioCtx.createGain();
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(1400 + i * 90, t);
    filt.Q.setValueAtTime(1.2, t);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.frequency.setValueAtTime(freq, t);
    osc.detune.setValueAtTime(v.detune, t);
    osc.connect(filt);
    filt.connect(g);
    g.connect(musicGain);
    osc.start(t);
    osc.stop(t + 0.55);
  });
}

function playPluckBass(t, note) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(note, t);
  g.gain.setValueAtTime(0.14, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 0.38);
  const filt = audioCtx.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(620, t);
  filt.Q.setValueAtTime(0.9, t);
  osc.connect(filt);
  filt.connect(g);
  g.connect(musicGain);
  osc.start(t);
  osc.stop(t + 0.4);
}

function playFunkStab(t, root) {
  if (!audioCtx) return;
  const intervals = [0, 7, 10];
  intervals.forEach((off, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    const freq = root * Math.pow(2, off / 12);
    const g = audioCtx.createGain();
    const filt = audioCtx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.setValueAtTime(1800 - i * 150, t);
    filt.Q.setValueAtTime(1.0, t);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.35);
    osc.frequency.setValueAtTime(freq, t);
    osc.connect(filt);
    filt.connect(g);
    g.connect(musicGain);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

function playTom(t) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(78, t + 0.22);
  g.gain.setValueAtTime(0.18, t);
  g.gain.exponentialRampToValueAtTime(0.0008, t + 0.3);
  osc.connect(g);
  g.connect(musicGain);
  osc.start(t);
  osc.stop(t + 0.32);
}

function playGuitarComp(t, root) {
  if (!audioCtx) return;
  const intervals = [0, 4, 7, 10];
  intervals.forEach((off, i) => {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    const filt = audioCtx.createBiquadFilter();
    osc.type = 'square';
    const freq = root * Math.pow(2, off / 12);
    osc.frequency.setValueAtTime(freq, t + i * 0.012);
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(1800 - i * 120, t);
    filt.Q.setValueAtTime(0.8, t);
    g.gain.setValueAtTime(0.08, t + i * 0.012);
    g.gain.exponentialRampToValueAtTime(0.0006, t + 0.35);
    osc.connect(filt);
    filt.connect(g);
    g.connect(musicGain);
    osc.start(t + i * 0.012);
    osc.stop(t + 0.38);
  });
}

function playWhoosh() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime + 0.01;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(240, t);
  osc.frequency.exponentialRampToValueAtTime(62, t + 0.55);
  g.gain.setValueAtTime(0.35, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
  osc.connect(g);
  g.connect(musicGain);
  osc.start(t);
  osc.stop(t + 0.6);
}

function playChord(t, step) {
  if (!audioCtx) return;
  const root = chordRoots[step % chordRoots.length];
  const intervals = [0, 7, 12, 16];
  intervals.forEach((offset, i) => {
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    const freq = root * Math.pow(2, offset / 12);
    const lp = audioCtx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1900 - i * 120, t);
    lp.Q.setValueAtTime(0.6, t);
    const g = audioCtx.createGain();
    const baseGain = 0.13 / (1 + i * 0.25);
    g.gain.setValueAtTime(baseGain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
    osc.frequency.setValueAtTime(freq, t);
    osc.connect(lp);
    lp.connect(g);
    g.connect(musicGain);
    osc.start(t);
    osc.stop(t + 1.0);
  });
}

function playJumpscare() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime + 0.02;
  // Noise hit
  const noise = audioCtx.createBufferSource();
  noise.buffer = noiseBuffer;
  const hp = audioCtx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(200, t);
  const gNoise = audioCtx.createGain();
  gNoise.gain.setValueAtTime(0.55, t);
  gNoise.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  noise.connect(hp);
  hp.connect(gNoise);
  gNoise.connect(musicGain);
  noise.start(t);
  noise.stop(t + 0.5);

  // Detuned dual osc stab
  for (const detune of [-9, 7]) {
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.detune.setValueAtTime(detune, t);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(g);
    g.connect(musicGain);
    osc.start(t);
    osc.stop(t + 0.65);
  }
}

function scheduleChip(time, step, beat) {
  const barPos = step % 16;
  if (barPos % 2 === 0) playKick(time); // 4-on-the-floor
  if (barPos % 4 === 2) playSnare(time);
  playHat(time); // on-beat
  playHat(time + beat * 0.5); // off-beat
  if (barPos % 2 === 0) playBass(time, step);
  if (barPos % 4 === 0) playChord(time, step);
}

function scheduleJazz(time, step, beat) {
  const barPos = step % 16;
  const swing = beat * 0.65;
  playRide(time);
  playRide(time + swing);
  if (barPos % 4 === 2) playBrush(time);
  if (barPos % 4 === 0) playKick(time); // soft downbeat pulse
  playUpright(time, jazzBass[step % jazzBass.length]);
  if (barPos % 4 === 0) {
    const chordRoot = jazzChords[Math.floor(step / 4) % jazzChords.length] * 2;
    playPianoChord(time, chordRoot);
  }
}

function scheduleBigBand(time, step, beat) {
  const barPos = step % 16;
  const swingShort = beat * 0.6;
  playRide(time);
  playRide(time + swingShort);
  if (barPos % 4 === 2) playSnare(time);
  if (barPos % 4 === 0) playKick(time);
  playUpright(time, bigBandBass[step % bigBandBass.length]);
  if (barPos % 4 === 0 || barPos % 4 === 2) {
    const root = bigBandChords[Math.floor(step / 4) % bigBandChords.length] * 2;
    playHornSection(time, root);
  }
  if (barPos % 4 === 0) playTom(time + swingShort * 0.9);
  if (barPos % 4 === 0 || barPos % 4 === 3) {
    const root = bigBandChords[Math.floor(step / 4) % bigBandChords.length] * 2;
    playGuitarComp(time + (barPos % 4 === 3 ? beat * 0.25 : 0), root);
  }
}

function scheduleFunk(time, step, beat) {
  const barPos = step % 16;
  playKick(time);
  if (barPos % 4 === 2) playSnare(time);
  playHat(time);
  playHat(time + beat * 0.5);
  const bassNote = funkBass[(step + (barPos % 4 === 2 ? 1 : 0)) % funkBass.length];
  playPluckBass(time, bassNote * 2);
  if (barPos % 4 === 0 || barPos % 4 === 3) {
    const root = funkChords[Math.floor(step / 4) % funkChords.length] * 2;
    playFunkStab(time + (barPos % 4 === 3 ? beat * 0.3 : 0), root);
  }
}

function scheduleMusic() {
  if (!musicStarted || !audioCtx) return;
  const now = audioCtx.currentTime;
  const beat = trackMode === 'jazz' ? 0.55 : 0.5;
  while (musicHead < now + 1.5) {
    const step = Math.floor((musicHead - 0.0001) / beat);
    if (trackMode === 'jazz') scheduleJazz(musicHead, step, beat);
    else if (trackMode === 'bigband') scheduleBigBand(musicHead, step, beat * 0.92);
    else if (trackMode === 'funk') scheduleFunk(musicHead, step, beat * 0.9);
    else scheduleChip(musicHead, step, beat);
    musicHead += beat;
  }
  requestAnimationFrame(scheduleMusic);
}

function setNightmare(enabled) {
  nightmare = enabled;
}

function setTrackMode(mode) {
  const allowed = ['chip', 'jazz', 'bigband', 'funk'];
  trackMode = allowed.includes(mode) ? mode : 'chip';
  if (trackSelect.value !== mode) {
    trackSelect.value = trackMode;
  }
  if (audioCtx) {
    musicHead = audioCtx.currentTime + 0.05;
  }
}

function setWorldMode(mode) {
  worldMode = worlds[mode] ? mode : 'neon';
  if (worldSelect.value !== worldMode) worldSelect.value = worldMode;
}

function setBikeMode(mode) {
  bikeMode = bikes[mode] ? mode : 'nova';
  if (bikeSelect.value !== bikeMode) bikeSelect.value = bikeMode;
}

function updateModeCards() {
  modeCards.forEach((card) => {
    const mode = card.dataset.mode;
    card.classList.toggle('active', mode === currentMode);
  });
}

function setMode(mode) {
  const allowed = Object.keys(modes);
  const safe = allowed.includes(mode) ? mode : 'standard';
  currentMode = safe;
  modeConfig = modes[currentMode] || modes.standard;
  chillMode = currentMode === 'chill';
  setNightmare(currentMode === 'nightmare');
  if (musicGain) musicGain.gain.value = chillMode ? 0.9 : 1.4;
  if (audioCtx) musicHead = audioCtx.currentTime + 0.05;
  updateModeCards();
  refreshObjectiveText();
}

function refreshObjectiveText() {
  const cfg = modes[currentMode] || modes.standard;
  const obj = cfg.objective;
  const objText = obj
    ? obj.type === 'distance'
      ? `Objective: Reach ${Math.floor(obj.target / 5)} m`
      : `Objective: Get ${obj.target} kills`
    : 'Objective: Chill and explore';
  const summary = `${cfg.desc} - ${objText}`;
  if (objectiveText) {
    objectiveText.textContent = summary;
  }
  if (titleObjective) {
    titleObjective.textContent = summary;
  }
  const messageText = document.getElementById('message-text');
  if (messageText) messageText.textContent = '';
}

function readInput() {
  const throttle = input.up ? 1 : 0;
  const brake = input.down ? 1 : 0;
  const lean = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  return { throttle, brake, lean };
}

function updateHUD() {
  const speedKmh = Math.abs(bike.vx) * 3.6 / 100; // px/s roughly equals m/s if 100px ~ 1m
  speedEl.textContent = `${speedKmh.toFixed(1)} km/h`;
  distanceEl.textContent = `${Math.max(0, Math.floor(state.distance / 5))} m`;
  bestEl.textContent = `${Math.floor(bestDistance / 5)} m`;
  killsEl.textContent = `${state.kills}`;
  const powerTextParts = [];
  if (shieldCharges > 0) powerTextParts.push(`Shield x${shieldCharges}`);
  if (rapidFireTimer > 0) powerTextParts.push(`Rapid ${rapidFireTimer.toFixed(1)}s`);
  powerupsEl.textContent = powerTextParts.length ? powerTextParts.join(' | ') : 'None';
}

function update(dt) {
  if (state.status !== 'running') return;

  const { throttle, brake, lean } = readInput();
  const turbo = input.turbo;
  const wantsFire = input.fire;
  const drive = throttle - brake;
  const cfg = modeConfig || modes[currentMode] || modes.standard;
  const friendly = !!cfg.friendly;
  const spawnFactor = Math.max(0.25, cfg.spawnFactor ?? 1);
  const enemySpeedFactor = cfg.enemySpeed ?? 1;
  if (flashTimer > 0) flashTimer = Math.max(0, flashTimer - dt);
  if (shieldFlash > 0) shieldFlash = Math.max(0, shieldFlash - dt);
  if (rapidFireTimer > 0) rapidFireTimer = Math.max(0, rapidFireTimer - dt);

  // Engine push and rotational control.
  const turboBoost = turbo ? 1.8 : 1;
  const accel = (bike.onGround ? 360 : 220) * turboBoost;
  bike.vx += drive * accel * dt;
  bike.rotV += lean * (bike.onGround ? 6.2 : 8.8) * dt;
  bike.rotV = clamp(bike.rotV, -7, 7);

  if (fortniteBoost > 0) {
    fortniteBoost = Math.max(0, fortniteBoost - dt);
    bike.vx += 320 * dt;
  }

  // Gravity and damping.
  bike.vy += gravity * dt;
  bike.vy *= 1 - 0.03 * dt;

  // Integrate position.
  bike.x += bike.vx * dt;
  bike.y += bike.vy * dt;
  bike.rot += bike.rotV * dt;
  bike.rot = normalizeAngle(bike.rot);

  // Wheel positions in world space.
  const halfBase = wheelBase / 2;
  const dirX = Math.cos(bike.rot);
  const dirY = Math.sin(bike.rot);
  const backWheel = { x: bike.x - dirX * halfBase, y: bike.y - dirY * halfBase };
  const frontWheel = { x: bike.x + dirX * halfBase, y: bike.y + dirY * halfBase };

  const groundBack = terrain.height(backWheel.x) - wheelRadius;
  const groundFront = terrain.height(frontWheel.x) - wheelRadius;

  // Push bike out of the ground using the deepest wheel and add suspension feel.
  const backPen = Math.max(0, backWheel.y - groundBack);
  const frontPen = Math.max(0, frontWheel.y - groundFront);
  const penetration = Math.max(backPen, frontPen);
  if (penetration > 0) {
    bike.y -= penetration * 0.9;
    bike.vy -= penetration * suspensionStiffness * dt;
    bike.vy *= 1 - suspensionDamping * dt;
    bike.rotV += (backPen - frontPen) * 0.015;
  }

  bike.onGround = penetration > 0;

  if (bike.onGround) {
    const slopeBack = terrain.slope(backWheel.x);
    const slopeFront = terrain.slope(frontWheel.x);
    const targetRot = Math.atan2((slopeBack + slopeFront) * 0.5, 1);
    const delta = normalizeAngle(targetRot - bike.rot);
    bike.rot += delta * clamp(14 * dt, 0, 0.7);
    bike.rotV *= 0.55;
  }

  const slopeHere = terrain.slope(bike.x);
  if (bike.onGround) {
    bike.vx += slopeHere * slopeRollForce * dt;
  }
  const drag = bike.onGround ? 1.2 + Math.min(Math.abs(slopeHere) * 0.5, 1.4) : 0.12;
  bike.vx *= 1 - drag * dt;
  const speedCap = turbo ? maxSpeed * 1.45 : maxSpeed;
  bike.vx = clamp(bike.vx, -140, speedCap);

  // Progress
  state.distance = Math.max(state.distance, bike.x - 100);
  bestDistance = Math.max(bestDistance, state.distance);
  state.elapsed += dt;

  // Spawn enemies ahead of player
  const spawnAhead = bike.x + canvas.width * 0.9;
  while (nextEnemyX < spawnAhead) {
    const r = Math.random();
    const type = r > 0.82 ? 'drone' : r > 0.5 ? 'crawler' : 'wasp';
    const h = terrain.height(nextEnemyX);
    const y = type === 'drone' ? h - 120 - Math.random() * 80 :
              type === 'wasp' ? h - 60 - Math.random() * 20 :
              h - wheelRadius * 1.3;
    enemies.push({
      x: nextEnemyX,
      y,
      type,
      t: Math.random() * Math.PI * 2,
      alive: true,
      radius: type === 'drone' ? 24 : type === 'wasp' ? 20 : 22,
      cooldown: 0,
    });
    const spacingMin = 420 / spawnFactor;
    const spacingRange = 720 / spawnFactor;
    nextEnemyX += spacingMin + Math.random() * spacingRange;
  }

  // Spawn powerups sparsely
  const powerAhead = bike.x + canvas.width * 0.8;
  while (nextPowerupX < powerAhead) {
    const h = terrain.height(nextPowerupX);
    const type = Math.random() > 0.5 ? 'shield' : 'rapid';
    powerups.push({
      x: nextPowerupX,
      y: h - 120,
      type,
      radius: 22,
      t: Math.random() * Math.PI * 2,
    });
    nextPowerupX += 900 + Math.random() * 800;
  }

  // Fire gun
  const cooldown = rapidFireTimer > 0 ? fireCooldown * 0.4 : fireCooldown;
  if (wantsFire && time - lastShotAt > cooldown) {
    const dirX = Math.cos(bike.rot);
    const dirY = Math.sin(bike.rot);
    bullets.push({
      x: bike.x + dirX * 40,
      y: bike.y + dirY * 40,
      vx: dirX * bulletSpeed + bike.vx * 0.25,
      vy: dirY * bulletSpeed + bike.vy * 0.25,
      born: time,
    });
    lastShotAt = time;
  }

  // Update bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // Slight gravity to make arcs
    b.vy += gravity * 0.2 * dt;
    if (time - b.born > bulletLifetime) {
      bullets.splice(i, 1);
    }
  }

  // Enemy shots
  for (let i = enemyShots.length - 1; i >= 0; i--) {
    const s = enemyShots[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (time - s.born > 3 || s.x < camera.x - 400 || s.x > camera.x + canvas.width + 400) {
      enemyShots.splice(i, 1);
      continue;
    }
    const dx = bike.x - s.x;
    const dy = bike.y - s.y;
    if (friendly) continue;
    if (dx * dx + dy * dy < 28 * 28) {
      if (!tryUseShield()) {
        crash();
      }
      enemyShots.splice(i, 1);
    }
  }

  // Update enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.t += dt;
    const enemySpeed = enemySpeedFactor;
    if (e.type === 'drone') {
      e.y += Math.sin(e.t * 2.1) * 10 * dt * 60 * enemySpeed;
      e.x += Math.sin(e.t * 1.3) * 5 * dt * 60 * enemySpeed;
    } else if (e.type === 'wasp') {
      // Stationary shooter: gentle hover only
      e.y += Math.sin(e.t * 1.8) * 0.4;
      e.cooldown -= dt;
      if (!friendly && e.cooldown <= 0 && Math.abs(bike.x - e.x) < 900) {
        const dir = Math.atan2((bike.y - 30) - e.y, (bike.x - e.x));
        const speed = 240;
        enemyShots.push({
          x: e.x,
          y: e.y,
          vx: Math.cos(dir) * speed,
          vy: Math.sin(dir) * speed,
          born: time,
        });
        e.cooldown = 1.8 + Math.random() * 1.2;
      }
    } else {
      // crawler sticks to terrain
      const h = terrain.height(e.x);
      e.y = h - wheelRadius * 1.3;
      const crawlDrift = Math.max(-0.3, enemySpeed - 1);
      e.x += Math.sin(e.t * 0.8) * 6 * dt * 60 * crawlDrift;
    }

    // Bullet collision
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      const dx = b.x - e.x;
      const dy = b.y - e.y;
      const r = e.radius + 6;
      if (dx * dx + dy * dy < r * r) {
        bullets.splice(j, 1);
        enemies.splice(i, 1);
        state.kills += 1;
        break;
      }
    }

    // Cull far behind enemies
    if (e.x < bike.x - 900) {
      enemies.splice(i, 1);
    }
  }

  // Powerup pickups and animation
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.t += dt;
    p.y += Math.sin(p.t * 2) * 0.3;
    const dx = bike.x - p.x;
    const dy = (bike.y - 18) - p.y;
    const r = p.radius + 18;
    if (dx * dx + dy * dy < r * r) {
      applyPowerup(p.type);
      powerups.splice(i, 1);
      continue;
    }
    if (p.x < bike.x - 900) powerups.splice(i, 1);
  }


  // Objective checks
  if (cfg.objective && state.status === 'running') {
    if (cfg.objective.type === 'distance' && state.distance >= cfg.objective.target) {
      win();
    }
    if (cfg.objective.type === 'kills' && state.kills >= cfg.objective.target) {
      win();
    }
  }

  // Camera follows with smoothing.
  const desiredCamX = bike.x - canvas.width * 0.35;
  const desiredCamY = bike.y - canvas.height * 0.55;
  camera.x = lerp(camera.x, desiredCamX, 1 - Math.pow(0.001, dt * 60));
  camera.y = lerp(camera.y, desiredCamY, 1 - Math.pow(0.0015, dt * 60));

  // Crash detection.
  const bodyY = bike.y - 20;
  const headX = bike.x + Math.sin(bike.rot) * 26;
  const headY = bodyY - Math.cos(bike.rot) * 26;
  const headGround = terrain.height(headX);
  const headHitGround = headY + 8 > headGround;
  const rotationCrash = bike.onGround && Math.abs(bike.rot) > 2.45;
  if (headHitGround || rotationCrash) {
    if (!tryUseShield(headGround)) crash();
  }

  // Enemy collision
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    const dx = bike.x - e.x;
    const dy = (bike.y - 12) - e.y;
    const r = e.radius + 18;
    if (friendly) continue;
    if (dx * dx + dy * dy < r * r) {
      if (shieldCharges > 0) {
        shieldCharges -= 1;
        shieldFlash = 0.4;
        enemies.splice(i, 1);
        bike.vy = -260;
        bike.onGround = false;
      } else {
        crash();
      }
      break;
    }
  }

  updateHUD();
}

function drawBackground() {
  const w = canvas.width;
  const h = canvas.height;
  const world = worlds[worldMode] || worlds.neon;

// Sky
const sky = ctx.createLinearGradient(0, 0, 0, h);
if (nightmare) {
  sky.addColorStop(0, '#290513');
  sky.addColorStop(1, '#060208');
} else {
  sky.addColorStop(0, world.skyTop);
  sky.addColorStop(1, world.skyBottom);
}
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Stars
  ctx.fillStyle = nightmare ? 'rgba(255,120,120,0.16)' : world.stars;
  for (let i = 0; i < 60; i++) {
    const x = (i * 190 + (camera.x * 0.3)) % (w + 100) - 50;
    const y = (i * 47) % (h * 0.4);
    const size = (i % 3) + 1;
    ctx.fillRect(x, y, size, size);
  }

  // Clouds layer
  ctx.save();
  ctx.translate(-camera.x * 0.15, 0);
  ctx.fillStyle = nightmare ? 'rgba(255, 90, 120, 0.18)' : world.clouds;
  for (let i = 0; i < 12; i++) {
    const baseX = (i * 320) % (w + 320) - 160 + (camera.x * 0.05);
    const baseY = 50 + (i % 5) * 28 + Math.sin((i * 37 + camera.x * 0.002)) * 12;
    ctx.beginPath();
    ctx.ellipse(baseX, baseY, 90, 26, 0, 0, Math.PI * 2);
    ctx.ellipse(baseX + 50, baseY + 6, 70, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(baseX - 50, baseY + 10, 60, 18, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Distant hills
  ctx.save();
  ctx.translate(-camera.x * 0.2, h * 0.18);
  ctx.beginPath();
  const hillHeight = h * 0.28;
  ctx.moveTo(-200, h);
  for (let x = -200; x < w + 400; x += 8) {
    const y = Math.sin((x + camera.x * 0.15) * 0.005) * hillHeight * 0.4 +
              Math.sin((x + camera.x * 0.08) * 0.0012) * hillHeight * 0.6 +
              h * 0.4;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w + 400, h + 200);
  ctx.closePath();
  const hillGrad = ctx.createLinearGradient(0, 0, 0, h);
  if (nightmare) {
    hillGrad.addColorStop(0, 'rgba(130,30,50,0.55)');
    hillGrad.addColorStop(1, 'rgba(20,4,8,0.92)');
  } else {
    hillGrad.addColorStop(0, world.hillTop);
    hillGrad.addColorStop(1, world.hillBottom);
  }
  ctx.fillStyle = hillGrad;
  ctx.fill();
  ctx.restore();
}

function drawTerrain() {
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  const world = worlds[worldMode] || worlds.neon;

  const startX = Math.floor(camera.x / terrain.step) * terrain.step - terrain.step * 2;
  const endX = camera.x + canvas.width + terrain.step * 2;

  ctx.beginPath();
  ctx.moveTo(startX, camera.y + canvas.height + 200);
  for (let x = startX; x <= endX; x += terrain.step / 2) {
    const y = terrain.height(x);
    ctx.lineTo(x, y);
  }
  ctx.lineTo(endX, camera.y + canvas.height + 200);
  ctx.closePath();
  ctx.fillStyle = nightmare ? '#1c0b10' : world.terrainFill;
  ctx.fill();

  // Ridge line
  ctx.beginPath();
  for (let x = startX; x <= endX; x += terrain.step) {
    const y = terrain.height(x);
    if (x === startX) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = nightmare ? '#ff5172' : world.ridge;
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.restore();
}

function drawBike() {
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  const palette = bikes[bikeMode] || bikes.nova;

  const dirX = Math.cos(bike.rot);
  const dirY = Math.sin(bike.rot);
  const halfBase = wheelBase / 2;
  const backWheel = { x: bike.x - dirX * halfBase, y: bike.y - dirY * halfBase };
  const frontWheel = { x: bike.x + dirX * halfBase, y: bike.y + dirY * halfBase };
  const bodyY = bike.y - 16;

  const drawWheel = (p, spin) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(spin);
    ctx.fillStyle = '#0b0f14';
    ctx.beginPath();
    ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
    ctx.fill();

    // Tyre highlight
    ctx.strokeStyle = '#2b3a44';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, wheelRadius - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Rim
    ctx.strokeStyle = '#9ae0ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, wheelRadius - 6, 0, Math.PI * 2);
    ctx.stroke();

    // Spokes
    ctx.strokeStyle = 'rgba(154,224,255,0.8)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6;
      const x = Math.cos(a) * (wheelRadius - 7);
      const y = Math.sin(a) * (wheelRadius - 7);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    // Hub
    ctx.fillStyle = '#e9f2ff';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Wheels
  const spin = (Date.now() * 0.01) % (Math.PI * 2);
  drawWheel(backWheel, spin);
  drawWheel(frontWheel, spin + 0.4);

  // Frame and rider
  ctx.save();
  ctx.translate(bike.x, bodyY);
  ctx.rotate(bike.rot);
  ctx.lineCap = 'round';

  // Swingarm to rear wheel
  ctx.strokeStyle = palette.frame;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-halfBase + 8, 6);
  ctx.lineTo(-halfBase + 2, 14);
  ctx.stroke();

  // Front fork to wheel
  ctx.strokeStyle = palette.fork;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(halfBase - 6, 6);
  ctx.lineTo(halfBase - 2, 18);
  ctx.stroke();

  // Frame triangle
  ctx.strokeStyle = palette.frame;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-halfBase + 6, 8);
  ctx.lineTo(0, -12);
  ctx.lineTo(halfBase - 8, 8);
  ctx.stroke();

  // Seat bar
  ctx.beginPath();
  ctx.moveTo(-6, -10);
  ctx.lineTo(18, -16);
  ctx.strokeStyle = palette.accent;
  ctx.stroke();

  // Tank / body
  ctx.fillStyle = palette.tank;
  ctx.strokeStyle = palette.tankStroke;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-4, -14);
  ctx.quadraticCurveTo(10, -22, 24, -16);
  ctx.quadraticCurveTo(10, -8, -4, -10);
  ctx.fill();
  ctx.stroke();

  // Handlebar
  ctx.strokeStyle = '#e9f2ff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(halfBase - 10, -6);
  ctx.lineTo(halfBase + 8, -14);
  ctx.stroke();

  // Exhaust
  ctx.strokeStyle = '#8be0ff';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-halfBase + 2, -2);
  ctx.lineTo(-halfBase - 12, -8);
  ctx.stroke();

  // Rider torso
  ctx.strokeStyle = palette.rider;
  ctx.beginPath();
  ctx.moveTo(-6, -18);
  ctx.lineTo(0, -34);
  ctx.lineTo(12, -28);
  ctx.stroke();

  // Head
  ctx.fillStyle = palette.rider;
  ctx.beginPath();
  ctx.arc(0, -42, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
  ctx.restore();
}

function drawBullets() {
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  ctx.fillStyle = '#ffeb8a';
  ctx.strokeStyle = '#ffd34a';
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnemyShots() {
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  ctx.fillStyle = '#4dff80';
  ctx.strokeStyle = '#19c45f';
  for (const s of enemyShots) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawEnemies() {
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  for (const e of enemies) {
    if (e.type === 'drone') {
      const grad = ctx.createRadialGradient(e.x, e.y, 6, e.x, e.y, 32);
      grad.addColorStop(0, 'rgba(120,200,255,0.9)');
      grad.addColorStop(1, 'rgba(20,30,60,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 32, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7bd5ff';
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2de1ff';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else if (e.type === 'wasp') {
      const grad = ctx.createRadialGradient(e.x, e.y, 4, e.x, e.y, 26);
      grad.addColorStop(0, 'rgba(120,255,140,0.9)');
      grad.addColorStop(1, 'rgba(10,40,10,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7cff9a';
      ctx.strokeStyle = '#2dff5c';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ff7a6b';
      ctx.strokeStyle = '#ffd5c7';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(e.x - e.radius, e.y + e.radius);
      ctx.lineTo(e.x + e.radius, e.y + e.radius);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawPowerups() {
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  for (const p of powerups) {
    const pulse = (Math.sin(p.t * 4) + 1) * 0.5;
    ctx.save();
    ctx.translate(p.x, p.y);
    const glow = ctx.createRadialGradient(0, 0, 6, 0, 0, 36);
    if (p.type === 'shield') {
      glow.addColorStop(0, 'rgba(90,220,255,0.9)');
      glow.addColorStop(1, 'rgba(30,60,90,0)');
      ctx.fillStyle = '#9ee8ff';
      ctx.strokeStyle = '#4de1ff';
    } else {
      glow.addColorStop(0, 'rgba(255,210,90,0.9)');
      glow.addColorStop(1, 'rgba(70,50,0,0)');
      ctx.fillStyle = '#ffd770';
      ctx.strokeStyle = '#ffb347';
    }
    ctx.beginPath();
    ctx.arc(0, 0, 32, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 0, 18 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#0b0f1d';
    ctx.font = 'bold 16px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.type === 'shield' ? 'SH' : 'R', 0, 0);

    ctx.restore();
  }
  ctx.restore();
}

function draw() {
  drawBackground();
  drawTerrain();
  drawPowerups();
  drawEnemies();
  drawBike();
  drawBullets();
  drawEnemyShots();
  if (flashTimer > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(flashTimer * 1.8, 0, 0.8);
    ctx.fillStyle = '#ff1744';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = clamp(flashTimer * 2.2, 0, 0.9);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 72px "Bungee", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FORTNITE!!!', canvas.width / 2, canvas.height / 2);
    ctx.restore();
  }
  if (shieldFlash > 0) {
    ctx.save();
    ctx.globalAlpha = clamp(shieldFlash * (chillMode ? 1.2 : 2), 0, 0.5);
    ctx.fillStyle = '#4de1ff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = clamp((timestamp - lastTime) / 1000, 0, 0.033);
  lastTime = timestamp;
  time += dt;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

function handleKey(e, pressed) {
  if (['ArrowUp', 'KeyW'].includes(e.code)) input.up = pressed;
  if (['ArrowDown', 'KeyS'].includes(e.code)) input.down = pressed;
  if (['ArrowLeft', 'KeyA'].includes(e.code)) input.left = pressed;
  if (['ArrowRight', 'KeyD'].includes(e.code)) input.right = pressed;
  if (['ShiftLeft', 'ShiftRight', 'KeyX'].includes(e.code)) input.turbo = pressed;
  if (['Space', 'KeyF'].includes(e.code)) input.fire = pressed;

  if (pressed && e.code === 'KeyR') {
    startRun();
  }

  if (pressed && state.status !== 'running' && e.code === 'Space') {
    startRun();
  }
}

window.addEventListener('keydown', (e) => handleKey(e, true));
window.addEventListener('keyup', (e) => handleKey(e, false));

startBtn.addEventListener('click', startRun);
titleStartBtn.addEventListener('click', startRun);
modeCards.forEach((card) => {
  card.addEventListener('click', () => {
    if (state.status === 'running') return;
    setMode(card.dataset.mode);
  });
});
fortniteBtn.addEventListener('click', () => {
  ensureAudio();
  if (state.status !== 'running') {
    startRun();
  }
  fortniteBoost = fortniteBoostDuration;
  bike.vx += 180;
  bike.vy -= 260;
  playWhoosh();
  playJumpscare();
  flashTimer = 0.65;
});
trackSelect.addEventListener('change', () => {
  ensureAudio();
  setTrackMode(trackSelect.value);
});
worldSelect.addEventListener('change', () => setWorldMode(worldSelect.value));
bikeSelect.addEventListener('change', () => setBikeMode(bikeSelect.value));

// Initialize toggle
setNightmare(false);
setTrackMode('chip');
setWorldMode('neon');
setBikeMode('nova');
setMode('standard');
refreshObjectiveText();

// Initial overlay text
overlayTitle.textContent = 'Ride!';
overlay.classList.add('hidden');
titleScreen.classList.remove('hidden');
state.status = 'title';

// Kick off with generated terrain
terrain.reset();
resetBike();
