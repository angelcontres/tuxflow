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
| 1 | Desacoplar el refetch de red del refetch de feed (D2, unfollow) | 30–50 |
| 2 | Like sin refetch del feed, contador en el lugar (D2, like) | 20–40 |
| 3 | Fecha formateada + avatar con fallback a inicial (D1, D3) | 40–60 |
| 4 | Fase de tests obligatoria (Vitest + Testing Library, colocaladas) | 90–110 |

**Recomendación**: un único PR. Las unidades 1 y 2 comparten el mismo desacople y deben revisarse
juntas: si solo se desacopla el unfollow, el like reintroduce la desaparición. La unidad 4 cubre las
tres anteriores y es bloqueante para el cierre según `openspec/config.yaml` (`rules.tasks`: fase de
tests obligatoria; `rules.verify`: historia sin pruebas = WARNING, no PASS).

---

## Unidad 1: Desacoplar el refetch de red (unfollow no vacía el feed)

**Desbloquea**: el requisito nuevo — los posts ya renderizados sobreviven al unfollow. Sin esto, la
unidad 2 no tiene sentido (el like seguiría reconstruido por el mismo `loadAllData`).
**Rollback**: revertir devuelve la desaparición inmediata tras cada unfollow.

- [ ] Separar en `App.tsx` el refresco de red (sugerencias + seguidos → `setRed`) del refresco de
      feed (`fetchFeedBySocialGraph` → `setPosts`), de modo que `UserSuggestionsCard` reciba un
      `onNetworkUpdated` que ya NO reconstruya los posts
- [ ] Conservar el refresco de feed en la carga inicial y al crear un post (`CreatePostForm` →
      `onPostCreated`); ahí sí aplica el filtrado vigente del backend
- [ ] No cambiar el backend ni el Cypher. La API sigue excluyendo a los no seguidos
- [ ] No proponer fan-out-on-write. Explícitamente rechazado en `proposal.md`

---

## Unidad 2: Like sin refetch (el contador se actualiza en el lugar)

**Desbloquea**: que dar like a un post de un usuario recién dejado de seguir no lo haga desaparecer
en mitad del clic. Depende de la unidad 1 (mismo `loadAllData` compartido).
**Rollback**: revertir devuelve la reconstrucción del feed en cada like.

- [ ] Desconectar `PostCard.handleLike` del refetch global: tras `togglePostLike` con éxito, conservar
      el estado optimista local (`isLiked` / `likesCount`) sin llamar a `onRefresh`/`loadAllData`
- [ ] Conservar el comportamiento de fallo actual: revertir el contador y registrar con
      `console.error` (el endpoint pertenece a US-06; no cambiar su contrato)
- [ ] Ajustar el cableado `FeedList.tsx:33` (`onLikeChanged={onRefresh}`) según el diseño D2, sin
      romper el resto de usos de `onRefresh`
- [ ] Verificar el escenario: unfollow a "beatriz" → like a su post visible → el post sigue en
      pantalla con el contador actualizado

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

- [ ] Prueba: tras unfollow exitoso, los posts ya renderizados siguen visibles y la tarjeta de red
      refleja el nuevo estado
- [ ] Prueba: en la próxima carga del feed tras el unfollow, los posts del usuario dejado de seguir
      ya no aparecen (el mock de `fetchFeedBySocialGraph` devuelve el feed filtrado)
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
- [ ] En navegador: tras dejar de seguir, los posts siguen visibles hasta la próxima carga
- [ ] En navegador: la fecha se lee como tiempo relativo / absoluto / "Reciente" según el caso
- [ ] En navegador: un avatar con URL rota muestra la inicial, no un círculo vacío
