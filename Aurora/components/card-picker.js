let cardsData = null;
let resolveCallback = null;
let currentSpread = '3card';
let selectedSlots = {};
let activeSlot = null;

const SPREADS = {
  '1card':  [{ label: 'ไพ่' }],
  '3card':  [{ label: 'อดีต' }, { label: 'ปัจจุบัน' }, { label: 'อนาคต' }],
  'celtic': [
    { label: 'ปัจจุบัน' }, { label: 'ความท้าทาย' }, { label: 'พื้นฐาน' },
    { label: 'ผ่านมา' }, { label: 'มงกุฎ' }, { label: 'อนาคต' },
    { label: 'ตัวเอง' }, { label: 'สิ่งแวดล้อม' }, { label: 'ความหวัง/กลัว' }, { label: 'ผลลัพธ์' }
  ],
  'custom': []
};

async function loadCards() {
  if (cardsData) return cardsData;
  const res = await fetch('data/cards.json');
  cardsData = await res.json();
  return cardsData;
}

export async function openCardPicker(defaultSpread = '3card', existingCards = []) {
  currentSpread = defaultSpread;
  selectedSlots = {};
  activeSlot = null;

  // Pre-fill existing
  existingCards.forEach((c, i) => { if (c) selectedSlots[i] = c; });

  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="modal modal-lg card-picker-modal">
      <div class="modal-header">
        <span class="modal-title">🃏 เลือกไพ่</span>
        <button class="btn-icon" id="close-picker">✕</button>
      </div>

      <div class="spread-selector">
        ${Object.entries({ '1card':'1 ใบ', '3card':'3 ใบ', 'celtic':'Celtic Cross', 'custom':'Custom' })
          .map(([k,v]) => `<button class="spread-btn${currentSpread===k?' active':''}" data-spread="${k}">${v}</button>`).join('')}
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

  overlay.querySelectorAll('.spread-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.spread-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSpread = btn.dataset.spread;
      selectedSlots = {};
      activeSlot = null;
      renderPositions();
      renderCount();
    });
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
    selectedSlots = {};
    activeSlot = null;
    renderPositions();
    renderCards(currentFilter, overlay.querySelector('#card-search-input').value);
    renderCount();
  });

  overlay.querySelector('#confirm-picker').addEventListener('click', () => {
    const positions = currentSpread === 'custom' ? Object.keys(selectedSlots).map(Number) : SPREADS[currentSpread].map((_, i) => i);
    const result = positions.map(i => selectedSlots[i] || null).filter(Boolean);
    const cb = resolveCallback;
    cleanup();
    cb?.(result);
  });

  renderPositions();
  await loadCards();
  renderCards('ทั้งหมด', '');
  renderCount();

  return new Promise(resolve => { resolveCallback = resolve; });
}

