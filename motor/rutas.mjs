// Rutas del repositorio. El motor vive en motor/; los datos personales no.
// Una instalación que ya tenía cuentas en la raíz sigue usándolas ahí.
// Una carpeta nueva escribe en datos/. No mueve archivos ni envía órdenes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MOTOR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(MOTOR, '..');
export const HTML = path.join(MOTOR, 'Granja-de-Cuentas-v2.html');
export const TV_CLI = path.join(ROOT, 'tradingview-mcp/src/cli/index.js');
export const TV_PKG = path.join(ROOT, 'tradingview-mcp/package.json');

const MARCADORES = [
  'accounts.json',
  'sod.json',
  'days.json',
  'negocio.json',
  'real-allowlist.json',
  'colchon-fuente.json',
  'logros.json',
  'metas.json',
  'colchon-eventos.jsonl',
  'historial',
];

function tieneDatos(dir) {
  return MARCADORES.some(nombre => fs.existsSync(path.join(dir, nombre)));
}

export function dataDir() {
  const datos = path.join(ROOT, 'datos');
  if (tieneDatos(ROOT) && !tieneDatos(datos)) return ROOT;
  fs.mkdirSync(datos, { recursive: true });
  return datos;
}
