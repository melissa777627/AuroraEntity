import { getEntities, getReadingsByEntity, getDivineMessage, saveDivineMessage, clearDivineMessage, getDivineCooldown, setDivineCooldown, saveReading, getSettings, getEntityPattern, saveEntityPattern, getHandcuffs, isHandcuffActive } from '../src/storage.js';
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
  const thaiDate = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' });
  const affirmation = getDailyAffirmation().replace(/\s*—\s*/g, ' ');

  const handcuff = isHandcuffActive() ? getHandcuffs() : null;
  const handcuffBannerHtml = handcuff ? buildHandcuffBannerHTML(handcuff, entities) : '';

  container.innerHTML = `
    <div class="h-page">
      <header class="h-hero">
        <div class="h-hero-top">
          <span class="h-moon" title="${esc(moon.meaningTH)}">${moon.emoji} ${esc(moon.nameTH)}</span>
          <span class="h-date">${thaiDate}</span>
          <a href="#/search" class="h-ico" aria-label="ค้นหา">🔍</a>
          <a href="#/settings" class="h-ico" aria-label="ตั้งค่า">⚙️</a>
        </div>
        <p class="h-aff">${esc(affirmation)}</p>
        <div id="letter-slot"></div>
      </header>

      <div class="home-lower">
        ${handcuffBannerHtml}
        <div id="divine-section"></div>
        <div id="pattern-section"></div>
        <div class="h-label">สื่อสารกับตน</div>
        <div class="h-ents" id="entity-grid"></div>
        <div class="h-label">ชวนพี่ๆ คุยด้วยกัน</div>
        <div class="h-stickers">
          <a href="#/multi" class="h-stk"><span>🔀</span>ถามหลายตน</a>
          <a href="#/council" class="h-stk"><span>🗳️</span>สภาพี่</a>
          <a href="#/favorites" class="h-stk"><span>❤️</span>ที่ชอบ</a>
          <a href="#/calendar" class="h-stk"><span>📅</span>ปฏิทิน</a>
          <a href="#/search" class="h-stk"><span>🔍</span>ค้นหา</a>
        </div>
      </div>
    </div>`;

  renderEntityGrid(container, entities);
  renderDivineSection(container, entities);
  renderPatternSection(container, entities);
}

// ── Entity cards: face, name, the last thing they said ─────────
function lastSaid(readings) {
  for (let i = readings.length - 1; i >= 0; i--) {
    const msgs = readings[i].messages || [];
    for (let j = msgs.length - 1; j >= 0; j--) {
      if (msgs[j].role === 'assistant' && msgs[j].content) return String(msgs[j].content).replace(/\s+/g, ' ').trim();
    }
  }
  return '';
}

function ago(dateStr) {
  if (!dateStr) return '';
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days <= 0) return 'วันนี้';
  if (days === 1) return 'เมื่อวาน';
  if (days < 30) return `${days} วันก่อน`;
  return formatDate(dateStr);
}

function renderEntityGrid(container, entities) {
  const grid = container.querySelector('#entity-grid');
  if (!grid) return;

  grid.innerHTML = entities.map(entity => {
    const readings = getReadingsByEntity(entity.id);
    const last = readings[readings.length - 1];
    const days = last ? (Date.now() - new Date(last.date).getTime()) / 86400000 : Infinity;
    const quiet = days >= 14;
    const said = lastSaid(readings);
    const say = quiet ? '🌙 ยังอยู่นะ ไม่ได้คุยกันนานแล้ว' : said;
    return `
      <a href="#/chat/${entity.id}" class="h-ent${quiet ? ' quiet' : ''}" style="--ec:${entity.color_secondary || '#ffe4ed'};--ep:${entity.color_primary || '#ffb6c1'}">
        <span class="h-face">${esc(entity.icon || '🌙')}</span>
        <span class="h-name">${esc(entity.name || 'ไม่มีชื่อ')}</span>
        ${say ? `<span class="h-say">${esc(say)}</span>` : `<span class="h-say quiet">ยังไม่ได้คุยกันเลย</span>`}
        ${last ? `<span class="h-when">${ago(last.date)}</span>` : ''}
      </a>`;
  }).join('') + `
    <a href="#/entity/new" class="h-ent add"><span class="h-face">＋</span><span class="h-name">${entities.length ? 'เพิ่มตนใหม่' : 'เพิ่มตนแรกของคุณ'}</span></a>`;
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

  const slot = container.querySelector('#letter-slot');
  if (!slot) return;
  slot.innerHTML = `
    <button class="h-letter" id="divine-gen-btn">
      <span class="h-env">💌</span>
      <span class="h-letter-txt"><b>มีจดหมายมาถึง</b><small>มีบางคนอยากพูดอะไรด้วย แตะเพื่อเปิด</small></span>
      <span class="h-seal">♥</span>
    </button>`;

  slot.querySelector('#divine-gen-btn').addEventListener('click', () => {
    slot.innerHTML = '';
    generateDivineMessage(section, entities);
  });
}

async function generateDivineMessage(section, entities) {
  section.innerHTML = `<div class="divine-prompt"><span class="divine-prompt-text">💌 กำลังเปิดซอง...</span></div>`;

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

function buildHandcuffBannerHTML(handcuff, entities) {
  const def = entities.find(e => e.id === handcuff.defendantId);
  const acc = entities.find(e => e.id === handcuff.accompliceId);
  if (!def || !acc) return '';
  const msLeft = handcuff.expiresAt - Date.now();
  const hLeft = Math.floor(msLeft / 3600000);
  const mLeft = Math.floor((msLeft % 3600000) / 60000);
  const timeStr = hLeft > 0 ? `${hLeft} ชม. ${mLeft} น.` : `${mLeft} น.`;
  const bubbles = (handcuff.bicker || []).map(b => {
    const e = entities.find(x => x.id === b.entityId);
    return `<div class="hc-bubble"><span class="hc-bubble-name" style="color:${e?.color_primary || 'var(--accent-deep)'}">${esc(e?.icon || '?')} ${esc(e?.name || '?')}</span><span class="hc-bubble-text">${esc(b.text)}</span></div>`;
  }).join('');
  return `<div id="handcuff-banner" class="handcuff-banner">
    <div class="handcuff-banner-title">⛓️ กุญแจมือวิญญาณ — หายใน ${esc(timeStr)}</div>
    <div class="handcuff-pair">
      <span style="color:${def.color_primary || 'var(--accent-deep)'}">${esc(def.icon || '🌙')} ${esc(def.name)}</span>
      <span class="hc-chain">⛓️</span>
      <span style="color:${acc.color_primary || 'var(--accent-deep)'}">${esc(acc.icon || '🌙')} ${esc(acc.name)}</span>
    </div>
    <div class="handcuff-bicker">${bubbles}</div>
  </div>`;
}

function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatDate(d) {
  if (!d) return 'ไม่มีข้อมูล';
  try { return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return d; }
}
