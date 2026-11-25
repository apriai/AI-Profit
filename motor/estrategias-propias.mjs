// Estrategias propias de esta computadora. Se guardan solo en estrategias-propias.json
// en la raíz de TradingLink (junto a motor/). Nunca se suben a GitHub (.gitignore).
// El motor las mezcla en strategies.mjs con propia:true. No renombra las de serie.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ROOT } from './rutas.mjs';

const MAX_BODY = 64 * 1024;
const MAX_STRATS = 30;
const MAX_STEPS = 3;
const MAX_NAME = 40;
const USD_MAX = 20000;
const ID_RX = /^propia-[a-z0-9]{6,32}$/;

function archivo() { return process.env.ESTRATEGIAS_PROPIAS_FILE || path.join(ROOT, 'estrategias-propias.json'); }
const fallosAvisados = new Set();
let ultimoReparo = null;

function money(n) {
  if (typeof n === 'string' && n.trim() === '') return null;
  const x = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(x)) return null;
  return Math.round(x * 100) / 100;
}
const usd = n => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

function texto(name, sl, tp, steps) {
  const head = `Operación: SL −${usd(sl)} / TP +${usd(tp)}`;
  if (!steps.length) return { short: head + '\nAI: el stop no se mueve', description: `${head}. AI: el stop no se mueve; termina en TP, en SL o si la cierras tú.` };
  const bits = steps.map(s => `+${usd(s.trigger)} → protege ${usd(s.lock)}`);
  return { short: head + '\n' + bits.join('\n'), description: `${head}. AI: ${bits.join('; ')}. Solo sube, nunca baja.` };
}

function shape(id, v) {
  const t = texto(v.name, v.sl, v.tp, v.steps);
  return {
    id, name: v.name, short: t.short, description: t.description,
    params: { SL_USD: v.sl, TP_USD: v.tp, STEPS: v.steps.map(s => ({ trigger: s.trigger, lock: s.lock })), DEFAULT_QTY: { MNQ: 8, NQ: 1 } },
  };
}

// names: estrategias ya guardadas, para rechazar un nombre repetido (salvo el mismo id).
export function validatePropia(body, { names = [], id = null } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, err: 'formato inválido' };
  const name = String(body.name ?? '').replace(/[\u0000-\u001F]/g, '').trim();
  if (!name) return { ok: false, err: 'escribe un nombre' };
  if (name.length > MAX_NAME) return { ok: false, err: `el nombre puede tener hasta ${MAX_NAME} caracteres` };
  const dup = names.find(n => n && n.id !== id && String(n.name || '').localeCompare(name, 'es', { sensitivity: 'accent' }) === 0);
  if (dup) return { ok: false, err: 'ya hay una estrategia propia con ese nombre' };
  const sl = money(body.sl ?? body.SL_USD);
  const tp = money(body.tp ?? body.TP_USD);
  if (sl == null || sl < 1 || sl > USD_MAX) return { ok: false, err: 'el stop loss tiene que ser un monto entre $1 y $20,000' };
  if (tp == null || tp < 1 || tp > USD_MAX) return { ok: false, err: 'el take profit tiene que ser un monto entre $1 y $20,000' };
  const raw = body.steps == null ? (body.STEPS == null ? [] : body.STEPS) : body.steps;
  if (!Array.isArray(raw)) return { ok: false, err: 'los pasos tienen que ser una lista' };
  if (raw.length > MAX_STEPS) return { ok: false, err: 'máximo 3 pasos' };
  const steps = [];
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i];
    if (!s || typeof s !== 'object' || Array.isArray(s)) return { ok: false, err: `el paso ${i + 1} no es válido` };
    const trigger = money(s.trigger ?? s.triggerUsd);
    const lock = money(s.lock ?? s.protege ?? s.protect ?? s.lockUsd);
    if (trigger == null || trigger <= 0 || trigger > USD_MAX) return { ok: false, err: `el paso ${i + 1}: el disparo tiene que ser mayor que $0` };
    if (lock == null || lock < 0 || lock > USD_MAX) return { ok: false, err: `el paso ${i + 1}: lo que protege tiene que ser $0 o más` };
    if (lock >= trigger) return { ok: false, err: `el paso ${i + 1}: protege menos de lo que dispara (+${usd(trigger)} → ${usd(lock)})` };
    if (trigger >= tp) return { ok: false, err: `el paso ${i + 1}: el disparo tiene que ser menor que el take profit` };
    if (steps.length && trigger <= steps[steps.length - 1].trigger) return { ok: false, err: `el paso ${i + 1}: el disparo tiene que ser mayor que el del paso anterior` };
    if (steps.length && lock < steps[steps.length - 1].lock) return { ok: false, err: `el paso ${i + 1}: tiene que proteger al menos lo del paso anterior` };
    steps.push({ trigger, lock });
  }
  return { ok: true, value: { name, sl, tp, steps } };
}

function pareceEstrategia(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return false;
  const p = j.params;
  return typeof j.id === 'string' && !!j.name && p && typeof p === 'object' && !Array.isArray(p) && ('SL_USD' in p || 'TP_USD' in p || 'STEPS' in p);
}

