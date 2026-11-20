// Instala cada indicador de motor/pine/manifest.json en el gráfico de TradingView Desktop.
// No lee el bróker, la cuenta, el símbolo, las posiciones ni las órdenes. Si falla, el motor sigue.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PINE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pine');
export const FUENTE_PINE = path.join(PINE, 'ai-profit-camp-algo.pine');
export const PINE_DIR = PINE;

export const ALGO_NOMBRE = 'Profito Algoritmo';
export const ALGO_ANTERIOR = 'Ai Profit Camp Algo';
export const RETIRADOS = [
  {
    nombre: 'Smart Money Algo',
    tambien: ['Smart Money Structure'],
    pineId: 'USER;c372e364a273408e83cec7ca380539ca',
  },
];
export const ALGO_VERSION = '1';
const FACADE = 'https://pine-facade.tradingview.com/pine-facade';

export function esElAlgo(nombre) {
  return String(nombre || '').trim().toLowerCase() === ALGO_NOMBRE.toLowerCase();
}

export function estudiosAlgo(lista) {
  return (Array.isArray(lista) ? lista : []).filter(s => esElAlgo(s && (s.name || s.title || s.description)));
}

// nada: ya está y la versión coincide. actualizar: está, hay que reescribir el script sin duplicarlo.
// instalar: no está en el gráfico. deduplicar: hay más de uno y la versión ya es la buena.
// script$user;<hash> (Desktop 3.5.0), USER;<hash>, PUB;, STD; y Script$KIND;<hash> son el mismo estudio.
export function formasEstudio(id) {
  const raw = String(id || '').trim();
  if (!raw) return [];
  const out = [];
  const add = (x) => { const s = String(x || '').trim(); if (s && !out.includes(s)) out.push(s); };
  let kind = '';
  let hash = '';
  let m = /^script\$([A-Za-z0-9]+)[;:]([A-Za-z0-9]+)$/i.exec(raw);
  if (!m) m = /^Script\$([A-Za-z0-9]+)[;:]([A-Za-z0-9]+)$/.exec(raw);
  if (!m) m = /^([A-Za-z0-9]+)[;:]([A-Za-z0-9]+)$/.exec(raw);
  if (m) { kind = m[1].toUpperCase(); hash = m[2]; }
  if (kind && hash) {
    add(`${kind};${hash}`);
    add(`Script$${kind};${hash}`);
    add(`script$${kind.toLowerCase()};${hash}`);
    if (raw !== `${kind};${hash}` && raw !== `Script$${kind};${hash}` && raw !== `script$${kind.toLowerCase()};${hash}`) add(raw);
  } else add(raw);
  return out;
}

export function esEstudioPine(id) {
  return /script\$/i.test(String(id || '')) || /^(USER|PUB);/i.test(String(id || ''));
}

// script$user;<hash> y Script$USER;<hash>@tv-scripting-101 → USER;<hash>
export function pineIdDe(id) {
  const limpio = String(id || '').trim().replace(/@.*$/, '');
  return formasEstudio(limpio).find(f => /^(USER|PUB);/.test(f)) || '';
}

// Desktop 3.5.0: createStudy(texto) usa un inserter java y rechaza Pine.
// createStudy(metaInfo JSON) hace insertStudy(null) y falla. El editor usa
// createStudyInserter({type:'pine', pineId:'USER;<hash>', pineVersion:'last'}).
export async function insertarEstudio(chart, id, nombre) {
  if (!chart) throw new Error('sin gráfico');
  const pineId = pineIdDe(id);
  let ultimo = null;
  if (pineId) {
    try {
      const model = chart._chartWidget && chart._chartWidget.model && chart._chartWidget.model();
      if (!model || typeof model.createStudyInserter !== 'function') throw new Error('sin inserter pine');
      const ins = model.createStudyInserter({ type: 'pine', pineId, pineVersion: 'last' }, []);
      const st = await ins.insert(d => Promise.resolve({ inputs: d, parentSources: [] }));
      if (st && typeof st.id === 'function') return String(st.id());
      if (st && st.id != null) return String(st.id);
      throw new Error('Failed to create study');
    } catch (e) { ultimo = e; }
  } else if (typeof chart.createStudy === 'function') {
    const vistos = [];
    for (const n of [nombre, ...formasEstudio(id)]) {
      if (!n || vistos.includes(n)) continue;
      vistos.push(n);
      try {
        const sid = await chart.createStudy(n, true, false);
        if (sid != null) return String(sid);
      } catch (e) { ultimo = e; }
    }
  }
  throw ultimo || new Error('no se pudo añadir al gráfico');
}

export function mismoEstudioId(a, b) {
  if (a == null || b == null || a === '' || b === '') return false;
  if (String(a) === String(b)) return true;
  const formas = new Set(formasEstudio(a));
  return formasEstudio(b).some(x => formas.has(x));
}

export function textoMotivo(motivo) {
  const m = String(motivo || '').trim();
  if (!m) return '';
  if (m === 'sin-tv' || /9222|ECONN|fetch failed|No encuentro/i.test(m)) return 'TradingView no está abierto con el puerto 9222. Lo reintento.';
  if (/unexpected study id/i.test(m)) return 'TradingView no aceptó el id del estudio. Lo reintento.';
  if (/sin-broker/i.test(m)) return 'No pude leer el gráfico. Lo reintento.';
  return m.length > 180 ? m.slice(0, 180) : m;
}

export function planAlgo({ enGrafico = 0, versionGuardada = '', version = ALGO_VERSION } = {}) {
  const n = Number(enGrafico) || 0;
  if (n > 1 && versionGuardada === version) return 'deduplicar';
  if (n > 0 && versionGuardada === version) return 'nada';
  if (n > 0) return 'actualizar';
  return 'instalar';
}

export function textoAlgo(item) {
  const nombre = item && item.nombre ? item.nombre : ALGO_NOMBRE;
  if (item && item.estado === 'instalado') return `Algo TradingView: ${nombre} instalado v${item.version || ''}`;
  if (item && item.estado === 'instalando') return `Algo TradingView: ${nombre} instalando`;
  if (item && item.estado === 'error') return `Algo TradingView: ${nombre} error`;
  const por = textoMotivo(item && item.motivo);
  return por ? `Algo TradingView: ${nombre} pendiente. ${por}` : `Algo TradingView: ${nombre} pendiente`;
}

