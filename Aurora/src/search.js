import { getReadings, getEntities } from './storage.js';

export function search(query) {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  const entityMap = Object.fromEntries(getEntities().map(e => [e.id, e]));
  const results = [];

  for (const reading of getReadings()) {
    const entity = entityMap[reading.entity_id] || {};
    for (const msg of (reading.messages || [])) {
      if (msg.role !== 'assistant') continue;
      const content = msg.content || '';
      if (!content.toLowerCase().includes(q)) continue;
      const idx = content.toLowerCase().indexOf(q);
      const start = Math.max(0, idx - 40);
      const end = Math.min(content.length, idx + 80);
      results.push({
        readingId: reading.id,
        entityId: reading.entity_id,
        entityName: entity.name || 'ไม่ทราบชื่อ',
        entityIcon: entity.icon || '🌙',
        date: reading.date,
        messageId: msg.id,
        context: reading.context,
        excerpt: '...' + content.slice(start, end) + '...',
        matchStart: idx - start + 3,
        matchLen: q.length
      });
    }
  }
  return results;
}
