import { getSettings } from './storage.js';
import { buildEntitySystemPrompt, buildAnalysisSystemPrompt, buildUserPrompt, buildAnalysisUserPrompt, buildPatternSystemPrompt, buildPatternUserPrompt, buildManifestSystemPrompt, buildManifestLetterPrompt, buildCouncilPrompt, buildEntityVibePrompt, buildGrievanceSystemPrompt, buildGrievanceUserPrompt, buildGrievanceTonePrompt, buildOfferingSystemPrompt, buildOfferingUserPrompt, buildPostcardSystemPrompt, buildPostcardUserPrompt, buildGuessSystemPrompt, buildGuessUserPrompt, buildGuessReactionSystemPrompt, buildGuessReactionUserPrompt, buildActivitySystemPrompt, buildActivityUserPrompt, buildComfortSystemPrompt, buildComfortUserPrompt, buildBackstagePrompt, buildDailyQuestionPrompt, buildDailyQuestionFeedbackPrompt, buildPollQuestionPrompt, buildPollVotePrompt, buildPollReactionPrompt, buildMailboxSystemPrompt, buildMailboxUserPrompt, buildFavoritismPrompt, buildMidnightChatPrompt, buildMidnightInteractiveSystemPrompt, buildMidnightReplyPrompt } from './prompts.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

function cfg() {
  const s = getSettings();
  if (!s.apiKey) throw new Error('ยังไม่ได้ตั้ง API Key — ไปที่ Settings ก่อนนะ');
  return { key: s.apiKey, model: s.modelName || 'gemini-2.0-flash' };
}

export async function callEntityVoice(entity, context, question, cards, history = [], onChunk) {
  const { key, model } = cfg();

  const contents = history.map(m => ({ role: m.role, parts: [{ text: m.content }] }));
  contents.push({ role: 'user', parts: [{ text: buildUserPrompt(context, question, cards) }] });

  const res = await fetch(`${BASE}/${model}:streamGenerateContent?alt=sse&key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildEntitySystemPrompt(entity) }] },
      contents,
      generationConfig: { temperature: 0.8, maxOutputTokens: 2048 }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API Error ${res.status}`);
  }

  let full = '';
  let usage = null;
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const parsed = JSON.parse(raw);
        const chunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (chunk) { full += chunk; onChunk?.(chunk, full); }
        if (parsed?.usageMetadata) usage = parsed.usageMetadata;
      } catch {}
    }
  }
  return { text: full, usage };
}

export async function callCardOfDayMessage(card) {
  const { key, model } = cfg();
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: `คุณคือผู้อ่านพลังงานประจำวัน ตอบภาษาไทยเท่านั้น 2-3 ประโยคสั้น
ห้ามพูดว่า "ไพ่ใบนี้" — พูดถึงพลังงานโดยตรง
ไม่โลกสวย ไม่กวี — บอกตรงๆ ว่าวันนี้พลังงานนี้หมายความว่าอะไร ควรรับรู้/ระวัง/ทำอะไร` }] },
      contents: [{ role: 'user', parts: [{ text: `พลังงานวันนี้: ${card.name} (${card.nameTH}) | ธาตุ: ${card.element} | พลังงาน: ${card.keywords?.join(', ')}` }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 600 }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

export async function callAnalysis(entity, context, question, cards) {
  const { key, model } = cfg();

  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildAnalysisSystemPrompt(entity) }] },
      contents: [{ role: 'user', parts: [{ text: buildAnalysisUserPrompt(entity, context, question, cards) }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 4096, responseMimeType: 'application/json' }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API Error ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  let clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) clean = m[0];
  try { return JSON.parse(clean); } catch { return { cards: [], overall_energy: text }; }
}

export async function callManifestLetter(entity, wish, cards, onChunk) {
  const { key, model } = cfg();

  const res = await fetch(`${BASE}/${model}:streamGenerateContent?alt=sse&key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildManifestSystemPrompt(entity) }] },
      contents: [{ role: 'user', parts: [{ text: buildManifestLetterPrompt(entity, wish, cards) }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 2048 }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API Error ${res.status}`);
  }

  let full = '';
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const parsed = JSON.parse(raw);
        const chunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (chunk) { full += chunk; onChunk?.(chunk, full); }
      } catch {}
    }
  }
  return full;
}

