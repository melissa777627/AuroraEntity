import { getEntities, getBackstageEpisodes, saveBackstageEpisodes, getMidnightChat, saveMidnightChat, saveBackstageLastViewed } from '../src/storage.js';
import { callBackstage, callMidnightChat, callMidnightInteractivePrompt, callMidnightReply } from '../src/api.js';

const TONES = [
  'เป็นห่วงแบบผิดจุด','เถียงกันเรื่อง keeper','วางแผนแอบช่วย',
  'นินทาด้วยความรัก','เรื่องของตัวเองล้วนๆ',
  'ระแวงว่า keeper หายไปไหน','เดิมพันเรื่อง keeper','อิจฉากันเอง',
  'เหนื่อยกับ keeper แบบยังรัก','drift ออกนอกเรื่อง','Nostalgic',
  'ปกป้อง keeper จากกันเอง','สอนกันเรื่อง keeper','ตกใจเรื่อง keeper',
  'แข่งว่าใครเข้าใจ keeper มากกว่า','Fangirl เรื่อง keeper',
  'คิดถึง keeper ตอน keeper ไม่มา','ลางบอกเหตุ','โกรธ keeper แต่ไม่ยอมรับ',
  'ขำ keeper แต่ไม่บอก','รู้สึกผิดแต่ไม่ยอมรับ','เถียงกันว่า keeper ผิดหรือถูก',
  'เอา keeper มาเป็นตัวอย่างในทุกเรื่อง','ใครจะเป็นคนบอก keeper',
  'keeper กำลังจะทำพลาดแต่ห้ามไม่ได้','เชื่อว่า keeper ส่งสัญญาณมา แต่แปลผิดกันหมด',
  'ถกกันว่า keeper เป็นประเภทไหน','พิสูจน์ว่าตัวเองไม่แคร์ keeper แต่ทำไม่ได้',
  'รอให้ keeper ถามก่อน','แย่งกันเป็นผู้เชี่ยวชาญ keeper แต่มั่วกันหมด',
];

const INCOMPATIBLE_MIXES = [
  ['Fangirl เรื่อง keeper', 'ลางบอกเหตุ'],
  ['drift ออกนอกเรื่อง', 'วางแผนแอบช่วย'],
];

const GIMMICKS = ['A','B','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U'];
const INTERJECTION_TYPES = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25];
const BS_DATA_VERSION = 2;

const SLOTS = [
  { id: 'morning',   startRange: [7*60, 9*60+30] },
  { id: 'afternoon', startRange: [12*60, 14*60+30] },
  { id: 'night',     startRange: [19*60, 21*60+30] },
  { id: 'latenight', startRange: [22*60, 23*60+30] },
];

const REVEAL_INTERVAL_MIN = 11;
const REVEAL_INTERVAL_MAX = 13;

function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function todayBKK() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

