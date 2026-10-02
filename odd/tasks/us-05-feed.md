# US-05 — Feed cronológico filtrado por grafo social (TUX-55)

> **Rama**: `carlosfpatino/tux-55-us-05-chronological-feed-filtered-by-social-graph-2-hops`
> **Dominio**: `feed-generation` · **TDD**: desactivado (`strict_tdd: false`, fuente `openspec/config.yaml`)
> **Tests**: obligatorios. `config.yaml` exige fase de tests; no cerrar la historia sin pruebas.

## Objetivo

Que el feed de un usuario funcione, muestre la fecha formateada, degrade bien el avatar, y **refleje
siempre el filtrado vigente del grafo**: al dejar de seguir a alguien, sus posts desaparecen de
inmediato, sin esperar a que el usuario recargue la página.

## Problema verificado

`PostCard.handleLike` llama `onLikeChanged` tras cada reacción, que `FeedList` encadena a `onRefresh`,
que `App.tsx` conecta al mismo `loadAllData` que dispara follow/unfollow. Cada like reconstruía la
lista completa de publicaciones contra el grafo: un round-trip entero para mover un contador.

`onNetworkUpdated` de `UserSuggestionsCard` **se queda** en `loadAllData`. Dejar de seguir sí debe
repetir el feed: es lo que hace que los posts del usuario filtrado desaparezcan al instante.

## Alcance autorizado

| # | Trabajo | Dónde |
|---|---|---|
| 1 | Reescribir los 4 artifacts contra la realidad verificada | `openspec/changes/us-05-feed/**` |
| 2 | Desacoplar `loadFeed` / `loadNetwork` / `loadAllData` | `App.tsx`, `App.test.tsx` |
| 3 | Like no refetchea el feed | `PostCard.tsx`, `FeedList.tsx`, `App.tsx` |
| 4 | Fecha formateada (hoy muestra el literal `"Publicado"`) | `PostCard.tsx`, helper nuevo |
| 5 | Avatar cae a la inicial cuando la URL falla | `PostCard.tsx` |
| 6 | Pruebas de todo lo anterior | colocaladas |

## Estado real verificado (2026-10-01)

Ya resuelto, **no rehacer**:

