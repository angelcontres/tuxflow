# US-06 bis — Dislikes y retirada de reacciones (TUX-68)

> **Rama**: misma de TUX-56 (`carlosfpatino/tux-56-us-06-react-to-posts-idempotent-likes`)
> **Dominio**: `post-reactions` · **TDD**: desactivado (`strict_tdd: false`, fuente `openspec/config.yaml`)
> **Tests**: obligatorios.

## Objetivo

Tratar los dislikes **simétricamente** con los likes sobre el modelo de persistencia actual, y poder
**retirar** cualquier reacción. El usuario que se equivocaba al dar like no tenía forma de
corregirse: la API no tenía ruta para deshacerlo.

## Decisión de alcance (user, 2026-10-03)

El ticket TUX-68 propone `LIKES`/`DISLIKES` como relaciones separadas y `likeCount`/`dislikeCount`
denormalizados en el nodo. **Descartado**, con el modelo actual tal cual:

- **Se mantiene `REACCIONA {tipo: 'LIKE'|'DISLIKE'}`.** El grafo tiene 3 reacciones con ese tipo.
  Renombrar a dos tipos de relación es migración de datos + tocar todos los Cypher + reescribir el
  Gherkin de TUX-06, que exige `MERGE (u)-[r:REACCIONA {tipo: 'LIKE'}]->(p)`.
- **Se mantiene `count(r)` en vez de contadores denormalizados.** Verificado: `SET p.likeCount =
  p.likeCount + 1` sobre un nodo sin la propiedad devuelve `NULL`, no `1`. Sin migración de
  inicialización, el contador quedaría `NULL` en silencio y el feed mostraría números falsos.
- **Se mantiene `MERGE`** para registrar (idempotencia) y se agrega `DELETE` para retirar.

El "simétrico" se cumple sobre las relaciones existentes: dislike/undislike son el espejo exacto de
like/unlike.

## Problema verificado

Sin ruta de retirada, `PostCard` no puede desmarcar: el segundo clic reenvía el like y el corazón
sigue marcado. Comprobado con 7 intentos contra el stack levantado:

| Intento | Resultado |
|---|---|
| `DELETE /posts/{id}/like` | 405 |
| `POST /posts/{id}/unlike` | 404 |
| `POST /posts/{id}/dislike` | 404 |
| `POST /like` con `{"liked": false}` | **200** "Reacción registrada", `likedByMe: true` |

Ese último caso es una mentira activa: el endpoint lee **solo** `userId` e ignora el resto del cuerpo.

## Riesgo principal: el feed queda mintiendo al agregar dislikes

Nada de esto es una degradación, es una corrección obligatoria. Al existir `DISLIKE`, tres consultas
pasan a estar mal **sin dar ningún error**:

| Línea | Consulta | Defecto |
|---|---|---|
| `Neo4jGrafoAdapter.java:30` + `:38` | `count(r) AS totalLikes` | Suma likes + dislikes |
| `Neo4jGrafoAdapter.java:39` | `EXISTS((u)-[:REACCIONA]->(p)) AS likedByMe` | Un dislike marca el corazón |
| `Neo4jGrafoAdapter.java:626-627` | `count(reaccion) AS totalLikes` | Igual, dentro de `registrarLike` |

Las tres deben filtrar `{tipo: 'LIKE'}`. Sin eso, el contador del feed muestra `3` cuando hay `2`
likes y `1` dislike, y `likedByMe` responde `true` a quien sólo dio dislike.

## Alcance autorizado

| # | Trabajo | Dónde |
|---|---|---|
| 1 | Filtrar por `tipo:'LIKE'` el conteo y el `EXISTS` del feed y de `registrarLike` | `Neo4jGrafoAdapter` |
| 2 | `registrarDislike` / `retirarLike` / `retirarDislike` en el puerto de salida | `GrafoPersistencePort`, `Neo4jGrafoAdapter` |
| 3 | Casos de entrada y servicio | `CrearPostUseCase`, `PostApplicationService` |
| 4 | Rutas `POST /dislike`, `DELETE /like`, `DELETE /dislike` | `PostResource` |
| 5 | Feed expone `totalDislikes` y `dislikedByMe` | `Neo4jGrafoAdapter`, `Post` |
| 6 | Botón de dislike con la misma lógica optimista, reconciliación y reversión | `PostCard.tsx`, `feedApi.ts`, `post.types.ts` |
| 7 | Pruebas de todo lo anterior | colocaladas |

## Fuera de alcance

- **Renombrar la relación** a `LIKES`/`DISLIKES`, y **contadores denormalizados**. Ver la decisión.
- **Mutualidad like/dislike.** El ticket no la pide y ninguna spec la declara. Dar dislike a un post
  que ya tiene tu like deja **ambos** registros; el feed mostrará `likedByMe` y `dislikedByMe` en
  `true` a la vez. Es una decisión de producto pendiente, no un defecto de esta historia.
