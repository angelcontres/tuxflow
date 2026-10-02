# Proposal: US-05 (TUX-55) — Feed cronológico filtrado por grafo social

> **Ticket Linear**: `TUX-55` — US-05: Chronological feed filtered by social graph (2 hops) · Sprint 2 · 5 SP · P0 Must
> **Dominio canónico**: `feed-generation`

## Intención

Como usuario de la red social, quiero ver en mi timeline solo las publicaciones de los usuarios que sigo,
con el total de likes y si ya reaccioné a cada una, con la fecha legible y el avatar degradado a la
inicial cuando la imagen falla. Y quiero que dejar de seguir a alguien **no me arranque de la pantalla**
las publicaciones que ya estoy leyendo.

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

## Problema verificado 3 (nuevo requisito): dejar de seguir vacía el feed en pantalla

`App.tsx:74-88` define `loadAllData`, que refresca feed + sugerencias + seguidos en un solo
`Promise.all` y termina en `setPosts(feedData)`. `App.tsx:164` pasa ese mismo `loadAllData` como
`onNetworkUpdated` a `UserSuggestionsCard`, que lo invoca tras cada unfollow
(`UserSuggestionsCard.tsx:40`).

Consecuencia: dejar de seguir a alguien reconstruye el feed **de inmediato**, y los posts del usuario
dejado de seguir desaparecen de la pantalla sin que el lector haya pedido recargar nada. Es un efecto
secundario de compartir la función de refresco, no una decisión de producto.

Comportamiento requerido:

- Tras dejar de seguir, los posts ya renderizados **siguen visibles** hasta la próxima carga del feed.
- En la próxima carga (remontaje, recarga o nueva petición al feed), esos posts **ya no aparecen**,
  porque el backend sigue filtrando por el grafo.
- Es un cambio de **desacople de refetch en el cliente**. El backend no se toca, el Cypher no cambia.
  El Gherkin ("excluye completamente la publicación de david") sigue siendo VERDADERO: lo que cambia es
  **cuándo** se aplica el cambio, no lo que devuelve la API.

Consecuencia obligada: `PostCard.handleLike` (`PostCard.tsx:21-34`) llama `onLikeChanged`, que
`FeedList.tsx:33` conecta a `onRefresh`, que `App.tsx:152` conecta al mismo `loadAllData`. Si solo se
desacopla el unfollow, dar like a un post de un usuario recién dejado de seguir lo haría desaparecer
en mitad del clic. **El camino del like debe desacoplarse también**, refrescando el contador en el
lugar en vez de reconstruir el feed.

## Alcance de este change (solo frontend)

- `App.tsx`: separar el refresco de red del refresco de feed; el unfollow actualiza la red sin
  reconstruir los posts.
- `PostCard.tsx` + `FeedList.tsx` + `App.tsx`: el like actualiza el contador en el lugar, sin refetch
  del feed.
- `PostCard.tsx` (+ helper nuevo): formatear `fechaCreacion` (relativo si reciente, absoluto si hace
  más de 7 días, `"Reciente"` si ausente o inválido).
- `PostCard.tsx`: el `onError` del avatar cae a la inicial en vez de ocultar la imagen.

## Fuera de alcance

- **Cambiar el Cypher o el backend.** El feed ya devuelve 200 con el filtrado correcto.
- **Cambiar `Post.fechaCreacion` de tipo.** Ya es `Long`; no hay nada que cambiar.
- **Paginación.** `LIMIT 20` es fijo y el Gherkin no la pide.
- **Materialización fan-out-on-write.** Explícitamente rechazada: no hace falta, está fuera de alcance
  y rompería los criterios de aceptación del ticket.
- **US-06 (reacciones).** El endpoint de `togglePostLike` pertenece a US-06. Hoy el fallo se registra
  con `console.error` y el contador optimista se revierte (`PostCard.tsx:29-32`); ese comportamiento se
  conserva tal cual.
