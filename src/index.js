// offgridcommunitiessystem SDK · sovereign single-file library · MIT · AI-Native Solutions
// Extracted from offgridcommunitiessystem/index.html · 89501 bytes of source logic
// Public-safe: no primes/glyphs/dyad references

'use strict';
// ════════════════════════════════════════════════════════════════
// CONST
// ════════════════════════════════════════════════════════════════
const DB_NAME = 'offgrid_db';
const DB_VERSION = 1;
const ROLES = ['founder','member','visitor','wwoofer'];
const LEDGER_CATEGORIES = ['hours','goods','service','tool-loan','gift','adjustment'];
const PROPOSAL_TYPES = ['decision','change','meeting','agreement'];
const VOTING_METHODS = ['fall-consensus','consensus','majority','sociocracy','unanimous'];
// Fall Consensus · 7-dim bloom vector · cosine convergence (algorithm ported from fallconsensus seed, sovereignty intact)
const FALL_DIMS = [
  {k:'alignment',     l:'Alignment',    d:'Does this serve our shared purpose?'},
  {k:'urgency',       l:'Urgency',      d:'How time-sensitive is this?'},
  {k:'risk',          l:'Risk comfort', d:'How comfortable are we with the downside?'},
  {k:'resources',     l:'Resources',    d:'Do we have what this requires?'},
  {k:'reversibility', l:'Reversibility',d:'Can we undo if wrong?'},
  {k:'fairness',      l:'Fairness',     d:'Is this equitable across members?'},
  {k:'readiness',     l:'Readiness',    d:'Is the group ready to execute?'}
];
const FALL_THRESH = {avgSim: 70, minPair: 50, maxVar: 0.15};
const EVENT_KINDS = ['workday','harvest','meeting','market','feast','other'];
const RESOURCE_KINDS = ['tool','equipment','vehicle','space','other'];
const SKILL_KINDS = ['teach','help-with','looking-for'];
// ════════════════════════════════════════════════════════════════
// IndexedDB
// ════════════════════════════════════════════════════════════════
let db = null;
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      ['members','ledger','proposals','events','resources','skills','meta'].forEach(s => {
        if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: s === 'meta' ? 'key' : 'id' });
      });
    };
    req.onsuccess = () => { db = req.result; resolve(db); };
  });
}
function tx(stores, mode='readonly') { return db.transaction(stores, mode); }
function dbGet(store, key) { return new Promise((res, rej) => { const r = tx([store]).objectStore(store).get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function dbGetAll(store) { return new Promise((res, rej) => { const r = tx([store]).objectStore(store).getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => rej(r.error); }); }
function dbPut(store, value) { return new Promise((res, rej) => { const r = tx([store], 'readwrite').objectStore(store).put(value); r.onsuccess = () => res(value); r.onerror = () => rej(r.error); }); }
function dbDel(store, key) { return new Promise((res, rej) => { const r = tx([store], 'readwrite').objectStore(store).delete(key); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); }
// ════════════════════════════════════════════════════════════════
// State
// ════════════════════════════════════════════════════════════════
const state = {
  members: new Map(), ledger: new Map(), proposals: new Map(),
  events: new Map(), resources: new Map(), skills: new Map(),
  meta: {
    name: 'Your Community',
    unit_label: 'credits',
    unit_label_short: 'credits',
    founded: new Date().toISOString().slice(0, 10),
    peg_definition: '1 credit ≈ 1 hour of contributed labour',
    governance_default: 'fall-consensus',
  onboarded: false,
  ai_tier: 'T0',  // T0 (none, default) · T2 (WebLLM in-browser) · T3 (BYOK API)
    ledger_floor: -50,
    mesh_url: null,
    theme: 'dark',
    current_member_id: null,
  },
  tab: 'home',
};
const uid = (p='') => p + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const now = () => new Date().toISOString();
function toast(msg, kind) { const t = $('#toast'); t.textContent = msg; t.className = 'toast show ' + (kind || ''); clearTimeout(t._to); t._to = setTimeout(() => t.className = 'toast', 2400); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
function unit() { return state.meta.unit_label_short || 'credits'; }
// ════════════════════════════════════════════════════════════════
// AI CASCADE · ported verbatim from canonical `botler/index.html`
// 3 tiers: T0 (no AI, always works) · T2 (WebLLM in-browser, ~2GB, sovereign) · T3 (BYOK API)
// Single entry point: aiComplete(systemPrompt, userMsg, maxTokens)
// T0 returns null → caller MUST fall back gracefully
// ════════════════════════════════════════════════════════════════
const WEBLLM_MODEL = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
const AI = { ready: false, loading: false, progress: 0, engine: null, model: null };
function aiTier() { return state.meta.ai_tier || 'T0'; }
function renderAiChip() {
  if (!chip || !txt) return;
  chip.classList.remove('live', 'loading', 'warn');
  const tier = aiTier();
  if (tier === 'T0') { txt.textContent = 'T0 · off'; }
  else if (tier === 'T2') {
    if (AI.ready) { txt.textContent = 'T2 WebLLM · ready'; chip.classList.add('live'); }
    else if (AI.loading) { txt.textContent = `T2 loading ${Math.round(AI.progress)}%`; chip.classList.add('loading'); }
    else { txt.textContent = 'T2 · click to load'; chip.classList.add('warn'); }
  } else if (tier === 'T3') {
    if (state.meta.api_key) { txt.textContent = `T3 ${state.meta.api_provider || 'BYOK'}`; chip.classList.add('live'); }
    else { txt.textContent = 'T3 · no key'; chip.classList.add('warn'); }
  }
}
async function loadWebLLM() {
  if (AI.loading || AI.ready) return;
  AI.loading = true; AI.progress = 0; renderAiChip();
  toast('Loading WebLLM · ~2GB first time', 'ok');
  try {
    const { CreateMLCEngine } = await import('https://esm.run/@mlc-ai/web-llm@0.2.79');
    const engine = await CreateMLCEngine(WEBLLM_MODEL, {
      initProgressCallback: p => { AI.progress = (p.progress || 0) * 100; renderAiChip(); }
    });
    AI.engine = engine; AI.model = WEBLLM_MODEL; AI.ready = true; AI.loading = false;
    renderAiChip();
    toast('WebLLM ready · sovereign mode', 'ok');
  } catch (e) {
    console.error('webllm load failed', e);
    AI.loading = false; renderAiChip();
    toast('WebLLM load failed · ' + e.message, 'err');
  }
}
async function aiComplete(systemPrompt, userMsg, maxTokens = 600) {
  const tier = aiTier();
  if (tier === 'T2' && AI.ready && AI.engine) {
    const r = await AI.engine.chat.completions.create({
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMsg }],
      max_tokens: maxTokens,
    });
    return r.choices[0].message.content;
  }
  if (tier === 'T3' && state.meta.api_key && state.meta.api_provider) {
    return await aiCloudCall(systemPrompt, userMsg, maxTokens);
  }
  return null;  // T0 fallback — caller handles
}
async function aiCloudCall(sys, msg, maxTokens) {
  if (state.meta.api_provider === 'anthropic') {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': state.meta.api_key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-5', max_tokens: maxTokens, system: sys, messages: [{ role: 'user', content: msg }] })
    });
    if (!r.ok) throw new Error('Anthropic ' + r.status);
    const j = await r.json();
    return j.content[0].text;
  }
  if (state.meta.api_provider === 'openai') {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'Authorization': 'Bearer ' + state.meta.api_key },
      body: JSON.stringify({ model: 'gpt-4o-mini', max_tokens: maxTokens, messages: [{ role: 'system', content: sys }, { role: 'user', content: msg }] })
    });
    if (!r.ok) throw new Error('OpenAI ' + r.status);
    const j = await r.json();
    return j.choices[0].message.content;
  }
  throw new Error('unknown provider: ' + state.meta.api_provider);
}
function openAiPanel() {
  const tier = aiTier();
  let body = `<p style="font-size:13.5px;color:var(--cream-dim);line-height:1.7">Current tier: <strong style="color:var(--brass);font-family:var(--mono)">${tier}</strong></p>`;
  if (tier === 'T0') body += `<p style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-top:8px">T0 = no AI · the seed works fully without it. Upgrade to <strong>T2</strong> (WebLLM in-browser, ~2GB one-time download, sovereign, never leaves your device) or <strong>T3</strong> (BYOK Anthropic/OpenAI key, you pay, stored locally) from Settings.</p>`;
  else if (tier === 'T2') {
    if (AI.ready) body += `<p style="font-size:13px;color:var(--leaf);line-height:1.7">WebLLM ready · model: <code style="font-family:var(--mono);background:var(--ink);padding:1px 5px;border-radius:2px">${esc(AI.model)}</code></p><p style="font-size:12.5px;color:var(--cream-muted);line-height:1.6;margin-top:8px">All AI inference runs in your browser. Open DevTools Network — nothing leaves the device.</p>`;
    else if (AI.loading) body += `<p style="font-size:13px;color:var(--amber);line-height:1.7">Loading · ${Math.round(AI.progress)}%</p><p style="font-size:12.5px;color:var(--cream-muted);line-height:1.6;margin-top:8px">First load downloads ~2GB of model weights from the @mlc-ai/web-llm CDN. After that, runs offline forever.</p>`;
    else body += `<p style="font-size:13px;color:var(--cream-dim);line-height:1.7">WebLLM is configured but not loaded yet. Click below to download the model (~2GB, one-time, then cached forever).</p>`;
  } else if (tier === 'T3') {
    if (state.meta.api_key) body += `<p style="font-size:13px;color:var(--leaf);line-height:1.7">T3 active · ${esc(state.meta.api_provider)} · key stays in your IndexedDB, never proxied.</p>`;
    else body += `<p style="font-size:13px;color:var(--cream-dim);line-height:1.7">Set an API key in Settings to enable T3.</p>`;
  }
  let actionsHtml = `<button class="btn ghost" onclick="closeModal()">Close</button>`;
  if (tier === 'T2' && !AI.ready && !AI.loading) actionsHtml = `<button class="btn brass" onclick="closeModal();loadWebLLM()">Load WebLLM (~2GB)</button>` + actionsHtml;
}
// ─── AI-assist helpers (graceful T0 fallback per botler doctrine: NEVER hide a feature behind AI) ───
async function aiDraftProposal(titleEl, bodyEl) {
  const title = titleEl.value.trim();
  if (!title) { toast('Add a title first — AI drafts a body from it', 'err'); return; }
  if (aiTier() === 'T0') { openAiPanel(); return; }
  bodyEl.disabled = true; bodyEl.placeholder = 'AI drafting…';
  try {
    const txt = await aiComplete(
      'You are drafting a proposal body for an off-grid community deciding things together. Be concrete: context (1 sentence), what is being asked (specific action), who would do it, by when, why. Land-grounded tone. No SaaS-bro language. 80-150 words max.',
      'Proposal title: ' + title,
      400
    );
    if (txt) { bodyEl.value = txt; toast('AI draft inserted · edit before saving', 'ok'); }
  } catch (e) { toast('AI failed: ' + e.message, 'err'); }
  finally { bodyEl.disabled = false; bodyEl.placeholder = "What's the proposal? Context, what's being asked, who'd do it, by when. Be specific."; }
}
async function aiSuggestLedgerDesc(descEl) {
  if (aiTier() === 'T0') { openAiPanel(); return; }
  const examples = { hours: 'e.g. "3 hours digging beds"', goods: 'e.g. "12 eggs"', service: 'e.g. "drove to market and back"', 'tool-loan': 'e.g. "borrowed the cordless drill for 2 days"', gift: 'e.g. "spare jam, no expectation"', adjustment: 'e.g. "rounding balance reset"' };
  descEl.disabled = true; descEl.placeholder = 'AI suggesting…';
  try {
    const txt = await aiComplete(
      'You suggest one concrete short description for a community-ledger exchange entry. 5-12 words. Land-grounded. No emojis. Just the description, no quotes.',
      `Category: ${cat}. Amount: ${amt} ${unit()}. Example shape: ${examples[cat] || 'short, concrete'}.`,
      40
    );
    if (txt) { descEl.value = txt.trim().replace(/^["'`]|["'`]$/g, ''); toast('AI suggestion inserted', 'ok'); }
  } catch (e) { toast('AI failed: ' + e.message, 'err'); }
  finally { descEl.disabled = false; descEl.placeholder = 'e.g. "3 hours digging beds", "12 eggs", "ride to market"'; }
}
// ─── FALL CONSENSUS helpers (ported from fallconsensus seed) ───
function cosineSim(a, b) {
  // a, b: {dimKey: 0..100}
  let dot = 0, mA = 0, mB = 0;
  for (const d of FALL_DIMS) {
    const va = (a?.[d.k] ?? 50) / 100;
    const vb = (b?.[d.k] ?? 50) / 100;
    dot += va * vb; mA += va * va; mB += vb * vb;
  }
  return (mA && mB) ? (dot / Math.sqrt(mA * mB)) * 100 : 0;
}
function bloomConvergence(positions) {
  // positions: array of {dimKey: 0..100}
  const valid = positions.filter(p => p && typeof p === 'object' && !p._abstain);
  if (valid.length < 2) return { avg: 0, min: 100, variance: 0, converged: false, voters: valid.length, reason: 'need ≥2 positions' };
  let sum = 0, cnt = 0, mn = 100;
  for (let i = 0; i < valid.length; i++) for (let j = i + 1; j < valid.length; j++) {
    const s = cosineSim(valid[i], valid[j]);
    sum += s; cnt += 1; if (s < mn) mn = s;
  }
  const avg = cnt ? sum / cnt : 0;
  let totalVar = 0;
  for (const d of FALL_DIMS) {
    const vs = valid.map(p => (p[d.k] ?? 50) / 100);
    const m = vs.reduce((a, b) => a + b, 0) / vs.length;
    totalVar += vs.reduce((a, v) => a + (v - m) ** 2, 0) / vs.length;
  }
  const converged = avg >= FALL_THRESH.avgSim && mn >= FALL_THRESH.minPair && totalVar <= FALL_THRESH.maxVar;
  const reason = converged ? 'all thresholds met' :
    avg < FALL_THRESH.avgSim ? `avg sim ${avg.toFixed(0)}% < ${FALL_THRESH.avgSim}%` :
    mn < FALL_THRESH.minPair ? `weakest pair ${mn.toFixed(0)}% < ${FALL_THRESH.minPair}%` :
    `variance ${totalVar.toFixed(3)} > ${FALL_THRESH.maxVar}`;
  return { avg, min: mn, variance: totalVar, converged, voters: valid.length, reason };
}
function renderBloomBars(pos, label) {
  if (!pos || pos._abstain) return `<span style="font-family:var(--mono);font-size:10px;color:var(--cream-muted);letter-spacing:.04em">abstained</span>`;
  const colors = ['#3d8ac9','#3db88a','#c08a3a','#a14a2a','#7b5cd4','#ec4899','#14b8a6'];
  return `<div style="display:flex;gap:2px;align-items:flex-end;height:30px;width:84px" title="${label}">
    ${FALL_DIMS.map((d, i) => {
      const v = pos[d.k] ?? 50;
      return `<div style="flex:1;background:${colors[i]};height:${Math.max(4, v)}%;border-radius:1px 1px 0 0;opacity:.85" title="${d.l}: ${v}"></div>`;
    }).join('')}
  </div>`;
}
function fmtDate(iso) { if (!iso) return ''; const d = new Date(iso); if (isNaN(d)) return iso; return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtDateShort(iso) { if (!iso) return ''; const d = new Date(iso); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
function fmtTime(iso) { if (!iso) return ''; const d = new Date(iso); return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
function isoLocalNow() { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0,16); }
// ════════════════════════════════════════════════════════════════
// Models
// ════════════════════════════════════════════════════════════════
function makeMember(o={}) {
  return { id: uid('m_'), name: o.name || '', handle: o.handle || '', contact: o.contact || '', role: o.role || 'member', skills: o.skills || [], offers: o.offers || [], needs: o.needs || [], notes: o.notes || '', active: o.active !== false, joined_at: o.joined_at || now(), created_at: now(), updated_at: now() };
}
function makeLedger(o={}) {
  return { id: uid('l_'), at: o.at || now(), from_id: o.from_id, to_id: o.to_id, amount_kcc: Number(o.amount_kcc) || 0, description: o.description || '', category: o.category || 'hours', acknowledged_by: o.acknowledged_by || [o.from_id].filter(Boolean), status: o.status || 'pending', created_at: now(), updated_at: now() };
}
function makeProposal(o={}) {
  return { id: uid('pr_'), at: o.at || now(), author_id: o.author_id, title: o.title || '', body: o.body || '', type: o.type || 'decision', voting_method: o.voting_method || state.meta.governance_default, votes: o.votes || {}, status: o.status || 'open', decided_at: null, created_at: now(), updated_at: now() };
}
function makeEvent(o={}) {
  return { id: uid('e_'), at: o.at, end_at: o.end_at || null, title: o.title || '', kind: o.kind || 'meeting', location: o.location || '', notes: o.notes || '', attendees: o.attendees || [], created_at: now(), updated_at: now() };
}
function makeResource(o={}) {
  return { id: uid('r_'), name: o.name || '', owner_id: o.owner_id, kind: o.kind || 'tool', available: o.available !== false, current_borrower_id: o.current_borrower_id || null, borrowed_at: o.borrowed_at || null, notes: o.notes || '', created_at: now(), updated_at: now() };
}
function makeSkill(o={}) {
  return { id: uid('s_'), member_id: o.member_id, kind: o.kind || 'teach', text: o.text || '', active: o.active !== false, created_at: now(), updated_at: now() };
}
// ════════════════════════════════════════════════════════════════
// Load / save
// ════════════════════════════════════════════════════════════════
async function loadAll() {
  state.members.clear(); state.ledger.clear(); state.proposals.clear();
  state.events.clear(); state.resources.clear(); state.skills.clear();
  for (const x of await dbGetAll('members')) state.members.set(x.id, x);
  for (const x of await dbGetAll('ledger')) state.ledger.set(x.id, x);
  for (const x of await dbGetAll('proposals')) state.proposals.set(x.id, x);
  for (const x of await dbGetAll('events')) state.events.set(x.id, x);
  for (const x of await dbGetAll('resources')) state.resources.set(x.id, x);
  for (const x of await dbGetAll('skills')) state.skills.set(x.id, x);
  const meta = await dbGet('meta', 'community');
  if (meta) state.meta = { ...state.meta, ...meta.value };
  applyTheme();
}
function applyTheme() { document.documentElement.classList.toggle('light', state.meta.theme === 'light'); }
async function saveMeta() { await dbPut('meta', { key: 'community', value: state.meta }); }
async function toggleTheme() { state.meta.theme = state.meta.theme === 'dark' ? 'light' : 'dark'; await saveMeta(); applyTheme(); }
async function saveMember(m) { m.updated_at = now(); state.members.set(m.id, m); await dbPut('members', m); }
async function saveLedger(l) { l.updated_at = now(); state.ledger.set(l.id, l); await dbPut('ledger', l); }
async function saveProposal(p) { p.updated_at = now(); state.proposals.set(p.id, p); await dbPut('proposals', p); }
async function saveEvent(e) { e.updated_at = now(); state.events.set(e.id, e); await dbPut('events', e); }
async function saveResource(r) { r.updated_at = now(); state.resources.set(r.id, r); await dbPut('resources', r); }
async function saveSkill(s) { s.updated_at = now(); state.skills.set(s.id, s); await dbPut('skills', s); }
async function delMember(id) { state.members.delete(id); await dbDel('members', id); }
async function delLedger(id) { state.ledger.delete(id); await dbDel('ledger', id); }
async function delProposal(id) { state.proposals.delete(id); await dbDel('proposals', id); }
async function delEvent(id) { state.events.delete(id); await dbDel('events', id); }
async function delResource(id) { state.resources.delete(id); await dbDel('resources', id); }
async function delSkill(id) { state.skills.delete(id); await dbDel('skills', id); }
// ════════════════════════════════════════════════════════════════
// Computed
// ════════════════════════════════════════════════════════════════
function balanceOf(memberId) {
  let balance = 0;
  for (const l of state.ledger.values()) {
    if (l.status !== 'confirmed') continue;
    if (l.from_id === memberId) balance -= l.amount_kcc;
    if (l.to_id === memberId) balance += l.amount_kcc;
  }
  return balance;
}
function memberById(id) { return state.members.get(id); }
function activeMembers() { return Array.from(state.members.values()).filter(m => m.active).sort((a, b) => a.name.localeCompare(b.name)); }
function currentMember() { return state.meta.current_member_id ? memberById(state.meta.current_member_id) : null; }
// ════════════════════════════════════════════════════════════════
// Router
// ════════════════════════════════════════════════════════════════
function goTab(tab) { state.tab = tab; render(); }
function render() {
  $('#commNameLabel').textContent = state.meta.name || 'Your Community';
  $$('#tabBar button').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
  const body = $('#body');
  switch (state.tab) {
    case 'home':       renderHome(body); break;
    case 'members':    renderMembers(body); break;
    case 'ledger':     renderLedger(body); break;
    case 'governance': renderGovernance(body); break;
    case 'calendar':   renderCalendar(body); break;
    case 'resources':  renderResources(body); break;
    case 'skills':     renderSkills(body); break;
    case 'settings':   renderSettings(body); break;
    case 'help':       renderHelp(body); break;
    default: renderHome(body);
  }
  renderAiChip();
}
$$('#tabBar button').forEach(b => b.addEventListener('click', () => goTab(b.dataset.tab)));
// ════════════════════════════════════════════════════════════════
// HOME
// ════════════════════════════════════════════════════════════════
function renderHome(body) {
  const ms = activeMembers();
  const me = currentMember();
  const openProps = Array.from(state.proposals.values()).filter(p => p.status === 'open').length;
  const upcomingEvents = Array.from(state.events.values()).filter(e => new Date(e.at) > new Date()).sort((a,b) => a.at.localeCompare(b.at)).slice(0, 3);
  const recentLedger = Array.from(state.ledger.values()).sort((a,b) => b.at.localeCompare(a.at)).slice(0, 5);
  const myBalance = me ? balanceOf(me.id) : null;
  const totalKcc = Array.from(state.ledger.values()).filter(l => l.status === 'confirmed').reduce((a,l) => a + l.amount_kcc, 0);
  body.innerHTML = `
    <div class="hero">
      <h2>${esc(state.meta.name)}</h2>
      <div class="lede">Founded ${esc(fmtDate(state.meta.founded))} · ${ms.length} member${ms.length === 1 ? '' : 's'} · ${state.meta.peg_definition}</div>
    </div>
    ${!me ? `
      <div class="card" style="border-color:var(--brass);background:linear-gradient(135deg,rgba(192,138,58,.08),transparent)">
        <div>
          <strong style="color:var(--brass);font-family:var(--serif)">Welcome.</strong>
          <p style="font-size:13px;color:var(--cream-dim);margin-top:4px;line-height:1.6">First — who are you? Add yourself as a member, then mark "this is me" in your profile so the ledger and proposals can attribute things to you.</p>
        </div>
        <button class="btn brass" onclick="openMemberModal()">+ Add yourself</button>
      </div>
    ` : `
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        <div class="card" style="text-align:center">
          <div style="font-family:var(--mono);font-size:10px;color:var(--cream-muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">Your balance</div>
          <div class="kcc-balance ${myBalance > 0 ? 'pos' : myBalance < 0 ? 'neg' : 'zero'}" style="font-size:20px;padding:8px 14px">${myBalance.toFixed(1)}</div>
        </div>
        <div class="card" style="text-align:center">
          <div style="font-family:var(--mono);font-size:10px;color:var(--cream-muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">Community flow</div>
          <div class="kcc-balance" style="font-size:20px;padding:8px 14px">${totalKcc.toFixed(1)}</div>
          <div style="font-family:var(--mono);font-size:9px;color:var(--cream-muted);margin-top:4px">total ${unit()} circulated</div>
        </div>
        <div class="card" style="text-align:center">
          <div style="font-family:var(--mono);font-size:10px;color:var(--cream-muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">Open proposals</div>
          <div style="font-family:var(--serif);font-size:28px;font-weight:700;color:var(--brass)">${openProps}</div>
        </div>
        <div class="card" style="text-align:center">
          <div style="font-family:var(--mono);font-size:10px;color:var(--cream-muted);letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px">Members</div>
          <div style="font-family:var(--serif);font-size:28px;font-weight:700;color:var(--brass)">${ms.length}</div>
        </div>
      </div>
    `}
    ${upcomingEvents.length ? `
      <div class="section-h"><h3>Upcoming</h3><span class="sub">${upcomingEvents.length} event${upcomingEvents.length === 1 ? '' : 's'}</span><div class="actions"><button class="btn sm" onclick="goTab('calendar')">all →</button></div></div>
      <div class="cal-list-wrap">
        ${upcomingEvents.map(renderEventCard).join('')}
      </div>
    ` : ''}
    ${recentLedger.length ? `
      <div class="section-h"><h3>Recent ledger</h3><span class="sub">last ${recentLedger.length}</span><div class="actions"><button class="btn sm" onclick="goTab('ledger')">all →</button></div></div>
      ${renderLedgerTable(recentLedger)}
    ` : ''}
    ${ms.length === 0 ? `
      <div class="empty">No members yet. Click <strong>+ Add yourself</strong> above to start.</div>
    ` : ''}
  `;
}
// ════════════════════════════════════════════════════════════════
// MEMBERS
// ════════════════════════════════════════════════════════════════
function renderMembers(body) {
  const ms = Array.from(state.members.values()).sort((a, b) => a.name.localeCompare(b.name));
  body.innerHTML = `
    <div class="section-h">
      <h3>Members</h3>
      <span class="sub">${ms.length} ${ms.length === 1 ? 'person' : 'people'}</span>
      <div class="actions">
        <button class="btn brass" onclick="openMemberModal()">+ Add member</button>
      </div>
    </div>
    ${ms.length === 0 ? `<div class="empty">No members yet. Add yourself first — that's the foundation.</div>` :
      `<div class="grid">${ms.map(renderMemberCard).join('')}</div>`}
  `;
}
function renderMemberCard(m) {
  const isMe = state.meta.current_member_id === m.id;
  const bal = balanceOf(m.id);
  const initials = m.name.split(/\s+/).map(w => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase() || '?';
  return `<div class="member-card ${isMe ? 'is-me' : ''}" onclick="openMemberModal('${m.id}')">
    <div class="top">
      <div class="avatar">${esc(initials)}</div>
      <div class="name-block">
        <div class="nm">${esc(m.name || 'Unnamed')}${isMe ? ' · <span style="color:var(--brass);font-family:var(--mono);font-size:10px">this is me</span>' : ''}</div>
        <div class="handle">${esc(m.handle || '')}${m.contact ? ' · ' + esc(m.contact) : ''}</div>
      </div>
      <span class="role-badge role-${m.role}">${m.role}</span>
    </div>
    <div class="tags-row">
      ${(m.skills || []).slice(0, 4).map(s => `<span class="tag leaf">${esc(s)}</span>`).join('')}
      ${(m.offers || []).slice(0, 3).map(s => `<span class="tag brass">offers: ${esc(s)}</span>`).join('')}
      ${(m.needs || []).slice(0, 3).map(s => `<span class="tag rust">needs: ${esc(s)}</span>`).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding-top:6px;border-top:1px solid var(--line-soft);margin-top:4px">
      <span class="kcc-balance ${bal > 0 ? 'pos' : bal < 0 ? 'neg' : 'zero'}">${bal.toFixed(1)}</span>
      <span style="font-family:var(--mono);font-size:10px;color:var(--cream-muted);letter-spacing:.04em">joined ${fmtDate(m.joined_at)}</span>
    </div>
  </div>`;
}
function openMemberModal(memberId) {
  const m = memberId ? memberById(memberId) : null;
  const isExisting = !!m;
  $('#modalBg').innerHTML = `<div class="modal">
    <span class="close" onclick="closeModal()">×</span>
    <h3>${isExisting ? 'Edit member' : 'Add member'}</h3>
    <div class="row"><label>Name</label><input type="text" id="mName" value="${esc(m?.name || '')}" placeholder="Their name"></div>
    <div class="row-flex">
      <div class="row" style="flex:1"><label>Handle / nickname</label><input type="text" id="mHandle" value="${esc(m?.handle || '')}" placeholder="Optional"></div>
      <div class="row" style="flex:1"><label>Role</label><select id="mRole">
        ${ROLES.map(r => `<option value="${r}" ${m?.role === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select></div>
    </div>
    <div class="row"><label>Contact (email · phone · whatever)</label><input type="text" id="mContact" value="${esc(m?.contact || '')}" placeholder="Optional"></div>
    <div class="row"><label>Skills (comma-separated)</label><input type="text" id="mSkills" value="${esc((m?.skills || []).join(', '))}" placeholder="e.g. carpentry, beekeeping, plumbing"></div>
    <div class="row-flex">
      <div class="row" style="flex:1"><label>Offers</label><input type="text" id="mOffers" value="${esc((m?.offers || []).join(', '))}" placeholder="e.g. childcare, lifts to town"></div>
      <div class="row" style="flex:1"><label>Needs</label><input type="text" id="mNeeds" value="${esc((m?.needs || []).join(', '))}" placeholder="e.g. help with wiring"></div>
    </div>
    <div class="row"><label>Notes</label><textarea id="mNotes" placeholder="Anything else useful for the community to know.">${esc(m?.notes || '')}</textarea></div>
    <div class="row"><label><input type="checkbox" id="mIsMe" style="width:auto;margin-right:6px" ${state.meta.current_member_id === m?.id ? 'checked' : ''}> This is me (attribute my entries to this member)</label></div>
    <div class="row-btns">
      ${isExisting ? `<button class="btn danger" onclick="confirmDelMember('${m.id}')">Delete</button>` : ''}
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn brass" onclick="saveMemberFromModal('${m?.id || ''}')">${isExisting ? 'Save' : 'Add member'}</button>
    </div>
  </div>`;
  $('#modalBg').classList.add('open');
  setTimeout(() => $('#mName').focus(), 30);
}
async function saveMemberFromModal(id) {
  const name = $('#mName').value.trim();
  if (!name) { toast('Name required', 'err'); return; }
  const m = id ? memberById(id) : makeMember();
  m.name = name;
  m.handle = $('#mHandle').value.trim();
  m.role = $('#mRole').value;
  m.contact = $('#mContact').value.trim();
  m.skills = $('#mSkills').value.split(',').map(s => s.trim()).filter(Boolean);
  m.offers = $('#mOffers').value.split(',').map(s => s.trim()).filter(Boolean);
  m.needs = $('#mNeeds').value.split(',').map(s => s.trim()).filter(Boolean);
  m.notes = $('#mNotes').value;
  await saveMember(m);
  if ($('#mIsMe').checked) { state.meta.current_member_id = m.id; await saveMeta(); }
  else if (state.meta.current_member_id === m.id) { state.meta.current_member_id = null; await saveMeta(); }
  closeModal();
  toast(id ? 'Member updated' : 'Member added', 'ok');
  render();
}
async function confirmDelMember(id) {
  const m = memberById(id);
  if (!confirm('Delete "' + m.name + '"? Their ledger history is preserved but they will no longer appear in lists.')) return;
  m.active = false;
  await saveMember(m);
  if (state.meta.current_member_id === id) { state.meta.current_member_id = null; await saveMeta(); }
  closeModal();
  toast('Member archived');
  render();
}
// ════════════════════════════════════════════════════════════════
// LEDGER
// ════════════════════════════════════════════════════════════════
function renderLedger(body) {
  const entries = Array.from(state.ledger.values()).sort((a,b) => b.at.localeCompare(a.at));
  const me = currentMember();
  body.innerHTML = `
    <div class="section-h">
      <h3>Ledger</h3>
      <span class="sub">${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} · denominated in community units</span>
      <div class="actions">
        <button class="btn brass" onclick="openLedgerModal()">+ New entry</button>
        <button class="btn sm" onclick="exportLedgerCsv()">⤓ CSV</button>
      </div>
    </div>
    ${entries.length === 0 ? `<div class="empty">No ledger entries yet. Record an exchange to start the flow.</div>` :
      renderLedgerTable(entries)}
    <div style="margin-top:18px;padding:14px 16px;background:var(--void-2);border:1px solid var(--line);border-radius:4px;font-size:12px;color:var(--cream-muted);line-height:1.65">
      <strong style="color:var(--brass)">How the ledger works</strong> · Every exchange is a transfer from one member to another, denominated in community units. Both parties must confirm before the entry counts toward balances. ${state.meta.peg_definition}. Ledger floor: ${state.meta.ledger_floor} ${unit()} (the lowest balance a member can hold).
    </div>
  `;
}
function renderLedgerTable(entries) {
  const me = currentMember();
  return `<table class="ledger-table">
    <thead><tr><th>When</th><th>From → To</th><th style="text-align:right">Amount</th><th>For</th><th>Cat.</th><th>Status</th><th></th></tr></thead>
    <tbody>${entries.map(l => {
      const from = memberById(l.from_id); const to = memberById(l.to_id);
      const isMine = me && (l.from_id === me.id || l.to_id === me.id);
      const dir = me && l.to_id === me.id ? 'in' : me && l.from_id === me.id ? 'out' : '';
      const ackNeeded = l.status === 'pending' && me && !l.acknowledged_by.includes(me.id) && (l.from_id === me.id || l.to_id === me.id);
      return `<tr ${isMine ? 'style="background:rgba(192,138,58,.03)"' : ''}>
        <td><span style="font-family:var(--mono);font-size:11px;color:var(--cream-muted)">${fmtDateShort(l.at)}</span></td>
        <td><span style="color:var(--cream)">${esc(from?.name || '?')}</span> <span style="color:var(--cream-muted)">→</span> <span style="color:var(--cream)">${esc(to?.name || '?')}</span></td>
        <td style="text-align:right"><span class="amt ${dir === 'in' ? 'amt-in' : dir === 'out' ? 'amt-out' : ''}">${dir === 'out' ? '-' : dir === 'in' ? '+' : ''}${l.amount_kcc.toFixed(1)}</span></td>
        <td>${esc(l.description)}</td>
        <td><span class="cat">${esc(l.category)}</span></td>
        <td><span class="status-${l.status}">${esc(l.status)}</span></td>
        <td>${ackNeeded ? `<button class="ack-btn" onclick="ackLedger('${l.id}')">✓ confirm</button>` : `<button class="btn sm ghost" onclick="openLedgerModal('${l.id}')">edit</button>`}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}
function openLedgerModal(id) {
  const l = id ? state.ledger.get(id) : null;
  const me = currentMember();
  const members = activeMembers();
  if (members.length < 2) { toast('Need at least 2 members to record an exchange', 'err'); return; }
  $('#modalBg').innerHTML = `<div class="modal">
    <span class="close" onclick="closeModal()">×</span>
    <h3>${l ? 'Edit ledger entry' : 'Record an exchange'}</h3>
    <div class="row-flex">
      <div class="row" style="flex:1"><label>From (giver)</label><select id="lFrom">
        ${members.map(m => `<option value="${m.id}" ${(l?.from_id || me?.id) === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
      </select></div>
      <div class="row" style="flex:1"><label>To (receiver)</label><select id="lTo">
        ${members.map(m => `<option value="${m.id}" ${l?.to_id === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
      </select></div>
    </div>
    <div class="row-flex">
      <div class="row" style="flex:1"><label>Amount</label><input type="number" id="lAmount" value="${l?.amount_kcc || ''}" step="0.5" min="0.5" placeholder="e.g. 3"></div>
      <div class="row" style="flex:1"><label>Category</label><select id="lCat">
        ${LEDGER_CATEGORIES.map(c => `<option value="${c}" ${l?.category === c ? 'selected' : ''}>${c}</option>`).join('')}
      </select></div>
    </div>
    <div class="row"><label>What for?</label><input type="text" id="lDesc" value="${esc(l?.description || '')}" placeholder='e.g. "3 hours digging beds", "12 eggs", "ride to market"'>
    </div>
    <div class="row"><label>When</label><input type="datetime-local" id="lAt" value="${l?.at?.slice(0,16) || isoLocalNow()}"></div>
    <div class="row-btns">
      ${l ? `<button class="btn danger" onclick="confirmDelLedger('${l.id}')">Delete</button>` : ''}
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn brass" onclick="saveLedgerFromModal('${l?.id || ''}')">${l ? 'Save' : 'Record entry'}</button>
    </div>
  </div>`;
  $('#modalBg').classList.add('open');
}
async function saveLedgerFromModal(id) {
  const from_id = $('#lFrom').value, to_id = $('#lTo').value;
  if (from_id === to_id) { toast('From and To must be different members', 'err'); return; }
  const amt = Number($('#lAmount').value);
  if (!amt || amt <= 0) { toast('Amount must be positive', 'err'); return; }
  const desc = $('#lDesc').value.trim();
  if (!desc) { toast('Describe what the exchange is for', 'err'); return; }
  // ledger floor check (from_id will go more negative)
  const newFromBal = balanceOf(from_id) - amt + (id ? state.ledger.get(id).amount_kcc : 0);
  if (newFromBal < state.meta.ledger_floor) {
    if (!confirm(`This entry would put ${memberById(from_id).name} at ${newFromBal.toFixed(1)} ${unit()}, below the floor (${state.meta.ledger_floor}). Record anyway?`)) return;
  }
  const me = currentMember();
  const l = id ? state.ledger.get(id) : makeLedger({ from_id });
  l.from_id = from_id; l.to_id = to_id; l.amount_kcc = amt;
  l.description = desc; l.category = $('#lCat').value; l.at = new Date($('#lAt').value).toISOString();
  // ack tracking
  if (me) {
    if (!l.acknowledged_by.includes(me.id)) l.acknowledged_by.push(me.id);
  } else {
    l.acknowledged_by = [from_id];
  }
  // auto-confirm if both parties ack'd
  if (l.acknowledged_by.includes(from_id) && l.acknowledged_by.includes(to_id)) l.status = 'confirmed';
  await saveLedger(l);
  closeModal();
  toast(id ? 'Entry updated' : 'Entry recorded', 'ok');
  render();
}
async function ackLedger(id) {
  const l = state.ledger.get(id); if (!l) return;
  const me = currentMember(); if (!me) { toast('Set "this is me" on your member profile first', 'err'); return; }
  if (!l.acknowledged_by.includes(me.id)) l.acknowledged_by.push(me.id);
  if (l.acknowledged_by.includes(l.from_id) && l.acknowledged_by.includes(l.to_id)) l.status = 'confirmed';
  await saveLedger(l);
  toast('Confirmed', 'ok');
  render();
}
async function confirmDelLedger(id) {
  if (!confirm('Delete this ledger entry?')) return;
  await delLedger(id); closeModal(); toast('Entry deleted'); render();
}
function exportLedgerCsv() {
  const entries = Array.from(state.ledger.values()).sort((a,b) => b.at.localeCompare(a.at));
  const rows = [['When','From','To','Amount','Category','Description','Status','Acknowledged by']];
  for (const l of entries) {
    rows.push([l.at, memberById(l.from_id)?.name || '?', memberById(l.to_id)?.name || '?', l.amount_kcc, l.category, l.description, l.status, l.acknowledged_by.map(id => memberById(id)?.name || id).join('; ')]);
  }
  const csv = rows.map(r => r.map(c => /[,"\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c).join(',')).join('\n');
  downloadFile(csv, `kcc-ledger-${ymd(new Date())}.csv`, 'text/csv');
  toast('CSV downloaded', 'ok');
}
// ════════════════════════════════════════════════════════════════
// GOVERNANCE
// ════════════════════════════════════════════════════════════════
function renderGovernance(body) {
  const props = Array.from(state.proposals.values()).sort((a,b) => b.at.localeCompare(a.at));
  const open = props.filter(p => p.status === 'open');
  const closed = props.filter(p => p.status !== 'open');
  body.innerHTML = `
    <div class="section-h">
      <h3>Governance</h3>
      <span class="sub">${open.length} open · ${closed.length} decided · default method: ${state.meta.governance_default}</span>
      <div class="actions"><button class="btn brass" onclick="openProposalModal()">+ New proposal</button></div>
    </div>
    ${props.length === 0 ? `<div class="empty">No proposals yet. Anyone can raise one.</div>` : ''}
    ${open.length ? `<div class="section-h"><h3 style="font-size:14px">Open</h3></div>${open.map(renderProposalCard).join('')}` : ''}
    ${closed.length ? `<div class="section-h"><h3 style="font-size:14px">Decided</h3></div>${closed.map(renderProposalCard).join('')}` : ''}
  `;
}
function renderProposalCard(p) {
  if (p.voting_method === 'fall-consensus') return renderFallConsensusCard(p);
  const author = memberById(p.author_id);
  const me = currentMember();
  const totalMembers = activeMembers().length;
  const yesCount = Object.values(p.votes).filter(v => v === 'yes').length;
  const noCount = Object.values(p.votes).filter(v => v === 'no').length;
  const abstainCount = Object.values(p.votes).filter(v => v === 'abstain').length;
  const blockCount = Object.values(p.votes).filter(v => v === 'block').length;
  const myVote = me ? p.votes[me.id] : null;
  return `<div class="proposal-card ${p.status}">
    <div class="ph">
      <h4>${esc(p.title)}</h4>
      <span class="status-badge status-${p.status}">${p.status}</span>
      <span class="meta">${esc(p.type)} · ${esc(p.voting_method)} · raised ${fmtDate(p.at)} by ${esc(author?.name || '?')}</span>
    </div>
    <div class="body">${esc(p.body)}</div>
    ${p.status === 'open' && me ? `<div class="vote-row">
      <button class="vote-btn ${myVote === 'yes' ? 'cast-yes' : ''}" onclick="castVote('${p.id}', 'yes')">✓ Yes</button>
      <button class="vote-btn ${myVote === 'no' ? 'cast-no' : ''}" onclick="castVote('${p.id}', 'no')">✗ No</button>
      <button class="vote-btn ${myVote === 'abstain' ? 'cast-abstain' : ''}" onclick="castVote('${p.id}', 'abstain')">∅ Abstain</button>
      ${p.voting_method === 'consensus' || p.voting_method === 'sociocracy' ? `<button class="vote-btn ${myVote === 'block' ? 'cast-block' : ''}" onclick="castVote('${p.id}', 'block')">⛔ Block</button>` : ''}
      <span style="flex:1"></span>
      ${p.author_id === me.id ? `<button class="btn sm ghost" onclick="openProposalModal('${p.id}')">edit</button> <button class="btn sm danger" onclick="withdrawProposal('${p.id}')">withdraw</button>` : ''}
    </div>` : ''}
    <div class="tally">
      <span style="color:var(--leaf)">✓ ${yesCount}</span>
      <span style="color:var(--rust)">✗ ${noCount}</span>
      <span>∅ ${abstainCount}</span>
      ${blockCount ? `<span style="color:var(--rust)">⛔ ${blockCount}</span>` : ''}
      <span style="margin-left:auto">${yesCount + noCount + abstainCount + blockCount} / ${totalMembers} voted</span>
      ${p.status === 'open' && me?.id === p.author_id ? `<button class="btn sm brass" onclick="tallyProposal('${p.id}')">tally now →</button>` : ''}
    </div>
  </div>`;
}
function renderFallConsensusCard(p) {
  const author = memberById(p.author_id);
  const me = currentMember();
  const totalMembers = activeMembers().length;
  const positions = Object.values(p.votes);
  const conv = bloomConvergence(positions);
  const myPos = me ? p.votes[me.id] : null;
  const memberPositions = Object.entries(p.votes).map(([mid, pos]) => ({ m: memberById(mid), pos }));
  return `<div class="proposal-card ${p.status}" style="border-left:3px solid var(--brass)">
    <div class="ph">
      <h4>${esc(p.title)}</h4>
      <span class="status-badge status-${p.status}">${p.status}</span>
      <span class="meta">${esc(p.type)} · <strong style="color:var(--brass)">fall-consensus · 7-dim</strong> · raised ${fmtDate(p.at)} by ${esc(author?.name || '?')}</span>
    </div>
    <div class="body">${esc(p.body)}</div>
    <div style="background:var(--ink);border:1px solid var(--line);border-radius:4px;padding:14px 16px;margin:10px 0">
      <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:10px;flex-wrap:wrap">
        <strong style="font-family:var(--mono);font-size:10px;color:var(--brass);letter-spacing:.12em;text-transform:uppercase">Convergence</strong>
        <span class="kcc-balance ${conv.converged ? 'pos' : 'zero'}" style="font-family:var(--mono);font-size:13px">${conv.avg.toFixed(0)}% avg · ${conv.min.toFixed(0)}% min · σ²=${conv.variance.toFixed(3)}</span>
        <span style="font-family:var(--mono);font-size:10px;color:var(--cream-muted);letter-spacing:.04em">${conv.voters}/${totalMembers} positions · ${esc(conv.reason)}</span>
      </div>
      ${conv.converged ? `<div style="font-family:var(--mono);font-size:11px;color:var(--leaf);letter-spacing:.04em;padding:6px 0">◆ thresholds met — ready to lock in</div>` : ''}
      ${memberPositions.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-top:8px">
        ${memberPositions.map(({m, pos}) => `<div style="text-align:center;font-size:11px">
          <div style="font-family:var(--mono);font-size:10px;color:var(--cream-muted);letter-spacing:.04em;margin-bottom:2px">${esc(m?.name || '?')}</div>
          ${renderBloomBars(pos, m?.name || '')}
        </div>`).join('')}
      </div>` : ''}
    </div>
    ${p.status === 'open' && me ? `<div style="margin-top:10px">
      <div style="font-family:var(--mono);font-size:10px;color:var(--cream-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">Your 7-dim position · drag sliders</div>
      ${FALL_DIMS.map(d => {
        const v = (myPos && !myPos._abstain && typeof myPos === 'object') ? (myPos[d.k] ?? 50) : 50;
        return `<div style="display:grid;grid-template-columns:120px 1fr 36px;gap:10px;align-items:center;padding:3px 0">
          <label style="font-size:12px;color:var(--cream-dim)" title="${esc(d.d)}">${esc(d.l)}</label>
          <input type="range" min="0" max="100" value="${v}" data-prop="${p.id}" data-dim="${d.k}" oninput="onFallSliderInput(this)" style="accent-color:var(--brass)">
          <span class="dim-v-${d.k}-${p.id}" style="font-family:var(--mono);font-size:11px;color:var(--brass);text-align:right">${v}</span>
        </div>`;
      }).join('')}
      <div class="vote-row" style="margin-top:10px">
        <button class="btn sm brass" onclick="submitFallPosition('${p.id}')">${myPos && !myPos._abstain ? '✓ update position' : '✓ submit position'}</button>
        <button class="vote-btn ${myPos && myPos._abstain ? 'cast-abstain' : ''}" onclick="castVote('${p.id}', {_abstain:true})">∅ Abstain</button>
        <span style="flex:1"></span>
        ${p.author_id === me.id ? `<button class="btn sm ghost" onclick="openProposalModal('${p.id}')">edit</button> <button class="btn sm danger" onclick="withdrawProposal('${p.id}')">withdraw</button> ${conv.converged ? `<button class="btn sm brass" onclick="tallyProposal('${p.id}')">lock in →</button>` : ''}` : ''}
      </div>
    </div>` : ''}
  </div>`;
}
function onFallSliderInput(el) {
  const dim = el.dataset.dim;
  if (span) span.textContent = el.value;
}
async function submitFallPosition(propId) {
  const me = currentMember(); if (!me) { toast('Set "this is me" first', 'err'); return; }
  const p = state.proposals.get(propId); if (!p || p.status !== 'open') return;
  const pos = {};
  FALL_DIMS.forEach(d => {
    pos[d.k] = el ? Number(el.value) : 50;
  });
  p.votes[me.id] = pos;
  await saveProposal(p);
  render();
  toast('Position submitted', 'ok');
}
function openProposalModal(id) {
  const p = id ? state.proposals.get(id) : null;
  const me = currentMember();
  if (!me) { toast('Set "this is me" on your member profile first', 'err'); return; }
  $('#modalBg').innerHTML = `<div class="modal">
    <span class="close" onclick="closeModal()">×</span>
    <h3>${p ? 'Edit proposal' : 'New proposal'}</h3>
    <div class="row"><label>Title</label><input type="text" id="pTitle" value="${esc(p?.title || '')}" placeholder="Short, clear, action-oriented"></div>
    <div class="row"><label>Body</label><textarea id="pBody" placeholder="What's the proposal? Context, what's being asked, who'd do it, by when. Be specific.">${esc(p?.body || '')}</textarea>
    </div>
    <div class="row-flex">
      <div class="row" style="flex:1"><label>Type</label><select id="pType">
        ${PROPOSAL_TYPES.map(t => `<option value="${t}" ${p?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select></div>
      <div class="row" style="flex:1"><label>Voting method</label><select id="pMethod">
        ${VOTING_METHODS.map(v => `<option value="${v}" ${(p?.voting_method || state.meta.governance_default) === v ? 'selected' : ''}>${v}</option>`).join('')}
      </select></div>
    </div>
    <div class="row-btns">
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn brass" onclick="saveProposalFromModal('${p?.id || ''}')">${p ? 'Save' : 'Raise proposal'}</button>
    </div>
  </div>`;
  $('#modalBg').classList.add('open');
  setTimeout(() => $('#pTitle').focus(), 30);
}
async function saveProposalFromModal(id) {
  const me = currentMember();
  const title = $('#pTitle').value.trim();
  if (!title) { toast('Title required', 'err'); return; }
  const p = id ? state.proposals.get(id) : makeProposal({ author_id: me.id });
  p.title = title; p.body = $('#pBody').value;
  p.type = $('#pType').value; p.voting_method = $('#pMethod').value;
  await saveProposal(p);
  closeModal(); toast(id ? 'Proposal updated' : 'Proposal raised', 'ok'); render();
}
async function castVote(id, choice) {
  const me = currentMember(); if (!me) { toast('Set "this is me" on your member profile first', 'err'); return; }
  const p = state.proposals.get(id); if (!p || p.status !== 'open') return;
  // Fall-consensus abstain comes as {_abstain:true}; equality compare on objects always false, so just set
  if (typeof choice === 'string' && p.votes[me.id] === choice) delete p.votes[me.id];
  else p.votes[me.id] = choice;
  await saveProposal(p);
  render();
}
async function tallyProposal(id) {
  const p = state.proposals.get(id); if (!p) return;
  const total = activeMembers().length;
  let passes; let summary;
  if (p.voting_method === 'fall-consensus') {
    const conv = bloomConvergence(Object.values(p.votes));
    passes = conv.converged;
    summary = `Fall consensus · ${conv.voters}/${total} positions · avg ${conv.avg.toFixed(0)}% · min ${conv.min.toFixed(0)}% · σ²=${conv.variance.toFixed(3)} · ${conv.reason}`;
  } else {
    const yes = Object.values(p.votes).filter(v => v === 'yes').length;
    const no = Object.values(p.votes).filter(v => v === 'no').length;
    const blocks = Object.values(p.votes).filter(v => v === 'block').length;
    const voted = Object.keys(p.votes).length;
    if (p.voting_method === 'unanimous') passes = (yes === total);
    else if (p.voting_method === 'consensus') passes = (blocks === 0 && yes >= 1 && no === 0);
    else if (p.voting_method === 'sociocracy') passes = (blocks === 0 && yes > 0);
    else /* majority */ passes = (yes > no);
    summary = `${yes} yes · ${no} no · ${blocks} block · ${voted}/${total} voted`;
  }
  if (!confirm(`Tally "${p.title}" — ${summary}. Result: ${passes ? 'PASSES' : 'FAILS'}. Lock it in?`)) return;
  p.status = passes ? 'passed' : 'failed'; p.decided_at = now();
  await saveProposal(p); render(); toast(passes ? 'Passed' : 'Failed', passes ? 'ok' : 'err');
}
async function withdrawProposal(id) {
  if (!confirm('Withdraw this proposal?')) return;
  const p = state.proposals.get(id); p.status = 'withdrawn'; p.decided_at = now();
  await saveProposal(p); render();
}
// ════════════════════════════════════════════════════════════════
// CALENDAR
// ════════════════════════════════════════════════════════════════
function renderCalendar(body) {
  const events = Array.from(state.events.values()).sort((a,b) => a.at.localeCompare(b.at));
  const upcoming = events.filter(e => new Date(e.at) > new Date());
  const past = events.filter(e => new Date(e.at) <= new Date());
  body.innerHTML = `
    <div class="section-h">
      <h3>Calendar</h3>
      <span class="sub">${upcoming.length} upcoming · ${past.length} past</span>
      <div class="actions"><button class="btn brass" onclick="openEventModal()">+ New event</button></div>
    </div>
    ${events.length === 0 ? `<div class="empty">No events yet.</div>` : ''}
    ${upcoming.length ? `<div class="section-h"><h3 style="font-size:14px">Upcoming</h3></div><div class="cal-list-wrap">${upcoming.map(renderEventCard).join('')}</div>` : ''}
    ${past.length ? `<div class="section-h"><h3 style="font-size:14px">Past</h3></div><div class="cal-list-wrap">${past.reverse().slice(0, 12).map(renderEventCard).join('')}</div>` : ''}
  `;
}
function renderEventCard(e) {
  const me = currentMember();
  const isAttending = me && e.attendees.includes(me.id);
  const d = new Date(e.at);
  return `<div class="event-card">
    <div class="when-block">
      <div class="when-day">${d.getDate()}</div>
      <div class="when-month">${d.toLocaleDateString('en-GB', { month: 'short' })}</div>
      <div class="when-time">${fmtTime(e.at)}</div>
    </div>
    <div class="info-block">
      <div class="title">${esc(e.title)}</div>
      <div class="meta">${esc(e.location || '')} ${e.location && e.attendees.length ? '·' : ''} ${e.attendees.length} attending${e.notes ? ' · ' + esc(e.notes.slice(0, 60)) : ''}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">
      <span class="kind-badge k-${e.kind}">${e.kind}</span>
      ${me ? `<button class="btn sm ${isAttending ? 'leaf' : ''}" onclick="toggleAttend('${e.id}')">${isAttending ? '✓ going' : 'attend'}</button>` : ''}
      <button class="btn sm ghost" onclick="openEventModal('${e.id}')">edit</button>
    </div>
  </div>`;
}
function openEventModal(id) {
  const e = id ? state.events.get(id) : null;
  $('#modalBg').innerHTML = `<div class="modal">
    <span class="close" onclick="closeModal()">×</span>
    <h3>${e ? 'Edit event' : 'New event'}</h3>
    <div class="row"><label>Title</label><input type="text" id="eTitle" value="${esc(e?.title || '')}" placeholder="e.g. Saturday workday — building chicken coop"></div>
    <div class="row-flex">
      <div class="row" style="flex:1"><label>When</label><input type="datetime-local" id="eAt" value="${e?.at?.slice(0,16) || isoLocalNow()}"></div>
      <div class="row" style="flex:1"><label>Kind</label><select id="eKind">
        ${EVENT_KINDS.map(k => `<option value="${k}" ${e?.kind === k ? 'selected' : ''}>${k}</option>`).join('')}
      </select></div>
    </div>
    <div class="row"><label>Location</label><input type="text" id="eLoc" value="${esc(e?.location || '')}" placeholder="Where on the land / in the community"></div>
    <div class="row"><label>Notes</label><textarea id="eNotes" placeholder="What to bring, what to expect, who's leading">${esc(e?.notes || '')}</textarea></div>
    <div class="row-btns">
      ${e ? `<button class="btn danger" onclick="confirmDelEvent('${e.id}')">Delete</button>` : ''}
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn brass" onclick="saveEventFromModal('${e?.id || ''}')">${e ? 'Save' : 'Add event'}</button>
    </div>
  </div>`;
  $('#modalBg').classList.add('open');
}
async function saveEventFromModal(id) {
  const title = $('#eTitle').value.trim(); if (!title) { toast('Title required', 'err'); return; }
  const e = id ? state.events.get(id) : makeEvent({ at: new Date($('#eAt').value).toISOString() });
  e.title = title; e.at = new Date($('#eAt').value).toISOString();
  e.kind = $('#eKind').value; e.location = $('#eLoc').value; e.notes = $('#eNotes').value;
  await saveEvent(e); closeModal(); toast(id ? 'Event saved' : 'Event added', 'ok'); render();
}
async function toggleAttend(id) {
  const me = currentMember(); if (!me) { toast('Set "this is me" on your member profile first', 'err'); return; }
  const e = state.events.get(id); if (!e) return;
  if (e.attendees.includes(me.id)) e.attendees = e.attendees.filter(a => a !== me.id);
  else e.attendees.push(me.id);
  await saveEvent(e); render();
}
async function confirmDelEvent(id) {
  if (!confirm('Delete this event?')) return;
  await delEvent(id); closeModal(); toast('Event deleted'); render();
}
// ════════════════════════════════════════════════════════════════
// RESOURCES
// ════════════════════════════════════════════════════════════════
function renderResources(body) {
  const rs = Array.from(state.resources.values()).sort((a,b) => a.name.localeCompare(b.name));
  body.innerHTML = `
    <div class="section-h">
      <h3>Resources</h3>
      <span class="sub">${rs.length} item${rs.length === 1 ? '' : 's'} · borrow within the community</span>
      <div class="actions"><button class="btn brass" onclick="openResourceModal()">+ New resource</button></div>
    </div>
    ${rs.length === 0 ? `<div class="empty">No shared resources yet. Tools, vehicles, equipment, spaces — anything that can be borrowed.</div>` :
      `<div class="grid">${rs.map(renderResourceCard).join('')}</div>`}
  `;
}
function renderResourceCard(r) {
  const owner = memberById(r.owner_id);
  const borrower = r.current_borrower_id ? memberById(r.current_borrower_id) : null;
  const me = currentMember();
  return `<div class="resource-card">
    <div class="top">
      <div class="ttl">${esc(r.name)}</div>
      <span class="avail ${r.available ? 'yes' : 'no'}">${r.available ? 'available' : 'borrowed'}</span>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <span class="tag">${esc(r.kind)}</span>
      <span class="tag brass">owned by ${esc(owner?.name || '?')}</span>
      ${borrower ? `<span class="tag rust">with ${esc(borrower.name)}</span>` : ''}
    </div>
    ${r.notes ? `<div style="font-size:12px;color:var(--cream-dim);line-height:1.5">${esc(r.notes)}</div>` : ''}
    <div class="borrow-row">
      ${me ? (r.available ?
        `<button class="btn sm leaf" onclick="borrowResource('${r.id}')">borrow</button>` :
        (borrower?.id === me.id ? `<button class="btn sm brass" onclick="returnResource('${r.id}')">return</button>` : '')
      ) : ''}
      <button class="btn sm ghost" onclick="openResourceModal('${r.id}')" style="margin-left:auto">edit</button>
    </div>
  </div>`;
}
function openResourceModal(id) {
  const r = id ? state.resources.get(id) : null;
  const me = currentMember();
  const members = activeMembers();
  if (members.length === 0) { toast('Add a member first', 'err'); return; }
  $('#modalBg').innerHTML = `<div class="modal">
    <span class="close" onclick="closeModal()">×</span>
    <h3>${r ? 'Edit resource' : 'New resource'}</h3>
    <div class="row"><label>Name</label><input type="text" id="rName" value="${esc(r?.name || '')}" placeholder="e.g. Cordless drill, Land Rover, Polytunnel"></div>
    <div class="row-flex">
      <div class="row" style="flex:1"><label>Kind</label><select id="rKind">
        ${RESOURCE_KINDS.map(k => `<option value="${k}" ${r?.kind === k ? 'selected' : ''}>${k}</option>`).join('')}
      </select></div>
      <div class="row" style="flex:1"><label>Owner</label><select id="rOwner">
        ${members.map(m => `<option value="${m.id}" ${(r?.owner_id || me?.id) === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
      </select></div>
    </div>
    <div class="row"><label>Notes (care instructions, condition, where it's kept)</label><textarea id="rNotes">${esc(r?.notes || '')}</textarea></div>
    <div class="row-btns">
      ${r ? `<button class="btn danger" onclick="confirmDelResource('${r.id}')">Delete</button>` : ''}
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn brass" onclick="saveResourceFromModal('${r?.id || ''}')">${r ? 'Save' : 'Add resource'}</button>
    </div>
  </div>`;
  $('#modalBg').classList.add('open');
}
async function saveResourceFromModal(id) {
  const name = $('#rName').value.trim(); if (!name) { toast('Name required', 'err'); return; }
  const r = id ? state.resources.get(id) : makeResource();
  r.name = name; r.kind = $('#rKind').value; r.owner_id = $('#rOwner').value; r.notes = $('#rNotes').value;
  await saveResource(r); closeModal(); toast(id ? 'Resource saved' : 'Resource added', 'ok'); render();
}
async function borrowResource(id) {
  const me = currentMember(); if (!me) { toast('Set "this is me" first', 'err'); return; }
  const r = state.resources.get(id); if (!r) return;
  r.available = false; r.current_borrower_id = me.id; r.borrowed_at = now();
  await saveResource(r); toast('Borrowed', 'ok'); render();
}
async function returnResource(id) {
  const r = state.resources.get(id); r.available = true; r.current_borrower_id = null; r.borrowed_at = null;
  await saveResource(r); toast('Returned', 'ok'); render();
}
async function confirmDelResource(id) {
  if (!confirm('Delete this resource?')) return;
  await delResource(id); closeModal(); toast('Resource deleted'); render();
}
// ════════════════════════════════════════════════════════════════
// SKILLS
// ════════════════════════════════════════════════════════════════
function renderSkills(body) {
  const ss = Array.from(state.skills.values()).filter(s => s.active).sort((a,b) => b.created_at.localeCompare(a.created_at));
  const teach = ss.filter(s => s.kind === 'teach');
  const help = ss.filter(s => s.kind === 'help-with');
  const looking = ss.filter(s => s.kind === 'looking-for');
  body.innerHTML = `
    <div class="section-h">
      <h3>Skills & exchanges</h3>
      <span class="sub">${ss.length} active offers · teach · help-with · looking-for</span>
      <div class="actions"><button class="btn brass" onclick="openSkillModal()">+ Post offer</button></div>
    </div>
    ${ss.length === 0 ? `<div class="empty">No active offers. Post one — what can you teach, where do you need help, what are you looking for?</div>` : ''}
    ${teach.length ? `<div class="section-h"><h3 style="font-size:14px;color:var(--leaf)">▸ Can teach</h3></div><div class="grid">${teach.map(renderSkillCard).join('')}</div>` : ''}
    ${help.length ? `<div class="section-h"><h3 style="font-size:14px;color:var(--amber)">▸ Help with</h3></div><div class="grid">${help.map(renderSkillCard).join('')}</div>` : ''}
    ${looking.length ? `<div class="section-h"><h3 style="font-size:14px;color:var(--slate)">▸ Looking for</h3></div><div class="grid">${looking.map(renderSkillCard).join('')}</div>` : ''}
  `;
}
function renderSkillCard(s) {
  const m = memberById(s.member_id);
  const colorClass = s.kind === 'teach' ? 'leaf' : s.kind === 'help-with' ? 'brass' : 'slate';
  return `<div class="skill-card">
    <div class="top">
      <div class="ttl">${esc(s.text)}</div>
      <span class="tag ${colorClass}">${esc(s.kind)}</span>
    </div>
    <div class="by">— ${esc(m?.name || 'unknown')} · ${fmtDate(s.created_at)}</div>
    <div style="display:flex;gap:6px">
      <button class="btn sm ghost" onclick="openSkillModal('${s.id}')">edit</button>
      <button class="btn sm danger" onclick="archiveSkill('${s.id}')" style="margin-left:auto">archive</button>
    </div>
  </div>`;
}
function openSkillModal(id) {
  const s = id ? state.skills.get(id) : null;
  const me = currentMember();
  if (!me && !id) { toast('Set "this is me" first', 'err'); return; }
  const members = activeMembers();
  $('#modalBg').innerHTML = `<div class="modal">
    <span class="close" onclick="closeModal()">×</span>
    <h3>${s ? 'Edit offer' : 'Post a skill offer'}</h3>
    <div class="row-flex">
      <div class="row" style="flex:1"><label>By</label><select id="sMember">
        ${members.map(m => `<option value="${m.id}" ${(s?.member_id || me?.id) === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
      </select></div>
      <div class="row" style="flex:1"><label>Kind</label><select id="sKind">
        ${SKILL_KINDS.map(k => `<option value="${k}" ${s?.kind === k ? 'selected' : ''}>${k}</option>`).join('')}
      </select></div>
    </div>
    <div class="row"><label>What</label><textarea id="sText" placeholder='e.g. "I can teach willow weaving Sundays", "Need help with electrical work in the barn"'>${esc(s?.text || '')}</textarea></div>
    <div class="row-btns">
      ${s ? `<button class="btn danger" onclick="confirmDelSkill('${s.id}')">Delete</button>` : ''}
      <button class="btn ghost" onclick="closeModal()">Cancel</button>
      <button class="btn brass" onclick="saveSkillFromModal('${s?.id || ''}')">${s ? 'Save' : 'Post'}</button>
    </div>
  </div>`;
  $('#modalBg').classList.add('open');
}
async function saveSkillFromModal(id) {
  const text = $('#sText').value.trim(); if (!text) { toast('Describe the offer', 'err'); return; }
  const s = id ? state.skills.get(id) : makeSkill();
  s.member_id = $('#sMember').value; s.kind = $('#sKind').value; s.text = text;
  await saveSkill(s); closeModal(); toast(id ? 'Saved' : 'Posted', 'ok'); render();
}
async function archiveSkill(id) {
  const s = state.skills.get(id); s.active = false; await saveSkill(s); toast('Archived'); render();
}
async function confirmDelSkill(id) {
  if (!confirm('Delete this offer?')) return;
  await delSkill(id); closeModal(); toast('Deleted'); render();
}
// ════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════
function renderSettings(body) {
  const total = state.members.size + state.ledger.size + state.proposals.size + state.events.size + state.resources.size + state.skills.size;
  body.innerHTML = `
    <div class="section-h"><h3>Settings</h3><span class="sub">community-wide · stored in this browser</span></div>
    <div class="settings-section">
      <h4>Community</h4>
      <div class="settings-row"><label>Name</label><div><input type="text" id="setName" value="${esc(state.meta.name)}"></div></div>
      <div class="settings-row"><label>Founded</label><div><input type="date" id="setFounded" value="${esc(state.meta.founded)}"></div></div>
      <div class="settings-row"><label>Unit peg definition</label><div>
        <input type="text" id="setPeg" value="${esc(state.meta.peg_definition)}">
        <div class="hint">e.g. "1 credit ≈ 1 hour of labour" · "1 credit = 1 kWh contributed" · whatever your community agrees</div>
      </div></div>
      <div class="settings-row"><label>Default voting method</label><div>
        <select id="setGov">${VOTING_METHODS.map(v => `<option value="${v}" ${state.meta.governance_default === v ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <div class="hint">consensus: 0 blocks + 0 no + ≥1 yes · sociocracy: 0 blocks + ≥1 yes · majority: yes > no · unanimous: all yes</div>
      </div></div>
      <div class="settings-row"><label>Ledger floor</label><div>
        <input type="number" id="setFloor" value="${state.meta.ledger_floor}" step="1">
        <div class="hint">Lowest balance a member can hold without community confirmation. Default: -50.</div>
      </div></div>
      <div class="settings-row"><label>Mesh sync URL (optional)</label><div>
        <input type="text" id="setMesh" value="${esc(state.meta.mesh_url || '')}" placeholder="leave empty to stay device-local">
        <div class="hint">Point at a relay (Cloudflare Worker or your community Pi) to sync between members.</div>
      </div></div>
      <div style="margin-top:14px"><button class="btn brass" onclick="saveSettingsFromModal()">Save settings</button></div>
    </div>
    <div class="settings-section">
      <h4>AI assist · 3 tiers · default off</h4>
      <div class="settings-row"><label>Tier</label><div>
        <select id="setAiTier" onchange="onAiTierChange()">
          <option value="T0" ${state.meta.ai_tier === 'T0' ? 'selected' : ''}>T0 · off (default · the seed works fully without AI)</option>
          <option value="T2" ${state.meta.ai_tier === 'T2' ? 'selected' : ''}>T2 · WebLLM in-browser (~2GB one-time download · sovereign · runs offline forever after)</option>
          <option value="T3" ${state.meta.ai_tier === 'T3' ? 'selected' : ''}>T3 · BYOK Anthropic or OpenAI key (you pay · stored in IndexedDB · never proxied)</option>
        </select>
        <div class="hint">AI is opt-in. Proposal drafting and ledger description suggestions become available when enabled. The seed itself runs fully at T0.</div>
      </div></div>
      <div class="settings-row" id="setT3Row" style="display:${state.meta.ai_tier === 'T3' ? 'grid' : 'none'}"><label>BYOK provider</label><div>
        <select id="setAiProvider">
          <option value="anthropic" ${state.meta.api_provider === 'anthropic' ? 'selected' : ''}>Anthropic (claude-sonnet-4-5)</option>
          <option value="openai" ${state.meta.api_provider === 'openai' ? 'selected' : ''}>OpenAI (gpt-4o-mini)</option>
        </select>
      </div></div>
      <div class="settings-row" id="setT3KeyRow" style="display:${state.meta.ai_tier === 'T3' ? 'grid' : 'none'}"><label>API key</label><div>
        <input type="password" id="setAiKey" value="${esc(state.meta.api_key || '')}" placeholder="${state.meta.api_key ? '(unchanged — leave empty to keep)' : 'sk-ant-... or sk-...'}" autocomplete="off">
        <div class="hint">Stored only in your browser's IndexedDB. Sent direct to the provider — never to us. Wipe via Reset workspace.</div>
      </div></div>
      <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn brass" onclick="saveAiSettings()">Save AI settings</button>
        ${state.meta.ai_tier === 'T2' ? `<button class="btn ${AI.ready ? 'leaf' : 'brass'}" onclick="loadWebLLM()" ${AI.ready || AI.loading ? 'disabled' : ''}>${AI.ready ? '✓ WebLLM loaded' : AI.loading ? `loading ${Math.round(AI.progress)}%` : 'Load WebLLM (~2GB)'}</button>` : ''}
        <button class="btn ghost" onclick="openAiPanel()">Tier status</button>
      </div>
    </div>
    <div class="settings-section">
      <h4>Backup & data</h4>
      <div class="settings-row"><label>Records</label><div style="font-family:var(--mono);font-size:11px;color:var(--cream-muted);letter-spacing:.04em">${state.members.size} members · ${state.ledger.size} ledger entries · ${state.proposals.size} proposals · ${state.events.size} events · ${state.resources.size} resources · ${state.skills.size} skill offers · ${total} records total</div></div>
      <div class="settings-row"><label>Export whole community</label><div><button class="btn brass" onclick="exportAll()">⤓ Download JSON backup</button><div class="hint">One file containing everything. Re-importable into any install of this seed.</div></div></div>
      <div class="settings-row"><label>Import backup</label><div><input type="file" id="importFile" accept=".json" onchange="importAll(this.files[0])"><div class="hint">Merges into your current community. Existing IDs win.</div></div></div>
      <div class="settings-row"><label>Reset</label><div><button class="btn danger" onclick="wipeAll()">⚠ Reset everything</button><div class="hint">Deletes ALL community data from this browser. Cannot be undone.</div></div></div>
    </div>
    <div class="settings-section">
      <h4>About</h4>
      <div style="font-size:12.5px;color:var(--cream-dim);line-height:1.65">
        Off-Grid Community System v1.0 · MIT · part of the AI Native Solutions estate.<br>
        Single HTML PWA · IndexedDB local · works offline · save the file and it runs forever.<br>
        Source: <a href="https://github.com/sjgant80-hub/offgridcommunitiessystem" target="_blank">github.com/sjgant80-hub/offgridcommunitiessystem</a> · Estate: <a href="https://www.ai-nativesolutions.com" target="_blank">ai-nativesolutions.com</a>
      </div>
    </div>
  `;
}
function onAiTierChange() {
}
async function saveAiSettings() {
  if (newKey) state.meta.api_key = newKey;
  await saveMeta();
  toast('AI settings saved', 'ok');
  render();
}
async function saveSettingsFromModal() {
  state.meta.name = $('#setName').value.trim() || 'Your Community';
  state.meta.founded = $('#setFounded').value;
  state.meta.peg_definition = $('#setPeg').value;
  state.meta.governance_default = $('#setGov').value;
  state.meta.ledger_floor = Number($('#setFloor').value) || -50;
  state.meta.mesh_url = $('#setMesh').value.trim() || null;
  await saveMeta(); toast('Settings saved', 'ok'); render();
}
async function exportAll() {
  const data = {
    ogcs_version: '1.0', kcc_version: '1.0', exported_at: now(),
    meta: state.meta,
    members: Array.from(state.members.values()),
    ledger: Array.from(state.ledger.values()),
    proposals: Array.from(state.proposals.values()),
    events: Array.from(state.events.values()),
    resources: Array.from(state.resources.values()),
    skills: Array.from(state.skills.values()),
  };
  downloadFile(JSON.stringify(data, null, 2), `kcc-${state.meta.name.toLowerCase().replace(/\s+/g, '-')}-${ymd(new Date())}.json`, 'application/json');
  toast('Backup downloaded', 'ok');
}
async function importAll(file) {
  if (!file) return;
  const txt = await file.text();
  let data; try { data = JSON.parse(txt); } catch (e) { toast('Invalid JSON', 'err'); return; }
  if (!data.ogcs_version && !data.kcc_version) { toast("Not a valid backup", "err"); return; }
  if (!confirm(`Import ${data.members?.length || 0} members, ${data.ledger?.length || 0} ledger entries, ${data.proposals?.length || 0} proposals? Existing IDs will be overwritten.`)) return;
  if (data.meta) state.meta = { ...state.meta, ...data.meta };
  for (const m of data.members || []) { state.members.set(m.id, m); await dbPut('members', m); }
  for (const l of data.ledger || []) { state.ledger.set(l.id, l); await dbPut('ledger', l); }
  for (const p of data.proposals || []) { state.proposals.set(p.id, p); await dbPut('proposals', p); }
  for (const e of data.events || []) { state.events.set(e.id, e); await dbPut('events', e); }
  for (const r of data.resources || []) { state.resources.set(r.id, r); await dbPut('resources', r); }
  for (const s of data.skills || []) { state.skills.set(s.id, s); await dbPut('skills', s); }
  await saveMeta();
  toast('Imported', 'ok'); render();
}
async function wipeAll() {
  if (!confirm('Delete ALL community data from this browser? Cannot be undone. Have you exported a backup?')) return;
  if (!confirm('Really wipe everything?')) return;
  await db.close();
  await new Promise((res, rej) => { const r = indexedDB.deleteDatabase(DB_NAME); r.onsuccess = res; r.onerror = rej; });
  location.reload();
}
// ════════════════════════════════════════════════════════════════
// HELP TAB · how it works
// ════════════════════════════════════════════════════════════════
function renderHelp(body) {
  body.innerHTML = `
    <div class="hero" style="background:linear-gradient(135deg,rgba(192,138,58,.08),rgba(107,141,74,.04))">
      <h2>How this works</h2>
      <div class="lede">Read once. It's all in one HTML file on your device. No accounts. No subscriptions. No data leaves you.</div>
    </div>
    <div class="settings-section">
      <h4>The 30-second version</h4>
      <p style="font-size:13.5px;color:var(--cream-dim);line-height:1.7;margin-bottom:10px">A small community needs a few simple things:</p>
      <ol style="font-size:13.5px;color:var(--cream-dim);line-height:1.85;margin-left:24px;margin-bottom:10px">
        <li><strong style="color:var(--brass)">Know who's in the group.</strong> Add members (◉ tab).</li>
        <li><strong style="color:var(--brass)">Track who's helped whom.</strong> Record exchanges in the ledger (⊞ tab). 1 credit ≈ 1 hour of contributed labour by default — your community can redefine it.</li>
        <li><strong style="color:var(--brass)">Decide things together.</strong> Raise proposals (§ tab). Five voting methods baked in — fall-consensus is the default, see below.</li>
        <li><strong style="color:var(--brass)">Coordinate the calendar.</strong> Workdays, harvests, meetings (▦ tab).</li>
        <li><strong style="color:var(--brass)">Share tools.</strong> Anyone can list a tool or vehicle others can borrow (⚒ tab).</li>
        <li><strong style="color:var(--brass)">Trade skills.</strong> Teach what you know, ask for what you need (☆ tab).</li>
      </ol>
      <p style="font-size:13.5px;color:var(--cream-dim);line-height:1.7">That's the whole tool. Open the laptop, do the thing, close the laptop, go outside.</p>
    </div>
    <div class="settings-section">
      <h4>Fall Consensus · the 7-dim convergence method</h4>
      <p style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-bottom:10px">Most voting systems force everyone to a single yes/no. People with nuance get squeezed into a side they don't really hold. Decisions pass that nobody fully believes in.</p>
      <p style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-bottom:10px"><strong style="color:var(--brass)">Fall Consensus</strong> asks each member to position themselves on <strong>seven dimensions</strong>, not one. Together, those positions form your <em>bloom vector</em> — a 7-dimensional point describing how you stand toward this proposal.</p>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin:10px 0">
        <thead><tr style="background:var(--void-2)">
          <th style="padding:6px 10px;text-align:left;font-family:var(--mono);font-size:10px;color:var(--cream-muted);letter-spacing:.08em;text-transform:uppercase">Dimension</th>
          <th style="padding:6px 10px;text-align:left;font-family:var(--mono);font-size:10px;color:var(--cream-muted);letter-spacing:.08em;text-transform:uppercase">The question</th>
        </tr></thead>
        <tbody>
          ${FALL_DIMS.map(d => `<tr><td style="padding:6px 10px;border-top:1px solid var(--line-soft);color:var(--brass);font-weight:600">${esc(d.l)}</td><td style="padding:6px 10px;border-top:1px solid var(--line-soft);color:var(--cream-dim)">${esc(d.d)}</td></tr>`).join('')}
        </tbody>
      </table>
      <p style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-bottom:10px">When you submit, the system computes the <strong style="color:var(--brass)">cosine similarity</strong> between your bloom vector and every other member's. The proposal converges — and can be locked in — when:</p>
      <ul style="font-size:13px;color:var(--cream-dim);line-height:1.85;margin-left:24px;margin-bottom:10px;font-family:var(--mono)">
        <li>avg similarity across all member pairs ≥ <strong style="color:var(--brass)">${FALL_THRESH.avgSim}%</strong></li>
        <li>weakest pair similarity ≥ <strong style="color:var(--brass)">${FALL_THRESH.minPair}%</strong></li>
        <li>variance across all dimensions ≤ <strong style="color:var(--brass)">${FALL_THRESH.maxVar}</strong></li>
      </ul>
      <p style="font-size:13px;color:var(--cream-dim);line-height:1.7">No central tally. No majority-overrules-minority. Nobody gets dragged. You move together or you keep talking.</p>
    </div>
    <div class="settings-section">
      <h4>The other voting methods</h4>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px">
        <thead><tr style="background:var(--void-2)">
          <th style="padding:6px 10px;text-align:left;font-family:var(--mono);font-size:10px;color:var(--cream-muted);letter-spacing:.08em;text-transform:uppercase">Method</th>
          <th style="padding:6px 10px;text-align:left;font-family:var(--mono);font-size:10px;color:var(--cream-muted);letter-spacing:.08em;text-transform:uppercase">Passes when</th>
        </tr></thead>
        <tbody>
          <tr><td style="padding:6px 10px;border-top:1px solid var(--line-soft);color:var(--brass);font-weight:600">consensus</td><td style="padding:6px 10px;border-top:1px solid var(--line-soft);color:var(--cream-dim)">≥1 yes · 0 no · 0 blocks. One block stops it.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid var(--line-soft);color:var(--brass);font-weight:600">sociocracy</td><td style="padding:6px 10px;border-top:1px solid var(--line-soft);color:var(--cream-dim)">≥1 yes · 0 blocks. No-votes are OK; blocks aren't. ("Good enough for now, safe enough to try.")</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid var(--line-soft);color:var(--brass);font-weight:600">majority</td><td style="padding:6px 10px;border-top:1px solid var(--line-soft);color:var(--cream-dim)">More yes than no votes.</td></tr>
          <tr><td style="padding:6px 10px;border-top:1px solid var(--line-soft);color:var(--brass);font-weight:600">unanimous</td><td style="padding:6px 10px;border-top:1px solid var(--line-soft);color:var(--cream-dim)">Every active member votes yes.</td></tr>
        </tbody>
      </table>
    </div>
    <div class="settings-section">
      <h4>The ledger · mutual credit, in your own unit</h4>
      <p style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-bottom:10px">Every exchange is a transfer from one member to another, denominated in <strong style="color:var(--brass)">${unit()}</strong> (configurable in Settings). Both parties must confirm before the entry counts toward balances.</p>
      <p style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-bottom:10px">No central bank. No fees. Balances can go negative within the community-set floor (default <strong style="color:var(--brass)">${state.meta.ledger_floor || -50} ${unit()}</strong>). The lowest balance someone can hold without community discussion.</p>
      <p style="font-size:13px;color:var(--cream-dim);line-height:1.7"><strong style="color:var(--brass)">Default peg:</strong> ${esc(state.meta.peg_definition)} — your community can redefine in Settings.</p>
    </div>
    <div class="settings-section">
      <h4>Where your data lives</h4>
      <p style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-bottom:10px">All data sits in <strong style="color:var(--brass)">IndexedDB on this device</strong>. Open browser DevTools → Application → IndexedDB → <code style="font-family:var(--mono);background:var(--ink);padding:1px 4px;border-radius:2px">offgrid_db</code> to see it. Open Network tab and use the app: zero outbound requests.</p>
      <p style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-bottom:10px">For multi-device or multi-member sync, set a <strong style="color:var(--brass)">mesh URL</strong> in Settings — a small relay (Cloudflare Worker free tier, or your community Raspberry Pi). The relay forwards updates; it never holds data. If the relay goes down, every device still has the local copy. If we disappear, the HTML file you saved keeps working.</p>
      <p style="font-size:13px;color:var(--cream-dim);line-height:1.7"><strong style="color:var(--brass)">Backup ritual:</strong> Settings → Export → keep a JSON file somewhere safe (USB, second device, a printout if you're hardcore). One file = the entire community state. Re-importable into any install.</p>
    </div>
    <div class="settings-section">
      <h4>Run it on a Raspberry Pi (community-on-a-shelf)</h4>
      <pre style="font-family:var(--mono);font-size:11.5px;background:var(--ink);padding:14px 16px;border-radius:4px;color:var(--cream-dim);line-height:1.55;border:1px solid var(--line);overflow-x:auto">curl -O https://sjgant80-hub.github.io/offgridcommunitiessystem/index.html
python3 -m http.server 8080 --bind 0.0.0.0
# every member on your local network visits http://&lt;pi-ip&gt;:8080</pre>
      <p style="font-size:12.5px;color:var(--cream-muted);line-height:1.7;margin-top:8px;font-family:var(--mono);letter-spacing:.04em">~80KB file · system fonts only · zero CDN dependencies · runs offline · runs on a school chromebook</p>
    </div>
    <div class="settings-section">
      <h4>The tone</h4>
      <p style="font-size:13px;color:var(--cream-dim);line-height:1.7;font-style:italic">Practical. Dignified. Land-grounded. Not a hippy aesthetic. Not a tech-bro aesthetic. Closer to "1880s farmers' co-operative manual" meets "Linux man page". The tool should help you spend <em>less</em> time on the laptop, not more. The best signal it's working: a member closes the laptop and goes outside.</p>
      <p style="font-size:13px;color:var(--cream-dim);line-height:1.7;margin-top:10px"><strong style="color:var(--brass)">Star Trek × Hobbiton.</strong> Few hours online. Rest in the garden.</p>
    </div>
  `;
}
// ════════════════════════════════════════════════════════════════
// ONBOARDING modal · first load
// ════════════════════════════════════════════════════════════════
function showOnboarding() {
  $('#modalBg').innerHTML = `<div class="modal" style="max-width:620px">
    <span class="close" onclick="completeOnboarding()">×</span>
    <h3 style="color:var(--brass)">Welcome to your community OS</h3>
    <p style="font-size:13.5px;color:var(--cream-dim);line-height:1.7;margin-bottom:14px">No SaaS. No subscription. No account. Your data lives in this browser. Open Network tab in DevTools — nothing leaves.</p>
    <div style="font-family:var(--mono);font-size:11px;color:var(--cream-muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">In 90 seconds</div>
    <ol style="font-size:13px;color:var(--cream-dim);line-height:1.85;margin-left:24px;margin-bottom:14px">
      <li>Add yourself as a member (◉ tab) — tick <em>"this is me"</em> on your profile.</li>
      <li>Add a few other members.</li>
      <li>Record an exchange in the ledger (⊞ tab) — both parties confirm.</li>
      <li>Raise a proposal (§ tab) using <strong style="color:var(--brass)">Fall Consensus</strong> — the 7-dim convergence method.</li>
      <li>Tap the <strong>? Help</strong> tab any time for the full how-it-works.</li>
    </ol>
    <p style="font-size:12px;color:var(--cream-muted);line-height:1.6;margin-bottom:14px">Save the page to disk (right-click → Save As) and it runs offline forever. Settings → Export anytime to back up the whole community as one JSON.</p>
    <div class="row-btns">
      <button class="btn brass" onclick="completeOnboarding()">Got it. Let's go.</button>
    </div>
  </div>`;
  $('#modalBg').classList.add('open');
}
async function completeOnboarding() {
  state.meta.onboarded = true; await saveMeta();
  closeModal();
}
// ════════════════════════════════════════════════════════════════
// Modal + helpers
// ════════════════════════════════════════════════════════════════
function closeModal() { $('#modalBg').classList.remove('open'); $('#modalBg').innerHTML = ''; }
$('#modalBg').addEventListener('click', e => { if (e.target.id === 'modalBg') closeModal(); });
function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}
function ymd(d) { return d.toISOString().slice(0, 10); }
// ════════════════════════════════════════════════════════════════
// Boot
// ════════════════════════════════════════════════════════════════
(async () => {
  try {
    await openDB();
    await loadAll();
    render();
    if (!state.meta.onboarded) setTimeout(showOnboarding, 400);
  } catch (e) {
    console.error('boot failed', e);
    document.body.innerHTML = '<div style="padding:40px;color:#ebe3d2;background:#1a1612;min-height:100vh;font-family:system-ui,sans-serif"><h1 style="color:#c08a3a;font-family:Georgia,serif">Off-Grid Community System could not start</h1><p>' + esc(e.message) + '</p><p>Try: Ctrl+Shift+Delete to clear site data, then reload.</p></div>';
  }
})();

// Named exports for the primary API surface
export { openDB };
export { tx };
export { dbGet };
export { dbGetAll };
export { dbPut };
export { dbDel };
export { toast };
export { esc };
export { unit };
export { aiTier };

export { DB_NAME };
export { DB_VERSION };
export { ROLES };
export { LEDGER_CATEGORIES };
export { PROPOSAL_TYPES };
export { VOTING_METHODS };
export { FALL_DIMS };
export { FALL_THRESH };
export { EVENT_KINDS };
export { RESOURCE_KINDS };
