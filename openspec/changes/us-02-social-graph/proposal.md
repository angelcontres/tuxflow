# Proposal: US-02 (TUX-53) — Seguir y dejar de seguir en el grafo social

**Change**: `us-02-social-graph`
**Ticket**: TUX-53 (US-02)
**Alcance**: Frontend + añadido estrecho de backend (autorizado 2026-09-30)
**Fecha**: 2026-09-26 · **Actualizado**: 2026-09-30 (cambio de alcance: el backend sí se modifica)
**Spec base**: no existe todavia `openspec/specs/social-graph/spec.md`. La capability `social-graph` esta declarada en `openspec/specs/spec.md` (capability 2 de 8), pero su spec durable aun no se escribio. El delta de este change es, por lo tanto, enteramente `## ADDED Requirements`.

> **Este proposal es corto a propósito.** La historia está implementada en su mayor parte desde el commit `964620d`. Un documento largo aquí sería relleno, y el relleno es exactamente lo que motivó rehacer esta historia. El trabajo real que queda está enumerado con precisión y es pequeño.

---

## Intent

Completar la capacidad de seguir y dejar de seguir usuarios, cerrando el último hueco del lado del cliente: **no existe forma de dejar de seguir**.

El botón "Seguir" funciona. El camino inverso no está en la interfaz, aunque el servicio HTTP que lo implementa sí existe y está probado por lectura de código.

El 2026-09-30 se autorizó el cambio de alcance: el backend gana un endpoint estrecho de lectura (`GET /api/users/{userId}/follows`) porque el diseño original —solo frontend— quedó demostrado inviable (ver `design.md`, causa raíz F3). Todo lo que sigue ya refleja ese alcance.

---

## Estado verificado

### Backend: cadena completa + un endpoint nuevo por crear

La cadena hexagonal de escritura está completa y cableada. Ninguna de estas piezas falta:

| Anillo | Artefacto | Evidencia |
|---|---|---|
| Entrada (REST) | `UserGraphResource` — `POST` y `DELETE` `/{seguidorId}/follow/{seguidoId}` | líneas 26-38 |
| Puerto de entrada | `GestionarGrafoSocialUseCase` — `seguirUsuario`, `dejarDeSeguir` | líneas 11-12 |
| Servicio | `UserGraphApplicationService` — delega al puerto de salida | líneas 26, 31 |
| Puerto de salida | `GrafoPersistencePort` — ambos métodos declarados | líneas 28-29 |
| Adaptador | `Neo4jGrafoAdapter` — `seguirUsuario`, `dejarDeSeguir` | líneas 207, 219 |

Lo que **falta** y esta historia crea (Opción A, segundo endpoint):

| Anillo | Artefacto nuevo | Sigue el estilo de |
|---|---|---|
| Puerto de entrada | `GestionarGrafoSocialUseCase.obtenerSeguidos` | `obtenerSugerencias`, `obtenerSeguidoresEnComun` |
| Servicio | `UserGraphApplicationService` pass-through, sin validación | `obtenerSugerencias` (líneas 62-65) |
| Puerto de salida | `GrafoPersistencePort.obtenerSeguidos` | nomenclatura verbo-primero del puerto |
| Adaptador | `Neo4jGrafoAdapter.obtenerSeguidos`, un solo `MATCH -[:SIGUE]->` | `obtenerSeguidoresEnComun` (~líneas 131-138) |
| Entrada (REST) | `UserGraphResource` — `GET /{userId}/follows` | `GET /{userId}/sugerencias` (líneas 107-111) |

### Frontend: servicio completo, UI incompleta

| Artefacto | Estado | Evidencia |
|---|---|---|
| `networkApi.followUserInGraph` | ✅ existe | `features/network/services/networkApi.ts` |
| `networkApi.unfollowUserInGraph` | ✅ existe | mismo archivo |
| `networkApi.fetchSeguidos` | ❌ **no existe** | a crear en esta historia (D6) |
| Botón "Seguir" | ✅ renderiza y llama al servicio | `UserSuggestionsCard.tsx`, `handleFollow` |
| Botón "Dejar de seguir" | ❌ **no existe** | `UserSuggestionsCard.tsx` solo renderiza "Seguir" |
| Estado de seguimiento | ❌ **no existe** | la tarjeta no sabe si ya se sigue al usuario |
| Montaje en la app | ✅ `UserSuggestionsCard` montado con `currentUserId` | `App.tsx` |

