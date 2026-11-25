import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diaFarm } from './colchon.mjs';
import { inicioDiaFarm, leerCola, leerEventosDesde, limpiarCacheEventos } from './eventos-ventana.mjs';

const inicio = inicioDiaFarm('2026-11-25');
assert.equal(diaFarm(inicio), '2026-11-25');
assert.notEqual(diaFarm(inicio - 1), '2026-11-25');

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-eventos-'));
const file = path.join(dir, 'colchon-eventos.jsonl');
const viejo = new Date('2024-01-02T15:00:00.000Z').toISOString();
const reciente = new Date('2026-11-25T15:00:00.000Z').toISOString();
const lineas = [];
for (let i = 0; i < 4000; i++) lineas.push(JSON.stringify({ at: viejo, type: 'lectura', n: i }));
lineas.push(JSON.stringify({ at: reciente, type: 'fin_trade', pnlFinalUSD: 1 }));
fs.writeFileSync(file, lineas.join('\n'));

const t0 = performance.now();
const todo = leerEventosDesde(file, null);
const tTodo = performance.now() - t0;
limpiarCacheEventos();
const desde = Date.parse(reciente) - 1000;
const t1 = performance.now();
const cola = leerCola(file, desde, 1024);
const tCola = performance.now() - t1;
assert.equal(todo.length, 4001);
assert.equal(cola.length, 1);
assert.equal(cola[0].type, 'fin_trade');
console.log(`muestra chica · entero ${tTodo.toFixed(1)} ms · cola ${tCola.toFixed(1)} ms`);

const otra = leerEventosDesde(file, desde, 1024);
assert.equal(otra.length, 1);
const amplio = leerEventosDesde(file, null);
assert.equal(amplio.length, 4001);

console.log(`eventos-ventana ok · archivo entero ${tTodo.toFixed(1)} ms · cola ${tCola.toFixed(1)} ms`);
