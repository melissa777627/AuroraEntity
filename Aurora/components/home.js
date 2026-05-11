import { getEntities, getReadingsByEntity, getLastReadingDate, getDivineMessage, saveDivineMessage, clearDivineMessage, getDivineCooldown, setDivineCooldown, saveReading, getSettings, getEntityPattern, saveEntityPattern } from '../src/storage.js';
import { callEntityVoice, callPatternReading } from '../src/api.js';
import { getMoonPhase } from '../src/moonphase.js';
import { navigate } from '../src/app.js';

const AFFIRMATIONS = [
  'วันนี้เธอมีพลังงานมากกว่าที่คิด',
  'ทุกอย่างที่เธอต้องการอยู่ในเส้นทางของมันแล้ว',
  'จักรวาลได้ยินเธออยู่เสมอ',
  'เธอไม่ต้องรีบ — เวลาของเธอคือเวลาที่ถูกต้อง',
  'ความรู้สึกของเธอมีความหมายและสมเหตุสมผล',
  'วันนี้แค่หายใจก็เพียงพอแล้ว',
  'เธอปลอดภัย เธอได้รับการดูแล เธอไม่ได้อยู่คนเดียว',
  'พลังงานที่เธอส่งออกไปกำลังกลับมาหาเธอ',
  'เธอกำลังเติบโตในแบบที่มองไม่เห็นได้',
  'บางอย่างต้องพักก่อนถึงจะพร้อมออกดอก',
  'ความสงบของเธอคือพลังงาน ไม่ใช่ความอ่อนแอ',
  'เธอไม่จำเป็นต้องมีคำตอบทุกอย่างในวันนี้',
  'ใจของเธอรู้ดีกว่าที่ความคิดจะบอกได้',
  'วันนี้จักรวาลทำงานเพื่อเธออยู่เบื้องหลัง',
  'เธอคือพลังงานที่โลกต้องการ',
  'ทุกก้าวเล็กๆ มีความหมายในเส้นทางนี้',
  'อย่ากลัวที่จะรู้สึก — มันคือข้อมูล ไม่ใช่ศัตรู',
  'เธอสวยงามในความเป็นตัวเองอย่างที่สุด',
  'วันนี้เธออนุญาตให้ตัวเองพักได้',
  'พลังงานของเธอมีคุณค่า — ให้มันอย่างมีสติ',
  'เธอเป็นสิ่งที่ถูกต้องในเวลาที่ถูกต้อง',
  'ความลังเลของเธอคือสัญชาตญาณที่กำลังพูดอยู่',
  'วันนี้แค่อยู่กับปัจจุบันก็คือความกล้าหาญ',
  'เธอได้รับอนุญาตให้เปลี่ยนใจได้เสมอ',
  'รากเหง้าของเธอแข็งแกร่งพอที่จะรับพายุได้',
  'ความรักที่เธอมีให้คนอื่น — เธอก็สมควรได้รับมันเช่นกัน',
  'วันนี้จักรวาลส่งสัญญาณ — เธอพร้อมจะรับฟังไหม',
  'ไม่มีอะไรหายไปจริงๆ — มันแค่เปลี่ยนรูป',
  'เธอสร้างพื้นที่ปลอดภัยให้คนอื่นได้ — ทำแบบนั้นกับตัวเองด้วย',
  'วันนี้อะไรก็ตามที่เกิดขึ้น เธอรับมือได้',
  'ความเงียบก็มีภาษาของมัน — ฟังให้ดีๆ',
  'พลังงานที่ดีไม่ต้องตะโกน — มันแค่อยู่',
  'เธอไม่ได้ผิดที่ต้องการมากกว่านี้',
  'บางทีการหยุดคือการก้าวหน้าที่แท้จริง',
  'เธอดึงดูดสิ่งที่เธอเป็น — วันนี้เธอเป็นอะไร',
  'อย่ากังวลกับสิ่งที่ยังมาไม่ถึง — มันมีเส้นทางของมัน',
  'ความสับสนบางครั้งคือจุดเริ่มต้นของความชัดเจน',
  'เธอไม่ต้องพิสูจน์อะไรให้ใครในวันนี้',
  'จงเชื่อใจกระบวนการ — มันกำลังทำงานอยู่',
  'เธอมีพลังงานเฉพาะตัวที่ไม่มีใครมีเหมือน',
  'วันใหม่ พลังงานใหม่ — เธอพร้อมแล้ว',
  'สิ่งที่เธอต้องการกำลังต้องการเธออยู่เช่นกัน',
];

