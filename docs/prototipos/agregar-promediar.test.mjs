import { compute, money, fmtPx, fmtUsd } from './agregar-promediar.calc.mjs';

const base = {
  symbol: 'MNQ',
  plan: '25K',
  comm: 1,
  qty: 5,
  avg: 21000,
  sl: 20950,
  tp: 21160,
  addQty: 5,
  ddlLeft: 600,
  ddLeft: 1000,
  riskMode: 'keep',
  tpMode: 'keep',
};

const cases = [
  {
    name: '1. Promediar a la baja (largo)',
    input: { ...base, side: 'long', addPrice: 20960, live: 20960 },
    expect: {
      avgExact: 20980,
      sl: 20955.25,
      tp: 21060.25,
      currentRisk: 505,
      currentTarget: 1595,
      realRisk: 505,
      realTarget: 1595,
      leaveRisk: 610,
      leaveTarget: 3590,
      against: true,
      favor: false,
      ok: true,
    },
  },
  {
    name: '2. Piramidar a favor (largo)',
    input: { ...base, side: 'long', addPrice: 21040, live: 21040 },
    expect: {
      avgExact: 21020,
      sl: 20995.25,
      tp: 21100.25,
      currentRisk: 505,
      currentTarget: 1595,
      realRisk: 505,
      realTarget: 1595,
      leaveRisk: 1410,
      leaveTarget: 2790,
      against: false,
      favor: true,
      ok: true,
    },
  },
  {
    name: '3. Corto, promediando en contra',
    input: { ...base, side: 'short', sl: 21050, tp: 20840, addPrice: 21040, live: 21040 },
    expect: {
      avgExact: 21020,
      sl: 21044.75,
      tp: 20939.75,
      currentRisk: 505,
      currentTarget: 1595,
      realRisk: 505,
      realTarget: 1595,
      leaveRisk: 610,
      leaveTarget: 3590,
      against: true,
      favor: false,
    },
  },
  {
    name: '4. Redondeo seguro (riesgo custom 401, 5+2 MNQ)',
    input: {
      ...base,
      side: 'long',
      addQty: 2,
      addPrice: 20960,
      live: 20960,
      riskMode: 'custom',
      customRisk: 401,
      tpMode: 'custom',
      customTp: 1600,
      ddlLeft: 600,
      ddLeft: 1000,
    },
    expect: {
      avgExact: 146920 / 7,
      sl: 20960.5,
      realRisk: 400, // ≤ 401
      // live is 20960, SL 20960.5 is ABOVE live for a long → should BLOCK
    },
  },
];

let failed = 0;
for (const c of cases) {
  const r = compute(c.input);
  const exp = c.expect;
  const checks = [];
  const near = (a, b, eps = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps;
  const eqm = (a, b) => money(a) === money(b);
  if (exp.avgExact != null) checks.push(['avgExact', near(r.avgExact, exp.avgExact), r.avgExact, exp.avgExact]);
  if (exp.sl != null) checks.push(['sl', near(r.sl, exp.sl), r.sl, exp.sl]);
  if (exp.tp != null) checks.push(['tp', near(r.tp, exp.tp), r.tp, exp.tp]);
  if (exp.currentRisk != null) checks.push(['currentRisk', eqm(r.currentRisk, exp.currentRisk), r.currentRisk, exp.currentRisk]);
  if (exp.currentTarget != null) checks.push(['currentTarget', eqm(r.currentTarget, exp.currentTarget), r.currentTarget, exp.currentTarget]);
  if (exp.realRisk != null) checks.push(['realRisk', eqm(r.realRisk, exp.realRisk), r.realRisk, exp.realRisk]);
  if (exp.realTarget != null) checks.push(['realTarget', eqm(r.realTarget, exp.realTarget), r.realTarget, exp.realTarget]);
  if (exp.leaveRisk != null) checks.push(['leaveRisk', eqm(r.leave.risk, exp.leaveRisk), r.leave.risk, exp.leaveRisk]);
  if (exp.leaveTarget != null) checks.push(['leaveTarget', eqm(r.leave.target, exp.leaveTarget), r.leave.target, exp.leaveTarget]);
  if (exp.against != null) checks.push(['against', r.against === exp.against, r.against, exp.against]);
  if (exp.favor != null) checks.push(['favor', r.favor === exp.favor, r.favor, exp.favor]);
  if (exp.ok != null) checks.push(['ok', r.ok === exp.ok, r.ok, exp.ok]);

  const bad = checks.filter(x => !x[1]);
  console.log('\n=== ' + c.name + ' ===');
  console.log('ok=', r.ok, 'errors=', r.errors);
  console.log('warnings=', r.warnings);
  console.log(`avg exact=${r.avgExact}  tick=${r.avgTick}`);
  console.log(`SL ${fmtPx(r.sl)} (${r.slDistPts} pts)  riesgo real ${fmtUsd(r.realRisk)}  lock ${fmtUsd(r.realLock)}`);
  console.log(`TP ${fmtPx(r.tp)} (${r.tpDistPts} pts)  objetivo real ${fmtUsd(r.realTarget)}`);
  console.log(`dejar SL/TP: riesgo ${fmtUsd(r.leave.risk)}  objetivo ${fmtUsd(r.leave.target)}`);
  if (bad.length) {
    failed += 1;
    console.log('FALLOS:');
    for (const b of bad) console.log('  ', b[0], 'obtuvo', b[2], 'esperaba', b[3]);
  } else {
    console.log('PASA');
  }
}

// Caso 1 should be ok: risk 505 <= 600. I accidentally set ok:false in expect; the test will tell me.
// Caso 4: SL 20960.5 vs live 20960 — block. Recheck math and print.

console.log('\n--- resumen ---');
if (failed) {
  console.log(failed + ' caso(s) con diferencia vs lo esperado (revisar).');
  process.exitCode = 1;
} else {
  console.log('Todos los chequeos pasaron.');
}
