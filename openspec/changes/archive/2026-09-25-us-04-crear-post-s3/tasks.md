# Tasks: US-04 — Crear Publicación con Multimedia Desacoplada en S3

**Change**: `2026-09-25-us-04-crear-post-s3`  
**Phase**: Sprint 1

---

## Phase 1: Puertos e Integración

- [x] **1.1** — Crear/Modificar `StorageMultimediaPort.java` con método `String subirArchivo(InputStream stream, String filename)`.
- [x] **1.2** — Implementar `MinioS3StorageAdapter.java` configurado para apuntar al `minio` definido en Docker Compose.
- [x] **1.3** — Crear método `crearPost(Post post)` en `GrafoPersistencePort`.

## Phase 2: Casos de uso y Resource

- [x] **2.1** — En `PostApplicationService.java`, coordinar la subida del archivo (si existe) y luego delegar a `GrafoPersistencePort` el guardado de metadatos (texto, url de la imagen).
- [x] **2.2** — En `PostResource.java`, exponer el endpoint multipart `POST /api/posts`.

## Phase 3: Verificación

- [x] **3.1** — Construir con `mvn compile`.
- [x] **3.2** — Configurar `docker/neo4j-seed.cql` (si aplica para simular).

*(Nota: Tests ignorados hasta que se provea runner en el proyecto).*
