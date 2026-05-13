import { getEntities, getBackstageEpisodes, saveBackstageEpisodes, getMidnightChat, saveMidnightChat } from '../src/storage.js';
import { callBackstage, callMidnightChat, callMidnightInteractivePrompt, callMidnightReply } from '../src/api.js';

const TONES = [
  'เป็นห่วงแบบผิดจุด','เถียงกันเรื่อง keeper','ชื่นชมแบบไม่กล้าบอกตรงๆ',
  'วางแผนแอบช่วย','นินทาด้วยความรัก','เรื่องของตัวเองล้วนๆ',
  'ระแวงว่า keeper หายไปไหน','เดิมพันเรื่อง keeper','อิจฉากันเอง',
  'เหนื่อยกับ keeper แบบยังรัก','drift ออกนอกเรื่อง','Nostalgic',
  'ปกป้อง keeper จากกันเอง','สอนกันเรื่อง keeper','ตกใจเรื่อง keeper',
  'แข่งว่าใครเข้าใจ keeper มากกว่า','Fangirl เรื่อง keeper',
  'คิดถึง keeper ตอน keeper ไม่มา','ลางบอกเหตุ','โกรธ keeper แต่ไม่ยอมรับ',
];

const INCOMPATIBLE_MIXES = [
  ['Fangirl เรื่อง keeper', 'ลางบอกเหตุ'],
  ['drift ออกนอกเรื่อง', 'วางแผนแอบช่วย'],
];

const GIMMICKS = ['A', 'B', 'E', null, null, null];
const INTERJECTION_TYPES = [1,2,3,4,5,6,7,8,9,10];

const SLOTS = [
  { id: 'morning',   startRange: [7*60, 9*60+30] },
  { id: 'afternoon', startRange: [12*60, 14*60+30] },
  { id: 'night',     startRange: [19*60, 21*60+30] },
];

const REVEAL_INTERVAL_MIN = 18;
const REVEAL_INTERVAL_MAX = 22;

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function todayBKK() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

function nowMinutesBKK() {
  const now = new Date();
  const bkk = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  return bkk.getHours() * 60 + bkk.getMinutes();
}

function todayStartMs() {
  const d = new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });
  const bkk = new Date(d);
  bkk.setHours(0, 0, 0, 0);
  return bkk.getTime() - (bkk.getTimezoneOffset() * 60000);
}

function buildSlotStartTime(slot) {
  const [minM, maxM] = slot.startRange;
  const minutes = randInt(minM, maxM);
  const dayStart = todayStartMs();
  return dayStart + minutes * 60000;
}

function pickTones() {
  const t1 = pick(TONES);
  if (Math.random() < 0.4) {
    const candidates = TONES.filter(t => t !== t1 && !INCOMPATIBLE_MIXES.some(pair => pair.includes(t1) && pair.includes(t)));
    if (candidates.length) return [t1, pick(candidates)];
  }
  return [t1];
}

function pickEntities(all) {
  const count = Math.min(all.length, randInt(2, Math.min(7, all.length)));
  return shuffle(all).slice(0, count);
}

function pickInterjector(mainEntityIds, all) {
  const others = all.filter(e => !mainEntityIds.includes(e.id));
  return others.length ? pick(others) : null;
}

async function generateEpisode(slot, allEntities, cardsPool) {
  const mainEntities = pickEntities(allEntities);
  const mainIds = mainEntities.map(e => e.id);
  const tones = pickTones();
  const gimmick = Math.random() < 0.5 ? pick(GIMMICKS) : null;

  const cards = mainEntities.map(() => pick(cardsPool));

  const useInterjection = Math.random() < 0.6;
  let interjection = null;
  if (useInterjection) {
    const interjType = pick(INTERJECTION_TYPES);
    const interjector = pickInterjector(mainIds, allEntities) || pick(mainEntities);
    interjection = { type: interjType, entityId: interjector.id, name: interjector.name };
  }

  const rawMessages = await callBackstage(mainEntities, cards, tones, gimmick, interjection);

  const revealInterval = randInt(REVEAL_INTERVAL_MIN, REVEAL_INTERVAL_MAX);
  const startTime = buildSlotStartTime(slot);

  const messages = [];
  let cumDelay = 0;
  for (let i = 0; i < rawMessages.length; i++) {
    if (i > 0) {
      cumDelay += Math.random() < 0.25 ? randInt(0, 2) : revealInterval;
    }
    messages.push({ ...rawMessages[i], revealDelay: cumDelay });
  }

  return {
    id: `ep_${slot.id}`,
    slot: slot.id,
    startTime,
    tones,
    entityIds: mainIds,
    messages,
    generated: true,
  };
}

