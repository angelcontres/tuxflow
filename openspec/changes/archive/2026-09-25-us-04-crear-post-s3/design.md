# Design: US-04 — Crear Publicación con Multimedia Desacoplada en S3

**Change**: `2026-09-25-us-04-crear-post-s3`  
**Status**: DESIGN (ARCHIVED)

---

## Overview

Se diseñó la arquitectura hexagonal para la subida de multimedia. El frontend envía un formulario multipart. El adaptador de Quarkus lo captura, delega el binario al `StorageMultimediaPort` y el objeto `Post` devuelto por el dominio se envía a `GrafoPersistencePort`.

## Decisions

**D1 — Multipart vs pre-signed URLs**
**Decision**: El frontend envía `multipart/form-data` al backend de Quarkus, y Quarkus transfiere a MinIO usando su cliente S3.
**Why**: Es la forma más sencilla inicial, y evita exponer las credenciales o firmar URLs pre-signed en el cliente. Si en el futuro se vuelve un cuello de botella, se puede migrar a subida directa al bucket mediante firmas.

**D2 — Neo4j `[:PUBLICA]` Relationship**
**Decision**: El nodo `(:Usuario)` se conecta al nodo `(:Post)` creado usando `MERGE (u:Usuario {id: $userId}) CREATE (p:Post {id: randomUUID(), ...}) CREATE (u)-[:PUBLICA]->(p)`.
**Why**: La creación del post siempre pertenece a un usuario, no tiene sentido un nodo Post flotante.

## Verification Checklist

- [x] Subida exitosa guarda el archivo en MinIO.
- [x] Post se crea correctamente en Neo4j con relación `[:PUBLICA]`.
- [x] Post expone URL válida hacia S3.
