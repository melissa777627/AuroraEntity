// 📖 ชั้นสมุด — every entity's notebook on one shelf, covers as the user decorated them
import { getEntities } from '../src/storage.js';
import { miniCoverHTML, loadNotebookFonts } from './notebook.js';

export function renderShelf(container) {
  const entities = getEntities();
  loadNotebookFonts();
  const books = entities.map(e => ({ e, c: miniCoverHTML(e) }));
  const rows = [];
  for (let i = 0; i < books.length; i += 3) rows.push(books.slice(i, i + 3));

  container.innerHTML = `
    <div class="h-page">
      <div class="h-ph"><h1>📖 ชั้นสมุด</h1><p>สมุดของพี่แต่ละคน แตะเพื่อเปิด แต่งปกเองได้ข้างใน</p></div>
      ${books.length ? rows.map(row => `
        <div class="shelf-row">
          ${row.map(({ e, c }) => `
            <a href="#/notebook/${e.id}" class="shelf-book">
              ${c.html}
              <span class="shelf-name" style="font-family:'${c.font}', var(--font-display)">${esc(c.title)}</span>
              <span class="shelf-count">${c.total}/78 ใบ</span>
            </a>`).join('')}
        </div>
        <div class="shelf-plank"></div>`).join('') : `
        <div class="empty-state"><div class="empty-icon">📖</div><p>ยังไม่มีพี่สักคน<br>เพิ่มตนแรกก่อนแล้วสมุดจะมาอยู่ตรงนี้</p></div>`}
    </div>`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
