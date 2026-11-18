// POST real a /api/algo-tv: tiene que llegar a algoTv.fijar, no al POST genérico.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { manejar } from './rutas-api.mjs';

const llamadas = [];
function deps() {
  return {
    propiasH(q, r) {
      if (!q.url.startsWith('/api/estrategias-propias')) return false;
      r.writeHead(200, { 'content-type': 'application/json' });
      r.end(JSON.stringify({ ok: true, via: 'propias' }));
      return true;
    },
    negocioH(q, r) {
      if (q.url.split('?')[0] !== '/api/negocio') return false;
      r.writeHead(200, { 'content-type': 'application/json' });
      r.end(JSON.stringify({ ok: true, via: 'negocio' }));
      return true;
    },
    vistaPrevia: { aplicar: async (j) => { llamadas.push(['vista', j]); return { ok: true, via: 'vista', seq: j.seq }; } },
    colchon: {
      status: () => ({ state: 'idle' }),
      start: async (j) => { llamadas.push(['start', j]); return { ok: true, via: 'start' }; },
      stop: async () => ({ ok: true, via: 'stop' }),
      summary: () => null,
      strategies: () => [],
      accounts: async () => ({}),
      check: async () => ({}),
    },
    colchonCFG: { ok: true },
    DIR: '/tmp',
    state: { accounts: {} },
    buildReport: () => '',
    diaFarm: () => '2026-11-16',
    maskId: s => s,
    detalleTrade: () => ({ ok: true }),
    lastFull: () => 0,
    lastBusy: () => Date.now(),
    quietMs: () => 1000,
    metricasDe: async () => ({ ok: true }),
    tradesDe: async () => [],
    conexion: async () => ({ servidor: true }),
    orders: {
      DRY_RUN: true,
      bot: { get: () => false, set: (v) => { llamadas.push(['bot', v]); return v; } },
      request: (j) => { llamadas.push(['order', j]); return { ok: true, via: 'order' }; },
      confirm: async () => ({ ok: true }),
      cancel: () => true,
    },
    algoTv: () => ({
      estado: () => ({ conectado: true, algos: [{ nombre: 'Ai Profit Camp Algo', visible: true }], texto: 'listo' }),
      fijar: async (nombre, visible) => {
        llamadas.push(['fijar', nombre, visible]);
        return { ok: true, via: 'fijar', nombre, visible, algos: [{ nombre, visible }] };
      },
    }),
    textoVersion: () => '0.10.18',
    ROOT: '/tmp',
    HTML: '/tmp/no-existe.html',
  };
}

function pedir(puerto, metodo, ruta, cuerpo) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: puerto, method: metodo, path: ruta,
      headers: cuerpo ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(cuerpo) } : {},
    }, (res) => {
      let b = '';
      res.setEncoding('utf8');
      res.on('data', c => { b += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(b); } catch {}
        resolve({ status: res.statusCode, body: b, json });
      });
    });
    req.on('error', reject);
    if (cuerpo) req.write(cuerpo);
    req.end();
  });
}

const server = http.createServer((q, r) => manejar(q, r, deps()));
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const puerto = server.address().port;

const post = await pedir(puerto, 'POST', '/api/algo-tv', JSON.stringify({ nombre: 'Ai Profit Camp Algo', visible: false }));
assert.equal(post.json.via, 'fijar');
assert.equal(post.json.ok, true);
assert.deepEqual(llamadas.filter(c => c[0] === 'fijar'), [['fijar', 'Ai Profit Camp Algo', false]]);
assert.notDeepEqual(post.json.err, ['ruta desconocida']);

const conQuery = await pedir(puerto, 'POST', '/api/algo-tv?x=1', JSON.stringify({ nombre: 'Smart Money Algo', visible: true }));
assert.equal(conQuery.json.via, 'fijar');
assert.equal(conQuery.json.nombre, 'Smart Money Algo');

const version = await pedir(puerto, 'GET', '/api/version');
assert.equal(version.body, '0.10.18');

const get = await pedir(puerto, 'GET', '/api/algo-tv');
assert.equal(get.json.conectado, true);
assert.equal(get.json.algos[0].nombre, 'Ai Profit Camp Algo');

const vista = await pedir(puerto, 'POST', '/api/vista-previa', JSON.stringify({ seq: 3, activo: true }));
assert.equal(vista.json.via, 'vista');
assert.equal(vista.json.seq, 3);

const start = await pedir(puerto, 'POST', '/api/colchon/start', '{}');
assert.equal(start.json.via, 'start');

const orden = await pedir(puerto, 'POST', '/order', '{}');
assert.equal(orden.json.via, 'order');

const negocio = await pedir(puerto, 'POST', '/api/negocio', '{}');
assert.equal(negocio.json.via, 'negocio');

const propias = await pedir(puerto, 'POST', '/api/estrategias-propias', '{}');
assert.equal(propias.json.via, 'propias');

const rara = await pedir(puerto, 'POST', '/api/no-existe', '{}');
assert.deepEqual(rara.json.err, ['ruta desconocida']);

const colchonRara = await pedir(puerto, 'POST', '/api/colchon/no-existe', '{}');
assert.equal(colchonRara.json.err, 'ruta desconocida');

server.close();

const src = fs.readFileSync(new URL('./rutas-api.mjs', import.meta.url), 'utf8');
const iAlgo = src.indexOf("q.url === '/api/algo-tv'");
const iPost = src.indexOf("q.method === 'POST' || q.url === '/bot'");
const iVista = src.indexOf("'/api/vista-previa'");
const iColchon = src.indexOf("'/api/colchon/'");
assert.ok(iAlgo > 0 && iPost > iAlgo, 'algo-tv queda antes del POST genérico');
assert.ok(iVista > 0 && iVista < iPost);
assert.ok(iColchon > 0 && iColchon < iPost);
const tl = fs.readFileSync(new URL('./tradinglink.mjs', import.meta.url), 'utf8');
assert.match(tl, /manejar\(q, r/);
assert.doesNotMatch(tl, /err:\['ruta desconocida'\]/);

console.log('rutas-api ok');
