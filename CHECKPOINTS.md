# CHECKPOINTS — Evaluación del estado final

> En sistemas multi-agente no se evalúa el camino, se evalúa el destino.
> Estos son los checkpoints objetivos que un juez (humano o IA) puede usar
> para decidir si el proyecto de la Red Social está sano.

## C1 — La base está completa

- [ ] Existen `openspec/config.yaml` y `openspec/ROADMAP.md` debidamente actualizados.
- [ ] Gates verdes al cierre: frontend compila con `cd frontend && npm run build` (exit code 0).
- [ ] Gates verdes al cierre: backend compila con `cd backend && mvn compile` (exit code 0).

## C2 — El estado es coherente

- [ ] Un solo change activo a la vez en `openspec/changes/` organizado por historia y capa (ej. `us-01-user-identity/front`).
- [ ] Toda change archivada tiene un `archive-report.md` que declara honestamente su estado.
- [ ] El estado real vive en OpenSpec + Engram, no en bitácoras sueltas.

## C3 — El código respeta la arquitectura

- [ ] `backend/src/` usa exclusivamente Arquitectura Hexagonal (domain, port, application, infrastructure).
- [ ] No existen dependencias ni conexiones a bases de datos relacionales (solo Neo4j 5.20 y MinIO permitidos).
- [ ] No hay código de pruebas inventado o placeholders vacíos (el testing está deshabilitado temporalmente).

## C4 — La verificación es real (Compilación Estricta)

- [ ] Al no haber runners configurados (`strict_tdd: false`), la validación recae en que no existan errores de tipos (TypeScript) ni fallos de compilación en Java.
- [ ] El código de UI asume un comportamiento optimista donde corresponda, para minimizar latencias.

## C5 — La sesión se cerró bien

- [ ] No hay archivos temporales, logs sueltos o `.tmp` sin trackear en `.gitignore`.
- [ ] La última feature trabajada quedó archivada en `openspec/changes/archive/`.
- [ ] El contenedor Docker local funciona sin crasheos inesperados (se asume puerto 8080 para Quarkus, 3000 para React).

## C6 — Spec Driven Development (SDD)

- [ ] Toda change tiene su `proposal.md`, `design.md`, `tasks.md` y `specs/<cap>/spec.md` redactados en formato Gherkin.
- [ ] El manifiesto central (`openspec/specs/spec.md`) refleja las 8 capabilities puras y el stack tecnológico actual.
- [ ] La deuda técnica (como la falta de tests o linter) se reconoce abiertamente en `config.yaml` y `ROADMAP.md`.

---

**Cómo usar este archivo:** Un agente revisor recorre cada checkbox, marca `[x]` o `[ ]`, y alerta si existen inconsistencias antes de dar por terminada la sesión de trabajo.
