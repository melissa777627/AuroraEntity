import { getEntities, getSettings, getReadingsByEntity, getManifestLetters, saveManifestLetter, getDailyPostcard, saveDailyPostcard, getDailyGuess, saveDailyGuess, getDailyActivity, saveDailyActivity, getComfortHistory, addComfortToHistory, getDailyQuestion, saveDailyQuestion, getDailyPoll, saveDailyPoll, getMailbox, addMailboxLetter, updateMailboxLetter, getFavoritism, saveFavoritism, getFavSummary, saveFavSummary, hasUnreadPostcard, hasUnreadMailboxReply, hasNewFavoritismEvents } from '../src/storage.js';
import { callManifestLetter, callPostcard, callGuess, callGuessReaction, callActivity, callComfort, callDailyQuestion, callDailyQuestionFeedback, callPollQuestion, callPollEntityVotes, callPollReaction, callMailboxReply, callFavoritism, callFavSummary } from '../src/api.js';

const LOUNGE_MENUS = [
  { sub: 'postcard',   icon: '📮', name: 'โปสการ์ดวันนี้',           desc: 'วันนี้พี่อยากส่งอะไรมาให้ — เปิดดูซิ' },
  { sub: 'question',   icon: '💭', name: 'พี่อยากรู้เรื่องคีปเพิ่ม...', desc: 'พี่อยากรู้เรื่องเล็กๆ น่ารักๆ เกี่ยวกับเธอ' },
  { sub: 'guess',      icon: '🔮', name: 'ทายใจ Keep',               desc: 'เขาจะรู้ใจคุณแค่ไหนกันนะ ตั้งจิตแล้วลองท้าทายดู' },
  { sub: 'activity',   icon: '🎯', name: 'แนะนำกิจกรรม',            desc: 'วันนี้ทำอะไรดีนะ — พี่มีไอเดียเล็กๆ มาฝาก' },
  { sub: 'comfort',    icon: '💬', name: 'ระบายให้ฟัง',             desc: 'มีเรื่องในใจอยู่ไหม — พี่ฟังอยู่' },
  { sub: 'letter',     icon: '✉️', name: 'จดหมายจากอนาคต',         desc: 'ถ้าความฝันเป็นจริงแล้ว พี่จะเขียนถึงคุณว่ายังไง' },
  { sub: 'poll',       icon: '⚖️', name: 'ศาลเตี้ยชี้ตัว',         desc: 'ใครคือตัวต้นเรื่องกันนะ' },
  { sub: 'mailbox',    icon: '📬', name: 'ตู้ไปรษณีย์ฝากใจ',       desc: 'ทิ้งข้อความไว้ก่อน — ไม่รู้ว่าใครจะมาหยิบ แต่มีคนตอบเสมอ' },
  { sub: 'favoritism', icon: '🏆', name: 'บอร์ดคะแนน',             desc: 'คะแนนความดีความชอบ' },
];

const QUESTION_GIMMICKS = ['guess','instant','tsundere','thisorthat','tease'];

