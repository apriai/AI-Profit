// La silla usa el mismo disco sólido que el cerezo (Kx).
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
assert.match(html, /const tlCz=\{x:-5\.8,z:-5\.2,r:5\.1\}/);
assert.match(html, /const tlSilla=\{x:1\.65,z:-3\.155,r:1\.08\}/);
assert.match(html, /\),tlCz,tlSilla\]/);
assert.match(html, /Kx\(\)\.some\(t=>\(x-t\.x\)\*\*2\+\(z-t\.z\)\*\*2<=t\.r\*t\.r\)\)return!1/);
assert.match(html, /Kx\(\)\.some\(t=>\(n-t\.x\)\*\*2\+\(e-t\.z\)\*\*2<=t\.r\*t\.r\)\?!1/);
assert.match(html, /st\.mode==="sit"\|\|\(st\.after==="sit"&&!st\._water\)/);

const silla = { x: 1.65, z: -3.155, r: 1.08 };
const dentro = (x, z) => (x - silla.x) ** 2 + (z - silla.z) ** 2 <= silla.r ** 2;
assert.equal(dentro(1.75, -3), true, 'el asiento queda dentro del disco');
assert.equal(dentro(1.65, -3.15), true, 'el centro de la silla bloquea');
assert.equal(dentro(1.65, -1.6), false, 'el patio al norte de la silla sigue libre');
assert.equal(dentro(4.5, 1), false, 'no tapa la casa del rectángulo este');

console.log('silla-colision ok');
