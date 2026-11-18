// El cerezo ya no admite certificados. Quedan manzanas fijas y las plantas de las cuentas.
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const jardin = html.slice(html.indexOf('Cerezo estático'), html.indexOf('id="tlPanelIzq"'));
assert.ok(jardin.length > 200, 'hay bloque del cerezo');

for (const ido of ['pfCert', 'pfAddG', 'Crear logro', 'certUrl', 'tl_garden_v1', 'tl_garden_hidden', 'Elegir certificado', 'type=file', '__pfGarden', 'openAdd(', '/logros.json']) {
  assert.equal(jardin.includes(ido), false, 'el cerezo ya no tiene ' + ido);
}
assert.match(jardin, /const MANZANAS=5/);
assert.match(jardin, /for\(let i=0;i<MANZANAS;i\+\+\)apple\(gx,CT,i\)/);
assert.match(jardin, /function cherry\(gx\)/);
assert.equal(jardin.includes('addEventListener("pointerup"'), false, 'el árbol no se pulsa para subir nada');

assert.match(html, /Cada cubo dorado en los árboles es un pago/);
assert.match(html, /Arboles memoriales de pago/);
assert.match(html, /a\.memorial/);
assert.match(html, /addPayout/);
assert.match(jardin, /className="pfMeta"/);

const rutas = fs.readFileSync(new URL('./rutas-api.mjs', import.meta.url), 'utf8');
assert.match(rutas, /logros\.json ya no lo lee la granja/);
assert.match(rutas, /metas\.json/);

console.log('cerezo-estatico ok');
