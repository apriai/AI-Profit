// tv-vista-previa.mjs — Vista previa del trade en TradingView.
// Dibuja, solo mientras el panel está abierto y hay un lado (BUY o SELL bajo el cursor),
// la entrada estimada, el SL y el TP. No es una orden: no llama a placeOrder, modifyOrder ni closePosition.
// No guarda el dibujo como reporte. Al cerrar o desactivar el panel se borran solo los ids de esta vista.
import { getStrategy } from './strategies.mjs';
import { paramsForAccount, maxQtyFor } from './account-size.mjs';

export const MODULO = 'tv-vista-previa';
export const TITULO = 'Vista previa';

const META = { MNQ: { pv: 2, tick: 0.25 }, NQ: { pv: 20, tick: 0.25 } };
const PROHIBIDO = /placeOrder|modifyOrder|editPositionBrackets|closePosition|cancelOrder|setCurrentAccount|removeAllShapes|saveChartToServer/;

export function raizDe(symbol) {
  const x = String(symbol || '').toUpperCase().replace(/^.*:/, '');
  if (x.startsWith('MNQ')) return 'MNQ';
  if (x.startsWith('NQ')) return 'NQ';
  return null;
}
const redondear = (p, tick) => Math.round(p / tick) * tick;

// Misma cuenta que colchon.ptsFor cuando el riesgo es en dólares: al subir contratos, la distancia en puntos baja.
// Si la estrategia trae puntos o ticks fijos, la distancia no se mueve y sí cambia el importe en dólares.
export function tramo(params, usdKey, ptsKey, ticksKey, qty, pv, tick) {
  if (!params) return null;
  if (Number.isFinite(params[ptsKey]) && params[ptsKey] > 0) {
    const pts = redondear(params[ptsKey], tick);
    return { pts, usd: Math.round(pts * pv * qty * 100) / 100, modo: 'puntos' };
  }
  if (Number.isFinite(params[ticksKey]) && params[ticksKey] > 0) {
    const pts = redondear(params[ticksKey] * tick, tick);
    return { pts, usd: Math.round(pts * pv * qty * 100) / 100, modo: 'ticks' };
  }
  if (Number.isFinite(params[usdKey]) && params[usdKey] > 0 && qty > 0 && pv > 0) {
    const pts = Math.round(params[usdKey] / (pv * qty) / tick) * tick;
    return { pts, usd: params[usdKey], modo: 'dolares' };
  }
  return null;
}

export function cuentaPreview(p = {}) {
  const name = p.accountName || p.name || null;
  return {
    name,
    id: name || p.accountId || p.id,
    type: p.accountType || p.type,
    balance: p.balance,
    equity: p.equity,
    totalPnl: p.totalPnl,
    plan: p.plan,
    start: p.start,
    planStart: p.planStart ?? p.start,
  };
}

export function nivelesPreview({ side, symbol, qty, price, params, account }) {
  const raiz = raizDe(symbol);
  const meta = META[raiz];
  if (side !== 'long' && side !== 'short') return { ok: false, motivo: 'sin-direccion' };
  if (!meta) return { ok: false, motivo: 'simbolo' };
  const tope = maxQtyFor(raiz, account || {});
  if (!Number.isInteger(qty) || qty < 1 || qty > tope) return { ok: false, motivo: 'cantidad', max: tope };
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return { ok: false, motivo: 'sin-precio' };
  const sl = tramo(params, 'SL_USD', 'SL_PTS', 'SL_TICKS', qty, meta.pv, meta.tick);
  const tp = tramo(params, 'TP_USD', 'TP_PTS', 'TP_TICKS', qty, meta.pv, meta.tick);
  if (!sl || !tp || !(sl.pts > 0) || !(tp.pts > 0)) return { ok: false, motivo: 'sin-distancia' };
  const signo = side === 'long' ? 1 : -1;
  const entrada = price;
  const stop = redondear(entrada - signo * sl.pts, meta.tick);
  const take = redondear(entrada + signo * tp.pts, meta.tick);
  const dinero = n => (n < 0 ? '−' : '') + '$' + Math.abs(Math.round(n * 100) / 100);
  const texto = `Vista previa ${side === 'long' ? 'LONG' : 'SHORT'} x${qty} ${raiz}\nSL ${dinero(-sl.usd)} · ${sl.pts} pts\nTP +${dinero(tp.usd).replace('−', '')} · ${tp.pts} pts\nestimado, no es una orden`;
  return {
    ok: true, side, symbol: raiz, qty, entrada, stop, take, sl, tp, tick: meta.tick, texto,
    ticksSl: Math.round(Math.abs(stop - entrada) / meta.tick),
    ticksTp: Math.round(Math.abs(take - entrada) / meta.tick),
  };
}