- **Tendencias.** `obtenerTendenciasRedExtendida` (`:301-303`) cuenta `REACCIONA` sin filtro de tipo,
  así que los dislikes entran en el ranking. Ya tiene deuda documentada en `openspec/ROADMAP.md`
  ("Conteo de tendencias multiplica por caminos", US-11). Se anota, no se toca.
- **Notificar al autor**. Es US-08.

## Criterios de aceptación

- [ ] `POST /{id}/dislike` registra `REACCIONA {tipo:'DISLIKE'}` y responde `200` con `totalDislikes`
- [ ] Repetir el dislike es idempotente: una sola relación, misma fecha, `200`
- [ ] `DELETE /{id}/like` borra la relación y devuelve `likedByMe: false` con el total recalculado
- [ ] `DELETE /{id}/dislike` borra la relación y devuelve `dislikedByMe: false`
- [ ] `DELETE` de una reacción que no existe responde `200` con `likedByMe: false` (idempotente)
- [ ] `DELETE` sobre post o usuario inexistente responde `404`
- [ ] **El feed NO cuenta dislikes dentro de `totalLikes`**
- [ ] **`likedByMe` es `false` para quien sólo dio dislike**
- [ ] La UI permite dar y quitar like, y dar y quitar dislike, con reversión ante fallo
- [ ] Like y dislike son excluyentes: registrar uno borra el contrario en la misma transacción

## Checks

```bash
source ~/.local/opt/activate-jdk21.sh
export PATH="$HOME/.local/opt/apache-maven-3.9.6/bin:$PATH"

cd backend  && mvn verify          # tests + spotless + spotbugs
cd frontend && pnpm run check      # format:check + lint + test + build
```

El `java` del PATH es el 25 y **no** sirve: el proyecto apunta a JDK 21.

## Progreso

**2026-10-03 — implementado y verificado contra Neo4j real.**

- [x] U1 consultas del feed y `registrarLike` filtradas por `tipo:'LIKE'`
- [x] U2 puerto de salida + adaptador: dislike, retirar like, retirar dislike
- [x] U3 casos de entrada, servicio y rutas REST
- [x] U4 feed expone `totalDislikes` / `dislikedByMe`
- [x] U5 frontend: dislike con la misma lógica que like
- [x] U6 pruebas backend y frontend

### Evidencia (ejecutada, no reportada)

| Check | Resultado |
|---|---|
| `mvn verify` (JDK 21) | **PASS** — 95 pruebas, 0 fallos, incluye spotless y spotbugs |
| `pnpm run check` | **PASS** — prettier, eslint, **115 pruebas**, `tsc` + `vite build` |
| Feed con 3 likes + 2 dislikes mezclados | **PASS** — `totalLikes: 3`, `totalDislikes: 2`, correctos por separado |

### El `count(DISTINCT ...)` no es defensivo, es obligatorio

Dos `OPTIONAL MATCH` encadenados sobre el mismo `p` **multiplican filas**. Medido sobre `post-b1`
con 3 likes y 2 dislikes:

```
sin_distinct, con_distinct, dislikes
6, 3, 2
```

Sin `DISTINCT`, `count(rl)` daría **6** likes cuando hay **3**. Sin ningún error: un número falso.

### BUG CORREGIDO: el 404 de TUX-06 nunca funcionó

