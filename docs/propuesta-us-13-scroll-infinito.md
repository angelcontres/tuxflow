# US-13: Scroll infinito en el perfil ajeno (propuesta de ticket para Linear)

> **Estado:** propuesta. **No** está en `docs/backlog-programadores.md` ni en el `ROADMAP.md`, y no
> debe agregarse sin decisión del arquitecto. Este archivo existe para que la tarjeta se copie y
> pegue en Linear, tal como describe el encabezado de `backlog-programadores.md`.
>
> **Numeración propuesta:** US-13. **No se propone número de ticket.** El último Linear usado es
> `TUX-64` (US-12) y hay al menos un `TUX-65` en una rama remota
> (`carlosfpatino/tux-65-fix-arreglar-fecha-de-publicacion-y-caracteres-especiales`). La numeración
> ya se equivocó una vez (`TUX-57` y `TUX-58` estaban intercambiados en el roadmap hasta el
> 2026-09-26), así que hay que verificar en Linear antes de crear la tarjeta y no deducirla de acá.
>
> **Épica:** Identidad / Grafo Social · **Sprint sugerido:** 4 · **Asignado sugerido:** Angel Villon /
> Carlos Patiño

---

### US-13: Scroll infinito en el perfil ajeno

* **Épica:** Identidad
* **Prioridad:** P1 (Should Have)
* **Estimación:** 3 Story Points
* **Rama Git:** `feature/US-13-scroll-infinito-perfil`
* **Asignado recomendado:** Angel Villon / Carlos Patiño
* **Depende de:** US-12

#### 📝 Descripción

Como usuario de la comunidad, quiero que las publicaciones y los seguidores de un perfil se carguen a
medida que bajo, sin ver un contador del tipo "mostrando 200 de 3.000" ni un botón de "cargar más".

US-12 dejó dos listas con tope de seguridad: 200 publicaciones y 500 seguidores. El tope evita que el
servidor se agote, pero la lista se corta en silencio, y una lista que se corta sin decir nada hace
pensar que esa es toda la actividad de la persona.

#### 🎯 Criterios de Aceptación (Gherkin)

```gherkin
Dado que existe el usuario "beatriz-silva"
Y que tiene más de 20 publicaciones
Cuando "carlos-patino" abre su perfil
Entonces se muestran las 20 publicaciones más recientes
Y no hay ningún texto que diga cuántas hay en total

Cuando "carlos-patino" baja hasta el final de la lista
Entonces se piden las siguientes 20 publicaciones
Y se añaden al final, sin quitar las que ya estaban
Y el listado no vuelve al principio ni salta

Cuando se llega a la última publicación de esa persona
Entonces no se hace ninguna petición más
Y no se muestra ningún mensaje de error: simplemente no hay más que cargar
```

#### ⚠️ El detalle que decide la historia: el cursor no puede ser sólo la fecha

`fechaCreacion` se escribe como `datetime().epochMillis`, es decir un entero en **milisegundos**, y no es
única: dos publicaciones del mismo autor pueden caer en el mismo milisegundo, y la semilla
(`docker/neo4j-seed.cql`) escribe las fechas a mano, así que un empate es fácil de construir.

Un cursor con la forma "las siguientes cuyo `fechaCreacion` es menor que X" tiene dos fallos, y los dos
son silenciosos:

- **Repite filas.** Con dos publicaciones en el milisegundo 1727270000000, la segunda página vuelve a
  empezar por ese mismo milisegundo y devuelve una de las dos otra vez. El frontend la ve, la
  deduplica por `id` y sigue, así que el usuario no nota nada.
- **Se salta filas.** Si el corte cae en medio de un empate, la publicación que quedó en la página
  anterior por el orden secondary no vuelve a aparecer en ninguna. Esa sí se pierde, y tampoco se nota.

El cursor tiene que ser el par `(fechaCreacion, id)`, con el `id` como desempate, y la condición de
continuación tiene que ser:

```cypher
(p.fechaCreacion < $desdeFecha)
OR (p.fechaCreacion = $desdeFecha AND p.id < $desdeId)
```

con el `ORDER BY p.fechaCreacion DESC, p.id DESC` correspondiente. La comparación de `p.id` es textual y
el `id` de las publicaciones es un UUID, así que no ordena por antigüedad: sólo sirve para que el corte
sea **estable**, que es lo que importa. Cualquier empate anterior al cursor queda excluido por la
primera mitad y cualquier empate posterior por la segunda, sin huecos ni solapes.

**Por qué no `SKIP`/`OFFSET`.** `SKIP` hace que Neo4j recorra y descarte las filas anteriores en cada
petición, así que la página 50 cuesta lo mismo que la 2. Con un cursor, la página 50 cuesta lo mismo
que la primera. Además `SKIP` es frágil ante publicaciones nuevas: al publicar durante el scroll, la
segunda página se desplaza una fila y se repite una. Con el cursor, una publicación nueva aparece
arriba y no altera lo que ya se pidió.

#### 🛠️ Tareas de Desarrollo

