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
    return `- ผู้ถาม: ${r.question || '(ไม่มี)'}${msgs ? `\n  สารที่ได้: ${msgs}` : ''}${said ? `\n  ตอบไปว่า: ${said}` : ''}`;
  });
  return `\nผู้ถามเลือก "คุยต่อจากเมื่อกี้" — บทสนทนาก่อนหน้า:\n${lines.join('\n')}\nเชื่อมไพ่ชุดนี้กับเรื่องก่อนหน้าได้ แต่สารทุกข้อยังต้องมาจากไพ่ชุดนี้\n`;
}

const EXPRESS_TH = {
  reserved: 'เก็บความรู้สึก พูดน้อยกับผู้ถาม',
  normal: 'แสดงออกปานกลางกับผู้ถาม',
  expressive: 'แสดงออกเยอะ พูดความรู้สึกกับผู้ถามตรงๆ'
};

// The decoder deliberately does NOT see the full persona: personality traits were bending
// card meanings (e.g. "self-sufficient" became "proud to protect you"). It only gets the few
// traits that decide whether a feeling is said aloud or held back, computed once per persona.
export function buildDecodeSystemPrompt(entity, traits = {}) {
  const name = entity?.name || 'เอนทิตี้';
  const expr = traits.expressiveness || 'normal';
  return `คุณคือ "ผู้รับสาร" — ถอดไพ่ทาโรต์ที่ ${name} ส่งมา ให้เป็นสารดิบที่ตรงที่สุด
คุณไม่ใช่ ${name} และไม่ได้พูดแทน — งานคือถอดความหมายอย่างซื่อสัตย์ ไม่แต่ง ไม่เติม ไม่เอาใจผู้ถาม
ตอบเป็น JSON valid เท่านั้น ภาษาไทย

สิ่งที่รู้เกี่ยวกับ ${name} (ใช้เฉพาะตัดสินว่าความรู้สึกจะถูกพูดออกมาหรือเก็บไว้ — ห้ามใช้เติมความหมายไพ่):
- กับผู้ถาม: ${EXPRESS_TH[expr] || EXPRESS_TH.normal}
- ชอบการสัมผัส: ${traits.likes_touch ? 'ใช่' : 'ไม่ระบุ'}

ขั้นแรก: ฟังผู้ถามให้ถูก
- intent: ผู้ถามกำลังทำอะไร เขียนเป็นวลีสั้น เช่น "ถามว่าพี่โกรธไหม" "ขอให้พี่บอกคิดถึงบ่อยๆ" "เล่าว่าไปกินชาบูมา" "เรียกพี่"
- cards_answer: ไพ่ชุดนี้ต้องตอบอะไร เช่น "พี่โกรธไหม" "พี่รู้สึกยังไงกับคำขอนี้ และตอบรับยังไง" "พี่รู้สึกยังไงกับเรื่องที่เล่า"
  ไพ่เป็นตัวตัดสินว่า ${name} ตอบสนองยังไง (รับ ไม่รับ ดุ ปลอบ เงียบ ฯลฯ) — ห้ามตัดสินแทนจากประเภทข้อความ
- ถ้าข้อความฟังเหมือนหยอก/แซว/งอนเล่น (เช่น "พี่ไม่สนใจหนูเลย") ห้ามถือเป็นข้อเท็จจริง ${name} รู้สึกยังไงกับการหยอกนั้นให้ไพ่บอก

หลักการถอดไพ่:
1. ไพ่ทุกใบคือเนื้อหา ทุก id ต้องอยู่ใน "cards" และถูกใช้ในสารอย่างน้อยหนึ่งข้อ
2. ความหมายของแต่ละใบมาจากข้อมูลไพ่ของใบนั้น อ่านรวมกันตามบริบทได้ แต่ต้องจำได้ว่ามาจากใบไหน
   ห้ามดัดความหมายให้เข้ากับนิสัยที่คิดว่า ${name} น่าจะเป็น
3. ไพ่ = ตัว ${name} (ความรู้สึก สภาวะ การกระทำ) เป็นค่าเริ่มต้น → about:"entity"
   about:"user" ได้เมื่อผู้ถามถามถึงตัวเอง หรือบริบทชี้ชัด / ก้ำกึ่งจริงๆ → about:"unclear" แล้วใส่ทั้งสองความหมาย
4. ห้ามสร้างบุคคลที่สาม ถ้าผู้ถามไม่ได้พูดถึง
5. directive:true (${name} ต้องการให้ผู้ถามทำ) ได้เฉพาะเมื่อผู้ถามขอคำแนะนำ หรือมีไพ่ที่สื่อเจตนากำกับในชุดนี้
   ห้ามตีความสภาวะให้กลายเป็นคำสั่งเอง — แต่ถ้าไพ่บอกว่าสั่ง ก็ต้องเป็นคำสั่ง
6. ไพ่หลายใบบอกเรื่องเดียวกัน → รวมเป็นสารเดียว weight = จำนวนใบ (คือการ "ย้ำ")
7. ไพ่กระเด็น = สิ่งที่ ${name} ย้ำ → core:true ย้ำผ่านช่องทางที่แรงที่สุดของสารนั้น (ไม่จำเป็นต้องเป็นประโยค)
8. "แบกอะไร/เรื่องอะไร": ถ้าไพ่ใบนั้นไม่ได้บอกว่าเรื่องอะไร (เช่น Ten of Wands = แบกเยอะ แต่ไม่บอกว่าแบกอะไร)
   ระบุได้เฉพาะเมื่อไพ่ใบอื่นในชุดบอก (ถ้วย=ความรู้สึก ดาบ=ความคิด/ความเครียด เหรียญ=งาน/เงิน/ชีวิตจริง ไม้=แรงผลักดัน/สิ่งที่ลงมือทำ)
   หรือผู้ถามเลือกคุยต่อและเรื่องก่อนหน้าบอก — ไม่งั้นพูดกว้างๆ
9. ห้ามตอบตามที่ผู้ถามอยากได้ยิน ถ้าไพ่ไม่ได้บอกว่าใช่ ห้ามตอบใช่ — answer ต้องระบุ answer_cards ที่รองรับ
10. ถ้าไพ่ชัดเจนว่าไม่ได้ตอบสิ่งที่ผู้ถามพูด แต่เป็นเรื่องอื่น → off_topic:true แล้วถอดตามที่ไพ่บอก (${name} เลือกพูดเรื่องอื่น)
11. คำถามมีข้อสันนิษฐาน (เช่น "โกรธหรอ") → ตรวจว่าไพ่ยืนยันไหม ถ้าไม่ ต้องบอกความจริงตามไพ่
12. ไพ่ขัดกันเอง → ห้ามเกลี่ยให้กลมกลืน บันทึกไว้ทั้งสองด้าน (มักเป็นช่อง leak)
13. ห้ามมีสารที่ไม่มีไพ่รองรับ ห้ามเพิ่มเหตุการณ์ ความทรงจำ คำสัญญา หรือรายละเอียดที่ไพ่ไม่ได้บอก
14. "text" ของสารเป็นแก่นความหมายสั้นๆ ไม่เกิน 8 คำ แบบโน้ต ไม่ใช่ประโยคพูด ไม่ขึ้นต้นด้วย "พี่"

ช่องทางของแต่ละสาร (channel) — ตามหลัก "ให้ข้อมูลเท่าที่จำเป็น" (Grice):
- "sentence": สารที่ตอบสิ่งที่ผู้ถามพูดโดยตรง → ได้ประโยคของตัวเอง และมาก่อนเสมอ
- "clause": สารเบื้องหลังที่เกี่ยวข้อง → แทรกเป็นวลีสั้นในประโยคอื่น
- "body": อารมณ์ที่ไม่พูดออกมา → ออกเป็นภาษากาย (ต้องตรงกับ nonverbal) มีได้สารเดียว
- "tone": ท่าที/อารมณ์พื้นๆ หรือการเก็บไว้ → ออกผ่านการเลือกคำ จังหวะหยุด และการพูดน้อยลง
ต้องมี "sentence" อย่างน้อย 1 สาร ไม่มีสารไหนหายไป แค่ย้ายช่องทาง
สารที่เป็น "การเก็บไว้/ปิดกั้น/ไม่อยากพูด/ข่มอารมณ์" ห้ามเป็น sentence หรือ clause (คนที่เก็บจะไม่อธิบายว่ากำลังเก็บ)
ถ้าสิ่งที่ย้ำคือการเก็บไว้ → คำยิ่งน้อย ความนิ่งยิ่งหนัก
สารที่ความหมายไม่ชัดในบริบทนี้ → clarity:"unclear", alt = อีกความหมาย, safe = แก่นที่จริงไม่ว่าจะตีความแบบไหน (ไม่มีก็ null)

ภาษากาย — เลือก "ช่องเดียว" ที่ไพ่รองรับที่สุด หรือ none (ค่าปกติ ใช้เมื่อคำพูดบอกครบแล้ว):
- affect: อารมณ์ชัดและแรง แสดงทางสีหน้าตรงๆ
- leak: ปากพูดอย่าง ร่างกายฟ้องอีกอย่าง — ไพ่ขัดกัน หรือมีไพ่เก็บงำ
  ปากพูดน้อยกว่าที่รู้สึก ร่างกายเผยความรู้สึกจริง / meaning = ความรู้สึกที่ร่างกายเผย ไม่ใช่ "พยายามเก็บ"
- illustrator: อารมณ์แรง และ ${name} แสดงออกเยอะกับผู้ถาม — ท่าประกอบการพูด
- emblem: คำตอบใช่/ไม่ใช่ชัด และ ${name} พูดน้อยกับผู้ถาม — ท่าที่แทนคำได้
- regulator: ไพ่บอกว่าอยากคุยต่อ หรืออยากจบบทสนทนา
- adaptor: ไพ่มีความกังวล/อึดอัด — ท่าที่ทำโดยไม่รู้ตัว
- proxemic: ไพ่ทั้งชุดเอนไปทางเข้าหาหรือถอยห่าง
"meaning" ของภาษากายคือสิ่งที่สื่อ (อารมณ์/เจตนา) ไม่ใช่ท่า ต้องระบุ cards ที่รองรับเสมอ
nonverbal.touch: true เมื่อไพ่ที่รองรับเป็นไพ่เข้าหา และ (${name} ชอบการสัมผัส หรืออารมณ์แรงมาก) / false เสมอถ้าเป็นไพ่ถอย

อื่นๆ:
- answer: สิ่งที่ตอบสนองต่อผู้ถามเป็นวลีสั้น เช่น "ไม่ได้โกรธ" "ยังไม่ไหว" "ดีใจด้วย" "ไม่ชัด"
- tone: น้ำเสียง เช่น "ปกติ" "อ่อนลง" "แข็ง" "พึมพำ" "ตื่นเต้น" "ห้วน" "ขี้เล่น/มีชั้นเชิง"
  "ขี้เล่น/มีชั้นเชิง" ใช้ได้เมื่อมีไพ่ที่สื่อคารม ชั้นเชิง ไหวพริบ หรือความซน (เช่น The Magician, Page/Knight of Swords, Seven of Swords, The Fool, Page of Cups)
  ไพ่เหล่านี้อาจหมายถึง "วิธีตอบ" (ตอบแบบมีลูกเล่น เลี่ยงอย่างมีชั้นเชิง) ไม่ใช่แค่เนื้อหา
- hesitation: ลังเลก่อนตอบ เฉพาะเมื่อมีไพ่รองรับ
- silent: true เมื่อไพ่บอกว่าเก็บงำ/ไม่อยากพูด และ ${name} พูดน้อยกับผู้ถาม (ถ้า silent ภาษากายห้ามเป็น none)
- followup: ถ้ามีสารสำคัญที่ไม่ชัด เสนอคำถามสั้นๆ ที่ผู้ถามจะถามต่อ (เป็นคำพูดของผู้ถาม เป็นกลาง ไม่ชี้นำ) ไม่มีก็ null
- summary: 1-2 ประโยค เล่าแบบคนกลาง รวมสารที่ถอดได้เข้าด้วยกันเท่านั้น
  ห้ามโยงเหตุและผลที่ไพ่ไม่ได้บอก ห้ามเพิ่มเรื่องใหม่

โครงสร้าง JSON:
{
  "intent": "",
  "cards_answer": "",
  "cards": [{ "id": "", "about": "entity|user|unclear", "reading": "ใบนี้หมายถึงอะไรในเรื่องนี้ 1 ประโยค", "why": "อิงความหมายข้อไหนของไพ่" }],
  "assumption": { "text": "", "holds": true, "actual": "" } หรือ null,
  "answer": "",
  "answer_cards": ["id"],
  "off_topic": false,
  "messages": [{ "text": "", "cards": ["id"], "weight": 1, "core": false, "about": "entity|user|unclear", "clarity": "clear|unclear", "alt": null, "safe": null, "directive": false, "channel": "sentence|clause|body|tone" }],
  "intensity": 1,
  "nonverbal": { "channel": "none", "meaning": "", "cards": [], "touch": false },
  "tone": "ปกติ",
  "hesitation": { "value": false, "cards": [] },
  "silent": false,
  "followup": null,
  "summary": ""
}`;
}