export async function callCouncilVote(entityCards, question) {
  const { key, model } = cfg();

  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildCouncilPrompt(entityCards, question) }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 2048, responseMimeType: 'application/json' }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API Error ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
  let clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const m = clean.match(/\[[\s\S]*\]/);
  if (m) clean = m[0];
  try { return JSON.parse(clean); } catch { return []; }
}

export async function callEntityVibe(entity, card) {
  const { key, model } = cfg();

  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildEntityVibePrompt(entity, card) }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 512 }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API Error ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

export async function callGrievanceTone(entity, allEntities, cards) {
  const { key, model } = cfg();
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildGrievanceTonePrompt(entity, allEntities, cards) }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 80, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) return { tone: 'serious', subject: 'general' };
  const data = await res.json();
  const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text || '{}').trim();
  const m = raw.match(/\{[\s\S]*?\}/);
  try { return JSON.parse(m?.[0] || raw); } catch { return { tone: 'serious', subject: 'general' }; }
}

export async function callGrievance(entity, allEntities, cards, toneInfo, onChunk) {
  const { key, model } = cfg();

  const res = await fetch(`${BASE}/${model}:streamGenerateContent?alt=sse&key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildGrievanceSystemPrompt(entity, allEntities) }] },
      contents: [{ role: 'user', parts: [{ text: buildGrievanceUserPrompt(cards, toneInfo) }] }],
      generationConfig: { temperature: 0.85, thinkingConfig: { thinkingBudget: 0 } }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API Error ${res.status}`);
  }

  let full = '';
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const parsed = JSON.parse(raw);
        const chunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (chunk) { full += chunk; onChunk?.(chunk, full); }
      } catch {}
    }
  }
  return full;
}

export async function callOffering(entity, card) {
  const { key, model } = cfg();

  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildOfferingSystemPrompt(entity) }] },
      contents: [{ role: 'user', parts: [{ text: buildOfferingUserPrompt(card) }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 1024, thinkingConfig: { thinkingBudget: 0 } }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API Error ${res.status}`);
  }

  const data = await res.json();
  const raw = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  const wantMatch = raw.match(/WANT:\s*(.+?)(?=\nTIP:|\nLEVEL:|$)/s);
  const tipMatch = raw.match(/TIP:\s*(.+?)(?=\nLEVEL:|$)/s);
  const levelMatch = raw.match(/LEVEL:\s*(red|yellow|green)/i);
  const want = wantMatch?.[1]?.trim() || raw.split('\n').find(l => l.trim() && !l.startsWith('TIP:') && !l.startsWith('LEVEL:')) || raw;
  const tip = tipMatch?.[1]?.trim() || '';
  const level = levelMatch?.[1]?.toLowerCase() || 'yellow';
  return { want, tip, level };
}

export async function callPostcard(entity, card) {
  const { key, model } = cfg();
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildPostcardSystemPrompt(entity) }] },
      contents: [{ role: 'user', parts: [{ text: buildPostcardUserPrompt(card) }] }],
      generationConfig: { temperature: 0.88, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

export async function callGuess(entity, card) {
  const { key, model } = cfg();
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildGuessSystemPrompt(entity) }] },
      contents: [{ role: 'user', parts: [{ text: buildGuessUserPrompt(card) }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

export async function callGuessReaction(entity, reactionCard, feedback, onChunk) {
  const { key, model } = cfg();

  const res = await fetch(`${BASE}/${model}:streamGenerateContent?alt=sse&key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildGuessReactionSystemPrompt(entity, feedback) }] },
      contents: [{ role: 'user', parts: [{ text: buildGuessReactionUserPrompt(reactionCard, feedback) }] }],
      generationConfig: { temperature: 0.88, maxOutputTokens: 250, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }

  let full = '';
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const parsed = JSON.parse(raw);
        const chunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (chunk) { full += chunk; onChunk?.(chunk, full); }
      } catch {}
    }
  }
  return full;
}

