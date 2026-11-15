// 💌 จดหมาย — an entity writes first. Everything comes from the cards:
//  • who writes: once a day one "knock card" is drawn; if it is one of an entity's
//    signature cards (the 3 that come up with them most), that entity knocks. Otherwise a quiet day.
//  • what kind: Major / court knock card → "ส่งไพ่มาให้" (3 cards), number card → "ทักสั้น" (1 card, 1 sentence)
//  • the label: read off the knock card's own data, never chosen by the AI
//  • the words: decode → voice, same as a normal reading
import { getReadingsByEntity, getDivineMessage, saveDivineMessage, clearDivineMessage, saveReading, getNotebook, getFavorites, get, set } from '../src/storage.js';
import { callDecode, callVoice, callText } from '../src/api.js';
import { enforceVoice, styleExamplesFor, recentGesturesFor } from '../src/reading-prompts.js';
import { navigate } from '../src/app.js';

const MIN_DRAWS = 5;   // an entity needs this many cards in the notebook before it can knock
const LETTER_CONTEXT = 'divine timing';

let deckCache = null;
async function deck() {
  if (!deckCache) deckCache = (await fetch('data/cards.json').then(r => r.json())).tarot || [];
  return deckCache;
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
// *(gesture)* lines become soft brackets, like chat
const voiceHTML = t => esc(t || '').replace(/\*\(([^*\n]*?)\)\*/g, '<span class="voice-action">($1)</span>');

// ── who knocks ──────────────────────────────────────────────
// The cards that come up with this entity most (letters themselves don't count)
export function signatureCards(entityId) {
  const count = {};
  let total = 0;
  getReadingsByEntity(entityId).filter(r => r.context !== LETTER_CONTEXT).forEach(r =>
    (r.cards || []).forEach(c => { count[c.id] = (count[c.id] || 0) + 1; total++; }));
  if (total < MIN_DRAWS) return [];
  return Object.entries(count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 3).map(([id, n]) => ({ id, n }));
}

// Once per (Bangkok) day, while no letter is waiting
async function knock(entities) {
  if (getDivineMessage() || get('knock_day') === today()) return;
  set('knock_day', today());
  const cards = await deck();
  const card = cards[Math.floor(Math.random() * cards.length)];
  const hits = entities.map(e => ({ e, sig: signatureCards(e.id).find(s => s.id === card.id) })).filter(x => x.sig);
  if (!hits.length) return;   // nobody's card — a quiet day
  const top = Math.max(...hits.map(h => h.sig.n));
  const best = hits.filter(h => h.sig.n === top);
  const { e } = best[Math.floor(Math.random() * best.length)];
  saveDivineMessage({ entityId: e.id, knockId: card.id, kind: kindOf(card), at: Date.now(), text: '' });
}

const kindOf = card => (card.suit === 'Major' || card.person_card) ? 'cards' : 'short';

// The label comes from the knock card's data, in this order
export function labelOf(card) {
  if (!card) return '';
  if (card.unease) return '⚠️ ไพ่บอกว่า: เป็นห่วง อยากเตือน';
  if (card.directive) return '👉 ไพ่บอกว่า: อยากให้ทำอะไรบางอย่าง';
  if (card.hesitation) return '🤐 ไพ่บอกว่า: ลังเลอยู่';
  if (card.suit === 'Major') return '👀 ไพ่บอกว่า: ให้สังเกต';
  if (card.approach === 'away') return '🌫️ ไพ่บอกว่า: ขอระยะห่างนิดนึง';
  if (card.approach === 'toward') return '💗 ไพ่บอกว่า: คิดถึง อยากใกล้';
  return '💬 ไพ่บอกว่า: แค่อยากทัก';
}

// ── writing the letter ──────────────────────────────────────
async function write(letter, entity) {
  const all = await deck();
  const knockCard = all.find(c => c.id === letter.knockId) || all[Math.floor(Math.random() * all.length)];
  const cards = [knockCard];
  if (letter.kind === 'cards') {
    const pool = all.filter(c => c.id !== knockCard.id);
    while (cards.length < 3) cards.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  const picked = cards.map(c => ({ ...c, reversed: false }));
  const signs = getNotebook(entity.id).signs?.calling || [];
  const mode = letter.kind === 'cards' ? 'cards' : 'short';

  const decode = await callDecode(entity, '', '', picked, [], { initiated: true });
  const { text: raw } = await callVoice(entity, '', '', decode, [], null, {
    initiated: mode,
    signs,
    styleExamples: styleExamplesFor(entity.id, getFavorites()),
    recentGestures: recentGesturesFor(getReadingsByEntity(entity.id))
  });
  const text = enforceVoice(raw, decode, entity) || raw;
  const signsHit = signs.filter(s => s.text && text.includes(s.text));
  const why = await explain(decode, text).catch(() => null);

  const done = { ...letter, cards: picked, decode, text, why, signsHit, label: labelOf(knockCard) };
  saveDivineMessage(done);
  saveReading({
    id: `divine_${Date.now()}`, date: today(), entity_id: entity.id, context: LETTER_CONTEXT, question: '',
    cards: picked, decode, messages: [{ id: `msg_${Date.now()}`, role: 'assistant', content: text }]
  });
  return done;
}

// "ทำไมพี่พูดแบบนี้": which message (and so which cards) each spoken line came from
async function explain(decode, text) {
  const msgs = (decode.messages || []).map((m, i) => `${i}: ${m.text}`).join('\n');
  const raw = await callText(
    'คุณจับคู่ประโยคที่พูดกับสารต้นทาง ตอบเป็น JSON เท่านั้น',
    `สารต้นทาง (เลข: ข้อความ):
${msgs || '(ไม่มี)'}

ข้อความที่พูด:
"""${text}"""

แบ่งข้อความที่พูดเป็นประโยค/วลีตามที่เขียน (คัดลอกตรงตัว ห้ามแก้ ห้ามข้าม) แล้วบอกว่าแต่ละประโยคมาจากสารเลขไหน
- ท่าทางในรูป *(…)* ให้ gesture = true
- ประโยคที่ไม่ตรงกับสารใดเลย ให้ msg = []
{"lines":[{"text":"...","msg":[0],"gesture":false}]}`,
    { temperature: 0, maxOutputTokens: 2048, responseMimeType: 'application/json' }
  );
  const j = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || '{}');
  return Array.isArray(j.lines) ? j.lines.filter(l => l && typeof l.text === 'string') : null;
}

function whyHTML(letter) {
  const d = letter.decode || {};
  const byId = Object.fromEntries((letter.cards || []).map(c => [c.id, c]));
  const names = ids => (ids || []).map(id => esc(byId[id]?.nameTH || byId[id]?.name || id)).join(' · ');
  if (letter.why?.length) {
    return letter.why.map(l => {
      const ids = l.gesture ? d.nonverbal?.cards : (l.msg || []).flatMap(i => d.messages?.[i]?.cards || []);
      const ok = ids?.length;
      return `<div class="lt-why-row${ok ? '' : ' bad'}"><div class="lt-why-say">${voiceHTML(l.text)}</div>
        <div class="lt-why-from">${ok ? `🂠 ${names([...new Set(ids)])}` : '⚠️ ประโยคนี้ไม่มีไพ่รองรับ'}</div></div>`;
    }).join('');
  }
  // no line map (older letter or the match failed): list what was sent instead
  return (d.messages || []).map(m => `<div class="lt-why-row"><div class="lt-why-say">${esc(m.text)}</div><div class="lt-why-from">🂠 ${names(m.cards)}</div></div>`).join('')
    || '<div class="lt-why-from">ไม่มีข้อมูลการถอดไพ่ของจดหมายฉบับนี้</div>';
}

// ── on the home page ────────────────────────────────────────
export async function renderLetter(slot, entities) {
  if (!slot || !entities.length) return;
  await knock(entities);
  const letter = getDivineMessage();
  if (!letter) { slot.innerHTML = ''; return; }
  const entity = entities.find(e => e.id === letter.entityId);
  if (!entity) { clearDivineMessage(); slot.innerHTML = ''; return; }
  if (letter.text) return showPaper(slot, letter, entity, false);

  slot.innerHTML = `
    <div class="lt-env" id="lt-env">
      <div class="lt-flap"></div>
      <div class="lt-front">
        <b>มีจดหมายมาถึง</b>
        <small>${letter.kind === 'short' ? 'ข้อความสั้นๆ จากใครบางคน' : 'มีคนส่งไพ่มาให้'} · แตะตราเพื่อเปิด</small>
      </div>
      <button class="lt-seal" id="lt-seal" aria-label="แกะตราเปิดซอง">♥</button>
    </div>`;
  slot.querySelector('#lt-seal').addEventListener('click', () => openEnvelope(slot, letter, entity));
}

async function openEnvelope(slot, letter, entity) {
  const env = slot.querySelector('#lt-env');
  env.classList.add('open');
  env.insertAdjacentHTML('beforeend', `<div class="lt-paper rising"><div class="lt-wait">💌 กำลังคลี่กระดาษ…</div></div>`);
  try {
    const done = await write(letter, entity);
    showPaper(slot, done, entity, true);
  } catch (err) {
    slot.querySelector('.lt-paper').innerHTML = `<div class="lt-err">❌ ${esc(err.message)}</div>
      <button class="btn btn-secondary btn-sm" id="lt-retry">↩ ลองเปิดอีกครั้ง</button>`;
    slot.querySelector('#lt-retry').addEventListener('click', () => renderLetter(slot, [entity]));
  }
}

function showPaper(slot, letter, entity, rising) {
  slot.innerHTML = `
    <div class="lt-env open settled">
      <div class="lt-flap"></div>
      <div class="lt-paper${rising ? ' rising' : ''}">
        ${letter.label ? `<div class="lt-label">${esc(letter.label)}</div>` : ''}
        <div class="lt-cards">${(letter.cards || []).map(c => `<span class="lt-card">${esc(c.nameTH || c.name)}</span>`).join('')}</div>
        <div class="lt-text">${voiceHTML(letter.text)}</div>
        ${(letter.signsHit || []).map(s => `<div class="lt-sign">${esc(s.e)} พูดถึง "${esc(s.text)}" ได้ เพราะอยู่ในสัญญาณประจำตัวของพี่</div>`).join('')}
        <div class="lt-from">จาก <span class="lt-who" id="lt-who">${esc(entity.icon || '🌙')} ${esc(entity.name)}</span></div>
        <details class="lt-why"><summary>ทำไมพี่พูดแบบนี้</summary>${whyHTML(letter)}</details>
        <div class="lt-actions">
          <button class="btn btn-secondary btn-sm" id="lt-reveal">👁️ เปิดดูว่าใครส่ง</button>
          <button class="btn btn-ghost btn-sm" id="lt-read">✓ อ่านแล้ว</button>
        </div>
      </div>
    </div>`;
  const reveal = slot.querySelector('#lt-reveal');
  reveal.addEventListener('click', () => {
    const who = slot.querySelector('#lt-who');
    if (!who.classList.contains('shown')) { who.classList.add('shown'); reveal.textContent = `💬 ตอบ${entity.name}`; }
    else navigate(`#/chat/${entity.id}`);
  });
  slot.querySelector('#lt-read').addEventListener('click', () => {
    clearDivineMessage();
    slot.innerHTML = `<div class="lt-done">✨ เก็บไว้ในแชท${esc(entity.name)}แล้ว · พี่จะทักมาอีกเมื่อไพ่เคาะประตู</div>`;
  });
}

// For the ✨ วันนี้ tile
export function letterStatus() {
  const l = getDivineMessage();
  if (l?.text) return ['มีจดหมายรออ่านอยู่', 'แตะเพื่อไปอ่านที่หน้าหลัก'];
  if (l) return ['มีจดหมายมาถึง', 'ยังไม่ได้แกะซอง ไม่รู้ว่าใครส่ง'];
  return ['ยังไม่มีจดหมาย', 'พี่จะทักมาเองเมื่อไพ่เคาะประตู'];
}