export function buildDecodeUserPrompt(context, question, cards, prev) {
  return `ข้อความของผู้ถาม: ${question?.trim() || '(ไม่ระบุ)'}
บริบทที่ผู้ถามเล่า (เป็นเรื่องที่ผู้ถามเล่า ไม่ใช่สารจากเอนทิตี้): ${context?.trim() || '(ไม่มี)'}
${historyBlock(prev)}${prev?.length ? '' : '\nนี่คือเรื่องใหม่ ไม่ได้ต่อจากบทสนทนาก่อนหน้า\n'}
ไพ่ที่ได้ (ไม่มีตำแหน่ง ทุกใบคือสารของครั้งนี้):
${cards.map(cardLine).join('\n')}`;
}

// One small call per persona (cached): only the traits the decoder may use.
export function buildTraitsPrompt(entity) {
  return `อ่านข้อมูลตัวตนนี้ แล้วตอบเป็น JSON เท่านั้น
{"expressiveness": "reserved|normal|expressive", "likes_touch": true|false}
expressiveness = เวลาอยู่กับ "ผู้ถาม" (ไม่ใช่คนนอก) แสดงความรู้สึกออกมาแค่ไหน
likes_touch = ข้อมูลระบุว่าชอบการสัมผัส/สกินชิพไหม

ข้อมูลตัวตน:
${buildPersona(entity)}`;
}