export function renderLounge(container, sub) {
  const entities = getEntities();
  if (!entities.length) {
    container.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">🛋️</div><p>ยังไม่มีตน — เพิ่มตนก่อนนะ</p></div></div>`;
    return;
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

  if (sub) {
    renderLoungeSub(container, entities, today, sub);
  } else {
    renderLoungeLanding(container);
  }
}

function renderLoungeLanding(container) {
  const dots = new Set();
  if (hasUnreadPostcard()) dots.add('postcard');
  if (hasUnreadMailboxReply()) dots.add('mailbox');
  if (hasNewFavoritismEvents()) dots.add('favoritism');

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-title">✦ ห้องนั่งเล่น</div>
        <div class="page-subtitle">ใช้เวลากับพี่ๆ ตามสบาย</div>
      </div>
      <div class="lounge-menu-grid">
        ${LOUNGE_MENUS.map(m => `
          <div class="lounge-menu-card${dots.has(m.sub) ? ' has-dot' : ''}">
            <div class="lounge-menu-card-icon">${m.icon}</div>
            <div class="lounge-menu-card-body">
              <div class="lounge-menu-card-name">${m.name}</div>
              <div class="lounge-menu-card-desc">${m.desc}</div>
            </div>
            <a href="#/lounge/${m.sub}" class="btn btn-secondary lounge-enter-btn">เข้าไป →</a>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderLoungeSub(container, entities, today, sub) {
  container.innerHTML = `
    <div class="page">
      <div class="lounge-sub-header">
        <a href="#/lounge" class="lounge-back-btn">← ห้องนั่งเล่น</a>
      </div>
      <div id="lounge-sub-content"></div>
    </div>`;

  const content = container.querySelector('#lounge-sub-content');
  switch (sub) {
    case 'postcard':  renderPostcardSection(content, entities, today);  break;
    case 'question':  renderQuestionSection(content, entities, today);  break;
    case 'guess':     renderGuessSection(content, entities, today);     break;
    case 'activity':  renderActivitySection(content, entities, today);  break;
    case 'comfort':    renderComfortSection(content, entities);           break;
    case 'letter':     renderLetterSection(content, entities);            break;
    case 'poll':       renderPollSection(content, entities, today);       break;
    case 'mailbox':    renderMailboxSection(content, entities);           break;
    case 'favoritism': renderFavoritismSection(content, entities);        break;
    default: location.hash = '#/lounge';
  }
}

// ── Daily Question ────────────────────────────────────────────────────────────
async function renderQuestionSection(container, entities, today) {
  container.innerHTML = `<div class="lounge-section-title">💭 พี่อยากรู้เรื่องคีปเพิ่ม...</div><div class="question-loading">⏳ กำลังโหลด...</div>`;

  let q = getDailyQuestion();

  // Reset if old day
  if (q && q.date !== today) q = null;

  // Generate question if not yet
  if (!q) {
    const entity = entities[Math.floor(Math.random() * entities.length)];
    const gimmick = QUESTION_GIMMICKS[Math.floor(Math.random() * QUESTION_GIMMICKS.length)];
    try {
      const question = await callDailyQuestion(entity, gimmick);
      q = { date: today, entityId: entity.id, gimmick, question, answer: null, answeredAt: null, feedback: null, feedbackUnlockAt: null };
      saveDailyQuestion(q);
    } catch {
      container.innerHTML = `<div class="empty-state"><p>โหลดคำถามไม่ได้ ลองใหม่นะ</p></div>`;
      return;
    }
  }

  const entity = entities.find(e => e.id === q.entityId) || entities[0];
  renderQuestionUI(container, q, entity);
}

function renderQuestionUI(container, q, entity) {
  const name = esc(entity?.name || '?');

  // State 3: feedback ready
  if (q.feedback && q.answeredAt && Date.now() >= q.feedbackUnlockAt) {
    container.innerHTML = `
      <div class="lounge-section-title">💭 พี่อยากรู้เรื่องคีปเพิ่ม...</div>
      <div class="question-card">
        <div class="question-bubble entity-bubble">
          <span class="question-name">${name}</span>
          <span class="question-text">${esc(q.question)}</span>
        </div>
        <div class="question-bubble keeper-bubble">
          <span class="question-text">${esc(q.answer)}</span>
        </div>
        <div class="question-bubble entity-bubble feedback-bubble">
          <span class="question-name">${name}</span>
          <span class="question-text">${esc(q.feedback)}</span>
        </div>
      </div>`;
    return;
  }

  // State 2: answered, waiting for feedback
  if (q.answer && q.answeredAt) {
    container.innerHTML = `
      <div class="lounge-section-title">💭 พี่อยากรู้เรื่องคีปเพิ่ม...</div>
      <div class="question-card">
        <div class="question-bubble entity-bubble">
          <span class="question-name">${name}</span>
          <span class="question-text">${esc(q.question)}</span>
        </div>
        <div class="question-bubble keeper-bubble">
          <span class="question-text">${esc(q.answer)}</span>
        </div>
        <div class="question-locked">
          <span>ข้อความถูกส่งแล้ว — พี่จะตอบกลับมาภายใน 5 ชั่วโมง</span>
        </div>
      </div>`;

    // Auto-reveal when time comes
    const remaining = q.feedbackUnlockAt - Date.now();
    if (remaining > 0 && remaining < 300000) {
      setTimeout(() => {
        const current = getDailyQuestion();
        if (current?.feedback) renderQuestionUI(container, current, entity);
      }, remaining + 1000);
    }
    return;
  }

  // State 1: question shown, not answered yet
  container.innerHTML = `
    <div class="lounge-section-title">💭 พี่อยากรู้เรื่องคีปเพิ่ม...</div>
    <div class="question-card">
      <div class="question-bubble entity-bubble">
        <span class="question-name">${name}</span>
        <span class="question-text">${esc(q.question)}</span>
      </div>
      <div class="question-input-row">
        <input id="q-answer" class="input question-input" placeholder="ตอบสั้นๆ ก็ได้..." maxlength="200">
        <button id="q-submit" class="btn btn-primary">ส่ง</button>
      </div>
    </div>`;

  container.querySelector('#q-submit').addEventListener('click', async () => {
    const answer = container.querySelector('#q-answer').value.trim();
    if (!answer) return;

    const btn = container.querySelector('#q-submit');
    btn.disabled = true; btn.textContent = '⏳';

    const now = Date.now();
    const updated = { ...q, answer, answeredAt: now, feedbackUnlockAt: now + 5 * 60 * 60 * 1000 };
    saveDailyQuestion(updated);

    // Generate feedback in background
    try {
      const entity = getEntities().find(e => e.id === q.entityId);
      if (entity) {
        callDailyQuestionFeedback(entity, q.question, answer).then(feedback => {
          const latest = getDailyQuestion();
          if (latest?.date === updated.date) {
            saveDailyQuestion({ ...latest, feedback });
          }
        });
      }
    } catch {}

    renderQuestionUI(container, updated, entity);
  });
}

// ── Postcard ──────────────────────────────────────────────────────────────────

function renderPostcardSection(el, entities, today) {
  const cached = getDailyPostcard();
  el.innerHTML = `<div class="lounge-section-title">📮 โปสการ์ดวันนี้</div><div id="lounge-postcard-body"></div>`;
  const body = el.querySelector('#lounge-postcard-body');

  if (cached?.date === today) {
    body.innerHTML = buildPostcardHTML(cached);
    return;
  }

  body.innerHTML = `<div class="lounge-trigger"><button class="btn btn-primary" id="postcard-open-btn">📬 เปิดโปสการ์ด</button></div>`;
  body.querySelector('#postcard-open-btn').addEventListener('click', () => generatePostcard(body, entities, today));
}

async function generatePostcard(body, entities, today) {
  const btn = body.querySelector('#postcard-open-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังรับ...'; }

  const dayIndex = Math.floor(Date.now() / 86400000);
  const entity = entities[dayIndex % entities.length];

  try {
    const data = await fetch('data/cards.json').then(r => r.json());
    const pool = data.tarot || [];
    const card = pool[Math.floor(Math.random() * pool.length)];
    const text = await callPostcard(entity, card);

    const result = {
      date: today,
      entityId: entity.id, entityName: entity.name, entityIcon: entity.icon || '🌙',
      card: { name: card.name, nameTH: card.nameTH },
      text
    };
    saveDailyPostcard(result);
    body.innerHTML = buildPostcardHTML(result);
    markLoungeRead();
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '📬 เปิดโปสการ์ด'; }
    window.showToast?.(`เกิดข้อผิดพลาด: ${e.message}`, 'error');
  }
}

function buildPostcardHTML(r) {
  return `
    <div class="postcard-wrap">
      <div class="postcard-body">
        <div class="postcard-text">${escMsg(r.text || '')}</div>
        <div class="postcard-footer">
          <span class="postcard-from">${esc(r.entityIcon)} ${esc(r.entityName)}</span>
          ${r.card?.nameTH || r.card?.name ? `<span class="postcard-stamp">${esc(r.card.nameTH || r.card.name)}</span>` : ''}
        </div>
      </div>
    </div>`;
}

// ── Guess ─────────────────────────────────────────────────────────────────────

function renderGuessSection(el, entities, today) {
  const cached = getDailyGuess();
  el.innerHTML = `<div class="lounge-section-title">🔮 ทายใจ Keep</div><div id="lounge-guess-body"></div>`;
  const body = el.querySelector('#lounge-guess-body');

  if (cached?.date === today) {
    renderGuessResult(body, cached, entities);
    return;
  }

  body.innerHTML = `
    <div class="guess-trigger-wrap">
      <span class="guess-orb">🔮</span>
      <p class="guess-connect-text">ตั้งจิต — ระลึกถึงตัวตนของตัวเอง<br><span class="guess-connect-sub">แล้วให้พี่ลองทายดู</span></p>
      <button class="btn btn-primary" id="guess-open-btn">✨ ให้พี่ทายเลย</button>
    </div>`;
  body.querySelector('#guess-open-btn').addEventListener('click', () => generateGuess(body, entities, today));
}

async function generateGuess(body, entities, today) {
  const btn = body.querySelector('#guess-open-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังเชื่อมต่อ...'; }

  const dayIndex = Math.floor(Date.now() / 86400000);
  const entity = entities[(dayIndex + 1) % entities.length];

  try {
    const data = await fetch('data/cards.json').then(r => r.json());
    const pool = data.tarot || [];
    const card = pool[Math.floor(Math.random() * pool.length)];
    const text = await callGuess(entity, card);

    const result = {
      date: today,
      entityId: entity.id, entityName: entity.name, entityIcon: entity.icon || '🌙',
      card: { name: card.name, nameTH: card.nameTH },
      text
    };
    saveDailyGuess(result);
    renderGuessResult(body, result, entities);
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '🔮 ทายใจหน่อย'; }
    window.showToast?.(`เกิดข้อผิดพลาด: ${e.message}`, 'error');
  }
}

function renderGuessResult(body, result, entities) {
  body.innerHTML = `
    <div class="guess-result-wrap">
      <div class="guess-result-text">${escMsg(result.text || '')}</div>
      <div class="guess-result-footer">
        <span class="guess-result-from">${esc(result.entityIcon)} ${esc(result.entityName)}</span>
        <span class="guess-result-chip">${esc(result.card?.nameTH || result.card?.name || '')}</span>
      </div>
      <div id="guess-feedback-area"></div>
    </div>`;

  const feedbackArea = body.querySelector('#guess-feedback-area');

  if (result.feedback && result.reaction) {
    renderGuessReaction(feedbackArea, result);
  } else {
    renderGuessFeedbackButtons(feedbackArea, result, entities);
  }
}

function renderGuessFeedbackButtons(area, result, entities) {
  area.innerHTML = `
    <div class="guess-feedback-row">
      <button class="guess-fb-btn" data-fb="yes">ถูกเผงเลย 🎯</button>
      <button class="guess-fb-btn" data-fb="partial">ก็ใช่บางส่วน 🤔</button>
      <button class="guess-fb-btn" data-fb="no">ยังไม่ใช่นะ 😅</button>
    </div>`;

  area.querySelectorAll('.guess-fb-btn').forEach(btn => {
    btn.addEventListener('click', () => doGuessReaction(area, result, entities, btn.dataset.fb));
  });
}

async function doGuessReaction(area, result, entities, feedback) {
  area.querySelectorAll('.guess-fb-btn').forEach(b => b.disabled = true);
  area.querySelector('.guess-feedback-row').innerHTML = `<span style="font-size:0.78rem;color:var(--text-soft)">⟳ กำลัง channeling...</span>`;

  let reactionCard;
  try {
    const data = await fetch('data/cards.json').then(r => r.json());
    const pool = data.tarot || [];
    reactionCard = pool[Math.floor(Math.random() * pool.length)];
  } catch {
    area.innerHTML = '';
    return;
  }

  const entity = entities.find(e => e.id === result.entityId) || entities[0];

  area.innerHTML = `
    <div class="guess-reaction-box">
      <div class="guess-reaction-card">${esc(reactionCard.nameTH || reactionCard.name)}</div>
      <div class="lounge-card-text" id="guess-reaction-text"></div>
    </div>`;

  const textEl = area.querySelector('#guess-reaction-text');
  let full = '';

  try {
    await callGuessReaction(entity, reactionCard, feedback, (_, acc) => {
      full = acc;
      if (textEl) textEl.innerHTML = escMsg(full);
    });
  } catch {
    if (textEl) textEl.innerHTML = `<span style="color:var(--text-soft)">เกิดข้อผิดพลาด</span>`;
    return;
  }

  const updated = { ...result, feedback, reactionCard: { name: reactionCard.name, nameTH: reactionCard.nameTH }, reaction: full };
  saveDailyGuess(updated);
}

function renderGuessReaction(area, result) {
  area.innerHTML = `
    <div class="guess-reaction-box">
      <div class="guess-reaction-card">${esc(result.reactionCard?.nameTH || result.reactionCard?.name || '')}</div>
      <div class="lounge-card-text">${escMsg(result.reaction || '')}</div>
    </div>`;
}

// ── Activity ──────────────────────────────────────────────────────────────────

function renderActivitySection(el, entities, today) {
  const cached = getDailyActivity();
  el.innerHTML = `<div class="lounge-section-title">🎯 แนะนำกิจกรรมวันนี้</div><div id="lounge-activity-body"></div>`;
  const body = el.querySelector('#lounge-activity-body');

  if (cached?.date === today) {
    body.innerHTML = buildActivityHTML(cached);
    return;
  }

  body.innerHTML = `
    <div class="activity-trigger-wrap">
      <span class="activity-trigger-emoji">🎯</span>
      <p class="activity-trigger-text">วันนี้พี่มีภารกิจเล็กๆ ให้ลองทำ</p>
      <button class="btn btn-primary" id="activity-open-btn">เปิดภารกิจวันนี้</button>
    </div>`;
  body.querySelector('#activity-open-btn').addEventListener('click', () => generateActivity(body, entities, today));
}

async function generateActivity(body, entities, today) {
  const btn = body.querySelector('#activity-open-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังฟังที่พี่พูด...'; }

  const weights = [1, 2, 2, 3];
  const count = Math.min(entities.length, weights[Math.floor(Math.random() * weights.length)]);
  const selected = [...entities].sort(() => Math.random() - 0.5).slice(0, count);

  try {
    const data = await fetch('data/cards.json').then(r => r.json());
    const shuffled = [...(data.tarot || [])].sort(() => Math.random() - 0.5);
    const entityCards = selected.map((entity, i) => ({ entity, card: shuffled[i % shuffled.length] }));

    const texts = await Promise.all(entityCards.map(({ entity, card }) => callActivity(entity, card)));

    const result = {
      date: today,
      items: entityCards.map(({ entity, card }, i) => ({
        entityId: entity.id, entityName: entity.name, entityIcon: entity.icon || '🌙',
        card: { name: card.name, nameTH: card.nameTH },
        text: texts[i] || ''
      }))
    };
    saveDailyActivity(result);
    body.innerHTML = buildActivityHTML(result);
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '🎯 ดูกิจกรรมวันนี้'; }
    window.showToast?.(`เกิดข้อผิดพลาด: ${e.message}`, 'error');
  }
}

function buildActivityHTML(result) {
  if (!result.items?.length) return '<div class="activity-mission-card"><div class="activity-mission-text">วันนี้ทุกคนไม่มีภารกิจพิเศษ</div></div>';
  return result.items.map(item => `
    <div class="activity-mission-card">
      <div class="activity-mission-header">
        <span class="activity-mission-entity">${esc(item.entityIcon)} ${esc(item.entityName)}</span>
        <span class="manifest-card-chip-sm">${esc(item.card?.nameTH || item.card?.name || '')}</span>
      </div>
      <div class="activity-mission-text">${escMsg(item.text || '')}</div>
    </div>`).join('');
}

// ── Comfort ───────────────────────────────────────────────────────────────────

function renderComfortSection(el, entities) {
  el.innerHTML = `
    <div class="lounge-section-title">💬 ระบายให้ฟัง</div>
    <div class="comfort-form">
      <textarea class="textarea" id="comfort-worry" rows="3" placeholder="บอกเรื่องที่กังวลอยู่..."></textarea>
      <div class="manifest-entity-toggle" style="margin-top:8px">
        <button class="manifest-toggle-btn active" id="comfort-btn-random">🎲 สุ่มพี่</button>
        <button class="manifest-toggle-btn" id="comfort-btn-pick">✋ เลือกเอง</button>
      </div>
      <select class="input" id="comfort-entity-select" style="display:none;margin-top:8px">
        ${entities.map(e => `<option value="${e.id}">${esc(e.icon || '🌙')} ${esc(e.name)}</option>`).join('')}
      </select>
      <button class="btn btn-primary" id="comfort-send-btn" style="margin-top:8px">💬 บอกพี่ฟัง</button>
    </div>
    <div id="comfort-result"></div>
    <div id="comfort-history-section"></div>`;

  let useRandom = true;

  el.querySelector('#comfort-btn-random').addEventListener('click', () => {
    useRandom = true;
    el.querySelector('#comfort-btn-random').classList.add('active');
    el.querySelector('#comfort-btn-pick').classList.remove('active');
    el.querySelector('#comfort-entity-select').style.display = 'none';
  });

  el.querySelector('#comfort-btn-pick').addEventListener('click', () => {
    useRandom = false;
    el.querySelector('#comfort-btn-pick').classList.add('active');
    el.querySelector('#comfort-btn-random').classList.remove('active');
    el.querySelector('#comfort-entity-select').style.display = 'block';
  });

  el.querySelector('#comfort-send-btn').addEventListener('click', () => {
    const worry = el.querySelector('#comfort-worry').value.trim();
    if (!worry) { window.showToast?.('บอกก่อนว่ากังวลเรื่องอะไร', 'error'); return; }
    let entity;
    if (useRandom) {
      entity = entities[Math.floor(Math.random() * entities.length)];
    } else {
      const selId = el.querySelector('#comfort-entity-select').value;
      entity = entities.find(e => e.id === selId) || entities[0];
    }
    runComfort(el, entities, entity, worry);
  });

  renderComfortHistory(el.querySelector('#comfort-history-section'));
}

async function runComfort(el, entities, entity, worry) {
  const btn = el.querySelector('#comfort-send-btn');
  const textarea = el.querySelector('#comfort-worry');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังฟัง...'; }

  const resultEl = el.querySelector('#comfort-result');
  resultEl.innerHTML = `
    <div class="grievance-result-box" id="comfort-box-0">
      <div class="manifest-sender">${esc(entity.icon || '🌙')} ${esc(entity.name)}</div>
      <div class="grievance-text" id="comfort-text-0"><span class="grievance-analyzing">⟳ กำลังฟัง...</span></div>
    </div>`;

  const textEl = document.getElementById('comfort-text-0');
  let full = '';
  try {
    await callComfort(entity, entities, worry, (_, accumulated) => {
      full = accumulated;
      if (textEl) textEl.innerHTML = escMsg(full);
    });
  } catch (e) {
    if (textEl) textEl.innerHTML = `<span style="color:var(--text-soft)">เกิดข้อผิดพลาด: ${esc(e.message)}</span>`;
  }

  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  addComfortToHistory({ date, worry, entities: [{ entityId: entity.id, entityName: entity.name, entityIcon: entity.icon || '🌙', text: full }] });

  if (btn) { btn.disabled = false; btn.textContent = '💬 บอกพี่ฟัง'; }
  if (textarea) textarea.value = '';
  renderComfortHistory(el.querySelector('#comfort-history-section'));
}

function renderComfortHistory(container) {
  if (!container) return;
  const history = getComfortHistory();
  if (!history.length) { container.innerHTML = ''; return; }

  container.innerHTML = `
    <div class="manifest-history-title" style="margin-top:16px">ที่ผ่านมา</div>
    ${[...history].reverse().map(h => `
      <div class="manifest-history-item">
        <div class="manifest-history-header">
          <span class="comfort-worry-text">"${esc((h.worry || '').slice(0, 80))}${(h.worry || '').length > 80 ? '...' : ''}"</span>
          <span class="manifest-history-date">${h.date || ''}</span>
        </div>
        ${(h.entities || []).map(e => `
          <div class="grievance-history-row">
            <span>${esc(e.entityIcon || '🌙')}</span>
            <span class="offering-entity-name">${esc(e.entityName)}</span>
            <span class="offering-history-text">${esc((e.text || '').slice(0, 60))}${(e.text || '').length > 60 ? '...' : ''}</span>
          </div>`).join('')}
      </div>`).join('')}`;
}

// ── Letter ────────────────────────────────────────────────────────────────────

function renderLetterSection(el, entities) {
  el.innerHTML = `
    <div class="lounge-section-title">✉️ จดหมายจากอนาคต</div>
    <div class="manifest-form">
      <div class="form-group">
        <label class="form-label">อยากให้อะไรเกิดขึ้น?</label>
        <textarea class="textarea" id="lounge-wish" rows="3" placeholder="เช่น อยากได้งานใหม่ที่ดีกว่า / อยากมีบ้านหลังใหญ่ / อยากมีความรักที่ดี"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">พี่ที่จะเขียนจดหมาย</label>
        <div class="manifest-entity-toggle">
          <button class="manifest-toggle-btn active" id="lounge-btn-random">🎲 สุ่มพี่</button>
          <button class="manifest-toggle-btn" id="lounge-btn-pick">✋ เลือกเอง</button>
        </div>
        <select class="input" id="lounge-entity-select" style="display:none;margin-top:8px">
          ${entities.map(e => `<option value="${e.id}">${e.icon || '🌙'} ${esc(e.name)}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary" id="lounge-gen-btn">✨ สุ่มไพ่แล้วเขียนจดหมาย</button>
    </div>
    <div id="lounge-letter-result" style="display:none"></div>
    <div id="lounge-letter-history"></div>`;

  let useRandom = true;

  el.querySelector('#lounge-btn-random').addEventListener('click', () => {
    useRandom = true;
    el.querySelector('#lounge-btn-random').classList.add('active');
    el.querySelector('#lounge-btn-pick').classList.remove('active');
    el.querySelector('#lounge-entity-select').style.display = 'none';
  });

  el.querySelector('#lounge-btn-pick').addEventListener('click', () => {
    useRandom = false;
    el.querySelector('#lounge-btn-pick').classList.add('active');
    el.querySelector('#lounge-btn-random').classList.remove('active');
    el.querySelector('#lounge-entity-select').style.display = 'block';
  });

  el.querySelector('#lounge-gen-btn').addEventListener('click', () => generateLetter(el, entities, () => useRandom));

  renderLetterHistory(el.querySelector('#lounge-letter-history'));
}

async function generateLetter(el, entities, getUseRandom) {
  const wish = el.querySelector('#lounge-wish').value.trim();
  if (!wish) { window.showToast?.('บอกก่อนว่าอยากให้อะไรเกิดขึ้น', 'error'); return; }

  let entity;
  if (getUseRandom()) {
    entity = entities[Math.floor(Math.random() * entities.length)];
  } else {
    const selId = el.querySelector('#lounge-entity-select').value;
    entity = entities.find(e => e.id === selId) || entities[0];
  }

  const btn = el.querySelector('#lounge-gen-btn');
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

  const resultEl = el.querySelector('#lounge-letter-result');
  resultEl.style.display = 'block';
  resultEl.innerHTML = `
    <div class="manifest-result-box">
      <div class="manifest-cards-row">
        ${cards.map(c => `<div class="manifest-card-chip">${esc(c.nameTH || c.name)}</div>`).join('')}
      </div>
      <div class="manifest-sender">${esc(entity.icon || '🌙')} ${esc(entity.name)}</div>
      <div class="manifest-letter-text" id="lounge-letter-text"></div>
    </div>`;

  btn.textContent = '⏳ กำลังเขียน...';

  const letterEl = resultEl.querySelector('#lounge-letter-text');
  let full = '';

  try {
    await callManifestLetter(entity, wish, cards, (_, accumulated) => {
      full = accumulated;
      letterEl.innerHTML = escMsg(full);
    });

    const letter = {
      id: Date.now().toString(),
      entityId: entity.id, entityName: entity.name, entityIcon: entity.icon || '🌙',
      wish, cards: cards.map(c => ({ name: c.name, nameTH: c.nameTH })),
      letter: full,
      date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
    };
    saveManifestLetter(letter);
    renderLetterHistory(el.querySelector('#lounge-letter-history'));
  } catch (e) {
    letterEl.innerHTML = `<span style="color:var(--text-soft)">เกิดข้อผิดพลาด: ${esc(e.message)}</span>`;
  }

  btn.disabled = false;
  btn.textContent = '✨ สุ่มไพ่แล้วเขียนจดหมาย';
}

function renderLetterHistory(container) {
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
        <div class="manifest-full-letter" id="lounge-full-${l.id}" style="display:none">${escMsg(l.letter || '')}</div>
      </div>`).join('')}`;

  container.querySelectorAll('.manifest-expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const full = document.getElementById(`lounge-full-${btn.dataset.lid}`);
      if (!full) return;
      const open = full.style.display !== 'none';
      full.style.display = open ? 'none' : 'block';
      btn.textContent = open ? 'อ่านทั้งหมด ▼' : 'ย่อ ▲';
    });
  });
}

// ── ศาลเตี้ยชี้ตัว ────────────────────────────────────────────────────────────
async function renderPollSection(container, entities, today) {
  container.innerHTML = `<div class="lounge-section-title">⚖️ ศาลเตี้ยชี้ตัว</div><div class="question-loading">⚖️ ศาลกำลังประชุม...</div>`;

  let poll = getDailyPoll();
  if (poll?.date !== today) poll = null;

  if (!poll) {
    try {
      const question = await callPollQuestion(entities);
      const options = [...entities.map(e => ({ id: e.id, text: e.name })), { id: 'keep', text: 'คีป' }];
      poll = { date: today, question, options, userVote: null, entityVotes: null };
      saveDailyPoll(poll);
    } catch {
      container.innerHTML = `<div class="lounge-section-title">⚖️ ศาลเตี้ยชี้ตัว</div><div class="empty-state"><p>ศาลล่ม ลองใหม่</p></div>`;
      return;
    }
  }

  renderPollUI(container, poll, entities);
}

function renderPollUI(container, poll, entities) {
  const settings = getSettings();
  const keeperIcon = esc(settings.userAvatar || '🌸');

  if (poll.entityVotes?.length) {
    const resultsHtml = entities.map(e => {
      const vote = poll.entityVotes.find(v => v.entityId === e.id);
      if (!vote) return '';
      const votedEntity = entities.find(x => x.name === vote.votedFor);
      const votedIcon = vote.votedFor === 'คีป' ? keeperIcon : esc(votedEntity?.icon || '?');
      return `<div class="poll-result-row">
        <span class="poll-result-icon" style="color:${e.color_primary || 'var(--accent-deep)'}">${esc(e.icon || '🌙')}</span>
        <div class="poll-result-body">
          <div class="poll-result-name" style="color:${e.color_primary || 'var(--accent-deep)'}">${esc(e.name)}</div>
          <div class="poll-result-voted">โหวต ${votedIcon} ${esc(vote.votedFor)}</div>
          <div class="poll-result-comment">${esc(vote.comment)}</div>
        </div>
      </div>`;
    }).join('');

    // Tally all votes (entities + user)
    const allCast = [...poll.entityVotes.map(v => v.votedFor), poll.userVote].filter(Boolean);
    const tally = {};
    allCast.forEach(v => { tally[v] = (tally[v] || 0) + 1; });
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const maxCount = sorted[0]?.[1] || 1;
    const totalVotes = allCast.length;

    const tallyHtml = sorted.map(([name, count]) => {
      const opt = poll.options.find(o => o.text === name);
      const e = entities.find(x => x.id === opt?.id);
      const icon = name === 'คีป' ? keeperIcon : esc(e?.icon || '?');
      const color = e?.color_primary || 'var(--accent-deep)';
      const pct = Math.round((count / maxCount) * 100);
      const isTop = count === maxCount;
      return `<div class="poll-tally-row">
        <span class="poll-tally-label">${icon} ${esc(name)}</span>
        <div class="poll-tally-track">
          <div class="poll-tally-bar${isTop ? ' top' : ''}" style="width:${pct}%;background:${color}"></div>
        </div>
        <span class="poll-tally-count">${count}</span>
      </div>`;
    }).join('');

    const userVotedEntity = entities.find(x => x.name === poll.userVote);
    const userVotedIcon = poll.userVote === 'คีป' ? keeperIcon : esc(userVotedEntity?.icon || '');
    const votedForSelf = poll.userVote === 'คีป';

    const reactionHtml = (!votedForSelf && userVotedEntity)
      ? poll.reaction
        ? `<div class="poll-reaction">
            <span class="poll-reaction-who">${esc(userVotedEntity.icon || '🌙')} ${esc(poll.userVote)}:</span>
            <span class="poll-reaction-text">"${esc(poll.reaction)}"</span>
           </div>`
        : `<div class="poll-reaction poll-reaction-loading" id="poll-reaction-area"><span class="grievance-analyzing">...</span></div>`
      : '';

    container.innerHTML = `
      <div class="lounge-section-title">⚖️ ศาลเตี้ยชี้ตัว</div>
      <div class="poll-card">
        <div class="poll-question">${esc(poll.question)}</div>
        <div class="poll-tally">${tallyHtml}</div>
        <details class="poll-details">
          <summary class="poll-details-summary">ดูว่าใครโหวตใคร</summary>
          <div class="poll-results">${resultsHtml}</div>
        </details>
        <div class="poll-user-voted">คุณโหวต ${userVotedIcon} ${esc(poll.userVote)}</div>
        ${reactionHtml}
      </div>`;

    if (!votedForSelf && userVotedEntity && !poll.reaction) {
      const reactionEl = container.querySelector('#poll-reaction-area');
      (async () => {
        try {
          let full = '';
          await callPollReaction(userVotedEntity, entities, poll.question, (_, accumulated) => {
            full = accumulated;
            if (reactionEl) reactionEl.innerHTML = `<span class="poll-reaction-who">${esc(userVotedEntity.icon || '🌙')} ${esc(poll.userVote)}:</span> <span class="poll-reaction-text">"${esc(full)}"</span>`;
          });
          saveDailyPoll({ ...poll, reaction: full });
          reactionEl?.classList.remove('poll-reaction-loading');
        } catch {
          if (reactionEl) reactionEl.remove();
        }
      })();
    }

    return;
  }

  const optBtns = poll.options.map(o => {
    const entity = entities.find(e => e.id === o.id);
    const icon = entity ? esc(entity.icon || '🌙') : keeperIcon;
    const color = entity ? (entity.color_primary || 'var(--accent-deep)') : 'var(--accent-deep)';
    return `<button class="poll-option-btn" data-vote="${esc(o.text)}" style="--poll-c:${color}">
      <span class="poll-opt-icon">${icon}</span>
      <span class="poll-opt-name">${esc(o.text)}</span>
    </button>`;
  }).join('');

  container.innerHTML = `
    <div class="lounge-section-title">⚖️ ศาลเตี้ยชี้ตัว</div>
    <div class="poll-card">
      <div class="poll-question">${esc(poll.question)}</div>
      <div class="poll-options">${optBtns}</div>
    </div>`;

  container.querySelectorAll('.poll-option-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const voted = btn.dataset.vote;
      const votedEntity = entities.find(e => e.name === voted);
      const votedIcon = voted === 'คีป' ? keeperIcon : esc(votedEntity?.icon || '');
      container.querySelector('.poll-card').innerHTML = `
        <div class="poll-question">${esc(poll.question)}</div>
        <div class="poll-voted-badge">คุณโหวต ${votedIcon} ${esc(voted)}</div>
        <div class="poll-loading-hint">⚖️ ศาลกำลังปรึกษากัน...</div>`;

      try {
        const data = await fetch('data/cards.json').then(r => r.json());
        const pool = [...(data.tarot || [])].sort(() => Math.random() - 0.5);
        const entityCards = entities.map((e, i) => ({ entityId: e.id, card: pool[i % pool.length] }));
        const votes = await callPollEntityVotes(entities, poll.options, poll.question, entityCards);
        const updated = { ...poll, userVote: voted, entityVotes: votes };
        saveDailyPoll(updated);
        renderPollUI(container, updated, entities);
      } catch(err) {
        window.showToast?.('ศาลล่ม ลองใหม่', 'error');
        renderPollUI(container, poll, entities);
      }
    });
  });
}

