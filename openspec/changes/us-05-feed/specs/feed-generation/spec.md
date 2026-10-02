# Specifications: US-05 (TUX-55) — Feed cronológico filtrado por grafo social

> **Ticket Linear**: `TUX-55` · **Dominio**: `feed-generation`
> **Delta**: todos los requisitos son `ADDED` (no existe aún la capability `feed-generation` en `openspec/specs/`)

---

## ADDED Requirements

### Requirement: Entregar el feed con filtrado por grafo social

El sistema DEBE devolver el feed de un usuario con código `200`, incluyendo únicamente las
publicaciones de usuarios alcanzados por una relación directa `[:SIGUE]` (más las propias),
ordenadas de más reciente a más antigua, y DEBE excluir las publicaciones de usuarios que el lector
no sigue.

#### Scenario: Feed con publicaciones de seguidos

- **GIVEN** que "carlos-patio" sigue a "beatriz" y "paulo", y ambos tienen al menos una publicación
- **WHEN** se ejecuta `GET /api/feed/carlos-patio`
- **THEN** la respuesta es `200`
- **AND** contiene las publicaciones de "beatriz" y "paulo"

#### Scenario: Exclusión de publicaciones de no seguidos

- **GIVEN** que "carlos-patio" sigue a "beatriz" y "paulo", pero no sigue a "david"
- **WHEN** se ejecuta `GET /api/feed/carlos-patio`
- **THEN** aparecen las publicaciones de "beatriz" y "paulo"
- **AND** la publicación de "david" no aparece en la respuesta

#### Scenario: Orden descendente por fecha

- **GIVEN** que "beatriz" y "paulo" tienen publicaciones con fechas distintas
- **WHEN** se ejecuta `GET /api/feed/carlos-patio`
- **THEN** las publicaciones están ordenadas de la fecha más reciente a la más antigua

#### Scenario: El usuario no sigue a nadie

- **GIVEN** que "carlos-patio" no sigue a ningún usuario y no tiene publicaciones propias
- **WHEN** se ejecuta `GET /api/feed/carlos-patio`
- **THEN** la respuesta es `200` con la lista vacía
- **AND** el frontend muestra el estado vacío invitando a seguir a más usuarios

### Requirement: Calcular likes y reacción propia

El sistema DEBE calcular `totalLikes` contando las relaciones `[:REACCIONA]` recibidas por cada
publicación, y `likedByMe` indicando si el lector reaccionó a ella.

#### Scenario: Conteo de reacciones

- **GIVEN** que la publicación de "beatriz" tiene dos reacciones de otros usuarios
- **WHEN** se ejecuta `GET /api/feed/carlos-patio`
- **THEN** esa publicación trae `totalLikes` igual a `2`

#### Scenario: Publicación sin reacciones

- **GIVEN** que una publicación de "beatriz" no tiene ninguna relación `[:REACCIONA]`
- **WHEN** se ejecuta `GET /api/feed/carlos-patio`
- **THEN** esa publicación aparece en la respuesta
- **AND** su `totalLikes` es `0`
- **AND** su `likedByMe` es `false`

#### Scenario: El lector ya reaccionó

- **GIVEN** que "carlos-patio" ya reaccionó a la publicación de "beatriz"
- **WHEN** se ejecuta `GET /api/feed/carlos-patio`
- **THEN** esa publicación trae `likedByMe` igual a `true`

### Requirement: Mostrar la fecha formateada

El sistema DEBE presentar la fecha de cada publicación en formato legible por una persona, y DEBE
manejar el caso en que el valor recibido no sea una fecha válida.

#### Scenario: Publicación reciente

- **GIVEN** que una publicación se creó hace pocas horas
- **WHEN** se muestra en el feed
- **THEN** la fecha aparece como tiempo relativo en español, no como número ni como literal fijo

#### Scenario: Publicación antigua

- **GIVEN** que una publicación se creó hace más de siete días
- **WHEN** se muestra en el feed
- **THEN** la fecha aparece como fecha absoluta

#### Scenario: Fecha ausente o inválida

- **GIVEN** que una publicación llega sin `fechaCreacion` o con un valor que no es una fecha
- **WHEN** se muestra en el feed
- **THEN** la fecha aparece como "Reciente"
- **AND** el resto de la publicación se muestra con normalidad

### Requirement: Mostrar el autor con avatar y badge

El sistema DEBE mostrar el autor de cada publicación con su avatar cuando exista y cargue, con la
inicial del nombre cuando no exista o no cargue, y con un badge que indique la relación de
seguimiento.

#### Scenario: El autor tiene avatar

- **GIVEN** que "beatriz" tiene una URL de avatar que carga correctamente
- **WHEN** se muestra su publicación
- **THEN** se muestra el avatar, no la inicial

#### Scenario: El autor no tiene avatar

- **GIVEN** que "paulo" no tiene `autorAvatar`
- **WHEN** se muestra su publicación
- **THEN** se muestra la inicial de su nombre

#### Scenario: El avatar no carga

- **GIVEN** que "beatriz" tiene una URL de avatar que no se puede cargar
- **WHEN** se intenta mostrar el avatar
- **THEN** se muestra la inicial de su nombre en su lugar
- **AND** no queda visible una imagen rota ni un círculo vacío
- **AND** el badge de seguimiento sigue visible

### Requirement: Dejar de seguir refresca el feed y retira los posts del usuario

El sistema DEBE volver a pedir el feed al dejar de seguir a un usuario. Como el backend excluye de
las publicaciones a los no seguidos, las publicaciones de esa persona DEBEN desaparecer del feed de
inmediato, sin esperar a que el usuario recargue la página. La tarjeta de red también DEBE reflejar
el nuevo estado.

Este es el comportamiento previo a US-05 y se conserva a propósito: el feed siempre muestra el
filtrado vigente del backend, sin posts fantasma de usuarios que ya no se siguen.

#### Scenario: Los posts desaparecen de inmediato tras dejar de seguir

- **GIVEN** que el feed muestra una publicación de "beatriz", a quien "carlos-patio" sigue
- **WHEN** "carlos-patio" deja de seguir a "beatriz" desde la tarjeta de red
- **THEN** el feed se vuelve a pedir al backend
- **AND** la publicación de "beatriz" desaparece de la vista sin recargar la página
- **AND** las publicaciones de los usuarios que se siguen siguen visibles
- **AND** la tarjeta de red refleja el nuevo estado ("Seguir")

#### Scenario: Los posts filtrados no reaparecen al recargar la vista

- **GIVEN** que "carlos-patio" dejó de seguir a "beatriz"
- **WHEN** se produce la próxima carga del feed (remontaje, recarga o nueva petición)
- **THEN** la publicación de "beatriz" no aparece

#### Scenario: Dar like no retira el post de la pantalla

- **GIVEN** que el feed muestra una publicación de un usuario que "carlos-patio" sigue
- **WHEN** "carlos-patio" da like a esa publicación
- **THEN** la publicación sigue visible en el feed
- **AND** el contador de likes se actualiza en el lugar, sin volver a pedir el feed
- **AND** si la petición de like falla, el contador se revierte y el error se registra en consola
