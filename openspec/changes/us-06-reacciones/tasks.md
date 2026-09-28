# Tasks: US-06 (TUX-56) — Likes idempotentes

> **Dominio**: `post-reactions` · **Estrategia de entrega**: `single-pr` · **Límite de revisión**: 800 líneas
> **Depende de**: US-05 debe estar aplicada. El refetch de reconciliación llama a `GET /api/feed/{userId}`,
> que hoy devuelve 500 por el defecto documentado en US-05.

**Archivos a modificar**: `PostResource.java`, `GrafoPersistencePort.java`, `PostApplicationService.java`,
`Neo4jGrafoAdapter.java`, `PostCard.tsx`, `feedApi.ts`

## Review Workload Forecast

| Métrica | Valor |
|---|---|
| Unidades de trabajo | 4 |
| Líneas estimadas de cambio | 55–80 |
| Riesgo de presupuesto de 400 líneas | **Bajo** |
| PRs encadenados recomendados | **No** |
| Decisión necesaria antes de apply | **No** |
| División sugerida | PR único |
| Estrategia de entrega | single-pr |
| Límite de revisión del preflight | 800 líneas |

| Unidad | Alcance | Líneas |
|---|---|---|
| 1 | Validar `userId` y reportar creación real (D1, D2) | 20–30 |
| 2 | Actualización optimista con reversión (D3) | 25–35 |
| 3 | Renombrar los métodos que mienten (D4) | 5–10 |
| 4 | Mensaje de error visible | 5–8 |

**Recomendación**: un único PR. Las unidades 1 y 3 tocan los mismos archivos y la 3 es el renombrado de
la 1, así que separarlas no reduce el riesgo de ninguno.

---

## Unidad 1: Que el endpoint deje de mentir

**Desbloquea**: que un `200` signifique reacción registrada. Es el mismo defecto que US-04, con la misma
causa.
**Rollback**: revertir devuelve el `200` mentiroso, que es el estado actual.

- [ ] En `PostResource.reaccionarPost()`, leer `userId` del cuerpo y rechazar con `400` si es `null` o
      `isBlank()`, nombrando el campo faltante
- [ ] Cambiar la firma de `GrafoPersistencePort.alternarLike()` de `void` a `boolean`
- [ ] En `Neo4jGrafoAdapter`, cambiar el `MERGE` para devolver si creó una relación nueva, en vez de
      encontrar una existente
- [ ] Propagar el `boolean` en `PostApplicationService.reaccionarPost()`, que hoy no devuelve nada
- [ ] En `PostResource`, responder `404` cuando el resultado sea `false`
- [ ] Mantener el `MERGE` y el `ON CREATE SET r.fecha` exactamente como están. Son la línea obligatoria del
      Gherkin y ya son correctos
- [ ] No agregar un `DELETE` ni una ruta para quitar likes. El Gherkin no lo pide

### La distinción que no hay que perder

`false` significa "el post o el usuario no existen", **no** "ya tenías un like". El segundo clic es un
no-op correcto y por eso responde `200`. Si se responden las dos igual, un like repetido parecería un
error.

---

## Unidad 2: Actualización optimista

**Desbloquea**: el entregable explícito del backlog, *"Actualización optimista de UI"*.
**Rollback**: revertir vuelve al refetch completo, que funciona pero hace esperar.

- [ ] Agregar estado local en `PostCard` para `likedByMe` y `totalLikes`, inicializado desde la prop
- [ ] Al hacer clic, aplicar el cambio local **antes** de esperar la respuesta
- [ ] Disparar la petición después del cambio local, no antes
- [ ] Si la petición falla, revertir el estado local a los valores anteriores
- [ ] Mantener el refetch del feed, pero **después** de la petición, no antes. Así la UI responde al
      instante y además se reconcilia con el total real del servidor
- [ ] Volver a sincronizar el estado local cuando la prop cambie. Sin esto, un estado inicializado desde
      props queda congelado en el primer valor y el contador queda obsoleto después del refetch
- [ ] No mutar el objeto `post` recibido por prop

### Nota de alcance

La prop `post` llega desde `FeedList` y de ahí desde `App`, así que el estado local no puede vivir en
`PostCard` si se quiere que el refetch lo actualice. La resincronización es obligatoria, no opcional.

---

## Unidad 3: Dejar de mentir con los nombres

**Desbloquea**: que la firma del puerto describa lo que hace.
**Rollback**: trivial, es un renombrado.

- [ ] Renombrar `GrafoPersistencePort.alternarLike()` a `registrarLike()`
- [ ] Renombrar la implementación en `Neo4jGrafoAdapter` y su llamada en `PostApplicationService`
- [ ] Renombrar `togglePostLike` a `likePost` en `feedApi.ts` y actualizar su único punto de uso en
      `PostCard.tsx`
- [ ] Verificar con grep que no queda ninguna referencia al nombre anterior
- [ ] No cambiar el Cypher. El `MERGE` es correcto; lo que miente es el nombre

---

## Unidad 4: Que el error se vea

**Desbloquea**: dejar de tragarse los clics fallidos en un `console.error`.
**Rollback**: trivial.

- [ ] Reemplazar el `console.error` del `catch` por un mensaje visible para el usuario
- [ ] Mantener el `console.error` como apoyo de diagnóstico, no como aviso al usuario
- [ ] No agregar un sistema de notificaciones. Un mensaje local es suficiente para una acción de un clic

---

## Fuera de alcance

- Quitar un like. No lo pide el Gherkin y la historia es de 2 SP.
- Notificar al autor del post. Es US-08, y `[:REACCIONA]` no dispara push hoy.
- Contadores en vivo de otros usuarios mientras se mira el post. El refetch de fondo los alinea en la
  siguiente carga, no en tiempo real.
- Índices sobre `[:REACCIONA]`. El `MERGE` de Cypher ya garantiza la unicidad.

## Verificación

```bash
# Backend
cd backend && mvn compile

# Frontend
cd frontend && pnpm run build

# cURL del backlog
curl -X POST http://localhost:8080/api/posts/post-p1/like \
  -H "Content-Type: application/json" \
  -d '{"userId": "carlos-patina"}'
```

No hay suite de pruebas en el proyecto, por decisión registrada en `openspec/config.yaml`.

- [ ] `mvn compile` termina en verde
- [ ] `pnpm run build` termina en verde
- [ ] El cURL devuelve `200`
- [ ] El cURL con un `postId` inexistente devuelve `404`, no `200`
- [ ] El cURL sin `userId` devuelve `400`, no `200`
- [ ] El cURL repetido devuelve `200` y deja una sola relación
- [ ] En navegador: el corazón se pinta rojo antes de que termine la petición
- [ ] En navegador: con la red caída, el corazón vuelve al estado anterior y se ve un mensaje
- [ ] En navegador: tras la recarga, el contador coincide con el total del servidor
