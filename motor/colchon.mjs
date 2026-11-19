import { getStrategy, listStrategies, DEFAULT_STRATEGY, paramsForAccount, accountPlanSize, rulesFor, maxQtyFor } from './strategies.mjs';
import { tipoDe } from './granja-flores.mjs';
// TradingLink - "Colchón" (stop-to-profit). Paper/Demo, y cuentas Lucid (LFE/LFF) con confirmReal (el motor puede activarla con setCurrentAccount si no hay trades/órdenes abiertas). Sin real-allowlist.json no se bloquean.
// La IA nunca coloca/modifica/cierra órdenes: solo el usuario arranca una prueba desde la Granja.
// Servidor: import { colchon } from './colchon.mjs'  -> colchon.start({side,symbol,qty}), colchon.stop(), colchon.status()
// CLI:      node colchon.mjs [--paper] [--short] [--mnq]   |   node colchon.mjs --selftest
import { execFile } from 'node:child_process'; import path from 'node:path'; import fs from 'node:fs';
import { dataDir, TV_CLI, TV_PKG } from './rutas.mjs';
const DIR = dataDir();
export const CFG = { SL_USD: 600, TP_USD: 1600, NET_USD: 100, SLIP_TICKS: 1, TRIGGER_EXTRA_USD: 15, POLL_MS: 500 };
export const SIZES = { NQ: 2, MNQ: 20 }; const PT_USD = { NQ: 20, MNQ: 2 }; export const TICK = 0.25;
export const ptsFor = (usd, symbol, qty) => Math.round(usd / (PT_USD[symbol] * qty) / TICK) * TICK;
export const DEFAULT = { symbol: 'MNQ', qty: 20 }; // SIZES = tope 25K; 50K y la fondeada usan maxQtyFor (hasta 40 MNQ / 4 NQ). $/tick: MNQ 0.50, NQ 5
// colchón en puntos: nunca a menos de 1 tick del punto de disparo (+$160)
// colchón automático por tamaño: neto ≈ +$150 tras comisiones Lucid (ida y vuelta: $1 por MNQ, $3.50 por NQ) y 1 tick de deslizamiento
export const COMM_RT = { MNQ: 1, NQ: 3.5 };
export const tickUsdFor = (symbol, qty) => PT_USD[symbol] * TICK * qty;
export const lockUsdFor = (symbol, qty, P = getStrategy().params) => { const t = tickUsdFor(symbol, qty); return Math.round(Math.ceil((P.NET_USD + (P.COMM_RT || COMM_RT)[symbol] * qty + P.SLIP_TICKS * t) / t - 1e-9) * t * 100) / 100; };
export const triggerUsdFor = (symbol, qty, P = getStrategy().params) => { const t = tickUsdFor(symbol, qty); return Math.round((lockUsdFor(symbol, qty, P) + Math.ceil(P.TRIGGER_EXTRA_USD / t - 1e-9) * t) * 100) / 100; }; // disparo = colchón + $X redondeado ARRIBA a tick
export const lockPtsFor = (symbol, qty, P) => Math.round(lockUsdFor(symbol, qty, P) / (PT_USD[symbol] * qty) / TICK) * TICK;
export const triggerPtsFor = (symbol, qty, P) => Math.round(triggerUsdFor(symbol, qty, P) / (PT_USD[symbol] * qty) / TICK) * TICK;
// escalones del colchón para un tamaño: [{n, triggerUsd, lockUsd, lockPts}]. Una estrategia sin STEPS = un único escalón (colchón + disparo).
// probabilidad de acierto necesaria para quedar en equilibrio = riesgo / (riesgo + recompensa)
// riesgo = SL; recompensa = neto protegido del primer escalón (NET_USD si la estrategia lo define), o el TP si no hay escalones
export function breakEvenFor(symbol, qty, P = getStrategy().params) {
  const risk = P.SL_USD, st = stepsFor(symbol, qty, P);
  const reward = !st.length || P.PROB === 'tp' ? P.TP_USD : (P.NET_USD != null ? P.NET_USD : st[0].lockUsd);
  return { pct: Math.round(risk / (risk + reward) * 1000) / 10, riesgoUSD: risk, recompensaUSD: reward };
}
export function stepsFor(symbol, qty, P = getStrategy().params) {
  const t = tickUsdFor(symbol, qty), ppt = PT_USD[symbol] * qty;
  // escalón con `lockTicks`: el stop va a entrada + N ticks de ganancia (USD = N ticks × tamaño); el disparo nunca queda a menos de 1 tick de ese stop
  if (Array.isArray(P.STEPS)) return P.STEPS.map((x, i) => { const tk = x.lockTicks != null, lockUsd = tk ? Math.round(x.lockTicks * t * 100) / 100 : Math.round(Math.ceil(x.lock / t - 1e-9) * t * 100) / 100, triggerUsd = tk ? Math.max(x.trigger, Math.round((lockUsd + t) * 100) / 100) : x.trigger; return { n: i + 1, triggerUsd, lockUsd, lockPts: Math.round(lockUsd / ppt / TICK) * TICK }; });
  return [{ n: 1, triggerUsd: triggerUsdFor(symbol, qty, P), lockUsd: lockUsdFor(symbol, qty, P), lockPts: lockPtsFor(symbol, qty, P) }];
}
export const roundTick = p => Math.round(p / TICK) * TICK;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Precio de la orden: compra al ask, venta al bid. Si falta ese lado, el último trato.
// El cierre de la vela no sirve: el 9:47 el cierre iba por detrás del fill y el TP nacía ya vendible.
function edadDeMarca(marca, ahora) {
  if (marca == null || marca === '') return null;
  let tm = +marca;
  if (!Number.isFinite(tm) || tm <= 0) return null;
  if (tm < 1e12) tm *= 1000;
  return Math.max(0, ahora - tm);
}
// fuente: ask, bid, last, o «lado opuesto» (bid en una compra, ask en una venta).
export function detallePrecio(side, q, ahora = Date.now()) {
  if (!q || typeof q !== 'object') return null;
  const n = v => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
  const lista = side === 'long'
    ? [['ask', q.ask, q.askTime ?? q.ask_time], ['last', q.last, q.lastTime ?? q.last_time], ['lado opuesto', q.bid, q.bidTime ?? q.bid_time]]
    : side === 'short'
      ? [['bid', q.bid, q.bidTime ?? q.bid_time], ['last', q.last, q.lastTime ?? q.last_time], ['lado opuesto', q.ask, q.askTime ?? q.ask_time]]
      : [];
  for (const [fuente, valor, marca] of lista) {
    const precio = n(valor);
    if (precio != null) return { precio, fuente, edadMs: edadDeMarca(marca, ahora) };
  }
  return null;
}
export function precioEntrada(side, q) {
  const d = detallePrecio(side, q);
  return d ? d.precio : null;
}
export function lineaPrecio({ fuente, precio, edadMs, recalculado } = {}) {
  const edad = typeof edadMs === 'number' && Number.isFinite(edadMs) ? Math.round(edadMs) + ' ms' : '?';
  const px = typeof precio === 'number' && Number.isFinite(precio) ? precio : '?';
  return `PRECIO: ${fuente || '?'} ${px} · edad ${edad} · recalculado ${recalculado ? 'sí' : 'no'}`;
}
function armarBracket(side, base, slPts, tpPts) {
  const s = side === 'long' ? 1 : -1;
  return { stopLoss: roundTick(base - s * slPts), takeProfit: roundTick(base + s * tpPts), precio: roundTick(base) };
}
function bracketSano(side, b, live) {
  if (!b || !Number.isFinite(live)) return false;
  if (side === 'long') return b.stopLoss <= live - TICK && b.takeProfit >= live + TICK;
  if (side === 'short') return b.stopLoss >= live + TICK && b.takeProfit <= live - TICK;
  return false;
}
// Bracket pegado a la misma orden. Si el precio candidato (el cierre de la vela) dejaría el SL o el TP
// del lado malo o a menos de 1 tick del precio vivo, se recalcula desde el vivo. Si ni así queda fuera
// del mercado, no se envía.
export function bracketSeguro(side, live, slPts, tpPts, candidato) {
  const px = Number(live), slP = Number(slPts), tpP = Number(tpPts);
  if ((side !== 'long' && side !== 'short') || !Number.isFinite(px) || px <= 0 || !(slP > 0) || !(tpP > 0)) return null;
  const otro = Number(candidato);
  const desdeOtro = Number.isFinite(otro) && otro > 0 ? armarBracket(side, otro, slP, tpP) : null;
  const recalculado = !!(desdeOtro && !bracketSano(side, desdeOtro, px));
  const b = armarBracket(side, px, slP, tpP);
  if (!bracketSano(side, b, px)) return null;
  return { ...b, recalculado };
}
export const PANEL_PAUSA_MS = 8000;
export function frenaEscaneo({ pausa = false, panelHasta = 0, operando = false, ahora = Date.now(), lastFull = 0, lastFunded = 0, fullMs = 1 } = {}) {
  const panel = typeof panelHasta === 'number' && panelHasta > ahora;
  const full = !pausa && !panel && !operando && (ahora - lastFull >= fullMs);
  const funded = !full && !!pausa && !panel && !operando && (ahora - lastFunded >= fullMs);
  return { full, funded, panel };
}
export const SNAPSHOT_MS = 300;
// Beneficio del DOM en dólares de la posición. 0, vacío o texto raro no cuentan.
export function pnlDomUsd(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw !== 0 ? raw : null;
  let s = String(raw ?? '').trim().replace(/\s+/g, '').replace(/[$]/g, '');
  if (!s) return null;
  let neg = false;
  if (s.startsWith('(') && s.endsWith(')')) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith('-') || s.startsWith('−') || s.startsWith('–')) { neg = true; s = s.slice(1); }
  s = s.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n === 0) return null;
  return neg ? -n : n;
}
// Solo el beneficio del DOM de esta cuenta y de este símbolo. En dólares de la posición.
export function pnlDomDeTick(v, S) {
  if (!S || S.entry == null || !S.symbol || !S.account || !S.account.name) return null;
  const txt = v && typeof v === 'object' ? v.txt : v;
  const cuenta = v && typeof v === 'object' ? String(v.cuenta || '').trim() : '';
  const simbolo = v && typeof v === 'object' ? String(v.simbolo || '').trim() : '';
  if (!cuenta || cuenta !== String(S.account.name).trim()) return null;
  if (!simbolo || simbolo !== S.symbol) return null;
  return pnlDomUsd(txt);
}
export function lineaTiempos(t = {}) {
  const n = v => (typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v)) : '?');
  return `TIEMPOS: click→servidor ${n(t.clickServidor)} ms · preparar ${n(t.preparar)} ms · cotización ${n(t.cotizacion)} ms · snapshot ${n(t.snapshot)} ms · placeOrder ${n(t.placeOrder)} ms · posición ${n(t.posicion)} ms · total ${n(t.total)} ms`;
}
export function lineaLatencia(envio, confirmacion) {
  const n = v => (typeof v === 'number' && Number.isFinite(v) ? String(Math.round(v)) : '?');
  return `LATENCIA: envío ${n(envio)} ms · confirmación ${n(confirmacion)} ms`;
}
// Lectura corta, después de placeOrder: posición, historial y ejecuciones desde el clic. No envía nada.
function rellenoVisto(root, side, qty, since, prevExec, prevOrd, parcial) {
  return `var ROOT=${JSON.stringify(root)},SIDE=${Number(side)},QTY=${Number(qty)},DESDE=${Number(since) || 0},PREVX=${JSON.stringify(prevExec || [])},PREVO=${JSON.stringify(prevOrd || [])},PARCIAL=${parcial ? 'true' : 'false'};
  function reciente(x){var tm=+(x&&(x.time||x.timePoint))||0;if(!tm)return false;if(tm<1e12)tm*=1000;return !DESDE||tm>=DESDE-3000}
  function conocido(x,lista){var i=x&&x.id!=null?String(x.id):'';return !!(i&&lista.indexOf(i)>=0)}
  function raizOk(s){return tvRoot(s)===ROOT}
  var histError=null,h=[];try{h=await ab.ordersHistory()||[]}catch(e){histError=String(e&&e.message||e);h=[]}
  var mercado=(h||[]).filter(function(x){return x&&x.type===2&&+x.side===SIDE&&Math.abs(Number(x.qty))===QTY&&raizOk(x.symbol)&&!conocido(x,PREVO)&&reciente(x)});
  var o=mercado.length?mercado[mercado.length-1]:null;
  var p2=await tvPos(ab,ROOT);if(p2)return {filled:true,closed:false,ms:Math.round(performance.now()-T),entry:p2.avgPrice!=null?+p2.avgPrice:null,histError:histError};
  if(o&&(+o.status===5||+o.status===6||+o.status===4)){var msg0=o.message?(o.message.text||String(o.message)):null;return {filled:false,closed:false,filledOrder:false,status:+o.status,message:msg0,histError:histError,ms:Math.round(performance.now()-T)}}
  var execError=null,ex=[];
  try{if(typeof ab.allExecutions==='function')ex=await ab.allExecutions()||[];else if(typeof ab.executions==='function'){var sy=[];try{var csy=window.TradingViewApi._activeChartWidgetWV.value().symbol();if(csy)sy.push(csy)}catch(e){}for(var i=0;i<sy.length;i++){try{(await ab.executions(sy[i])||[]).forEach(function(x){ex.push(x)})}catch(e){throw e}}}else execError='el bróker no tiene lista de ejecuciones'}catch(e){execError=String(e&&e.message||e);ex=[]}
  if(execError)return {filled:false,closed:false,filledOrder:!!(o&&+o.status===2),status:o?+o.status:null,execError:execError,histError:histError,message:o&&o.message?(o.message.text||String(o.message)):null,ms:Math.round(performance.now()-T)};
  ex=(ex||[]).filter(function(x){return x&&raizOk(x.symbol)&&!conocido(x,PREVX)&&reciente(x)});
  function suma(lado){var q=0,px=0;ex.forEach(function(x){if(+x.side!==lado)return;var qq=Math.abs(+x.qty)||0;q+=qq;px+=qq*(+x.price||0)});return q?{qty:q,px:px/q}:null}
  var en=suma(SIDE),sa=suma(-SIDE);
  if(!PARCIAL&&en&&sa&&en.qty+1e-9>=QTY&&sa.qty+1e-9>=QTY)return {filled:true,closed:true,ms:Math.round(performance.now()-T),entry:Math.round(en.px*100)/100,exit:Math.round(sa.px*100)/100,histError:histError};
  if(PARCIAL)return {filled:false,closed:false,filledOrder:!!(o&&+o.status===2),parcial:true,status:o?+o.status:null,message:o&&o.message?(o.message.text||String(o.message)):null,histError:histError,ms:Math.round(performance.now()-T)};
  if(o&&+o.status===2)return {filled:false,filledOrder:true,closed:false,status:2,entry:o.avgPrice!=null?+o.avgPrice:(o.price!=null?+o.price:(en?Math.round(en.px*100)/100:null)),histError:histError,ms:Math.round(performance.now()-T)};
  var msg=o&&o.message?(o.message.text||String(o.message)):null;
  return {filled:false,closed:false,filledOrder:false,status:o?+o.status:null,message:msg,histError:histError,ms:Math.round(performance.now()-T)}`;
}