export function textoLista(algos) {
  return (algos || []).map(textoAlgo).join('\n');
}

export function cargarManifiesto(dir) {
  const lista = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
  if (!Array.isArray(lista) || !lista.length) throw new Error('manifiesto vacío');
  return lista.map(item => {
    const nombre = String(item && item.nombre || '').trim();
    const version = String(item && item.version || '').trim();
    const archivo = String(item && item.archivo || '').trim();
    const anterior = String(item && item.anterior || '').trim();
    if (!nombre || !version || !archivo) throw new Error('entrada incompleta en el manifiesto');
    if (archivo.includes('..') || path.isAbsolute(archivo)) throw new Error('ruta de indicador no permitida');
    return { nombre, version, archivo, anterior };
  });
}

export function leerFuente(ruta) {
  return fs.readFileSync(ruta, 'utf8').replace(/^\uFEFF/, '').replace(/\s+$/, '') + '\n';
}

const ESCANEO = `
function mismo(n){return String(n||'').trim().toLowerCase()===String(D.nombre).toLowerCase()}
function chart(){var api=window.TradingViewApi; if(!api||typeof api.activeChart!=='function') return null; try{return api.activeChart()}catch(e){return null}}
function meter(mapa, s){
  var id=s.id!=null?String(s.id):'';
  var name=String(s.name||'');
  var clave=(id||'')+'|'+(name||'').toLowerCase();
  if(!clave||clave==='|') return;
  if(mapa[clave]) { if(s.oculto) mapa[clave].oculto=true; return; }
  mapa[clave]={id:id, name:name, oculto:!!s.oculto};
}
function todos(){
  var mapa={};
  var c=chart();
  if(c&&typeof c.getAllStudies==='function'){
    var raw=[]; try{raw=c.getAllStudies()||[]}catch(e){raw=[]}
    for(var i=0;i<raw.length;i++){
      var s=raw[i]||{};
      var oculto=false;
      try{ if(typeof c.getStudyById==='function' && s.id!=null){ var st=c.getStudyById(s.id); if(st&&typeof st.isVisible==='function') oculto=st.isVisible()===false; } }catch(e2){}
      meter(mapa,{id:s.id, name:s.name||s.title||s.description||'', oculto:oculto});
    }
  }
  try{
    var api=window.TradingViewApi;
    var w=api._activeChartWidgetWV.value()._chartWidget;
    var model=w.model(); var inner=model.model?model.model():model;
    var all=inner.dataSources?inner.dataSources():[];
    for(var k=0;k<all.length;k++){
      var src=all[k]; var name=''; var id=''; var oculto=false;
      try{ var mi=src.metaInfo&&src.metaInfo(); name=(mi&&(mi.description||mi.shortDescription))||''; }catch(e){}
      try{ if(!name&&src.title) name=typeof src.title==='function'?src.title():String(src.title); }catch(e2){}
      try{ id=src.id&&(typeof src.id==='function'?src.id():src.id); }catch(e3){}
      try{
        if(typeof src.isVisible==='function') oculto=src.isVisible()===false;
        else if(typeof src.properties==='function'){ var vis=src.properties().visible; if(vis&&typeof vis.value==='function') oculto=vis.value()===false; }
      }catch(e4){}
      meter(mapa,{id:id, name:name, oculto:oculto});
    }
  }catch(e){}
  var out=[]; for(var key in mapa) out.push(mapa[key]);
  return out;
}
function lista(){
  return todos().filter(function(s){return mismo(s.name) || (D.studyId && (s.id===D.studyId || (typeof mismoEstudioId==='function' && mismoEstudioId(s.id, D.studyId))))});
}
`;

const IDS_JS = `${formasEstudio.toString()}\n${mismoEstudioId.toString()}\n`;
const INSERTAR_JS = `${esEstudioPine.toString()}\n${pineIdDe.toString()}\n${insertarEstudio.toString()}\n`;

// Solo lee el gráfico. No guarda, no añade y no abre el editor.
export function exprMirar({ nombre = ALGO_NOMBRE, studyId = '', anterior = '' } = {}) {
  const datos = JSON.stringify({ nombre, studyId: String(studyId || ''), mirar: true, anterior: String(anterior || '') });
  return `(async function(){
var D=${datos};
${ESCANEO}
${IDS_JS}
function porNombre(n){return todos().filter(function(s){return String(s.name||'').trim().toLowerCase()===String(n||'').toLowerCase()});}
var estudios=lista();
var primero=estudios[0];
var viejos=D.anterior?porNombre(D.anterior).filter(function(s){return !mismo(s.name);}):[];
return {ok:true, mirar:true, enGrafico:estudios.length, visible:estudios.length?(primero.oculto?false:true):null, studyId:primero&&primero.id||'', viejos:viejos.length, visibleViejo:viejos.length?!viejos[0].oculto:null};
})()`;
}

