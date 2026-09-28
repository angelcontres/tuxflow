# Proposal: US-04 — Crear Publicación con Multimedia Desacoplada en S3

**Change**: `2026-09-25-us-04-crear-post-s3`  
**Status**: ARCHIVED  
**Phase**: Sprint 1  

---

## Intent

Permitir a los usuarios crear publicaciones que contengan texto y opcionalmente imágenes/videos. En lugar de almacenar los blobs en la base de datos, el archivo se enviará a MinIO S3 y el grafo solo guardará la URL firmada o el bucket path, manteniendo la base de datos Neo4j ágil.

## Scope

### In Scope

- `CrearPostUseCase` que coordine la inserción de `(:Post)` y `[:PUBLICA]`.
- Subida de archivos binarios al bucket `posts-media` de MinIO.
- Endpoint `POST /api/posts`.

### Out of Scope

- Edición de publicaciones (solo creación).
- Eliminación en cascada en S3 (se abordará en un ticket de limpieza de deuda técnica o en otra US).

## Capabilities

- `crear-post-s3`: Permite crear publicaciones persistiendo metadatos en grafo y multimedia en S3.

## Domain Module Dependencies

- `backend/src/main/java/ec/edu/upse/redsocial/domain/port/out/StorageMultimediaPort.java`
- `backend/src/main/java/ec/edu/upse/redsocial/domain/port/out/GrafoPersistencePort.java`
- `backend/src/main/java/ec/edu/upse/redsocial/application/service/PostApplicationService.java`
- `backend/src/main/java/ec/edu/upse/redsocial/infrastructure/adapter/in/rest/PostResource.java`
- `backend/src/main/java/ec/edu/upse/redsocial/infrastructure/adapter/out/MinioS3StorageAdapter.java`
- `backend/src/main/java/ec/edu/upse/redsocial/infrastructure/adapter/out/Neo4jGrafoAdapter.java`
