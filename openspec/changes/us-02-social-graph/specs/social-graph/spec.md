# Delta Spec: social-graph (US-02)

> **Ticket**: `TUX-53` — US-02: Seguir y dejar de seguir en el grafo social. Alcance: frontend + añadido estrecho de backend (`GET /{userId}/follows`).
>
> **Cambio de alcance 2026-09-30**: el backend sí se modifica (endpoint de seguidos, Opción A). Las menciones anteriores a "backend intacto" quedan sin efecto.
>
> Este delta describe el **estado objetivo**. Al archivarse, se consolida en `openspec/specs/social-graph/spec.md`.
>
> Decisiones de diseño de referencia: `openspec/changes/us-02-social-graph/design.md` (D6/D7: origen del estado de seguimiento; D8: copia del título).

---

## ADDED Requirements

### Requirement: Endpoint de usuarios seguidos

El sistema DEBE exponer los usuarios ya seguidos vía `GET /api/users/{userId}/follows`, devolviendo el modelo `Usuario` de dominio existente (sin DTO nuevo).

#### Scenario: Seguidos con éxito

- **GIVEN** un usuario con relaciones `[:SIGUE]` activas
- **WHEN** se pide `GET /api/users/{userId}/follows`
- **THEN** responde 200 con la lista de `Usuario` seguidos (`id`, `username`, `nombre`, `avatarUrl`)
- **AND** la consulta es un único `MATCH (u:Usuario {id: $userId})-[:SIGUE]->(s:Usuario)`, sin `UNION` ni `OPTIONAL MATCH`

#### Scenario: Usuario sin seguidos

- **GIVEN** un usuario sin relaciones `[:SIGUE]` salientes
- **WHEN** se pide `GET /api/users/{userId}/follows`
- **THEN** responde 200 con lista vacía

#### Scenario: Endpoint sin validación añadida

- **GIVEN** cualquier `userId`, exista o no
- **WHEN** se pide `GET /api/users/{userId}/follows`
- **THEN** el servicio delega sin validación (pass-through) y el recurso responde `Response.ok(...).build()` sin try/catch, como `GET /{userId}/sugerencias` (`UserGraphResource`, líneas 107-111)

> El puerto de entrada lo declara como `obtenerSeguidos`, en el estilo de `obtenerSugerencias` y `obtenerSeguidoresEnComun`.

---

### Requirement: Dejar de seguir usuario

El sistema DEBE ofrecer la acción inversa a seguir, invocando el verbo `DELETE` ya existente en el servicio HTTP.

#### Scenario: Dejar de seguir exitoso

- **GIVEN** un usuario con relación `[:SIGUE]` activa hacia el objetivo
- **WHEN** se acciona "Dejar de seguir" en `UserSuggestionsCard`
- **THEN** el cliente invoca `unfollowUserInGraph(currentUserId, targetId)` con `DELETE /users/{seguidorId}/follow/{seguidoId}`
- **AND** la relación deja de ofrecerse como seguida en la interfaz

#### Scenario: Dejar de seguir sin recarga

- **GIVEN** una acción de dejar de seguir completada con éxito
- **WHEN** la respuesta del servidor confirma el borrado
- **THEN** la tarjeta cambia a "Seguir" sin recargar la página

> La alternancia es decisión de presentación, no requiere un cliente HTTP nuevo.

---

### Requirement: Alternancia según estado de seguimiento

El sistema DEBE mostrar exactamente una acción por usuario: "Seguir" cuando no existe relación, "Dejar de seguir" cuando existe. La fuente de la tarjeta es la unión de sugerencias y seguidos fusionada en el cliente por id (seguidos primero, sin duplicados); la bandera de seguimiento la provee cada fila desde su origen, nunca un `Set` solo-cliente.

#### Scenario: Usuario no seguido

- **GIVEN** un sugerido sin relación `[:SIGUE]` desde el usuario actual
- **WHEN** se renderiza `UserSuggestionsCard`
- **THEN** se muestra "Seguir" y no se muestra "Dejar de seguir"

#### Scenario: Usuario ya seguido

- **GIVEN** un usuario proveniente de la fuente de seguidos (`GET /{userId}/follows`), con bandera de seguimiento activa en su fila
- **WHEN** se renderiza `UserSuggestionsCard`
- **THEN** se muestra "Dejar de seguir" y no se muestra "Seguir"

> El sugerido nunca puede estar ya seguido por construcción (`Neo4jGrafoAdapter.java:74-75` filtra con `NOT (u)-[:SIGUE]->(sugerido)`); el caso "ya seguido" solo llega vía la fuente de seguidos (D6/D7). La tarjeta se titula "Tu red" con subtítulo "Sugerencias y personas que sigues" (D8).

---

### Requirement: Retroalimentación visible ante error

El sistema DEBE informar al usuario de forma visible cuando la acción de seguir o dejar de seguir falla, en lugar de limitarse a `console.error`.

#### Scenario: Error al seguir

- **GIVEN** un fallo de red o del servidor durante `followUserInGraph`
- **WHEN** la promesa se rechaza
- **THEN** la interfaz muestra una señal visible de error
- **AND** el estado mostrado sigue reflejando la ausencia de relación

#### Scenario: Error al dejar de seguir

- **GIVEN** un fallo de red o del servidor durante `unfollowUserInGraph`
- **WHEN** la promesa se rechaza
- **THEN** la interfaz muestra una señal visible de error
- **AND** el estado mostrado sigue reflejando la relación activa

---

### Requirement: Reflejo inmediato del cambio

El sistema DEBE reflejar el estado real de la relación inmediatamente después de cada acción exitosa, sin recargar la página.

#### Scenario: Seguir refleja el cambio

- **GIVEN** una acción de seguir completada con éxito
- **WHEN** la respuesta del servidor confirma la creación
- **THEN** la tarjeta muestra "Dejar de seguir" sin recargar la página

#### Scenario: Cambio confirmado contra el servidor

- **GIVEN** una acción de seguir o dejar de seguir
- **WHEN** la interfaz actualiza su estado
- **THEN** el estado mostrado coincide con la respuesta del servidor y no con un valor optimista sin confirmar

> Sin cambios en el grafo: `[:SIGUE]` ya se crea y borra en `Neo4jGrafoAdapter`. Sin restricciones ni validación nuevas.

---

## Fuera de alcance

- Sugerencias de segundo grado y amigos en común: corresponden a US-03. `obtenerSugerencias` no se modifica.
- Autenticación y sesión plenas: corresponden a US-01. El `currentUserId` por defecto permanece en `App.tsx:14` (matizado: el commit `1053010` aportó sesión/registro y `handleUserChange`); es riesgo aceptado, no requisito de esta historia. No se elimina el fijo.
- DTO nuevo de seguido: se devuelve el `Usuario` de dominio; no se crea ningún modelo.
- Chat, feed, reacciones, push, posts, tendencias y camino más corto: US-04 a US-11.
- Pruebas: EN alcance. JUnit 5 en backend (`$MAVEN_HOME/bin/mvn test`, con `UsuarioTest`/`PostTest` existentes como base) y Vitest en frontend (`pnpm test`, `frontend/package.json:10`; la tarjeta ya tiene base en `UserSuggestionsCard.test.tsx`). Verificación de cierre: compilación y pruebas (`$MAVEN_HOME/bin/mvn compile`, `pnpm run build`), más `$MAVEN_HOME/bin/mvn spotless:check` (`openspec/config.yaml:83`).
