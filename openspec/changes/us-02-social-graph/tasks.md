# Tasks: US-02 (TUX-53) — Seguir y dejar de seguir en el grafo social

> **Ticket**: `TUX-53` — US-02: Seguir y dejar de seguir en el grafo social.
> **Especificación**: `openspec/changes/us-02-social-graph/specs/social-graph/spec.md` (5 requisitos, 11 escenarios).
> **Diseño**: `openspec/changes/us-02-social-graph/design.md` (D1–D8; D1 y D4 superseded, D5 vigente con riesgo rebajado).
> **Alcance**: frontend + añadido estrecho de backend (`GET /{userId}/follows`, autorizado 2026-09-30). Cada checkbox implementa algo: no hay mitigaciones prometidas sin tarea.

## Review Workload Forecast

| Métrica | Valor |
|---|---|
| Unidades de trabajo | 5 |
| Líneas estimadas de cambio | 290–400 (código + pruebas) |
| Riesgo de presupuesto de 400 líneas | **Medio** (el techo toca el presupuesto) |
| PRs encadenados recomendados | **Sí — 2** (PR1 backend, PR2 frontend) |
| Decisión necesaria antes de apply | **No** (Opción A ya elegida) |
| División sugerida | PR1: Unidades 1–2 · PR2: Unidades 3–4 (+ Unidad 5 como cierre) |
| Estrategia de entrega | chained-pr |
| Límite de revisión del preflight | 800 líneas |

**Estimación por unidad** (autoría, con pruebas colocalizadas incluidas):

| Unidad | Alcance | Líneas |
|---|---|---|
| 1 | Puertos + servicio `obtenerSeguidos` + test JUnit del servicio (D6) | 50–70 |
| 2 | Adaptador Cypher + recurso `GET /{userId}/follows` + test de contrato (D6) | 60–90 |
| 3 | `fetchSeguidos` + tipo `Usuario`/fila + test Vitest del cliente (D6) | 40–60 |
| 4 | Fusión en `App.tsx` + alternancia/error/título en la tarjeta + tests Vitest (D2, D3, D5, D7, D8; retira D1) | 140–180 |
| 5 | Verificación final con comandos correctos, sin cambio de código | 0 |

**Recomendación**: dos PRs encadenados. PR1 (backend, Unidades 1–2) desbloquea causalmente PR2 (frontend, Unidades 3–4); la Unidad 5 cierra PR2. Cada unidad es un commit revisable y revertible en bloque. Las pruebas se ejecutan durante cada fase (`openspec/config.yaml:127-133`), no solo en la Unidad 5.

---

## Fase 1 — Puertos y servicio de seguidos [back]

### Unidad 1: `obtenerSeguidos` en puertos y servicio, con test unitario

- **Estado inicial**: la cadena de lectura no conoce a los seguidos; no hay `obtenerSeguidos` en ningún anillo.
- **Terminado cuando**: el puerto de entrada, el servicio (pass-through, cero validación) y el puerto de salida declaran/implementan `obtenerSeguidos`, y un test JUnit lo cubre.
- **Trazabilidad**: Requirement Endpoint de usuarios seguidos (escenario sin validación añadida); D6 (puertos + servicio).
- **Archivos**: `backend/src/main/java/ec/edu/upse/redsocial/domain/port/in/GestionarGrafoSocialUseCase.java`, `backend/src/main/java/ec/edu/upse/redsocial/infrastructure/service/UserGraphApplicationService.java`, `backend/src/main/java/ec/edu/upse/redsocial/domain/port/out/GrafoPersistencePort.java`, más un `*Test.java` nuevo junto al servicio.
- **Desbloquea (frontier)**: el adaptador y el recurso de la Unidad 2, que necesitan los puertos para compilar.
- **Boundary de rollback**: los tres archivos más el test. Revertirlos elimina `obtenerSeguidos` de la cadena; el resto del backend sigue compilando.
- **Verificación**: `$MAVEN_HOME/bin/mvn test` desde `backend` (JUnit 5 vía Surefire; `UsuarioTest`/`PostTest` existentes siguen verdes).

