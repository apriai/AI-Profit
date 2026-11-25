// Promedio, SL y TP de Agregar/Promediar. Mismo cálculo que el prototipo aprobado.
// No envía órdenes. El riesgo real queda <= al objetivo y el neto del TP >= a la meta.

export const TICK = 0.25;

const SPEC = {
  MNQ: { pt: 2, tickUsd: 0.5, comm: 1 },
  NQ:  { pt: 20, tickUsd: 5, comm: 3.5 },
};

const LIMITS = {
  '25K': { MNQ: 20, NQ: 2, ddl: 600, dd: 1000, tp: 1600 },
  '50K': { MNQ: 40, NQ: 4, ddl: 1200, dd: 2000, tp: 3200 },
};

const ceilTick = (x) => Math.ceil(x / TICK - 1e-9) * TICK;
const floorTick = (x) => Math.floor(x / TICK + 1e-9) * TICK;
const roundTick = (x) => Math.round(x / TICK) * TICK;
export const money = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const onTick = (x) => Number.isFinite(x) && Math.abs(x / TICK - Math.round(x / TICK)) < 1e-8;
const fmtPx = x => Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

function avgPrice(q1, p1, q2, p2) {
  const qty = q1 + q2;
  const exact = (q1 * p1 + q2 * p2) / qty;
  return { exact, tick: roundTick(exact), qty };
}

/** PnL neto si se sale a exitPx (incluye comisión ida y vuelta de toda la posición). */
function exitPnl({ long, qty, avg, exitPx, pt, comm }) {
  const dir = long ? 1 : -1;
  return qty * dir * (exitPx - avg) * pt - comm;
}

/**
 * SL en el lado de riesgo (pérdida), redondeado al tick en dirección segura:
 * más cerca del promedio / del precio, de modo que el riesgo real ≤ objetivo.
 * Long: SL = ceilTick(avg - dist). Short: SL = floorTick(avg + dist).
 */
function slForRisk({ long, avg, dist }) {
  return long ? ceilTick(avg - dist) : floorTick(avg + dist);
}

/**
 * SL que protege una ganancia neta (colchón ya movido), redondeado para que
 * lo protegido real sea ≥ al objetivo. Long sube el SL; short lo baja.
 */
function slForLock({ long, avg, dist }) {
  return long ? ceilTick(avg + dist) : floorTick(avg - dist);
}

/**
 * TP redondeado para que el neto real sea ≥ al objetivo.
 * Long: ceilTick(avg + dist). Short: floorTick(avg - dist).
 */
function tpForTarget({ long, avg, dist }) {
  return long ? ceilTick(avg + dist) : floorTick(avg - dist);
}

