import { getEntityById, getReadingsByEntity, saveReading, deleteReading, clearEntityReadings, saveFavorite, removeFavorite, isFavorited, getReadingById, getEntityVibe, saveEntityVibe } from '../src/storage.js';
import { callEntityVoice, callAnalysis, callEntityVibe } from '../src/api.js';
import { getMoonPhase } from '../src/moonphase.js';
import { getSettings } from '../src/storage.js';
import { showToast, navigate } from '../src/app.js';
import { openCardPicker, openCardSpread } from './card-picker.js';

export function renderChat(entityId, readingId, container) {
  const entity = getEntityById(entityId);
  if (!entity) {
    container.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">👻</div><p>ไม่พบ Entity นี้</p><button class="btn btn-secondary" onclick="navigate('#/')">กลับหน้าหลัก</button></div></div>`;
    return;
  }

  // Inject ambient style
  injectEntityStyle(entity);

  const moon = getMoonPhase();
  const settings = getSettings();

  container.innerHTML = `
    <div class="chat-screen" data-entity-id="${entity.id}">
      <div class="chat-header">
        <div class="chat-header-icon">${entity.icon || '🌙'}</div>
        <div class="chat-header-info">
          <h2>${esc(entity.name || 'Entity')}</h2>
          <p>${esc(entity.element || '')}${entity.domain ? ' • ' + esc(entity.domain) : ''}</p>
          <div id="chat-vibe-area"></div>
        </div>
        <div style="margin-left:auto;display:flex;gap:4px;align-items:center">
          <button class="btn-icon" id="clear-history-btn" title="ล้างประวัติการสนทนาทั้งหมด">🗑️</button>
          <button class="btn-icon" id="edit-entity-btn" title="แก้ไข profile">✏️</button>
        </div>
        <div class="moon-badge" title="${moon.meaningTH}">${moon.emoji} ${moon.nameTH}</div>
      </div>

      <div class="chat-messages" id="chat-messages"></div>

      <div class="chat-input-area" id="chat-input-area">
        <div class="chat-input-toggle" id="chat-input-toggle">
          <span class="chat-input-toggle-chevron">▲</span>
          <span class="chat-input-toggle-label">ถาม</span>
        </div>
        <div class="chat-input-row">
          <input type="text" class="input" id="context-input" placeholder="บริบท เช่น ถามเรื่องงาน...">
          <input type="text" class="input" id="question-input" placeholder="คำถาม...">
        </div>
        <div class="cards-row">
          <div class="selected-cards-display" id="selected-cards-display">
            <span class="no-cards-text">ยังไม่ได้เลือกไพ่</span>
          </div>
          <button class="btn btn-secondary" id="pick-cards-btn" title="เลือกจากรายการ">🃏 เลือกไพ่</button>
          <button class="btn btn-ghost" id="spread-cards-btn" title="สุ่มจากเดค">🎴 เปิดจากเดค</button>
        </div>
        <div class="chat-input-actions">
          <span id="submit-error" style="font-size:0.78rem;color:#c0616b;display:none"></span>
          <button class="btn btn-primary" id="submit-btn" ${!settings.apiKey ? 'disabled title="ตั้ง API Key ใน Settings ก่อน"' : ''}>
            🌸 ถาม
          </button>
        </div>
      </div>
    </div>`;

  const chatMessages = container.querySelector('#chat-messages');
  const inputArea = container.querySelector('#chat-input-area');
  const inputToggle = container.querySelector('#chat-input-toggle');

  inputToggle?.addEventListener('click', () => inputArea?.classList.toggle('collapsed'));

  // Entity vibe in chat header
  initChatVibe(container, entity);

  let selectedCards = [];

  // Load past readings
  const readings = getReadingsByEntity(entityId);
  readings.forEach(r => appendReading(chatMessages, r, entity));

  // Jump to specific reading
  if (readingId) {
    setTimeout(() => {
      const el = chatMessages.querySelector(`[data-reading-id="${readingId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  } else {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Clear history
  container.querySelector('#clear-history-btn').addEventListener('click', () => {
    if (!confirm(`ล้างประวัติการสนทนากับ ${entity.name} ทั้งหมดไหม?\n(ลบออกถาวร ไม่สามารถกู้คืนได้)`)) return;
    clearEntityReadings(entityId);
    chatMessages.innerHTML = '';
    readings.length = 0;
    showToast('ล้างประวัติแล้ว', 'success');
  });

  // Edit entity
  container.querySelector('#edit-entity-btn').addEventListener('click', () => navigate(`#/entity/${entityId}`));

  // Card picker
  container.querySelector('#pick-cards-btn').addEventListener('click', async () => {
    const picked = await openCardPicker(settings.defaultSpread || '3card', selectedCards);
    if (picked.length > 0) {
      selectedCards = picked;
      renderSelectedCards(container.querySelector('#selected-cards-display'), selectedCards);
    }
  });

  container.querySelector('#spread-cards-btn').addEventListener('click', async () => {
    const picked = await openCardSpread(settings.defaultSpread || '3card', selectedCards);
    if (picked.length > 0) {
      selectedCards = picked;
      renderSelectedCards(container.querySelector('#selected-cards-display'), selectedCards);
    }
  });

  // Submit
  container.querySelector('#submit-btn').addEventListener('click', () => submitReading());

  container.querySelector('#question-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitReading(); }
  });

  async function submitReading() {
    const context = container.querySelector('#context-input').value.trim();
    const question = container.querySelector('#question-input').value.trim();
    const errEl = container.querySelector('#submit-error');

    if (!question && selectedCards.length === 0) {
      errEl.textContent = 'กรุณาใส่คำถามหรือเลือกไพ่';
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';

    // Build history from current readings (last 6 messages)
    const history = buildHistory(readings);

    const readingId = `read_${Date.now()}`;
    const reading = {
      id: readingId,
      date: new Date().toISOString().split('T')[0],
      entity_id: entityId,
      context, question,
      cards: selectedCards,
      messages: [],
      summary: ''
    };

    // Clear input
    container.querySelector('#context-input').value = '';
    container.querySelector('#question-input').value = '';
    selectedCards = [];
    renderSelectedCards(container.querySelector('#selected-cards-display'), []);

    // Add separator + user bubble + skeleton entity bubble
    const readingEl = document.createElement('div');
    readingEl.dataset.readingId = readingId;
    readingEl.innerHTML = `
      <div class="reading-separator">${formatDate(reading.date)}</div>
      ${reading.cards.length ? `
      <div class="reading-cards-row">
        ${reading.cards.map(c => `<span class="card-chip${c.reversed?' reversed':''}">${c.name}${c.reversed?' ↕':''}</span>`).join('')}
      </div>` : ''}
      <div class="user-bubble">
        <div class="user-bubble-inner">
          ${context ? `<div class="user-bubble-context">${esc(context)}</div>` : ''}
          <div class="user-bubble-question">${esc(question) || '(ไม่มีคำถาม)'}</div>
        </div>
      </div>
      <div class="entity-bubble" id="bubble-${readingId}">
        <div class="bubble-header">
          <div class="entity-icon-badge">${entity.icon || '🌙'}</div>
          <span class="bubble-entity-name">${esc(entity.name)}</span>
        </div>
        <div class="bubble-content streaming" id="content-${readingId}"></div>
        <div class="bubble-actions" id="actions-${readingId}" style="display:none"></div>
      </div>
      <div class="analysis-panel" id="analysis-${readingId}"></div>`;
    chatMessages.appendChild(readingEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const contentEl = readingEl.querySelector(`#content-${readingId}`);
    const actionsEl = readingEl.querySelector(`#actions-${readingId}`);
    const submitBtn = container.querySelector('#submit-btn');

    async function attempt() {
      contentEl.className = 'bubble-content streaming';
      contentEl.textContent = '';
      actionsEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳';

      try {
        const { text, usage } = await callEntityVoice(entity, context, question, reading.cards, history, (_, full) => {
          contentEl.textContent = full;
          chatMessages.scrollTop = chatMessages.scrollHeight;
        });

        contentEl.classList.remove('streaming');
        submitBtn.disabled = false;
        submitBtn.textContent = '🌸 ถาม';

        const msgId = `msg_${Date.now()}`;
        reading.messages = [{ id: msgId, role: 'assistant', content: text, tokens: usage }];
        if (!readings.includes(reading)) readings.push(reading);
        saveReading(reading);

        actionsEl.style.display = 'flex';
        actionsEl.innerHTML = buildBubbleActions(msgId, reading, entity, text, usage);
        bindBubbleActions(actionsEl, msgId, reading, entity, text, readingEl);
        inputArea?.classList.add('collapsed');

        if (reading.cards?.length) {
          const analysisPanel = readingEl.querySelector(`#analysis-${readingId}`);
          analysisPanel.classList.add('open');
          analysisPanel.innerHTML = `<div class="analysis-inner"><div class="analysis-loading"><div class="spinner"></div>กำลังอ่านพลังงาน...</div></div>`;
          callAnalysis(entity, context, question, reading.cards)
            .then(result => {
              if (!getReadingById(reading.id)) return;
              reading.analysis = result;
              saveReading(reading);
              renderAnalysis(analysisPanel, result);
            })
            .catch(() => {
              analysisPanel.classList.remove('open');
              showToast('วิเคราะห์ไพ่ไม่สำเร็จ', 'error');
            });
        }

      } catch (err) {
        contentEl.classList.remove('streaming');
        contentEl.innerHTML = `<span style="color:#c0616b">❌ ${esc(err.message)}</span> <button class="btn btn-ghost btn-sm retry-btn" style="margin-left:8px">↩ ลองอีกครั้ง</button>`;
        contentEl.querySelector('.retry-btn').addEventListener('click', attempt);
        submitBtn.disabled = false;
        submitBtn.textContent = '🌸 ถาม';
      }
    }

    attempt();
  }
}

function appendReading(chatMessages, reading, entity) {
  const el = document.createElement('div');
  el.dataset.readingId = reading.id;

  const voice = reading.messages?.find(m => m.role === 'assistant');
  const msgId = voice?.id || `msg_${reading.id}`;

  el.innerHTML = `
    <div class="reading-separator">${formatDate(reading.date)}</div>
    ${reading.cards?.length ? `
    <div class="reading-cards-row">
      ${reading.cards.map(c => `<span class="card-chip${c.reversed?' reversed':''}">${c.name}</span>`).join('')}
    </div>` : ''}
    <div class="user-bubble">
      <div class="user-bubble-inner">
        ${reading.context ? `<div class="user-bubble-context">${esc(reading.context)}</div>` : ''}
        <div class="user-bubble-question">${esc(reading.question) || '(ไม่มีคำถาม)'}</div>
      </div>
    </div>
    ${voice ? `
    <div class="entity-bubble">
      <div class="bubble-header">
        <div class="entity-icon-badge">${entity.icon || '🌙'}</div>
        <span class="bubble-entity-name">${esc(entity.name)}</span>
      </div>
      <div class="bubble-content">${esc(voice.content)}</div>
      <div class="bubble-actions" id="actions-${reading.id}">
        ${buildBubbleActions(msgId, reading, entity, voice.content, voice.tokens)}
      </div>
    </div>
    <div class="analysis-panel" id="analysis-${reading.id}"></div>
    ` : ''}`;

  if (voice) {
    const actionsEl = el.querySelector(`#actions-${reading.id}`);
    bindBubbleActions(actionsEl, msgId, reading, entity, voice.content, el);

    if (reading.analysis) {
      const analysisPanel = el.querySelector(`#analysis-${reading.id}`);
      if (analysisPanel) {
        analysisPanel.classList.add('open');
        renderAnalysis(analysisPanel, reading.analysis);
      }
    }
  }

  chatMessages.appendChild(el);
}

function buildBubbleActions(msgId, reading, entity, content, usage) {
  const fav = isFavorited(msgId);
  const tokenText = usage?.totalTokenCount ? `<span class="token-badge" title="prompt: ${usage.promptTokenCount ?? '?'} / output: ${usage.candidatesTokenCount ?? '?'}">⚡ ${usage.totalTokenCount} tokens</span>` : '';
  // Show analyze button only for old readings without cached analysis
  const analyzeBtn = (!reading.analysis && reading.cards?.length)
    ? `<button class="btn-analysis-toggle" data-reading-id="${reading.id}">📖 วิเคราะห์ไพ่ ▼</button>`
    : '';
  return `
    ${tokenText}
    <button class="btn-favorite${fav ? ' active' : ''}" data-msg-id="${msgId}" title="${fav ? 'เอาออกจาก Favorites' : 'เพิ่มใน Favorites'}">
      ${fav ? '❤️' : '🤍'}
    </button>
    ${analyzeBtn}
    <button class="btn-icon btn-delete-reading" data-reading-id="${reading.id}" title="ลบ reading นี้" style="margin-left:auto;color:#c0616b;opacity:0.6" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.6">
      🗑️
    </button>`;
}

function bindBubbleActions(actionsEl, msgId, reading, entity, content, readingEl) {
  actionsEl.querySelector('.btn-favorite')?.addEventListener('click', function() {
    if (isFavorited(msgId)) {
      removeFavorite(msgId);
      this.textContent = '🤍';
      this.classList.remove('active');
      this.title = 'เพิ่มใน Favorites';
      showToast('เอาออกจาก Favorites แล้ว');
    } else {
      saveFavorite({
        message_id: msgId,
        reading_id: reading.id,
        entity_id: entity.id,
        entity_name: entity.name,
        entity_icon: entity.icon,
        content,
        date: reading.date,
        tag: ''
      });
      this.textContent = '❤️';
      this.classList.add('active');
      this.title = 'เอาออกจาก Favorites';
      showToast('บันทึกใน Favorites แล้ว 🌸', 'success');
    }
  });

  actionsEl.querySelector('.btn-delete-reading')?.addEventListener('click', function() {
    if (!confirm('ลบ reading นี้ออกไหม?')) return;
    deleteReading(reading.id);
    readingEl.remove();
    showToast('ลบแล้ว');
  });

  actionsEl.querySelector('.btn-analysis-toggle')?.addEventListener('click', function() {
    const panel = readingEl.querySelector(`#analysis-${reading.id}`);
    if (!panel) return;

    if (panel.classList.contains('open')) {
      panel.classList.remove('open');
      this.classList.remove('open');
      this.textContent = '📖 ดูเหตุผล ▼';
      return;
    }

    panel.classList.add('open');
    this.classList.add('open');
    this.textContent = '📖 ซ่อนเหตุผล ▲';

    if (panel.dataset.loaded) return;
    panel.dataset.loaded = 'true';
    loadAnalysis(panel, reading);
  });
}

async function loadAnalysis(panel, reading) {
  panel.innerHTML = `<div class="analysis-inner"><div class="analysis-loading"><div class="spinner"></div>กำลังวิเคราะห์ไพ่...</div></div>`;

  try {
    const entityForAnalysis = getEntityById(reading.entity_id);
    const result = await callAnalysis(entityForAnalysis, reading.context, reading.question, reading.cards || []);
    reading.analysis = result;
    saveReading(reading);
    renderAnalysis(panel, result);
  } catch (err) {
    panel.innerHTML = `<div class="analysis-inner"><div class="analysis-error">❌ โหลดไม่ได้: ${err.message}</div></div>`;
    panel.dataset.loaded = '';
  }
}

export function renderAnalysis(panel, data) {
  const cards = data.cards || [];
  panel.innerHTML = `
    <div class="analysis-inner">
      ${data.overall_energy ? `
        <div class="analysis-overall">
          <strong style="font-size:0.72rem;color:var(--text-soft);display:block;margin-bottom:4px;letter-spacing:0.04em">✨ พลังงานรวม</strong>
          ${esc(data.overall_energy)}
        </div>` : ''}
      ${cards.length ? `
        <button class="btn-cards-expand">📖 ดูรายละเอียดไพ่แต่ละใบ ▼</button>
        <div class="analysis-cards-detail">
          ${cards.map(card => `
            <div class="analysis-card-item">
              <div class="analysis-card-name">
                🃏 ${esc(card.name)}${card.nameTH ? ` <span style="color:var(--text-soft);font-weight:400">(${esc(card.nameTH)})</span>` : ''}
                ${card.element ? `<span class="analysis-card-element">${esc(card.element)}</span>` : ''}
                ${card.orientation === 'reversed' ? '<span class="analysis-card-element">กลับหัว</span>' : ''}
                ${card.position_label ? `<span style="font-size:0.72rem;color:var(--text-soft);">(${esc(card.position_label)})</span>` : ''}
              </div>
              ${card.keywords?.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px">${card.keywords.map(k => `<span style="font-size:0.7rem;background:var(--accent);padding:2px 7px;border-radius:10px;">${esc(k)}</span>`).join('')}</div>` : ''}
              ${card.in_context ? `<div class="analysis-field" style="font-style:italic;color:var(--accent-text,var(--accent));font-weight:600;margin-bottom:4px">"${esc(card.in_context)}"</div>` : ''}
              ${card.reasoning ? `<div class="analysis-field" style="font-size:0.82rem;line-height:1.6">${esc(card.reasoning)}</div>` : ''}
            </div>
          `).join('')}
        </div>` : ''}
    </div>`;

  panel.querySelector('.btn-cards-expand')?.addEventListener('click', function() {
    const detail = panel.querySelector('.analysis-cards-detail');
    const isOpen = detail.classList.contains('open');
    detail.classList.toggle('open', !isOpen);
    this.textContent = isOpen ? '📖 ดูรายละเอียดไพ่แต่ละใบ ▼' : '📖 ซ่อนรายละเอียด ▲';
  });
}

function renderSelectedCards(display, cards) {
  if (!cards.length) {
    display.innerHTML = '<span class="no-cards-text">ยังไม่ได้เลือกไพ่</span>';
    return;
  }
  display.innerHTML = cards.map((c, i) => `
    <div class="selected-card-chip">
      ${c.position_label ? `<span style="color:var(--text-soft);font-size:0.65rem">${esc(c.position_label)}:</span>` : ''}
      ${esc(c.name)}${c.reversed ? ' ↕' : ''}
      <span class="remove-card" data-idx="${i}">✕</span>
    </div>`).join('');

  display.querySelectorAll('.remove-card').forEach(btn => {
    btn.addEventListener('click', () => {
      cards.splice(parseInt(btn.dataset.idx), 1);
      renderSelectedCards(display, cards);
    });
  });
}

function buildHistory(readings) {
  const msgs = [];
  for (const r of readings.slice(-3)) {
    const cardNames = r.cards?.map(c => c.name).join(', ') || 'ไม่มีไพ่';
    const opening = r.messages?.[0]?.content?.slice(0, 80)?.trim();
    msgs.push({ role: 'user', content: `[เคยถาม] ${r.question || '(ไม่มีคำถาม)'} | ไพ่: ${cardNames}` });
    msgs.push({ role: 'model', content: `(ตอบไปแล้ว — ห้ามซ้ำสไตล์และรูปแบบเดิม${opening ? ` เช่น: "${opening}..."` : ''})` });
  }
  return msgs;
}

function injectEntityStyle(entity) {
  const id = `entity-style-${entity.id}`;
  document.getElementById(id)?.remove();
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `.chat-screen[data-entity-id="${entity.id}"] { --entity-primary: ${entity.color_primary || 'var(--accent)'}; --entity-secondary: ${entity.color_secondary || 'var(--bg-secondary)'}; }`;
  document.head.appendChild(style);
}

function initChatVibe(container, entity) {
  const vibeArea = container.querySelector('#chat-vibe-area');
  if (!vibeArea) return;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const vibe = getEntityVibe(entity.id);

  if (vibe?.date === today && vibe?.vibe) {
    vibeArea.innerHTML = `<span class="chat-vibe-text">🂠 ${esc(vibe.cardNameTH || '')} · ${esc(vibe.vibe)}</span><button class="chat-vibe-reset" title="สุ่มใหม่">↺</button>`;
  } else {
    vibeArea.innerHTML = `<button class="chat-vibe-btn">✦ ดูพลังงานวันนี้</button>`;
  }

  vibeArea.addEventListener('click', async e => {
    if (e.target.classList.contains('chat-vibe-btn') || e.target.classList.contains('chat-vibe-reset')) {
      vibeArea.innerHTML = `<span class="chat-vibe-text" style="opacity:0.5">⏳</span>`;
      try {
        const data = await fetch('data/cards.json').then(r => r.json());
        const pool = data.tarot || [];
        const card = pool[Math.floor(Math.random() * pool.length)];
        const vibeText = await callEntityVibe(entity, card);
        saveEntityVibe(entity.id, { date: today, cardId: card.id, cardNameTH: card.nameTH || card.name, reversed: false, vibe: vibeText });
        vibeArea.innerHTML = `<span class="chat-vibe-text">🂠 ${esc(card.nameTH || card.name)} · ${esc(vibeText)}</span><button class="chat-vibe-reset" title="สุ่มใหม่">↺</button>`;
        // sync sidebar if visible
        const sidebarVibeArea = document.querySelector(`.entity-vibe-area[data-entity-id="${entity.id}"]`);
        if (sidebarVibeArea) sidebarVibeArea.innerHTML = `<div class="entity-vibe">🂠 ${esc(card.nameTH || card.name)} · ${esc(vibeText)}<button class="entity-vibe-reset" title="สุ่มใหม่" onclick="event.preventDefault();event.stopPropagation();window.resetEntityVibe('${entity.id}')">↺</button></div>`;
      } catch {
        vibeArea.innerHTML = `<button class="chat-vibe-btn">✦ ดูพลังงานวันนี้</button>`;
      }
    }
  });
}

function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDate(s) { try { return new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return s || ''; } }