function normalizar(j) {
  const objs = xs => (Array.isArray(xs) ? xs : []).filter(x => x && typeof x === 'object' && !Array.isArray(x));
  if (Array.isArray(j)) return { known: true, list: objs(j) };
  if (!j || typeof j !== 'object') return { known: false, list: [] };
  if (Array.isArray(j.strategies)) return { known: true, list: objs(j.strategies) };
  if (Array.isArray(j.estrategias)) return { known: true, list: objs(j.estrategias) };
  if (j.strategies && typeof j.strategies === 'object') {
    const list = [];
    for (const [k, v] of Object.entries(j.strategies)) {
      if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
      const id = typeof v.id === 'string' && ID_RX.test(v.id) ? v.id : k;
      list.push({ ...v, id });
    }
    return { known: true, list };
  }
  if (pareceEstrategia(j)) return { known: true, list: [j] };
  return { known: false, list: [] };
}

function logFallo(reason, buf) {
  const key = String(reason || 'lectura');
  if (fallosAvisados.has(key)) return;
  fallosAvisados.add(key);
  const size = buf ? buf.length : 0;
  const b0 = buf && buf.length ? '0x' + buf[0].toString(16) : '—';
  console.log(`estrategias-propias: no pude leer el archivo (${key}), ${size} bytes, primer byte ${b0}`);
}