// ---- Gate de seguridad ----
// cuenta elegible para la prueba: tipo demo/paper, nunca live, nunca Lucid (LFE/LFF/lucid)
export function accountAllowed(a, broker = '') { if (!a || a.type === 'live' || /\bLF[EF]\d*/i.test(a.name || '') || /lucid/i.test(`${a.name} ${a.title}`)) return false; return a.type === 'demo' && isPaper(a.name, `${a.title || ''} ${broker}`); }
// ---- Toda cuenta que no es Paper/Demo es Lucid y se puede operar, aunque el nombre no empiece por LFE/LFF.
// real-allowlist.json no bloquea ninguna cuenta.
export function loadAllow(file = path.join(DIR, 'real-allowlist.json')) {
  const abierto = { allowAll: true, allow: [] };
  try {
    const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').trim();
    if (!raw) return abierto;
    const j = JSON.parse(raw);
    if (!j || typeof j !== 'object' || Array.isArray(j)) return abierto;
    const allow = Array.isArray(j.allow) ? j.allow.map(s => String(s).trim()).filter(Boolean) : [];
    if (j.allowAll === true || allow.length === 0) return { allowAll: true, allow };
    return { allowAll: false, allow };
  } catch { return abierto; }
}
export function realAllowed(name) { const n = String(name || '').trim(); return !!n && !isPaper(n); }
export const realLabel = name => { const n = String(name || ''); return `${n} (LucidFlex · ${tipoDe({ id: n, name: n }) === 'funded' ? 'fondeada' : 'evaluación'})`; };
export function isPaper(name = '', broker = '') {
  const s = `${name || ''} ${broker || ''}`;
  if (/\bLF[EF]\d*/i.test(s) || /lucid/i.test(s)) return false;   // nunca Lucid
  return /paper|demo|\bsim(ulat\w*)?\b/i.test(s);
}

// Datos de la cuenta al abrir (nombre Lucid + inicio/startOfDay de la granja, si existen).
function accountHintFor(name) {
  const id = String(name || '').trim();
  const hint = { name: id, id };
  if (!id) return hint;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(DIR, 'accounts.json'), 'utf8'));
    const a = j && j.accounts && j.accounts[id];
    if (a) {
      if (a.startOfDay != null) hint.startOfDay = a.startOfDay;
      if (a.balance != null) hint.balance = a.balance;
      if (a.inicio != null) hint.inicio = a.inicio;
      if (a.start != null) hint.start = a.start;
      if (a.planStart != null) hint.planStart = a.planStart;
      if (a.plan) hint.plan = a.plan;
      if (a.size) hint.size = a.size;
      if (a.type) hint.type = a.type;
    }
  } catch {}
  try {
    const j = JSON.parse(fs.readFileSync(path.join(DIR, 'sod.json'), 'utf8'));
    const s = j && j.accounts && j.accounts[id];
    if (s) {
      if (s.inicio != null) hint.inicio = s.inicio;
      if (s.planSaldo) hint.planSaldo = s.planSaldo;
      if (s.peak != null) hint.peak = s.peak;
      if (s.lastBal != null) hint.lastBal = s.lastBal;
      if (hint.startOfDay == null && s.bal != null) hint.startOfDay = s.bal;
    }
  } catch {}
  return hint;
}


// ---- Lógica pura del colchón ----
export function decide(pos, stop, st, c) {
  if (!pos) return { action: 'flat' };
  const steps = c.steps || stepsFor(c.symbol, c.qty, c.P), from = st.step ?? 0;
  if (st.locked || from >= steps.length) return { action: 'hold' };
  if (pos.pnl == null) return { action: 'wait' };
  // el escalón más alto alcanzado (si el precio saltó varios disparos), bajando si el precio está demasiado cerca; nunca hacia atrás
  for (let k = steps.length - 1; k >= from; k--) {
    if (pos.pnl < steps[k].triggerUsd) continue;
    const target = roundTick(pos.side === 'long' ? pos.entry + steps[k].lockPts : pos.entry - steps[k].lockPts);
    if (pos.price != null && (pos.side === 'long' ? target >= pos.price : target <= pos.price)) continue;
    const tighter = stop == null || (pos.side === 'long' ? target > stop : target < stop);
    if (!tighter) return { action: 'skip', step: k, why: 'SL ya más ajustado' };
    return { action: 'modify', price: target, step: k };
  }
  return { action: 'wait' };
}