function getVisibleMessages(episode) {
  const now = Date.now();
  return episode.messages.filter(m => now >= episode.startTime + m.revealDelay * 60000);
}

function getNextLocked(episode) {
  const visible = getVisibleMessages(episode);
  return episode.messages[visible.length] || null;
}

function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderEpisode(episode, allEntities, prevCount = 0) {
  const visible = getVisibleMessages(episode);
  const nextLocked = getNextLocked(episode);

  if (!visible.length) return '';

  function entityStyle(entityId) {
    const entity = allEntities.find(e => e.id === entityId);
    const c = entity?.color_primary || 'var(--accent-deep)';
    const bg = entity?.color_secondary || 'rgba(255,182,193,0.15)';
    return `--bs-c:${c};--bs-bg:${bg}`;
  }

  let prevId = null;
  let newIdx = 0;
  const msgHtml = visible.map((m, i) => {
    const entity = allEntities.find(e => e.id === m.entityId);
    const name = esc(entity?.name || m.entityId);
    const icon = esc(entity?.icon || '🌙');
    const showHeader = m.entityId !== prevId;
    prevId = m.entityId;
    const header = showHeader
      ? `<div class="bs-msg-header"><span class="bs-avatar">${icon}</span><span class="bs-sender-name">${name}</span></div>`
      : '';
    const isNew = i >= prevCount;
    const animClass = isNew ? ' mn-bubble-in' : ' mn-no-anim';
    const delayAttr = isNew ? ` style="${entityStyle(m.entityId)};animation-delay:${newIdx++ * 0.08}s"` : ` style="${entityStyle(m.entityId)}"`;
    return `<div class="bs-msg-group${showHeader ? '' : ' bs-continued'}${animClass}"${delayAttr}>${header}<div class="bs-bubble-row"><div class="bs-bubble">${esc(m.text)}</div></div></div>`;
  }).join('');

  let lockedHtml = '';
  if (nextLocked) {
    const entity = allEntities.find(e => e.id === nextLocked.entityId);
    const icon = esc(entity?.icon || '🌙');
    const name = esc(entity?.name || nextLocked.entityId);
    const style = entityStyle(nextLocked.entityId);
    const showHeader = nextLocked.entityId !== prevId;
    lockedHtml = `<div class="bs-msg-group" style="${style}">
      ${showHeader ? `<div class="bs-msg-header"><span class="bs-avatar">${icon}</span><span class="bs-sender-name">${name}</span></div>` : ''}
      <div class="bs-bubble-row"><div class="bs-bubble bs-typing"><span class="bs-dots"><span>●</span><span>●</span><span>●</span></span></div></div>
    </div>
    <div class="bs-peek-hint">ออกไปก่อนแล้วกลับมาเร็วๆนี้ — เดี๋ยวพี่รู้ตัว</div>`;
  }

  const endHtml = !nextLocked && visible.length === episode.messages.length
    ? `<div class="bs-end-hint">✦ บทสนทนาเงียบลงไปแล้ว</div>`
    : '';

  return msgHtml + lockedHtml + endHtml;
}