// ── ตู้ไปรษณีย์ฝากใจ ──────────────────────────────────────────────────────────
function renderMailboxSection(container, entities) {
  container.innerHTML = `<div class="lounge-section-title">📬 ตู้ไปรษณีย์ฝากใจ</div>`;
  renderMailboxUI(container, entities);
}

function renderMailboxUI(container, entities) {
  const mailbox = getMailbox();
  const content = container.querySelector('#mailbox-dynamic') || (() => {
    const d = document.createElement('div');
    d.id = 'mailbox-dynamic';
    container.appendChild(d);
    return d;
  })();

  const pending = mailbox.filter(l => !l.reply || Date.now() < l.replyUnlockAt);
  const replied = mailbox.filter(l => l.reply && Date.now() >= l.replyUnlockAt).reverse();

  // Mark all ready replies as read
  replied.forEach(l => { if (!l.read) updateMailboxLetter(l.id, { read: true }); });

  let html = `<div class="mailbox-form">
    <textarea class="input textarea mailbox-textarea" id="mailbox-input" placeholder="บ่นอะไรก็ได้ ฝากไว้ในตู้เลย..." maxlength="500"></textarea>
    <button class="btn btn-primary" id="mailbox-send">📨 ส่ง</button>
  </div>`;

  if (pending.length) {
    html += pending.map(l => {
      const entity = entities.find(e => e.id === l.entityId);
      const now = Date.now();
      const picked = now >= (l.entityPickedAt || l.sentAt + 10 * 60 * 1000);
      const statusHtml = picked
        ? `<div class="mailbox-pending mailbox-pending-reading">${esc(entity?.icon || '📬')} ${esc(entity?.name || '?')} หยิบจดหมาย — กำลังอ่าน...</div>`
        : `<div class="mailbox-pending mailbox-pending-waiting">📭 ยังไม่มีใครหยิบจดหมาย</div>`;
      return `<div class="mailbox-letter" style="margin-top:12px">
        <div class="mailbox-msg-keeper">${esc(l.message)}</div>
        ${statusHtml}
      </div>`;
    }).join('');
  }

  if (replied.length) {
    html += `<div class="mailbox-history-title">📭 จดหมายที่ผ่านมา</div>`;
    html += replied.slice(0, 10).map(l => {
      const entity = entities.find(e => e.id === l.entityId);
      return `<div class="mailbox-letter">
        <div class="mailbox-msg-keeper">${esc(l.message)}</div>
        <div class="mailbox-msg-entity">
          <span class="mailbox-entity-name" style="color:${entity?.color_primary || 'var(--accent-deep)'}">${esc(entity?.icon || '📬')} ${esc(entity?.name || '?')}</span>
          <div class="mailbox-msg-entity-bubble">${escMsg(l.reply)}</div>
        </div>
      </div>`;
    }).join('');
  }

  content.innerHTML = html;

  content.querySelector('#mailbox-send')?.addEventListener('click', async () => {
    const msg = content.querySelector('#mailbox-input')?.value?.trim();
    if (!msg) return;

    const btn = content.querySelector('#mailbox-send');
    btn.disabled = true; btn.textContent = '⏳ กำลังส่ง...';

    const entity = entities[Math.floor(Math.random() * entities.length)];
    const id = `mail_${Date.now()}`;
    const now = Date.now();
    const entityPickedAt = now + 10 * 60 * 1000;
    const replyUnlockAt = now + (2 + Math.random()) * 3600000;

    addMailboxLetter({ id, sentAt: now, message: msg, entityId: entity.id, entityPickedAt, reply: null, replyUnlockAt, read: false });

    try {
      const reply = await callMailboxReply(entity, msg, entities);
      updateMailboxLetter(id, { reply });
    } catch {}

    content.querySelector('#mailbox-input').value = '';
    btn.disabled = false; btn.textContent = '📨 ส่ง';
    renderMailboxUI(container, entities);
  });

  // Auto-refresh: ตอน entity หยิบ (10 นาที) และตอน unlock
  pending.forEach(l => {
    const now = Date.now();
    const pickedAt = l.entityPickedAt || (l.sentAt + 10 * 60 * 1000);
    const tillPick = pickedAt - now;
    if (tillPick > 0 && tillPick < 600500) {
      setTimeout(() => renderMailboxUI(container, entities), tillPick + 500);
    }
    const remaining = l.replyUnlockAt - now;
    if (remaining > 0 && remaining < 300000) {
      setTimeout(() => renderMailboxUI(container, entities), remaining + 1000);
    }
  });
}