- [ ] 1.1 Declarar `List<Usuario> obtenerSeguidos(String userId);` en `GestionarGrafoSocialUseCase.java`, en el estilo de `obtenerSugerencias` y `obtenerSeguidoresEnComun` (D6)
- [ ] 1.2 Declarar `List<Usuario> obtenerSeguidos(String userId);` en `GrafoPersistencePort.java`, con nomenclatura verbo-primero del puerto (D6)
- [ ] 1.3 Implementar el pass-through sin validación en `UserGraphApplicationService.java`, como `obtenerSugerencias` (líneas 62-65) (D6; Requirement Endpoint, escenario sin validación)
- [ ] 1.4 Añadir test JUnit (Mockito, sin contenedor) que verifica delegación al puerto de salida y ausencia de validación: falla si el servicio filtra, transforma o valida (D6; Requirement Endpoint, escenario sin validación)

---

## Fase 2 — Adaptador y recurso de seguidos [back]

### Unidad 2: Cypher de seguidos y `GET /{userId}/follows`, con test de contrato

- **Estado inicial**: puertos y servicio listos (Unidad 1); sin lectura Cypher ni endpoint.
- **Terminado cuando**: `GET /api/users/{userId}/follows` responde 200 con `List<Usuario>` (lista vacía si no hay seguidos) y un test cubre el contrato.
- **Trazabilidad**: Requirement Endpoint de usuarios seguidos (escenarios seguidos con éxito y usuario sin seguidos); D6 (adaptador + recurso).
- **Archivos**: `backend/src/main/java/ec/edu/upse/redsocial/infrastructure/adapter/out/neo4j/Neo4jGrafoAdapter.java`, `backend/src/main/java/ec/edu/upse/redsocial/infrastructure/adapter/in/rest/UserGraphResource.java`, más test de contrato JUnit.
- **Desbloquea (frontier)**: el cliente `fetchSeguidos` de la Unidad 3, que necesita el contrato del endpoint.
- **Boundary de rollback**: ambos archivos más el test. Revertirlos retira el endpoint; la cadena de escritura (`seguirUsuario`, `dejarDeSeguir`, líneas 207 y 219 del adaptador) queda intacta.
- **Verificación**: `$MAVEN_HOME/bin/mvn test` desde `backend`.

- [ ] 2.1 Añadir `obtenerSeguidos` en `Neo4jGrafoAdapter.java` con `try (var session = driver.session()) { session.executeRead(...) }`, sin try/catch ni logging, reutilizando el mapeo de fila `Usuario` de `obtenerSeguidoresEnComun` (~líneas 131-138); Cypher de un solo `MATCH -[:SIGUE]->` que retorna `id, username, nombre, avatarUrl` (D6; Requirement Endpoint, escenarios con éxito y sin seguidos)
- [ ] 2.2 Añadir `@GET @Path("/{userId}/follows")` en `UserGraphResource.java` como `@GET @Path("/{userId}/sugerencias")` (líneas 107-111): `Response.ok(useCase.obtenerSeguidos(userId)).build()`, sin try/catch (D6; Requirement Endpoint, escenario con éxito)
- [ ] 2.3 Añadir test de contrato del endpoint (forma de respuesta y lista vacía); si el entorno no tiene Docker para Testcontainers (`config.yaml:50`), registrarlo como pendiente justificado en el propio test, nunca desactivar una prueba para dejarla verde (D6; Requirement Endpoint, ambos escenarios)

---

## Fase 3 — Cliente HTTP y tipos [front]

### Unidad 3: `fetchSeguidos` y tipo `Usuario`/fila, con test Vitest

- **Estado inicial**: `networkApi.ts` expone seguir/dejar de seguir y sugerencias, pero no seguidos; `network.types.ts` no conoce el `Usuario` del backend.
- **Terminado cuando**: el cliente trae seguidos del endpoint nuevo y los tipos distinguen `avatarUrl` (backend) de `avatar` (sugerencias), con la fila discriminada que porta la bandera.
- **Trazabilidad**: Requirement Endpoint de usuarios seguidos (el cliente consume su forma); D6 (cliente + tipos); D4-superseded (este es el cambio en `networkApi.ts` que D4 negaba).
- **Archivos**: `frontend/src/features/network/services/networkApi.ts`, `frontend/src/features/network/types/network.types.ts`, más `networkApi.test.ts` colocalizado.
- **Desbloquea (frontier)**: la fusión de la Unidad 4, que necesita `fetchSeguidos` y la fila con bandera.
- **Boundary de rollback**: ambos archivos más el test. Revertirlos devuelve el cliente a seguir/dejar/sugerencias, sin afectar la tarjeta.
- **Verificación**: `pnpm test` y `pnpm run build` desde `frontend`.

