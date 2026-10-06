# US-11 Tendencias (TUX-62) — Odd tasks

> **Rama**: `carlosfpatino/tux-62-us-11-trending-posts-across-the-1-and-2-hop-extended-network`
> **Ticket**: TUX-62 · **Dominio**: `graph-algorithms`
> **TDD**: desactivado (`strict_tdd: false`, fuente `openspec/config.yaml`). Se escribe el test antes
> del cambio cuando aporta (RED → GREEN), pero no es obligatorio por contrato.
> **Delegación**: intento de subagente `explore` falló por el runtime (`OpenCode's free tier can only
> be used from within OpenCode`); el mapeo y la escritura se hacen inline con esa limitación declarada.

## Objetivo

Ver las 10 publicaciones más populares creadas en los últimos 7 días dentro del círculo extendido a 1
y 2 saltos, ordenadas por **puntuación neta (likes − dislikes)**, en `GET /api/posts/tendencias/{userId}`
y en un widget de la barra lateral derecha.

## Estado inicial verificado (rama limpia en `1a22b98`)

Hecho:

- `Neo4jGrafoAdapter.obtenerTendenciasRedExtendida()` (:390): ventana de 7 días corregida
  (`epochMillis - duration('P7D').days * 86400000`) y `count(DISTINCT reactor)`.
- Ruta `GET /api/posts/tendencias/{userId}` (`PostResource:173`) + `CrearPostUseCase` +
  `PostApplicationService.obtenerTendencias()`.
- `Neo4jGrafoAdapterTendenciasTest` (6 tests): umbral por días, no `.milliseconds`; comparación entre
  enteros; filtro `{tipo: 'LIKE'}` (a eliminar, ver D1); mapeo de filas; lista vacía.

Falta:

- Excluir al usuario como autor de su propia ventana (D3 del design).
- Excluir posts sin `fechaCreacion`.
- Métrica: pasar de "solo LIKE" a **puntuación neta** (D1, decidido por el usuario).
- Seeds: hoy 6 usuarios, 3 posts, 2 reacciones. El ticket pide 50.
- Frontend: sin tipo, sin función de cliente, sin widget, sin cableado.

## Decisiones

- **D1 — Métrica = puntuación neta (`likes − dislikes`)**, decidida por el usuario el 2026-10-06.
  Adapta la Cypher 5 obligatoria manteniendo su esqueleto (mismo `MATCH`, mismo `WHERE`, `LIMIT 10`);
  proyecta además `totalReacciones` para el AC. Desviación consciente y aceptada del `ORDER BY`
  literal del ticket.
- **D2 — Exclusión de autor propio y de posts sin fecha** (design D3 + tasks unidad 1).
- **D3 — Seeds = 50 publicaciones** en `docker/neo4j-seed.cql` (mecanismo de "migración" del repo,
  `docker/seed.sh --wipe`), con LIKES y DISLIKES y tiempos variados: dentro y fuera de la ventana de
  7 días, autores a 1 y 2 saltos (`beatriz`, `paulo`, `david`) y autores fuera de la ventana de
  `carlos-patino` (`angel`, `elena`).
- **D4 — Widget propio con estados separados** (design D4/D5): loading, vacío y error distintos;
  orden de la barra: tendencias, sugerencias, conexiones, chat.
- **D5 — Entrega**: `single-pr` con `size:exception` registrado — `openspec/changes/us-11-tendencias/tasks.md`
  declara `Estrategia de entrega: single-pr · Límite de revisión: 800 líneas`. Pronóstico actual
  ~600 líneas autorizadas (< 800). Revocable por el usuario antes del primer commit si quiere split.

## Tareas

### B1 — Consulta y mapeo (backend)

- [x] B1.1 Adaptar la Cypher: `WITH DISTINCT` por reactor+tipo, `likes`, `dislikes`,
      `puntuacionNeta = likes − dislikes`, `totalReacciones = likes + dislikes`,
      `ORDER BY puntuacionNeta DESC, totalReacciones DESC`, `LIMIT 10`.
- [x] B1.2 Añadir `AND autor <> u` (autor propio excluido) y `AND p.fechaCreacion IS NOT NULL`.
- [x] B1.3 Proyectar los campos nuevos en el `Map` de retorno (longs).
- [x] B1.4 `cd backend && mvn compile`

### B2 — Tests backend

- [x] B2.1 Actualizar el test del filtro: ya no `{tipo: 'LIKE'}`; ahora exige `puntuacionNeta` y
      prohíbe `count(reactor)` simple.
- [x] B2.2 Exigir por string las condiciones nuevas (`autor <> u`, `fechaCreacion IS NOT NULL`).
- [x] B2.3 Test de mapeo con los campos nuevos (likes/dislikes/total/neta).
- [x] B2.4 `cd backend && mvn -Dtest=Neo4jGrafoAdapterTendenciasTest test`

### S1 — Seeds

- [x] S1.1 Ampliar `docker/neo4j-seed.cql` a 50 posts con `UNWIND` (timestamps relativos a
      `datetime().epochMillis`): mezcla dentro/fuera de 7 días, autores variados.
- [x] S1.2 Reacciones LIKES y DISLIKES sobre esos posts, con rankings variados para la neta.
- [x] S1.3 Verificar que `carlos-patino` tiene posts en ventana con likes y dislikes.
      Evidencia (Neo4j 5.20 real, seed cargado con `docker/seed.sh --wipe`): 50 posts,
      167 reacciones (123 likes / 44 dislikes); la query da exactamente el top 10 previsto
      (t15, t43, t08/t31, t01, t02, b1/t03, t33, t21 — puestos 3-4 y 7-8 empatados a la par,
      ambos siempre dentro); puesto 11 = t32 (neto 1, total 1) cortado por el LIMIT 10;
      0 posts de angel/elena/carlos y 0 posts antiguos en la lista; t46/t47 sin reacciones
      ausentes. Verificación documentada al final del propio seed (sección 9).

