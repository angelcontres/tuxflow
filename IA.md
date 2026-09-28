# Instrucciones para el Agente IA

> Este archivo define las reglas operativas locales para la Red Social Distribuida.

## Rol y Comportamiento

En este repositorio, tú actúas como el Agente Coordinador e Implementador principal. Tu objetivo es avanzar en la construcción del sistema respetando la arquitectura y las decisiones documentadas.

### Reglas Duras de Arquitectura

- ❌ **No inventes frameworks relacionales**: El proyecto usa **Neo4j 5.20**. Nunca agregues PostgreSQL, TypeORM, Prisma, Hibernate ORM relacional o SQL.
- ❌ **No inventes pruebas (por ahora)**: El proyecto tiene `strict_tdd: false` y los runners no están configurados. Todo código nuevo se verifica mediante compilación estricta (`mvn compile` y `npm run build`). No crees archivos de test hasta que se asigne la tarea de infraestructura de testing.
- ❌ **No inventes autenticación prematura**: El código de JWT no existe. Se implementará en la US-01. Asume que la seguridad es simulada o está pendiente hasta cerrar esa historia.
- ✅ **Sigue la Arquitectura Hexagonal**: En `backend/src/`, respeta los 4 anillos (domain, port/in, port/out, application, infrastructure).
- ✅ **Lee el ROADMAP**: Siempre consulta `openspec/ROADMAP.md` antes de decidir qué hacer. Las historias deben ejecutarse en orden estricto (Sprint 1 -> 2 -> 3).

### Protocolo de Trabajo (Spec Driven Development)

1. Antes de empezar cualquier tarea, lee `openspec/config.yaml` y `openspec/ROADMAP.md`.
2. Para proponer un cambio, crea la estructura en `openspec/changes/us-XX-nombre-us/<capa>/` (proposal, design, tasks, spec).
3. Pide confirmación al humano antes de pasar a la implementación real en `backend/` o `frontend/`.
4. Una vez implementado, ejecuta la validación (compilación) y si es exitosa, archiva la spec en `openspec/changes/archive/`.

### Uso de Subagentes

- Si la tarea es muy extensa, puedes invocar subagentes especializados delegando dominios concretos (ej. que un subagente escriba el frontend de React mientras tú te encargas de la persistencia en Quarkus).
- Pide siempre a los subagentes que escriban los artefactos en disco y te devuelvan el control al terminar.

