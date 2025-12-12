const adWall = document.getElementById('adWall');
const sessionTimeEl = document.getElementById('sessionTime');
const bestTimeEl = document.getElementById('bestTime');
const clockDisplay = document.getElementById('clockDisplay');
const resetBtn = document.getElementById('resetBtn');
const editToggle = document.getElementById('editToggle');
const addAdBtn = document.getElementById('addAdBtn');
const exportBtn = document.getElementById('exportBtn');
const resetAdsBtn = document.getElementById('resetAdsBtn');
const adModal = document.getElementById('adModal');
const adForm = document.getElementById('adForm');
const modalClose = document.getElementById('modalClose');
const cancelModal = document.getElementById('cancelModal');

const tagInput = document.getElementById('tagInput');
const headlineInput = document.getElementById('headlineInput');
const copyInput = document.getElementById('copyInput');
const priceInput = document.getElementById('priceInput');
const bgInput = document.getElementById('bgInput');

const SESSION_KEY = 'makememoney_best_seconds';
const ADS_KEY = 'makememoney_ads_v1';
const TIMER_KEY = 'makememoney_elapsed_v1';
const TIMER_START_KEY = 'makememoney_last_start_v1';
const TIMER_RUNNING_KEY = 'makememoney_running_v1';

const slogans = [
  'Buy faster. Spend harder.',
  'Limited time forever sale!',
  "World's #1 impulse buy.",
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
let baseElapsed = 0;
let lastStartMs = null;
let editMode = false;
let ads = [];

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

function generateRandomAd() {
  return {
    tag: randomItem(tags),
    headline: randomItem(products),
    copy: randomItem(slogans),
    price: randomItem(priceTags),
    bg: randomItem(gradients)
  };
}

function createDefaultAds(count = 120) {
  return Array.from({ length: count }, generateRandomAd);
}

function loadAds() {
  try {
    const stored = localStorage.getItem(ADS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_err) {
    // ignore parse errors and fall back
  }
  return createDefaultAds();
}

function saveAds() {
  localStorage.setItem(ADS_KEY, JSON.stringify(ads));
}

function renderAds() {
  adWall.innerHTML = '';
  const frag = document.createDocumentFragment();

  ads.forEach((ad, index) => {
    const card = document.createElement('div');
    card.className = 'ad';
    card.dataset.index = String(index);
    card.style.background = ad.bg || randomItem(gradients);

    card.innerHTML = `
      <button class="delete-btn" data-action="delete" title="Delete ad">x</button>
      <span class="tag">${ad.tag || ''}</span>
      <p class="headline">${ad.headline || ''}</p>
      <p class="copy">${ad.copy || ''}</p>
      <span class="price">${ad.price || ''}</span>
    `;

    frag.appendChild(card);
  });

  adWall.appendChild(frag);
  document.body.classList.toggle('edit-mode', editMode);
}

function openModal(prefill = {}) {
  tagInput.value = prefill.tag || randomItem(tags);
  headlineInput.value = prefill.headline || randomItem(products);
  copyInput.value = prefill.copy || randomItem(slogans);
  priceInput.value = prefill.price || randomItem(priceTags);
  bgInput.value = prefill.bg || randomItem(gradients);
  adModal.classList.remove('hidden');
  tagInput.focus();
}

function closeModal() {
  adModal.classList.add('hidden');
}

function loadBest() {
  const stored = Number(localStorage.getItem(SESSION_KEY) || 0);
  return Number.isFinite(stored) ? stored : 0;
}

function saveBest(seconds) {
  localStorage.setItem(SESSION_KEY, String(seconds));
}

function persistTimerState(running) {
  localStorage.setItem(TIMER_KEY, String(baseElapsed));
  localStorage.setItem(TIMER_RUNNING_KEY, running ? '1' : '0');
  if (running && lastStartMs) {
    localStorage.setItem(TIMER_START_KEY, String(lastStartMs));
  } else {
    localStorage.removeItem(TIMER_START_KEY);
  }
}

function computeElapsed() {
  const now = Date.now();
  const live = lastStartMs ? Math.floor((now - lastStartMs) / 1000) : 0;
  return baseElapsed + live;
}

function updateTimers() {
  sessionSeconds = computeElapsed();
  const formatted = formatSeconds(sessionSeconds);
  sessionTimeEl.textContent = formatted;
  clockDisplay.textContent = formatted;
  const best = loadBest();
  bestTimeEl.textContent = best > 0 ? formatSeconds(best) : '--';
}

function startTimer(resume = false) {
  if (tickInterval) return;
  if (!resume) {
    baseElapsed = computeElapsed(); // ensure base up to date
  }
  lastStartMs = Date.now();
  persistTimerState(true);
  tickInterval = setInterval(() => {
    updateTimers();
    const best = loadBest();
    if (sessionSeconds > best) {
      saveBest(sessionSeconds);
    }
  }, 1000);
}

function stopTimer() {
  if (!tickInterval) return;
  baseElapsed = computeElapsed();
  clearInterval(tickInterval);
  tickInterval = null;
  lastStartMs = null;
  persistTimerState(false);
  const best = loadBest();
  if (sessionSeconds > best) {
    saveBest(sessionSeconds);
  }
  sessionSeconds = baseElapsed;
  updateTimers();
}

function resetTimer() {
  baseElapsed = 0;
  lastStartMs = Date.now();
  persistTimerState(true);
  updateTimers();
  if (!tickInterval) startTimer(true);
}

function exportAds() {
  const json = JSON.stringify(ads, null, 2);
  navigator.clipboard
    .writeText(json)
    .then(() => alert('Copied ads JSON to clipboard.'))
    .catch(() => alert('Could not copy automatically. Here is your JSON:\n' + json));
}

function init() {
  ads = loadAds();
  renderAds();

  // Restore timer state
  const storedElapsed = Number(localStorage.getItem(TIMER_KEY) || 0);
  const storedStart = Number(localStorage.getItem(TIMER_START_KEY) || 0);
  const storedRunning = localStorage.getItem(TIMER_RUNNING_KEY) === '1';
  baseElapsed = Number.isFinite(storedElapsed) ? storedElapsed : 0;
  if (storedRunning && storedStart) {
    lastStartMs = storedStart;
    updateTimers();
    startTimer(true);
  } else {
    lastStartMs = null;
    updateTimers();
    startTimer();
  }

  resetBtn.addEventListener('click', resetTimer);

  editToggle.addEventListener('click', () => {
    editMode = !editMode;
    editToggle.textContent = editMode ? 'Done editing' : 'Edit ads';
    renderAds();
  });

  addAdBtn.addEventListener('click', () => openModal());
  modalClose.addEventListener('click', closeModal);
  cancelModal.addEventListener('click', closeModal);

  adForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newAd = {
      tag: tagInput.value.trim() || 'Ad',
      headline: headlineInput.value.trim() || 'Your Ad Here',
      copy: copyInput.value.trim() || 'Click now.',
      price: priceInput.value.trim() || '$99',
      bg: bgInput.value.trim() || randomItem(gradients)
    };
    ads.unshift(newAd);
    saveAds();
    renderAds();
    closeModal();
  });

  adWall.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.dataset.action === 'delete' && editMode) {
      const card = target.closest('.ad');
      const index = card ? Number(card.dataset.index) : -1;
      if (index >= 0) {
        ads.splice(index, 1);
        saveAds();
        renderAds();
      }
    }
  });

  exportBtn.addEventListener('click', exportAds);

  resetAdsBtn.addEventListener('click', () => {
    if (confirm('Reset ads to default set?')) {
      ads = createDefaultAds();
      saveAds();
      renderAds();
    }
  });

  window.addEventListener('beforeunload', stopTimer);
}

init();
