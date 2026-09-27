# Design: US-06 (TUX-56) — Likes idempotentes

> **Change**: `us-06-reacciones` · **Ticket**: `TUX-56` · **Dominio**: `post-reactions`
> **Base**: el criterio de aceptación de `proposal.md`, el `MERGE` real y el flujo real de `PostCard`

## El problema de fondo

Esta historia repite exactamente el defecto de US-04, y esa repetición es el dato importante.

En US-04 el recurso informed creación de un post que no existía. En US-06 informa una reacción que no
ocurrió. En los dos casos la causa es la misma: **una escritura precedida de `MATCH` cuyo número de
filas se descarta**.

```java
MATCH (u:Usuario {id: $userId}), (p:Post {id: $postId})
MERGE (u)-[r:REACCIONA {tipo: 'LIKE'}]->(p)
```

Cero filas en el `MATCH` significa cero `MERGE`. El método retorna `void`, así que esa información se
pierde, y el recurso responde éxito por defecto en lugar de por evidencia.

Un `MATCH` seguido de escritura **debe** Say qué encontró. Si no lo dice, el que llama está adivinando.

---

### D1 — Que `alternarLike` reporte si creó la relación

El puerto cambia de `void` a `boolean`, y el adaptador devuelve si el `MERGE` creó una relación nueva en
vez de encontrar una existente. `PostResource` responde `404` cuando devuelve `false`.

La distinción importa por la idempotencia: un `MERGE` que encuentra la relación ya existente no crea
nada, y eso **no es un error**. Es el comportamiento correcto del segundo clic. Por eso la respuesta
distingue "no se pudo" de "ya estaba": el `404` es para un post o usuario inexistente, no para un like
repetido.

**Alternativa descartada**: responder `409` cuando ya existe. Se descartó porque obligaría al cliente a
distinguir dos casos que para el usuario son idénticos, y porque el `MERGE` ya garantiza la unicidad: la
segunda escritura es un no-op silencioso y correcto.

**Consecuencia**: es el mismo cambio de firma que US-04 aplica sobre `crearPost`, en el mismo puerto de
salida. Se aplican en secuencia y no se solapan: métodos distintos, líneas distintas.

### D2 — Validar `userId` en el borde

`reaccionarPost` rechaza un `userId` nulo, vacío o solo espacios con `400`, con `String.isBlank()` y el
mismo criterio de US-04. Sin esto, un cuerpo vacío se confunde con un like válido y devuelve el mismo
`200`.

**Consecuencia**: el `404` de D1 pasa a significar de verdad "el post o el usuario no existen", porque ya
no puede ser disparado por un cuerpo vacío.

### D3 — Actualización optimista con reversión

`PostCard` mantiene su propia versión de `likedByMe` y `totalLikes` en estado local. Al hacer clic:

1. Se aplica el cambio local de inmediato.
2. Se dispara la petición.
3. Si la petición falla, se revierte el cambio local y se muestra un mensaje.

El refetch completo se conserva **después** de la petición, no antes. Así la UI responde al instante y
además se reconcilia con el conteo real del servidor, que puede incluir likes de otros usuarios.

**El detalle que no es obvio**: `PostCard` recibe `post` por prop desde `FeedList`, así que no puede
modificar el objeto. El estado local se inicializa desde la prop, y eso obliga a re-sincronizar cuando la
prop cambie. Sin ese re-sincronizado, un estado local inicializado desde props queda congelado en el
primer valor y el contador se vuelveliese obsoleto después del refetch: el arreglo del bug H4
introduciría un bug nuevo.

**Consecuencia**: un fallo de red deja la UI como estaba y avisa, en vez de tragarse el clic en un
`console.error`.

### D4 — Renombrar el método para que diga lo que hace

`alternarLike` pasa a `registrarLike` y `togglePostLike` pasa a `likePost`. Cuatro archivos, sin cambio de
comportamiento.

No es cosmetiquería. Un método que se llama `toggle` y no alterna es una trampa para quien llegue
después: alguien va a llamarlo esperando poder quitar un like, va a ver que no pasa nada, y va a perder
tiempo buscando el endpoint que nunca existió. El nombre es parte del contrato aunque no haya
interfaz.

**Consecuencia**: si más adelante se agrega la capacidad de quitar el like, el nombre vuelve a ser cierto
y el cambio queda local. Hoy deja de mentir.

---

## Riesgo residual

El refetch de fondo de D3 depende de `GET /api/feed/{userId}`, que hoy devuelve 500 por el defecto de
US-05. **US-05 debe aplicarse antes que US-06**, aunque el roadmap liste US-06 antes. Sin US-05, el
optimismo funciona y la reconciliación no.

`MERGE` no lleva un índice ni una restricción de unicidad sobre `(u)-[:REACCIONA {tipo:'LIKE'}]->(p)`.
La idempotencia la garantiza el propio `MERGE` de Cypher, que es correcto y está respaldado por el
modelo de datos. Con escrituras concurrentes sobre el mismo par, `MERGE` puede pedir un lock y
reintentar, así que el riesgo es bajo. No se agrega un índice porque el `MERGE` no lo necesita y agregarlo
sería optimizar sin evidencia.

La capacidad de quitar un like no existe y no se agrega. Con el `MERGE` unidireccional, un usuario que
se arrepiente de un like no tiene forma de corregirlo. Es una limitación real del producto, no un bug de
esta historia, y el Gherkin no la pide. Queda anotada para cuando la pidan.
