import { saveEntity, deleteEntity, getEntityById } from '../src/storage.js';
import { navigate, showToast } from '../src/app.js';

const PRESET_COLORS = ['#c8a4d4','#a4c8d4','#a4d4a8','#d4c8a4','#d4a4a4','#a4a4d4','#d4a4c8','#c4b8a8'];
const ICONS = ['🌙','⭐','🌸','🔥','💧','🌿','❄️','⚡','🌊','🌺','🌻','🌹','🍀','🦋','🐉','🦅','🌙','☀️','🌈','💫','✨','🌟','🔮','💎','🪄','🌀','🎭','👁️','🗡️','🛡️'];

function generateId() { return `entity_${Date.now()}`; }

export function renderProfilePage(entityId, container) {
  const isNew = !entityId || entityId === 'new';
  const entity = isNew ? createBlankEntity() : (getEntityById(entityId) || createBlankEntity());

  container.innerHTML = `
    <div class="page">
      <div class="page-header" style="display:flex;align-items:center;gap:12px">
        <button class="btn-ghost" onclick="history.back()">← กลับ</button>
        <div>
          <h1 class="page-title">${isNew ? '✨ สร้าง Entity ใหม่' : `✏️ แก้ไข ${entity.name || 'Entity'}`}</h1>
          <p class="page-subtitle">${isNew ? 'เพิ่มตนใหม่เข้าสู่ Oracle' : 'แก้ไข profile ของตน'}</p>
        </div>
      </div>

      <div class="profile-page">

        <!-- ── Basic Info ── -->
        <div class="profile-section">
          <div class="profile-section-title">ข้อมูลพื้นฐาน</div>

          <div style="display:flex;gap:16px;align-items:flex-start">
            <div style="flex-shrink:0;text-align:center">
              <div id="icon-preview" style="font-size:3rem;width:72px;height:72px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:var(--bg-secondary);border:2px solid var(--accent);cursor:pointer" title="คลิกเพื่อเปลี่ยน icon">
                ${entity.icon || '🌙'}
              </div>
            </div>
            <div style="flex:1">
              <div class="form-group">
                <label class="form-label">ชื่อ</label>
                <input type="text" class="input" id="name-input" value="${esc(entity.name)}" placeholder="ชื่อของตน">
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                <div class="form-group">
                  <label class="form-label">สรรพนาม (ตัวเอง)</label>
                  <input type="text" class="input" id="pronoun-self" value="${esc(entity.pronouns?.self)}" placeholder="เช่น ข้า, พี่, ฉัน">
                </div>
                <div class="form-group">
                  <label class="form-label">เรียกผู้ถามว่า</label>
                  <input type="text" class="input" id="pronoun-user" value="${esc(entity.pronouns?.callUser)}" placeholder="เช่น เจ้า, น้อง, หนู">
                </div>
              </div>
            </div>
          </div>

          <!-- Icon Picker -->
          <div id="icon-picker-panel" style="display:none;margin-top:12px">
            <div class="profile-section-title">เลือก Icon</div>
            <div class="icon-picker-grid">${ICONS.map(ic => `
              <div class="icon-option${ic === entity.icon ? ' selected' : ''}" data-icon="${ic}">${ic}</div>
            `).join('')}</div>
          </div>
        </div>

        <!-- ── Personality ── -->
        <div class="profile-section">
          <div class="profile-section-title">บุคลิกและภาษา</div>
          <div class="form-group">
            <label class="form-label">บุคลิก</label>
            <textarea class="textarea input" id="personality-input" placeholder="บุคลิกของตน เช่น เยือกเย็น ลึกลับ ชอบพูดเป็นปริศนา...">${esc(entity.personality)}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">รูปแบบภาษา</label>
            <textarea class="textarea input" id="language-input" placeholder="สไตล์การพูด เช่น ราบรื่น โบราณ ใช้คำเชิงกวี...">${esc(entity.language_style)}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">ความสัมพันธ์กับผู้ถาม</label>
            <input type="text" class="input" id="relationship-input" value="${esc(entity.relationship)}" placeholder="เช่น ผู้พิทักษ์, ครูบาอาจารย์, ผู้ที่รัก">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div class="form-group">
              <label class="form-label">ธาตุ</label>
              <select class="input" id="element-select">
                <option value="">-- เลือก --</option>
                ${['ไฟ','น้ำ','ดิน','อากาศ','อีเธอร์','แสง','ความมืด','เวลา','ฝัน'].map(el =>
                  `<option value="${el}" ${entity.element === el ? 'selected' : ''}>${el}</option>`
                ).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">โดเมน / ความถนัด</label>
              <input type="text" class="input" id="domain-input" value="${esc(entity.domain)}" placeholder="เช่น ความรัก, อาชีพ, จิตวิญญาณ">
            </div>
          </div>
        </div>

        <!-- ── Likes / Dislikes ── -->
        <div class="profile-section">
          <div class="profile-section-title">ความชอบส่วนตัว (memory สำหรับ AI)</div>
          <p style="font-size:0.78rem;color:var(--text-soft);margin-bottom:10px">AI จะรู้ข้อมูลนี้เป็น background แต่จะไม่พูดถึงทุกครั้ง เว้นแต่ถูกถามหรือเชื่อมกับบริบท</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div class="form-group">
              <label class="form-label">ชอบ</label>
              <textarea class="textarea input" id="likes-input" placeholder="เช่น ราเมน, แมว, ความสงบ, ท้าทาย" style="min-height:70px">${esc(entity.likes)}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">ไม่ชอบ</label>
              <textarea class="textarea input" id="dislikes-input" placeholder="เช่น ถูกเพิกเฉย, คนโกหก, ความวุ่นวาย" style="min-height:70px">${esc(entity.dislikes)}</textarea>
            </div>
          </div>
        </div>

        <!-- ── Color ── -->
        <div class="profile-section">
          <div class="profile-section-title">สีประจำตัว</div>
          <div class="color-picker-row" style="margin-bottom:10px">
            ${PRESET_COLORS.map(c => `
              <div class="color-swatch${entity.color_primary === c ? ' selected' : ''}"
                data-color="${c}" style="background:${c}" title="${c}"></div>
            `).join('')}
          </div>
          <div class="color-custom-input">
            <label class="form-label" style="margin:0">สี Primary:</label>
            <input type="color" id="color-primary-input" value="${entity.color_primary || '#c8a4d4'}">
            <label class="form-label" style="margin:0;margin-left:10px">สี Secondary:</label>
            <input type="color" id="color-secondary-input" value="${entity.color_secondary || '#ede0f5'}">
          </div>
        </div>

        <!-- ── System Prompt ── -->
        <div class="profile-section">
          <div class="profile-section-title">System Prompt (Version ${entity.active_version || 1})</div>
          <p style="font-size:0.78rem;color:var(--text-soft);margin-bottom:10px">
            ถ้าเว้นว่าง จะ generate จากข้อมูล profile ด้านบนอัตโนมัติ
          </p>
          <div class="form-group">
            <textarea class="textarea input" id="prompt-input" style="min-height:160px" placeholder="ถ้าต้องการกำหนด system prompt เอง ใส่ที่นี่...">${esc(entity.prompt_versions?.find(v => v.version === entity.active_version)?.prompt || '')}</textarea>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <button class="btn btn-ghost" id="view-history-btn" style="font-size:0.8rem">📜 ดูประวัติ prompt</button>
            <span style="font-size:0.75rem;color:var(--text-soft)">${entity.prompt_versions?.length || 1} version(s) บันทึกไว้</span>
          </div>
          <div id="prompt-history-panel" style="display:none;margin-top:12px"></div>
        </div>

        <!-- ── Actions ── -->
        <div style="display:flex;gap:10px;align-items:center">
          <button class="btn btn-primary" id="save-entity-btn">💾 บันทึก</button>
          <button class="btn btn-secondary" id="chat-btn" style="${isNew ? 'display:none' : ''}">💬 เริ่มสนทนา</button>
          ${!isNew ? `<button class="btn btn-danger" id="delete-btn" style="margin-left:auto">🗑️ ลบตนนี้</button>` : ''}
        </div>
      </div>
    </div>`;

  // Icon picker toggle
  const iconPreview = container.querySelector('#icon-preview');
  const iconPanel = container.querySelector('#icon-picker-panel');
  iconPreview.addEventListener('click', () => {
    iconPanel.style.display = iconPanel.style.display === 'none' ? 'block' : 'none';
  });
  container.querySelectorAll('.icon-option').forEach(el => {
    el.addEventListener('click', () => {
      container.querySelectorAll('.icon-option').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
      iconPreview.textContent = el.dataset.icon;
      iconPanel.style.display = 'none';
    });
  });

  // Color swatches
  container.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      container.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('selected'));
      sw.classList.add('selected');
      container.querySelector('#color-primary-input').value = sw.dataset.color;
      // Auto-generate secondary (lighter)
      container.querySelector('#color-secondary-input').value = lighten(sw.dataset.color);
    });
  });

  // Prompt history toggle
  container.querySelector('#view-history-btn')?.addEventListener('click', () => {
    const panel = container.querySelector('#prompt-history-panel');
    if (panel.style.display === 'none') {
      panel.style.display = 'block';
      renderPromptHistory(panel, entity);
    } else { panel.style.display = 'none'; }
  });

  // Save
  container.querySelector('#save-entity-btn').addEventListener('click', () => {
    const updated = buildEntityFromForm(container, entity, isNew);
    if (!updated.name?.trim()) { showToast('กรุณาใส่ชื่อตน', 'error'); return; }
    saveEntity(updated);
    showToast(`บันทึก ${updated.name} เรียบร้อยแล้ว 🌸`, 'success');
    if (isNew) navigate(`#/chat/${updated.id}`);
    else navigate(`#/entity/${updated.id}`);
  });

  // Chat
  container.querySelector('#chat-btn')?.addEventListener('click', () => navigate(`#/chat/${entity.id}`));

  // Delete
  container.querySelector('#delete-btn')?.addEventListener('click', () => {
    if (!confirm(`ลบ "${entity.name}" ออกจาก Oracle ไหม? (ข้อมูลจะหายถาวร)`)) return;
    deleteEntity(entity.id);
    showToast('ลบเรียบร้อยแล้ว', 'success');
    navigate('#/');
  });
}

