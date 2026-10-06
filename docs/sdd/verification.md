# Verificación — Cómo demostrar que el trabajo funciona

## Niveles de verificación

### Nivel 1 — Compilación estricta (Obligatorio)

Dado que no hay runners configurados (`strict_tdd: false`), la validación recae totalmente en la compilación y tipado estricto:

**Para Frontend (React):**
```bash
cd frontend && npm run build
```

**Para Backend (Quarkus):**
```bash
cd backend && mvn compile
```
Ambos comandos deben finalizar con exit code 0.

### Nivel 2 — Pruebas automatizadas (Obligatorio)

Ya no hay deuda de runner: el backend usa Surefire y el frontend Vitest, ambos con suites en verde.

```bash
cd backend && $MAVEN_HOME/bin/mvn -o verify
cd frontend && pnpm run check
```
`pnpm run check` encadena tipos, pruebas y build, así que covers los tres.

### Nivel 3 — Verificación manual (Opcional pero recomendado)

Para verificar si el sistema está operativo, usa Docker Compose:
```bash
docker compose up -d
```
Luego interactúa mediante Postman o el cliente web en `http://localhost:3000`.

### Nivel 4 — Prueba de extremo a extremo del chat (Opcional)

`tools/chat-smoke.mjs` levanta dos sockets reales contra el backend en marcha y comprueba entrega,
acuse, rechazos, varias sesiones del mismo usuario e historial por HTTP:

```bash
node --experimental-websocket tools/chat-smoke.mjs
```
Requiere el flag porque el WebSocket nativo de Node va tras `--experimental-websocket`. No sustituye
al navegador: solo demuestra el contrato del servidor.

### Anti-patrones (no hacer)

- ❌ "He creado el componente, asumo que corre." → Si no pasa `npm run build`, no sirve.
- ❌ Marcar como completada una tarea si `mvn compile` falla.
- ❌ Dar por bueno un cambio de protocolo porque las pruebas unitarias pasan. El contrato del chat se
  rompe en la frontera entre capas: un frame de entrega que llega con `estado` hace que el cliente lo
  lea como un acuse y lo descarte, y ninguna prueba unitaria de por separado lo detecta. Para eso está
  el Nivel 4.
