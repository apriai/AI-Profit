import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, 'Granja-de-Cuentas-v2.html'), 'utf8');
const server = fs.readFileSync(path.join(here, 'tradinglink.mjs'), 'utf8');

function duracion(nombre, min, max) {
  const buf = fs.readFileSync(path.join(here, 'sonidos', nombre));
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF', nombre);
  assert.equal(buf.toString('ascii', 8, 12), 'WAVE', nombre);
  const rate = buf.readUInt32LE(24);
  const ch = buf.readUInt16LE(22);
  const bits = buf.readUInt16LE(34);
  const data = buf.indexOf(Buffer.from('data'));
  assert.ok(data > 0, nombre);
  const bytes = buf.readUInt32LE(data + 4);
  const dur = bytes / (rate * ch * (bits / 8)) * 1000;
  assert.ok(dur > min && dur < max, nombre + ' ' + dur);
  return dur;
}
const clic = duracion('clic-burbuja.wav', 70, 100);
const wuhu = duracion('despertar-wuhu.wav', 100, 400);

for (const trozo of [
  'window.__tlClic=function(){ tocar("clic"); }',
  'window.__tlDespertar=function(){ tocar("wuhu"); }',
  'createBufferSource',
  'clic:{src:"/sonidos/clic-burbuja.wav",vol:0.35}',
  'wuhu:{src:"/sonidos/despertar-wuhu.wav",vol:0.4}',
  'histBtn").onclick=()=>{try{window.__tlClic',
  'tradesBtn").onclick=()=>{try{window.__tlClic',
  'metricaBtn").onclick=()=>{try{window.__tlClic',
  '[data-trade]");tr&&(tr.onclick=ev=>{ev.preventDefault();ev.stopPropagation();try{window.__tlClic',
  'if(awake)window.__tlClic&&window.__tlClic();else window.__tlDespertar&&window.__tlDespertar()',
]) assert.ok(html.includes(trozo), trozo);

const buy = html.indexOf('data-s=long');
assert.ok(buy > 0);
assert.equal(html.slice(buy, buy + 900).includes('__tlClic'), false, 'BUY/SELL no suenan');
assert.equal(html.slice(buy, buy + 900).includes('__tlDespertar'), false, 'BUY/SELL no despiertan');
assert.ok(server.includes("'clic-burbuja.wav'") && server.includes("'despertar-wuhu.wav'"), 'el servidor entrega los dos wav');
console.log('sonidos ok', Math.round(clic) + ' ms clic, ' + Math.round(wuhu) + ' ms wuhu');
