# Specifications: US-09 (TUX-57) — Conexiones en común entre dos perfiles

> **Ticket Linear**: `TUX-57` · **Card backlog**: `TUX-07` · **Dominio**: `social-graph`
> **Delta**: todos los requisitos son `ADDED`

---

### Requirement: Entregar la intersección de seguidos

El sistema DEBE devolver los usuarios que tanto el usuario A como el usuario B siguen, mediante la
interseección de relaciones `[:SIGUE]`. DEBE devolver una lista vacía cuando no hay ninguno en común.

#### Scenario: Dos usuarios con conexiones en común

- **GIVEN** que "carlos-patina" y "angel-villon" siguen ambos a "beatriz" y a "paulo"
- **WHEN** se consulta `GET /api/users/comunes` con `userA` "carlos-patino" y `userB` "angel-villon"
- **THEN** la respuesta es `200`
- **AND** contiene a "beatriz" y a "paulo"
- **AND** cada elemento trae `id`, `username`, `nombre` y `avatar`

#### Scenario: Sin conexiones en común

- **GIVEN** que "carlos-patina" y "angel-villon" no siguen a ninguna persona en común
- **WHEN** se consulta el endpoint con ambos identificadores
- **THEN** la respuesta es `200` con la lista vacía

#### Scenario: Exclusión de las conexiones exclusivas

- **GIVEN** que "beatriz" la sigue solo "carlos-patino" y "paulo" la sigue solo "angel-villon"
- **WHEN** se consulta el endpoint con ambos identificadores
- **THEN** la lista devuelta está vacía

---

### Requirement: Rechazar consultas incompletes o incoherentes

El sistema DEBE responder `400` si falta cualquiera de los dos identificadores, si alguno está vacío o
contiene solo espacios, o si ambos identificadores son iguales. NO DEBE devolver la lista completa de
seguidos de un usuario cuando se lo compara consigo mismo.

#### Scenario: Faltan los parámetros

- **GIVEN** que se consulta el endpoint sin `userA` ni `userB`
- **WHEN** se ejecuta la petición
- **THEN** la respuesta es `400`
- **AND** el cuerpo no es una lista de usuarios

#### Scenario: Falta uno de los dos

- **GIVEN** que se consulta con `userA` y sin `userB`
- **WHEN** se ejecuta la petición
- **THEN** la respuesta es `400`

#### Scenario: Comparación consigo mismo

- **GIVEN** que se consulta con `userA` y `userB` iguales
- **WHEN** se ejecuta la petición
- **THEN** la respuesta es `400`
- **AND** no devuelve la lista de usuarios que sigue esa persona

---

### Requirement: Tolerar datos de usuario incompletos

El sistema DEBE devolver la intersección aunque alguno de los usuarios no tenga nombre o avatar, y NO DEBE
fallar la petición por ello.

#### Scenario: Un usuario sin nombre

- **GIVEN** que "beatriz" tiene una relación de seguimiento pero su registro no tiene nombre
- **WHEN** se consulta la intersección que la incluye
- **THEN** la respuesta es `200`
- **AND** "beatriz" aparece en la lista
- **AND** su `nombre` llega vacío o nulo

#### Scenario: Un usuario sin avatar

- **GIVEN** que "paulo" no tiene avatar registrado
- **WHEN** se consulta la intersección que lo incluye
- **THEN** la respuesta es `200`
- **AND** su `avatar` llega vacío o nulo

---

### Requirement: Mostrar las conexiones mutuas en la interfaz

El sistema DEBE permitir consultar las conexiones en común de un usuario con otra persona desde el módulo
de red social, y DEBE mostrar el resultado con avatar, nombre y el estado vacío.

#### Scenario: Consulta con resultados

- **GIVEN** que el usuario consulta las conexiones en común con otra persona
- **WHEN** la consulta devuelve usuarios
- **THEN** el panel lista esos usuarios
- **AND** cada uno muestra su avatar, o su inicial cuando no tiene avatar
- **AND** se muestra su nombre, o su identificador cuando no tiene nombre

#### Scenario: Consulta sin resultados

- **GIVEN** que el usuario consulta las conexiones en común con otra persona
- **WHEN** la consulta devuelve una lista vacía
- **THEN** el panel informa que no hay conexiones en común
- **AND** no muestra un error

#### Scenario: Identificador inválido

- **GIVEN** que el usuario envía un identificador vacío
- **WHEN** se intenta la consulta
- **THEN** el panel informa que se necesita un identificador
- **AND** no se envía ninguna petición

#### Scenario: Fallo de la consulta

- **GIVEN** que la consulta al servidor falla
- **WHEN** se intenta la consulta
- **THEN** el panel informa el fallo de forma visible
- **AND** no se muestra una lista vacía como si fuera un resultado
