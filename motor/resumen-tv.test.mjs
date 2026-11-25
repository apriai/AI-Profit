import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fijarResumenTv, resumenTvActivo } from './resumen-tv.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'resumen-tv-'));
assert.equal(resumenTvActivo(dir), true);
assert.deepEqual(fijarResumenTv(dir, false), { ok: true, on: false });
assert.equal(resumenTvActivo(dir), false);
assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'resumen-tv.json'), 'utf8')).on, false);
assert.equal(fijarResumenTv(dir, true).on, true);
assert.equal(resumenTvActivo(dir), true);

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const ojo = html.slice(html.indexOf('Sonido de la señal'), html.indexOf('Sonido de la señal') + 400);
assert.match(ojo, /Resumen de trades en TradingView/);
assert.match(ojo, /id="tlResumenTV"/);
assert.match(html, /profito\.resumenTV/);
assert.match(html, /\/api\/resumen-tv/);

console.log('resumen-tv ok');