export const BARRAS = 6;
export const COLOR_SL = '#ef5350';
export const COLOR_TP = '#26a69a';

// Resolución de TradingView: "15" minutos, "60" una hora, "1S" segundos, "1D"/"D" día, "1W" semana.
// El mes ("1M"/"M") no tiene duración fija: el ancho se hace con el índice de barra, no con segundos inventados.
export function segundosPorBarra(resolution) {
  const r = String(resolution ?? '').trim().toUpperCase();
  if (!r) return null;
  if (r === 'D' || r === '1D') return 86400;
  if (r === 'W' || r === '1W') return 7 * 86400;
  const m = /^(\d+)([SDWHM])?$/.exec(r);
  if (!m) return null;
  const n = Number(m[1]);
  if (!(n > 0)) return null;
  const u = m[2] || '';
  if (u === 'S') return n;
  if (u === 'H') return n * 3600;
  if (u === 'D') return n * 86400;
  if (u === 'W') return n * 7 * 86400;
  if (u === 'M') return null;
  return n * 60;
}

export function anclaSeis({ lastTimeSec, lastIndex, resolution, barras = BARRAS } = {}) {
  const step = segundosPorBarra(resolution);
  const t0 = Number.isFinite(lastTimeSec) ? lastTimeSec : null;
  const t1 = step != null && t0 != null ? t0 + barras * step : null;
  const i0 = Number.isFinite(lastIndex) ? lastIndex : null;
  const i1 = i0 == null ? null : i0 + barras;
  return { t0, t1, i0, i1, step, barras, resolution: String(resolution || '') };
}

