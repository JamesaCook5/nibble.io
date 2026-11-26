(() => {
'use strict';

/* ---------- constants ---------- */
const $ = s => document.querySelector(s);
const TIERS = {
  quantum:     { name: 'Megabyte',      score: 100, color: '#ffcc33', sq: '🟨' },
  liquid:      { name: 'Kilobyte',      score: 85,  color: '#b98cff', sq: '🟪' },
  overclocked: { name: 'Byte',          score: 60,  color: '#4aa3ff', sq: '🟦' },
  tuned:       { name: 'Nibble',        score: 30,  color: '#5ad17a', sq: '🟩' },
  stock:       { name: 'Bit',           score: 10,  color: '#b8c0cc', sq: '⬜' },
  miss:        { name: 'No signal',     score: 0,   color: '#5a6275', sq: '⬛' }
};
const TIER_ORDER = ['stock', 'tuned', 'overclocked', 'liquid', 'quantum'];
const UPGRADE_EVERY = 75; // points per rig upgrade
const PREVIEW_MS = 3000, ANSWER_MS = 25000, URGENT_MS = 3050, ROUNDS = 7;
const EPOCH = '2026-11-26', TZ = 'Europe/London';   // Daily counter reset to #0; advances at London midnight

// Eight rigs. Geometry is in % of the scene (x, y = top-left; w, h = size; stand = % of monitor height).
const KB_A = { x: 30, y: 65.5, w: 40, h: 27 }, KB_B = { x: 29.5, y: 65.5, w: 41, h: 27 }, KB_C = { x: 28.5, y: 65, w: 43, h: 27.5 }, KB_D = { x: 27.5, y: 64.5, w: 45, h: 28.5 };
const MS_A = { x: 74.5, y: 72, w: 4.4, h: 12 }, MS_B = { x: 75.5, y: 72, w: 4.2, h: 11.5 }, MS_C = { x: 76.5, y: 72, w: 4.4, h: 12 }, MS_D = { x: 77.5, y: 71.5, w: 4.6, h: 12.5 };
const STAGES = [
  { label: '1981 · Beige box',       screen: 'green',  mono: true, kb: 'beige',   mouse: 'ball',    caseKind: 'desktop',     mon: 'crt',
    main: { x: 34, y: 4, w: 32, h: 47, stand: 0 }, box: { x: 29, y: 50, w: 42, h: 13 }, kbBox: KB_A, msBox: MS_A, side: [], extras: ['lamp', 'mug', 'pad'] },
  { label: '1987 · Amber terminal',  screen: 'amber',  mono: true, kb: 'beige',   mouse: 'ball',    caseKind: 'desktop',     mon: 'crt',
    main: { x: 33.5, y: 3, w: 33, h: 48, stand: 0 }, box: { x: 29, y: 50, w: 42, h: 13 }, kbBox: KB_A, msBox: MS_A, side: [], extras: ['lamp', 'mug', 'pad'] },
  { label: '1995 · Colour CRT',      screen: 'dos',    kb: 'beige',   mouse: 'ball',    caseKind: 'tower-beige', mon: 'crt',
    main: { x: 30.5, y: 5, w: 37, h: 58, stand: 11 }, box: { x: 72, y: 28, w: 11, h: 35 }, kbBox: KB_A, msBox: MS_A, side: [], extras: ['lamp', 'mug', 'pad'] },
  { label: '2003 · First flat panel', screen: 'teal',  kb: 'black',   mouse: 'optical', caseKind: 'tower-grey',  mon: 'lcd',
    main: { x: 30.5, y: 6, w: 38, h: 57, stand: 17 }, box: { x: 75, y: 27, w: 11, h: 36 }, kbBox: KB_B, msBox: MS_B, side: [], extras: ['mug', 'plant', 'pad'] },
  { label: '2010 · Widescreen',      screen: 'modern', kb: 'black',   mouse: 'optical', caseKind: 'tower-black', mon: 'lcd',
    main: { x: 26.5, y: 9, w: 47, h: 54, stand: 15 }, box: { x: 80, y: 25, w: 11, h: 38 }, kbBox: KB_B, msBox: MS_B, side: [], extras: ['mug', 'plant', 'pad'] },
  { label: '2016 · Dual monitors',   screen: 'modern', kb: 'mech',    mouse: 'gaming',  caseKind: 'tower-led',   mon: 'lcd',
    main: { x: 17, y: 9, w: 45, h: 54, stand: 15 }, box: { x: 3, y: 25, w: 11, h: 38 }, kbBox: KB_C, msBox: MS_C,
    side: [{ x: 63, y: 12, w: 33, h: 51, rot: -20, stand: 14, content: 'board' }], extras: ['mug', 'plant', 'deskmat'] },
  { label: '2021 · Triple screen',   screen: 'modern', kb: 'rgb',     mouse: 'gaming',  caseKind: 'tower-rgb',   mon: 'lcd',
    main: { x: 31, y: 10, w: 38, h: 53, stand: 15 }, box: { x: 88, y: 23, w: 11, h: 40 }, kbBox: KB_C, msBox: MS_C,
    side: [{ x: 2.5, y: 14, w: 30, h: 49, rot: 22, stand: 14, content: 'board' }, { x: 67.5, y: 14, w: 30, h: 49, rot: -22, stand: 14, content: 'code' }],
    extras: ['plant', 'deskmat', 'led'] },
  { label: 'Today · Command centre', screen: 'pro',    kb: 'premium', mouse: 'premium', caseKind: 'none',        mon: 'lcd', arms: true,
    main: { x: 33, y: 24.5, w: 34, h: 37.5, stand: 0 }, box: null, kbBox: KB_D, msBox: MS_D,
    side: [{ x: 2.5, y: 25.5, w: 31, h: 35, rot: 24, stand: 0, content: 'board' }, { x: 66.5, y: 25.5, w: 31, h: 35, rot: -24, stand: 0, content: 'code' },
           { x: 35, y: 1, w: 30, h: 22.5, rot: 0, stand: 0, content: 'timer' }],
    extras: ['plant', 'deskmat', 'led'] }
];

// Keyboard: [code, legend, shifted char, width in key units]. Every row is 15 units wide.
const ROWS = [
  [['Backquote','`','~'],['Digit1','1','!'],['Digit2','2','@'],['Digit3','3','#'],['Digit4','4','$'],['Digit5','5','%'],['Digit6','6','^'],['Digit7','7','&'],['Digit8','8','*'],['Digit9','9','('],['Digit0','0',')'],['Minus','-','_'],['Equal','=','+'],['Backspace','⌫ Back',null,2]],
  [['Tab','Tab',null,1.5],...'QWERTYUIOP'.split('').map(c=>['Key'+c,c,null]),['BracketLeft','[','{'],['BracketRight',']','}'],['Backslash','\\','|',1.5]],
  [['CapsLock','Caps',null,1.75],...'ASDFGHJKL'.split('').map(c=>['Key'+c,c,null]),['Semicolon',';',':'],['Quote',"'",'"'],['Enter','Enter',null,2.25]],
  [['ShiftLeft','Shift',null,2.25],...'ZXCVBNM'.split('').map(c=>['Key'+c,c,null]),['Comma',',','<'],['Period','.','>'],['Slash','/','?'],['ShiftRight','Shift',null,2.75]],
  [['ControlLeft','Ctrl',null,1.5],['MetaLeft','◆',null,1.25],['AltLeft','Alt',null,1.25],['Space','',null,7],['AltRight','Alt',null,1.25],['MetaRight','◆',null,1.25],['ControlRight','Ctrl',null,1.5]]
];

/* ---------- helpers ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

function norm(s) {
  return String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/['’]s\b/g, '').replace(/\*/g, ' star ').replace(/&/g, ' and ')
    .replace(/[^a-z0-9+#]+/g, ' ').trim()
    .replace(/^(the|an|a) (?=\S)/, '').replace(/\s+/g, '');
}
function keyFor(p, s) {
  if (p.prep) s = p.prep(String(s));
  let k = norm(s);
  if (p.strip) { const k2 = k.replace(p.strip, ''); if (k2) k = k2; }
  return k;
}
function buildIndex(p) {
  if (p._idx) return p._idx;
  const map = new Map(), all = [];
  for (const t of TIER_ORDER) for (const entry of (p[t] || [])) {
    const names = entry.split('|');
    const item = { display: names[0], tier: t };
    all.push(item);
    for (const n of names) { const k = keyFor(p, n); if (k && !map.has(k)) map.set(k, item); }
  }
  return (p._idx = { map, all });
}
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
function judge(p, raw) {
  const { map } = buildIndex(p);
  const k = keyFor(p, raw);
  if (!k) return { ok: false };
  const hit = map.get(k);
  if (hit) return { ok: true, item: hit };
  if (k.length >= 5) {
    const maxD = k.length >= 9 ? 2 : 1;
    let best = null, bd = 99, tie = false;
    for (const [key, item] of map) {
      const d = lev(k, key, maxD);
      if (d < bd) { bd = d; best = item; tie = false; } else if (d === bd && item !== best) tie = true;
    }
    if (best && bd <= maxD && !tie) return { ok: false, suggest: best.display };
  }
  return { ok: false };
}

function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffled(arr, rnd) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function londonDate(d = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d); }
function dayNumber(date) { return Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(EPOCH + 'T00:00:00Z')) / 864e5); }
function msToLondonMidnight() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
  const g = t => +parts.find(p => p.type === t).value;
  return (86400 - (g('hour') * 3600 + g('minute') * 60 + g('second'))) * 1000;
}
const stageFor = score => clamp(Math.floor(score / UPGRADE_EVERY), 0, 7);

