import { search as doSearch } from '../src/search.js';
import { navigate } from '../src/app.js';

export function renderSearch(container) {
  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">🔍 Search</h1>
        <p class="page-subtitle">ค้นหาข้อความจากทุก reading</p>
      </div>
      <div class="search-input-wrapper">
        <span class="search-icon">🔍</span>
        <input type="search" class="input" id="search-input" placeholder="พิมพ์คำที่ต้องการค้นหา..." autofocus>
      </div>
      <div id="search-results"></div>
    </div>`;

  const input = container.querySelector('#search-input');
  const results = container.querySelector('#search-results');
  let debounce;

  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => renderResults(input.value), 250);
  });

  function renderResults(query) {
    if (!query.trim()) { results.innerHTML = ''; return; }
    const hits = doSearch(query);
    if (!hits.length) {
      results.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>ไม่พบผลลัพธ์สำหรับ "${esc(query)}"</p></div>`;
      return;
    }

    results.innerHTML = `<p style="font-size:0.78rem;color:var(--text-soft);margin-bottom:12px">พบ ${hits.length} ผลลัพธ์</p>` +
      hits.map(h => {
        const excerpt = esc(h.excerpt);
        const q = esc(query);
        const highlighted = excerpt.replace(new RegExp(`(${q})`, 'gi'), '<mark class="search-highlight">$1</mark>');
        return `
          <div class="search-result-item" data-reading="${h.readingId}" data-entity="${h.entityId}">
            <div class="search-result-meta">
              <span>${h.entityIcon} <strong>${esc(h.entityName)}</strong></span>
              <span>•</span>
              <span>${formatDate(h.date)}</span>
              ${h.context ? `<span>— ${esc(h.context)}</span>` : ''}
            </div>
            <div class="search-result-excerpt">${highlighted}</div>
          </div>`;
      }).join('');

    results.querySelectorAll('.search-result-item').forEach(el => {
      el.addEventListener('click', () => {
        navigate(`#/chat/${el.dataset.entity}/reading/${el.dataset.reading}`);
      });
    });
  }
}

function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatDate(s) { try { return new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return s || ''; } }
