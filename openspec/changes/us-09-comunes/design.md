# Design: US-09 (TUX-57) — Conexiones en común

> **Change**: `us-09-amigos-comun` · **Ticket**: `TUX-57` · **Dominio**: `social-graph`
> **Base**: el criterio de aceptación de `proposal.md`, el Cypher #3 real y el módulo `features/network`

## El problema de fondo

Esta historia tiene dos mitades que no se parecen en nada.

El backend está **terminado y bien hecho**: el Cypher #3 es la consulta obligatoria del ticket, la
intersección está planteada en las dos direcciones correctas, y la guarda de null en `avatar` ya está
puesta. Alguien escribió esta parte con la cabeza en la especificación.

El frontend **no existe**: no hay función de API, no hay tipo, no hay componente. No hay ni un `console.log`
en el módulo.

Entre las dos mitades hay un defecto de una línea, y ese defecto es la mitad interesante de la historia.

---

### D1 — La guarda de `nombre` que falta, y la que está de más

`obtenerSeguidoresEnComun` mapea cinco campos. Cuatro tienen guarda implícita o explícita; uno no:

```java
u.setNombre(record.get("nombre").asString());                                    // sin guarda
u.setAvatarUrl(record.get("avatar").isNull() ? null : ...);                        // con guarda
```

Se agrega la guarda de `nombre` siguiendo **el patrón exacto de la línea siguiente**. No hay decisión de
diseño que tomar aquí: la respuesta correcta ya está escrita a una línea de distancia, y su ausencia es
una inconsistencia, no una elección.

**Consecuencia**: un `Usuario` sin `nombre` degrada a `null` en lugar de romper la petición. La respuesta
deja de depender de un dato opcional.

**Deuda que queda anotada**: el mismo defecto sin corregir está en `obtenerSugerencias`, línea 88, que
devuelve `sugerido.nombre` con `.asString()` sin guarda. Es la misma línea de arreglo y pertenece a US-03.
No se toca acá para no cruzar los límites de la historia, pero **no se pierde**: queda escrita acá y en el
design de US-03.

### D2 — Validar los dos parámetros, y validar que sean distintos

`userA` y `userB` se validan con `isBlank()` y responden `400` si falta alguno. Además, si son iguales, se
responde `400`.

La segunda validación no es un refinamiento. Con `userA == userB` la intersección de un conjunto consigo
mismo es el conjunto entero, así que el endpoint devuelve la lista completa de seguidos del usuario y lo
presenta como "conexiones en común". Una respuesta correcta sobre una pregunta que nunca se hizo.

**Alternativa descartada**: normalizar y devolver la lista completa a propósito. Se descartó porque el
cliente pidió una intersección y recibe algo distinto; el que llama no tiene forma de detectarlo.

**Consecuencia**: `400` cubre los tres casos, y `[]` vuelve a significar exactamente una cosa: no hay
conexiones en común.

### D3 — Componente nuevo, no otro bloque dentro de `UserSuggestionsCard`

El backlog dice "modal o sección". Ninguna de las dos va dentro de `UserSuggestionsCard.tsx`, y el motivo
es concreto: **US-02 y US-03 modifican ese mismo archivo**. Meter la historia de conexiones mutuas en el
componente de sugerencias produce un archivo que tres historias tocan, y los conflictos de merge dejan de
ser cosméticos.

Por eso va en `ConexionesComunesPanel.tsx`, dentro de `features/network/components/`, con su función de
API y su tipo. El punto de montaje es una línea.

**Consecuencia**: US-09 no solapa con US-02 ni US-03 en ningún archivo. Se pueden aplicar en cualquier
orden.

### D4 — El segundo usuario se elige explícitamente

No hay página de perfil en el producto. `App.tsx` trabaja con un usuario único hardcodeado, y no hay
ningún lugar donde "estoy mirando el perfil de alguien" sea una noción que el producto represente.

Construir la página de perfil sería la solución correcta, y es más grande que esta historia de 3 SP. En su
lugar, el panel recibe un campo de texto donde se indica el identificador del otro usuario y busca a
pedido.

Es más tosco que una página de perfil y es exactamente lo que permite mantener el alcance. Se anota como
la deuda que se paga cuando exista el perfil.

**Consecuencia**: no se inventa un concepto de navegación que el producto no tiene.

---

## Riesgo residual

El `MERGE` de `guardarUsuario` borra la propiedad cuando el valor es `null`, así que "usuario sin nombre"
es un estado real y fácil de alcanzar. D1 evita el 500, pero el dato sigue faltando: el panel de
conexiones muestra `nombre` y, cuando viene nulo, tiene que mostrar `username`. Es el mismo criterio de
US-03 con el avatar.

`GET /api/users/comunes` no está protegido por nada. Cualquiera que conozca dos identificadores obtiene su
intersección de seguidos. Hoy no hay autenticación, así que no es una regresión de esta historia — es el
estado del proyecto. Pero es exactamente la clase de dato que se vuelve sensible el día que aterrice
US-01, y conviene que quede anotado ahora.

La intersección no tiene límite de tamaño. Si dos usuarios siguen a las mismas doscientas personas, se
devuelven doscientas filas sin paginación. El Gherkin no lo pide y a esta escala es inocuo, pero es la
misma limitación de `LIMIT 20` en US-05: aparece cuando hay volumen, no antes.