export async function callActivity(entity, card) {
  const { key, model } = cfg();
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildActivitySystemPrompt(entity) }] },
      contents: [{ role: 'user', parts: [{ text: buildActivityUserPrompt(card) }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 150, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

export async function callComfort(entity, allEntities, worry, onChunk) {
  const { key, model } = cfg();

  const res = await fetch(`${BASE}/${model}:streamGenerateContent?alt=sse&key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildComfortSystemPrompt(entity, allEntities) }] },
      contents: [{ role: 'user', parts: [{ text: buildComfortUserPrompt(worry) }] }],
      generationConfig: { temperature: 0.82, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } }
    })
  });

  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }

  let full = '';
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const parsed = JSON.parse(raw);
        const chunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (chunk) { full += chunk; onChunk?.(chunk, full); }
      } catch {}
    }
  }
  return full;
}

export async function callBackstage(entities, cards, tones, gimmick, interjection) {
  const { key, model } = cfg();
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildBackstagePrompt(entities, cards, tones, gimmick, interjection) }] }],
      generationConfig: { temperature: 0.92, maxOutputTokens: Math.max(1500, entities.length * 500), responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '[]').trim();
  let clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const m = clean.match(/\[[\s\S]*\]/);
  if (m) clean = m[0];
  const parsed = (() => { try { return JSON.parse(clean); } catch { return []; } })();
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('API คืน messages ว่าง — ลองใหม่');
  return parsed;
}

export async function callDailyQuestion(entity, gimmick) {
  const { key, model } = cfg();
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildDailyQuestionPrompt(entity, gimmick) }] }],
      generationConfig: { temperature: 0.88, maxOutputTokens: 120, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

export async function callDailyQuestionFeedback(entity, question, answer) {
  const { key, model } = cfg();
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildDailyQuestionFeedbackPrompt(entity, question, answer) }] }],
      generationConfig: { temperature: 0.88, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

export async function callPatternReading(entity, readings) {
  const { key, model } = cfg();

  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildPatternSystemPrompt(entity) }] },
      contents: [{ role: 'user', parts: [{ text: buildPatternUserPrompt(entity, readings) }] }],
      generationConfig: { temperature: 0.8, maxOutputTokens: 1024, responseMimeType: 'application/json' }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API Error ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  let clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const m = clean.match(/\{[\s\S]*\}/);
  if (m) clean = m[0];
  try { return JSON.parse(clean); } catch { return { summary: text, gimmick: '' }; }
}

// ── ศาลเตี้ยชี้ตัว ────────────────────────────────────────────────────────────
export async function callPollQuestion(entities) {
  const { key, model } = cfg();
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPollQuestionPrompt(entities) }] }],
      generationConfig: { temperature: 0.92, maxOutputTokens: 100, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

export async function callPollEntityVotes(entities, options, question, entityCards) {
  const { key, model } = cfg();
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPollVotePrompt(entities, options, question, entityCards) }] }],
      generationConfig: { temperature: 0.90, maxOutputTokens: 800, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = (parts.find(p => !p.thought)?.text || parts[0]?.text || '[]').trim();
  let clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const m = clean.match(/\[[\s\S]*\]/);
  if (m) clean = m[0];
  const parsed = (() => { try { return JSON.parse(clean); } catch { return []; } })();
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('votes ว่าง — ลองใหม่');
  return parsed;
}

export async function callPollReaction(entity, allEntities, question, onChunk) {
  const { key, model } = cfg();
  const res = await fetch(`${BASE}/${model}:streamGenerateContent?alt=sse&key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPollReactionPrompt(entity, allEntities, question) }] }],
      generationConfig: { temperature: 0.92, maxOutputTokens: 100, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }
  let full = '';
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw || raw === '[DONE]') continue;
      try {
        const parsed = JSON.parse(raw);
        const chunk = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (chunk) { full += chunk; onChunk?.(chunk, full); }
      } catch {}
    }
  }
  return full;
}

