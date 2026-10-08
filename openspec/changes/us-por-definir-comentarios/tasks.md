# Tasks: US (por definir) — Comentarios en publicaciones

> **Dominio**: `comments` · **Estrategia de entrega**: `single-pr` · **Límite de revisión**: 800 líneas
> **Depende de**: US-04 (el `:Post` existe) y US-06 (patrón de likes idempotentes).

**Archivos a crear**: `Comentario.java`, `EstadoComentario.java`, `ComentarioNoEncontradoException.java`,
`GestionarComentariosUseCase.java`, `ComentarioApplicationService.java`, `ComentarioResource.java`,
`ComentariosModal.tsx`, `comentarioApi.ts`, tests.
**Archivos a modificar**: `GrafoPersistencePort.java`, `Neo4jGrafoAdapter.java`,
`DomainExceptionMapper.java`, `docker/neo4j-seed.cql`, `PostCard.tsx`, `FeedList.tsx`,
`PerfilAjeno.tsx`, `App.tsx`, `post.types.ts`, `post.types` tests.

## Orden

```
B1 ──▶ B2 ──▶ B3 ──▶ B4 ──▶ B5
                             │
F1 ──▶ F2 ──▶ F3 ──▶ F4 ─────┴──▶ V1
```

## Fase B — Backend

- [x] **B1. Dominio `[back]`.** `Comentario` (POJO) y `EstadoComentario` (record
  `totalLikes`, `likedByMe`). `ComentarioNoEncontradoException` con `getComentarioId()`.
  Añadir su `@Provider` en `DomainExceptionMapper` (mismo 404 genérico).
  **Desbloquea**: B2.
- [x] **B2. Puerto de salida `[back]`.** En `GrafoPersistencePort`:
  `crearComentario`, `obtenerComentariosDePost`, `registrarLikeComentario`,
  `retirarLikeComentario`, con Javadoc de por qué son idempotentes.
  **Desbloquea**: B3.
- [x] **B3. Adaptador Cypher `[back]`.** En `Neo4jGrafoAdapter`: constraint en el seed;
  validación + creación en una transacción; lectura ordenada con `likedByMe`; like con
  `MERGE` + `ON CREATE SET`; retirada idempotente. Mapeo con guarda de null para avatar.
  **Desbloquea**: B4.
- [x] **B4. Caso de uso + servicio `[back]`.** `GestionarComentariosUseCase` y
  `ComentarioApplicationService` (`@ApplicationScoped`, `UUID.randomUUID()`).
  **Desbloquea**: B5.
- [x] **B5. Recurso REST `[back]`.** `ComentarioResource` en
  `/api/posts/{postId}/comentarios` (GET, POST) y `/{comentarioId}/like` (POST, DELETE).
  Validación imperativa `400`, `201` con el comentario, `200` con el estado de likes.
  **Desbloquea**: F1 y V1.
- [x] **B6. Tests backend `[back]`.** `ComentarioResourceTest` (Mockito) y
  `Neo4jGrafoAdapterComentariosTest` (mock de driver + `ArgumentCaptor` sobre el Cypher).
  **Desbloquea**: V1.

## Fase F — Frontend

- [x] **F1. Tipos y servicio `[front]`.** `Comentario`, `ComentarioLikeResponse`,
  `CrearComentarioPayload` en `post.types.ts`; `comentarioApi.ts` con las cuatro llamadas.
  **Desbloquea**: F2.
- [x] **F2. `ComentariosModal` `[front]`.** Overlay con dos paneles, hilo con scroll, formulario
  de primer nivel, respuesta en línea, like optimista con reversión.
  **Desbloquea**: F3.
- [x] **F3. Cableado `[front]`.** `onComentar?` en `PostCard`; `onComentar` en `FeedList` y
  `PerfilAjeno`; estado y render del modal en `App`.
  **Desbloquea**: F4.
- [x] **F4. Tests frontend `[front]`.** `ComentariosModal.test.tsx` (carga, envío, respuesta,
  like con reversión) y caso del botón en `PostCard.test.tsx`.
  **Desbloquea**: V1.

## Fase V — Verificación

- [x] **V1.** `cd backend && mvn verify` y `cd frontend && pnpm run check`.

## Criterios de aceptación, con su prueba

| # | Criterio | Prueba |
|---|---|---|
| A1 | Crear comentario responde 201 con el comentario | `ComentarioResourceTest.crearResponde201` |
| A2 | Faltan userId/texto → 400 y no se llama al caso de uso | `ComentarioResourceTest` |
| A3 | Responder usa `parentId` y sólo un nivel | `Neo4jGrafoAdapterComentariosTest` + modal |
| A4 | Listar ordena del más antiguo al más reciente y marca `likedByMe` | adaptador + modal |
| A5 | Like idempotente con `MERGE`, no `CREATE` | `Neo4jGrafoAdapterComentariosTest` |
| A6 | Comentario inexistente → 404 | adaptador |
| A7 | El modal abre, envía, responde y revierte el like fallido | `ComentariosModal.test.tsx` |

## Identificador del ticket

No hay ticket verificado en Linear, así que el número queda **US (por definir)**: no se inventa un
`US-NN` que pudiera chocar con un ticket real, siguiendo la regla de US-13/US-14. Cuando se conozca
el ID de Linear se renombra la carpeta, la rama y las referencias `US (por definir)` a `US-NN`.