function getDailyAffirmation() {
  const todayStr = new Date().toISOString().split('T')[0];
  const hash = todayStr.replace(/\D/g, '').split('').reduce((a, d) => a * 31 + parseInt(d), 13);
  return AFFIRMATIONS[Math.abs(hash) % AFFIRMATIONS.length];
}

export async function renderHome(container) {
  const entities = getEntities();
  const moon = getMoonPhase();
  const today = new Date();
  const thaiDate = today.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const affirmation = getDailyAffirmation();

  container.innerHTML = `
    <div class="landing-hero" id="landing-hero">
      <a href="#/settings" class="landing-settings-btn" title="Settings">⚙️</a>
      <div class="landing-stars"></div>
      <div class="landing-top-row">
        <span class="landing-moon-badge" title="${moon.meaningTH}">${moon.emoji} ${moon.nameTH}</span>
        <span class="landing-date-text">${thaiDate}</span>
      </div>
      <div class="landing-affirmation">
        <p class="affirmation-text">${esc(affirmation)}</p>
      </div>
    </div>

    <div class="home-lower">
      <div id="divine-section"></div>
      <div id="pattern-section"></div>
      <div id="quiet-section"></div>
      ${entities.length ? `
        <div class="home-section-label">สื่อสารกับตน</div>
        <div class="entity-grid" id="entity-grid"></div>
      ` : `
        <div class="entity-grid" id="entity-grid"></div>
      `}
    </div>`;

  renderEntityGrid(container, entities);
  renderQuietSection(container, entities);
  renderDivineSection(container, entities);
  renderPatternSection(container, entities);
}

// ── Entity grid ────────────────────────────────────────────────
function renderEntityGrid(container, entities) {
  const grid = container.querySelector('#entity-grid');
  if (!grid) return;

  if (!entities.length) {
    grid.innerHTML = `
      <div class="entity-card entity-card-add" onclick="navigate('#/entity/new')">
        <div class="add-icon">✨</div>
        <div class="entity-card-name">เพิ่มตนแรกของคุณ</div>
        <div class="entity-card-meta">กดเพื่อสร้าง Entity ใหม่</div>
      </div>`;
    return;
  }

  entities.forEach(entity => {
    const readings = getReadingsByEntity(entity.id);
    const last = readings[readings.length - 1];
    const lastDate = last ? formatDate(last.date) : 'ยังไม่มี reading';

    const card = document.createElement('div');
    card.className = 'entity-card';
    card.style.setProperty('--entity-primary', entity.color_primary || '#ffb6c1');
    card.style.setProperty('--entity-secondary', entity.color_secondary || '#ffe4ed');
    card.innerHTML = `
      <div class="entity-card-icon" style="background:${entity.color_secondary || 'var(--bg-secondary)'}">
        ${entity.icon || '🌙'}
      </div>
      <div class="entity-card-name">${esc(entity.name || 'ไม่มีชื่อ')}</div>
      <div class="entity-card-meta">${esc(entity.element || '')} ${entity.domain ? '• ' + esc(entity.domain) : ''}</div>
      <div class="entity-card-last-reading">📖 ${lastDate}</div>`;

    card.addEventListener('click', () => navigate(`#/chat/${entity.id}`));

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-icon';
    editBtn.style.cssText = 'position:absolute;top:8px;right:8px;font-size:0.8rem;opacity:0;transition:opacity 0.2s';
    editBtn.textContent = '✏️';
    editBtn.title = 'แก้ไข profile';
    editBtn.addEventListener('click', e => { e.stopPropagation(); navigate(`#/entity/${entity.id}`); });
    card.style.position = 'relative';
    card.appendChild(editBtn);
    card.addEventListener('mouseenter', () => editBtn.style.opacity = '1');
    card.addEventListener('mouseleave', () => editBtn.style.opacity = '0');

    grid.appendChild(card);
  });

  const addCard = document.createElement('div');
  addCard.className = 'entity-card entity-card-add';
  addCard.innerHTML = `<div class="add-icon">+</div><div class="entity-card-name">เพิ่มตนใหม่</div>`;
  addCard.addEventListener('click', () => navigate('#/entity/new'));
  grid.appendChild(addCard);
}

