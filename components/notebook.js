// 📖 สมุดของพี่ — every card that came up with one entity, a cute decorated cover,
// and the user's own note per card ("ใบนี้ของพี่ = ...") which the decoder reads next time.
import { getEntityById, getReadingsByEntity, getNotebook, saveNotebook, saveEntity, clearEntityReadings } from '../src/storage.js';

// Profile fields shown on the 🪪 page; tap ✏️ to edit any of them in place
const INFO_SHORT = [
  ['pronouns.self', 'เรียกตัวเองว่า', 'เช่น พี่, ข้า'], ['pronouns.callUser', 'เรียกเราว่า', 'เช่น น้อง, หนู'],
  ['relationship', 'เป็นอะไรกับเรา', 'เช่น ผู้พิทักษ์'], ['domain', 'ถนัดเรื่อง', 'เช่น ความรัก งาน']
];
const INFO_LONG = [
  ['personality', 'บุคลิก', 'บุคลิกของพี่'], ['language_style', 'วิธีพูด', 'สไตล์การพูด'],
  ['likes', 'ชอบ', 'เช่น ราเมน ความสงบ'], ['dislikes', 'ไม่ชอบ', 'เช่น ถูกเพิกเฉย']
];
const FEELS = ['🫶 อุ่นๆ', '😏 เหมือนแซว', '⚠️ เหมือนเตือน', '🤔 ไม่แน่ใจ'];
// "ใช่พี่ไหม" reads the card's own approach data: coming toward = yes, moving away = no, held back = unclear
function verdictOf(card) {
  if (card.hesitation || card.approach === 'neutral') return 'meh';
  return card.approach === 'toward' ? 'ok' : 'no';
}
const VERDICT = { ok: '✓ ใช่ พี่เอง', no: '✗ ไม่ใช่พี่', meh: '? ยังไม่ชัด' };

const SUIT_TH = { Major: 'ไพ่ใหญ่', Wands: 'ไม้', Cups: 'ถ้วย', Swords: 'ดาบ', Pentacles: 'เหรียญ' };
const SUIT_SYM = { Major: '✦', Wands: '🔥', Cups: '🌊', Swords: '💨', Pentacles: '🌿' };

