// Instalación nueva: la barra ve la cuenta del bróker y accounts.json está vacío.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { aplicarFlores, inicioDe } from './granja-flores.mjs';

function tienda() {
  const cuentas = [];
  let n = 1;
  return {
    cuentas,
    get: () => ({ accounts: cuentas }),
    upsertAccount(a) {
      if (a.id != null) {
        const ex = cuentas.find(x => x.id === a.id);
        if (ex) Object.assign(ex, a);
        return ex;
      }
      const row = { id: n++, memorial: false, burnedAt: null, ...a };
      cuentas.push(row);
      return row;
    },
    setDaily(id, p) {
      const ex = cuentas.find(x => x.id === id);
      if (ex) Object.assign(ex, p);
    },
    deleteAccount(id) {
      const i = cuentas.findIndex(x => x.id === id);
      if (i >= 0) cuentas.splice(i, 1);
    },
    markBurned(id) {
      const ex = cuentas.find(x => x.id === id);
      if (ex) ex.burnedAt = 'quemada';
    },
    setDayTotal() {},
  };
}

const fresh = tienda();
fresh.cuentas.push({ id: 9, name: 'Demo vieja', type: 'eval', memorial: false, bal: 25000 });
const plan = aplicarFlores(fresh, {
  accountsJson: { accounts: {}, live: ['OTRA-QUE-NO-COINCIDE'], daily: {} },
  colchon: {
    ok: true,
    broker: 'Tradovate',
    accounts: [
      { id: 'LFE05099900011111', name: 'LFE05099900011111', type: 'eval', plan: '50K', start: 50000, current: true, allowed: true },
      { name: 'Cuenta Lucid sin prefijo', plan: '25K', current: false, allowed: true },
    ],
  },
});
assert.equal(plan.plantar.length, 2);
assert.equal(fresh.cuentas.some(a => a.name === 'Demo vieja'), false, 'la lista vieja no borra la cuenta que el bróker sí muestra, y sí quita la que no está');
const cincuenta = fresh.cuentas.find(a => a.name === 'LFE05099900011111');
assert.ok(cincuenta, 'la cuenta 50K que ve la barra tiene flor');
assert.equal(cincuenta.start, 50000);
assert.equal(cincuenta.bal, 50000, 'sin saldo todavía, la flor usa el inicio del plan');
assert.equal(cincuenta.plan, '50K');
const suelta = fresh.cuentas.find(a => a.name === 'Cuenta Lucid sin prefijo');
assert.ok(suelta, 'un id que no empieza por LFE/LFF también se planta si el menú lo muestra');
assert.equal(suelta.start, 25000);
assert.equal(inicioDe({ plan: '50K' }), 50000);

const conSaldo = tienda();
aplicarFlores(conSaldo, {
  accountsJson: {
    accounts: { LFE02588043490023: { id: 'LFE02588043490023', type: 'eval', balance: 25110, dayPnl: 110, start: 25000, plan: '25K' } },
    live: ['LFE02588043490023'],
  },
  colchon: { ok: true, accounts: [{ name: 'LFE02588043490023', type: 'eval', plan: '25K', start: 25000, balance: 25110, current: true }] },
});
assert.equal(conSaldo.cuentas.length, 1);
assert.equal(conSaldo.cuentas[0].bal, 25110);

const html = fs.readFileSync(new URL('./Granja-de-Cuentas-v2.html', import.meta.url), 'utf8');
assert.match(html, /from '\/granja-flores\.mjs'/);
assert.match(html, /aplicarFlores/);
assert.match(html, /\/api\/colchon\/accounts/);
assert.match(html, /if \(!s\) \{ setTimeout\(sync, 500\); return; \}/);

console.log('granja-flores ok');
