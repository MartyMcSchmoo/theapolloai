const adWall = document.getElementById('adWall');
const sessionTimeEl = document.getElementById('sessionTime');
const bestTimeEl = document.getElementById('bestTime');
const topTimeEl = document.getElementById('topTime');
const boardList = document.getElementById('boardList');
const scrollBtn = document.getElementById('scrollBtn');
const toLeaderboard = document.getElementById('toLeaderboard');

const SESSION_KEY = 'makememoney_best_seconds';

const slogans = [
  'Buy faster. Spend harder.',
  'Limited time forever sale!',
  'World’s #1 impulse buy.',
  'We accept emotional support credit.',
  'Tap to feel richer.',
  'Pre-order the unannounced.',
  'Sponsored by your future self.',
  'Stack coupon codes irresponsibly.',
  'As seen on a billboard.',
  'Finance it for 84 months.',
  'Certified to increase your cart size.',
  'Impulse-approved.',
  'Spend first, ask later.',
  'Swipe your destiny.',
  'Big logo, bigger mark-up.'
];

const products = [
  'Moonlight Sneakers',
  'Quantum Soda',
  'Retro Cassette Drone',
  'Vaporwave Keyboard',
  'Infinite Coffee Pass',
  'Glow-in-the-dark Hoodie',
  'Nano Pizza Box',
  'Cloud Pillow 3000',
  'Hologram Plant',
  'Pocket Projector',
  'Silent Alarm Clock',
  'AI Sticker Pack',
  'Mini Fridge Bag',
  'Noise-Cancel Rocks',
  'LED Sandals'
];

const priceTags = ['$9.99', '$29', '$59', '$199', '$499', '$7', '$13', '$77', '$999', '$42', '$420', '$5', '$17', '$88'];
const tags = ['Hot', 'New', 'Limited', 'Bogo', 'Ad', 'Gift', 'Flash', 'Premium', 'Bundle', 'VIP'];
const gradients = [
  'linear-gradient(135deg, #ff4f6f, #ffc371)',
  'linear-gradient(135deg, #44d1ff, #7af5ff)',
  'linear-gradient(135deg, #ffbf4f, #ff8f70)',
  'linear-gradient(135deg, #9f7bff, #44d1ff)',
  'linear-gradient(135deg, #7af0c5, #44d1ff)',
  'linear-gradient(135deg, #ff7eb6, #ffb347)',
  'linear-gradient(135deg, #ffc371, #ff5f6d)'
];

let sessionSeconds = 0;
let tickInterval = null;

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatSeconds(sec) {
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = Math.floor(sec % 60);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function buildAdCard() {
  const div = document.createElement('div');
  div.className = 'ad';
  div.style.background = randomItem(gradients);

  const headline = randomItem(products);
  const copy = randomItem(slogans);
  const tag = randomItem(tags);
  const price = randomItem(priceTags);

  div.innerHTML = `
    <span class="tag">${tag}</span>
    <p class="headline">${headline}</p>
    <p class="copy">${copy}</p>
    <span class="price">${price}</span>
  `;

  return div;
}

function fillAds(count = 160) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i += 1) {
    frag.appendChild(buildAdCard());
  }
  adWall.appendChild(frag);
}

function loadBest() {
  const stored = Number(localStorage.getItem(SESSION_KEY) || 0);
  return Number.isFinite(stored) ? stored : 0;
}

function saveBest(seconds) {
  localStorage.setItem(SESSION_KEY, String(seconds));
}

function getLeaderboardData(current) {
  const baseline = [
    { name: 'Lingerer#1', seconds: 7200 },
    { name: 'AdEnjoyer', seconds: 5400 },
    { name: 'ScrollGoblin', seconds: 3600 },
    { name: 'NeonGazer', seconds: 2400 },
    { name: 'RooftopWatcher', seconds: 1800 }
  ];

  const best = loadBest();
  const meSeconds = Math.max(best, current);
  const mine = { name: 'You', seconds: meSeconds };

  const merged = [...baseline, mine].sort((a, b) => b.seconds - a.seconds).slice(0, 8);
  return { merged, top: merged[0]?.seconds || 0 };
}

function renderBoard(current = 0) {
  const { merged, top } = getLeaderboardData(current);
  boardList.innerHTML = '';

  merged.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'row' + (entry.name === 'You' ? ' me' : '');
    li.innerHTML = `
      <span class="name">${entry.name}</span>
      <span class="time">${formatSeconds(entry.seconds)}</span>
    `;
    boardList.appendChild(li);
  });

  topTimeEl.textContent = formatSeconds(top);
}

function updateTimers() {
  sessionTimeEl.textContent = formatSeconds(sessionSeconds);
  const best = loadBest();
  bestTimeEl.textContent = best > 0 ? formatSeconds(best) : '--';
}

function startTimer() {
  if (tickInterval) return;
  tickInterval = setInterval(() => {
    sessionSeconds += 1;
    updateTimers();
    renderBoard(sessionSeconds);
  }, 1000);
}

function stopTimer() {
  if (!tickInterval) return;
  clearInterval(tickInterval);
  tickInterval = null;
  const best = loadBest();
  if (sessionSeconds > best) {
    saveBest(sessionSeconds);
  }
}

function init() {
  fillAds(200);
  updateTimers();
  renderBoard(0);
  startTimer();

  scrollBtn.addEventListener('click', () => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  });

  toLeaderboard.addEventListener('click', () => {
    document.getElementById('leaderboard').scrollIntoView({ behavior: 'smooth' });
  });

  window.addEventListener('beforeunload', stopTimer);
}

init();
