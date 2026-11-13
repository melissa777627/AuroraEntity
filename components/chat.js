import { getFavorites, getEntityById, getReadingsByEntity, saveReading, deleteReading, clearEntityReadings, saveFavorite, removeFavorite, isFavorited, getReadingById, getEntityVibe, saveEntityVibe } from '../src/storage.js';
import { callAnalysis, callEntityVibe, callDecode, callVoice } from '../src/api.js';
import { enforceVoice, styleExamplesFor, recentGesturesFor } from '../src/reading-prompts.js';
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
  injectReadingStyle();

  const moon = getMoonPhase();
  const settings = getSettings();

  container.innerHTML = `
    <div class="chat-screen" data-entity-id="${entity.id}">
      <div class="chat-header">
        <div class="chat-header-icon">${entity.icon || '🌙'}</div>
        <div class="chat-header-info">
          <h2>${esc(entity.name || 'Entity')}</h2>
          <p>${esc(entity.domain || '')}</p>
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
          <button class="mini-deck" id="spread-cards-btn" type="button" disabled title="สับไพ่ (ตั้งคำถามก่อน)" aria-label="สับไพ่"><span></span><span></span><span></span></button>
        </div>
        <div class="chat-input-actions">
          <button type="button" class="continue-toggle" id="continue-toggle" aria-pressed="false" title="เปิด = ไพ่ชุดนี้ต่อจากเรื่องเมื่อกี้ / ปิด = เรื่องใหม่">🔗 ต่อจากเมื่อกี้</button>
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
  const questionInput = container.querySelector('#question-input');
  const cardsDisplay = container.querySelector('#selected-cards-display');

  // One question, one draw: the question must be set before drawing,
  // and stays locked to the drawn cards until the reading is sent or abandoned.
  function requireQuestion() {
    if (questionInput.value.trim()) return true;
    const errEl = container.querySelector('#submit-error');
    errEl.textContent = 'ตั้งคำถามก่อน แล้วค่อยจั่วไพ่';
    errEl.style.display = 'block';
    questionInput.focus();
    return false;
  }

  function setDrawn(picked) {
    selectedCards = picked;
    questionInput.readOnly = true;
    questionInput.classList.add('question-locked');
    container.querySelector('#submit-error').style.display = 'none';
    renderSelectedCards(cardsDisplay, selectedCards, abandonDraw);
  }

  function abandonDraw() {
    if (selectedCards.length && !confirm('ทิ้งคำถามและไพ่ชุดนี้ไหม?')) return;
    selectedCards = [];
    questionInput.readOnly = false;
    questionInput.classList.remove('question-locked');
    questionInput.value = '';
    renderSelectedCards(cardsDisplay, [], abandonDraw);
    syncDeck();
  }

  // "Continue from before" — off by default: each draw is a new message unless chosen
  const continueBtn = container.querySelector('#continue-toggle');
  function setContinue(on) {
    continueBtn.setAttribute('aria-pressed', String(!!on));
    continueBtn.classList.toggle('on', !!on);
  }
  continueBtn.addEventListener('click', () => setContinue(continueBtn.getAttribute('aria-pressed') !== 'true'));
  container.addEventListener('followup-picked', () => setContinue(true));

  // The deck wakes up once there is a question
  const deckBtn = container.querySelector('#spread-cards-btn');
  function syncDeck() {
    const ready = !!questionInput.value.trim() && !selectedCards.length;
    deckBtn.disabled = !ready;
    deckBtn.classList.toggle('awake', ready);
  }
  questionInput.addEventListener('input', syncDeck);

  deckBtn.addEventListener('click', async () => {
    if (selectedCards.length) { showToast('จั่วไพ่ไปแล้ว — กด ✕ ถ้าจะทิ้งชุดนี้'); return; }
    if (!requireQuestion()) return;
    questionInput.readOnly = true;
    document.activeElement?.blur?.();
    const picked = await openCardSpread(settings.defaultSpread || '3card', [], questionInput.value.trim(), entity);
    if (picked === 'manual') {
      const manual = await openCardPicker(settings.defaultSpread || '3card', []);
      if (manual.length > 0) setDrawn(manual);
      else questionInput.readOnly = false;
    } else if (picked.length > 0) {
      setDrawn(picked);
      submitReading();   // "ส่งถึงพี่" in the sheet sends right away
    } else {
      questionInput.readOnly = false;
    }
    syncDeck();
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

    if (!question || selectedCards.length === 0) {
      errEl.textContent = !question ? 'กรุณาใส่คำถาม' : 'จั่วไพ่ก่อนนะ — พี่ตอบผ่านไพ่';
      errEl.style.display = 'block';
      return;
    }
    errEl.style.display = 'none';

    // Previous exchanges, so a follow-up question is understood in context
    const continuing = continueBtn.getAttribute('aria-pressed') === 'true';
    const prev = continuing ? readings.slice(-3) : [];
    setContinue(false);   // every message starts as a new topic unless chosen again

    const readingId = `read_${Date.now()}`;
    const reading = {
      id: readingId,
      date: new Date().toISOString().split('T')[0],
      entity_id: entityId,
      context, question,
      continued: continuing,
      cards: selectedCards,
      messages: [],
      summary: ''
    };

    // Clear input
    container.querySelector('#context-input').value = '';
    container.querySelector('#question-input').value = '';
    selectedCards = [];
    questionInput.readOnly = false;
    questionInput.classList.remove('question-locked');
    renderSelectedCards(cardsDisplay, [], abandonDraw);
    syncDeck();

    // Add separator + user bubble + skeleton entity bubble
    const readingEl = document.createElement('div');
    readingEl.dataset.readingId = readingId;
    readingEl.innerHTML = `
      <div class="reading-separator">${formatDate(reading.date)}</div>
      ${reading.cards.length ? `
      <div class="reading-cards-row">
        ${reading.cards.map(cardChipHtml).join('')}
      </div>` : ''}
      <div class="user-bubble">
        <div class="user-bubble-avatar">${getSettings().userAvatar || '🌸'}</div>
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
        contentEl.innerHTML = TYPING_DOTS;
        if (!reading.decode) reading.decode = await callDecode(entity, context, question, reading.cards, prev);
        const decode = reading.decode;

        // Hesitation backed by the cards: let the pause be felt, not described
        if (decode.hesitation?.value) await new Promise(r => setTimeout(r, 1300));

        contentEl.textContent = '';
        const voiceExtras = {
          styleExamples: styleExamplesFor(entity.id, getFavorites()),
          recentGestures: recentGesturesFor(readings.filter(r => r.id !== reading.id))
        };
        const { text: rawText, usage } = await callVoice(entity, context, question, decode, prev, (_, full) => {
          contentEl.innerHTML = formatVoice(enforceVoice(full, decode, entity) || full);
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }, voiceExtras);
        const text = enforceVoice(rawText, decode, entity) || rawText;
        contentEl.innerHTML = formatVoice(text);

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

        renderDecodePanel(readingEl.querySelector(`#analysis-${readingId}`), reading);
        bindFollowup(readingEl, reading, container);
        bindRevoice(readingEl, reading, entity);

      } catch (err) {
        contentEl.classList.remove('streaming');
        contentEl.innerHTML = `<span style="color:#c0616b">❌ ${esc(err.message)}</span> <button class="btn btn-ghost btn-sm retry-btn" style="margin-left:8px">↩ ลองอีกครั้ง</button>`;
        // Retry = remove this failed message and send it again from scratch
        // (same question, same drawn cards — fresh decode and voice).
        contentEl.querySelector('.retry-btn').addEventListener('click', () => {
          readingEl.remove();
          const i = readings.indexOf(reading);
          if (i >= 0) readings.splice(i, 1);
          deleteReading(reading.id);
          container.querySelector('#context-input').value = reading.context || '';
          questionInput.value = reading.question || '';
          setContinue(!!reading.continued);
          setDrawn(reading.cards || []);
          submitReading();
        });
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
      ${reading.cards.map(cardChipHtml).join('')}
    </div>` : ''}
    <div class="user-bubble">
      <div class="user-bubble-avatar">${getSettings().userAvatar || '🌸'}</div>
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
      <div class="bubble-content">${formatVoice(reading.decode ? (enforceVoice(voice.content, reading.decode, entity) || voice.content) : voice.content)}</div>
      <div class="bubble-actions" id="actions-${reading.id}">
        ${buildBubbleActions(msgId, reading, entity, voice.content, voice.tokens)}
      </div>
    </div>
    <div class="analysis-panel" id="analysis-${reading.id}"></div>
    ` : ''}`;

  if (voice) {
    const actionsEl = el.querySelector(`#actions-${reading.id}`);
    bindBubbleActions(actionsEl, msgId, reading, entity, voice.content, el);

    if (reading.decode) {
      renderDecodePanel(el.querySelector(`#analysis-${reading.id}`), reading);
      bindFollowup(el, reading, chatMessages.closest('.chat-screen'));
      bindRevoice(el, reading, entity);
    } else if (reading.analysis) {
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
  const analyzeBtn = (!reading.decode && !reading.analysis && reading.cards?.length)
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

function renderSelectedCards(display, cards, onAbandon) {
  if (!cards.length) {
    display.innerHTML = '<span class="no-cards-text">ยังไม่ได้จั่วไพ่</span>';
    return;
  }
  // Drawn cards can't be swapped one by one — only the whole draw can be abandoned
  display.innerHTML = cards.map(c => `
    <div class="selected-card-chip${c.jumper ? ' jumper' : ''}">${c.jumper ? '✨ ' : ''}${esc(c.name)}</div>`).join('') +
    `<button class="btn-icon abandon-draw" title="ทิ้งคำถามและไพ่ชุดนี้">✕</button>`;
  display.querySelector('.abandon-draw')?.addEventListener('click', () => onAbandon?.());
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

// ── Two-step reading helpers ─────────────────────────────────────────────
const TYPING_DOTS = '<span class="reading-dots"><span></span><span></span><span></span></span>';

function cardChipHtml(c) {
  return `<span class="card-chip${c.jumper ? ' jumper' : ''}">${c.jumper ? '✨ ' : ''}${esc(c.name)}</span>`;
}

// Escape, then style *(action)* as body language
function formatVoice(text) {
  return esc(text || '').replace(/\*\(([^*\n]*?)\)\*/g, '<span class="voice-action">($1)</span>');
}

const ABOUT_TH = { entity: 'พี่', user: 'หนู', unclear: 'ไม่ชัด' };
const CHANNEL_LABEL = {
  affect: 'สีหน้า/อารมณ์', leak: 'อารมณ์รั่ว', illustrator: 'ท่าประกอบคำพูด', emblem: 'ท่าแทนคำ',
  regulator: 'ท่าคุมบทสนทนา', adaptor: 'ท่าคลายอึดอัด', proxemic: 'ระยะห่าง'
};

const SAY_ICON = { sentence: '💬', clause: '↪', body: '🫧', tone: '🎐' };
const SAY_LABEL = { sentence: 'พูดออกมา', clause: 'แทรกในประโยค', body: 'ออกทางท่าทาง', tone: 'ออกทางน้ำเสียง' };

// Calm, readable layout: what was sent, grouped by how it comes out; details folded away.
function renderDecodePanel(panel, reading) {
  const d = reading.decode;
  if (!panel || !d) return;
  const byId = Object.fromEntries((reading.cards || []).map(c => [c.id, c]));
  const names = ids => ids.map(id => esc(byId[id]?.nameTH || byId[id]?.name || id)).join(' · ');

  const order = ['sentence', 'clause', 'body', 'tone'];
  const groups = order.map(ch => {
    const items = d.messages.filter(m => (m.channel || 'sentence') === ch);
    if (!items.length) return '';
    return `<div class="dp-group">
      <div class="dp-group-title">${SAY_ICON[ch]} ${SAY_LABEL[ch]}</div>
      ${items.map(m => `<div class="dp-item${m.clarity === 'unclear' ? ' unclear' : ''}">
        <div class="dp-text">${m.core ? '⭐ ' : ''}${esc(m.text)}${m.weight > 1 ? ` <span class="dp-weight">ย้ำ ×${m.weight}</span>` : ''}</div>
        ${m.clarity === 'unclear' ? `<div class="dp-sub">ไม่ชัด — อาจหมายถึง ${esc(m.alt || '-')}${m.safe ? ` · พูดได้แค่ "${esc(m.safe)}"` : ''}</div>` : ''}
        ${m.about === 'user' || m.directive ? `<div class="dp-sub">${m.about === 'user' ? 'เรื่องของหนู' : ''}${m.about === 'user' && m.directive ? ' · ' : ''}${m.directive ? 'พี่อยากให้ทำ' : ''}</div>` : ''}
        <div class="dp-cards">${names(m.cards)}</div>
      </div>`).join('')}
    </div>`;
  }).join('');

  const facts = [
    d.intent ? `หนูกำลัง: ${esc(d.intent.replace(/^ผู้ถาม(กำลัง)?/, ''))}` : '',
    d.answer ? `คำตอบหลัก: ${esc(d.answer)}${d.answer_cards?.length ? ` (${names(d.answer_cards)})` : ''}` : '',
    d.off_topic ? '↪ ไพ่ไม่ได้ตอบสิ่งที่ถามตรงๆ — พี่พูดเรื่องที่ไพ่บอกแทน' : '',
    reading.continued ? '🔗 อ่านต่อจากเรื่องก่อนหน้า' : '',
    d.assumption && d.assumption.holds === false ? `ที่ถามว่า "${esc(d.assumption.text)}" ไม่ตรง — จริงๆ คือ ${esc(d.assumption.actual)}` : '',
    d.nonverbal?.channel && d.nonverbal.channel !== 'none' ? `ภาษากาย: ${esc(d.nonverbal.meaning)}` : '',
    d.hesitation?.value ? 'ลังเลก่อนตอบ' : '',
    d.silent ? 'พี่เลือกที่จะเงียบ' : '',
    d.unused?.length ? `⚠️ ไพ่ที่ไม่ได้ถูกนับ: ${names(d.unused)}` : ''
  ].filter(Boolean);

  const notes = (d.cards || []).map(c => `
    <div class="dp-note"><b>${names([c.id])}</b> ${esc(c.reading || '')}${c.why ? `<div class="dp-sub">${esc(c.why)}</div>` : ''}</div>`).join('');

  panel.classList.add('open');
  panel.innerHTML = `
    <div class="analysis-inner">
      <button class="dp-toggle" aria-expanded="false">🔒 สารที่ส่งมา</button>
      <div class="dp-body" hidden>
        ${groups}
        ${d.summary ? `<div class="dp-summary"><div class="dp-group-title">📝 สรุป</div>${esc(d.summary)}</div>` : ''}
        ${facts.length ? `<div class="dp-facts">${facts.map(f => `<div>${f}</div>`).join('')}</div>` : ''}
        ${notes ? `<details class="dp-details"><summary>ดูความหมายไพ่ทีละใบ</summary>${notes}</details>` : ''}
      </div>
    </div>`;
  panel.querySelector('.dp-toggle').addEventListener('click', function() {
    const body = panel.querySelector('.dp-body');
    body.hidden = !body.hidden;
    this.setAttribute('aria-expanded', String(!body.hidden));
    this.textContent = body.hidden ? '🔒 สารที่ส่งมา' : '🔓 สารที่ส่งมา';
  });
}

// Re-speak the same decoded message (same cards, same meaning — only the wording is redone)
function bindRevoice(readingEl, reading, entity) {
  const actions = readingEl.querySelector('.bubble-actions');
  if (!reading.decode || !actions || actions.querySelector('.revoice-btn')) return;
  const btn = document.createElement('button');
  btn.className = 'btn-icon revoice-btn';
  const titleFor = () => reading.redecoded ? 'ให้พี่พูดใหม่ (สารเดิม ไพ่เดิม)' : 'อ่านไพ่ชุดนี้ใหม่ 1 ครั้ง (ไพ่เดิม ถอดสารใหม่)';
  btn.title = titleFor();
  btn.textContent = '🔄';
  btn.addEventListener('click', async () => {
    const contentEl = readingEl.querySelector('.bubble-content');
    if (!contentEl || btn.disabled) return;
    btn.disabled = true;
    const before = contentEl.innerHTML;
    contentEl.innerHTML = TYPING_DOTS;
    try {
      const prev = reading.continued ? getReadingsByEntity(reading.entity_id).filter(r => r.id < reading.id).slice(-3) : [];
      // One fresh decode per reading (so rule changes reach old readings); after that only the
      // wording is redone — otherwise re-reading becomes fishing for a nicer interpretation.
      if (!reading.redecoded) {
        reading.decode = await callDecode(entity, reading.context, reading.question, reading.cards || [], prev);
        reading.redecoded = true;
        renderDecodePanel(readingEl.querySelector(`#analysis-${reading.id}`), reading);
        readingEl.querySelector('.followup-row')?.remove();
        bindFollowup(readingEl, reading, readingEl.closest('.chat-screen'));
      }
      const voiceExtras = {
        styleExamples: styleExamplesFor(entity.id, getFavorites().filter(f => f.reading_id !== reading.id)),
        recentGestures: recentGesturesFor(getReadingsByEntity(reading.entity_id).filter(r => r.id !== reading.id))
      };
      const { text: raw, usage } = await callVoice(entity, reading.context, reading.question, reading.decode, prev, (_, full) => {
        contentEl.innerHTML = formatVoice(enforceVoice(full, reading.decode, entity) || full);
      }, voiceExtras);
      const text = enforceVoice(raw, reading.decode, entity) || raw;
      contentEl.innerHTML = formatVoice(text);
      const msg = reading.messages?.[0];
      if (msg) { msg.content = text; msg.tokens = usage; } else reading.messages = [{ id: `msg_${Date.now()}`, role: 'assistant', content: text, tokens: usage }];
      saveReading(reading);
      btn.title = titleFor();
    } catch (err) {
      contentEl.innerHTML = before;
      showToast(err.message, 'error');
    }
    btn.disabled = false;
  });
  actions.prepend(btn);
}

// A suggested follow-up only fills the question box — the user still draws cards as usual
function bindFollowup(readingEl, reading, screen) {
  const q = reading.decode?.followup;
  const actions = readingEl.querySelector('.bubble-actions');
  if (!q || !actions || readingEl.querySelector('.followup-row')) return;
  const btn = document.createElement('button');
  btn.className = 'followup-chip';
  btn.textContent = `💬 ${q}`;
  btn.title = 'ใส่เป็นคำถามถัดไป (ยังต้องจั่วไพ่เอง)';
  btn.addEventListener('click', () => {
    const input = screen?.querySelector('#question-input');
    if (!input || input.readOnly) { showToast('มีคำถามที่จั่วไพ่ค้างอยู่'); return; }
    input.value = q;
    input.dispatchEvent(new Event('input'));
    screen.dispatchEvent(new CustomEvent('followup-picked', { bubbles: true }));
    screen.querySelector('#chat-input-area')?.classList.remove('collapsed');
    input.focus();
  });
  const row = document.createElement('div');
  row.className = 'followup-row';
  row.innerHTML = '<span class="followup-label">ถามต่อได้</span>';
  row.appendChild(btn);
  actions.after(row);
}

function injectReadingStyle() {
  if (document.getElementById('reading-style')) return;
  const style = document.createElement('style');
  style.id = 'reading-style';
  style.textContent = `
    .voice-action { display:inline-block; font-style:italic; color:var(--text-soft); font-size:0.9em; }
    .reading-dots { display:inline-flex; gap:4px; padding:4px 0; }
    .reading-dots span { width:6px; height:6px; border-radius:50%; background:var(--text-soft); opacity:0.5; animation:readingDot 1.2s infinite; }
    .reading-dots span:nth-child(2) { animation-delay:0.2s; }
    .reading-dots span:nth-child(3) { animation-delay:0.4s; }
    @keyframes readingDot { 0%,80%,100% { opacity:0.25; transform:translateY(0); } 40% { opacity:0.9; transform:translateY(-3px); } }
    .bubble-content.streaming:has(.reading-dots)::after { display:none; }
    .question-locked { opacity:0.75; }
    .card-chip.jumper, .selected-card-chip.jumper { box-shadow:0 0 0 1.5px var(--accent); }
    .abandon-draw { font-size:0.8rem; opacity:0.6; }
    .followup-row { display:flex; flex-direction:column; align-items:flex-start; gap:4px; margin-top:8px; }
    .followup-label { font-size:0.66rem; color:var(--text-soft); opacity:0.8; }
    .dp-summary { font-size:0.84rem; line-height:1.6; padding:8px 10px; border-radius:10px; background:var(--bg-primary); }
    .followup-chip { font:inherit; font-size:0.74rem; line-height:1.45; padding:3px 10px; border-radius:12px; border:1px dashed var(--accent); background:transparent; color:var(--text-soft); cursor:pointer; max-width:100%; text-align:left; }
    .dp-toggle { width:100%; text-align:left; font:inherit; font-size:0.85rem; color:var(--text-soft); background:none; border:none; padding:6px 2px; cursor:pointer; }
    .dp-body { display:flex; flex-direction:column; gap:14px; padding:4px 2px 6px; font-size:0.86rem; line-height:1.6; }
    .dp-group { display:flex; flex-direction:column; gap:8px; }
    .dp-group-title { font-size:0.72rem; letter-spacing:0.02em; color:var(--text-soft); }
    .dp-item { padding-left:10px; border-left:2px solid var(--accent); }
    .dp-item.unclear { border-left-style:dashed; }
    .dp-text { color:var(--text-primary); }
    .dp-weight { font-size:0.7rem; color:var(--accent-deep); white-space:nowrap; }
    .dp-sub { font-size:0.74rem; color:var(--text-soft); }
    .dp-cards { font-size:0.7rem; color:var(--text-soft); opacity:0.85; }
    .dp-facts { font-size:0.76rem; color:var(--text-soft); display:flex; flex-direction:column; gap:2px; }
    .dp-details summary { font-size:0.76rem; color:var(--text-soft); cursor:pointer; }
    .dp-note { font-size:0.8rem; margin-top:6px; }
    .revoice-btn { font-size:0.9rem; opacity:0.7; }
    .continue-toggle { font:inherit; font-size:0.74rem; padding:4px 10px; border-radius:999px; border:1px dashed var(--accent); background:transparent; color:var(--text-soft); cursor:pointer; margin-right:auto; }
    .continue-toggle.on { border-style:solid; border-color:var(--accent-deep); background:var(--bg-secondary); color:var(--text-primary); }
    .decode-list { list-style:none; padding:0; margin:6px 0; display:flex; flex-direction:column; gap:6px; font-size:0.82rem; line-height:1.55; }
    .decode-msg.unclear { opacity:0.8; }
    .decode-about { font-size:0.7rem; color:var(--text-soft); }
    .decode-tag { font-size:0.65rem; padding:1px 6px; border-radius:8px; background:var(--accent); }
    .decode-cards, .decode-sub { font-size:0.72rem; color:var(--text-soft); }
    .decode-extra { font-size:0.75rem; color:var(--text-soft); margin-top:4px; }
    .decode-notes-title { font-size:0.72rem; font-weight:600; color:var(--text-soft); margin-top:10px; }
  `;
  document.head.appendChild(style);
}
