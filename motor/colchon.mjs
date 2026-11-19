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
// Holgura mínima: ni el stop ni el objetivo pueden quedar a menos de 2 ticks del lado del libro que los dispararía.
export const HOLGURA_TICKS = 2;
// Si el objetivo de la estrategia es corto (Rascacielo son 2,5 pts), el límite de entrada queda al menos
// 8 ticks (2,00 pts) más allá del lado contrario del libro, para que un deslizamiento normal no lo cruce al entrar.
export const TP_FRENTE_TICKS = 8;
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
// Stop y objetivo solo si quedan del lado correcto de la entrada Y del precio vivo.
// Un objetivo de pocos puntos calculado con el cierre de la vela puede quedar ya cruzado
// y la orden de salida se llena en el mismo segundo que la entrada.
export function bracketsSeguros(side, entry, price, slPts, tpPts) {
  const s = side === 'short' || side === -1 ? -1 : 1;
  const px = price == null || !Number.isFinite(Number(price)) ? Number(entry) : Number(price);
  const en = Number(entry);
  if (!Number.isFinite(en)) return { sl: null, tp: null };
  let sl = roundTick(en - s * slPts), tp = roundTick(en + s * tpPts);
  if (s === 1) {
    if (!(sl < px && sl < en)) sl = null;
    if (!(tp > px && tp > en)) tp = null;
  } else {
    if (!(sl > px && sl > en)) sl = null;
    if (!(tp < px && tp < en)) tp = null;
  }
  return { sl, tp };
}
// Al confirmar el fill: si el precio ya alcanzó un escalón, el stop nace en ese nivel
// (el más alto que aún queda del lado bueno del precio vivo) y la gestión sigue desde el siguiente.
// Si el precio ya pasó el objetivo, la estrategia termina ahí: no se deja el trade sin objetivo.
export function planAlAbrir({ side, entry, price, steps, slPts, tpPts, usdPerPoint }) {
  const s = side === 'short' || side === -1 ? -1 : 1;
  const en = Number(entry);
  const px = Number.isFinite(Number(price)) ? Number(price) : en;
  if (!Number.isFinite(en)) return { sl: null, tp: null, tpPlace: null, tpReached: false, stepIndex: null, nextStep: 0, locked: false, pnl: null };
  const tp = roundTick(en + s * tpPts);
  const pnl = Number(usdPerPoint) > 0 ? Math.round((px - en) * s * Number(usdPerPoint) * 100) / 100 : null;
  const tpReached = Number.isFinite(tp) && (s === 1 ? px >= tp - 1e-9 : px <= tp + 1e-9);
  const list = Array.isArray(steps) ? steps : [];
  const hol = HOLGURA_TICKS * TICK;
  const safe = lock => s === 1 ? lock <= px - hol + 1e-9 : lock >= px + hol - 1e-9;
  let chosen = null;
  if (pnl != null && !tpReached) {
    for (let k = list.length - 1; k >= 0; k--) {
      if (pnl + 1e-9 < Number(list[k].triggerUsd)) continue;
      const lock = roundTick(s === 1 ? en + Number(list[k].lockPts) : en - Number(list[k].lockPts));
      if (!safe(lock)) continue;
      chosen = { index: k, step: list[k], sl: lock };
      break;
    }
  }
  let sl = chosen ? chosen.sl : roundTick(en - s * slPts);
  if (!safe(sl)) sl = null;
  const tpPlace = !tpReached && (s === 1 ? tp > px : tp < px) ? tp : null;
  return {
    pnl, tp, tpReached, sl: tpReached ? null : sl, tpPlace,
    stepIndex: chosen ? chosen.index : null,
    step: chosen ? chosen.step : null,
    nextStep: chosen ? chosen.index + 1 : 0,
    locked: !!(chosen && chosen.index + 1 >= list.length),
  };
}
// Precios del bracket que viaja CON la orden a mercado. Referencia: ask si es compra, bid si es venta.
export function bracketEntrada({ side, bid, ask, slPts, tpPts }) {
  const s = side === 'short' || side === -1 ? -1 : 1;
  const b = Number(bid), a = Number(ask);
  if (!Number.isFinite(b) || !Number.isFinite(a) || !(a >= b) || !(b > 0)) return { ok: false, error: 'sin bid/ask' };
  const hol = HOLGURA_TICKS * TICK, frente = TP_FRENTE_TICKS * TICK;
  if (s === 1) {
    const sl = roundTick(a - slPts);
    if (!(sl <= b - hol + 1e-9)) return { ok: false, error: 'el stop quedaría del lado malo del bid' };
    const tp = roundTick(Math.max(a + tpPts, b + frente, a + hol));
    if (!(tp >= a + hol - 1e-9)) return { ok: false, error: 'el objetivo quedaría del lado malo del ask' };
    return { ok: true, sl, tp, ref: a };
  }
  const sl = roundTick(b + slPts);
  if (!(sl >= a + hol - 1e-9)) return { ok: false, error: 'el stop quedaría del lado malo del ask' };
  const tp = roundTick(Math.min(b - tpPts, a - frente, b - hol));
  if (!(tp <= b - hol + 1e-9)) return { ok: false, error: 'el objetivo quedaría del lado malo del bid' };
  return { ok: true, sl, tp, ref: b };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

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
 var c=l.filter(function(o){return o&&(o.type===3||o.type===4)&&(o.status===6||o.status===4)&&o.parentId!=null&&(!pos||(tvRoot(o.symbol)===tvRoot(pos.symbol)&&o.side===-pos.side))});c.sort(function(a,b){return sc(b)-sc(a)});return c[0]||null}
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
  place: o => `(async function(){${PAGE}var ab=tvBroker(tvTrading());if(!tvBrokerId(ab))return {error:'No active broker'};var r=await ab.placeOrder(${JSON.stringify(o)});return {ok:r!==false,orderId:r&&(r.orderId||r.id)||null}})()`,
  // Llamada 1, solo lectura. Se puede reintentar: no contiene placeOrder.
  // Cuenta activa, lista, posición del símbolo, bid/ask/last y el contrato del chart. El guardado no se manda si no coincide.
  preparar: (root, front) => `(async function(){${PAGE}/*LECTURA_APERTURA*/
    var t=tvTrading(),ab=tvBroker(t);if(!tvBrokerId(ab))return {ok:false,error:'No active broker'};
    var R=${JSON.stringify(root)},FRENTE_GUARDADO=${JSON.stringify(front || null)};
    var cur;try{cur=String(tvWv(ab.currentAccount()))}catch(e){return {ok:false,error:'no pude leer la cuenta. No se envía.'}}
    var listaC;try{listaC=await ab.accountsMetainfo()||[]}catch(e){return {ok:false,error:'no pude leer la lista de cuentas. No se envía.'}}
    var accounts=listaC.map(function(a){return {id:String(a.id),name:a.name}});
    var pos;try{pos=await tvPos(ab,R)}catch(e){return {ok:false,error:'no pude leer la posición. No se cierra nada y no se envía la orden'}}
    if(tvPos.lastErr)return {ok:false,error:'no pude leer la posición. No se cierra nada y no se envía la orden',detail:tvPos.lastErr};
    if(pos)return {ok:false,error:'ya hay posicion',side:pos.side===1?'long':'short',qty:Math.abs(Number(pos.qty))};
    var ms,q=null,fr=null,symChart=null,last=null;
    try{ms=window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries();symChart=ms.symbol();q=ms.quotes&&ms.quotes();var si=ms.symbolInfo&&ms.symbolInfo();fr=si&&si.front_contract||null;last=q&&q.last!=null?Number(q.last):tvChartPx()}catch(e){return {ok:false,error:'sin grafico'}}
    if(tvRoot(symChart)!==R)return {ok:false,error:'el chart está en '+symChart};
    var bid=q&&Number(q.bid),ask=q&&Number(q.ask);
    if(!isFinite(bid)||!isFinite(ask)||ask<bid||bid<=0)return {ok:false,error:'sin bid/ask'};
    var idBroker=tvBrokerId(ab),base=symChart.indexOf(':')>=0?symChart.replace(/[^:]*$/,''):'';
    var frente=fr||null,rollover=!!(FRENTE_GUARDADO&&frente&&String(FRENTE_GUARDADO)!==String(frente));
    var dt=frente?base+String(frente).replace(/^.*:/,''):null,cands=[symChart];
    if(dt&&/\\d!$/.test(symChart))cands=String(idBroker).toLowerCase()==='paper'?[symChart,dt]:[dt,symChart];
    var sym=null;if(typeof ab.symbolInfo==='function'){for(var i=0;i<cands.length&&!sym;i++){try{var inf=await Promise.race([ab.symbolInfo(cands[i]),new Promise(function(z){setTimeout(function(){z(null)},5000)})]);if(inf)sym=cands[i]}catch(e){}}}
    else sym=symChart;
    if(!sym)return {ok:false,error:'sin simbolo',front:fr||null,rollover:rollover};
    return {ok:true,accountId:cur,accounts:accounts,bid:bid,ask:ask,last:last,front:fr||null,symbol:sym,chart:symChart,rollover:rollover}})()`,
  // Llamada 2, la orden. No se reintenta. Relee cuenta, plano y contrato; si algo cambió, no envía.
  // El bracket se calcula aquí con el bid/ask de este momento y viaja en la misma placeOrder.
  enviar: p => `(async function(){${PAGE}/*ENVIO_APERTURA*/
    var t=tvTrading(),ab=tvBroker(t);if(!tvBrokerId(ab))return {sent:false,error:'No active broker'};
    var R=${JSON.stringify(p.root)},SIDE=${Number(p.side)},QTY=${Number(p.qty)},SLP=${Number(p.slPts)},TPP=${Number(p.tpPts)};
    var CUENTA=${JSON.stringify(String(p.accountId || ''))},SYM=${JSON.stringify(p.symbol || '')},ESP=${JSON.stringify(p.front || null)};
    var HOL=${HOLGURA_TICKS},F=${TP_FRENTE_TICKS},TICK=0.25,rnd=function(x){return Math.round(x/TICK)*TICK};
    var cur;try{cur=String(tvWv(ab.currentAccount()))}catch(e){return {sent:false,error:'no pude releer la cuenta. No se envía.'}}
    if(cur!==CUENTA)return {sent:false,error:'la cuenta cambió: era '+CUENTA+' y ahora es '+cur+'. No se envía.'};
    var pos;try{pos=await tvPos(ab,R)}catch(e){return {sent:false,error:'no pude releer la posición. No se envía.'}}
    if(tvPos.lastErr)return {sent:false,error:'no pude releer la posición. No se envía.',detail:tvPos.lastErr};
    if(pos)return {sent:false,error:'ya hay posicion',side:pos.side===1?'long':'short'};
    var fr=null,symChart=null,q=null;
    try{var ms=window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries();symChart=ms.symbol();q=ms.quotes&&ms.quotes();var si=ms.symbolInfo&&ms.symbolInfo();fr=si&&si.front_contract||null}catch(e){return {sent:false,error:'sin grafico. No se envía.'}}
    if(tvRoot(symChart)!==R)return {sent:false,error:'el chart está en '+symChart+'. No se envía.'};
    if(String(fr||'')!==String(ESP||''))return {sent:false,error:'el contrato cambió: era '+(ESP||'(ninguno)')+' y ahora es '+(fr||'(ninguno)')+'. No se envía.'};
    var bid=q&&Number(q.bid),ask=q&&Number(q.ask);
    if(!isFinite(bid)||!isFinite(ask)||ask<bid||bid<=0)return {sent:false,error:'sin bid/ask. No se envía.'};
    var sl,tp;if(SIDE===1){sl=rnd(ask-SLP);tp=rnd(Math.max(ask+TPP,bid+F*TICK,ask+HOL*TICK));if(!(sl<=bid-HOL*TICK+1e-9))return {sent:false,error:'el stop quedaría del lado malo del bid',bid:bid,ask:ask};if(!(tp>=ask+HOL*TICK-1e-9))return {sent:false,error:'el objetivo quedaría del lado malo del ask',bid:bid,ask:ask}}
    else{sl=rnd(bid+SLP);tp=rnd(Math.min(bid-TPP,ask-F*TICK,bid-HOL*TICK));if(!(sl>=ask+HOL*TICK-1e-9))return {sent:false,error:'el stop quedaría del lado malo del ask'};if(!(tp<=bid-HOL*TICK+1e-9))return {sent:false,error:'el objetivo quedaría del lado malo del bid'}}
    var r;try{r=await ab.placeOrder({symbol:SYM,side:SIDE,type:2,qty:QTY,stopLoss:sl,takeProfit:tp})}catch(e){return {sent:true,dudoso:true,error:String(e&&e.message||e),sl:sl,tp:tp,bid:bid,ask:ask,front:fr||null}}
    if(r===false)return {sent:false,error:'el bróker no aceptó la orden',sl:sl,tp:tp,bid:bid,ask:ask,front:fr||null};
    return {sent:true,orderId:r&&(r.orderId||r.id)?String(r.orderId||r.id):null,sl:sl,tp:tp,bid:bid,ask:ask,symbol:SYM,front:fr||null}})()`,
  // Posición de ESTE símbolo y solo las órdenes cuyo parentId es esta posición o esta orden de entrada.
  estado: (root, orderId, posId) => `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t),R=${JSON.stringify(root)},OID=${JSON.stringify(orderId || '')},PID=${JSON.stringify(posId || '')};
    var pos=null,err=null;try{pos=await tvPos(ab,R)}catch(e){err=String(e&&e.message||e)}
    if(tvPos.lastErr)err=tvPos.lastErr;
    var kids=[];try{kids=await tvAllOrders(t,ab)}catch(e){}
    var liga=function(o){if(!o)return false;var p=o.parentId!=null?String(o.parentId):'';return (OID&&(String(o.id)===OID||p===OID))||(PID&&p===PID)||(pos&&p===String(pos.id))};
    var map=function(o){return {id:String(o.id),parentId:o.parentId!=null?String(o.parentId):null,type:o.type,side:o.side,qty:Math.abs(Number(o.qty)||0),status:o.status,stopPrice:o.stopPrice!=null?o.stopPrice:null,limitPrice:o.limitPrice!=null?o.limitPrice:null}};
    var ordenes=kids.filter(liga).map(map);
    var h=[];try{h=(await ab.ordersHistory())||[]}catch(e){}
    var ex=[];try{if(typeof ab.allExecutions==='function')ex=(await ab.allExecutions())||[]}catch(e){}
    var hist=h.filter(function(o){return o&&(String(o.id)===OID||(o.parentId!=null&&String(o.parentId)===OID))}).map(map);
    var mercado=h.filter(function(o){return o&&Number(o.type)===2&&tvRoot(o.symbol)===R}).map(map);
    var execs=ex.filter(function(x){return x&&tvRoot(x.symbol)===R&&(String(x.orderId||x.id)===OID||(x.parentId!=null&&String(x.parentId)===OID)||hist.some(function(o){return String(o.id)===String(x.orderId||'')}))}).map(function(x){return {id:String(x.id),orderId:x.orderId!=null?String(x.orderId):null,side:+x.side,qty:Math.abs(+x.qty),price:+x.price,time:+x.time}});
    return {err:err,pos:pos?{id:String(pos.id),side:pos.side===1?'long':'short',qty:Math.abs(Number(pos.qty)||0),entry:pos.avgPrice,price:pos.lastPrice!=null?pos.lastPrice:null}:null,ordenes:ordenes,hist:hist,execs:execs,mercado:mercado}})()`,
  cerrarQty: (root, side, qty) => `(async function(){${PAGE}var ab=tvBroker(tvTrading());if(!tvBrokerId(ab))return {error:'No active broker'};
    var R=${JSON.stringify(root)},SIDE=${Number(side)},QTY=${Number(qty)};
    var pos;try{pos=await tvPos(ab,R)}catch(e){return {error:'lectura'}}
    if(!pos)return {error:'sin posicion',flat:true};
    var q=Math.min(QTY,Math.abs(Number(pos.qty)||0));if(!(q>0))return {error:'cantidad'};
    var r;try{r=await ab.placeOrder({symbol:pos.symbol,side:-SIDE,type:2,qty:q})}catch(e){return {error:String(e&&e.message||e),qty:q}}
    if(r===false)return {error:'no aceptado',qty:q};
    return {ok:true,orderId:r&&(r.orderId||r.id)?String(r.orderId||r.id):null,qty:q}})()`,
  // Espera el fill. Una posición que nace y muere en la ventana, o una lectura que falla, no es "no se llenó".
  // status 2 = llena, 5 = rechazada, 6 = trabajando. No cierra nada.
  fill: (root, side, qty, tradeSymbol, waitMs = 6000) => `(async function(){${PAGE}var ab=tvBroker(tvTrading()),R=${JSON.stringify(root)},SIDE=${Number(side)},QTY=${Number(qty)},SYM=${JSON.stringify(tradeSymbol || '')},WAIT=${Number(waitMs) > 0 ? Number(waitMs) : 6000};
    var T=performance.now(),fallo=false,limpio=false;
    var reciente=function(tm){var n=Number(tm);if(!isFinite(n))return false;if(n<1e12)n*=1000;var d=Date.now()-n;return d<30000&&d>-5000};
    var leer=async function(){var p=await tvPos(ab,R);if(tvPos.lastErr)fallo=true;else limpio=true;return p};
    while(performance.now()-T<WAIT){var p=await leer();if(p)return {filled:true,open:true,ms:Math.round(performance.now()-T),entry:p.avgPrice};await new Promise(function(z){setTimeout(z,150)})}
    var p2=await leer();if(p2)return {filled:true,open:true,ms:Math.round(performance.now()-T),entry:p2.avgPrice,via:'relectura'};
    var h=[];try{h=await ab.ordersHistory()}catch(e){fallo=true}
    var mismo=function(x){return x&&Number(x.type)===2&&Number(x.side)===SIDE&&Number(x.qty)===QTY&&tvRoot(x.symbol)===R};
    var o=(h||[]).filter(mismo).pop();
    var ex=[];try{if(typeof ab.allExecutions==='function')ex=(await ab.allExecutions())||[]}catch(e){fallo=true}
    if(!ex.length&&SYM&&typeof ab.executions==='function'){try{ex=(await ab.executions(SYM))||[]}catch(e){fallo=true}}
    var hits=(ex||[]).filter(function(x){return x&&Number(x.side)===SIDE&&Number(x.qty)===QTY&&tvRoot(x.symbol)===R&&reciente(x.time)});
    if(o&&Number(o.status)===5)return {filled:false,status:5,message:o.message?(o.message.text||String(o.message)):null};
    if((o&&Number(o.status)===2)||hits.length){var p3=await leer();if(p3)return {filled:true,open:true,ms:Math.round(performance.now()-T),entry:p3.avgPrice,via:'ejecucion'};if(tvPos.lastErr)return {filled:false,uncertain:true,sawFill:true,status:o?Number(o.status):2};return {filled:true,open:false,alreadyFlat:true,status:o?Number(o.status):2}}
    if(fallo||!limpio)return {filled:false,uncertain:true,status:o?Number(o.status):null};
    return {filled:false,status:o?Number(o.status):null,message:o&&o.message?(o.message.text||String(o.message)):null}})()`,
  // Precios ya decididos (stop del escalón alcanzado, u objetivo). Null = no armar esa pata. Nunca cierra.
  adopt: (root, slPrice, tpPrice) => `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t),R=${JSON.stringify(root)};
    var p=await tvPos(ab,R);if(!p)return {error:'sin posicion'};
    var s=p.side===1?1:-1,entry=Number(p.avgPrice),px=p.lastPrice!=null?Number(p.lastPrice):tvChartPx();if(!isFinite(px))px=entry;
    var sl=${slPrice == null ? 'null' : Number(slPrice)},tp=${tpPrice == null ? 'null' : Number(tpPrice)};
    if(s===1){if(!(sl!=null&&sl<px))sl=null;if(!(tp!=null&&tp>px))tp=null}else{if(!(sl!=null&&sl>px))sl=null;if(!(tp!=null&&tp<px))tp=null}
    if(sl==null&&tp==null)return {ok:false,error:'el precio ya pasó el stop y el objetivo',entry:entry,price:px};
    var b={};if(sl!=null)b.stopLoss=sl;if(tp!=null)b.takeProfit=tp;
    var noPB=tvNoPosBrackets(ab),via=null,err=null;
    if(!noPB&&typeof ab.editPositionBrackets==='function'){try{var r1=await ab.editPositionBrackets(String(p.id),b);if(r1!==false)via='editPositionBrackets';else err='edit false'}catch(e){err=String(e&&e.message||e)}}
    var kids=[];try{kids=await tvAllOrders(t,ab)}catch(e){}
    var has=function(tp){return kids.some(function(o){return o&&o.type===tp&&(o.status===6||o.status===4)&&o.side===-s&&tvRoot(o.symbol)===R})};
    if(sl!=null&&!has(3)&&!has(4))err=(err?err+'; ':'')+'sin stop ligado: no se crea una orden suelta';
    if(tp!=null&&!has(1))err=(err?err+'; ':'')+'sin objetivo ligado: no se crea una orden suelta';
    return {ok:!!via&&(sl==null||has(3)||has(4))&&(tp==null||has(1)),via:via,sl:sl,tp:tp,entry:entry,error:err}})()`,
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
    var findTp=async function(p2){var l=[];try{l=(await tvAllOrders(t,ab))||[]}catch(e){}return l.find(function(o){return o&&o.type===1&&(o.status===6||o.status===4)&&o.parentId!=null&&o.side===-p2.side&&tvRoot(o.symbol)===tvRoot(p2.symbol)})};
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
  try{if(typeof MutationObserver==='function'&&document.body){var mo=new MutationObserver(function(){try{document.querySelectorAll('[class*=accountSummaryField]').forEach(function(e){var x=String(e.innerText||'').split('\\n');if(x.length>1)send('b:dom.'+x[0],x[1])})}catch(e){}});mo.observe(document.body,{subtree:true,childList:true,characterData:true});src.push('b:dom');U.push(function(){mo.disconnect()})}}catch(e){}
  var last=null,lb=null,la=null;var iv=setInterval(function(){var c=tvChartPx();if(c!=null&&c!==last){last=c;send('bar',c)}try{var ms=window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries(),q=ms.quotes&&ms.quotes();if(q){if(q.bid!=null&&q.bid!==lb){lb=q.bid;send('q:bid',q.bid)}if(q.ask!=null&&q.ask!==la){la=q.ask;send('q:ask',q.ask)}}}catch(e){}},50);src.push('bar');U.push(function(){clearInterval(iv)});
  window.__colchonTickU=function(){U.forEach(function(u){try{u()}catch(e){}});window.__colchonTickU=null};return {ok:true,fuentes:src}})()`;
// escrituras: se evalúan UNA sola vez (nunca se reintentan)
export const WRITE = /placeOrder|modifyOrder|editPositionBrackets|closePosition|cancelOrder|createEditOrderContext|setCurrentAccount/;
// Un script con placeOrder (o cualquier escritura) no se reintenta jamás: ni por desconexión ni por tiempo agotado.
export function reintentaEvaluate(expr, err) {
  if (WRITE.test(String(expr || ''))) return false;
  return /disconnect|closed|WebSocket|ECONN|not open/i.test(String(err && err.message || err));
}
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
  const evaluate = async expr => { try { return await once(expr); } catch (e) { if (!reintentaEvaluate(expr, e)) throw e; client = null; return once(expr); } };
  const ticker = { async start(root, fn) { onTick = fn; if (!client) await connect(); try { await client.Runtime.addBinding({ name: '__colchonTick' }); } catch {} return once(TICK_JS(root)); },
    async stop() { onTick = null; try { if (client) await once('(function(){if(window.__colchonTickU)window.__colchonTickU();return true})()'); } catch {} } };
  return { evaluate, ticker, close: () => client && client.close() };
}

export function apiDriver(evaluate, ui = null, ticker = null, o = {}) {
  const last = { pos: null, open: null }; const rereadMs = o.rereadMs ?? 800, uiWaitMs = o.uiWaitMs ?? 3000, apiWaitMs = o.apiWaitMs ?? 3000;
  let frenteCache = { symbol: null, front: null, at: 0 };
  const estado = async (symbol, orderId, posId) => { try { return await evaluate(js.estado(symbol, orderId || '', posId || '')); } catch (e) { return { err: String(e.message || e), pos: null, ordenes: [], hist: [], execs: [] }; } };
  const stopLigado = (st, side) => {
    const hol = HOLGURA_TICKS * TICK, px = st && st.pos && st.pos.price != null ? st.pos.price : null;
    const stops = ((st && st.ordenes) || []).filter(x => x.type === 3 && x.stopPrice != null);
    const bueno = px == null ? [] : stops.filter(x => side === 'long' ? x.stopPrice <= px - hol + 1e-9 : x.stopPrice >= px + hol - 1e-9);
    return { stops, ok: stops.length === 1 && bueno.length === 1, doble: stops.length > 1 };
  };
  return {
    kind: 'api', ticker, lastOpen: () => last.open || null,
    async working(symbol) { const r = await evaluate(js.working(symbol)); if (!r || r.error) throw new Error((r && r.error) || 'working'); return r.orders; },
    async accounts() { const r = await evaluate(js.accounts); if (r.error) throw new Error(r.error); return r; },
    async switchAccount(id, name) { return evaluate(js.switchAccount(id, name)); },
    async accountId() { return evaluate(js.accountId); },
    async account() { const a = await evaluate(js.account); return { name: a.name, broker: [a.broker, a.brokerId].filter(Boolean).join(' '), api: a.api }; },
    async position(symbol) { const p = await evaluate(js.position(symbol)); if (p && p.error) throw new Error(p.error); if (p && p.transient) return p; last.pos = p; return p; },
    async stop() { return last.pos ? last.pos.stop : null; },
    async lastPrice() { try { const r = await evaluate(js.lastPrice); return r && typeof r.price === 'number' ? r.price : null; } catch { return null; } },
    async openBracket({ side, symbol, qty, slPts, tpPts, steps }) {
      last.open = null;
      const s = side === 'long' ? 1 : -1;
      const front = frenteCache.symbol === symbol && Date.now() - frenteCache.at < 5 * 60 * 1000 ? frenteCache.front : null;
      let prep = null, prepErr = null;
      for (let intento = 0; intento < 2 && !prep; intento++) {
        try { prep = await evaluate(js.preparar(symbol, front)); }
        catch (e) { prepErr = e; prep = null; }
      }
      if (!prep) return 'error: no pude leer la cuenta ni el precio. No se envía.' + (prepErr ? ' ' + prepErr.message : '');
      if (prep.ok === false) return 'error: ' + (prep.error || 'lectura');
      if (!prep.accountId || !prep.symbol) return 'error: la lectura no trajo cuenta o contrato. No se envía.';
      if (prep.front) frenteCache = { symbol, front: prep.front, at: Date.now() };
      let res;
      try { res = await evaluate(js.enviar({ root: symbol, side: s, qty, slPts, tpPts, accountId: prep.accountId, symbol: prep.symbol, front: prep.front })); }
      catch (e) { res = { dudoso: true, corte: true, error: String(e.message || e) }; }
      if (res && res.front) frenteCache = { symbol, front: res.front, at: Date.now() };
      if (res && res.sent === false) return 'error: ' + (res.error || 'no enviada');
      let orderId = res && res.orderId ? String(res.orderId) : '';
      const enviada = !!(res && (res.sent || res.corte));
      const dudoso = !!(res && (res.dudoso || res.corte)) || !orderId;
      const dudaMs = Number(process.env.COLCHON_DUDA_MS) > 0 ? Number(process.env.COLCHON_DUDA_MS) : 45000;
      const espera = dudoso ? dudaMs : (Number(process.env.COLCHON_FILL_MS) > 0 ? Number(process.env.COLCHON_FILL_MS) : 6000);
      const paso = dudoso ? 400 : 150;
      const t0 = Date.now();
      let st = null, vio = false;
        const salidaDeEsta = x => {
        const hist = (x && x.hist) || [], execs = (x && x.execs) || [];
        const hijos = hist.filter(o => orderId && String(o.parentId) === orderId);
        const ids = new Set(hijos.map(o => String(o.id)));
        return execs.find(e => e.side === -s && e.orderId && ids.has(String(e.orderId))) || null;
      };
      while (Date.now() - t0 < espera) {
        st = await estado(symbol, orderId, null);
        if (res && res.corte && !orderId && Array.isArray(st.mercado)) {
          const cands = st.mercado.filter(o => Number(o.status) === 2 && Number(o.side) === s);
          if (cands.length === 1) orderId = String(cands[0].id);
        }
        const q = st.pos ? st.pos.qty : 0;
        if (st.pos && st.pos.side !== side) {
          last.open = { dudoso: true, pedirSaldo: true, alerta: 'Apareció una posición del otro lado. No se toca. Revisa TradingView.' };
          return 'error: ' + last.open.alerta;
        }
        if (q >= qty) { vio = true; break; }
        if (q > 0 && Date.now() - t0 >= 3000) { vio = true; break; }
        const rechazada = orderId && (st.hist || []).some(o => String(o.id) === orderId && Number(o.status) === 5);
        if (rechazada && !q) return 'error: la orden no se llenó (RECHAZADA por TradingView)';
        if (!q && orderId && salidaDeEsta(st) && Date.now() - t0 >= 2500) {
          last.open = { yaPlana: true, orderId, pedirSaldo: true };
          return 'error: la orden sí se llenó y ya no hay posición (salida de esta orden). No se envió ninguna orden de cierre.';
        }
        await sleep(paso);
      }
      if (!vio && enviada) {
        const extra = Date.now() + 2500;
        let salida = null;
        while (Date.now() < extra) {
          st = await estado(symbol, orderId, null);
          if (st.pos && st.pos.side === side && st.pos.qty > 0) { vio = true; break; }
          if (!st.pos) salida = salidaDeEsta(st) || salida;
          await sleep(200);
        }
        if (!vio && salida && orderId) {
          last.open = { yaPlana: true, orderId, pedirSaldo: true };
          return 'error: la orden sí se llenó y ya no hay posición (salida de esta orden). No se envió ninguna orden de cierre.';
        }
      }
      if (!vio) {
        const alerta = (res && res.corte)
          ? 'La llamada se cortó. No se reenvía la orden. No apareció posición de esta orden. Revisa TradingView.'
          : 'No pude confirmar el fill. Miré ' + Math.round((Date.now() - t0) / 1000) + ' s y no apareció posición de esta orden. No se cerró nada. Revisa TradingView.';
        last.open = { dudoso: true, pedirSaldo: true, alerta, orderId: orderId || null };
        return 'error: ' + alerta;
      }
      const pos = st.pos;
      const plan = (pos.price != null) ? planAlAbrir({ side, entry: pos.entry, price: pos.price, steps, slPts, tpPts, usdPerPoint: (PT_USD[symbol] || 0) * pos.qty }) : null;
      let tpFallo = null;
      if (plan && plan.tpReached) {
        let cr = null;
        try { cr = await evaluate(js.cerrarQty(symbol, s, Math.min(pos.qty, qty))); } catch (e) { cr = { error: String(e.message || e) }; }
        let salida = null;
        if (cr && cr.orderId) {
          const fin = Date.now() + 2000;
          while (Date.now() < fin && salida == null) {
            const e3 = await estado(symbol, cr.orderId, pos.id);
            const ex = (e3.execs || []).find(x => String(x.orderId) === String(cr.orderId));
            if (ex && Number.isFinite(ex.price)) salida = ex.price; else await sleep(150);
          }
        }
        const pnl = salida != null && pos.entry != null ? Math.round((salida - pos.entry) * s * (PT_USD[symbol] || 0) * (cr && cr.qty || 0) * 100) / 100 : null;
        const okCierre = !!(cr && cr.ok && salida != null);
        if (okCierre) {
          last.open = { tpHit: true, ref: pos.entry, tp: plan.tp, price: pos.price, salida, salidaReal: pnl, qty: cr && cr.qty, orderId, pedirSaldo: true, alerta: null };
          return `ok market ${cr.qty} @${pos.entry} objetivo ya pasado: salida ${salida}`;
        }
        tpFallo = 'El objetivo ya estaba pasado y el cierre de ESTA cantidad no se confirmó. El stop de la orden sigue. No se tocó el resto.';
      }
      let visto = { ok: false, stops: [], doble: false };
      const hasta = Date.now() + 1000;
      do {
        const e2 = await estado(symbol, orderId, pos.id);
        visto = stopLigado(e2.pos ? e2 : { ...e2, pos }, side);
        if (visto.ok || visto.doble) break;
        if (Date.now() >= hasta) break;
        await sleep(150);
      } while (Date.now() < hasta);
      const parcial = pos.qty < qty;
      const baseAlerta = visto.doble
        ? 'HAY MÁS DE UN STOP ligado a esta posición. No se manda otro. Revisa TradingView.'
        : !visto.ok
          ? 'NO VEO EL STOP de esta operación. Se sigue intentando. No se toca ninguna otra orden.'
          : parcial ? `Llenado parcial: hay ${pos.qty} de ${qty}. El bracket de la orden sigue. No se manda otra orden.` : (dudoso ? 'La orden tardó en confirmarse. La posición se adoptó con el bracket que ya traía.' : null);
      const alerta = ((res && res.corte) ? 'La llamada se cortó. No se reenvía la orden. Se adopta la posición que apareció. ' : '') + (tpFallo ? tpFallo + ' ' : '') + (baseAlerta || '');
      last.open = {
        ref: pos.entry, sl: plan ? plan.sl : (res && res.sl), tp: plan ? plan.tpPlace : (res && res.tp),
        orderId: orderId || null, posId: pos.id, slObjetivo: plan ? plan.sl : (res && res.sl), slOk: visto.ok && !visto.doble,
        alerta, step: plan && plan.step ? plan.nextStep : 0, locked: !!(plan && plan.step && plan.locked),
        paso: plan && plan.step ? { paso: plan.step.n, disparoUSD: plan.step.triggerUsd, protegeUSD: plan.step.lockUsd, precio: plan.sl, enSeg: 0, confirmado: false, saltados: plan.stepIndex } : null,
        parcial, qtyVista: pos.qty, dudoso, pedirSaldo: dudoso || parcial,
      };
      const nota = plan && plan.step ? ` · paso ${plan.step.n} ya alcanzado: el ajuste mueve el stop a ${plan.sl}` : '';
      return `ok market ${pos.qty} @${pos.entry} SL ${res && res.sl != null ? res.sl : '—'} TP ${res && res.tp != null ? res.tp : '—'}${nota}${alerta ? ' · ' + alerta : ''}`;
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
    const st = { locked: !!S.locked, fails: 0, uiTried: false, step: S.step || 0 }; const driver = await D(); const real = S.mode === 'real';
    const FZ = fuenteCfg(opts.fuenteFile, opts.fuente), SRC = {}, ticks = {}, leadN = {}; let lead = null; S.fuenteModo = FZ.modo; S.fuenteLider = null; S.fuentes = {};
    const pv = PT_USD[c.symbol] * c.qty, sd = c.side === 'long' ? 1 : -1, wait = FZ.modo === 'grafica' ? poll : Math.min(poll, FZ.pollMs);
    const pnlAt = px => S.entry == null || px == null ? null : Math.round((px - S.entry) * sd * pv * 100) / 100;
    const setSrc = (k, v, t = Date.now()) => { if (typeof v !== 'number') return; const x = SRC[k] || (SRC[k] = { n: 0, changes: 0, gaps: 0, gapSum: 0 }); x.readAt = t; x.n++;
      if (x.v !== v) { if (x.changedAt) { x.gapMs = t - x.changedAt; x.gaps++; x.gapSum += x.gapMs; } x.v = v; x.changedAt = t; x.changes++; if (k !== 'broker-lectura' && k !== 'grafica' || x.changes % 10 === 1) ev('fuente_pl', { fuente: k, v, gapMs: x.gapMs ?? null }); } };
    if (driver.ticker && !opts.noTicks) { try { const tr = await driver.ticker.start(c.symbol, m => { ticks[m.k] = (ticks[m.k] || 0) + 1; const now = Date.now();
        if (/^b:position/.test(m.k)) setSrc('broker-evento', m.v, now); else if (m.k === 'bar') { S.chartPx = m.v; setSrc('grafica', pnlAt(m.v), now); }
        else if (m.k === 'q:bid' && sd === 1) setSrc('bidask', pnlAt(m.v), now); else if (m.k === 'q:ask' && sd === -1) setSrc('bidask', pnlAt(m.v), now); });
      ev('ticks_inicio', { fuentes: tr && tr.fuentes }); } catch (e) { ev('ticks_inicio', { error: String(e.message || e) }); } }
    let lastLect = 0;
    try {
      for (let i = 0; !stopReq; i++) {
        if (paper && S.accountId && driver.accountId) { const cur = await driver.accountId(); if (cur && cur !== S.accountId) { S.error = `La cuenta activa cambió (${cur}) en mitad de la prueba: se deja de vigilar SIN cerrar nada. Revisa la cuenta ${S.account && S.account.name} en TradingView.`; log('ERROR', S.error); break; } }
        const tRead = Date.now(); let pos = await driver.position(c.symbol); const sl0 = await driver.stop(); const tSeen = Date.now();
        if (pos && pos.transient) { ev('anomalia', { kind: 'lectura_fallida_transitoria', error: pos.transient }); await sleep(wait); continue; }
        // guarda de flat: 3 lecturas vacías seguidas, ≥1 s desde la primera y sin órdenes hijas SL/TP activas
        if (!pos && S.openAt != null) {
          S.emptyN = (S.emptyN || 0) + 1; S.emptySince = S.emptySince || Date.now();
          let kids = []; try { kids = driver.working ? (await driver.working(c.symbol)).filter(o => { const liga = (S.posId && String(o.parentId) === String(S.posId)) || (S.orderId && String(o.parentId) === String(S.orderId)); return liga && (o.type === 3 || o.type === 1); }) : []; } catch { kids = [{ id: '?' }]; }
          const need = opts.flatConfirm ?? { reads: 3, ms: 1000 };
          if (S.emptyN === 1) ev('flat_contador', { lecturasVacias: S.emptyN, msDesdePrimera: Date.now() - S.emptySince, necesita: need, sltpActivas: kids });
          if (S.emptyN < need.reads || Date.now() - S.emptySince < need.ms || kids.length) {
            if (kids.length && Date.now() - S.emptySince > 30000 && !S.kidsWarned) { S.kidsWarned = true; S.alerta = 'No veo la posición pero siguen activas órdenes SL/TP: revisa TradingView'; log('AVISO', S.alerta); ev('notificacion', { texto: S.alerta }); }
            await sleep(wait); continue; }
          ev('flat_decidido', { lecturasVacias: S.emptyN, msDesdePrimera: Date.now() - S.emptySince });
        } else if (pos && S.emptyN) { ev('anomalia', { kind: 'lectura_vacia_transitoria', lecturas: S.emptyN }); log(`lectura vacía transitoria (${S.emptyN}): la posición sigue`); S.emptyN = 0; S.emptySince = null; }
        if (pos && pos.entry != null && paper && !S.ajusteHecho && S.ref != null && pos.price != null) {
          S.ajusteHecho = true;
          const plan = planAlAbrir({ side: c.side, entry: pos.entry, price: pos.price, steps: S.steps, slPts: S.slPts, tpPts: S.tpPts, usdPerPoint: pv });
          const slN = plan.sl, tpN = plan.tpPlace, slA = sl0, tpA = S.tpRef;
          const rec = { ref: S.ref, fill: pos.entry, slAntes: slA, slNuevo: slN, tpAntes: tpA, tpNuevo: tpN, stopId: pos.stopId ?? null, paso: plan.step ? plan.step.n : null };
          if (plan.step) { S.step = plan.nextStep; st.step = plan.nextStep; S.locked = plan.locked; if (slN != null) S.lockPrice = slN; S.slObjetivo = slN; }
          if ((slA === slN || slN == null) && (tpA === tpN || tpN == null)) { rec.ok = slN != null; rec.nada = true; }
          else { const t0 = Date.now();
            rec.sl = slN == null || slA === slN ? { ok: slN != null, ya: true } : await driver.modifyStop(slN, c.symbol);
            rec.tp = tpN == null ? { ok: true, ya: true } : (driver.modifyTp ? await driver.modifyTp(tpN, c.symbol) : { ok: false, err: 'sin modifyTp' });
            rec.ok = !!(rec.sl && rec.sl.ok && rec.tp && rec.tp.ok); rec.seg = Math.round((Date.now() - t0) / 100) / 10;
            await sleep(1000);
            let dobles = [];
            try { const w = driver.working ? await driver.working(c.symbol) : []; dobles = w.filter(o => o.type === 3 && ((S.posId && String(o.parentId) === String(S.posId)) || (S.orderId && String(o.parentId) === String(S.orderId)))); } catch { dobles = []; }
            if (dobles.length > 1) { rec.doble = true; S.alerta = 'HAY MÁS DE UN STOP ligado a esta posición. No se manda otro. Revisa TradingView.'; ev('notificacion', { texto: S.alerta }); }
          }
          if (tpN != null) S.tpPrice = tpN; S.ajuste = rec; if (rec.sl && rec.sl.ok && slN != null) S.slOk = true;
          ev('ajuste_brackets', rec);
          log(rec.nada ? `Fill ${pos.entry} = referencia: SL/TP ya correctos` : `Ajuste por fill ${pos.entry} (ref ${S.ref}): SL ${slA}→${slN} ${rec.sl && rec.sl.ok ? 'OK' : 'FALLO'} · TP ${tpA}→${tpN} ${rec.tp && rec.tp.ok ? 'OK' : 'FALLO'} (${rec.seg || 0} s)`);
          if (!rec.ok || slN == null) { S.slOk = false; S.alerta = S.alerta || `NO VEO EL STOP tras el ajuste (SL ${slN == null ? 'inseguro' : slN}). Se sigue intentando. No se toca ninguna otra orden.`; ev('notificacion', { texto: S.alerta }); }
          if (!rec.nada) { await sleep(wait); continue; }
        }
        if (pos && S.slOk === false && S.slObjetivo != null && Date.now() - (S.slIntento || 0) > 1000) {
          S.slIntento = Date.now();
          const rsl = await driver.modifyStop(S.slObjetivo, c.symbol);
          if (rsl && rsl.ok) { S.slOk = true; if (S.alerta && /NO VEO EL STOP/.test(S.alerta)) S.alerta = null; }
          else S.alerta = 'NO VEO EL STOP de esta operación. Se sigue intentando. No se toca ninguna otra orden.';
        }
        const sl = sl0;
        if (pos && S.openAt == null) { S.openAt = Date.now(); log('Posición abierta (fill visto)'); }
        if (pos) {
          if (pos.entry != null) S.entry = pos.entry; const now = Date.now();
          setSrc('broker-lectura', pos.brokerPl, now); if (pos.chart && pos.chart.pnl != null) { S.chartPx = pos.chart.price; setSrc('grafica', pnlAt(pos.chart.price) ?? pos.chart.pnl, now); }
          if (now - lastLect >= 1000) { lastLect = now; ev('lectura', { brokerPl: pos.brokerPl ?? null, chartPl: pos.chart ? pos.chart.pnl : null, stop: sl, stopId: pos.stopId ?? null }); }
          const allowK = FZ.modo === 'grafica' ? ['grafica', 'bidask'] : FZ.modo === 'broker' ? ['broker-evento', 'broker-lectura'] : ['broker-evento', 'broker-lectura', 'grafica', 'bidask'];
          const trig = (c.steps[st.step ?? 0] || c.steps[c.steps.length - 1] || { triggerUsd: 100 }).triggerUsd, lim = 2 * Math.max(Math.abs(trig), Math.abs((c.P && c.P.SL_USD) || 0), Math.abs((c.P && c.P.TP_USD) || 0), 1), okK = [];
          for (const k of allowK) { const x = SRC[k]; if (!x || x.v == null || now - x.readAt > FZ.frescoMs) continue; if (!isFinite(x.v) || Math.abs(x.v) > lim) { if (!x.badLogged || x.badLogged !== x.v) { x.badLogged = x.v; ev('anomalia', { kind: 'pnl_imposible', fuente: k, valor: x.v, limiteUSD: lim }); } continue; } okK.push(k); }
          okK.sort((a, b) => (SRC[b].v - SRC[a].v) || (SRC[b].changedAt - SRC[a].changedAt));
          const nl = okK[0] || null; if (nl !== lead) { ev('fuente_lider', { de: lead, a: nl, v: nl ? SRC[nl].v : null }); lead = nl; } if (nl) leadN[nl] = (leadN[nl] || 0) + 1;
          let pnl = nl ? SRC[nl].v : null, price = pos.price;
          if (nl === 'broker-evento' || nl === 'broker-lectura') price = S.entry + pnl / (sd * pv); else if (nl === 'grafica' && S.chartPx != null) price = S.chartPx;
          pos = { ...pos, pnl, price, pnlSrc: nl || 'sin-fuente-fresca' }; S.fuenteLider = pos.pnlSrc;
          S.fuentes = Object.fromEntries(Object.entries(SRC).map(([k, x]) => [k, { v: x.v, edadMs: now - x.readAt }]));
          Object.assign(S, { entry: pos.entry, price: pos.price, pnl: pos.pnl, sl, brokerPl: pos.brokerPl ?? null, chartPl: pos.chart ? pos.chart.pnl : null }); if (typeof sl === 'number' && Number.isFinite(sl)) S.slVisto = sl; if (pos.raw && typeof pos.raw.takeProfit === 'number' && Number.isFinite(pos.raw.takeProfit)) S.tpVisto = pos.raw.takeProfit; if (S.tpPrice == null && pos.entry != null) S.tpPrice = roundTick(pos.entry + (c.side === 'long' ? 1 : -1) * S.tp);
        }
        if (S.lockPending && sl === S.lockTarget) { S.lockPending = false; S.locked = true; S.lockPrice = sl; S.lockAt = S.lockAt || Date.now(); log(`colchón confirmado en ${sl}`); }
        const d = decide(pos, sl, st, c);
        if (d.action === 'flat') { if (paper && S.openAt == null && i < 10) { await sleep(poll); continue; }
          let lp = S.price; try { const q = driver.lastPrice && await driver.lastPrice(); if (q != null) lp = q; } catch {} const up = c.side === 'long'; S.reason = lp == null ? 'flat' : (S.tpPrice != null && (up ? lp >= S.tpPrice - TICK * 4 : lp <= S.tpPrice + TICK * 4)) ? 'tp' : ((S.lockTarget ?? S.sl) != null && (up ? lp <= (S.lockTarget ?? S.sl) + TICK * 4 : lp >= (S.lockTarget ?? S.sl) - TICK * 4)) ? 'sl' : 'flat';
          S.closeAt = Date.now(); log('Sin posición: fin del loop (' + S.reason + ')'); break; }
        if (d.action === 'skip') { st.step = d.step + 1; S.step = st.step; log(`paso ${d.step + 1}: el SL ya está más ajustado, se salta`); }
        if (d.action === 'modify') { const stp = c.steps[d.step];
          const hol = HOLGURA_TICKS * TICK, pxv = pos.price;
          if (pxv != null && (c.side === 'long' ? d.price > pxv - hol + 1e-9 : d.price < pxv + hol - 1e-9)) {
            if (!S.holguraAvisada) { S.holguraAvisada = true; S.alerta = 'El stop del escalón queda a menos de 2 ticks del precio. No se mueve hasta que haya hueco. No se toca ninguna otra orden.'; log(S.alerta); }
            await sleep(wait); continue;
          }
          log(`[${c.strategy.name}] paso ${stp.n}/${c.steps.length}: P&L $${pos.pnl} (${pos.pnlSrc}) >= $${stp.triggerUsd}: SL ${sl} -> ${d.price} (protege +$${stp.lockUsd}${c.P.NET_USD ? ` ≈ +$${c.P.NET_USD} netos` : ''})${d.step > st.step ? ` · salto de ${d.step - (st.step ?? 0)} escalón(es)` : ''}`);
          ev('disparo', { paso: stp.n, pnl: pos.pnl, fuente: pos.pnlSrc, disparoUSD: stp.triggerUsd, precio: d.price, slAntes: sl });
          if (paper) { const t0 = Date.now(); const r = await driver.modifyStop(d.price, c.symbol); let v = r.verified, confirmMs = r.confirmMs ?? null;
            if (r.method === 'ui' && r.verified == null) { const c0 = Date.now(); await sleep(800); await driver.position(c.symbol); v = await driver.stop(); confirmMs = Date.now() - c0; }
            for (const x of r.intentos || []) ev('intento_stop', { ...x, precio: d.price, paso: stp.n });
            const tDone = Date.now(); const lat = { metodo: r.method || '?', via: r.via || '?', leerMs: tSeen - tRead, modificarMs: r.modifyMs ?? null, confirmarMs: confirmMs, apiIntentoMs: r.method === 'ui' ? r.apiAttemptMs : (r.apiMs ?? null), uiMs: r.method === 'ui' ? ((r.modifyMs ?? 0) + (confirmMs ?? 0)) : null, apiError: r.apiErr || null, modificarYConfirmarMs: tDone - t0, totalDesdeLecturaMs: tDone - tRead, maxRetrasoPorPollMs: wait, fuente: pos.pnlSrc, intentos: r.intentos || [], real: !opts.ignoreClock }; S.latency = lat; try { fs.appendFileSync(path.join(path.dirname(logFile), 'colchon-latencia.log'), JSON.stringify({ at: new Date().toISOString(), ok: v === d.price, ...lat }) + '\n'); } catch {}
            ev('mover_stop', { paso: stp.n, precio: d.price, ok: v === d.price, verificado: v ?? null, via: r.via || null, intentos: r.intentos || [] });
            log(`LATENCIA [${lat.metodo}/${lat.via}] leer ${sg(lat.leerMs)} · modificar ${sg(lat.modificarMs)} · confirmar ${sg(lat.confirmarMs)}${lat.metodo === 'ui' ? ` · intento API ${sg(lat.apiIntentoMs)} (${lat.apiError}) · UI ${sg(lat.uiMs)}` : ''} = ${sg(lat.totalDesdeLecturaMs)} (+ hasta ${sg(wait)} entre lecturas)`);
            log(`modify via ${r.via || '?'} (${sg(tDone - t0)}) -> verificado ${v}`, v === d.price ? 'OK' : 'NO coincide ' + (r.err || r.raw || ''));
            const stepRec = { paso: stp.n, disparoUSD: stp.triggerUsd, protegeUSD: stp.lockUsd, precio: d.price, pnlAlDisparar: pos.pnl, fuente: pos.pnlSrc, saltados: d.step - (st.step ?? 0), latencia: lat };
            if (v === d.price || r.accepted) { stepRec.enSeg = S.openAt ? Math.round((Date.now() - S.openAt) / 100) / 10 : null; stepRec.confirmado = v === d.price; S.pasos.push(stepRec); st.step = d.step + 1; S.step = st.step; if (st.step >= c.steps.length) st.locked = true; }
            if (v === d.price) { S.locked = true; S.lockPrice = v; S.sl = v; S.lockTarget = d.price; S.lockAt = S.lockAt || Date.now(); } else if (r.accepted) { S.lockAt = S.lockAt || Date.now(); S.lockPending = true; S.lockTarget = d.price; log(`editPositionBrackets aceptado; TradingView aún no refleja ${d.price} tras 1.5 s: no se reintenta, se confirma en las próximas lecturas`); }
            else { if ((r.intentos || []).some(x => x.metodo === 'ui')) st.uiTried = true; st.fails++;
              if (st.fails >= (real || st.uiTried ? 1 : 3)) { st.locked = true; S.alerta = `NO PUDE MOVER EL STOP: muévelo a mano a ${d.price} (intentos: ${(r.intentos || []).map(x => `${x.metodo} ${x.ok ? 'ok' : 'falló'}`).join(', ') || 'api falló'})`; log(S.alerta); ev('notificacion', { texto: S.alerta, precio: d.price }); } } }
          else { log('SIMULACIÓN: no se modifica'); st.step = d.step + 1; S.step = st.step; if (st.step >= c.steps.length) st.locked = true; S.locked = true; S.lockPrice = d.price; }
        }
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
    const SP = S.P || (S.strategy && getStrategy(S.strategy.id) || getStrategy()).params; const pnlFinal0 = S.salidaReal != null ? S.salidaReal : S.reason === 'tp' ? SP.TP_USD : S.reason === 'sl' ? pnlSL : S.pnl; const usaBroker = pnlFinal0 == null && typeof S.pnlBroker === 'number'; const pnlFinal = usaBroker ? S.pnlBroker : pnlFinal0;
    last = { fin: new Date().toISOString(), cuenta: S.account && S.account.name, modo: S.mode, direccion: S.side === 'long' ? 'COMPRA' : 'VENTA', tamano: `${S.qty} ${S.symbol}`, motivo: { tp: 'Take profit', sl: 'Stop loss', stop: 'Detenido manualmente', flat: 'Posición cerrada', error: 'Error' }[S.reason] || S.reason || '—',
      ajusteFill: S.ajuste || null, estrategia: S.strategy ? S.strategy.name : null, estrategiaId: S.strategy ? S.strategy.id : null, ...tiempos(), entrada: S.entry, salida: S.salidaPrecio ?? null, pnlFinalUSD: pnlFinal, pnlFinalAprox: usaBroker ? false : !(S.reason === 'tp' || S.reason === 'sl'), colchonMovido: S.locked, slColchon: S.lockPrice, pasos: (S.pasos || []).map(p => ({ paso: p.paso, disparoUSD: p.disparoUSD, protegeUSD: p.protegeUSD, precio: p.precio, enSeg: p.enSeg, confirmado: p.confirmado, saltados: p.saltados, latenciaSeg: p.latencia ? Math.round(p.latencia.totalDesdeLecturaMs / 10) / 100 : null })), probabilidadNecesaria: S.qty ? breakEvenFor(S.symbol, S.qty, SP) : null, pasosTotal: S.steps ? S.steps.length : null, colchonUSD: S.qty ? ((S.pasos && S.pasos.length) ? S.pasos[S.pasos.length - 1].protegeUSD : (SP.STEPS ? null : lockUsdFor(S.symbol, S.qty, SP))) : null, disparoUSD: S.qty && !SP.STEPS ? triggerUsdFor(S.symbol, S.qty, SP) : null, latencia: S.latency || null, fuenteModo: S.fuenteModo || null, fuenteLider: S.fuenteLider || null, fuentes: S.fuentesStats || null, alerta: S.alerta || null, inicio: S.startedAt, error: S.error };
    S.summary = last; try { fs.writeFileSync(path.join(path.dirname(logFile), 'colchon-resumen.json'), JSON.stringify(last, null, 2)); } catch {}
    ev('fin_trade', last); try { const f = colchonHooks.despuesDeOperar; if (typeof f === 'function') f({ motivo: S.reason }); } catch {} try { const dd = path.dirname(logFile), rd = path.join(dd, 'reportes'); fs.mkdirSync(rd, { recursive: true }); fs.writeFileSync(path.join(rd, diaFarm() + '.md'), buildReport(dd, diaFarm())); } catch {}
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
        if (!r || (!r.ok && !r.watching)) { liberarPrueba(); if (S.state === 'running') { S.state = 'error'; S.error = S.error || (r && r.err) || 'No se pudo iniciar'; } }
        return r || { ok: false, err: 'No se pudo iniciar' };
      } catch (e) { liberarPrueba(); if (S.state === 'running') S.state = 'error'; return { ok: false, err: String(e.message || e) }; }
    },
    async _start({ side = 'long', symbol = DEFAULT.symbol, qty, accountId, strategyId, confirmReal } = {}) {
      const strat = getStrategy(strategyId == null || strategyId === '' ? DEFAULT_STRATEGY : strategyId); if (!strat) return { ok: false, err: `Estrategia desconocida: ${strategyId}` };
      if (!['long', 'short'].includes(side) || !(symbol in SIZES)) return { ok: false, err: 'Parámetros inválidos' };
      qty = qty == null || qty === '' ? ((strat.params.DEFAULT_QTY || {})[symbol] ?? (symbol === DEFAULT.symbol ? DEFAULT.qty : 1)) : Number(qty);
      if (!Number.isInteger(qty) || qty < 1) return { ok: false, err: `Cantidad inválida: ${symbol} entre 1 y ${maxQtyFor(symbol, {})}` };
      let switched = null, chosen = null, chk = null;
      if (accountId != null && accountId !== '') {
        const l = await this.accounts(); if (!l.ok) return { ok: false, err: l.err };
        const a = l.accounts.find(x => x.id === String(accountId)); if (!a) return { ok: false, err: 'Cuenta no encontrada' }; chosen = a;
        { const maxChosen = maxQtyFor(symbol, a); if (qty > maxChosen) return { ok: false, err: `Cantidad inválida: ${symbol} entre 1 y ${maxChosen}` }; }
        if (!a.allowed) return { ok: false, blocked: true, err: `No veo el nombre de la cuenta ${a.name || ''}` };
        if (a.real && confirmReal !== true) return { ok: false, blocked: true, needConfirm: true, err: `CUENTA REAL · ${a.realLabel}: falta confirmación` };
        if (!a.current && S.state === 'running') return { ok: false, err: 'Hay una prueba en marcha: no se cambia de cuenta' };
        if (!a.current) { const sw = await (await D()).switchAccount(a.id, a.name); if (!sw || !sw.ok) return { ok: false, err: 'No se pudo activar la cuenta ' + a.name + ': ' + ((sw && sw.error) || '?') }; switched = { name: a.name, ms: sw.ms }; }
        chk = await check(); if (chk.account.name !== a.name) return { ok: false, err: `La cuenta activa es ${chk.account.name}, no ${a.name}: no se opera` };
      }
      if (!chk) chk = await check();
      if (chk.real && confirmReal !== true) return { ok: false, blocked: true, needConfirm: true, err: `CUENTA REAL · ${chk.realLabel}: falta confirmación (confirmReal)` };
      const exec = chk.paper || (chk.real && confirmReal === true);
      if (accountId != null && accountId !== '' && !exec) return { ok: false, blocked: true, err: chk.msg };
      const hint = accountHintFor((chk.account && chk.account.name) || (chosen && chosen.name) || '');
      { const maxQ = maxQtyFor(symbol, hint); if (qty > maxQ) return { ok: false, err: `Cantidad inválida: ${symbol} entre 1 y ${maxQ}` }; }
      const P = paramsForAccount(strat.params, hint), c = { side, symbol, qty, P, strategy: { id: strat.id, name: strat.name }, steps: stepsFor(symbol, qty, P) }, slPts = ptsFor(P.SL_USD, symbol, qty), tpPts = ptsFor(P.TP_USD, symbol, qty);
      S = { ...S, pnlBroker: null, summary: null, reason: null, lockTarget: null, lockPending: false, openAt: null, closeAt: null, lockAt: null, tpPrice: null, latency: null, state: 'running', strategy: { id: strat.id, name: strat.name }, P, steps: stepsFor(symbol, qty, P), step: 0, pasos: [], mode: chk.paper ? 'paper' : chk.real ? 'real' : 'simulacion', realLabel: chk.realLabel || null, alerta: null, emptyN: 0, emptySince: null, kidsWarned: false, fuentesStats: null, account: chk.account, side, symbol, qty, entry: null, price: null, pnl: null, sl: null, slVisto: null, tpVisto: null, tp: tpPts, locked: false, lockPrice: null, error: null, startedAt: new Date().toISOString(), log: [] };
      stopReq = false;
      log(`Inicio [${strat.name}] ${side === 'long' ? 'COMPRA' : 'VENTA'} ${qty} ${symbol} · SL -$${P.SL_USD} (${slPts} pts) · TP +$${P.TP_USD} (${tpPts} pts) · ${P.STEPS ? (!c.steps.length ? 'stop fijo (sin movimientos)' : 'escalones ' + c.steps.map(x => `+$${x.triggerUsd}→+$${x.lockUsd} (${x.lockPts} pts)`).join(' · ')) : `colchón +$${lockUsdFor(symbol, qty, P)} (${lockPtsFor(symbol, qty, P)} pts, ≈ +$${P.NET_USD} netos), disparo +$${triggerUsdFor(symbol, qty, P)} (${triggerPtsFor(symbol, qty, P)} pts)`} · cuenta ${chk.account.name || '?'}${strat.params.SCALE_BY_SIZE ? ' · plan ' + accountPlanSize(hint) : ''} -> ${chk.msg}`);
      if (switched) log(`Cuenta cambiada a ${switched.name} por API (${(switched.ms / 1000).toFixed(2)} s, verificada)`);
      if (chk.real) log(`CUENTA REAL · ${chk.realLabel} · confirmada por el usuario`);
      if (!exec) { log('BLOQUEADO: solo Paper/Demo o cuenta real permitida y confirmada. No se envía ninguna orden.'); S.state = 'blocked'; return { ok: false, blocked: true, err: chk.msg, status: S }; }
      const drv = await D(); try { S.accountId = drv.accountId ? await drv.accountId() : null; } catch { S.accountId = null; }
      if (accountId && S.accountId && S.accountId !== String(accountId)) { S.state = 'error'; S.error = 'La cuenta activa no es la elegida: no se opera'; log(S.error); return { ok: false, err: S.error, status: S }; }
      const op = await drv.openBracket({ ...c, slPts, tpPts }); log('open ->', op);
      const lo = drv.lastOpen ? drv.lastOpen() : null;
      Object.assign(S, { ajusteHecho: false, ajuste: null, slPts, tpPts, ref: lo ? lo.ref : null, tpRef: lo ? lo.tp : null, step: lo && lo.step ? lo.step : 0, locked: !!(lo && lo.locked), lockPrice: lo && lo.step ? lo.sl : null, tpPrice: lo ? lo.tp : null, slOk: !!(lo && lo.slOk), slObjetivo: lo ? (lo.slObjetivo ?? null) : null, orderId: lo ? (lo.orderId || null) : null, posId: lo ? (lo.posId || null) : null, alerta: (lo && lo.alerta) || null, salidaReal: lo ? (lo.salidaReal ?? null) : null, salidaPrecio: lo ? (lo.salida ?? null) : null });
      if (lo && lo.paso) S.pasos = [lo.paso];
      if (lo && lo.tpHit) { S.entry = lo.ref; S.openAt = Date.now(); S.closeAt = Date.now(); S.tpPrice = lo.tp; S.reason = 'tp'; S.state = 'done'; log(`Objetivo ya pasado: cierre de ${lo.qty} a ${lo.salida} (precio real, no el del objetivo)`); summarize(); liberarPrueba(); return { ok: true, closed: 'tp', status: S }; }
      if (String(op).startsWith('error')) { S.state = 'error'; S.error = op; S.reason = 'error'; S.alerta = (lo && lo.alerta) || op; summarize(); return { ok: false, err: op, status: S }; }
      loopP = loop(c, true).finally(() => { liberarPrueba(); });
      if (lo && lo.pedirSaldo) { try { const f = colchonHooks.despuesDeOperar; if (typeof f === 'function') f({ motivo: 'apertura' }); } catch {} }
      if (lo && !lo.slOk) return { ok: false, watching: true, alerta: S.alerta, status: S };
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
export const acctGuard = { testActive: false, fullRead: null, saldoPendiente: false, alLiberar: null };
// Al soltar la prueba se avisa para que corra lo que quedó en cola (saldo, vista previa). No se tira.
export function liberarPrueba() {
  acctGuard.testActive = false;
  const fn = acctGuard.alLiberar;
  if (typeof fn === 'function') { try { fn(); } catch {} }
}
// Si hay una orden en curso, el trabajo espera en `cola` y se ejecuta al drenarla. Si no, corre ya.
export function encolarSiOcupado(cola, trabajo) {
  if (!acctGuard.testActive) return Promise.resolve().then(trabajo);
  return new Promise(resolve => {
    cola.push(() => Promise.resolve().then(trabajo).then(resolve, e => resolve({ ok: false, error: String(e && e.message || e) })));
  });
}
export function drenarCola(cola) {
  const jobs = cola.splice(0);
  return Promise.all(jobs.map(j => Promise.resolve().then(j)));
}
export async function readAccounts({ all = false, only = null, evaluate = null } = {}) {
  if (all && acctGuard.testActive) all = false;
  let c = null; const ev = evaluate || (c = await cdpEvaluator()).evaluate;
  const run = (async () => { try { return await ev(js_readAccounts(all, only)); } finally { try { c && c.close(); } catch {} } })();
  if (all) { acctGuard.fullRead = run.catch(() => {}); run.finally(() => { acctGuard.fullRead = null; }).catch(() => {}); }
  const r = await run; if (all) r.full = true; return r;
}