export function compute(i) {
  const errors = [];
  const warnings = [];
  const symbol = i.symbol === 'NQ' ? 'NQ' : 'MNQ';
  const plan = i.plan === '50K' ? '50K' : '25K';
  const inst = SPEC[symbol];
  const lim = LIMITS[plan];
  const pt = inst.pt;
  const commUnit = Number(i.comm);
  const long = i.side !== 'short';
  const q1 = Number(i.qty);
  const p1 = Number(i.avg);
  const sl0 = Number(i.sl);
  const tp0 = Number(i.tp);
  const q2 = Number(i.addQty);
  const p2 = Number(i.addPrice);
  const live = Number(i.live != null ? i.live : i.addPrice);
  const ddlLeft = Number(i.ddlLeft);
  const ddLeft = Number(i.ddLeft);

  const numOk = [q1, p1, sl0, tp0, q2, p2, live, commUnit, ddlLeft, ddLeft].every(Number.isFinite);
  if (!numOk) {
    return { ok: false, errors: ['Faltan datos numéricos o hay un valor inválido.'], warnings };
  }
  if (!Number.isInteger(q1) || q1 < 1 || !Number.isInteger(q2) || q2 < 1) {
    errors.push('Las cantidades tienen que ser enteros de al menos 1 contrato.');
  }
  if (p1 <= 0 || p2 <= 0 || live <= 0 || sl0 <= 0 || tp0 <= 0) {
    errors.push('Los precios tienen que ser mayores que cero.');
  }
  if (commUnit < 0) errors.push('La comisión no puede ser negativa.');
  for (const [label, px] of [['entrada actual', p1], ['SL actual', sl0], ['TP actual', tp0], ['precio de agrega', p2], ['precio actual', live]]) {
    if (Number.isFinite(px) && px > 0 && !onTick(px)) {
      warnings.push(`El ${label} (${px}) no cae en un tick de 0.25. Revisa ese precio.`);
    }
  }

  const Q = q1 + q2;
  const comm1 = q1 * commUnit;
  const commQ = Q * commUnit;
  const avgExact = (q1 * p1 + q2 * p2) / Q;
  const avgTick = roundTick(avgExact);

  const slRiskSide = long ? sl0 < p1 - 1e-12 : sl0 > p1 + 1e-12;
  const slLockSide = long ? sl0 > p1 + 1e-12 : sl0 < p1 - 1e-12;
  const currentGrossSl = q1 * Math.abs(p1 - sl0) * pt;
  const currentRisk = slRiskSide ? money(currentGrossSl + comm1) : 0;
  const currentLock = slLockSide ? money(currentGrossSl - comm1) : 0;
  const currentTarget = money(q1 * Math.abs(tp0 - p1) * pt - comm1);

  const against = long ? p2 < p1 - 1e-12 : p2 > p1 + 1e-12;
  const favor = long ? p2 > p1 + 1e-12 : p2 < p1 - 1e-12;
  if (against) {
    warnings.push('Promedias en contra: el precio de agrega está peor que tu entrada. El riesgo sube fácil y el stop nuevo puede quedar ya tocado.');
  } else if (favor) {
    warnings.push('Piramidas a favor: el precio de agrega está mejor que tu entrada. Si dejas el SL donde está, el riesgo en dólares crece mucho.');
  }

  const maxQty = lim[symbol];
  if (Q > maxQty) {
    errors.push(`El total sería ${Q} ${symbol}, por encima del tope Lucid de ${maxQty} en una cuenta ${plan}.`);
  }

  const leaveSlPnl = exitPnl({ long, qty: Q, avg: avgExact, exitPx: sl0, pt, comm: commQ });
  const leaveTpPnl = exitPnl({ long, qty: Q, avg: avgExact, exitPx: tp0, pt, comm: commQ });
  const leave = {
    sl: sl0,
    tp: tp0,
    risk: leaveSlPnl < 0 ? money(-leaveSlPnl) : 0,
    lock: leaveSlPnl >= 0 ? money(leaveSlPnl) : 0,
    target: money(leaveTpPnl),
    slAlreadyHit: long ? sl0 >= live - 1e-12 : sl0 <= live + 1e-12,
    tpAlreadyHit: long ? tp0 <= live + 1e-12 : tp0 >= live - 1e-12,
  };

  const riskMode = i.riskMode === 'custom' ? 'custom' : 'keep';
  const tpMode = i.tpMode === 'custom' ? 'custom' : 'keep';

  let sl = null;
  let slKind = 'risk';
  let targetRisk = null;
  let targetLock = null;

  if (riskMode === 'keep' && slLockSide) {
    slKind = 'lock';
    targetLock = currentLock;
    const dist = (targetLock + commQ) / (Q * pt);
    if (!Number.isFinite(dist) || dist <= 0) {
      errors.push('No se puede mantener lo protegido: el colchón neto actual no alcanza para cubrir la comisión de la posición nueva.');
    } else {
      sl = slForLock({ long, avg: avgExact, dist });
    }
  } else {
    slKind = 'risk';
    targetRisk = riskMode === 'keep' ? currentRisk : Number(i.customRisk);
    if (!Number.isFinite(targetRisk) || targetRisk <= 0) {
      errors.push('Indica un riesgo objetivo en dólares mayor que cero.');
    } else if (targetRisk <= commQ + 1e-9) {
      errors.push(`El riesgo objetivo ($${money(targetRisk)}) no alcanza ni para la comisión total ($${money(commQ)}).`);
    } else {
      const dist = (targetRisk - commQ) / (Q * pt);
      sl = slForRisk({ long, avg: avgExact, dist });
    }
  }

  let slPnl = null;
  let realRisk = null;
  let realLock = null;
  let slDistPts = null;
  if (sl != null) {
    slPnl = exitPnl({ long, qty: Q, avg: avgExact, exitPx: sl, pt, comm: commQ });
    realRisk = slPnl < 0 ? money(-slPnl) : 0;
    realLock = slPnl >= 0 ? money(slPnl) : 0;
    slDistPts = money(Math.abs(avgExact - sl));
    if (slDistPts + 1e-9 < TICK) {
      errors.push('El SL nuevo quedaría a menos de 1 tick del promedio. No hay distancia válida.');
    }
    if (long && sl >= live - 1e-12) {
      errors.push(`El SL nuevo (${fmtPx(sl)}) quedaría en o por encima del precio actual (${fmtPx(live)}). El stop ya estaría tocado. Prueba un riesgo mayor, menos contratos o no agregar aquí.`);
    }
    if (!long && sl <= live + 1e-12) {
      errors.push(`El SL nuevo (${fmtPx(sl)}) quedaría en o por debajo del precio actual (${fmtPx(live)}). El stop ya estaría tocado. Prueba un riesgo mayor, menos contratos o no agregar aquí.`);
    }
    if (slKind === 'risk' && targetRisk != null && realRisk > targetRisk + 0.009) {
      errors.push('El redondeo no pudo dejar el riesgo por debajo del objetivo. Revisa los precios.');
    }
  }

  const targetUsd = tpMode === 'keep' ? currentTarget : Number(i.customTp);
  let tp = null;
  let realTarget = null;
  let tpDistPts = null;
  if (!Number.isFinite(targetUsd)) {
    errors.push('Indica un objetivo en dólares.');
  } else {
    const distTp = (targetUsd + commQ) / (Q * pt);
    if (distTp <= 0) {
      errors.push('El objetivo en dólares es demasiado bajo (ni cubre la comisión).');
    } else {
      tp = tpForTarget({ long, avg: avgExact, dist: distTp });
      realTarget = money(exitPnl({ long, qty: Q, avg: avgExact, exitPx: tp, pt, comm: commQ }));
      tpDistPts = money(Math.abs(tp - avgExact));
      if (long && tp <= live + 1e-12) {
        warnings.push(`El TP nuevo (${fmtPx(tp)}) ya está en o por debajo del precio actual. El objetivo ya se habría alcanzado.`);
      }
      if (!long && tp >= live - 1e-12) {
        warnings.push(`El TP nuevo (${fmtPx(tp)}) ya está en o por encima del precio actual. El objetivo ya se habría alcanzado.`);
      }
      if (realTarget + 0.009 < targetUsd) {
        errors.push('El redondeo no pudo dejar el objetivo neto en o por encima de la meta.');
      }
    }
  }

  if (realRisk != null && realRisk > ddlLeft + 1e-9) {
    warnings.push('Este SL se pasa de tu daily loss');
  }
  if (realRisk != null && realRisk > ddLeft + 1e-9) {
    warnings.push('Este SL se pasa de tu drawdown');
  }
  if (leave.risk > ddlLeft + 1e-9) {
    warnings.push(`Si dejas el SL donde está, el riesgo sería $${money(leave.risk)} y se pasa del daily loss que te queda ($${money(ddlLeft)}).`);
  }
  if (leave.risk > ddLeft + 1e-9) {
    warnings.push(`Si dejas el SL donde está, el riesgo sería $${money(leave.risk)} y se pasa del drawdown de cierre que te queda ($${money(ddLeft)}).`);
  }
  if (leave.slAlreadyHit) {
    warnings.push('El SL actual ya está en o más allá del precio de ahora. Si lo dejas ahí, el stop ya estaría tocado.');
  }

  const ok = errors.length === 0 && sl != null && tp != null;
  return {
    ok,
    errors,
    warnings,
    symbol,
    plan,
    long,
    pt,
    q1,
    p1,
    q2,
    p2,
    live,
    Q,
    comm1: money(comm1),
    commQ: money(commQ),
    commUnit: money(commUnit),
    avgExact,
    avgTick,
    slIsRisk: slRiskSide,
    slIsLock: slLockSide,
    currentRisk,
    currentLock,
    currentTarget,
    against,
    favor,
    maxQty,
    leave,
    riskMode,
    tpMode,
    slKind,
    targetRisk: targetRisk != null ? money(targetRisk) : null,
    targetLock: targetLock != null ? money(targetLock) : null,
    targetUsd: Number.isFinite(targetUsd) ? money(targetUsd) : null,
    sl,
    tp,
    slDistPts,
    tpDistPts,
    realRisk,
    realLock,
    realTarget,
    sl0,
    tp0,
  };
}