function bkkParts(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = fmt.formatToParts(date);
  const get = t => parseInt(parts.find(p => p.type === t)?.value ?? '0', 10);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

function nowMinutesBKK() {
  const { hour, minute } = bkkParts();
  return hour * 60 + minute;
}

function todayStartMs() {
  const { year, month, day } = bkkParts();
  const pad = n => String(n).padStart(2, '0');
  return Date.parse(`${year}-${pad(month)}-${pad(day)}T00:00:00+07:00`);
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
  const count = randInt(2, Math.min(all.length, 7));
  return shuffle(all).slice(0, count);
}

function pickInterjector(mainEntityIds, all, interjType) {
  const others = all.filter(e => !mainEntityIds.includes(e.id));
  if (!others.length) return null;
  const outgoingTypes = [1, 3, 6, 7, 9, 11, 12, 13, 15, 20, 23, 25];
  if (outgoingTypes.includes(interjType)) {
    const loud = others.filter(e => /ซน|เฮฮา|กวนตีน|แซว|พลังงานสูง|วุ่นวาย|ตลก|แรง/.test(e.personality || ''));
    if (loud.length) return pick(loud);
  }
  return pick(others);
}

async function generateEpisode(slot, allEntities, cardsPool, mainEntities) {
  if (!mainEntities) mainEntities = pickEntities(allEntities);
  const mainIds = mainEntities.map(e => e.id);
  const tones = pickTones();
  const gimmick = Math.random() < 0.4 ? pick(GIMMICKS) : null;

  const cards = mainEntities.map(() => pick(cardsPool));

  const useInterjection = Math.random() < 0.6;
  let interjection = null;
  if (useInterjection) {
    const interjType = pick(INTERJECTION_TYPES);
    const interjector = pickInterjector(mainIds, allEntities, interjType) || pick(mainEntities);
    interjection = { type: interjType, entityId: interjector.id, name: interjector.name };
  }

  const rawMessages = await callBackstage(mainEntities, cards, tones, gimmick, interjection);

  const revealInterval = randInt(REVEAL_INTERVAL_MIN, REVEAL_INTERVAL_MAX);
  const startTime = buildSlotStartTime(slot);

  const messages = [];
  let cumDelay = 0;
  for (let i = 0; i < rawMessages.length; i++) {
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
    const styleStr = isNew
      ? `${entityStyle(m.entityId)};opacity:0;transform:translateY(8px)`
      : entityStyle(m.entityId);
    const reaction = episode.reactions?.[i];
    const reactionBadge = reaction ? `<div class="bs-reaction-badge">${reaction}</div>` : '';
    const whisperClass = m.whisper ? ' bs-whisper' : '';
    const bubbleContent = isNew
      ? `<div class="bs-bubble bs-typewriter${whisperClass}" data-fulltext="${esc(m.text).replace(/"/g, '&quot;')}"></div>`
      : `<div class="bs-bubble${whisperClass}">${esc(m.text)}</div>`;
    return `<div class="bs-msg-group${showHeader ? '' : ' bs-continued'}" data-ep-id="${episode.id}" data-msg-idx="${i}" style="${styleStr}">${header}<div class="bs-bubble-row">${bubbleContent}</div>${reactionBadge}</div>`;
  }).join('');

  const lockedHtml = '';

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
  saveBackstageLastViewed();

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

  if (!saved || saved.date !== today || saved.version !== BS_DATA_VERSION) {
    saved = { version: BS_DATA_VERSION, date: today, episodes: [] };
  }

  // Remove expired episodes (> 24h old)
  saved.episodes = saved.episodes.filter(ep => Date.now() - ep.startTime < 24 * 60 * 60 * 1000);

  async function generateAndRender(bypassTime = false) {
    if (saved.episodes.length) drawEpisodes();

    for (const slot of SLOTS) {
      const alreadyExists = saved.episodes.find(ep => ep.slot === slot.id);
      if (alreadyExists) continue;
      if (!bypassTime && nowMin < slot.startRange[0]) continue;

      const mainEntities = pickEntities(allEntities);

      if (!saved.episodes.length) {
        const loadDiv = document.createElement('div');
        loadDiv.className = 'bs-episode';
        epContainer.innerHTML = '';
        epContainer.appendChild(loadDiv);
        showGeneratingState(loadDiv, mainEntities);
      }

      try {
        const ep = await generateEpisode(slot, allEntities, cardsPool, mainEntities);
        if (bypassTime) ep.startTime = Date.now() - (REVEAL_INTERVAL_MAX * 60 * 1000 * 8);
        saved.episodes.push(ep);
        saveBackstageEpisodes(saved);
        break;
      } catch {
        if (!saved.episodes.length) {
          epContainer.innerHTML = `<div class="backstage-empty"><p>มีคนขวางไม่ให้ดู — ลองอีกครั้ง</p></div>`;
          appendTestBtn();
          return;
        }
      }
    }
    drawEpisodes();
  }

  const epRenderedCounts = {};
  let typingInProgress = false;

  const pause = ms => new Promise(r => setTimeout(r, ms));

  function showGeneratingState(div, entities) {
    const hint = document.createElement('div');
    hint.className = 'bs-generating';
    hint.textContent = 'กำลังแอบดู...';
    div.appendChild(hint);

    const widths = [60, 75, 45, 82, 55, 70, 40, 68];
    const skeletonEntities = shuffle(entities);
    for (let i = 0; i < 8; i++) {
      const entity = skeletonEntities[i % skeletonEntities.length];
      const c  = entity.color_primary   || 'var(--accent-deep)';
      const bg = entity.color_secondary || 'rgba(255,182,193,0.15)';
      const group = document.createElement('div');
      group.className = 'bs-msg-group bs-continued';
      group.style.cssText = `--bs-c:${c};--bs-bg:${bg}`;
      group.innerHTML = `<div class="bs-bubble-row"><div class="bs-bubble bs-skeleton" style="width:${widths[i % widths.length]}%"></div></div>`;
      div.appendChild(group);
    }
  }

  async function runTypewriters(bubbles) {
    typingInProgress = true;
    const fast = bubbles.length > 5;
    const charMs = fast ? 7 : 22;
    const gapMs  = fast ? 20 : 65;

    for (const bubble of bubbles) {
      const group = bubble.closest('[data-msg-idx]');
      if (!group || !document.contains(group)) break;

      const text = bubble.dataset.fulltext || '';

      group.getBoundingClientRect();
      group.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
      group.style.opacity = '1';
      group.style.transform = 'translateY(0)';
      await pause(55);

      for (let j = 1; j <= text.length; j++) {
        if (!document.contains(bubble)) { typingInProgress = false; return; }
        bubble.textContent = text.slice(0, j);
        await pause(charMs);
      }

      await pause(gapMs);
    }
    typingInProgress = false;
  }

  function appendSpecialSection(newBubbles) {
    const section = document.createElement('div');
    section.className = 'bs-special-section';

    const label = document.createElement('div');
    label.className = 'bs-special-label';
    label.textContent = '✦ รอบพิเศษ';
    section.appendChild(label);

    if (saved.specialEpisode) {
      const prevCount = epRenderedCounts[saved.specialEpisode.id] || 0;
      epRenderedCounts[saved.specialEpisode.id] = saved.specialEpisode.messages.length;
      const div = document.createElement('div');
      div.className = 'bs-episode';
      div.innerHTML = renderEpisode(saved.specialEpisode, allEntities, prevCount);
      div.querySelectorAll('.bs-typewriter').forEach(b => newBubbles.push(b));
      section.appendChild(div);
    }

    const genBtn = document.createElement('button');
    genBtn.className = 'btn btn-secondary bs-special-btn';
    genBtn.textContent = saved.specialEpisode ? '↺ ขอรอบพิเศษใหม่' : '✦ ขอรอบพิเศษ';
    genBtn.addEventListener('click', async () => {
      genBtn.disabled = true;
      genBtn.textContent = '⏳';
      const mainEntities = pickEntities(allEntities);
      const loadDiv = document.createElement('div');
      loadDiv.className = 'bs-episode';
      section.insertBefore(loadDiv, genBtn);
      showGeneratingState(loadDiv, mainEntities);
      try {
        const ep = await generateEpisode({ id: 'special', startRange: [0, 1] }, allEntities, cardsPool, mainEntities);
        ep.id = 'ep_special';
        ep.startTime = Date.now() - 24 * 60 * 60 * 1000;
        saved.specialEpisode = ep;
        saveBackstageEpisodes(saved);
        drawEpisodes();
      } catch {
        loadDiv.remove();
        genBtn.disabled = false;
        genBtn.textContent = saved.specialEpisode ? '↺ ขอรอบพิเศษใหม่' : '✦ ขอรอบพิเศษ';
        window.showToast?.('มีคนขวางไม่ให้ดู — ลองอีกครั้ง', 'error');
      }
    });
    section.appendChild(genBtn);
    epContainer.appendChild(section);
  }

  function drawEpisodes() {
    if (typingInProgress) return;
    epContainer.innerHTML = '';

    if (!saved.episodes.length) {
      epContainer.innerHTML = `
        <div class="backstage-empty">
          <p>บทสนทนายังไม่เริ่ม — กลับมาใหม่หลัง ${formatTime(SLOTS[0].startRange[0])} น.</p>
        </div>`;
      appendSpecialSection([]);
      return;
    }

    const newBubbles = [];

    for (let i = 0; i < saved.episodes.length; i++) {
      const ep = saved.episodes[i];
      const visible = getVisibleMessages(ep);
      const isDone = visible.length === ep.messages.length && ep.messages.length > 0;
      const isLast = i === saved.episodes.length - 1;

      if (isDone && !isLast) {
        const details = document.createElement('details');
        details.className = 'bs-episode-collapsed';
        details.innerHTML = `
          <summary class="bs-episode-drift">บทสนทนานี้ค่อยๆลอยไปตามลม...</summary>
          <div class="bs-episode bs-episode-archived">${renderEpisode(ep, allEntities, Infinity)}</div>`;
        epContainer.appendChild(details);
        const div = document.createElement('div');
        div.className = 'bs-episode-divider';
        epContainer.appendChild(div);
      } else {
        const prevCount = epRenderedCounts[ep.id] || 0;
        const newVisible = visible.length;
        epRenderedCounts[ep.id] = newVisible;
        const div = document.createElement('div');
        div.className = 'bs-episode';
        div.innerHTML = renderEpisode(ep, allEntities, prevCount);
        div.querySelectorAll('.bs-typewriter').forEach(b => newBubbles.push(b));
        epContainer.appendChild(div);
      }
    }

    const footer = document.createElement('div');
    footer.className = 'bs-footer';
    footer.textContent = '👁 กำลังแอบดูอยู่';
    epContainer.appendChild(footer);

    if (newBubbles.length) runTypewriters(newBubbles);
  }

  await generateAndRender(false);

  // ── Emoji reactions ──
  const EMOJIS = ['❤️', '😂', '😮', '😢', '💀', '🙄', '🥹', '👀'];
  let activePicker = null;

  function closePicker() { activePicker?.remove(); activePicker = null; }

  epContainer.addEventListener('click', e => {
    // Emoji button click
    const emojiBtn = e.target.closest('.bs-emoji-btn');
    if (emojiBtn && activePicker) {
      e.stopPropagation();
      const group = activePicker.closest('[data-msg-idx]');
      const epId = group?.dataset.epId;
      const msgIdx = parseInt(group?.dataset.msgIdx);
      const ep = saved.episodes.find(x => x.id === epId);
      if (ep) {
        if (!ep.reactions) ep.reactions = {};
        const emoji = emojiBtn.dataset.emoji;
        if (emoji) ep.reactions[msgIdx] = emoji; else delete ep.reactions[msgIdx];
        saveBackstageEpisodes(saved);
      }
      closePicker();
      drawEpisodes();
      return;
    }

    // Bubble click — open/close picker
    const bubble = e.target.closest('.bs-bubble:not(.bs-typing)');
    const group = bubble?.closest('[data-msg-idx]');

    if (activePicker) {
      const same = activePicker.closest('[data-msg-idx]') === group;
      closePicker();
      if (same) return;
    }
    if (!group) return;

    const epId = group.dataset.epId;
    const msgIdx = parseInt(group.dataset.msgIdx);
    const ep = saved.episodes.find(x => x.id === epId);
    const cur = ep?.reactions?.[msgIdx];

    activePicker = document.createElement('div');
    activePicker.className = 'bs-emoji-picker';
    activePicker.innerHTML = EMOJIS.map(em =>
      `<button class="bs-emoji-btn${em === cur ? ' active' : ''}" data-emoji="${em}">${em}</button>`
    ).join('') + (cur ? `<button class="bs-emoji-btn bs-emoji-clear" data-emoji="">✕</button>` : '');
    group.appendChild(activePicker);
  });

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
  return bkkParts().hour;
}

function midnightDateKey() {
  const { hour } = bkkParts();
  const date = hour < 5 ? new Date(Date.now() - 86400000) : new Date();
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

// Generate backstage episodes in background (no DOM) — call on load + every minute
export async function prefetchBackstageEpisodes() {
  const allEntities = getEntities();
  if (!allEntities.length) return;

  const today = todayBKK();
  const nowMin = nowMinutesBKK();
  let saved = getBackstageEpisodes();
  if (!saved || saved.date !== today || saved.version !== BS_DATA_VERSION) saved = { version: BS_DATA_VERSION, date: today, episodes: [] };
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

