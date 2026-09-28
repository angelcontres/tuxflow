# Design: US-04 (TUX-54) — Crear publicación con multimedia en S3

> **Change**: `us-04-crear-post` · **Ticket**: `TUX-54` · **Dominio**: `post-management`
> **Base**: el criterio de aceptación de `proposal.md` y el código actual de `PostResource` y
> `CreatePostForm`

## El problema de fondo

La consulta que crea la publicación está escrita como una cadena de cláusulas donde el `MATCH` es
obligatorio pero su resultado no se comprueba:

```cypher
MATCH (u:Usuario {id: $autorId})
CREATE (p:Post { ... })
CREATE (u)-[:PUBLICA]->(p)
```

Cypher es orientado a filas. Si el `MATCH` no devuelve filas, todo lo que sigue también opera sobre cero
filas. No se crea ni el post ni la relación, y **el método no señala nada**: devuelve `void` y el
servicio responde con el UUID como si todo hubiera salido bien.

El criterio de aceptación promete un enlace "atómicamente" con el usuario. Hoy esa atomicidad es
accidental —depende de que el autor exista— y cuando falla es invisible.

---

### D1 — Validar la entrada en el borde y responder con error explícito

`PostResource.crearPost()` rechaza `autorId` y `texto` vacíos o nulos con `400` antes de tocar el dominio.
Es la frontera inbound: es donde se conoce el contrato HTTP y donde un error es barato.

Se usa `String.isBlank()`, que cubre `null`, cadena vacía y solo espacios en una sola comprobación.

**Consecuencia**: un `POST` con cuerpo vacío deja de devolver `201` y pasa a devolver `400` con un mensaje
explícito. El frontend ya ignora la respuesta y limpia el formulario, así que no se rompe el flujo: el
usuario ve que su publicación no apareció, en lugar de creer que sí.

### D2 — Verificar que la creación ocurrió, en lugar de asumirlo

`GrafoPersistencePort.crearPost()` cambia de `void` a `boolean`, y el adaptador devuelve si la consulta
afectó alguna fila. `PostApplicationService` propaga ese resultado y `PostResource` responde `404` cuando
no se creó nada.

Esto convierte la garantía del criterio de aceptación en algo verificable: el `201` significa que existe
un nodo `(:Post)` enlazado, no solo que se intentó.

**Alternativa descartada**: hacer que el Cypher lance una excepción si no encuentra al autor. Se descartó
porque Neo4j no falla de forma natural ante un `MATCH` vacío: no hay excepción que capturar, habría que
inventarla en Java y el chequeo quedaría igual de lejos del dato.

**Consecuencia**: cambia la firma de un puerto de salida. Es el único cambio de contrato de esta historia
y no toca los adaptadores de S3, Push ni WebSocket.

### D3 — Preview local con la URL escrita, sin descarga previa

El preview se resuelve en el navegador contra la misma URL que el backend va a guardar. No hay endpoint
nuevo ni subida de archivos.

Como la URL es escrita a mano y no sube nada, el componente necesita un `onError` en el `<img>` para
volver al estado sin preview cuando la imagen no carga. Es el mismo patrón que US-03 usa para el avatar,
y por eso se resuelve igual: un booleano en el estado del componente.

**Consecuencia**: una URL que el navegador no puede cargar se ve como error, aunque sea válida en el
lado del servidor. Se acepta: el caso normal es una URL pública y el caso raro es una URL mal pegada.

### D4 — Corregir `pl-13` sin cambiar el diseño

La escala de Tailwind no tiene `pl-13`. Se reemplaza por `pl-12`, la clase real más cercana al ancho
del avatar (`w-10` más el `gap-3`), de modo que la URL de multimedia queda alineada con el `textarea`.

**Consecuencia**: es un cambio de una clase, sin efecto sobre el layout vertical.

---

## Riesgo residual

D2 detecta que la creación falló, pero no dice **por qué**. Un `404` con un `autorId` inexistente y un
`404` con un problema de permisos se ven iguales. Es coherente con el estado actual del proyecto —no hay
autenticación— y se resuelve cuando US-01 aterrice la identidad.

`PostApplicationService.crearPost()` invoca además `notificarSeguidoresNuevoPost()`, que pertenece a US-08
y hoy es un stub que solo registra logs. La llamada queda dentro de la historia porque ya está escrita y
no tiene efecto, pero acopla US-04 con US-08: el día que el push se implemente, cualquier fallo suyo
pasará aHMACAR la creación de la publicación.
