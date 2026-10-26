  if (q.url.startsWith('/api/colchon/')) { let b=''; q.on('data',c=>b+=c); q.on('end', async()=>{ let j={}; try{j=JSON.parse(b||'{}')}catch{} let out;
    try {
      if (q.url.startsWith('/api/colchon/status')) out = { ...colchon.status(), cfg: colchonCFG };
      else if (q.url.startsWith('/api/colchon/summary')) out = colchon.summary() || { ok: false, err: 'Todavía no hay resumen' };
      else if (q.url.startsWith('/api/colchon/accounts')) out = await colchon.accounts();
      else if (q.url.startsWith('/api/colchon/check')) out = await colchon.check();
      else if (q.url.startsWith('/api/colchon/start') && q.method === 'POST') out = await colchon.start(j);
      else if (q.url.startsWith('/api/colchon/stop') && q.method === 'POST') out = await colchon.stop(j);
      else out = { ok: false, err: 'ruta desconocida' };
    } catch (e) { out = { ok: false, err: String(e.message || e) }; }
    r.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); r.end(JSON.stringify(out)); }); return; }