// ── decoration options ──
// Cover materials/prints (the outside of the book)
const PAPERS = [
  { id: 'plain', name: 'เรียบ' }, { id: 'linen', name: 'ผ้าลินิน' }, { id: 'velvet', name: 'กำมะหยี่' },
  { id: 'quilted', name: 'บุนวม' }, { id: 'marble', name: 'หินอ่อน' }, { id: 'polka', name: 'ลายจุด' },
  { id: 'gingham', name: 'สก็อต' }, { id: 'checker', name: 'ตารางหมากรุก' }, { id: 'stripe', name: 'ลายทาง' },
  { id: 'hearts', name: 'หัวใจ' }, { id: 'stars', name: 'ดาว' }, { id: 'floral', name: 'ดอกไม้' },
  { id: 'cloud', name: 'ก้อนเมฆ' }, { id: 'kraft', name: 'คราฟท์' }, { id: 'leather', name: 'หนัง' },
  { id: 'holo', name: 'โฮโลแกรม' }, { id: 'tartan', name: 'ตาร์ทัน' }, { id: 'dots', name: 'จุดไข่ปลา' }
];
// Writing paper for the pages inside — chosen separately from the cover
const INSIDES = [
  { id: 'plain', name: 'ขาวนวล', bg: 'radial-gradient(rgba(160,120,100,0.05) 1px, transparent 1.4px) 0 0/6px 6px, #fffdf8' },
  { id: 'cream-lined', name: 'บรรทัดมีขอบ', bg: 'linear-gradient(90deg, transparent 26px, rgba(232,110,130,0.45) 26px 27px, transparent 27px), repeating-linear-gradient(to bottom, transparent 0 27px, rgba(110,150,200,0.28) 27px 28px) #fffaf0' },
  { id: 'grid', name: 'ตารางฟ้า', bg: 'linear-gradient(rgba(120,160,210,0.22) 1px, transparent 1px) 0 0/20px 20px, linear-gradient(90deg, rgba(120,160,210,0.22) 1px, transparent 1px) 0 0/20px 20px, #fbfdff' },
  { id: 'pink-grid', name: 'ตารางชมพู', bg: 'linear-gradient(rgba(232,130,154,0.20) 1px, transparent 1px) 0 0/18px 18px, linear-gradient(90deg, rgba(232,130,154,0.20) 1px, transparent 1px) 0 0/18px 18px, #fff5f7' },
  { id: 'dotgrid', name: 'จุดกริด', bg: 'radial-gradient(rgba(120,100,110,0.30) 1.1px, transparent 1.6px) 0 0/18px 18px, #fffdfa' },
  { id: 'mint-lined', name: 'บรรทัดมินต์', bg: 'repeating-linear-gradient(to bottom, transparent 0 27px, rgba(95,183,154,0.30) 27px 28px) #f3fbf7' },
  { id: 'pastel', name: 'สีน้ำพาสเทล', bg: 'radial-gradient(60% 45% at 15% 10%, rgba(255,200,225,0.55), transparent 70%), radial-gradient(55% 50% at 90% 40%, rgba(200,215,255,0.5), transparent 70%), radial-gradient(60% 45% at 30% 95%, rgba(200,255,235,0.5), transparent 70%), #fffdfd' },
  { id: 'recycled', name: 'กระดาษรีไซเคิล', bg: 'radial-gradient(rgba(90,70,50,0.18) 0.8px, transparent 1.3px) 0 0/9px 11px, radial-gradient(rgba(90,70,50,0.10) 1px, transparent 1.6px) 4px 6px/13px 17px, #f1eadf' },
  { id: 'parchment', name: 'กระดาษเก่า', bg: 'radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(150,105,50,0.18)), radial-gradient(rgba(150,105,50,0.08) 1px, transparent 1.5px) 0 0/7px 7px, #f7ecd6' },
  { id: 'lilac-dots', name: 'จุดม่วง', bg: 'radial-gradient(rgba(156,126,214,0.30) 1.4px, transparent 2px) 0 0/16px 16px, #faf6ff' }
];
const COLORS = [
  { id: 'pink', c: '#ffd6e0' }, { id: 'peach', c: '#ffe0c7' }, { id: 'cream', c: '#fff4d6' },
  { id: 'mint', c: '#d4f1e2' }, { id: 'sky', c: '#d6eaff' }, { id: 'lilac', c: '#e6dcff' },
  { id: 'rose', c: '#f2a9bb' }, { id: 'sage', c: '#b9cdb0' }, { id: 'navy', c: '#2e3a5c', dark: true },
  { id: 'night', c: '#2a2230', dark: true }, { id: 'wine', c: '#7a2a3e', dark: true },
  { id: 'brown', c: '#5b3a29', dark: true }, { id: 'black', c: '#1b1a1e', dark: true }
];
// Border/finish layered over the paper
const DECOS = [
  { id: 'none', name: 'ไม่มี' }, { id: 'lace', name: 'ลูกไม้' }, { id: 'stitch', name: 'ด้ายเย็บ' },
  { id: 'gold', name: 'มุมทอง' }, { id: 'pearl', name: 'มุก' }, { id: 'shine', name: 'ประกายวิ้ง' },
  { id: 'pins', name: 'เข็มกลัด' }, { id: 'moon', name: 'จันทร์เสี้ยว' }, { id: 'scallop', name: 'ขอบหยัก' },
  { id: 'corners', name: 'มุมรูปถ่าย' }, { id: 'doodle', name: 'ขอบวาดมือ' }, { id: 'bow', name: 'โบว์ใหญ่' },
  { id: 'bloom', name: 'ช่อดอกมุมปก' }, { id: 'label', name: 'ป้ายชื่อแปะ' }, { id: 'glitter', name: 'ขอบกากเพชร' }
];
// One tap = a whole look; every piece can still be changed afterwards
const THEMES = [
  { id: 'coquette', name: 'Coquette', icon: '🎀', cover: { paper: 'quilted', color: 'pink', inside: 'pink-grid', font: 'Fahkwang', frame: 'arch', tape: 'lace', tapePos: 'top', ribbon: 'pink', deco: 'bow' }, pack: ['🎀', '🩷', '💌', '🍓', '🦢', '🫧', '🌷', '💗'], words: ['xoxo', 'with love', 'ของพี่'], doodles: ['heart', 'bow', 'sparkle'] },
  { id: 'cottage', name: 'Cottagecore', icon: '🌼', cover: { paper: 'gingham', color: 'cream', inside: 'cream-lined', font: 'Mali', frame: 'stamp', tape: 'floral', tapePos: 'corners', ribbon: 'mint', deco: 'stitch' }, pack: ['🌼', '🍄', '🧺', '🐝', '🌿', '🍯', '🐇', '🍞'], words: ['bloom', 'สู้ๆ', 'วันดีๆ'], doodles: ['leaf', 'flower', 'squiggle'] },
  { id: 'kawaii', name: 'Kawaii', icon: '☁️', cover: { paper: 'cloud', color: 'sky', inside: 'dotgrid', font: 'Itim', frame: 'cloud', tape: 'rainbow', tapePos: 'cross', ribbon: 'pink', deco: 'scallop' }, pack: ['☁️', '🐰', '🐱', '🍡', '🧸', '🍮', '🌈', '⭐'], words: ['yay!', 'คิดถึง', 'hehe'], doodles: ['star', 'heart', 'sparkle'] },
  { id: 'y2k', name: 'Y2K', icon: '💿', cover: { paper: 'holo', color: 'lilac', inside: 'pastel', font: 'Playpen Sans Thai', frame: 'star', tape: 'checker', tapePos: 'side', ribbon: 'lilac', deco: 'glitter' }, pack: ['💿', '🦋', '⭐', '💖', '📱', '👾', '✨', '🌈'], words: ['lucky ✦', 'OMG', 'bestie'], doodles: ['sparkle', 'star', 'arrow'] },
  { id: 'academia', name: 'Dark Academia', icon: '📜', cover: { paper: 'leather', color: 'brown', inside: 'parchment', font: 'Noto Serif Thai', frame: 'oval', tape: 'none', tapePos: 'corners', ribbon: 'gold', deco: 'gold' }, pack: ['🕯️', '🗝️', '📜', '🪶', '🦉', '☕', '🥀', '📚'], words: ['dear diary', 'secret', 'memento'], doodles: ['swirl', 'crown', 'leaf'] },
  { id: 'witchy', name: 'Witchy', icon: '🔮', cover: { paper: 'velvet', color: 'night', inside: 'recycled', font: 'Athiti', frame: 'diamond', tape: 'stars', tapePos: 'top', ribbon: 'lilac', deco: 'moon' }, pack: ['🔮', '🌙', '🕯️', '🃏', '🪄', '🐈‍⬛', '💎', '🍄'], words: ['magic', 'secret', 'ฝันดีนะ'], doodles: ['star', 'swirl', 'sparkle'] },
  { id: 'grunge', name: 'Grunge', icon: '🖤', cover: { paper: 'tartan', color: 'black', inside: 'grid', font: 'K2D', frame: 'polaroid', tape: 'clear', tapePos: 'cross', ribbon: 'red', deco: 'pins' }, pack: ['🖤', '⛓️', '🥀', '💀', '🎸', '🕷️', '⚡', '🩹'], words: ['NO.', 'whatever', 'ไม่แคร์'], doodles: ['squiggle', 'arrow', 'star'] },
  { id: 'mermaid', name: 'Mermaid', icon: '🐚', cover: { paper: 'stripe', color: 'mint', inside: 'mint-lined', font: 'Kodchasan', frame: 'circle', tape: 'mint', tapePos: 'corners', ribbon: 'mint', deco: 'pearl' }, pack: ['🐚', '🫧', '🐠', '🪸', '🌊', '🧜‍♀️', '🦪', '💎'], words: ['ocean', 'shine', 'ทะเลเหงา'], doodles: ['swirl', 'sparkle', 'heart'] },
  { id: 'celestial', name: 'Celestial', icon: '✨', cover: { paper: 'stars', color: 'navy', inside: 'lilac-dots', font: 'Athiti', frame: 'star', tape: 'gold', tapePos: 'side', ribbon: 'gold', deco: 'shine' }, pack: ['☀️', '🌙', '⭐', '🪐', '💫', '🌟', '✨', '🔭'], words: ['stardust', 'wish', 'ดวงดาว'], doodles: ['star', 'sparkle', 'swirl'] },
  { id: 'minimal', name: 'Minimal', icon: '🤍', cover: { paper: 'linen', color: 'cream', inside: 'dotgrid', font: 'Anuphan', frame: 'none', tape: 'none', tapePos: 'corners', ribbon: 'navy', deco: 'label' }, pack: ['🤍', '🌿', '☁️', '✦'], words: ['notes', 'today', 'บันทึก'], doodles: ['arrow', 'leaf', 'squiggle'] },
  { id: 'forest', name: 'Fairy Forest', icon: '🍄', cover: { paper: 'floral', color: 'sage', inside: 'recycled', font: 'Mali', frame: 'circle', tape: 'kraft', tapePos: 'top', ribbon: 'gold', deco: 'bloom' }, pack: ['🍄', '🧚', '🌿', '🐌', '🦔', '🍃', '✨', '🌙'], words: ['fairy', 'grow', 'ป่าวิเศษ'], doodles: ['leaf', 'flower', 'sparkle'] },
  { id: 'vintage', name: 'Vintage Letter', icon: '💌', cover: { paper: 'kraft', color: 'cream', inside: 'parchment', font: 'Noto Serif Thai', frame: 'stamp', tape: 'clear', tapePos: 'top', ribbon: 'red', deco: 'corners' }, pack: ['💌', '📮', '🥀', '🕰️', '🪶', '🎞️', '☕', '🗝️'], words: ['par avion', 'yours', 'ถึงพี่'], doodles: ['swirl', 'heart', 'arrow'] },
  { id: 'marble', name: 'Marble Café', icon: '☕', cover: { paper: 'marble', color: 'cream', inside: 'plain', font: 'Prompt', frame: 'arch', tape: 'kraft', tapePos: 'side', ribbon: 'navy', deco: 'doodle' }, pack: ['☕', '🥐', '🍰', '🧁', '🫖', '🍪', '🥛', '📖'], words: ['café', 'chill', 'พักก่อน'], doodles: ['squiggle', 'heart', 'arrow'] },
  { id: 'cherry', name: 'Cherry Picnic', icon: '🍒', cover: { paper: 'checker', color: 'rose', inside: 'cream-lined', font: 'Sriracha', frame: 'ticket', tape: 'pink', tapePos: 'cross', ribbon: 'red', deco: 'scallop' }, pack: ['🍒', '🧺', '🍓', '🥪', '🌷', '🐞', '🎀', '🍉'], words: ['picnic', 'sweet', 'น่ารัก'], doodles: ['heart', 'flower', 'sparkle'] }
];
// Readable Thai fonts only (no old-style calligraphy), grouped by feel
const FONTS = [
  { id: 'Itim', name: 'อิ่ม', g: 'cute' }, { id: 'Mali', name: 'มะลิ', g: 'cute' },
  { id: 'Kodchasan', name: 'กชสรณ์', g: 'cute' }, { id: 'Playpen Sans Thai', name: 'เพลย์เพน', g: 'cute' },
  { id: 'Sriracha', name: 'ศรีราชา', g: 'cute' },
  { id: 'Fahkwang', name: 'ฟ้ากว้าง', g: 'elegant' }, { id: 'Athiti', name: 'อธิติ', g: 'elegant' },
  { id: 'Noto Serif Thai', name: 'โนโต้ เซอริฟ', g: 'elegant' },
  { id: 'Mitr', name: 'มิตร', g: 'modern' }, { id: 'Prompt', name: 'พร้อมท์', g: 'modern' },
  { id: 'Anuphan', name: 'อนุพันธ์', g: 'modern' }, { id: 'K2D', name: 'เคทูดี', g: 'modern' },
  { id: 'IBM Plex Sans Thai Looped', name: 'ไอบีเอ็ม มีหัว', g: 'modern' }
];
const FONT_GROUPS = [['cute', 'น่ารัก'], ['elegant', 'เอเลแกนต์'], ['modern', 'โมเดิร์น เรียบๆ']];
const FRAMES = [
  { id: 'circle', name: 'วงกลม' }, { id: 'heart', name: 'หัวใจ' }, { id: 'star', name: 'ดาว' },
  { id: 'stamp', name: 'แสตมป์' }, { id: 'polaroid', name: 'โพลารอยด์' }, { id: 'oval', name: 'วงรีวินเทจ' },
  { id: 'arch', name: 'ซุ้มโค้ง' }, { id: 'cloud', name: 'ก้อนเมฆ' }, { id: 'diamond', name: 'ข้าวหลามตัด' },
  { id: 'ticket', name: 'ตั๋ว' }, { id: 'none', name: 'ไม่มีกรอบ' }
];
const TAPES = [
  { id: 'none', name: 'ไม่มี' }, { id: 'pink', name: 'ชมพูริ้ว' }, { id: 'mint', name: 'มินต์จุด' },
  { id: 'gold', name: 'ทอง' }, { id: 'lilac', name: 'ม่วงสก็อต' }, { id: 'clear', name: 'ใส' },
  { id: 'floral', name: 'ลายดอก' }, { id: 'checker', name: 'หมากรุก' }, { id: 'rainbow', name: 'สายรุ้ง' },
  { id: 'kraft', name: 'กระดาษคราฟท์' }, { id: 'stars', name: 'ดาวกลางคืน' }, { id: 'lace', name: 'ลูกไม้' }
];
const TAPE_POS = [
  { id: 'corners', name: 'มุมบน' }, { id: 'top', name: 'แปะกลางบน' }, { id: 'side', name: 'แปะข้างสัน' }, { id: 'cross', name: 'มุมทแยง' }
];
const RIBBONS = [
  { id: 'none', c: '' }, { id: 'red', c: '#d9455f' }, { id: 'pink', c: '#f28aa5' }, { id: 'gold', c: '#d9a441' },
  { id: 'lilac', c: '#9c7ed6' }, { id: 'mint', c: '#5fb79a' }, { id: 'navy', c: '#34446e' }
];
// Sticker drawers — emoji sets by mood, plus word labels and hand-drawn doodles
const STICKER_SETS = [
  { id: 'cute', name: 'น่ารัก', items: ['🌸','🎀','💗','🧸','🐰','🐱','🐾','🍡','🧁','🍰','🌈','🩷','🐣','🐻','🦄','💝'] },
  { id: 'nature', name: 'ธรรมชาติ', items: ['🌷','🌼','🌻','🍀','🌿','🍃','🍁','🍄','🌵','🌙','☁️','🌊','🐚','🦋','🐝','🐞'] },
  { id: 'mystic', name: 'ลึกลับ', items: ['🔮','🃏','🕯️','🪄','🗝️','📿','💎','👁️','🌒','🪐','✨','💫','⭐','🌟','🦉','🐈‍⬛'] },
  { id: 'food', name: 'ของกิน', items: ['🍓','🍒','🍑','🍋','🍉','🍪','🍩','🍮','🍵','🧋','☕','🍜','🍙','🥟','🍭','🍦'] },
  { id: 'retro', name: 'เรโทร', items: ['💿','📼','📷','🎞️','📮','💌','🕰️','📻','☎️','🎧','🎸','🛼','🎲','👾','🪩','📟'] },
  { id: 'sky', name: 'นก ปีก มงกุฎ', items: ['🦅','🕊️','🪽','🪶','👑','🎐','🎵','🫧','🏮','⛩️','🪷','🐉'] }
];
const WORDS = ['love', 'xoxo', 'secret', 'magic', 'lucky ✦', 'dear diary', 'with love', 'คิดถึง', 'ฝันดีนะ', 'ของพี่', 'โชคดี', 'สู้ๆ', 'บันทึก', 'วันนี้', 'ถึงพี่', 'hehe'];
const WORD_STYLES = 4; // label · bubble · tape · outline
// Hand-drawn doodles (stroked SVG, 40×40)
const DOODLES = {
  heart: 'M20 33C9 25 5 19 6 13c1-5 7-7 11-3l3 3 3-3c4-4 10-2 11 3 1 6-3 12-14 20z',
  star: 'M20 5l4 10 10 1-8 7 3 11-9-6-9 6 3-11-8-7 10-1z',
  sparkle: 'M20 4c1 9 4 13 14 16-10 3-13 7-14 16-1-9-4-13-14-16 10-3 13-7 14-16z',
  squiggle: 'M4 22c4-8 8-8 10 0s6 8 10 0 8-8 12 0',
  swirl: 'M22 20a3 3 0 1 1-4-3c5-1 8 3 7 7-1 5-7 8-12 6-6-2-8-9-5-14 3-6 11-8 17-5',
  arrow: 'M5 28c8-12 18-16 28-14m0 0l-6-5m6 5l-5 6',
  crown: 'M6 30l-2-18 9 8 7-12 7 12 9-8-2 18z',
  bow: 'M20 20c-6-8-14-9-14-3s8 7 14 3c6 4 14 3 14-3s-8-5-14 3zm0 0l-5 13m5-13l5 13',
  leaf: 'M8 32C8 18 18 8 33 7c0 15-10 25-25 25zm0 0l14-14',
  flower: 'M20 15a4 4 0 1 1 0 .1M20 11c-3-6 3-6 0 0m9 9c6-3 6 3 0 0m-9 9c3 6-3 6 0 0m-9-9c-6 3-6-3 0 0'
};
const DOODLE_INKS = ['#e8829a', '#9c7ed6', '#5fb79a', '#d9a441', '#34446e', '#d9455f'];

