// "📜 ภาพรวมพี่" — gossip-style overview of an entity, grounded in the cards that actually came up.
// Numbers are counted in code; the AI only narrates them (and quotes real lines), never invents.
import { getReadingsByEntity, get, set } from '../src/storage.js';
import { callText } from '../src/api.js';

const SUIT_TH = { Cups: 'ถ้วย', Swords: 'ดาบ', Wands: 'ไม้', Pentacles: 'เหรียญ', Major: 'ไพ่ใหญ่' };
const SUIT_MEANS = { Cups: 'ความรู้สึก ความรัก', Swords: 'ความคิด ความเครียด', Wands: 'แรงผลักดัน การลงมือ', Pentacles: 'งาน เงิน ชีวิตจริง', Major: 'เรื่องใหญ่ ช่วงชีวิต' };

let deckCache = null;
async function deck() {
  if (deckCache) return deckCache;
  const res = await fetch('data/cards.json');
  const data = await res.json();
  deckCache = Object.fromEntries((data.tarot || []).map(c => [c.id, c]));
  return deckCache;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Tiny markdown: ## headings, **bold**, - bullets, > quotes, paragraphs.
function md(text) {
  return esc(text).split('\n').map(line => {
    const l = line.trim();
    if (!l) return '';
    const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*\((.+?)\)\*/g, '<em>($1)</em>');
    if (l.startsWith('## ')) return `<h3 class="ov-h">${inline(l.slice(3))}</h3>`;
    if (l.startsWith('- ')) return `<li>${inline(l.slice(2))}</li>`;
    if (l.startsWith('&gt; ')) return `<blockquote>${inline(l.slice(5))}</blockquote>`;
    return `<p>${inline(l)}</p>`;
  }).join('').replace(/(<li>.*?<\/li>)+/g, m => `<ul>${m}</ul>`);
}

export async function computeStats(entityId) {
  const d = await deck();
  const readings = getReadingsByEntity(entityId).filter(r => r.cards?.length);
  // Current card data wins (older readings stored thinner card objects)
  const full = c => ({ ...c, ...(d[c.id] || {}) });

  const count = {}, suits = {};
  const directive = [], warm = [], heavy = [];
  readings.forEach(r => r.cards.map(full).forEach(c => {
    count[c.id] = (count[c.id] || 0) + 1;
    suits[c.suit] = (suits[c.suit] || 0) + 1;
    if (c.directive) directive.push({ card: c.name, q: r.question });
    if (c.suit === 'Cups' || c.approach === 'toward') warm.push(c.name);
    if (c.unease || (c.suit === 'Swords' && (c.intensity || 0) >= 2)) heavy.push(c.name);
  }));

  // Trend: dominant suit in the older half vs the newer half
  const half = Math.ceil(readings.length / 2);
  const dominant = list => {
    const t = {};
    list.forEach(r => r.cards.forEach(c => { const s = (d[c.id] || c).suit; t[s] = (t[s] || 0) + 1; }));
    return Object.entries(t).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  };
  const trend = readings.length >= 4 ? { early: dominant(readings.slice(0, half)), late: dominant(readings.slice(half)) } : null;

  const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, n]) => ({ name: d[id]?.name || id, nameTH: d[id]?.nameTH || '', n }));

  return { readings, total: readings.length, top, suits, directive, warmCount: warm.length, heavyCount: heavy.length, trend };
}