- [ ] 3.1 Agregar `fetchSeguidos(userId)` en `frontend/src/features/network/services/networkApi.ts` siguiendo `fetchSugerenciasGrafo` exactamente (axios `api.get` desnudo a `/users/${userId}/follows`, sin headers ni manejo de errores) (D6)
- [ ] 3.2 Agregar el tipo `Usuario` en `frontend/src/features/network/types/network.types.ts` con los nombres exactos del backend (`avatarUrl`, distinto de `avatar` en sugerencias) más la fila discriminada `seguido: boolean` que renderiza sugerencia o seguido (D6, D7)
- [ ] 3.3 Añadir test Vitest colocalizado del cliente (respuesta 200 con forma `Usuario`, lista vacía); falla si cambia el path o la forma (D6; Requirement Endpoint, escenarios con éxito y sin seguidos)

---

## Fase 4 — Fusión y tarjeta [front]

### Unidad 4: fusión por id en `App.tsx` y alternancia con bandera por fila

- **Estado inicial**: `loadAllData` (`App.tsx:20-33`) pide solo dos fuentes con reemplazo total; la tarjeta solo renderiza "Seguir" y no conoce seguidos.
- **Terminado cuando**: la tarjeta muestra la unión (seguidos primero, sin duplicados), alterna "Seguir"/"Dejar de seguir" por bandera solo tras confirmación del servidor, con error visible por tarjeta, botón deshabilitado en vuelo y título "Tu red".
- **Trazabilidad**: Requirement Dejar de seguir (ambos escenarios); Requirement Alternancia (ambos escenarios); Requirement Retroalimentación visible (ambos escenarios); Requirement Reflejo inmediato (ambos escenarios); D2, D3, D5, D6 (fusión), D7, D8; D1-superseded (retiro del `Set` local).
- **Archivos**: `frontend/src/App.tsx`, `frontend/src/features/network/components/UserSuggestionsCard.tsx`, más extensión de `UserSuggestionsCard.test.tsx` (base de 8 pruebas verdes).
- **Desbloquea (frontier)**: la verificación final de la Unidad 5 sobre la UI completa.
- **Boundary de rollback**: ambos archivos más los tests. Revertirlos devuelve la tarjeta al botón único de "Seguir".
- **Verificación**: `pnpm test` y `pnpm run build` desde `frontend`.

- [ ] 4.1 Sumar `fetchSeguidos` al `Promise.all` de `loadAllData` en `frontend/src/App.tsx` (líneas 20-33) y fusionar por id —seguidos primero, sin duplicados aunque un id venga en ambas fuentes, sin caída— manteniendo el `currentUserId` por defecto de `App.tsx:14` (D5) y `handleUserChange` intactos (D6; Requirement Alternancia, escenario usuario ya seguido)
- [ ] 4.2 Eliminar `seguidosIds: Set<string>` y renderizar "Seguir"/"Dejar de seguir" por la bandera de cada fila en `frontend/src/features/network/components/UserSuggestionsCard.tsx`, con `handleToggle` que invoca `followUserInGraph` o `unfollowUserInGraph` y actualiza la bandera solo tras `await` exitoso, sin optimismo (D7 que supersede a D1; D2; Requirement Dejar de seguir, ambos escenarios; Requirement Alternancia, ambos escenarios; Requirement Reflejo inmediato, ambos escenarios)
- [ ] 4.3 Agregar `errorPorId` con `role="alert"` conservando el botón previo ante rechazo, y deshabilitar el botón de la tarjeta mientras su promesa está en curso, en `frontend/src/features/network/components/UserSuggestionsCard.tsx` (D2, D3; Requirement Retroalimentación visible, ambos escenarios)
- [ ] 4.4 Aplicar la copia D8 en `frontend/src/features/network/components/UserSuggestionsCard.tsx` —título "Tu red", subtítulo "Sugerencias y personas que sigues"— y extender `UserSuggestionsCard.test.tsx` con alternancia por bandera, error visible y render inicial de ya-seguido desde la fuente de seguidos (D8; Requirement Alternancia, escenario usuario ya seguido; Requirement Retroalimentación visible)

