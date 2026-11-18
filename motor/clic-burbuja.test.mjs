import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here, 'Granja-de-Cuentas-v2.html'), 'utf8');
const server = fs.readFileSync(path.join(here, 'rutas-api.mjs'), 'utf8');

function duracion(nombre, min, max) {
  const buf = fs.readFileSync(path.join(here, 'sonidos', nombre));
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF', nombre);
  const rate = buf.readUInt32LE(24);
  const ch = buf.readUInt16LE(22);
  const bits = buf.readUInt16LE(34);
  const data = buf.indexOf(Buffer.from('data'));
  const bytes = buf.readUInt32LE(data + 4);
  const dur = bytes / (rate * ch * (bits / 8)) * 1000;
  assert.ok(dur > min && dur < max, nombre + ' ' + dur);
}
duracion('clic-burbuja.wav', 70, 100);
duracion('despertar-wuhu.wav', 100, 400);

assert.equal(html.includes('__tlClic'), false, 'la página ya no llama al clic de burbuja');
assert.equal(html.includes('tocar("wuhu")'), false, 'despertar ya no reproduce el wav');
assert.ok(html.includes('window.__tlDespertar=playDJStart'), 'despertar usa DJ Inicio');
assert.ok(server.includes("'clic-burbuja.wav'") && server.includes("'despertar-wuhu.wav'"), 'el servidor sigue sirviendo los wav viejos');
const buy = html.indexOf('data-s=long');
assert.equal(html.slice(buy, buy + 900).includes('__tlDespertar'), false);
console.log('clic-burbuja ok: los wav quedan en disco, la página usa Web Audio');
