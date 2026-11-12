# Instalación

Empieza por [INSTALAR-CON-GROKBOT.md](../../INSTALAR-CON-GROKBOT.md), en la raíz del repositorio. Ahí está el texto para copiar al bot.

- [pasos.md](pasos.md) — descarga de la última release, Node, acceso y cuentas de quien instala
- [comprobaciones.md](comprobaciones.md) — qué tiene que cumplirse para decir «instalado»
- [problemas.md](problemas.md) — 404, checksum, carpeta ya existente, TradingView no conectado, la granja no abre
- [notas-internas.md](notas-internas.md) — detalles técnicos de conexión, solo para el bot (no se leen a la persona)

La guía no fija ningún número de versión: instala siempre la última release (`https://github.com/apriai/AI-Profit/releases/latest`). El comprobador `acceso/comprobar-instalacion.mjs` compara `VERSION` con esa release si se le pasa `--ultima`.
