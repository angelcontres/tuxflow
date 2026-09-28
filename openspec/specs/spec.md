# System Source of Truth

## Architecture & Tech Stack
- **Base de Datos**: Neo4j 5.20 usando *index-free adjacency* para evitar consultas recursivas lentas. Todo está modelado en un Property Graph. Nodos principales: `Usuario`, `Post`, `MensajeChat`, `SugerenciaUsuario`. Relaciones: `SIGUE`, `PUBLICA`, `REACCIONA`.
- **Backend**: Quarkus (Java) con Arquitectura Hexagonal pura (domain, port/in, port/out, application, infrastructure).
- **Frontend**: React 18, Vite y Tailwind CSS, bajo una estructura de features en `frontend/src/features/`.
- **Autenticación**: Autenticación JWT stateless (actualmente NO está implementada en el código, pero es la decisión de diseño final).

## Cross-Cutting Rules

### R1. Testing y Cobertura
Testing no configurado por ahora. No hay runners (JUnit/Vitest). Todo test en specs se valida mentalmente y por compilación estricta, pero no corre.

### R2. Linting y Formateo
No hay ESLint ni Prettier. Confiar en TSC y Javac.

### R3. CI/CD
Solo compila: `mvn compile` (backend) y `pnpm run build` (frontend). **pnpm**, no npm: `config.yaml` lo establece y `pnpm-lock.yaml` está versionado.

## Capabilities (Domains)

1. `user-identity`: Registro, perfiles con avatar en MinIO, y futura autenticación JWT.
2. `social-graph`: Relaciones `SIGUE`, dejar de seguir, sugerencia inteligente de contactos (2do grado) y amigos en común.
3. `post-management`: Publicaciones de texto y subida de archivos multimedia desacoplada hacia MinIO S3 (`[:PUBLICA]`).
4. `feed-generation`: Generación de feed cronológico con los saltos en Cypher a través de la relación de seguidores.
5. `post-reactions`: Dar likes a los posts a través de la relación `[:REACCIONA]`.
6. `chat-messaging`: Sockets 1 a 1 mediante `ChatWebSocket`.
7. `web-push-notifications`: Alertas VAPID asíncronas para notificar de nuevas publicaciones.
8. `graph-algorithms`: Cálculos avanzados como el camino más corto (shortest path) y detección de tendencias/viralidad.

## Gherkin Scenarios
*(Los escenarios estables se consolidan aquí una vez que un Proposal es archivado)*