function sello(d = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function respaldar(buf) {
  const dir = path.dirname(archivo());
  fs.mkdirSync(dir, { recursive: true });
  const stamp = sello();
  let nombre = `estrategias-propias.corrupto-${stamp}.json`;
  let n = 2;
  while (fs.existsSync(path.join(dir, nombre))) nombre = `estrategias-propias.corrupto-${stamp}-${n++}.json`;
  const dest = path.join(dir, nombre);
  fs.writeFileSync(dest, buf);
  const rx = /^estrategias-propias\.corrupto-(\d{8})-(\d{6})(?:-(\d+))?\.json$/;
  const clave = f => { const m = rx.exec(f); return m ? m[1] + m[2] + String(m[3] || 1).padStart(4, '0') : f; };
  const todos = fs.readdirSync(dir).filter(f => rx.test(f)).sort((a, b) => clave(a) < clave(b) ? -1 : clave(a) > clave(b) ? 1 : 0);
  while (todos.length > 5) fs.unlinkSync(path.join(dir, todos.shift()));
  return dest;
}

function reparar(buf, raw, reason) {
  logFallo(reason, buf);
  const valid = raw.map(asStrategy).filter(Boolean);
  let dest;
  try {
    dest = respaldar(buf);
    const copia = fs.readFileSync(dest);
    if (copia.length !== buf.length || !copia.equals(buf)) throw new Error('el respaldo no coincide');
  } catch (e) {
    return { ok: false, reason, list: [] };
  }
  try { writeList(valid); } catch (e) { return { ok: false, reason, list: [] }; }
  ultimoReparo = { archivo: dest, recuperadas: valid.length, reason };
  console.log(`estrategias-propias: respaldé el archivo dañado en ${dest} y empecé uno nuevo (recuperé ${valid.length})`);
  return { ok: true, list: valid, reparado: ultimoReparo };
}

function load() {
  const file = archivo();
  if (!fs.existsSync(file)) return { ok: true, list: [] };
  let buf;
  try { buf = fs.readFileSync(file); } catch (e) {
    logFallo('lectura', null);
    return { ok: false, reason: 'lectura', list: [] };
  }
  let text = buf.toString('utf8');
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  if (text.trim() === '') return { ok: true, list: [] };
  let j;
  try { j = JSON.parse(text); } catch {
    return reparar(buf, [], 'json');
  }
  const norm = normalizar(j);
  if (!norm.known) return reparar(buf, [], 'formato');
  return { ok: true, list: norm.list };
}

function writeList(list) {
  const file = archivo();
  const tmp = file + '.tmp-' + process.pid;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, strategies: list }, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

function asStrategy(row) {
  if (!row || typeof row.id !== 'string' || !ID_RX.test(row.id)) return null;
  const p = row.params && typeof row.params === 'object' ? row.params : null;
  if (!p) return null;
  const v = validatePropia({ name: row.name, sl: p.SL_USD, tp: p.TP_USD, steps: Array.isArray(p.STEPS) ? p.STEPS : null });
  if (!v.ok) return null;
  const s = shape(row.id, v.value);
  return s.name === v.value.name ? s : null;
}

function pub(s) { return { id: s.id, name: s.name, short: s.short, description: s.description, params: s.params, default: false, propia: true }; }

export function listPropias() {
  return load().list.map(asStrategy).filter(Boolean).map(pub);
}

export function reparacionPropia() { return ultimoReparo; }

export function getPropia(id) {
  if (typeof id !== 'string' || !id.startsWith('propia-')) return null;
  const s = load().list.map(asStrategy).find(x => x && x.id === id);
  return s ? { ...s, propia: true } : null;
}

function newId(list) {
  for (let i = 0; i < 8; i++) {
    const id = 'propia-' + randomBytes(4).toString('hex');
    if (!list.some(s => s && s.id === id)) return id;
  }
  return 'propia-' + Date.now().toString(36);
}

export function savePropia(body) {
  const loaded = load();
  if (!loaded.ok) return { ok: false, status: 409, err: 'el archivo de estrategias propias está dañado: no lo sobrescribo' };
  const idIn = body && typeof body.id === 'string' ? body.id.trim() : '';
  if (idIn && !ID_RX.test(idIn)) return { ok: false, status: 400, err: 'id inválido' };
  if (idIn && !loaded.list.some(s => s && s.id === idIn)) return { ok: false, status: 404, err: 'no está esa estrategia' };
  const names = loaded.list.map(asStrategy).filter(Boolean).map(s => ({ id: s.id, name: s.name }));
  const v = validatePropia(body, { names, id: idIn || null });
  if (!v.ok) return { ok: false, status: 400, err: v.err };
  if (!idIn && loaded.list.length >= MAX_STRATS) return { ok: false, status: 400, err: `máximo ${MAX_STRATS} estrategias propias` };
  const id = idIn || newId(loaded.list);
  const strat = shape(id, v.value);
  const next = idIn ? loaded.list.map(s => (s && s.id === id ? strat : s)) : loaded.list.concat(strat);
  try { writeList(next); } catch (e) { return { ok: false, status: 500, err: 'no pude guardar: ' + (e && e.message || e) }; }
  return { ok: true, status: 200, strategy: pub(strat) };
}

export function deletePropia(id) {
  const key = String(id || '').trim();
  if (!ID_RX.test(key)) return { ok: false, status: 400, err: 'id inválido' };
  const loaded = load();
  if (!loaded.ok) return { ok: false, status: 409, err: 'el archivo de estrategias propias está dañado: no lo sobrescribo' };
  if (!loaded.list.some(s => s && s.id === key)) return { ok: false, status: 404, err: 'no está esa estrategia' };
  try { writeList(loaded.list.filter(s => !s || s.id !== key)); } catch (e) { return { ok: false, status: 500, err: 'no pude borrar: ' + (e && e.message || e) }; }
  return { ok: true, status: 200, id: key };
}

function readBody(q, cb) {
  const ch = []; let n = 0, big = false;
  q.on('data', c => { n += c.length; if (n > MAX_BODY) big = true; else ch.push(c); });
  q.on('end', () => {
    if (big) return cb(Object.assign(new Error('muy grande'), { status: 413 }));
    const s = Buffer.concat(ch).toString('utf8').trim();
    if (!s) return cb(null, {});
    try { cb(null, JSON.parse(s)); } catch { cb(Object.assign(new Error('JSON inválido'), { status: 400 })); }
  });
}

// GET lista, POST guarda (crea o actualiza), DELETE borra. Solo localhost.
export function estrategiasPropias({ port = 8787 } = {}) {
  const hosts = [`localhost:${port}`, `127.0.0.1:${port}`];
  const local = q => {
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(q.socket.remoteAddress)) return false;
    if (!hosts.includes(String(q.headers.host || '').toLowerCase())) return false;
    const o = q.headers.origin; if (o && !hosts.some(h => o.toLowerCase() === 'http://' + h)) return false;
    return q.headers['sec-fetch-site'] !== 'cross-site';
  };
  const send = (r, code, o) => { r.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); r.end(JSON.stringify(o)); };
  try { load(); } catch { /* un disco lleno no debe tumbar el servidor */ }
  return (q, r) => {
    let u; try { u = new URL(q.url, 'http://127.0.0.1'); } catch { return false; }
    if (u.pathname !== '/api/estrategias-propias') return false;
    if (!local(q)) { send(r, 403, { ok: false, err: 'solo localhost' }); return true; }
    if (q.method === 'GET' || q.method === 'HEAD') {
      const strategies = listPropias();
      const reparado = reparacionPropia();
      send(r, 200, reparado ? { ok: true, strategies, reparado: { recuperadas: reparado.recuperadas, archivo: path.basename(reparado.archivo) } } : { ok: true, strategies });
      return true;
    }
    if (q.method !== 'POST' && q.method !== 'DELETE') { send(r, 405, { ok: false, err: 'método no permitido' }); return true; }
    readBody(q, (e, j) => {
      if (e) return send(r, e.status || 400, { ok: false, err: e.message });
      try {
        if (q.method === 'DELETE') {
          const id = u.searchParams.get('id') || (j && j.id);
          const res = deletePropia(id);
          return send(r, res.status, res.ok ? { ok: true, id: res.id } : { ok: false, err: res.err });
        }
        const res = savePropia(j);
        return send(r, res.status, res.ok ? { ok: true, strategy: res.strategy } : { ok: false, err: res.err });
      } catch (err) { return send(r, 500, { ok: false, err: String(err && err.message || err) }); }
    });
    return true;
  };
}
