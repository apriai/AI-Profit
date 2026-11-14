import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, 'Granja-de-Cuentas-v2.html'), 'utf8');

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
assert.ok(abrir.includes('window.__tlCelebrate({pnlFinalUSD:1,motivo:"Take profit",pnlFinalAprox:false,soloVisual:true})'), 'reutiliza la celebración grande, solo visual');
assert.ok(abrir.includes('s.mode="sit"'), 'al terminar vuelve a dormir en el banco');
for (const no of ['__tlShowSummary', '__tlSumNew', 'localStorage', 'play(', 'negocio', 'fetch(']) {
  assert.equal(abrir.includes(no), false, 'la apertura no debe ' + no);
}
assert.equal(html.split('tlCelebrarAlAbrir').length - 1, 2, 'definición y reintento');

assert.ok(html.includes('clic:{src:"/sonidos/clic-burbuja.wav",vol:0.35}'));
assert.ok(html.includes('wuhu:{src:"/sonidos/despertar-wuhu.wav",vol:0.4}'));
assert.ok(html.includes('function play(big){if(muted||!ac||ac.state!=="running")return false;'));
assert.ok(html.includes('function playPerdida(){'));
assert.ok(html.includes('>v0.10.8</div>'));

console.log('apertura-celebracion ok');