const DEFAULT_COVER = { theme: 'coquette', ...THEMES[0].cover, title: '', stickers: [] };

// Older notebooks saved before covers and pages were split: give them their theme's page paper
function normCover(saved = {}) {
  const th = THEMES.find(t => t.id === saved.theme);
  const c = { ...DEFAULT_COVER, ...saved };
  if (!saved.inside) c.inside = th?.cover.inside || 'plain';
  if (!saved.tapePos) c.tapePos = 'corners';
  return c;
}
function insideBg(cover) { return (INSIDES.find(p => p.id === cover.inside) || INSIDES[0]).bg; }

// One sticker's look: emoji, a word label, or a hand-drawn doodle
function stickerInner(s) {
  if (s.t === 'w') return esc(s.e);
  if (s.t === 'd') return `<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true"><path d="${DOODLES[s.e] || DOODLES.heart}" fill="none" stroke="${s.c || DOODLE_INKS[0]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return s.e;
}
function stickerClass(s) {
  if (s.t === 'w') return ` nb-word nb-word-${s.v || 0}`;
  if (s.t === 'd') return ' nb-doodle';
  return '';
}

let deckCache = null;
async function deck() {
  if (deckCache) return deckCache;
  const data = await fetch('data/cards.json').then(r => r.json());
  deckCache = data.tarot || [];
  return deckCache;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function loadFonts() {
  if (document.getElementById('nb-fonts')) return;
  const l = document.createElement('link');
  l.id = 'nb-fonts';
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Itim&family=Mali:wght@500&family=Kodchasan:wght@500&family=Playpen+Sans+Thai:wght@500&family=Sriracha&family=Fahkwang:wght@500&family=Athiti:wght@500&family=Noto+Serif+Thai:wght@500&family=Prompt&family=Anuphan:wght@500&family=K2D:wght@500&family=IBM+Plex+Sans+Thai+Looped:wght@500&display=swap';
  document.head.appendChild(l);
}

// ── paper patterns as inline backgrounds (ink follows the cover's lightness) ──
function svgTile(path, ink, size) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><path d='${path}' fill='${ink}'/></svg>`;
  // single quotes (encoded inside) so this can sit in a style="..." attribute
  return `url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}')`;
}
const HEART = 'M18 27s-8-5-8-10a4 4 0 0 1 8-1.5a4 4 0 0 1 8 1.5c0 5-8 10-8 10z';
const STAR = 'M20 9l2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6-4.5-4.2 6.1-.7z';
const CLOUD = 'M12 30a6 6 0 0 1-.5-12 8 8 0 0 1 15.5-2.5A6.5 6.5 0 0 1 29 30z';
const circ = (x, y, r) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
const FLOWER = [0, 72, 144, 216, 288].map(a => circ(+(22 + 5.5 * Math.cos(a * Math.PI / 180)).toFixed(1), +(22 + 5.5 * Math.sin(a * Math.PI / 180)).toFixed(1), 4)).join('');
function svgLayer(inner, size) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'>${inner}</svg>`;
  return `url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, '%27')}')`;
}

export function paperBackground(paper, bg, dark) {
  const ink = dark ? 'rgba(255,255,255,0.16)' : 'rgba(150,70,95,0.13)';
  switch (paper) {
    case 'lined': return `repeating-linear-gradient(to bottom, transparent 0 23px, ${ink} 23px 24px) ${bg}`;
    case 'grid': return `linear-gradient(${ink} 1px, transparent 1px) 0 0/18px 18px, linear-gradient(90deg, ${ink} 1px, transparent 1px) 0 0/18px 18px, ${bg}`;
    case 'dots': return `radial-gradient(${ink} 1.3px, transparent 1.8px) 0 0/16px 16px, ${bg}`;
    case 'polka': return `radial-gradient(${ink} 5px, transparent 5.6px) 0 0/34px 34px, radial-gradient(${ink} 5px, transparent 5.6px) 17px 17px/34px 34px, ${bg}`;
    case 'gingham': return `linear-gradient(90deg, ${ink} 50%, transparent 50%) 0 0/22px 22px, linear-gradient(${ink} 50%, transparent 50%) 0 0/22px 22px, ${bg}`;
    case 'stripe': return `repeating-linear-gradient(135deg, ${ink} 0 7px, transparent 7px 19px) ${bg}`;
    case 'hearts': return `${svgTile(HEART, dark ? 'rgba(255,255,255,0.2)' : 'rgba(232,130,154,0.28)', 36)} 0 0/36px 36px, ${bg}`;
    case 'stars': return `${svgTile(STAR, dark ? 'rgba(255,230,160,0.35)' : 'rgba(217,164,65,0.3)', 40)} 0 0/40px 40px, ${bg}`;
    case 'kraft': return `radial-gradient(rgba(90,55,25,0.16) 1px, transparent 1.5px) 0 0/7px 7px, radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1.5px) 3px 4px/11px 11px, #d4ac80`;
    case 'leather': return `radial-gradient(rgba(0,0,0,0.18) 1px, transparent 1.6px) 0 0/5px 5px, radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1.6px) 2px 3px/9px 9px, radial-gradient(120% 90% at 30% 20%, rgba(255,255,255,0.10), transparent 60%), ${bg}`;
    case 'holo': return `radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1.6px) 0 0/22px 22px, linear-gradient(125deg, #ffd1f0, #c9d8ff 30%, #c7fff0 55%, #fff3c4 75%, #f0c9ff)`;
    case 'linen': return `repeating-linear-gradient(0deg, ${ink} 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, ${ink} 0 1px, transparent 1px 4px), ${bg}`;
    case 'velvet': return `radial-gradient(130% 80% at 25% 15%, rgba(255,255,255,${dark ? 0.16 : 0.45}), transparent 55%), radial-gradient(90% 70% at 85% 95%, rgba(0,0,0,${dark ? 0.35 : 0.12}), transparent 60%), ${bg}`;
    case 'quilted': return `linear-gradient(45deg, transparent 47%, ${ink} 47% 53%, transparent 53%) 0 0/28px 28px, linear-gradient(-45deg, transparent 47%, ${ink} 47% 53%, transparent 53%) 0 0/28px 28px, radial-gradient(circle at 50% 30%, rgba(255,255,255,${dark ? 0.12 : 0.5}), transparent 60%) 0 0/28px 28px, ${bg}`;
    case 'marble': return `radial-gradient(40% 18% at 20% 30%, ${ink}, transparent 70%), radial-gradient(30% 60% at 75% 20%, rgba(255,255,255,0.5), transparent 70%), linear-gradient(115deg, transparent 38%, ${ink} 40%, transparent 42%, transparent 62%, ${ink} 63%, transparent 65%), radial-gradient(50% 30% at 60% 80%, ${ink}, transparent 70%), ${bg}`;
    case 'checker': return `conic-gradient(${ink} 25%, transparent 0 50%, ${ink} 0 75%, transparent 0) 0 0/28px 28px, ${bg}`;
    case 'floral': {
      const petal = dark ? 'rgba(255,214,224,0.35)' : 'rgba(255,255,255,0.85)';
      const mid = dark ? 'rgba(255,230,160,0.5)' : 'rgba(217,164,65,0.55)';
      return `${svgLayer(`<path d='${FLOWER}' fill='${petal}'/><circle cx='22' cy='22' r='2.6' fill='${mid}'/>`, 44)} 0 0/44px 44px, ${svgLayer(`<path d='${FLOWER}' fill='${petal}'/><circle cx='22' cy='22' r='2.6' fill='${mid}'/>`, 44)} 22px 22px/44px 44px, ${bg}`;
    }
    case 'cloud': return `${svgTile(CLOUD, dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.9)', 40)} 0 0/48px 48px, ${svgTile(CLOUD, dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)', 40)} 24px 20px/48px 48px, ${bg}`;
    case 'tartan': {
      const a = dark ? 'rgba(200,40,60,0.35)' : 'rgba(200,40,60,0.22)';
      return `repeating-linear-gradient(90deg, ${a} 0 10px, transparent 10px 30px, ${ink} 30px 33px, transparent 33px 50px), repeating-linear-gradient(0deg, ${a} 0 10px, transparent 10px 30px, ${ink} 30px 33px, transparent 33px 50px), ${bg}`;
    }
    default: return bg;
  }
}

