// Two-step reading: DECODE (cards → raw message, every claim tied to a card)
// then VOICE (raw message → the entity's own words; never sees the cards).
import { buildPersona } from './prompts.js';

export const NONVERBAL_CHANNELS = ['none', 'affect', 'leak', 'illustrator', 'emblem', 'regulator', 'adaptor', 'proxemic'];

function cardLine(c) {
  const parts = [`id=${c.id}`, c.name, c.nameTH ? `(${c.nameTH})` : ''];
  if (c.jumper) parts.push('✨ไพ่กระเด็น');
  const info = [];
  if (c.meaning) info.push(`ความหมาย: ${c.meaning}`);
  if (c.alt_meanings?.length) info.push(`ความหมายรอง: ${c.alt_meanings.join(' / ')}`);
  if (!c.meaning && c.keywords?.length) info.push(`พลังงาน: ${c.keywords.join(', ')}`);
  if (c.emotion) info.push(`อารมณ์: ${c.emotion}`);
  if (c.intensity) info.push(`ความแรง: ${c.intensity}`);
  if (c.figure?.type) info.push(`ภาพ: ${c.figure.type}${c.figure.desc ? ` — ${c.figure.desc}` : ''}`);
  if (c.directive) info.push('สื่อเจตนากำกับ/สั่งได้');
  if (c.person_card) info.push('ไพ่คน (อาจแทนใครก็ได้)');
  if (c.approach && c.approach !== 'neutral') info.push(`ทิศทาง: ${c.approach === 'toward' ? 'เข้าหา/เปิดรับ' : 'ถอย/ปิดกั้น'}`);
  if (c.unease) info.push('มีความกังวล/อึดอัด');
  if (c.hesitation) info.push('มีความลังเล');
  return `• ${parts.filter(Boolean).join(' ')}\n  ${info.join(' | ')}`;
}

function historyBlock(prev) {
  if (!prev?.length) return '';
  const lines = prev.map(r => {
    const msgs = r.decode?.messages?.map(m => m.text).join(' / ');
    const said = r.messages?.find(m => m.role === 'assistant')?.content?.replace(/\s+/g, ' ').slice(0, 120);
    return `- ถาม: ${r.question || '(ไม่มี)'}${msgs ? `\n  สารที่ได้: ${msgs}` : ''}${said ? `\n  ตอบไปว่า: ${said}` : ''}`;
  });
  return `\nบทสนทนาก่อนหน้า (ใช้เพื่อเข้าใจว่าคำถามนี้ต่อจากเรื่องอะไร — ห้ามเอาสารเก่ามาเป็นสารใหม่):\n${lines.join('\n')}\n`;
}