// ---- Driver API (primario): API interna de trading de TradingView vía UNA conexión CDP persistente ----
// Basado en ezydubs/tradingview-mcp (src/core/paper_cdp.js, src/core/paper.js modifyOrder/setBrackets).
export const PAGE = `
function tvWv(x){if(x==null||typeof x!=='object')return x;if(typeof x.value==='function')return x.value();if('value' in x)return x.value;return x}
function tvTrading(){var b=window.TradingView&&window.TradingView.bottomWidgetBar;if(!b)return null;var c=b._widgetControllers&&b._widgetControllers.get('paper_trading');return c&&c._trading||null}
function tvBroker(t){if(!t||!t.activeBroker)return null;return tvWv(t.activeBroker())}
function tvBrokerId(ab){try{return ab&&ab._brokerMetainfo&&ab._brokerMetainfo.id!=null?String(ab._brokerMetainfo.id):null}catch(e){return null}}
function tvRoot(s){var x=String(s||'').replace(/^.*:/,'');return /^MNQ/.test(x)?'MNQ':/^NQ/.test(x)?'NQ':x}
async function tvPos(ab,root){var l=[];tvPos.lastErr=null;try{l=await ab.positions()}catch(e){tvPos.lastErr=String(e&&e.message||e)}l=(l||[]).filter(function(p){return p&&Number(p.qty)!==0&&tvRoot(p.symbol)===root});return l[0]||null}
async function tvAllOrders(t,ab){var l=[];try{l=(tvWv(t._ordersService.activeOrders())||[]).slice()}catch(e){}try{(await ab.orders()||[]).forEach(function(o){if(o&&!l.some(function(x){return x&&String(x.id)===String(o.id)}))l.push(o)})}catch(e){}return l}
function tvStopOrder(t,pos,extra){var l=[];try{l=(tvWv(t&&t._ordersService&&t._ordersService.activeOrders())||[]).slice()}catch(e){}(extra||[]).forEach(function(o){if(o&&!l.some(function(x){return x&&String(x.id)===String(o.id)}))l.push(o)});
 var sc=function(o){return (pos&&Math.abs(Number(o.qty))===Math.abs(Number(pos.qty))?2:0)+(o.parentId!=null?1:0)};
 var c=l.filter(function(o){return o&&(o.type===3||o.type===4)&&(o.status===6||o.status===4)&&(!pos||(tvRoot(o.symbol)===tvRoot(pos.symbol)&&o.side===-pos.side))});c.sort(function(a,b){return sc(b)-sc(a)});return c[0]||null}
function tvNoPosBrackets(ab){try{var f=ab._brokerMetainfo&&ab._brokerMetainfo.configFlags;if(f&&f.supportPositionBrackets===false)return true}catch(e){}try{var m=ab.accountMetainfo&&ab.accountMetainfo();m=tvWv(m);if(m&&m.config&&m.config.supportPositionBrackets===false)return true}catch(e){}return false}
function tvChartPx(){try{return window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries().bars().last().value[4]}catch(e){return null}}
`;
export const js = {
  account: `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t),n=document.querySelector('[class*=accountName]');var meta={};try{meta=ab&&ab._brokerMetainfo||{}}catch(e){}
    var name=n&&n.innerText?String(n.innerText).trim():'';
    if(!name&&ab&&typeof ab.accountsMetainfo==='function'&&typeof ab.currentAccount==='function'){try{var cur=String(tvWv(ab.currentAccount())),l=await ab.accountsMetainfo(),hit=(l||[]).find(function(a){return a&&String(a.id)===cur});if(hit&&hit.name)name=String(hit.name).trim()}catch(e){}}
    return {api:!!ab,brokerId:tvBrokerId(ab),broker:meta.title||meta.name||tvBrokerId(ab),name:name||null}})()`,
  accounts: `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t);if(!ab||!ab.accountsMetainfo)return {error:'no-accounts-api'};var meta={};try{meta=ab._brokerMetainfo||{}}catch(e){}
    var cur=String(tvWv(ab.currentAccount())),l=await ab.accountsMetainfo();return {brokerId:tvBrokerId(ab),broker:meta.title||tvBrokerId(ab),current:cur,canSwitch:typeof ab.setCurrentAccount==='function',
      accounts:(l||[]).map(function(a){return {id:String(a.id),name:a.name,type:a.type,title:a.title,current:String(a.id)===cur}})}})()`,
  // cambia de subcuenta por la API interna (sin clics) y espera a que el id actual Y el nombre visible coincidan
  switchAccount: (id, name) => `(async function(){${PAGE}var ab=tvBroker(tvTrading());if(!ab||typeof ab.setCurrentAccount!=='function')return {error:'no-switch-api'};var T=performance.now(),id=${JSON.stringify(String(id))},nm=${JSON.stringify(String(name || ''))};
    var t0=tvTrading();if(String(tvWv(ab.currentAccount()))!==id){try{if(document.visibilityState==='visible'&&document.hasFocus())return {ok:false,error:'TradingView está en primer plano: no se cambia de cuenta (minimízalo o cámbiala tú)'}}catch(e){}
      var bz=null;try{var ps=((await ab.positions())||[]).filter(function(x){return x&&Number(x.qty)!==0}),wo=(tvWv(t0._ordersService.activeOrders())||[]);if(ps.length||wo.length)bz=ps.length+' posición(es) y '+wo.length+' orden(es) abiertas en la cuenta activa'}catch(e){bz='no pude leer posiciones/órdenes ('+e.message+')'}
      if(bz)return {ok:false,error:'no se cambia de cuenta: '+bz};ab.setCurrentAccount(id)}
    while(performance.now()-T<6000){var n=document.querySelector('[class*=accountName]');if(String(tvWv(ab.currentAccount()))===id&&(!nm||(n&&n.innerText.trim()===nm))){await new Promise(function(z){setTimeout(z,1000)});try{await ab.positions();tvWv(tvTrading()._ordersService.activeOrders())}catch(e){return {ok:false,error:'recarga de posiciones/órdenes: '+e.message}}if(String(tvWv(ab.currentAccount()))!==id)return {ok:false,error:'la cuenta cambió durante la espera'};var np=0,no=0;try{np=((await ab.positions())||[]).filter(function(x){return x&&Number(x.qty)!==0}).length;no=(tvWv(tvTrading()._ordersService.activeOrders())||[]).length}catch(e){return {ok:false,error:'relectura: '+e.message}}if(np||no)return {ok:false,error:'la cuenta '+nm+' ya tiene '+np+' posición(es) y '+no+' orden(es): no se opera'};return {ok:true,ms:Math.round(performance.now()-T)}}await new Promise(function(z){setTimeout(z,100)})}
    return {ok:false,error:'la cuenta no quedó activa',current:String(tvWv(ab.currentAccount()))}})()`,
  position: root => `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t);if(!ab)return {error:'no-api'};var R=${JSON.stringify(root)};var p=await tvPos(ab,R);if(!p)return tvPos.lastErr?{transient:tvPos.lastErr}:null;
    var xo=[];try{xo=(await ab.orders())||[]}catch(e){}var e=p.extra||{},bpl=e.pl!=null?e.pl:(p.pl!=null?p.pl:p.unrealizedPl),so=tvStopOrder(t,p,xo);
    var cpx=tvChartPx(),pv=R==='MNQ'?2:20,sd=p.side===1?1:-1,cpl=cpx!=null?Math.round((cpx-p.avgPrice)*sd*pv*Math.abs(p.qty)*100)/100:null,hasB=typeof bpl==='number';
    var raw={};for(var k in p){var v=p[k];if(v==null||(typeof v!=='object'&&typeof v!=='function'))raw[k]=v}
    return {id:String(p.id),symbol:p.symbol,side:p.side===1?'long':'short',qty:Math.abs(p.qty),entry:p.avgPrice,price:p.lastPrice!=null?p.lastPrice:cpx,priceSrc:p.lastPrice!=null?'broker':'grafica',pnl:hasB?bpl:cpl,pnlSrc:hasB?'broker':'propio',brokerPl:hasB?bpl:null,raw:raw,
    chart:{price:cpx,pnl:cpl},nOrders:xo.length,stopId:so?String(so.id):null,stop:so?so.stopPrice:(p.stopLoss!=null?p.stopLoss:null),stopSrc:so?'order':(p.stopLoss!=null?'bracket':null)}})()`,
  working: root => `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t);if(!ab)return {error:'no-api'};var R=${JSON.stringify(root)};var l=await tvAllOrders(t,ab);
    return {orders:l.filter(function(o){return o&&tvRoot(o.symbol)===R&&(o.status===6||o.status===4)}).map(function(o){return {id:String(o.id),type:o.type,parentId:o.parentId!=null?String(o.parentId):null,status:o.status,stopPrice:o.stopPrice!=null?o.stopPrice:null}})}})()`,
  stopById: id => `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t);if(!ab)return {error:'no-api'};var ID=${JSON.stringify(String(id))};var o=(await tvAllOrders(t,ab)).find(function(x){return x&&String(x.id)===ID});return o?{id:ID,stopPrice:o.stopPrice!=null?o.stopPrice:null,limitPrice:o.limitPrice!=null?o.limitPrice:null,status:o.status,type:o.type}:null})()`,
  tradeSymbol: (sym, front) => `(async function(){${PAGE}var ab=tvBroker(tvTrading()),id=tvBrokerId(ab);var w=function(p,ms){return Promise.race([Promise.resolve(p),new Promise(function(z){setTimeout(function(){z('timeout')},ms)})])};
    var c=${JSON.stringify(sym)},f=${JSON.stringify(front || null)};if(!ab||typeof ab.symbolInfo!=='function')return {symbol:c,broker:id};var list=[c];
    var dt=f?(c.indexOf(':')>=0?c.replace(/[^:]*$/,''):'')+String(f).replace(/^.*:/,''):null;if(dt&&/\\d!$/.test(c))list=String(id).toLowerCase()==='paper'?[c,dt]:[dt,c];
    for(var i=0;i<list.length;i++){try{var r=await w(ab.symbolInfo(list[i]),5000);if(r&&r!=='timeout')return {symbol:list[i],broker:id}}catch(e){}}
    return {error:'el bróker ('+id+') no reconoce '+list.join(' ni ')}})()`,
  modifyUi: (id, price, waitMs = 3000) => `(async function(){${PAGE}var ab=tvBroker(tvTrading());if(!ab||typeof ab.createEditOrderContext!=='function')return {error:'sin createEditOrderContext'};
    var ID=${JSON.stringify(String(id))},PX=${Number(price)},t=tvTrading();var find=async function(){return (await tvAllOrders(t,ab)).find(function(x){return x&&String(x.id)===ID})};
    var so=await find();if(!so)return {error:'stop '+ID+' no encontrado'};if(so.type!==3&&so.type!==4)return {error:'no es stop'};if(so.status!==6&&so.status!==4)return {error:'stop no activo'};
    if(so.stopPrice===PX)return {ok:true,ya:true,verified:PX};var o=Object.assign({},so);o.stopPrice=PX;var T0=performance.now(),r,er=null;
    try{var ctx=await ab.createEditOrderContext({order:o,source:'instant',isDisposable:true,isValidationEnabled:false});r=await Promise.race([ctx.send(),new Promise(function(z){setTimeout(function(){z('pendiente')},${Number(waitMs)})})])}catch(e){er=String(e&&e.message||e)}
    var T1=performance.now(),v=null;do{var x=await find();v=x&&x.stopPrice;if(v===PX)break;await new Promise(function(z){setTimeout(z,100)})}while(performance.now()-T1<${Number(waitMs)});
    return {ok:v===PX,verified:v,ret:r===undefined?'undefined':r,err:er,sendMs:Math.round(T1-T0),confirmMs:Math.round(performance.now()-T1)}})()`,
  lastPrice: `(function(){try{var ms=window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries();var b=ms.bars().last();var fr=null;try{var si=ms.symbolInfo&&ms.symbolInfo();fr=si&&si.front_contract||null}catch(e){}return {symbol:ms.symbol(),price:b.value[4],front:fr}}catch(e){return {error:e.message}}})()`,
  // Bid/ask/último justo antes de placeOrder. El cierre de la vela viaja aparte y no se usa como precio de entrada.
  cotizacion: `(function(){try{var ms=window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries();var q=(ms.quotes&&ms.quotes())||{};var bar=null;try{bar=ms.bars().last().value[4]}catch(e){}function t(v){return v!=null&&v!==''?+v:null}return {bid:q.bid!=null?+q.bid:null,ask:q.ask!=null?+q.ask:null,last:q.last!=null?+q.last:(q.trade!=null?+q.trade:null),bar:typeof bar==='number'?bar:null,symbol:ms.symbol(),askTime:t(q.askTime!=null?q.askTime:q.ask_time),bidTime:t(q.bidTime!=null?q.bidTime:q.bid_time),lastTime:t(q.lastTime!=null?q.lastTime:(q.last_time!=null?q.last_time:q.trade_time)),leido:Date.now()}}catch(e){return {error:e.message}}})()`,
  // Una sola ida a TradingView: cuenta (y cambio si hace falta), sin posición, contrato del chart.
  preparar: (accountId, accountName, symbol) => `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t);if(!tvBrokerId(ab))return {error:'No active broker'};
    var want=${JSON.stringify(String(accountId || ''))},esperada=${JSON.stringify(String(accountName || ''))},root=${JSON.stringify(symbol)};
    var meta={};try{meta=ab._brokerMetainfo||{}}catch(e){}
    var nombre=function(){var n=document.querySelector('[class*=accountName]');return n&&n.innerText?String(n.innerText).trim():''};
    var cur=function(){try{return String(tvWv(ab.currentAccount()))}catch(e){return ''}};
    var switchedMs=null;
    if(want){var lista;try{lista=await ab.accountsMetainfo()||[]}catch(e){return {error:'no-accounts-api'}}
      var acc=(lista||[]).find(function(a){return a&&String(a.id)===want});if(!acc)return {error:'Cuenta no encontrada'};
      if(esperada&&String(acc.name)!==esperada)return {error:'La cuenta elegida no coincide con TradingView'};
      if(cur()!==want){var t0=tvTrading();try{if(document.visibilityState==='visible'&&document.hasFocus())return {error:'TradingView está en primer plano: no se cambia de cuenta (minimízalo o cámbiala tú)'}}catch(e){}
        var bz=null;try{var ps=((await ab.positions())||[]).filter(function(x){return x&&Number(x.qty)!==0}),wo=(tvWv(t0._ordersService.activeOrders())||[]);if(ps.length||wo.length)bz=ps.length+' posición(es) y '+wo.length+' orden(es) abiertas en la cuenta activa'}catch(e){bz='no pude leer posiciones/órdenes ('+(e&&e.message||e)+')'}
        if(bz)return {error:'no se cambia de cuenta: '+bz};var T=performance.now();ab.setCurrentAccount(want);var okSw=false,nm=String(acc.name||'');
        while(performance.now()-T<6000){var n=document.querySelector('[class*=accountName]');if(cur()===want&&(!nm||(n&&n.innerText.trim()===nm))){await new Promise(function(z){setTimeout(z,1000)});try{await ab.positions();tvWv(tvTrading()._ordersService.activeOrders())}catch(e){return {error:'recarga de posiciones/órdenes: '+e.message}}if(cur()!==want)return {error:'la cuenta cambió durante la espera'};var np=0,noo=0;try{np=((await ab.positions())||[]).filter(function(x){return x&&Number(x.qty)!==0}).length;noo=(tvWv(tvTrading()._ordersService.activeOrders())||[]).length}catch(e){return {error:'relectura: '+e.message}}if(np||noo)return {error:'la cuenta '+nm+' ya tiene '+np+' posición(es) y '+noo+' orden(es): no se opera'};okSw=true;switchedMs=Math.round(performance.now()-T);break}await new Promise(function(z){setTimeout(z,100)})}
        if(!okSw)return {error:'la cuenta no quedó activa',current:cur()}}}
    var name=nombre();if(!name){try{var l2=await ab.accountsMetainfo();var hit=(l2||[]).find(function(a){return a&&String(a.id)===cur()});if(hit&&hit.name)name=String(hit.name).trim()}catch(e){}}
    if(want&&esperada&&name&&name!==esperada)return {error:'La cuenta activa es '+name+', no '+esperada+': no se opera'};
    var ya=await tvPos(ab,root);if(ya)return {error:'Ya hay una posición de '+root+' en '+(name||'?')+': no se opera'};
    var leer=function(){try{var ms=window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries();var fr=null;try{var si=ms.symbolInfo&&ms.symbolInfo();fr=si&&si.front_contract||null}catch(e){}return {symbol:ms.symbol(),front:fr}}catch(e){return {error:e.message}}};
    var lp=leer();if(lp.error)return {error:lp.error};
    var cs=String(lp.symbol||'').replace(/^.*:/,''),chartRoot=/^MNQ/.test(cs)?'MNQ':/^NQ/.test(cs)?'NQ':cs;
    if(chartRoot!==root)return {error:'el chart está en '+lp.symbol+'; pon '+root+'1! en el chart'};
    if(!lp.front&&/\\d!$/.test(String(lp.symbol||''))){for(var i=0;i<8&&!lp.front;i++){await new Promise(function(z){setTimeout(z,250)});var again=leer();if(again&&!again.error)lp=again}}
    var idb=tvBrokerId(ab),c=lp.symbol,f=lp.front||null,w=function(p,ms){return Promise.race([Promise.resolve(p),new Promise(function(z){setTimeout(function(){z('timeout')},ms)})])};
    var list=[c],dt=f?(c.indexOf(':')>=0?c.replace(/[^:]*$/,''):'')+String(f).replace(/^.*:/,''):null;if(dt&&/\\d!$/.test(c))list=String(idb).toLowerCase()==='paper'?[c,dt]:[dt,c];
    var trade=null;if(!ab||typeof ab.symbolInfo!=='function')trade=c;else{for(var j=0;j<list.length&&!trade;j++){try{var rr=await w(ab.symbolInfo(list[j]),5000);if(rr&&rr!=='timeout')trade=list[j]}catch(e){}}}
    if(!trade){if(!lp.front&&/\\d!$/.test(String(lp.symbol||'')))return {error:'Tradovate no acepta el continuo '+lp.symbol+' y aún no tengo el contrato fechado (front_contract). Espera 1–2 s con '+root+'1! en el chart e inténtalo de nuevo.'};return {error:'el bróker ('+idb+') no reconoce '+list.join(' ni ')}}
    return {ok:true,accountId:cur(),name:name||null,broker:meta.title||meta.name||idb,brokerId:idb,tradeSymbol:trade,chartSymbol:lp.symbol,front:lp.front||null,switchedMs:switchedMs}})()`,
  place: o => `(async function(){${PAGE}var ab=tvBroker(tvTrading());if(!tvBrokerId(ab))return {error:'No active broker'};
    var prevExec=[],prevOrd=[],execError=null,histError=null,parcial=false;function idDe(x){return x&&x.id!=null?String(x.id):''}
    function cortar(p){return Promise.race([Promise.resolve().then(function(){return p}),new Promise(function(z){setTimeout(function(){z('timeout')},${SNAPSHOT_MS})})])}
    var tSnap=performance.now();
    try{var lx=null;if(typeof ab.allExecutions==='function')lx=await cortar(ab.allExecutions());else if(typeof ab.executions==='function'){var sy=[];try{var cs=window.TradingViewApi._activeChartWidgetWV.value().symbol();if(cs)sy.push(cs)}catch(e){}lx=[];for(var i=0;i<sy.length;i++){var trozo=await cortar(ab.executions(sy[i]));if(trozo==='timeout'){parcial=true;break}(trozo||[]).forEach(function(x){lx.push(x)})}}else execError='el bróker no tiene lista de ejecuciones';if(lx==='timeout'){parcial=true;lx=[]}(lx||[]).forEach(function(x){var i=idDe(x);if(i&&prevExec.indexOf(i)<0)prevExec.push(i)})}catch(e){execError=String(e&&e.message||e);parcial=true}
    try{var lh=null;if(typeof ab.ordersHistory==='function')lh=await cortar(ab.ordersHistory());if(lh==='timeout'){parcial=true;lh=[]}(lh||[]).forEach(function(x){var i=idDe(x);if(i&&prevOrd.indexOf(i)<0)prevOrd.push(i)});var t0=tvTrading();(tvWv(t0&&t0._ordersService&&t0._ordersService.activeOrders())||[]).forEach(function(x){var i=idDe(x);if(i&&prevOrd.indexOf(i)<0)prevOrd.push(i)})}catch(e){histError=String(e&&e.message||e);parcial=true}
    var snapMs=Math.round(performance.now()-tSnap);
    var T=performance.now();var r=await ab.placeOrder(${JSON.stringify(o)});return {ok:r!==false,orderId:r&&(r.orderId||r.id)||null,placeMs:Math.round(performance.now()-T),snapMs:snapMs,parcial:parcial,prevExec:prevExec,prevOrd:prevOrd,execError:execError,histError:histError}})()`,
  // Tras enviar (una sola vez): posición abierta, o historial/ejecuciones nuevas si se abrió y se cerró. No reenvía.
  visto: (root, side, qty, since, prevExec = [], prevOrd = [], parcial = false) => `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t);if(!ab)return {error:'no-api'};var T=performance.now();${rellenoVisto(root, side, qty, since, prevExec, prevOrd, parcial)}})()`,
  fill: (root, side, qty, since, esperaMs = 6000, prevExec = [], prevOrd = [], parcial = false) => `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t);if(!ab)return {error:'no-api'};var T=performance.now();var ROOT=${JSON.stringify(root)};while(performance.now()-T<${Number(esperaMs) || 6000}){var p=await tvPos(ab,ROOT);if(p)return {filled:true,closed:false,ms:Math.round(performance.now()-T),entry:p.avgPrice!=null?+p.avgPrice:null};await new Promise(function(z){setTimeout(z,150)})}
    ${rellenoVisto(root, side, qty, since, prevExec, prevOrd, parcial)}})()`,
  accountId: `(function(){${PAGE}var ab=tvBroker(tvTrading());try{return String(tvWv(ab.currentAccount()))}catch(e){return null}})()`,
  modify: (root, price, waitMs = 3000) => `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t);if(!tvBrokerId(ab))return {error:'No active broker'};var R=${JSON.stringify(root)},PX=${Number(price)};var p=await tvPos(ab,R);if(!p)return {error:'sin posicion'};
    // Paper: editPositionBrackets (reenviando el TP). Tradovate (supportPositionBrackets:false): modifyOrder sobre la orden stop hija, con tope de 3 s. Siempre la MISMA orden; nunca cancela ni recrea.
    var xo=[];try{xo=(await ab.orders())||[]}catch(e){}var noPB=tvNoPosBrackets(ab),so=tvStopOrder(t,p,xo),T0=performance.now(),tries=[];
    var tpPx=p.takeProfit!=null?p.takeProfit:null;if(tpPx==null){try{var lo=(await tvAllOrders(t,ab)).find(function(o){return o&&o.type===1&&(o.status===6||o.status===4)&&o.side===-p.side&&tvRoot(o.symbol)===tvRoot(p.symbol)});if(lo)tpPx=lo.limitPrice}catch(e){}}
    var readSL=async function(){var p2=await tvPos(ab,R);if(!p2)return null;var x2=[];try{x2=(await ab.orders())||[]}catch(e){}var s2=tvStopOrder(t,p2,x2);return s2&&s2.stopPrice!=null?s2.stopPrice:(p2.stopLoss!=null?p2.stopLoss:null)};
    if(!noPB&&ab.editPositionBrackets&&(p.stopLoss!=null||(so&&(so.parentId!=null||so.parentType!=null)))){var b={stopLoss:PX};if(tpPx!=null)b.takeProfit=tpPx;var r1,e1=null;try{r1=await ab.editPositionBrackets(String(p.id),b)}catch(e){e1=e&&e.message||String(e)}
      var T1=performance.now(),v1=null,n=0;
      if(r1!==false&&!e1){do{v1=await readSL();if(v1===PX)break;await new Promise(function(z){setTimeout(z,100)});n++}while(performance.now()-T1<1500)}
      tries.push({via:'editPositionBrackets',payload:b,ret:r1===undefined?'undefined':r1,err:e1,verified:v1,polls:n});
      if(r1!==false&&!e1)return {ok:v1===PX,accepted:true,via:'editPositionBrackets',verified:v1,tpKept:tpPx,tries:tries,modifyMs:Math.round(T1-T0),confirmMs:Math.round(performance.now()-T1)}}
    if(so){if(so.stopPrice===PX)return {ok:true,via:'modifyOrder',verified:PX,ya:true,tries:[{via:'modifyOrder',orderId:String(so.id),ya:true}],modifyMs:0,confirmMs:0};
      var o=Object.assign({},so);o.stopPrice=PX;var T2=performance.now(),r2,e2=null;
      try{r2=await Promise.race([Promise.resolve().then(function(){return ab.modifyOrder(o)}),new Promise(function(z){setTimeout(function(){z('pendiente-3s')},${Number(waitMs)})})])}catch(e){e2=e&&e.message||String(e)}
      var T3=performance.now(),v2=null;if(r2!==false&&!e2){do{v2=await readSL();if(v2===PX)break;await new Promise(function(z){setTimeout(z,100)})}while(performance.now()-T3<1500)}else v2=await readSL();
      tries.push({via:'modifyOrder',orderId:String(so.id),parentId:so.parentId,ret:r2===undefined?'undefined':r2,err:e2,verified:v2,noPosBrackets:noPB});
      if(v2===PX)return {ok:true,via:'modifyOrder',verified:v2,tries:tries,modifyMs:Math.round(T3-T2),confirmMs:Math.round(performance.now()-T3)}}
    return tries.length?{ok:false,error:'no verificado: '+JSON.stringify(tries),tries:tries}:{error:'no-stop-found'}})()`,
  // TP tras el fill: MISMA orden límite hija (type 1). Paper: editPositionBrackets reenviando el SL actual. Tradovate: modifyOrder limitPrice (tope 3 s). Nunca cancela ni recrea.
  modifyTp: (root, price, waitMs = 3000) => `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t);if(!tvBrokerId(ab))return {error:'No active broker'};var R=${JSON.stringify(root)},PX=${Number(price)};var p=await tvPos(ab,R);if(!p)return {error:'sin posicion'};
    var findTp=async function(p2){var l=[];try{l=(await tvAllOrders(t,ab))||[]}catch(e){}return l.find(function(o){return o&&o.type===1&&(o.status===6||o.status===4)&&o.side===-p2.side&&tvRoot(o.symbol)===tvRoot(p2.symbol)})};
    var lo=await findTp(p),cur=lo&&lo.limitPrice!=null?lo.limitPrice:(p.takeProfit!=null?p.takeProfit:null),tries=[],T0=performance.now();
    if(cur===PX)return {ok:true,ya:true,verified:PX,orderId:lo?String(lo.id):null,tries:[]};
    var readTp=async function(){var p2=await tvPos(ab,R);if(!p2)return null;var o2=await findTp(p2);return o2&&o2.limitPrice!=null?o2.limitPrice:(p2.takeProfit!=null?p2.takeProfit:null)};
    var poll=async function(){var T=performance.now(),v=null;do{v=await readTp();if(v===PX)break;await new Promise(function(z){setTimeout(z,100)})}while(performance.now()-T<1500);return v};
    var noPB=tvNoPosBrackets(ab);
    if(!noPB&&ab.editPositionBrackets&&p.takeProfit!=null){var xo=[];try{xo=(await ab.orders())||[]}catch(e){}var so=tvStopOrder(t,p,xo);var b={takeProfit:PX};var slx=so&&so.stopPrice!=null?so.stopPrice:p.stopLoss;if(slx!=null)b.stopLoss=slx;var r1,e1=null;try{r1=await ab.editPositionBrackets(String(p.id),b)}catch(e){e1=e&&e.message||String(e)}
      var v1=r1!==false&&!e1?await poll():await readTp();tries.push({via:'editPositionBrackets',payload:b,ret:r1===undefined?'undefined':r1,err:e1,verified:v1});
      if(v1===PX)return {ok:true,via:'editPositionBrackets',verified:v1,orderId:lo?String(lo.id):null,tries:tries,ms:Math.round(performance.now()-T0)}}
    if(lo){var o=Object.assign({},lo);o.limitPrice=PX;var r2,e2=null;try{r2=await Promise.race([Promise.resolve().then(function(){return ab.modifyOrder(o)}),new Promise(function(z){setTimeout(function(){z('pendiente-3s')},${Number(waitMs)})})])}catch(e){e2=e&&e.message||String(e)}
      var v2=r2!==false&&!e2?await poll():await readTp();tries.push({via:'modifyOrder',orderId:String(lo.id),ret:r2===undefined?'undefined':r2,err:e2,verified:v2});
      if(v2===PX)return {ok:true,via:'modifyOrder',verified:v2,orderId:String(lo.id),tries:tries,ms:Math.round(performance.now()-T0)}}
    return tries.length?{ok:false,error:'no verificado',orderId:lo?String(lo.id):null,tries:tries}:{error:'no-tp-found'}})()`,
  flatten: root => `(async function(){${PAGE}var ab=tvBroker(tvTrading());if(!tvBrokerId(ab))return {error:'No active broker'};var p=await tvPos(ab,${JSON.stringify(root)});if(!p)return {ok:true,flat:true};var r=await ab.closePosition(String(p.id));return {ok:r!==false}})()`,
};

