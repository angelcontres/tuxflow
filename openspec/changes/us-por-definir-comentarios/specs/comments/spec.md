# Specifications: US (por definir) — Comentarios en publicaciones

> **Dominio**: `comments` · **Delta**: todos los requisitos son `ADDED`
> **Depende de**: `post-management` (el `:Post` debe existir) y `post-reactions` (patrón de likes).

## ADDED Requirements

### Requirement: Crear un comentario de primer nivel

El sistema DEBE crear un nodo `:Comentario` enlazado al autor por `[:COMENTA]` y a la publicación
por `[:COMENTA_EN]`, con `fechaCreacion` tomada del reloj del servidor.

#### Scenario: Comentario creado

- **GIVEN** que existen el usuario `paulo-orrala` y la publicación `post-b1`
- **WHEN** se envía `POST /api/posts/post-b1/comentarios` con `{"userId":"paulo-orrala","texto":"Buen aporte"}`
- **THEN** existe `(:Usuario {id:'paulo-orrala'})-[:COMENTA]->(:Comentario)-[:COMENTA_EN]->(:Post {id:'post-b1'})`
- **AND** el nuevo `:Comentario` tiene `parentId` nulo
- **AND** la respuesta es `201` con el comentario completo (id, texto, autor, fecha, `totalLikes: 0`, `likedByMe: false`)

#### Scenario: Falta el usuario

- **GIVEN** la publicación `post-b1`
- **WHEN** se envía `POST /api/posts/post-b1/comentarios` sin `userId`
- **THEN** la respuesta es `400` con `{"error":"El campo 'userId' es obligatorio"}`
- **AND** no se crea ningún `:Comentario`

#### Scenario: Falta el texto

- **GIVEN** que existe el usuario `paulo-orrala`
- **WHEN** se envía `POST /api/posts/post-b1/comentarios` con `{"userId":"paulo-orrala","texto":"   "}`
- **THEN** la respuesta es `400` con `{"error":"El texto del comentario es obligatorio"}`
- **AND** no se crea ningún `:Comentario`

#### Scenario: La publicación no existe

- **GIVEN** que no existe la publicación `post-inexistente`
- **WHEN** se envía un comentario sobre ese id
- **THEN** la respuesta es `404` con el mensaje genérico `El recurso indicado no existe`
- **AND** el cuerpo no repite el identificador interno

### Requirement: Responder a un comentario

El sistema DEBE permitir un solo nivel de respuestas: `parentId` referencia un comentario de primer
nivel de la **misma** publicación y se guarda como propiedad del nuevo nodo.

#### Scenario: Respuesta anidada

- **GIVEN** un comentario `com-1` de primer nivel en `post-b1`
- **WHEN** se envía `POST /api/posts/post-b1/comentarios` con `{"userId":"carlos-patino","texto":"De acuerdo","parentId":"com-1"}`
- **THEN** el nuevo `:Comentario` tiene `parentId = "com-1"`
- **AND** la respuesta es `201`

#### Scenario: El padre no existe

- **GIVEN** la publicación `post-b1` y que no existe el comentario `com-x`
- **WHEN** se envía un comentario con `parentId: "com-x"`
- **THEN** la respuesta es `404`
- **AND** no se crea ningún `:Comentario`

#### Scenario: El padre pertenece a otra publicación

- **GIVEN** un comentario `com-2` que cuelga de `post-p1`
- **WHEN** se envía un comentario en `post-b1` con `parentId: "com-2"`
- **THEN** la respuesta es `404`
- **AND** no se crea ningún `:Comentario`

#### Scenario: No se responde a una respuesta

- **GIVEN** una respuesta `com-r` cuyo `parentId` no es nulo
- **WHEN** se envía un comentario con `parentId: "com-r"`
- **THEN** la respuesta es `404` y no se anida un segundo nivel

### Requirement: Listar los comentarios de una publicación

El sistema DEBE devolver los comentarios de una publicación del más antiguo al más reciente, con el
autor y los totales de likes, y DEBE marcar `likedByMe` según el visor.

#### Scenario: Lista con respuestas

- **GIVEN** dos comentarios de primer nivel y una respuesta en `post-b1`
- **WHEN** se pide `GET /api/posts/post-b1/comentarios?viewerId=carlos-patino`
- **THEN** la respuesta es `200` y trae los tres comentarios en orden cronológico
- **AND** la respuesta incluye `parentId` en cada uno para que el cliente anide la respuesta

#### Scenario: Sin comentarios

- **GIVEN** una publicación sin comentarios
- **WHEN** se pide su lista de comentarios
- **THEN** la respuesta es `200` con lista vacía, no un error

#### Scenario: La respuesta no expone campos del dominio

- **WHEN** se pide la lista de comentarios
- **THEN** ningún elemento contiene `password`, `email` ni `pushSubscriptionJson`

### Requirement: Reaccionar con like a un comentario

El sistema DEBE registrar `(u:Usuario)-[:REACCIONA {tipo:'LIKE'}]->(c:Comentario)` de forma
idempotente y DEBE devolver el total recalculado.

#### Scenario: Like registrado

- **GIVEN** un comentario `com-1` sin likes
- **WHEN** se envía `POST /api/posts/post-b1/comentarios/com-1/like` con `{"userId":"carlos-patino"}`
- **THEN** existe `(:Usuario {id:'carlos-patino'})-[:REACCIONA {tipo:'LIKE'}]->(:Comentario {id:'com-1'})`
- **AND** la respuesta es `200` con `likedByMe: true` y `totalLikes` del grafo

#### Scenario: Like repetido

- **GIVEN** que `carlos-patino` ya dio like a `com-1`
- **WHEN** vuelve a enviar el mismo like
- **THEN** no se crea una segunda relación y la respuesta sigue siendo `200`

#### Scenario: Retirar el like

- **GIVEN** que `carlos-patino` dio like a `com-1`
- **WHEN** se envía `DELETE /api/posts/post-b1/comentarios/com-1/like?userId=carlos-patino`
- **THEN** la relación se borra y la respuesta es `200` con `likedByMe: false`
- **AND** retirar un like que no existe también responde `200` sin cambios

#### Scenario: El comentario no existe

- **WHEN** se da like a un comentario inexistente
- **THEN** la respuesta es `404` y no se inventa una reacción

### Requirement: Abrir el hilo de comentarios desde la tarjeta

El cliente DEBE abrir el hilo al pulsar **Comentar** en `PostCard`, mostrando la publicación y los
comentarios con scroll, y DEBE permitir escribir, responder y reaccionar.

#### Scenario: Abrir y cargar

- **GIVEN** una tarjeta de `post-b1` en el feed
- **WHEN** el usuario pulsa "Comentar"
- **THEN** se abre un diálogo accesible (`role="dialog"`, `aria-modal="true"`) con la publicación visible
- **AND** se cargan y listan sus comentarios

#### Scenario: Enviar un comentario

- **GIVEN** el modal abierto
- **WHEN** el usuario escribe un texto y envía
- **THEN** el comentario devuelto por el servidor se añade a la lista
- **AND** el campo de texto queda vacío

#### Scenario: Responder en línea

- **GIVEN** un comentario del hilo
- **WHEN** el usuario pulsa "Responder" y envía una respuesta
- **THEN** la respuesta se envía con `parentId` del comentario y se pinta anidada

#### Scenario: Error de like revertido

- **GIVEN** un comentario sin like propio
- **WHEN** el usuario pulsa el corazón y el servidor falla
- **THEN** el corazón y el contador vuelven al estado previo
- **AND** se muestra un mensaje de error visible
