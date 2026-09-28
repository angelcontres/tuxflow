# Tasks: US-05 (TUX-55) — Feed cronológico por grafo social

> **Dominio**: `feed-generation` · **Estrategia de entrega**: `single-pr` · **Límite de revisión**: 800 líneas

**Archivos a modificar**: `Neo4jGrafoAdapter.java`, `PostCard.tsx`, `post.types.ts`

## Review Workload Forecast

| Métrica | Valor |
|---|---|
| Unidades de trabajo | 3 |
| Líneas estimadas de cambio | 45–70 |
| Riesgo de presupuesto de 400 líneas | **Bajo** |
| PRs encadenados recomendados | **No** |
| Decisión necesaria antes de apply | **No** |
| División sugerida | PR único |
| Estrategia de entrega | single-pr |
| Límite de revisión del preflight | 800 líneas |

| Unidad | Alcance | Líneas |
|---|---|---|
| 1 | Leer la fecha como entero (D1) | 8–12 |
| 2 | Formatear la fecha en el componente (D2) | 25–40 |
| 3 | Manejar el fallo de carga del avatar (D3) | 10–15 |

**Recomendación**: un único PR. La unidad 1 es una línea y es la que desbloquea todo lo demás: mientras el
endpoint devuelva 500, las unidades 2 y 3 no se pueden ni comprobar.

---

## Unidad 1: Que el feed deje de devolver 500

**Desbloquea**: la historia entera. Sin esto no hay nada que ver en el navegador.
**Rollback**: revertir devuelve el 500. Es el estado actual, así que no hay riesgo de empeorar nada.

- [ ] En `Neo4jGrafoAdapter.obtenerFeedCronologico()`, cambiar la línea que asigna la fecha para leer el
      valor con `asLong()` y convertirlo con `String.valueOf(...)`
- [ ] No cambiar la firma de `Post.setFechaCreacion`: sigue recibiendo `String`
- [ ] No tocar el Cypher #1. Es obligatorio, está verificado contra el ticket y no es la causa
- [ ] No cambiar `Post.fechaCreacion` a `long`. El modelo se comparte con US-04, US-06 y US-11
- [ ] Verificar con el cURL del backlog que la respuesta es `200` y trae `post-b1` y `post-p1`, sin
      `post-d1`

**Nota**: el fallo es una excepción de coerción, no un `null`. Por eso aparece como 500 y no como feed
vacío. Si tras el cambio la fecha llega como número y no como texto, el mapeo quedó a medias.

---

## Unidad 2: Formatear la fecha

**Desbloquea**: el entregable "formatted date" del ticket, hoy ausente.
**Rollback**: revertir devuelve el epoch crudo, que es legible pero inútil.

### Pasos

- [ ] Crear un helper `formatFecha(valor: string): string` en el módulo de feed, junto a los tipos
- [ ] Convertir el valor con `new Date(Number(valor))`
- [ ] Si la conversión no produce una fecha válida, devolver `'Reciente'`
- [ ] Para menos de siete días, devolver tiempo relativo en español: minutos, horas o días
- [ ] Para siete días o más, devolver la fecha absoluta con `Intl.DateTimeFormat`
- [ ] Reemplazar el render actual de `post.fechaCreacion || 'Reciente'` por una llamada al helper
- [ ] Quitar el `|| 'Reciente'`: es código muerto, porque epoch en milisegundos nunca es falsy. El
      chequeo de validez va dentro del helper, no en el JSX
- [ ] No formatear en el backend. La decisión de presentación es del cliente y depende de su locale
- [ ] No agregar una dependencia de formato de fechas. `Intl` está en el runtime

### Nota sobre el cero

`0` es un epoch válido: 1 de enero de 1970. Un chequeo de vacío o de `=== 0` lo trataría como "sin fecha".
Solo `Number.isNaN` distingue "no hay fecha" de "la fecha es muy antigua".

---

## Unidad 3: Que el avatar sobreviva a una URL rota

**Desbloquea**: el entregable "avatar support" cuando la URL está inaccesible.
**Rollback**: revertir deja la imagen rota, que es el estado actual.

- [ ] Agregar un booleano `avatarError` al estado del componente, inicializado en `false`
- [ ] Poner `onError` en el `<img>` del avatar para poner ese booleano en `true`
- [ ] Renderizar el avatar solo cuando exista la URL **y** `avatarError` sea `false`
- [ ] Cuando no se renderice el avatar, conservar la inicial del nombre como se muestra hoy
- [ ] No tocar el `<img>` de `mediaUrl`. La imagen adjunta es entregable de US-04 y su `onError` se
      resuelve con US-04
- [ ] Mantener el badge `• Amigo en Grafo` visible siempre. Todo post del feed viene de alguien seguido,
      así que el badge es cierto por construcción

---

## Fuera de alcance

- Cambiar el Cypher #1 o la sintaxis `EXISTS()`. Es obligatorio y verificado contra el ticket.
- Cambiar `Post.fechaCreacion` a `long`. Deuda documentada en `design.md`.
- Paginación. `LIMIT 20` es fijo y el Gherkin no la pide.
- `onError` en la imagen de `mediaUrl`. Entregable de US-04.
- US-06. El botón de like ya se llama desde `PostCard` y falla en silencio hasta que US-06 exista.

## Verificación

```bash
# Backend
cd backend && mvn compile

# Frontend
cd frontend && pnpm run build

# cURL del backlog
curl -X GET http://localhost:8080/api/feed/carlos-patino
```

No hay suite de pruebas en el proyecto, por decisión registrada en `openspec/config.yaml`.

- [ ] `mvn compile` termina en verde
- [ ] `pnpm run build` termina en verde
- [ ] El cURL devuelve `200`, con `post-b1` y `post-p1`, y sin `post-d1`
- [ ] Cada publicación trae `fechaCreacion` como texto numérico, no como exception
- [ ] En navegador: la fecha se lee como tiempo relativo, no como número
- [ ] En navegador: una publicación de hace más de una semana muestra fecha absoluta
- [ ] En navegador: una publicación sin fecha válida muestra "Reciente"
- [ ] En navegador: un avatar con URL rota muestra la inicial, no una imagen rota
- [ ] En navegador: un usuario sin seguido muestra el estado vacío, no un error