function renderPositions() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  const container = overlay.querySelector('#spread-positions');
  const slots = currentSpread === 'custom' ? [] : SPREADS[currentSpread];

  if (slots.length === 0 && currentSpread === 'custom') {
    container.innerHTML = `<div style="font-size:0.8rem;color:var(--text-soft)">กดไพ่ในตาราง เพื่อเพิ่ม — ไม่จำกัดจำนวน</div>`;
    return;
  }

  container.innerHTML = slots.map((pos, i) => {
    const filled = selectedSlots[i];
    return `<div class="position-slot${filled ? ' filled' : ''}${activeSlot === i ? ' active' : ''}" data-slot="${i}">
      <span class="position-label">${pos.label}</span>
      <span class="position-card">${filled ? (filled.name || '') : '—'}</span>
      ${filled?.reversed ? '<span style="font-size:0.65rem;color:var(--text-soft)">[กลับหัว]</span>' : ''}
    </div>`;
  }).join('');

  container.querySelectorAll('.position-slot').forEach(slot => {
    slot.addEventListener('click', () => {
      activeSlot = activeSlot === parseInt(slot.dataset.slot) ? null : parseInt(slot.dataset.slot);
      renderPositions();
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

  const usedIds = Object.values(selectedSlots).map(c => c?.id).filter(Boolean);

  grid.innerHTML = cards.map(card => `
    <div class="card-item${usedIds.includes(card.id) ? ' selected' : ''}" data-id="${card.id}">
      <div class="card-item-name">${card.name}</div>
      <div class="card-item-nameTH">${card.nameTH || ''}</div>
      <span class="card-item-element">${card.element || ''}</span>
      <label class="reversed-toggle" onclick="event.stopPropagation()">
        <input type="checkbox" ${selectedSlots && Object.values(selectedSlots).find(c => c?.id === card.id)?.reversed ? 'checked' : ''}
          data-card-id="${card.id}">
        กลับหัว
      </label>
    </div>
  `).join('') || `<div class="analysis-loading" style="grid-column:1/-1">ไม่พบไพ่ที่ตรงกัน</div>`;

  grid.querySelectorAll('.card-item').forEach(el => {
    el.addEventListener('click', () => toggleCard(card => card.id === el.dataset.id, cards, el.dataset.id));
  });

  grid.querySelectorAll('input[data-card-id]').forEach(chk => {
    chk.addEventListener('change', () => {
      const id = chk.dataset.cardId;
      Object.keys(selectedSlots).forEach(k => {
        if (selectedSlots[k]?.id === id) selectedSlots[k] = { ...selectedSlots[k], reversed: chk.checked };
      });
      renderPositions();
    });
  });
}

function toggleCard(finder, cards, cardId) {
  const overlay = document.getElementById('modal-overlay');
  const card = cards.find(c => c.id === cardId);
  if (!card) return;

  // Remove if already selected
  const existingSlot = Object.keys(selectedSlots).find(k => selectedSlots[k]?.id === cardId);
  if (existingSlot !== undefined) {
    delete selectedSlots[existingSlot];
    renderPositions();
    renderCards(overlay.querySelector('.filter-chip.active')?.dataset.filter || 'ทั้งหมด', overlay.querySelector('#card-search-input')?.value || '');
    renderCount();
    return;
  }

  if (currentSpread === 'custom') {
    const nextIdx = Math.max(-1, ...Object.keys(selectedSlots).map(Number)) + 1;
    selectedSlots[nextIdx] = { ...card, reversed: false, position_label: `ไพ่ ${nextIdx + 1}` };
  } else {
    const slots = SPREADS[currentSpread];
    const target = activeSlot !== null ? activeSlot : slots.findIndex((_, i) => !selectedSlots[i]);
    if (target === -1) return; // all slots full
    selectedSlots[target] = { ...card, reversed: false, position_label: slots[target]?.label || '' };
    activeSlot = slots.findIndex((_, i) => !selectedSlots[i]);
    if (activeSlot === -1) activeSlot = null;
  }

  renderPositions();
  renderCards(overlay.querySelector('.filter-chip.active')?.dataset.filter || 'ทั้งหมด', overlay.querySelector('#card-search-input')?.value || '');
  renderCount();
}

function renderCount() {
  const overlay = document.getElementById('modal-overlay');
  const el = overlay?.querySelector('#selection-count');
  if (!el) return;
  const count = Object.keys(selectedSlots).length;
  el.textContent = count ? `เลือกแล้ว ${count} ใบ` : '';
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

// ── Face-down card spread ──────────────────────────────────────
const EL_EMOJI = { 'ไฟ': '🔥', 'น้ำ': '🌊', 'อากาศ': '💨', 'ดิน': '🌿' };
const EL_COLOR = { 'ไฟ': '#ff9050', 'น้ำ': '#5bc8ef', 'อากาศ': '#b39ddb', 'ดิน': '#66bb6a' };

export async function openCardSpread(spreadType = '3card', existingCards = []) {
  const data = await loadCards();
  const pool = [...(data.tarot || [])].sort(() => Math.random() - 0.5);
  const slots = SPREADS[spreadType] || SPREADS['3card'];
  const needed = spreadType === 'custom' ? 0 : slots.length;

  let flipped = {}; // id → true
  let selected = []; // ordered array of card objects

  // pre-fill existing
  existingCards.forEach(c => { if (c) { flipped[c.id] = true; selected.push(c); } });

  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');

  function render() {
    const selIds = selected.map(c => c.id);
    overlay.innerHTML = `
      <div class="modal modal-lg card-spread-modal">
        <div class="modal-header">
          <span class="modal-title">✨ เลือกไพ่จากเดค</span>
          <button class="btn-icon" id="spread-close">✕</button>
        </div>

        <div class="spread-selected-row" id="spread-selected-row">
          ${selected.length === 0
            ? `<span class="spread-hint">แตะไพ่ที่คว่ำหน้าเพื่อเปิด${needed ? ` (ต้องการ ${needed} ใบ)` : ''}</span>`
            : selected.map((c, i) => {
                const label = slots[i]?.label || `ใบที่ ${i+1}`;
                const color = EL_COLOR[c.element] || '#b39ddb';
                return `<div class="spread-sel-chip" data-id="${c.id}" style="--chip-color:${color}">
                  <span>${EL_EMOJI[c.element] || '✨'}</span>
                  <div>
                    <div class="spread-sel-label">${label}</div>
                    <div class="spread-sel-name">${c.nameTH || c.name}</div>
                  </div>
                  <button class="spread-sel-remove" data-id="${c.id}">×</button>
                </div>`;
              }).join('')}
        </div>

        <div class="card-spread-grid" id="card-spread-grid">
          ${pool.map(card => {
            const isFlipped = !!flipped[card.id];
            const isSel = selIds.includes(card.id);
            const color = EL_COLOR[card.element] || '#b39ddb';
            return `<div class="spread-card${isFlipped ? ' flipped' : ''}${isSel ? ' selected' : ''}" data-id="${card.id}">
              <div class="spread-card-inner">
                <div class="spread-card-back"></div>
                <div class="spread-card-front" style="--card-color:${color}">
                  <div class="spread-front-el">${EL_EMOJI[card.element] || '✨'}</div>
                  <div class="spread-front-name">${card.nameTH || card.name}</div>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>

        <div class="modal-footer">
          <span style="font-size:0.82rem;color:var(--text-soft);margin-right:auto">
            ${needed ? `${selected.length}/${needed} ใบ` : `${selected.length} ใบ`}
          </span>
          <button class="btn btn-ghost" id="spread-cancel">ยกเลิก</button>
          <button class="btn btn-primary" id="spread-confirm" ${needed && selected.length < needed ? 'disabled' : ''}>✅ ยืนยัน</button>
        </div>
      </div>`;

    overlay.querySelector('#spread-close').addEventListener('click', () => { cleanup(); resolveCallback?.([]); });
    overlay.querySelector('#spread-cancel').addEventListener('click', () => { cleanup(); resolveCallback?.([]); });

    overlay.querySelector('#spread-confirm').addEventListener('click', () => {
      const result = selected.map((c, i) => ({ ...c, position_label: slots[i]?.label || `ใบที่ ${i+1}` }));
      const cb = resolveCallback;
      cleanup();
      cb?.(result);
    });

    overlay.querySelectorAll('.spread-sel-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const id = btn.dataset.id;
        selected = selected.filter(c => c.id !== id);
        delete flipped[id];
        render();
      });
    });

    overlay.querySelectorAll('.spread-card').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        const card = pool.find(c => c.id === id);
        if (!card) return;
        const isSel = selected.some(c => c.id === id);
        if (isSel) {
          selected = selected.filter(c => c.id !== id);
          delete flipped[id];
        } else {
          if (needed && selected.length >= needed) return;
          flipped[id] = true;
          selected.push({ ...card, reversed: false });
        }
        render();
      });
    });
  }

  render();
  return new Promise(resolve => { resolveCallback = resolve; });
}