// Fuentes de P&L empujadas por CDP (Runtime.addBinding('__colchonTick')): eventos del bróker, summary, DOM, barra del chart, bid/ask. Solo lectura.
export const TICK_JS = root => `(function(){${PAGE}if(window.__colchonTickU){try{window.__colchonTickU()}catch(e){}}var R=${JSON.stringify(root)},U=[],src=[];
  var send=function(k,v){try{window.__colchonTick(JSON.stringify({k:k,v:v,t:Date.now()}))}catch(e){}};var t=tvTrading(),ab=tvBroker(t);
  if(ab){['positionUpdate','positionPartialUpdate'].forEach(function(n){var d=ab[n];if(d&&typeof d.subscribe==='function'){var f=function(p){if(p&&(!p.symbol||tvRoot(p.symbol)===R)){var v=p.unrealizedPl!=null?p.unrealizedPl:p.pl;if(typeof v==='number')send('b:positionUpdate.unrealizedPl',v)}};d.subscribe(null,f);src.push('b:'+n);U.push(function(){d.unsubscribe(null,f)})}});
    try{(ab.accountManagerInfo().summary||[]).forEach(function(s){var w=s.wValue;if(w&&typeof w.subscribe==='function'){var f=function(v){send('b:summary.'+s.text,tvWv(v))};w.subscribe(f);src.push('b:summary.'+s.text);U.push(function(){try{w.unsubscribe(f)}catch(e){}})}})}catch(e){}}
  try{if(typeof MutationObserver==='function'&&document.body){var mo=new MutationObserver(function(){try{var n=document.querySelector('[class*=accountName]');var cuenta=n&&n.innerText?String(n.innerText).trim():'';var sim='';try{sim=tvRoot(window.TradingViewApi._activeChartWidgetWV.value().symbol())}catch(e){}document.querySelectorAll('[class*=accountSummaryField]').forEach(function(e){var x=String(e.innerText||'').split('\\n');if(x.length>1)send('b:dom.'+x[0],{txt:x[1],cuenta:cuenta,simbolo:sim})})}catch(e){}});mo.observe(document.body,{subtree:true,childList:true,characterData:true});src.push('b:dom');U.push(function(){mo.disconnect()})}}catch(e){}
  var last=null,lb=null,la=null;var iv=setInterval(function(){var c=tvChartPx();if(c!=null&&c!==last){last=c;send('bar',c)}try{var ms=window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries(),q=ms.quotes&&ms.quotes();if(q){if(q.bid!=null&&q.bid!==lb){lb=q.bid;send('q:bid',q.bid)}if(q.ask!=null&&q.ask!==la){la=q.ask;send('q:ask',q.ask)}}}catch(e){}},50);src.push('bar');U.push(function(){clearInterval(iv)});
  window.__colchonTickU=function(){U.forEach(function(u){try{u()}catch(e){}});window.__colchonTickU=null};return {ok:true,fuentes:src}})()`;
