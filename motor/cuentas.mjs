// Reconoce una cuenta por el nombre que muestra la barra, no por el prefijo LFE/LFF.
// El tipo y el inicio salen de granja-flores.mjs. Sin tipo, es evaluación.
import { inicioDe, tipoDe } from './granja-flores.mjs';

const IGN = new Set(['LFE00000000000000', 'LFF00000000000000']);

export function esPapel(cuenta = {}) {
  const s = `${cuenta.name || ''} ${cuenta.id || ''} ${cuenta.title || ''}`;
  if (/\bLF[EF]\d*/i.test(s)) return false;
  return /paper|demo|\bsim(?:ulat\w*)?\b/i.test(s);
}

export function debeGuardarSaldo(cuenta = {}) {
  if (cuenta.balance == null || !String(cuenta.name || '').trim()) return false;
  return !esPapel(cuenta);
}

export function fusionarCuentas({ accountsJson = {}, colchon = null } = {}) {
  const archivo = accountsJson && accountsJson.accounts && typeof accountsJson.accounts === 'object' ? accountsJson.accounts : {};
  const brokerOk = !!(colchon && colchon.ok && Array.isArray(colchon.accounts));
  const broker = brokerOk ? colchon.accounts : [];
  const porNombre = new Map();
  for (const raw of Object.values(archivo)) {
    if (!raw) continue;
    const name = String(raw.id || raw.name || '').trim();
    if (!name) continue;
    porNombre.set(name, { ...raw, id: name, name });
  }
  for (const raw of broker) {
    const name = String((raw && (raw.name || raw.id)) || '').trim();
    if (!name) continue;
    const prev = porNombre.get(name);
    const balance = raw.balance != null ? raw.balance : (prev && prev.balance != null ? prev.balance : null);
    porNombre.set(name, { ...(prev || {}), ...raw, id: name, name, balance });
  }
  return [...porNombre.values()].map(a => {
    const start = inicioDe(a);
    return { ...a, type: tipoDe(a), start, plan: a.plan || (start >= 45000 ? '50K' : '25K') };
  });
}

export function filtroFondeadas(nombres) {
  const lista = [...(nombres || [])].map(s => String(s).trim()).filter(Boolean);
  if (!lista.length) return null;
  const alt = lista.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return `^(?:${alt})$`;
}

function yaEnLibro(ledger, id) {
  return ledger.some(e => e && (String(e.cuenta || '') === id || String(e.note || '').includes(id)));
}

// Libro vacío: anota la compra estimada de las cuentas que ya existen.
// Libro con datos: no repite una cuenta cuyo id ya está en una línea.
export function anotarNegocio({ cuentas = [], ledger = [], seen = [], burned = [], precio = 50, hoy = '', idNuevo } = {}) {
  const l = (Array.isArray(ledger) ? ledger : []).map(x => ({ ...x }));
  const vistos = new Set((seen || []).map(String));
  const quemadas = new Set((burned || []).map(String));
  const vacio = l.length === 0;
  const nuevo = typeof idNuevo === 'function' ? idNuevo : (p, id) => p + String(id).slice(-4);
  const monto = Number.isFinite(+precio) && +precio >= 0 ? +precio : 50;
  let changed = false;
  let seenChanged = false;
  let fondeos = 0;
  for (const raw of cuentas) {
    const id = String((raw && (raw.name || raw.id)) || '').trim();
    if (!id || IGN.has(id) || esPapel(raw)) continue;
    const tipo = tipoDe(raw);
    const start = inicioDe(raw);
    const dd = start >= 45000 ? 2000 : 1000;
    const conocida = yaEnLibro(l, id);
    if (!conocida && (vacio || !vistos.has(id))) {
      vistos.add(id);
      seenChanged = true;
      changed = true;
      const tam = start >= 45000 ? '50K' : '25K';
      if (tipo === 'funded') {
        fondeos += 1;
        l.push({ id: nuevo('f', id), type: 'fondeo', date: hoy, amount: 0, cuenta: id, note: 'Fondeo ' + id });
      } else {
        l.push({
          id: nuevo('a', id),
          type: 'compra',
          date: hoy,
          amount: monto,
          cuenta: id,
          note: tam + ' ' + id + ' (auto, monto estimado — edítalo)',
        });
      }
    } else if (!vistos.has(id)) {
      vistos.add(id);
      seenChanged = true;
    }
    const bal = raw.balance != null ? Number(raw.balance) : (raw.bal != null ? Number(raw.bal) : null);
    if (tipo !== 'funded' && !quemadas.has(id) && bal != null && Number.isFinite(bal) && bal <= start - dd) {
      quemadas.add(id);
      changed = true;
      l.push({ id: nuevo('q', id), type: 'quemada', date: hoy, amount: 0, cuenta: id, note: 'Quemada ' + id });
    }
  }
  return { ledger: l, seen: [...vistos], burned: [...quemadas], changed, seenChanged, fondeos };
}
