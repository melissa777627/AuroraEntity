import { getEntities, getDailyOffering, saveDailyOffering, getOfferingHistory, addOfferingToHistory, getDismissedOfferings, dismissOffering, cleanupOfferingData } from '../src/storage.js';
import { callOffering } from '../src/api.js';

export async function renderOffering(container) {
  const entities = getEntities();
  if (!entities.length) {
    container.innerHTML = `<div class="page"><div class="empty-state"><div class="empty-icon">🎁</div><p>ยังไม่มีตน — เพิ่มตนก่อนนะ</p></div></div>`;
    return;
  }

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const existing = getDailyOffering();
  const hasTodayResult = existing?.date === today;

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div class="page-title">✦ ขอออฟเฟอริ่ง</div>
        <div class="page-subtitle">พลังงานวันนี้ที่พี่อยากให้ทำ</div>
      </div>
      <div id="offering-today">
        ${hasTodayResult
          ? buildTodayHTML(existing)
          : `<div class="offering-trigger"><button class="btn btn-primary" id="offering-gen-btn">🂠 ดูว่าวันนี้มีใครต้องการอะไร</button></div>`}
      </div>
      <div id="offering-log-section"></div>
    </div>`;

  if (!hasTodayResult) {
    container.querySelector('#offering-gen-btn').addEventListener('click', () => generate(container, entities, today));
  }

  renderRequestLog(container.querySelector('#offering-log-section'));
}

async function generate(container, entities, today) {
  const todayEl = container.querySelector('#offering-today');
  const btn = todayEl.querySelector('#offering-gen-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังถาม...'; }

  try {
    const data = await fetch('data/cards.json').then(r => r.json());
    const pool = data.tarot || [];

    const selected = selectEntities(entities);
    if (!selected.length) {
      const result = { date: today, entities: [] };
      saveDailyOffering(result);
      addOfferingToHistory(result);
      todayEl.innerHTML = buildTodayHTML(result);
      attachRefreshBtn(container, entities, today);
      return;
    }

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const entityCards = selected.map((e, i) => ({
      entity: e,
      card: { ...shuffled[i % shuffled.length], reversed: false }
    }));

    const results = await Promise.all(entityCards.map(({ entity, card }) => callOffering(entity, card)));

    const result = {
      date: today,
      entities: entityCards.map(({ entity, card }, i) => ({
        reqId: `${Date.now()}-${i}`,
        entityId: entity.id,
        entityName: entity.name,
        entityIcon: entity.icon || '🌙',
        card: { name: card.name, nameTH: card.nameTH },
        want: results[i]?.want || '',
        tip: results[i]?.tip || '',
        level: results[i]?.level || 'yellow'
      }))
    };
    saveDailyOffering(result);
    addOfferingToHistory(result);
    todayEl.innerHTML = buildTodayHTML(result);
    renderRequestLog(container.querySelector('#offering-log-section'));
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = '🂠 ดูว่าวันนี้มีใครต้องการอะไร'; }
    window.showToast?.(`เกิดข้อผิดพลาด: ${e.message}`, 'error');
  }
}

function selectEntities(entities) {
  const weights = [0, 0, 1, 2, 2, 3];
  const count = Math.min(weights[Math.floor(Math.random() * weights.length)], entities.length);
  return [...entities].sort(() => Math.random() - 0.5).slice(0, count);
}

function buildTodayHTML(result) {
  const isEmpty = !result.entities?.length;
  const cardsBlock = isEmpty
    ? `<div class="offering-empty-day">✦ วันนี้ทุกคนเงียบๆ ของตัวเอง</div>`
    : result.entities.map(e => `
        <div class="offering-entity-card">
          <div class="offering-entity-header">
            <span class="offering-entity-icon">${esc(e.entityIcon)}</span>
            <span class="offering-entity-name">${esc(e.entityName)}</span>
            <span class="manifest-card-chip-sm">${esc(e.card?.nameTH || e.card?.name || '')}</span>
          </div>
          <div class="offering-entity-want">${escMsg(e.want || e.text || '')}</div>
          ${e.tip ? `<div class="offering-urgency" data-level="${esc(e.level || 'yellow')}">${esc(e.tip)}</div>` : ''}
        </div>`).join('');

  return `
    <div class="offering-today-box">
      <div class="offering-today-header">
        <span class="offering-today-date">${result.date || ''}</span>
      </div>
      ${cardsBlock}
    </div>`;
}

function stableReqKey(r) {
  if (r.reqId) return r.reqId;
  const s = `${r.entityId}::${r.date}::${(r.want || '').slice(0, 40)}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return `h${(h >>> 0).toString(36)}`;
}

