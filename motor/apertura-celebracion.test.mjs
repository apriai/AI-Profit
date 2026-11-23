import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const html = fs.readFileSync(path.join(here, 'Granja-de-Cuentas-v2.html'), 'utf8');
const bat = fs.readFileSync(path.join(root, 'acceso', 'Abrir Granja.bat'), 'utf8');
const cmd = fs.readFileSync(path.join(root, 'acceso', 'AI Profit.cmd'), 'utf8');
const nsi = fs.readFileSync(path.join(root, 'instalador', 'profito.nsi'), 'utf8');

const ganancia = 'if(p>0){try{tlPushOut(ci);tlPushOut(Ri)}catch(e){}const big=sm.motivo==="Take profit"&&!sm.pnlFinalAprox,visual=!!(sm&&sm.soloVisual);confeti(big);const j=celebra(big,visual),s=visual?false:play(big);return{tipo:"gana",big,salto:j,sonido:s}}';
assert.ok(html.includes(ganancia), 'la ganancia sigue en __tlCelebrate');
assert.equal(html.split('function celebra(big, silencio)').length - 1, 1);
assert.ok(html.includes('if(!silencio&&!muted&&ac&&ac.state==="running")'), 'el silencio solo apaga el audio de la celebración');
assert.ok(html.includes('function salto(big){return celebra(big)}'), 'un trade ganado sigue con sonido');

const ini = html.indexOf('function tlCelebrarAlAbrir()');
const fin = html.indexOf('})();})();', ini);
assert.ok(ini > 0 && fin > ini, 'hay un arranque');
const abrir = html.slice(ini, fin);
assert.ok(abrir.includes('if(tlApertura)return'), 'una sola vez');
assert.ok(abrir.includes('soloVisual:!listo'), 'el sonido va con la celebración, o no va');
assert.equal(abrir.includes('soloVisual:true'), false, 'la apertura ya no fuerza el silencio');
assert.ok(abrir.includes('if(muted){disparar(false);return}'), 'el botón de silencio apaga la fanfarria');
assert.ok(abrir.includes('setTimeout(fin,1200)'), 'si el audio no arranca, no se espera un clic');
assert.ok(abrir.includes('s.mode="sit"'), 'al terminar vuelve a dormir en el banco');
assert.ok(abrir.includes('junto:true'), 'queda constancia de que salieron juntos');
for (const no of ['__tlShowSummary', '__tlSumNew', 'localStorage', 'play(', 'negocio', 'fetch(', 'pointerdown', 'keydown']) {
  assert.equal(abrir.includes(no), false, 'la apertura no debe ' + no);
}
assert.equal(html.split('tlCelebrarAlAbrir').length - 1, 2, 'definición y reintento');

assert.ok(html.includes('window.__tlAudioCtx=function()'));
assert.ok(html.includes('if(window.__tlAudioCtx)ac=window.__tlAudioCtx()'));
assert.equal(html.includes('tocar("wuhu")'), false);
assert.equal(html.includes('__tlClic'), false);
assert.ok(html.includes('function play(big){if(muted||!ac||ac.state!=="running")return false;'));
assert.ok(html.includes('function playPerdida(){'));
assert.ok(html.includes('>v0.10.47</div>'));

const granja = fs.readFileSync(path.join(root, 'acceso', 'abrir-granja.ps1'), 'utf8');
assert.ok(granja.includes('--autoplay-policy=no-user-gesture-required'), 'el acceso pide autoplay');
assert.ok(granja.includes('--app=http://localhost:8787/Granja-de-Cuentas-v2.html'), 'abre en modo app');
assert.ok(granja.includes('--user-data-dir='), 'perfil propio para que el flag no se pierda');
assert.ok(granja.includes('navegador-granja.mjs'), 'elige el navegador predeterminado');
assert.ok(cmd.includes('AI Profit.vbs'), 'el acceso del escritorio llega a la bandeja');
assert.ok(nsi.includes('acceso\\AI Profit.vbs'), 'el instalador crea el acceso hacia la bandeja');
assert.ok(nsi.includes('wscript.exe'), 'el acceso no abre una consola');

console.log('apertura-celebracion ok');