export async function renderBackstage(container, sub) {
  const allEntities = getEntities();
  if (!allEntities.length) {
    container.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">👁</div><p>ยังไม่มีตน — เพิ่มตนก่อนนะ</p></div></div>`;
    return;
  }

  if (sub === 'midnight') {
    container.innerHTML = `
      <div class="page backstage-page">
        <div class="backstage-header">
          <div class="backstage-tabs">
            <a href="#/backstage" class="backstage-tab-btn">✦ บทสนทนาลับ</a>
            <a href="#/backstage/midnight" class="backstage-tab-btn active">🌙 หลังเที่ยงคืน</a>
          </div>
        </div>
        <div id="midnight-content"></div>
      </div>`;
    const midnightContent = container.querySelector('#midnight-content');
    const h = nowHourBKK();
    if (h < 0 || h > 4) {
      midnightContent.innerHTML = `<div class="backstage-empty"><p>กลับมาอีกทีตอนกลางดึก...</p></div>`;
    } else {
      await renderMidnightSection(midnightContent, allEntities);
    }
    return;
  }

  container.innerHTML = `
    <div class="page backstage-page">
      <div class="backstage-header">
        <div class="backstage-tabs">
          <a href="#/backstage" class="backstage-tab-btn active">✦ บทสนทนาลับ</a>
          <a href="#/backstage/midnight" class="backstage-tab-btn">🌙 หลังเที่ยงคืน</a>
        </div>
      </div>
      <div id="backstage-episodes"></div>
    </div>`;

  const epContainer = container.querySelector('#backstage-episodes');

  let cardsPool;
  try {
    const data = await fetch('data/cards.json').then(r => r.json());
    cardsPool = data.tarot || [];
  } catch {
    epContainer.innerHTML = `<div class="empty-state"><p>โหลดไพ่ไม่ได้</p></div>`;
    return;
  }

  const today = todayBKK();
  const nowMin = nowMinutesBKK();
  let saved = getBackstageEpisodes();

  if (!saved || saved.date !== today) {
    saved = { date: today, episodes: [] };
  }

  // Remove expired episodes (> 24h old)
  saved.episodes = saved.episodes.filter(ep => Date.now() - ep.startTime < 24 * 60 * 60 * 1000);

  async function generateAndRender(bypassTime = false) {
    for (const slot of SLOTS) {
      const alreadyExists = saved.episodes.find(ep => ep.slot === slot.id);
      if (alreadyExists) continue;
      if (!bypassTime && nowMin < slot.startRange[0]) continue;

      epContainer.innerHTML = `<div class="bs-generating">⏳ กำลังแอบดู...</div>`;
      try {
        const ep = await generateEpisode(slot, allEntities, cardsPool);
        if (bypassTime) ep.startTime = Date.now() - (REVEAL_INTERVAL_MAX * 60 * 1000 * 8); // reveal ทุกข้อความทันที
        saved.episodes.push(ep);
        saveBackstageEpisodes(saved);
        break; // generate ทีละตอน
      } catch {
        epContainer.innerHTML = `<div class="backstage-empty"><p>มีคนขวางไม่ให้ดู — ลองอีกครั้ง</p></div>`;
        return;
      }
    }
    drawEpisodes();
  }

  const epRenderedCounts = {};

  function drawEpisodes() {
    epContainer.innerHTML = '';

    if (!saved.episodes.length) {
      epContainer.innerHTML = `
        <div class="backstage-empty">
          <p>บทสนทนายังไม่เริ่ม — กลับมาใหม่หลัง ${formatTime(SLOTS[0].startRange[0])} น.</p>
        </div>`;
      return;
    }

    for (const ep of saved.episodes) {
      const prevCount = epRenderedCounts[ep.id] || 0;
      const visible = getVisibleMessages(ep);
      epRenderedCounts[ep.id] = visible.length;
      const div = document.createElement('div');
      div.className = 'bs-episode';
      div.innerHTML = renderEpisode(ep, allEntities, prevCount);
      epContainer.appendChild(div);
    }


    const footer = document.createElement('div');
    footer.className = 'bs-footer';
    footer.textContent = '👁 กำลังแอบดูอยู่';
    epContainer.appendChild(footer);
  }

  await generateAndRender(false);

  // Auto-refresh every minute to reveal new messages
  let refreshTimer = setInterval(() => {
    if (!document.querySelector('.backstage-page')) { clearInterval(refreshTimer); return; }
    drawEpisodes();
  }, 60000);
}

function formatTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

// ── Midnight Chat ─────────────────────────────────────────────────────────────
function nowHourBKK() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })).getHours();
}

function midnightDateKey() {
  const bkk = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const h = bkk.getHours();
  if (h < 5) {
    bkk.setDate(bkk.getDate() - 1);
  }
  return bkk.toLocaleDateString('en-CA');
}

