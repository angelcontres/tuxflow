# Capability: user-identity

> Estado vigente y verificado del código. Los changes en `openspec/changes/` escriben deltas (`## ADDED Requirements`) que se consolidan acá al archivarse.

**Dominio**: `:Usuario` en Neo4j.
**Backend**: Quarkus, Arquitectura Hexagonal (`domain`, `domain/port/in`, `domain/port/out`, `application`, `infrastructure`).
**Frontend**: React 18 + Vite + TypeScript + Tailwind, bajo `frontend/src/features/`.

---

## Requirements

### Requirement: Registro de usuario

El sistema DEBE permitir crear un usuario persistiendo su nodo `:Usuario` en el grafo.

#### Scenario: Registro exitoso

- **GIVEN** un payload con `id`, `username`, `email`, `nombre` y `avatarUrl`
- **WHEN** se envía `POST /api/users`
- **THEN** el nodo `:Usuario` queda persistido vía `GrafoPersistencePort.guardarUsuario()`
- **AND** la respuesta es `201 Created` con el JSON del usuario

**Estado**: IMPLEMENTADO. `UserGraphResource.registrarUsuario()` → `GestionarGrafoSocialUseCase.registrarUsuario()` → `UserGraphApplicationService` → `Neo4jGrafoAdapter.guardarUsuario()`.

#### Scenario: Registro con payload incompleto

- **GIVEN** un payload sin `id` o sin `username`
- **WHEN** se envía `POST /api/users`
- **THEN** la respuesta debe ser `400 Bad Request` con mensaje de campo faltante

**Estado**: NO IMPLEMENTADO. No hay validación de entrada: `UserGraphResource.registrarUsuario()` acepta `Usuario` crudo sin `@Valid` ni restricciones.

---

### Requirement: Lectura de perfil

El sistema DEBE permitir consultar el perfil de un usuario por su identificador.

#### Scenario: Consultar perfil existente

- **GIVEN** un `userId` existente en el grafo
- **WHEN** se solicita `GET /api/users/{userId}`
- **THEN** la respuesta es `200 OK` con los campos del usuario

**Estado**: NO IMPLEMENTADO. No existe endpoint de lectura de usuario. `GrafoPersistencePort` no declara un método de lectura individual.

---

### Requirement: Avatar en MinIO

El sistema DEBE almacenar el avatar del usuario en MinIO S3 y persistir su URL en la propiedad `avatarUrl` del nodo `:Usuario`.

#### Scenario: Subir avatar

- **GIVEN** un archivo de imagen y un `userId`
- **WHEN** se sube el archivo
- **THEN** el archivo queda en el bucket de MinIO
- **AND** la URL devuelta se persiste en `Usuario.avatarUrl`

**Estado**: PARCIAL. El puerto de salida `StorageMultimediaPort.subirArchivo(InputStream, long, String, String)` está declarado e implementado en `MinioS3StorageAdapter`, pero **ningún consumidor lo invoca**: no existe endpoint REST ni caso de uso que reciba la subida. El puerto está cableado a la nada.

#### Scenario: Avatar por defecto

- **GIVEN** un usuario registrado sin avatar
- **WHEN** se consulta su perfil
- **THEN** el sistema debe devolver un avatar por defecto

**Estado**: NO IMPLEMENTADO.

---

### Requirement: Autenticación JWT

El sistema DEBE emitir y validar tokens JWT stateless para identificar al usuario en cada request.

> Decisión cerrada en `openspec/ROADMAP.md`: JWT stateless. La dependencia `quarkus-smallrye-jwt` está declarada en `backend/pom.xml` pero no se usa en ninguna clase.

#### Scenario: Login válido

- **GIVEN** credenciales correctas de un usuario registrado
- **WHEN** se solicita `POST /api/auth/login`
- **THEN** la respuesta es `200 OK` con un token JWT firmado

**Estado**: NO IMPLEMENTADO. No existe endpoint de login, ni emisión de token, ni verificación de credenciales. No hay hashing de contraseñas: el modelo `Usuario` no tiene campo de contraseña.

#### Scenario: Request sin token

- **GIVEN** un endpoint que requiere identidad
- **WHEN** se envía un request sin token o con token inválido
- **THEN** la respuesta es `401 Unauthorized`

**Estado**: NO IMPLEMENTADO. Ningún endpoint valida identidad; `UserGraphResource` opera sobre `usuarioId` crudos enviados en el body o el path.

#### Scenario: Identidad en el frontend

- **GIVEN** un usuario autenticado
- **WHEN** carga la aplicación
- **THEN** el frontend obtiene su identidad del token, no de un valor hardcodeado

**Estado**: NO IMPLEMENTADO. `App.tsx` declara `const [currentUserId] = useState<string>('carlos-patino')` y `const [currentUsername] = useState<string>('carlos')` — valores fijos, sin setter.

---

## Límites de la capability

- La relación `[:SIGUE]`, las sugerencias de 2do grado y los seguidores en común pertenecen a la capability `social-graph`, aunque sus endpoints vivan en `UserGraphResource`.
- Los algoritmos de camino más corto pertenecen a `graph-algorithms`.

## Deuda técnica que afecta a esta capability

- Sin validación de entrada en ningún borde REST.
- `StorageMultimediaPort` declarado e implementado sin consumidores.
- `Usuario` no modela credenciales, por lo que la autenticación requiere decisión de diseño propia (dónde vive la contraseña, cómo se verifica, quéclaims lleva el token).
- El frontend no tiene servicio de autenticación ni capa de estado de sesión.
