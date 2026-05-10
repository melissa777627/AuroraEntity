import { getSettings, saveSettings, getEntities, getReadings, getFavorites, set, get } from '../src/storage.js';
import { showToast, navigate } from '../src/app.js';

export function renderSettings(container) {
  const s = getSettings();

  container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <h1 class="page-title">⚙️ Settings</h1>
        <p class="page-subtitle">ตั้งค่า API และค่าเริ่มต้น</p>
      </div>
      <div class="settings-page">

        <div class="profile-section">
          <div class="profile-section-title">Google AI Studio API</div>
          <div class="form-group">
            <label class="form-label">API Key</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input type="password" class="input" id="api-key-input" value="${s.apiKey || ''}"
                placeholder="AIza..." style="flex:1">
              <button class="btn-icon" id="toggle-key" title="แสดง/ซ่อน">👁️</button>
            </div>
            <p style="font-size:0.75rem;color:var(--text-soft);margin-top:4px">
              รับ key ได้ที่ <strong>aistudio.google.com</strong> — key จะเก็บเฉพาะใน browser ของคุณ
            </p>
          </div>
          <div class="form-group">
            <label class="form-label">Model</label>
            <select class="input" id="model-select">
              <optgroup label="Gemini 3 (ใหม่ล่าสุด)">
                <option value="gemini-3-flash-preview" ${s.modelName === 'gemini-3-flash-preview' ? 'selected' : ''}>gemini-3-flash ⚡ (แนะนำ)</option>
                <option value="gemini-3.1-flash-lite-preview" ${s.modelName === 'gemini-3.1-flash-lite-preview' ? 'selected' : ''}>gemini-3.1-flash-lite 💨 (เร็ว ถูก)</option>
                <option value="gemini-3.1-pro-preview" ${s.modelName === 'gemini-3.1-pro-preview' ? 'selected' : ''}>gemini-3.1-pro 🧠 (ฉลาดที่สุด)</option>
              </optgroup>
              <optgroup label="Gemini 2.5">
                <option value="gemini-2.5-flash" ${s.modelName === 'gemini-2.5-flash' ? 'selected' : ''}>gemini-2.5-flash</option>
                <option value="gemini-2.5-pro" ${s.modelName === 'gemini-2.5-pro' ? 'selected' : ''}>gemini-2.5-pro</option>
              </optgroup>
              <optgroup label="Gemini 2.0">
                <option value="gemini-2.0-flash" ${s.modelName === 'gemini-2.0-flash' ? 'selected' : ''}>gemini-2.0-flash</option>
              </optgroup>
            </select>
          </div>
        </div>

        <div class="profile-section">
          <div class="profile-section-title">ค่าเริ่มต้น</div>
          <div class="form-group">
            <label class="form-label">Spread เริ่มต้น</label>
            <select class="input" id="spread-select">
              <option value="1card" ${s.defaultSpread === '1card' ? 'selected' : ''}>1 ใบ</option>
              <option value="3card" ${s.defaultSpread === '3card' ? 'selected' : ''}>3 ใบ (Past/Present/Future)</option>
              <option value="celtic" ${s.defaultSpread === 'celtic' ? 'selected' : ''}>Celtic Cross (10 ใบ)</option>
              <option value="custom" ${s.defaultSpread === 'custom' ? 'selected' : ''}>Custom</option>
            </select>
          </div>
        </div>

        <div style="display:flex;gap:10px">
          <button class="btn btn-primary" id="save-settings-btn">💾 บันทึก</button>
          <button class="btn btn-ghost" id="test-api-btn">🔍 ทดสอบ API</button>
        </div>

        <div id="test-result" style="margin-top:12px;font-size:0.85rem;display:none"></div>

        <div class="profile-section" style="margin-top:24px">
          <div class="profile-section-title">ข้อมูล</div>
          <p style="font-size:0.8rem;color:var(--text-soft);margin-bottom:12px">ข้อมูลทั้งหมดเก็บใน browser — Export ก่อนล้าง cache หรือเปลี่ยนอุปกรณ์</p>
          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn btn-secondary" id="export-btn">💾 Export ข้อมูล</button>
            <label class="btn btn-ghost" style="cursor:pointer">
              📥 Import ข้อมูล
              <input type="file" id="import-file" accept=".json" style="display:none">
            </label>
            <button class="btn btn-ghost" id="clear-cache-btn" style="color:rgba(255,100,100,.7)">🗑️ ล้าง Cache</button>
          </div>
        </div>
      </div>
    </div>`;

  container.querySelector('#clear-cache-btn').addEventListener('click', async () => {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    showToast('ล้าง Cache แล้ว — กำลัง reload...', 'success');
    setTimeout(() => { window.location.href = window.location.href.split('#')[0]; }, 800);
  });

  container.querySelector('#toggle-key').addEventListener('click', () => {
    const inp = container.querySelector('#api-key-input');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  container.querySelector('#save-settings-btn').addEventListener('click', () => {
    const newSettings = {
      ...s,
      apiKey: container.querySelector('#api-key-input').value.trim(),
      modelName: container.querySelector('#model-select').value,
      defaultSpread: container.querySelector('#spread-select').value
    };
    saveSettings(newSettings);
    showToast('บันทึก settings เรียบร้อยแล้ว 🌸', 'success');
  });

  container.querySelector('#export-btn').addEventListener('click', () => {
    const data = {
      entities: getEntities(),
      readings: getReadings(),
      favorites: getFavorites(),
      settings: getSettings(),
      exported_at: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aurora-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export สำเร็จ 💾', 'success');
  });

  container.querySelector('#import-file').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.entities || !data.readings) throw new Error('ไฟล์ไม่ถูกต้อง');
        showImportConfirm(data);
      } catch (err) {
        showToast(`Import ล้มเหลว: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  function showImportConfirm(data) {
    const existing = document.getElementById('import-confirm-overlay');
    if (existing) existing.remove();

    const entities = data.entities || [];
    const readings = data.readings || [];
    const hasData = entities.length > 0;
    const entityList = entities.slice(0, 5).map(e => `<div style="font-size:0.8rem;color:var(--text-soft);padding:2px 0">${e.icon || '🌙'} ${e.name || '?'}</div>`).join('') +
      (entities.length > 5 ? `<div style="font-size:0.75rem;color:rgba(255,255,255,.3)">และอีก ${entities.length - 5} entities...</div>` : '');

    const overlay = document.createElement('div');
    overlay.id = 'import-confirm-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(4px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px';
    overlay.innerHTML = `
      <div style="background:var(--bg-secondary);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:28px;max-width:360px;width:100%">
        <div style="font-size:1.5rem;margin-bottom:12px;text-align:center">📥</div>
        <div style="font-weight:600;margin-bottom:12px;color:var(--text-primary);text-align:center">Import ข้อมูล?</div>
        ${hasData ? `
          <div style="background:rgba(255,255,255,.04);border-radius:10px;padding:12px;margin-bottom:12px">
            <div style="font-size:0.75rem;color:rgba(255,255,255,.4);margin-bottom:6px">พบใน file:</div>
            ${entityList}
            <div style="font-size:0.75rem;color:rgba(255,255,255,.3);margin-top:6px">${readings.length} readings · ${data.settings?.apiKey ? '✓ มี API Key' : '✗ ไม่มี API Key'}</div>
          </div>
        ` : `
          <div style="background:rgba(255,80,80,.08);border:1px solid rgba(255,80,80,.2);border-radius:10px;padding:12px;margin-bottom:12px;text-align:center">
            <div style="color:rgba(255,120,120,.8);font-size:0.85rem">⚠️ ไฟล์นี้ไม่มี entities</div>
            <div style="color:rgba(255,255,255,.3);font-size:0.75rem;margin-top:4px">ลองเช็คว่า export มาจากอุปกรณ์ที่มีข้อมูลจริง</div>
          </div>
        `}
        <div style="font-size:0.78rem;color:rgba(255,100,100,.6);margin-bottom:20px;text-align:center">ข้อมูลปัจจุบันจะถูกแทนที่ทั้งหมด</div>
        <div style="display:flex;gap:10px;justify-content:center">
          <button id="import-cancel-btn" class="btn btn-ghost">ยกเลิก</button>
          <button id="import-confirm-btn" class="btn btn-primary">Import เลย</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    overlay.querySelector('#import-cancel-btn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#import-confirm-btn').addEventListener('click', () => {
      try {
        set('entities', data.entities || []);
        set('readings', data.readings || []);
        set('favorites', data.favorites || []);
        if (data.settings) set('settings', data.settings);

        const saved = get('entities');
        if (saved === null) throw new Error('localStorage ไม่ยอม save');

        const hasApiKey = !!(data.settings?.apiKey);
        const entityCount = (data.entities || []).length;
        const readingCount = (data.readings || []).length;

        overlay.innerHTML = `
          <div style="background:var(--bg-secondary);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:28px;max-width:360px;width:100%;text-align:center">
            <div style="font-size:2rem;margin-bottom:12px">🌸</div>
            <div style="font-weight:600;margin-bottom:8px;color:var(--text-primary)">Import สำเร็จ!</div>
            <div style="font-size:0.85rem;color:var(--text-soft);margin-bottom:20px">
              ${entityCount} entities · ${readingCount} readings
            </div>
            ${!hasApiKey ? `
              <div style="background:rgba(255,200,0,.08);border:1px solid rgba(255,200,0,.2);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:0.8rem;color:rgba(255,210,80,.8)">
                ⚠️ ไฟล์นี้ไม่มี API Key — กรอก API Key ในช่องด้านบนแล้วกด บันทึก
              </div>` : ''}
            <div style="display:flex;gap:10px;justify-content:center">
              <button id="import-done-stay" class="btn btn-ghost">ปิด</button>
              <button id="import-done-go" class="btn btn-primary">ไปหน้าหลัก →</button>
            </div>
          </div>`;

        overlay.querySelector('#import-done-stay').addEventListener('click', () => {
          overlay.remove();
          renderSettings(container); // re-render settings ให้ API key field แสดงค่าใหม่
        });
        overlay.querySelector('#import-done-go').addEventListener('click', () => {
          overlay.remove();
          navigate('#/');
        });
      } catch (err) {
        overlay.remove();
        showToast(`บันทึกไม่สำเร็จ: ${err.message}`, 'error');
      }
    });
  }

  container.querySelector('#test-api-btn').addEventListener('click', async () => {
    const key = container.querySelector('#api-key-input').value.trim();
    const model = container.querySelector('#model-select').value;
    const resultEl = container.querySelector('#test-result');
    resultEl.style.display = 'block';
    resultEl.innerHTML = '<span style="color:var(--text-soft)">⏳ กำลังทดสอบ...</span>';
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'ตอบว่า "ใช่" เท่านั้น' }] }] }) }
      );
      if (res.ok) { resultEl.innerHTML = '<span style="color:#6b9e7e">✅ เชื่อมต่อ API สำเร็จ!</span>'; }
      else {
        const err = await res.json().catch(() => ({}));
        resultEl.innerHTML = `<span style="color:#c0616b">❌ ${err?.error?.message || 'API Error ' + res.status}</span>`;
      }
    } catch (e) {
      resultEl.innerHTML = `<span style="color:#c0616b">❌ ${e.message}</span>`;
    }
  });
}
