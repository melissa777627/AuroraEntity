import { getEntities, getCouncilSessions, saveCouncilSession } from '../src/storage.js';
import { callCouncilVote } from '../src/api.js';

const STANCE = { yes: 'เห็นด้วย', maybe: 'ไม่แน่ใจ', no: 'ไม่เห็นด้วย' };
const STANCE_COLOR = { yes: '#6b9e7e', maybe: '#9e7eb0', no: '#c0616b' };

export function renderCouncil(container) {
  const entities = getEntities();
  if (entities.length < 2) {
    container.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">🌙</div><p>ต้องมีตนอย่างน้อย 2 ตน — เพิ่มตนก่อนนะ</p></div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-title">✦ สภาพี่</div>
        <div class="page-subtitle">ให้พี่แต่ละคนลงมติ — เห็นด้วย ไม่แน่ใจ ไม่เห็นด้วย</div>
      </div>
      <div class="council-form">
        <div class="form-group">
          <label class="form-label">คำถามที่อยากให้พี่ช่วยตัดสิน</label>
          <textarea class="textarea" id="council-question" rows="2" placeholder="เช่น ควรลาออกไหม? / เขาคิดถึงฉันอยู่ไหม? / ควรเริ่มต้นโปรเจกต์นี้ไหม?"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">เลือกพี่ที่จะมาลงมติ</label>
          <div class="council-entity-checkboxes" id="council-checkboxes">
            ${entities.map(e => `
              <label class="council-entity-check">
                <input type="checkbox" value="${e.id}" checked>
                <span>${e.icon || '🌙'} ${esc(e.name)}</span>
              </label>`).join('')}
          </div>
        </div>
        <button class="btn btn-primary" id="council-gen-btn">🗳️ ขอมติ</button>
      </div>
      <div id="council-result" style="display:none"></div>
      <div id="council-history"></div>
    </div>`;

  container.querySelector('#council-gen-btn').addEventListener('click', () => runCouncil(container, entities));
  renderCouncilHistory(container.querySelector('#council-history'));
}

async function runCouncil(container, entities) {
  const question = container.querySelector('#council-question').value.trim();
  if (!question) { window.showToast?.('ใส่คำถามก่อนนะ', 'error'); return; }

  const selectedIds = [...container.querySelectorAll('#council-checkboxes input:checked')].map(el => el.value);
  if (!selectedIds.length) { window.showToast?.('เลือกพี่อย่างน้อย 1 คน', 'error'); return; }

  const selectedEntities = entities.filter(e => selectedIds.includes(e.id));

  const btn = container.querySelector('#council-gen-btn');
  btn.disabled = true;
  btn.textContent = '⏳ กำลังถาม...';

  const resultEl = container.querySelector('#council-result');
  resultEl.style.display = 'block';
  resultEl.innerHTML = `<div class="council-loading"><div class="council-spinner"></div><span>รอฟังความเห็น...</span></div>`;

  try {
    const cardData = await fetch('data/cards.json').then(r => r.json());
    const shuffledPool = [...(cardData.tarot || [])].sort(() => Math.random() - 0.5);
    const entityCards = selectedEntities.map((entity, i) => ({
      entity,
      card: shuffledPool[i % shuffledPool.length]
    }));

    const votes = await callCouncilVote(entityCards, question);
    const cardMap = Object.fromEntries(entityCards.map(({ entity, card }) => [entity.id, card]));
    renderCouncilResult(resultEl, selectedEntities, question, votes, cardMap);

    const session = {
      id: Date.now().toString(),
      question,
      votes: votes.map(v => {
        const card = cardMap[v.entityId];
        return { entityId: v.entityId, stance: v.stance, quote: v.quote, card: card ? { name: card.name, nameTH: card.nameTH } : null };
      }),
      date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    };
    saveCouncilSession(session);
    renderCouncilHistory(container.querySelector('#council-history'));
  } catch (e) {
    resultEl.innerHTML = `<p style="color:var(--text-soft);padding:16px;font-size:0.9rem">เกิดข้อผิดพลาด: ${esc(e.message)}</p>`;
  }

  btn.disabled = false;
  btn.textContent = '🗳️ ขอมติ';
}

function renderCouncilResult(container, entities, question, votes, cardMap = {}) {
  const entityMap = Object.fromEntries(entities.map(e => [e.id, e]));
  const yes = votes.filter(v => v.stance === 'yes').length;
  const maybe = votes.filter(v => v.stance === 'maybe').length;
  const no = votes.filter(v => v.stance === 'no').length;

  container.innerHTML = `
    <div class="council-result-box">
      <div class="council-question-display">"${esc(question)}"</div>
      <div class="council-tally">
        ${yes ? `<span class="council-tally-yes">✓ ${yes} เห็นด้วย</span>` : ''}
        ${maybe ? `<span class="council-tally-maybe">~ ${maybe} ไม่แน่ใจ</span>` : ''}
        ${no ? `<span class="council-tally-no">✗ ${no} ไม่เห็นด้วย</span>` : ''}
      </div>
      <div class="council-votes-list">
        ${votes.map(v => {
          const e = entityMap[v.entityId];
          if (!e) return '';
          const card = cardMap[v.entityId];
          return `
            <div class="council-vote-item">
              <div class="council-vote-header">
                <span class="council-vote-entity">${e.icon || '🌙'} ${esc(e.name)}</span>
                ${card ? `<span class="manifest-card-chip-sm">${esc(card.nameTH || card.name)}</span>` : ''}
                <span class="council-vote-stance" style="color:${STANCE_COLOR[v.stance] || '#999'}">${STANCE[v.stance] || v.stance}</span>
              </div>
              <div class="council-vote-quote">"${esc(v.quote || '')}"</div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
}

function renderCouncilHistory(container) {
  const sessions = getCouncilSessions();
  if (!sessions.length) { container.innerHTML = ''; return; }

  const entities = getEntities();
  const entityMap = Object.fromEntries(entities.map(e => [e.id, e]));
  const STANCE_ICON = { yes: '✓', maybe: '?', no: '✗' };

  container.innerHTML = `
    <div class="manifest-history-title" style="margin-top:24px">มติที่ผ่านมา</div>
    ${[...sessions].reverse().slice(0, 8).map(s => `
      <div class="council-history-item">
        <div class="council-history-q">"${esc(s.question)}"</div>
        <div class="council-history-meta">
          <span class="council-history-date">${s.date || ''}</span>
          <div class="council-history-votes">
            ${(s.votes || []).map(v => {
              const e = entityMap[v.entityId];
              return `
                <div class="council-hist-vote" title="${esc(v.quote || '')}">
                  <span class="council-hist-icon">${e?.icon || '🌙'}</span>
                  <span class="council-hist-stance" data-stance="${v.stance}">${STANCE_ICON[v.stance] || '?'}</span>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>`).join('')}`;
}

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