---

## Fase 5 — Integración y verificación [both]

### Unidad 5: verificación final con los comandos correctos

- **Estado inicial**: código y pruebas completos, verificación final sin correr.
- **Terminado cuando**: compilación, pruebas, formato y tipos pasan en ambas capas con las invocaciones reales del proyecto.
- **Trazabilidad**: sin requisito funcional; cierra los criterios de éxito de compilación y pruebas del proposal.
- **Archivos**: ninguno; es verificación.
- **Desbloquea (frontier)**: habilita `sdd-apply` y `sdd-verify` sobre una base compilable y probada.
- **Boundary de rollback**: sin cambio de código; no hay reversión parcial.
- **Verificación**: los cinco comandos de esta fase son la verificación.

- [ ] 5.1 Ejecutar `$MAVEN_HOME/bin/mvn test` desde `backend` (JUnit 5; nunca `mvn` desnudo: no está en PATH y no hay `mvnw`, `config.yaml:15-16`)
- [ ] 5.2 Ejecutar `$MAVEN_HOME/bin/mvn spotless:check` desde `backend` (`config.yaml:83`) y `$MAVEN_HOME/bin/mvn compile` (`config.yaml:74`)
- [ ] 5.3 Ejecutar `pnpm test` y `pnpm run build` desde `frontend` (`frontend/package.json:10`, `config.yaml:74`)

---

## Fuera de alcance

- Sugerencias de segundo grado (US-03).
- Autenticación y sesión plenas (US-01). El `currentUserId` por defecto sigue en `App.tsx:14` (matizado por el commit `1053010` y `handleUserChange`); es dependencia de cierre, no tarea.
- DTO nuevo de seguido; `avatar` vs `avatarUrl` se mantienen distintos y exactos.
- Chat, feed, reacciones, push, posts, tendencias y camino más corto (US-04 a US-11).
- Infraestructura de notificaciones; runner e2e (no disponible a propósito, `config.yaml:51-53`).

## Riesgos de implementación

| Riesgo | Mitigación |
|---|---|
| Recarga vía `onNetworkUpdated` reemplaza la lista | Los seguidos vienen del servidor y la fusión es por id en `loadAllData` (Unidad 4.1); el `Set` local se elimina (Unidad 4.2) |
| Doble clic dispara dos mutaciones | Deshabilitar el botón mientras la promesa está en curso (Unidad 4.3) |
| Identidad por defecto (`App.tsx:14`) | Riesgo rebajado por commit `1053010` + `handleUserChange`; dependencia de cierre de US-01 (D5, Unidad 4.1 la preserva) |
| `UserSuggestionsCard.tsx` lo tocan US-03 y US-10 | Trabajo estrictamente serial (`openspec/ROADMAP.md:80-81`); esta historia no deja el archivo en estado intermedio |
| Sin Docker no hay test de contrato Cypher | Pendiente justificado en el propio test (Unidad 2.3); servicio y recurso quedan cubiertos igual |

## Verificación: compilación Y pruebas, por decisión del proyecto

`openspec/config.yaml` ya decidió este punto: pruebas durante la implementación (`config.yaml:127-133`), runners operativos en ambas capas (`frontend/package.json:10` con `"test": "vitest run"`; JUnit 5 con `UsuarioTest`/`PostTest` existentes), y ninguna historia se cierra solo con compilación (`config.yaml:135`). La verificación es `$MAVEN_HOME/bin/mvn test` + `$MAVEN_HOME/bin/mvn spotless:check` + `$MAVEN_HOME/bin/mvn compile` en `backend`, y `pnpm test` + `pnpm run build` en `frontend` —siempre `$MAVEN_HOME/bin/mvn`, nunca `mvn` desnudo.