/* ---------- state ---------- */
const params = new URLSearchParams(location.search);
// Daily and random modes both run seven prompts; only daily results are saved.
const SESSION_KEY = 'nibble:session:v3';
const savedSession = store.get(SESSION_KEY);
const randomRequested = params.has('random') || params.has('unlimited') || params.has('practice');
if (randomRequested) history.replaceState(null, '', '?home=1');
const hasModeParam = params.has('home') || params.has('daily') || randomRequested;
let unlimited = false; // Random is currently locked.
const forcedStage = params.has('stage') ? clamp(parseInt(params.get('stage'), 10) || 0, 0, 7) : null;
const today = londonDate();
const day = dayNumber(today);
const seed = today;
const byPromptId = new Map(window.PROMPTS.map(p => [p.id, p]));
const defaultDailyPrompts = shuffled(window.PROMPTS, mulberry32(hashStr(today))).slice(0, ROUNDS);
const configuredDailyIds = Array.isArray(window.DAILY_PROMPT_IDS) ? window.DAILY_PROMPT_IDS : null;
let dailyPrompts = configuredDailyIds?.length === ROUNDS && new Set(configuredDailyIds).size === ROUNDS && configuredDailyIds.every(id => byPromptId.has(id))
  ? configuredDailyIds.map(id => byPromptId.get(id)) : defaultDailyPrompts;
function makeUnlimited() { return shuffled(window.PROMPTS, mulberry32(hashStr('random-' + Date.now()))).slice(0, ROUNDS); }
const restoredRun = Array.isArray(savedSession?.promptIds) ? savedSession.promptIds.map(id => byPromptId.get(id)) : [];
const restoredResults = Array.isArray(savedSession?.results) ? savedSession.results : [];
const resultsMatchRun = restoredResults.length <= ROUNDS && restoredResults.every((r,i) => r.id === restoredRun[i]?.id);
const restoredPromptsMatchMode = savedSession?.mode !== 'daily' || restoredRun.every((p,i) => p?.id === dailyPrompts[i]?.id);
const validPhases = new Set(['intro','preview','answering','feedback','done']);
const restoreSession = !params.has('home') && !!savedSession && savedSession.mode === (unlimited ? 'random' : 'daily') && savedSession.date === today && validPhases.has(savedSession.phase) && restoredRun.length === ROUNDS && restoredRun.every(Boolean) && resultsMatchRun && restoredPromptsMatchMode;
let prompts = restoreSession ? restoredRun : unlimited ? makeUnlimited() : dailyPrompts;
const SAVE_KEY = 'nibble:v3:' + today;
const dailySaved = store.get(SAVE_KEY);
const dailyResultsValid = Array.isArray(dailySaved?.results) && dailySaved.results.length <= ROUNDS && dailySaved.results.every((r,i) => r.id === dailyPrompts[i]?.id);
const daily = { results: dailyResultsValid ? dailySaved.results.slice() : [], score: 0, done: false };
if (!dailyResultsValid && dailySaved) store.set(SAVE_KEY, null);
daily.score = daily.results.reduce((a,r) => a + r.score, 0);
daily.done = (!!dailySaved?.done && dailyResultsValid) || daily.results.length >= ROUNDS;
const STREAK_KEY = 'nibble:streak:v2';
function shiftDate(date, days) { return new Date(Date.parse(date + 'T00:00:00Z') + days * 864e5).toISOString().slice(0,10); }
function syncDailyStreak(completed = daily.done) {
  if (!completed) return store.get(STREAK_KEY);
  const current = store.get(STREAK_KEY);
  if (current?.lastDate === today) return current;
  const next = { count:current?.lastDate === shiftDate(today,-1) ? Math.max(0, Number(current.count) || 0) + 1 : 1, lastDate:today };
  store.set(STREAK_KEY,next);
  return next;
}
function getDailyStreak() {
  const current = store.get(STREAK_KEY);
  return current && (current.lastDate === today || current.lastDate === shiftDate(today,-1)) ? Math.max(0, Number(current.count) || 0) : 0;
}
const S = { phase: restoreSession ? savedSession.phase : 'intro', menu: unlimited ? 1 : 0, results: restoreSession ? restoredResults : [], score: 0, stage: 0, previewEndsAt: 0, answerEndsAt: 0, msg: '', msgKind: '', feedbackAt: 0, resumed: false, dailyDone: false };
if (!unlimited && !restoreSession) { S.results = daily.results.slice(); S.score = daily.score; S.resumed = S.results.length > 0 && !daily.done; S.dailyDone = daily.done; }
if (restoreSession) { S.score = S.results.reduce((a, r) => a + r.score, 0); S.resumed = S.results.length > 0 && S.phase !== 'done'; S.dailyDone = !unlimited && S.phase === 'done'; S.previewEndsAt = performance.now() + Math.max(0, savedSession.previewRemaining || 0); S.answerEndsAt = performance.now() + Math.max(0, savedSession.answerRemaining || 0); }
S.stage = Math.max(stageFor(S.score), forcedStage ?? 0);
const save = () => {
  if (adminTestMode) return;
  if (!unlimited) {
    store.set(SAVE_KEY, { results: S.results, done: S.phase === 'done' });
    if (S.phase === 'done' || S.results.length >= ROUNDS) { syncDailyStreak(true); renderStreakBadge(); }
  }
  saveSession();
};
function saveSession() {
  if (adminTestMode || !prompts?.length) return;
  store.set(SESSION_KEY, { date: today, mode: unlimited ? 'random' : 'daily', phase: S.phase, results: S.results, promptIds: prompts.map(p => p.id), input: input?.value || '', previewRemaining: Math.max(0, S.previewEndsAt - performance.now()), answerRemaining: Math.max(0, S.answerEndsAt - performance.now()) });
}
const curPrompt = () => prompts[Math.min(S.results.length, ROUNDS - 1)];
const setDone = () => S.results.length >= ROUNDS;

// Estimated score-to-percentile curve supplied for the no-player-data period.
const DAILY_SCORE_CURVE = [
  { score:0, percentile:0 }, { score:115, percentile:10 }, { score:165, percentile:20 },
  { score:210, percentile:30 }, { score:250, percentile:40 }, { score:285, percentile:50 },
  { score:320, percentile:60 }, { score:355, percentile:70 }, { score:390, percentile:80 },
  { score:425, percentile:90 }, { score:700, percentile:100 }
];
function estimatedDailyPercentile(score) {
  const value = clamp(score, 0, 700);
  for (let i=1; i<DAILY_SCORE_CURVE.length; i++) {
    const upper=DAILY_SCORE_CURVE[i], lower=DAILY_SCORE_CURVE[i-1];
    if (value <= upper.score) {
      const part=(value-lower.score)/(upper.score-lower.score);
      return Math.round(lower.percentile+part*(upper.percentile-lower.percentile));
    }
  }
  return 100;
}

/* ---------- DOM ---------- */
const screensEl = $('#screens'), screenEl = $('#screen'), scrBody = $('#scrBody');
const scrLeft = $('#scrLeft'), screenScore = $('#screenScore'), fuse = $('#fuse'), sideWrap = $('#sideScreens');
const input = $('#answer'), dock = $('#dock'), dockPrompt = $('#dockPrompt'), dockMsg = $('#dockMsg');
input.inputMode = 'text';
const resultsEl = $('#results'), rigCanvas = $('#rig');
const adminOverlay = $('#adminOverlay'), adminLoginPanel = $('#adminLoginPanel'), adminPanel = $('#adminPanel');
const adminLoginForm = $('#adminLoginForm'), adminPassword = $('#adminPassword'), adminLoginStatus = $('#adminLoginStatus');
const adminPromptList = $('#adminPromptList'), adminSearch = $('#adminSearch'), adminDate = $('#adminDate');
const adminSelectionCount = $('#adminSelectionCount'), adminSaveStatus = $('#adminSaveStatus'), adminSave = $('#adminSave');
const adminTest = $('#adminTest'), adminTestExit = $('#adminTestExit');
const streakBadge = $('#streakBadge'), streakCount = $('#streakCount');
let adminSequence = '', adminSequenceAt = 0, adminAuthenticated = false, adminTestMode = false;
const adminAnswerCache = new Map();
if (restoreSession) { input.value = savedSession.input || ''; input.readOnly = !['answering','preview'].includes(S.phase); }

function renderStreakBadge() {
  const count = getDailyStreak();
  streakCount.textContent = String(count);
  streakBadge.setAttribute('aria-label', `${count}-day daily streak on this device`);
  const completedToday = store.get(STREAK_KEY)?.lastDate === today;
  streakBadge.title = count ? `${count}-day daily streak · ${completedToday ? 'completed today' : 'complete today to keep it going'}` : 'No active daily streak yet';
}
renderStreakBadge();

