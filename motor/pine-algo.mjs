// Instala cada indicador de motor/pine/manifest.json en el gráfico de TradingView Desktop.
// No lee el bróker, la cuenta, el símbolo, las posiciones ni las órdenes. Si falla, el motor sigue.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PINE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pine');
export const FUENTE_PINE = path.join(PINE, 'ai-profit-camp-algo.pine');
export const PINE_DIR = PINE;

export const ALGO_NOMBRE = 'Ai Profit Camp Algo';
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
  var meta=j&&(j.result&&j.result.metaInfo||j.metaInfo)||{};
  return idDe(meta)||idDe(j&&j.result)||id||'';
}
async function poner(id){
  var c=chart(); if(!c||typeof c.createStudy!=='function') throw new Error('sin gráfico');
  var nombres=[D.nombre];
  var formas=[]; try{ formas=formasEstudio(id)||[]; }catch(e){ formas=[]; }
  for(var i=0;i<formas.length;i++) if(nombres.indexOf(formas[i])<0) nombres.push(formas[i]);
  var ultimo=null;
  for(var j=0;j<nombres.length;j++){
    try{ var sid=await c.createStudy(nombres[j], true, false); if(sid!=null) return String(sid); }catch(e){ ultimo=e; }
  }
  throw ultimo||new Error('no se pudo añadir al gráfico');
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
  var guardado='';
  try{ guardado=await guardar(id); }catch(eGuardar){
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
  function estado() {
    const algos = vista();
    return { conectado: memoria.conectado === true, fase: faseActual(), algos, texto: textoLista(algos) };
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
    if (plan === 'nada' && !migrar) {
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
    return { trabajo: anuncia, fallo: false };
  }
  async function intentar() {
    let trabajo = false;
    let fallo = false;
    try {
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
  return { intentar, sincronizar, fijar, estado, archivo, manifiesto };
}
