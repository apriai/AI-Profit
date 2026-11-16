import assert from 'node:assert/strict';
import fs from 'node:fs';

const colchon = fs.readFileSync(new URL('./colchon.mjs', import.meta.url), 'utf8');
const pagina = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
const orders = fs.readFileSync(new URL('./orders.mjs', import.meta.url), 'utf8');

assert.doesNotMatch(colchon, /FLAT_BY_MIN|4:45pm|4:45 PM ET: cerrar/, 'el bucle activo ya no cierra por la hora');
assert.match(colchon, /async stop\(\{ flatten = false \}/, 'Detener sigue pudiendo cerrar a mano');
assert.match(colchon, /if \(flatten && \(S\.mode === 'paper' \|\| S\.mode === 'real'\)\)/, 'el aplanado queda solo en el botón Detener');
assert.match(pagina, /data-stop/, 'el botón Detener sigue en la página');
assert.match(pagina, /flatten:true/, 'Detener sigue pidiendo cerrar la posición');
assert.match(pagina, /ya no cierra sola/, 'el historial viejo no presenta el corte de las 4:45 como algo vigente');
assert.match(orders, /DRY_RUN = true/);
assert.match(orders, /bot APAGADO/);
assert.doesNotMatch(orders, /closePosition|flatten\(/);

console.log('sin-cierre-hora ok');
