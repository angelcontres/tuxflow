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

### Nivel 2 — Verificación manual (Opcional pero recomendado)

Para verificar si el sistema está operativo, usa Docker Compose:
```bash
docker compose up -d
```
Luego interactúa mediante Postman o el cliente web en `http://localhost:3000`.

### Anti-patrones (no hacer)

- ❌ "He creado el componente, asumo que corre." → Si no pasa `npm run build`, no sirve.
- ❌ Marcar como completada una tarea si `mvn compile` falla.
- ❌ Intentar ejecutar tests (`mvn test`, `npm test`) sabiendo que el proyecto declara una deuda técnica de falta de runner de testing.
