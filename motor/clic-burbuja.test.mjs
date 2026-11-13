import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const wav = path.join(here, 'sonidos', 'clic-burbuja.wav');
const html = fs.readFileSync(path.join(here, 'Granja-de-Cuentas-v2.html'), 'utf8');
const server = fs.readFileSync(path.join(here, 'tradinglink.mjs'), 'utf8');

assert.ok(fs.existsSync(wav), 'falta el wav');
assert.ok(fs.statSync(wav).size > 1000 && fs.statSync(wav).size < 20000, 'tamaño del wav');
const buf = fs.readFileSync(wav);
assert.equal(buf.toString('ascii', 0, 4), 'RIFF');
assert.equal(buf.toString('ascii', 8, 12), 'WAVE');
const rate = buf.readUInt32LE(24);
const ch = buf.readUInt16LE(22);
const bits = buf.readUInt16LE(34);
const data = buf.indexOf(Buffer.from('data'));
assert.ok(data > 0, 'chunk data');
const bytes = buf.readUInt32LE(data + 4);
const dur = bytes / (rate * ch * (bits / 8)) * 1000;
assert.ok(dur > 70 && dur < 100, 'duración ' + dur);

for (const trozo of [
  'window.__tlClic=function()',
  'createBufferSource',
  'var VOL=0.35',
  'gain.gain.value=VOL',
  'histBtn").onclick=()=>{try{window.__tlClic',
  'tradesBtn").onclick=()=>{try{window.__tlClic',
  'metricaBtn").onclick=()=>{try{window.__tlClic',
  '[data-trade]");tr&&(tr.onclick=ev=>{ev.preventDefault();ev.stopPropagation();try{window.__tlClic',
  '!pl||!pl.contains(e.target))return;e.stopImmediatePropagation();e.preventDefault();try{window.__tlClic',
]) assert.ok(html.includes(trozo), trozo);

const buy = html.indexOf('data-s=long');
assert.ok(buy > 0);
assert.equal(html.slice(buy, buy + 900).includes('__tlClic'), false, 'BUY/SELL no suenan');
assert.ok(server.includes("'/sonidos/clic-burbuja.wav'"), 'el servidor entrega el wav');
console.log('clic burbuja ok', Math.round(dur) + ' ms');
