# US-06 — Reaccionar a publicaciones (likes idempotentes) (TUX-56)

> **Rama**: `carlosfpatino/tux-56-us-06-react-to-posts-idempotent-likes`
> **Dominio**: `post-reactions` · **TDD**: desactivado (`strict_tdd: false`, fuente `openspec/config.yaml`)
> **Tests**: obligatorios (`config.yaml` exige fase de tests).

## Objetivo

Que `POST /api/posts/{postId}/like` registre `[:REACCIONA {tipo: 'LIKE'}]` de forma **idempotente**,
que un `200` signifique reacción registrada, y que la tarjeta del feed marque el corazón al instante y
concilie el contador con el total real del servidor.

## Problema verificado

El endpoint ya existía y el `MERGE` ya era correcto, pero la capa alrededor **mentía**:

- `Neo4jGrafoAdapter.alternarLike()` hacía `tx.run(...).consume()`: si el `MATCH` no encontraba
  usuario o publicación, el resultado se descartaba en silencio y la respuesta era `200` igual. El
  cliente pintaba un corazón marcado que en el grafo no existía. Mismo defecto y misma causa que
  US-04 en `crearPost`.
- `PostResource.reaccionarPost()` no validaba `userId`: un cuerpo sin `userId` producía una relación
  `null` o un `200` sin efecto.
- El nombre `alternarLike` / `togglePostLike` describía un interruptor (like/unlike) que **la API no
  tiene**. No hay ruta para quitar likes, y el Gherkin no la pide.
- `PostCard` alternaba localmente: el segundo clic desinflaba el contador mientras el grafo seguía
  teniendo la reacción.

## Alcance autorizado

| # | Trabajo | Dónde |
|---|---|---|
| 1 | El `200` significa reacción registrada: `400` sin `userId`, `404` si no existe el objetivo | `PostResource.java`, `PostNoEncontradoException`, `DomainExceptionMapper` |
| 2 | `registrarLike()` devuelve el total real para conciliar el contador | `GrafoPersistencePort`, `Neo4jGrafoAdapter`, `PostApplicationService`, `CrearPostUseCase` |
| 3 | Like optimista idempotente con reversión y aviso visible | `PostCard.tsx`, `feedApi.ts`, `post.types.ts` |
| 4 | Renombrar lo que miente | `alternarLike`→`registrarLike`, `togglePostLike`→`likePost` |
| 5 | Pruebas de todo lo anterior | colocaladas |

## Decisiones

- **El like no es un interruptor.** Sin `Unlike` en la API, un like ya registrado no se desmarca ni se
  descuenta en pantalla: el grafo seguiría teniendo la reacción. El segundo clic reenvía la petición
  (idempotente, responde `200`) y adopta el total del servidor.
- **El servidor devuelve el total, el cliente no lo adivina.** `openspec/changes/us-05-feed/design.md`
  ya avisaba: *"si US-06 cambia su contrato (p. ej. devuelve el conteo definitivo), el like optimista
  deberá revisarse para conciliar el contador con la respuesta en vez de asumir el incremento local"*.
  Eso evita el refetch completo que US-05 eliminó a propósito.
- **Conteo dentro de la misma consulta.** El `OPTIONAL MATCH` va **después** del `MERGE` para que
  cuente la reacción recién creada. Un segundo round-trip sería una segunda fuente de verdad.
- **Clic en vuelo se ignora.** Dos peticiones simultáneas pueden llegar en orden inverso y dejar el
  contador con el valor de la más antigua. El botón se deshabilita mientras corre.
- **`PostNoEncontradoException` aparte de `AutorNoEncontradoException`.** El Cypher hace un único
  `MATCH` sobre usuario y publicación: cuando no devuelve filas no se puede saber cuál falta. Cada
  mapper se registra por su tipo concreto; un mapper de `RuntimeException` taparía además los 500.
- **El `MERGE` y el `ON CREATE SET r.fecha` no se tocan.** Son la línea obligatoria del Gherkin y ya
  eran correctos: `ON CREATE` es lo que hace que repetir el like no mueva la fecha.

## Fuera de alcance

- Quitar un like. No lo pide el Gherkin y la historia es de 2 SP.
- Notificar al autor del post. Es US-08; `[:REACCIONA]` no dispara push hoy.
- Contadores en vivo de otros usuarios mientras se mira el post.
- Índices sobre `[:REACCIONA]`. El `MERGE` ya garantiza la unicidad.

## Criterios de aceptación

- [x] Un `POST` con `userId` responde `200` y existe una sola `[:REACCIONA {tipo: 'LIKE'}]`
- [x] El `POST` repetido responde `200`, no duplica la relación y no cambia su fecha
- [x] `postId` inexistente responde `404`, no `200`
- [x] Cuerpo sin `userId`, o con `userId` en blanco, responde `400` y no crea nada
- [x] El corazón se marca al instante, sin esperar la respuesta del servidor
- [x] Con la red caída el corazón vuelve al estado anterior y se ve un mensaje
- [x] El contador pasa a ser el total que devuelve el servidor, no el incremento local

## Checks

```bash
cd backend  && mvn test
cd frontend && pnpm run check   # format:check + lint + test + build
```

## Progreso

**2026-10-02 — las 4 unidades implementadas y verificadas.**

- [x] **U1** `PostResource.reaccionarPost()` rechaza `userId` nulo/en blanco con `400`;
      `registrarLike()` propaga `PostNoEncontradoException` cuando el `MATCH` no devuelve filas, y el
      mapper la traduce a `404` sin filtrar identificadores.
- [x] **U2** `registrarLike()` devuelve `int totalLikes` leído después del `MERGE`. La respuesta
      incluye `postId`, `likedByMe` y `totalLikes`.
- [x] **U3** `PostCard.handleLike()`: optimista antes de la petición, idempotente (no desmarca),
      reversión completa ante fallo, `role="alert"` visible, botón deshabilitado en vuelo.
- [x] **U4** `alternarLike`→`registrarLike` y `togglePostLike`→`likePost`. `grep` sin referencias
      al nombre anterior.

### Evidencia de verificación (2026-10-02)

| Check | Resultado |
|---|---|
| `pnpm run check` (frontend) | **PASS** — prettier, eslint, **110 pruebas** (100 previas + 10 de US-06), `tsc` + `vite build` |
| `mvn test` (backend) | **PASS parcial** — 54 pruebas verdes (incluye `PostResourceTest`, 11 casos). **20 errores de Mockito**: los 4 tests de `Neo4jGrafoAdapter*` (3 preexistentes + el nuevo) fallan porque el inline mock maker no puede modificar clases en el JDK 25 de esta máquina. El proyecto apunta a JDK 21; en ese JDK los 3 preexistentes ya pasaban. **No verificado localmente**: `Neo4jGrafoAdapterRegistrarLikeTest` (5 casos) |
| `mvn spotless:check` | **NO EJECUTABLE** — `google-java-format` 1.24 (fijado por Spotless 2.44.0) es incompatible con el JDK 25 de esta máquina (`NoSuchMethodError` en `com.sun.tools.javac.util.Log`). Se verificó el formato AOSP a mano contra `google-java-format` 1.30 en los archivos tocados: sin diferencias de ancho de línea ni de imports sin usar |

### Pendiente

- Verificación manual en navegador y el cURL del backlog (`POST /api/posts/post-p1/like`), que
  necesitan Neo4j en `:7474` y la app en `:8080`.
- `Neo4jGrafoAdapterRegistrarLikeTest` necesita ejecutarse en JDK 21 para quedar confirmado.