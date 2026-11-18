import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadAllow, realAllowed } from './colchon.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tl-allow-'));
const falta = path.join(dir, 'no-esta.json');
assert.equal(loadAllow(falta).allowAll, true);
assert.equal(realAllowed('LFE02500000000001', loadAllow(falta)), true);
assert.equal(realAllowed('LFF05000000000002', loadAllow(falta)), true);

const vacio = path.join(dir, 'vacio.json');
fs.writeFileSync(vacio, '   \n');
assert.equal(loadAllow(vacio).allowAll, true);

const llaves = path.join(dir, 'llaves.json');
fs.writeFileSync(llaves, '{}');
assert.equal(loadAllow(llaves).allowAll, true);
assert.equal(realAllowed('LFE02500000000001', loadAllow(llaves)), true);

const listaVacia = path.join(dir, 'lista.json');
fs.writeFileSync(listaVacia, '{"allow":[]}');
assert.equal(loadAllow(listaVacia).allowAll, true);

const roto = path.join(dir, 'roto.json');
fs.writeFileSync(roto, '{');
assert.equal(loadAllow(roto).allowAll, true);
assert.equal(realAllowed('LFF02500000000009', loadAllow(roto)), true);

assert.equal(realAllowed('DEMO123', loadAllow(falta)), false, 'paper o demo no es la cuenta real');
assert.equal(realAllowed('CUENTA88421', loadAllow(falta)), true, 'una Lucid sin LFE/LFF se puede operar');
assert.equal(realAllowed('LFE02500000000001', { allowAll: false, allow: ['OTRA'] }), true, 'la lista no bloquea ninguna cuenta');

console.log('allow-default ok');