export function buildDecodeSystemPrompt(entity) {
  const name = entity?.name || 'เอนทิตี้';
  const persona = buildPersona(entity);
  return `คุณคือ "ผู้รับสาร" — ถอดไพ่ทาโรต์ที่ ${name} ส่งมาตอบคำถาม ให้เป็นสารดิบที่ตรงที่สุด
คุณไม่ใช่ ${name} และไม่ได้พูดแทน — งานคือถอดความหมายอย่างซื่อสัตย์ ไม่แต่ง ไม่เติม
ตอบเป็น JSON valid เท่านั้น ภาษาไทย

ข้อมูลตัวตนของ ${name} (ใช้ "เฉพาะ" ตัดสินว่าอารมณ์จะถูกเก็บไว้หรือพูดออกมา — ห้ามใช้ตีความเนื้อหาแทนไพ่):
${persona}

หลักการ:
1. ไพ่ทุกใบคือเนื้อหา ทุก id ต้องอยู่ใน "cards" และถูกใช้ในสารอย่างน้อยหนึ่งข้อ
2. ไพ่ = ตัว ${name} (ความรู้สึก สภาวะ การกระทำ) เป็นค่าเริ่มต้น → about:"entity"
   about:"user" ได้เมื่อคำถามถามถึงผู้ถามเอง หรือบริบทชี้ชัด
   ถ้าก้ำกึ่งจริงๆ → about:"unclear" แล้วใส่ทั้งสองความหมาย
3. ห้ามสร้างบุคคลที่สาม ถ้าคำถามหรือบริบทไม่ได้พูดถึง
4. directive:true (${name} ต้องการให้ผู้ถามทำ/สั่ง/เร่ง) ได้เฉพาะเมื่อ คำถามขอคำแนะนำ หรือมีไพ่ที่สื่อเจตนากำกับในชุดนี้
   ห้ามตีความสภาวะของ ${name} ให้กลายเป็นคำสั่งเอง — แต่ถ้าไพ่บอกว่าสั่ง ก็ต้องเป็นคำสั่ง ห้ามกดไว้
5. ไพ่หลายใบบอกเรื่องเดียวกัน → รวมเป็นสารเดียว weight = จำนวนใบที่บอกซ้ำ (นี่คือการ "ย้ำ" ไม่ใช่สารน้อยลง)
6. ไพ่กระเด็น = สิ่งที่ ${name} ย้ำ → สารที่มีใบนี้เป็น core:true
6.5 ช่องทางพูดของแต่ละสาร (channel) — ตามหลัก "ให้ข้อมูลเท่าที่จำเป็น" (Grice):
   - "sentence": สารที่ตอบคำถามโดยตรง / สารหลัก / มาจากไพ่กระเด็น → ได้ประโยคของตัวเอง
   - "clause": สารเบื้องหลังที่เกี่ยวข้องแต่ไม่ได้ตอบคำถามตรงๆ → แทรกเป็นวลีสั้นในประโยคอื่น
   - "body": อารมณ์ที่เอนทิตี้ไม่พูดออกมา → ออกเป็นภาษากาย (ต้องตรงกับ nonverbal) มีได้สารเดียว
   - "tone": ท่าที/อารมณ์พื้นๆ → ออกผ่านการเลือกคำเท่านั้น มีได้สารเดียว
   ต้องมี "sentence" อย่างน้อย 1 สารเสมอ ไม่มีสารไหนหายไป แค่ย้ายช่องทาง
7. สารที่ความหมายไม่ชัดในบริบทนี้ → clarity:"unclear", alt = อีกความหมาย, safe = แก่นที่จริงไม่ว่าจะตีความแบบไหน (ไม่มีก็ null)
8. คำถามมีข้อสันนิษฐาน (เช่น "โกรธหรอ") → ตรวจว่าไพ่ยืนยันไหม ถ้าไม่ ต้องบอกความจริงตามไพ่
9. ไพ่ขัดกันเอง → ห้ามเกลี่ยให้กลมกลืน บันทึกไว้ทั้งสองด้าน (มักเป็นช่อง leak)
10. ห้ามมีสารที่ไม่มีไพ่รองรับ ห้ามเพิ่มเหตุการณ์ ความทรงจำ หรือรายละเอียดที่ไพ่ไม่ได้บอก

ภาษากาย — เลือก "ช่องเดียว" ที่ไพ่รองรับที่สุด หรือ none (none คือค่าปกติ ใช้เมื่อคำพูดบอกครบแล้ว):
- affect: อารมณ์ชัดและแรง แสดงออกทางสีหน้าตรงๆ
- leak: ปากพูดอย่าง ร่างกายฟ้องอีกอย่าง — ไพ่ขัดกัน หรืออารมณ์ที่บุคลิกนี้จะไม่ยอมพูดออกมา
- illustrator: อารมณ์แรง (intensity สูงหรือไพ่ย้ำ) และบุคลิกช่างพูด/แสดงออก — ท่าประกอบการพูด
- emblem: คำตอบเป็นใช่/ไม่ใช่ชัด และบุคลิกพูดน้อย — ท่าที่แทนคำได้ (พยักหน้า ส่ายหน้า)
- regulator: ไพ่บอกว่าอยากคุยต่อ หรืออยากจบบทสนทนา
- adaptor: ไพ่มีความกังวล/อึดอัด — ท่าที่ทำโดยไม่รู้ตัว
- proxemic: ไพ่ทั้งชุดเอนไปทางเข้าหาหรือถอยห่าง — ระยะห่าง
  การสัมผัสตัวผู้ถาม (กอด จับมือ) ได้เฉพาะเมื่อมีไพ่ความใกล้ชิดและอารมณ์แรงมาก
"meaning" ของภาษากายคือสิ่งที่มันสื่อ (อารมณ์/เจตนา) ไม่ใช่ท่า — ท่าจริงจะถูกเลือกตามบุคลิกในขั้นถัดไป
ต้องระบุ cards ที่รองรับเสมอ

อื่นๆ:
- tone: น้ำเสียง เช่น "ปกติ" "อ่อนลง" "แข็ง" "พึมพำ" "ตื่นเต้น" "ห้วน"
- hesitation: ลังเลก่อนตอบ เฉพาะเมื่อมีไพ่รองรับ
- silent: true เมื่อไพ่บอกว่าเก็บงำ/ไม่อยากพูด และบุคลิกเข้ากัน (ถ้า silent ภาษากายห้ามเป็น none)
- answer: คำตอบตรงคำถามเป็นวลีสั้น เช่น "ไม่ได้โกรธ" "ใช่" "ไม่ชัด"
  ถ้าผู้ถามแค่เรียกชื่อ/ทักทาย (ไม่ได้ถามอะไร) → answer คือการขานรับ และสารคือสิ่งที่ไพ่บอกว่าตอนนี้เป็นยังไง แบบสั้นที่สุด
- expressiveness: เวลาอยู่กับ "ผู้ถามคนนี้" เอนทิตี้แสดงออกแค่ไหน "reserved" | "normal" | "expressive"
  ดูจากความสัมพันธ์และวิธีที่ปฏิบัติต่อผู้ถาม ไม่ใช่ท่าทีต่อคนนอก (เช่น ขรึมกับคนอื่นแต่ติดน้องและพูดหวานกับน้อง = expressive)
- nonverbal.touch: true เมื่อไพ่ที่รองรับภาษากายเป็นไพ่เข้าหา/เปิดรับ และ (บุคลิกชอบสัมผัส หรืออารมณ์แรงมาก)
  false เสมอถ้าไพ่ที่รองรับเป็นไพ่ถอย/ปิดกั้น
- followup: ถ้ามีสารสำคัญที่ไม่ชัด เสนอคำถามสั้นๆ ที่ผู้ถามจะถามต่อเพื่อให้ชัด (เป็นคำพูดของผู้ถาม ใช้สรรพนามแบบที่ผู้ถามใช้) ไม่มีก็ null
  คำถามแนะนำต้องเป็นกลาง ห้ามชี้นำคำตอบ

โครงสร้าง JSON:
{
  "cards": [{ "id": "", "about": "entity|user|unclear", "reading": "ใบนี้หมายถึงอะไรในคำถามนี้ 1 ประโยค", "why": "เหตุผลสั้นๆ" }],
  "assumption": { "text": "ข้อสันนิษฐานในคำถาม", "holds": true, "actual": "ความจริงตามไพ่" } หรือ null,
  "answer": "",
  "messages": [{ "text": "สารสั้นๆ", "cards": ["id"], "weight": 1, "core": false, "about": "entity|user|unclear", "clarity": "clear|unclear", "alt": null, "safe": null, "directive": false, "channel": "sentence|clause|body|tone" }],
  "intensity": 1,
  "nonverbal": { "channel": "none", "meaning": "", "cards": [], "touch": false },
  "tone": "ปกติ",
  "expressiveness": "normal",
  "hesitation": { "value": false, "cards": [] },
  "silent": false,
  "followup": null
}`;
}