``registrarLike` (y ahora `registrarDislike`) no podían detectar usuario/post inexistente:

```cypher
MATCH (u:Usuario {id: 'fantasma'}), (p:Post {id: 'no-existe'})
RETURN count(*) AS conteo;
→ 1 fila con valor 0
```

En Cypher, una **agregación sin clave de agrupamiento devuelve UNA fila con cero cuando el MATCH no
produce filas**, no cero filas. Por eso `result.hasNext()` es siempre `true` y la guarda
`if (!result.hasNext()) throw new PostNoEncontradoException(...)` era **código muerto**.

Verificado en vivo antes del arreglo:

```
POST /api/posts/post-inexistente/like
→ 200 {"likedByMe":true,"totalLikes":0,"mensaje":"Reacción registrada"}
```

El arreglo es un centinela explícito: `RETURN count(reaccion) AS totalLikes, count(p) AS
encontrados`. `count(p)` vale 0 sólo cuando el MATCH no encontró nada. Después del arreglo, en vivo:

```
POST /api/posts/post-inexistente/like    → 404 {"error":"El recurso indicado no existe"}
POST /api/posts/post-inexistente/dislike → 404 {"error":"El recurso indicado no existe"}
POST /api/posts/post-b1/like (usuario fantasma) → 404
```

**Por qué el test unitario no lo detectó:** el mock fijaba `hasNext() = false`, es decir, codificaba
la suposición equivocada en vez de reproducir lo que el driver hace. El test, el código y el mock
concordaban entre sí y ninguno tocaba la realidad. Los mocks de esas dos pruebas se corrigieron para
reproducir el comportamiento real del driver (`hasNext()` siempre `true` + centinela en cero), y se
separó `resultadoSinFilas()` (consulta sin agregación, como el feed) de `resultadoVacio()` (consulta
con agregación).

### Mutualidad like/dislike — implementada (2026-10-03)

Like y dislike son **mutuamente excluyentes** por par (usuario, post). Registrar uno borra el
contrario **en la misma transacción**; retirar uno no toca el otro.

El `DELETE` de la reacción contraria va en el Cypher, no en el servicio: si el borrado fuera un
segundo `tx.run` aparte, un fallo entre medio dejaría la reacción opuesta viva junto a la nueva.

Cypher de registro (el de dislike es el espejo con `'DISLIKE'` y los tipos cruzados):

```cypher
MATCH (u:Usuario {id: $userId}), (p:Post {id: $postId})
MERGE (u)-[r:REACCIONA {tipo: 'LIKE'}]->(p)
ON CREATE SET r.fecha = timestamp()
WITH u, p
OPTIONAL MATCH (u)-[d:REACCIONA {tipo: 'DISLIKE'}]->(p)
DELETE d
WITH p
OPTIONAL MATCH (p)<-[rl:REACCIONA {tipo: 'LIKE'}]-(:Usuario)
OPTIONAL MATCH (p)<-[rd:REACCIONA {tipo: 'DISLIKE'}]-(:Usuario)
RETURN count(DISTINCT rl) AS totalLikes, count(DISTINCT rd) AS totalDislikes, count(p) AS encontrados
```

**Las cuatro operaciones devuelven el estado completo** (`totalLikes` + `totalDislikes`) mediante el
`record EstadoReaccion`. Eso **elimina la limitación D1**: la respuesta ya no trae "sólo mi mitad", así
que `PostCard` reconcilia las cuatro piezas sin guardas `typeof` y el contador ya no queda en el
decremento optimista.

### Comportamiento verificado en vivo (usuario `carlos-patino`, `post-b1`)

| Paso | Respuesta | Grafo |
|---|---|---|
| Estado inicial | `likedByMe: true`, `L=3 D=0` | 1 LIKE de carlos |
| `POST /dislike` | `likedByMe: false`, `dislikedByMe: true`, `L=2 D=1` | **sólo DISLIKE** — el LIKE desapareció |
| Feed | `likedByMe: false`, `dislikedByMe: true`, `L=2 D=1` | — |
| `POST /like` | `likedByMe: true`, `dislikedByMe: false`, `L=3 D=0` | **sólo LIKE** — el DISLIKE desapareció |
| Like ×2 más | `L=3 D=0` estable | 1 relación, idempotente |
| `POST /post-inexistente/like` | **404** | el centinela `count(p)` sigue funcionando |
| `POST /post-b1/like` sin `userId` | **400** | — |

### Verificación del frontend

`PostCard` tiene un único `handleReaccion(tipo)`. El efecto cruzado se aplica **antes** de esperar la
respuesta, y la reversión restaura las cuatro piezas desde una foto previa.

Tests que lo cubren (`PostCard.test.tsx`, 22 en verde, 5 de mutualidad):

- `dar dislike con el like activo desmarca el corazón y mueve ambos contadores`
- `dar like con el dislike activo desmarca el dislike y mueve ambos contadores`
- **`el efecto cruzado se ve al instante, sin esperar al servidor`** — con la petición pendiente
  (Promise sin resolver), el corazón pasa a `aria-pressed="false"` y su contador de 6 a 5, mientras el
  dislike queda en `aria-pressed="true"` con 1. Es el criterio pedido: el corazón se desmarca aunque el
  servidor todavía no respondió.
- `la reconciliación adopta ambos totales del servidor`
- `si el cruce falla, ambas mitades vuelven a su estado previo`

**Limitación de esta verificación:** es a nivel de DOM con jsdom (`@testing-library/react`), no en un
navegador real. No hay chromium ni playwright en esta máquina. Queda pendiente el clic a mano.

### Limitación conocida: la retirada no reconcilia el contador

Resuelta con la mutualidad. `unlikePost` / `undislikePost` ahora sí devuelven ambos totales, así que
`PostCard` los adopta directamente y el contador deja de depender del decremento optimista.

### Desviación consciente del plan

`DELETE /{postId}/like` sobre post o usuario inexistente responde **200 con `false`**, no 404, porque
no hay nada que borrar. Es idempotente y coherente, pero contradice el criterio escrito arriba. Se
documenta en vez de ocultarse.

### Pendiente

- **Tendencias**: `obtenerTendenciasRedExtendida` (`:301-303`) cuenta `REACCIONA` sin filtro de tipo,
  así que los dislikes entran al ranking. Deuda ya documentada en `openspec/ROADMAP.md` (US-11).
- **Verificación de navegador**: los botones se probaron por API y por test, no a mano en el browser.