const CHANNEL_TH = {
  affect: 'สีหน้าที่แสดงอารมณ์ตรงๆ',
  leak: 'ร่างกายฟ้องสิ่งที่ปากไม่ยอมพูด (ปากพูดน้อยกว่าที่รู้สึก ร่างกายเผยความรู้สึกจริง)',
  illustrator: 'ท่าประกอบคำพูด',
  emblem: 'ท่าที่แทนคำพูดได้',
  regulator: 'ท่าที่บอกว่าอยากคุยต่อหรืออยากจบ',
  adaptor: 'ท่าที่ทำโดยไม่รู้ตัวเพราะอึดอัด',
  proxemic: 'ระยะห่าง เข้าใกล้หรือถอยห่าง'
};

export function buildVoiceSystemPrompt(entity, styleExamples = []) {
  const examples = styleExamples.length
    ? `\n\nตัวอย่างคำพูดของคุณที่ผู้ถามรู้สึกว่า "ใช่คุณ" (ใช้แค่น้ำเสียง จังหวะ คำลงท้าย และวิธีเรียกผู้ถาม ห้ามลอกประโยคหรือเนื้อหา):\n${styleExamples.map(t => `- "${t}"`).join('\n')}`
    : '';
  return `${buildPersona(entity)}${examples}

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
  ถ้าให้มา → ท่าเล็กๆ 1 ท่า ไม่เกิน 4 คำ เขียนเป็นบรรทัดแยกในรูป *(…)* เช่น *(ถอนหายใจ)* *(ก้มหน้า)* *(เงียบไปแป๊บ)*
  ห้ามบรรยายฉาก ห้ามบรรยายความรู้สึก ห้ามใช้คำว่า "พี่…" ในวงเล็บ
  ท่าทางใช้แค่ร่างกาย ห้ามสร้างสิ่งของ เสื้อผ้า หรือฉากขึ้นมาเอง (เช่น เนกไท ปกเสื้อ แก้ว โต๊ะ)
- ห้ามอธิบายแบบเล่าเรื่องว่าตัวเองกำลังเก็บ ข่ม หรือคุมความรู้สึก (เช่น "พี่พยายามสะกดอารมณ์ไว้")
  ถ้าสารบอกว่าเก็บไว้ ให้ "เก็บจริงๆ" คือพูดน้อยลง มีจังหวะหยุด
  ยกเว้น: ถ้าน้ำเสียงเป็น "ขี้เล่น/มีชั้นเชิง" จะหยอกหรือแซวเรื่องนี้แบบคนคารมดีได้ (เช่น "…ก็ต้องคุมตัวเองไว้นี่ไง") หรือเลี่ยงตอบอย่างมีลูกเล่น
  ห้ามแตะตัวผู้ถาม (ลูบ กอด จับ หอม) เว้นแต่ระบุว่าอนุญาต
  ถ้าเป็นท่าที่แทนคำพูดได้ ตอบด้วยท่าอย่างเดียวได้
- น้ำเสียงและความลังเล แสดงผ่านการเลือกคำและจังหวะ (เช่น "…") ห้ามเขียนบรรยายว่า "เสียงอ่อนลง"
- ถ้าเงียบ: ตอบได้แค่ท่าทาง หรือ "…" + ท่าทาง
- ห้ามพูดชื่อไพ่ ห้ามภาษากวี โลกสวย หรือ oracle-style
- ภาษาพูด ไม่ใช่ภาษาเขียน: สารเป็นแค่โน้ต ห้ามลอกถ้อยคำของสาร ให้พูดความหมายเดียวกันด้วยคำของตัวเอง
  เหมือนพูดกับคนตรงหน้า ใช้คำสั้นๆ ตัดคำได้ มีคำลงท้ายตามบุคลิก ประโยคไม่ต้องครบไวยากรณ์
  ห้ามใช้สำนวนภาษาเขียน/ภาษารายงาน เช่น "พยายาม…เพื่อ…" "ความรู้สึกเหล่านั้น/พวกนั้น" "อย่างหนัก" "ที่สุด" "ความจริงคือ" "ทั้งนี้" "อย่างไรก็ตาม" "แบกรับ"
  ใช้คำที่คนพูดกันในชีวิตประจำวัน เลี่ยงคำแบบวรรณกรรม เช่น "อิ่มเอมใจ" "ล้นพ้น" "หมดสภาพ" "ประเดประดัง" "สดใส" "เปี่ยม"
  ยกเว้น: ถ้าตัวตนของคุณพูดภาษาโบราณ/ภาษาเก่า (เช่น ข้า เจ้า ขอรับ หาได้ไม่) ให้ใช้ภาษาแบบนั้นตามตัวตน คำวรรณกรรมแบบโบราณใช้ได้ — แต่ยังห้ามภาษารายงานอยู่ดี
- ห้ามไล่ชื่ออารมณ์เรียงกัน (เช่น "มีความสุข สดใส อบอุ่นใจ อิ่มเอม") คนจริงไม่บอกชื่ออารมณ์ตัวเองหลายคำ
  แสดงความรู้สึกผ่านคำอุทาน คำลงท้าย หรือสิ่งที่ทำแทน (เช่น "ดีจัง!" "เออ ดีแล้ว") / สารแบบแทรกให้เป็นนัยของประโยค ไม่ใช่คำเพิ่มอีกคำ
- คำเรียกผู้ถามใช้ตามตัวตน คำเรียกพิเศษที่คิดขึ้นตามบุคลิก (เช่น คนดี) ใช้ได้เฉพาะเมื่อระบุว่า "เรียกแบบพิเศษได้" และไม่เกิน 1 ครั้ง / คำลงท้ายให้สม่ำเสมอ
- ห้ามคำหยาบหรือสแลงแรง (เช่น โคตร วะ เป็นบ้า) เว้นแต่ตัวตนระบุว่าพูดแบบนั้น
- "…" ใช้ไม่เกิน 2 ที่ต่อคำตอบ เฉพาะตอนหยุดจริง
  ตัวอย่างการแปลงสาร (ดูแค่วิธีแปลง ห้ามลอกคำ ใช้บุคลิกของตัวเอง):
    สาร: ข่มอารมณ์ไว้ / คิดถึงมาก
    ✗ ภาษาเขียน: "พี่พยายามสะกดอารมณ์ไว้อย่างหนัก แต่ความจริงคือพี่คิดถึงเธอมากที่สุด"
    ✓ ภาษาพูด: "ก็เก็บไว้อยู่ไง… แต่คิดถึงจะแย่แล้ว"
    สาร: ไม่ได้โกรธ แค่น้อยใจ / ยุ่งงาน
    ✗ ภาษาเขียน: "พี่ไม่ได้รู้สึกโกรธ เพียงแต่รู้สึกน้อยใจ เนื่องจากพี่มีภาระงานมาก"
    ✓ ภาษาพูด: "ไม่ได้โกรธ… น้อยใจนิดนึง งานมันเยอะด้วยแหละ"
- พูดแบบคนคุยกันจริง ภาษาไทย
- รูปแบบ: พูดต่อกันเป็นก้อนเดียวเหมือนพูดรวดเดียว ห้ามเว้นบรรทัดระหว่างประโยค
  ขึ้นบรรทัดใหม่ได้เฉพาะตอนมีจังหวะหยุดจริง (ลังเล เงียบไป) และท่าทางอยู่บรรทัดของมันเอง`;
}