- **H1 — el 500 por `asString()`**: arreglado en `a20f067` (PR #11). `Neo4jGrafoAdapter.java:56-59` usa
  `isNull() ? null : asLong()`. El feed ya devuelve 200.
- **`Post.fechaCreacion`**: ya es `Long`, no `String`. Cambiado en el mismo commit.
- **`post.types.ts:5`**: ya declara `fechaCreacion: number`.

Los tres artifacts actuales mienten sobre esto. Hay que corregirlos, no reimplementarlos.

## Pendiente real

- **Fecha**: `PostCard.tsx:76` renderiza el string fijo `"Publicado"`. No muestra la fecha de ninguna
  forma. No existe `formatFecha`.
- **Avatar**: `PostCard.tsx:62-64` tiene `onError` pero hace `style.display = 'none'`, dejando el
  círculo azul **vacío**. No cae a la inicial.
- **`mediaUrl`**: `PostCard.tsx:93` ya tiene `onError`. El artifact lo declaraba fuera de alcance.
- **Feed**: `LIMIT 20` fijo, sin paginación. Fuera de alcance (el Gherkin no lo pide).
- **Like**: el endpoint es de US-06. Hoy el fallo se consola y el contador se revierte.

## Decisiones

- **Unfollow SÍ repide el feed.** Es el comportamiento previo a este change y se conserva a
  propósito: el feed muestra siempre el filtrado vigente del backend, sin posts fantasma de
  usuarios que ya no se siguen. El Gherkin ("excluye completamente la publicación de david") queda
  intacto — lo que cambia es qué peticiones dispara cada acción, no qué devuelve la API.
  *(Revertido el 2026-10-01: la primera versión de este change desacoplaba el unfollow y dejaba los
  posts en pantalla. El usuario lo rechazó: no era el comportamiento esperado.)*
- **Like NO refetchea el feed.** El contador se refresca en el lugar. Es independiente del unfollow:
  conviven sin conflicto.
- **Copia local, no refetch, en el camino del like.** Evita el parpadeo y una request por like.
- **Fecha formateada en el cliente.** El backend no debe decidir locale.
- **Sin dependencia de fechas.** `Intl` está en el runtime.
- **Éxito de unfollow es requisito, no efecto secundario.** Hoy el `catch` de la UI mantiene el botón en
  "Dejar de seguir" si falla la request, pero hay que asegurar que la fila refleje el estado real.

## Criterios de aceptación

- [ ] El feed responde 200 y trae los posts de los seguidos, sin los de los no seguidos
- [ ] Cada post trae `totalLikes` y `likedByMe` correctos
- [ ] La fecha se ve como tiempo relativo si es reciente, absoluta si es de hace más de 7 días
- [ ] Una fecha ausente o inválida muestra "Reciente"
- [ ] Un avatar con URL rota muestra la inicial, no un círculo vacío ni una imagen rota
- [ ] Tras dejar de seguir, el feed se vuelve a pedir y los posts de esa persona desaparecen ya
- [ ] Los posts de los usuarios que se siguen siguen visibles
- [ ] Al recargar la vista, los posts filtrados no reaparecen
- [ ] Dar like actualiza el contador en el lugar sin pedir el feed de nuevo

## Checks

```bash
cd backend  && $MAVEN_HOME/bin/mvn test
cd frontend && pnpm test && pnpm run build && pnpm run lint
```

## Progreso

**2026-10-01 — las 4 unidades implementadas y verificadas.** Frontend únicamente; backend sin tocar.

- [x] **U1** `App.tsx`: `loadAllData` partido en `loadFeed` (posts), `loadNetwork` (red) y `loadAllData`
      (combinada). `onNetworkUpdated={loadAllData}` — el unfollow repide el feed a propósito.
- [x] **U2** `PostCard.tsx`: el like queda optimista y local, sin refetch. Se conserva la reversión del
      contador y el `console.error` ante fallo. Cadena de props muertas `onLikeChanged`/`onRefresh`
      eliminada de `PostCard` → `FeedList` → `App`.
- [x] **U3a** `frontend/src/features/feed/utils/formatFecha.ts`: relativo < 7 días, absoluto con `Intl`
      ≥ 7 días, `'Reciente'` ante valor ausente/inválido, `0` tratado como epoch válido, futuro
      clampado a "ahora mismo". Reemplaza el literal `"Publicado"`.
- [x] **U3b** `PostCard.tsx`: `avatarCaido` reemplaza el `display='none'`, con el patrón de
      `UserSuggestionsCard`. Sin imagen rota ni círculo vacío. `mediaUrl` intacto.
- [x] **U4** 21 pruebas nuevas en 3 archivos: `formatFecha.test.ts` (10), `PostCard.test.tsx` (8),
      `App.test.tsx` (3, integración).

### Evidencia de verificación (ejecutada por el orquestador, no reportada)

| Check | Resultado |
|---|---|
| `pnpm test` | **PASS** — 9 archivos, 79 pruebas (58 preexistentes + 21 nuevas) |
| `pnpm run build` | **PASS** — `tsc` limpio + `vite build` OK (typechequea también las pruebas) |
| `pnpm run lint` | **PASS** — `eslint .` sin errores ni warnings |

Backend no se modificó, así que no se re-corre `mvn test`.

### Comportamiento reportado — no es un defecto

Al dejar de seguir a alguien, esa persona **desaparece de "Tu red"**. Se chaired el hallazgo y se
verificó contra las specs: **es el comportamiento especificado**, no una falla de código.

- **US-02** define la fuente de la tarjeta como "la unión de sugerencias y seguidos fusionada en el
  cliente por id (seguidos primero, sin duplicados)".
- **US-03** define las sugerencias como contactos de **segundo grado**.

Al dejar de seguir, la persona sale de `seguidos` (correcto por US-02) y sólo reaparece si alguien
que seguís también la sigue. `fusionarRed` (`App.tsx:15-35`) implementa la unión al pie de la letra:
`seguido: true` para los seguidos, deduplicación por id, y las sugerencias detrás.

Hacerla persistente exigiría comportamiento que **ninguna spec declara** (tumbas de "dejado de
seguir", o cambiar la regla de la unión). Eso es producto nuevo, no US-05, así que queda fuera de
alcance y anotado como tal en `proposal.md` y `tasks.md`.

### Pendiente

- Ninguna unidad de código. Falta la verificación manual en navegador (los 3 puntos de la lista de
  verificación).