export function expresionVista(job) {
  const j = JSON.stringify(job);
  return `(async function(){
    var JOB=${j};
    var BARRAS=JOB.barras||6;
    var COLOR_SL=JOB.colorSl||'#ef5350';
    var COLOR_TP=JOB.colorTp||'#26a69a';
    function raiz(s){var x=String(s||'').toUpperCase().replace(/^.*:/,'');if(x.indexOf('MNQ')===0)return 'MNQ';if(x.indexOf('NQ')===0)return 'NQ';return ''}
    function paso(res){
      var r=String(res||'').toUpperCase();
      if(r==='D'||r==='1D')return 86400;
      if(r==='W'||r==='1W')return 604800;
      var m=r.match(/^(\\d+)([SDWHM])?$/);
      if(!m)return null;
      var n=+m[1], u=m[2]||'';
      if(!(n>0))return null;
      if(u==='S')return n;
      if(u==='H')return n*3600;
      if(u==='D')return n*86400;
      if(u==='W')return n*604800;
      if(u==='M')return null;
      return n*60;
    }
    var api=window.TradingViewApi; if(!api||typeof api.activeChart!=='function') return {ok:false,motivo:'sin-chart',ids:[]};
    var c=api.activeChart(); var sym=''; try{sym=c.symbol()||''}catch(e){sym=''}
    if(!JOB.borrar && raiz(sym)!==JOB.raiz) return {ok:false,motivo:'simbolo',sym:sym,ids:JOB.ids||[]};
    function widget(){try{return api._activeChartWidgetWV.value()._chartWidget}catch(e){return null}}
    function escala(){var w=widget(); try{return w&&w.model().timeScale()}catch(e){return null}}
    function ultima(){
      var w=widget(); if(!w)return null;
      try{var last=w.model().mainSeries().bars().last(); if(!last)return null; var t=last.value&&last.value[0]; if(typeof t==='number'&&t>1e12)t=Math.floor(t/1000); return {index:typeof last.index==='number'?last.index:null,time:typeof t==='number'?t:null}}catch(e){return null}
    }
    function restaurarEspacio(){
      if(typeof JOB.espacioPrev!=='number')return;
      try{var ts=escala(); if(ts&&typeof ts.setRightOffset==='function')ts.setRightOffset(JOB.espacioPrev)}catch(e){}
    }
    var ids=[];
    function fuente(id){
      var w=widget(); if(!w||id==null)return null;
      try{
        var model=w.model(); var inner=model.model?model.model():model; var src=null;
        try{if(inner.dataSourceForId)src=inner.dataSourceForId(id)}catch(e){}
        if(!src&&inner.dataSources){var all=inner.dataSources(); for(var n=0;n<all.length;n++){var sid=null; try{sid=all[n].id&&all[n].id()}catch(e2){sid=all[n].id} if(String(sid)===String(id)){src=all[n];break}}}
        return src;
      }catch(e){return null}
    }
    function presente(id){
      try{var now=c.getAllShapes()||[]; for(var i=0;i<now.length;i++) if(String(now[i].id)===String(id)) return true}catch(e){return true}
      return false;
    }
    function quitar(id){
      if(id==null) return;
      try{c.removeEntity(id)}catch(e){}
      if(!presente(id)) return;
      try{var src=fuente(id); var w=widget(); var model=w&&w.model(); var inner=model&&(model.model?model.model():model); if(src&&inner&&typeof inner.removeSource==='function') inner.removeSource(src)}catch(e2){}
    }
    if(JOB.borrar){
      var lista=[];
      for(var bi=0;bi<(JOB.ids||[]).length;bi++){
        var bid=JOB.ids[bi];
        if(bid==null||bid==='') continue;
        var bs=String(bid);
        if(lista.indexOf(bs)<0) lista.push(bs);
      }
      for(var q=0;q<lista.length;q++) quitar(lista[q]);
      var quedaron=[];
      for(var k=0;k<lista.length;k++) if(presente(lista[k])) quedaron.push(lista[k]);
      restaurarEspacio();
      return {ok:quedaron.length===0,quedaron:quedaron,borrados:lista.filter(function(id){return quedaron.indexOf(id)<0})};
    }
    var res=''; try{res=String(c.resolution?c.resolution():'')}catch(e){res=''}
    var bar=ultima();
    if(!bar||bar.time==null||bar.index==null) return {ok:false,motivo:'sin-barra',ids:[]};
    var step=paso(res);
    var t0=bar.time, t1=step!=null?t0+BARRAS*step:t0, i0=bar.index, i1=i0+BARRAS;
    var espacioPrev=null;
    if(!JOB.espacioYa){
      try{var ts=escala(); if(ts&&typeof ts.rightOffset==='function'&&typeof ts.setRightOffset==='function'){var cur=ts.rightOffset(); if(typeof cur==='number'&&cur<BARRAS+2){espacioPrev=cur; ts.setRightOffset(BARRAS+2)}}}catch(e){}
    }
    function tiempoEnIndice(idx){
      var ts=escala(); if(!ts||typeof idx!=='number') return null;
      var nombres=['indexToTimePoint','indexToUserTime','indexToTime'];
      for(var i=0;i<nombres.length;i++){
        if(typeof ts[nombres[i]]!=='function') continue;
        try{
          var v=ts[nombres[i]](idx);
          var t=typeof v==='number'?v:(v&&typeof v.timestamp==='number'?v.timestamp:(v&&typeof v.time==='number'?v.time:null));
          if(typeof t!=='number') continue;
          if(t>1e12) t=Math.floor(t/1000);
          if(t>t0) return t;
        }catch(e){}
      }
      return null;
    }
    function anchoDe(id){
      var src=fuente(id);
      if(!src||typeof src.points!=='function') return {ok:false,motivo:'sin-puntos'};
      var ps=[]; try{ps=src.points()||[]}catch(e){return {ok:false,motivo:'sin-puntos'}}
      var min=null,max=null;
      for(var i=0;i<ps.length;i++){
        var ix=ps[i]&&typeof ps[i].index==='number'?ps[i].index:null;
        if(ix==null) continue;
        if(min==null||ix<min) min=ix;
        if(max==null||ix>max) max=ix;
      }
      return {ok:min!=null&&max!=null&&(max-min)>=BARRAS,min:min,max:max,n:ps.length};
    }
    function fijarCaja(id){
      var src=fuente(id);
      if(!src||typeof src.setPoint!=='function'||typeof src.points!=='function') return {ok:false,motivo:'sin-setPoint'};
      var ps=[]; try{ps=src.points()||[]}catch(e){ps=[]}
      if(ps.length<2) return {ok:false,motivo:'sin-puntos',n:ps.length};
      var proy=tiempoEnIndice(i1);
      function dato(indice,precio,futuro){
        var o={index:indice,price:precio};
        if(!futuro) o.time=t0;
        else if(proy!=null) o.time=proy;
        return o;
      }
      var p0=typeof ps[0].price==='number'?ps[0].price:JOB.entrada;
      try{
        src.setPoint(0,dato(i0,p0,false));
        for(var n=1;n<ps.length;n++){
          var precio=typeof ps[n].price==='number'?ps[n].price:JOB.entrada;
          src.setPoint(n,dato(i1,precio,true));
        }
      }catch(e){return {ok:false,motivo:'setPoint',n:ps.length,proy:proy!=null}}
      return {ok:true,n:ps.length,proy:proy!=null};
    }
    function reponerNiveles(id){
      if(id==null) return;
      try{
        var sh=c.getShapeById(id);
        if(sh&&sh.setProperties) sh.setProperties({stopLevel:JOB.ticksSl,profitLevel:JOB.ticksTp,qty:JOB.qty});
      }catch(e){}
    }
    function nivelStop(id){
      try{
        var sh=c.getShapeById(id);
        var pr=sh&&sh.getProperties?sh.getProperties():null;
        if(!pr||typeof pr.stopLevel!=='number') return null;
        return pr.stopLevel;
      }catch(e){return null}
    }
    async function multipunto(prev,pts,opts){
      if(prev){try{var sh=c.getShapeById(prev); if(sh.setPoints){sh.setPoints(pts); return String(prev)}}catch(e){}}
      var o=Object.assign({disableSave:true,lock:false},opts);
      try{return String(await c.createMultipointShape(pts,o))}catch(e){delete o.disableSave; return String(await c.createMultipointShape(pts,o))}
    }
    async function punto(prev,pt,opts){
      if(prev){try{var sh=c.getShapeById(prev); if(sh.setPoints){sh.setPoints([pt]); return String(prev)}}catch(e){}}
      var o=Object.assign({disableSave:true,lock:false},opts);
      try{return String(await c.createShape(pt,o))}catch(e){delete o.disableSave; return String(await c.createShape(pt,o))}
    }
    try{
      function nombreDe(id){
        try{var all=c.getAllShapes(); for(var i=0;i<all.length;i++) if(String(all[i].id)===String(id)) return String(all[i].name||'');}catch(e){}
        return '';
      }
      async function raya(prev,precio,color){
        var pt={time:t0,price:precio};
        var over={linecolor:color,linewidth:2,linestyle:2};
        if(prev && /horizontal.?line/i.test(nombreDe(prev))){
          try{var sh=c.getShapeById(prev); if(sh.setPoints)sh.setPoints([pt]); try{sh.setProperties(over)}catch(e0){} return String(prev);}catch(e){}
        }
        if(prev){try{c.removeEntity(prev)}catch(e1){}}
        try{return await punto(null,pt,{shape:'horizontal_line',overrides:over});}
        catch(e2){
          try{return await punto(null,pt,{shape:'horizontal_ray',overrides:over});}
          catch(e3){return await multipunto(null,[{time:t0,price:precio},{time:t1,price:precio}],{shape:'trend_line',overrides:over});}
        }
      }
      var sl=await raya(JOB.prev&&JOB.prev.sl,JOB.stop,COLOR_SL);
      var tp=await raya(JOB.prev&&JOB.prev.tp,JOB.take,COLOR_TP);
      var forma=JOB.lado==='long'?'long_position':'short_position';
      var niveles={stopLevel:JOB.ticksSl,profitLevel:JOB.ticksTp,qty:JOB.qty};
      var box=JOB.prev&&JOB.prev.box?String(JOB.prev.box):null;
      if(box) reponerNiveles(box);
      else{
        try{box=await punto(null,{time:t0,price:JOB.entrada},{shape:forma,overrides:niveles});}
        catch(e6){try{box=await multipunto(null,[{time:t0,price:JOB.entrada},{time:t0,price:JOB.entrada}],{shape:forma,overrides:niveles})}catch(e7){box=null}}
      }
      await new Promise(function(r){setTimeout(r,50)});
      var fija=box?fijarCaja(box):{ok:false,motivo:'sin-caja'};
      await new Promise(function(r){setTimeout(r,50)});
      var medida=box?anchoDe(box):{ok:false};
      var riesgo=null;
      if(box&&medida.ok){
        reponerNiveles(box);
        await new Promise(function(r){setTimeout(r,50)});
        var tras=anchoDe(box);
        if(!tras.ok){
          fijarCaja(box);
          await new Promise(function(r){setTimeout(r,50)});
          medida=anchoDe(box);
          riesgo=false;
        }else{
          medida=tras;
          var slv=nivelStop(box);
          riesgo=slv==null?null:slv>0;
        }
      }
      if(!medida.ok&&box){quitar(box); if(!presente(box)) box=null}
      var tx=await punto(JOB.prev&&JOB.prev.tx,{time:t1,price:JOB.entrada},{shape:'text',text:JOB.texto,overrides:{color:'#ffffff',fontsize:12,bold:true,fillBackground:true,backgroundColor:'rgba(20,16,28,0.92)',backgroundTransparency:8,drawBorder:true,borderColor:'#b0b4c0',wordWrap:true,wordWrapWidth:220}});
      ids=[sl,tp,box,tx].filter(Boolean);
      try{c.getSeries().sendToBack()}catch(e2){}
      for(var k=0;k<ids.length;k++){try{c.getShapeById(ids[k]).bringToFront()}catch(e3){}}
      return {ok:true,caja:!!(medida&&medida.ok),riesgo:riesgo,ids:{sl:sl,tp:tp,box:box,tx:tx},lista:ids,espacioPrev:espacioPrev,ancla:{res:res,step:step,t0:t0,t1:t1,i0:i0,i1:i1,barras:BARRAS,min:medida&&medida.min,max:medida&&medida.max,n:medida&&medida.n,proy:!!(fija&&fija.proy)}};
    }catch(e){
      return {ok:false,motivo:'dibujo',error:String(e&&e.message||e),ids:ids,espacioPrev:espacioPrev};
    }
  })()`;
}