export function statsForPrompt(entity, s) {
  const totalCards = Object.values(s.suits).reduce((a, b) => a + b, 0) || 1;
  const suitLines = Object.entries(s.suits).sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${SUIT_TH[k] || k} (${SUIT_MEANS[k] || ''}): ${n} ใบ (${Math.round(n / totalCards * 100)}%)`).join('\n');
  const recent = s.readings.slice(-12).map(r => {
    const said = r.messages?.find(m => m.role === 'assistant')?.content?.replace(/\s+/g, ' ').slice(0, 140) || '';
    return `- [${r.date}] ผู้ถาม: "${r.question}" | ไพ่: ${r.cards.map(c => c.name + (c.jumper ? '✨' : '')).join(', ')}${r.decode?.summary ? `\n  สรุป: ${r.decode.summary}` : ''}${said ? `\n  ${entity.name}ตอบ: "${said}"` : ''}`;
  }).join('\n');
  return `${entity.name} — คุยกันมาแล้ว ${s.total} ครั้ง (นับเฉพาะที่มีไพ่)

ไพ่ที่ออกบ่อย: ${s.top.map(t => `${t.name}${t.nameTH ? ` (${t.nameTH})` : ''} ×${t.n}`).join(', ') || '-'}
สัดส่วนชุดไพ่:
${suitLines || '-'}
ไพ่สายหวาน/เข้าหา: ${s.warmCount} ใบ · ไพ่สายหนัก/เครียด: ${s.heavyCount} ใบ
ไพ่สายดุ/สั่ง: ${s.directive.length ? s.directive.map(x => `${x.card} (ตอนถามว่า "${x.q}")`).join(', ') : 'ยังไม่เคยออก'}
${s.trend ? `แนวโน้ม: ช่วงแรกชุด${SUIT_TH[s.trend.early] || s.trend.early}เด่น → ช่วงหลังชุด${SUIT_TH[s.trend.late] || s.trend.late}เด่น` : 'แนวโน้ม: ยังน้อยเกินจะดูแนวโน้ม'}

บทสนทนาล่าสุด:
${recent}`;
}

export const GOSSIP_SYSTEM = `คุณคือเพื่อนสนิทที่นั่งเม้ามอยเรื่อง "พี่" (spirit entity) ให้ผู้ถามฟัง จากไพ่ที่ออกมาจริงเท่านั้น
น้ำเสียง: สนุก ฮาๆ เป็นกันเอง แซวได้ ใช้อีโมจิพอประมาณ เรียกผู้ถามว่า "คุณ" ไม่ต้องใช้สรรพนามแทนตัวเอง
ภาษาไทยภาษาพูด ไม่เป็นทางการ ไม่ภาษาเขียน

กฎ:
- อิงตัวเลขและบทสนทนาที่ให้มาเท่านั้น ห้ามแต่งไพ่ เหตุการณ์ หรือคำพูดที่ไม่มี
- อ้างไพ่ที่ออกจริงพร้อมความหมายสั้นๆ ในวงเล็บ ยกคำพูดจริงของพี่มา 1-2 ประโยคได้ (ใส่เครื่องหมายคำพูด)
- ถ้าข้อมูลยังน้อย บอกตรงๆ ไม่ฟันธงเกินข้อมูล
- ความยาวไม่เกินประมาณ 250 คำ

รูปแบบ (markdown แบบง่าย):
## คลั่งรักไหม: <ตอบสั้นๆ ฮาๆ>
- เหตุผลจากไพ่ 2-3 ข้อ
## ดุไหม: <ตอบสั้นๆ>
- เหตุผลจากไพ่ (ดูไพ่สายดุ/สั่ง และไพ่สายหนัก)
## ภาพรวมที่น่าสนใจ
- แนวโน้มหรือไพ่ที่ออกบ่อย
**สรุปเป็นคำเดียว:** <ประโยคเดียว ฮาๆ> + อีโมจิ
(ปิดท้ายด้วยวงเล็บบอกว่าอ่านจากไพ่กี่ครั้ง)`;

export async function openOverview(entity) {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  overlay.innerHTML = `
    <div class="modal ov-modal">
      <div class="modal-header">
        <span class="modal-title">📜 ภาพรวม${esc(entity.name)}</span>
        <button class="btn-icon" id="ov-close" aria-label="ปิด">✕</button>
      </div>
      <div class="ov-body"><div class="analysis-loading"><div class="spinner"></div>กำลังนับไพ่…</div></div>
    </div>`;
  const close = () => { overlay.classList.add('hidden'); overlay.innerHTML = ''; };
  overlay.querySelector('#ov-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); }, { once: true });

  const s = await computeStats(entity.id);
  const body = overlay.querySelector('.ov-body');
  if (!s.total) {
    body.innerHTML = `<p class="ov-empty">ยังไม่มีการอ่านไพ่กับ${esc(entity.name)}เลย ถามพี่สักคำถามก่อนนะ 🃏</p>`;
    return;
  }

  const totalCards = Object.values(s.suits).reduce((a, b) => a + b, 0) || 1;
  const bars = ['Cups', 'Swords', 'Wands', 'Pentacles', 'Major'].filter(k => s.suits[k]).map(k => `
    <div class="ov-bar"><span class="ov-bar-label">${SUIT_TH[k]}</span>
      <span class="ov-bar-track"><span class="ov-bar-fill ov-${k}" style="width:${Math.round(s.suits[k] / totalCards * 100)}%"></span></span>
      <span class="ov-bar-n">${s.suits[k]}</span></div>`).join('');

  const cacheKey = 'overview_cache';
  const cache = get(cacheKey) || {};
  const cached = cache[entity.id];

  body.innerHTML = `
    <div class="ov-stats">
      <div class="ov-chip">💬 ${s.total} ครั้ง</div>
      <div class="ov-chip">💗 สายหวาน ${s.warmCount}</div>
      <div class="ov-chip">⛈️ สายหนัก ${s.heavyCount}</div>
      <div class="ov-chip">⚖️ สายดุ ${s.directive.length}</div>
    </div>
    <div class="ov-bars">${bars}</div>
    ${s.top.length ? `<div class="ov-top">ออกบ่อย: ${s.top.map(t => `<span>${esc(t.nameTH || t.name)} ×${t.n}</span>`).join('')}</div>` : ''}
    <div class="ov-gossip">${cached ? md(cached.text) : ''}</div>
    <button class="btn btn-primary ov-go">${cached ? (cached.total === s.total ? '🔄 เม้าใหม่' : '🆕 มีคำถามใหม่ เม้าใหม่') : '☕ เม้าให้ฟังหน่อย'}</button>
    <div class="ov-note">${cached ? `เม้าไว้ตอนคุยกันได้ ${cached.total} ครั้ง` : 'ใช้ AI 1 ครั้ง ประมาณ 0.3 บาท'}</div>`;

  body.querySelector('.ov-go').addEventListener('click', async function () {
    this.disabled = true;
    const box = body.querySelector('.ov-gossip');
    box.innerHTML = '<div class="analysis-loading"><div class="spinner"></div>กำลังเม้า…</div>';
    try {
      const text = await callText(GOSSIP_SYSTEM, statsForPrompt(entity, s), { temperature: 0.9, maxOutputTokens: 2048 });
      box.innerHTML = md(text);
      cache[entity.id] = { text, total: s.total, at: new Date().toISOString() };
      set(cacheKey, cache);
      this.textContent = '🔄 เม้าใหม่';
      body.querySelector('.ov-note').textContent = `เม้าไว้ตอนคุยกันได้ ${s.total} ครั้ง`;
    } catch (err) {
      box.innerHTML = `<p class="ov-empty">❌ ${esc(err.message)}</p>`;
    }
    this.disabled = false;
  });
}
