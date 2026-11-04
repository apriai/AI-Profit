// Registro de estrategias. Orden: Evaluación → Evaluación con trailing → Día mínimo + colchón → Prueba BE.
// Explicaciones al estilo flecha: +$300 → protege $100. Todas usan el mismo motor colchon (modifyOrder / Tradovate·Bit).
export const STRATEGY_ORDER = ['evaluacion-simple', 'evaluacion', 'dia-minimo-colchon', 'prueba-be'];
export const STRATEGIES = {
  'evaluacion-simple': {
    id: 'evaluacion-simple', name: 'Evaluación',
    short: "Operación: SL −$630 / TP +$630\nAI: el stop no se mueve",
    description: "Operación: entra a mercado con SL −$630 y TP +$630. AI: el stop no se mueve; termina en TP, en SL o si la cierras tú.",
    params: { SL_USD: 630, TP_USD: 630, STEPS: [], DEFAULT_QTY: { MNQ: 8, NQ: 1 } },
  },
  'evaluacion': {
    id: 'evaluacion', name: 'Evaluación con trailing',
    short: "Operación: SL −$630 / TP +$630\n+$200 → protege $0 (entrada)\n+$300 → protege $100\n+$500 → protege $200",
    description: "Operación: entra a mercado con SL −$630 y TP +$630. AI: +$200 → el stop sube a la entrada (sin pérdida); +$300 → protege $100; +$500 → protege $200. Solo sube, nunca baja.",
    params: { SL_USD: 630, TP_USD: 630, STEPS: [{ trigger: 200, lock: 0 }, { trigger: 300, lock: 100 }, { trigger: 500, lock: 200 }], DEFAULT_QTY: { MNQ: 8, NQ: 1 } },
  },
  'dia-minimo-colchon': {
    id: 'dia-minimo-colchon', name: 'Día mínimo + colchón',
    short: "Operación: SL −$600 / TP +$1,600\n~+$115 → protege ~$100",
    description: "Operación: entra a mercado con SL −$600 y TP +$1,600. AI: ~+$115 → el stop sube para proteger ~$100 netos. Solo sube, nunca baja.",
    params: { SL_USD: 600, TP_USD: 1600, NET_USD: 100, COMM_RT: { MNQ: 1, NQ: 3.5 }, SLIP_TICKS: 1, TRIGGER_EXTRA_USD: 15, DEFAULT_QTY: { MNQ: 8, NQ: 2 } },
  },
  'prueba-be': {
    id: 'prueba-be', name: 'Prueba BE',
    short: "Operación: SL −$630 / TP +$630\n+$15 → protege $0 (entrada)",
    description: "Operación: entra a mercado con SL −$630 y TP +$630. AI: +$15 → el stop sube a la entrada (sin pérdida). Se mueve una sola vez.",
    params: { SL_USD: 630, TP_USD: 630, STEPS: [{ trigger: 15, lock: 0 }], PROB: 'tp', DEFAULT_QTY: { MNQ: 8, NQ: 1 } },
  },
};
export const DEFAULT_STRATEGY = 'evaluacion-simple';
export const getStrategy = id => STRATEGIES[id ?? DEFAULT_STRATEGY] || null;
export const listStrategies = () => STRATEGY_ORDER.map(id => STRATEGIES[id]).filter(Boolean).map(({ id, name, short, description, params }) => ({ id, name, short, description, params, default: id === DEFAULT_STRATEGY }));
