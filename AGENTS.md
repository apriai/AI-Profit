# AGENTS.md: reglas para cualquier agente (Grok) que trabaje en este repositorio

Repositorio privado de Prop Farm / TradingLink (motor y página, sin datos personales). El texto largo está en `docs/AGENTS.md`. Los pasos para actualizar están en `docs/INSTRUCCIONES-GROK.md`.

## Reglas que no se rompen
1. Nunca abras, modifiques, canceles ni cierres órdenes reales por tu cuenta. Solo Caroline lo hace desde la granja.
2. Nunca reinicies el servidor si hay una operación abierta u órdenes pendientes. Primero confirma que está sin posición y sin órdenes.
3. Haz copia de respaldo de cualquier archivo antes de editarlo (carpeta `backups\`).
4. No subas nunca al repositorio cuentas, saldos, historial, registros ni números de cuenta completos. Al mostrar una cuenta, enmascárala: primeros 4 y últimos 3 caracteres.
5. Trabaja solo en tu propia rama `caroline`. Nunca subas a `main`. Para proponer un cambio abre un pull request y espera a que Bänéd lo apruebe.
6. No instales nada en todo el sistema. Solo herramientas portátiles dentro de la carpeta de TradingLink.
7. No hagas clics dentro de TradingView.
8. No inventes números ni resultados. Si algo no se puede verificar, dilo.

El servidor está en `motor/`. Los datos personales van a `datos/` (o se quedan en la raíz si ya estaban ahí). No los subas.
