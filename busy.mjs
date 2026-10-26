// busy.mjs - SOLO LECTURA. Dice si la cuenta activa tiene posicion u ordenes de trabajo. Necesita TradingView con CDP 9222.
// Uso (desde la carpeta TradingLink): node-win\node.exe busy.mjs     Reiniciar el servidor SOLO si "busy" es false.
import { readAccounts } from './colchon.mjs';
const mask = s => String(s == null ? '' : s).replace(/\b(LF[EF]\d)\d{3,}(\d{3})\b/g, '$1...$2');
try {
  const r = await readAccounts({ all: false });
  console.log(JSON.stringify({ busy: r.busy, cuentasVivas: Array.isArray(r.live) ? r.live.length : null, actual: mask(r.current), error: r.error ? mask(r.error) : null }));
} catch (e) { console.log(JSON.stringify({ busy: true, error: mask(e && e.message || e) })); }
process.exit(0);