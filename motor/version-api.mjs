// Texto de la versión instalada. Vacío si el archivo no está o no es x.y.z.
import fs from 'node:fs';

export function textoVersion(ruta) {
  try {
    const t = fs.readFileSync(ruta, 'utf8').replace(/^\uFEFF/, '').trim();
    return /^\d+\.\d+\.\d+$/.test(t) ? t : '';
  } catch {
    return '';
  }
}