const syncModeLabel = () => { $('#dayLabel').textContent = adminTestMode ? 'TEST' : unlimited ? 'RANDOM' : '#' + day; };
syncModeLabel();

/* ---------- admin prompt editor ---------- */
function openAdminLogin() {
  adminSequence = ''; adminOverlay.hidden = false; adminLoginPanel.hidden = false; adminPanel.hidden = true;
  adminLoginStatus.textContent = ''; adminPassword.value = ''; adminSaveStatus.textContent = '';
  input.blur(); adminPassword.focus({preventScroll:true});
}
function closeAdmin() {
  adminOverlay.hidden = true; adminPassword.value = ''; adminSequence = '';
  if (adminAuthenticated) { fetch('/api/admin/logout',{method:'POST'}).catch(()=>{}); adminAuthenticated = false; }
}
function trackAdminCharacter(ch) {
  const now = performance.now();
  if (now - adminSequenceAt > 2500) adminSequence = '';
  adminSequenceAt = now;
  adminSequence = (adminSequence + ch.toLowerCase()).slice(-11);
  if (adminSequence === 'adminrights') openAdminLogin();
}
function updateAdminSelection() {
  const count = adminPromptList.querySelectorAll('.admin-prompt-select:checked').length;
  const completed = adminPromptList.querySelectorAll('.admin-prompt-complete:checked').length;
  adminSelectionCount.textContent = `${count} / 7 selected · ${completed} complete`;
  adminSave.disabled = count !== 7;
  adminTest.disabled = count !== 7;
}
function startAdminTest() {
  const selectedIds = [...adminPromptList.querySelectorAll('.admin-prompt-select:checked')].map(input => input.value);
  const selectedPrompts = selectedIds.map(id => window.PROMPTS.find(prompt => String(prompt.id) === id));
  if (selectedPrompts.length !== ROUNDS || selectedPrompts.some(prompt => !prompt)) return;
  prompts = selectedPrompts;
  adminTestMode = true;
  adminOverlay.hidden = true;
  adminPassword.value = '';
  if (adminAuthenticated) fetch('/api/admin/logout', {method:'POST'}).catch(() => {});
  adminAuthenticated = false;
  S.phase = 'intro'; S.menu = 0; S.results = []; S.score = 0; S.resumed = false; S.dailyDone = false;
  S.stage = forcedStage ?? 0; applyStage(S.stage, false); syncModeLabel();
  adminTestExit.hidden = false;
  startRound();
}
function renderAdminPromptChoices(selectedIds, completedIds, scheduledIds) {
  const selected = new Set(selectedIds || []), completed = new Set(completedIds || []), scheduled = new Set(scheduledIds || []), fragment = document.createDocumentFragment();
  for (const prompt of window.PROMPTS) {
    const row = document.createElement('div'); row.className = 'admin-prompt-option'; row.dataset.promptId = prompt.id;
    const choice = document.createElement('label'); choice.className = 'admin-prompt-choice';
    const wasScheduled = scheduled.has(prompt.id), isComplete = completed.has(prompt.id) || wasScheduled;
    row.dataset.usedBefore = String(wasScheduled);
    const checkbox = document.createElement('input'); checkbox.className = 'admin-prompt-select'; checkbox.type = 'checkbox'; checkbox.value = prompt.id; checkbox.checked = selected.has(prompt.id); checkbox.disabled = isComplete;
    const text = document.createElement('span'); text.textContent = prompt.prompt;
    choice.append(checkbox,text);

    const actions = document.createElement('div'); actions.className = 'admin-prompt-actions';
    const answerButton = document.createElement('button'); answerButton.type = 'button'; answerButton.dataset.adminAnswers = ''; answerButton.textContent = 'View answers';
    const completeLabel = document.createElement('label'); completeLabel.className = 'admin-complete-toggle';
    const complete = document.createElement('input'); complete.className = 'admin-prompt-complete'; complete.type = 'checkbox'; complete.value = prompt.id; complete.checked = isComplete; complete.disabled = wasScheduled;
    const completeText = document.createElement('span'); completeText.textContent = wasScheduled ? 'Used' : 'Complete';
    completeLabel.append(complete,completeText); actions.append(answerButton,completeLabel);

    const answerPreview = document.createElement('div'); answerPreview.className = 'admin-answer-preview'; answerPreview.hidden = true;
    answerPreview.setAttribute('aria-label', `Accepted answers for ${prompt.prompt}`);
    row.append(choice,actions,answerPreview);
    if (isComplete) row.setAttribute('aria-disabled','true');
    fragment.append(row);
  }
  adminPromptList.replaceChildren(fragment); updateAdminSelection();
}
async function loadAdminPromptChoices() {
  const response = await fetch('/api/admin/daily');
  if (!response.ok) throw new Error('Admin session expired. Unlock again.');
  const data = await response.json(); adminDate.textContent = data.date;
  const completed = data.completedPromptIds || [], scheduled = data.scheduledPromptIds || [], used = new Set([...completed,...scheduled]);
  const available = window.PROMPTS.filter(prompt => !used.has(prompt.id));
  const selected = data.promptIds || available.slice(0, ROUNDS).map(prompt => prompt.id);
  renderAdminPromptChoices(selected, completed, scheduled);
}

function renderAdminAnswers(container, answers) {
  container.replaceChildren();
  if (!answers.length) {
    const empty = document.createElement('p'); empty.textContent = 'No accepted answers are available for this prompt yet.'; container.append(empty); return;
  }
  const names = {quantum:'Megabyte', liquid:'Kilobyte', overclocked:'Byte', tuned:'Nibble', stock:'Bit'};
  const order = ['Megabyte','Kilobyte','Byte','Nibble','Bit'], grouped = new Map();
  for (const answer of answers) {
    const tier = names[answer.tier] || answer.tier || 'Bit';
    if (!grouped.has(tier)) grouped.set(tier, []);
    grouped.get(tier).push(answer.display);
  }
  const groups = document.createElement('div'); groups.className = 'admin-answer-groups';
  for (const tier of [...order.filter(name => grouped.has(name)), ...[...grouped.keys()].filter(name => !order.includes(name))]) {
    const section = document.createElement('section'); section.className = 'admin-answer-group';
    const heading = document.createElement('h4'); heading.textContent = `${tier} · ${grouped.get(tier).length}`;
    const list = document.createElement('ul');
    for (const answer of grouped.get(tier)) { const item = document.createElement('li'); item.textContent = answer; list.append(item); }
    section.append(heading,list); groups.append(section);
  }
  container.append(groups);
}

async function toggleAdminAnswers(button, row) {
  const panel = row.querySelector('.admin-answer-preview');
  const opening = panel.hidden;
  panel.hidden = !opening; button.textContent = opening ? 'Hide answers' : 'View answers';
  button.setAttribute('aria-expanded', String(opening));
  if (!opening || panel.dataset.loaded) return;
  panel.dataset.loaded = 'loading';
  const promptId = row.dataset.promptId;
  try {
    let answers = adminAnswerCache.get(promptId);
    if (!answers) {
      const response = await fetch(`/api/answers?id=${encodeURIComponent(promptId)}`);
      if (!response.ok) throw new Error('Could not load this answer set.');
      answers = (await response.json()).answers || [];
      adminAnswerCache.set(promptId, answers);
    }
    renderAdminAnswers(panel, answers); panel.dataset.loaded = 'true';
  } catch (err) {
    panel.dataset.loaded = '';
    const message = document.createElement('p'); message.textContent = err.message || 'Could not load this answer set.'; panel.replaceChildren(message);
  }
}

/* ---------- keyboard (drawn by render.js) ---------- */
const charToCode = new Map(), shiftChar = new Map(), baseChar = new Map();
for (const row of ROWS) for (const [code, legend, shifted] of row) {
  if (legend.length === 1 && !code.startsWith('Meta')) {
    const base = legend.toLowerCase();
    baseChar.set(code, base); shiftChar.set(code, shifted || legend.toUpperCase());
    charToCode.set(base, code); charToCode.set(shifted || legend.toUpperCase(), code);
  }
}
charToCode.set(' ', 'Space');
const codeAlias = { NumpadEnter: 'Enter', OSLeft: 'MetaLeft', OSRight: 'MetaRight', IntlBackslash: 'Backslash' };
const downCodes = new Set(), physicalDown = new Set();
function pressKey(code) { code = codeAlias[code] || code; if (!Rig.hasKey(code)) return; Rig.press(code); downCodes.add(code); }
function releaseKey(code) { code = codeAlias[code] || code; Rig.release(code); downCodes.delete(code); }
function tapKey(code, ms = 110) { pressKey(code); setTimeout(() => { if (!physicalDown.has(code)) releaseKey(code); }, ms); }
function releaseAll() { for (const c of [...downCodes]) releaseKey(c); physicalDown.clear(); }

