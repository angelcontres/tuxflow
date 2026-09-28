# Proposal: US-09 (TUX-57) — Conexiones en común entre dos perfiles

> **Ticket Linear**: `TUX-57` — US-09: Followers and mutual connections between two profiles · Sprint 2 · 3 SP · P1 Should Have
> **Card backlog**: `TUX-07` en `docs/backlog-programadores.md` línea 310
> **Rama**: `feature/US-09-amigos-en-comun`
> **Épica**: Grafo / Analítica · **Dominio canónico**: `social-graph` · **Asignado**: Angel Villon / Carlos Patiño

## Intención

Como usuario que inspecciona el perfil de otro colega, quiero conocer qué personas seguimos en común para
evaluar afinidad y comunidad compartida.

## Criterio de aceptación (Gherkin)

```gherkin
Dado que "carlos-patina" y "angel-villon" siguen conjuntamente a "beatriz" y "paulo"
Cuando se consulta GET /api/users/comunes?userA=carlos-patina&userB=angel-villon
Entonces se ejecuta la consulta Cypher #3 obligatoria
Y retorna el listado de nodos Usuario correspondientes a "beatriz" y "paulo".
```

## Estado real: backend terminado, frontend inexistente

| Entregable de TUX-57 | Ubicación | Estado |
|---|---|---|
| Cypher #3 obligatoria | `Neo4jGrafoAdapter:101` | **Idéntica al ticket** |
| `obtenerSeguidoresEnComun()` en el puerto | `GrafoPersistencePort:18` | **Completo** |
| `UserGraphApplicationService` | línea 40 | **Completo** |
| Inbound `GET /api/users/comunes` | `UserGraphResource:47` | **Completo en forma** |
| **Función `fetchConexionesComunes`** | `networkApi.ts` | **No existe** |
| **Tipo de la conexión en común** | `network.types.ts` | **No existe** |
| **Modal o sección en `features/network`** | — | **No existe** |

El Cypher #3 cumple la línea obligatoria al pie de la letra, con la intersección de seguimiento en las dos
direcciones correctas: `(u1)<-[:SIGUE]-(comun)-[:SIGUE]->(u2)`, es decir, quienes ambos siguen.

**Es la primera historia del lote con el backend al 100% y el frontend al 0%.** Las cinco anteriores
venían con huecos finos; aquí no hay nada que mostrar.

---

## H1 — `nombre` se lee sin guarda, `avatar` sí, y están a una línea

```java
// Neo4jGrafoAdapter, mismo método, líneas 119 y 120
u.setNombre(record.get("nombre").asString());
u.setAvatarUrl(record.get("avatar").isNull() ? null : record.get("avatar").asString());
```

Alguien barrieró null en `avatar` y se le pasó `nombre`, una línea más arriba. La asimetría no es una opinión
estética: es la diferencia entre un campo que degrada a `null` y un campo que **rompe la petición**.

Porque el nodo puede no tener la propiedad. `guardarUsuario` hace:

```cypher
SET u.username = $username, ..., u.nombre = $nombre, ...
```

En Neo4j, **asignar `null` a una propiedad la elimina**. Y `Usuario` no valida nada, ni `registrarUsuario`
comprueba nada. Un `POST /api/users` con `{"id":"x","username":"x"}` y sin `nombre` crea un nodo sin esa
propiedad. La siguiente llamada a `/api/users/comunes` (read-only) que lo alcance hace `record.get("nombre")` sobre un
`NullValue`, `.asString()` **lanza excepción**, y el endpoint devuelve **500**.

Es la misma clase de defecto que US-05, donde `fechaCreacion` se leía con `asString()` sobre un entero. Y
el mismo patrón sin corregir sigue en `obtenerSugerencias` (línea 88), que pertenece a US-03.

## H2 — Sin `userA` ni `userB` la respuesta es una lista vacía

`obtenerSeguidoresEnComun` no valida nada:

```java
public Response obtenerSeguidoresEnComun(@QueryParam("userA") String userA, @QueryParam("userB") String userB) {
    return Response.ok(gestionarGrafoSocialUseCase.obtenerSeguidoresEnComun(userA, userB)).build();
}
```

`GET /api/users/comunes` sin parámetros devuelve `200` con `[]`. Una lista vacía tiene dos significados
indistinguibles: "no tienen conexiones en común" o "no le pasaste los parámetros". Es la misma clase de
mentira que US-04 y US-06, y se corrige con `400`.

## H3 — `userA` igual a `userB` devuelve la lista completa de seguidos

Si los dos parámetros son el mismo usuario, la intersección se resuelve sobre el mismo conjunto y el
endpoint devuelve **todos los usuarios que sigue**. No filtra nada y parece una respuesta válida.

No es una fuga de información — son sus propios seguidos — pero es una consulta sin sentido que devuelve
algo plausible. Merece un `400` en lugar de una lista que miente sobre lo que preguntaba.

## H4 — No hay forma de elegir con quién comparar

El frontend no tiene nada, y además **no hay página de perfil** donde colgarlo. `App.tsx` trabaja con un
usuario único hardcodeado. La historia necesita dos identidades y el producto todavía no tiene dónde
elegir la segunda.

## Alcance de este change

- `Neo4jGrafoAdapter.java`: guarda de null en `nombre`.
- `UserGraphResource.java`: validar `userA` y `userB`.
- `networkApi.ts` y `network.types.ts`: función y tipo de la intersección.
- `network/components/`: componente nuevo para mostrar las conexiones mutuas.

## Fuera de alcance

- **Una página de perfil.** Sería la solución natural, y es más grande que esta historia de 3 SP. El
  componente se monta donde se pueda y la elección del segundo usuario se hace con un campo explícito.
- **Editar `UserSuggestionsCard.tsx`.** US-02 y US-03 modifican ese archivo. Meter el componente ahí
  encima genera conflictos y acopla dos historias independientes. Ver `design.md`.
- **La guarda de `nombre` en `obtenerSugerencias` (línea 88).** Es el mismo defecto de una línea, pero
  pertenece a US-03. Queda anotado en `design.md` para que no se pierda.
- US-10 y US-11, que comparten el grafo.