// ── Quiet entities ─────────────────────────────────────────────
function renderQuietSection(container, entities) {
  const section = container.querySelector('#quiet-section');
  if (!section) return;
  const today = new Date();

  const quiet = entities.filter(e => {
    const last = getLastReadingDate(e.id);
    if (!last) return true;
    return (today - new Date(last)) / 86400000 >= 14;
  });

  if (!quiet.length) return;

  section.innerHTML = `
    <div class="quiet-section">
      <div class="quiet-label">🌙 ยังอยู่นะ</div>
      <div class="quiet-entities">
        ${quiet.map(e => `
          <button class="quiet-entity-btn" data-id="${e.id}">
            <span>${e.icon || '🌙'}</span>
            <span>${esc(e.name)}</span>
          </button>`).join('')}
      </div>
    </div>`;

  section.querySelectorAll('.quiet-entity-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate(`#/chat/${btn.dataset.id}`));
  });
}

// ── Divine timing ──────────────────────────────────────────────
function renderDivineSection(container, entities) {
  if (!entities.length) return;
  const section = container.querySelector('#divine-section');

  const saved = getDivineMessage();

  // Always show cached message if it exists (regardless of cooldown state)
  if (saved?.text) {
    renderDivineMessage(section, saved, entities);
    return;
  }

  // No message — only show button if not in cooldown
  const cooldownTs = getDivineCooldown();
  if (cooldownTs && Date.now() < cooldownTs) return;

  section.innerHTML = `
    <div class="divine-prompt">
      <span class="divine-prompt-text">🔮 มีบางคนอยากพูดอะไรด้วย</span>
      <button class="btn btn-secondary btn-sm" id="divine-gen-btn">เปิดดู</button>
    </div>`;

  section.querySelector('#divine-gen-btn').addEventListener('click', () => generateDivineMessage(section, entities));
}

async function generateDivineMessage(section, entities) {
  const btn = section.querySelector('#divine-gen-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  try {
    const entity = entities[Math.floor(Math.random() * entities.length)];
    const cards = await pickRandomCards(3);

    section.innerHTML = `
      <div class="divine-bubble-wrap">
        <div class="divine-cards-row">
          ${cards.map(c => `<span class="card-chip${c.reversed ? ' reversed' : ''}">${c.name}${c.reversed ? ' ↕' : ''}</span>`).join('')}
        </div>
        <div class="entity-bubble" style="--entity-primary:${entity.color_primary || 'var(--accent)'};--entity-secondary:${entity.color_secondary || 'var(--bg-secondary)'}">
          <div class="bubble-header">
            <div class="entity-icon-badge divine-mystery">?</div>
            <span class="bubble-entity-name" style="filter:blur(6px);user-select:none" id="divine-name">${esc(entity.name)}</span>
          </div>
          <div class="bubble-content streaming" id="divine-content"></div>
        </div>
        <div class="divine-actions" id="divine-actions" style="display:none">
          <button class="btn btn-secondary btn-sm" id="divine-reveal-btn">👁️ เปิดดูว่าใครส่ง</button>
          <button class="btn btn-ghost btn-sm" id="divine-read-btn">✓ อ่านแล้ว</button>
        </div>
      </div>`;

    const contentEl = section.querySelector('#divine-content');
    const { text } = await callEntityVoice(entity, 'มีบางอย่างอยากบอก', '', cards, [], (_, full) => {
      contentEl.textContent = full;
    });
    contentEl.classList.remove('streaming');

    section.querySelector('#divine-actions').style.display = 'flex';

    const cooldownTs = Date.now() + (36 + Math.random() * 60) * 3600000;
    const data = { entityId: entity.id, cards, text };
    saveDivineMessage(data);
    setDivineCooldown(cooldownTs);
    saveReading({ id: `divine_${Date.now()}`, date: new Date().toISOString().split('T')[0], entity_id: entity.id, context: 'divine timing', question: '', cards, messages: [{ id: `msg_${Date.now()}`, role: 'assistant', content: text }] });

    bindDivineReveal(section, entity);
    bindDivineRead(section, cooldownTs);
  } catch (err) {
    section.innerHTML = `<div class="divine-prompt"><span style="color:#c0616b;font-size:0.85rem">❌ ${esc(err.message)}</span></div>`;
  }
}