export function exprAlgo({ source, nombre = ALGO_NOMBRE, version = ALGO_VERSION, versionGuardada = '', studyIdGuardado = '', anterior = '' } = {}) {
  const datos = JSON.stringify({ source: String(source || ''), nombre, version, versionGuardada: String(versionGuardada || ''), studyId: String(studyIdGuardado || ''), anterior: String(anterior || '') });
  return `(async function(){
var D=${datos};
${ESCANEO}
${IDS_JS}
${INSERTAR_JS}
async function scriptsDe(nombre){
  var r=await fetch(${JSON.stringify(FACADE + '/list?filter=saved')},{credentials:'include'});
  if(!r.ok) throw new Error('lista '+r.status);
  var j=await r.json();
  var arr=Array.isArray(j)?j:(j&&(j.results||j.data))||[];
  return arr.filter(function(s){return String(s&&(s.scriptName||s.scriptTitle||s.name||s.title)||'').trim().toLowerCase()===String(nombre||'').toLowerCase()});
}
function idDe(s){return s&&(s.scriptIdPart||s.id)&&String(s.scriptIdPart||s.id)||''}
async function guardar(id){
  var fd=new FormData(); fd.append('source', D.source);
  var url=id
    ? ${JSON.stringify(FACADE + '/save/next/')} + encodeURIComponent(id) + '?allow_create_new=false&name=' + encodeURIComponent(D.nombre)
    : ${JSON.stringify(FACADE + '/save/new')} + '?name=' + encodeURIComponent(D.nombre) + '&allow_overwrite=true';
  var r=await fetch(url,{method:'POST',credentials:'include',body:fd});
  var j=null; try{j=await r.json()}catch(e){j=null}
  if(!r.ok|| (j&&j.success===false)) throw new Error((j&& (j.reason||j.error||j.message)) || ('guardar '+r.status));
  var meta=j&&(j.result&&j.result.metaInfo||j.metaInfo)||null;
  return idDe(meta)||idDe(j&&j.result)||id||'';
}
async function poner(id){
  var ya=lista();
  if(ya.length) return ya[0].id||'';
  return insertarEstudio(chart(), id, D.nombre);
}
function quitarIds(items){
  var c=chart(); if(!c||typeof c.removeEntity!=='function') return;
  for(var i=0;i<items.length;i++){ try{ if(items[i].id) c.removeEntity(items[i].id); }catch(e){} }
}
function quitarExtras(items){
  quitarIds(items.slice(1));
  return lista().length;
}
function ocultarEstudio(id){
  if(!id) return;
  try{ var c=chart(); var st=c&&c.getStudyById&&c.getStudyById(id); if(st&&typeof st.setVisible==='function') st.setVisible(false); }catch(e){}
}
function porNombre(n){return todos().filter(function(s){return String(s.name||'').trim().toLowerCase()===String(n||'').toLowerCase()});}
function abrirEditor(){
  var bar=window.TradingView&&window.TradingView.bottomWidgetBar;
  var claves=['pine-editor','pine_editor','scriptEditor','script-editor','pine'];
  if(bar){
    for(var i=0;i<claves.length;i++){
      try{ if(typeof bar.activateWidget==='function'){ bar.activateWidget(claves[i]); return 'api'; } }catch(e){}
    }
  }
  var nodos=document.querySelectorAll('button,[role="tab"],[data-name]');
  for(var j=0;j<nodos.length;j++){
    var tx=((nodos[j].innerText||'')+' '+(nodos[j].getAttribute('aria-label')||'')+' '+(nodos[j].getAttribute('data-name')||''));
    if(/pine/i.test(tx) && !/buy|sell|comprar|vender/i.test(tx)){ try{nodos[j].click(); return 'dom'}catch(e2){} }
  }
  return '';
}
function escribirEditor(){
  try{
    if(window.monaco&&monaco.editor&&monaco.editor.getModels){
      var models=monaco.editor.getModels()||[];
      for(var i=0;i<models.length;i++){
        var u=String(models[i].uri||'');
        if(/pine|script/i.test(u)||models.length===1){ models[i].setValue(D.source); return true; }
      }
    }
  }catch(e){}
  return false;
}
return (async function(){
  var viejos=D.anterior?porNombre(D.anterior).filter(function(s){return !mismo(s.name);}):[];
  var estudios=lista();
  if(estudios.length>0 && D.versionGuardada===D.version && estudios.length<2 && !viejos.length) return {ok:true, estado:'instalado', version:D.version, enGrafico:estudios.length, plan:'nada', visible:!estudios[0].oculto, studyId:estudios[0].id||''};
  if(estudios.length>1 && D.versionGuardada===D.version && !viejos.length){
    var quedan=quitarExtras(estudios);
    return {ok:quedan<=1, estado:quedan<=1?'instalado':'error', version:D.version, enGrafico:quedan, plan:'deduplicar'};
  }
  var id='';
  try{
    var ya=await scriptsDe(D.nombre);
    var viejosGuardados=D.anterior?await scriptsDe(D.anterior):[];
    if(ya[0]) id=idDe(ya[0]);
    else if(viejosGuardados[0]) id=idDe(viejosGuardados[0]);
  }catch(e){ id=''; }
  var guardado=id;
  try{ guardado=(await guardar(id))||id; }catch(eGuardar){
    abrirEditor();
    if(!escribirEditor()) return {ok:false, estado:'error', motivo:String(eGuardar&&eGuardar.message||eGuardar)};
    guardado=id;
  }
  abrirEditor();
  escribirEditor();
  var tras=lista();
  var studyId='';
  if(!tras.length){
    try{ studyId=await poner(guardado||id); }catch(ePoner){ return {ok:false, estado:'error', motivo:String(ePoner&&ePoner.message||ePoner), scriptId:guardado||id}; }
    if(studyId) D.studyId=String(studyId);
    tras=lista();
    if(!tras.length && studyId) tras=[{id:String(studyId), name:D.nombre}];
  } else if(tras.length>1) {
    quitarExtras(tras);
    tras=lista();
  }
  if(viejos.length) quitarIds(viejos);
  tras=lista();
  if(viejos.length && viejos[0].oculto && tras[0] && tras[0].id) ocultarEstudio(tras[0].id);
  tras=lista();
  if(!tras.length && studyId) tras=[{id:String(studyId), name:D.nombre, oculto:!!(viejos[0]&&viejos[0].oculto)}];
  if(!tras.length) return {ok:false, estado:'error', motivo:'no quedó en el gráfico', enGrafico:0, scriptId:guardado||id};
  var visibleFinal=!tras[0].oculto;
  if(viejos.length && viejos[0].oculto) visibleFinal=false;
  return {ok:true, estado:'instalado', version:D.version, enGrafico:1, visible:visibleFinal, studyId:tras[0].id||studyId, scriptId:guardado||id, plan:viejos.length?'migrar':(estudios.length?'actualizar':'instalar')};
})();
})()`;
}

function leerEstado(archivo) {
  try {
    const j = JSON.parse(fs.readFileSync(archivo, 'utf8'));
    return j && typeof j === 'object' ? j : {};
  } catch { return {}; }
}

function guardarEstado(archivo, j) {
  fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const tmp = archivo + '.tmp-' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(j));
  fs.renameSync(tmp, archivo);
}

