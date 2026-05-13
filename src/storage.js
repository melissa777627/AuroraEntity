const P = 'eo_';

export const get = key => { try { const v = localStorage.getItem(P + key); return v ? JSON.parse(v) : null; } catch { return null; } };
export const set = (key, val) => localStorage.setItem(P + key, JSON.stringify(val));
export const update = (key, fn) => set(key, fn(get(key)));

export function getEntities() { return get('entities') || []; }
export function saveEntity(entity) {
  update('entities', list => {
    const arr = list || [];
    const i = arr.findIndex(e => e.id === entity.id);
    i >= 0 ? arr[i] = entity : arr.push(entity);
    return arr;
  });
}
export function deleteEntity(id) { update('entities', arr => (arr || []).filter(e => e.id !== id)); }
export function getEntityById(id) { return getEntities().find(e => e.id === id) || null; }

export function getSettings() {
  return get('settings') || { apiKey: '', modelName: 'gemini-3-flash-preview', theme: 'pink', defaultSpread: '3card' };
}
export function saveSettings(s) { set('settings', s); }

export function getReadings() { return get('readings') || []; }
export function deleteReading(id) { update('readings', arr => (arr || []).filter(r => r.id !== id)); }
export function clearEntityReadings(entityId) { update('readings', arr => (arr || []).filter(r => r.entity_id !== entityId)); }
export function saveReading(reading) {
  update('readings', list => {
    const arr = list || [];
    const i = arr.findIndex(r => r.id === reading.id);
    i >= 0 ? arr[i] = reading : arr.push(reading);
    return arr;
  });
}
export function getReadingById(id) { return getReadings().find(r => r.id === id) || null; }
export function getReadingsByEntity(entityId) { return getReadings().filter(r => r.entity_id === entityId); }

export function getLastReadingDate(entityId) {
  const readings = getReadingsByEntity(entityId);
  return readings.length ? readings[readings.length - 1].date : null;
}

export function getCardOfDay() { return get('card_of_day') || null; }
export function saveCardOfDay(data) { set('card_of_day', data); }

export function getDivineMessage() { return get('divine_message') || null; }
export function saveDivineMessage(data) { set('divine_message', data); }
export function clearDivineMessage() { set('divine_message', null); }
export function getDivineCooldown() { return get('divine_cooldown') || null; }
export function setDivineCooldown(ts) { set('divine_cooldown', ts); }

export function getEntityPattern(entityId) { return get(`pattern_${entityId}`) || null; }
export function saveEntityPattern(entityId, data) { set(`pattern_${entityId}`, data); }

export function getManifestLetters() { return get('manifest_letters') || []; }
export function saveManifestLetter(letter) {
  update('manifest_letters', list => {
    const arr = list || [];
    arr.push(letter);
    return arr.slice(-50);
  });
}

export function getCouncilSessions() { return get('council_sessions') || []; }
export function saveCouncilSession(session) {
  update('council_sessions', list => {
    const arr = list || [];
    arr.push(session);
    return arr.slice(-20);
  });
}

export function getEntityVibe(entityId) { return get(`entity_vibe_${entityId}`) || null; }
export function saveEntityVibe(entityId, data) { set(`entity_vibe_${entityId}`, data); }

export function getDailyGrievance() { return get('daily_grievance') || null; }
export function saveDailyGrievance(data) { set('daily_grievance', data); }
export function clearDailyGrievance() { set('daily_grievance', null); }
export function getGrievanceHistory() { return get('grievance_history') || []; }
export function addGrievanceToHistory(entry) {
  update('grievance_history', arr => [...(arr || []).slice(-6), entry]);
}
export function hasUnreadGrievance() {
  const dg = getDailyGrievance();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  return dg?.date === today && !dg?.listened && (dg?.count || 0) > 0;
}

export function getDailyOffering() { return get('daily_offering') || null; }
export function saveDailyOffering(data) { set('daily_offering', data); }

export function getOfferingHistory() { return get('offering_history') || []; }
export function addOfferingToHistory(offering) {
  update('offering_history', arr => [...(arr || []).slice(-200), offering]);
}