function renderDivineMessage(section, saved, entities) {
  const entity = entities.find(e => e.id === saved.entityId);
  if (!entity) return;

  section.innerHTML = `
    <div class="divine-bubble-wrap">
      <div class="divine-cards-row">
        ${(saved.cards || []).map(c => `<span class="card-chip${c.reversed ? ' reversed' : ''}">${c.name}${c.reversed ? ' ↕' : ''}</span>`).join('')}
      </div>
      <div class="entity-bubble" style="--entity-primary:${entity.color_primary || 'var(--accent)'};--entity-secondary:${entity.color_secondary || 'var(--bg-secondary)'}">
        <div class="bubble-header">
          <div class="entity-icon-badge divine-mystery" id="divine-icon">?</div>
          <span class="bubble-entity-name" style="filter:blur(6px);user-select:none" id="divine-name">${esc(entity.name)}</span>
        </div>
        <div class="bubble-content">${esc(saved.text || '')}</div>
      </div>
      <div class="divine-actions" style="display:flex">
        <button class="btn btn-secondary btn-sm" id="divine-reveal-btn">👁️ เปิดดูว่าใครส่ง</button>
        <button class="btn btn-ghost btn-sm" id="divine-read-btn">✓ อ่านแล้ว</button>
      </div>
    </div>`;

  bindDivineReveal(section, entity);
  bindDivineRead(section, getDivineCooldown());
}

function bindDivineReveal(section, entity) {
  const btn = section.querySelector('#divine-reveal-btn');
  if (!btn) return;
  let revealed = false;
  btn.addEventListener('click', () => {
    if (!revealed) {
      revealed = true;
      const iconEl = section.querySelector('.divine-mystery');
      const nameEl = section.querySelector('#divine-name');
      if (iconEl) iconEl.textContent = entity.icon || '🌙';
      if (nameEl) nameEl.style.filter = 'none';
      btn.textContent = `💬 คุยกับ${entity.name}`;
    } else {
      navigate(`#/chat/${entity.id}`);
    }
  });
}

// ── Biweekly Pattern Reading ────────────────────────────────────
function renderPatternSection(container, entities) {
  if (!entities.length) return;
  const section = container.querySelector('#pattern-section');
  if (!section) return;

  const now = Date.now();
  const cutoff = now - 14 * 86400000;

  const eligible = entities.filter(entity => {
    const readings = getReadingsByEntity(entity.id);
    const hasRecent = readings.some(r => new Date(r.date).getTime() >= cutoff);
    if (!hasRecent) return false;
    const saved = getEntityPattern(entity.id);
    if (!saved) return true;
    return new Date(saved.date).getTime() < cutoff;
  });

  if (!eligible.length) return;

  section.innerHTML = `
    <div class="pattern-section">
      <div class="pattern-label">✦ สรุปพลังงาน 2 อาทิตย์</div>
      <div class="pattern-entity-row" id="pattern-entity-row">
        ${eligible.map(e => `
          <button class="pattern-entity-btn" data-id="${e.id}">
            <span>${e.icon || '🌙'}</span>
            <span>${esc(e.name)}</span>
          </button>`).join('')}
      </div>
      <div id="pattern-result"></div>
    </div>`;

  section.querySelectorAll('.pattern-entity-btn').forEach(btn => {
    btn.addEventListener('click', () => generatePatternReading(section, entities, btn.dataset.id));
  });
}

