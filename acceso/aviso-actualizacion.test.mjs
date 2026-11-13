import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  parseVersion, compararVersiones, diaLocal, debePreguntar, urlDeInstalador,
  releaseUtil, textoAviso, revisarActualizacion, API_ULTIMA,
} from './aviso-actualizacion.mjs';

let n = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); n++; };
const ok = (c, m) => { assert.ok(c, m); n++; };

eq(parseVersion('0.10.4'), [0, 10, 4]);
eq(parseVersion('v0.10.5'), [0, 10, 5]);
eq(parseVersion('no'), null);
eq(compararVersiones('0.10.4', '0.10.5'), -1);
eq(compararVersiones('0.10.5', '0.10.5'), 0);
eq(compararVersiones('0.11.0', '0.10.9'), 1);
eq(compararVersiones('1.0.0', '0.10.5'), 1);
eq(compararVersiones('mala', '0.10.5'), null);

const hoy = new Date(2026, 10, 13, 15, 0, 0);
eq(diaLocal(hoy), '2026-11-13');
ok(debePreguntar({ local: '0.10.4', remota: '0.10.5', noEl: '', hoy: '2026-11-13' }));
ok(!debePreguntar({ local: '0.10.5', remota: '0.10.5', noEl: '', hoy: '2026-11-13' }), 'la misma no se pregunta');
ok(!debePreguntar({ local: '0.10.6', remota: '0.10.5', noEl: '', hoy: '2026-11-13' }));
ok(!debePreguntar({ local: '0.10.4', remota: '0.10.5', noEl: '2026-11-13', hoy: '2026-11-13' }), 'No hoy, no insiste');
ok(debePreguntar({ local: '0.10.4', remota: '0.10.5', noEl: '2026-11-12', hoy: '2026-11-13' }), 'al día siguiente vuelve a preguntar');
eq(textoAviso('0.10.5'), 'Hay una versión nueva de Profito (0.10.5). ¿Actualizar ahora?');

const buena = 'https://github.com/apriai/AI-Profit/releases/download/v0.10.5/Profito-Setup.exe';
eq(urlDeInstalador(buena), buena);
eq(urlDeInstalador('https://evil.example/Profito-Setup.exe'), '');
eq(urlDeInstalador('http://github.com/apriai/AI-Profit/releases/download/v0.10.5/Profito-Setup.exe'), '');
eq(urlDeInstalador('https://github.com/apriai/AI-Profit/releases/download/v0.10.5/otro.exe'), '');
eq(releaseUtil({
  tag_name: 'v0.10.5',
  assets: [{ name: 'Profito-Setup.exe', browser_download_url: buena }],
}), { version: '0.10.5', setupUrl: buena });
eq(releaseUtil({ tag_name: 'v0.10.5', assets: [] }), null);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aviso-'));
const archivo = path.join(dir, 'aviso-actualizacion.json');
const memoria = new Map();
const io = {
  leerVersion: () => '0.10.4',
  archivoAviso: archivo,
  leerTexto: f => memoria.get(f),
  guardarTexto: (f, txt) => memoria.set(f, txt),
  ahora: () => hoy,
};

const release = {
  tag_name: 'v0.10.5',
  assets: [{ name: 'Profito-Setup.exe', browser_download_url: buena }],
};

let pregunto = 0;
const silencio = await revisarActualizacion({
  ...io,
  fetchImpl: async () => { throw new Error('sin red'); },
  preguntar: async () => { pregunto++; return 'si'; },
  descargar: async () => 'x',
  ejecutar: async () => {},
});
eq(silencio.accion, 'silencio');
eq(pregunto, 0, 'sin internet no pregunta');

const apiLenta = await revisarActualizacion({
  ...io,
  timeoutApiMs: 30,
  fetchImpl: () => new Promise(() => {}),
  preguntar: async () => { pregunto++; return 'si'; },
});
eq(apiLenta.accion, 'silencio', 'la API que no responde no bloquea');
eq(pregunto, 0);

const dijoNo = await revisarActualizacion({
  ...io,
  fetchImpl: async (url) => {
    ok(url === API_ULTIMA);
    return { ok: true, json: async () => release };
  },
  preguntar: async (v) => { eq(v, '0.10.5'); return 'no'; },
  descargar: async () => { throw new Error('no debía bajar'); },
});
eq(dijoNo.accion, 'no');
eq(JSON.parse(memoria.get(archivo)).noEl, '2026-11-13');

const otraVez = await revisarActualizacion({
  ...io,
  fetchImpl: async () => ({ ok: true, json: async () => release }),
  preguntar: async () => { pregunto++; return 'si'; },
});
eq(otraVez.accion, 'omitido');
eq(pregunto, 0, 'el No de hoy no se repite');

memoria.clear();
let bajo = '';
let ejecuto = '';
let cerro = false;
const dijoSi = await revisarActualizacion({
  ...io,
  fetchImpl: async () => ({ ok: true, json: async () => release }),
  preguntar: async () => 'si',
  descargar: async (url, version) => { bajo = url; eq(version, '0.10.5'); return 'C:\\Temp\\Profito-Setup-0.10.5.exe'; },
  ejecutar: async destino => { ejecuto = destino; },
  cerrarProfito: async () => { cerro = true; },
});
eq(dijoSi.accion, 'si');
eq(bajo, buena);
eq(ejecuto, 'C:\\Temp\\Profito-Setup-0.10.5.exe');
ok(cerro);

const ocupado = await revisarActualizacion({
  ...io,
  ocupado: true,
  fetchImpl: async () => { throw new Error('no debía consultar'); },
  preguntar: async () => 'si',
});
eq(ocupado.accion, 'ocupado');

console.log(n + ' comprobaciones del aviso pasaron');