function textoEstado(estado) {
  if (estado === 'sin-direccion') return 'Vista previa: pasa el cursor por BUY o SELL. No envía la orden.';
  if (estado === 'apagado') return '';
  return 'Vista previa no disponible';
}

// Solo los ids que esta sesión creó. No mira color, estilo, hora ni el texto del gráfico.
export function idsPropios(registrados) {
  const out = [];
  const add = (id) => {
    if (id == null || id === '') return;
    const s = String(id);
    if (!out.includes(s)) out.push(s);
  };
  if (Array.isArray(registrados)) {
    for (const id of registrados) add(id);
    return out;
  }
  if (registrados && typeof registrados === 'object') {
    for (const k of ['sl', 'tp', 'box', 'tx']) add(registrados[k]);
    if (Array.isArray(registrados.extra)) for (const id of registrados.extra) add(id);
  }
  return out;
}

// `quedaron` es la lista que el gráfico aún ve, y solo cuenta si el id era nuestro.
export function idsQueSiguen(registrados, quedaron) {
  const propios = idsPropios(registrados);
  if (!Array.isArray(quedaron)) return propios;
  const allow = new Set(propios);
  const siguen = [];
  for (const id of quedaron) {
    const s = id == null || id === '' ? '' : String(id);
    if (allow.has(s) && !siguen.includes(s)) siguen.push(s);
  }
  return siguen;
}

