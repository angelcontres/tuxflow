# Design: US-02 — Seguir y dejar de seguir en el grafo social

**Change**: `us-02-social-graph` · **Ticket**: TUX-53 · **Alcance**: frontend + añadido estrecho de backend (autorizado 2026-09-30) · **Base**: `specs/social-graph/spec.md` (delta verificado, 5 requisitos) y `proposal.md`.

## Enfoque técnico

El 2026-09-30 se autorizó un segundo endpoint de lectura (`GET /api/users/{userId}/follows`, Opción A: endpoint separado, no agregado) porque el diseño original solo-frontend quedó demostrado inviable. La tarjeta se alimenta de la unión de sugerencias y seguidos, fusionada en el cliente por id, con la bandera de seguimiento provista por fila desde su origen. El estado cambia solo tras respuesta confirmada, con error visible por tarjeta.

## Causa raíz del rediseño

El plan original (D1) guardaba `seguidosIds: Set<string>` en estado local y seguía llamando `onNetworkUpdated()` tras cada acción. Esa combinación no podía funcionar:

1. `App.tsx:20-33` (`loadAllData`) hace `setSugerencias(sugData)` —reemplazo total de la lista— y `App.tsx:95` pasa `onNetworkUpdated={loadAllData}`.
2. Tras seguir a un usuario, la recarga volvía a pedir sugerencias, y `Neo4jGrafoAdapter.java:74-75` filtra con `NOT (u)-[:SIGUE]->(sugerido)`: el recién seguido ya no venía en la lista.
3. El usuario desaparecía del DOM, así que el botón "Dejar de seguir" —que dependía de ese `Set` local sobre una fila que ya no existía— nunca podía renderizarse.
4. La mitigación prometida ("el estado se conserva por identificador y se fusiona tras la recarga", `design.md:96`, `tasks.md:97`) no tenía ningún checkbox que la implementara en `tasks.md`.

Conclusión registrada: **el spec no debe afirmar que el estado local por sí solo resuelve la alternancia**. La bandera de seguimiento debe venir provista por fila desde una fuente que sí contenga a los seguidos (D6/D7).

## Decisiones de arquitectura

### D1. Origen del estado de seguimiento: estado local del cliente confirmado por el servidor — SUPERSEDED por D7

**Decisión original**: `UserSuggestionsCard` mantiene `seguidosIds: Set<string>` en estado local. Cada tarjeta inicia como no seguida y cambia a seguida solo cuando `POST` responde con éxito; vuelve a no seguida solo cuando `DELETE` responde con éxito.

**Por qué quedó superseded**: por la causa raíz de arriba, un `Set` local no puede satisfacer ni el render inicial de un ya-seguido (las sugerencias excluyen seguidos por construcción, `Neo4jGrafoAdapter.java:74-75`) ni sobrevivir al reemplazo total de `loadAllData` (`App.tsx:20-33`). Ver D7, que la reemplaza.

**Lo que se conserva de D1**: la mitad "confirmado por el servidor" sigue vigente y vive ahora en D2.

**Alternativas descartadas entonces** (se mantienen como registro):
- (a) Derivarlo del payload de sugerencias. Descartada por lectura de código: `SugerenciaUsuario` (frontend y `domain/model`) no contiene ningún campo de estado, y la consulta Cypher de `obtenerSugerenciasUsuarios` filtra con `NOT (u)-[:SIGUE]->(sugerido)`. Por construcción, todo sugerido está no seguido; el payload no puede distinguir el caso "ya seguido".
- (b) Endpoint nuevo de estado de seguimiento. Descartada **entonces** por alcance: el proposal y el spec declaraban backend intacto. Reutilizar `GET /comunes` por tarjeta sería un N+1 con semántica incorrecta. Esta alternativa es exactamente lo que D6 rescata tras la autorización del 2026-09-30.

### D2. Actualización confirmada, no optimista — VIGENTE

**Decisión**: el estado cambia después de `await` exitoso; ante rechazo se conserva el estado previo.

