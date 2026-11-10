// Fuente única del tamaño de cuenta (25K / 50K) y de las reglas que dependen de él.
// Detección: id Lucid LFE050…/LFF050… o token 50K, o algún saldo de plan ≥ 45,000.
// Un id LFE025/LFF025 o token 25K gana sobre un startOfDay crecido.
// Si no, 25K. Los dólares de estrategia se adaptan ×2. Las reglas Lucid que no son ×2
// (objetivo de ganancia, trail de bloqueo, piso bloqueado) usan la cifra oficial.

export const PLANS = {
  '25K': {
    size: '25K',
    scale: 1,
    start: 25000,
    dd: 1000,
    lockTriggerOver: 1100,
    lockFloorOver: 100,
    dailyLoss: 600,
    profitTarget: 1250,
    atRisk: 300,
  },
  '50K': {
    size: '50K',
    scale: 2,
    start: 50000,
    dd: 2000,
    // Oficial LucidFlex: trail en 52,100 (= start + 2,100), no 2,200 (que sería 1,100×2).
    // https://support.lucidtrading.com/en/articles/12945815-lucidflex-drawdown
    lockTriggerOver: 2100,
    // Oficial: el MLL se fija en saldo inicial + $100 en todos los tamaños (no ×2).
    lockFloorOver: 100,
    // Flex no publica tabla de DLL en el help; 600×2 = 1,200, alineado con el storefront
    // citado por terceros y con el DLL de LucidPro 50K.
    // https://support.lucidtrading.com/en/articles/12890122-lucidpro-daily-loss-limit
    dailyLoss: 1200,
    // Oficial LucidFlex evaluación 50K: $3,000 (no 1,250×2 = 2,500).
    // https://support.lucidtrading.com/en/articles/12945790-lucidflex-evaluation-account
    profitTarget: 3000,
    atRisk: 600,
  },
};

const numOrNull = v => {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : null;
};

export function accountPlanSize(account = {}) {
  if (account == null) account = {};
  if (typeof account === 'string') account = { id: account, name: account };
  const forced = account.size || account.plan || account.planSize;
  if (forced === '50K' || forced === '25K') return forced;
  const labels = [account.id, account.name, account.accountId, account.cuenta]
    .filter(v => v != null && String(v).trim() !== '')
    .map(v => String(v).trim());
  if (labels.some(s => /^LF[EF]050/i.test(s) || /(^|[^A-Za-z0-9])50K([^A-Za-z0-9]|$)/i.test(s))) return '50K';
  if (labels.some(s => /^LF[EF]025/i.test(s) || /(^|[^A-Za-z0-9])25K([^A-Za-z0-9]|$)/i.test(s))) return '25K';
  const starts = [account.inicio, account.initialBalance, account.startBalance, account.planStart, account.start, account.startOfDay]
    .map(numOrNull)
    .filter(x => x != null);
  if (starts.some(x => x >= 45000)) return '50K';
  return '25K';
}

export function rulesFor(account) {
  return { ...PLANS[accountPlanSize(account)] };
}

export function attachPlan(account = {}) {
  const r = rulesFor(account);
  return Object.assign(account, {
    plan: r.size,
    scale: r.scale,
    start: r.start,
    planStart: r.start,
    dd: r.dd,
    dailyLoss: r.dailyLoss,
    profitTarget: r.profitTarget,
    lockTriggerOver: r.lockTriggerOver,
    lockFloorOver: r.lockFloorOver,
    atRisk: r.atRisk,
  });
}

// Multiplica los dólares de la estrategia (SL, TP, STEPS trigger/lock, NET, TRIGGER_EXTRA).
// lockTicks no se toca: son ticks para cubrir comisión, no una cifra de la cuenta 25K.
export function paramsForAccount(params, account) {
  if (!params) return params;
  const scale = rulesFor(account).scale;
  if (scale === 1) return params;
  const mul = v => {
    const x = numOrNull(v);
    return x == null ? v : x * scale;
  };
  const out = { ...params };
  if (params.SL_USD != null) out.SL_USD = mul(params.SL_USD);
  if (params.TP_USD != null) out.TP_USD = mul(params.TP_USD);
  if (params.NET_USD != null) out.NET_USD = mul(params.NET_USD);
  if (params.TRIGGER_EXTRA_USD != null) out.TRIGGER_EXTRA_USD = mul(params.TRIGGER_EXTRA_USD);
  if (Array.isArray(params.STEPS)) {
    out.STEPS = params.STEPS.map(s => {
      const n = { ...s };
      if (s.trigger != null) n.trigger = mul(s.trigger);
      if (s.lock != null) n.lock = mul(s.lock);
      return n;
    });
  }
  return out;
}
