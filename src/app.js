import { getEntities, getSettings, getEntityVibe, saveEntityVibe, hasUnreadGrievance, hasUnreadLounge, hasUnreadBackstage } from './storage.js';
import { callEntityVibe } from './api.js';
import { getMoonPhase } from './moonphase.js';
import { renderHome } from '../components/home.js';
import { renderChat } from '../components/chat.js';
import { renderSettings } from '../components/settings.js';
import { renderFavorites } from '../components/favorites.js';
import { renderSearch } from '../components/search-page.js';
import { renderCalendar } from '../components/calendar.js';
import { renderMulti } from '../components/multi-consult.js';
import { renderProfilePage } from '../components/profile-modal.js';
import { renderCardOfDayPage } from '../components/card-of-day.js';
import { renderLounge, tryBgFavUpdate } from '../components/lounge.js';
import { renderCouncil } from '../components/council.js';
import { renderGrievance } from '../components/grievance.js';
import { renderOffering } from '../components/offering.js';
import { renderBackstage, prefetchMidnightChat, prefetchBackstageEpisodes } from '../components/backstage.js';

// ── Global navigate helper exposed to inline onclick ──
export function navigate(hash) { location.hash = hash; }
window.navigate = navigate;

// ── Entity vibe generator (global for inline onclick) ──
window.resetEntityVibe = function(entityId) {
  saveEntityVibe(entityId, null);
  const vibeArea = document.querySelector(`.entity-vibe-area[data-entity-id="${entityId}"]`);
  if (vibeArea) vibeArea.innerHTML = `<button class="entity-vibe-btn" data-entity-id="${entityId}" onclick="event.preventDefault();event.stopPropagation();window.generateEntityVibe('${entityId}')">✦ ดูพลังงานวันนี้</button>`;
};

window.generateEntityVibe = async function(entityId) {
  const entity = getEntities().find(e => e.id === entityId);
  if (!entity) return;

  const btn = document.querySelector(`.entity-vibe-btn[data-entity-id="${entityId}"]`);
  if (btn) { btn.textContent = '⏳'; btn.disabled = true; }

  try {
    const data = await fetch('data/cards.json').then(r => r.json());
    const pool = data.tarot || [];
    const card = pool[Math.floor(Math.random() * pool.length)];
    const vibe = await callEntityVibe(entity, card);
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
    saveEntityVibe(entityId, { date: today, cardId: card.id, cardNameTH: card.nameTH || card.name, reversed: false, vibe });

    const vibeArea = document.querySelector(`.entity-vibe-area[data-entity-id="${entityId}"]`);
    if (vibeArea) vibeArea.innerHTML = `<div class="entity-vibe">🂠 ${esc(card.nameTH || card.name)} · ${esc(vibe)}</div>`;
  } catch {
    if (btn) { btn.textContent = '✦ ดูพลังงานวันนี้'; btn.disabled = false; }
  }
};

// ── Toast ──
let toastContainer;
export function showToast(msg, type = '') {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  const el = document.createElement('div');
  el.className = `toast${type ? ' ' + type : ''}`;
  el.textContent = msg;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
window.showToast = showToast;

// ── Router ──
function getRoute() {
  const hash = location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);
  return { hash, parts };
}

function updateSidebar() {
  const entities = getEntities();
  const list = document.getElementById('entity-nav-list');
  if (!list) return;

  const { hash } = getRoute();

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

  list.innerHTML = entities.map(e => {
    const vibe = getEntityVibe(e.id);
    const vibeHtml = vibe?.date === today && vibe?.vibe
      ? `<div class="entity-vibe">🂠 ${esc(vibe.cardNameTH || '')} · ${esc(vibe.vibe)}<button class="entity-vibe-reset" title="สุ่มใหม่" onclick="event.preventDefault();event.stopPropagation();window.resetEntityVibe('${e.id}')">↺</button></div>`
      : `<button class="entity-vibe-btn" data-entity-id="${e.id}" onclick="event.preventDefault();event.stopPropagation();window.generateEntityVibe('${e.id}')">✦ ดูพลังงานวันนี้</button>`;
    return `
      <a href="#/chat/${e.id}" class="entity-nav-item${hash.includes(e.id) ? ' active' : ''}" data-id="${e.id}">
        <span class="entity-icon">${e.icon || '🌙'}</span>
        <span class="entity-name">${esc(e.name || 'ไม่มีชื่อ')}</span>
      </a>
      <div class="entity-vibe-area" data-entity-id="${e.id}">${vibeHtml}</div>`;
  }).join('') +
    `<a href="#/entity/new" class="entity-nav-item entity-nav-add">
      <span class="entity-icon">+</span>
      <span class="entity-name">เพิ่มตนใหม่</span>
    </a>`;

  // Sidebar footer active state + notification dots
  document.querySelectorAll('.sidebar-footer .nav-link').forEach(link => {
    const route = link.dataset.route;
    link.classList.toggle('active', hash.includes(route));
    if (route === 'grievance') {
      link.classList.toggle('has-notification', hasUnreadGrievance());
    }
    if (route === 'lounge') {
      link.classList.toggle('has-notification', hasUnreadLounge());
    }
    if (route === 'backstage') {
      link.classList.toggle('has-notification', hasUnreadBackstage());
    }
  });

  // Moon badge in sidebar
  let moonBadge = document.getElementById('moon-sidebar');
  if (!moonBadge) {
    moonBadge = document.createElement('div');
    moonBadge.id = 'moon-sidebar';
    moonBadge.style.cssText = 'padding:6px 16px;font-size:0.72rem;color:var(--text-soft);opacity:0.8';
    document.querySelector('.sidebar-header')?.appendChild(moonBadge);
  }
  const moon = getMoonPhase();
  moonBadge.textContent = `${moon.emoji} ${moon.nameTH}`;
  moonBadge.title = moon.meaningTH;
}

