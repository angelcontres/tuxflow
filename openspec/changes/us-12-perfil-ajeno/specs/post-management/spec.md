# Specifications: US-12 (TUX-64) — Perfil de usuario ajeno

> **Ticket Linear**: `TUX-64` · **Dominio**: `post-management` · **Delta**: todo `ADDED`

## ADDED Requirements

### Requirement: Lectura de las publicaciones de un autor

La API debe devolver las publicaciones de una persona, de la más nueva a la más antigua. El feed no
sirve para esto: mezcla las publicaciones propias con las de los seguidos y las filtra por el grafo,
as que no hay forma de pedir las de una persona y nada más.

#### Scenario: Devolver las publicaciones de un autor

- **Dado** el grafo `(:Usuario)-[:PUBLICA]->(:Post)`
- **Cuando** se pide `GET /api/posts/autor/beatriz-silva`
- **Entonces** la respuesta es `200` con los `:Post` que publica `beatriz-silva`
- **Y** no incluye las publicaciones de ninguna otra persona

#### Scenario: Ordenar de la más nueva a la más antigua

- **Dado** dos publicaciones con `fechaCreacion` 1727260000000 y 1727270000000
- **Cuando** se piden las publicaciones del autor
- **Entonces** la de 1727270000000 viene primero
- **Y** la fecha se devuelve como número entero, no como texto

#### Scenario: El autor es quien aparece en cada publicación

- **Dado** que las publicaciones tienen `autorId`, `autorUsername` y `autorAvatar`
- **Cuando** se piden las publicaciones de un autor
- **Entonces** cada elemento trae esos tres campos
- **Y** el perfil puede pintar la cabecera sin pedir un segundo recurso

#### Scenario: Un autor sin publicaciones

- **Dado** un usuario que no ha publicado nada
- **Cuando** se piden sus publicaciones
- **Entonces** la respuesta es `200` con la lista vacía, no un error

#### Scenario: Una publicación sin fecha no se inventa de posición

- **Dado** que existe una publicación sin `fechaCreacion`
- **Cuando** se piden las publicaciones de su autor
- **Entonces** esa publicación no aparece en la lista
- **Y** las demás siguen ordenadas por fecha

#### Scenario: Identificador ausente

- **Dado** una petición con el identificador en blanco
- **Cuando** se pide el recurso
- **Entonces** la respuesta es `400` con un mensaje
- **Y** no se consulta el grafo, porque un identificador en blanco no puede ser una respuesta legítima

### Requirement: El visor sólo cambia el estado de la reacción

La respuesta debe poder decir si la reacción de cada publicación es de quien está mirando, sin que eso
convierta al endpoint en uno que exija saber quién mira.

#### Scenario: Sin visor, la reacción llega sin marcar

- **Dado** una publicación con una reacción de `carlos-patino`
- **Cuando** se piden las publicaciones de su autor sin `viewerId`
- **Entonces** la respuesta es `200` y `likedByMe` es `false` en todas
- **Y** el total de reacciones sí viene, porque no depende del visor

#### Scenario: Con visor, la reacción propia se distingue

- **Dado** que `carlos-patino` reaccionó a `post-b1` y no a `post-b2`
- **Cuando** se piden las publicaciones de su autor con `viewerId=carlos-patino`
- **Entonces** `post-b1` llega con `likedByMe` en `true`
- **Y** `post-b2` llega con `likedByMe` en `false`

#### Scenario: Un visor que no existe no rompe la consulta

- **Dado** un `viewerId` que no corresponde a ningún usuario
- **Cuando** se piden las publicaciones de un autor real
- **Entonces** la respuesta es `200` con las publicaciones
- **Y** `likedByMe` es `false` en todas

#### Scenario: El total de reacciones cuenta personas, no filas

- **Dado** dos personas distintas que reaccionaron a la misma publicación
- **Cuando** se piden las publicaciones de su autor
- **Entonces** el total de esa publicación es `2`
- **Y** la publicación aparece una sola vez en la lista