// Generate backstage episodes in background (no DOM) — call on load + every minute
export async function prefetchBackstageEpisodes() {
  const allEntities = getEntities();
  if (!allEntities.length) return;

  const today = todayBKK();
  const nowMin = nowMinutesBKK();
  let saved = getBackstageEpisodes();
  if (!saved || saved.date !== today) saved = { date: today, episodes: [] };
  saved.episodes = saved.episodes.filter(ep => Date.now() - ep.startTime < 24 * 60 * 60 * 1000);

  const dueSlot = SLOTS.find(slot =>
    !saved.episodes.find(ep => ep.slot === slot.id) && nowMin >= slot.startRange[0]
  );
  if (!dueSlot) return;

  let cardsPool;
  try {
    const data = await fetch('data/cards.json').then(r => r.json());
    cardsPool = data.tarot || [];
  } catch { return; }

  try {
    const ep = await generateEpisode(dueSlot, allEntities, cardsPool);
    saved.episodes.push(ep);
    saveBackstageEpisodes(saved);
  } catch {}
}

const MIDNIGHT_GIMMICKS = ['silence', 'dots', 'confess', 'philosophy', 'secret', 'disagree'];

// Generate midnight chat data in background (no DOM) — call on load + every minute
export async function prefetchMidnightChat() {
  const h = nowHourBKK();
  if (h < 0 || h > 4) return; // ไม่ใช่ช่วงเที่ยงคืน

  const dateKey = midnightDateKey();
  const mc = getMidnightChat();
  if (mc?.date === dateKey) return; // มีแล้ว ไม่ต้อง generate ซ้ำ

  const allEntities = getEntities();
  if (!allEntities.length) return;

  let cardsPool;
  try {
    const data = await fetch('data/cards.json').then(r => r.json());
    cardsPool = data.tarot || [];
  } catch { return; }

  const useInteractive = Math.random() < 0.4;

  if (useInteractive) {
    const entity = allEntities[Math.floor(Math.random() * allEntities.length)];
    let prompt = '';
    try { prompt = await callMidnightInteractivePrompt(entity); } catch {}
    saveMidnightChat({
      date: dateKey,
      messages: [],
      startTime: Date.now(),
      interactive: prompt ? { entityId: entity.id, prompt, userReply: null, card: null, reply: null } : null,
    });
  } else {
    const gimmickCount = Math.random() < 0.5 ? 2 : 1;
    const gimmicks = [...MIDNIGHT_GIMMICKS].sort(() => Math.random() - 0.5).slice(0, gimmickCount);
    const entityCards = allEntities.map(e => ({ entityId: e.id, card: cardsPool[Math.floor(Math.random() * cardsPool.length)] }));
    let rawMessages;
    try { rawMessages = await callMidnightChat(allEntities, entityCards, gimmicks); } catch { return; }
    const half = Math.floor(rawMessages.length / 2);
    const revealInterval = 3 + Math.floor(Math.random() * 3);
    const messages = rawMessages.map((m, i) => ({
      ...m,
      revealDelay: i < half ? 0 : (i - half + 1) * revealInterval,
    }));
    saveMidnightChat({ date: dateKey, messages, startTime: Date.now(), interactive: null });
  }
}