function renderPromptHistory(panel, entity) {
  const versions = entity.prompt_versions || [];
  if (!versions.length) { panel.innerHTML = '<p style="font-size:0.82rem;color:var(--text-soft)">ยังไม่มีประวัติ</p>'; return; }
  panel.innerHTML = `
    <div class="version-timeline">
      ${versions.slice().reverse().map(v => `
        <div class="version-item${v.version === entity.active_version ? ' active' : ''}">
          <div class="version-meta">
            <span class="version-label">v${v.version}</span>
            ${v.label ? `<span>—</span><span>${esc(v.label)}</span>` : ''}
            ${v.version === entity.active_version ? '<span class="version-active-badge">ใช้งานอยู่</span>' : ''}
            <span style="margin-left:auto">${formatDate(v.saved_at)}</span>
          </div>
          <div style="font-size:0.78rem;color:var(--text-soft);max-height:60px;overflow:hidden;line-height:1.5">
            ${esc(v.prompt || '(auto-generate)')}
          </div>
          ${v.version !== entity.active_version ? `
            <button class="btn btn-ghost" style="font-size:0.75rem;margin-top:6px" data-restore="${v.version}">
              ↩️ ใช้ version นี้
            </button>` : ''}
        </div>
      `).join('')}
    </div>`;

  panel.querySelectorAll('[data-restore]').forEach(btn => {
    btn.addEventListener('click', () => {
      const ver = parseInt(btn.dataset.restore);
      if (!confirm(`ต้องการใช้ v${ver} ไหม?`)) return;
      entity.active_version = ver;
      saveEntity(entity);
      showToast(`เปลี่ยนเป็น v${ver} แล้ว`, 'success');
      panel.style.display = 'none';
    });
  });
}

