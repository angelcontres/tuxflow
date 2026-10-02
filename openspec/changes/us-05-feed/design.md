# Design: US-05 (TUX-55) — Feed cronológico por grafo social

> **Change**: `us-05-feed` · **Ticket**: `TUX-55` · **Dominio**: `feed-generation`
> **Base**: el criterio de aceptación de `proposal.md` y el código verificado el 2026-10-01

## Punto de partida

El backend ya entrega el contrato correcto: `GET /api/feed/{userId}` devuelve 200 con `fechaCreacion`
como epoch en milisegundos (`Long` anulable, `Neo4jGrafoAdapter.java:56-59`), `totalLikes` y
`likedByMe` calculados por el grafo, y filtrado por `[:SIGUE]`. Todo el trabajo de este change vive en
el cliente, en tres decisiones: dónde se formatea la fecha, cómo se desacoplan los refetches y cómo
falla el avatar.

---

### D1 — Formatear la fecha en el borde de presentación, no en el backend

El backend entrega epoch en milisegundos; el componente decide cómo se ve. Un helper `formatFecha`
junto al módulo de feed convierte el `number` a texto: relativo en español para lo reciente
(minutos, horas, días), absoluto con `Intl.DateTimeFormat` para lo de hace 7 días o más, y
`"Reciente"` cuando el valor es ausente o inválido.

La frontera es deliberada: el backend no sabe si el cliente quiere "hace 3 horas" o "12 mar", y
meter esa decisión en el servidor obliga a cambiarla para todos los clientes a la vez. Además,
formatear en el servidor depende del locale del servidor, no del usuario.

Se usa `Intl`, que ya está en el runtime: **sin dependencia de fechas**.

**Consecuencia**: el literal `"Publicado"` (`PostCard.tsx:76`) se reemplaza por la llamada al helper.
El chequeo de validez vive dentro del helper (`Number.isNaN` tras `new Date(valor)`), no en el JSX.
`0` es un epoch válido (1 de enero de 1970) y no debe tratarse como "sin fecha".

**Alternativa descartada**: formatear en el backend. Acoplaría la presentación al locale del servidor
y obligaría a versionar la API para cambiar un texto visible.

### D2 — Desacoplar los refetches: la red y el feed se refrescan por separado

`loadAllData` (`App.tsx:104-107`) es una sola función que reconstruye todo: `setPosts(feedData)` +
`setRed(...)`. El diseño la separa en dos intenciones con dependencias independientes:

- **Refresco de red** (`loadNetwork`): recarga sugerencias + seguidos y actualiza solo `red`.
- **Refresco de feed** (`loadFeed`): recarga `posts` aplicando el filtrado vigente del backend.
- **Carga combinada** (`loadAllData`): `Promise.all` de ambas. Es la que se dispara en el arranque,
  al crear un post (`CreatePostForm` → `onPostCreated`), al actualizar el perfil desde el `Navbar` y
  **en follow/unfollow** (`onNetworkUpdated`).

Que follow/unfollow use `loadAllData` y no `loadNetwork` es una decisión de producto explícita: al
dejar de seguir a alguien, sus posts deben desaparecer del feed **de inmediato**, porque el backend ya
no los devuelve. Se evaluó la alternativa de refrescar solo la red y conservar los posts en pantalla,
pero se descartó: deja posts fantasma de usuarios que ya no se siguen, que es la sorpresa que el
usuario reportó.

- **Like**: actualización optimista local del contador en `PostCard` (`PostCard.tsx:23-35`),
  **sin** pedir el feed. Si la petición confirma, el contador queda; si falla, se revierte y se
  registra en consola. El feed se recalcula entero por cada like solo porque el contador se guardaba
  en el servidor; mientras tanto, reconstruir la lista no aporta nada.

Así el Gherkin sigue intacto — la API excluye a los no seguidos — y lo único que cambia es **qué
peticiones dispara cada acción**, no lo que la API devuelve.

**Alternativa descartada**: fan-out-on-write (materializar el feed por seguidor). Rechazada de forma
explícita: no hace falta para este ticket, está fuera de alcance y rompería los criterios de
aceptación, que exigen filtrado por grafo en lectura.

### D3 — Un solo patrón de fallo de imagen, igual que la tarjeta de red

`PostCard` adopta el patrón que `UserSuggestionsCard.tsx:81-101` ya usa: un booleano de "avatar caído"
que, activo, renderiza la inicial en lugar del `<img>`. El `onError` actual
(`PostCard.tsx:62-64`), que oculta la imagen con `display = 'none'` y deja el círculo vacío, se
reemplaza por ese estado. Dos componentes resolviendo el mismo problema de la misma forma: una sola
manera de pensar el fallo de imagen.

**Consecuencia**: la URL rota deja de ser visible y deja de dejar un hueco vacío. El usuario ve la
inicial, que es lo mismo que ve cuando el autor no tiene avatar.

---

### D4 — Explain collateral disappearances with an ephemeral notice, not stored state

"Tu red" is 2-hop reachability recomputed on every refresh, so unfollowing the last bridge to
someone legitimately removes that person from the list. The list update itself is correct; what
is missing is feedback. `UserSuggestionsCard` therefore keeps the pre-refresh rows and the just
unfollowed bridge username in refs, diffs them against the refreshed `filas`, and shows a
temporary `role="status"` banner only when a disappeared suggestion row listed the bridge in its
pre-refresh `seguidosEnComun`. Follows never produce the notice, self-removal of the bridge is
excluded, and unexplained disappearances stay unexplained rather than inventing a cause. The
notice auto-clears after 6000 ms with proper timer cleanup.

**Alternativa descartada**: persisting reachability or the notice in the backend. The reachability
is derived data and the notice is transient presentation feedback; storing either would couple a
momentary UI explanation to the graph.

---

## Riesgo residual

- `EXISTS((u)-[:REACCIONA]->(p))` es la forma clásica de Neo4j 5 y funciona, pero está deprecada a
  favor de `EXISTS { ... }`. No se toca: el Cypher está verificado contra el ticket y cualquier cambio
  de sintaxis sería una desviación de la especificación, no una mejora.
- `LIMIT 20` es fijo y no está paginado. Con más de 20 publicaciones de los seguidos, las más antiguas
  son inalcanzables. El Gherkin no pide paginación, así que queda fuera, pero es la limitación que más
  se notará con volumen.
- El endpoint de `togglePostLike` pertenece a US-06. Si US-06 cambia su contrato (p. ej. devuelve el
  conteo definitivo), el like optimista de US-05 deberá revisarse para conciliar el contador con la
  respuesta en vez de asumir el incremento local.
- Separar los refetches introduce un estado temporalmente divergente a propósito: la tarjeta de red ya
  muestra "Seguir" mientras el feed aún muestra posts del usuario dejado de seguir. Es el
  comportamiento pedido, pero debe quedar cubierto por prueba para que nadie lo "arregle" devolviendo
  el refetch conjunto.
