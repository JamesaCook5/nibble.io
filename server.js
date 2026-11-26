'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = __dirname;
function loadLocalEnv() {
  try {
    for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] == null) process.env[match[1]] = match[2].replace(/^(['\"])(.*)\1$/, '$2');
    }
  } catch {}
}
loadLocalEnv();
const ADMIN_PASSWORD = process.env.NIBBLE_ADMIN_PASSWORD || '';
const ADMIN_COOKIE = 'nibble_admin';
const adminSessions = new Map();
const dailyConfigPath = path.join(root, 'data', 'daily_prompts.json');
const bank = JSON.parse(fs.readFileSync(path.join(root, 'question-bank/prompts.json'), 'utf8')).prompts;
const data = [
  JSON.parse(fs.readFileSync(path.join(root, 'answer-pilot/answer_sets.json'), 'utf8')).prompts,
  JSON.parse(fs.readFileSync(path.join(root, 'overclock/answer-full/answer_sets_full.json'), 'utf8')).prompts
];
const tierKey = { Bit:'stock', Nibble:'tuned', Byte:'overclocked', Kilobyte:'liquid', Megabyte:'quantum' };
const greekGlyphNames = {'Α':'alpha','α':'alpha','Β':'beta','β':'beta','Γ':'gamma','γ':'gamma','Δ':'delta','δ':'delta','Ε':'epsilon','ε':'epsilon','Ζ':'zeta','ζ':'zeta','Η':'eta','η':'eta','Θ':'theta','θ':'theta','Ι':'iota','ι':'iota','Κ':'kappa','κ':'kappa','Λ':'lambda','λ':'lambda','Μ':'mu','μ':'mu','Ν':'nu','ν':'nu','Ξ':'xi','ξ':'xi','Ο':'omicron','ο':'omicron','Π':'pi','π':'pi','Ρ':'rho','ρ':'rho','Σ':'sigma','σ':'sigma','ς':'sigma','Τ':'tau','τ':'tau','Υ':'upsilon','υ':'upsilon','Φ':'phi','φ':'phi','Χ':'chi','χ':'chi','Ψ':'psi','ψ':'psi','Ω':'omega','ω':'omega'};
function norm(s) {
  return String(s).replace(/[Α-Ωα-ως]/g, ch => greekGlyphNames[ch] || ch).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/&/g,' and ').replace(/\+/g,' plus ').replace(/#/g,' sharp ').replace(/\*/g,' star ').replace(/\^/g,' pow ')
    .replace(/\bvs\.?\b/g,' v ').replace(/\bversus\b/g,' v ').replace(/^\s*the\s+/,'')
    .replace(/[^a-z0-9-]+/g,'');
}
const promptById = new Map(bank.map(p => [p.id, p]));
const promptIds = new Set(promptById.keys());
function londonToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone:'Europe/London', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
}
function addCalendarDays(date, days) {
  return new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}
function londonTomorrow() { return addCalendarDays(londonToday(), 1); }
function readDailyConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(dailyConfigPath, 'utf8'));
    if (!config || typeof config !== 'object') return { schedules:{}, completedPromptIds:[] };
    const schedules = { ...(config.schedules || {}) };
    // Migrate the earlier one-day format in memory so existing schedules remain usable.
    if (config.date && Array.isArray(config.promptIds) && !schedules[config.date]) schedules[config.date] = { promptIds:config.promptIds };
    for (const [date, schedule] of Object.entries(schedules)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(schedule?.promptIds) || schedule.promptIds.length !== 7 || new Set(schedule.promptIds).size !== 7 || !schedule.promptIds.every(id => promptIds.has(id))) delete schedules[date];
    }
    const completedPromptIds = Array.isArray(config.completedPromptIds) ? [...new Set(config.completedPromptIds.filter(id => promptIds.has(id)))] : [];
    return { schedules, completedPromptIds };
  } catch { return null; }
}
function scheduledPromptIds(config, beforeDate) {
  const used = new Set();
  for (const [date, schedule] of Object.entries(config?.schedules || {})) {
    if (date < beforeDate) for (const id of schedule.promptIds) used.add(id);
  }
  return used;
}
function usedPromptIds(config, beforeDate) {
  return [...new Set([...(config?.completedPromptIds || []), ...scheduledPromptIds(config, beforeDate)])];
}
function adminToken(req) {
  const cookie = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(ADMIN_COOKIE + '='));
  return cookie ? decodeURIComponent(cookie.slice(ADMIN_COOKIE.length + 1)) : '';
}
function isAdmin(req) {
  const token = adminToken(req), expires = adminSessions.get(token);
  if (!expires || expires < Date.now()) { if (token) adminSessions.delete(token); return false; }
  return true;
}
function json(res, status, value, headers = {}) {
  res.writeHead(status, { 'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', ...headers });
  res.end(JSON.stringify(value));
}
function readJson(req, limit, callback) {
  let body = '', failed = false;
  req.on('data', chunk => {
    if (failed) return;
    body += chunk;
    if (body.length > limit) { failed = true; json(req.res, 413, { error:'request too large' }); req.destroy(); }
  });
  req.on('end', () => {
    if (failed) return;
    try { callback(null, JSON.parse(body || '{}')); } catch { callback(new Error('invalid JSON')); }
  });
}