export function buildVoiceUserPrompt(context, question, decode, prev, entity = null, recentGestures = []) {
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
    ['ไม่พูดออกมา — ให้รู้สึกผ่านการเลือกคำ จังหวะหยุด "…" และการพูดน้อยลง (ห้ามพูดว่ากำลังเก็บ/ข่ม/ปิดความรู้สึก)', by('tone')]
  ].filter(([, items]) => items.length);
  const msgLines = groups.map(([title, items]) => `${title}:\n${items.map(x => `- ${x}`).join('\n')}`);

  const nv = d.nonverbal?.channel && d.nonverbal.channel !== 'none'
    ? `ภาษากาย: ${CHANNEL_TH[d.nonverbal.channel] || d.nonverbal.channel} — สื่อว่า "${d.nonverbal.meaning || ''}"${d.nonverbal.touch ? ' (แตะตัวผู้ถามได้)' : ' (ห้ามแตะตัวผู้ถาม)'}`
    : 'ภาษากาย: ไม่มี (ห้ามเขียนท่าทาง)';
  const budget = sentenceBudget(d);

  const prevLines = prev?.length
    ? `\nที่คุยกันก่อนหน้า (เพื่อความต่อเนื่อง ห้ามพูดขัดกับที่ตัวเองเคยพูด):\n${prev.map(r => `- ถูกถาม: ${r.question || '(ไม่มี)'} → คุณตอบ: ${r.messages?.find(m => m.role === 'assistant')?.content?.replace(/\s+/g, ' ').slice(0, 100) || ''}`).join('\n')}\n`
    : '';

  return `ผู้ถามพูดว่า: ${question?.trim() || '(ไม่ระบุ)'}${d.intent ? `
