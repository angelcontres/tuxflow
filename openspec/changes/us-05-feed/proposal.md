# Proposal: US-05 (TUX-55) — Feed cronológico filtrado por grafo social

> **Ticket Linear**: `TUX-55` — US-05: Chronological feed filtered by social graph (2 hops) · Sprint 2 · 5 SP · P0 Must
> **Dominio canónico**: `feed-generation`

## Intención

Como usuario de la red social, quiero ver en mi timeline solo las publicaciones de los usuarios que sigo,
con el total de likes y si ya reaccioné a cada una, con la fecha legible y el avatar degradado a la
inicial cuando la imagen falla. Y quiero que el feed refleje siempre el filtrado vigente: al dejar de
seguir a alguien, sus publicaciones desaparecen de inmediato sin que tenga que recargar la página.

## Criterio de aceptación (Gherkin)

```gherkin
Dado que "carlos-patio" sigue a "beatriz" y "paulo", pero NO sigue a "david"
Cuando realiza una petición GET a "/api/feed/carlos-patio"
Entonces la respuesta contiene los posts de "beatriz" y "paulo" ordenados descendentemente por fecha
Y excluye completamente la publicación de "david"
Y calcula "totalLikes" y "likedByMe" mediante la relación [:REACCIONA].
```

## Estado real verificado (2026-10-01)

El camino del backend **ya funciona**. Lo siguiente está resuelto y no se rehace:

- **El 500 por `asString()` está arreglado** en el commit `a20f067` (PR #11).
  `Neo4jGrafoAdapter.java:56-59` lee la fecha con `record.get("fecha").isNull() ? null : asLong()`.
  El feed ya devuelve 200.
- **`Post.fechaCreacion` ya es `Long`** (`Post.java:7`). Cambiado en el mismo commit.
- **`post.types.ts:5` ya declara `fechaCreacion: number`.**
- **`mediaUrl` ya tiene `onError`** (`PostCard.tsx:93`).

La consulta Cypher (`Neo4jGrafoAdapter.java:23-40`) cumple el Gherkin: filtra por `[:SIGUE]`,
cuenta `count(r)` sobre `[:REACCIONA]` para `totalLikes`, usa `EXISTS((u)-[:REACCIONA]->(p))` para
`likedByMe`, ordena por `p.fechaCreacion DESC` y limita a 20. No se toca.

## Problema verificado 1: la fecha no se muestra

`PostCard.tsx:76` renderiza el literal fijo `"Publicado"`. La fecha no se muestra de ninguna forma:
ni cruda ni formateada. No existe ningún helper `formatFecha`. El entregable "formatted date" del
ticket está pendiente.

## Problema verificado 2: el avatar deja un círculo vacío

El `onError` del avatar **sí existe** (`PostCard.tsx:62-64`), pero hace
`style.display = 'none'` sobre el `<img>`, dejando el círculo azul **vacío**: ni imagen ni inicial.
El hueco no es la falta de `onError`, sino la falta del fallback a la inicial (el patrón que
`UserSuggestionsCard.tsx:81-101` ya resuelve con `avatarCaido` + inicial).

## Problema verificado 3: el like no debe reconstruir el feed

`PostCard.handleLike` (`PostCard.tsx:23-35`) llama `onLikeChanged` tras confirmar la reacción, que
`FeedList.tsx` conecta a `onRefresh`, que `App.tsx` conecta a `loadAllData`. Cada like reconstruía la
lista completa de publicaciones contra el grafo: un round-trip entero para mover un contador, con el
scroll y el foco positions nueva y la oportunidad de que posts se reordenen mientras el usuario mira.

`onNetworkUpdated` de `UserSuggestionsCard` **se queda** en `loadAllData`: dejar de seguir sí debe
repedir el feed, para que los posts del usuario filtrado desaparezcan de inmediato. Esa combinación
—unfollow refresca, like no— es intencional.

Comportamiento requerido:

- Unfollow: el feed se vuelve a pedir y los posts del usuario dejado de seguir desaparecen de
  inmediato, sin esperar a que el lector recargue la página. Es el comportamiento previo a este
  change y se conserva.
- Like: el contador se actualiza en el lugar, sin pedir el feed. Si la petición falla, se revierte y
  se registra en consola.

## Alcance de este change (solo frontend)

- `App.tsx`: separar el refresco de red del refresco de feed en `loadNetwork` / `loadFeed`, compuestas
  por `loadAllData`. `onNetworkUpdated` sigue apuntando a `loadAllData`.
- `PostCard.tsx` + `FeedList.tsx` + `App.tsx`: el like actualiza el contador en el lugar, sin refetch
  del feed; se eliminan las props `onLikeChanged` / `onRefresh`, que quedan sin llamador.
- `PostCard.tsx` (+ helper nuevo): formatear `fechaCreacion` (relativo si reciente, absoluto si hace
  más de 7 días, `"Reciente"` si ausente o inválido).
- `PostCard.tsx`: el `onError` del avatar cae a la inicial en vez de ocultar la imagen.

## Fuera de alcance

- **Cambiar el Cypher o el backend.** El feed ya devuelve 200 con el filtrado correcto.
- **Cambiar `Post.fechaCreacion` de tipo.** Ya es `Long`; no hay nada que cambiar.
- **Paginación.** `LIMIT 20` es fijo y el Gherkin no la pide.
- **Materialización fan-out-on-write.** Explícitamente rechazada: no hace falta, está fuera de alcance
  y rompería los criterios de aceptación del ticket.
- **Que un usuario pagado salga de "Tu red" al dejar de seguirlo.** Se reportó como comportamiento
  inattendido, pero **no es un defecto**: es la composición exacta de dos specs ya aceptadas.
  US-02 define la fuente de la tarjeta como "la unión de sugerencias y seguidos fusionada en el
  cliente por id (seguidos primero, sin duplicados)", y US-03 define las sugerencias como contactos
  de segundo grado. Al dejar de seguir, la persona sale de `seguidos` (correcto por US-02) y sólo
  vuelve si es sugerencia de 2º grado — Cypher `Neo4jGrafoAdapter.java:77-90`, `LIMIT 5`.
  `fusionarRed` (`App.tsx:15`) cumple la regla al pie de la letra. Hacerla persistente exigiría
  inventar comportamiento que ninguna spec declara (tumbas de "dejado de seguir", o cambiar la
  regla de la unión): es producto nuevo, no US-05.
- **US-06 (reacciones).** El endpoint de `togglePostLike` pertenece a US-06. Hoy el fallo se registra
  con `console.error` y el contador optimista se revierte; ese comportamiento se conserva tal cual.