1. **Contrato del cursor [back]**
   - `GET /api/posts/autor/{userId}` acepta `desdeFecha` (epochMillis, opcional) y `desdeId` (string,
     opcional). Los dos van juntos: `desdeId` sin `desdeFecha` no significa nada.
   - `GET /api/users/{userId}/followers` acepta `desdeUsername`, porque esa lista ordena por `username`
     y no por fecha.
   - Ambos parámetros son opcionales y su ausencia significa "desde el principio", para que el cURL
     actual del ticket siga funcionando sin cambios.
   - **No** exponer un `total` ni un `count`. Es lo que produciría el "mostrando X de Y" que esta
     historia rechaza, y además obliga a un `count(*)` extra en cada página.

2. **Saber si hay más sin pedir un total [back]**
   - Pedir `limite + 1` filas y devolver las primeras `limite`. Si llega una fila de más, hay más.
   - La respuesta pasa a ser `{ "items": [...], "hayMas": true }`.
   - Esto **cambia la forma de la respuesta** de los dos endpoints. Es un cambio de contrato: hay que
     actualizar `PerfilAjeno.tsx` y sus pruebas en la misma historia, y no dejar un endpoint devolviendo
     un array y otro un objeto.

3. **Consulta con cursor [back]**
   - Aplicar el `WHERE` del cursor en `obtenerPostsDeUsuario` y `obtenerSeguidores`.
   - Mantener `LIMIT $limite` como parámetro. Subir los topes (200 y 500) no es la solución: el problema
     no es cuántas caben en una respuesta, es cuántas se piden sin que el usuario las haya pedido.
   - No tocar `Post.fechaCreacion`. Sigue siendo un entero, por la decisión que ya cerró el ROADMAP.

4. **Scroll infinito en el perfil [front]**
   - `IntersectionObserver` sobre un elemento centinela al final de la lista.
   - Al pedir la página siguiente se **añade** al final. Nunca se reemplaza: si se reemplazara, la lista
     volvería arriba en cada carga.
   - Deduplicar por `id` al añadir. Es la red de seguridad del punto anterior, no un reemplazo: si el
     backend devuelve un repetido, la lista no debe mostrarlo dos veces.
   - Guardar el cursor en un `useRef`, no en estado: se lee en cada disparo del observer y no debe
     provocar un render.
   - Limpiar el observer al desmontar y al cambiar de perfil.
   - Cancelar la petición en vuelo al cambiar de perfil. Sin esto, abrir el perfil de otra persona
     mientras se carga la última página deja publicaciones de la anterior mezcladas.

5. **Fallo de una página suelta [front]**
   - Si la segunda página falla, **conservar las publicaciones ya cargadas** y ofrecer un botón "Reintentar"
     en el centinela.
   - No convertir un fallo en una lista vacía ni vaciar lo que hay.

6. **Estados que hay que distinguir**
   - Cargando la primera página, cargando la siguiente, hay más, no hay más, y fallo reintentable. Son
     cinco cosas distintas y se ven distintas en pantalla.

#### ⚡ Prueba cURL Inmediata

```bash
# Primera página: sin cursor. Devuelve 20 items y hayMas=false
curl -X GET "http://localhost:8080/api/posts/autor/beatriz-silva?limite=20"

# Segunda página: el cursor es la última fecha y el último id de la respuesta anterior
curl -X GET "http://localhost:8080/api/posts/autor/beatriz-silva?limite=20&desdeFecha=1727260000000&desdeId=post-b1"

# Seguidores, que ordenan por username
curl -X GET "http://localhost:8080/api/users/beatriz-silva/followers?limite=20&desdeUsername=d"
```

#### ⚠️ Defectos abiertos que toca

| Defecto | Dónde | Por qué importa acá |
|---|---|---|
| El tope corta en silencio | `Neo4jGrafoAdapter` | Es lo que esta historia arregla. Hoy un perfil con 250 publicaciones muestra 200 y no dice nada. |
| `fechaCreacion` no es única | `Neo4jGrafoAdapter`, `crearPost` | Es la razón de que el cursor tenga que llevar `id` además de fecha. Si algún día la fecha pasa a nanosegundos, el desempate sigue haciendo falta: la unicidad no está garantizada por el tipo. |
| Dos listas con tope y forma distinta | `PerfilAjeno` | Hoy ambas devuelven `List` y ambas se pintan enteras. Al cambiar el contrato hay que cambiar las dos, y una a medias rompe el perfil. |

#### 🔗 Relación con el resto de historias

```
US-12 (perfil ajeno) ──→ US-13 (scroll infinito)
```

US-13 no desbloquea nada. Paga una deuda que US-12 dejó escrita: el recorte silencioso.

#### 🎯 Por qué 3 Story Points

Dos endpoints con un parámetro de cursor, una consulta con desempate, un observer y los estados de
carga. Es más código que US-11 pero menos superficie que US-12, que tuvo que construir el perfil entero
y dos endpoints nuevos. El riesgo está en el cursor mal hecho, no en el volumen: de ahí que el desempate
por `id` sea el centro de la historia y no un detalle.

#### ✅ Verificación

```bash
# Backend
cd backend && mvn verify

# Frontend
cd frontend && pnpm run test && pnpm run build

# Comprobación manual del desempate: dos publicaciones con la MISMA fecha
# tienen que aparecer una en cada página, no repetidas ni perdidas.
```

En navegador: abrir el perfil de alguien con muchos posts, bajar hasta el final varias veces y
comprobar que la lista crece hacia abajo, que no vuelve arriba, que no duplica publicaciones y que al
llegar al final deja de pedir.
