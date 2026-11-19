// Registro de estrategias. Orden: Evaluación → Evaluación con rascacielos → Rascacielo (Dia Minimo+Colchon) → Fast Breakeven → Dos disparos · 1:2.
// Explicaciones al estilo flecha: +$112 → protege ~$100. Todas usan el mismo motor colchon (modifyOrder / Tradovate·Bit).
// Rascacielo (Dia Minimo+Colchon) / Fast Breakeven: idea de Karol (PR #19), integradas en 0.8.0.
// El id viejo «rascacielo» (SL −$600 / TP +$104, stop fijo) ya no está: una selección guardada cae en la estrategia por defecto.
// Las propias (estrategias-propias.json, solo esta computadora) se agregan al final con propia:true y no pisan un id de serie.
import { getPropia, listPropias } from './estrategias-propias.mjs';
export const STRATEGY_ORDER = ['evaluacion-simple', 'evaluacion', 'dia-minimo-colchon', 'prueba-be', 'dos-disparos'];
export const STRATEGIES = {
  'evaluacion-simple': {
    id: 'evaluacion-simple', name: 'Evaluación',
    short: "Operación: SL −$630 / TP +$630\nAI: el stop no se mueve",
    description: "Operación: entra a mercado con SL −$630 y TP +$630. AI: el stop no se mueve; termina en TP, en SL o si la cierras tú.",
    params: { SL_USD: 630, TP_USD: 630, STEPS: [], DEFAULT_QTY: { MNQ: 8, NQ: 1 } },
  },
  'evaluacion': {
    id: 'evaluacion', name: 'Evaluación con rascacielos',
    short: "Evaluación con rascacielos. Operación: SL −$630 / TP +$630\n~+$112 → protege ~$100 netos",
    description: "Evaluación con rascacielos. Operación: entra a mercado con SL −$630 y TP +$630. AI: ~+$112 → el stop sube una sola vez para proteger ~$100 netos y el trade sigue hasta el TP o el SL. Solo sube, nunca baja.",
    params: { SL_USD: 630, TP_USD: 630, NET_USD: 100, COMM_RT: { MNQ: 1, NQ: 3.5 }, SLIP_TICKS: 1, TRIGGER_EXTRA_USD: 15, DEFAULT_QTY: { MNQ: 8, NQ: 1 } },
  },
  'dia-minimo-colchon': {
    id: 'dia-minimo-colchon', name: 'Rascacielo (Dia Minimo+Colchon)',
    short: "Rascacielo (Dia Minimo+Colchon). Operación: SL −$600 / TP +$1,600\n~+$115 → protege ~$100",
    description: "Rascacielo (Dia Minimo+Colchon). Operación: entra a mercado con SL −$600 y TP +$1,600. AI: ~+$115 → el stop sube para proteger ~$100 netos. Solo sube, nunca baja.",
    params: { SL_USD: 600, TP_USD: 1600, NET_USD: 100, COMM_RT: { MNQ: 1, NQ: 3.5 }, SLIP_TICKS: 1, TRIGGER_EXTRA_USD: 15, DEFAULT_QTY: { MNQ: 8, NQ: 2 } },
  },
  'prueba-be': {
    id: 'prueba-be', name: 'Fast Breakeven',
    short: "Fast Breakeven. Operación: SL −$630 / TP +$630\n+$15 → stop a entrada +3 ticks (cubre la comisión)",
    description: "Fast Breakeven. Operación: entra a mercado con SL −$630 y TP +$630. AI: +$15 → el stop sube a la entrada +3 ticks de ganancia (0.75 pts), para cubrir al menos la comisión. Se mueve una sola vez.",
    params: { SL_USD: 630, TP_USD: 630, STEPS: [{ trigger: 15, lockTicks: 3 }], PROB: 'tp', DEFAULT_QTY: { MNQ: 8, NQ: 1 } },
  },
  'dos-disparos': {
    id: 'dos-disparos', name: 'Dos disparos · 1:2',
    short: "Operación: SL −$300 / TP +$630 (25K) · 50K: −$600 / +$1,260\nAI: el stop no se mueve; hasta 2 intentos al día",
    description: "Dos disparos · 1:2. Operación: entra a mercado con SL −$300 y TP +$630 en una cuenta de 25K (en 50K, el doble: SL −$600 y TP +$1,260). AI: el stop no se mueve; termina en TP, en SL o si la cierras tú. Hasta 2 intentos al día (el segundo lo abres tú; el motor no reentra solo).",
    params: { SL_USD: 300, TP_USD: 630, STEPS: [], SCALE_BY_SIZE: { '25K': 1, '50K': 2 }, DEFAULT_QTY: { MNQ: 8, NQ: 1 } },
  },
};
export const DEFAULT_STRATEGY = 'evaluacion-simple';
const pubBuilt = s => { const { id, name, short, description, params } = s; return { id, name, short, description, params, default: id === DEFAULT_STRATEGY, propia: false }; };
export const getStrategy = id => {
  const key = id == null || id === '' || id === 'rascacielo' ? DEFAULT_STRATEGY : id;
  const built = STRATEGIES[key];
  if (built) return built;
  if (typeof key === 'string' && key.startsWith('propia-')) return getPropia(key);
  return null;
};
export const listStrategies = () => {
  const built = STRATEGY_ORDER.map(id => STRATEGIES[id]).filter(Boolean).map(pubBuilt);
  const have = new Set(built.map(s => s.id));
  return built.concat(listPropias().filter(s => s && s.id && !have.has(s.id)));
};
export { accountPlanSize, paramsForAccount, rulesFor, PLANS, attachPlan, maxQtyFor } from './account-size.mjs';