### F1 — Cliente y tipo (frontend)

- [x] F1.1 Tipo `Tendencia` en `post.types.ts` (id, texto, autor, likes, dislikes,
      totalReacciones, puntuacionNeta).
- [x] F1.2 `fetchTendencias(userId)` en `feedApi.ts` con la instancia `api` ya configurada;
      error propagado, no convertido a lista vacía.
- [x] F1.3 `cd frontend && pnpm run build` — `tsc && vite build` OK (1579 módulos, 4.42s).

### F2 — Widget en la barra lateral

- [x] F2.1 `TrendingSidebar.tsx` en `features/feed/components`: loading, vacío ≠ error, sin
      duplicar peticiones en vuelo, lista en orden recibido. `EstadoConsulta` como discriminated
      union (patrón `ConexionesComunesPanel`); neta firmada (`+2 pts` / `-2 pts`) porque es la
      métrica que ordena (D1).
- [x] F2.2 Cablear en `App.tsx` `<aside>` por encima de `UserSuggestionsCard` (D4).
- [x] F2.3 Tests del componente (vitest + testing-library, patrón de `UserSuggestionsCard.test.tsx`)
      — 9 tests: consulta (petición con userId, loading, sin duplicar en vuelo), renderizado
      (título, orden, autor/likes/dislikes/neta con signo, vacío ≠ alerta), errores (fallback
      `getUserFacingError` + mensaje de backend vía `isAxiosError`).
      Nota: `App.test.tsx` hacía falta sumar `fetchTendencias` al mock de `feedApi` y re-stubearlo
      tras `vi.resetAllMocks()` de sus dos `beforeEach` (si no, el widget monta con la función en
      undefined y el render de App revienta).
- [x] F2.4 `cd frontend && pnpm run build && pnpm test` — build OK; **175/175 tests en verde**
      (166 previos + 9 del widget); `pnpm lint` sin errores (eslint).

### V — Verificación

- [x] V.1 `cd backend && mvn -B verify` (JDK 21) — **BUILD SUCCESS** (1:33 min; SpotBugs 0 bugs,
      Spotless limpio, 53 ficheros).
- [x] V.2 Backend levantado con el jar de verify (`target/quarkus-app/quarkus-run.jar`,
      `setsid` para sobrevivir al tool) + Neo4j seedado: `GET /api/posts/tendencias/carlos-patino`
      → **HTTP 200 con 10 posts** (no lista vacía): t15, t43, t31, t08, t01, t02, b1, t03, t33, t21.
- [x] V.3 Orden por neta verificado programáticamente (5,4,3,3,3,2,2,2,1,1 DESC; empates 3-4
      resueltos por total 5>3) y sin `carlos-patino` como autor. Edades reales de Neo4j: los 10
      devueltos tienen ≤5 días (b1/t15/t43/t01/t02 = 0.1d); `post-t13` y `post-t27` (14 días,
      **neta 5** — empatarían con el puesto 1) existen y **no aparecen**: la ventana de 7 días filtra.

## Commits (unidades de trabajo, misma PR)

- `f8d1e97` `feat(US-11): top 10 de tendencias por puntuacion neta en la red extendida (TUX-62)` —
  backend + tests: +100/−20 (120 autorizadas). Foco: `mvn -Dtest=Neo4jGrafoAdapterTendenciasTest test`
  (8 tests) y `mvn -B verify` (V.1, BUILD SUCCESS). Rollback: `Neo4jGrafoAdapter.java` +
  `Neo4jGrafoAdapterTendenciasTest.java`.
- `9c4bb9c` `chore(seed): amplia neo4j-seed.cql a 50 posts con likes y dislikes (US-11)` —
  +172 autorizadas. Foco: carga con `docker/seed.sh --wipe` + query real (S1, V.2/V.3).
  Rollback: `docker/neo4j-seed.cql` (los posts `post-t*` no los toca el código).
- `4a585d9` `feat(US-11): widget de tendencias en la barra lateral (TUX-62)` — frontend:
  +341/−3 (344 autorizadas). Foco: `pnpm test` (175/175), `pnpm run build`, `pnpm lint`.
  Runtime: sin e2e de navegador en el repo — N/A; la verificación de runtime real es V.2 (endpoint)
  y los 9 tests de componente. Rollback: `TrendingSidebar.*`, `fetchTendencias` + `Tendencia`,
  el cableado en `App.tsx` y el ajuste del mock en `App.test.tsx`.
- Docs (este archivo): commit aparte porque el documento registra los hashes anteriores.

**Recuento de entrega (D5)**: 636 líneas autorizadas (613+ / 23−) sobre 3 commits → excede 400,
dentro del `size:exception` de 800 registrado en D5. Estrategia: **single-pr**, una sola PR con los
3 commits de código + docs. RDD del clon está **off** (`gentle-ai review mode status`), por lo que
no corrió review nativo: los checks son los funcionales anteriores.

## Criterios de aceptación

- El cURL devuelve publicaciones (no lista vacía) con el top 10 por puntuación neta de 7 días.
- Los totales cuentan personas distintas, sin multiplicar por caminos.
- El usuario no aparece como autor de su propia tendencia.
- La barra lateral muestra tendencias sobre sugerencias, y vacío ≠ error.

## Fuera de alcance

- Migrar `fechaCreacion` a fecha con hora (deuda nombrada en ROADMAP).
- Ponderar por antigüedad o por categorías; página de tendencias completa.