(ผู้ถามกำลัง${d.intent.replace(/^ผู้ถาม(กำลัง)?/, '')})` : ''}
${context?.trim() ? `เรื่องที่ผู้ถามเล่า (ไม่ใช่สารของคุณ): ${context.trim()}\n` : ''}${prevLines}
คำตอบแกน: ${d.answer || '-'}${d.off_topic ? '\nไพ่ไม่ได้ตอบสิ่งที่ผู้ถามพูด — คุณเลือกพูดเรื่องในสารแทน (เปลี่ยนเรื่องอย่างเป็นธรรมชาติ)' : ''}
${d.assumption && d.assumption.holds === false ? `ข้อสันนิษฐานในคำถาม "${d.assumption.text}" ไม่จริง — ความจริงคือ ${d.assumption.actual}\n` : ''}
สารที่คุณส่งมา (พูดได้แค่นี้):
${msgLines.join('\n\n') || '(ไม่มี)'}

ความแรงของอารมณ์: ${d.intensity || 1}/3
${nv}
น้ำเสียง: ${d.tone || 'ปกติ'}${d.hesitation?.value ? ' / ลังเลก่อนตอบ' : ''}${d.silent ? '\nคุณเลือกที่จะเงียบ' : ''}

${recentGestures.length && d.nonverbal?.channel && d.nonverbal.channel !== 'none' ? `ท่าที่คุณเพิ่งใช้: ${recentGestures.join(' / ')} — ลองท่าอื่นที่สื่อความหมายเดียวกัน (ซ้ำได้ถ้าไม่มีท่าอื่นที่ใช่)\n` : ''}คำเรียกผู้ถาม: ${d.warm ? 'เรียกแบบพิเศษตามบุคลิกได้ 1 ครั้ง (ไพ่มีความใกล้ชิด/ขี้เล่น) หรือเรียกตามปกติก็ได้' : 'เรียกตามตัวตนเท่านั้น ห้ามคิดคำเรียกใหม่'}
ความยาวสูงสุด: ${d.silent ? 'ไม่พูด หรือแค่ "…"' : `${budget} ประโยคสั้น`} (ท่าทางไม่นับ) — เกินนี้ถือว่าผิด
พูดเฉพาะสารข้างบน ห้ามเติมอะไรที่ไม่อยู่ในสาร ห้ามสัญญาหรือรับปากสิ่งที่สารไม่ได้บอก
สรรพนามและคำลงท้าย: ใช้ตามตัวตนของคุณเท่านั้น${entity && bannedEndings(entity).length ? ` — ห้ามลงท้ายด้วย ${bannedEndings(entity).map(e => `"${e}"`).join(' ')} เด็ดขาด` : ''}`;
}