function colorOf(cover) { return COLORS.find(c => c.id === cover.color) || COLORS[0]; }
function isDark(cover) { return !['kraft', 'holo'].includes(cover.paper) && !!colorOf(cover).dark; }

function coverHTML(entity, cover, total, editing) {
  const col = colorOf(cover);
  const dark = isDark(cover);
  const title = cover.title?.trim() || `สมุดของ${entity.name}`;
  const ribbon = RIBBONS.find(r => r.id === cover.ribbon);
  return `
    <div class="nb-book${editing ? ' editing' : ''}">
      <div class="nb-cover nb-deco-${cover.deco || 'none'}${dark ? ' dark' : ''}" id="nb-cover" style="background:${paperBackground(cover.paper, col.c, dark)}">
        ${cover.tape !== 'none' ? `<span class="nb-tapes nb-tapes-${cover.tapePos || 'corners'}"><span class="nb-tape nb-tape-${cover.tape} l"></span><span class="nb-tape nb-tape-${cover.tape} r"></span></span>` : ''}
        <div class="nb-label">
          <div class="nb-frame nb-frame-${cover.frame}" style="--ent:${entity.color_primary || '#ffb6c1'}"><span>${esc(entity.icon || '🌙')}</span></div>
          <div class="nb-title" style="font-family:'${cover.font}', var(--font-display)">${esc(title)}</div>
          <div class="nb-count">${total}/78 ใบ</div>
        </div>
        ${(cover.stickers || []).map((s, i) => `<span class="nb-sticker${stickerClass(s)}" data-i="${i}" style="left:${s.x}%;top:${s.y}%;transform:translate(-50%,-50%) rotate(${s.r || 0}deg) scale(${s.s || 1})">${stickerInner(s)}</span>`).join('')}
      </div>
      ${ribbon?.c ? `<span class="nb-ribbon" style="--rb:${ribbon.c}"></span>` : ''}
    </div>`;
}

// Small cover for the shelf page: same paper, colour, finish and stickers as the real cover
export function miniCoverHTML(entity) {
  const cover = normCover(getNotebook(entity.id).cover || {});
  const dark = isDark(cover);
  const ribbon = RIBBONS.find(r => r.id === cover.ribbon);
  const seen = new Set();
  getReadingsByEntity(entity.id).forEach(r => (r.cards || []).forEach(c => seen.add(c.id)));
  return {
    total: seen.size,
    title: cover.title?.trim() || entity.name || '',
    font: cover.font,
    html: `<span class="shelf-cover nb-deco-${cover.deco || 'none'}${dark ? ' dark' : ''}" style="background:${paperBackground(cover.paper, colorOf(cover).c, dark)}">
      <span class="shelf-face">${esc(entity.icon || '🌙')}</span>
      ${cover.tape !== 'none' ? `<span class="nb-tapes nb-tapes-${cover.tapePos || 'corners'} mini"><span class="nb-tape nb-tape-${cover.tape} l"></span><span class="nb-tape nb-tape-${cover.tape} r"></span></span>` : ''}
      ${(cover.stickers || []).slice(0, 8).map(s => `<span class="shelf-stk${stickerClass(s)}" style="left:${s.x}%;top:${s.y}%;transform:translate(-50%,-50%) rotate(${s.r || 0}deg) scale(${(s.s || 1) * 0.55})">${stickerInner(s)}</span>`).join('')}
      ${ribbon?.c ? `<span class="shelf-ribbon" style="background:${ribbon.c}"></span>` : ''}
    </span>`
  };
}
export { loadFonts as loadNotebookFonts };

// ── data: which cards came up, when, and what was said ──
function collect(entityId) {
  const map = {};
  getReadingsByEntity(entityId).filter(r => r.cards?.length).forEach(r => {
    const ids = r.cards.map(c => c.id);
    r.cards.forEach(c => {
      const e = map[c.id] || (map[c.id] = { n: 0, jumper: 0, hits: [], with: {} });
      e.n++;
      if (c.jumper) e.jumper++;
      e.hits.push({ r, jumper: !!c.jumper });
      ids.filter(o => o !== c.id).forEach(o => { e.with[o] = (e.with[o] || 0) + 1; });
    });
  });
  return map;
}

