# Spec: US-04 — Crear Publicación con Multimedia Desacoplada en S3

## Domain: crear-post-s3 (NEW)

### Requirement: Persistencia del Post y su Relación
El sistema DEBE crear un nodo Post y establecer la relación de autoría con un solo query.

- Scenario: Post con Texto Exitoso — GIVEN un usuario autenticado
  WHEN envía texto sin multimedia
  THEN se crea el nodo `(:Post)` con sus metadatos
  AND se establece la relación `(:Usuario)-[:PUBLICA]->(:Post)`

### Requirement: Almacenamiento S3
El sistema DEBE almacenar el binario multimedia en S3 y guardar solo la URL en Neo4j.

- Scenario: Post con Foto — GIVEN un usuario autenticado
  WHEN envía un payload multipart con una imagen JPEG
  THEN el archivo es subido a MinIO y se obtiene su URL
  AND el nodo `(:Post)` se guarda en Neo4j con la propiedad `mediaUrl` apuntando a MinIO
