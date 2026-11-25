// Lectura del registro de eventos acotada por tiempo. El archivo crece al final:
// para un día o las últimas horas se lee la cola y no se parsea el historial anterior.
import fs from 'node:fs';

const DIA = 86400000;

function stat(file) {
  try { return fs.statSync(file); } catch { return null; }
}

function parsear(texto) {
  const out = [];
  for (const line of texto.split('\n')) {
    if (!line) continue;
    try {
      const x = JSON.parse(line);
      if (x && x.at) out.push(x);
    } catch { /* línea a medias o rota */ }
  }
  return out;
}

function leerTodo(file) {
  try { return parsear(fs.readFileSync(file, 'utf8')); } catch { return []; }
}

// Lee desde el final hasta cruzar `desdeMs`. Los eventos van en orden cronológico.
export function leerCola(file, desdeMs, chunk = 256 * 1024) {
  const st = stat(file);
  if (!st || !st.size) return [];
  const fd = fs.openSync(file, 'r');
  try {
    let pos = st.size;
    let suffix = Buffer.alloc(0);
    const recientes = [];
    let listo = false;
    while (pos > 0 && !listo) {
      const n = Math.min(chunk, pos);
      pos -= n;
      const buf = Buffer.alloc(n);
      fs.readSync(fd, buf, 0, n, pos);
      const cur = Buffer.concat([buf, suffix]);
      let start = 0;
      if (pos > 0) {
        const nl = cur.indexOf(0x0a);
        if (nl < 0) { suffix = cur; continue; }
        suffix = cur.subarray(0, nl);
        start = nl + 1;
      } else suffix = Buffer.alloc(0);
      const partes = cur.subarray(start).toString('utf8').split('\n');
      for (let i = partes.length - 1; i >= 0; i--) {
        const line = partes[i].replace(/\r$/, '');
        if (!line) continue;
        let ev = null;
        try { ev = JSON.parse(line); } catch { continue; }
        if (!ev || !ev.at) continue;
        const t = Date.parse(ev.at);
        if (Number.isFinite(desdeMs) && Number.isFinite(t) && t < desdeMs) { listo = true; break; }
        recientes.push(ev);
      }
    }
    recientes.reverse();
    return recientes;
  } finally {
    fs.closeSync(fd);
  }
}

let cache = null;

export function leerEventosDesde(file, desdeMs, chunk) {
  const st = stat(file);
  if (!st) return [];
  const completo = desdeMs == null || !Number.isFinite(+desdeMs);
  if (cache && cache.file === file && cache.mtime === st.mtimeMs && cache.size === st.size) {
    if (cache.desdeMs == null) return completo ? cache.rows : cache.rows.filter(x => Date.parse(x.at) >= +desdeMs);
    if (!completo && cache.desdeMs <= +desdeMs) return cache.rows.filter(x => Date.parse(x.at) >= +desdeMs);
  }
  const rows = completo ? leerTodo(file) : leerCola(file, +desdeMs, chunk);
  cache = { file, mtime: st.mtimeMs, size: st.size, desdeMs: completo ? null : +desdeMs, rows };
  return rows;
}

export function limpiarCacheEventos() { cache = null; }

// 16:00 ET del día de calendario anterior: ahí empieza la sesión que se etiqueta `iso`.
export function inicioDiaFarm(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''))) return null;
  const prev = new Date(iso + 'T00:00:00Z');
  prev.setUTCDate(prev.getUTCDate() - 1);
  const dia = prev.toISOString().slice(0, 10);
  const [y, m, d] = dia.split('-').map(Number);
  let t = Date.UTC(y, m - 1, d, 21, 0, 0);
  for (let i = 0; i < 8; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date(t)).map(p => [p.type, p.value]));
    const got = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
    const want = Date.UTC(y, m - 1, d, 16, 0);
    if (got === want) return t;
    t += want - got;
  }
  return t;
}

export const MS_HORA = 3600000;
export const MS_DIA = DIA;
