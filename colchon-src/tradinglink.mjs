// TradingLink Fase 1 — SOLO LECTURA. No coloca órdenes.
// Regla: cuentas LFE = evaluación, LFF = fondeada.
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import * as orders from './orders.mjs';
import { colchon, CFG as colchonCFG, readAccounts } from './colchon.mjs';
import { execFile } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
const TV = path.join(DIR, 'tradingview-mcp/src/cli/index.js');
const PORT = 8787, EVERY_MS = 5 * 60 * 1000;
const tv = (...a) => new Promise(r => execFile(process.execPath, [TV, ...a], (e, o) => { try { r(JSON.parse(o)); } catch { r({ success: false }); } }));
const ev = async js => (await tv('ui', 'eval', js)).result;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const typeOf = id => id.startsWith('LFF') ? 'funded' : id.startsWith('LFE') ? 'eval' : 'unknown';
const num = s => +String(s).replace(/[^0-9.-]/g, '');
let state = { updated: null, accounts: {}, error: null, daily: {} };
// Dia de trading (ET): la sesion empieza a las 6 PM ET -> despues de las 18:00 cuenta como el dia siguiente.
const SOD_FILE = path.join(DIR, 'sod.json');
let sod = { accounts: {}, daily: {} }; try { sod = { accounts: {}, daily: {}, ...JSON.parse(fs.readFileSync(SOD_FILE, 'utf8')) }; } catch {}
function tradingDay() { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value])); const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day)); if ((+p.hour % 24) >= 18) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }

