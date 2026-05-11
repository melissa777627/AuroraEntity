import { getEntities, getDailyGrievance, saveDailyGrievance } from '../src/storage.js';
import { callGrievance, callGrievanceTone } from '../src/api.js';

const COUNT_WORDS = ['', 'หนึ่ง', 'สอง', 'สาม'];

const HINTS = {
  0: '...วันนี้เงียบๆ ไม่ได้ยินอะไรเป็นพิเศษ',
  1: '...ได้ยินเสียงแว่วๆ มา เหมือนมีคนอยากระบายบางอย่าง',
  2: (n) => `...ได้ยินเสียงแว่วๆ มา เหมือนคน${COUNT_WORDS[n]}คนกำลังบ่นอยู่`,
  3: (n) => `...ได้ยินเสียงแว่วๆ มา เหมือนคน${COUNT_WORDS[n]}คนกำลังบ่นอยู่`,
};

function getHint(count) {
  if (count === 0) return HINTS[0];
  if (count === 1) return HINTS[1];
  return HINTS[count]?.(count) ?? `...ได้ยินเสียงแว่วๆ มาจากทาง${COUNT_WORDS[count] || count}คน`;
}

export async function renderGrievance(container) {
  const entities = getEntities();
  if (!entities.length) {
    container.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">🔔</div><p>ยังไม่มีตน — เพิ่มตนก่อนนะ</p></div></div>`;
    return;
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  let daily = getDailyGrievance();

  // Create today's grievance plan if not exists
  if (!daily || daily.date !== today) {
    const count = pickCount(entities.length);
    const shuffledIds = [...entities].sort(() => Math.random() - 0.5).slice(0, count).map(e => e.id);
    daily = { date: today, count, selectedEntityIds: shuffledIds, listened: false, entities: [] };
    saveDailyGrievance(daily);
  }

  // Mark as read when page opens (remove red dot)
  if (daily.listened) {
    markNavRead();
  }

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-title">✦ ร้องเรียน</div>
        <div class="page-subtitle">${getHint(daily.count)}</div>
      </div>
      <div id="grievance-main">
        ${daily.listened ? buildListenedHTML(daily) : buildUnlistenedHTML(daily)}
      </div>
      ${daily.count > 0 ? `<div id="grievance-countdown" class="grievance-countdown"></div>` : ''}
    </div>`;

  if (!daily.listened && daily.count > 0) {
    container.querySelector('#grievance-listen-btn')?.addEventListener('click', () => doListen(container, entities, daily));
  }

  startCountdown(container.querySelector('#grievance-countdown'));
}

function msUntilBangkokMidnight() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-CA', { timeZone: 'Asia/Bangkok', hour12: false });
  const [h, m, s] = timeStr.split(':').map(Number);
  return ((23 - h) * 3600 + (59 - m) * 60 + (60 - s)) * 1000;
}

function startCountdown(el) {
  if (!el) return;
  const update = () => {
    if (!document.contains(el)) { clearInterval(id); return; }
    const ms = msUntilBangkokMidnight();
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    el.textContent = `คำร้องเรียนจะหายไปในอีก ${hours}ชม. ${mins}นาที`;
  };
  update();
  const id = setInterval(update, 60000);
}

function buildUnlistenedHTML(daily) {
  if (daily.count === 0) {
    return `<div class="grievance-quiet">✦ วันนี้ทุกคนสงบดี ไม่มีอะไรระบาย</div>`;
  }
  return `
    <div class="grievance-trigger">
      <button class="btn btn-primary grievance-listen-btn" id="grievance-listen-btn">🔔 แอบฟังซิ</button>
    </div>`;
}

function buildListenedHTML(daily) {
  if (!daily.entities?.length) {
    return `<div class="grievance-quiet">✦ วันนี้ทุกคนสงบดี ไม่มีอะไรระบาย</div>`;
  }
  return daily.entities.map(e => `
    <div class="grievance-result-box">
      <div class="grievance-cards-row">
        ${(e.cards || []).map(c => `<div class="manifest-card-chip">${esc(c.nameTH || c.name)}</div>`).join('')}
      </div>
      <div class="manifest-sender">${esc(e.entityIcon || '🌙')} ${esc(e.entityName)}</div>
      <div class="grievance-text">${escMsg(e.text || '')}</div>
    </div>`).join('');
}

async function doListen(container, entities, daily) {
  const btn = container.querySelector('#grievance-listen-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังฟัง...'; }

  const selected = daily.selectedEntityIds.map(id => entities.find(e => e.id === id)).filter(Boolean);

  let pool;
  try {
    const data = await fetch('data/cards.json').then(r => r.json());
    pool = [...(data.tarot || [])].sort(() => Math.random() - 0.5);
  } catch {
    if (btn) { btn.disabled = false; btn.textContent = '🔔 แอบฟังซิ'; }
    window.showToast?.('โหลดไพ่ไม่ได้', 'error');
    return;
  }

  // Show result boxes immediately (streaming placeholder)
  const mainEl = container.querySelector('#grievance-main');
  mainEl.innerHTML = selected.map((entity, i) => `
    <div class="grievance-result-box" id="grievance-box-${i}">
      <div class="grievance-cards-row" id="grievance-cards-${i}"></div>
      <div class="manifest-sender">${esc(entity.icon || '🌙')} ${esc(entity.name)}</div>
      <div class="grievance-text" id="grievance-text-${i}">...</div>
    </div>`).join('');

  const entityResults = [];
  for (let i = 0; i < selected.length; i++) {
    const entity = selected[i];
    const cards = pool.slice(i * 2, i * 2 + 2).map(c => ({ ...c, reversed: false }));

    const cardsEl = document.getElementById(`grievance-cards-${i}`);
    if (cardsEl) {
      cardsEl.innerHTML = cards.map(c => `<div class="manifest-card-chip">${esc(c.nameTH || c.name)}</div>`).join('');
    }

    const textEl = document.getElementById(`grievance-text-${i}`);
    if (textEl) textEl.innerHTML = '<span class="grievance-analyzing">คุณค่อยๆ เงี่ยหูฟัง...</span>';

    let toneInfo = { tone: 'serious', subject: 'general' };
    try { toneInfo = await callGrievanceTone(entity, entities, cards); } catch {}

    if (textEl) textEl.innerHTML = '';

    let full = '';
    try {
      await callGrievance(entity, entities, cards, toneInfo, (_, accumulated) => {
        full = accumulated;
        if (textEl) textEl.innerHTML = escMsg(full);
      });
    } catch (e) {
      if (textEl) textEl.innerHTML = `<span style="color:var(--text-soft)">เกิดข้อผิดพลาด: ${esc(e.message)}</span>`;
    }

    entityResults.push({
      entityId: entity.id,
      entityName: entity.name,
      entityIcon: entity.icon || '🌙',
      cards: cards.map(c => ({ name: c.name, nameTH: c.nameTH })),
      text: full,
      tone: toneInfo.tone
    });
  }

  const updated = { ...daily, listened: true, entities: entityResults };
  saveDailyGrievance(updated);
  markNavRead();
}

function pickCount(entityCount) {
  const weights = [0, 1, 2, 2, 3, 3];
  const n = weights[Math.floor(Math.random() * weights.length)];
  return Math.min(n, entityCount);
}

function markNavRead() {
  document.querySelector('.nav-link[data-route="grievance"]')?.classList.remove('has-notification');
}

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escMsg(s) { return esc(s).replace(/\n/g, '<br>'); }