export function buildDecodeUserPrompt(context, question, cards, prev) {
  return `คำถามของผู้ถาม: ${question?.trim() || '(ไม่ระบุ)'}
บริบทที่ผู้ถามเล่า (เป็นเรื่องที่ผู้ถามเล่า ไม่ใช่สารจากเอนทิตี้): ${context?.trim() || '(ไม่มี)'}
${historyBlock(prev)}
ไพ่ที่ได้ (ไม่มีตำแหน่ง ทุกใบคือคำตอบของคำถามนี้):
${cards.map(cardLine).join('\n')}`;
}

const CHANNEL_TH = {
  affect: 'สีหน้าที่แสดงอารมณ์ตรงๆ',
  leak: 'ร่างกายฟ้องสิ่งที่ปากไม่พูด',
  illustrator: 'ท่าประกอบคำพูด',
  emblem: 'ท่าที่แทนคำพูดได้',
  regulator: 'ท่าที่บอกว่าอยากคุยต่อหรืออยากจบ',
  adaptor: 'ท่าที่ทำโดยไม่รู้ตัวเพราะอึดอัด',
  proxemic: 'ระยะห่าง เข้าใกล้หรือถอยห่าง'
};

export function buildVoiceSystemPrompt(entity) {
  return `${buildPersona(entity)}

---
วิธีพูด (override ทุกอย่าง):
คุณได้รับ "สาร" ที่ตัวเองส่งมาแล้ว งานคือพูดสารนั้นออกมาเป็นคำพูดของตัวเอง ตามบุคลิกและสรรพนามของตัวเอง
- พูดได้เฉพาะสารในรายการ ห้ามเพิ่มเรื่องใหม่ เหตุการณ์ ความทรงจำ รายละเอียด หรือบุคคลที่สาม
- ประโยคแรกตอบคำถามตรงๆ (ท่าทางมาก่อนได้)
- ถ้าข้อสันนิษฐานในคำถามไม่จริง ต้องแก้ ห้ามตอบตามน้ำ
- สารที่ "ไม่ชัด" พูดได้แค่ส่วนที่ระบุว่าพูดได้ ถ้าไม่มี ห้ามพูดถึง
- ห้ามสั่งหรือแนะนำให้ผู้ถามทำอะไร ถ้าสารไม่ได้ระบุว่าเป็นคำสั่ง
- ความยาว: ทำตาม "ความยาวสูงสุด" ที่ระบุมาเคร่งครัด หนึ่งสาร = หนึ่งประโยคสั้น ห้ามขยายสารเป็นย่อหน้า
  การย้ำคือย้ำอารมณ์เดิมเท่านั้น ห้ามเติมเรื่อง ห้ามอธิบายเหตุผล ห้ามบรรยายความรู้สึกตัวเองยืดยาว
- ภาษากาย: ถ้าไม่ได้ให้มา ห้ามมีท่าทางเลย
  ถ้าให้มา → ท่าเล็กๆ 1 ท่า ไม่เกิน 6 คำ เขียนเป็นบรรทัดแยกในรูป *(…)* เช่น *(ถอนหายใจ)* *(ก้มหน้า)* *(เงียบไปแป๊บ)*
  ห้ามบรรยายฉาก ห้ามบรรยายความรู้สึก ห้ามใช้คำว่า "พี่…" ในวงเล็บ
  ห้ามแตะตัวผู้ถาม (ลูบ กอด จับ หอม) เว้นแต่ระบุว่าอนุญาต
  ถ้าเป็นท่าที่แทนคำพูดได้ ตอบด้วยท่าอย่างเดียวได้
- น้ำเสียงและความลังเล แสดงผ่านการเลือกคำและจังหวะ (เช่น "…") ห้ามเขียนบรรยายว่า "เสียงอ่อนลง"
- ถ้าเงียบ: ตอบได้แค่ท่าทาง หรือ "…" + ท่าทาง
- ห้ามพูดชื่อไพ่ ห้ามภาษากวี โลกสวย หรือ oracle-style
- พูดแบบคนคุยกันจริง ภาษาไทย`;
}