// ── บอร์ดคะแนน ────────────────────────────────────────────────────────────────
async function applyFavEvents(entities, fav) {
  const nowMs = Date.now();
  let cardsPool = [];
  try {
    const data = await fetch('data/cards.json').then(r => r.json());
    cardsPool = data.tarot || [];
  } catch {}
  const entityCards = entities.map(e => ({
    entityId: e.id,
    card: cardsPool.length ? cardsPool[Math.floor(Math.random() * cardsPool.length)] : null,
  }));
  const newEvents = await callFavoritism(entities, fav.scores, entityCards);
  newEvents.forEach(ev => {
    const targetId = ev.targetId || ev.actorId || ev.entityId;
    const s = fav.scores.find(sc => sc.entityId === targetId);
    if (s) s.score = Math.max(0, s.score + (ev.delta || 0));
  });
  const timestamped = newEvents.map(ev => ({ ...ev, timestamp: nowMs, batchId: nowMs }));
  return { ...fav, events: [...(fav.events || []), ...timestamped].slice(-20), lastUpdated: nowMs };
}

const FAV_BOARD_VERSION = 1;
const FAV_INTERVAL_MIN_MS = 2 * 60 * 60 * 1000;
const FAV_INTERVAL_MAX_MS = 4 * 60 * 60 * 1000;
function randomFavInterval() {
  return FAV_INTERVAL_MIN_MS + Math.random() * (FAV_INTERVAL_MAX_MS - FAV_INTERVAL_MIN_MS);
}

