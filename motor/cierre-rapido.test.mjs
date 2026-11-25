// El cierre no espera 3 lecturas ni 1 s, y el P&L exacto sustituye la misma fila.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { conPnlExacto, createColchon } from './colchon.mjs';

const fin = '2026-11-25T12:00:00.000Z';
const eventos = [
  { type: 'fin_trade', at: fin, fin, inicio: fin, pnlFinalUSD: 14, pnlFinalAprox: true, motivo: 'Posición cerrada', direccion: 'COMPRA', tamano: '1 MNQ' },
  { type: 'fin_trade_pnl', at: '2026-11-25T12:00:01.000Z', fin, pnlFinalUSD: 0.5, pnlFinalAprox: false, motivo: 'Stop loss' },
];
const listos = conPnlExacto(eventos);
assert.equal(listos.filter(x => x.type === 'fin_trade').length, 1);
assert.equal(listos[0].pnlFinalUSD, 0.5);
assert.equal(listos[0].pnlFinalAprox, false);
assert.equal(listos[0].motivo, 'Stop loss');
assert.equal(listos[0].fin, fin);

const src = fs.readFileSync(new URL('./colchon.mjs', import.meta.url), 'utf8');
assert.match(src, /reads: 2, ms: 450/);
assert.doesNotMatch(src, /NO VEO EL STOP/);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-cierre-'));
function motor(abierta, kids) {
  return createColchon(() => ({
    kind: 'api',
    account: async () => ({ name: 'Practice Demo', broker: 'Paper' }),
    preparar: async () => ({ accountId: 'p1', name: 'Practice Demo', brokerId: 'paper', tradeSymbol: 'MNQH6' }),
    cotizacion: async () => ({ bid: 20959.75, ask: 20960, last: 20960, leido: Date.now() }),
    position: async () => abierta.v ? { side: 'long', qty: 1, entry: 21000, price: 21010, stop: 20950, raw: { takeProfit: 21160 }, pnl: 20 } : null,
    stop: async () => 20950,
    working: async () => kids.v,
    openBracket: async () => 'ok market',
    flatten: async () => 'ok',
    ticker: null,
  }), { pollMs: 40, logFile: path.join(tmp, 'c-' + Math.random().toString(16).slice(2) + '.log'), ignoreClock: true, noTicks: true, fuente: { modo: 'broker', frescoMs: 2000, pollMs: 40 } });
}

{
  const abierta = { v: true }, kids = { v: [] };
  const k = motor(abierta, kids);
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, accountId: 'p1', accountName: 'Practice Demo' });
  assert.equal(r.ok, true, r.err);
  await new Promise(z => setTimeout(z, 180));
  assert.equal(k.status().state, 'running');
  const t0 = Date.now();
  abierta.v = false;
  while (k.status().state === 'running' && Date.now() - t0 < 2000) await new Promise(z => setTimeout(z, 20));
  const dt = Date.now() - t0;
  assert.equal(k.status().state, 'done', 'sin hijas, cierra');
  assert.ok(dt >= 400 && dt < 1200, 'tardó ' + dt + ' ms');
  await k.stop({ flatten: false });
}

{
  const abierta = { v: true }, kids = { v: [] };
  const k = motor(abierta, kids);
  const r = await k.start({ side: 'long', symbol: 'MNQ', qty: 1, accountId: 'p1', accountName: 'Practice Demo' });
  assert.equal(r.ok, true, r.err);
  await new Promise(z => setTimeout(z, 180));
  kids.v = [
    { id: 's1', type: 3, parentId: 'a' },
    { id: 't1', type: 1, parentId: 'a' },
  ];
  abierta.v = false;
  await new Promise(z => setTimeout(z, 700));
  assert.equal(k.status().state, 'running', 'con SL/TP no se da por cerrada');
  await k.stop({ flatten: false });
}

console.log('cierre-rapido ok');
