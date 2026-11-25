// Preferencia «Resumen de trades en TradingView». Por defecto está prendida.
// Vive en el motor (resumen-tv.json, carpeta de datos) para que siga igual al reiniciar.
// No guarda cuentas ni saldos. No envía órdenes.
import fs from 'node:fs';
import path from 'node:path';

const ARCHIVO = 'resumen-tv.json';

export function resumenTvActivo(dir) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, ARCHIVO), 'utf8'));
    if (j && j.on === false) return false;
  } catch {}
  return true;
}

export function fijarResumenTv(dir, on) {
  const valor = on !== false;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, ARCHIVO);
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify({ on: valor }, null, 1));
  fs.renameSync(tmp, file);
  return { ok: true, on: valor };
}