---

## Alcance

### Dentro del alcance

- Endpoint `GET /api/users/{userId}/follows` que devuelve `List<Usuario>` (modelo de dominio existente, sin DTO nuevo), con su puerto de entrada, servicio, puerto de salida, adaptador y recurso.
- `fetchSeguidos(userId)` en `networkApi.ts`, siguiendo `fetchSugerenciasGrafo` exactamente.
- Fusión en `App.tsx` (`loadAllData`, líneas 20-33): la tarjeta se alimenta de la unión de sugerencias y seguidos, con bandera de seguimiento por fila provista por el origen.
- Botón "Dejar de seguir" en `UserSuggestionsCard`, reutilizando `unfollowUserInGraph`, que ya existe.
- Manejo del error de la acción, hoy limitado a un `console.error` silencioso.
- Pruebas colocalizadas: JUnit 5 en backend (`$MAVEN_HOME/bin/mvn test`), Vitest en frontend (`pnpm test`), según `openspec/config.yaml:127-133`.
- Verificación de que la cadena backend responde y de que la interfaz refleja el cambio.

### Fuera del alcance

- **Sugerencias de segundo grado.** `obtenerSugerencias` ya existe en `UserGraphResource` y alimenta esta tarjeta, pero el cálculo del algoritmo es de US-03. Aquí no se toca.
- **Relaciones sociales en general.** Seguir y dejar de seguir son las únicas operaciones de esta historia.
- **Autenticación.** El `currentUserId` que consume la acción parte de un valor fijo en `App.tsx:14`, pero el commit `1053010` implementó sesión/registro real (TUX-01/TUX-52) y existe `handleUserChange`: el fijo es valor por defecto/respaldo, no el único camino. Sustituirlo del todo es de US-01; esta historia no lo toca.
- **Chat, feed, reacciones, push, posts, tendencias, seguidores en común y camino más corto.** Corresponden a US-04 a US-11.
- **DTO nuevo de seguido.** Se devuelve el `Usuario` de dominio existente; no se crea ningún modelo.

---

## Contexto técnico

El componente actual no distingue el estado de la relación, así que solo puede ofrecer una de las dos acciones:

```tsx
// UserSuggestionsCard.tsx — estado actual
const handleFollow = async (targetId: string) => {
  try {
    await followUserInGraph(currentUserId, targetId);
    onNetworkUpdated();
  } catch (err) {
    console.error('Error al seguir usuario:', err);
  }
};

// ...y en el render, siempre:
<button onClick={() => handleFollow(sug.id)}>
  <UserPlus className="w-3.5 h-3.5" />
  <span>Seguir</span>
</button>
```

`followUserInGraph` y `unfollowUserInGraph` comparten firma, de modo que alternar entre ambas es una decisión de presentación, no un gap de red. El origen del estado de seguimiento —una segunda fuente de seguidos fusionada en el cliente— queda fijado en `design.md` (D6/D7).

> La causa raíz que forzó el rediseño: el plan original guardaba `seguidosIds: Set<string>` local y llamaba `onNetworkUpdated()` tras cada acción, pero `App.tsx:20-33` (`loadAllData`) hace `setSugerencias(sugData)` —reemplazo total— y `App.tsx:95` pasa `onNetworkUpdated={loadAllData}`. El usuario recién seguido se volvía a pedir fuera de la lista y desaparecía del DOM: el botón "Dejar de seguir" nunca podía renderizarse. La mitigación de fusión prometida (`design.md:96`, `tasks.md:97`) no tenía ningún checkbox que la implementara. El detalle completo está en `design.md`.

El servicio ya expone ambos verbos:

```ts
export const followUserInGraph = async (seguidorId: string, seguidoId: string): Promise<void> => {
  await api.post(`/users/${seguidorId}/follow/${seguidoId}` (read-only));
};

export const unfollowUserInGraph = async (seguidorId: string, seguidoId: string): Promise<void> => {
  await api.delete(`/users/${seguidorId}/follow/${seguidoId}` (read-only));
};
```

---

## Cambios en el grafo

Ninguno de esquema. La relación `[:SIGUE]` y su aritmética de creación y borrado ya están en `Neo4jGrafoAdapter`. El endpoint nuevo es una lectura con un único `MATCH (u:Usuario {id: $userId})-[:SIGUE]->(s:Usuario)`, sin `UNION` ni `OPTIONAL MATCH`.

