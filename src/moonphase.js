const REF_NEW_MOON = new Date('2024-01-11T11:57:00Z').getTime();
const SYNODIC = 29.53058867 * 86400000;

export function getMoonPhase(date = new Date()) {
  const pos = ((date.getTime() - REF_NEW_MOON) % SYNODIC + SYNODIC) % SYNODIC;
  const d = pos / 86400000;
  if (d < 1.85)  return { emoji: '🌑', nameTH: 'พระจันทร์ดับ',      meaningTH: 'เวลาแห่งการเริ่มต้นใหม่' };
  if (d < 7.38)  return { emoji: '🌒', nameTH: 'เสี้ยวแรก',         meaningTH: 'ก้าวออกสู่สิ่งใหม่' };
  if (d < 9.22)  return { emoji: '🌓', nameTH: 'ครึ่งดวงแรก',       meaningTH: 'ถึงเวลาตัดสินใจ' };
  if (d < 12.91) return { emoji: '🌔', nameTH: 'ข้างขึ้น',           meaningTH: 'พลังงานกำลังเติบโต' };
  if (d < 16.61) return { emoji: '🌕', nameTH: 'พระจันทร์เต็มดวง',  meaningTH: 'พลังงานถึงจุดสูงสุด' };
  if (d < 20.30) return { emoji: '🌖', nameTH: 'ข้างแรม',           meaningTH: 'ปล่อยวางสิ่งที่ไม่จำเป็น' };
  if (d < 23.99) return { emoji: '🌗', nameTH: 'ครึ่งดวงหลัง',      meaningTH: 'สำรวจตัวเองจากภายใน' };
  if (d < 27.68) return { emoji: '🌘', nameTH: 'เสี้ยวสุดท้าย',     meaningTH: 'เวลาแห่งการปิดฉาก' };
  return           { emoji: '🌑', nameTH: 'พระจันทร์ดับ',      meaningTH: 'เวลาแห่งการเริ่มต้นใหม่' };
}