// escrituras: se evalúan UNA sola vez (nunca se reintentan)
export const WRITE = /placeOrder|modifyOrder|editPositionBrackets|closePosition|cancelOrder|createEditOrderContext|setCurrentAccount/;
// Conexión CDP persistente (chrome-remote-interface, dependencia de tradingview-mcp). Inyectable para tests.
export async function cdpEvaluator(port = 9222) {
  const { createRequire } = await import('node:module');
  const req = createRequire(TV_PKG);
  const CDP = req('chrome-remote-interface');
  const targets = await CDP.List({ port }); const tgt = targets.find(t => t.type === 'page' && /tradingview\.com\/chart/.test(t.url)) || targets.find(t => t.type === 'page');
  if (!tgt) throw new Error('No encuentro la página del chart en CDP');
  let client = null, onTick = null;
  const connect = async () => { client = await CDP({ port, target: tgt.id }); await client.Runtime.enable(); client.on('disconnect', () => { client = null; });
    client.on('Runtime.bindingCalled', m => { if (m.name === '__colchonTick' && onTick) { try { onTick(JSON.parse(m.payload)); } catch {} } }); };
  const once = async expr => { if (!client) await connect(); const r = await client.Runtime.evaluate({ expression: expr, awaitPromise: true, returnByValue: true, timeout: 5000 }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  const evaluate = async expr => { try { return await once(expr); } catch (e) { if (WRITE.test(expr) || !/disconnect|closed|WebSocket|ECONN|not open/i.test(String(e.message))) throw e; client = null; return once(expr); } };
  const ticker = { async start(root, fn) { onTick = fn; if (!client) await connect(); try { await client.Runtime.addBinding({ name: '__colchonTick' }); } catch {} return once(TICK_JS(root)); },
    async stop() { onTick = null; try { if (client) await once('(function(){if(window.__colchonTickU)window.__colchonTickU();return true})()'); } catch {} } };
  return { evaluate, ticker, close: () => client && client.close() };
}

export function apiDriver(evaluate, ui = null, ticker = null, o = {}) {
  const last = { pos: null }; const rereadMs = o.rereadMs ?? 800, uiWaitMs = o.uiWaitMs ?? 3000, apiWaitMs = o.apiWaitMs ?? 3000;
  return {
    kind: 'api', ticker, lastOpen: () => last.open || null,
    async working(symbol) { const r = await evaluate(js.working(symbol)); if (!r || r.error) throw new Error((r && r.error) || 'working'); return r.orders; },
    async accounts() { const r = await evaluate(js.accounts); if (r.error) throw new Error(r.error); return r; },
    async switchAccount(id, name) { return evaluate(js.switchAccount(id, name)); },
    async accountId() { return evaluate(js.accountId); },
    async account() { const a = await evaluate(js.account); return { name: a.name, broker: [a.broker, a.brokerId].filter(Boolean).join(' '), api: a.api }; },
    async preparar(accountId, accountName, symbol) { const r = await evaluate(js.preparar(accountId, accountName, symbol)); if (!r) throw new Error('No pude preparar la orden'); if (r.error) throw new Error(r.error); return r; },
    async position(symbol) { const p = await evaluate(js.position(symbol)); if (p && p.error) throw new Error(p.error); if (p && p.transient) return p; last.pos = p; return p; },
    async stop() { return last.pos ? last.pos.stop : null; },
    async lastPrice() { try { const r = await evaluate(js.lastPrice); return r && typeof r.price === 'number' ? r.price : null; } catch { return null; } },
    async openBracket({ side, symbol, qty, slPts, tpPts, tradeSymbol, fillWaitMs, adoptMs, marcar } = {}) {
      const marcas = { cotizacion: null, snapshot: null, placeOrder: null, posicion: null, fuente: null, precio: null, edadMs: null, recalculado: null, execError: null };
      const fin = v => { if (typeof marcar === 'function') marcar(marcas); return v; };
      if (!tradeSymbol) return fin('error: sin símbolo del bróker');
      const tCot = Date.now(); let q = null;
      try { q = await evaluate(js.cotizacion); } catch (e) { return fin('error: ' + (e && e.message || e)); }
      marcas.cotizacion = Date.now() - tCot;
      if (!q || q.error) return fin('error: ' + ((q && q.error) || 'sin cotización'));
      const det = detallePrecio(side, q, q.leido || Date.now());
      const live = det ? det.precio : null;
      if (det) { marcas.fuente = det.fuente; marcas.precio = det.precio; marcas.edadMs = det.edadMs; }
      if (live == null) return fin('error: no hay precio vivo (bid/ask) para el SL y el TP: no se envía la orden');
      const br = bracketSeguro(side, live, slPts, tpPts, q.bar);
      if (!br) return fin('error: el SL o el TP quedarían dentro del precio vivo: no se envía la orden');
      marcas.recalculado = !!br.recalculado;
      const s = side === 'long' ? 1 : -1;
      const o = { symbol: tradeSymbol, side: s, type: 2, qty, stopLoss: br.stopLoss, takeProfit: br.takeProfit };
      const tPl = Date.now(); let r = null;
      try { r = await evaluate(js.place(o)); } catch (e) { return fin('error: ' + (e && e.message || e)); }
      marcas.placeOrder = r && r.placeMs != null ? r.placeMs : (Date.now() - tPl);
      marcas.snapshot = r && r.snapMs != null ? r.snapMs : null;
      if (!r || r.error) return fin('error: ' + ((r && r.error) || 'la orden no se envió'));
      if (r.ok === false) return fin('error: la orden no se envió');
      if (r.execError) marcas.execError = r.execError;
      const prevExec = r.prevExec || [], prevOrd = r.prevOrd || [], parcial = !!r.parcial;
      const primero = Number.isFinite(+fillWaitMs) ? +fillWaitMs : 6000;
      const tope = Number.isFinite(+adoptMs) ? +adoptMs : 60000;
      const leer = async () => evaluate(js.visto(symbol, s, qty, tPl, prevExec, prevOrd, parcial));
      let f = null;
      try { f = await evaluate(js.fill(symbol, s, qty, tPl, Math.min(primero, tope), prevExec, prevOrd, parcial)); }
      catch { try { f = await leer(); } catch (e) { f = { execError: String(e && e.message || e) }; } }
      const limite = tPl + tope;
      while (Date.now() < limite && f && !f.filled && !f.closed && f.status !== 5 && (f.filledOrder || f.status === 6 || f.status === 4 || f.status === 2)) {
        await sleep(Math.min(400, Math.max(50, primero)));
        if (Date.now() >= limite) break;
        try { const n = await leer(); if (n) f = n; } catch (e) { f = { ...(f || {}), execError: (f && f.execError) || String(e && e.message || e) }; break; }
      }
      if (f && f.execError) marcas.execError = marcas.execError || f.execError;
      marcas.posicion = f && f.ms != null ? f.ms : null;
      const notaExec = f && f.execError ? { execError: f.execError } : {};
      if (f && f.closed) return fin({ cerrado: true, texto: f.entry != null && f.exit != null ? `se llenó y se cerró: entrada ${f.entry} salida ${f.exit}` : 'se llenó y se cerró', entry: f.entry ?? null, exit: f.exit ?? null, ...notaExec });
      if (f && f.filled) {
        last.open = { ref: live, sl: o.stopLoss, tp: o.takeProfit };
        return fin(`ok market ${qty} ${tradeSymbol} @~${live} SL ${o.stopLoss} TP ${o.takeProfit} · fill visto en ${((f.ms || 0) / 1000).toFixed(2)} s`);
      }
      if (f && f.execError && !f.filledOrder && f.status !== 6 && f.status !== 4) return fin({ lectura: true, texto: 'No pude leer las ejecuciones: ' + f.execError, execError: f.execError });
      if ((parcial || (f && f.parcial)) && !(f && (f.filled || f.closed || f.status === 5))) return fin({ lectura: true, texto: 'lectura previa incompleta: no confirmo el resultado y no reenvío' });
      if (f && f.filledOrder) return fin({ llenoSinPos: true, texto: 'se llenó y no aparece la posición: no reenvío', ...notaExec });
      if (f && (f.status === 6 || f.status === 4)) return fin({ llenoSinPos: true, texto: 'la orden sigue en el bróker: no reenvío', ...notaExec });
      return fin(`error: la orden no se llenó${f && f.status === 5 ? ' (RECHAZADA por TradingView)' : ''}: ${(f && f.message) || 'sin posición tras 6 s'}`);
    },
    // TP: api (tope 3 s) -> relectura por id. Misma orden; nunca cancela ni recrea.
    async modifyTp(price, symbol) {
      const intentos = [], a0 = Date.now(); let r = null, err = null;
      try { r = await evaluate(js.modifyTp(symbol, price, apiWaitMs)); } catch (e) { err = e.message; }
      const tl = ((r && r.tries) || []).slice(-1)[0] || {}, id = (r && r.orderId) || tl.orderId || null;
      intentos.push({ metodo: 'api', via: (r && r.via) || tl.via || null, ms: Date.now() - a0, ok: !!(r && r.ok), verificado: r ? (r.verified ?? tl.verified ?? null) : null, error: err || (r && !r.ok ? r.error : null), tpId: id });
      if (r && r.ok) return { ok: true, ya: !!r.ya, via: r.via || 'ya', verified: r.verified, tpId: id, intentos };
      if (id) { const t0 = Date.now(); let v = null; do { try { const x = await evaluate(js.stopById(id)); v = x ? x.limitPrice : null; } catch {} if (v === price) break; await sleep(100); } while (Date.now() - t0 < rereadMs);
        intentos.push({ metodo: 'relectura', via: 'stopById', ms: Date.now() - t0, ok: v === price, verificado: v, tpId: id });
        if (v === price) return { ok: true, via: 'modifyOrder (confirmado tarde)', verified: v, tpId: id, intentos }; }
      return { ok: false, err: err || (r && r.error) || 'no verificado', tpId: id, intentos };
    },
    // cascada idempotente sobre la MISMA orden y el MISMO precio: api (tope 3 s) -> relectura por id -> edición interna (createEditOrderContext) -> aviso rojo
    async modifyStop(price, symbol) {
      const intentos = [], a0 = Date.now(); let r = null, apiErr = null;
      try { r = await evaluate(js.modify(symbol, price, apiWaitMs)); } catch (e) { apiErr = e.message; }
      const apiMs = Date.now() - a0, tries = (r && r.tries) || [], tl = tries[tries.length - 1] || {};
      intentos.push({ metodo: 'api', via: (r && r.via) || tl.via || null, ms: apiMs, ok: !!(r && r.ok), verificado: r ? (r.verified ?? tl.verified ?? null) : null, ret: tl.ret ?? null, error: apiErr || (r && !r.ok ? (r.error || null) : null), stopId: tl.orderId || (last.pos && last.pos.stopId) || null });
      if (r && !r.error && (r.ok || r.accepted)) return { ok: r.verified === price, accepted: !!r.accepted, method: 'api', via: r.via, verified: r.verified, modifyMs: r.modifyMs, confirmMs: r.confirmMs, apiMs, intentos };
      apiErr = apiErr || (r && r.error) || 'modify false';
      const stopId = (tries.find(t => t.orderId) || {}).orderId || (last.pos && last.pos.stopId) || null;
      if (stopId) { const t0 = Date.now(); let v = null; do { try { const x = await evaluate(js.stopById(stopId)); v = x ? x.stopPrice : null; } catch {} if (v === price) break; await sleep(100); } while (Date.now() - t0 < rereadMs);
        intentos.push({ metodo: 'relectura', via: 'stopById', ms: Date.now() - t0, ok: v === price, verificado: v, error: v === price ? null : 'sin cambio', stopId });
        if (v === price) return { ok: true, method: 'api', via: 'modifyOrder (confirmado tarde)', verified: v, modifyMs: apiMs, confirmMs: Date.now() - t0, apiMs, intentos }; }
      const apiAttemptMs = Date.now() - a0;
      if (ui === 'off') return { ok: false, method: 'api', err: apiErr, apiAttemptMs, intentos };
      if (ui && typeof ui.modifyStop === 'function') { const u0 = Date.now(), u = await ui.modifyStop(price), uiModifyMs = Date.now() - u0; intentos.push({ metodo: 'ui', via: 'ui (clics)', ms: uiModifyMs, ok: u === 'ok', verificado: null, error: u === 'ok' ? null : String(u), stopId });
        return { ok: u === 'ok', method: 'ui', via: 'ui', verified: null, raw: u, apiErr, apiAttemptMs, modifyMs: uiModifyMs, intentos }; }
      if (!stopId) return { ok: false, method: 'api', err: apiErr + ' · sin id del stop: no se toca nada', apiAttemptMs, intentos };
      const u0 = Date.now(); let u = null; try { u = await evaluate(js.modifyUi(stopId, price, uiWaitMs)); } catch (e) { u = { error: e.message }; }
      intentos.push({ metodo: 'ui', via: 'ui-interno (createEditOrderContext instant)', ms: Date.now() - u0, ok: !!(u && u.ok), verificado: u ? (u.verified ?? null) : null, error: u && !u.ok ? (u.error || u.err || 'no verificado') : null, stopId });
      return { ok: !!(u && u.ok), method: 'ui', via: 'ui-interno', verified: u ? (u.verified ?? null) : null, apiErr, apiAttemptMs, modifyMs: (u && u.sendMs) ?? (Date.now() - u0), confirmMs: (u && u.confirmMs) ?? 0, intentos };
    },
    async flatten(symbol) { const r = await evaluate(js.flatten(symbol)); return r.error ? 'error: ' + r.error : 'ok'; },
  };
}

// ---- Driver UI (respaldo): CLI de tradingview-mcp + clics. Selectores a verificar en HERO. ----
export function uiDriver() {
  const TV = TV_CLI;
  const tv = (...a) => new Promise(r => execFile(process.execPath, [TV, ...a], { timeout: 15000 }, (e, o) => { try { r(JSON.parse(o)); } catch { r({ success: false, raw: String(o || e) }); } }));
  const ev = async j => (await tv('ui', 'eval', j)).result;
  return {
    async modifyStop(price) {
      const xy = await ev(`(()=>{const r=[...document.querySelectorAll('[class*=accountManager] tr')].find(t=>/\\bStop\\b/i.test(t.innerText));if(!r)return '';const b=r.getBoundingClientRect();return (b.x+b.width/2|0)+' '+(b.y+b.height/2|0)})()`);
      if (!xy) return 'no-stop-row'; const [x, y] = xy.split(' ');
      await tv('ui', 'mouse', x, y, '--double'); await sleep(1200);
      return ev(`(()=>{const i=[...document.querySelectorAll('input')].find(i=>/stop|price/i.test((i.getAttribute('aria-label')||'')+(i.name||'')));if(!i)return 'no-input';Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'${price}');i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));const b=[...document.querySelectorAll('button')].find(b=>/^(Modify|Modificar)/i.test(b.innerText.trim()));if(!b)return 'no-confirm';b.click();return 'ok'})()`);
    },
  };
}
export async function defaultDriver() { const c = await cdpEvaluator(); return apiDriver(c.evaluate, process.env.COLCHON_UI_FALLBACK === '0' ? 'off' : null, c.ticker); } // respaldo: edición interna de TradingView (sin clics); el uiDriver de píxeles NO se usa

// ---- Fuente de P&L (colchon-fuente.json): "mas-rapido" | "broker" | "grafica" ----
export function fuenteCfg(file = path.join(DIR, 'colchon-fuente.json'), over = null) { let j = {}; try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {} j = { ...j, ...(over || {}) };
  return { modo: ['mas-rapido', 'broker', 'grafica'].includes(j.modo) ? j.modo : 'mas-rapido', frescoMs: Number(j.frescoMs) > 0 ? Number(j.frescoMs) : 2000, pollMs: Number(j.pollMs) > 0 ? Number(j.pollMs) : 50 }; }
export const etDay = (t = Date.now()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));
// DIA DEL FARM: una sesión va de las 18:00 a las 16:00 del día siguiente, hora de Nueva York.
// Se etiqueta con la fecha del día en que termina (las 16:00). De las 16:00 a las 18:00 no hay sesión:
// ese trade pasa a la sesión siguiente (la que empieza a las 18:00 y termina a las 16:00 del otro día).
// Sábado y domingo no se juntan con el lunes: cada uno lleva la fecha de sus 16:00. El horario de verano lo resuelve America/New_York.
export const diaFarm = (t = Date.now()) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date(t)).map(x => [x.type, x.value])); const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day)); if ((+p.hour % 24) >= 16) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
// Fuera de sesión: de las 16:00 inclusive a las 18:00 exclusive, hora de Nueva York.
// Ese hueco es el cierre de la sesión que acaba de terminar. El pico del max loss solo sube con un saldo de aquí, no con un saldo intradía.
export function fueraDeSesion(t = Date.now()) { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(t)).map(x => [x.type, x.value])); const m = (+p.hour % 24) * 60 + +p.minute; return m >= 16 * 60 && m < 18 * 60; }
// Informe del día (Markdown) desde colchon-eventos.jsonl
export function buildReport(dir = DIR, day = diaFarm()) {
  let L = []; try { L = fs.readFileSync(path.join(dir, 'colchon-eventos.jsonl'), 'utf8').split('\n').filter(Boolean).map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(x => x && x.at && diaFarm(Date.parse(x.at)) === day); } catch {}
  const by = t => L.filter(x => x.type === t), etT = a => new Date(a).toLocaleTimeString('en-US', { timeZone: 'America/New_York' }) + ' ET', o = [`# Informe colchón · ${day}`, ''];
  const fins = by('fin_trade'); o.push(`## Trades (${fins.length})`); for (const f of fins) o.push(`- ${etT(f.at)} · ${f.modo || '?'} · ${f.cuenta || '?'} · ${f.estrategia || '?'} · ${f.direccion} ${f.tamano} · ${f.motivo} · P&L ${f.pnlFinalUSD ?? '?'}${f.alerta ? ' · ⚠ ' + f.alerta : ''}`);
  o.push('', '## Ajuste SL/TP al precio real de fill'); { const aj = by('ajuste_brackets'); if (!aj.length) o.push('- sin ajustes'); for (const x of aj) o.push(`- ${etT(x.at)} ref ${x.ref} · fill ${x.fill} · ${x.nada ? 'sin cambio (fill = referencia)' : `SL ${x.slAntes}→${x.slNuevo} ${x.sl && x.sl.ok ? 'OK' : 'FALLÓ'} · TP ${x.tpAntes}→${x.tpNuevo} ${x.tp && x.tp.ok ? 'OK' : 'FALLÓ'} · ${x.seg ?? '?'} s`}`); }
  o.push('', '## Movimientos del stop'); for (const m of by('mover_stop')) o.push(`- ${etT(m.at)} paso ${m.paso} → ${m.precio}: ${m.ok ? 'OK' : 'FALLÓ'} · intentos: ${(m.intentos || []).map(i => `${i.metodo} ${i.ms ?? '?'} ms ${i.ok ? 'ok' : 'falló'}`).join(', ') || '—'}`);
  const lec = by('lectura').filter(x => x.brokerPl != null && x.chartPl != null), dif = lec.map(x => Math.abs(x.brokerPl - x.chartPl));
  o.push('', '## P&L del bróker vs P&L del chart', lec.length ? `- ${lec.length} lecturas · diferencia media $${(dif.reduce((a, b) => a + b, 0) / dif.length).toFixed(2)} · máx $${Math.max(...dif).toFixed(2)}` : '- sin lecturas con ambas fuentes');
  for (const x of lec.slice(-5)) o.push(`  - ${etT(x.at)} bróker ${x.brokerPl} · chart ${x.chartPl}`);
  o.push('', '## Fuentes de P&L para decidir'); for (const x of by('fuentes_fin')) o.push(`- ${etT(x.at)} modo ${x.modo} · líder final ${x.lider || '—'} · ` + Object.entries(x.fuentes || {}).map(([k, v]) => `${k}: ${v.changes} cambios, hueco medio ${v.gapMedioMs ?? '?'} ms, lidera ${v.lidera ?? 0}`).join(' · '));
  for (const x of by('ticks_fin')) o.push(`- ticks: ${JSON.stringify(x.ticks || {})}`);
  const an = by('anomalia'); if (an.length) { o.push('', '## Anomalías'); for (const x of an.slice(-20)) o.push(`- ${etT(x.at)} ${x.kind} ${x.fuente || ''} ${x.valor ?? x.error ?? ''}`); }
  return o.join('\n') + '\n';
}

