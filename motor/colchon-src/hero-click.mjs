// Edge headless 9333: clic agente abre color SIEMPRE; en Prueba el pill despierta; fuera de Prueba el pill hace toggle de #tlPanel. Sin trades.
import { createRequire } from 'module'; const req = createRequire(process.cwd() + '/tradingview-mcp/package.json');
const CDP = req('chrome-remote-interface'); const sleep = ms => new Promise(r => setTimeout(r, ms)); const { spawn } = await import('child_process');
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + process.env.TEMP + '/edge9333', '--window-size=1400,850', 'http://localhost:8787/'], { stdio: 'ignore' });
await sleep(7000); const c = await CDP({ port: 9333 }); const { Runtime, Input, Page } = c; await Page.enable(); await sleep(4000);
const ev = async e => (await Runtime.evaluate({ expression: e, returnByValue: true, awaitPromise: true })).result.value;
const click = async (x, y) => { for (const t of ['mousePressed', 'mouseReleased']) await Input.dispatchMouseEvent({ type: t, x, y, button: 'left', clickCount: 1 }); };
const picker = () => ev(`document.getElementById('blobColors').classList.contains('open')`), close = () => ev(`document.getElementById('blobColors').classList.remove('open')`);
const panel = () => ev(`document.getElementById('tlPanel').classList.contains('open')`), label = () => ev(`document.querySelector('#botToggle b').textContent`);
const agent = () => ev(`(()=>{const g=window.__gx;const v=g.ci.getWorldPosition(new g.P);v.y+=.5;v.project(g.Lt);return {x:(v.x+1)/2*innerWidth,y:(1-v.y)/2*innerHeight}})()`);
const pill = () => ev(`(()=>{const r=document.getElementById('botToggle').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
let a = await agent(); await click(a.x, a.y); await sleep(800); console.log('OFF clic agente -> picker', await picker()); await close(); await sleep(400);
const p0 = await panel(); let pp = await pill(); await click(pp.x, pp.y); await sleep(600); console.log('OFF pill -> tlPanel', p0, '->', await panel(), 'label', await label()); await click(pp.x, pp.y); await sleep(600);
await ev(`document.getElementById('prBtn').click()`); await sleep(2500); console.log('Prueba ON -> label', await label(), 'fase', await ev('window.__prueba().phase'));
a = await agent(); await click(a.x, a.y); await sleep(800); console.log('ON clic agente -> picker', await picker(), 'fase', await ev('window.__prueba().phase')); await close(); await sleep(400);
const p1 = await panel(); pp = await pill(); await click(pp.x, pp.y); await sleep(1200);
console.log('ON pill -> fase', await ev('window.__prueba().phase'), 'tarjeta', await ev(`getComputedStyle(document.getElementById('prCard')).display`), 'tlPanel cambió', p1 !== await panel(), 'texto', await ev(`document.getElementById('prCard').innerText.replace(/\\n+/g,' | ')`));
const s = await Page.captureScreenshot(); (await import('fs')).writeFileSync('backups/hero-prueba-pill.png', Buffer.from(s.data, 'base64'));
await ev(`document.getElementById('prBtn').click()`); await sleep(500); console.log('Prueba OFF -> label', await label()); await c.close(); edge.kill();