export function exprQuitar({ nombres = [], ids = [] } = {}) {
  const datos = JSON.stringify({ quitar: true, nombres, ids: ids.map(String) });
  return `(async function(){
var D=${datos};
function chart(){var api=window.TradingViewApi; if(!api||typeof api.activeChart!=='function') return null; try{return api.activeChart()}catch(e){return null}}
function norm(n){return String(n||'').trim().toLowerCase()}
function todos(){
  var out=[], c=chart();
  if(c&&typeof c.getAllStudies==='function'){
    var raw=[]; try{raw=c.getAllStudies()||[]}catch(e){raw=[]}
    for(var i=0;i<raw.length;i++){
      var s=raw[i]||{};
      out.push({id:s.id!=null?String(s.id):'', name:String(s.name||s.title||s.description||'')});
    }
  }
  return out;
}
var c=chart();
if(!c||typeof c.removeEntity!=='function') return {ok:false, motivo:'sin-tv'};
var nombres=D.nombres.map(norm), ids=D.ids, n=0;
var lista=todos();
for(var i=0;i<lista.length;i++){
  var s=lista[i];
  if(!s.id) continue;
  if(nombres.indexOf(norm(s.name))<0 && ids.indexOf(String(s.id))<0) continue;
  try{ c.removeEntity(s.id); n++; }catch(e){}
}
return {ok:true, quitados:n};
})()`;
}

export function exprOjos({ nombres = [], accion = 'leer', nombre = '', visible = true, studyId = '' } = {}) {
  const datos = JSON.stringify({ nombres, accion, nombre, visible: !!visible, studyId: String(studyId || '') });
  return `(async function(){
var D=${datos};
function mismo(n,nombre){return String(n||'').trim().toLowerCase()===String(nombre||'').toLowerCase()}
function chart(){var api=window.TradingViewApi; if(!api||typeof api.activeChart!=='function') return null; try{return api.activeChart()}catch(e){return null}}
function meter(mapa,s){
  var id=s.id!=null?String(s.id):''; var name=String(s.name||'');
  var clave=id+'|'+name.toLowerCase(); if(clave==='|') return;
  if(mapa[clave]){ if(s.oculto) mapa[clave].oculto=true; return; }
  mapa[clave]={id:id,name:name,oculto:!!s.oculto};
}
function todos(){
  var mapa={}, c=chart();
  if(c&&typeof c.getAllStudies==='function'){
    var raw=[]; try{raw=c.getAllStudies()||[]}catch(e){raw=[]}
    for(var i=0;i<raw.length;i++){
      var s=raw[i]||{}, oculto=false;
      try{ if(s.id!=null&&typeof c.getStudyById==='function'){ var st=c.getStudyById(s.id); if(st&&typeof st.isVisible==='function') oculto=st.isVisible()===false; } }catch(e2){}
      meter(mapa,{id:s.id,name:s.name||s.title||s.description||'',oculto:oculto});
    }
  }
  try{
    var w=window.TradingViewApi._activeChartWidgetWV.value()._chartWidget;
    var model=w.model(); var inner=model.model?model.model():model;
    var all=inner.dataSources?inner.dataSources():[];
    for(var k=0;k<all.length;k++){
      var src=all[k], name='', id='', oculto=false;
      try{ var mi=src.metaInfo&&src.metaInfo(); name=(mi&&(mi.description||mi.shortDescription))||''; }catch(e){}
      try{ if(!name&&src.title) name=typeof src.title==='function'?src.title():String(src.title); }catch(e2){}
      try{ id=src.id&&(typeof src.id==='function'?src.id():src.id); }catch(e3){}
      try{ if(typeof src.isVisible==='function') oculto=src.isVisible()===false; else if(typeof src.properties==='function'){ var vis=src.properties().visible; if(vis&&typeof vis.value==='function') oculto=vis.value()===false; } }catch(e4){}
      meter(mapa,{id:id,name:name,oculto:oculto});
    }
  }catch(e){}
  var out=[]; for(var key in mapa) out.push(mapa[key]);
  return out;
}
function de(nombre, id){
  return todos().filter(function(s){return mismo(s.name,nombre) || (id && s.id===id)});
}
if(D.accion==='leer'){
  var items=[];
  for(var i=0;i<D.nombres.length;i++){
    var hallados=de(D.nombres[i],'');
    items.push({nombre:D.nombres[i], enGrafico:hallados.length, visible:hallados.length? !hallados[0].oculto : null, studyId:hallados[0]?hallados[0].id:''});
  }
  return {ok:true, items:items};
}
var uno=de(D.nombre, D.studyId);
if(!uno.length) return {ok:false, estado:'error', motivo:'no está en el gráfico'};
var c=chart();
var aplicado=false;
try{ var st=c.getStudyById&&c.getStudyById(uno[0].id); if(st&&typeof st.setVisible==='function'){ st.setVisible(!!D.visible); aplicado=true; } }catch(e){}
if(!aplicado){
  try{
    var w=window.TradingViewApi._activeChartWidgetWV.value()._chartWidget;
    var model=w.model(); var inner=model.model?model.model():model;
    var all=inner.dataSources?inner.dataSources():[];
    for(var n=0;n<all.length;n++){
      var src=all[n], id='';
      try{ id=src.id&&(typeof src.id==='function'?src.id():src.id); }catch(e2){}
      if(String(id)!==String(uno[0].id)) continue;
      var vis=src.properties&&src.properties().visible;
      if(vis&&typeof vis.setValue==='function'){ vis.setValue(!!D.visible); aplicado=true; }
    }
  }catch(e3){}
}
if(!aplicado) return {ok:false, estado:'error', motivo:'no pude cambiar la visibilidad'};
return {ok:true, visible:!!D.visible, studyId:uno[0].id};
})()`;
}

