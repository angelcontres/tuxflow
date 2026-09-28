# Specifications: US-05 (TUX-55) — Feed cronológico filtrado por grafo social

> **Ticket Linear**: `TUX-55` · **Card backlog**: `TUX-04` · **Dominio**: `feed-generation`
> **Delta**: todos los requisitos son `ADDED`

---

### Requirement: Entregar el feed sin error de conversión

El sistema DEBE devolver el feed de un usuario con código `200` y la lista de publicaciones de quienes
sigue. La fecha de cada publicación DEBE llegar como texto numérico de milisegundos desde epoch, y el
sistema NO DEBE fallar al convertir ese valor.

#### Scenario: Feed con publicaciones disponibles

- **GIVEN** que "carlos-patino" sigue a "beatriz" y "paulo", y ambos tienen al menos una publicación
- **WHEN** se ejecuta `GET /api/feed/carlos-patino`
- **THEN** la respuesta es `200`
- **AND** contiene las publicaciones de "beatriz" y "paulo"
- **AND** cada publicación trae `fechaCreacion` como texto numérico

#### Scenario: Publicación sin reacciones

- **GIVEN** que una publicación de "beatriz" no tiene ninguna relación `[:REACCIONA]`
- **WHEN** se ejecuta `GET /api/feed/carlos-patino`
- **THEN** esa publicación aparece en la respuesta
- **AND** su `totalLikes` es `0`
- **AND** su `likedByMe` es `false`

---

### Requirement: Filtrar por el grafo social de dos saltos

El sistema DEBE incluir únicamente publicaciones de usuarios alcanzados por una relación directa
`[:SIGUE]`, ordenadas de más reciente a más antigua. DEBE excluir las publicaciones de usuarios que el
lector no sigue.

#### Scenario: Exclusión de publicaciones de no seguidos

- **GIVEN** que "carlos-patino" sigue a "beatriz" y "paulo", pero no sigue a "david"
- **WHEN** se ejecuta `GET /api/feed/carlos-patino`
- **THEN** aparecen las publicaciones de "beatriz" y "paulo"
- **AND** la publicación de "david" no aparece en la respuesta

#### Scenario: Orden descendente por fecha

- **GIVEN** que "beatriz" y "paulo" tienen publicaciones con fechas distintas
- **WHEN** se ejecuta `GET /api/feed/carlos-patino`
- **THEN** las publicaciones están ordenadas de la fecha más reciente a la más antigua

#### Scenario: El usuario no sigue a nadie

- **GIVEN** que "carlos-patino" no sigue a ningún usuario
- **WHEN** se ejecuta `GET /api/feed/carlos-patino`
- **THEN** la respuesta es `200` con la lista vacía
- **AND** el frontend muestra el estado vacío inviting a seguir a más usuarios

---

### Requirement: Calcular likes y reaction propia

El sistema DEBE calcular `totalLikes` contando las reacciones recibidas por cada publicación, y
`likedByMe` indicando si el lector reaccionó a ella.

#### Scenario: Conteo de reacciones

- **GIVEN** que la publicación de "beatriz" tiene dos reacciones de otros usuarios
- **WHEN** se ejecuta `GET /api/feed/carlos-patino`
- **THEN** esa publicación trae `totalLikes` igual a `2`

#### Scenario: El lector ya reaccionó

- **GIVEN** que "carlos-patino" ya reaccionó a la publicación de "beatriz"
- **WHEN** se ejecuta `GET /api/feed/carlos-patino`
- **THEN** esa publicación trae `likedByMe` igual a `true`

---

### Requirement: Mostrar la fecha formateada

El sistema DEBE presentar la fecha de cada publicación en formato legible por una persona, y DEBE manejar
el caso en que el valor recibido no sea una fecha válida.

#### Scenario: Publicación reciente

- **GIVEN** que una publicación se creó hace pocas horas
- **WHEN** se muestra en el feed
- **THEN** la fecha aparece como tiempo relativo, no como número

#### Scenario: Publicación antigua

- **GIVEN** que una publicación se creó hace más de siete días
- **WHEN** se muestra en el feed
- **THEN** la fecha aparece como fecha absoluta

#### Scenario: Fecha ausente o inválida

- **GIVEN** que una publicación llega sin `fechaCreacion` o con un valor que no es una fecha
- **WHEN** se muestra en el feed
- **THEN** la fecha aparece como "Reciente"
- **AND** el resto de la publicación se muestra con normalidad

---

### Requirement: Mostrar el autor con avatar y badge

El sistema DEBE mostrar el autor de cada publicación con su avatar cuando exista, con la inicial del
nombre cuando no exista, y con un badge que indique la relación de seguimiento.

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
- **AND** no queda visible una imagen rota
- **AND** el badge de seguimiento sigue visible