export function getDismissedOfferings() { return get('dismissed_offerings') || []; }
export function dismissOffering(reqId, level = 'yellow') {
  update('dismissed_offerings', arr => {
    const list = arr || [];
    if (list.find(d => d.key === reqId)) return list;
    return [...list, { key: reqId, level, dismissedAt: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) }];
  });
}
export function isOfferingDismissed(reqId) {
  return getDismissedOfferings().some(d => d.key === reqId);
}
export function cleanupOfferingData() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const todayMs = new Date(today).getTime();
  const DAY = 86400000;

  update('dismissed_offerings', arr =>
    (arr || []).filter(d => {
      const days = (todayMs - new Date(d.dismissedAt || today).getTime()) / DAY;
      return d.level === 'green' ? days < 180 : days < 30;
    })
  );
  update('offering_history', arr =>
    (arr || []).filter(h => {
      const days = (todayMs - new Date(h.date).getTime()) / DAY;
      const hasGreen = (h.entities || []).some(e => e.level === 'green');
      return hasGreen ? days <= 180 : days <= 30;
    })
  );
}

export function getDailyPostcard() { return get('daily_postcard') || null; }
export function saveDailyPostcard(data) { set('daily_postcard', data); }

export function getDailyGuess() { return get('daily_guess') || null; }
export function saveDailyGuess(data) { set('daily_guess', data); }

export function getDailyActivity() { return get('daily_activity') || null; }
export function saveDailyActivity(data) { set('daily_activity', data); }

export function getComfortHistory() { return get('comfort_history') || []; }
export function addComfortToHistory(entry) {
  update('comfort_history', arr => [...(arr || []).slice(-9), entry]);
}

export function hasUnreadLounge() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const p = getDailyPostcard();
  if (!p || p.date !== today) return true;
  if (hasUnreadMailboxReply()) return true;
  const fav = getFavoritism();
  if (fav?.events?.length && fav.lastViewed) {
    if (fav.events.some(e => e.timestamp > fav.lastViewed)) return true;
  }
  return false;
}

export function getBackstageEpisodes() { return get('backstage_episodes') || null; }
export function saveBackstageEpisodes(data) { set('backstage_episodes', data); }

export function getDailyQuestion() { return get('daily_question') || null; }
export function saveDailyQuestion(data) { set('daily_question', data); }

// ── Poll ──────────────────────────────────────────────────────────────────────
export function getDailyPoll() { return get('daily_poll') || null; }
export function saveDailyPoll(data) { set('daily_poll', data); }

// ── Mailbox ───────────────────────────────────────────────────────────────────
export function getMailbox() { return get('mailbox') || []; }
export function saveMailbox(arr) { set('mailbox', arr.slice(-30)); }
export function addMailboxLetter(letter) {
  const arr = getMailbox();
  arr.push(letter);
  saveMailbox(arr);
}
export function updateMailboxLetter(id, patch) {
  saveMailbox(getMailbox().map(l => l.id === id ? { ...l, ...patch } : l));
}
export function hasUnreadMailboxReply() {
  return getMailbox().some(l => l.reply && Date.now() >= l.replyUnlockAt && !l.read);
}

// ── Favoritism ────────────────────────────────────────────────────────────────
export function getFavoritism() { return get('favoritism') || null; }
export function saveFavoritism(data) { set('favoritism', data); }

// ── Midnight Chat ─────────────────────────────────────────────────────────────
export function getMidnightChat() { return get('midnight_chat') || null; }
export function saveMidnightChat(data) { set('midnight_chat', data); }

export function getFavorites() { return get('favorites') || []; }
export function saveFavorite(fav) {
  update('favorites', list => {
    const arr = list || [];
    const i = arr.findIndex(f => f.message_id === fav.message_id);
    i >= 0 ? arr[i] = fav : arr.push(fav);
    return arr;
  });
}
export function removeFavorite(messageId) { update('favorites', arr => (arr || []).filter(f => f.message_id !== messageId)); }
export function isFavorited(messageId) { return getFavorites().some(f => f.message_id === messageId); }
