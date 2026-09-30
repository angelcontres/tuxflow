# Specifications: US-03 (TUX-58) — Sugerencia inteligente de contactos

> **Ticket**: `TUX-58` — US-03: Sugerencia Inteligente de Contactos (2do Grado)
> **Dominio**: `social-graph` · **Alcance**: exclusivo de frontend
> **Delta**: todos los requisitos son `ADDED`

## Contexto

`GET /api/users/{userId}/sugerencias` ya existe y ya devuelve, por sugerencia, el número de intermediarios
compartidos y los usernames de esos intermediarios. Estos requisitos cubren únicamente la presentación de
esos datos en `UserSuggestionsCard.tsx`.

---

### Requirement: Mostrar los intermediarios en común de cada sugerencia

El sistema DEBE mostrar los usernames de las personas que se tienen en común con cada sugerencia,
tomados del campo `seguidosEnComun` de la respuesta.

#### Scenario: La lista de intermediarios se renderiza

- **GIVEN** que "carlos-patino" sigue a "beatriz" y a "paulo", y ambos siguen a "david"
- **WHEN** la tarjeta de sugerencias renderiza la sugerencia de "david"
- **THEN** se muestran los intermediarios "beatriz" y "paulo"
- **AND** se muestra el contador de 2 conexiones en común

#### Scenario: La ausencia de intermediarios no rompe la tarjeta

- **GIVEN** que una sugerencia llega con `seguidosEnComun` vacío
- **WHEN** la tarjeta la renderiza
- **THEN** la tarjeta se muestra igual, sin la línea de nombres
- **AND** el resto de la información permanece visible

---

### Requirement: Mostrar el avatar real de la persona sugerida

El sistema DEBE renderizar el avatar recibido en el campo `avatar` de la respuesta, y DEBE mantener una
representación de respaldo cuando el avatar no esté disponible.

#### Scenario: El avatar se muestra cuando existe

- **GIVEN** que la sugerencia trae una URL en el campo `avatar`
- **WHEN** la tarjeta la renderiza
- **THEN** se muestra la imagen del avatar
- **AND** no se muestra el círculo con la inicial

#### Scenario: El respaldo se usa cuando no hay avatar

- **GIVEN** que la sugerencia trae el campo `avatar` vacío
- **WHEN** la tarjeta la renderiza
- **THEN** se muestra el círculo con la inicial del username
- **AND** la tarjeta permanece legible

#### Scenario: El respaldo se usa cuando la imagen no carga

- **GIVEN** que la sugerencia trae una URL en el campo `avatar`
- **AND** que la imagen no se puede cargar
- **WHEN** la tarjeta la renderiza
- **THEN** se muestra el círculo con la inicial del username en lugar de la imagen

---

### Requirement: No modificar el contrato de datos de sugerencias

El sistema NO DEBE agregar campos, endpoints ni tipos nuevos para satisfacer esta historia. La verificación
de la implementación se limita al build de frontend y a la suite de pruebas.

#### Scenario: El contrato permanece intacto

- **GIVEN** que la historia se implementó
- **WHEN** se inspecciona el código modificado
- **THEN** el único archivo de producción cambiado es `UserSuggestionsCard.tsx`
- **AND** `networkApi.ts` y `network.types.ts` no fueron modificados

#### Scenario: El comportamiento nuevo queda cubierto por pruebas

- **GIVEN** que la historia se implementó
- **WHEN** se inspecciona el diff
- **THEN** el único archivo adicional es `UserSuggestionsCard.test.tsx`
- **AND** ese archivo contiene pruebas que fallan si `seguidosEnComun` o `avatar` vuelven a ignorarse
