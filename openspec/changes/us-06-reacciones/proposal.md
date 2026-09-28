# Proposal: US-06 (TUX-56) — Reaccionar a publicaciones con likes idempotentes

> **Ticket Linear**: `TUX-56` — US-06: React to posts (idempotent likes) · Sprint 2 · 2 SP · P1 Should Have
> **Card backlog**: `TUX-05` en `docs/backlog-programadores.md` línea 243
> **Rama**: `feature/US-06-reacciones-likes`
> **Épica**: Contenido / Interacciones · **Dominio canónico**: `post-reactions` · **Asignado**: Carlos Patiño

## Intención

Como lector del feed, quiero dar "Me gusta" a cualquier publicación, actualizando la relación
`[:REACCIONA {tipo: 'LIKE'}]` de forma idempotente y reflejando el conteo de inmediato en pantalla.

## Criterio de aceptación (Gherkin)

```gherkin
Dado un post existente "post-b1"
Cuando el usuario envía POST /api/posts/post-b1/like con {"userId": "carlos-patino"}
Entonces se ejecuta MERGE (u)-[r:REACCIONA {tipo: 'LIKE'}]->(p)
Y el contador de likes en la UI cambia de estado a marcado (color rojo/corazón activo).
```

## Estado real: el MERGE es correcto, todo lo alrededor no

| Entregable de TUX-56 | Ubicación | Estado |
|---|---|---|
| `MERGE` idempotente | `Neo4jGrafoAdapter:252` | **Correcto** |
| Inbound `POST /{postId}/like` | `PostResource:34` | **Completo en forma, no en contenido** |
| `Neo4jGrafoAdapter.alternarLike()` | línea 252 | **Existe, no confirma nada** |
| Corazón rojo y estado marcado | `PostCard.tsx` | **Completo** |
| **Actualización optimista** | `PostCard.handleLike` | **Ausente** |

El `MERGE` cumple la primera línea del Gherkin al pie de la letra, con `ON CREATE SET r.fecha` para que
reintentar no pise la fecha original. Esa parte está bien hecha. Y el corazón rojo que pide la segunda
línea también está: `PostCard` ya pinta `fill-rose-500` y `bg-rose-50` cuando `likedByMe` es cierto.

El problema es que nada entre el clic y la base de datos se comporta como debe.

---

## H1 — El endpoint reporta una reacción que no ocurrió

```java
// Neo4jGrafoAdapter:252
MATCH (u:Usuario {id: $userId}), (p:Post {id: $postId})
MERGE (u)-[r:REACCIONA {tipo: 'LIKE'}]->(p)
```

Cypher es orientado a filas. Si el post o el usuario no existen, el `MATCH` devuelve cero filas, el `MERGE`
no crea nada, y `alternarLike` retorna `void` sin decir nada. `PostResource` responde:

```java
return Response.ok(Map.of("mensaje", "Reacción registrada")).build();
```

Un `200` con "Reacción registrada" sobre una reacción que nunca existió. Es **el mismo defecto que en
US-04**: una escritura precedida de `MATCH` cuyo número de filas nunca se comprueba. Es la tercera
aparición del patrón en el repositorio.

## H2 — `userId` no se valida y un `null` también produce un éxito

`reaccionarPost` hace `body.get("userId")` y lo pasa directo. Sin `userId`, el parámetro viaja nulo, el
`MATCH` no encuentra a nadie, y el resultado es el mismo `200` mentiroso de H1. Un cuerpo vacío se
confunde con un like válido.

## H3 — El nombre promete un toggle; el código solo agrega

Tres nombres mienten en la misma dirección:

- `GrafoPersistencePort.alternarLike()` — "alternar" significa conmutar
- `PostApplicationService.reaccionarPost()` — "reaccionar" es neutro, este sí
- `feedApi.togglePostLike()` — "toggle" significa conmutar

Pero el `MERGE` es de una sola dirección. **No existe ninguna forma de quitar un like**: no hay `DELETE`,
no hay un endpoint contrario, no hay un `REMOVE` en ningún Cypher del repositorio. Verificado con grep
sobre todo el árbol.

El Gherkin pide idempotencia, y el `MERGE` la cumple. El código está bien; el nombre es lo que sugiere
una capacidad que no existe, y es exactamente el tipo de cosa que hace que un compañero intente usarla
como toggle.

## H4 — No hay actualización optimista

El backlog pide literalmente *"Actualización optimista de UI (`likedByMe` y `totalLikes + 1`)"*. Lo que
hay es lo contrario:

```tsx
const handleLike = async () => {
  try {
    await togglePostLike(post.id, currentUserId);   // espera la red
    onLikeChanged();                                 // refetch completo del feed
  } catch (err) {
    console.error('Error al dar like:', err);        // invisible
  }
};
```

La UI no se mueve hasta que la promesa resuelve, y resolver dispara `loadAllData()`, que vuelve a pedir
el feed entero. Cada like cuesta un round-trip del feed completo. Y el fallo se traga en un
`console.error`: el usuario hace clic, la red falla, y no pasa absolutamente nada visible.

Vale la pena notar el orden de las dependencias: hoy ese refetch llama a `GET /api/feed/{userId}`, que
devuelve 500 por el bug de US-05. **El botón de like no puede funcionar hasta que US-05 esté aplicada.**

## Alcance de este change

- `PostResource.java`: validar `userId` y responder con error honesto.
- `GrafoPersistencePort.java`, `PostApplicationService.java`, `Neo4jGrafoAdapter.java`: que `MERGE` confirme
  que creó algo, y renombrar el método para que deje de mentir.
- `PostCard.tsx`: actualización optimista con reversión y error visible.
- `feedApi.ts`: renombrar la función para que deje de mentir.

## Fuera de alcance

- **Quitar un like.** El Gherkin no lo pide y la historia es de 2 SP. El `MERGE` unidireccional es
  correcto según la especificación. Se documenta el nombre, se arregla el nombre, y la capacidad de
  quitar queda para cuando alguien la pida.
- **Notificar al autor.** US-08, y el `[:REACCIONA]` no dispara push hoy.
- **Cambiar el `MERGE`.** Es la línea obligatoria del Gherkin y ya es correcta.
- El conteo en vivo de likes de otros usuarios mientras se mira el post. El refetch de fondo lo resuelve
  en la siguiente carga, no en tiempo real.
