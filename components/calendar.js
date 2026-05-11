import { getReadings } from '../src/storage.js';
import { navigate } from '../src/app.js';

export function renderCalendar(container) {
  let year = new Date().getFullYear();
  let month = new Date().getMonth();

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">📅 Reading Calendar</h1>
      </div>
      <div class="streak-badges" id="streak-badges"></div>
      <div class="calendar-header">
        <button class="btn-icon" id="prev-month">◀</button>
        <div class="calendar-month-title" id="month-title"></div>
        <button class="btn-icon" id="next-month">▶</button>
      </div>
      <div class="calendar-grid" id="cal-grid"></div>
      <div id="day-readings" style="margin-top:16px"></div>
    </div>`;

  container.querySelector('#prev-month').addEventListener('click', () => { month--; if (month < 0) { month = 11; year--; } render(); });
  container.querySelector('#next-month').addEventListener('click', () => { month++; if (month > 11) { month = 0; year++; } render();});

  function render() {
    const readings = getReadings();
    renderStreaks(container.querySelector('#streak-badges'), readings);
    renderMonth(container, year, month, readings);
  }

  render();
}

function renderStreaks(el, readings) {
  const dates = [...new Set(readings.map(r => r.date))].sort();
  let streak = 0, longest = 0, cur = 0;
  const today = new Date().toISOString().split('T')[0];
  let prev = null;
  for (const d of dates) {
    if (prev) {
      const diff = (new Date(d) - new Date(prev)) / 86400000;
      cur = diff === 1 ? cur + 1 : 1;
    } else { cur = 1; }
    longest = Math.max(longest, cur);
    prev = d;
  }
  if (dates.includes(today) || dates.includes(yesterday(today))) streak = cur;
  el.innerHTML = `
    <div class="streak-badge"><div class="streak-num">${streak}</div><div class="streak-label">streak ปัจจุบัน</div></div>
    <div class="streak-badge"><div class="streak-num">${longest}</div><div class="streak-label">streak ยาวที่สุด</div></div>
    <div class="streak-badge"><div class="streak-num">${readings.length}</div><div class="streak-label">readings ทั้งหมด</div></div>`;
}

function renderMonth(container, year, month, readings) {
  const title = container.querySelector('#month-title');
  const grid = container.querySelector('#cal-grid');
  const dayPanel = container.querySelector('#day-readings');

  title.textContent = new Date(year, month, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  const byDate = {};
  readings.forEach(r => { if (!byDate[r.date]) byDate[r.date] = []; byDate[r.date].push(r); });

  const dayNames = ['อา','จ','อ','พ','พฤ','ศ','ส'];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  grid.innerHTML = dayNames.map(d => `<div class="calendar-day-header">${d}</div>`).join('') +
    Array.from({ length: firstDay }, () => '<div class="calendar-day empty"></div>').join('') +
    Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      const hasR = !!byDate[dateStr];
      const isToday = dateStr === today;
      return `<div class="calendar-day${isToday?' today':''}${hasR?' has-reading':''}" data-date="${dateStr}">${day}</div>`;
    }).join('');

  grid.querySelectorAll('.calendar-day[data-date]').forEach(el => {
    el.addEventListener('click', () => {
      const rds = byDate[el.dataset.date];
      if (!rds?.length) { dayPanel.innerHTML = ''; return; }
      dayPanel.innerHTML = `
        <div class="reading-separator">${el.dataset.date}</div>
        ${rds.map(r => `
          <div class="search-result-item" style="cursor:pointer" data-entity="${r.entity_id}" data-reading="${r.id}">
            <div class="search-result-meta"><span>${r.context || 'ไม่ระบุบริบท'}</span></div>
            <div style="font-size:0.8rem;color:var(--text-soft)">${(r.cards||[]).map(c=>c.name).join(' • ')}</div>
          </div>`).join('')}`;
      dayPanel.querySelectorAll('[data-entity]').forEach(el => {
        el.addEventListener('click', () => navigate(`#/chat/${el.dataset.entity}/reading/${el.dataset.reading}`));
      });
    });
  });
}

function yesterday(d) { const dt = new Date(d); dt.setDate(dt.getDate() - 1); return dt.toISOString().split('T')[0]; }
