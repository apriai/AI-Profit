// Vigia visual del stop (solo LECTURA): despues de mover el stop, comprueba durante unos segundos
// si TradingView lo MUESTRA (orden en su memoria, texto del panel, fotos de pantalla, si la ventana pinta).
// No hace clics, no envia ni modifica ordenes. Usa su propia conexion CDP, fuera del camino de las ordenes.
import fs from 'node:fs'; import path from 'node:path';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DOM_JS = (p1, p2) => `(function(){var o={vis:document.visibilityState,focus:document.hasFocus()};var h=[];try{var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),n,c=0;while((n=w.nextNode())&&c<60000){c++;var t=n.nodeValue;if(t&&(t.indexOf(${JSON.stringify(p1)})>=0||t.indexOf(${JSON.stringify(p2)})>=0)){var el=n.parentElement,row=el&&(el.closest('tr,[role=row]')||el.parentElement||el);h.push(String((row&&row.innerText)||t).replace(/\\s+/g,' ').slice(0,110));if(h.length>=4)break}}}catch(e){o.err=String(e&&e.message||e)}o.domHits=h;return o})()`;
const RAF_JS = `new Promise(function(r){var n=0,t=performance.now();function f(){n++;if(performance.now()-t<300)requestAnimationFrame(f);else r(n)}requestAnimationFrame(f);setTimeout(function(){r(n)},700)})`;
export async function vigiaStop({ CDP, port = 9222, price, stopId, readExpr, dir, ev, tag = '' }) {
  let client = null; const T0 = Date.now(), muestras = [], fotos = [];
  try {
    const targets = await CDP.List({ port });
    const tgt = targets.find(t => t.type === 'page' && /tradingview\.com\/chart/.test(t.url)) || targets.find(t => t.type === 'page');
    if (!tgt) return;
    client = await CDP({ port, target: tgt.id });
    const evalv = async expr => { const r = await client.Runtime.evaluate({ expression: expr, awaitPromise: true, returnByValue: true, timeout: 4000 }); return r.exceptionDetails ? { error: String(r.exceptionDetails.text || 'err') } : r.result.value; };
    const sub = path.join(dir, 'colchon-visual', new Date(T0).toISOString().replace(/[:.]/g, '-').slice(0, 19) + (tag ? '-' + tag : '')); fs.mkdirSync(sub, { recursive: true });
    const P1 = String(price), P2 = Number(price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fullAt = [0, 500, 1500, 4000]; let fi = 0, lastStore = '__init__', firstStoreMs = null, firstDomMs = null;
    while (Date.now() - T0 < 5200) {
      const ms = Date.now() - T0; const m = { ms };
      try { const x = readExpr ? await evalv(readExpr) : null; m.store = x && x.stopPrice != null ? x.stopPrice : null; if (m.store === Number(price) && firstStoreMs == null) firstStoreMs = ms; } catch (e) { m.storeErr = String(e.message || e); }
      const full = fi < fullAt.length && ms >= fullAt[fi];
      if (full) {
        fi++;
        try { const d = await evalv(DOM_JS(P1, P2)); if (d) { m.vis = d.vis; m.focus = d.focus; m.domHits = d.domHits; if (d.domHits && d.domHits.length && firstDomMs == null) firstDomMs = ms; } } catch (e) { m.domErr = String(e.message || e); }
        try { m.raf300ms = await evalv(RAF_JS); } catch {}
        try { const s = await client.Page.captureScreenshot({ format: 'jpeg', quality: 55 }); const f = `foto-${String(ms).padStart(4, '0')}ms.jpg`; fs.writeFileSync(path.join(sub, f), Buffer.from(s.data, 'base64')); m.foto = f; fotos.push(f); } catch (e) { m.fotoErr = String(e.message || e); }
      }
      if (full || m.store !== lastStore) { muestras.push(m); lastStore = m.store; }
      await sleep(250);
    }
    ev('visual_stop', { precio: price, stopId, carpeta: sub, tras: 'stop verificado', primeraLecturaMemoriaMs: firstStoreMs, primerTextoPanelMs: firstDomMs, muestras });
    try { const base = path.join(dir, 'colchon-visual'); const ds = fs.readdirSync(base).sort(); for (const x of ds.slice(0, Math.max(0, ds.length - 40))) fs.rmSync(path.join(base, x), { recursive: true, force: true }); } catch {}
  } catch (e) { try { ev('visual_stop', { precio: price, error: String(e && e.message || e), muestras }); } catch {} }
  finally { try { client && await client.close(); } catch {} }
}