// ---- Controlador (usado por el servidor) ----
export const colchonHooks = {}; // el servidor registra pnlFinalBroker y onCierre (reporte). onCierre no se espera: no bloquea el cierre ni las órdenes.
export function createColchon(driverOrFactory = defaultDriver, opts = {}) {
  let driver = typeof driverOrFactory === 'function' ? null : driverOrFactory;
  const D = async () => driver || (driver = await driverOrFactory());
  const poll = opts.pollMs ?? CFG.POLL_MS, logFile = opts.logFile ?? path.join(DIR, 'colchon.log');
  let S = { state: 'idle', mode: null, account: null, side: null, symbol: null, qty: null, entry: null, price: null, pnl: null, sl: null, tp: null, locked: false, lockPrice: null, error: null, startedAt: null, log: [] };
  let stopReq = false, loopP = null;
  const evFile = path.join(path.dirname(logFile), 'colchon-eventos.jsonl'); const ev = (type, d = {}) => { try { fs.appendFileSync(evFile, JSON.stringify({ at: new Date().toISOString(), type, ...d }) + '\n'); } catch {} };
  const allow = () => loadAllow(opts.realAllowFile ?? path.join(DIR, 'real-allowlist.json'));
  const log = (...a) => { const s = `${new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} ET ${a.join(' ')}`; S.log.push(s); S.log = S.log.slice(-40); try { fs.appendFileSync(logFile, s + '\n'); } catch {} };
  async function check() { let acc; try { acc = await (await D()).account(); } catch (e) { driver = null; return { account: {}, paper: false, msg: 'Sin conexión con TradingView (CDP 9222): ' + e.message }; } const ok = isPaper(acc.name, acc.broker), real = !ok && realAllowed(acc.name, allow()); return { account: acc, paper: ok, real, realLabel: real ? realLabel(acc.name) : null, msg: ok ? 'Paper/Demo OK' : real ? `CUENTA REAL · ${realLabel(acc.name)}` : (acc.name ? 'No pude leer esa cuenta de TradingView' : 'No veo la cuenta en TradingView') }; }
  async function loop(c, paper) {
    const st = { locked: false, fails: 0, uiTried: false }; const driver = await D(); const real = S.mode === 'real';
    const FZ = fuenteCfg(opts.fuenteFile, opts.fuente), SRC = {}, ticks = {}, leadN = {}; let lead = null; S.fuenteModo = FZ.modo; S.fuenteLider = null; S.fuentes = {};
    const pv = PT_USD[c.symbol] * c.qty, sd = c.side === 'long' ? 1 : -1, wait = FZ.modo === 'grafica' ? poll : Math.min(poll, FZ.pollMs);
    const pnlAt = px => S.entry == null || px == null ? null : Math.round((px - S.entry) * sd * pv * 100) / 100;
    const setSrc = (k, v, t = Date.now()) => { if (typeof v !== 'number') return; const x = SRC[k] || (SRC[k] = { n: 0, changes: 0, gaps: 0, gapSum: 0 }); x.readAt = t; x.n++;
      if (x.v !== v) { if (x.changedAt) { x.gapMs = t - x.changedAt; x.gaps++; x.gapSum += x.gapMs; } x.v = v; x.changedAt = t; x.changes++; if (k !== 'broker-lectura' && k !== 'grafica' || x.changes % 10 === 1) ev('fuente_pl', { fuente: k, v, gapMs: x.gapMs ?? null }); } };
    if (driver.ticker && !opts.noTicks) { try { const tr = await driver.ticker.start(c.symbol, m => { ticks[m.k] = (ticks[m.k] || 0) + 1; const now = Date.now();
        if (/^b:position/.test(m.k)) setSrc('broker-evento', m.v, now); else if (m.k === 'bar') { S.chartPx = m.v; setSrc('grafica', pnlAt(m.v), now); }
        else if (m.k === 'q:bid' && sd === 1) setSrc('bidask', pnlAt(m.v), now); else if (m.k === 'q:ask' && sd === -1) setSrc('bidask', pnlAt(m.v), now);
        else if (m.k === 'b:dom.Profit') { const usd = pnlDomDeTick(m.v, S); if (usd != null) setSrc('dom', usd, m.t || now); } });
      ev('ticks_inicio', { fuentes: tr && tr.fuentes }); } catch (e) { ev('ticks_inicio', { error: String(e.message || e) }); } }
    let lastLect = 0;
    // Misma lectura de P&L que el bucle. El primer ciclo la usa antes del reajuste, con la entrada ya puesta.
    function aplicarFuentes(pos, sl) {
      if (!pos) return pos;
      if (pos.entry != null) S.entry = pos.entry; const now = Date.now();
      setSrc('broker-lectura', pos.brokerPl, now); if (pos.chart && pos.chart.pnl != null) { S.chartPx = pos.chart.price; setSrc('grafica', pnlAt(pos.chart.price) ?? pos.chart.pnl, now); }
      if (now - lastLect >= 1000) { lastLect = now; ev('lectura', { brokerPl: pos.brokerPl ?? null, chartPl: pos.chart ? pos.chart.pnl : null, stop: sl, stopId: pos.stopId ?? null }); }
      const allowK = FZ.modo === 'grafica' ? ['grafica', 'bidask', 'dom'] : FZ.modo === 'broker' ? ['broker-evento', 'broker-lectura', 'dom'] : ['broker-evento', 'broker-lectura', 'grafica', 'bidask', 'dom'];
      const trig = (c.steps[st.step ?? 0] || c.steps[c.steps.length - 1] || { triggerUsd: 100 }).triggerUsd, lim = 2 * Math.max(Math.abs(trig), Math.abs((c.P && c.P.SL_USD) || 0), Math.abs((c.P && c.P.TP_USD) || 0), 1), okK = [];
      for (const k of allowK) { const x = SRC[k]; if (!x || x.v == null || now - x.readAt > FZ.frescoMs) continue; if (!isFinite(x.v) || Math.abs(x.v) > lim) { if (!x.badLogged || x.badLogged !== x.v) { x.badLogged = x.v; ev('anomalia', { kind: 'pnl_imposible', fuente: k, valor: x.v, limiteUSD: lim }); } continue; } okK.push(k); }
      okK.sort((a, b) => (SRC[b].v - SRC[a].v) || (SRC[b].changedAt - SRC[a].changedAt));
      const nl = okK[0] || null; if (nl !== lead) { ev('fuente_lider', { de: lead, a: nl, v: nl ? SRC[nl].v : null }); lead = nl; } if (nl) leadN[nl] = (leadN[nl] || 0) + 1;
      let pnl = nl ? SRC[nl].v : null, price = pos.price;
      if (nl === 'broker-evento' || nl === 'broker-lectura' || nl === 'dom') price = S.entry + pnl / (sd * pv); else if (nl === 'grafica' && S.chartPx != null) price = S.chartPx;
      pos = { ...pos, pnl, price, pnlSrc: nl || 'sin-fuente-fresca' }; S.fuenteLider = pos.pnlSrc;
      S.fuentes = Object.fromEntries(Object.entries(SRC).map(([k, x]) => [k, { v: x.v, edadMs: now - x.readAt }]));
      Object.assign(S, { entry: pos.entry, price: pos.price, pnl: pos.pnl, sl, brokerPl: pos.brokerPl ?? null, chartPl: pos.chart ? pos.chart.pnl : null }); if (typeof sl === 'number' && Number.isFinite(sl)) S.slVisto = sl; if (pos.raw && typeof pos.raw.takeProfit === 'number' && Number.isFinite(pos.raw.takeProfit)) S.tpVisto = pos.raw.takeProfit; if (S.tpPrice == null && pos.entry != null) S.tpPrice = roundTick(pos.entry + (c.side === 'long' ? 1 : -1) * S.tp);
      return pos;
    }
    async function actuar(d, pos, sl, tRead, tSeen) {
      if (d.action === 'skip') { st.step = d.step + 1; S.step = st.step; log(`paso ${d.step + 1}: el SL ya está más ajustado, se salta`); return; }
      if (d.action !== 'modify') return;
      const stp = c.steps[d.step];
      log(`[${c.strategy.name}] paso ${stp.n}/${c.steps.length}: P&L $${pos.pnl} (${pos.pnlSrc}) >= $${stp.triggerUsd}: SL ${sl} -> ${d.price} (protege +$${stp.lockUsd}${c.P.NET_USD ? ` ≈ +$${c.P.NET_USD} netos` : ''})${d.step > st.step ? ` · salto de ${d.step - (st.step ?? 0)} escalón(es)` : ''}`);
      ev('disparo', { paso: stp.n, pnl: pos.pnl, fuente: pos.pnlSrc, disparoUSD: stp.triggerUsd, precio: d.price, slAntes: sl });
      if (paper) { const t0 = Date.now(); const r = await driver.modifyStop(d.price, c.symbol); let v = r.verified, confirmMs = r.confirmMs ?? null;
        if (r.method === 'ui' && r.verified == null) { const c0 = Date.now(); await sleep(800); await driver.position(c.symbol); v = await driver.stop(); confirmMs = Date.now() - c0; }
        for (const x of r.intentos || []) ev('intento_stop', { ...x, precio: d.price, paso: stp.n });
        const tDone = Date.now(); const lat = { metodo: r.method || '?', via: r.via || '?', leerMs: tSeen - tRead, modificarMs: r.modifyMs ?? null, confirmarMs: confirmMs, apiIntentoMs: r.method === 'ui' ? r.apiAttemptMs : (r.apiMs ?? null), uiMs: r.method === 'ui' ? ((r.modifyMs ?? 0) + (confirmMs ?? 0)) : null, apiError: r.apiErr || null, modificarYConfirmarMs: tDone - t0, totalDesdeLecturaMs: tDone - tRead, maxRetrasoPorPollMs: wait, fuente: pos.pnlSrc, intentos: r.intentos || [], real: !opts.ignoreClock }; S.latency = lat; try { fs.appendFileSync(path.join(path.dirname(logFile), 'colchon-latencia.log'), JSON.stringify({ at: new Date().toISOString(), ok: v === d.price, ...lat }) + '\n'); } catch {}
        ev('mover_stop', { paso: stp.n, precio: d.price, ok: v === d.price, verificado: v ?? null, via: r.via || null, intentos: r.intentos || [] });
        log(`LATENCIA [${lat.metodo}/${lat.via}] leer ${sg(lat.leerMs)} · modificar ${sg(lat.modificarMs)} · confirmar ${sg(lat.confirmarMs)}${lat.metodo === 'ui' ? ` · intento API ${sg(lat.apiIntentoMs)} (${lat.apiError}) · UI ${sg(lat.uiMs)}` : ''} = ${sg(lat.totalDesdeLecturaMs)} (+ hasta ${sg(wait)} entre lecturas)`);
        log(lineaLatencia(lat.modificarMs, lat.confirmarMs));
        log(`modify via ${r.via || '?'} (${sg(tDone - t0)}) -> verificado ${v}`, v === d.price ? 'OK' : 'NO coincide ' + (r.err || r.raw || ''));
        const stepRec = { paso: stp.n, disparoUSD: stp.triggerUsd, protegeUSD: stp.lockUsd, precio: d.price, pnlAlDisparar: pos.pnl, fuente: pos.pnlSrc, saltados: d.step - (st.step ?? 0), latencia: lat };
        if (v === d.price || r.accepted) { stepRec.enSeg = S.openAt ? Math.round((Date.now() - S.openAt) / 100) / 10 : null; stepRec.confirmado = v === d.price; S.pasos.push(stepRec); st.step = d.step + 1; S.step = st.step; if (st.step >= c.steps.length) st.locked = true; }
        if (v === d.price) { S.locked = true; S.lockPrice = v; S.sl = v; S.lockTarget = d.price; S.lockAt = S.lockAt || Date.now(); } else if (r.accepted) { S.lockAt = S.lockAt || Date.now(); S.lockPending = true; S.lockTarget = d.price; log(`editPositionBrackets aceptado; TradingView aún no refleja ${d.price} tras 1.5 s: no se reintenta, se confirma en las próximas lecturas`); }
        else { if ((r.intentos || []).some(x => x.metodo === 'ui')) st.uiTried = true; st.fails++;
          if (st.fails >= (real || st.uiTried ? 1 : 3)) { st.locked = true; S.alerta = `NO PUDE MOVER EL STOP: muévelo a mano a ${d.price} (intentos: ${(r.intentos || []).map(x => `${x.metodo} ${x.ok ? 'ok' : 'falló'}`).join(', ') || 'api falló'})`; log(S.alerta); ev('notificacion', { texto: S.alerta, precio: d.price }); } } }
      else { log('SIMULACIÓN: no se modifica'); st.step = d.step + 1; S.step = st.step; if (st.step >= c.steps.length) st.locked = true; S.locked = true; S.lockPrice = d.price; }
    }
    try {
      for (let i = 0; !stopReq; i++) {
        if (paper && S.accountId && driver.accountId) { const cur = await driver.accountId(); if (cur && cur !== S.accountId) { S.error = `La cuenta activa cambió (${cur}) en mitad de la prueba: se deja de vigilar SIN cerrar nada. Revisa la cuenta ${S.account && S.account.name} en TradingView.`; log('ERROR', S.error); break; } }
        const tRead = Date.now(); let pos = await driver.position(c.symbol); const sl0 = await driver.stop(); const tSeen = Date.now();
        if (pos && pos.transient) { ev('anomalia', { kind: 'lectura_fallida_transitoria', error: pos.transient }); await sleep(wait); continue; }
        // guarda de flat: 3 lecturas vacías seguidas, ≥1 s desde la primera y sin órdenes hijas SL/TP activas
        if (!pos && S.openAt != null) {
          S.emptyN = (S.emptyN || 0) + 1; S.emptySince = S.emptySince || Date.now();
          let kids = []; try { kids = driver.working ? (await driver.working(c.symbol)).filter(o => o.parentId != null || o.type === 3 || o.type === 1) : []; } catch { kids = [{ id: '?' }]; }
          const need = opts.flatConfirm ?? { reads: 3, ms: 1000 };
          if (S.emptyN === 1) ev('flat_contador', { lecturasVacias: S.emptyN, msDesdePrimera: Date.now() - S.emptySince, necesita: need, sltpActivas: kids });
          if (S.emptyN < need.reads || Date.now() - S.emptySince < need.ms || kids.length) {
            if (kids.length && Date.now() - S.emptySince > 30000 && !S.kidsWarned) { S.kidsWarned = true; S.alerta = 'No veo la posición pero siguen activas órdenes SL/TP: revisa TradingView'; log('AVISO', S.alerta); ev('notificacion', { texto: S.alerta }); }
            await sleep(wait); continue; }
          ev('flat_decidido', { lecturasVacias: S.emptyN, msDesdePrimera: Date.now() - S.emptySince });
        } else if (pos && S.emptyN) { ev('anomalia', { kind: 'lectura_vacia_transitoria', lecturas: S.emptyN }); log(`lectura vacía transitoria (${S.emptyN}): la posición sigue`); S.emptyN = 0; S.emptySince = null; }
        let sl = sl0;
        if (pos && pos.entry != null && paper && !S.ajusteHecho && S.ref != null) {
          S.entry = pos.entry;
          if (S.openAt == null) { S.openAt = Date.now(); log('Posición abierta (fill visto)'); }
          pos = aplicarFuentes(pos, sl);
          const dPre = decide(pos, sl, st, c);
          const orden = [];
          if (dPre.action === 'modify' || dPre.action === 'skip') { if (dPre.action === 'modify') orden.push('paso'); await actuar(dPre, pos, sl, tRead, tSeen); if (S.lockPrice != null) sl = S.lockPrice; }
          orden.push('ajuste');
          S.ajusteHecho = true; const sd2 = c.side === 'long' ? 1 : -1, slCalc = roundTick(pos.entry - sd2 * S.slPts), tpN = roundTick(pos.entry + sd2 * S.tpPts);
          const protegido = S.lockPrice != null ? S.lockPrice : (S.lockPending ? S.lockTarget : null);
          const slN = protegido != null && (c.side === 'long' ? protegido > slCalc : protegido < slCalc) ? protegido : slCalc;
          const slA = slN === protegido ? protegido : sl0, tpA = S.tpRef;
          const rec = { ref: S.ref, fill: pos.entry, slAntes: slA, slNuevo: slN, tpAntes: tpA, tpNuevo: tpN, stopId: pos.stopId ?? null };
          if (slA === slN && tpA === tpN) { rec.ok = true; rec.nada = true; }
          else { const t0 = Date.now();
            rec.sl = slA === slN ? { ok: true, ya: true } : await driver.modifyStop(slN, c.symbol);
            rec.tp = driver.modifyTp ? await driver.modifyTp(tpN, c.symbol) : { ok: false, err: 'sin modifyTp' };
            rec.ok = !!(rec.sl.ok && rec.tp.ok); rec.seg = Math.round((Date.now() - t0) / 100) / 10; }
          S.tpPrice = tpN; S.ajuste = rec; ev('ajuste_brackets', rec);
          log(rec.nada ? `Fill ${pos.entry} = referencia: SL/TP ya correctos` : `Ajuste por fill ${pos.entry} (ref ${S.ref}): SL ${slA}→${slN} ${rec.sl.ok ? 'OK' : 'FALLO'} · TP ${tpA}→${tpN} ${rec.tp.ok ? 'OK' : 'FALLO'} (${rec.seg} s)`);
          log(`TIEMPOS: orden ${orden.join('→')}`);
          if (!rec.ok) { S.alerta = `Ajuste SL/TP al fill no verificado (SL ${slN}, TP ${tpN}): revisa TradingView. No se canceló nada.`; ev('notificacion', { texto: S.alerta }); }
          if (!rec.nada) { await sleep(wait); continue; }
        }
        if (pos && S.openAt == null) { S.openAt = Date.now(); log('Posición abierta (fill visto)'); }
        if (pos) pos = aplicarFuentes(pos, sl);
        if (S.lockPending && sl === S.lockTarget) { S.lockPending = false; S.locked = true; S.lockPrice = sl; S.lockAt = S.lockAt || Date.now(); log(`colchón confirmado en ${sl}`); }
        const d = decide(pos, sl, st, c);
        if (d.action === 'flat') { if (paper && S.openAt == null && i < 10) { await sleep(poll); continue; }
          let lp = S.price; try { const q = driver.lastPrice && await driver.lastPrice(); if (q != null) lp = q; } catch {} const up = c.side === 'long'; S.reason = lp == null ? 'flat' : (S.tpPrice != null && (up ? lp >= S.tpPrice - TICK * 4 : lp <= S.tpPrice + TICK * 4)) ? 'tp' : ((S.lockTarget ?? S.sl) != null && (up ? lp <= (S.lockTarget ?? S.sl) + TICK * 4 : lp >= (S.lockTarget ?? S.sl) - TICK * 4)) ? 'sl' : 'flat';
          S.closeAt = Date.now(); log('Sin posición: fin del loop (' + S.reason + ')'); break; }
        if (d.action === 'skip' || d.action === 'modify') await actuar(d, pos, sl, tRead, tSeen);
        await sleep(wait);
      }
    } catch (e) { S.error = String(e.message || e); log('ERROR', S.error); ev('error', { error: S.error }); }
    if (driver.ticker && !opts.noTicks) { try { await driver.ticker.stop(); } catch {} }
    const fz = Object.fromEntries(Object.entries(SRC).map(([k, x]) => [k, { lecturas: x.n, changes: x.changes, gapMedioMs: x.gaps ? Math.round(x.gapSum / x.gaps) : null, lidera: leadN[k] || 0, ultimo: x.v }]));
    S.fuentesStats = fz; ev('fuentes_fin', { modo: FZ.modo, lider: lead, fuentes: fz }); ev('ticks_fin', { ticks });
    S.state = stopReq ? 'stopped' : (S.error ? 'error' : 'done'); if (stopReq) S.reason = 'stop'; if (S.error) S.reason = 'error'; log('loop terminado:', S.state);
    await brokerFinal();
    summarize();
  }
  let last = null;
  const sg = ms => ms == null ? '?' : (ms < 1000 ? (ms / 1000).toFixed(2) : (ms / 1000).toFixed(1)) + ' s';
  const etT = t => t == null ? null : new Date(t).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', second: '2-digit' }) + ' ET';
  const seg = (a, b) => a == null || b == null ? null : Math.round((b - a) / 100) / 10;
  function tiempos() { if (S.openAt != null && S.closeAt == null && S.state !== 'running') S.closeAt = Date.now();
    return { abiertaEn: S.openAt ? new Date(S.openAt).toISOString() : null, cerradaEn: S.closeAt ? new Date(S.closeAt).toISOString() : null, abiertaET: etT(S.openAt), cerradaET: etT(S.closeAt),
      duracionSeg: seg(S.openAt, S.closeAt), colchonTrasSeg: S.locked ? seg(S.openAt, S.lockAt) : null, precisionMs: `±${poll}` }; }
  // Si el bucle no tiene P&L final (cierre rapido), toma el P&L bruto real de las ejecuciones del broker. Nunca lanza error ni bloquea mas de ~6 s.
  async function brokerFinal() { S.pnlBroker = null; try { if (S.openAt != null && S.closeAt == null) S.closeAt = Date.now(); if (S.reason === 'tp' || S.reason === 'sl' || S.pnl != null || S.openAt == null) return; const f = opts.pnlFinalBroker || colchonHooks.pnlFinalBroker; if (typeof f !== 'function') return;
    for (let i = 0; i < 2 && S.pnlBroker == null; i++) { if (i) await sleep(1000); const v = await Promise.race([f({ openAt: S.openAt, side: S.side, cuenta: S.account && S.account.name }), sleep(2500).then(() => null)]); if (typeof v === 'number' && Number.isFinite(v)) { S.pnlBroker = v; log('P&L final tomado de las ejecuciones del broker: ' + v); } } } catch {} }
  function summarize() {
    if (S.reason === 'sl' && S.lockTarget != null && !S.locked) { S.locked = true; S.lockPrice = S.lockTarget; S.sl = S.lockTarget; S.lockPending = false; } // salió por stop en el precio del colchón
    if (S.reason === 'sl' && S.lockTarget != null) S.sl = S.lockTarget;
    const pnlSL = S.sl != null && S.entry != null ? Math.round((S.sl - S.entry) * (S.side === 'long' ? 1 : -1) * PT_USD[S.symbol] * S.qty * 100) / 100 : null;
    const SP = S.P || (S.strategy && getStrategy(S.strategy.id) || getStrategy()).params; const pnlFinal0 = S.reason === 'tp' ? SP.TP_USD : S.reason === 'sl' ? pnlSL : S.pnl; const usaBroker = pnlFinal0 == null && typeof S.pnlBroker === 'number'; const pnlFinal = usaBroker ? S.pnlBroker : pnlFinal0;
    last = { fin: new Date().toISOString(), cuenta: S.account && S.account.name, modo: S.mode, direccion: S.side === 'long' ? 'COMPRA' : 'VENTA', tamano: `${S.qty} ${S.symbol}`, motivo: { tp: 'Take profit', sl: 'Stop loss', stop: 'Detenido manualmente', flat: 'Posición cerrada', error: 'Error' }[S.reason] || S.reason || '—',
      ajusteFill: S.ajuste || null, estrategia: S.strategy ? S.strategy.name : null, estrategiaId: S.strategy ? S.strategy.id : null, ...tiempos(), entrada: S.entry, pnlFinalUSD: pnlFinal, pnlFinalAprox: usaBroker ? false : !(S.reason === 'tp' || S.reason === 'sl'), colchonMovido: S.locked, slColchon: S.lockPrice, pasos: (S.pasos || []).map(p => ({ paso: p.paso, disparoUSD: p.disparoUSD, protegeUSD: p.protegeUSD, precio: p.precio, enSeg: p.enSeg, confirmado: p.confirmado, saltados: p.saltados, latenciaSeg: p.latencia ? Math.round(p.latencia.totalDesdeLecturaMs / 10) / 100 : null })), probabilidadNecesaria: S.qty ? breakEvenFor(S.symbol, S.qty, SP) : null, pasosTotal: S.steps ? S.steps.length : null, colchonUSD: S.qty ? ((S.pasos && S.pasos.length) ? S.pasos[S.pasos.length - 1].protegeUSD : (SP.STEPS ? null : lockUsdFor(S.symbol, S.qty, SP))) : null, disparoUSD: S.qty && !SP.STEPS ? triggerUsdFor(S.symbol, S.qty, SP) : null, latencia: S.latency || null, fuenteModo: S.fuenteModo || null, fuenteLider: S.fuenteLider || null, fuentes: S.fuentesStats || null, alerta: S.alerta || null, inicio: S.startedAt, error: S.error };
    S.summary = last; try { fs.writeFileSync(path.join(path.dirname(logFile), 'colchon-resumen.json'), JSON.stringify(last, null, 2)); } catch {}
    ev('fin_trade', last); try { const dd = path.dirname(logFile), rd = path.join(dd, 'reportes'); fs.mkdirSync(rd, { recursive: true }); fs.writeFileSync(path.join(rd, diaFarm() + '.md'), buildReport(dd, diaFarm())); } catch {}
    log(`DURACIÓN ${last.duracionSeg == null ? '?' : sg(last.duracionSeg * 1000)} (${last.abiertaET ?? '?'} → ${last.cerradaET ?? '?'}, ±${sg(poll)})${last.colchonTrasSeg != null ? ` · colchón a los ${sg(last.colchonTrasSeg * 1000)}` : ''}`);
    if (last.pasos.length) log('PASOS ' + last.pasos.map(p => `#${p.paso} +$${p.protegeUSD} a los ${p.enSeg ?? '?'} s`).join(' · '));
    log('RESUMEN', JSON.stringify(last));
    // Reporte en el gráfico: aviso asíncrono, fuera del camino de la orden. Si falla, el cierre ya quedó registrado.
    try {
      const h = opts.onCierre || colchonHooks.onCierre;
      if (typeof h === 'function') {
        const aviso = { ...last, symbol: S.symbol, side: S.side, qty: S.qty, accountId: S.accountId || null, slVisto: S.slVisto ?? null, tpVisto: S.tpVisto ?? null, cerrado: S.openAt != null && S.entry != null && S.reason !== 'error' };
        setImmediate(() => { Promise.resolve(h(aviso)).catch(() => {}); });
      }
    } catch {}
  }
  return {
    check,
    strategies: () => ({ ok: true, default: DEFAULT_STRATEGY, strategies: listStrategies() }),
    async accounts() { try { const r = await (await D()).accounts(); return { ok: true, ...r, accounts: r.accounts.map(a => { const papel = isPaper(a.name || '', `${r.broker || ''} ${r.brokerId || ''}`), tiene = !!String(a.name || '').trim(), re = tiene && !papel; const hint = accountHintFor(a.name); const tipo = tipoDe({ id: a.name, name: a.name, type: hint.type }); const acc = { id: a.name, name: a.name, ...hint, ...(a.balance != null ? { balance: a.balance } : {}), ...(a.equity != null ? { equity: a.equity } : {}), type: tipo }; const rules = rulesFor({ id: a.name, name: a.name, ...acc }); const pnl = acc.balance != null ? Math.round((acc.balance - rules.start) * 100) / 100 : null; return { ...a, type: tipo, ...(acc.balance != null ? { balance: acc.balance, totalPnl: pnl } : { totalPnl: null }), allowed: tiene, real: re, realLabel: re ? realLabel(a.name) : null, plan: rules.size, ...(acc.planSaldo ? { planSaldo: acc.planSaldo } : {}), scale: rules.scale, start: rules.start, planStart: rules.start, dd: rules.dd, dailyLoss: rules.dailyLoss, profitTarget: rules.profitTarget, lockTriggerOver: rules.lockTriggerOver, lockFloorOver: rules.lockFloorOver, atRisk: rules.atRisk, maxMinis: maxQtyFor('NQ', acc), maxMicros: maxQtyFor('MNQ', acc) }; }) }; } catch (e) { driver = null; return { ok: false, err: 'Sin conexión con TradingView: ' + e.message, accounts: [] }; } },
    async start(args = {}) {
      if (S.state === 'running') return { ok: false, err: 'Ya hay una prueba corriendo' };
      if (acctGuard.testActive) return { ok: false, err: 'esperando lectura…', waitingLectura: true };
      acctGuard.testActive = true;
      try {
        if (acctGuard.fullRead) {
          log('Lectura de cuentas en curso: se espera como máximo 2.5 s antes de operar.');
          await Promise.race([Promise.resolve(acctGuard.fullRead).catch(() => {}), sleep(2500)]);
        }
        let r; try { r = await this._start(args); } catch (e) { r = { ok: false, err: String(e.message || e) }; }
        if (!r || !r.ok) { acctGuard.testActive = false; if (S.state === 'running') { S.state = 'error'; S.error = S.error || (r && r.err) || 'No se pudo iniciar'; } }
        return r || { ok: false, err: 'No se pudo iniciar' };
      } catch (e) { acctGuard.testActive = false; if (S.state === 'running') S.state = 'error'; return { ok: false, err: String(e.message || e) }; }
    },
    async _start({ side = 'long', symbol = DEFAULT.symbol, qty, accountId, accountName, strategyId, confirmReal, tClick } = {}) {
      const tServer = Date.now();
      const tiempos = { clickServidor: tClick != null && Number.isFinite(+tClick) ? tServer - +tClick : null };
      const strat = getStrategy(strategyId == null || strategyId === '' ? DEFAULT_STRATEGY : strategyId); if (!strat) return { ok: false, err: `Estrategia desconocida: ${strategyId}` };
      if (!['long', 'short'].includes(side) || !(symbol in SIZES)) return { ok: false, err: 'Parámetros inválidos' };
      qty = qty == null || qty === '' ? ((strat.params.DEFAULT_QTY || {})[symbol] ?? (symbol === DEFAULT.symbol ? DEFAULT.qty : 1)) : Number(qty);
      if (!Number.isInteger(qty) || qty < 1) return { ok: false, err: `Cantidad inválida: ${symbol} entre 1 y ${maxQtyFor(symbol, {})}` };
      const desdePanel = tClick != null || accountName != null;
      if (desdePanel && (accountId == null || accountId === '')) return { ok: false, err: 'Elige una cuenta' };
      const nombrePedido = accountName != null ? String(accountName) : '';
      if (nombrePedido) {
        const hint0 = accountHintFor(nombrePedido), max0 = maxQtyFor(symbol, hint0);
        if (qty > max0) return { ok: false, err: `Cantidad inválida: ${symbol} entre 1 y ${max0}` };
        if (!isPaper(nombrePedido) && realAllowed(nombrePedido, allow()) && confirmReal !== true) return { ok: false, blocked: true, needConfirm: true, err: `CUENTA REAL · ${realLabel(nombrePedido)}: falta confirmación` };
      }
      const tPrep = Date.now(); let prep;
      try { prep = await (await D()).preparar(accountId || '', nombrePedido, symbol); }
      catch (e) { return { ok: false, err: String(e.message || e) }; }
      tiempos.preparar = Date.now() - tPrep;
      const name = prep.name || nombrePedido || '';
      const brokerTxt = [prep.broker, prep.brokerId].filter(Boolean).join(' ');
      const paper = isPaper(name, brokerTxt), real = !paper && realAllowed(name, allow());
      const chk = { account: { name: name || null, broker: brokerTxt, api: true }, paper, real, realLabel: real ? realLabel(name) : null, msg: paper ? 'Paper/Demo OK' : real ? `CUENTA REAL · ${realLabel(name)}` : (name ? 'No pude leer esa cuenta de TradingView' : 'No veo la cuenta en TradingView') };
      if (real && confirmReal !== true) return { ok: false, blocked: true, needConfirm: true, err: `CUENTA REAL · ${chk.realLabel}: falta confirmación (confirmReal)` };
      const exec = paper || (real && confirmReal === true);
      if ((desdePanel || (accountId != null && accountId !== '')) && !exec) return { ok: false, blocked: true, err: chk.msg };
      if (accountId && prep.accountId && String(prep.accountId) !== String(accountId)) return { ok: false, err: 'La cuenta activa no es la elegida: no se opera' };
      const hint = accountHintFor(name);
      { const maxQ = maxQtyFor(symbol, hint); if (qty > maxQ) return { ok: false, err: `Cantidad inválida: ${symbol} entre 1 y ${maxQ}` }; }
      const P = paramsForAccount(strat.params, hint), c = { side, symbol, qty, P, strategy: { id: strat.id, name: strat.name }, steps: stepsFor(symbol, qty, P) }, slPts = ptsFor(P.SL_USD, symbol, qty), tpPts = ptsFor(P.TP_USD, symbol, qty);
      S = { ...S, pnlBroker: null, summary: null, reason: null, lockTarget: null, lockPending: false, openAt: null, closeAt: null, lockAt: null, tpPrice: null, latency: null, state: 'running', strategy: { id: strat.id, name: strat.name }, P, steps: stepsFor(symbol, qty, P), step: 0, pasos: [], mode: chk.paper ? 'paper' : chk.real ? 'real' : 'simulacion', realLabel: chk.realLabel || null, alerta: null, emptyN: 0, emptySince: null, kidsWarned: false, fuentesStats: null, account: chk.account, side, symbol, qty, entry: null, price: null, pnl: null, sl: null, slVisto: null, tpVisto: null, tp: tpPts, locked: false, lockPrice: null, error: null, startedAt: new Date().toISOString(), log: [] };
      stopReq = false;
      log(`Inicio [${strat.name}] ${side === 'long' ? 'COMPRA' : 'VENTA'} ${qty} ${symbol} · SL -$${P.SL_USD} (${slPts} pts) · TP +$${P.TP_USD} (${tpPts} pts) · ${P.STEPS ? (!c.steps.length ? 'stop fijo (sin movimientos)' : 'escalones ' + c.steps.map(x => `+$${x.triggerUsd}→+$${x.lockUsd} (${x.lockPts} pts)`).join(' · ')) : `colchón +$${lockUsdFor(symbol, qty, P)} (${lockPtsFor(symbol, qty, P)} pts, ≈ +$${P.NET_USD} netos), disparo +$${triggerUsdFor(symbol, qty, P)} (${triggerPtsFor(symbol, qty, P)} pts)`} · cuenta ${chk.account.name || '?'}${strat.params.SCALE_BY_SIZE ? ' · plan ' + accountPlanSize(hint) : ''} -> ${chk.msg}`);
      if (prep.switchedMs != null) log(`Cuenta cambiada a ${name} por API (${(prep.switchedMs / 1000).toFixed(2)} s, verificada)`);
      if (chk.real) log(`CUENTA REAL · ${chk.realLabel} · confirmada por el usuario`);
      if (!exec) { log('BLOQUEADO: solo Paper/Demo o cuenta real permitida y confirmada. No se envía ninguna orden.'); S.state = 'blocked'; return { ok: false, blocked: true, err: chk.msg, status: S }; }
      const drv = await D(); S.accountId = prep.accountId || null;
      const marcas = {};
      const op = await drv.openBracket({ ...c, slPts, tpPts, tradeSymbol: prep.tradeSymbol, fillWaitMs: opts.fillWaitMs, adoptMs: opts.adoptMs, marcar: m => Object.assign(marcas, m) });
      tiempos.cotizacion = marcas.cotizacion ?? null; tiempos.snapshot = marcas.snapshot ?? null; tiempos.placeOrder = marcas.placeOrder ?? null; tiempos.posicion = marcas.posicion ?? null;
      tiempos.total = Date.now() - (tClick != null && Number.isFinite(+tClick) ? +tClick : tServer);
      if (marcas.fuente) log(lineaPrecio(marcas));
      if (marcas.execError) log('No pude leer las ejecuciones: ' + marcas.execError);
      const especial = op && typeof op === 'object';
      const texto = especial ? String(op.texto || '') : String(op);
      log('open ->', texto);
      log(lineaTiempos(tiempos));
      if (especial && op.cerrado) {
        S.state = 'done'; S.reason = 'flat'; S.error = null; S.entry = op.entry ?? null; if (op.exit != null) S.price = op.exit;
        S.openAt = Date.now(); S.closeAt = Date.now();
        return { ok: false, filled: true, closed: true, aviso: true, err: texto, status: S };
      }
      if (especial && op.lectura) {
        S.state = 'done'; S.reason = 'error'; S.error = texto;
        return { ok: false, filled: false, err: texto, status: S };
      }
      if (especial && op.llenoSinPos) {
        S.state = 'done'; S.reason = op.cerrado ? 'flat' : 'error'; S.error = null; S.entry = op.entry ?? null; if (op.exit != null) S.price = op.exit;
        S.openAt = Date.now(); S.closeAt = Date.now();
        return { ok: false, filled: true, closed: !!op.cerrado, err: texto, status: S };
      }
      { const lo = drv.lastOpen ? drv.lastOpen() : null; Object.assign(S, { ajusteHecho: false, ajuste: null, slPts, tpPts, ref: lo ? lo.ref : null, tpRef: lo ? lo.tp : null }); }
      if (texto.startsWith('error')) { S.state = 'error'; S.error = texto; S.reason = 'error'; summarize(); return { ok: false, err: texto, status: S }; }
      loopP = loop(c, true).finally(() => { acctGuard.testActive = false; });
      return { ok: true, status: S };
    },
    async stop({ flatten = false } = {}) { stopReq = true; if (flatten && (S.mode === 'paper' || S.mode === 'real')) log('flatten ->', await (await D()).flatten(S.symbol)); await loopP; return { ok: true, status: S }; },
    status: () => S,
    summary: () => last || (() => { try { return JSON.parse(fs.readFileSync(path.join(DIR, 'colchon-resumen.json'), 'utf8')); } catch { return null; } })(),
  };
}
export const colchon = createColchon();