export async function renderNotebook(entityId, container, startAt) {
  const entity = getEntityById(entityId);
  if (!entity) { container.innerHTML = '<div class="page"><p>ไม่พบพี่คนนี้</p></div>'; return; }
  loadFonts();
  const cards = await deck();
  const nb = getNotebook(entityId);
  nb.cover = normCover(nb.cover || {});
  if (!FONTS.some(f => f.id === nb.cover.font)) nb.cover.font = 'Mitr'; // retired fonts fall back
  nb.notes = nb.notes || {};
  nb.signs = { calling: [], log: [], ...(nb.signs || {}) };
  const save = () => saveNotebook(entityId, nb);
  const seen = collect(entityId);
  const total = Object.keys(seen).length;

  // bookmarks inside the book: 🪪 info · 🃏 cards · 🐦 signs
  let section = ['info', 'cards', 'signs'].includes(startAt) ? startAt : (nb.lastSection || 'cards');
  let view = startAt ? 'inside' : 'cover';
  let tab = 'theme';
  let filter = 'all';
  let selected = -1;
  let stkSet = 'theme';
  let ink = DOODLE_INKS[0];

  container.innerHTML = `<div class="page nb-page"><div class="nb-topbar">
    <button class="btn-icon" id="nb-back" aria-label="กลับ">←</button><span class="nb-top-title">📖 สมุด</span></div>
    <div id="nb-view"></div></div>`;
  const root = container.querySelector('#nb-view');
  container.querySelector('#nb-back').addEventListener('click', () => {
    if (view === 'cover' || (startAt && view === 'inside')) {
      // back to wherever it was opened from (shelf or chat)
      if (history.length > 1) history.back(); else location.hash = `#/chat/${entityId}`;
    }
    else { view = view === 'page' ? 'inside' : 'cover'; draw(); }
  });

  function draw() {
    container.querySelector('.nb-page')?.style.setProperty('--nb-paper', insideBg(nb.cover));
    if (view === 'inside') return drawInside();
    if (view === 'page') return drawPage();
    const editing = view === 'edit';
    root.innerHTML = `
      <div class="nb-stage">${coverHTML(entity, nb.cover, total, editing)}</div>
      ${editing ? editorHTML() : `
        <div class="nb-actions">
          <button class="btn btn-primary" id="nb-open">📖 เปิดสมุด</button>
          <button class="btn btn-secondary" id="nb-edit">🎨 แต่งปก</button>
        </div>`}`;
    if (editing) bindEditor();
    else {
      root.querySelector('#nb-open').addEventListener('click', () => { view = 'inside'; draw(); });
      root.querySelector('#nb-edit').addEventListener('click', () => { view = 'edit'; draw(); });
      root.querySelector('#nb-cover').addEventListener('click', () => { view = 'inside'; draw(); });
    }
  }

  // ── sticker drawers ──
  const addBtn = (s, label) => `<button class="nb-stk${s.t === 'w' ? ' word' : ''}" data-add="${esc(s.e)}" data-t="${s.t || ''}" data-v="${s.v ?? ''}" data-c="${s.c || ''}">${label ?? stickerInner(s)}</button>`;
  function stickerDrawer(c) {
    const th = THEMES.find(t => t.id === c.theme) || THEMES[0];
    const inks = `<div class="nb-opts">${DOODLE_INKS.map(k => `<button class="nb-ink${ink === k ? ' on' : ''}" data-ink="${k}" style="background:${k}" aria-label="สีเส้น"></button>`).join('')}</div>`;
    const wordGrid = list => `<div class="nb-word-grid">${list.map((w, i) => addBtn({ t: 'w', e: w, v: i % WORD_STYLES }, `<span class="nb-word nb-word-${i % WORD_STYLES}">${esc(w)}</span>`)).join('')}</div>`;
    const doodleGrid = list => `<div class="nb-stk-grid">${list.map(d => addBtn({ t: 'd', e: d, c: ink })).join('')}</div>`;
    const emojiGrid = list => `<div class="nb-stk-grid">${list.map(e => addBtn({ e })).join('')}</div>`;
    if (stkSet === 'theme') return `${emojiGrid(th.pack)}${wordGrid(th.words || [])}${doodleGrid(th.doodles || [])}`;
    if (stkSet === 'words') return wordGrid(WORDS);
    if (stkSet === 'doodles') return `${inks}${doodleGrid(Object.keys(DOODLES))}`;
    if (stkSet === 'packs') return THEMES.filter(t => t.id !== th.id).map(t => `<div class="nb-sub">${t.icon} ${t.name}</div>${emojiGrid(t.pack)}`).join('');
    const set = STICKER_SETS.find(s => s.id === stkSet);
    return set ? emojiGrid(set.items) : '';
  }

  // ── cover editor ──
  function editorHTML() {
    const c = nb.cover;
    const tabs = [['theme', 'ธีม'], ['paper', 'ลายปก'], ['color', 'สีปก'], ['inside', 'กระดาษข้างใน'], ['sticker', 'สติกเกอร์'], ['title', 'ชื่อปก'], ['frame', 'กรอบรูป'], ['extra', 'ขอบ เทป ริบบิ้น']];
    let body = '';
    if (tab === 'theme') {
      const th = THEMES.find(t => t.id === c.theme);
      body = `<div class="nb-themes">${THEMES.map(t => {
        const tc = { ...c, ...t.cover };
        return `<button class="nb-theme${c.theme === t.id ? ' on' : ''}" data-theme="${t.id}">
          <span class="nb-theme-prev nb-deco-${t.cover.deco}" style="background:${paperBackground(tc.paper, colorOf(tc).c, isDark(tc))}"><span>${t.icon}</span></span>
          <span class="nb-theme-name">${t.name}</span></button>`;
      }).join('')}</div>
      ${th ? `<button class="btn btn-secondary btn-sm" id="nb-pack">แปะชุดสติกเกอร์ ${th.name} ${th.pack.slice(0, 3).join('')}</button>` : ''}
      <p class="nb-hint">เลือกธีมแล้วยังเปลี่ยนลายปก กระดาษข้างใน สี ฟอนต์ กรอบ ทีละอย่างได้ในแท็บอื่น</p>`;
    }
    if (tab === 'inside') body = `<p class="nb-hint">กระดาษหน้าข้างในสมุด แยกจากลายปก</p>
      <div class="nb-opts">${INSIDES.map(p => `<button class="nb-swatch${c.inside === p.id ? ' on' : ''}" data-set="inside" data-v="${p.id}"><span class="nb-sw-prev page" style="background:${p.bg}"></span>${p.name}</button>`).join('')}</div>`;
    if (tab === 'paper') body = `<div class="nb-opts">${PAPERS.map(p => `<button class="nb-swatch${c.paper === p.id ? ' on' : ''}" data-set="paper" data-v="${p.id}"><span class="nb-sw-prev" style="background:${paperBackground(p.id, colorOf(c).c, isDark({ ...c, paper: p.id }))}"></span>${p.name}</button>`).join('')}</div>`;
    if (tab === 'color') body = `<div class="nb-opts">${COLORS.map(x => `<button class="nb-dot${c.color === x.id ? ' on' : ''}" data-set="color" data-v="${x.id}" style="background:${x.c}" aria-label="${x.id}"></button>`).join('')}</div>${c.paper === 'kraft' ? '<p class="nb-hint">กระดาษคราฟท์มีสีของตัวเอง ลองเปลี่ยนกระดาษก่อนนะ</p>' : ''}`;
    if (tab === 'sticker') body = `
      <p class="nb-hint">แตะเพื่อแปะ · ลากบนปกเพื่อย้าย · แตะสติกเกอร์บนปกเพื่อปรับ</p>
      ${selected >= 0 && c.stickers[selected] ? `<div class="nb-stk-tools">
        <span class="nb-stk-cur${stickerClass(c.stickers[selected])}">${stickerInner(c.stickers[selected])}</span>
        ${c.stickers[selected].t === 'd' ? DOODLE_INKS.map(k => `<button class="nb-ink${c.stickers[selected].c === k ? ' on' : ''}" data-stk-ink="${k}" style="background:${k}" aria-label="สีเส้น"></button>`).join('') : ''}
        ${c.stickers[selected].t === 'w' ? '<button class="btn btn-ghost btn-sm" data-stk="style">🎨</button>' : ''}
        <button class="btn btn-ghost btn-sm" data-stk="small">➖</button>
        <button class="btn btn-ghost btn-sm" data-stk="big">➕</button>
        <button class="btn btn-ghost btn-sm" data-stk="rot">↻</button>
        <button class="btn btn-ghost btn-sm" data-stk="del">🗑️</button>
        <button class="btn btn-ghost btn-sm" data-stk="done">✓</button></div>` : ''}
      <div class="nb-tabs nb-stk-sets">${[['theme', `ชุด ${THEMES.find(t => t.id === c.theme)?.name || 'ธีม'}`], ['words', '🏷️ คำ'], ['doodles', '✏️ วาดมือ'], ...STICKER_SETS.map(s => [s.id, s.name]), ['packs', 'ชุดธีมอื่น']]
        .map(([id, n]) => `<button class="nb-chip${stkSet === id ? ' on' : ''}" data-stkset="${id}">${n}</button>`).join('')}</div>
      ${stickerDrawer(c)}
      ${c.stickers.length ? '<button class="btn btn-ghost btn-sm" id="nb-clear-stk">ลอกสติกเกอร์ออกหมด</button>' : ''}`;
    if (tab === 'title') body = `
      <input class="input nb-title-input" id="nb-title" maxlength="28" placeholder="สมุดของ${esc(entity.name)}" value="${esc(c.title)}">
      ${FONT_GROUPS.map(([g, label]) => `<div class="nb-sub">${label}</div>
      <div class="nb-fonts">${FONTS.filter(f => f.g === g).map(f => `<button class="nb-font${c.font === f.id ? ' on' : ''}" data-set="font" data-v="${f.id}" style="font-family:'${f.id}'">
        <span class="nb-font-sample">${esc(c.title?.trim() || `สมุดของ${entity.name}`)}</span><small>${f.name}</small></button>`).join('')}</div>`).join('')}`;
    if (tab === 'frame') body = `<div class="nb-opts">${FRAMES.map(f => `<button class="nb-chip${c.frame === f.id ? ' on' : ''}" data-set="frame" data-v="${f.id}">${f.name}</button>`).join('')}</div>`;
    if (tab === 'extra') body = `
      <div class="nb-sub">ขอบปก</div>
      <div class="nb-opts">${DECOS.map(d => `<button class="nb-chip${(c.deco || 'none') === d.id ? ' on' : ''}" data-set="deco" data-v="${d.id}">${d.name}</button>`).join('')}</div>
      <div class="nb-sub">เทปตกแต่ง</div>
      <div class="nb-opts">${TAPES.map(t => `<button class="nb-chip${c.tape === t.id ? ' on' : ''}" data-set="tape" data-v="${t.id}">${t.id !== 'none' ? `<span class="nb-tape-mini nb-tape-${t.id}"></span>` : ''}${t.name}</button>`).join('')}</div>
      ${c.tape !== 'none' ? `<div class="nb-sub">ตำแหน่งเทป</div>
      <div class="nb-opts">${TAPE_POS.map(p => `<button class="nb-chip${(c.tapePos || 'corners') === p.id ? ' on' : ''}" data-set="tapePos" data-v="${p.id}">${p.name}</button>`).join('')}</div>` : ''}
      <div class="nb-sub">ริบบิ้นคั่นหน้า</div>
      <div class="nb-opts">${RIBBONS.map(r => `<button class="nb-dot${c.ribbon === r.id ? ' on' : ''}${r.c ? '' : ' none'}" data-set="ribbon" data-v="${r.id}" style="${r.c ? `background:${r.c}` : ''}" aria-label="${r.id}">${r.c ? '' : '⦸'}</button>`).join('')}</div>`;
    return `
      <div class="nb-editor">
        <div class="nb-tabs">${tabs.map(([id, n]) => `<button class="nb-tab${tab === id ? ' on' : ''}" data-tab="${id}">${n}</button>`).join('')}</div>
        <div class="nb-panel">${body}</div>
        <div class="nb-actions"><button class="btn btn-primary" id="nb-done">เสร็จแล้ว ✨</button></div>
      </div>`;
  }

  function bindEditor() {
    const c = nb.cover;
    root.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; selected = -1; draw(); }));
    root.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => { c[b.dataset.set] = b.dataset.v; save(); draw(); }));
    root.querySelectorAll('[data-theme]').forEach(b => b.addEventListener('click', () => {
      const t = THEMES.find(x => x.id === b.dataset.theme);
      Object.assign(c, t.cover, { theme: t.id });
      save(); draw();
    }));
    root.querySelector('#nb-pack')?.addEventListener('click', () => {
      const t = THEMES.find(x => x.id === c.theme);
      const spots = [[14, 12], [86, 14], [12, 88], [88, 86], [50, 8], [24, 70]];
      const pick = a => a[Math.floor(Math.random() * a.length)];
      const items = [...t.pack.slice(0, 3).map(e => ({ e })),
        ...(t.words?.length ? [{ t: 'w', e: pick(t.words), v: Math.floor(Math.random() * WORD_STYLES) }] : []),
        ...(t.doodles?.length ? [{ t: 'd', e: pick(t.doodles), c: pick(DOODLE_INKS) }] : [])];
      items.forEach((it, k) => {
        if (c.stickers.length >= 30) return;
        const [x, y] = spots[(c.stickers.length + k) % spots.length];
        c.stickers.push({ ...it, x: x + Math.random() * 6 - 3, y: y + Math.random() * 6 - 3, r: Math.round(Math.random() * 40 - 20), s: 1 });
      });
      save(); draw();
    });
    root.querySelector('#nb-done').addEventListener('click', () => { selected = -1; view = 'cover'; draw(); });
    const title = root.querySelector('#nb-title');
    if (title) title.addEventListener('input', () => {
      c.title = title.value;
      save();
      root.querySelector('.nb-title').textContent = c.title.trim() || `สมุดของ${entity.name}`;
    });
    root.querySelectorAll('[data-stkset]').forEach(b => b.addEventListener('click', () => { stkSet = b.dataset.stkset; draw(); }));
    root.querySelectorAll('[data-ink]').forEach(b => b.addEventListener('click', () => { ink = b.dataset.ink; draw(); }));
    root.querySelectorAll('[data-stk-ink]').forEach(b => b.addEventListener('click', () => {
      const s = c.stickers[selected];
      if (s) { s.c = b.dataset.stkInk; save(); draw(); }
    }));
    root.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => {
      if (c.stickers.length >= 30) { window.showToast?.('ปกเต็มแล้ว ลอกออกบ้างนะ'); return; }
      const { t, v, c: col } = b.dataset;
      const extra = t === 'w' ? { t, v: +v || 0 } : t === 'd' ? { t, c: col || ink } : {};
      // words lie flatter than emoji so they stay readable
      const tilt = t === 'w' ? 16 : 40;
      c.stickers.push({ e: b.dataset.add, ...extra, x: 12 + Math.random() * 76, y: 10 + Math.random() * 80, r: Math.round(Math.random() * tilt - tilt / 2), s: 1 });
      selected = c.stickers.length - 1;
      save(); draw();
    }));
    root.querySelectorAll('[data-stk]').forEach(b => b.addEventListener('click', () => {
      const s = c.stickers[selected];
      if (!s) return;
      const act = b.dataset.stk;
      if (act === 'style') s.v = ((s.v || 0) + 1) % WORD_STYLES;
      if (act === 'small') s.s = Math.max(0.6, +(s.s - 0.2).toFixed(1));
      if (act === 'big') s.s = Math.min(2.4, +(s.s + 0.2).toFixed(1));
      if (act === 'rot') s.r = ((s.r || 0) + 15) % 360;
      if (act === 'del') { c.stickers.splice(selected, 1); selected = -1; }
      if (act === 'done') selected = -1;
      save(); draw();
    }));
    root.querySelector('#nb-clear-stk')?.addEventListener('click', () => {
      if (!confirm('ลอกสติกเกอร์ออกทั้งหมดไหม?')) return;
      c.stickers = []; selected = -1; save(); draw();
    });
    bindStickerDrag();
  }

  // Drag stickers on the cover (works with touch and mouse); a tap selects instead.
  function bindStickerDrag() {
    const coverEl = root.querySelector('#nb-cover');
    coverEl.querySelectorAll('.nb-sticker').forEach(el => {
      const i = +el.dataset.i;
      if (i === selected) el.classList.add('sel');
      el.addEventListener('pointerdown', ev => {
        ev.preventDefault();
        el.setPointerCapture(ev.pointerId);
        const rect = coverEl.getBoundingClientRect();
        const start = { x: ev.clientX, y: ev.clientY };
        let moved = false;
        const s = nb.cover.stickers[i];
        const move = e => {
          if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) return;
          moved = true;
          s.x = Math.min(98, Math.max(2, (e.clientX - rect.left) / rect.width * 100));
          s.y = Math.min(98, Math.max(2, (e.clientY - rect.top) / rect.height * 100));
          el.style.left = s.x + '%';
          el.style.top = s.y + '%';
        };
        const up = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
          save();
          if (!moved) { selected = i; tab = 'sticker'; draw(); }
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      });
    });
  }

  // ── inside: bookmarks + the open section ──
  const hand = () => `font-family:'${nb.cover.font}', var(--font-display)`;
  const ribbonColor = () => RIBBONS.find(r => r.id === nb.cover.ribbon)?.c || 'var(--accent-deep)';
  function bookmarks() {
    return `<div class="nb-marks" style="--mk:${ribbonColor()}">${[['info', '🪪 ข้อมูลพี่'], ['cards', '🃏 ไพ่'], ['signs', '🐦 สัญญาณ']]
      .map(([id, n]) => `<button class="nb-mark${section === id ? ' on' : ''}" data-sec="${id}">${n}</button>`).join('')}</div>`;
  }
  function bindMarks() {
    root.querySelectorAll('[data-sec]').forEach(b => b.addEventListener('click', () => {
      section = b.dataset.sec; nb.lastSection = section; save(); drawInside();
    }));
  }

  function drawInside() {
    if (section === 'info') return drawInfo();
    if (section === 'signs') return drawSigns();
    const list = cards.filter(c => filter === 'all' || (filter === 'noted' ? nb.notes[c.id] : c.suit === filter));
    const pct = Math.round(total / 78 * 100);
    const noted = Object.values(nb.notes).filter(t => t?.trim()).length;
    root.innerHTML = `${bookmarks()}
      <div class="nb-inside">
        <div class="nb-in-head">
          <div class="nb-in-title" style="font-family:'${nb.cover.font}', var(--font-display)">${esc(nb.cover.title?.trim() || `สมุดของ${entity.name}`)}</div>
          <div class="nb-progress"><span style="width:${pct}%"></span></div>
          <div class="nb-in-meta">สะสมแล้ว ${total}/78 ใบ · จดความหมายไว้ ${noted} ใบ</div>
        </div>
        <div class="nb-filters">
          ${[['all', 'ทั้งหมด'], ...Object.entries(SUIT_TH), ['noted', '📝 ที่จดไว้']].map(([id, n]) => `<button class="nb-chip${filter === id ? ' on' : ''}" data-f="${id}">${n}</button>`).join('')}
        </div>
        <div class="nb-grid">
          ${list.map(c => {
            const s = seen[c.id];
            return `<button class="nb-card${s ? ' seen' : ''}" data-id="${c.id}">
              ${s ? `<span class="nb-n">×${s.n}</span>` : ''}${nb.notes[c.id]?.trim() ? '<span class="nb-noted">📝</span>' : ''}
              <span class="nb-sym">${s ? SUIT_SYM[c.suit] || '✦' : '?'}</span>
              <span class="nb-name">${esc(c.nameTH || c.name)}</span></button>`;
          }).join('') || '<p class="nb-hint">ยังไม่มีใบไหนในหมวดนี้</p>'}
        </div>
      </div>
      <div class="nb-actions"><button class="btn btn-ghost" id="nb-close">ปิดสมุด</button></div>`;
    root.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; drawInside(); }));
    root.querySelectorAll('.nb-card').forEach(b => b.addEventListener('click', () => openCard(b.dataset.id)));
    root.querySelector('#nb-close').addEventListener('click', () => { view = 'cover'; draw(); });
    bindMarks();
  }

  // ── 🪪 the entity's info page, system prompt included ──
  let editing = null;
  const getF = k => k.split('.').reduce((o, p) => o?.[p], entity) || '';
  function setF(k, v) {
    const [a, b] = k.split('.');
    if (b) entity[a] = { ...(entity[a] || {}), [b]: v }; else entity[a] = v;
  }
  const activePrompt = () => entity.prompt_versions?.find(v => v.version === entity.active_version)?.prompt || '';

  function fieldHTML(k, label, ph, long) {
    if (editing === k) return `<div class="nb-info-row${long ? ' long' : ''} editing"><span class="nb-info-k">${label}</span>
      <textarea class="nb-info-edit" id="nb-edit-box" rows="${long ? 3 : 1}" placeholder="${ph}" style="${hand()}">${esc(getF(k))}</textarea>
      <span class="nb-info-btns"><button class="btn btn-ghost btn-sm" id="nb-edit-cancel">ยกเลิก</button><button class="btn btn-primary btn-sm" id="nb-edit-save">บันทึก</button></span></div>`;
    const v = getF(k);
    return `<button class="nb-info-row${long ? ' long' : ''}" data-edit="${k}"><span class="nb-info-k">${label}</span>
      <span class="nb-info-v${v ? '' : ' empty'}" style="${hand()}">${v ? esc(v) : 'แตะเพื่อเขียน'}</span><span class="nb-pen">✏️</span></button>`;
  }

  function drawInfo() {
    const versions = entity.prompt_versions || [];
    const prompt = activePrompt();
    root.innerHTML = `${bookmarks()}
      <div class="nb-sheet nb-info">
        <div class="nb-info-head">
          <div class="nb-frame nb-frame-${nb.cover.frame === 'none' ? 'circle' : nb.cover.frame}" style="--ent:${entity.color_primary || '#ffb6c1'}"><span>${esc(entity.icon || '🌙')}</span></div>
          <div class="nb-info-name">${editing === 'name'
            ? `<input class="input" id="nb-edit-box" value="${esc(entity.name)}"><span class="nb-info-btns"><button class="btn btn-ghost btn-sm" id="nb-edit-cancel">ยกเลิก</button><button class="btn btn-primary btn-sm" id="nb-edit-save">บันทึก</button></span>`
            : `<button data-edit="name" style="${hand()}">${esc(entity.name)} <span class="nb-pen">✏️</span></button>`}
            <small>คุยกันมา ${getReadingsByEntity(entityId).length} ครั้ง · สะสมไพ่ ${total}/78</small></div>
        </div>
        <div class="nb-info-grid">${INFO_SHORT.map(([k, l, p]) => fieldHTML(k, l, p)).join('')}</div>
        ${INFO_LONG.map(([k, l, p]) => fieldHTML(k, l, p, true)).join('')}

        <div class="nb-line-label">ระบบพร้อมพ์ · v${entity.active_version || 1}</div>
        ${editing === 'prompt' ? `
          <textarea class="nb-prompt-edit" id="nb-edit-box" rows="10" placeholder="เว้นว่าง = สร้างจากข้อมูลด้านบนเอง">${esc(prompt)}</textarea>
          <div class="nb-info-btns"><button class="btn btn-ghost btn-sm" id="nb-edit-cancel">ยกเลิก</button><button class="btn btn-primary btn-sm" id="nb-edit-save">บันทึกเป็นเวอร์ชันใหม่</button></div>`
        : `<button class="nb-prompt" data-edit="prompt"><span class="nb-prompt-text">${prompt ? esc(prompt) : '<i>ยังไม่ได้เขียนเอง — แอพสร้างจากข้อมูลด้านบนให้</i>'}</span><span class="nb-pen">✏️ แก้</span></button>`}
        ${versions.length > 1 ? `<details class="nb-versions"><summary>เวอร์ชันเก่า (${versions.length - 1})</summary>
          ${versions.filter(v => v.version !== entity.active_version).reverse().map(v => `<div class="nb-ver"><b>v${v.version}</b> ${esc(thDate(v.saved_at))}
            <p>${esc((v.prompt || '(สร้างอัตโนมัติ)').slice(0, 120))}${(v.prompt || '').length > 120 ? '…' : ''}</p>
            <button class="btn btn-ghost btn-sm" data-restore="${v.version}">↩️ ใช้เวอร์ชันนี้</button></div>`).join('')}</details>` : ''}

        <div class="nb-info-more">
          <button class="btn btn-secondary btn-sm" id="nb-overview">📜 ภาพรวมพี่</button>
          <button class="btn btn-secondary btn-sm" id="nb-look">🎨 ไอคอนและสี</button>
          <button class="btn btn-ghost btn-sm nb-danger" id="nb-wipe">🧹 ล้างประวัติแชท</button>
        </div>
      </div>`;
    bindMarks();
    root.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
      editing = b.dataset.edit; drawInfo();
      const box = root.querySelector('#nb-edit-box');
      box?.focus();
    }));
    root.querySelector('#nb-edit-cancel')?.addEventListener('click', () => { editing = null; drawInfo(); });
    root.querySelector('#nb-edit-save')?.addEventListener('click', () => {
      const v = root.querySelector('#nb-edit-box').value.trim();
      if (editing === 'prompt') {
        if (v !== activePrompt()) {
          const vs = [...(entity.prompt_versions || [])];
          const next = (vs[vs.length - 1]?.version || 0) + 1;
          vs.push({ version: next, saved_at: new Date().toISOString(), label: '', prompt: v });
          entity.prompt_versions = vs.slice(-10);
          entity.active_version = next;
        }
      } else if (editing === 'name') { if (v) entity.name = v; }
      else setF(editing, v);
      saveEntity(entity);
      editing = null;
      window.showToast?.('บันทึกแล้ว ✓', 'success');
      drawInfo();
    });
    root.querySelectorAll('[data-restore]').forEach(b => b.addEventListener('click', () => {
      entity.active_version = +b.dataset.restore; saveEntity(entity); drawInfo();
    }));
    root.querySelector('#nb-overview').addEventListener('click', () =>
      import('./overview.js').then(m => m.openOverview(entity)).catch(() => window.showToast?.('เปิดภาพรวมไม่ได้')));
    root.querySelector('#nb-look').addEventListener('click', () => { location.hash = `#/entity/${entityId}`; });
    root.querySelector('#nb-wipe').addEventListener('click', () => {
      if (!confirm(`ล้างประวัติการสนทนากับ ${entity.name} ทั้งหมดไหม?\n(ลบออกถาวร ไม่สามารถกู้คืนได้)`)) return;
      clearEntityReadings(entityId);
      window.showToast?.('ล้างประวัติแล้ว', 'success');
    });
  }

  // ── 🐦 signs: the entity's calling cards + a log of what was seen ──
  let signForm = null;
  function drawSigns() {
    const S = nb.signs;
    const confirmed = id => S.log.filter(l => l.what === id && l.verdict === 'ok').length;
    const cnt = k => S.log.filter(l => l.verdict === k).length;
    const f = signForm;
    root.innerHTML = `${bookmarks()}
      <div class="nb-sheet nb-signs">
        <div class="nb-sheet-name" style="${hand()}">สัญญาณของ${esc(entity.name)}</div>

        <div class="nb-line-label">สัญญาณประจำตัว</div>
        <div class="nb-calls">${S.calling.map(c => `<div class="nb-call"><span class="e">${esc(c.e)}</span>
          <span class="t" style="${hand()}">${esc(c.text)}</span><small>ยืนยัน ${confirmed(c.id)} ครั้ง</small>
          <button class="nb-x" data-uncall="${c.id}" aria-label="ลบ">×</button></div>`).join('')
          || `<p class="nb-line nb-faint">ยังไม่มี · ${esc(entity.name)}มักมาแบบไหน เพิ่มไว้ได้เลย</p>`}
          <div class="nb-call-add"><input class="input" id="nb-call-e" maxlength="4" placeholder="🐦"><input class="input" id="nb-call-t" placeholder="เช่น นกบินวนใกล้ๆ"><button class="btn btn-secondary btn-sm" id="nb-call-add">เพิ่ม</button></div>
        </div>
        <p class="nb-margin-note">พี่จะพูดถึงสัญญาณเจาะจงได้เฉพาะที่อยู่ในรายการนี้</p>

        ${S.log.length ? `<div class="nb-sign-stats"><span>เจอ <b>${S.log.length}</b></span><span class="ok">✓ ${cnt('ok')}</span><span class="no">✗ ${cnt('no')}</span><span class="meh">? ${cnt('meh')}</span><span>ยังไม่ถาม ${S.log.filter(l => !l.verdict).length}</span></div>` : ''}

        ${f ? `<div class="nb-memo nb-sign-form">
          <div class="nb-memo-label">เจออะไร</div>
          <div class="nb-opts">${[...S.calling.map(c => [c.id, `${c.e} ${c.text}`]), ['', '✨ อื่นๆ']].map(([id, n]) => `<button class="nb-chip${f.what === id ? ' on' : ''}" data-what="${id}">${esc(n)}</button>`).join('')}</div>
          <textarea class="nb-write" id="nb-sign-text" rows="2" style="${hand()}" placeholder="เล่าเพิ่ม เช่น นกพิราบเกาะระเบียงจ้องอยู่นาน">${esc(f.text)}</textarea>
          <div class="nb-memo-label">ตอนนั้นรู้สึกยังไง</div>
          <div class="nb-opts">${FEELS.map(x => `<button class="nb-chip${f.feel === x ? ' on' : ''}" data-feel="${x}">${x}</button>`).join('')}</div>
          <div class="nb-actions"><button class="btn btn-ghost btn-sm" id="nb-sign-save">จดไว้เฉยๆ</button><button class="btn btn-primary btn-sm" id="nb-sign-ask">🃏 ถามพี่ว่าใช่ไหม</button></div>
        </div>` : '<div class="nb-actions"><button class="btn btn-primary" id="nb-sign-new">＋ เจออะไรมา จดไว้</button></div>'}

        ${S.log.length ? `<div class="nb-line-label">บันทึก · ${S.log.length} ครั้ง</div>
          <div class="nb-entries">${[...S.log].reverse().map(l => {
            const c = S.calling.find(x => x.id === l.what);
            const card = l.card && cards.find(x => x.id === l.card);
            return `<div class="nb-entry"><div class="nb-entry-date">${esc(thDate(l.date))}
              ${l.verdict ? `<span class="nb-verdict ${l.verdict}">${VERDICT[l.verdict]}</span>` : `<button class="nb-verdict ask" data-askold="${l.id}">ถามพี่</button>`}</div>
              <div class="nb-entry-q">${c ? esc(`${c.e} ${c.text}`) : ''}${c && l.text ? ' · ' : ''}${esc(l.text || '')}</div>
              <div class="nb-entry-said">${l.feel ? `รู้สึก: ${esc(l.feel)}` : ''}${l.feel && card ? ' · ' : ''}${card ? `ไพ่: ${esc(card.nameTH || card.name)}${nb.notes[card.id] ? ` (ที่จดไว้: ${esc(nb.notes[card.id])})` : ''}` : ''}</div></div>`;
          }).join('')}</div>` : ''}
      </div>`;
    bindMarks();

    root.querySelector('#nb-call-add').addEventListener('click', () => {
      const t = root.querySelector('#nb-call-t').value.trim();
      if (!t) return;
      S.calling.push({ id: `c${Date.now()}`, e: root.querySelector('#nb-call-e').value.trim() || '✨', text: t });
      save(); drawSigns();
    });
    root.querySelectorAll('[data-uncall]').forEach(b => b.addEventListener('click', () => {
      if (!confirm('เอาสัญญาณนี้ออกจากรายการไหม? (บันทึกเดิมยังอยู่)')) return;
      S.calling = S.calling.filter(c => c.id !== b.dataset.uncall); save(); drawSigns();
    }));
    root.querySelector('#nb-sign-new')?.addEventListener('click', () => { signForm = { what: S.calling[0]?.id || '', text: '', feel: '' }; drawSigns(); });
    root.querySelectorAll('[data-what]').forEach(b => b.addEventListener('click', () => { keepText(); f.what = b.dataset.what; drawSigns(); }));
    root.querySelectorAll('[data-feel]').forEach(b => b.addEventListener('click', () => { keepText(); f.feel = f.feel === b.dataset.feel ? '' : b.dataset.feel; drawSigns(); }));
    function keepText() { const t = root.querySelector('#nb-sign-text'); if (t && f) f.text = t.value; }
    const draw1 = () => cards[Math.floor(Math.random() * cards.length)];
    function store(ask) {
      keepText();
      const entry = { id: `s${Date.now()}`, date: new Date().toISOString(), what: f.what || null, text: f.text.trim(), feel: f.feel };
      if (ask) { const c = draw1(); entry.card = c.id; entry.verdict = verdictOf(c); }
      S.log.push(entry); signForm = null; save(); drawSigns();
      if (ask) window.showToast?.(`🃏 ${entry.card && (cards.find(x => x.id === entry.card)?.nameTH)} · ${VERDICT[entry.verdict]}`);
    }
    root.querySelector('#nb-sign-save')?.addEventListener('click', () => store(false));
    root.querySelector('#nb-sign-ask')?.addEventListener('click', () => store(true));
    root.querySelectorAll('[data-askold]').forEach(b => b.addEventListener('click', () => {
      const l = S.log.find(x => x.id === b.dataset.askold); const c = draw1();
      l.card = c.id; l.verdict = verdictOf(c); save(); drawSigns();
    }));
  }

  // A card's own page in the notebook — lined paper, written like a journal, flip with ‹ › or a swipe
  let pageId = null;
  let pageList = [];
  const thDate = d => { try { return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); } catch { return d || ''; } };

  function openCard(id) {
    pageList = cards.filter(c => filter === 'all' || (filter === 'noted' ? nb.notes[c.id] : c.suit === filter)).map(c => c.id);
    pageId = id;
    view = 'page';
    drawPage();
    window.scrollTo({ top: 0 });
  }

  function drawPage(dir = 0) {
    const id = pageId;
    const card = cards.find(c => c.id === id);
    const s = seen[id];
    const byId = Object.fromEntries(cards.map(c => [c.id, c]));
    const partners = s ? Object.entries(s.with).sort((a, b) => b[1] - a[1]).slice(0, 3).filter(([, n]) => n > 1) : [];
    const hits = s ? [...s.hits].reverse() : [];
    const at = pageList.indexOf(id);
    const hand = `font-family:'${nb.cover.font}', var(--font-display)`;
    root.innerHTML = `
      <div class="nb-sheet${dir ? (dir > 0 ? ' flip-next' : ' flip-prev') : ''}" id="nb-sheet">
                <div class="nb-sheet-head">
          <div class="nb-mini${s ? ' seen' : ''}"><span>${s ? SUIT_SYM[card.suit] || '✦' : '?'}</span></div>
          <div class="nb-sheet-titles">
            <div class="nb-sheet-name" style="${hand}">${esc(card.nameTH || card.name)}</div>
            <div class="nb-sheet-en">${esc(card.name)} · ${SUIT_TH[card.suit] || ''}</div>
          </div>
          ${s ? `<div class="nb-stamp">ออก ${s.n} ครั้ง${s.jumper ? `<br>✨ กระเด็น ${s.jumper}` : ''}</div>` : '<div class="nb-stamp faint">ยังไม่เคยออก</div>'}
        </div>

        <div class="nb-memo">
          <div class="nb-memo-label">ใบนี้ของ${esc(entity.name)} หมายถึง… <span class="nb-saved" id="nb-saved"></span></div>
          <textarea class="nb-write" id="nb-note" rows="2" style="${hand}" placeholder="แตะเพื่อจด เช่น พี่ไปทำงาน">${esc(nb.notes[id] || '')}</textarea>
          <div class="nb-margin-note">ครั้งหน้าที่ใบนี้ออก จะแปลตามที่จดก่อนตำรา</div>
        </div>

        <div class="nb-line-label">ตำราว่า</div>
        <p class="nb-line">${esc(card.meaning || (card.keywords || []).join(', '))}</p>

        ${partners.length ? `<div class="nb-line-label">มักมากับ</div>
          <p class="nb-line">${partners.map(([o, n]) => `<button class="nb-tag" data-go="${o}">${esc(byId[o]?.nameTH || o)} ×${n}</button>`).join(' ')}</p>` : ''}

        ${hits.length ? `<div class="nb-line-label">บันทึกที่ผ่านมา · ${hits.length} ครั้ง</div>
          <div class="nb-entries">${hits.map(h => {
            const msgs = (h.r.decode?.messages || []).filter(m => m.cards?.includes(id)).map(m => m.text);
            const said = (h.r.messages?.find(m => m.role === 'assistant')?.content || '').replace(/\s+/g, ' ').trim();
            return `<a class="nb-entry" href="#/chat/${entityId}/reading/${h.r.id}">
              <div class="nb-entry-date">${esc(thDate(h.r.date))}${h.jumper ? '<span class="nb-jump">✨ กระเด็น</span>' : ''}</div>
              <div class="nb-entry-q">${esc(h.r.question || '(ไม่มีคำถาม)')}</div>
              ${msgs.length ? `<div class="nb-entry-msg"><mark>${esc(msgs.join(' / '))}</mark></div>` : ''}
              ${said ? `<div class="nb-entry-said">${esc(entity.name)}: “${esc(said.length > 110 ? said.slice(0, 110) + '…' : said)}”</div>` : ''}
            </a>`;
          }).join('')}</div>` : `<p class="nb-line nb-faint">ยังไม่เคยออกกับ${esc(entity.name)} จดความหมายไว้ล่วงหน้าได้นะ</p>`}
        <div class="nb-pageno">— ${at + 1} / ${pageList.length} —</div>
      </div>
      <div class="nb-pager">
        <button class="btn btn-ghost btn-sm" id="nb-prev" ${at <= 0 ? 'disabled' : ''}>‹ หน้าก่อน</button>
        <button class="btn btn-ghost btn-sm" id="nb-toc">สารบัญ</button>
        <button class="btn btn-ghost btn-sm" id="nb-next" ${at >= pageList.length - 1 ? 'disabled' : ''}>หน้าถัดไป ›</button>
      </div>`;

    const go = step => {
      const k = pageList.indexOf(pageId) + step;
      if (k < 0 || k >= pageList.length) return;
      pageId = pageList[k];
      drawPage(step);
    };
    root.querySelector('#nb-prev').addEventListener('click', () => go(-1));
    root.querySelector('#nb-next').addEventListener('click', () => go(1));
    root.querySelector('#nb-toc').addEventListener('click', () => { view = 'inside'; draw(); });
    root.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
      if (!pageList.includes(b.dataset.go)) pageList = cards.map(c => c.id);
      pageId = b.dataset.go;
      drawPage(1);
    }));

    // swipe to flip (ignored while writing)
    const sheet = root.querySelector('#nb-sheet');
    let sx = null, sy = 0;
    sheet.addEventListener('touchstart', e => { if (e.target.closest('textarea')) { sx = null; return; } sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    sheet.addEventListener('touchend', e => {
      if (sx === null) return;
      const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
      sx = null;
    });

    // the note grows with what's written and saves as you type
    const note = root.querySelector('#nb-note');
    const grow = () => { note.style.height = 'auto'; note.style.height = Math.max(56, note.scrollHeight) + 'px'; };
    grow();
    let t;
    note.addEventListener('input', () => {
      grow();
      clearTimeout(t);
      t = setTimeout(() => {
        const v = note.value.trim();
        if (v) nb.notes[id] = v; else delete nb.notes[id];
        save();
        const mark = root.querySelector('#nb-saved');
        if (mark) { mark.textContent = 'บันทึกแล้ว ✓'; setTimeout(() => { mark.textContent = ''; }, 1500); }
      }, 400);
    });
  }

  draw();
}

// Cards in this reading that have never come up with this entity before.
export function freshCards(cards, earlierReadings) {
  const had = new Set(earlierReadings.flatMap(r => (r.cards || []).map(c => c.id)));
  const fresh = cards.filter(c => !had.has(c.id));
  const total = new Set([...had, ...cards.map(c => c.id)]).size;
  return { fresh, total };
}