// Duración de un marco de TradingView, en ms. Número solo = minutos. 15S = segundos. 1H, 1D, 1W, 1M.
export function duracionMarcoMs(resolucion) {
  const s = String(resolucion ?? '').trim().toUpperCase();
  if (!s) return null;
  if (/^\d+$/.test(s)) { const n = Number(s); return n > 0 ? n * 60 * 1000 : null; }
  const m = s.match(/^(\d*)([SDWHM])$/);
  if (!m) return null;
  const n = m[1] ? Number(m[1]) : 1;
  if (!Number.isFinite(n) || n <= 0) return null;
  const u = m[2];
  if (u === 'S') return n * 1000;
  if (u === 'H') return n * 3600000;
  if (u === 'D') return n * 86400000;
  if (u === 'W') return n * 7 * 86400000;
  if (u === 'M') return n * 30 * 86400000;
  return null;
}
// info.time de TradingView llega en segundos (≈1e9) o en ms (≈1e12).
export function barraEnMs(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1e12 ? n * 1000 : n;
}
const SESGO_VELA_MS = 3000;
// La vela en vivo es la que contiene «ahora». Margen corto por desfase de reloj.
// Si el marco no se reconoce, se usa 1 minuto: una barra más vieja que eso no es la de ahora.
export function velaEnVivo(barra, resolucion, ahora) {
  const inicio = barraEnMs(barra);
  const now = Number(ahora);
  if (inicio == null || !Number.isFinite(now)) return false;
  const dur = duracionMarcoMs(resolucion) ?? 60 * 1000;
  return now + SESGO_VELA_MS >= inicio && now < inicio + dur + SESGO_VELA_MS;
}
// Suena solo en la vela en vivo, cada vez que el círculo pasa de apagado a encendido.
// Un cambio de marco o de símbolo reanuda y no suena hasta que la misma barra se repite ~1 s.
// Una vela pasada no suena y no deja el círculo marcado, para no tapar la vela en vivo.
export function decidirToque(estado, lectura, ahora) {
  const nada = { tocar: false, lado: null, barra: null };
  if (!estado || typeof estado !== 'object' || Array.isArray(estado) || estado instanceof Set) return nada;
  if (!lectura || lectura.ok !== true) return nada;
  if (lectura.visible === false || !lectura.enGrafico) return nada;
  const barra = lectura.barra;
  if (barra == null || barra === '') return nada;
  const res = lectura.resolucion != null ? String(lectura.resolucion) : '';
  const sim = lectura.simbolo != null ? String(lectura.simbolo) : '';
  const clave = res + '\n' + sim;
  const now = Number.isFinite(+ahora) ? +ahora : (Number.isFinite(+lectura.ahora) ? +lectura.ahora : Date.now());
  const meta = { barra, resolucion: res, simbolo: sim };
  if (estado.clave == null || estado.clave !== clave) {
    const cambio = estado.clave != null;
    estado.clave = clave;
    estado.resolucion = res;
    estado.simbolo = sim;
    estado.esperaMarco = cambio;
    estado.estableBarra = null;
    estado.estableDesde = null;
    if (cambio || !velaEnVivo(barra, res, now)) {
      estado.barra = null;
      estado.alcista = false;
      estado.bajista = false;
    } else {
      estado.barra = barra;
      estado.alcista = !!lectura.alcista;
      estado.bajista = !!lectura.bajista;
    }
    return { tocar: false, lado: null, rebaseline: true, ...meta };
  }
  if (!velaEnVivo(barra, res, now)) return { tocar: false, lado: null, pasada: true, ignorada: true, ...meta };
  if (estado.esperaMarco) {
    if (String(estado.estableBarra) !== String(barra)) {
      estado.estableBarra = barra;
      estado.estableDesde = now;
      return { tocar: false, lado: null, estabilizando: true, ...meta };
    }
    if (now - estado.estableDesde < 1000) return { tocar: false, lado: null, estabilizando: true, ...meta };
    estado.esperaMarco = false;
    estado.barra = barra;
    estado.alcista = false;
    estado.bajista = false;
  }
  if (String(estado.barra) !== String(barra)) {
    estado.barra = barra;
    estado.alcista = false;
    estado.bajista = false;
  }
  const alcista = !!lectura.alcista;
  const bajista = !!lectura.bajista;
  const subeAlcista = alcista && !estado.alcista;
  const subeBajista = bajista && !estado.bajista;
  estado.alcista = alcista;
  estado.bajista = bajista;
  const tocar = subeAlcista || subeBajista;
  const lado = subeAlcista ? 'alcista' : (subeBajista ? 'bajista' : null);
  return { tocar, lado, ...meta };
}