function buildEntityFromForm(container, entity, isNew) {
  const promptText = container.querySelector('#prompt-input').value.trim();
  const now = new Date().toISOString();
  let versions = [...(entity.prompt_versions || [])];
  let activeVersion = entity.active_version || 1;

  // Save new prompt version if changed
  const activePrompt = versions.find(v => v.version === activeVersion)?.prompt || '';
  if (promptText !== activePrompt && (promptText || activePrompt)) {
    activeVersion = (versions[versions.length - 1]?.version || 0) + 1;
    versions.push({ version: activeVersion, saved_at: now, label: '', prompt: promptText });
    if (versions.length > 10) versions = versions.slice(-10);
  }

  return {
    ...entity,
    id: isNew ? generateId() : entity.id,
    name: container.querySelector('#name-input').value.trim(),
    pronouns: {
      self: container.querySelector('#pronoun-self').value.trim(),
      callUser: container.querySelector('#pronoun-user').value.trim()
    },
    personality: container.querySelector('#personality-input').value.trim(),
    language_style: container.querySelector('#language-input').value.trim(),
    relationship: container.querySelector('#relationship-input').value.trim(),
    element: container.querySelector('#element-select').value,
    domain: container.querySelector('#domain-input').value.trim(),
    likes: container.querySelector('#likes-input').value.trim(),
    dislikes: container.querySelector('#dislikes-input').value.trim(),
    icon: container.querySelector('.icon-option.selected')?.dataset.icon || entity.icon || '🌙',
    color_primary: container.querySelector('#color-primary-input').value,
    color_secondary: container.querySelector('#color-secondary-input').value,
    prompt_versions: versions.length ? versions : [{ version: 1, saved_at: now, label: 'ต้นฉบับ', prompt: promptText }],
    active_version: activeVersion,
    created_at: entity.created_at || now
  };
}

function createBlankEntity() {
  return {
    id: null, name: '', pronouns: { self: '', callUser: '' },
    personality: '', language_style: '', relationship: '',
    element: '', domain: '', likes: '', dislikes: '',
    color_primary: '#c8a4d4', color_secondary: '#ede0f5',
    icon: '🌙',
    prompt_versions: [{ version: 1, saved_at: new Date().toISOString(), label: 'ต้นฉบับ', prompt: '' }],
    active_version: 1, created_at: null
  };
}

function lighten(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + 60);
  const g = Math.min(255, ((n >> 8) & 0xff) + 60);
  const b = Math.min(255, (n & 0xff) + 60);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function esc(s) { return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatDate(s) { try { return new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); } catch { return s || ''; } }
