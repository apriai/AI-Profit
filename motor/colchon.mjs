import { getStrategy, listStrategies, DEFAULT_STRATEGY } from './strategies.mjs';
// TradingLink - "Colchón" (stop-to-profit). Paper/Demo, y cuentas reales Lucid (LFE/LFF) SOLO si están en real-allowlist.json, con confirmReal (el motor puede activarla con setCurrentAccount si no hay trades/órdenes abiertas).
// La IA nunca coloca/modifica/cierra órdenes: solo el usuario arranca una prueba desde la Granja.
// Servidor: import { colchon } from './colchon.mjs'  -> colchon.start({side,symbol,qty}), colchon.stop(), colchon.status()
// CLI:      node colchon.mjs [--paper] [--short] [--mnq]   |   node colchon.mjs --selftest
import { execFile } from 'node:child_process'; import path from 'node:path'; import fs from 'node:fs';
import { dataDir, TV_CLI, TV_PKG } from './rutas.mjs';
const DIR = dataDir();
export const CFG = { SL_USD: 600, TP_USD: 1600, NET_USD: 100, SLIP_TICKS: 1, TRIGGER_EXTRA_USD: 15, POLL_MS: 500, FLAT_BY_MIN: 16 * 60 + 45 };
export const SIZES = { NQ: 2, MNQ: 20 }; const PT_USD = { NQ: 20, MNQ: 2 }; export const TICK = 0.25;
export const ptsFor = (usd, symbol, qty) => Math.round(usd / (PT_USD[symbol] * qty) / TICK) * TICK;
export const DEFAULT = { symbol: 'MNQ', qty: 20 }; // SIZES = tope máximo por símbolo; $/tick: MNQ 0.50, NQ 5
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
const etMin = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value])); return (+p.hour % 24) * 60 + +p.minute; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- Gate de seguridad ----
// cuenta elegible para la prueba: tipo demo/paper, nunca live, nunca Lucid (LFE/LFF/lucid)
export function accountAllowed(a, broker = '') { if (!a || a.type === 'live' || /\bLF[EF]\d*/i.test(a.name || '') || /lucid/i.test(`${a.name} ${a.title}`)) return false; return a.type === 'demo' && isPaper(a.name, `${a.title || ''} ${broker}`); }
// ---- Cuentas reales (Lucid LFE = evaluación, LFF = fondeada): real-allowlist.json {"allowAll":true} o {"allow":["LFE…"]}. Sin archivo = todo bloqueado.
export function loadAllow(file = path.join(DIR, 'real-allowlist.json')) { try { const j = JSON.parse(fs.readFileSync(file, 'utf8')); return { allowAll: j.allowAll === true, allow: Array.isArray(j.allow) ? j.allow.map(String) : [] }; } catch { return { allowAll: false, allow: [] }; } }
export function realAllowed(name, allow) { const n = String(name || '').trim(); if (!/^LF[EF]\d+$/.test(n) || !allow) return false; return allow.allowAll ? true : allow.allow.includes(n); }
export const realLabel = name => { const n = String(name || ''); return `${n} (${/^LFF/.test(n) ? 'fondeada' : /^LFE/.test(n) ? 'evaluación' : 'real'})`; };
export function isPaper(name = '', broker = '') {
  const s = `${name || ''} ${broker || ''}`;
  if (/\bLF[EF]\d*/i.test(s) || /lucid/i.test(s)) return false;   // nunca Lucid
  return /paper|demo|\bsim(ulat\w*)?\b/i.test(s);
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
    return {api:!!ab,brokerId:tvBrokerId(ab),broker:meta.title||meta.name||tvBrokerId(ab),name:n?n.innerText.trim():null}})()`,
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
  // tras enviar: espera el fill (posición visible). Si no llega, busca la orden en el historial (status 5 = rechazada) y devuelve el motivo
  fill: (root, side, qty) => `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t),T=performance.now();while(performance.now()-T<6000){var p=await tvPos(ab,${JSON.stringify(root)});if(p)return {filled:true,ms:Math.round(performance.now()-T)};await new Promise(function(z){setTimeout(z,150)})}
    var h=[];try{h=await ab.ordersHistory()}catch(e){}var o=(h||[]).filter(function(x){return x&&x.type===2&&x.side===${side}&&x.qty===${qty}&&tvRoot(x.symbol)===${JSON.stringify(root)}}).pop();
    return {filled:false,status:o?o.status:null,message:o&&o.message?(o.message.text||String(o.message)):null}})()`,
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
  try{if(typeof MutationObserver==='function'&&document.body){var mo=new MutationObserver(function(){try{document.querySelectorAll('[class*=accountSummaryField]').forEach(function(e){var x=String(e.innerText||'').split('\\n');if(x.length>1)send('b:dom.'+x[0],x[1])})}catch(e){}});mo.observe(document.body,{subtree:true,childList:true,characterData:true});src.push('b:dom');U.push(function(){mo.disconnect()})}}catch(e){}
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
    async position(symbol) { const p = await evaluate(js.position(symbol)); if (p && p.error) throw new Error(p.error); if (p && p.transient) return p; last.pos = p; return p; },
    async stop() { return last.pos ? last.pos.stop : null; },
    async lastPrice() { try { const r = await evaluate(js.lastPrice); return r && typeof r.price === 'number' ? r.price : null; } catch { return null; } },
    async openBracket({ side, symbol, qty, slPts, tpPts }) {
      let lp = await evaluate(js.lastPrice); if (lp.error) return 'error: ' + lp.error;
      const cs = String(lp.symbol).replace(/^.*:/, ''), chartRoot = /^MNQ/.test(cs) ? 'MNQ' : /^NQ/.test(cs) ? 'NQ' : cs;
      if (chartRoot !== symbol) return `error: el chart está en ${lp.symbol}; pon ${symbol}1! en el chart`;
      // Tradovate exige contrato fechado; si el chart aún no trae front_contract, reintentar unos segundos
      if (!lp.front && /\d!$/.test(String(lp.symbol || ''))) {
        for (let i = 0; i < 8 && !lp.front; i++) {
          await new Promise(z => setTimeout(z, 250));
          const again = await evaluate(js.lastPrice);
          if (again && !again.error) lp = again;
        }
      }
      const ts = await evaluate(js.tradeSymbol(lp.symbol, lp.front));
      if (!ts || ts.error) {
        if (!lp.front && /\d!$/.test(String(lp.symbol || ''))) return 'error: Tradovate no acepta el continuo ' + lp.symbol + ' y aún no tengo el contrato fechado (front_contract). Espera 1–2 s con ' + symbol + '1! en el chart e inténtalo de nuevo.';
        return 'error: ' + ((ts && ts.error) || 'sin símbolo del bróker');
      }
      const s = side === 'long' ? 1 : -1, px = lp.price;
      const o = { symbol: ts.symbol, side: s, type: 2, qty, stopLoss: roundTick(px - s * slPts), takeProfit: roundTick(px + s * tpPts) };
      const r = await evaluate(js.place(o)); if (r.error) return 'error: ' + r.error;
      const f = await evaluate(js.fill(symbol, s, qty));
      if (!f.filled) return `error: la orden no se llenó${f.status === 5 ? ' (RECHAZADA por TradingView)' : ''}: ${f.message || 'sin posición tras 6 s'}`;
      last.open = { ref: px, sl: o.stopLoss, tp: o.takeProfit };
      return `ok market ${qty} ${ts.symbol} @~${px} SL ${o.stopLoss} TP ${o.takeProfit} · fill visto en ${(f.ms / 1000).toFixed(2)} s`;
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
// DIA DEL FARM: el dia de trading termina a las 16:00 America/New_York (fin de las sesiones de Nueva York). Desde las 16:00 cuenta como el dia SIGUIENTE; sabado y domingo -> lunes (viernes 16:00 -> lunes). Horario de verano: lo resuelve la zona America/New_York (no hay horas fijas en UTC).
export const diaFarm = (t = Date.now()) => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }).formatToParts(new Date(t)).map(x => [x.type, x.value])); const d = new Date(Date.UTC(+p.year, +p.month - 1, +p.day)); if ((+p.hour % 24) >= 16) d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w === 6) d.setUTCDate(d.getUTCDate() + 2); else if (w === 0) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
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
export const colchonHooks = {}; // el servidor registra aqui pnlFinalBroker (P&L final real desde las ejecuciones del broker)
export function createColchon(driverOrFactory = defaultDriver, opts = {}) {
  let driver = typeof driverOrFactory === 'function' ? null : driverOrFactory;
  const D = async () => driver || (driver = await driverOrFactory());
  const poll = opts.pollMs ?? CFG.POLL_MS, logFile = opts.logFile ?? path.join(DIR, 'colchon.log');
  let S = { state: 'idle', mode: null, account: null, side: null, symbol: null, qty: null, entry: null, price: null, pnl: null, sl: null, tp: null, locked: false, lockPrice: null, error: null, startedAt: null, log: [] };
  let stopReq = false, loopP = null;
  const evFile = path.join(path.dirname(logFile), 'colchon-eventos.jsonl'); const ev = (type, d = {}) => { try { fs.appendFileSync(evFile, JSON.stringify({ at: new Date().toISOString(), type, ...d }) + '\n'); } catch {} };
  const allow = () => loadAllow(opts.realAllowFile ?? path.join(DIR, 'real-allowlist.json'));
  const log = (...a) => { const s = `${new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} ET ${a.join(' ')}`; S.log.push(s); S.log = S.log.slice(-40); try { fs.appendFileSync(logFile, s + '\n'); } catch {} };
  async function check() { let acc; try { acc = await (await D()).account(); } catch (e) { driver = null; return { account: {}, paper: false, msg: 'Sin conexión con TradingView (CDP 9222): ' + e.message }; } const ok = isPaper(acc.name, acc.broker), real = !ok && realAllowed(acc.name, allow()); return { account: acc, paper: ok, real, realLabel: real ? realLabel(acc.name) : null, msg: ok ? 'Paper/Demo OK' : real ? `CUENTA REAL · ${realLabel(acc.name)}` : (acc.name ? 'Bloqueado: cuenta real o Lucid no permitida (real-allowlist.json)' : 'No veo la cuenta en TradingView') }; }
  async function loop(c, paper) {
    const st = { locked: false, fails: 0, uiTried: false }; const driver = await D(); const real = S.mode === 'real';
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
        if (!opts.ignoreClock && etMin() >= CFG.FLAT_BY_MIN && etMin() < 18 * 60) { S.reason = '4:45pm'; log('4:45 PM ET: cerrar'); if (paper) log('flatten ->', await driver.flatten(c.symbol)); break; }
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
        if (pos && pos.entry != null && paper && !S.ajusteHecho && S.ref != null) {
          S.ajusteHecho = true; const sd2 = c.side === 'long' ? 1 : -1, slN = roundTick(pos.entry - sd2 * S.slPts), tpN = roundTick(pos.entry + sd2 * S.tpPts), slA = sl0, tpA = S.tpRef;
          const rec = { ref: S.ref, fill: pos.entry, slAntes: slA, slNuevo: slN, tpAntes: tpA, tpNuevo: tpN, stopId: pos.stopId ?? null };
          if (slA === slN && tpA === tpN) { rec.ok = true; rec.nada = true; }
          else { const t0 = Date.now();
            rec.sl = slA === slN ? { ok: true, ya: true } : await driver.modifyStop(slN, c.symbol);
            rec.tp = driver.modifyTp ? await driver.modifyTp(tpN, c.symbol) : { ok: false, err: 'sin modifyTp' };
            rec.ok = !!(rec.sl.ok && rec.tp.ok); rec.seg = Math.round((Date.now() - t0) / 100) / 10; }
          S.tpPrice = tpN; S.ajuste = rec; ev('ajuste_brackets', rec);
          log(rec.nada ? `Fill ${pos.entry} = referencia: SL/TP ya correctos` : `Ajuste por fill ${pos.entry} (ref ${S.ref}): SL ${slA}→${slN} ${rec.sl.ok ? 'OK' : 'FALLO'} · TP ${tpA}→${tpN} ${rec.tp.ok ? 'OK' : 'FALLO'} (${rec.seg} s)`);
          if (!rec.ok) { S.alerta = `Ajuste SL/TP al fill no verificado (SL ${slN}, TP ${tpN}): revisa TradingView. No se canceló nada.`; ev('notificacion', { texto: S.alerta }); }
          if (!rec.nada) { await sleep(wait); continue; }
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
          Object.assign(S, { entry: pos.entry, price: pos.price, pnl: pos.pnl, sl, brokerPl: pos.brokerPl ?? null, chartPl: pos.chart ? pos.chart.pnl : null }); if (S.tpPrice == null && pos.entry != null) S.tpPrice = roundTick(pos.entry + (c.side === 'long' ? 1 : -1) * S.tp);
        }
        if (S.lockPending && sl === S.lockTarget) { S.lockPending = false; S.locked = true; S.lockPrice = sl; S.lockAt = S.lockAt || Date.now(); log(`colchón confirmado en ${sl}`); }
        const d = decide(pos, sl, st, c);
        if (d.action === 'flat') { if (paper && S.openAt == null && i < 10) { await sleep(poll); continue; }
          let lp = S.price; try { const q = driver.lastPrice && await driver.lastPrice(); if (q != null) lp = q; } catch {} const up = c.side === 'long'; S.reason = lp == null ? 'flat' : (S.tpPrice != null && (up ? lp >= S.tpPrice - TICK * 4 : lp <= S.tpPrice + TICK * 4)) ? 'tp' : ((S.lockTarget ?? S.sl) != null && (up ? lp <= (S.lockTarget ?? S.sl) + TICK * 4 : lp >= (S.lockTarget ?? S.sl) - TICK * 4)) ? 'sl' : 'flat';
          S.closeAt = Date.now(); log('Sin posición: fin del loop (' + S.reason + ')'); break; }
        if (d.action === 'skip') { st.step = d.step + 1; S.step = st.step; log(`paso ${d.step + 1}: el SL ya está más ajustado, se salta`); }
        if (d.action === 'modify') { const stp = c.steps[d.step];
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
    const SP = (S.strategy && getStrategy(S.strategy.id) || getStrategy()).params; const pnlFinal0 = S.reason === 'tp' ? SP.TP_USD : S.reason === 'sl' ? pnlSL : S.pnl; const usaBroker = pnlFinal0 == null && typeof S.pnlBroker === 'number'; const pnlFinal = usaBroker ? S.pnlBroker : pnlFinal0;
    last = { fin: new Date().toISOString(), cuenta: S.account && S.account.name, modo: S.mode, direccion: S.side === 'long' ? 'COMPRA' : 'VENTA', tamano: `${S.qty} ${S.symbol}`, motivo: { tp: 'Take profit', sl: 'Stop loss', stop: 'Detenido manualmente', flat: 'Posición cerrada', '4:45pm': 'Cierre 4:45 PM ET', error: 'Error' }[S.reason] || S.reason || '—',
      ajusteFill: S.ajuste || null, estrategia: S.strategy ? S.strategy.name : null, estrategiaId: S.strategy ? S.strategy.id : null, ...tiempos(), entrada: S.entry, pnlFinalUSD: pnlFinal, pnlFinalAprox: usaBroker ? false : !(S.reason === 'tp' || S.reason === 'sl'), colchonMovido: S.locked, slColchon: S.lockPrice, pasos: (S.pasos || []).map(p => ({ paso: p.paso, disparoUSD: p.disparoUSD, protegeUSD: p.protegeUSD, precio: p.precio, enSeg: p.enSeg, confirmado: p.confirmado, saltados: p.saltados, latenciaSeg: p.latencia ? Math.round(p.latencia.totalDesdeLecturaMs / 10) / 100 : null })), probabilidadNecesaria: S.qty ? breakEvenFor(S.symbol, S.qty, SP) : null, pasosTotal: S.steps ? S.steps.length : null, colchonUSD: S.qty ? ((S.pasos && S.pasos.length) ? S.pasos[S.pasos.length - 1].protegeUSD : (SP.STEPS ? null : lockUsdFor(S.symbol, S.qty, SP))) : null, disparoUSD: S.qty && !SP.STEPS ? triggerUsdFor(S.symbol, S.qty, SP) : null, latencia: S.latency || null, fuenteModo: S.fuenteModo || null, fuenteLider: S.fuenteLider || null, fuentes: S.fuentesStats || null, alerta: S.alerta || null, inicio: S.startedAt, error: S.error };
    S.summary = last; try { fs.writeFileSync(path.join(path.dirname(logFile), 'colchon-resumen.json'), JSON.stringify(last, null, 2)); } catch {}
    ev('fin_trade', last); try { const dd = path.dirname(logFile), rd = path.join(dd, 'reportes'); fs.mkdirSync(rd, { recursive: true }); fs.writeFileSync(path.join(rd, diaFarm() + '.md'), buildReport(dd, diaFarm())); } catch {}
    log(`DURACIÓN ${last.duracionSeg == null ? '?' : sg(last.duracionSeg * 1000)} (${last.abiertaET ?? '?'} → ${last.cerradaET ?? '?'}, ±${sg(poll)})${last.colchonTrasSeg != null ? ` · colchón a los ${sg(last.colchonTrasSeg * 1000)}` : ''}`);
    if (last.pasos.length) log('PASOS ' + last.pasos.map(p => `#${p.paso} +$${p.protegeUSD} a los ${p.enSeg ?? '?'} s`).join(' · '));
    log('RESUMEN', JSON.stringify(last));
  }
  return {
    check,
    strategies: () => ({ ok: true, default: DEFAULT_STRATEGY, strategies: listStrategies() }),
    async accounts() { try { const r = await (await D()).accounts(); return { ok: true, ...r, accounts: r.accounts.map(a => { const p = accountAllowed(a, `${r.broker} ${r.brokerId}`), re = !p && realAllowed(a.name, allow()); return { ...a, allowed: p || re, real: re, realLabel: re ? realLabel(a.name) : null }; }) }; } catch (e) { driver = null; return { ok: false, err: 'Sin conexión con TradingView: ' + e.message, accounts: [] }; } },
    async start(args = {}) {
      if (S.state === 'running' || acctGuard.testActive) return { ok: false, err: 'Ya hay una prueba corriendo' };
      acctGuard.testActive = true;
      if (acctGuard.fullRead) { log('Esperando a que termine la lectura de cuentas de la granja antes de operar…'); await acctGuard.fullRead; }
      let r; try { r = await this._start(args); } catch (e) { r = { ok: false, err: String(e.message || e) }; }
      if (!r.ok) acctGuard.testActive = false; return r;
    },
    async _start({ side = 'long', symbol = DEFAULT.symbol, qty, accountId, strategyId, confirmReal } = {}) {
      const strat = getStrategy(strategyId == null || strategyId === '' ? DEFAULT_STRATEGY : strategyId); if (!strat) return { ok: false, err: `Estrategia desconocida: ${strategyId}` };
      if (!['long', 'short'].includes(side) || !(symbol in SIZES)) return { ok: false, err: 'Parámetros inválidos' };
      qty = qty == null || qty === '' ? ((strat.params.DEFAULT_QTY || {})[symbol] ?? (symbol === DEFAULT.symbol ? DEFAULT.qty : 1)) : Number(qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > SIZES[symbol]) return { ok: false, err: `Cantidad inválida: ${symbol} entre 1 y ${SIZES[symbol]}` };
      let switched = null;
      if (accountId != null && accountId !== '') {
        const l = await this.accounts(); if (!l.ok) return { ok: false, err: l.err };
        const a = l.accounts.find(x => x.id === String(accountId)); if (!a) return { ok: false, err: 'Cuenta no encontrada' };
        if (!a.allowed) return { ok: false, blocked: true, err: `Bloqueado: ${a.name} no es Paper/Demo ni está en real-allowlist.json` };
        if (a.real && confirmReal !== true) return { ok: false, blocked: true, needConfirm: true, err: `CUENTA REAL · ${a.realLabel}: falta confirmación` };
        if (!a.current && S.state === 'running') return { ok: false, err: 'Hay una prueba en marcha: no se cambia de cuenta' };
        if (!a.current) { const sw = await (await D()).switchAccount(a.id, a.name); if (!sw || !sw.ok) return { ok: false, err: 'No se pudo activar la cuenta ' + a.name + ': ' + ((sw && sw.error) || '?') }; switched = { name: a.name, ms: sw.ms }; }
        const chk0 = await check(); if (chk0.account.name !== a.name) return { ok: false, err: `La cuenta activa es ${chk0.account.name}, no ${a.name}: no se opera` };
        try { const p0 = await (await D()).position(symbol); if (p0) return { ok: false, err: `Ya hay una posición de ${symbol} en ${a.name}: no se opera` }; } catch {}
      }
      const chk = await check();
      if (chk.real && confirmReal !== true) return { ok: false, blocked: true, needConfirm: true, err: `CUENTA REAL · ${chk.realLabel}: falta confirmación (confirmReal)` };
      const exec = chk.paper || (chk.real && confirmReal === true);
      if (accountId != null && accountId !== '' && !exec) return { ok: false, blocked: true, err: chk.msg };
      const P = strat.params, c = { side, symbol, qty, P, strategy: { id: strat.id, name: strat.name }, steps: stepsFor(symbol, qty, P) }, slPts = ptsFor(P.SL_USD, symbol, qty), tpPts = ptsFor(P.TP_USD, symbol, qty);
      S = { ...S, pnlBroker: null, summary: null, reason: null, lockTarget: null, lockPending: false, openAt: null, closeAt: null, lockAt: null, tpPrice: null, latency: null, state: 'running', strategy: { id: strat.id, name: strat.name }, steps: stepsFor(symbol, qty, P), step: 0, pasos: [], mode: chk.paper ? 'paper' : chk.real ? 'real' : 'simulacion', realLabel: chk.realLabel || null, alerta: null, emptyN: 0, emptySince: null, kidsWarned: false, fuentesStats: null, account: chk.account, side, symbol, qty, entry: null, price: null, pnl: null, sl: null, tp: tpPts, locked: false, lockPrice: null, error: null, startedAt: new Date().toISOString(), log: [] };
      stopReq = false;
      log(`Inicio [${strat.name}] ${side === 'long' ? 'COMPRA' : 'VENTA'} ${qty} ${symbol} · SL -$${P.SL_USD} (${slPts} pts) · TP +$${P.TP_USD} (${tpPts} pts) · ${P.STEPS ? (!c.steps.length ? 'stop fijo (sin movimientos)' : 'escalones ' + c.steps.map(x => `+$${x.triggerUsd}→+$${x.lockUsd} (${x.lockPts} pts)`).join(' · ')) : `colchón +$${lockUsdFor(symbol, qty, P)} (${lockPtsFor(symbol, qty, P)} pts, ≈ +$${P.NET_USD} netos), disparo +$${triggerUsdFor(symbol, qty, P)} (${triggerPtsFor(symbol, qty, P)} pts)`} · cuenta ${chk.account.name || '?'} -> ${chk.msg}`);
      if (switched) log(`Cuenta cambiada a ${switched.name} por API (${(switched.ms / 1000).toFixed(2)} s, verificada)`);
      if (chk.real) log(`CUENTA REAL · ${chk.realLabel} · confirmada por el usuario`);
      if (!exec) { log('BLOQUEADO: solo Paper/Demo o cuenta real permitida y confirmada. No se envía ninguna orden.'); S.state = 'blocked'; return { ok: false, blocked: true, err: chk.msg, status: S }; }
      const drv = await D(); try { S.accountId = drv.accountId ? await drv.accountId() : null; } catch { S.accountId = null; }
      if (accountId && S.accountId && S.accountId !== String(accountId)) { S.state = 'error'; S.error = 'La cuenta activa no es la elegida: no se opera'; log(S.error); return { ok: false, err: S.error, status: S }; }
      const op = await drv.openBracket({ ...c, slPts, tpPts }); log('open ->', op);
      { const lo = drv.lastOpen ? drv.lastOpen() : null; Object.assign(S, { ajusteHecho: false, ajuste: null, slPts, tpPts, ref: lo ? lo.ref : null, tpRef: lo ? lo.tp : null }); }
      if (String(op).startsWith('error')) { S.state = 'error'; S.error = op; S.reason = 'error'; summarize(); return { ok: false, err: op, status: S }; }
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
// - una prueba que arranca espera a que termine una lectura completa en curso antes de tocar la cuenta.
export const acctGuard = { testActive: false, fullRead: null };
export async function readAccounts({ all = false, only = null, evaluate = null } = {}) {
  if (all && acctGuard.testActive) all = false;
  let c = null; const ev = evaluate || (c = await cdpEvaluator()).evaluate;
  const run = (async () => { try { return await ev(js_readAccounts(all, only)); } finally { try { c && c.close(); } catch {} } })();
  if (all) { acctGuard.fullRead = run.catch(() => {}); run.finally(() => { acctGuard.fullRead = null; }).catch(() => {}); }
  const r = await run; if (all) r.full = true; return r;
}