**Alternativa descartada**: actualización optimista antes de la respuesta. Viola el requisito "Cambio confirmado contra el servidor".

**Justificación**: el spec exige coincidencia con la respuesta del servidor. El retardo por ación es mínimo y aceptable.

### D3. Error visible por tarjeta, sin infraestructura global — VIGENTE

**Decisión**: mensaje de error local en la tarjeta (`role="alert"`), conservando el botón previo.

**Alternativas descartadas**: mantener `console.error` (viola el requisito); un sistema global de notificaciones (excede el ticket; esa infraestructura no existe).

**Justificación**: es el cambio mínimo que satisface los dos escenarios de error sin introducir dependencias nuevas.

### D4. Reutilizar el servicio existente, sin cliente nuevo — SUPERSEDED por D6

**Decisión original**: un único manejador `handleToggle(targetId, seguido)` invoca `followUserInGraph` o `unfollowUserInGraph`; `networkApi.ts` no cambia.

**Por qué quedó superseded**: `networkApi.ts` sí cambia —gana `fetchSeguidos(userId)` (D6)—, y el manejador alterna sobre filas con bandera provista por el origen, no sobre un `Set` local. Lo que se conserva: no se crea hook `useFollow` separado; la alternancia sigue siendo presentación sobre funciones que comparten firma.

**Alternativa descartada**: un hook `useFollow` separado. Sin reutilizadores a la vista, sería anticipación innecesaria.

### D5. Identidad hardcodeada intacta — VIGENTE, riesgo rebajado

**Decisión**: el `currentUserId` por defecto sigue fijo en `App.tsx:14`; no se implementa autenticación en esta historia. **No se elimina el fijo**: está fuera de alcance.

**Riesgo rebajado, y por qué**: el commit `1053010` implementó sesión/registro real (TUX-01/TUX-52) y existe `handleUserChange`, así que el valor de `App.tsx:14` es valor por defecto/respaldo, no el único camino de identidad. Sigue siendo dependencia de cierre de US-01, pero ya no "la acción no es verificable por usuario".

**Alternativa descartada**: convertirlo en requisito de esta historia. Contradice la regla de no implementar autenticación antes de US-01 (`config.yaml`, restricción de diseño).

**Justificación**: evita expansión de alcance hacia US-01.

### D6. Segundo endpoint de seguidos + fusión en el cliente — NUEVA

**Decisión**: Opción A —endpoint separado, no agregado—. Nuevo `GET /api/users/{userId}/follows` que devuelve `List<Usuario>` (modelo de dominio existente, sin DTO nuevo). La fuente de datos de la tarjeta pasa a ser la unión de sugerencias y seguidos, fusionada en el cliente por id. Cadena exacta, siguiendo nomenclatura y estilo existentes:

| Capa | Cambio |
|---|---|
| `GestionarGrafoSocialUseCase` | añadir `List<Usuario> obtenerSeguidos(String userId);` (estilo `obtenerSugerencias`, `obtenerSeguidoresEnComun`) |
| `UserGraphApplicationService` | pass-through como `obtenerSugerencias` (líneas 62-65), cero validación |
| `GrafoPersistencePort` | añadir `List<Usuario> obtenerSeguidos(String userId);` (nomenclatura verbo-primero) |
| `Neo4jGrafoAdapter` | método nuevo con el estilo `try (var session = driver.session()) { session.executeRead(...) }`, sin try/catch ni logging; reutiliza el mapeo de fila `Usuario` de `obtenerSeguidoresEnComun` (~líneas 131-138) |
| `UserGraphResource` | `@GET @Path("/{userId}/follows")` como `@GET @Path("/{userId}/sugerencias")` (líneas 107-111): `Response.ok(useCase.obtenerSeguidos(userId)).build()`, sin try/catch |

Cypher —el más simple posible, un solo `MATCH`, sin `UNION` ni `OPTIONAL MATCH`:

```cypher
MATCH (u:Usuario {id: $userId})-[:SIGUE]->(s:Usuario)
RETURN s.id AS id, s.username AS username, s.nombre AS nombre, s.avatarUrl AS avatarUrl
```

**Contrato de fusión** (en `App.tsx`, `loadAllData`, líneas 20-33, que suma `fetchSeguidos` al `Promise.all` existente): unión por id de usuario, seguidos primero; tolerante a que el mismo id aparezca en ambas fuentes —por construcción no debería ocurrir (`Neo4jGrafoAdapter.java:74-75` excluye seguidos de las sugerencias), pero si ocurre no hay duplicados ni caída: manda la entrada de seguido. Fila de sugerencia y fila de seguido son formas distintas; el tipo de fila de la tarjeta es una forma discriminada que renderiza ambas y porta la bandera de seguimiento.

**Alternativa descartada**: endpoint agregado (sugerencias + seguidos en una respuesta). Acopla dos lecturas con semánticas distintas y rompe el estilo de un recurso por consulta que sigue `UserGraphResource`.

### D7. La bandera de seguimiento vive en la fila, no en un `Set` del cliente — NUEVA (supersede a D1)

**Decisión**: cada fila porta su bandera de seguimiento provista por su origen (sugerencia ⇒ no seguido; seguido ⇒ seguido). Ningún `Set<string>` local. Un `Set` solo-cliente no puede satisfacer el escenario de render inicial de un ya-seguido, y el estado visible se actualiza solo tras confirmación del servidor (D2).

**Justificación**: es la consecuencia directa de la causa raíz: la fuente de verdad del estado inicial debe ser el servidor (D6), no memoria de sesión del cliente.

### D8. Título y alcance honestos de la tarjeta — NUEVA

**Decisión**: la tarjeta ya no muestra solo sugerencias de segundo grado, así que su rótulo no debe decirlo. Copia decidida:

- Título: **"Tu red"**
- Subtítulo: **"Sugerencias y personas que sigues"**

**Justificación**: decir "Sugerencias" a secas sería falso para las filas de seguidos; decir solo "Seguidos" ocultaría las sugerencias. El subtítulo nombra ambas fuentes, que es exactamente el contrato de fusión de D6. Cambio solo de copia, sin lógica asociada.

## Grafo y arquitectura hexagonal

Sin cambios de esquema: `[:SIGUE]` ya se crea y borra en `Neo4jGrafoAdapter`. El añadido respeta los anillos (`domain`, `port/in`, `port/out`, `application`, `infrastructure`): puerto de entrada → servicio → puerto de salida → adaptador → recurso, sin almacenamiento nuevo ni autenticación nueva, conforme a `config.yaml`. Restricción Neo4j-only intacta: ninguna base relacional.

## Flujo de datos

```
App.tsx (loadAllData: sugerencias + seguidos en Promise.all, fusión por id, seguidos primero)
  -> UserSuggestionsCard [filas con bandera seguido, errorPorId]
       -> handleToggle: follow/unfollowUserInGraph -> POST|DELETE /users/{id}/follow/{id}
       <- éxito: actualiza bandera tras confirmación (D2, D7)
       <- fallo: fija errorPorId, conserva estado (D2, D3)
Backend lectura:
  GET /api/users/{userId}/follows -> UserGraphResource -> obtenerSeguidos
    -> UserGraphApplicationService -> GrafoPersistencePort
    -> Neo4jGrafoAdapter (MATCH -[:SIGUE]->, mapeo Usuario)
```