// Lee Alcista/Bajista en la última vela (la que se está formando). No toca órdenes ni la cuenta.
export function exprSenal({ nombre = ALGO_NOMBRE } = {}) {
  const datos = JSON.stringify({ nombre });
  return `(function(){
var D=${datos};
function finito(v){return typeof v==='number'&&isFinite(v)}
function chart(){var api=window.TradingViewApi; if(!api||typeof api.activeChart!=='function') return null; try{return api.activeChart()}catch(e){return null}}
function mismo(n){return String(n||'').trim().toLowerCase()===String(D.nombre||'').trim().toLowerCase()}
function idDe(src){try{var id=src&&src.id&&(typeof src.id==='function'?src.id():src.id); return id!=null?String(id):''}catch(e){return ''}}
function nombreDe(src){
  try{var mi=src.metaInfo&&src.metaInfo(); var n=mi&&(mi.description||mi.shortDescription); if(n) return String(n)}catch(e){}
  try{if(src.title) return typeof src.title==='function'?String(src.title()):String(src.title)}catch(e2){}
  return '';
}
function fuentes(){
  var out=[];
  try{
    var api=window.TradingViewApi;
    var w=api._activeChartWidgetWV.value()._chartWidget;
    var model=w.model(); var inner=model.model?model.model():model;
    var all=inner.dataSources?inner.dataSources():[];
    for(var i=0;i<all.length;i++) if(all[i]) out.push(all[i]);
  }catch(e){}
  return out;
}
function oculto(c, src, id){
  try{ if(c&&typeof c.getStudyById==='function'&&id){ var st=c.getStudyById(id); if(st&&typeof st.isVisible==='function'&&st.isVisible()===false) return true; } }catch(e){}
  try{ if(src&&typeof src.isVisible==='function'&&src.isVisible()===false) return true; }catch(e2){}
  try{ var vis=src&&src.properties&&src.properties().visible; if(vis&&typeof vis.value==='function'&&vis.value()===false) return true; }catch(e3){}
  return false;
}
function indices(mi){
  var plots=mi&&mi.plots||[], styles=mi&&mi.styles||{}, al=-1, ba=-1, lineas=[];
  for(var i=0;i<plots.length;i++){
    var id=plots[i]&&plots[i].id;
    var st=styles[id]||{};
    var t=String(st.title||st.text||'').toLowerCase();
    var ty=String(plots[i]&&plots[i].type||'').toLowerCase();
    if(t==='alcista') al=i;
    if(t==='bajista') ba=i;
    if(ty!=='bar_colorer'&&ty!=='bg_colorer'&&ty!=='text_colorer') lineas.push(i);
  }
  if(al<0&&lineas.length) al=lineas[0];
  if(ba<0&&lineas.length>1) ba=lineas[1];
  return {al:al, ba:ba};
}
function infoDe(item){
  if(!item) return null;
  var value=item.value!=null?item.value:item;
  var time=null;
  try{ if(item.index!=null) time=item.index; }catch(e){}
  if(value&&finito(value[0])&&value[0]>1e8) time=value[0];
  else if(time==null&&value&&finito(value[0])) time=value[0];
  return {time:time, value:value};
}
function ultimo(src){
  var filasSrc=filas(src, 1);
  return filasSrc.length?infoDe(filasSrc[filasSrc.length-1]):null;
}
function filas(src, n){
  var data=null, bars=null, items=[];
  try{ data=src&&src.data&&src.data(); }catch(e){}
  try{ bars=data&&typeof data.bars==='function'?data.bars():null; }catch(e2){}
  if(!bars&&src){ try{ bars=src.bars&&typeof src.bars==='function'?src.bars():(src._data&&typeof src._data.bars==='function'?src._data.bars():src._data); }catch(e3){} }
  try{
    if(bars&&bars._items&&bars._items.length){
      var a=bars._items, i0=Math.max(0, a.length-n);
      for(var i=i0;i<a.length;i++) if(a[i]) items.push(a[i]);
    } else if(bars&&typeof bars.last==='function'){
      var last=bars.last(); if(last) items.push(last);
    }
  }catch(e4){}
  return items;
}
function abiertaDe(value){
  if(!value||!finito(value[1])) return null;
  if(finito(value[0])&&value[0]>1e8&&value[1]>1e8) return null;
  return value[1];
}
function plotEn(info, idx){
  if(!info||idx<0||!info.value) return false;
  var value=info.value, base=0;
  if(finito(value[0])&&(value[0]===info.time||value[0]>1e8)) base=1;
  return finito(value[base+idx]);
}
try{
  var c=chart();
  var res='', sim='';
  try{ if(c&&typeof c.resolution==='function') res=String(c.resolution()||''); }catch(eR){}
  try{ if(c&&typeof c.symbol==='function') sim=String(c.symbol()||''); }catch(eS){}
  var lista=[];
  if(c&&typeof c.getAllStudies==='function'){
    var raw=[]; try{raw=c.getAllStudies()||[]}catch(e){raw=[]}
    for(var i=0;i<raw.length;i++){ var s=raw[i]||{}; if(mismo(s.name||s.title||s.description)) lista.push({id:s.id!=null?String(s.id):'', src:null}); }
  }
  var fuentesLista=fuentes();
  for(var k=0;k<fuentesLista.length;k++){
    var src=fuentesLista[k], nom=nombreDe(src), id=idDe(src);
    if(!mismo(nom)) continue;
    var ya=false;
    for(var n=0;n<lista.length;n++){ if(lista[n].id&&id&&lista[n].id===id){ lista[n].src=src; ya=true; } }
    if(!ya) lista.push({id:id, src:src});
  }
  if(!lista.length) return {ok:true, enGrafico:0, visible:false, barra:null, alcista:false, bajista:false, resolucion:res, simbolo:sim};
  var elegido=null;
  for(var p=0;p<lista.length;p++){
    var item=lista[p];
    if(!item.src){ for(var q=0;q<fuentesLista.length;q++){ if(idDe(fuentesLista[q])&&item.id&&idDe(fuentesLista[q])===item.id) item.src=fuentesLista[q]; } }
    if(oculto(c, item.src, item.id)) continue;
    elegido=item; break;
  }
  if(!elegido) return {ok:true, enGrafico:lista.length, visible:false, barra:null, alcista:false, bajista:false, resolucion:res, simbolo:sim};
  var mi=null; try{ mi=elegido.src&&elegido.src.metaInfo&&elegido.src.metaInfo(); }catch(e6){}
  var ix=indices(mi||{});
  var info=elegido.src?ultimo(elegido.src):null;
  if(!info||info.time==null) return {ok:true, enGrafico:lista.length, visible:true, barra:null, alcista:false, bajista:false, resolucion:res, simbolo:sim, velas:[]};
  function guardarAbierta(map, time, ap){
    if(ap==null||time==null) return;
    map[String(time)]=ap;
    if(finito(time)&&time>1e8&&time<1e12) map[String(Math.round(time*1000))]=ap;
    else if(finito(time)&&time>=1e12) map[String(Math.round(time/1000))]=ap;
  }
  function tomarAbierta(map, time){
    if(time==null) return null;
    if(map[String(time)]!=null) return map[String(time)];
    if(finito(time)&&time>1e8&&time<1e12&&map[String(Math.round(time*1000))]!=null) return map[String(Math.round(time*1000))];
    if(finito(time)&&time>=1e12&&map[String(Math.round(time/1000))]!=null) return map[String(Math.round(time/1000))];
    return null;
  }
  var velas=[], abiertas={}, vivaBarra=null;
  try{
    var ms=window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries();
    var fils=filas(ms, 12);
    for(var bi=0;bi<fils.length;bi++){
      var ib=infoDe(fils[bi]);
      if(!ib||ib.time==null) continue;
      var ap=abiertaDe(ib.value);
      if(ap!=null) guardarAbierta(abiertas, ib.time, ap);
      vivaBarra=ib.time;
    }
  }catch(eM){}
  var filsS=elegido.src?filas(elegido.src, 12):[];
  for(var si=0;si<filsS.length;si++){
    var is=infoDe(filsS[si]);
    if(!is||is.time==null) continue;
    velas.push({barra:is.time, abierta:tomarAbierta(abiertas, is.time), alcista:plotEn(is, ix.al), bajista:plotEn(is, ix.ba)});
  }
  var precio=null;
  try{
    var ms2=window.TradingViewApi._activeChartWidgetWV.value()._chartWidget.model().mainSeries();
    var qq=(ms2.quotes&&ms2.quotes())||{};
    function num(v){var x=typeof v==='number'?v:+v; return typeof x==='number'&&isFinite(x)&&x>0?x:null}
    precio={bid:num(qq.bid), ask:num(qq.ask), last:num(qq.last!=null?qq.last:qq.trade)};
  }catch(eQ){}
  return {ok:true, enGrafico:lista.length, visible:true, barra:info.time, alcista:plotEn(info, ix.al), bajista:plotEn(info, ix.ba), resolucion:res, simbolo:sim, velas:velas, precio:precio, vivaBarra:vivaBarra};
}catch(e){ return {ok:false}; }
})()`;
}

