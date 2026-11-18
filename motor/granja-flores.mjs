// Qué flor plantar. La barra y el menú de cuentas leen el bróker
// (/api/colchon/accounts y /api/colchon/conexion). accounts.json solo
// tiene saldo cuando el panel de TradingView ya se pudo leer, y en una
// instalación nueva eso llega vacío. Una cuenta que la barra ve siempre
// tiene flor, aunque todavía no haya saldo y aunque el id no empiece por LFE/LFF.

// A partir de este saldo la cuenta es 50K. 37.500 queda entre 25.000 y 50.000.
export const UMBRAL_50K = 37500;

const CAMPOS_SALDO = ['balance', 'equity', 'peak', 'bal', 'start', 'inicio', 'planStart', 'initialBalance', 'startBalance', 'startOfDay', 'highest', 'lastBal'];

function numerosDe(cuenta) {
  return CAMPOS_SALDO.map(k => Number(cuenta[k])).filter(n => Number.isFinite(n) && n > 0);
}

function nombreDice50(cuenta) {
  const nombre = `${cuenta.name || ''} ${cuenta.id || ''} ${cuenta.accountId || ''} ${cuenta.cuenta || ''}`;
  return cuenta.plan === '50K' || cuenta.size === '50K' || cuenta.planSize === '50K' || /^LF[EF]050/i.test(nombre) || /(^|[^0-9])50\s*K/i.test(nombre);
}

function nombreDice25(cuenta) {
  const nombre = `${cuenta.name || ''} ${cuenta.id || ''} ${cuenta.accountId || ''} ${cuenta.cuenta || ''}`;
  return cuenta.plan === '25K' || cuenta.size === '25K' || cuenta.planSize === '25K' || /^LF[EF]025/i.test(nombre) || /(^|[^0-9])25\s*K/i.test(nombre);
}

// El saldo manda. planSaldo o un inicio ya guardado de 50.000 no bajan a 25K
// aunque el saldo de hoy esté en drawdown. El nombre solo vale si aún no hay ningún saldo.
export function planDe(cuenta = {}) {
  if (cuenta == null) cuenta = {};
  if (typeof cuenta === 'string') cuenta = { id: cuenta, name: cuenta };
  if (cuenta.planSaldo === '50K') return '50K';
  const nums = numerosDe(cuenta);
  if (nums.length) return Math.max(...nums) >= UMBRAL_50K ? '50K' : '25K';
  if (nombreDice50(cuenta)) return '50K';
  if (nombreDice25(cuenta)) return '25K';
  return '25K';
}

export function inicioDe(cuenta = {}) {
  return planDe(cuenta) === '50K' ? 50000 : 25000;
}

export function tipoDe(cuenta = {}) {
  if (cuenta.type === 'funded') return 'funded';
  if (cuenta.type === 'eval') return 'eval';
  const nombre = String(cuenta.name || cuenta.id || '');
  if (/^LFF/i.test(nombre)) return 'funded';
  return 'eval';
}

function nombreDe(cuenta) {
  return String((cuenta && (cuenta.name || cuenta.id)) || '').trim();
}

export function planFlores({ accountsJson = {}, colchon = null } = {}) {
  const archivo = accountsJson && typeof accountsJson.accounts === 'object' && accountsJson.accounts ? accountsJson.accounts : {};
  const brokerOk = !!(colchon && colchon.ok && Array.isArray(colchon.accounts));
  const broker = brokerOk ? colchon.accounts : [];
  const porNombre = new Map();

  for (const raw of Object.values(archivo)) {
    if (!raw || !raw.id || raw.balance == null) continue;
    porNombre.set(String(raw.id), { ...raw, name: String(raw.id) });
  }
  for (const raw of broker) {
    const name = nombreDe(raw);
    if (!name) continue;
    const prev = porNombre.get(name);
    const balance = raw.balance != null ? raw.balance : (prev && prev.balance != null ? prev.balance : null);
    porNombre.set(name, { ...(prev || {}), ...raw, id: name, name, balance });
  }

  const plantar = [];
  for (const a of porNombre.values()) {
    const start = inicioDe(a);
    const bal = a.balance != null ? Number(a.balance) : start;
    plantar.push({
      name: a.name,
      type: tipoDe(a),
      start,
      bal,
      peak: a.peak != null ? Number(a.peak) : Math.max(start, bal),
      dd: a.dd,
      dailyLoss: a.dailyLoss,
      profitTarget: a.profitTarget,
      scale: a.scale,
      plan: a.plan || (start >= 45000 ? '50K' : '25K'),
      lockTriggerOver: a.lockTriggerOver,
      lockFloorOver: a.lockFloorOver,
      atRisk: a.atRisk,
      dayPnl: a.dayPnl,
      burned: !!(a.burned || a.breached),
      tieneSaldo: a.balance != null,
    });
  }

  const live = Array.isArray(accountsJson.live) ? accountsJson.live.map(x => String(x)) : [];
  const mantener = new Set(plantar.map(a => a.name));
  return {
    plantar,
    mantener: brokerOk ? mantener : new Set(live.length ? live : [...mantener]),
    puedeBorrar: brokerOk ? broker.length > 0 : live.length > 0,
    diario: accountsJson.daily || null,
  };
}

export function aplicarFlores(store, datos) {
  const plan = planFlores(datos);
  const actuales = () => (store.get().accounts || []);
  for (const a of plan.plantar) {
    const ex = actuales().find(x => x.name === a.name);
    if (ex) {
      if (ex.type !== a.type) store.upsertAccount({ id: ex.id, type: a.type, bal: a.bal });
      else if (a.tieneSaldo && store.setDaily) store.setDaily(ex.id, { bal: a.bal, pnlToday: a.dayPnl ?? 0 });
      if (a.peak != null && a.peak > (ex.peak ?? 0)) store.upsertAccount({ id: ex.id, peak: a.peak });
      store.upsertAccount({
        id: ex.id, start: a.start, dd: a.dd, dailyLoss: a.dailyLoss, profitTarget: a.profitTarget,
        scale: a.scale, plan: a.plan, lockTriggerOver: a.lockTriggerOver, lockFloorOver: a.lockFloorOver, atRisk: a.atRisk,
      });
      if (a.burned && store.markBurned && !ex.burnedAt) store.markBurned(ex.id);
    } else {
      const n = store.upsertAccount({
        name: a.name, type: a.type, start: a.start, bal: a.bal, peak: a.peak,
        dd: a.dd, dailyLoss: a.dailyLoss, profitTarget: a.profitTarget, scale: a.scale, plan: a.plan,
        lockTriggerOver: a.lockTriggerOver, lockFloorOver: a.lockFloorOver, atRisk: a.atRisk,
      });
      if (n && a.burned && store.markBurned) store.markBurned(n.id);
      if (n && a.tieneSaldo && store.setDaily) store.setDaily(n.id, { pnlToday: a.dayPnl ?? 0 });
    }
  }
  if (plan.diario && store.setDayTotal) {
    for (const [k, v] of Object.entries(plan.diario)) store.setDayTotal(k, v);
  }
  if (plan.puedeBorrar) {
    for (const x of [...actuales()]) {
      if (!x || x.memorial || plan.mantener.has(x.name)) continue;
      if (x.type === 'funded' && store.markBurned) {
        if (!x.burnedAt) store.markBurned(x.id);
      } else if (store.deleteAccount) store.deleteAccount(x.id);
    }
  }
  return plan;
}