// ---- CLI ----
if (process.argv.includes('--selftest')) {
  for (const [sy, q] of [['MNQ', 20], ['NQ', 2]]) console.log(`evaluacion ${sy}x${q}`, JSON.stringify(stepsFor(sy, q, getStrategy('evaluacion').params)));
  for (const [sy, q] of [['MNQ', 10], ['MNQ', 1], ['MNQ', 20], ['MNQ', 3], ['NQ', 1], ['NQ', 2]]) console.log(`${sy}x${q} SL ${ptsFor(600, sy, q)} TP ${ptsFor(1600, sy, q)} colchón $${lockUsdFor(sy, q)} disparo $${triggerUsdFor(sy, q)} | pts disparo ${triggerPtsFor(sy, q)} lock ${lockPtsFor(sy, q)}`);
  console.log('NQx2 SL', ptsFor(600, 'NQ', 2), 'TP', ptsFor(1600, 'NQ', 2), 'lock', ptsFor(150, 'NQ', 2), '| MNQx20 lock', ptsFor(150, 'MNQ', 20));
  const c = { symbol: 'NQ', qty: 2 };
  console.log(decide({ side: 'long', entry: 20000, pnl: 120 }, 19985, {}, c).action, decide({ side: 'long', entry: 20000, price: 20004.5, pnl: 180 }, 19985, {}, c), decide({ side: 'short', entry: 20000, price: 19995, pnl: 200 }, 20015, {}, c), decide({ side: 'long', entry: 20000, pnl: 200 }, 20005, {}, c).action);
  console.log('gate', isPaper('Paper Trading'), isPaper('DEMO1234567', 'Tradovate'), isPaper('LFE00000000000000', 'Tradovate'), isPaper('LFF123 demo'), isPaper('12345 live'));
} else if (process.argv[1] && process.argv[1].endsWith('colchon.mjs')) {
  const k = createColchon(); const r = await k.start({ side: process.argv.includes('--short') ? 'short' : 'long', symbol: process.argv.includes('--mnq') ? 'MNQ' : 'NQ' });
  if (!r.ok) { console.log(r.err); process.exit(0); }
}