function renderRequestLog(container) {
  cleanupOfferingData();

  const history = getOfferingHistory();
  const dismissedKeys = new Set(getDismissedOfferings().map(d => d.key));

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const todayMs = new Date(today).getTime();
  const DAY = 86400000;

  const allRequests = history
    .flatMap(h => (h.entities || []).map(e => ({ ...e, date: h.date })))
    .filter(e => e.want)
    .filter(e => {
      const days = (todayMs - new Date(e.date).getTime()) / DAY;
      return e.level === 'green' ? days <= 180 : days <= 30;
    })
    .map(e => ({ ...e, _key: stableReqKey(e) }));

  if (!allRequests.length) { container.innerHTML = ''; return; }

  const grouped = {};
  for (const req of allRequests) {
    const gkey = req.entityId || req.entityName;
    if (!grouped[gkey]) grouped[gkey] = { entityName: req.entityName, entityIcon: req.entityIcon || '🌙', requests: [] };
    grouped[gkey].requests.push(req);
  }

  const levelScore = { red: 2, yellow: 1, green: 0 };
  const levelIcon = { red: '🔴', yellow: '🟡', green: '🟢' };

  const groups = Object.values(grouped).sort((a, b) => {
    const aMax = Math.max(...a.requests.filter(r => !dismissedKeys.has(r._key)).map(r => levelScore[r.level] ?? 1), -1);
    const bMax = Math.max(...b.requests.filter(r => !dismissedKeys.has(r._key)).map(r => levelScore[r.level] ?? 1), -1);
    return bMax - aMax || b.requests.length - a.requests.length;
  });

  // Preserve which groups are open
  const openNames = new Set();
  container.querySelectorAll('details[open] .offering-log-name').forEach(el => openNames.add(el.textContent));

  container.innerHTML = `
    <div class="manifest-history-title">📋 บันทึกคำขอตามพี่</div>
    ${groups.map(g => {
      const sorted = [...g.requests].sort((a, b) => (levelScore[b.level] ?? 1) - (levelScore[a.level] ?? 1) || b.date.localeCompare(a.date));
      const activeCount = sorted.filter(r => !dismissedKeys.has(r._key)).length;
      const dots = [...new Set(sorted.filter(r => !dismissedKeys.has(r._key)).map(r => levelIcon[r.level] || '🟡'))].join('');
      const isOpen = openNames.has(g.entityName);
      return `
        <details class="offering-entity-group"${isOpen ? ' open' : ''}>
          <summary class="offering-entity-group-header">
            <span class="offering-entity-icon">${esc(g.entityIcon)}</span>
            <span class="offering-log-name">${esc(g.entityName)}</span>
            <span class="offering-log-count">${activeCount}/${g.requests.length} คำขอ</span>
            <span class="offering-group-dots">${dots}</span>
          </summary>
          <table class="offering-request-table">
            <thead><tr><th>วันที่</th><th>คำขอ</th><th></th><th></th></tr></thead>
            <tbody>
              ${sorted.map(r => {
                const done = dismissedKeys.has(r._key);
                return `
                <tr class="${done ? 'offering-row-dismissed' : ''}">
                  <td class="offering-table-date">${esc(r.date || '')}</td>
                  <td class="offering-table-want">${esc(r.want)}</td>
                  <td><span class="offering-urgency offering-urgency-sm" data-level="${esc(r.level || 'yellow')}">${esc(levelIcon[r.level] || '🟡')}</span></td>
                  <td>${done
                    ? `<span class="offering-done-mark">✓</span>`
                    : `<button class="offering-dismiss-btn" data-key="${esc(r._key)}" data-level="${esc(r.level || 'yellow')}">ทำแล้ว</button>`}
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </details>`;
    }).join('')}`;

  container.querySelectorAll('.offering-dismiss-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissOffering(btn.dataset.key, btn.dataset.level);
      renderRequestLog(container);
    });
  });
}

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escMsg(s) { return esc(s).replace(/\n/g, '<br>'); }