/* ---------- sound ---------- */
let actx = null, noiseBuf = null;
let soundOn = store.get('nibble:sound') ?? true;
const soundBtn = $('#soundBtn');
function syncSoundBtn() { soundBtn.setAttribute('aria-pressed', String(soundOn)); soundBtn.title = soundOn ? 'Sound on' : 'Sound off'; }
syncSoundBtn();
soundBtn.addEventListener('click', () => { soundOn = !soundOn; store.set('nibble:sound', soundOn); syncSoundBtn(); soundBtn.blur(); });
function audio() {
  if (!soundOn) return null;
  if (!actx) {
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    noiseBuf = actx.createBuffer(1, actx.sampleRate * 0.08, actx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (actx.state === 'suspended') actx.resume();
  return actx;
}
const KB_SOUND = { // GUESS: tuned by ear for the feel of each era
  beige:   { f: 2400, q: 1.4, d: 0.05,  g: 0.30, th: 0.10, tf: 220 },
  black:   { f: 1700, q: 0.8, d: 0.025, g: 0.14, th: 0,    tf: 0 },
  mech:    { f: 3300, q: 2.2, d: 0.03,  g: 0.26, th: 0.12, tf: 180 },
  rgb:     { f: 3300, q: 2.2, d: 0.03,  g: 0.26, th: 0.12, tf: 180 },
  premium: { f: 1250, q: 1.0, d: 0.035, g: 0.22, th: 0.32, tf: 120 }
};
function keySound(code) {
  const ac = audio(); if (!ac) return;
  const p = KB_SOUND[STAGES[S.stage].kb]; const big = code === 'Space' || code === 'Enter' || code === 'Backspace';
  const t = ac.currentTime;
  const src = ac.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = 0.9 + Math.random() * 0.2;
  const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = p.f * (big ? 0.7 : 1) * (0.95 + Math.random() * 0.1); bp.Q.value = p.q;
  const g = ac.createGain(); g.gain.setValueAtTime(p.g, t); g.gain.exponentialRampToValueAtTime(0.001, t + p.d * (big ? 1.4 : 1));
  src.connect(bp).connect(g).connect(ac.destination); src.start(t); src.stop(t + 0.08);
  if (p.th) {
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(p.tf * (big ? 0.8 : 1), t); o.frequency.exponentialRampToValueAtTime(p.tf * 0.6, t + 0.05);
    const og = ac.createGain(); og.gain.setValueAtTime(p.th, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    o.connect(og).connect(ac.destination); o.start(t); o.stop(t + 0.07);
  }
}
function tones(freqs, type = 'square', step = 0.07, len = 0.12, vol = 0.08) {
  const ac = audio(); if (!ac) return; const t = ac.currentTime;
  freqs.forEach((f, i) => {
    const o = ac.createOscillator(); o.type = type; o.frequency.value = f;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t + i * step); g.gain.exponentialRampToValueAtTime(vol, t + i * step + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + i * step + len);
    o.connect(g).connect(ac.destination); o.start(t + i * step); o.stop(t + i * step + len + 0.02);
  });
}

/* ---------- stage / scene ---------- */
function sideContent(kind) {
  if (kind === 'code') return `<div class="code-scroll"><pre>${esc(CODE_TEXT + '\n' + CODE_TEXT)}</pre></div>`;
  if (kind === 'timer') return `<div class="side-title">TIMER</div><div class="timer-big" data-timer>--</div><div class="legend">${TIER_ORDER.slice().reverse().map(t => `<span style="--tc:${TIERS[t].color}">${TIERS[t].name} ${TIERS[t].score}</span>`).join('')}</div>`;
  return `<div class="side-title">SCOREBOARD</div><div class="side-chips" data-chips></div><div class="side-score" data-score></div><div class="side-sub" data-stage></div>`;
}
const CODE_TEXT = `def partition(a, lo, hi):
    pivot = a[hi]
    i = lo - 1
    for j in range(lo, hi):
        if a[j] <= pivot:
            i += 1
            a[i], a[j] = a[j], a[i]
    a[i+1], a[hi] = a[hi], a[i+1]
    return i + 1

def quicksort(a, lo, hi):
    if lo < hi:
        p = partition(a, lo, hi)
        quicksort(a, lo, p - 1)
        quicksort(a, p + 1, hi)

# rig.upgrade() -> ok
# fans: 1200rpm  temp: 41C
# mem: 64GB  ok`;

function applyStage(n, animate) {
  const st = STAGES[n];
  Rig.setStage(n, animate);
  Object.assign(screensEl.dataset, { stage: n, screen: st.screen, mon: st.mon });
  screenEl.classList.toggle('mono', !!st.mono);
  const existing = [...sideWrap.children];
  st.side.forEach((g, i) => {
    let el = existing[i];
    if (!el) { el = document.createElement('div'); el.className = 'screen side-screen'; sideWrap.appendChild(el); }
    if (el.dataset.content !== g.content) { el.dataset.content = g.content; el.innerHTML = sideContent(g.content); }
  });
  existing.slice(st.side.length).forEach(el => el.remove());
  renderSides();
}
// render.js tells us where each monitor's screen is, in CSS pixels, every frame.
const lastLayout = new WeakMap();
function placeScreen(el, r, radius) {
  const sig = `${r.left}|${r.top}|${r.width}|${r.height}|${r.a ?? 1}|${radius}`;
  if (lastLayout.get(el) === sig) return; lastLayout.set(el, sig);
  Object.assign(el.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', opacity: r.a ?? 1, borderRadius: radius + 'px' });
  el.style.setProperty('--u', (Math.min(r.width * 1.3, r.height * 1.8) / 100).toFixed(3) + 'px');
}
function onLayout(main, sides, radius) {
  placeScreen(screenEl, main, radius);
  sides.forEach((r, i) => { const el = sideWrap.children[i]; if (el) placeScreen(el, r, 0); });
}
function upgradeTo(n) {
  if (n <= S.stage) return;
  S.stage = n;
  Rig.zap();
  tones([392, 523, 659, 784, 1047], 'square', 0.06, 0.14, 0.06);
  setTimeout(() => { applyStage(n, true); renderHud(); }, 140);
  const b = document.createElement('div'); b.className = 'banner';
  b.innerHTML = `<small>UPGRADE INSTALLED</small>${esc(STAGES[n].label)}`;
  screenEl.appendChild(b); setTimeout(() => b.remove(), 2600);
}

/* ---------- rendering ---------- */
function rarerExamples(p, tier, count = 2) {
  const { all } = buildIndex(p);
  const minIdx = tier === 'miss' ? -1 : TIER_ORDER.indexOf(tier);
  const pool = all.filter(i => TIER_ORDER.indexOf(i.tier) > minIdx);
  const rnd = mulberry32(hashStr(p.id + seed));
  const top = shuffled(pool.filter(i => i.tier === 'quantum' || i.tier === 'liquid'), rnd);
  const rest = shuffled(pool, rnd);
  const out = [];
  for (const i of [...top, ...rest]) { if (!out.includes(i)) out.push(i); if (out.length >= count) break; }
  return out;
}
function tierHTML(t) { return `<span class="tier" style="--tc:${TIERS[t].color}">${TIERS[t].name}</span>`; }

/* ---------- review screen (after round 7) ----------
   Scroll the monitor to see each round. Tap a round to open every accepted answer,
   grouped by rarity, with filter chips and a search box (like a results "catch"). */
let reviewOpen = -1, reviewFilter = 'all', reviewQuery = '';
const RARE_FIRST = [...TIER_ORDER].reverse();
const loadedAnswerSheets = new Set();
async function loadReviewAnswers() {
  const jobs = S.results.map(async (result, i) => {
    const p = prompts[i]; if (!p || loadedAnswerSheets.has(p.id)) return;
    const response = await fetch('/api/answers?id=' + encodeURIComponent(p.id));
    if (!response.ok) { p._answersUnavailable = true; return; }
    const data = await response.json();
    for (const tier of TIER_ORDER) p[tier] = [];
    for (const answer of data.answers) p[answer.tier].push(answer.display);
    p._idx = null; p._answersLoaded = true; loadedAnswerSheets.add(p.id);
  });
  await Promise.all(jobs);
  if (S.phase === 'done') renderScreen();
}
let histogramSortPlayed = false;
function scoreCurveHTML(animateHistogram = false) {
  if (unlimited) return '';
  const score = clamp(S.score,0,700), percentile=estimatedDailyPercentile(score);
  const left=54, right=746, base=144, blockCount=100, span=right-left, step=span/blockCount, gap=1.35;
  const density=x=>Math.exp(-0.5*Math.pow((x-260)/138,2));
  // Each bar has a score-bin key and a target height; the animation shuffles
  // the bars, then insertion-sorts them directly into the estimated density.
  const random=mulberry32(hashStr('nibble-score-histogram-'+today));
  const finalHeights=Array.from({length:blockCount},(_,i)=>Math.max(5,Math.round(7+78*density((i+.5)*7)+(random()-.5)*9)));
  const randomHeights=Array.from({length:blockCount},()=>Math.round(8+random()*78));
  const initialOrder=Array.from({length:blockCount},(_,i)=>i);
  for(let i=initialOrder.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[initialOrder[i],initialOrder[j]]=[initialOrder[j],initialOrder[i]];}
  const active=Math.min(blockCount-1,Math.floor(score/700*blockCount));
  const order=animateHistogram?initialOrder:Array.from({length:blockCount},(_,i)=>i);
  const bars=order.map((key,position)=>{
    const randomHeight=randomHeights[key],h=animateHistogram?randomHeight:finalHeights[key],x=left+position*step+gap/2,y=base-h;
    const className=animateHistogram?(position%2?'curve-bar alt':'curve-bar'):(key===active?'curve-bar active':position%2?'curve-bar alt':'curve-bar');
    const from=key*7,to=Math.min(700,(key+1)*7);
    return `<rect class="${className}" data-key="${key}" data-random-height="${randomHeight}" data-final-height="${finalHeights[key]}" data-active="${key===active}" x="${x.toFixed(2)}" y="${y}" width="${(step-gap).toFixed(2)}" height="${h}"><title>Score ${from}–${to}${key===active?' · your score':''}</title></rect>`;
  }).join('');
  const activeX=left+(active+.5)*step, labelX=clamp(activeX,left+31,right-31);
  const ticks=[0,115,250,425,700].map(v=>{const x=left+span*v/700;return `<line class="curve-grid" x1="${x}" y1="26" x2="${x}" y2="${base}"/><text class="curve-tick" x="${x}" y="164" text-anchor="middle">${v}</text>`}).join('');
  const scoreLabel = adminTestMode ? 'TOTAL TEST SCORE' : 'TOTAL DAILY SCORE';
  return `<section class="score-curve"><div class="curve-heading"><div><strong>ESTIMATED SCORE DISTRIBUTION</strong><small>100 score blocks · 0–700</small></div><div class="curve-rank">BETTER THAN <b>${percentile}%</b></div></div><svg viewBox="0 0 800 184" role="img" aria-label="Estimated score distribution shown as 100 blocks. Your score ${score} is in the highlighted block and is better than ${percentile} percent of players.">${ticks}${bars}<line class="curve-axis" x1="${left}" y1="${base}" x2="${right}" y2="${base}"/><text class="curve-you" x="${labelX}" y="18" text-anchor="middle">YOU · ${score}</text><text class="curve-axis-label" x="${(left+right)/2}" y="181" text-anchor="middle">${scoreLabel}</text></svg><div class="curve-note">${animateHistogram?'SHUFFLED INPUT · INSERTION SORT STARTING':'Illustrative estimated score density · no player data yet'}</div></section>`;
}
function animateHistogramSort(svg) {
  const bars=Array.from(svg.querySelectorAll('.curve-bar'));
  if(bars.length!==100)return;
  const order=bars.slice(),frames=[];
  for(let i=1;i<order.length;i++){
    const key=order[i];let j=i-1;
    while(j>=0&&Number(order[j].dataset.key)>Number(key.dataset.key)){order[j+1]=order[j];j--;}
    order[j+1]=key;
    frames.push({order:order.slice(),pass:i,key});
  }
  const note=svg.closest('.score-curve')?.querySelector('.curve-note'),label=svg.querySelector('.curve-you');
  const base=144,left=54,step=692/100,gap=1.35;
  let frameIndex=0;
  function playFrame(){
    const frame=frames[frameIndex];
    frame.order.forEach((bar,position)=>{
      const height=position<=frame.pass?Number(bar.dataset.finalHeight):Number(bar.dataset.randomHeight),alt=position%2?' alt':'';
      bar.setAttribute('x',left+position*step+gap/2);bar.setAttribute('height',height);bar.setAttribute('y',base-height);
      bar.setAttribute('class',`curve-bar${alt}${bar===frame.key?' sorting':position<=frame.pass?' sorted':''}`);
    });
    if(note)note.textContent=`INSERTION SORT INTO SCORE BINS · ${frame.pass}/99`;
    frameIndex++;
    if(frameIndex<frames.length){setTimeout(()=>requestAnimationFrame(playFrame),24);return;}
    frame.order.forEach((bar,position)=>{
      const height=Number(bar.dataset.finalHeight),alt=position%2?' alt':'';
      bar.setAttribute('x',left+position*step+gap/2);bar.setAttribute('height',height);bar.setAttribute('y',base-height);
      bar.setAttribute('class',`curve-bar${bar.dataset.active==='true'?' active':alt}`);
    });
    if(label)label.style.opacity='1';
    if(note)setTimeout(()=>{note.textContent='Illustrative estimated score density · no player data yet';},550);
  }
  setTimeout(()=>requestAnimationFrame(playFrame),450);
}
function reviewHTML(animateHistogram = false) {
  const rows = S.results.map((r, i) => {
    const p = prompts[i], open = i === reviewOpen;
    return `<li class="rv-row${open ? ' open' : ''}">
      <button type="button" class="rv-head" data-toggle="${i}" aria-expanded="${open}">
        <span class="rv-n">${i + 1}</span>
        <span class="rv-main"><span class="rv-q">${esc(p.prompt)}</span><span class="rv-a">${r.answer ? esc(r.answer) : '<span class="dim">no answer</span>'}</span>
          <span class="rv-t" style="--tc:${TIERS[r.tier].color}">${r.tier === 'miss' ? 'no signal' : TIERS[r.tier].name}</span></span>
        <span class="rv-pts" style="--tc:${TIERS[r.tier].color}">+${r.score}</span><span class="rv-car">${open ? '▾' : '▸'}</span>
      </button>${open ? reviewDetailHTML(p, r) : ''}
    </li>`;
  }).join('');
  return `${scoreCurveHTML(animateHistogram)}<div class="rv-top"><div class="answer-list-label">Your seven answers</div><div class="t-sub">${esc(STAGES[S.stage].label)} · tap a question to browse its answer set</div></div>
    <ol class="rv-list">${rows}</ol>
    <div class="rv-foot">${adminTestMode ? 'ADMIN TEST · score, daily progress and streak are not saved' : 'new daily set at midnight (UK time) · Random locked'}</div>`;
}
function reviewDetailHTML(p, r) {
  return `<div class="rv-detail">${chipsHTML(p)}<input class="rv-search" type="text" spellcheck="false" autocomplete="off" placeholder="search every answer…" value="${esc(reviewQuery)}" aria-label="Search answers"><ul class="rv-answers">${answersHTML(p, r)}</ul></div>`;
}
function chipsHTML(p) {
  const all = buildIndex(p).all, n = t => all.filter(i => i.tier === t).length;
  return `<div class="rv-chips">${[['all', 'All', all.length, '']].concat(RARE_FIRST.map(t => [t, TIERS[t].name, n(t), TIERS[t].color]))
    .map(([k, name, c, col]) => `<button type="button" class="rv-chip${reviewFilter === k ? ' on' : ''}" data-filter="${k}"${col ? ` style="--tc:${col}"` : ''}>${name} <b>${c}</b></button>`).join('')}</div>`;
}
function answersHTML(p, r) {
  if (!p._answersLoaded) return `<li class="rv-none">${p._answersUnavailable ? 'answers unavailable' : 'loading answers…'}</li>`;
  const q = norm(reviewQuery);
  const list = buildIndex(p).all
    .filter(i => (reviewFilter === 'all' || i.tier === reviewFilter) && (!q || norm(i.display).includes(q)))
    .sort((x, y) => RARE_FIRST.indexOf(x.tier) - RARE_FIRST.indexOf(y.tier) || x.display.localeCompare(y.display));
  if (!list.length) return '<li class="rv-none">nothing matches</li>';
  return list.map(i => `<li class="${i.display === r.answer ? 'mine' : ''}" style="--tc:${TIERS[i.tier].color}"><span>${esc(i.display)}${i.display === r.answer ? ' <em>you</em>' : ''}</span><span class="s">${TIERS[i.tier].score}</span></li>`).join('')
    + `<li class="rv-count">${list.length} answer${list.length === 1 ? '' : 's'}</li>`;
}
function reviewKey(e) {
  if (e.target.classList?.contains('rv-search')) { if (e.key === 'Escape') e.target.blur(); return; }
  const step = { ArrowDown: 48, ArrowUp: -48, PageDown: scrBody.clientHeight * .8, PageUp: -scrBody.clientHeight * .8, ' ': scrBody.clientHeight * .8 }[e.key];
  if (step) { e.preventDefault(); scrBody.scrollBy({ top: step, behavior: 'smooth' }); return; }
  const s = scrBody.querySelector('.rv-search');
  if (s && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) s.focus({ preventScroll: true });
}
scrBody.addEventListener('click', e => {
  if (S.phase !== 'done') return;
  const t = e.target.closest('[data-toggle]'), f = e.target.closest('[data-filter]');
  if (t) {
    const i = +t.dataset.toggle; reviewOpen = reviewOpen === i ? -1 : i; reviewFilter = 'all'; reviewQuery = '';
    renderScreen();
  } else if (f) {
    reviewFilter = f.dataset.filter;
    scrBody.querySelectorAll('.rv-chip').forEach(c => c.classList.toggle('on', c === f));
    scrBody.querySelector('.rv-answers').innerHTML = answersHTML(prompts[reviewOpen], S.results[reviewOpen]);
  }
});
scrBody.addEventListener('input', e => {
  if (S.phase !== 'done' || !e.target.classList.contains('rv-search')) return;
  reviewQuery = e.target.value;
  scrBody.querySelector('.rv-answers').innerHTML = answersHTML(prompts[reviewOpen], S.results[reviewOpen]);
});

function renderScreen() {
  adminTestExit.hidden = !adminTestMode;
  document.body.classList.toggle('ipad-results', S.phase === 'done');
  const p = curPrompt(), round = Math.min(S.results.length + 1, ROUNDS), of = '/7';
  screenScore.textContent = S.phase === 'intro' ? '' : String(S.score).padStart(3, '0');
  let html = '';
  if (S.phase === 'intro') {
    scrLeft.textContent = 'HOME';
    const dDesc = daily.done ? `done · ${daily.score} pts · see answers` : daily.results.length ? `resume round ${daily.results.length + 1}/7` : '111<sub>2</sub> prompts, same for everyone';
    html = `<div class="t-title t-home">nibble.io</div>
      <div class="menu" role="listbox" aria-label="Mode">
        <button type="button" class="mopt${S.menu === 0 ? ' on' : ''}" data-mode="0" role="option" aria-selected="${S.menu === 0}"><span class="mk">▸</span><span class="mt">DAILY #${day}<small>${dDesc}</small></span></button>
        <button type="button" class="mopt locked" data-mode="1" role="option" aria-disabled="true" disabled><span class="mk">▸</span><span class="mt">RANDOM · LOCKED<small>Currently unavailable</small></span></button>
      </div>
      <div class="t-cta blink">↑ ↓ CHOOSE · ENTER BOOT</div>`;
  } else if (S.phase === 'preview') {
    scrLeft.textContent = `ROUND ${round}${of}`;
    html = `<div class="t-pill">READ <span data-pv>3</span></div><div class="t-prompt">${esc(p.prompt)}</div>`;
  } else if (S.phase === 'answering') {
    scrLeft.textContent = `ROUND ${round}${of}`;
    html = `<div class="t-prompt small">${esc(p.prompt)}</div><div class="t-line">&gt; <span data-typed></span></div><div class="t-msg ${S.msgKind}">${S.msg}</div>`;
  } else if (S.phase === 'feedback') {
    const r = S.results[S.results.length - 1], pp = prompts[S.results.length - 1];
    scrLeft.textContent = `ROUND ${S.results.length}${of}`;
    const ex = rarerExamples(pp, r.tier);
    html = `<div class="t-prompt small">${esc(pp.prompt)}</div>
      <div class="t-line">&gt; ${r.answer ? esc(r.answer) : '<span class="dim">(no answer)</span>'}</div>
      <div class="t-tier" style="--tc:${TIERS[r.tier].color}">${r.tier === 'miss' ? 'NO SIGNAL' : TIERS[r.tier].name.toUpperCase()} <b>+${r.score}</b></div>
      ${ex.length ? `<div class="t-hint">${r.tier === 'miss' ? 'could have said' : 'rarer'}: ${ex.map(i => esc(i.display)).join(' · ')}</div>` : ''}
      <div class="t-cta blink">${setDone() ? 'PRESS ENTER ▸ SEE ALL ANSWERS' : 'PRESS ENTER WHEN READY ▸ NEXT'}</div>
      `;
  } else if (S.phase === 'done') {
    scrLeft.textContent = unlimited ? 'RANDOM · RESULTS' : `#${day} · RESULTS`;
    html = reviewHTML();
  }
  scrBody.innerHTML = html;
  scrBody.dataset.phase = S.phase;
  lastMirror = '';
  dockPrompt.textContent = (S.phase === 'preview' || S.phase === 'answering') ? p.prompt : '';
  const last = S.results[S.results.length - 1];
  dockMsg.innerHTML = S.phase === 'answering' ? S.msg :
    S.phase === 'feedback' ? `<span style="color:${TIERS[last.tier].color}">${TIERS[last.tier].name} +${last.score}</span> · Enter for ${setDone() ? 'results' : 'next round'}` : '';
  dockMsg.className = 'bar-msg' + (S.phase === 'answering' && S.msgKind === 'bad' ? ' bad' : '');
  input.placeholder = { intro: S.menu ? 'Enter: random set' : S.resumed ? 'Enter: resume daily' : 'Enter: daily set', preview: 'Read the prompt…', answering: 'Type your answer', feedback: 'Press Enter for the next round', done: unlimited ? 'Nice run' : 'Come back tomorrow' }[S.phase];
  $('#passBtn').disabled = S.phase !== 'answering';
  $('#goBtn').disabled = S.phase === 'preview' || S.phase === 'done';
  if (S.phase !== 'answering' && S.phase !== 'preview') { input.value = S.phase === 'feedback' ? (last.answer || '') : ''; setRing(S.phase === 'feedback' ? 0 : 1, S.phase === 'feedback' ? '✓' : '25', false); if (S.phase === 'feedback' && last.tier === 'miss') setRing(0, '✕', false); }
}
function renderChips(el) {
  const base = unlimited ? Math.max(0, S.results.length - (S.phase === 'done' ? 7 : 6)) : 0;
  el.innerHTML = Array.from({ length: ROUNDS }, (_, j) => {
    const i = base + j, r = S.results[i];
    const cur = !r && i === S.results.length && S.phase !== 'done' && S.phase !== 'intro';
    return `<span class="chip${cur ? ' cur' : ''}${r ? ' filled' : ''}" style="--tc:${r ? TIERS[r.tier].color : 'transparent'}" title="${r ? esc(TIERS[r.tier].name) : 'Round ' + (i + 1)}"></span>`;
  }).join('');
}
function renderHud() {
  renderChips($('#chips'));
  $('#score').textContent = S.score;
  $('#resultsBtn').hidden = S.phase !== 'done';
  const displayedStage = S.phase === 'intro' ? 0 : S.stage;
  const st = STAGES[displayedStage];
  $('#stageName').textContent = st.label;
  const nextAt = (S.stage + 1) * UPGRADE_EVERY;
  const into = S.stage >= 7 ? 1 : clamp((S.score - S.stage * UPGRADE_EVERY) / UPGRADE_EVERY, 0, 1);
  $('#meterFill').style.transform = `scaleX(${into})`;
  $('#meterLabel').textContent = S.stage >= 7 ? 'dream setup unlocked' : `next upgrade at ${nextAt}`;
  renderSides();
}
function renderSides() {
  lastSec = -2;
  sideWrap.querySelectorAll('[data-chips]').forEach(renderChips);
  sideWrap.querySelectorAll('[data-score]').forEach(el => el.innerHTML = `${S.score}<small> pts</small>`);
  sideWrap.querySelectorAll('[data-stage]').forEach(el => el.textContent = STAGES[S.phase === 'intro' ? 0 : S.stage].label);
}

let lastMirror = '';
function mirrorTyped() {
  const el = scrBody.querySelector('[data-typed]'); if (!el) return;
  const v = input.value, a = input.selectionStart ?? v.length, b = input.selectionEnd ?? v.length;
  const focused = document.activeElement === input;
  const sig = v + '|' + a + '|' + b + '|' + focused;
  if (sig === lastMirror) return; lastMirror = sig;
  if (a !== b) el.innerHTML = esc(v.slice(0, a)) + `<mark>${esc(v.slice(a, b))}</mark>` + esc(v.slice(b));
  else el.innerHTML = esc(v.slice(0, a)) + `<span class="caret${focused ? '' : ' off'}"></span>` + esc(v.slice(a));
}

let animateIpadOnNextRender = false;
function renderResults() {
  if (S.phase !== 'done') { resultsEl.hidden = true; return; }
  const answerScrollTop = resultsEl.hidden ? 0 : (resultsEl.querySelector('.ipad-body')?.scrollTop || 0);
  resultsEl.hidden = false;
  const animateHistogram=!histogramSortPlayed;
  resultsEl.innerHTML = `<div class="ipad-shell${animateIpadOnNextRender ? ' ipad-enter' : ''}"><div class="ipad-screen">
    <header class="ipad-header"><div><div class="ipad-kicker">NIBBLE.IO · ${adminTestMode ? 'ADMIN TEST' : unlimited ? 'RANDOM SET' : 'DAILY SET #' + day}</div><h1>Answer review</h1></div>
      <div class="ipad-score"><strong>${S.score}</strong><span>points</span></div></header>
    <div class="ipad-body">${reviewHTML(animateHistogram)}</div>
    <footer class="ipad-footer"><button class="btn locked-action" type="button" disabled>Random locked</button><a class="btn ghost" href="?home=1">Home</a></footer>
  </div><div class="ipad-camera"></div><button class="ipad-side-button" type="button" aria-label="Tablet side button" tabindex="-1"></button></div>`;
  resultsEl.querySelector('.ipad-body').scrollTop = answerScrollTop;
  if (animateHistogram) {
    histogramSortPlayed=true;
    const svg=resultsEl.querySelector('.score-curve svg');
    if(svg)animateHistogramSort(svg);
  }
  animateIpadOnNextRender = false;
}

function renderAll() { renderScreen(); renderHud(); renderResults(); }

/* ---------- game flow ---------- */
function begin() {
  if (S.phase !== 'intro' || S.menu === 1) return;
  audio();
  if (S.menu === 1 && !unlimited) {
    // switch to random mode: choose a fresh set of seven prompts
    unlimited = true; prompts = makeUnlimited();
    S.results = []; S.score = 0; S.resumed = false;
    S.stage = forcedStage ?? 0; applyStage(S.stage, false);
    history.replaceState(null, '', '?random=1'); syncModeLabel();
  } else if (S.menu === 0 && unlimited) { location.href = '?daily=1'; return; }
  else if (!unlimited) applyStage(S.stage, false);
  if (!unlimited && S.dailyDone) { animateIpadOnNextRender = true; S.phase = 'done'; reviewOpen = -1; saveSession(); applyStage(7, false); loadReviewAnswers(); renderAll(); scrBody.scrollTop = 0; return; }
  startRound();
}
function pickMode(m) { if (S.phase !== 'intro' || m === 1) return; S.menu = 0; renderScreen(); }
function finish() {
  if (S.phase !== 'feedback') return;
  animateIpadOnNextRender = true; S.phase = 'done'; reviewOpen = -1; save(); applyStage(7, false); loadReviewAnswers(); renderAll(); scrBody.scrollTop = 0;
}
function startRound() {
  S.phase = 'preview'; S.msg = ''; S.msgKind = '';
  const now = performance.now();
  S.previewEndsAt = now + PREVIEW_MS; S.answerEndsAt = S.previewEndsAt + ANSWER_MS;
  input.value = ''; input.readOnly = true; focusInput();
  saveSession(); renderAll();
  tones([660], 'square', 0, 0.06, 0.05);
}
function startAnswering() {
  S.phase = 'answering'; input.readOnly = false; saveSession(); focusInput(); renderScreen();
}
function setMsg(html, kind) {
  S.msg = html; S.msgKind = kind;
  const m = scrBody.querySelector('.t-msg');
  if (m) { m.className = 't-msg ' + kind; m.innerHTML = html; void m.offsetWidth; m.classList.add('kick'); }
  dockMsg.innerHTML = html;
}
async function submit() {
  if (S.phase !== 'answering') return;
  const raw = input.value.trim(); if (!raw) return;
  input.readOnly = true;
  try {
    const response = await fetch('/api/check', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({id:curPrompt().id, answer:raw}) });
    if (!response.ok) throw new Error('Answer service unavailable');
    const res = await response.json();
    if (res.ok) return endRound(res.item, raw);
    input.readOnly = false;
    setMsg(`"${esc(raw)}": no match. try again`, 'bad'); input.select();
    tones([150, 110], 'sawtooth', 0.07, 0.1, 0.05);
  } catch (error) {
    input.readOnly = false;
    setMsg('answer service unavailable · try again', 'bad');
  }
}
function endRound(item, raw) {
  const p = curPrompt();
  const tier = item ? item.tier : 'miss';
  S.results.push({ id: p.id, answer: item ? item.display : (raw || ''), tier, score: TIERS[tier].score });
  S.score += TIERS[tier].score;
  S.phase = 'feedback'; S.feedbackAt = performance.now(); input.readOnly = true;
  screensEl.classList.remove('urgent');
  save(); renderAll();
  if (item) tones(tier === 'quantum' ? [523, 659, 784, 1047] : tier === 'liquid' ? [523, 659, 880] : [523, 784], 'triangle', 0.06, 0.12, 0.08);
  else tones([220, 165], 'square', 0.12, 0.16, 0.05);
  const ns = Math.max(stageFor(S.score), forcedStage ?? 0);
  if (ns > S.stage) setTimeout(() => upgradeTo(ns), 500);
}
function next() {
  if (S.phase !== 'feedback') return;
  if (setDone()) { animateIpadOnNextRender = true; S.phase = 'done'; reviewOpen = -1; save(); applyStage(7, false); loadReviewAnswers(); renderAll(); scrBody.scrollTop = 0; return; }
  startRound();
}
let viewportUnlockTimer = 0;
input.addEventListener('focus', () => {
  clearTimeout(viewportUnlockTimer);
  Rig.lockViewport(true);
});
input.addEventListener('blur', () => {
  clearTimeout(viewportUnlockTimer);
  viewportUnlockTimer = setTimeout(() => Rig.lockViewport(false), 350);
});
input.addEventListener('pointerdown', () => Rig.captureViewportAnchor(), { capture: true });
function focusInput() { if (document.activeElement !== input) input.focus({ preventScroll: true }); }

/* ---------- loop ---------- */
const ringEl = $('#ring'), ringProg = $('#ringProg'), ringNum = $('#ringNum');
function setRing(frac, label, hot) {
  ringProg.style.strokeDashoffset = String(138.2 * (1 - clamp(frac, 0, 1)));
  if (ringNum.textContent !== label) ringNum.textContent = label;
  ringEl.classList.toggle('hot', !!hot);
}
const clockNow = () => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
let lastSec = -2;
function tick(now) {
  if (S.phase === 'preview') {
    const left = S.previewEndsAt - now;
    const pv = scrBody.querySelector('[data-pv]'); if (pv) pv.textContent = Math.max(1, Math.ceil(left / 1000));
    fuse.style.transform = 'scaleX(1)';
    setRing(1, '25', false);
    if (left <= 0) startAnswering();
  } else if (S.phase === 'answering') {
    const remaining = S.answerEndsAt - now;
    fuse.style.transform = `scaleX(${clamp(remaining / ANSWER_MS, 0, 1)})`;
    screensEl.classList.toggle('urgent', remaining <= URGENT_MS);
    setRing(remaining / ANSWER_MS, String(Math.max(0, Math.ceil(remaining / 1000))), remaining <= URGENT_MS);
    if (remaining <= 0) endRound(null, input.value.trim());
  } else {
    fuse.style.transform = 'scaleX(0)';
  }
  mirrorTyped();
  const t = S.phase === 'answering' ? Math.max(0, Math.ceil((S.answerEndsAt - now) / 1000)) : S.phase === 'preview' ? 25 : -1;
  if (t !== lastSec) { lastSec = t; sideWrap.querySelectorAll('[data-timer]').forEach(el => { el.textContent = t < 0 ? clockNow() : String(t).padStart(2, '0'); el.classList.toggle('hot', t >= 0 && t <= 3 && S.phase === 'answering'); }); }
  requestAnimationFrame(tick);
}

/* ---------- input events ---------- */
let lastPhysicalAt = 0;
document.addEventListener('keydown', e => {
  if (e.target === soundBtn) return;
  if (!adminOverlay.hidden) { if (e.key === 'Escape') closeAdmin(); return; }
  const code = codeAlias[e.code] || e.code;
  if (code) { lastPhysicalAt = performance.now(); if (!e.repeat) { pressKey(code); physicalDown.add(code); if (Rig.hasKey(code)) keySound(code); } }
  if (S.phase === 'intro' && /^[a-z]$/i.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); trackAdminCharacter(e.key); return; }
  if (S.phase === 'intro' && /^(ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/.test(e.key)) { e.preventDefault(); pickMode(0); return; }
  
  if (e.key === 'Enter') {
    if (S.phase === 'intro') { e.preventDefault(); begin(); }
    else if (S.phase === 'feedback') { e.preventDefault(); if (!e.repeat && performance.now() - S.feedbackAt > 600) next(); }
    else if (S.phase === 'answering' && document.activeElement !== input) { e.preventDefault(); submit(); }
    else if (S.phase === 'preview') e.preventDefault();
  } else if ((S.phase === 'answering' || S.phase === 'preview') && document.activeElement !== input && !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
    focusInput();
  } else if (S.phase === 'done') reviewKey(e);
});
document.addEventListener('keyup', e => { const code = codeAlias[e.code] || e.code; physicalDown.delete(code); releaseKey(code); });
window.addEventListener('blur', releaseAll);

// Soft keyboards (phones) often send no key codes, so light up keys from the inserted text instead.
input.addEventListener('beforeinput', e => {
  if (performance.now() - lastPhysicalAt < 80) return;
  if (e.inputType === 'deleteContentBackward') { tapKey('Backspace'); keySound('Backspace'); return; }
  if (e.data) for (const ch of e.data.slice(-3)) { const c = charToCode.get(ch) || charToCode.get(ch.toLowerCase()); if (c) { tapKey(c); keySound(c); } }
});
input.addEventListener('input', saveSession);
dock.addEventListener('submit', e => { e.preventDefault(); if (S.phase === 'answering') submit(); else if (S.phase === 'feedback' && performance.now() - S.feedbackAt > 600) next(); else if (S.phase === 'intro') begin(); });

// Clicking the on-screen keys types with them.
let virtShift = false;
rigCanvas.addEventListener('pointerdown', e => {
  const code = Rig.keyAt(e.clientX, e.clientY);
  if (!code) { if (S.phase === 'answering' || S.phase === 'preview') { e.preventDefault(); focusInput(); } return; }
  e.preventDefault();
  tapKey(code, 140); keySound(code);
  if (code === 'Enter') {
    if (S.phase === 'intro') begin(); else if (S.phase === 'feedback' && performance.now() - S.feedbackAt > 600) next(); else submit();
    return;
  }
  if (code === 'ShiftLeft' || code === 'ShiftRight') { virtShift = !virtShift; Rig.setShift(virtShift); return; }
  if (S.phase === 'intro' && code === 'KeyD') { S.menu = 0; begin(); return; }
  const tgt = S.phase === 'answering' ? input : S.phase === 'done' ? scrBody.querySelector('.rv-search') : null;
  if (!tgt) return;
  if (tgt === input) focusInput(); else tgt.focus({ preventScroll: true });
  const s = tgt.selectionStart ?? tgt.value.length, en = tgt.selectionEnd ?? s;
  const changed = () => { if (tgt !== input) tgt.dispatchEvent(new Event('input', { bubbles: true })); };
  if (code === 'Backspace') {
    if (s !== en) tgt.setRangeText('', s, en, 'end'); else if (s > 0) tgt.setRangeText('', s - 1, s, 'end');
    changed(); return;
  }
  let ch = null;
  if (code === 'Space') ch = ' ';
  else if (baseChar.has(code)) ch = virtShift ? shiftChar.get(code) : baseChar.get(code);
  if (ch && tgt.value.length < 64) { tgt.setRangeText(ch, s, en, 'end'); changed(); if (virtShift) { virtShift = false; Rig.setShift(false); } }
});
rigCanvas.addEventListener('mousemove', e => { rigCanvas.style.cursor = Rig.keyAt(e.clientX, e.clientY) ? 'pointer' : 'default'; });

screenEl.addEventListener('click', e => {
  if (S.phase === 'done') return;
  if (S.phase === 'feedback' && e.target.closest('[data-finish]')) { finish(); return; }
  if (S.phase === 'intro') { const o = e.target.closest('[data-mode]'); if (o?.dataset.mode === '1' || o?.disabled) return; if (o) S.menu = 0; begin(); return; }
  if (S.phase === 'feedback' && performance.now() - S.feedbackAt > 600) next(); else focusInput();
});

// The desk mouse follows your real pointer a little and clicks when you click.
document.addEventListener('pointermove', e => Rig.mouseMove(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5));
document.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') Rig.mouseBtn(e.button !== 2, e.button === 2); });
document.addEventListener('pointerup', () => Rig.mouseBtn(false, false));

/* ---------- overlay controls ---------- */
$('#passBtn').addEventListener('click', () => { if (S.phase === 'answering') endRound(null, ''); focusInput(); });
$('#helpBtn').addEventListener('click', e => { const h = $('#help'); h.hidden = !h.hidden; e.currentTarget.blur(); });
$('#resultsBtn').addEventListener('click', () => { resultsEl.hidden = false; });
$('#adminClose').addEventListener('click', closeAdmin);
adminTest.addEventListener('click', startAdminTest);
adminTestExit.addEventListener('click', () => { location.href = '?home=1'; });
adminOverlay.addEventListener('click', e => { if (e.target === adminOverlay) closeAdmin(); });
adminLoginForm.addEventListener('submit', async e => {
  e.preventDefault(); adminLoginStatus.textContent = 'Checking password…';
  try {
    const response = await fetch('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:adminPassword.value})});
    if (!response.ok) { adminLoginStatus.textContent = 'Password not accepted.'; adminPassword.focus(); adminPassword.select(); return; }
    adminAuthenticated = true; adminLoginPanel.hidden = true; adminPanel.hidden = false; adminLoginStatus.textContent = '';
    await loadAdminPromptChoices();
  } catch { adminLoginStatus.textContent = 'Admin service unavailable.'; }
});
adminPromptList.addEventListener('change', e => {
  if (e.target.classList.contains('admin-prompt-complete')) {
    const row = e.target.closest('.admin-prompt-option'), select = row.querySelector('.admin-prompt-select');
    select.disabled = e.target.checked || row.dataset.usedBefore === 'true';
    if (e.target.checked) select.checked = false;
    row.toggleAttribute('aria-disabled', e.target.checked || row.dataset.usedBefore === 'true');
  }
  adminSaveStatus.textContent = '';
  updateAdminSelection();
});
adminPromptList.addEventListener('click', e => {
  const button = e.target.closest('[data-admin-answers]');
  if (button) toggleAdminAnswers(button, button.closest('.admin-prompt-option'));
});
adminSearch.addEventListener('input', () => {
  const query = adminSearch.value.trim().toLowerCase();
  for (const row of adminPromptList.children) row.hidden = query && !row.textContent.toLowerCase().includes(query);
});
adminSave.addEventListener('click', async () => {
  const promptIds = [...adminPromptList.querySelectorAll('.admin-prompt-select:checked')].map(input => input.value);
  const completedPromptIds = [...adminPromptList.querySelectorAll('.admin-prompt-complete:checked:not(:disabled)')].map(input => input.value);
  if (promptIds.length !== 7) return;
  adminSave.disabled = true; adminSaveStatus.textContent = 'Saving tomorrow’s set…';
  try {
    const response = await fetch('/api/admin/daily',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({promptIds,completedPromptIds})});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not save daily set.');
    adminDate.textContent = data.date;
    adminSaveStatus.textContent = `Saved for ${data.date}. This set and its completed prompts are shared across the site.`;
  } catch (err) { adminSaveStatus.textContent = err.message || 'Could not save daily set.'; }
  updateAdminSelection();
});
let answerReviewScrollBeforeClick = null;
resultsEl.addEventListener('pointerdown', e => {
  const toggle=e.target.closest('[data-toggle]');
  if(toggle){
    answerReviewScrollBeforeClick=resultsEl.querySelector('.ipad-body')?.scrollTop ?? 0;
    e.preventDefault();
  }
}, true);
resultsEl.addEventListener('click', e => {
  const toggle=e.target.closest('[data-toggle]'), filter=e.target.closest('[data-filter]');
  if(toggle){
    const i=+toggle.dataset.toggle, previous=reviewOpen;
    const answerBody=resultsEl.querySelector('.ipad-body');
    const answerScrollTop=answerReviewScrollBeforeClick ?? answerBody?.scrollTop ?? 0;
    answerReviewScrollBeforeClick=null;
    reviewOpen=reviewOpen===i?-1:i;reviewFilter='all';reviewQuery='';
    if(previous>=0){
      const oldButton=resultsEl.querySelector(`[data-toggle="${previous}"]`), oldRow=oldButton?.closest('.rv-row');
      oldButton?.setAttribute('aria-expanded','false');
      const oldCar=oldButton?.querySelector('.rv-car'); if(oldCar)oldCar.textContent='▸';
      oldRow?.classList.remove('open'); oldRow?.querySelector('.rv-detail')?.remove();
    }
    if(reviewOpen>=0){
      const button=resultsEl.querySelector(`[data-toggle="${i}"]`), row=button?.closest('.rv-row');
      button?.setAttribute('aria-expanded','true');
      const car=button?.querySelector('.rv-car'); if(car)car.textContent='▾';
      row?.classList.add('open'); row?.insertAdjacentHTML('beforeend',reviewDetailHTML(prompts[i],S.results[i]));
    }
    if(answerBody){
      answerBody.scrollTop=answerScrollTop;
      requestAnimationFrame(()=>{if(answerBody.isConnected)answerBody.scrollTop=answerScrollTop;});
    }
    return;
  }
  if(filter){reviewFilter=filter.dataset.filter;resultsEl.querySelectorAll('.rv-chip').forEach(x=>x.classList.toggle('on',x===filter));const ul=resultsEl.querySelector('.rv-answers');if(ul)ul.innerHTML=answersHTML(prompts[reviewOpen],S.results[reviewOpen]);return;}
});
resultsEl.addEventListener('input', e => {if(!e.target.classList.contains('rv-search'))return;reviewQuery=e.target.value;const ul=resultsEl.querySelector('.rv-answers');if(ul)ul.innerHTML=answersHTML(prompts[reviewOpen],S.results[reviewOpen]);});
document.addEventListener('pointerdown', e => { const h = $('#help'); if (!h.hidden && !e.target.closest('#help, #helpBtn')) h.hidden = true; });

/* ---------- countdown ---------- */
setInterval(() => { if (S.phase === 'answering' || S.phase === 'preview') saveSession(); else lastSec = -2; }, 1000);
setInterval(() => {
  const el = document.getElementById('countdown'); if (!el) return;
  const ms = msToLondonMidnight(); const h = Math.floor(ms / 36e5), m = Math.floor(ms % 36e5 / 6e4), s = Math.floor(ms % 6e4 / 1e3);
  el.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  if (londonDate() !== today && !unlimited && (S.phase === 'done' || S.phase === 'intro')) location.reload();
}, 1000);

/* ---------- boot ---------- */
Rig.init(STAGES, ROWS, onLayout);
applyStage(S.phase === 'intro' ? 0 : S.stage, false);
renderAll();
if (S.phase === 'done') { applyStage(7, false); loadReviewAnswers(); }
requestAnimationFrame(tick);

// Debug hook for testing in the console: nibble.upgrade(n)
window.nibble = { upgrade: n => upgradeTo(clamp(n, 0, 7)), get state() { return S; }, get prompts() { return prompts; } };
})();