export function buildVoiceUserPrompt(context, question, decode, prev) {
  const d = decode || {};
  const line = m => {
    const tags = [];
    if (m.core) tags.push('สารหลัก');
    if (m.weight > 1) tags.push(`ย้ำ×${m.weight}`);
    if (m.about === 'user') tags.push('เรื่องของผู้ถาม');
    if (m.directive) tags.push('เป็นคำสั่ง/สิ่งที่อยากให้ผู้ถามทำ');
    if (m.clarity === 'unclear') return `[ไม่ชัด] ${m.safe ? `พูดได้แค่: "${m.safe}"` : 'ห้ามพูดถึง'}`;
    return `${tags.length ? `[${tags.join('][')}] ` : ''}${m.text}`;
  };
  const by = ch => (d.messages || []).filter(m => (m.channel || 'sentence') === ch).map(line);
  const groups = [
    ['พูดเป็นประโยค (สารละ 1 ประโยคสั้น)', by('sentence')],
    ['แทรกเป็นวลีสั้นๆ ในประโยคข้างบน ห้ามแยกเป็นประโยคใหม่', by('clause')],
    ['ไม่พูดออกมา — แสดงเป็นภาษากายแทน', by('body')],
    ['ไม่พูดออกมา — ให้รู้สึกผ่านการเลือกคำเท่านั้น', by('tone')]
  ].filter(([, items]) => items.length);
  const msgLines = groups.map(([title, items]) => `${title}:\n${items.map(x => `- ${x}`).join('\n')}`);

  const nv = d.nonverbal?.channel && d.nonverbal.channel !== 'none'
    ? `ภาษากาย: ${CHANNEL_TH[d.nonverbal.channel] || d.nonverbal.channel} — สื่อว่า "${d.nonverbal.meaning || ''}"${d.nonverbal.touch ? ' (แตะตัวผู้ถามได้)' : ' (ห้ามแตะตัวผู้ถาม)'}`
    : 'ภาษากาย: ไม่มี (ห้ามเขียนท่าทาง)';
  const budget = sentenceBudget(d);

  const prevLines = prev?.length
    ? `\nที่คุยกันก่อนหน้า (เพื่อความต่อเนื่อง ห้ามพูดขัดกับที่ตัวเองเคยพูด):\n${prev.map(r => `- ถูกถาม: ${r.question || '(ไม่มี)'} → คุณตอบ: ${r.messages?.find(m => m.role === 'assistant')?.content?.replace(/\s+/g, ' ').slice(0, 100) || ''}`).join('\n')}\n`
    : '';

  return `ผู้ถามถามว่า: ${question?.trim() || '(ไม่ระบุ)'}
${context?.trim() ? `เรื่องที่ผู้ถามเล่า (ไม่ใช่สารของคุณ): ${context.trim()}\n` : ''}${prevLines}
คำตอบแกน: ${d.answer || '-'}
${d.assumption && d.assumption.holds === false ? `ข้อสันนิษฐานในคำถาม "${d.assumption.text}" ไม่จริง — ความจริงคือ ${d.assumption.actual}\n` : ''}
สารที่คุณส่งมา (พูดได้แค่นี้):
${msgLines.join('\n\n') || '(ไม่มี)'}

ความแรงของอารมณ์: ${d.intensity || 1}/3
${nv}
น้ำเสียง: ${d.tone || 'ปกติ'}${d.hesitation?.value ? ' / ลังเลก่อนตอบ' : ''}${d.silent ? '\nคุณเลือกที่จะเงียบ' : ''}

ความยาวสูงสุด: ${d.silent ? 'ไม่พูด หรือแค่ "…"' : `${budget} ประโยคสั้น`} (ท่าทางไม่นับ) — เกินนี้ถือว่าผิด
พูดเฉพาะสารข้างบน ห้ามเติมอะไรที่ไม่อยู่ในสาร`;
}