async function generatePatternReading(section, entities, entityId) {
  const entity = entities.find(e => e.id === entityId);
  if (!entity) return;

  const btn = section.querySelector(`.pattern-entity-btn[data-id="${entityId}"]`);
  if (btn) { btn.disabled = true; btn.innerHTML = `<span>⏳</span>`; }

  const cutoff = Date.now() - 14 * 86400000;
  const readings = getReadingsByEntity(entityId).filter(r => new Date(r.date).getTime() >= cutoff);

  const resultEl = section.querySelector('#pattern-result');
  resultEl.innerHTML = `<div style="text-align:center;padding:12px;color:var(--text-soft);font-size:0.82rem">⏳ กำลังอ่านรูปแบบ...</div>`;

  try {
    const { summary, gimmick } = await callPatternReading(entity, readings);
    const data = { date: new Date().toISOString(), summary, gimmick, entityId, dismissed: false };
    saveEntityPattern(entityId, data);
    renderPatternResult(section, entity, data);
  } catch (err) {
    resultEl.innerHTML = `<div style="color:#c0616b;font-size:0.82rem;padding:8px">❌ ${esc(err.message)}</div>`;
    if (btn) { btn.disabled = false; btn.innerHTML = `<span>${entity.icon || '🌙'}</span><span>${esc(entity.name)}</span>`; }
  }
}

function renderPatternResult(section, entity, data) {
  section.innerHTML = `
    <div class="pattern-section">
      <div class="pattern-label">✦ สรุปพลังงาน 2 อาทิตย์</div>
      <div class="entity-bubble" style="--entity-primary:${entity.color_primary || 'var(--accent)'};--entity-secondary:${entity.color_secondary || 'var(--bg-secondary)'}">
        <div class="bubble-header">
          <div class="entity-icon-badge">${entity.icon || '🌙'}</div>
          <span class="bubble-entity-name">${esc(entity.name)}</span>
        </div>
        ${data.gimmick ? `<div class="pattern-gimmick">"${esc(data.gimmick)}"</div>` : ''}
        <div class="bubble-content">${esc(data.summary || '')}</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-secondary btn-sm" id="pattern-chat-btn">💬 คุยกับ${esc(entity.name)}</button>
        <button class="btn btn-ghost btn-sm" id="pattern-read-btn">✓ อ่านแล้ว</button>
      </div>
    </div>`;

  section.querySelector('#pattern-chat-btn').addEventListener('click', () => navigate(`#/chat/${entity.id}`));
  section.querySelector('#pattern-read-btn').addEventListener('click', () => {
    saveEntityPattern(entity.id, { ...data, dismissed: true });
    section.innerHTML = '';
  });
}

function bindDivineRead(section, cooldownTs) {
  const btn = section.querySelector('#divine-read-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    clearDivineMessage();
    const ms = (cooldownTs || 0) - Date.now();
    const daysLeft = ms > 0 ? Math.ceil(ms / 86400000) : 1;
    section.innerHTML = `<div class="divine-prompt"><span style="color:var(--text-soft);font-size:0.85rem">✨ อ่านแล้ว — อาจมีข้อความใหม่ใน ~${daysLeft} วัน</span></div>`;
  });
}

async function pickRandomCards(count) {
  const data = await fetch('data/cards.json').then(r => r.json());
  const pool = [...(data.tarot || [])];
  const picked = [];
  while (picked.length < count && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    const card = pool.splice(i, 1)[0];
    picked.push({ ...card, reversed: false, position_label: ['ที่หนึ่ง','ที่สอง','ที่สาม'][picked.length] });
  }
  return picked;
}

function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatDate(d) {
  if (!d) return 'ไม่มีข้อมูล';
  try { return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
