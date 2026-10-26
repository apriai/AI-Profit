// Registro de estrategias de prueba (Paper/Demo). Para añadir una: nueva entrada con id, name, short, description y params.
// params: SL_USD / TP_USD (bracket en $), NET_USD (neto que protege el colchón), COMM_RT (comisión ida y vuelta por contrato),
// SLIP_TICKS (deslizamiento en ticks), TRIGGER_EXTRA_USD (disparo = colchón + esto, redondeado ARRIBA a tick).
export const STRATEGIES = {
  'dia-minimo-colchon': {
    id: 'dia-minimo-colchon', name: 'Día mínimo + colchón',
    short: 'Bracket SL −$600 / TP +$1,600. Al llegar al disparo, el SL sube para asegurar ≈ +$100 netos.',
    description: 'Entrada a mercado con bracket SL −$600 / TP +$1,600. Colchón = $100 + comisiones Lucid ($1 MNQ / $3.50 NQ por contrato, ida y vuelta) + 1 tick, redondeado arriba a tick. Disparo = colchón + $15 (redondeado arriba a tick).',
    params: { SL_USD: 600, TP_USD: 1600, NET_USD: 100, COMM_RT: { MNQ: 1, NQ: 3.5 }, SLIP_TICKS: 1, TRIGGER_EXTRA_USD: 15, DEFAULT_QTY: { MNQ: 5, NQ: 2 } },
  },
  'evaluacion': {
    id: 'evaluacion', name: 'Trailing stop loss - Evaluación',
    short: 'Bracket SL −$630 / TP +$630. Stop escalonado: a +$150 protege +$100, a +$250 protege +$200, a +$350 protege +$300.',
    description: 'Entrada a mercado con bracket SL −$630 / TP +$630. Tres escalones de stop (brutos, sin comisiones), solo hacia arriba y una vez cada uno: +$150 → +$100, +$250 → +$200, +$350 → +$300. El colchón se redondea a tick hacia arriba (nunca por debajo de lo indicado). Si el precio salta varios disparos, va directo al escalón más alto válido.',
    // STEPS: escalones brutos en $ (trigger = P&L que dispara, lock = $ que protege)
    params: { SL_USD: 630, TP_USD: 630, STEPS: [{ trigger: 150, lock: 100 }, { trigger: 250, lock: 200 }, { trigger: 350, lock: 300 }] },
  },
  'evaluacion-simple': {
    id: 'evaluacion-simple', name: 'Evaluación',
    short: 'Bracket SL −$630 / TP +$630. Sin movimientos de stop.',
    description: 'Entrada a mercado con bracket SL −$630 / TP +$630. El stop no se mueve nunca: termina en TP o SL (o cierre manual).',
    params: { SL_USD: 630, TP_USD: 630, STEPS: [] },
  },
  'prueba-be': {
    id: 'prueba-be', name: 'PRUEBA BE',
    short: 'Bracket SL −$630 / TP +$630. A +$15 el SL pasa a la entrada (break even).',
    description: 'Prueba de lectura de P&L y movimiento de SL: entrada a mercado con bracket SL −$630 / TP +$630 (10 MNQ por defecto). Un solo paso: cuando el P&L (la fuente más rápida del bróker) llega a +$15, el stop se mueve al precio de entrada (break even, $0 protegidos). Solo se mueve una vez y nunca hacia atrás.',
    params: { SL_USD: 630, TP_USD: 630, STEPS: [{ trigger: 15, lock: 0 }], PROB: 'tp', DEFAULT_QTY: { MNQ: 5, NQ: 1 } },
  },
};
export const DEFAULT_STRATEGY = 'dia-minimo-colchon';
export const getStrategy = id => STRATEGIES[id ?? DEFAULT_STRATEGY] || null;
export const listStrategies = () => Object.values(STRATEGIES).map(({ id, name, short, description, params }) => ({ id, name, short, description, params, default: id === DEFAULT_STRATEGY }));
