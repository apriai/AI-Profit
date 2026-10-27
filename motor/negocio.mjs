// Negocio: copia persistente (en esta carpeta) del historial que la pagina guarda en el navegador (localStorage).
// Rutas: GET /api/negocio -> negocio.json (o {}); POST|PUT /api/negocio -> guarda. Solo localhost. Nunca se sube a GitHub.
import fs from 'node:fs'; import path from 'node:path';
const MAX = 5 * 1024 * 1024, KEEP = 30, KEYRX = /^(tl_|granja\.)/;
const count = v => { try { const a = JSON.parse(v); return Array.isArray(a) ? a.length : 0; } catch { return 0; } };
export function negocio({ dir, port, day }) {
  const FILE = path.join(dir, 'negocio.json'), BK = path.join(dir, 'backups-negocio');
  const hosts = [`localhost:${port}`, `127.0.0.1:${port}`];
  const local = q => {
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(q.socket.remoteAddress)) return false;
    if (!hosts.includes(String(q.headers.host || '').toLowerCase())) return false;
    const o = q.headers.origin; if (o && !hosts.some(h => o.toLowerCase() === 'http://' + h)) return false;
    return q.headers['sec-fetch-site'] !== 'cross-site';
  };
  const read = () => { try { const j = JSON.parse(fs.readFileSync(FILE, 'utf8')); return j && typeof j === 'object' ? j : null; } catch { return null; } };
  const send = (r, code, o) => { r.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); r.end(JSON.stringify(o)); };
  function respaldo() { // como mucho 1 respaldo por dia (el estado previo a la primera escritura del dia); se guardan los ultimos 30
    try { fs.mkdirSync(BK, { recursive: true }); const f = path.join(BK, `negocio-${day()}.json`); if (!fs.existsSync(f) && fs.existsSync(FILE)) fs.copyFileSync(FILE, f);
      const l = fs.readdirSync(BK).filter(x => /^negocio-\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort(); for (const x of l.slice(0, Math.max(0, l.length - KEEP))) fs.rmSync(path.join(BK, x), { force: true }); } catch (e) { console.log('negocio: respaldo fallo', e.message); } }
  function guardar(j) {
    if (!j || typeof j !== 'object' || !j.data || typeof j.data !== 'object' || Array.isArray(j.data)) return [400, { ok: false, err: 'formato invalido' }];
    const clean = {}; for (const [k, v] of Object.entries(j.data)) { if (!KEYRX.test(k) || typeof v !== 'string') return [400, { ok: false, err: 'clave o valor invalido' }]; clean[k] = v; }
    const old = read(), prev = (old && old.data && typeof old.data === 'object') ? old.data : {}, merged = { ...prev, ...clean };
    if (count(merged.tl_ledger_v1) === 0) return [409, { ok: false, err: 'sin historial: no se guarda (protege el archivo)' }];
    if (count(prev.tl_ledger_v1) > 0 && count(clean.tl_ledger_v1 ?? prev.tl_ledger_v1) === 0) return [409, { ok: false, err: 'vacio no sobrescribe' }];
    const same = Object.keys(merged).length === Object.keys(prev).length && Object.keys(merged).every(k => prev[k] === merged[k]);
    if (old && same) return [200, { ok: true, unchanged: true, savedAt: old.savedAt }];
    respaldo();
    const out = { version: 1, savedAt: new Date().toISOString(), data: merged }, tmp = FILE + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(out), 'utf8'); fs.renameSync(tmp, FILE);
    return [200, { ok: true, savedAt: out.savedAt, keys: Object.keys(merged).length }];
  }
  return (q, r) => {
    if (q.url.split('?')[0] !== '/api/negocio') return false;
    if (!local(q)) { send(r, 403, { ok: false, err: 'solo localhost' }); return true; }
    if (q.method === 'GET') { send(r, 200, read() || {}); return true; }
    if (q.method !== 'POST' && q.method !== 'PUT') { send(r, 405, { ok: false, err: 'metodo no permitido' }); return true; }
    const ch = []; let n = 0, big = false;
    q.on('data', c => { n += c.length; if (n > MAX) big = true; else ch.push(c); });
    q.on('end', () => { if (big) return send(r, 413, { ok: false, err: 'muy grande (max 5 MB)' });
      let j; try { j = JSON.parse(Buffer.concat(ch).toString('utf8')); } catch { return send(r, 400, { ok: false, err: 'JSON invalido' }); }
      let res; try { res = guardar(j); } catch (e) { res = [500, { ok: false, err: String(e.message || e) }]; } send(r, res[0], res[1]); });
    return true;
  };
}