# Design: US-05 (TUX-55) — Feed cronológico por grafo social

> **Change**: `us-05-feed` · **Ticket**: `TUX-55` · **Dominio**: `feed-generation`
> **Base**: el criterio de aceptación de `proposal.md` y el mapeo real de `Neo4jGrafoAdapter`

## El problema de fondo

El feed tiene tres capas y cada una asume algo distinto sobre `fechaCreacion`:

| Capa | Qué dice de la fecha |
|---|---|
| `crearPost` (escritura) | `datetime().epochMillis` → **entero** |
| Tipo de dominio `Post` | `private String fechaCreacion` → **texto** |
| `obtenerFeedCronologico` | `record.get("fecha").asString()` → **falla** |

El tipo de dominio declara `String` y por eso el mapeo escribió `.asString()`. Pero el valor real en
Neo4j nunca fue un texto: `crearPost` escribe epoch en milisegundos. La mentira del modelo seepagó tres
capas y estalló en la cuarta.

`asString()` no convierte. Lanza. El contrato de `Value.asString()` es "este valor **es** un texto", no
"convierte cualquier valor a texto". Por eso el fallo es una excepción y no un `null` silencioso: la
ejcepción es lo correcto, y el bug es la suposición que lausicó.

---

### D1 — Leer la fecha con `asLong()` y serializarla como texto

`obtenerFeedCronologico` lee `fecha` con `asLong()` y la convierte a `String` en Java. El tipo de dominio
sigue siendo `String`, así que el contrato de la API no cambia y nada más se entera.

**Alternativa descartada**: cambiar `Post.fechaCreacion` de `String` a `long`. Es el tipo honesto, pero el
modelo lo comparten US-04, US-06 y US-11. Cambiarlo arrastra un ajuste en tres historias más por una
mejora de tipado que no altera ningún comportamiento observable. Queda como deuda documentada, y en el
día en que esas historias se toquen el tipo se corrige una sola vez.

**Consecuencia**: el JSON sigue enviando `fechaCreacion` como texto numérico, exactamente como declara
`post.types.ts`. El feed pasa de 500 a 200 sin tocar frontend.

### D2 — Formatear en el borde de presentación, no en el backend

El backend entrega epoch en milisegundos; el componente decide cómo se ve. Un helper `formatFecha` en el
frontend convierte a fecha y produce texto relativo para lo reciente y absoluto para lo antiguo.

La frontera es deliberada: el backend no sabe si el cliente quiere "hace 3 horas" o "12 mar", y meter esa
decisión en el servidor obliga a cambiarla para todos los clientes a la vez. Además, formatear en el
servidor depende del locale del servidor, no del del usuario.

Se usa `Intl.DateTimeFormat`, que ya está en el runtime y evita una dependencia.

**Consecuencia**: el fallback `'Reciente'` se elimina. Se reemplaza por un chequeo de validez, porque en
epoch en milisegundos el valor cero es un instante real y no significa "sin fecha".

### D3 — Un solo patrón de fallo de imagen, igual que US-03

`PostCard` lleva un booleano `avatarError` que empieza en `false` y pasa a `true` en el `onError` del
`<img>`. Cuando está activo, se renderiza la inicial en lugar de la imagen.

Es el mismo patrón que US-03 usa para `sug.avatar`, y se resuelve igual a propósito: dos componentes
resolviendo el mismo problema de forma distinta obligan a pensar dos veces sobre lo mismo.

**Consecuencia**: la URL rota deja de ser visible. El usuario ve la inicial, que es lo que ve cuando el
usuario no tiene avatar.

---

## Riesgo residual

`EXISTS((u)-[:REACCIONA]->(p))` es la forma clásica de Neo4j 5 y funciona, pero está deprecada a favor de
`EXISTS { ... }`. No se toca: el Cypher #1 es obligatorio y está verificado contra el ticket, así que
cualquier cambio de sintaxis es una desviación de la especificación, no una mejora.

`togglePostLike` se llama desde `PostCard.handleLike` y su endpoint es de US-06. Hoy el fallo del like se
consola y el contador no se mueve. Es un botón que no hace nada hasta que US-06 aterrice, y es visible en
la UI como parte de US-05 aunque el comportamiento pertenece a US-06.

`LIMIT 20` es fijo y no está paginado. Con más de 20 publicaciones de los usuarios seguidos, las más
antiguas desaparecen sin ninguna forma de alcanzarlas. El Gherkin no pide paginación, así que queda
fuera, pero es la limitación que más se va a notar cuando haya volumen.
