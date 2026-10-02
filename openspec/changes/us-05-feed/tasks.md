# Tasks: US-05 (TUX-55) — Feed cronológico por grafo social

> **Ticket Linear**: `TUX-55` · **Dominio**: `feed-generation` · **Estrategia de entrega**: `single-pr`
> **Límite de revisión**: 800 líneas

**Archivos a modificar**: `App.tsx`, `FeedList.tsx`, `PostCard.tsx`, helper `formatFecha` nuevo,
pruebas colocaladas `*.test.tsx` (frontend). El backend no se toca.

## Review Workload Forecast

| Métrica | Valor |
|---|---|
| Unidades de trabajo | 4 (3 de comportamiento + 1 fase de tests) |
| Líneas estimadas de cambio | 180–260 (incluyendo pruebas) |
| Riesgo de presupuesto de 400 líneas | **Bajo** |
| PRs encadenados recomendados | **No** |
| Decisión necesaria antes de apply | **No** |
| Estrategia de entrega | single-pr |

| Unidad | Alcance | Líneas |
|---|---|---|
| 1 | Desacoplar el refetch de red del refetch de feed (D2) | 30–50 |
| 2 | Like sin refetch del feed, contador en el lugar (D2, like) | 20–40 |
| 3 | Fecha formateada + avatar con fallback a inicial (D1, D3) | 40–60 |
| 4 | Fase de tests obligatoria (Vitest + Testing Library, colocaladas) | 90–110 |

**Recomendación**: un único PR. La unidad 4 cubre las tres anteriores y es bloqueante para el cierre
según `openspec/config.yaml` (`rules.tasks`: fase de tests obligatoria; `rules.verify`: historia sin
pruebas = WARNING, no PASS).

---

## Unidad 1: Desacoplar el refresco de red del refresco de feed

**Desbloquea**: que follow/unfollow y like dejen de compartir el mismo `loadAllData`, que hoy
reconstruye feed + red en un solo `Promise.all`.
**Rollback**: revertir devuelve la reconstrucción de ambas listas en cada acción.

- [ ] Separar en `App.tsx` el refresco de red (sugerencias + seguidos → `setRed`) del refresco de
      feed (`fetchFeedBySocialGraph` → `setPosts`), componiéndolos en `loadAllData`
- [ ] **Mantener** `onNetworkUpdated={loadAllData}` en `UserSuggestionsCard`. Unfollow **sí** repide el
      feed: es lo que hace que los posts del usuario filtrado desaparezcan de inmediato
- [ ] Conservar el refresco combinado en la carga inicial, al crear un post (`CreatePostForm` →
      `onPostCreated`) y al actualizar el perfil desde el `Navbar`
- [ ] No cambiar el backend ni el Cypher. La API sigue excluyendo a los no seguidos
- [ ] No proponer fan-out-on-write. Explícitamente rechazado en `proposal.md`

---

## Unidad 2: Like sin refetch (el contador se actualiza en el lugar)

**Desbloquea**: que dar like no reconstruya la lista de publicaciones contra el grafo. Comparte
`loadAllData` con la unidad 1, pero se benefician por separado: el unfollow repide el feed, el like no.
**Rollback**: revertir devuelve la reconstrucción del feed en cada like.

- [ ] Desconectar `PostCard.handleLike` del refetch global: tras `togglePostLike` con éxito, conservar
      el estado optimista local (`isLiked` / `likesCount`) sin llamar a `onRefresh`/`loadAllData`
- [ ] Conservar el comportamiento de fallo actual: revertir el contador y registrar con
      `console.error` (el endpoint pertenece a US-06; no cambiar su contrato)
- [ ] Eliminar `onLikeChanged` (en `PostCard` y `FeedList`) y `onRefresh` de `FeedList`: quedan sin
      ningún llamador
- [ ] Verificar el escenario: like sobre un post de un usuario que se sigue → el contador sube y el
      feed no se vuelve a pedir

---

## Unidad 3: Fecha formateada y avatar con fallback a la inicial

**Desbloquea**: los entregables "formatted date" y "avatar support" del ticket, hoy pendientes.
Independiente de las unidades 1–2 en código, pero viaja en el mismo PR.
**Rollback**: revertir devuelve el literal `"Publicado"` y el círculo vacío.

