import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, 'Granja-de-Cuentas-v2.html'), 'utf8');

for (const trozo of [
  'function playTap()',
  'osc.frequency.setValueAtTime(1200, now)',
  'function playSelect()',
  'osc1.frequency.setValueAtTime(1400, now)',
  'function playToggle()',
  'osc.frequency.setValueAtTime(900, now)',
  'function playCardOpen()',
  'nf.frequency.setValueAtTime(1500, now)',
  'function playDJStart()',
  'sub.frequency.setValueAtTime(40, now)',
  'window.__tlTap=playTap',
  'window.__tlSelect=playSelect',
  'window.__tlToggle=playToggle',
  'window.__tlCard=playCardOpen',
  'window.__tlDespertar=playDJStart',
  'if(window.__tlMuted&&window.__tlMuted()) return null',
  'histBtn").onclick=e=>{e.__tlSon=1;var abre=!Ws.classList.contains("open");try{abre?window.__tlCard&&window.__tlCard():window.__tlTap&&window.__tlTap()',
  'tradesBtn").onclick=e=>{e.__tlSon=1;var abrio=v.classList.toggle("open");try{abrio?window.__tlCard&&window.__tlCard():window.__tlTap&&window.__tlTap()',
  'metricaBtn").onclick=e=>{e.__tlSon=1;var abrio=mv.classList.toggle("open");try{abrio?window.__tlCard&&window.__tlCard():window.__tlTap&&window.__tlTap()',
  'R.__tlSon=1;window.__tlCard&&window.__tlCard()',
  'window.__tlCard&&window.__tlCard()}catch(err){}}(),Rl(e)',
  'ev.__tlSon=1;window.__tlSelect&&window.__tlSelect()',
  'if(awake)window.__tlTap&&window.__tlTap();else window.__tlDespertar&&window.__tlDespertar()',
  'if(phase==="running"){try{window.__tlSelect&&window.__tlSelect()',
  'window.__tlToggle&&window.__tlToggle()}catch(err){}set(!muted)',
  'window.__tlToggle&&window.__tlToggle()}catch(err){}set(!on)',
  'window.__tlToggle&&window.__tlToggle()}catch(err){}mode=isNight()',
  'el.hasAttribute("data-s")) return',
]) assert.ok(html.includes(trozo), trozo);

assert.equal(html.includes('__tlClic'), false, 'ya no hay clic de burbuja');
assert.equal(html.includes('tocar("wuhu")'), false, 'el despertar ya no usa el wav');
assert.equal(html.includes('if(!muted)play(false)'), false, 'el silencio no dispara la fanfarria');
assert.ok(html.includes('function play(big){if(muted||!ac||ac.state!=="running")return false;'), 'la fanfarria de un trade sigue igual');
assert.ok(html.includes('function playPerdida(){'), 'el sonido de pérdida sigue');

const buy = html.indexOf('data-s=long');
assert.ok(buy > 0);
const zona = html.slice(buy, buy + 900);
for (const no of ['__tlCard', '__tlSelect', '__tlTap', '__tlToggle', '__tlDespertar', '__tlClic']) {
  assert.equal(zona.includes(no), false, 'BUY/SELL no llaman ' + no);
}

console.log('sonidos-party ok');
