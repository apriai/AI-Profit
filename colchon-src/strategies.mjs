// Registro de estrategias de prueba (Paper/Demo). Para añadir una: nueva entrada con id, name, short, description y params.
// params: SL_USD / TP_USD (bracket en $), NET_USD (neto que protege el colchón), COMM_RT (comisión ida y vuelta por contrato),
// SLIP_TICKS (deslizamiento en ticks), TRIGGER_EXTRA_USD (disparo = colchón + esto, redondeado ARRIBA a tick).
export const STRATEGIES = {
  'dia-minimo-colchon': {
    id: 'dia-minimo-colchon', name: 'Día mínimo + colchón',
    short: 'Bracket SL −$600 / TP +$1,600. Al llegar al disparo, el SL sube para asegurar ≈ +$150 netos.',
    description: 'Entrada a mercado con bracket SL −$600 / TP +$1,600. Colchón = $150 + comisiones Lucid ($1 MNQ / $3.50 NQ por contrato, ida y vuelta) + 1 tick, redondeado arriba a tick. Disparo = colchón + $10 (redondeado arriba a tick).',
    params: { SL_USD: 600, TP_USD: 1600, NET_USD: 150, COMM_RT: { MNQ: 1, NQ: 3.5 }, SLIP_TICKS: 1, TRIGGER_EXTRA_USD: 10 },
  },
  'evaluacion': {
    id: 'evaluacion', name: 'Evaluación',
    short: 'Bracket SL −$630 / TP +$630. Stop escalonado: a +$150 protege +$100, a +$250 protege +$200, a +$350 protege +$300.',
    description: 'Entrada a mercado con bracket SL −$630 / TP +$630. Tres escalones de stop (brutos, sin comisiones), solo hacia arriba y una vez cada uno: +$150 → +$100, +$250 → +$200, +$350 → +$300. El colchón se redondea a tick hacia arriba (nunca por debajo de lo indicado). Si el precio salta varios disparos, va directo al escalón más alto válido.',
    // STEPS: escalones brutos en $ (trigger = P&L que dispara, lock = $ que protege)
    params: { SL_USD: 630, TP_USD: 630, STEPS: [{ trigger: 150, lock: 100 }, { trigger: 250, lock: 200 }, { trigger: 350, lock: 300 }] },
  },
};
export const DEFAULT_STRATEGY = 'dia-minimo-colchon';
export const getStrategy = id => STRATEGIES[id ?? DEFAULT_STRATEGY] || null;
export const listStrategies = () => Object.values(STRATEGIES).map(({ id, name, short, description, params }) => ({ id, name, short, description, params, default: id === DEFAULT_STRATEGY }));