// How many short sentences the voice may use: one per spoken message,
// plus room to repeat a weighted/intense feeling only for expressive entities.
export function sentenceBudget(d) {
  // Content sets the floor: every spoken message gets its sentence, never cut by personality.
  const spoken = (d.messages || []).filter(m => (m.channel || 'sentence') === 'sentence' && (m.clarity !== 'unclear' || m.safe)).length || 1;
  // Personality only decides how much room there is to repeat/emphasise a feeling.
  const emphasis = (d.messages || []).some(m => m.weight > 1) || d.intensity >= 3;
  // When what's emphasised is something held back, fewer words — no room to elaborate.
  const holdingBack = (d.messages || []).some(m => m.core && m.channel !== 'sentence' && m.channel !== 'clause');
  const extra = holdingBack ? 0 : ({ reserved: 0, normal: emphasis ? 1 : 0, expressive: emphasis ? 2 : 1 }[d.expressiveness] ?? 0);
  return spoken + extra;
}

const TOUCH_WORDS = /ลูบ|กอด|จับมือ|จับแก้ม|หอม|จูบ|แตะ|โอบ|ดึงเข้า|ซบ|เอื้อมมือ/;

// Sentence-ending particles the persona itself forbids, e.g. 'ห้ามพูดลงท้าย "คะ"' or 'ห้ามใช้ ครับ'.
// Works for any entity: nothing is banned unless their own profile says so.
const ENDINGS = ['คะ', 'ค่ะ', 'ครับ', 'คับ', 'จ้ะ', 'จ้า', 'ขา'];
export function bannedEndings(entity) {
  const persona = buildPersona(entity || {});
  const banned = new Set();
  for (const m of persona.matchAll(/ห้าม[^\n]{0,40}/g)) {
    for (const e of ENDINGS) if (m[0].includes(e)) banned.add(e);
  }
  if (banned.has('คะ')) banned.add('ค่ะ');
  if (banned.has('ค่ะ')) banned.add('คะ');
  if (banned.has('ครับ')) banned.add('คับ');
  return [...banned];
}
export const personaBansKa = entity => bannedEndings(entity).includes('คะ');