function updateMobileNav() {
  const { hash } = getRoute();
  document.querySelectorAll('#mobile-nav a').forEach(a => {
    const route = a.dataset.route || '__';
    a.classList.toggle('active', hash.includes(route));
    if (route === 'grievance') a.classList.toggle('has-notification', hasUnreadGrievance());
    if (route === 'lounge') a.classList.toggle('has-notification', hasUnreadLounge());
    if (route === 'backstage') a.classList.toggle('has-notification', hasUnreadBackstage());
  });
}

async function render() {
  const settings = getSettings();
  const { parts } = getRoute();
  const main = document.getElementById('main-content');
  if (!main) return;

  // Redirect to settings if no API key
  if (!settings.apiKey && parts[0] !== 'settings') {
    location.hash = '#/settings';
    return;
  }

  const [section, param1, , param2] = parts;

  switch (section) {
    case 'entity':
      renderProfilePage(param1, main);
      break;
    case 'chat':
      renderChat(param1, param2, main); // param2 = readingId (#/chat/:id/reading/:rid → parts[3])
      break;
    case 'favorites':
      renderFavorites(main);
      break;
    case 'search':
      renderSearch(main);
      break;
    case 'calendar':
      renderCalendar(main);
      break;
    case 'multi':
      renderMulti(main);
      break;
    case 'lounge':
      renderLounge(main, parts[1]);
      break;
    case 'council':
      renderCouncil(main);
      break;
    case 'grievance':
      renderGrievance(main);
      break;
    case 'offering':
      renderOffering(main);
      break;
    case 'backstage':
      renderBackstage(main, parts[1]);
      break;
    case 'card-of-day':
      renderCardOfDayPage(main);
      break;
    case 'settings':
      renderSettings(main);
      break;
    default:
      renderHome(main); // async — fire and forget, UI updates incrementally
  }

  updateSidebar();
  updateMobileNav();
}

// Handle #/chat/:id/reading/:rid correctly
const _origRender = render;
async function renderFixed() {
  const hash = location.hash.slice(1) || '/';
  const parts = hash.split('/').filter(Boolean);
  const main = document.getElementById('main-content');
  if (!main) return;

  const settings = getSettings();
  if (!settings.apiKey && parts[0] !== 'settings') { location.hash = '#/settings'; return; }

  if (parts[0] === 'card-of-day') {
    renderCardOfDayPage(main);
    updateSidebar(); updateMobileNav();
    return;
  }

  if (parts[0] === 'chat' && parts[1]) {
    const readingId = parts[2] === 'reading' ? parts[3] : undefined;
    renderChat(parts[1], readingId, main);
    updateSidebar(); updateMobileNav();
    return;
  }

  return _origRender();
}

async function seedEntities() {
  const { get, set } = await import('./storage.js');
  if (get('entities') !== null) return; // มีข้อมูลแล้ว (รวมถึง array ว่าง) ไม่ overwrite
  try {
    const res = await fetch('data/entities.json');
    const data = await res.json();
    const arr = data.entities || data;
    if (Array.isArray(arr) && arr.length) set('entities', arr);
  } catch {}
}

window.addEventListener('hashchange', renderFixed);
async function bgFavCheck() {
  const entities = getEntities();
  if (!entities.length) return;
  await tryBgFavUpdate(entities);
  updateSidebar();
  updateMobileNav();
}

window.addEventListener('DOMContentLoaded', async () => {
  await seedEntities();
  renderFixed();
  prefetchBackstageEpisodes(); // generate episode ที่ถึงเวลาแล้วทันที
  prefetchMidnightChat(); // generate ทันทีถ้าเป็นช่วงเที่ยงคืน
  bgFavCheck(); // เช็คทันทีตอนเปิดแอป
  setInterval(prefetchBackstageEpisodes, 60000);
  setInterval(prefetchMidnightChat, 60000); // เช็คทุกนาที
  setInterval(bgFavCheck, 15 * 60 * 1000); // เช็คทุก 15 นาที
});

function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
