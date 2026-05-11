import { getSettings, getCardOfDay, saveCardOfDay } from '../src/storage.js';
import { callCardOfDayMessage } from '../src/api.js';

const ROMAN = ['0','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV','XVI','XVII','XVIII','XIX','XX','XXI'];
const EL_EMOJI = { 'ไฟ': '🔥', 'น้ำ': '🌊', 'อากาศ': '💨', 'ดิน': '🌿' };
const EL_COLOR = { 'ไฟ': '#ff9050', 'น้ำ': '#5bc8ef', 'อากาศ': '#b39ddb', 'ดิน': '#66bb6a' };

function thaiDateStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

export async function renderCardOfDayPage(container) {
  const settings = getSettings();
  const saved = getCardOfDay();
  const today = thaiDateStr();

  // Already drawn today — show it
  if (saved?.date === today && saved?.card) {
    renderCard(container, saved.card, saved.message || null, settings);
    return;
  }

  // Not drawn yet — show face-down state
  renderFaceDown(container, settings);
}

function renderFaceDown(container, settings) {
  container.innerHTML = `
    <div class="cotd-page">
      <div class="cotd-page-hero" style="--card-color:#b39ddb">
        <div class="cotd-page-label">✦ ไพ่แห่งวันนี้ ✦</div>
        <div class="cotd-page-face cotd-face-down">
          <div class="cotd-facedown-symbol">🂠</div>
        </div>
        <div class="cotd-page-name-en" style="opacity:0.4">???</div>
        <div style="margin-top:20px">
          <button class="cotd-draw-btn" id="cotd-draw-btn">🔮 เปิดไพ่วันนี้</button>
        </div>
      </div>
      <div class="cotd-page-body">
        <p style="color:rgba(255,255,255,.25);font-size:0.82rem;text-align:center;margin-top:8px">ไพ่จะค้างไว้จนเที่ยงคืน (เวลาไทย)</p>
      </div>
    </div>`;

  container.querySelector('#cotd-draw-btn').addEventListener('click', async () => {
    const btn = container.querySelector('#cotd-draw-btn');
    btn.disabled = true;
    btn.textContent = '⏳';

    let card;
    try {
      const data = await fetch('data/cards.json').then(r => r.json());
      const pool = data.tarot || [];
      card = pool[Math.floor(Math.random() * pool.length)];
    } catch {
      btn.disabled = false;
      btn.textContent = '🔮 เปิดไพ่วันนี้';
      return;
    }

    // Save card immediately (no message yet)
    saveCardOfDay({ date: thaiDateStr(), card, message: null });
    renderCard(container, card, null, settings, true);
  });
}

function renderCard(container, card, message, settings, fetchMessage = false) {
  const color = EL_COLOR[card.element] || '#b39ddb';
  const elEmoji = EL_EMOJI[card.element] || '✨';
  const numDisplay = card.suit === 'Major' && card.number !== undefined
    ? (ROMAN[card.number] || card.number)
    : card.number || '';

  container.innerHTML = `
    <div class="cotd-page">
      <div class="cotd-page-hero" style="--card-color:${color}">
        <div class="cotd-page-label">✦ ไพ่แห่งวันนี้ ✦</div>
        <div class="cotd-page-face">
          <div class="cotd-page-element">${elEmoji}</div>
          ${numDisplay ? `<div class="cotd-page-num" style="color:${color}">${numDisplay}</div>` : ''}
        </div>
        <div class="cotd-page-name-en">${esc(card.name)}</div>
        ${card.nameTH ? `<div class="cotd-page-name-th">${esc(card.nameTH)}</div>` : ''}
        <div class="cotd-page-keywords">
          ${(card.keywords || []).map(k => `<span>${esc(k)}</span>`).join('')}
        </div>
      </div>

      <div class="cotd-page-body">
        <div class="cotd-page-message-wrap" id="cotd-msg-wrap">
          ${message
            ? `<p class="cotd-page-message">${escMsg(message)}</p>`
            : settings.apiKey
              ? `<div class="cotd-page-loading-msg"><div class="cotd-spinner"></div><span>กำลังอ่านพลังงาน...</span></div>`
              : `<p style="color:rgba(255,255,255,.35);font-size:0.85rem;text-align:center">ตั้ง API Key ใน Settings เพื่อรับคำทำนาย</p>`}
        </div>
      </div>
    </div>`;

  if (!message && (settings.apiKey || fetchMessage)) {
    callCardOfDayMessage(card)
      .then(msg => {
        const wrap = container.querySelector('#cotd-msg-wrap');
        if (wrap) wrap.innerHTML = `<p class="cotd-page-message">${escMsg(msg)}</p>`;
        const saved = getCardOfDay();
        if (saved?.card?.id === card.id) saveCardOfDay({ ...saved, message: msg });
      })
      .catch(() => {
        const wrap = container.querySelector('#cotd-msg-wrap');
        if (wrap) wrap.innerHTML = `<p style="color:rgba(255,255,255,.35);font-size:0.85rem;text-align:center">ไม่สามารถรับคำทำนายได้ในขณะนี้</p>`;
      });
  }
}

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escMsg(s) { return esc(s).replace(/\n/g, '<br>'); }
