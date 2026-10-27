import { getStrategy, listStrategies, DEFAULT_STRATEGY } from './strategies.mjs';
// TradingLink - "Colchón" (stop-to-profit). SOLO PAPER/DEMO. Cuentas Lucid (LFE/LFF) o reales: siempre bloqueado.
// Servidor: import { colchon } from './colchon.mjs'  -> colchon.start({side,symbol,qty}), colchon.stop(), colchon.status()
// CLI:      node colchon.mjs [--paper] [--short] [--mnq]   |   node colchon.mjs --selftest
import { execFile } from 'node:child_process'; import path from 'node:path'; import fs from 'node:fs'; import { fileURLToPath } from 'node:url';
const DIR = path.dirname(fileURLToPath(import.meta.url));
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
  const reward = !st.length ? P.TP_USD : (P.NET_USD != null ? P.NET_USD : st[0].lockUsd);
  return { pct: Math.round(risk / (risk + reward) * 1000) / 10, riesgoUSD: risk, recompensaUSD: reward };
}
export function stepsFor(symbol, qty, P = getStrategy().params) {
  const t = tickUsdFor(symbol, qty), ppt = PT_USD[symbol] * qty;
  if (Array.isArray(P.STEPS)) return P.STEPS.map((x, i) => { const lockUsd = Math.round(Math.ceil(x.lock / t - 1e-9) * t * 100) / 100; return { n: i + 1, triggerUsd: x.trigger, lockUsd, lockPts: Math.round(lockUsd / ppt / TICK) * TICK }; });
  return [{ n: 1, triggerUsd: triggerUsdFor(symbol, qty, P), lockUsd: lockUsdFor(symbol, qty, P), lockPts: lockPtsFor(symbol, qty, P) }];
}
export const roundTick = p => Math.round(p / TICK) * TICK;
const etMin = () => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value])); return (+p.hour % 24) * 60 + +p.minute; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---- Gate de seguridad ----
// cuenta elegible para la prueba: tipo demo/paper, nunca live, nunca Lucid (LFE/LFF/lucid)
export function accountAllowed(a, broker = '') { if (!a || a.type === 'live' || /\bLF[EF]\d*/i.test(a.name || '') || /lucid/i.test(`${a.name} ${a.title}`)) return false; return a.type === 'demo' && isPaper(a.name, `${a.title || ''} ${broker}`); }
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
async function tvPos(ab,root){var l=[];try{l=await ab.positions()}catch(e){}return (l||[]).find(function(p){return p&&p.qty&&tvRoot(p.symbol)===root})||null}
function tvStopOrder(t,pos){var os=t&&t._ordersService,l=[];try{l=tvWv(os&&os.activeOrders&&os.activeOrders())||[]}catch(e){}
 return (l||[]).find(function(o){return o&&o.type===3&&(o.status===6||o.status===4)&&(!pos||(o.symbol===pos.symbol&&o.side===-pos.side))})||null}