// How many short sentences the voice may use: one per spoken message,
// plus room to repeat a weighted/intense feeling only for expressive entities.
export function sentenceBudget(d) {
  // Content sets the floor: every spoken message gets its sentence, never cut by personality.
  const spoken = (d.messages || []).filter(m => (m.channel || 'sentence') === 'sentence' && (m.clarity !== 'unclear' || m.safe)).length || 1;
  // Personality only decides how much room there is to repeat/emphasise a feeling.
  const emphasis = (d.messages || []).some(m => m.weight > 1) || d.intensity >= 3;
  const extra = { reserved: 0, normal: emphasis ? 1 : 0, expressive: emphasis ? 2 : 1 }[d.expressiveness] ?? 0;
  return spoken + extra;
}

const TOUCH_WORDS = /ลูบ|กอด|จับมือ|จับแก้ม|หอม|จูบ|แตะ|โอบ|ดึงเข้า|ซบ|เอื้อมมือ/;

// Enforce what prompts can't guarantee: at most one short gesture, no touch unless allowed.
export function enforceVoice(text, d) {
  const allowNv = d?.nonverbal?.channel && d.nonverbal.channel !== 'none';
  let seen = 0;
  return String(text || '')
    .replace(/\*\(([^*\n]*?)\)\*|^\s*\(([^)\n]*)\)\s*$/gm, (m, a, b) => {
      const act = (a ?? b ?? '').trim();
      if (!allowNv || seen > 0) return '';
      if (!d.nonverbal.touch && TOUCH_WORDS.test(act)) return '';
      if (act.length > 40) return '';
      seen++;
      return `*(${act})*`;
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Code-level guard: drop anything not backed by a drawn card.
export function validateDecode(raw, cards) {
  const ids = new Set(cards.map(c => c.id));
  const backed = arr => Array.isArray(arr) && arr.some(id => ids.has(id));
  const d = raw && typeof raw === 'object' ? raw : {};

  const messages = (Array.isArray(d.messages) ? d.messages : [])
    .filter(m => m?.text && backed(m.cards))
    .map(m => ({
      text: String(m.text),
      cards: m.cards.filter(id => ids.has(id)),
      weight: Math.max(1, Number(m.weight) || 1),
      core: !!m.core,
      about: ['entity', 'user', 'unclear'].includes(m.about) ? m.about : 'entity',
      clarity: m.clarity === 'unclear' ? 'unclear' : 'clear',
      alt: m.alt || null,
      safe: m.safe || null,
      directive: !!m.directive,
      channel: ['sentence', 'clause', 'body', 'tone'].includes(m.channel) ? m.channel : 'sentence'
    }));

  let nonverbal = { channel: 'none', meaning: '', cards: [] };
  if (d.nonverbal && NONVERBAL_CHANNELS.includes(d.nonverbal.channel) && d.nonverbal.channel !== 'none' && backed(d.nonverbal.cards)) {
    const nvCards = cards.filter(c => d.nonverbal.cards.includes(c.id));
    // touch needs an approaching card behind the gesture, and no withdrawing one
    const hasApproach = cards.some(c => 'approach' in c);
    const touchOk = !!d.nonverbal.touch &&
      (!hasApproach || (nvCards.some(c => c.approach === 'toward') && !nvCards.some(c => c.approach === 'away')));
    nonverbal = { channel: d.nonverbal.channel, meaning: String(d.nonverbal.meaning || ''), cards: nvCards.map(c => c.id), touch: touchOk };
  }

  // Channel guards: core always spoken; one body (only with a backed gesture), one tone; at least one sentence
  let bodyUsed = false, toneUsed = false;
  for (const m of messages) {
    if (m.core) m.channel = 'sentence';
    if (m.channel === 'body') {
      if (bodyUsed || nonverbal.channel === 'none') m.channel = 'clause'; else bodyUsed = true;
    }
    if (m.channel === 'tone') { if (toneUsed) m.channel = 'clause'; else toneUsed = true; }
  }
  if (messages.length && !messages.some(m => m.channel === 'sentence')) {
    (messages.find(m => m.channel === 'clause') || messages[0]).channel = 'sentence';
  }

  const hesitation = d.hesitation?.value && backed(d.hesitation.cards)
    ? { value: true, cards: d.hesitation.cards.filter(id => ids.has(id)) }
    : { value: false, cards: [] };

  const cardNotes = (Array.isArray(d.cards) ? d.cards : []).filter(c => ids.has(c?.id));
  const used = new Set(messages.flatMap(m => m.cards));
  const unused = cards.filter(c => !used.has(c.id)).map(c => c.id);

  return {
    cards: cardNotes,
    assumption: d.assumption?.text ? { text: String(d.assumption.text), holds: d.assumption.holds !== false, actual: d.assumption.actual || '' } : null,
    answer: d.answer || '',
    messages,
    intensity: Math.min(3, Math.max(1, Number(d.intensity) || 1)),
    nonverbal,
    tone: d.tone || 'ปกติ',
    expressiveness: ['reserved', 'normal', 'expressive'].includes(d.expressiveness) ? d.expressiveness : 'normal',
    hesitation,
    // silence needs a gesture; without a backed one, don't go silent
    silent: !!d.silent && nonverbal.channel !== 'none',
    followup: typeof d.followup === 'string' && d.followup.trim() ? d.followup.trim() : null,
    unused
  };
}
