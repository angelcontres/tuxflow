# Arquitectura — Qué significa "hacer un buen trabajo"

> Este documento define el estándar de calidad para la Red Social Distribuida. Los agentes revisores evalúan código contra este archivo. Si no está aquí, no es un requisito.

## Principios

1. **Capas claras (Hexagonal).** El backend en Quarkus respeta estrictamente los 4 anillos:
   - `domain/` — modelo de dominio puro (entidades, puertos in/out).
   - `application/` — servicios de aplicación.
   - `infrastructure/adapter/in/` — resources REST y WebSockets.
   - `infrastructure/adapter/out/` — conexión a Neo4j, MinIO, Push.
   No mezclar responsabilidades. No inyectar infraestructura en el dominio.

2. **Sin ORMs Relacionales.** Persistencia exclusivamente en **Neo4j 5.20**. Se prioriza el *index-free adjacency*. Prohibido usar PostgreSQL, Hibernate ORM tradicional (panache relacional) o Prisma.

3. **Frontend modular.** React con Vite. Las funcionalidades viven en `frontend/src/features/` (ej. `feed`, `chat`, `profile`). No usar Angular ni crear componentes gigantes monolíticos.

4. **Inmutabilidad de multimedia.** Los archivos subidos van a S3 (MinIO) de inmediato. Neo4j solo guarda URLs o paths.

## Flujo de datos

```
Frontend (React)  ─→  Adapter IN (Quarkus REST/WS)
                           │
                           ├─→  Application Service
                           │        │
                           │        └─→ Domain Port (IN/OUT)
                           │                │
                           └─→  Adapter OUT (Neo4j / MinIO / WebPush)
```

## Qué NO hacer

- No crear dependencias cíclicas entre features en el frontend.
- No hacer consultas Cypher directamente en un controlador REST. Todo va al adapter OUT pasando por el puerto correspondiente.
- No inventar auth (por ahora). El JWT se define en la US-01, asume comportamiento stateless.
