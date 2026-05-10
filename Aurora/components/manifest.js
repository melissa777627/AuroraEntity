import { getEntities, getManifestLetters, saveManifestLetter } from '../src/storage.js';
import { callManifestLetter } from '../src/api.js';

export async function renderManifest(container) {
  const entities = getEntities();
  if (!entities.length) {
    container.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">🌙</div><p>ยังไม่มีตน — เพิ่มตนก่อนนะ</p></div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-title">✦ จดหมายจากอนาคต</div>
        <div class="page-subtitle">บอกสิ่งที่อยากให้เกิดขึ้น — ให้พี่เล่าจากวันที่มันเป็นจริงแล้ว</div>
      </div>
      <div class="manifest-form">
        <div class="form-group">
          <label class="form-label">อยากให้อะไรเกิดขึ้น?</label>
          <textarea class="textarea" id="manifest-wish" rows="3" placeholder="เช่น อยากได้งานใหม่ที่ดีกว่า / อยากมีบ้านหลังใหญ่ / อยากมีความรักที่ดี"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">พี่ที่จะเขียนจดหมาย</label>
          <div class="manifest-entity-toggle">
            <button class="manifest-toggle-btn active" id="btn-random">🎲 สุ่มพี่</button>
            <button class="manifest-toggle-btn" id="btn-pick">✋ เลือกเอง</button>
          </div>
          <select class="input" id="manifest-entity-select" style="display:none;margin-top:8px">
            ${entities.map(e => `<option value="${e.id}">${e.icon || '🌙'} ${esc(e.name)}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary manifest-gen-btn" id="manifest-gen-btn">✨ สุ่มไพ่แล้วเขียนจดหมาย</button>
      </div>
      <div id="manifest-result" style="display:none"></div>
      <div id="manifest-history"></div>
    </div>`;

  let useRandom = true;

  container.querySelector('#btn-random').addEventListener('click', () => {
    useRandom = true;
    container.querySelector('#btn-random').classList.add('active');
    container.querySelector('#btn-pick').classList.remove('active');
    container.querySelector('#manifest-entity-select').style.display = 'none';
  });

  container.querySelector('#btn-pick').addEventListener('click', () => {
    useRandom = false;
    container.querySelector('#btn-pick').classList.add('active');
    container.querySelector('#btn-random').classList.remove('active');
    container.querySelector('#manifest-entity-select').style.display = 'block';
  });

  container.querySelector('#manifest-gen-btn').addEventListener('click', () => generateLetter(container, entities, () => useRandom));

  renderHistory(container.querySelector('#manifest-history'));
}

async function generateLetter(container, entities, getUseRandom) {
  const wish = container.querySelector('#manifest-wish').value.trim();
  if (!wish) { window.showToast?.('บอกก่อนว่าอยากให้อะไรเกิดขึ้น', 'error'); return; }

  let entity;
  if (getUseRandom()) {
    entity = entities[Math.floor(Math.random() * entities.length)];
  } else {
    const selId = container.querySelector('#manifest-entity-select').value;
    entity = entities.find(e => e.id === selId) || entities[0];
  }

  const btn = container.querySelector('#manifest-gen-btn');
  btn.disabled = true;
  btn.textContent = '⏳ กำลังสุ่มไพ่...';

  let cards;
  try {
    const data = await fetch('data/cards.json').then(r => r.json());
    const pool = data.tarot || [];
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    cards = shuffled.slice(0, 3).map(c => ({ ...c, reversed: false }));
  } catch {
    btn.disabled = false;
    btn.textContent = '✨ สุ่มไพ่แล้วเขียนจดหมาย';
    window.showToast?.('โหลดไพ่ไม่ได้', 'error');
    return;
  }

  const resultEl = container.querySelector('#manifest-result');
  resultEl.style.display = 'block';
  resultEl.innerHTML = `
    <div class="manifest-result-box">
      <div class="manifest-cards-row">
        ${cards.map(c => `<div class="manifest-card-chip">${esc(c.nameTH || c.name)}</div>`).join('')}
      </div>
      <div class="manifest-sender">${esc(entity.icon || '🌙')} ${esc(entity.name)}</div>
      <div class="manifest-letter-text" id="manifest-letter-text"></div>
    </div>`;

  btn.textContent = '⏳ กำลังเขียน...';

  const letterEl = resultEl.querySelector('#manifest-letter-text');
  let full = '';

  try {
    await callManifestLetter(entity, wish, cards, (_, accumulated) => {
      full = accumulated;
      letterEl.innerHTML = escMsg(full);
    });

    const letter = {
      id: Date.now().toString(),
      entityId: entity.id,
      entityName: entity.name,
      entityIcon: entity.icon || '🌙',
      wish,
      cards: cards.map(c => ({ name: c.name, nameTH: c.nameTH })),
      letter: full,
      date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    };
    saveManifestLetter(letter);
    renderHistory(container.querySelector('#manifest-history'));
  } catch (e) {
    letterEl.innerHTML = `<span style="color:var(--text-soft)">เกิดข้อผิดพลาด: ${esc(e.message)}</span>`;
  }

  btn.disabled = false;
  btn.textContent = '✨ สุ่มไพ่แล้วเขียนจดหมาย';
}

function renderHistory(container) {
  const letters = getManifestLetters();
  if (!letters.length) { container.innerHTML = ''; return; }

  container.innerHTML = `
    <div class="manifest-history-title">จดหมายที่ผ่านมา</div>
    ${[...letters].reverse().map(l => `
      <div class="manifest-history-item">
        <div class="manifest-history-header">
          <span class="manifest-history-entity">${esc(l.entityIcon || '🌙')} ${esc(l.entityName || '')}</span>
          <span class="manifest-history-date">${l.date || ''}</span>
        </div>
        <div class="manifest-history-wish">"${esc(l.wish)}"</div>
        <div class="manifest-history-cards">${(l.cards || []).map(c => `<span class="manifest-card-chip-sm">${esc(c.nameTH || c.name)}</span>`).join('')}</div>
        <div class="manifest-history-preview">${esc((l.letter || '').slice(0, 120))}${(l.letter || '').length > 120 ? '...' : ''}</div>
        <button class="manifest-expand-btn" data-lid="${l.id}">อ่านทั้งหมด ▼</button>
        <div class="manifest-full-letter" id="manifest-full-${l.id}" style="display:none">${escMsg(l.letter || '')}</div>
      </div>`).join('')}`;

  container.querySelectorAll('.manifest-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const full = document.getElementById(`manifest-full-${btn.dataset.lid}`);
      if (!full) return;
      const open = full.style.display !== 'none';
      full.style.display = open ? 'none' : 'block';
      btn.textContent = open ? 'อ่านทั้งหมด ▼' : 'ย่อ ▲';
    });
  });
}

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escMsg(s) { return esc(s).replace(/\n/g, '<br>'); }