const readCurrent = () => ev(`(()=>{const n=document.querySelector('[class*=accountName]');const f=[...document.querySelectorAll('[class*=accountSummaryField]')].map(e=>e.innerText.split('\\n'));const p=(document.querySelector('[class*=accountManager]')||{}).innerText||'';return JSON.stringify({id:n&&n.innerText.trim(),f,busy:/Positions\\s*\\(?[1-9]|Orders\\s*\\(?[1-9]/.test(p)})})()`).then(s => JSON.parse(s || '{}'));
const center = () => ev(`(()=>{const r=document.querySelector('[class*=accountName]').getBoundingClientRect();return (r.x+r.width/2|0)+' '+(r.y+r.height/2|0)})()`);
async function openList() { const [x, y] = (await center()).split(' '); await tv('ui', 'mouse', x, y); await sleep(1000); }
async function pick(id) {
  await openList();
  const xy = await ev(`(()=>{const e=[...document.querySelectorAll('*')].filter(e=>e.children.length===0&&e.innerText&&e.innerText.trim()==='${id}').pop();if(!e)return '';const r=e.getBoundingClientRect();return (r.x+r.width/2|0)+' '+(r.y+r.height/2|0)})()`);
  if (!xy) return false; const [x, y] = xy.split(' '); await tv('ui', 'mouse', x, y); await sleep(2000); return true;
}
const listIds = async () => { await openList(); const t = await ev(`(()=>[...new Set((document.body.innerText.match(/\\bLF[EF]\\d{8,}\\b/g)||[]))].join(','))()`); await tv('ui', 'keyboard', 'Escape'); await sleep(300); return (t || '').split(',').filter(Boolean); };
function save(c) {
  const g = k => { const r = c.f.find(x => x[0] === k); return r ? num(r[1]) : null; };
  state.accounts[c.id] = { id: c.id, type: typeOf(c.id), balance: g('Account Balance'), equity: g('Equity'), profit: g('Profit'), readAt: new Date().toISOString() };
  const a = state.accounts[c.id], day = tradingDay();
  if (a.balance != null) {
    const s = sod.accounts[c.id];
    if (!s || s.day !== day) sod.accounts[c.id] = { day, bal: s && s.lastBal != null ? s.lastBal : a.balance, lastBal: a.balance };
    else s.lastBal = a.balance;
    a.startOfDay = sod.accounts[c.id].bal; a.dayPnl = Math.round((a.balance - a.startOfDay) * 100) / 100; a.totalPnl = Math.round((a.balance - 25000) * 100) / 100; a.tradingDay = day;
    sod.daily[day] = Object.values(state.accounts).filter(x => x.tradingDay === day && x.dayPnl != null).reduce((t, x) => t + x.dayPnl, 0);
    try { fs.writeFileSync(SOD_FILE, JSON.stringify(sod, null, 2)); } catch {}
    state.daily = sod.daily;
  }
}
let cycling = false;
async function cycle() {
  if (cycling) return; cycling = true;
  try {
    // Saldos por la API interna de TradingView (sin clics): la cuenta activa cada 30 s; todas las cuentas cada 5 min
    // (nunca si hay posiciones/órdenes abiertas ni durante una prueba colchón, para no cambiar de cuenta en mitad de un trade).
    const full = Date.now() - lastFull >= FULL_MS && colchon.status().state !== 'running';
    const r = await readAccounts({ all: full }); if (r.error) throw new Error(r.error);
    if (full && !r.busy) lastFull = Date.now();
    for (const a of r.accounts) if (/^LF[EF]/.test(a.name) && a.balance != null)
      save({ id: a.name, f: [['Account Balance', String(a.balance)], ['Equity', String(a.equity ?? a.balance)], ['Profit', String(a.profit ?? 0)]] });
    state.updated = new Date().toISOString(); state.error = null;
  } catch (e) { state.error = String(e.message || e); }
  fs.writeFileSync(path.join(DIR, 'accounts.json'), JSON.stringify(state, null, 2));
  console.log(new Date().toLocaleTimeString(), state.error || Object.values(state.accounts).map(a => `${a.id} ${a.type} $${a.balance}`).join(' · '));
  cycling = false;
}
http.createServer((q, r) => {
  if (q.url.startsWith('/accounts.json')) { r.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return r.end(JSON.stringify(state)); }
  if (q.url.startsWith('/api/colchon/')) { let b=''; q.on('data',c=>b+=c); q.on('end', async()=>{ let j={}; try{j=JSON.parse(b||'{}')}catch{} let out;
    try {
      if (q.url.startsWith('/api/colchon/status')) out = { ...colchon.status(), cfg: colchonCFG };
      else if (q.url.startsWith('/api/colchon/summary')) out = colchon.summary() || { ok: false, err: 'Todavía no hay resumen' };
      else if (q.url.startsWith('/api/colchon/strategies')) out = colchon.strategies();
      else if (q.url.startsWith('/api/colchon/accounts')) out = await colchon.accounts();
      else if (q.url.startsWith('/api/colchon/check')) out = await colchon.check();
      else if (q.url.startsWith('/api/colchon/start') && q.method === 'POST') out = await colchon.start(j);
      else if (q.url.startsWith('/api/colchon/stop') && q.method === 'POST') out = await colchon.stop(j);
      else out = { ok: false, err: 'ruta desconocida' };
    } catch (e) { out = { ok: false, err: String(e.message || e) }; }
    r.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); r.end(JSON.stringify(out)); }); return; }
  if (q.method === 'POST' || q.url === '/bot') { let b=''; q.on('data',c=>b+=c); q.on('end', async()=>{ let j={}; try{j=JSON.parse(b||'{}')}catch{} let out;
    if (q.url==='/bot') out={enabled: q.method==='POST'? orders.bot.set(j.enabled): orders.bot.get(), simulated: orders.DRY_RUN};
    else if (q.url==='/order') out=orders.request(j, state.accounts);
    else if (q.url==='/confirm') out=await orders.confirm(j.id, state.accounts);
    else if (q.url==='/cancel') out={ok: orders.cancel(j.id)};
    else out={ok:false,err:['ruta desconocida']};
    console.log(new Date().toLocaleTimeString(), q.url, JSON.stringify(out)); r.writeHead(200,{'content-type':'application/json'}); r.end(JSON.stringify(out)); }); return; }
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); fs.createReadStream(path.join(DIR, 'Granja-de-Cuentas-v2.html')).pipe(r);
}).listen(PORT, '127.0.0.1', () => console.log(`Granja: http://localhost:${PORT}`));
let lastFull = 0; const FULL_MS = EVERY_MS;
cycle(); setInterval(cycle, 30 * 1000);
