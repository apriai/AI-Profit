import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { elegirNavegador, exeDeComando, esChromium } from './navegador-granja.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const bat = fs.readFileSync(path.join(here, 'Abrir Granja.bat'), 'utf8');

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const brave = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe';
const firefox = 'C:\\Program Files\\Mozilla Firefox\\firefox.exe';
const env = {
  ProgramFiles: 'C:\\Program Files',
  'ProgramFiles(x86)': 'C:\\Program Files (x86)',
  LOCALAPPDATA: 'C:\\Users\\Ana\\AppData\\Local',
};
const instalados = new Set([chrome, edge, brave]);
const existe = p => instalados.has(p);

assert.equal(exeDeComando(`"${chrome}" --single-argument %1`), chrome);
assert.equal(exeDeComando(`"${edge}" -- "%1"`), edge);
assert.equal(exeDeComando('C:\\brave\\brave.exe %1'), 'C:\\brave\\brave.exe');
assert.equal(exeDeComando(''), '');
assert.equal(esChromium(chrome), true);
assert.equal(esChromium(firefox), false);

assert.equal(elegirNavegador({ comando: `"${chrome}" --single-argument %1`, existe, env }), chrome, 'Chrome predeterminado');
assert.equal(elegirNavegador({ comando: `"${edge}" -- "%1"`, existe, env }), edge, 'Edge predeterminado');
assert.equal(elegirNavegador({ comando: `"${brave}"`, existe, env }), brave, 'Brave predeterminado');
assert.equal(elegirNavegador({ comando: `"${firefox}" -osint -url "%1"`, existe, env }), chrome, 'si no es Chromium, Chrome primero');

instalados.delete(chrome);
assert.equal(elegirNavegador({ comando: `"${firefox}" %1`, existe, env }), edge, 'sin Chrome, Edge');
instalados.delete(edge);
assert.equal(elegirNavegador({ comando: '', existe, env }), '', 'sin Chromium no elige nada');
instalados.add(chrome);
instalados.add(edge);

const roto = 'C:\\no-existe\\chrome.exe';
assert.equal(elegirNavegador({ comando: `"${roto}" %1`, existe, env }), chrome, 'un exe que no está no se usa');

assert.ok(bat.includes('navegador-granja.mjs'), 'el acceso pregunta el predeterminado');
assert.ok(bat.includes('--autoplay-policy=no-user-gesture-required'));
assert.ok(bat.includes('--app="http://localhost:8787/Granja-de-Cuentas-v2.html"'));
assert.ok(bat.includes('--user-data-dir="%PERFIL%"'));
assert.ok(bat.includes('--no-first-run'));
assert.ok(bat.includes('--no-default-browser-check'));
assert.ok(bat.includes('start "" "http://localhost:8787/Granja-de-Cuentas-v2.html"'), 'último recurso: la dirección');
const eleccion = bat.indexOf('navegador-granja.mjs');
const reserva = bat.indexOf('start "" "http://localhost:8787/Granja-de-Cuentas-v2.html"');
assert.ok(eleccion > 0 && eleccion < reserva, 'primero el predeterminado, al final la dirección');

console.log('navegador-granja ok');
