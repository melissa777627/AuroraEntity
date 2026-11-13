let cardsData = null;
let resolveCallback = null;
let currentSpread = '3card';
let picked = [];          // manual picker: ordered card objects (may include jumper:true)
let jumperNext = false;   // manual picker: next tapped card is a jumper

// Spreads have no positional meanings — every card simply answers the question.
// Value = number of cards to draw (0 = unlimited / custom).
const SPREAD_COUNT = { '1card': 1, '3card': 3, 'custom': 0 };
const SPREAD_LABEL = { '1card': '1 ใบ', '3card': '3 ใบ', 'custom': 'Custom' };

function normSpread(t) {
  return Object.prototype.hasOwnProperty.call(SPREAD_COUNT, t) ? t : '3card'; // e.g. legacy 'celtic'
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Copy a card for output: strip reversed/position data, optionally mark jumper.
function cleanCard(c, jumper = false) {
  const { reversed, orientation, position_label, jumper: _j, ...rest } = c;
  const out = { ...rest, position_label: '' };
  if (jumper) out.jumper = true;
  return out;
}

// ── Unbiased crypto randomness ─────────────────────────────────
const _u32 = new Uint32Array(1);
function randU32() { crypto.getRandomValues(_u32); return _u32[0]; }
function randBelow(n) {
  const limit = Math.floor(0x100000000 / n) * n;
  let x;
  do { x = randU32(); } while (x >= limit);
  return x % n;
}
function fisherYates(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randBelow(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function loadCards() {
  if (cardsData) return cardsData;
  const res = await fetch('data/cards.json');
  cardsData = await res.json();
  return cardsData;
}

// ── Manual picker (physical deck entry) ────────────────────────
export async function openCardPicker(defaultSpread = '3card', existingCards = []) {
  currentSpread = normSpread(defaultSpread);
  picked = (existingCards || []).filter(Boolean).map(c => cleanCard(c, !!c.jumper));
  jumperNext = false;

  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="modal modal-lg card-picker-modal">
      <div class="modal-header">
        <span class="modal-title">🃏 เลือกไพ่</span>
        <button class="btn-icon" id="close-picker">✕</button>
      </div>

      <div class="spread-selector">
        ${Object.entries(SPREAD_LABEL)
          .map(([k,v]) => `<button class="spread-btn${currentSpread===k?' active':''}" data-spread="${k}">${v}</button>`).join('')}
        <button class="spread-btn jumper-next-btn" id="jumper-next-btn" title="ใบที่จะเลือกถัดไปคือไพ่ที่กระเด็นออกมาตอนสับ">✨ ไพ่กระเด็น</button>
      </div>

      <div id="spread-positions" class="spread-positions"></div>

      <div class="card-picker-search-bar">
        <input type="search" class="input" id="card-search-input" placeholder="🔍 ค้นหาชื่อไพ่...">
        <div class="card-filter-chips" id="filter-chips">
          ${['ทั้งหมด','Major','Wands','Cups','Swords','Pentacles','Oracle'].map(f =>
            `<button class="filter-chip${f==='ทั้งหมด'?' active':''}" data-filter="${f}">${f}</button>`
          ).join('')}
        </div>
      </div>
      <div class="card-grid-wrapper">
        <div class="card-grid" id="card-grid"><div class="analysis-loading"><div class="spinner"></div>กำลังโหลด...</div></div>
      </div>

      <div class="modal-footer">
        <span id="selection-count" style="font-size:0.82rem;color:var(--text-soft);margin-right:auto"></span>
        <button class="btn btn-ghost" id="clear-picker">ล้าง</button>
        <button class="btn btn-secondary" id="cancel-picker">ยกเลิก</button>
        <button class="btn btn-primary" id="confirm-picker">✅ ยืนยัน</button>
      </div>
    </div>`;

  overlay.querySelector('#close-picker').addEventListener('click', cancelPicker);
  overlay.querySelector('#cancel-picker').addEventListener('click', cancelPicker);
  overlay.addEventListener('click', e => { if (e.target === overlay) cancelPicker(); });

  overlay.querySelectorAll('.spread-btn[data-spread]').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.spread-btn[data-spread]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSpread = btn.dataset.spread;
      picked = [];
      rerenderPicker();
    });
  });

  overlay.querySelector('#jumper-next-btn').addEventListener('click', () => {
    jumperNext = !jumperNext;
    renderJumperBtn();
  });

  let currentFilter = 'ทั้งหมด';
  overlay.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      overlay.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilter = chip.dataset.filter;
      renderCards(currentFilter, overlay.querySelector('#card-search-input').value);
    });
  });

  overlay.querySelector('#card-search-input').addEventListener('input', e => {
    renderCards(currentFilter, e.target.value);
  });

  overlay.querySelector('#clear-picker').addEventListener('click', () => {
    picked = [];
    jumperNext = false;
    rerenderPicker();
  });

  overlay.querySelector('#confirm-picker').addEventListener('click', () => {
    const result = picked.map(c => cleanCard(c, !!c.jumper));
    const cb = resolveCallback;
    cleanup();
    cb?.(result);
  });

  renderPositions();
  renderJumperBtn();
  await loadCards();
  renderCards('ทั้งหมด', '');
  renderCount();

  return new Promise(resolve => { resolveCallback = resolve; });
}

function mainCount() { return picked.filter(c => !c.jumper).length; }

function rerenderPicker() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  renderPositions();
  renderJumperBtn();
  renderCards(overlay.querySelector('.filter-chip.active')?.dataset.filter || 'ทั้งหมด', overlay.querySelector('#card-search-input')?.value || '');
  renderCount();
}

function renderJumperBtn() {
  const btn = document.getElementById('modal-overlay')?.querySelector('#jumper-next-btn');
  if (btn) btn.classList.toggle('active', jumperNext);
}

function renderPositions() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  const container = overlay.querySelector('#spread-positions');
  if (!container) return;
  const needed = SPREAD_COUNT[currentSpread];

  const chips = picked.map((c, i) => `
    <div class="position-slot filled${c.jumper ? ' jumper' : ''}" data-idx="${i}">
      ${c.jumper ? '<span class="position-label">✨ ไพ่กระเด็น</span>' : ''}
      <span class="position-card">${esc(c.name || '')}</span>
      <span class="slot-actions">
        <button class="slot-btn slot-jumper" data-idx="${i}" title="ทำเครื่องหมายว่าเป็นไพ่กระเด็น">✨</button>
        <button class="slot-btn slot-remove" data-idx="${i}" title="เอาออก">×</button>
      </span>
    </div>`);

  const empties = needed ? Math.max(0, needed - mainCount()) : 0;
  for (let i = 0; i < empties; i++) chips.push(`<div class="position-slot"><span class="position-card">—</span></div>`);

  container.innerHTML = chips.join('') ||
    `<div style="font-size:0.8rem;color:var(--text-soft)">กดไพ่ในตาราง เพื่อเพิ่ม — ไม่จำกัดจำนวน</div>`;

  container.querySelectorAll('.slot-jumper').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const c = picked[+btn.dataset.idx];
      if (!c) return;
      // Un-marking a jumper turns it into a main card — only if there's room
      if (c.jumper && needed && mainCount() >= needed) return;
      picked[+btn.dataset.idx] = { ...c, jumper: !c.jumper };
      rerenderPicker();
    });
  });
  container.querySelectorAll('.slot-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      picked.splice(+btn.dataset.idx, 1);
      rerenderPicker();
    });
  });
}

function renderCards(filter, search) {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay || !cardsData) return;
  const grid = overlay.querySelector('#card-grid');
  if (!grid) return;

  let cards = [...(cardsData.tarot || []), ...(cardsData.oracle || [])];

  if (filter !== 'ทั้งหมด') {
    if (filter === 'Major') cards = cards.filter(c => c.suit === 'Major');
    else if (filter === 'Oracle') cards = cards.filter(c => c.category === 'Oracle');
    else cards = cards.filter(c => c.suit === filter);
  }

  if (search.trim()) {
    const q = search.toLowerCase();
    cards = cards.filter(c =>
      c.name.toLowerCase().includes(q) || (c.nameTH || '').includes(q) ||
      (c.keywords || []).some(k => k.includes(q))
    );
  }

  const usedIds = picked.map(c => c.id);

  grid.innerHTML = cards.map(card => `
    <div class="card-item${usedIds.includes(card.id) ? ' selected' : ''}" data-id="${card.id}">
      <div class="card-item-name">${card.name}</div>
      <div class="card-item-nameTH">${card.nameTH || ''}</div>
      <span class="card-item-element">${card.element || ''}</span>
    </div>
  `).join('') || `<div class="analysis-loading" style="grid-column:1/-1">ไม่พบไพ่ที่ตรงกัน</div>`;

  grid.querySelectorAll('.card-item').forEach(el => {
    el.addEventListener('click', () => toggleCard(cards, el.dataset.id));
  });
}

function toggleCard(cards, cardId) {
  const card = cards.find(c => c.id === cardId);
  if (!card) return;

  const existing = picked.findIndex(c => c.id === cardId);
  if (existing !== -1) {
    picked.splice(existing, 1);
  } else if (jumperNext) {
    picked.push(cleanCard(card, true));
    jumperNext = false;
  } else {
    const needed = SPREAD_COUNT[currentSpread];
    if (needed && mainCount() >= needed) return; // all slots full
    picked.push(cleanCard(card));
  }
  rerenderPicker();
}

function renderCount() {
  const overlay = document.getElementById('modal-overlay');
  const el = overlay?.querySelector('#selection-count');
  if (!el) return;
  const jumpers = picked.length - mainCount();
  el.textContent = picked.length
    ? `เลือกแล้ว ${mainCount()} ใบ${jumpers ? ` + ไพ่กระเด็น ${jumpers}` : ''}`
    : '';
}

function cancelPicker() {
  const cb = resolveCallback;
  cleanup();
  cb?.([]);
}

function cleanup() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) { overlay.classList.add('hidden'); overlay.innerHTML = ''; }
  resolveCallback = null;
}

// ── Face-down card spread (hold-to-shuffle) ────────────────────
const EL_EMOJI = { 'ไฟ': '🔥', 'น้ำ': '🌊', 'อากาศ': '💨', 'ดิน': '🌿' };
const EL_COLOR = { 'ไฟ': '#ff9050', 'น้ำ': '#5bc8ef', 'อากาศ': '#b39ddb', 'ดิน': '#66bb6a' };

// One question, one draw: released deck + jumper + flipped cards are kept per question text.
const spreadStates = new Map();

// Jumper chance ≈ 1 in 8, decided only from the state captured at the release instant.
const JUMPER_ONE_IN = 8;

export async function openCardSpread(spreadType = '3card', existingCards = [], question = '') {
  const data = await loadCards();
  const qKey = String(question || '').trim();

  let state = qKey ? spreadStates.get(qKey) : null;
  if (!state) {
    const pre = (existingCards || []).filter(Boolean);
    const preMain = pre.filter(c => !c.jumper).map(c => cleanCard(c));
    const preJumper = pre.find(c => c.jumper);
    const usedIds = new Set(pre.map(c => c.id));
    state = {
      needed: SPREAD_COUNT[normSpread(spreadType)],
      deck: (data.tarot || []).filter(c => !usedIds.has(c.id)), // order fixed only on release
      released: false,
      jumper: preJumper ? cleanCard(preJumper, true) : null,
      selected: preMain
    };
    if (qKey) spreadStates.set(qKey, state);
  }
  const needed = state.needed;

  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');

  // Hold-to-shuffle runtime (not persisted)
  let holding = false;
  let rafId = 0;
  let passes = 0;
  let entropy = 0;   // 32-bit pool, updated every frame (crypto ⊕ timing)

  function shufflePass() {
    fisherYates(state.deck);
    const t = performance.now();
    const timing = (Math.floor(t * 1000) ^ Math.floor((t % 1) * 0x7fffffff)) >>> 0;
    // Rotating a uniformly shuffled deck by a timing-derived offset keeps it uniform
    const rot = timing % state.deck.length;
    if (rot) state.deck = state.deck.slice(rot).concat(state.deck.slice(0, rot));
    entropy = (randU32() ^ timing ^ Math.imul(entropy, 0x9e3779b1)) >>> 0;
    passes++;
  }

  function frame() {
    if (!holding) return;
    shufflePass();
    const counter = overlay.querySelector('#shuffle-count');
    if (counter) counter.textContent = `สับแล้ว ${passes} รอบ`;
    rafId = requestAnimationFrame(frame);
  }

  function startHold(e) {
    if (state.released || holding) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
    holding = true;
    shufflePass(); // at least one pass even on a quick tap
    overlay.querySelector('.card-spread-modal')?.classList.add('shuffling');
    rafId = requestAnimationFrame(frame);
  }

  function release() {
    if (!holding) return;
    holding = false;
    cancelAnimationFrame(rafId);
    // Final state = exactly what the deck looked like at release. Jumper is derived from it.
    let h = entropy;
    for (let i = 0; i < Math.min(8, state.deck.length); i++) {
      for (const ch of state.deck[i].id) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
    }
    h = (h ^ (h >>> 16)) >>> 0;
    if (!state.jumper && state.deck.length > needed && (h % JUMPER_ONE_IN) === 0) {
      state.jumper = cleanCard(state.deck[0], true); // top card flies out
      state.deck = state.deck.slice(1);
    }
    state.released = true;
    state.justJumped = !!state.jumper;
    render();
  }

  function close(result) {
    holding = false;
    cancelAnimationFrame(rafId);
    const cb = resolveCallback;
    cleanup();
    cb?.(result);
  }

  function chip(c, label) {
    const color = EL_COLOR[c.element] || '#b39ddb';
    return `<div class="spread-sel-chip${c.jumper ? ' jumper' : ''}" data-id="${c.id}" style="--chip-color:${color}">
      <span>${EL_EMOJI[c.element] || '✨'}</span>
      <div>
        ${label ? `<div class="spread-sel-label">${label}</div>` : ''}
        <div class="spread-sel-name">${esc(c.nameTH || c.name)}</div>
      </div>
      <span class="spread-sel-lock" title="ล็อกแล้ว">🔒</span>
    </div>`;
  }

  function render() {
    const selIds = new Set(state.selected.map(c => c.id));
    const done = needed && state.selected.length >= needed;
    const canConfirm = needed ? state.selected.length >= needed : state.selected.length > 0;

    let hint;
    if (!state.released && !done) hint = 'กดค้างเพื่อสับ · ปล่อยเมื่อรู้สึกว่าพอ';
    else if (!done) hint = `แตะไพ่ที่คว่ำหน้าเพื่อเปิด${needed ? ` (ต้องการ ${needed} ใบ)` : ''} · เปิดแล้วเปลี่ยนไม่ได้`;
    else hint = 'ครบแล้ว 🔒';

    overlay.innerHTML = `
      <div class="modal modal-lg card-spread-modal${state.released ? ' released' : ''}">
        <div class="modal-header">
          <span class="modal-title">✨ เลือกไพ่จากเดค</span>
          <button class="btn-icon" id="spread-close">✕</button>
        </div>

        ${qKey ? `<div class="spread-question">🔒 <span>${esc(qKey)}</span></div>` : ''}

        ${state.jumper ? `
          <div class="spread-jumper${state.justJumped ? ' just-jumped' : ''}">
            <div class="spread-jumper-title">✨ มีไพ่กระเด็นออกมา</div>
            ${chip(state.jumper, 'ไพ่กระเด็น')}
          </div>` : ''}

        <div class="spread-selected-row" id="spread-selected-row">
          ${state.selected.length === 0
            ? `<span class="spread-hint">${hint}</span>`
            : state.selected.map(c => chip(c, '')).join('') + `<span class="spread-hint">${done ? 'ครบแล้ว 🔒' : ''}</span>`}
        </div>

        ${!state.released && !done ? `
          <div class="shuffle-zone">
            <button class="shuffle-btn" id="shuffle-btn" type="button">
              <span class="shuffle-deck"><span></span><span></span><span></span></span>
              <span class="shuffle-btn-text">กดค้างเพื่อสับ · ปล่อยเมื่อรู้สึกว่าพอ</span>
              <span class="shuffle-count" id="shuffle-count"></span>
            </button>
          </div>` : ''}

        <div class="card-spread-grid${state.released ? '' : ' locked'}" id="card-spread-grid">
          ${state.deck.map(card => {
            const isFlipped = selIds.has(card.id);
            const color = EL_COLOR[card.element] || '#b39ddb';
            return `<div class="spread-card${isFlipped ? ' flipped selected' : ''}" data-id="${card.id}">
              <div class="spread-card-inner">
                <div class="spread-card-back"></div>
                <div class="spread-card-front" style="--card-color:${color}">
                  <div class="spread-front-el">${EL_EMOJI[card.element] || '✨'}</div>
                  <div class="spread-front-name">${isFlipped ? esc(card.nameTH || card.name) : ''}</div>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>

        <div class="modal-footer">
          <span style="font-size:0.82rem;color:var(--text-soft);margin-right:auto">
            ${needed ? `${state.selected.length}/${needed} ใบ` : `${state.selected.length} ใบ`}${state.jumper ? ' + ✨1' : ''}
          </span>
          <button class="btn btn-ghost" id="spread-cancel">ยกเลิก</button>
          <button class="btn btn-primary" id="spread-confirm" ${canConfirm ? '' : 'disabled'}>✅ ยืนยัน</button>
        </div>
      </div>`;
    state.justJumped = false;

    overlay.querySelector('#spread-close').addEventListener('click', () => close([]));
    overlay.querySelector('#spread-cancel').addEventListener('click', () => close([]));

    overlay.querySelector('#spread-confirm').addEventListener('click', () => {
      const result = [
        ...(state.jumper ? [cleanCard(state.jumper, true)] : []),
        ...state.selected.map(c => cleanCard(c))
      ];
      close(result);
    });

    const btn = overlay.querySelector('#shuffle-btn');
    if (btn) {
      btn.addEventListener('pointerdown', startHold);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
      btn.addEventListener('contextmenu', e => e.preventDefault());
      // Fallback for browsers without pointer events
      if (!window.PointerEvent) {
        btn.addEventListener('touchstart', startHold, { passive: false });
        btn.addEventListener('touchend', release);
        btn.addEventListener('touchcancel', release);
        btn.addEventListener('mousedown', startHold);
        btn.addEventListener('mouseup', release);
        btn.addEventListener('mouseleave', release);
      }
    }

    overlay.querySelectorAll('.spread-card').forEach(el => {
      el.addEventListener('click', () => {
        if (!state.released) return;                       // must shuffle first
        const id = el.dataset.id;
        if (state.selected.some(c => c.id === id)) return;  // flipped cards are locked
        if (needed && state.selected.length >= needed) return;
        const card = state.deck.find(c => c.id === id);
        if (!card) return;
        state.selected.push(cleanCard(card));
        render();
      });
    });
  }

  render();
  return new Promise(resolve => { resolveCallback = resolve; });
}