export async function renderMidnightSection(container, allEntities) {
  const section = document.createElement('div');
  section.className = 'midnight-section';
  container.appendChild(section);

  const dateKey = midnightDateKey();
  let mc = getMidnightChat();
  if (mc?.date !== dateKey) mc = null;

  // แสดง loading เฉพาะตอนที่ต้อง generate เท่านั้น
  if (!mc) {
    section.innerHTML = `<div class="midnight-loading" style="text-align:center;color:var(--text-soft);padding:24px;font-style:italic">กำลังแอบฟังเรื่องที่คุณไม่ควรได้ยิน...</div>`;
  }

  let cardsPool = [];
  try {
    const data = await fetch('data/cards.json').then(r => r.json());
    cardsPool = data.tarot || [];
  } catch {
    if (!mc) { section.querySelector('.midnight-loading').textContent = 'โหลดไพ่ไม่ได้'; return; }
  }

  if (!mc) {
    const useInteractive = Math.random() < 0.4;

    if (useInteractive && allEntities.length) {
      // คืนนี้เป็นคืนที่พี่ทักมา — ไม่มีบทสนทนากลุ่ม
      const entity = allEntities[Math.floor(Math.random() * allEntities.length)];
      let prompt = '';
      try { prompt = await callMidnightInteractivePrompt(entity); } catch {}
      mc = {
        date: dateKey,
        messages: [],
        startTime: Date.now(),
        interactive: prompt ? { entityId: entity.id, prompt, userReply: null, card: null, reply: null } : null,
      };
      saveMidnightChat(mc);
    } else {
      // คืนนี้เป็นคืนบทสนทนา
      const gimmickCount = Math.random() < 0.5 ? 2 : 1;
      const shuffled = [...MIDNIGHT_GIMMICKS].sort(() => Math.random() - 0.5);
      const gimmicks = shuffled.slice(0, gimmickCount);
      const entityCards = allEntities.map(e => ({ entityId: e.id, card: cardsPool[Math.floor(Math.random() * cardsPool.length)] }));

      let rawMessages;
      try {
        rawMessages = await callMidnightChat(allEntities, entityCards, gimmicks);
      } catch (err) {
        console.error('Midnight chat error:', err);
        const msg = err?.message || 'unknown error';
        section.innerHTML = `
          <div style="text-align:center;padding:24px">
            <p style="color:var(--text-soft);margin-bottom:6px">มีคนขวางไม่ให้ดู</p>
            <p style="font-size:0.72rem;color:var(--text-soft);opacity:0.55;margin-bottom:14px">${esc(msg)}</p>
            <button class="btn btn-ghost" id="midnight-retry-btn" style="font-size:0.8rem">↺ ลองใหม่</button>
          </div>`;
        section.querySelector('#midnight-retry-btn')?.addEventListener('click', async () => {
          section.remove();
          await renderMidnightSection(container, allEntities);
        });
        return;
      }

      const half = Math.floor(rawMessages.length / 2);
      const revealInterval = 3 + Math.floor(Math.random() * 3);
      const messages = rawMessages.map((m, i) => ({
        ...m,
        revealDelay: i < half ? 0 : (i - half + 1) * revealInterval,
      }));

      mc = { date: dateKey, messages, startTime: Date.now(), interactive: null };
      saveMidnightChat(mc);
    }
  }

  drawMidnightSection(section, mc, allEntities, cardsPool);

  const timer = setInterval(() => {
    if (!document.contains(section)) { clearInterval(timer); return; }
    drawMidnightSection(section, getMidnightChat() || mc, allEntities, cardsPool);
  }, 30000);
}