## Cambios de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `backend/.../domain/port/in/GestionarGrafoSocialUseCase.java` | Modificar | Declarar `obtenerSeguidos` |
| `backend/.../infrastructure/service/UserGraphApplicationService.java` | Modificar | Pass-through sin validación |
| `backend/.../domain/port/out/GrafoPersistencePort.java` | Modificar | Declarar `obtenerSeguidos` |
| `backend/.../adapter/out/neo4j/Neo4jGrafoAdapter.java` | Modificar | `MATCH -[:SIGUE]->` + mapeo `Usuario` |
| `backend/.../adapter/in/rest/UserGraphResource.java` | Modificar | `GET /{userId}/follows` |
| `backend/...` (tests JUnit 5) | Añadir | Contrato del servicio y del endpoint |
| `frontend/src/features/network/services/networkApi.ts` | Modificar | `fetchSeguidos(userId)` como `fetchSugerenciasGrafo`, axios desnudo |
| `frontend/src/features/network/types/network.types.ts` | Modificar | Tipo `Usuario` con campos del backend (`avatarUrl`, distinto de `avatar` en sugerencias) + fila discriminada con bandera |
| `frontend/src/App.tsx` | Modificar | `fetchSeguidos` en el `Promise.all` de `loadAllData`, fusión por id; `currentUserId` por defecto intacto (D5) |
| `frontend/src/features/network/components/UserSuggestionsCard.tsx` | Modificar | Render "Seguir"/"Dejar de seguir" por bandera, `handleToggle`, error `role="alert"`, botón deshabilitado en vuelo, título "Tu red" (D8); se elimina `seguidosIds` (D1 superseded) |

## Interfaces

```ts
// networkApi.ts — como fetchSugerenciasGrafo, axios desnudo
export const fetchSeguidos = async (userId: string): Promise<Usuario[]> => {
  const { data } = await api.get<Usuario[]>(`/users/${userId}/follows`);
  return data;
};
```

```ts
// network.types.ts — Usuario con nombres exactos del backend; fila discriminada
type FilaRed = { seguido: boolean } & (SugerenciaUsuario | Usuario);
```

```ts
// UserSuggestionsCard.tsx — sin seguidosIds; bandera por fila
const [errorPorId, setErrorPorId] = useState<Record<string, string | null>>({});
const [enVuelo, setEnVuelo] = useState<Record<string, boolean>>({});
```

## Verificación

Pruebas durante la implementación, no solo al final (`openspec/config.yaml:127-133`): `$MAVEN_HOME/bin/mvn test` (JUnit 5, incluye `UsuarioTest`/`PostTest` existentes) y `pnpm test` (Vitest) en cada fase que toque su capa. Cierre: `$MAVEN_HOME/bin/mvn test`, `$MAVEN_HOME/bin/mvn spotless:check` (`config.yaml:83`), `$MAVEN_HOME/bin/mvn compile`, y desde `frontend` `pnpm test` + `pnpm run build` (`config.yaml:74`). Sin `mvn` desnudo en PATH: siempre `$MAVEN_HOME/bin/mvn` (`config.yaml:15-16`).

## Matriz de amenazas

N/A — sin enrutamiento, shell, subprocesos, automatización de VCS ni integración de procesos.

## Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Recarga vía `onNetworkUpdated` reemplaza la lista | Ya no importa: los seguidos vienen del servidor (D6) y la fusión es por id en `loadAllData`; la promesa huérfana de fusión de D1 queda eliminada con el `Set` local |
| Doble clic dispara dos mutaciones | Deshabilitar el botón de la tarjeta mientras su promesa está en curso |
| Identidad por defecto (`App.tsx:14`) | Riesgo rebajado: commit `1053010` + `handleUserChange`; dependencia de cierre US-01 (D5) |
| `UserSuggestionsCard.tsx` lo tocan US-03 y US-10 | Trabajo estrictamente serial (`openspec/ROADMAP.md:80-81`); esta historia no deja el archivo en estado intermedio |
| Cypher de seguidos sin Testcontainers/Docker | Test de contrato del adaptador pendiente justificado si no hay Docker (`config.yaml:50`); el servicio y el recurso sí quedan cubiertos por unitarias |

## Diferido explícitamente

Sugerencias de segundo grado (US-03); autenticación y sesión plenas (US-01); chat, feed, reacciones, push, posts, tendencias, camino más corto (US-04 a US-11); DTO nuevo de seguido; infraestructura de notificaciones.

## Preguntas abiertas

Ninguna. La decisión de origen del estado queda cerrada por D6/D7; la copia del título por D8.
