// Arma la carpeta que el instalador NSIS copia. No incluye cuentas ni saldos.
import fs from 'node:fs';
import path from 'node:path';

const MOTOR = [
  'tradinglink.mjs', 'colchon.mjs', 'account-size.mjs', 'busy.mjs',
  'estrategias-propias.mjs', 'negocio.mjs', 'orders.mjs', 'rutas.mjs', 'strategies.mjs',
  'tv-reporte.mjs', 'tv-vista-previa.mjs', 'Granja-de-Cuentas-v2.html',
];
const TV_MODULOS = ['chrome-remote-interface', 'ws', 'commander'];

function copiarArchivo(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function copiarDir(src, dst) {
  if (!fs.existsSync(src)) return;
  for (const entrada of fs.readdirSync(src, { withFileTypes: true })) {
    if (entrada.name === 'test' || entrada.name.endsWith('.test.js') || entrada.name.endsWith('.test.mjs')) continue;
    const desde = path.join(src, entrada.name);
    const hacia = path.join(dst, entrada.name);
    if (entrada.isDirectory()) copiarDir(desde, hacia);
    else if (entrada.isFile()) copiarArchivo(desde, hacia);
  }
}

export function preparar(root, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const nombre of ['VERSION', 'LEEME.md', 'CHANGELOG.md']) {
    const src = path.join(root, nombre);
    if (fs.existsSync(src)) copiarArchivo(src, path.join(dest, nombre));
  }
  for (const nombre of MOTOR) copiarArchivo(path.join(root, 'motor', nombre), path.join(dest, 'motor', nombre));
  const acceso = path.join(root, 'acceso');
  for (const entrada of fs.readdirSync(acceso, { withFileTypes: true })) {
    if (!entrada.isFile()) continue;
    if (/\.test\.mjs$/.test(entrada.name)) continue;
    const ok = /\.(mjs|js|bat|cmd|ps1)$/i.test(entrada.name);
    if (!ok) continue;
    copiarArchivo(path.join(acceso, entrada.name), path.join(dest, 'acceso', entrada.name));
  }
  for (const nombre of ['abrir-granja-icon.ico', 'propfarm-logo.png']) {
    copiarArchivo(path.join(root, 'assets', nombre), path.join(dest, 'assets', nombre));
  }
  copiarArchivo(path.join(root, 'datos', 'LEEME.md'), path.join(dest, 'datos', 'LEEME.md'));
  const tv = path.join(root, 'tradingview-mcp');
  for (const nombre of ['package.json', 'LICENSE', 'PINNED_COMMIT.txt']) {
    const src = path.join(tv, nombre);
    if (fs.existsSync(src)) copiarArchivo(src, path.join(dest, 'tradingview-mcp', nombre));
  }
  copiarDir(path.join(tv, 'src'), path.join(dest, 'tradingview-mcp', 'src'));
  for (const mod of TV_MODULOS) copiarDir(path.join(tv, 'node_modules', mod), path.join(dest, 'tradingview-mcp', 'node_modules', mod));
  return dest;
}

if (process.argv[1] && path.resolve(process.argv[1]).endsWith(path.join('instalador', 'preparar.mjs'))) {
  const root = path.resolve(path.dirname(process.argv[1]), '..');
  const dest = path.join(root, 'instalador', 'stage', 'app');
  preparar(root, dest);
  console.log(dest);
}
