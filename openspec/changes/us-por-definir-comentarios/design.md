# Design: US (por definir) — Comentarios en publicaciones

> **Change**: `us-por-definir-comentarios` · **Dominio**: `comments`
> **Base**: el criterio de aceptación de `proposal.md`, el patrón de US-06 (reacciones idempotentes)
> y el modal de `GraphExplorerModal`.

## El problema de fondo

Un comentario es contenido que cuelga de una publicación y que a su vez recibe reacciones. El error
caro aquí no es olvidar un endpoint, es **modelarlo como una tabla plana con un `postId` en texto** y
luego reproducir el grafo a mano en cada consulta. El proyecto es Neo4j-only (`config.yaml`), así que
el comentario se modela como nodo unido al post por una relación, y su autor por otra, igual que
`[:PUBLICA]` y `[:REACCIONA]`.

## Modelo de grafo

```
(:Usuario)-[:COMENTA]->(:Comentario)-[:COMENTA_EN]->(:Post)
(:Usuario)-[:REACCIONA {tipo:'LIKE'}]->(:Comentario)
```

El nodo `:Comentario` guarda `{id, texto, fechaCreacion, parentId}`. `parentId` es `null` en un
comentario de primer nivel y el id del comentario padre en una respuesta. Se guarda como propiedad
(y no como relación `[:RESPONDE_A]`) porque también viaja en la respuesta JSON y el cliente agrupa con
él; tenerlo en el nodo evita un `OPTIONAL MATCH` sólo para reconstruir un campo.

Constraint nuevo en el seed: `unique_comentario_id` sobre `:Comentario.id`, junto a los de usuario y
post.

## D1 — Reutilizar `[:REACCIONA]` para los likes de comentario

**Decisión**: los likes de un comentario son `(u:Usuario)-[:REACCIONA {tipo:'LIKE'}]->(c:Comentario)`,
el mismo tipo de relación que ya usan los posts.

**Por qué**: `REACCIONA` ya significa "un usuario reacciona a contenido"; el tipo de nodo destino
distingue el objetivo. Todas las consultas existentes de posts están **tipadas** al label `:Post`
(`MATCH ... (p:Post {id: $postId})`, feed, tendencias, retirada), así que una relación con
`:Comentario` no puede colarse en esos conteos. Duplicar el tipo (`[:LIKE_COMENTARIO]`) sería una
segunda forma de decir lo mismo y obligaría a recordar cuál toca en cada consulta.

**Alternativa descartada**: guardar el like como propiedad booleana del comentario. Impide contar
varios likes y no sobrevive a "quién dio like".

## D2 — Un solo nivel de respuestas, con `parentId` validado contra el post

**Decisión**: una respuesta apunta a un comentario **de primer nivel del mismo post**. Se rechaza
responder a una respuesta.

**Por qué**: Instagram web sólo anida un nivel; permitir anidación libre obliga al cliente a pintar
árboles y al backend a decidir profundidades. Validar que el padre existe y pertenece al post evita
el fallo silencioso de colgar una respuesta de un comentario de otra publicación: la respuesta se
crearía y jamás se vería en el hilo.

**Alternativa descartada**: aplanar respondiendo a respuestas y prefijar el texto con `@autor`.
Traslada al servidor la decisión de producto y ensucia el texto guardado.

## D3 — Creación en dos pasos dentro de una transacción, con honestidad de errores

**Decisión**: `crearComentario` corre en `executeWrite` dos consultas: una de validación (¿existe
autor?, ¿existe post?, ¿el padre es válido?) y, sólo si pasa, la de creación con `RETURN`.

**Por qué**: un solo Cypher con `WHERE $parentId IS NULL OR EXISTS(...)` no distingue por qué no
creó nada. Todos los errores de dominio responden el mismo 404 genérico, pero el tipo de excepción es
lo que las pruebas verifican y lo que hace legible un log. Con dos consultas el código dice
explícitamente qué comprobó.

**Alternativa descartada**: `MERGE` del comentario. Un comentario no es idempotente: dos envíos son
dos comentarios.

## D4 — El POST devuelve el comentario completo

**Decisión**: `POST /api/posts/{postId}/comentarios` responde `201` con el `Comentario` creado
(autor, fecha, `parentId`, totales en cero), no sólo el id.

**Por qué**: el modal necesita pintarlo al instante con nombre y avatar. Devolver sólo el id obliga a
una segunda lectura o a un `fetch` completo del hilo; ambas son una vuelta de red evitable cuando la
consulta de creación ya tiene el `:Usuario` en la mano.

## D5 — Likes optimistas con reversión, igual que `PostCard`

**Decisión**: el corazón del comentario sube el contador al instante, llama al servidor y asignala
respuesta (`totalLikes`, `likedByMe`); si falla, revierte a la foto previa y muestra el error.

**Por qué**: es el patrón ya probado de likes en `PostCard`, y el mismo requisito de idempotencia
repetir el like no duplica. Un flag por comentario en vuelo evita dos clics en orden inverso.

## D6 — El modal no usa `createPortal`

**Decisión**: se renderiza en el árbol, condicionado por el estado de `App`, como
`GraphExplorerModal`.

**Por qué**: es el patrón existente; introducir portales para un solo modal añade una técnica nueva
sin resolver nada que el `fixed inset-0 z-50` no resuelva ya.

## Riesgo residual

- El tope de 500 comentarios no pagina; con un hilo mayor se recorta en silencio. Se documenta como
  el mismo compromiso que el tope de 200 publicaciones por perfil, y la respuesta correcta cuando se
  vea es paginar.
- Los likes de comentario no notifican. Es alcance explícito, no un olvido.