export function createVistaPrevia(opt = {}) {
  let ids = null;
  let dibujadoEn = null;
  let espacioPrev = null;
  let pendiente = null;
  let corriendo = null;
  let cache = { seq: 0, respuesta: { ok: true, estado: 'apagado', texto: '' } };
  async function borrarDibujos() {
    const lista = idsPropios(ids);
    if (!lista.length) return [];
    const raiz = dibujadoEn || 'MNQ';
    let res = null;
    try {
      if (opt.dibujar) res = await opt.dibujar(expresionVista({ raiz, borrar: true, ids: lista, espacioPrev, barras: BARRAS }));
    } catch { res = null; }
    const verificados = !!(res && Array.isArray(res.quedaron));
    const siguen = verificados ? idsQueSiguen(lista, res.quedaron) : lista;
    if (verificados && !siguen.length) { ids = null; dibujadoEn = null; espacioPrev = null; return []; }
    ids = { sl: null, tp: null, box: null, tx: null, extra: siguen };
    return siguen;
  }
  async function uno(p) {
    if (pendiente && pendiente !== p) return { ok: true, estado: 'reemplazado', texto: '' };
    if (!p || p.activo !== true || (p.side !== 'long' && p.side !== 'short')) {
      if (pendiente && pendiente !== p) return { ok: true, estado: 'reemplazado', texto: '' };
      const quedaron = await borrarDibujos();
      if (pendiente && pendiente !== p) return { ok: true, estado: 'reemplazado', texto: '' };
      const estado = p && p.activo ? 'sin-direccion' : 'apagado';
      const aviso = quedaron.length ? '\nLa vista previa sigue en el gráfico.' : '';
      return { ok: !aviso, estado, texto: textoEstado(estado) + aviso };
    }
    const strat = getStrategy(p.strategyId);
    let cot = null;
    try { cot = opt.cotizar ? await opt.cotizar() : null; } catch { cot = null; }
    if (pendiente && pendiente !== p) return { ok: true, estado: 'reemplazado', texto: '' };
    const raiz = raizDe(p.symbol);
    if (!strat || !cot || typeof cot.price !== 'number' || !Number.isFinite(cot.price) || raizDe(cot.symbol) !== raiz) {
      if (dibujadoEn) await borrarDibujos();
      return { ok: false, estado: 'no-disponible', texto: textoEstado('no-disponible') };
    }
    const cuenta = cuentaPreview(p);
    const niv = nivelesPreview({ side: p.side, symbol: p.symbol, qty: Number(p.qty), price: cot.price, params: paramsForAccount(strat.params, cuenta), account: cuenta });
    if (!niv.ok) {
      if (niv.motivo === 'cantidad' && dibujadoEn) await borrarDibujos();
      return { ok: false, estado: 'no-disponible', texto: textoEstado('no-disponible') };
    }
    const expr = expresionVista({ raiz });
    if (PROHIBIDO.test(expr)) return { ok: false, estado: 'no-disponible', texto: textoEstado('no-disponible') };
    const job = { raiz, lado: p.side, entrada: niv.entrada, stop: niv.stop, take: niv.take, ticksSl: niv.ticksSl, ticksTp: niv.ticksTp, qty: niv.qty, barras: BARRAS, colorSl: COLOR_SL, colorTp: COLOR_TP, texto: niv.texto, espacioYa: espacioPrev != null, prev: ids && dibujadoEn === raiz ? ids : null };
    let res = null;
    try { res = await opt.dibujar(expresionVista(job)); } catch { res = null; }
    if (pendiente && pendiente !== p) {
      if (res && res.ids) { if (typeof res.espacioPrev === 'number' && espacioPrev == null) espacioPrev = res.espacioPrev; ids = res.ids; dibujadoEn = raiz; await borrarDibujos(); }
      return { ok: true, estado: 'reemplazado', texto: '' };
    }
    if (!res || !res.ok || !res.ids) return { ok: false, estado: 'no-disponible', texto: textoEstado('no-disponible') };
    ids = res.ids; dibujadoEn = raiz;
    if (typeof res.espacioPrev === 'number' && espacioPrev == null) espacioPrev = res.espacioPrev;
    const aviso = res.caja === false ? '\nLa caja no quedó en 6 barras futuras.' : '';
    const avisoRiesgo = res.riesgo === false ? '\nLa zona roja de riesgo no quedó en la caja.' : '';
    return { ok: true, estado: 'vista', texto: niv.texto + aviso + avisoRiesgo, niveles: { entrada: niv.entrada, stop: niv.stop, take: niv.take, slUsd: niv.sl.usd, tpUsd: niv.tp.usd, slPts: niv.sl.pts, tpPts: niv.tp.pts, modoSl: niv.sl.modo } };
  }
  function aplicar(p) {
    const seq = Number(p && p.seq) || 0;
    if (seq && cache.seq && seq < cache.seq) return Promise.resolve({ ok: true, estado: 'reemplazado', texto: '' });
    pendiente = p;
    if (seq) cache.seq = Math.max(cache.seq, seq);
    if (!corriendo) {
      corriendo = (async () => {
        while (pendiente) {
          const actual = pendiente;
          pendiente = null;
          const r = await uno(actual);
          if (r && r.estado !== 'reemplazado') cache.respuesta = r;
        }
      })().finally(() => { corriendo = null; });
    }
    return corriendo.then(() => {
      if (pendiente) return aplicar(pendiente);
      const yo = Number(p && p.seq) || 0;
      if (yo && cache.seq && yo < cache.seq) return { ok: true, estado: 'reemplazado', texto: '' };
      return cache.respuesta;
    });
  }
  return { aplicar, ids: () => ids ? { ...ids } : null };
}