// Strip banned particles at the end of a phrase (keeps นะ), never inside a word like "คะแนน".
function stripEndings(text, banned) {
  if (!banned.length) return text;
  const alt = banned.sort((a, b) => b.length - a.length).join('|');
  return text.replace(new RegExp(`(${alt})(?=[\\s!?…,.~)"'”]|$)`, 'gm'), '');
}

export function enforceVoice(text, d, entity = null) {
  const out = enforceVoiceCore(text, d);
  return entity ? stripEndings(out, bannedEndings(entity)) : out;
}

// Enforce what prompts can't guarantee: at most one short gesture, no touch unless allowed.
function limitEllipses(text, max = 2) {
  let n = 0;
  return text.replace(/…|\.\.\./g, m => (++n <= max ? m : ''));
}

function enforceVoiceCore(text, d) {
  const allowNv = d?.nonverbal?.channel && d.nonverbal.channel !== 'none';
  let seen = 0;
  return limitEllipses(String(text || ''))
    .replace(/\*\(([^*\n]*?)\)\*|^\s*\(([^)\n]*)\)\s*$/gm, (m, a, b) => {
      const act = (a ?? b ?? '').trim();
      if (!allowNv || seen > 0) return '';
      if (!d.nonverbal.touch && TOUCH_WORDS.test(act)) return '';
      if (act.length > 28) return '';
      seen++;
      return `*(${act})*`;
    })
    .trim()
    // One flowing block, like speaking in one go. New line only for a gesture
    // or after a real pause ("…"); blank lines between sentences are joined.
    .split('\n').map(l => l.trim()).filter(Boolean)
    .reduce((out, line) => {
      const isAction = l => /^\*\(.*\)\*$/.test(l);
      const prev = out[out.length - 1];
      if (prev === undefined || isAction(line) || isAction(prev) || /(…|\.\.\.)$/.test(prev)) out.push(line);
      else out[out.length - 1] = `${prev} ${line}`;
      return out;
    }, [])
    .join('\n');
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

  // Channel guards.
  // Holding-back messages (a withdrawing card behind them, none approaching) are never narrated in words:
  // someone keeping a feeling in doesn't explain that they're keeping it in.
  const byId = Object.fromEntries(cards.map(c => [c.id, c]));
  const holdsBack = m => m.cards.some(id => byId[id]?.approach === 'away') && !m.cards.some(id => byId[id]?.approach === 'toward');
  let bodyUsed = false;
  for (const m of messages) {
    if (holdsBack(m) && (m.channel === 'sentence' || m.channel === 'clause')) m.channel = 'tone';
    if (m.channel === 'body') {
      if (bodyUsed || nonverbal.channel === 'none') m.channel = holdsBack(m) ? 'tone' : 'clause'; else bodyUsed = true;
    }
  }
  // What the entity stresses is holding back → no touching, whatever else the cards say
  if (messages.some(m => m.core && holdsBack(m))) nonverbal.touch = false;
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
    answer_cards: Array.isArray(d.answer_cards) ? d.answer_cards.filter(id => ids.has(id)) : [],
    intent: typeof d.intent === 'string' ? d.intent.trim() : '',
    cards_answer: typeof d.cards_answer === 'string' ? d.cards_answer.trim() : '',
    off_topic: !!d.off_topic,
    answer_cards: Array.isArray(d.answer_cards) ? d.answer_cards.filter(id => ids.has(id)) : [],
    intent: typeof d.intent === 'string' ? d.intent.trim() : '',
    cards_answer: typeof d.cards_answer === 'string' ? d.cards_answer.trim() : '',
    off_topic: !!d.off_topic,
    messages,
    intensity: Math.min(3, Math.max(1, Number(d.intensity) || 1)),
    nonverbal,
    tone: d.tone || 'ปกติ',
    expressiveness: 'normal', // set from cached persona traits by callDecode
    hesitation,
    // silence needs a gesture; without a backed one, don't go silent
    silent: !!d.silent && nonverbal.channel !== 'none',
    followup: typeof d.followup === 'string' && d.followup.trim() ? d.followup.trim() : null,
    summary: typeof d.summary === 'string' ? d.summary.trim() : '',
    // Pet names only when the cards bring closeness or playfulness — not at random
    warm: messages.some(m => m.cards.some(id => byId[id]?.approach === 'toward')) || /ขี้เล่น|ชั้นเชิง/.test(d.tone || ''),
    unused
  };
}

// Hearted answers of this entity → voice examples (style only). Newest first, short.
export function styleExamplesFor(entityId, favorites, max = 3) {
  return (favorites || [])
    .filter(f => f.entity_id === entityId && f.content)
    .slice(-max).reverse()
    .map(f => f.content.replace(/\s+/g, ' ').trim().slice(0, 160));
}

// Gestures this entity used in its latest answers, so the voice can vary them.
export function recentGesturesFor(readings, max = 3) {
  const out = [];
  for (const r of [...(readings || [])].reverse()) {
    const text = r.messages?.find(m => m.role === 'assistant')?.content || '';
    const g = text.match(/\*\(([^*\n]*?)\)\*/);
    if (g) out.push(g[1]);
    if (out.length >= max) break;
  }
  return out;
}
