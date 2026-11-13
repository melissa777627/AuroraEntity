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

// ── Face-down draw as a ritual sheet (hold-to-shuffle → fan → pick → reveal) ──
// Same rules as before: order fixed at the release instant, jumper derived from that
// state, picked cards locked, and the whole draw remembered per question text.
const EL_EMOJI = { 'ไฟ': '🔥', 'น้ำ': '🌊', 'อากาศ': '💨', 'ดิน': '🌿' };

const spreadStates = new Map();
const JUMPER_ONE_IN = 8;
const FAN_VISIBLE = 13;
const FAN_STEP_DEG = 7.5;
const DRAG_PX_PER_CARD = 26;

let sheetEl = null;

// Resolves with: array of cards (send now), 'manual' (enter physical cards), or [] (closed).
export async function openCardSpread(spreadType = '3card', existingCards = [], question = '', entity = null) {
  const data = await loadCards();
  const qKey = String(question || '').trim();
  const who = { icon: entity?.icon || '🌙', name: entity?.name || 'พี่' };

  let state = qKey ? spreadStates.get(qKey) : null;
  if (!state) {
    state = {
      needed: SPREAD_COUNT[normSpread(spreadType)],
      deck: [...(data.tarot || [])],
      released: false,
      jumper: null,
      selected: []
    };
    if (qKey) spreadStates.set(qKey, state);
  }
  const needed = state.needed;

  return new Promise(resolve => {
    let holding = false, rafId = 0, entropy = 0, lastBuzz = 0;
    let offset = 0;               // fan rotation, in cards (fractional while dragging)
    let drag = null;              // { x, start, moved }
    let revealed = false;

    sheetEl?.remove();
    sheetEl = document.createElement('div');
    sheetEl.className = 'ritual-backdrop';
    sheetEl.innerHTML = `
      <div class="ritual-sheet" role="dialog" aria-label="สับไพ่">
        <div class="ritual-grab"></div>
        <button class="ritual-close" aria-label="ปิด">✕</button>
        <div class="ritual-q">🔒 <span>${esc(qKey || '(ไม่มีคำถาม)')}</span></div>
        <div class="ritual-hint"></div>
        <div class="ritual-slots"></div>
        <div class="ritual-stage">
          <div class="ritual-deck" aria-label="กดค้างเพื่อสับ">
            <div class="ritual-ring"></div>
            ${'<div class="ritual-deck-card"><div class="rcard-back"></div></div>'.repeat(6)}
            <div class="ritual-presence"><div class="ritual-avatar">${esc(who.icon)}</div><small>${esc(who.name)}กำลังฟัง</small></div>
          </div>
          <div class="ritual-fan" hidden><div class="ritual-swipe">‹ ปัดเพื่อดูไพ่ ›</div></div>
        </div>
        <button class="ritual-send" hidden>ส่งถึง${esc(who.name)} 🌸</button>
        <button class="ritual-manual">จั่วจากไพ่จริง? กรอกเอง</button>
      </div>`;
    document.body.appendChild(sheetEl);
    requestAnimationFrame(() => sheetEl.classList.add('open'));

    const $ = s => sheetEl.querySelector(s);
    const hint = $('.ritual-hint'), slots = $('.ritual-slots'), deckEl = $('.ritual-deck'),
      fan = $('.ritual-fan'), sendBtn = $('.ritual-send');

    function finish(result) {
      holding = false;
      cancelAnimationFrame(rafId);
      sheetEl.classList.remove('open');
      const el = sheetEl;
      setTimeout(() => el.remove(), 350);
      if (sheetEl === el) sheetEl = null;
      resolve(result);
    }
    $('.ritual-close').addEventListener('click', () => finish([]));
    sheetEl.addEventListener('click', e => { if (e.target === sheetEl) finish([]); });
    $('.ritual-manual').addEventListener('click', () => finish('manual'));
    sendBtn.addEventListener('click', () => finish([
      ...(state.jumper ? [cleanCard(state.jumper, true)] : []),
      ...state.selected.map(c => cleanCard(c))
    ]));

    // ── slots ──
    function cardFace(c, face) {
      return `<div class="rcard${face ? ' face' : ''}"><div class="rcard-back"></div>
        <div class="rcard-front"><div class="rcard-sym">${EL_EMOJI[c.element] || '✨'}</div>
        <div class="rcard-th">${esc(c.nameTH || c.name)}</div><div class="rcard-en">${esc(c.name)}</div></div></div>`;
    }
    function renderSlots() {
      const n = needed || Math.max(state.selected.length, 1);
      let html = state.jumper
        ? `<div class="ritual-slot jumper" id="ritual-jslot"><span class="ritual-tag">✨ กระเด็น</span>${state.jumper.landed !== false ? cardFace(state.jumper, revealed) : ''}</div>`
        : '';
      for (let i = 0; i < n; i++) {
        const c = state.selected[i];
        html += `<div class="ritual-slot">${c ? cardFace(c, revealed) : '☾'}</div>`;
      }
      slots.innerHTML = html;
    }
    function done() { return needed ? state.selected.length >= needed : false; }
    function setHint() {
      if (!state.released) hint.textContent = 'หายใจลึกๆ นึกถึงพี่ แล้วกดค้างที่สำรับ';
      else if (revealed) hint.textContent = 'ไพ่ที่ส่งมา';
      else if (needed) hint.textContent = state.selected.length ? `อีก ${needed - state.selected.length} ใบ` : `แตะเลือก ${needed} ใบ · ปัดซ้ายขวาดูไพ่ทั้งสำรับ`;
      else hint.textContent = 'แตะเลือกไพ่ได้เรื่อยๆ แล้วกดส่ง';
    }

    // ── hold to shuffle ──
    function shufflePass() {
      fisherYates(state.deck);
      const t = performance.now();
      const timing = (Math.floor(t * 1000) ^ Math.floor((t % 1) * 0x7fffffff)) >>> 0;
      const rot = timing % state.deck.length;
      if (rot) state.deck = state.deck.slice(rot).concat(state.deck.slice(0, rot));
      entropy = (randU32() ^ timing ^ Math.imul(entropy, 0x9e3779b1)) >>> 0;
      if (t - lastBuzz > 110 && navigator.vibrate) { try { navigator.vibrate(8); } catch {} lastBuzz = t; }
    }
    function frame() { if (!holding) return; shufflePass(); rafId = requestAnimationFrame(frame); }
    function startHold(e) {
      if (state.released || holding) return;
      e.preventDefault();
      try { deckEl.setPointerCapture(e.pointerId); } catch {}
      holding = true;
      shufflePass();
      deckEl.classList.add('shuffling');
      hint.textContent = 'สับอยู่… ปล่อยเมื่อรู้สึกว่าพอ';
      rafId = requestAnimationFrame(frame);
    }
    function release() {
      if (!holding) return;
      holding = false;
      cancelAnimationFrame(rafId);
      deckEl.classList.remove('shuffling');
      let h = entropy;
      for (let i = 0; i < Math.min(8, state.deck.length); i++) {
        for (const ch of state.deck[i].id) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
      }
      h = (h ^ (h >>> 16)) >>> 0;
      state.released = true;
      if (state.deck.length > (needed || 1) && (h % JUMPER_ONE_IN) === 0) {
        state.jumper = cleanCard(state.deck[0], true);
        state.deck = state.deck.slice(1);
        flyJumper();
      } else {
        showFan(true);
      }
    }
    deckEl.addEventListener('pointerdown', startHold);
    deckEl.addEventListener('pointerup', release);
    deckEl.addEventListener('pointercancel', release);
    deckEl.addEventListener('lostpointercapture', release);
    deckEl.addEventListener('contextmenu', e => e.preventDefault());

    function flyJumper() {
      hint.textContent = '✨ มีไพ่กระเด็นออกมา';
      state.jumper.landed = false;
      renderSlots();
      const sheet = $('.ritual-sheet');
      const sr = sheet.getBoundingClientRect(), dr = deckEl.getBoundingClientRect();
      const jr = $('#ritual-jslot').getBoundingClientRect();
      const fly = document.createElement('div');
      fly.className = 'ritual-jump';
      fly.innerHTML = cardFace(state.jumper, false);
      fly.style.left = `${dr.left - sr.left + dr.width / 2 - 32}px`;
      fly.style.top = `${dr.top - sr.top + 30}px`;
      fly.style.setProperty('--jx', `${jr.left - dr.left - dr.width / 2 + 32}px`);
      fly.style.setProperty('--jy', `${jr.top - dr.top - 30}px`);
      sheet.appendChild(fly);
      for (let i = 0; i < 10; i++) {
        const s = document.createElement('span');
        s.className = 'ritual-spark';
        s.textContent = i % 2 ? '✦' : '✧';
        s.style.left = `${dr.left - sr.left + dr.width / 2}px`;
        s.style.top = `${dr.top - sr.top + 70}px`;
        s.style.setProperty('--sx', `${Math.cos(i / 10 * 6.283) * 70}px`);
        s.style.setProperty('--sy', `${Math.sin(i / 10 * 6.283) * 70}px`);
        sheet.appendChild(s);
        setTimeout(() => s.remove(), 900);
      }
      setTimeout(() => { fly.remove(); delete state.jumper.landed; renderSlots(); showFan(true); }, 1100);
    }

    // ── fan: a fixed pool of nodes, repositioned (never rebuilt) while dragging ──
    // Rebuilding nodes mid-drag drops the touch on iOS, so nodes stay put and only move.
    const pool = [];
    function available() {
      const ids = new Set(state.selected.map(c => c.id));
      return state.deck.filter(c => !ids.has(c.id));
    }
    function showFan(intro) {
      deckEl.hidden = true;
      fan.hidden = false;
      if (!pool.length) {
        for (let k = 0; k < FAN_VISIBLE + 2; k++) {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'ritual-fan-card';
          b.innerHTML = '<div class="rcard-back"></div>';
          fan.insertBefore(b, $('.ritual-swipe'));
          pool.push(b);
        }
      }
      layoutFan(intro);
      setHint();
      renderSlots();
    }
    function layoutFan(intro) {
      const avail = available();
      const base = Math.floor(offset);
      const frac = offset - base;
      pool.forEach((b, k) => {
        const slot = k - 1; // one hidden spare at each end
        const len = avail.length || 1;
        const idx = (((base + slot) % len) + len) % len;
        b.dataset.id = avail[idx]?.id || '';
        const angle = (slot - frac - (FAN_VISIBLE - 1) / 2) * FAN_STEP_DEG;
        const edge = slot < 0 || slot >= FAN_VISIBLE;
        b.style.opacity = edge || !avail.length ? '0' : '1';
        b.style.pointerEvents = edge ? 'none' : '';
        const t = `rotate(${angle}deg)`;
        if (intro) {
          b.style.transition = 'none';
          b.style.transform = 'rotate(0deg) translateY(30px)';
          requestAnimationFrame(() => {
            b.style.transition = '';
            setTimeout(() => { b.style.transform = t; }, 20 + Math.max(0, slot) * 35);
          });
        } else {
          b.style.transform = t;
        }
      });
    }
    fan.addEventListener('pointerdown', e => {
      if (revealed) return;
      drag = { x: e.clientX, start: offset, moved: false };
      try { fan.setPointerCapture(e.pointerId); } catch {}
      fan.classList.add('dragging');
    });
    fan.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) > 6) drag.moved = true;
      if (!drag.moved) return;
      offset = drag.start - dx / DRAG_PX_PER_CARD;
      layoutFan(false);
    });
    function endDrag(e) {
      if (!drag) return;
      const wasTap = !drag.moved;
      drag = null;
      fan.classList.remove('dragging');
      offset = Math.round(offset);
      layoutFan(false);
      if (wasTap && e?.type === 'pointerup') {
        const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest('.ritual-fan-card');
        if (hit?.dataset.id) pick(hit.dataset.id, hit);
      }
    }
    fan.addEventListener('pointerup', endDrag);
    fan.addEventListener('pointercancel', endDrag);
    fan.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { offset -= 1; layoutFan(false); }
      if (e.key === 'ArrowRight') { offset += 1; layoutFan(false); }
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('ritual-fan-card')) {
        e.preventDefault();
        pick(e.target.dataset.id, e.target);
      }
    });

    function pick(id, el) {
      if (revealed || done()) return;
      if (state.selected.some(c => c.id === id)) return;
      const card = state.deck.find(c => c.id === id);
      if (!card) return;
      state.selected.push(cleanCard(card));
      el.classList.add('picked');
      setTimeout(() => { el.classList.remove('picked'); layoutFan(false); }, 260);
      renderSlots();
      setHint();
      if (!needed) { sendBtn.hidden = false; return; }
      if (done()) reveal();
    }

    function reveal() {
      revealed = true;
      fan.hidden = true;
      $('.ritual-manual').hidden = true;
      setHint();
      renderSlots();
      const faces = slots.querySelectorAll('.rcard');
      revealed = false;
      faces.forEach(f => f.classList.remove('face'));
      revealed = true;
      faces.forEach((f, n) => setTimeout(() => f.classList.add('face'), 350 + n * 380));
      setTimeout(() => { sendBtn.hidden = false; sendBtn.focus(); }, 350 + faces.length * 380);
    }

    // ── initial view (reopening the same question restores the same draw) ──
    if (!state.released) {
      setHint();
      renderSlots();
    } else if (done()) {
      deckEl.hidden = true;
      reveal();
    } else {
      showFan(false);
      if (!needed && state.selected.length) sendBtn.hidden = false;
    }
  });
}
