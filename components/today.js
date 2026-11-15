// ✨ วันนี้ — the daily things in one place: letter status, card of the day, offering, grievance, backstage
import { getCardOfDay, hasUnreadGrievance, hasUnreadBackstage } from '../src/storage.js';
import { letterStatus } from './letter.js';

export function renderToday(container) {
  const date = new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

  const cotd = getCardOfDay();
  const drawn = cotd?.date === todayKey && cotd?.card;
  const cotdText = drawn ? `วันนี้ได้ ${cotd.card.nameTH || cotd.card.name}` : 'ยังไม่ได้จั่วเลย';

  const letter = letterStatus();

  const tile = (href, em, title, sub, badge, tilt) => `
    <a href="${href}" class="t-tile${tilt ? ' ' + tilt : ''}">
      ${badge ? `<span class="t-new">${badge}</span>` : ''}
      <span class="t-em">${em}</span><b>${title}</b><small>${sub}</small>
    </a>`;

  container.innerHTML = `
    <div class="h-page">
      <div class="h-ph"><h1>✨ วันนี้</h1><p>${date}</p></div>
      <div class="t-tiles">
        <a href="#/" class="t-tile wide"><span class="t-em">💌</span><span><b>${letter[0]}</b><small>${letter[1]}</small></span></a>
        ${tile('#/card-of-day', '🃏', 'ไพ่วันนี้', esc(cotdText), '', 'tilt-l')}
        ${tile('#/offering', '🎁', 'ออฟเฟอริ่ง', 'วันนี้มีใครอยากได้อะไร', '', 'tilt-r')}
        ${tile('#/grievance', '🔔', 'ร้องเรียน', 'พี่ๆ มีเรื่องจะฟ้อง', hasUnreadGrievance() ? 'ใหม่' : '', 'tilt-r')}
        ${tile('#/backstage', '🎭', 'บทสนทนาลับ', 'พี่ๆ คุยอะไรกันอยู่', hasUnreadBackstage() ? 'ตอนใหม่' : '', 'tilt-l')}
      </div>
    </div>`;
}

function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