function drawMidnightSection(section, mc, allEntities, cardsPool) {
  const now = Date.now();
  const visible = mc.messages.filter(m => now >= mc.startTime + m.revealDelay * 60000);
  const nextLocked = mc.messages[visible.length] || null;

  const lastCount = parseInt(section.dataset.renderedCount || '0');
  let animIdx = 0; // stagger counter for new messages only

  function entityStyle(entityId) {
    const e = allEntities.find(x => x.id === entityId);
    return `--bs-c:${e?.color_primary || 'var(--accent-deep)'};--bs-bg:${e?.color_secondary || 'rgba(255,182,193,0.15)'}`;
  }

  let prevId = null;
  const msgsHtml = visible.map((m, i) => {
    const e = allEntities.find(x => x.id === m.entityId);
    const showHeader = m.entityId !== prevId;
    prevId = m.entityId;
    const header = showHeader
      ? `<div class="bs-msg-header"><span class="bs-avatar">${esc(e?.icon || '🌙')}</span><span class="bs-sender-name">${esc(e?.name || m.entityId)}</span></div>`
      : '';
    const isNew = i >= lastCount;
    const animStyle = isNew ? ` style="${entityStyle(m.entityId)};animation-delay:${animIdx++ * 0.08}s"` : ` style="${entityStyle(m.entityId)}"`;
    const animClass = isNew ? ' mn-bubble-in' : ' mn-no-anim';
    return `<div class="bs-msg-group${showHeader ? '' : ' bs-continued'}${animClass}"${animStyle}>${header}<div class="bs-bubble-row"><div class="bs-bubble">${esc(m.text)}</div></div></div>`;
  }).join('');

  let lockedHtml = '';
  if (nextLocked) {
    const e = allEntities.find(x => x.id === nextLocked.entityId);
    const showHeader = nextLocked.entityId !== prevId;
    const msLeft = Math.ceil((mc.startTime + nextLocked.revealDelay * 60000 - now) / 60000);
    const timeHint = msLeft <= 1 ? 'กำลังจะส่ง...' : `อีก ${msLeft} นาที`;
    lockedHtml = `<div class="bs-msg-group" style="${entityStyle(nextLocked.entityId)}">
      ${showHeader ? `<div class="bs-msg-header"><span class="bs-avatar">${esc(e?.icon || '🌙')}</span><span class="bs-sender-name">${esc(e?.name || '?')}</span></div>` : ''}
      <div class="bs-bubble-row"><div class="bs-bubble bs-typing"><span class="bs-dots"><span>●</span><span>●</span><span>●</span></span></div></div>
    </div>
    <div class="midnight-time-hint">${timeHint}</div>`;
  }

  let interactiveHtml = '';
  if (mc.interactive) {
    const iv = mc.interactive;
    const e = allEntities.find(x => x.id === iv.entityId);
    const style = entityStyle(iv.entityId);
    if (iv.reply) {
      interactiveHtml = `<div class="midnight-interactive">
        <div class="midnight-interactive-label">💬 ${esc(e?.name || '?')} ทักมาหาคุณ</div>
        <div class="bs-msg-group" style="${style}">
          <div class="bs-msg-header"><span class="bs-avatar">${esc(e?.icon || '🌙')}</span><span class="bs-sender-name">${esc(e?.name || '?')}</span></div>
          <div class="bs-bubble-row"><div class="bs-bubble">${esc(iv.prompt)}</div></div>
        </div>
        <div class="bs-msg-group bs-continued" style="--bs-c:var(--accent-deep);--bs-bg:var(--accent)">
          <div class="bs-bubble-row"><div class="bs-bubble">${esc(iv.userReply)}</div></div>
        </div>
        <div class="bs-msg-group" style="${style}">
          <div class="bs-bubble-row"><div class="bs-bubble">${esc(iv.reply)}</div></div>
        </div>
      </div>`;
    } else {
      interactiveHtml = `<div class="midnight-interactive" id="midnight-iv">
        <div class="midnight-interactive-label">💬 ${esc(e?.name || '?')} ทักมาหาคุณ</div>
        <div class="bs-msg-group" style="${style}">
          <div class="bs-msg-header"><span class="bs-avatar">${esc(e?.icon || '🌙')}</span><span class="bs-sender-name">${esc(e?.name || '?')}</span></div>
          <div class="bs-bubble-row"><div class="bs-bubble">${esc(iv.prompt)}</div></div>
        </div>
        <div class="midnight-reply-row">
          <input class="input midnight-reply-input" id="midnight-reply-input" placeholder="ตอบกลับ..." maxlength="200">
          <button class="btn btn-primary btn-sm" id="midnight-reply-btn">ส่ง</button>
        </div>
      </div>`;
    }
  }

  section.dataset.renderedCount = visible.length;
  const ivAnimClass = section.dataset.ivRendered ? '' : ' mn-bubble-in';
  if (mc.interactive) section.dataset.ivRendered = '1';

  section.innerHTML = `
    ${interactiveHtml.replace('class="midnight-interactive"', `class="midnight-interactive${ivAnimClass}"`)}
    <div class="bs-episode">${msgsHtml}${lockedHtml}</div>`;

  const replyBtn = section.querySelector('#midnight-reply-btn');
  if (replyBtn) {
    replyBtn.addEventListener('click', async () => {
      const input = section.querySelector('#midnight-reply-input');
      const userMsg = input?.value?.trim();
      if (!userMsg) return;
      replyBtn.disabled = true; replyBtn.textContent = '⏳';

      const card = cardsPool[Math.floor(Math.random() * cardsPool.length)];
      const iv = mc.interactive;
      const entity = allEntities.find(x => x.id === iv.entityId);

      let reply = '';
      try { reply = await callMidnightReply(entity, userMsg, card); } catch {}

      const updated = { ...mc, interactive: { ...iv, userReply: userMsg, card, reply } };
      saveMidnightChat(updated);
      mc = updated;
      drawMidnightSection(section, updated, allEntities, cardsPool);
    });
  }
}