La única consecuencia observable es que la interfaz debe reflejar el estado real de la relación después de cada acción, para no ofrecer "Seguir" sobre alguien a quien ya se sigue.

---

## Cambios en permisos

Ninguno en esta historia. La autorización de la acción depende de US-01: hasta que exista token y sesión plenos, la acción parte del `currentUserId` por defecto en `App.tsx:14`, matizado porque el commit `1053010` (TUX-01/TUX-52) aportó sesión/registro y `handleUserChange` permite cambiar de usuario. Es un riesgo conocido y aceptado **de forma temporal**, con US-01 como dependencia de cierre.

---

## Entregables

1. Endpoint `GET /api/users/{userId}/follows` con `Response.ok(useCase.obtenerSeguidos(userId)).build()`, sin try/catch.
2. `fetchSeguidos` en `networkApi.ts` y tipo `Usuario` en `network.types.ts` con los nombres de campo del backend (`avatarUrl`).
3. Fusión por id en `App.tsx` (seguidos primero, sin duplicados aunque un id aparezca en ambas fuentes) y fila discriminada con bandera de seguimiento.
4. Alternancia de acción en `UserSuggestionsCard` entre seguir y dejar de seguir, con estado solo tras confirmación del servidor.
5. Botón de "Dejar de seguir" invocando `unfollowUserInGraph`.
6. Retroalimentación visible al usuario cuando la acción falla, en lugar de un `console.error` silencioso.
7. Pruebas JUnit 5 (backend) y Vitest (frontend) colocalizadas que fallan si el comportamiento se rompe.
8. `$MAVEN_HOME/bin/mvn test`, `$MAVEN_HOME/bin/mvn spotless:check`, `$MAVEN_HOME/bin/mvn compile` y `pnpm test` + `pnpm run build` desde `frontend`, en verde.

---

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| La acción parte de identidad por defecto hardcodeada | Un usuario podría actuar como otro antes de US-01 | Matizado: el commit `1053010` aportó sesión/registro y `handleUserChange`; el fijo en `App.tsx:14` es respaldo. Dependencia de cierre US-01, riesgo temporal aceptado |
| El estado de seguimiento se deriva de un origen que no lo refleja | La interfaz ofrece "Seguir" sobre alguien ya seguido | D6/D7 en `design.md`: segunda fuente de seguidos fusionada en el cliente, bandera por fila provista por el origen, no un `Set` local |
| La compilación del frontend falla por un error de tipos | Ningún criterio de éxito es alcanzable | **Resuelto antes de esta historia**: `pushService.ts:28` ya declara `Uint8Array<ArrayBuffer>` y `pnpm run build` está en verde. Si vuelve a fallar, es regresión, no deuda heredada |
| El backend no compila por dependencias | Bloquea el endpoint nuevo | Obsoleto como riesgo: `backend/pom.xml:43,56,62` fija versiones (`quarkus-neo4j 4.4.0`, `quarkus-amazon-s3 2.18.1`, `url-connection-client 2.27.20`); además la verificación incluye `$MAVEN_HOME/bin/mvn compile` |
| `UserSuggestionsCard.tsx` lo tocan también US-03 y US-10 | Colisión de merge si se trabaja en paralelo | `openspec/ROADMAP.md:75` y líneas 80-81: colisión estrictamente serial — nunca dos de las tres historias en paralelo |
| Un fallo de red se muestra solo en consola | El usuario no sabe si la acción ocurrió | El entregable 6 cubre la retroalimentación visible |

---

## Criterios de éxito

- [ ] `GET /api/users/{userId}/follows` responde 200 con `List<Usuario>` (id, username, nombre, avatarUrl)
- [ ] `UserSuggestionsCard` ofrece "Dejar de seguir" sobre un usuario ya seguido
- [ ] La acción de dejar de seguir invoca `unfollowUserInGraph` con `currentUserId` y el identificador correcto
- [ ] Seguir y dejar de seguir alternan correctamente sin recargar la página
- [ ] Un error de la acción produce una señal visible, no solo un `console.error`
- [ ] La interfaz no ofrece "Seguir" sobre una relación ya establecida
- [ ] El estado visible coincide con la respuesta del servidor, sin actualización optimista
- [ ] `$MAVEN_HOME/bin/mvn test` y `pnpm test` en verde, con pruebas nuevas que cubren el endpoint y la alternancia
- [ ] `$MAVEN_HOME/bin/mvn spotless:check` y `pnpm run build` sin errores nuevos
