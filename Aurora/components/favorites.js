import { getFavorites, removeFavorite, getEntities, saveFavorite } from '../src/storage.js';
import { navigate, showToast } from '../src/app.js';

export function renderFavorites(container) {
  const entities = getEntities();
  const entityMap = Object.fromEntries(entities.map(e => [e.id, e]));

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">❤️ Favorites</h1>
        <p class="page-subtitle">ข้อความที่บันทึกไว้</p>
      </div>

      <div class="favorites-filters">
        <select class="input" id="filter-entity" style="width:auto;min-width:140px">
          <option value="">ทุก Entity</option>
          ${entities.map(e => `<option value="${e.id}">${e.icon || '🌙'} ${esc(e.name)}</option>`).join('')}
        </select>
        <input type="text" class="input" id="filter-tag" placeholder="🏷️ tag..." style="width:120px">
        <input type="date" class="input" id="filter-from" style="width:140px">
        <span style="font-size:0.85rem;color:var(--text-soft)">ถึง</span>
        <input type="date" class="input" id="filter-to" style="width:140px">
        <button class="btn btn-ghost" id="clear-filters">ล้าง</button>
      </div>

      <div id="favorites-list"></div>
    </div>`;

  function renderList() {
    let favs = getFavorites().slice().reverse();
    const entityFilter = container.querySelector('#filter-entity').value;
    const tagFilter = container.querySelector('#filter-tag').value.trim().toLowerCase();
    const fromFilter = container.querySelector('#filter-from').value;
    const toFilter = container.querySelector('#filter-to').value;

    if (entityFilter) favs = favs.filter(f => f.entity_id === entityFilter);
    if (tagFilter) favs = favs.filter(f => (f.tag || '').toLowerCase().includes(tagFilter));
    if (fromFilter) favs = favs.filter(f => f.date >= fromFilter);
    if (toFilter) favs = favs.filter(f => f.date <= toFilter);

    const list = container.querySelector('#favorites-list');
    if (!favs.length) {
      list.innerHTML = `<div class="empty-state"><div class="empty-icon">🤍</div><p>ยังไม่มี Favorites<br>กด ❤️ บน bubble เพื่อบันทึก</p></div>`;
      return;
    }

    list.innerHTML = favs.map(fav => {
      const entity = entityMap[fav.entity_id] || {};
      return `
        <div class="favorite-item" data-fav-id="${fav.message_id}">
          <div class="favorite-item-meta">
            <span>${entity.icon || '🌙'} <strong>${esc(entity.name || fav.entity_name || 'Entity')}</strong></span>
            <span>•</span>
            <span>${formatDate(fav.date)}</span>
            ${fav.tag ? `<span class="favorite-tag">🏷️ ${esc(fav.tag)}</span>` : ''}
          </div>
          <div class="favorite-item-content">${esc(fav.content)}</div>
          <div style="display:flex;gap:8px;margin-top:10px;align-items:center">
            <button class="btn-ghost" style="font-size:0.78rem;padding:4px 8px" data-jump="${fav.reading_id}|${fav.entity_id}">
              📖 ไปดู reading
            </button>
            <button class="btn-ghost" style="font-size:0.78rem;padding:4px 8px" data-edit-tag="${fav.message_id}">
              🏷️ ${fav.tag ? 'แก้ tag' : 'เพิ่ม tag'}
            </button>
            <button class="btn-ghost" style="font-size:0.78rem;padding:4px 8px;color:#c0616b;margin-left:auto" data-remove="${fav.message_id}">
              🗑️
            </button>
          </div>
        </div>`;
    }).join('');

    list.querySelectorAll('[data-jump]').forEach(btn => {
      btn.addEventListener('click', () => {
        const [rid, eid] = btn.dataset.jump.split('|');
        navigate(`#/chat/${eid}/reading/${rid}`);
      });
    });

    list.querySelectorAll('[data-edit-tag]').forEach(btn => {
      btn.addEventListener('click', () => {
        const msgId = btn.dataset.editTag;
        const fav = getFavorites().find(f => f.message_id === msgId);
        const tag = prompt('ใส่ tag:', fav?.tag || '');
        if (tag === null) return;
        saveFavorite({ ...fav, tag: tag.trim() });
        renderList();
        showToast('บันทึก tag แล้ว', 'success');
      });
    });

    list.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        removeFavorite(btn.dataset.remove);
        renderList();
        showToast('เอาออกจาก Favorites แล้ว');
      });
    });
  }

  container.querySelector('#filter-entity').addEventListener('change', renderList);
  container.querySelector('#filter-tag').addEventListener('input', renderList);
  container.querySelector('#filter-from').addEventListener('change', renderList);
  container.querySelector('#filter-to').addEventListener('change', renderList);
  container.querySelector('#clear-filters').addEventListener('click', () => {
    container.querySelector('#filter-entity').value = '';
    container.querySelector('#filter-tag').value = '';
    container.querySelector('#filter-from').value = '';
    container.querySelector('#filter-to').value = '';
    renderList();
  });

  renderList();
}

function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatDate(s) { try { return new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return s || ''; } }