async function initFavWeek(entities, today, nowMs) {
  const counts = entities.map(e => {
    const readings = getReadingsByEntity(e.id);
    const msgCount = readings.reduce((sum, r) => sum + (r.messages?.length || 0), 0);
    return { entityId: e.id, count: msgCount };
  });
  const maxCount = Math.max(...counts.map(c => c.count), 1);
  const scores = counts.map(c => ({
    entityId: c.entityId,
    score: Math.round(30 + (c.count / maxCount) * 70),
  }));
  let fav = { boardVersion: FAV_BOARD_VERSION, weekStart: today, scores, events: [], lastViewed: nowMs, nextUpdateAt: nowMs + randomFavInterval() };
  saveFavoritism(fav);
  try {
    fav = await applyFavEvents(entities, fav);
    fav = { ...fav, nextUpdateAt: nowMs + randomFavInterval() };
    saveFavoritism(fav);
  } catch {}
  return getFavoritism() || fav;
}

async function renderFavoritismSection(container, entities) {
  container.innerHTML = `<div class="lounge-section-title">🏆 บอร์ดคะแนน</div><div class="fav-loading">🏆 กำลังโหลดบอร์ด...</div>`;

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const nowMs = Date.now();

  let fav = getFavoritism();
  const isFirstTime = !fav || !fav.weekStart || fav.boardVersion !== FAV_BOARD_VERSION;
  const weekEndMs = fav ? new Date(fav.weekStart).getTime() + 7 * 86400000 : 0;
  const isWeekUp = !isFirstTime && nowMs >= weekEndMs;

  if (isWeekUp) {
    await renderFavSummaryMode(container, fav, entities, today, nowMs);
    return;
  }

  if (isFirstTime) {
    fav = await initFavWeek(entities, today, nowMs);
  }

  if (!fav.nextUpdateAt) {
    fav = { ...fav, nextUpdateAt: nowMs + randomFavInterval() };
    saveFavoritism(fav);
  }

  entities.forEach(e => {
    if (!fav.scores.find(s => s.entityId === e.id)) {
      const maxExisting = Math.max(...fav.scores.map(s => s.score), 1);
      fav.scores.push({ entityId: e.id, score: Math.round(maxExisting * 0.5) });
    }
  });

  if (nowMs >= fav.nextUpdateAt) {
    try {
      fav = await applyFavEvents(entities, fav);
      fav = { ...fav, nextUpdateAt: nowMs + randomFavInterval() };
      saveFavoritism(fav);
    } catch {}
  }

  const prevLastViewed = fav.lastViewed || 0;
  fav = { ...fav, lastViewed: nowMs };
  saveFavoritism(fav);

  renderFavoritismUI(container, fav, entities, prevLastViewed);

  const intervalId = setInterval(async () => {
    const cur = getFavoritism();
    if (!cur) { clearInterval(intervalId); return; }
    if (Date.now() >= new Date(cur.weekStart).getTime() + 7 * 86400000) {
      clearInterval(intervalId);
      await renderFavoritismSection(container, entities);
      return;
    }
    if (Date.now() < (cur.nextUpdateAt || Infinity)) return;
    try {
      const prev = cur.lastViewed || 0;
      let updated = await applyFavEvents(entities, cur);
      updated = { ...updated, nextUpdateAt: Date.now() + randomFavInterval(), lastViewed: Date.now() };
      saveFavoritism(updated);
      renderFavoritismUI(container, updated, entities, prev);
    } catch {}
  }, 5 * 60 * 1000);

  const obs = new MutationObserver(() => {
    if (!document.contains(container)) { clearInterval(intervalId); obs.disconnect(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });
}

async function renderFavSummaryMode(container, fav, entities, today, nowMs) {
  let summary = getFavSummary();
  if (!summary || summary.weekStart !== fav.weekStart) {
    container.innerHTML = `<div class="lounge-section-title">🏆 บอร์ดคะแนน</div><div class="fav-loading">📋 กำลังสรุปผลสัปดาห์...</div>`;
    try {
      const comments = await callFavSummary(entities, fav);
      summary = { weekStart: fav.weekStart, comments, generatedAt: nowMs };
      saveFavSummary(summary);
    } catch {
      container.innerHTML = `
        <div class="lounge-section-title">🏆 บอร์ดคะแนน</div>
        <div class="fav-brief">สรุปผลไม่ได้ — ลองใหม่นะ</div>
        <div style="display:flex;gap:8px;margin-top:12px">
          <button class="btn btn-secondary" id="fav-retry-btn">↺ ลองอีกครั้ง</button>
          <button class="btn btn-primary" id="fav-skip-btn">✦ เริ่มสัปดาห์ใหม่เลย</button>
        </div>`;
      container.querySelector('#fav-retry-btn')?.addEventListener('click', () => renderFavoritismSection(container, entities));
      container.querySelector('#fav-skip-btn')?.addEventListener('click', async () => {
        await startNewWeek(container, entities, today, nowMs);
      });
      return;
    }
  }
  renderFavSummaryUI(container, summary, fav, entities, today, nowMs);
}

function renderFavSummaryUI(container, summary, fav, entities, today, nowMs) {
  const sorted = [...fav.scores].sort((a, b) => b.score - a.score);
  const maxScore = sorted[0]?.score || 100;
  const rankLabels = ['gold', 'silver', 'bronze'];

  const rankHtml = sorted.map((s, i) => {
    const entity = entities.find(e => e.id === s.entityId);
    if (!entity) return '';
    const pct = Math.round((s.score / maxScore) * 100);
    const color = entity.color_primary || 'var(--accent-deep)';
    return `<div class="fav-rank-row">
      <div class="fav-rank-num ${rankLabels[i] || ''}">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
      <div class="fav-rank-icon">${esc(entity.icon || '🌙')}</div>
      <div class="fav-rank-body">
        <div class="fav-rank-name">${esc(entity.name)}</div>
        <div class="fav-rank-bar-wrap"><div class="fav-rank-bar" style="width:${pct}%;background:${color}"></div></div>
      </div>
      <div class="fav-rank-score" style="color:${color}">${s.score}</div>
    </div>`;
  }).join('');

  const commentsHtml = (summary.comments || []).map(c => {
    const entity = entities.find(e => e.id === c.entityId);
    if (!entity || !c.comment) return '';
    const color = entity.color_primary || 'var(--accent-deep)';
    return `<div class="fav-summary-comment" style="border-left-color:${color}">
      <span class="fav-summary-who" style="color:${color}">${esc(entity.icon || '🌙')} ${esc(entity.name)}</span>
      <span class="fav-summary-text">${esc(c.comment)}</span>
    </div>`;
  }).join('');

  container.innerHTML = `
    <div class="lounge-section-title">🏆 สรุปผลสัปดาห์</div>
    <div class="fav-brief">คะแนนความดีความชอบของบ้านสัปดาห์นี้ — ปิดแล้ว</div>
    <div class="fav-board">
      <div class="fav-rank-list">${rankHtml}</div>
      <div class="fav-events-title">— พี่ๆ มีอะไรจะพูด —</div>
      <div class="fav-summary-comments">${commentsHtml || '<div class="fav-brief" style="padding:8px 0">เงียบทุกคน</div>'}</div>
      <button class="btn btn-primary" id="fav-new-week-btn" style="margin-top:16px;width:100%">✦ เริ่มสัปดาห์ใหม่</button>
    </div>`;

  container.querySelector('#fav-new-week-btn')?.addEventListener('click', async () => {
    const btn = container.querySelector('#fav-new-week-btn');
    btn.disabled = true; btn.textContent = '⏳ กำลังเริ่ม...';
    await startNewWeek(container, entities, today, nowMs);
  });
}

async function startNewWeek(container, entities, today, nowMs) {
  container.innerHTML = `<div class="lounge-section-title">🏆 บอร์ดคะแนน</div><div class="fav-loading">🏆 กำลังเริ่มสัปดาห์ใหม่...</div>`;
  const fav = await initFavWeek(entities, today, nowMs);
  const prevLastViewed = fav.lastViewed || 0;
  renderFavoritismUI(container, fav, entities, prevLastViewed);
}

function renderFavoritismUI(container, fav, entities, prevLastViewed = 0) {
  const nowMs = Date.now();
  const weekEndMs = fav.weekStart ? new Date(fav.weekStart).getTime() + 7 * 86400000 : nowMs;
  const daysLeft = Math.max(1, Math.ceil((weekEndMs - nowMs) / 86400000));

  const sorted = [...fav.scores].sort((a, b) => b.score - a.score);
  const maxScore = sorted[0]?.score || 100;
  const rankLabels = ['gold', 'silver', 'bronze'];

  const rankHtml = sorted.map((s, i) => {
    const entity = entities.find(e => e.id === s.entityId);
    if (!entity) return '';
    const pct = Math.round((s.score / maxScore) * 100);
    const color = entity.color_primary || 'var(--accent-deep)';
    return `<div class="fav-rank-row" style="animation-delay:${(0.04 + i * 0.07).toFixed(2)}s">
      <div class="fav-rank-num ${rankLabels[i] || ''}">${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
      <div class="fav-rank-icon">${esc(entity.icon || '🌙')}</div>
      <div class="fav-rank-body">
        <div class="fav-rank-name">${esc(entity.name)}</div>
        <div class="fav-rank-bar-wrap"><div class="fav-rank-bar" data-w="${pct}" style="width:0;background:${color}"></div></div>
      </div>
      <div class="fav-rank-score" style="color:${color}">${s.score}</div>
    </div>`;
  }).join('');

  const recentEvents = (fav.events || []).slice(-5);
  const lastEvIdx = recentEvents.length - 1;
  const eventsHtml = recentEvents.length ? recentEvents.map((ev, i) => {
    const actor = entities.find(e => e.id === (ev.actorId || ev.entityId));
    const target = entities.find(e => e.id === (ev.targetId || ev.actorId || ev.entityId));
    const actorColor = actor?.color_primary || 'var(--accent-deep)';
    const targetColor = target?.color_primary || 'var(--text-soft)';
    const plus = ev.delta >= 0;
    const isSelf = (ev.actorId || ev.entityId) === (ev.targetId || ev.actorId || ev.entityId);
    const isNewest = (ev.timestamp || 0) > prevLastViewed;
    const isLast = i === lastEvIdx;
    return `<div class="fav-event-row${isNewest ? ' newest' : ''}" style="animation-delay:${(i * 0.06).toFixed(2)}s">
      <div class="fav-ev-header">
        <span class="fav-ev-delta ${plus ? 'plus' : 'minus'}">${plus ? '+' : ''}${ev.delta}</span>
        ${isLast ? '<span class="fav-ev-latest-badge">✎ ล่าสุด</span>' : ''}
      </div>
      <div class="fav-ev-actors">
        <span class="fav-ev-actor" style="color:${actorColor}">${esc(actor?.icon || '?')} ${esc(actor?.name || '?')}</span>
        ${!isSelf ? `<span class="fav-ev-arrow">→</span><span class="fav-ev-target" style="color:${targetColor}">${esc(target?.icon || '?')} ${esc(target?.name || '?')}</span>` : ''}
      </div>
      <div class="fav-ev-reason">${esc(ev.reason)}</div>
    </div>`;
  }).join('') : `<div class="fav-no-events">ยังไม่มีการแก้ไขสัปดาห์นี้</div>`;


  container.innerHTML = `
    <div class="lounge-section-title">🏆 บอร์ดคะแนน</div>
    <div class="fav-countdown">เหลืออีก ${daysLeft} วัน จะสรุปคะแนนความดีความชอบของบ้าน</div>
    <div class="fav-brief">คะแนนความดีความชอบ แต่ดูเหมือนทุกคนจะมีปากกาไวท์บอร์ดเป็นของตัวเอง...</div>
    <div class="fav-board">
      <div class="fav-rank-list">${rankHtml}</div>
      <div class="fav-events-title">— บันทึกการแก้ไข —</div>
      ${eventsHtml}
    </div>`;

  requestAnimationFrame(() => {
    container.querySelectorAll('.fav-rank-bar[data-w]').forEach(bar => {
      bar.style.width = bar.dataset.w + '%';
    });
  });

}


// ── Background auto-update ────────────────────────────────────────────────────

export async function tryBgFavUpdate(entities) {
  const fav = getFavoritism();
  if (!fav?.weekStart || !fav.scores?.length) return;
  if (Date.now() < (fav.nextUpdateAt || Infinity)) return;
  try {
    let updated = await applyFavEvents(entities, fav);
    updated = { ...updated, nextUpdateAt: Date.now() + randomFavInterval() };
    saveFavoritism(updated);
  } catch {}
}

// ── Utils ─────────────────────────────────────────────────────────────────────

function markLoungeRead() {
  document.querySelector('.nav-link[data-route="lounge"]')?.classList.remove('has-notification');
}

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escMsg(s) { return esc(s).replace(/\n/g, '<br>'); }