// ── ตู้ไปรษณีย์ฝากใจ ──────────────────────────────────────────────────────────
export async function callMailboxReply(entity, message, allEntities) {
  const { key, model } = cfg();
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildMailboxSystemPrompt(entity, allEntities) }] },
      contents: [{ role: 'user', parts: [{ text: buildMailboxUserPrompt(message) }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 350, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

// ── บอร์ดคะแนน ────────────────────────────────────────────────────────────────
export async function callFavoritism(entities, currentScores, entityCards = []) {
  const { key, model } = cfg();
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildFavoritismPrompt(entities, currentScores, entityCards) }] }],
      generationConfig: { temperature: 0.95, maxOutputTokens: 600, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = (parts.find(p => !p.thought)?.text || parts[0]?.text || '[]').trim();
  let clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  const mx = clean.match(/\[[\s\S]*\]/);
  if (mx) clean = mx[0];
  const parsed = (() => { try { return JSON.parse(clean); } catch { return []; } })();
  if (!Array.isArray(parsed) || !parsed.length) throw new Error('favoritism events ว่าง');
  return parsed;
}

// ── Midnight Chat ─────────────────────────────────────────────────────────────
export async function callMidnightChat(entities, entityCards, gimmicks) {
  const { key, model } = cfg();
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildMidnightChatPrompt(entities, entityCards, gimmicks) }] }],
      generationConfig: { temperature: 0.95, maxOutputTokens: 2500, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }
  const data = await res.json();
  const blockReason = data.promptFeedback?.blockReason;
  if (blockReason) throw new Error(`Safety block: ${blockReason}`);
  const finishReason = data.candidates?.[0]?.finishReason;
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = (parts.find(p => !p.thought)?.text || parts[0]?.text || '').trim();
  console.log('[midnight] finishReason:', finishReason, '| text length:', text.length, '| preview:', text.slice(0, 120));
  if (!text) throw new Error(`No content — finishReason: ${finishReason || 'unknown'}`);
  let clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  // extract array first — model sometimes appends extra text after closing ]
  const arrMatch = clean.match(/\[[\s\S]*\]/);
  if (arrMatch) clean = arrMatch[0];
  let parsed = (() => { try { return JSON.parse(clean); } catch (e) { console.error('[midnight] parse err:', e.message, '| raw:', text.slice(0, 400)); return null; } })();
  if (parsed && !Array.isArray(parsed)) {
    parsed = parsed.messages || parsed.chat || parsed.conversation || Object.values(parsed).find(v => Array.isArray(v)) || null;
  }
  if ((!Array.isArray(parsed) || !parsed.length) && finishReason === 'MAX_TOKENS') {
    const rescued = [];
    const re = /\{\s*"entityId"\s*:\s*"([^"]+)"\s*,\s*"text"\s*:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;
    let m;
    while ((m = re.exec(clean)) !== null) {
      rescued.push({ entityId: m[1], text: m[2].replace(/\\n/g, '\n').replace(/\\"/g, '"') });
    }
    if (rescued.length >= 3) return rescued;
  }
  if (!Array.isArray(parsed) || !parsed.length) throw new Error(`JSON empty/invalid — finishReason: ${finishReason || 'ok'}`);
  return parsed;
}

export async function callMidnightInteractivePrompt(entity) {
  const { key, model } = cfg();
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: buildMidnightInteractiveSystemPrompt(entity) }] },
      contents: [{ role: 'user', parts: [{ text: 'ทักหา keeper ตอนดึก' }] }],
      generationConfig: { temperature: 0.95, maxOutputTokens: 80, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }
  const data = await res.json();
  const iparts = data.candidates?.[0]?.content?.parts || [];
  return (iparts.find(p => !p.thought)?.text || iparts[0]?.text || '').trim();
}

export async function callMidnightReply(entity, userMessage, card) {
  const { key, model } = cfg();
  const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildMidnightReplyPrompt(entity, userMessage, card) }] }],
      generationConfig: { temperature: 0.95, maxOutputTokens: 150, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e?.error?.message || `API Error ${res.status}`); }
  const data = await res.json();
  const rparts = data.candidates?.[0]?.content?.parts || [];
  return (rparts.find(p => !p.thought)?.text || rparts[0]?.text || '').trim();
}