// ---- Lectura de saldos de TODAS las cuentas por la API interna (sin clics). La usa tradinglink.mjs para la granja.
// all=false: solo la cuenta activa (sin cambiar nada). all=true: recorre las cuentas con setCurrentAccount y vuelve a la original,
// solo si no hay posiciones/órdenes abiertas en la cuenta activa.
export const js_readAccounts = (all, only = null) => `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t);if(!ab||!ab.accountsMetainfo)return {error:'no-api'};
  var sl=function(ms){return new Promise(function(z){setTimeout(z,ms)})},orig=String(tvWv(ab.currentAccount())),l=await ab.accountsMetainfo(),out=[],busy=false,aborted=false;
  // TradingView en primer plano (visible y con foco) = el usuario lo está usando: no se cambia de cuenta
  var fg=function(){try{return document.visibilityState==='visible'&&document.hasFocus()}catch(e){return true}},visible=fg(),vis0=document.visibilityState;
  try{busy=((await ab.positions())||[]).filter(function(x){return x&&Number(x.qty)!==0}).length>0||(tvWv(t._ordersService.activeOrders())||[]).length>0}catch(e){busy=true}
  var read=function(a){var m={};try{(ab.accountManagerInfo().summary||[]).forEach(function(s){m[String(s.text).toLowerCase()]=s.wValue?tvWv(s.wValue):null})}catch(e){}
    var n=document.querySelector('[class*=accountName]');return {accountId:String(a.id),name:a.name,type:a.type,balance:m['account balance'],equity:m['equity'],profit:m['profit']!=null?m['profit']:m['unrealized pnl'],shownName:n?n.innerText.trim():null}};
  var cur=l.find(function(a){return String(a.id)===orig});if(cur)out.push(read(cur));
  if(${all ? 'true' : 'false'}&&!busy&&!visible){for(const a of l){if(String(a.id)===orig)continue;if(${only ? 'true' : 'false'}&&!new RegExp(${JSON.stringify(only || '')}).test(a.name))continue;if(fg()){aborted=true;break}ab.setCurrentAccount(String(a.id));var T=performance.now(),ok=false;
      while(performance.now()-T<6000){if(fg()){aborted=true;break}var n=document.querySelector('[class*=accountName]');if(String(tvWv(ab.currentAccount()))===String(a.id)&&n&&n.innerText.trim()===a.name){ok=true;break}await sl(100)}
      if(aborted)break;if(!ok)continue;for(var w=0;w<20&&!fg();w++)await sl(100);var r=read(a);if(r.shownName===a.name&&String(tvWv(ab.currentAccount()))===String(a.id))out.push(r)}
    if(String(tvWv(ab.currentAccount()))!==orig){ab.setCurrentAccount(orig);var T2=performance.now();while(performance.now()-T2<6000&&String(tvWv(ab.currentAccount()))!==orig)await sl(100);await sl(1000)}}
  return {broker:tvBrokerId(ab),current:orig,busy:busy,visible:visible,visibility:vis0,focus:(function(){try{return document.hasFocus()}catch(e){return null}})(),aborted:aborted,live:(l||[]).map(function(a){return {id:String(a.id),name:a.name}}),accounts:out,final:String(tvWv(ab.currentAccount()))}})()`;
// Exclusión mutua entre la lectura de todas las cuentas (cambia de cuenta) y una prueba (fija su cuenta):
// - con una prueba activa (o arrancando) solo se lee la cuenta activa, sin cambiar nada;
// - una prueba que arranca espera como máximo ~2.5 s a una lectura completa en curso y luego sigue.
export const acctGuard = { testActive: false, fullRead: null };
export async function readAccounts({ all = false, only = null, evaluate = null } = {}) {
  if (all && acctGuard.testActive) all = false;
  let c = null; const ev = evaluate || (c = await cdpEvaluator()).evaluate;
  const run = (async () => { try { return await ev(js_readAccounts(all, only)); } finally { try { c && c.close(); } catch {} } })();
  if (all) { acctGuard.fullRead = run.catch(() => {}); run.finally(() => { acctGuard.fullRead = null; }).catch(() => {}); }
  const r = await run; if (all) r.full = true; return r;
}
