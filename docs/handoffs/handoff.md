# Handoff — Documentación de Sesión de Red Social Distribuida

> **Plantilla de Handoff** para asegurar continuidad entre agentes.
> **Motivo**: Límite de contexto, cierre de sesión, o pausa programada.

---

## 1. Estado actual (checkpoint)

- **Rama/Contexto**: `<rama-actual>`
- **Change OpenSpec**: `openspec/changes/us-XX-nombre-us/<capa>/`
  - Estado de artefactos: `[x] proposal.md`, `[ ] design.md`, `[ ] tasks.md`, `[ ] spec.md`
- **Feature en desarrollo**: `<descripción breve de lo que se estaba haciendo>`

---

## 2. Qué se implementó (la REALIDAD hasta el corte)

### Backend (Quarkus)

| Archivo | Qué hace |
|---|---|
| `<ruta>` | `<descripción>` |

### Frontend (React)

| Archivo | Qué hace |
|---|---|
| `<ruta>` | `<descripción>` |

---

## 3. Gates verificados (evidencia)

Al cierre de sesión:
- Frontend: `npm run build` → exit 0 (o detallar errores pendientes).
- Backend: `mvn compile` → exit 0 (o detallar errores pendientes).
- **Testing**: Deshabilitado por configuración global (`strict_tdd: false`).

---

## 4. Próximos pasos (para el siguiente agente)

1. **Continuar**: Retomar desde `<archivo o tarea incompleta>`.
2. **Validar**: Correr las validaciones de Nivel 1.
3. **Sincronizar**: Mover a `archive` y actualizar `openspec/specs/spec.md` al finalizar.
