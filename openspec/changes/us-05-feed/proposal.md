# Proposal: US-05 (TUX-55) — Feed cronológico filtrado por grafo social

> **Ticket Linear**: `TUX-55` — US-05: Chronological feed filtered by social graph (2 hops) · Sprint 2 · 5 SP · P0 Must
> **Card backlog**: `TUX-04` en `docs/backlog-programadores.md` línea 207
> **Rama**: `feature/US-05-feed-grafo`
> **Épica**: Feed Social · **Dominio canónico**: `feed-generation` · **Asignado**: Paulo Orrala / Angel Villon

## Intención

Como usuario de la red social, quiero ver en mi timeline solo las publicaciones de los usuarios que sigo,
con el total de likes y si ya reaccioné a cada una.

## Criterio de aceptación (Gherkin)

```gherkin
Dado que "carlos-patio" sigue a "beatriz" y "paulo", pero NO sigue a "david"
Cuando realiza una petición GET a "/api/feed/carlos-patio"
Entonces la respuesta contiene los posts de "beatriz" y "paulo" ordenados descendentemente por fecha
Y excluye completamente la publicación de "david"
Y calcula "totalLikes" y "likedByMe" mediante la relación [:REACCIONA].
```

## Estado real: la estructura está completa, el camino está roto

El entregable estructural de TUX-55 está entero:

| Entregable de TUX-55 | Ubicación | Estado |
|---|---|---|
| Cypher #1 obligatoria | `Neo4jGrafoAdapter:23` | **Idéntica al ticket, byte por byte** |
| `ObtenerFeedUseCase` | `application/usecase/out/` | **Completo** |
| `FeedApplicationService` | `application/service/` | **Completo** |
| Inbound `GET /api/feed/{userId}` | `FeedResource` | **Completo** |
| `fetchFeedBySocialGraph` | `feed/services/feedApi.ts:8` | **Completo** |
| `FeedList.tsx` + `PostCard.tsx` | `feed/components/` | **Completos, con avatar y badge** |

La consulta cumple las tres líneas del Gherkin: dos saltos `SIGUE`→`PUBLICA`, `count(r)` sobre
`[:REACCIONA]` para `totalLikes`, `EXISTS((u)-[:REACCIONA]->(p))` para `likedByMe`, y
`ORDER BY p.fechaCreacion DESC`.

**Y a pesar de eso, el feed devuelve 500.**

---

## El hueco H1: `asString()` sobre un entero

El Cypher proyecta `p.fechaCreacion`, y ese campo lo escribe `crearPost`:

```cypher
// Neo4jGrafoAdapter:237
fechaCreacion: datetime().epochMillis   // → un entero
```

El mapeo del feed lo lee como si fuera texto:

```java
// Neo4jGrafoAdapter:50
p.setFechaCreacion(record.get("fecha").asString());   // → lanza excepción
```

`Value.asString()` de Neo4j solo acepta valores de texto. Sobre un entero lanza `Uncoercible`, la
excepción escapa del `session.executeRead` y la petición responde **500**.

**No hay un camino donde el feed funcione.** Cualquier usuario que siga a alguien con al menos una
publicación recibe un error. El `catch` de `FeedApplicationService` no lo oculta, así que el síntoma
visible es un 500, no una lista vacía.

El `ORDER BY` sí funciona: ordena enteros sin problema. Solo la proyección rompe. Por eso el bug se
esconde tan bien — la consulta es correcta, el orden es correcto, y solo falla en el último paso.

## El hueco H2: la fecha se muestra cruda

Arreglado H1, el usuario vería `1758901234567`. `PostCard.tsx` renderiza el valor tal cual:

```tsx
<span className="text-xs text-slate-400 block">{post.fechaCreacion || 'Reciente'}</span>
```

El ticket pide "formatted date and badge support". El badge está (`• Amigo en Grafo`); la fecha formateada
no existe.

El `|| 'Reciente'` además es **código muerto**: epoch en milisegundos nunca es falsy, así que la
alternativa nunca se toma. El fallback que hace falta no es un chequeo de vacío sino de validez.

## El hueco H3: el avatar no sobrevive a una URL rota

`PostCard` renderiza `post.autorAvatar` en un `<img>` sin `onError`. Una URL de avatar inaccesible deja
el ícono de imagen rota del navegador en lugar de la inicial. Es el mismo entregable de "avatar support"
que el ticket pide, y el mismo patrón que US-03 resuelve para `sug.avatar`.

## Alcance de este change

- `Neo4jGrafoAdapter.java`: leer `fecha` como entero.
- `PostCard.tsx`: formatear la fecha y manejar el fallo de carga del avatar.
- `feed/types/post.types.ts`: reflejar que el valor es un conteo de milisegundos, no una fecha.

## Fuera de alcance

- **Cambiar el Cypher #1.** Es obligatorio y está verificado contra el ticket. Además, la causa del bug
  está en el mapeo, no en la consulta.
- **Cambiar `Post.fechaCreacion` a `long`.** Sería el tipo correcto, pero el modelo se comparte con
  US-04, US-06 y US-11, y cambiarlo propaga el ajuste a cuatro historias por un benefit de tipado que no
  cambia el comportamiento. Queda anotado como deuda.
- **`onError` en la imagen de `mediaUrl`.** Mismo patrón que H3, pero la imagen adjunta es entregable de
  US-04, no de US-05. Se resuelve junto con US-04.
- US-06 (reacciones). `togglePostLike` ya se llama desde `PostCard` y hoy falla de forma silenciosa, porque
  el endpoint es de US-06.