`;
export const js = {
  account: `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t),n=document.querySelector('[class*=accountName]');var meta={};try{meta=ab&&ab._brokerMetainfo||{}}catch(e){}
    return {api:!!ab,brokerId:tvBrokerId(ab),broker:meta.title||meta.name||tvBrokerId(ab),name:n?n.innerText.trim():null}})()`,
  accounts: `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t);if(!ab||!ab.accountsMetainfo)return {error:'no-accounts-api'};var meta={};try{meta=ab._brokerMetainfo||{}}catch(e){}
    var cur=String(tvWv(ab.currentAccount())),l=await ab.accountsMetainfo();return {brokerId:tvBrokerId(ab),broker:meta.title||tvBrokerId(ab),current:cur,canSwitch:typeof ab.setCurrentAccount==='function',
      accounts:(l||[]).map(function(a){return {id:String(a.id),name:a.name,type:a.type,title:a.title,current:String(a.id)===cur}})}})()`,
  // cambia de subcuenta por la API interna (sin clics) y espera a que el id actual Y el nombre visible coincidan
  switchAccount: (id, name) => `(async function(){${PAGE}var ab=tvBroker(tvTrading());if(!ab||typeof ab.setCurrentAccount!=='function')return {error:'no-switch-api'};var T=performance.now(),id=${JSON.stringify(String(id))},nm=${JSON.stringify(String(name || ''))};
    if(String(tvWv(ab.currentAccount()))!==id)ab.setCurrentAccount(id);
    while(performance.now()-T<6000){var n=document.querySelector('[class*=accountName]');if(String(tvWv(ab.currentAccount()))===id&&(!nm||(n&&n.innerText.trim()===nm))){await new Promise(function(z){setTimeout(z,1000)});try{await ab.positions();tvWv(tvTrading()._ordersService.activeOrders())}catch(e){return {ok:false,error:'recarga de posiciones/órdenes: '+e.message}}if(String(tvWv(ab.currentAccount()))!==id)return {ok:false,error:'la cuenta cambió durante la espera'};return {ok:true,ms:Math.round(performance.now()-T)}}await new Promise(function(z){setTimeout(z,100)})}
    return {ok:false,error:'la cuenta no quedó activa',current:String(tvWv(ab.currentAccount()))}})()`,
  position: root => `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t);if(!ab)return {error:'no-api'};var p=await tvPos(ab,${JSON.stringify(root)});if(!p)return null;
    var e=p.extra||{},pl=e.pl!=null?e.pl:p.pl,so=tvStopOrder(t,p);return {id:String(p.id),symbol:p.symbol,side:p.side===1?'long':'short',qty:p.qty,entry:p.avgPrice,price:p.lastPrice,pnl:typeof pl==='number'?pl:null,
    stopId:so?String(so.id):null,stop:so?so.stopPrice:(p.stopLoss!=null?p.stopLoss:null),stopSrc:so?'order':(p.stopLoss!=null?'bracket':null)}})()`,
  lastPrice: `(function(){try{var ms=window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries();var b=ms.bars().last();return {symbol:ms.symbol(),price:b.value[4]}}catch(e){return {error:e.message}}})()`,
  place: o => `(async function(){${PAGE}var ab=tvBroker(tvTrading());if(!tvBrokerId(ab))return {error:'No active broker'};var r=await ab.placeOrder(${JSON.stringify(o)});return {ok:r!==false,orderId:r&&(r.orderId||r.id)||null}})()`,
  // tras enviar: espera el fill (posición visible). Si no llega, busca la orden en el historial (status 5 = rechazada) y devuelve el motivo
  fill: (root, side, qty) => `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t),T=performance.now();while(performance.now()-T<6000){var p=await tvPos(ab,${JSON.stringify(root)});if(p)return {filled:true,ms:Math.round(performance.now()-T)};await new Promise(function(z){setTimeout(z,150)})}
    var h=[];try{h=await ab.ordersHistory()}catch(e){}var o=(h||[]).filter(function(x){return x&&x.type===2&&x.side===${side}&&x.qty===${qty}&&tvRoot(x.symbol)===${JSON.stringify(root)}}).pop();
    return {filled:false,status:o?o.status:null,message:o&&o.message?(o.message.text||String(o.message)):null}})()`,
  accountId: `(function(){${PAGE}var ab=tvBroker(tvTrading());try{return String(tvWv(ab.currentAccount()))}catch(e){return null}})()`,
  modify: (root, price) => `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t);if(!tvBrokerId(ab))return {error:'No active broker'};var p=await tvPos(ab,${JSON.stringify(root)});if(!p)return {error:'sin posicion'};
    // 1º editPositionBrackets (stop de bracket: hijo de la posición; Paper rechaza modifyOrder sobre él). Se reenvía el TP para no borrarlo. 2º modifyOrder si no hay bracket o no se verificó.
    var so=tvStopOrder(t,p),T0=performance.now(),tries=[];
    var tpPx=p.takeProfit!=null?p.takeProfit:null;if(tpPx==null){try{var lo=(tvWv(t._ordersService.activeOrders())||[]).find(function(o){return o&&o.type===1&&o.side===-p.side&&tvRoot(o.symbol)===tvRoot(p.symbol)});if(lo)tpPx=lo.limitPrice}catch(e){}}
    var readSL=async function(){var p2=await tvPos(ab,${JSON.stringify(root)});if(!p2)return null;var s2=tvStopOrder(t,p2);return s2&&s2.stopPrice!=null?s2.stopPrice:(p2.stopLoss!=null?p2.stopLoss:null)};
    if(ab.editPositionBrackets&&(p.stopLoss!=null||(so&&(so.parentId!=null||so.parentType!=null)))){var b={stopLoss:${Number(price)}};if(tpPx!=null)b.takeProfit=tpPx;var r1,e1=null;try{r1=await ab.editPositionBrackets(String(p.id),b)}catch(e){e1=e&&e.message||String(e)}
      var T1=performance.now(),v1=null,n=0;
      if(r1!==false&&!e1){do{v1=await readSL();if(v1===${Number(price)})break;await new Promise(function(z){setTimeout(z,100)});n++}while(performance.now()-T1<1500)}
      tries.push({via:'editPositionBrackets',payload:b,ret:r1===undefined?'undefined':r1,err:e1,verified:v1,polls:n});
      // aceptado (true/undefined, sin excepción): NO se llama modifyOrder aunque la verificación tarde
      if(r1!==false&&!e1)return {ok:v1===${Number(price)},accepted:true,via:'editPositionBrackets',verified:v1,tpKept:tpPx,tries:tries,modifyMs:Math.round(T1-T0),confirmMs:Math.round(performance.now()-T1)}}
    if(so){var o=Object.assign({},so);o.stopPrice=${Number(price)};var T2=performance.now(),r2,e2=null;try{r2=await ab.modifyOrder(o)}catch(e){e2=e&&e.message||String(e)}var T3=performance.now(),v2=await readSL();tries.push({via:'modifyOrder',orderId:String(so.id),parentId:so.parentId,ret:r2===undefined?'undefined':r2,err:e2,verified:v2});
      if(v2===${Number(price)})return {ok:true,via:'modifyOrder',verified:v2,tries:tries,modifyMs:Math.round(T3-T2),confirmMs:Math.round(performance.now()-T3)}}
    return tries.length?{ok:false,error:'no verificado: '+JSON.stringify(tries),tries:tries}:{error:'no-stop-found'}})()`,
  flatten: root => `(async function(){${PAGE}var ab=tvBroker(tvTrading());if(!tvBrokerId(ab))return {error:'No active broker'};var p=await tvPos(ab,${JSON.stringify(root)});if(!p)return {ok:true,flat:true};var r=await ab.closePosition(String(p.id));return {ok:r!==false}})()`,
};

// Conexión CDP persistente (chrome-remote-interface, dependencia de tradingview-mcp). Inyectable para tests.
export async function cdpEvaluator(port = 9222) {
  const { createRequire } = await import('node:module');
  const req = createRequire(path.join(DIR, 'tradingview-mcp/package.json'));
  const CDP = req('chrome-remote-interface');
  const targets = await CDP.List({ port }); const tgt = targets.find(t => t.type === 'page' && /tradingview\.com\/chart/.test(t.url)) || targets.find(t => t.type === 'page');
  if (!tgt) throw new Error('No encuentro la página del chart en CDP');
  let client = null;
  const connect = async () => { client = await CDP({ port, target: tgt.id }); await client.Runtime.enable(); client.on('disconnect', () => { client = null; }); };
  const evaluate = async expr => { if (!client) await connect(); const r = await client.Runtime.evaluate({ expression: expr, awaitPromise: true, returnByValue: true, timeout: 5000 }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
  return { evaluate, close: () => client && client.close() };
}

export function apiDriver(evaluate, ui = null) {
  const last = { pos: null };
  return {
    kind: 'api',
    async accounts() { const r = await evaluate(js.accounts); if (r.error) throw new Error(r.error); return r; },
    async switchAccount(id, name) { return evaluate(js.switchAccount(id, name)); },
    async accountId() { return evaluate(js.accountId); },
    async account() { const a = await evaluate(js.account); return { name: a.name, broker: [a.broker, a.brokerId].filter(Boolean).join(' '), api: a.api }; },
    async position(symbol) { const p = await evaluate(js.position(symbol)); if (p && p.error) throw new Error(p.error); last.pos = p; return p; },
    async stop() { return last.pos ? last.pos.stop : null; },
    async lastPrice() { try { const r = await evaluate(js.lastPrice); return r && typeof r.price === 'number' ? r.price : null; } catch { return null; } },
    async openBracket({ side, symbol, qty, slPts, tpPts }) {
      const lp = await evaluate(js.lastPrice); if (lp.error) return 'error: ' + lp.error;
      const cs = String(lp.symbol).replace(/^.*:/, ''), chartRoot = /^MNQ/.test(cs) ? 'MNQ' : /^NQ/.test(cs) ? 'NQ' : cs;
      if (chartRoot !== symbol) return `error: el chart está en ${lp.symbol}; pon ${symbol}1! en el chart`;
      const s = side === 'long' ? 1 : -1, px = lp.price;
      const o = { symbol: lp.symbol, side: s, type: 2, qty, stopLoss: roundTick(px - s * slPts), takeProfit: roundTick(px + s * tpPts) };
      const r = await evaluate(js.place(o)); if (r.error) return 'error: ' + r.error;
      const f = await evaluate(js.fill(symbol, s, qty));
      if (!f.filled) return `error: la orden no se llenó${f.status === 5 ? ' (RECHAZADA por TradingView)' : ''}: ${f.message || 'sin posición tras 6 s'}`;
      return `ok market ${qty} ${lp.symbol} @~${px} SL ${o.stopLoss} TP ${o.takeProfit} · fill visto en ${(f.ms / 1000).toFixed(2)} s`;
    },
    async modifyStop(price, symbol) {
      const a0 = Date.now(); let apiErr = null;
      try { const r = await evaluate(js.modify(symbol, price)); const apiMs = Date.now() - a0;
        if (!r.error && (r.ok || r.accepted)) return { ok: r.verified === price, accepted: !!r.accepted, method: 'api', via: r.via, verified: r.verified, modifyMs: r.modifyMs, confirmMs: r.confirmMs, apiMs };
        apiErr = r.error || 'modify false'; } catch (e) { apiErr = e.message; }
      const apiAttemptMs = Date.now() - a0;
      if (!ui) return { ok: false, method: 'api', err: apiErr, apiAttemptMs };
      const u0 = Date.now(), u = await ui.modifyStop(price), uiModifyMs = Date.now() - u0; // respaldo: clic en UI
      return { ok: u === 'ok', method: 'ui', via: 'ui', verified: null, raw: u, apiErr, apiAttemptMs, modifyMs: uiModifyMs };
    },
    async flatten(symbol) { const r = await evaluate(js.flatten(symbol)); return r.error ? 'error: ' + r.error : 'ok'; },
  };
}

// ---- Driver UI (respaldo): CLI de tradingview-mcp + clics. Selectores a verificar en HERO. ----
export function uiDriver() {
  const TV = path.join(DIR, 'tradingview-mcp/src/cli/index.js');
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
export async function defaultDriver() { const c = await cdpEvaluator(); return apiDriver(c.evaluate, process.env.COLCHON_UI_FALLBACK === '1' ? uiDriver() : null); } // respaldo por clics desactivado: selectores sin verificar (falló con no-input)

// ---- Controlador (usado por el servidor) ----
export function createColchon(driverOrFactory = defaultDriver, opts = {}) {
  let driver = typeof driverOrFactory === 'function' ? null : driverOrFactory;
  const D = async () => driver || (driver = await driverOrFactory());
  const poll = opts.pollMs ?? CFG.POLL_MS, logFile = opts.logFile ?? path.join(DIR, 'colchon.log');
  let S = { state: 'idle', mode: null, account: null, side: null, symbol: null, qty: null, entry: null, price: null, pnl: null, sl: null, tp: null, locked: false, lockPrice: null, error: null, startedAt: null, log: [] };
  let stopReq = false, loopP = null;
  const log = (...a) => { const s = `${new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' })} ET ${a.join(' ')}`; S.log.push(s); S.log = S.log.slice(-40); try { fs.appendFileSync(logFile, s + '\n'); } catch {} };
  async function check() { let acc; try { acc = await (await D()).account(); } catch (e) { driver = null; return { account: {}, paper: false, msg: 'Sin conexión con TradingView (CDP 9222): ' + e.message }; } const ok = isPaper(acc.name, acc.broker); return { account: acc, paper: ok, msg: ok ? 'Paper/Demo OK' : (acc.name ? 'Bloqueado: cuenta real o Lucid' : 'No veo la cuenta en TradingView') }; }
  async function loop(c, paper) {
    const st = { locked: false, fails: 0 }; const driver = await D();
    try {
      for (let i = 0; !stopReq; i++) {
        if (!opts.ignoreClock && etMin() >= CFG.FLAT_BY_MIN && etMin() < 18 * 60) { S.reason = '4:45pm'; log('4:45 PM ET: cerrar'); if (paper) log('flatten ->', await driver.flatten(c.symbol)); break; }
        if (paper && S.accountId && driver.accountId) { const cur = await driver.accountId(); if (cur && cur !== S.accountId) { S.error = `La cuenta activa cambió (${cur}) en mitad de la prueba: se deja de vigilar SIN cerrar nada. Revisa la cuenta ${S.account && S.account.name} en TradingView.`; log('ERROR', S.error); break; } }
        const tRead = Date.now(); const pos = await driver.position(c.symbol), sl = await driver.stop(); const tSeen = Date.now();
        if (pos && S.openAt == null) { S.openAt = Date.now(); log('Posición abierta (fill visto)'); }
        if (pos) { Object.assign(S, { entry: pos.entry, price: pos.price, pnl: pos.pnl, sl }); if (S.tpPrice == null && pos.entry != null) S.tpPrice = roundTick(pos.entry + (c.side === 'long' ? 1 : -1) * S.tp); }
        if (S.lockPending && sl === S.lockTarget) { S.lockPending = false; S.locked = true; S.lockPrice = sl; S.lockAt = S.lockAt || Date.now(); log(`colchón confirmado en ${sl}`); }
        const d = decide(pos, sl, st, c);
        if (d.action === 'flat') { if (paper && S.openAt == null && i < 10) { await sleep(poll); continue; }
          let lp = S.price; try { const q = driver.lastPrice && await driver.lastPrice(); if (q != null) lp = q; } catch {} const up = c.side === 'long'; S.reason = lp == null ? 'flat' : (S.tpPrice != null && (up ? lp >= S.tpPrice - TICK * 4 : lp <= S.tpPrice + TICK * 4)) ? 'tp' : ((S.lockTarget ?? S.sl) != null && (up ? lp <= (S.lockTarget ?? S.sl) + TICK * 4 : lp >= (S.lockTarget ?? S.sl) - TICK * 4)) ? 'sl' : 'flat';
          S.closeAt = Date.now(); log('Sin posición: fin del loop (' + S.reason + ')'); break; }
        if (d.action === 'skip') { st.step = d.step + 1; S.step = st.step; log(`paso ${d.step + 1}: el SL ya está más ajustado, se salta`); }
        if (d.action === 'modify') { const stp = c.steps[d.step];
          log(`[${c.strategy.name}] paso ${stp.n}/${c.steps.length}: P&L $${pos.pnl} >= $${stp.triggerUsd}: SL ${sl} -> ${d.price} (protege +$${stp.lockUsd}${c.P.NET_USD ? ` ≈ +$${c.P.NET_USD} netos` : ''})${d.step > st.step ? ` · salto de ${d.step - (st.step ?? 0)} escalón(es)` : ''}`);
          if (paper) { const t0 = Date.now(); const r = await driver.modifyStop(d.price, c.symbol); let v = r.verified, confirmMs = r.confirmMs ?? null;
            if (r.method === 'ui') { const c0 = Date.now(); await sleep(800); await driver.position(c.symbol); v = await driver.stop(); confirmMs = Date.now() - c0; }
            const tDone = Date.now(); const lat = { metodo: r.method || '?', via: r.via || '?', leerMs: tSeen - tRead, modificarMs: r.modifyMs ?? null, confirmarMs: confirmMs, apiIntentoMs: r.method === 'ui' ? r.apiAttemptMs : (r.apiMs ?? null), uiMs: r.method === 'ui' ? (r.modifyMs + confirmMs) : null, apiError: r.apiErr || null, modificarYConfirmarMs: tDone - t0, totalDesdeLecturaMs: tDone - tRead, maxRetrasoPorPollMs: poll, real: !opts.ignoreClock }; S.latency = lat; try { fs.appendFileSync(path.join(path.dirname(logFile), 'colchon-latencia.log'), JSON.stringify({ at: new Date().toISOString(), ok: v === d.price, ...lat }) + '\n'); } catch {}
            log(`LATENCIA [${lat.metodo}/${lat.via}] leer ${sg(lat.leerMs)} · modificar ${sg(lat.modificarMs)} · confirmar ${sg(lat.confirmarMs)}${lat.metodo === 'ui' ? ` · intento API ${sg(lat.apiIntentoMs)} (${lat.apiError}) · UI ${sg(lat.uiMs)}` : ''} = ${sg(lat.totalDesdeLecturaMs)} (+ hasta ${sg(poll)} entre lecturas)`);
            log(`modify via ${r.via || '?'} (${sg(tDone - t0)}) -> verificado ${v}`, v === d.price ? 'OK' : 'NO coincide ' + (r.err || r.raw || ''));
            const stepRec = { paso: stp.n, disparoUSD: stp.triggerUsd, protegeUSD: stp.lockUsd, precio: d.price, pnlAlDisparar: pos.pnl, saltados: d.step - (st.step ?? 0), latencia: lat };
            if (v === d.price || r.accepted) { stepRec.enSeg = S.openAt ? Math.round((Date.now() - S.openAt) / 100) / 10 : null; stepRec.confirmado = v === d.price; S.pasos.push(stepRec); st.step = d.step + 1; S.step = st.step; if (st.step >= c.steps.length) st.locked = true; }
            if (v === d.price) { S.locked = true; S.lockPrice = v; S.sl = v; S.lockTarget = d.price; S.lockAt = S.lockAt || Date.now(); } else if (r.accepted) { S.lockAt = S.lockAt || Date.now(); S.lockPending = true; S.lockTarget = d.price; log(`editPositionBrackets aceptado; TradingView aún no refleja ${d.price} tras 1.5 s: no se reintenta, se confirma en las próximas lecturas`); } else if (++st.fails >= 3) { st.locked = true; log('3 intentos fallidos: no se reintenta más'); } }
          else { log('SIMULACIÓN: no se modifica'); st.step = d.step + 1; S.step = st.step; if (st.step >= c.steps.length) st.locked = true; S.locked = true; S.lockPrice = d.price; }
        }
        await sleep(poll);
      }
    } catch (e) { S.error = String(e.message || e); log('ERROR', S.error); }
    S.state = stopReq ? 'stopped' : (S.error ? 'error' : 'done'); if (stopReq) S.reason = 'stop'; if (S.error) S.reason = 'error'; log('loop terminado:', S.state);
    summarize();
  }
  let last = null;
  const sg = ms => ms == null ? '?' : (ms < 1000 ? (ms / 1000).toFixed(2) : (ms / 1000).toFixed(1)) + ' s';
  const etT = t => t == null ? null : new Date(t).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', second: '2-digit' }) + ' ET';
  const seg = (a, b) => a == null || b == null ? null : Math.round((b - a) / 100) / 10;
  function tiempos() { if (S.openAt != null && S.closeAt == null && S.state !== 'running') S.closeAt = Date.now();
    return { abiertaEn: S.openAt ? new Date(S.openAt).toISOString() : null, cerradaEn: S.closeAt ? new Date(S.closeAt).toISOString() : null, abiertaET: etT(S.openAt), cerradaET: etT(S.closeAt),
      duracionSeg: seg(S.openAt, S.closeAt), colchonTrasSeg: S.locked ? seg(S.openAt, S.lockAt) : null, precisionMs: `±${poll}` }; }
  function summarize() {
    if (S.reason === 'sl' && S.lockTarget != null && !S.locked) { S.locked = true; S.lockPrice = S.lockTarget; S.sl = S.lockTarget; S.lockPending = false; } // salió por stop en el precio del colchón
    if (S.reason === 'sl' && S.lockTarget != null) S.sl = S.lockTarget;
    const pnlSL = S.sl != null && S.entry != null ? Math.round((S.sl - S.entry) * (S.side === 'long' ? 1 : -1) * PT_USD[S.symbol] * S.qty * 100) / 100 : null;
    const SP = (S.strategy && getStrategy(S.strategy.id) || getStrategy()).params; const pnlFinal = S.reason === 'tp' ? SP.TP_USD : S.reason === 'sl' ? pnlSL : S.pnl;
    last = { fin: new Date().toISOString(), cuenta: S.account && S.account.name, modo: S.mode, direccion: S.side === 'long' ? 'COMPRA' : 'VENTA', tamano: `${S.qty} ${S.symbol}`, motivo: { tp: 'Take profit', sl: 'Stop loss', stop: 'Detenido manualmente', flat: 'Posición cerrada', '4:45pm': 'Cierre 4:45 PM ET', error: 'Error' }[S.reason] || S.reason || '—',
      estrategia: S.strategy ? S.strategy.name : null, estrategiaId: S.strategy ? S.strategy.id : null, ...tiempos(), entrada: S.entry, pnlFinalUSD: pnlFinal, pnlFinalAprox: !(S.reason === 'tp' || S.reason === 'sl'), colchonMovido: S.locked, slColchon: S.lockPrice, pasos: (S.pasos || []).map(p => ({ paso: p.paso, disparoUSD: p.disparoUSD, protegeUSD: p.protegeUSD, precio: p.precio, enSeg: p.enSeg, confirmado: p.confirmado, saltados: p.saltados, latenciaSeg: p.latencia ? Math.round(p.latencia.totalDesdeLecturaMs / 10) / 100 : null })), probabilidadNecesaria: S.qty ? breakEvenFor(S.symbol, S.qty, SP) : null, pasosTotal: S.steps ? S.steps.length : null, colchonUSD: S.qty ? ((S.pasos && S.pasos.length) ? S.pasos[S.pasos.length - 1].protegeUSD : (SP.STEPS ? null : lockUsdFor(S.symbol, S.qty, SP))) : null, disparoUSD: S.qty && !SP.STEPS ? triggerUsdFor(S.symbol, S.qty, SP) : null, latencia: S.latency || null, inicio: S.startedAt, error: S.error };
    S.summary = last; try { fs.writeFileSync(path.join(path.dirname(logFile), 'colchon-resumen.json'), JSON.stringify(last, null, 2)); } catch {}
    log(`DURACIÓN ${last.duracionSeg == null ? '?' : sg(last.duracionSeg * 1000)} (${last.abiertaET ?? '?'} → ${last.cerradaET ?? '?'}, ±${sg(poll)})${last.colchonTrasSeg != null ? ` · colchón a los ${sg(last.colchonTrasSeg * 1000)}` : ''}`);
    if (last.pasos.length) log('PASOS ' + last.pasos.map(p => `#${p.paso} +$${p.protegeUSD} a los ${p.enSeg ?? '?'} s`).join(' · '));
    log('RESUMEN', JSON.stringify(last));
  }
  return {
    check,
    strategies: () => ({ ok: true, default: DEFAULT_STRATEGY, strategies: listStrategies() }),
    async accounts() { try { const r = await (await D()).accounts(); return { ok: true, ...r, accounts: r.accounts.map(a => ({ ...a, allowed: accountAllowed(a, `${r.broker} ${r.brokerId}`) })) }; } catch (e) { driver = null; return { ok: false, err: 'Sin conexión con TradingView: ' + e.message, accounts: [] }; } },
    async start(args = {}) {
      if (S.state === 'running' || acctGuard.testActive) return { ok: false, err: 'Ya hay una prueba corriendo' };
      acctGuard.testActive = true;
      if (acctGuard.fullRead) { log('Esperando a que termine la lectura de cuentas de la granja antes de operar…'); await acctGuard.fullRead; }
      let r; try { r = await this._start(args); } catch (e) { r = { ok: false, err: String(e.message || e) }; }
      if (!r.ok) acctGuard.testActive = false; return r;
    },
    async _start({ side = 'long', symbol = DEFAULT.symbol, qty, accountId, strategyId } = {}) {
      const strat = getStrategy(strategyId == null || strategyId === '' ? DEFAULT_STRATEGY : strategyId); if (!strat) return { ok: false, err: `Estrategia desconocida: ${strategyId}` };
      if (!['long', 'short'].includes(side) || !(symbol in SIZES)) return { ok: false, err: 'Parámetros inválidos' };
      qty = qty == null || qty === '' ? ((strat.params.DEFAULT_QTY || {})[symbol] ?? (symbol === DEFAULT.symbol ? DEFAULT.qty : 1)) : Number(qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > SIZES[symbol]) return { ok: false, err: `Cantidad inválida: ${symbol} entre 1 y ${SIZES[symbol]}` };
      let switched = null;
      if (accountId != null && accountId !== '') {
        const l = await this.accounts(); if (!l.ok) return { ok: false, err: l.err };
        const a = l.accounts.find(x => x.id === String(accountId)); if (!a) return { ok: false, err: 'Cuenta no encontrada' };
        if (!a.allowed) return { ok: false, blocked: true, err: `Bloqueado: ${a.name} no es Paper/Demo (o es Lucid/real)` };
        if (!a.current) { const sw = await (await D()).switchAccount(a.id, a.name); if (!sw || !sw.ok) return { ok: false, err: 'No se pudo activar la cuenta ' + a.name + ': ' + ((sw && sw.error) || '?') }; switched = { name: a.name, ms: sw.ms }; }
        const chk0 = await check(); if (chk0.account.name !== a.name) return { ok: false, err: `La cuenta activa es ${chk0.account.name}, no ${a.name}: no se opera` };
        try { const p0 = await (await D()).position(symbol); if (p0) return { ok: false, err: `Ya hay una posición de ${symbol} en ${a.name}: no se opera` }; } catch {}
      }
      const chk = await check();
      if (accountId != null && accountId !== '' && !chk.paper) return { ok: false, blocked: true, err: chk.msg };
      const P = strat.params, c = { side, symbol, qty, P, strategy: { id: strat.id, name: strat.name }, steps: stepsFor(symbol, qty, P) }, slPts = ptsFor(P.SL_USD, symbol, qty), tpPts = ptsFor(P.TP_USD, symbol, qty);
      S = { ...S, summary: null, reason: null, lockTarget: null, lockPending: false, openAt: null, closeAt: null, lockAt: null, tpPrice: null, latency: null, state: 'running', strategy: { id: strat.id, name: strat.name }, steps: stepsFor(symbol, qty, P), step: 0, pasos: [], mode: chk.paper ? 'paper' : 'simulacion', account: chk.account, side, symbol, qty, entry: null, price: null, pnl: null, sl: null, tp: tpPts, locked: false, lockPrice: null, error: null, startedAt: new Date().toISOString(), log: [] };
      stopReq = false;
      log(`Inicio [${strat.name}] ${side === 'long' ? 'COMPRA' : 'VENTA'} ${qty} ${symbol} · SL -$${P.SL_USD} (${slPts} pts) · TP +$${P.TP_USD} (${tpPts} pts) · ${P.STEPS ? (!c.steps.length ? 'stop fijo (sin movimientos)' : 'escalones ' + c.steps.map(x => `+$${x.triggerUsd}→+$${x.lockUsd} (${x.lockPts} pts)`).join(' · ')) : `colchón +$${lockUsdFor(symbol, qty, P)} (${lockPtsFor(symbol, qty, P)} pts, ≈ +$${P.NET_USD} netos), disparo +$${triggerUsdFor(symbol, qty, P)} (${triggerPtsFor(symbol, qty, P)} pts)`} · cuenta ${chk.account.name || '?'} -> ${chk.msg}`);
      if (switched) log(`Cuenta cambiada a ${switched.name} por API (${(switched.ms / 1000).toFixed(2)} s, verificada)`);
      if (!chk.paper) { log('BLOQUEADO: solo se permite en Paper/Demo. No se envía ninguna orden.'); S.state = 'blocked'; return { ok: false, blocked: true, err: chk.msg, status: S }; }
      const drv = await D(); try { S.accountId = drv.accountId ? await drv.accountId() : null; } catch { S.accountId = null; }
      if (accountId && S.accountId && S.accountId !== String(accountId)) { S.state = 'error'; S.error = 'La cuenta activa no es la elegida: no se opera'; log(S.error); return { ok: false, err: S.error, status: S }; }
      const op = await drv.openBracket({ ...c, slPts, tpPts }); log('open ->', op);
      if (String(op).startsWith('error')) { S.state = 'error'; S.error = op; S.reason = 'error'; summarize(); return { ok: false, err: op, status: S }; }
      loopP = loop(c, true).finally(() => { acctGuard.testActive = false; });
      return { ok: true, status: S };
    },
    async stop({ flatten = false } = {}) { stopReq = true; if (flatten && S.mode === 'paper') log('flatten ->', await (await D()).flatten(S.symbol)); await loopP; return { ok: true, status: S }; },
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
export const js_readAccounts = all => `(async function(){${PAGE}var t=tvTrading(),ab=tvBroker(t);if(!ab||!ab.accountsMetainfo)return {error:'no-api'};
  var sl=function(ms){return new Promise(function(z){setTimeout(z,ms)})},orig=String(tvWv(ab.currentAccount())),l=await ab.accountsMetainfo(),out=[],busy=false,aborted=false;
  // TradingView en primer plano (visible y con foco) = el usuario lo está usando: no se cambia de cuenta
  var fg=function(){try{return document.visibilityState==='visible'&&document.hasFocus()}catch(e){return true}},visible=fg(),vis0=document.visibilityState;
  try{busy=((await ab.positions())||[]).filter(function(x){return x&&Number(x.qty)!==0}).length>0||(tvWv(t._ordersService.activeOrders())||[]).length>0}catch(e){busy=true}
  var read=function(a){var m={};try{(ab.accountManagerInfo().summary||[]).forEach(function(s){m[String(s.text).toLowerCase()]=s.wValue?tvWv(s.wValue):null})}catch(e){}
    var n=document.querySelector('[class*=accountName]');return {accountId:String(a.id),name:a.name,type:a.type,balance:m['account balance'],equity:m['equity'],profit:m['profit']!=null?m['profit']:m['unrealized pnl'],shownName:n?n.innerText.trim():null}};
  var cur=l.find(function(a){return String(a.id)===orig});if(cur)out.push(read(cur));
  if(${all ? 'true' : 'false'}&&!busy&&!visible){for(const a of l){if(String(a.id)===orig)continue;if(fg()){aborted=true;break}ab.setCurrentAccount(String(a.id));var T=performance.now(),ok=false;
      while(performance.now()-T<6000){if(fg()){aborted=true;break}var n=document.querySelector('[class*=accountName]');if(String(tvWv(ab.currentAccount()))===String(a.id)&&n&&n.innerText.trim()===a.name){ok=true;break}await sl(100)}
      if(aborted)break;if(!ok)continue;for(var w=0;w<20&&!fg();w++)await sl(100);var r=read(a);if(r.shownName===a.name&&String(tvWv(ab.currentAccount()))===String(a.id))out.push(r)}
    if(String(tvWv(ab.currentAccount()))!==orig){ab.setCurrentAccount(orig);var T2=performance.now();while(performance.now()-T2<6000&&String(tvWv(ab.currentAccount()))!==orig)await sl(100);await sl(1000)}}
  return {broker:tvBrokerId(ab),current:orig,busy:busy,visible:visible,visibility:vis0,focus:(function(){try{return document.hasFocus()}catch(e){return null}})(),aborted:aborted,accounts:out,final:String(tvWv(ab.currentAccount()))}})()`;
// Exclusión mutua entre la lectura de todas las cuentas (cambia de cuenta) y una prueba (fija su cuenta):
// - con una prueba activa (o arrancando) solo se lee la cuenta activa, sin cambiar nada;
// - una prueba que arranca espera a que termine una lectura completa en curso antes de tocar la cuenta.
export const acctGuard = { testActive: false, fullRead: null };
export async function readAccounts({ all = false, evaluate = null } = {}) {
  if (all && acctGuard.testActive) all = false;
  let c = null; const ev = evaluate || (c = await cdpEvaluator()).evaluate;
  const run = (async () => { try { return await ev(js_readAccounts(all)); } finally { try { c && c.close(); } catch {} } })();
  if (all) { acctGuard.fullRead = run.catch(() => {}); run.finally(() => { acctGuard.fullRead = null; }).catch(() => {}); }
  const r = await run; if (all) r.full = true; return r;
}
