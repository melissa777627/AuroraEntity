import { getEntities, saveReading } from '../src/storage.js';
import { callEntityVoice, callAnalysis } from '../src/api.js';
import { getSettings } from '../src/storage.js';
import { showToast, navigate } from '../src/app.js';
import { openCardPicker } from './card-picker.js';
import { renderAnalysis } from './chat.js';

export function renderMulti(container) {
  const entities = getEntities();

  if (!entities.length) {
    container.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">👻</div><p>ยังไม่มี Entity<br>สร้าง Entity ก่อนใช้ Multi Consult</p><button class="btn btn-secondary" onclick="navigate('#/entity/new')">สร้าง Entity</button></div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">🔀 Multi-Entity Consultation</h1>
        <p class="page-subtitle">ถามหลายตนพร้อมกัน — แต่ละตนตอบในบุคลิกของตัวเอง</p>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">เลือก Entity ที่ต้องการถาม</div>
        <div id="entity-checkboxes" style="display:flex;flex-wrap:wrap;gap:10px">
          ${entities.map(e => `
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:8px 12px;border:1.5px solid var(--accent);border-radius:var(--radius-sm);background:white;transition:all 0.2s">
              <input type="checkbox" value="${e.id}" style="accent-color:var(--accent-deep)">
              <span>${e.icon || '🌙'}</span>
              <span style="font-size:0.875rem">${esc(e.name)}</span>
            </label>`).join('')}
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">คำถาม</div>
        <div class="form-group">
          <label class="form-label">บริบท</label>
          <input type="text" class="input" id="multi-context" placeholder="บริบท...">
        </div>
        <div class="form-group">
          <label class="form-label">คำถาม</label>
          <input type="text" class="input" id="multi-question" placeholder="คำถามของคุณ...">
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <div id="multi-cards-display" style="flex:1;display:flex;flex-wrap:wrap;gap:5px">
            <span style="font-size:0.8rem;color:var(--text-soft)">ยังไม่ได้เลือกไพ่</span>
          </div>
          <button class="btn btn-secondary" id="multi-pick-cards">🃏 เลือกไพ่</button>
        </div>
      </div>

      <button class="btn btn-primary" id="multi-submit">🔀 ถามพร้อมกัน</button>

      <div id="multi-results" style="margin-top:24px"></div>
    </div>`;

  let multiCards = [];
  const settings = getSettings();

  container.querySelector('#multi-pick-cards').addEventListener('click', async () => {
    const picked = await openCardPicker(settings.defaultSpread || '3card', multiCards);
    if (picked.length) {
      multiCards = picked;
      const d = container.querySelector('#multi-cards-display');
      d.innerHTML = multiCards.map(c => `<span class="selected-card-chip">${esc(c.name)}</span>`).join('');
    }
  });

  container.querySelector('#multi-submit').addEventListener('click', async () => {
    const checked = [...container.querySelectorAll('#entity-checkboxes input:checked')];
    if (!checked.length) { showToast('เลือก Entity อย่างน้อย 1 ตน', 'error'); return; }

    const context = container.querySelector('#multi-context').value.trim();
    const question = container.querySelector('#multi-question').value.trim();
    const selectedEntities = checked.map(cb => entities.find(e => e.id === cb.value)).filter(Boolean);

    const resultsEl = container.querySelector('#multi-results');
    resultsEl.innerHTML = selectedEntities.map(e => `
      <div style="margin-bottom:20px" id="multi-result-${e.id}">
        <div class="entity-bubble" style="--entity-primary:${e.color_primary || 'var(--accent)'};--entity-secondary:${e.color_secondary || 'var(--bg-secondary)'}">
          <div class="bubble-header">
            <div class="entity-icon-badge">${e.icon || '🌙'}</div>
            <span class="bubble-entity-name">${esc(e.name)}</span>
          </div>
          <div class="bubble-content streaming" id="multi-content-${e.id}">⏳</div>
        </div>
      </div>`).join('') + `
      <div class="analysis-panel" id="multi-analysis">
        <div class="analysis-inner">
          <div class="analysis-loading"><div class="spinner"></div>รอ voices เสร็จก่อน...</div>
        </div>
      </div>`;

    const btn = container.querySelector('#multi-submit');
    btn.disabled = true;

    try {
      await Promise.all(selectedEntities.map(async entity => {
        const contentEl = resultsEl.querySelector(`#multi-content-${entity.id}`);
        const { text } = await callEntityVoice(entity, context, question, multiCards, [], (_, full) => {
          contentEl.textContent = full;
        });
        contentEl.classList.remove('streaming');
        const readingId = `read_${Date.now()}_${entity.id}`;
        saveReading({ id: readingId, date: new Date().toISOString().split('T')[0], entity_id: entity.id, context, question, cards: multiCards, messages: [{ id: `msg_${Date.now()}`, role: 'assistant', content: text }] });
      }));

      // Load combined analysis
      const analysisPanel = resultsEl.querySelector('#multi-analysis');
      analysisPanel.classList.add('open');
      analysisPanel.innerHTML = `<div class="analysis-inner"><div class="analysis-loading"><div class="spinner"></div>กำลังวิเคราะห์ไพ่...</div></div>`;
      const result = await callAnalysis(context, question, multiCards);
      renderAnalysis(analysisPanel, result);
    } catch (err) {
      showToast(err.message, 'error');
    }

    btn.disabled = false;
  });
}

function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