const answerIndex = new Map();
for (const source of data) for (const [id, set] of Object.entries(source)) {
  const prompt = promptById.get(id);
  if (!prompt) continue;
  const index = answerIndex.get(id) || new Map();
  const stripWords = [...(set.strip || []), ...(prompt.strip || [])].map(norm).filter(Boolean);
  for (const answer of set.answers || []) {
    const item = { display: answer.answer, tier: tierKey[answer.tier] || 'stock' };
    for (const name of [answer.answer, ...(answer.aliases || [])]) {
      const key = norm(name);
      const variants = [key, ...stripWords.map(word => key.endsWith(word) ? key.slice(0, -word.length) : '')].filter(Boolean);
      for (const variant of variants) index.set(variant, item);
      for (const prefix of set.prefix || []) for (const variant of variants) index.set(norm(prefix) + variant, item);
    }
  }
  answerIndex.set(id, index);
}
function check(id, raw) {
  if (!promptById.has(id)) return null;
  const key = norm(raw);
  const singular = key.endsWith('ies') ? key.slice(0, -3) + 'y' : key.endsWith('s') && !key.endsWith('ss') ? key.slice(0, -1) : key;
  const index = answerIndex.get(id);
  const item = index && (index.get(key) || index.get(singular));
  return item ? { ok: true, item } : { ok: false };
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
http.createServer((req,res)=>{
  req.res = res;
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(req.method==='POST' && pathname==='/api/admin/login'){
    readJson(req, 4096, (err, body) => {
      if(err) return json(res, 400, {error:'invalid JSON'});
      const supplied = crypto.createHash('sha256').update(String(body.password || '')).digest();
      const expected = crypto.createHash('sha256').update(ADMIN_PASSWORD).digest();
      if(!ADMIN_PASSWORD || !crypto.timingSafeEqual(supplied, expected)) return json(res, 401, {error:'password not accepted'});
      const token = crypto.randomBytes(32).toString('hex'); adminSessions.set(token, Date.now() + 8*60*60*1000);
      const secure = req.socket.encrypted || req.headers['x-forwarded-proto']==='https' ? '; Secure' : '';
      return json(res, 200, {ok:true}, { 'set-cookie':`${ADMIN_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=28800${secure}` });
    }); return;
  }
  if(pathname==='/api/admin/logout' && req.method==='POST'){
    adminSessions.delete(adminToken(req));
    return json(res, 200, {ok:true}, { 'set-cookie':`${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` });
  }
  if(pathname==='/api/admin/daily' && req.method==='GET'){
    if(!isAdmin(req)) return json(res, 401, {error:'admin login required'});
    const date = londonTomorrow(), saved = readDailyConfig() || {schedules:{}, completedPromptIds:[]};
    return json(res, 200, {date, promptIds:saved.schedules[date]?.promptIds || null, completedPromptIds:saved.completedPromptIds, scheduledPromptIds:[...scheduledPromptIds(saved, date)], usedPromptIds:usedPromptIds(saved, date)});
  }
  if(pathname==='/api/admin/daily' && req.method==='POST'){
    if(!isAdmin(req)) return json(res, 401, {error:'admin login required'});
    readJson(req, 8192, (err, body) => {
      const ids = body && body.promptIds, completed = body && body.completedPromptIds, date = londonTomorrow();
      if(err) return json(res, 400, {error:'invalid JSON'});
      if(!Array.isArray(ids) || ids.length!==7 || new Set(ids).size!==7 || !ids.every(id => typeof id==='string' && promptIds.has(id))) return json(res, 400, {error:'choose exactly seven different prompts'});
      if(!Array.isArray(completed) || new Set(completed).size!==completed.length || !completed.every(id => typeof id==='string' && promptIds.has(id))) return json(res, 400, {error:'invalid completed prompts'});
      const config = readDailyConfig() || {schedules:{}, completedPromptIds:[]};
      const previouslyScheduled = new Set();
      for (const [scheduledDate, schedule] of Object.entries(config.schedules)) if (scheduledDate < date) for (const id of schedule.promptIds) previouslyScheduled.add(id);
      if(ids.some(id => previouslyScheduled.has(id))) return json(res, 400, {error:'a selected prompt was already used in an earlier daily set'});
      if(ids.some(id => completed.includes(id))) return json(res, 400, {error:'a selected prompt cannot also be marked complete'});
      config.schedules[date] = {promptIds:ids};
      config.completedPromptIds = completed;
      config.updatedAt = new Date().toISOString();
      try { fs.mkdirSync(path.dirname(dailyConfigPath), {recursive:true}); const tmp=dailyConfigPath+'.tmp'; fs.writeFileSync(tmp, JSON.stringify(config,null,2)+'\n'); fs.renameSync(tmp,dailyConfigPath); }
      catch { return json(res, 500, {error:'could not save daily prompts'}); }
      return json(res, 200, {ok:true, date, promptIds:ids, completedPromptIds:config.completedPromptIds, scheduledPromptIds:[...scheduledPromptIds(config, date)], usedPromptIds:usedPromptIds(config, date)});
    }); return;
  }
  if(req.method==='POST' && pathname==='/api/check'){
    let body=''; req.on('data',c=>{body+=c;if(body.length>4096) req.destroy();});
    req.on('end',()=>{try{const {id,answer}=JSON.parse(body); if(typeof id!=='string'||typeof answer!=='string'||answer.length>100){res.writeHead(400);return res.end('{"error":"invalid request"}');} const result=check(id,answer); res.writeHead(result?200:404,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(result||{error:'unknown prompt'}));}catch{res.writeHead(400);res.end('{"error":"invalid JSON"}');}}); return;
  }
  if(req.method==='GET' && pathname==='/api/answers'){
    const id=new URL(req.url,'http://localhost').searchParams.get('id');
    if(!promptById.has(id)){res.writeHead(404,{'content-type':'application/json'});return res.end('{"error":"unknown prompt"}');}
    const set=data.slice().reverse().map(source=>source[id]).find(Boolean);
    const tiers={Bit:'stock',Nibble:'tuned',Byte:'overclocked',Kilobyte:'liquid',Megabyte:'quantum'};
    const answers=(set?.answers||[]).map(a=>({display:a.answer,tier:tiers[a.tier]||'stock'}));
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});return res.end(JSON.stringify({id,answers}));
  }
  if(pathname==='/api/prompts'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify(bank.map(({id,prompt,example})=>({id,prompt,example}))));}
  const rel=pathname==='/'?'index.html':pathname.slice(1);
  const publicFiles=new Set(['index.html','app.js','render.js','styles.css','favicon.svg','questions.js']);
  if(!publicFiles.has(rel)){res.writeHead(404);return res.end('Not found');}
  const file=path.join(root,rel);
  if(rel==='questions.js'){
    const saved=readDailyConfig(), ids=saved?.schedules?.[londonToday()]?.promptIds || null;
    const script=fs.readFileSync(file,'utf8')+'\nwindow.DAILY_PROMPT_IDS = '+JSON.stringify(ids)+';\n';
    res.writeHead(200,{'content-type':types['.js'],'cache-control':'no-store'});return res.end(script);
  }
  fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'content-type':types[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});res.end(b);});
}).listen(process.env.PORT||8000,()=>console.log(`nibble.io API listening on http://localhost:${process.env.PORT||8000}`));
