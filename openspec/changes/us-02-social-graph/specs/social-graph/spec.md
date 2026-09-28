# Delta Spec: social-graph (US-02)

> **Ticket**: `TUX-53` — US-02: Seguir y dejar de seguir en el grafo social. Alcance exclusivo de frontend; el backend no se modifica.
>
> Este delta describe el **estado objetivo**. Al archivarse, se consolida en `openspec/specs/social-graph/spec.md`.
>
> Decisiones de diseño de referencia: `openspec/changes/us-02-social-graph/design.md` (origen del estado de seguimiento).

---

## ADDED Requirements

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

El sistema DEBE mostrar exactamente una acción por usuario: "Seguir" cuando no existe relación, "Dejar de seguir" cuando existe.

#### Scenario: Usuario no seguido

- **GIVEN** un sugerido sin relación `[:SIGUE]` desde el usuario actual
- **WHEN** se renderiza `UserSuggestionsCard`
- **THEN** se muestra "Seguir" y no se muestra "Dejar de seguir"

#### Scenario: Usuario ya seguido

- **GIVEN** un sugerido con relación `[:SIGUE]` activa desde el usuario actual
- **WHEN** se renderiza `UserSuggestionsCard`
- **THEN** se muestra "Dejar de seguir" y no se muestra "Seguir"

> El origen del estado (sugerencias o consulta nueva) queda diferido a `design.md`. Este requisito exige el comportamiento visible, no el mecanismo.

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
- Autenticación y sesión: corresponden a US-01. `currentUserId` permanece hardcodeado en `App.tsx`; es riesgo aceptado, no requisito de esta historia.
- Backend: ningún archivo del backend se modifica. Un defecto detectado ahí es corrección, no alcance de esta historia.
- Chat, feed, reacciones, push, posts, tendencias y camino más corto: US-04 a US-11.
- Pruebas: no se crean archivos de prueba. La verificación es compilación estricta (`pnpm run build` en `frontend`; `mvn compile` confirma que el backend sigue intacto).
