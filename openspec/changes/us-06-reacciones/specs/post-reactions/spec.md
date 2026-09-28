# Specifications: US-06 (TUX-56) — Reaccionar a publicaciones con likes idempotentes

> **Ticket Linear**: `TUX-56` · **Card backlog**: `TUX-05` · **Dominio**: `post-reactions`
> **Delta**: todos los requisitos son `ADDED`

---

### Requirement: Registrar una reacción de tipo like

El sistema DEBE crear la relación `[:REACCIONA {tipo: 'LIKE'}]` entre el usuario y la publicación, y DEBE
ser idempotente: repetir la misma petición no debe crear una segunda relación ni alterar la fecha original.

#### Scenario: Reacción registrada

- **GIVEN** que existen el usuario "carlos-patino" y la publicación "post-b1"
- **WHEN** se envía `POST /api/posts/post-b1/like` con `userId` "carlos-patino"
- **THEN** existe la relación `[:REACCIONA {tipo: 'LIKE'}]` de "carlos-patina" hacia "post-b1"
- **AND** la respuesta es `200`

#### Scenario: Reacción repetida

- **GIVEN** que "carlos-patina" ya reaccionó a "post-b1"
- **WHEN** se envía la misma petición otra vez
- **THEN** sigue existiendo una sola relación `[:REACCIONA {tipo: 'LIKE'}]` entre ambos
- **AND** la fecha de la relación no cambia
- **AND** la respuesta es `200`

#### Scenario: La publicación no existe

- **GIVEN** que no existe ninguna publicación con ese identificador
- **WHEN** se envía la petición
- **THEN** la respuesta es `404`
- **AND** no se crea ninguna relación

#### Scenario: El usuario no existe

- **GIVEN** que no existe ningún usuario con el `userId` enviado
- **WHEN** se envía la petición
- **THEN** la respuesta es `404`
- **AND** no se crea ninguna relación

---

### Requirement: Rechazar reacciones sin usuario

El sistema DEBE rechazar con `400` cualquier reacción cuyo `userId` sea nulo, vacío o contenga solo
espacios, y no debe crear nada en ese caso.

#### Scenario: Falta el userId

- **GIVEN** que se envía el cuerpo sin `userId`
- **WHEN** se ejecuta la petición
- **THEN** la respuesta es `400`
- **AND** no se crea ninguna relación

#### Scenario: El userId es solo espacios

- **GIVEN** que se envía un `userId` formado únicamente por espacios
- **WHEN** se ejecuta la petición
- **THEN** la respuesta es `400`
- **AND** no se crea ninguna relación

---

### Requirement: Reflejar el like de inmediato en pantalla

El sistema DEBE aplicar el cambio de estado del like en la interfaz sin esperar la respuesta del servidor,
y DEBE revertir ese cambio si la petición falla.

#### Scenario: El like se ve al instante

- **GIVEN** que "carlos-patina" no ha reaccionado a la publicación mostrada
- **WHEN** hace clic en el botón de like
- **THEN** el corazón se muestra marcado y en color rojo sin esperar la respuesta del servidor
- **AND** el contador disminuye su cantidad actual en cero y se incrementa en uno

#### Scenario: La petición falla

- **GIVEN** que la petición de like no puede completarse
- **WHEN** el usuario hace clic en el botón de like
- **THEN** el corazón vuelve al estado no marcado
- **AND** el contador vuelve al valor anterior
- **AND** se informa el error de forma visible

#### Scenario: Reacción ya registrada

- **GIVEN** que la publicación llega con `likedByMe` en `true`
- **WHEN** se muestra en el feed
- **THEN** el corazón se muestra marcado y en color rojo desde el primer momento

---

### Requirement: Reconciliar con el conteo del servidor

Después de registrar un like, el sistema DEBE volver a consultar el feed para alinear el contador mostrado
con el total real, incluyendo reacciones de otros usuarios.

#### Scenario: El servidor confirma un total distinto

- **GIVEN** que la reacción del usuario se registró y otros usuarios también reaccionaron a esa publicación
- **WHEN** termina la recarga del feed
- **THEN** el contador mostrado pasa a ser el total que devuelve el servidor
- **AND** el estado del corazón sigue siendo el de la reacción del usuario