export function crearAlgoTv({
  dir,
  pineDir = PINE_DIR,
  evaluar,
  log = () => {},
} = {}) {
  const archivo = path.join(dir, 'algo-tv.json');
  const manifiesto = cargarManifiesto(pineDir);
  let memoria = leerEstado(archivo);
  if (!memoria.algos) memoria.algos = {};
  if (memoria.fase === 'instalando') { memoria.fase = null; memoria.faseHasta = 0; }
  const vista = () => manifiesto.map(m => {
    const g = memoria.algos[m.nombre] || {};
    return {
      nombre: m.nombre,
      version: g.estado === 'instalado' ? (g.version || m.version) : (g.version || ''),
      estado: g.estado || 'pendiente',
      motivo: g.motivo || '',
      visible: g.visible === true ? true : g.visible === false ? false : null,
    };
  });
  const publicar = (nombre, parcial, version) => {
    const prev = memoria.algos[nombre] || {};
    memoria.algos[nombre] = {
      ...prev,
      ...parcial,
      nombre,
      version: parcial.estado === 'instalado' ? version : (prev.version || ''),
      at: new Date().toISOString(),
    };
    memoria.texto = textoLista(vista());
    try { guardarEstado(archivo, memoria); } catch (e) { log('algo: no pude guardar el estado', e && e.message); }
    return estado();
  };
  function faseActual() {
    if (memoria.fase === 'listos' && memoria.faseHasta && Date.now() > memoria.faseHasta) {
      memoria.fase = null;
      memoria.faseHasta = 0;
    }
    return memoria.fase === 'instalando' || memoria.fase === 'listos' ? memoria.fase : null;
  }
  const estadoSenal = { barra: null, alcista: false, bajista: false };
  let senal = { seq: 0, barra: null, lado: null };
  let senalEnCurso = false;
  let lecturaProfito = null;
  let firmaAjuste = '';
  function estado() {
    const algos = vista();
    return { conectado: memoria.conectado === true, fase: faseActual(), algos, texto: textoLista(algos), senal: { seq: senal.seq, barra: senal.barra, lado: senal.lado } };
  }
  async function oirSenal() {
    if (senalEnCurso) return estado();
    senalEnCurso = true;
    try {
      const r = await evaluar(exprSenal({ nombre: ALGO_NOMBRE }));
      if (r && r.ok) lecturaProfito = { velas: Array.isArray(r.velas) ? r.velas : [], resolucion: r.resolucion || '', simbolo: r.simbolo || '', precio: r.precio || null, vivaBarra: r.vivaBarra != null ? r.vivaBarra : null, leido: Date.now() };
      const d = decidirToque(estadoSenal, r || {});
      if (d.rebaseline) log(`Señal Profito Algoritmo: marco reanudado (${d.resolucion || '?'} ${d.simbolo || '?'}, barra ${d.barra})`);
      if (d.pasada) log(`Señal Profito Algoritmo: vela pasada ignorada (${d.resolucion || '?'} ${d.simbolo || '?'}, barra ${d.barra})`);
      if (d.tocar) {
        senal = { seq: senal.seq + 1, barra: d.barra, lado: d.lado };
        log(`Señal Profito Algoritmo: barra ${d.barra} · ${d.resolucion || '?'} · ${d.lado}`);
      }
    } catch { /* el gráfico a veces no deja leer el estudio; no suena y no se cae */ }
    finally { senalEnCurso = false; }
    return estado();
  }
  async function sincronizar() {
    try {
      const r = await evaluar(exprOjos({ nombres: manifiesto.map(m => m.nombre), accion: 'leer' }));
      if (!r || !r.ok || !Array.isArray(r.items)) { memoria.conectado = false; memoria.texto = textoLista(vista()); try { guardarEstado(archivo, memoria); } catch {} return estado(); }
      memoria.conectado = true;
      for (const item of r.items) {
        const prev = memoria.algos[item.nombre] || { nombre: item.nombre };
        memoria.algos[item.nombre] = { ...prev, nombre: item.nombre, visible: item.visible === true ? true : item.visible === false ? false : null, studyId: item.studyId || prev.studyId || '' };
      }
      memoria.texto = textoLista(vista());
      try { guardarEstado(archivo, memoria); } catch (e) { log('algo: no pude guardar el estado', e && e.message); }
      return estado();
    } catch (e) {
      const msg = String(e && e.message || e);
      if (/ECONN|9222|chart|WebSocket|fetch failed|No encuentro/i.test(msg)) memoria.conectado = false;
      return estado();
    }
  }
  async function fijar(nombre, visible) {
    const m = manifiesto.find(x => String(x.nombre).toLowerCase() === String(nombre || '').trim().toLowerCase());
    if (!m) return { ok: false, motivo: 'desconocido', ...estado() };
    const prev = memoria.algos[m.nombre] || {};
    try {
      const r = await evaluar(exprOjos({ accion: 'fijar', nombre: m.nombre, visible: !!visible, studyId: prev.studyId || '' }));
      if (!r || !r.ok) { memoria.conectado = false; return { ok: false, motivo: (r && r.motivo) || 'no se pudo', ...estado() }; }
      memoria.conectado = true;
      memoria.algos[m.nombre] = { ...prev, nombre: m.nombre, visible: !!r.visible, studyId: r.studyId || prev.studyId || '' };
      memoria.texto = textoLista(vista());
      try { guardarEstado(archivo, memoria); } catch (e) { log('algo: no pude guardar el estado', e && e.message); }
      return { ok: true, ...estado() };
    } catch (e) {
      memoria.conectado = false;
      log('algo:', m.nombre, e && e.message);
      return { ok: false, motivo: String(e && e.message || e), ...estado() };
    }
  }
  function cerrarAviso(listos) {
    memoria.fase = listos ? 'listos' : null;
    memoria.faseHasta = listos ? Date.now() + 12000 : 0;
    try { guardarEstado(archivo, memoria); } catch (e) { log('algo: no pude guardar el estado', e && e.message); }
  }
  async function uno(m) {
    const prev = memoria.algos[m.nombre] || {};
    const sondeo = await evaluar(exprMirar({ nombre: m.nombre, studyId: prev.studyId || '', anterior: m.anterior || '' }));
    if (!sondeo || sondeo.mirar !== true) {
      publicar(m.nombre, { estado: 'pendiente', motivo: (sondeo && sondeo.motivo) || 'sin-tv' }, m.version);
      return { trabajo: false, fallo: false, sinTv: true };
    }
    const plan = planAlgo({ enGrafico: sondeo.enGrafico, versionGuardada: prev.version || '', version: m.version });
    const migrar = (sondeo.viejos || 0) > 0;
    const yaEnGrafico = sondeo.enGrafico === 1 && !migrar && !prev.version;
    if ((plan === 'nada' && !migrar) || yaEnGrafico) {
      const visible = sondeo.visible === true ? true : sondeo.visible === false ? false : null;
      publicar(m.nombre, { estado: 'instalado', motivo: '', visible, studyId: sondeo.studyId || prev.studyId || '' }, m.version);
      return { trabajo: false, fallo: false };
    }
    const anuncia = plan === 'instalar' || plan === 'actualizar' || migrar;
    if (anuncia) {
      memoria.fase = 'instalando';
      memoria.faseHasta = 0;
      publicar(m.nombre, { estado: 'instalando', motivo: '' }, m.version);
    }
    const source = leerFuente(path.join(pineDir, m.archivo));
    let r;
    try {
      r = await evaluar(exprAlgo({
        source, nombre: m.nombre, version: m.version,
        versionGuardada: prev.version || '', studyIdGuardado: prev.studyId || sondeo.studyId || '',
        anterior: m.anterior || '',
      }));
    } catch (e) {
      const msg = String(e && e.message || e);
      const sinTv = /ECONN|9222|chart|WebSocket|fetch failed|No encuentro/i.test(msg);
      publicar(m.nombre, { estado: 'pendiente', motivo: sinTv ? 'sin-tv' : msg }, m.version);
      return { trabajo: anuncia, fallo: true, sinTv };
    }
    if (!r || typeof r !== 'object' || r.estado !== 'instalado') {
      log('algo:', m.nombre, (r && r.motivo) || 'error');
      publicar(m.nombre, { estado: 'pendiente', motivo: String((r && r.motivo) || 'error') }, m.version);
      return { trabajo: anuncia, fallo: true };
    }
    log('algo:', m.nombre, 'instalado v' + m.version + (r.plan ? ' (' + r.plan + ')' : ''));
    const visible = typeof r.visible === 'boolean' ? r.visible : (sondeo.visible === true ? true : sondeo.visible === false ? false : prev.visible);
    publicar(m.nombre, { estado: 'instalado', motivo: '', visible, scriptId: r.scriptId || prev.scriptId || '', studyId: r.studyId || sondeo.studyId || prev.studyId || '' }, m.version);
    if (m.anterior && memoria.algos[m.anterior]) delete memoria.algos[m.anterior];
    try { guardarEstado(archivo, memoria); } catch {}
    return { trabajo: anuncia, fallo: false };
  }
  async function quitarRetirados() {
    memoria.quitados = Array.isArray(memoria.quitados) ? memoria.quitados : [];
    const pendientes = RETIRADOS.filter(q => !memoria.quitados.includes(q.nombre));
    if (!pendientes.length) return;
    const conRegistro = [];
    let cambio = false;
    for (const q of pendientes) {
      const nombres = [q.nombre, ...(q.tambien || [])];
      if (!nombres.some(n => memoria.algos && memoria.algos[n])) {
        memoria.quitados.push(q.nombre);
        cambio = true;
        continue;
      }
      conRegistro.push(q);
    }
    if (!conRegistro.length) {
      if (cambio) { try { guardarEstado(archivo, memoria); } catch {} }
      return;
    }
    const nombres = [];
    const ids = [];
    for (const q of conRegistro) {
      for (const n of [q.nombre, ...(q.tambien || [])]) {
        nombres.push(n);
        const prev = memoria.algos[n];
        if (prev && prev.studyId) ids.push(String(prev.studyId));
      }
    }
    let r;
    try { r = await evaluar(exprQuitar({ nombres, ids })); } catch { return; }
    if (!r || r.ok !== true) return;
    for (const q of conRegistro) {
      for (const n of [q.nombre, ...(q.tambien || [])]) delete memoria.algos[n];
      if (!memoria.quitados.includes(q.nombre)) memoria.quitados.push(q.nombre);
    }
    try { guardarEstado(archivo, memoria); } catch (e) { log('algo: no pude guardar el estado', e && e.message); }
  }
  async function intentar() {
    let trabajo = false;
    let fallo = false;
    try {
      await quitarRetirados();
      for (const m of manifiesto) {
        try {
          const r = await uno(m);
          if (r && r.trabajo) trabajo = true;
          if (r && r.fallo) fallo = true;
          if (r && r.sinTv) break;
        } catch (e) {
          const msg = String(e && e.message || e);
          const sinTv = /ECONN|9222|chart|WebSocket|fetch failed|No encuentro/i.test(msg);
          const prev = memoria.algos[m.nombre] || {};
          if (sinTv && prev.estado === 'instalado' && prev.version === m.version) continue;
          fallo = true;
          publicar(m.nombre, { estado: 'pendiente', motivo: sinTv ? 'sin-tv' : msg }, m.version);
          if (sinTv) break;
        }
      }
      if (trabajo) cerrarAviso(!fallo);
      return estado();
    } catch (e) {
      if (trabajo) cerrarAviso(false);
      log('algo: error', e && e.message);
      return estado();
    }
  }
  function anotarAjuste(linea, firma) {
    if (!linea || !firma || firma === firmaAjuste) return;
    firmaAjuste = firma;
    log(linea);
  }
  return { intentar, sincronizar, fijar, estado, oirSenal, lecturaProfito: () => lecturaProfito, anotarAjuste, archivo, manifiesto };
}