### Fecha (D1)

- [ ] Crear el helper `formatFecha(valor: number): string` junto al módulo de feed
- [ ] Menos de siete días: tiempo relativo en español (minutos, horas, días)
- [ ] Siete días o más: fecha absoluta con `Intl.DateTimeFormat`
- [ ] Valor ausente o inválido: devolver `'Reciente'` (chequeo de validez dentro del helper, con
      `Number.isNaN`; `0` es un epoch válido y no es "sin fecha")
- [ ] Reemplazar el literal `"Publicado"` de `PostCard.tsx:76` por la llamada al helper
- [ ] No formatear en el backend; no agregar dependencia de fechas (`Intl` está en el runtime)

### Avatar (D3)

- [ ] Reemplazar el `onError` actual de `PostCard.tsx:62-64` (`display = 'none'`) por el estado de
      "avatar caído" que renderiza la inicial, con el mismo patrón de `UserSuggestionsCard.tsx:81-101`
- [ ] No tocar el `onError` de `mediaUrl` (`PostCard.tsx:93`): ya existe y funciona

---

## Unidad 4: Fase de tests obligatoria

**Desbloquea**: el cierre de la historia. Según `openspec/config.yaml` (`testing.runner.frontend`:
Vitest + Testing Library + jsdom, pruebas colocaladas `*.test.tsx`, imports explícitos desde
`'vitest'`), ningún comportamiento se declara correcto sin una prueba que lo cubra.
**Rollback**: N/A — sin esta unidad la historia se reporta como WARNING, no como PASS.

- [ ] Prueba: dejar de seguir vuelve a pedir el feed (`fetchFeedBySocialGraph` recibe una segunda
      llamada) y los posts del usuario filtrado desaparecen de inmediato, mientras los de los
      usuarios que se siguen siguen visibles
- [ ] Prueba: tras el unfollow, al remontar la vista los posts del usuario filtrado no reaparecen
- [ ] Prueba: dar like actualiza el contador en el lugar sin pedir el feed de nuevo (el mock del feed
      no recibe una segunda llamada); ante fallo de `togglePostLike`, el contador se revierte
- [ ] Prueba: `formatFecha` devuelve relativo para fechas recientes, absoluto para > 7 días y
      `"Reciente"` para valor ausente o inválido
- [ ] Prueba: avatar con URL rota renderiza la inicial, sin imagen rota ni círculo vacío
- [ ] Si alguna prueba debe quedar pendiente, justificar el motivo en el archivo (regla de
      `config.yaml`); nunca desactivar una prueba para dejarla verde

---

## Fuera de alcance

- Cambiar el Cypher, el mapeo `isNull() ? null : asLong()` o `Post.fechaCreacion` (ya es `Long`).
- Paginación (`LIMIT 20` fijo; el Gherkin no la pide).
- Materialización fan-out-on-write (rechazada).
- Que un usuario pagado salga de "Tu red" al dejar de seguirlo: no es un defecto, es la composición
  de la regla de la unión de US-02 con las sugerencias de 2º grado de US-03. Cambiarlo sería
  producto nuevo, no US-05.
- US-06: el contrato de `togglePostLike` no se modifica.
- Sintaxis `EXISTS(...)` deprecada: no se toca (Cypher verificado contra el ticket).

## Verificación

```bash
# Frontend (única capa tocada)
cd frontend && pnpm test && pnpm run build && pnpm run lint

# Backend (sin cambios; solo confirmar que sigue verde)
cd backend && $MAVEN_HOME/bin/mvn test
```

- [ ] `pnpm test` en verde, incluyendo las pruebas nuevas de la unidad 4
- [ ] `pnpm run build` en verde (typechequea también las pruebas)
- [ ] `pnpm run lint` sin errores nuevos
- [ ] `$MAVEN_HOME/bin/mvn test` en verde (sin cambios de backend)
- [ ] En navegador: al dejar de seguir, los posts de esa persona desaparecen sin recargar la página
- [ ] En navegador: la fecha se lee como tiempo relativo / absoluto / "Reciente" según el caso
- [ ] En navegador: un avatar con URL rota muestra la inicial, no un círculo vacío
