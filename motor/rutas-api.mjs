// Rutas HTTP de la granja. El POST de /api/algo-tv va ANTES del POST genérico
// (/bot, /order, /confirm, /cancel). Si no, el genérico responde
// {"ok":false,"err":["ruta desconocida"]} y el ojo de los algoritmos no hace nada.
import fs from 'node:fs';
import path from 'node:path';
import { acctGuard } from './colchon.mjs';

export function manejar(q, r, deps) {
  if (deps.propiasH(q, r)) return;
  if (deps.negocioH(q, r)) return;
  if (q.url.startsWith('/api/vista-previa')) {
    let b = ''; q.on('data', c => b += c); q.on('end', async () => {
      let out;
      try {
        let j = {}; try { j = JSON.parse(b || '{}'); } catch { j = {}; }
        if (deps.colchon.status().state === 'running') j = { activo: false, seq: j.seq || 0 };
        out = await deps.vistaPrevia.aplicar(j);
      } catch (e) { out = { ok: false, estado: 'no-disponible', texto: 'Vista previa no disponible' }; }
      r.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      r.end(JSON.stringify(out));
    });
    return;
  }
  // logros.json ya no lo lee la granja. Se sigue sirviendo y no se borra del disco.
  if (/^\/(logros|metas)\.json/.test(q.url)) {
    let t = '{}';
    try { t = fs.readFileSync(path.join(deps.DIR, q.url.startsWith('/logros') ? 'logros.json' : 'metas.json'), 'utf8'); } catch {}
    r.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return r.end(t);
  }
  if (q.url.startsWith('/accounts.json')) {
    r.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    return r.end(JSON.stringify(deps.state));
  }
  if (q.url.startsWith('/api/colchon/')) {
    let b = ''; q.on('data', c => b += c); q.on('end', async () => {
      let j = {}; try { j = JSON.parse(b || '{}'); } catch {}
      let out;
      try {
        if (q.url.startsWith('/api/colchon/reporte')) {
          const d = new URL(q.url, 'http://x').searchParams.get('dia');
          const md = deps.buildReport(deps.DIR, /^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : deps.diaFarm());
          r.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' });
          return r.end(md);
        }
        if (q.url.startsWith('/api/colchon/informe')) {
          const f = path.basename(new URL(q.url, 'http://x').searchParams.get('f') || '');
          let md = 'No encontré ese informe.';
          if (/^[\w.-]+\.md$/.test(f)) try { md = deps.maskId(fs.readFileSync(path.join(deps.DIR, 'reportes', f), 'utf8')); } catch {}
          r.writeHead(200, { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'no-store' });
          return r.end(md);
        }
        if (q.url.startsWith('/api/colchon/detalle')) {
          const out2 = deps.detalleTrade(new URL(q.url, 'http://x').searchParams.get('at') || '');
          r.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
          return r.end(JSON.stringify(out2));
        }
        if (q.url.startsWith('/api/colchon/lectura')) {
          const f = path.join(deps.DIR, 'pausa-lectura.flag');
          if (q.method === 'POST') {
            const p = j.pause ?? !fs.existsSync(f);
            if (p) fs.writeFileSync(f, 'pausa manual ' + new Date().toISOString());
            else fs.rmSync(f, { force: true });
          }
          const lastFull = deps.lastFull();
          const lastBusy = deps.lastBusy();
          out = {
            paused: fs.existsSync(f),
            ultimaLecturaCompleta: lastFull ? new Date(lastFull).toISOString() : null,
            ultimaActividad: new Date(lastBusy).toISOString(),
            esperaSeg: Math.max(0, Math.ceil((deps.quietMs() - (Date.now() - lastBusy)) / 1000)),
          };
        } else if (q.url.startsWith('/api/colchon/metricas')) out = await deps.metricasDe(q.url);
        else if (q.url.startsWith('/api/colchon/trades')) {
          const d = new URL(q.url, 'http://x').searchParams.get('dia');
          out = await deps.tradesDe(/^\d{4}-\d{2}-\d{2}$/.test(d || '') ? d : deps.diaFarm());
        } else if (q.url.startsWith('/api/colchon/conexion')) out = await deps.conexion();
        else if (q.url.startsWith('/api/colchon/status')) out = { ...deps.colchon.status(), cfg: deps.colchonCFG };
        else if (q.url.startsWith('/api/colchon/summary')) out = deps.colchon.summary() || { ok: false, err: 'Todavía no hay resumen' };
        else if (q.url.startsWith('/api/colchon/strategies')) out = deps.colchon.strategies();
        else if (q.url.startsWith('/api/colchon/accounts')) out = await deps.colchon.accounts();
        else if (q.url.startsWith('/api/colchon/check')) out = await deps.colchon.check();
        else if (q.url.startsWith('/api/colchon/panel') && q.method === 'POST') {
          acctGuard.panelAbierto = !!(j && j.abierto);
          if (!acctGuard.panelAbierto && typeof acctGuard.alCerrarPanel === 'function') { try { acctGuard.alCerrarPanel(); } catch {} }
          out = { ok: true, abierto: !!acctGuard.panelAbierto };
        }
        else if (q.url.startsWith('/api/colchon/start') && q.method === 'POST') out = await deps.colchon.start(j);
        else if (q.url.startsWith('/api/colchon/poner-stop') && q.method === 'POST') out = await deps.colchon.ponerStop();
        else if (q.url.startsWith('/api/colchon/stop') && q.method === 'POST') out = await deps.colchon.stop(j);
        else out = { ok: false, err: 'ruta desconocida' };
      } catch (e) { out = { ok: false, err: String(e.message || e) }; }
      r.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      r.end(JSON.stringify(out));
    });
    return;
  }
  if (q.url === '/api/algo-tv' || q.url.startsWith('/api/algo-tv?')) {
    const algoTv = deps.algoTv();
    if (q.method === 'GET') {
      let e = { conectado: false, algos: [], texto: '' };
      try { e = algoTv.estado(); } catch {}
      r.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return r.end(JSON.stringify(e));
    }
    if (q.method === 'POST') {
      let b = ''; q.on('data', c => b += c); q.on('end', async () => {
        let j = {}; try { j = JSON.parse(b || '{}'); } catch {}
        let out = { ok: false, conectado: false, algos: [], texto: '' };
        try { out = await algoTv.fijar(j.nombre, j.visible); } catch (e) { out.motivo = String(e && e.message || e); }
        r.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        r.end(JSON.stringify(out));
      });
      return;
    }
  }
  if (q.method === 'POST' || q.url === '/bot') {
    let b = ''; q.on('data', c => b += c); q.on('end', async () => {
      let j = {}; try { j = JSON.parse(b || '{}'); } catch {}
      let out;
      if (q.url === '/bot') out = { enabled: q.method === 'POST' ? deps.orders.bot.set(j.enabled) : deps.orders.bot.get(), simulated: deps.orders.DRY_RUN };
      else if (q.url === '/order') out = deps.orders.request(j, deps.state.accounts);
      else if (q.url === '/confirm') out = await deps.orders.confirm(j.id, deps.state.accounts);
      else if (q.url === '/cancel') out = { ok: deps.orders.cancel(j.id) };
      else out = { ok: false, err: ['ruta desconocida'] };
      console.log(new Date().toLocaleTimeString(), q.url, JSON.stringify(out));
      r.writeHead(200, { 'content-type': 'application/json' });
      r.end(JSON.stringify(out));
    });
    return;
  }
  if (q.method === 'GET' && (q.url === '/api/version' || q.url.startsWith('/api/version?'))) {
    const t = deps.textoVersion(path.join(deps.ROOT, 'VERSION'));
    if (!t) { r.writeHead(204, { 'cache-control': 'no-store' }); return r.end(); }
    r.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
    return r.end(t);
  }
  if (q.method === 'GET' && q.url.startsWith('/sonidos/')) {
    const nombre = path.basename(q.url.split('?')[0]);
    if (nombre === 'clic-burbuja.wav' || nombre === 'despertar-wuhu.wav') {
      const wav = path.join(deps.ROOT, 'motor', 'sonidos', nombre);
      if (fs.existsSync(wav)) {
        r.writeHead(200, { 'content-type': 'audio/wav', 'cache-control': 'public, max-age=86400' });
        return fs.createReadStream(wav).pipe(r);
      }
    }
  }
  if (q.method === 'GET' && (q.url === '/granja-flores.mjs' || q.url.startsWith('/granja-flores.mjs?') || q.url === '/cuentas.mjs' || q.url.startsWith('/cuentas.mjs?'))) {
    const archivo = path.join(deps.ROOT, 'motor', path.basename(q.url.split('?')[0]));
    if (fs.existsSync(archivo)) {
      r.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-store' });
      return fs.createReadStream(archivo).pipe(r);
    }
  }
  if (q.method === 'GET' && (q.url === '/propfarm-logo.png' || q.url.startsWith('/propfarm-logo.png?'))) {
    const logo = path.join(deps.ROOT, 'assets', 'propfarm-logo.png');
    if (fs.existsSync(logo)) {
      r.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'no-store' });
      return fs.createReadStream(logo).pipe(r);
    }
  }
  if (q.method === 'GET') {
    const ruta = q.url.split('?')[0];
    const icono = {
      '/favicon.ico': ['profito.ico', 'image/x-icon'],
      '/favicon-192.png': ['favicon-192.png', 'image/png'],
      '/favicon-512.png': ['favicon-512.png', 'image/png'],
      '/apple-touch-icon.png': ['apple-touch-icon.png', 'image/png'],
      '/manifest.webmanifest': ['manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
    }[ruta];
    if (icono) {
      const archivo = path.join(deps.ROOT, 'assets', icono[0]);
      if (fs.existsSync(archivo)) {
        r.writeHead(200, { 'content-type': icono[1], 'cache-control': 'no-store' });
        return fs.createReadStream(archivo).pipe(r);
      }
    }
  }
  r.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  fs.createReadStream(deps.HTML).pipe(r);
}
