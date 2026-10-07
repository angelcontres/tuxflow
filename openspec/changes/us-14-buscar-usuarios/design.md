# Design: US-14 (TUX-71) — Buscar usuarios

> **Ticket Linear**: `TUX-71` · **Dominio**: `social-graph` · **Delta**: todo `ADDED`

## El recorrido, de punta a punta

```
Persona escribe "patino" en el Navbar
  │
  ├─ [front] UserSearchBox: texto < 2 caracteres → no se pide nada
  ├─ [front] debounce 250 ms → una sola petición por texto escrito
  ├─ [front] AbortController → la petición anterior se cancela
  │
  └─ GET /api/users/buscar?q=patino
        │
        ├─ [in]  UserGraphResource.buscarUsuarios  → valida q (400 si < 2)
        ├─ [in]  GestionarGrafoSocialUseCase.buscarUsuarios
        ├─ [app] UserGraphApplicationService      → pasa el texto tal cual
        │
        └─ [out] Neo4jGrafoAdapter.buscarUsuarios(texto, 20)
                 │
                 ├─ normaliza el texto buscado con la misma función
                 ├─ MATCH (u:Usuario) WHERE <normalizado> CONTAINS $q
                 ├─ ORDER BY CASE <relevancia> ASC, u.username ASC
                 ├─ LIMIT $limite
                 └─ RETURN id, username, nombre, avatarUrl   ← y nada más
        │
        └─ 200 [UsuarioPublicoResponse]  (sin correo, sin password, sin push)
              │
              └─ [front] cada fila abre el perfil de US-12 → cerrar → seguir
```

## Arquitectura hexagonal: qué toca cada anillo

| Anillo | Artefacto | Cambio |
|---|---|---|
| `domain/model` | `Usuario` | **No cambia.** Los campos normalizados no viven en el dominio: son una proyección de la consulta, no parte de la identidad de la persona. |
| `domain/port/in` | `GestionarGrafoSocialUseCase` | `+ buscarUsuarios(texto)`, `− listarUsuarios()` |
| `domain/port/out` | `GrafoPersistencePort` | `+ buscarUsuarios(texto, limite)`, `− listarUsuarios()` |
| `application` | `UserGraphApplicationService` | Delega en el puerto; no normaliza ni ordena. |
| `infrastructure/adapter/in/rest` | `UserGraphResource` | `+ GET /buscar`, `− GET /` (el directorio) |
| `infrastructure/adapter/in/rest/dto` | `UsuarioPublicoResponse` | Se reutiliza. **No se crea un DTO nuevo**: la búsqueda devuelve exactamente las mismas cuatro propiedades que las listas de US-09 y US-12. |
| `infrastructure/adapter/out/neo4j` | `Neo4jGrafoAdapter` | `+ buscarUsuarios`, `− listarUsuarios` |
| `features/user/services` | `userApi.ts` | `+ buscarUsuarios(texto, signal)` |
| `features/user/components` | `UserSearchBox.tsx` | Nuevo |
| `shared/components` | `Navbar.tsx` | Monta el buscador |
| `App.tsx` | — | Pasa `onOpenPerfil` al `Navbar` |

**Por qué `UsuarioPublicoResponse` y no un DTO nuevo.** Un DTO por endpoint parece más riguroso, pero
aquí sería peor: dos clases con los mismos cuatro campos, dos sitios donde añadir un campo por
accidente, y la diferencia entre ambas no explicaría nada. La búsqueda es "una lista de personas",
igual que los seguidores y las conexiones en común, y ese concepto ya tiene su tipo.

## La consulta

```cypher
MATCH (u:Usuario)
WHERE toLower(u.username) CONTAINS $q
   OR apoc-free-normalized(u.nombre) CONTAINS $q
...
```

La forma final, con la normalización escrita explícitamente:

```cypher
MATCH (u:Usuario)
WHERE reduce(s = toLower(u.username),
              i IN range(0, 5) |
              replace(s, ['á','é','í','ó','ú','ñ'][i], ['a','e','i','o','u','n'][i]))
          CONTAINS $q
   OR reduce(s = toLower(u.nombre),
             i IN range(0, 5) |
             replace(s, ['á','é','í','ó','ú','ñ'][i], ['a','e','i','o','u','n'][i]))
          CONTAINS $q
RETURN u.id AS id,
       u.username AS username,
       u.nombre AS nombre,
       u.avatarUrl AS avatarUrl,
       CASE
           WHEN toLower(u.username) = $q THEN 1
           WHEN toLower(u.username) STARTS WITH $q THEN 2
           WHEN toLower(u.username) CONTAINS $q THEN 3
           WHEN <nombre normalizado> STARTS WITH $q THEN 4
           ELSE 5
       END AS relevancia
ORDER BY relevancia ASC, u.username ASC
LIMIT $limite
```

### Por qué el orden es por relevancia y no alfabético

Un orden alfabético por `nombre` hace la búsqueda inusable: buscar `sil` pondría "Angel Villon"
antes que "Beatriz Silva". La escala es:

1. `username` exacto — es lo que alguien busca el 90% de las veces.
2. `username` empieza por lo buscado.
3. `username` lo contiene.
4. `nombre` empieza por lo buscado.
5. `nombre` lo contiene.

El desempate por `username` ASC hace la lista **determinista**: sin él, dos ejecuciones de la misma
búsqueda pueden devolver el mismo conjunto en distinto orden, y una prueba que espere un orden
concreto se vuelve intermitente.

**El orden no se devuelve al cliente.** Es una decisión del servidor, y devolver un ranking obligaría
al cliente a reimplementar la regla para poder respectarla. La respuesta es la lista ya ordenada.

### Por qué el `RETURN` es la primera defensa

El `RETURN` proyecta cuatro propiedades. `email`, `password` y `pushSubscriptionJson` **no entran en
la consulta**, así que no hay forma de que lleguen al driver. Es la primera defensa; la segunda es el
DTO, que no tiene dónde_mapsar un campo que no existe.

El orden importa: si el `RETURN` dijera `u` completo, el `mapearUsuario` de US-12 tendría que elegir
qué ignorar, y eso se rompe el día que alguien añade una propiedad con credenciales.

### Por qué `LIMIT` es parámetro y no una constante en el texto

`$limite` va como parámetro. Con el `20` escrito en el texto habría que reconstruir la cadena para
cambiar el tope, y las pruebas no podrían comprobar que el valor que sale es el que se pidió.

El tope es **20**, mucho menor que los 500 seguidores o las 200 publicaciones de US-12, y el motivo
es distinto: aquí la lista corta **es** el resultado esperado, porque hay un criterio de búsqueda.
Con 20 el usuario ve lo que pidió; con 500 vería un directorio con filtro, que es el defecto que
esta historia cierra.

## Normalización: la decisión y su alternativa descartada

Se calcula en la consulta. Ya está justificada en `proposal.md` D1, con la tabla de los cuatro
candidatos medidos contra Neo4j 5.20. Lo que añade este documento es el resto de las consecuencias:

**Qué se normaliza y qué no.** Se pliegan `á é í ó ú ñ` y sus mayúsculas. No se hace nada más: no se
quitan espacios, no se quitan acentos de otros alfabetos, no se colapsan espacios dobles. Cada
transformación extra es una regla que alguien tiene que recordar y que puede sorprender.

**El texto buscado se normaliza con la misma función.** Si se normalizan los datos y no la
búsqueda, buscar `Pino` con `ñ` nunca encuentra nada. Es el mismo error en el otro sentido.

**Por qué no un campo en el nodo.** Un campo `nombreNormalizado` en el nodo es más rápido y se lee
mejor en el `MATCH`, a cambio de tres costes reales:

- Todo `:Usuario` escrito antes de esta historia queda **invisible** sin ningún error.
- Hay que migrar la semilla, y con ella cualquier base de datos que ya exista.
- Un nodo guardado por una ruta que no pase por `guardarUsuario` se queda sin normalizar.

El primero es el que decide. Un fallo silencioso que esconde personas de la comunidad es peor que
un escaneo de etiqueta más lento.

**Deuda que esto deja.** Sigue siendo un escaneo de etiqueta: `reduce` + `replace` se evalúa por
nodo. Cuando la comunidad crezca, la respuesta es el índice de texto completo de Neo4j, que además
requiere decidir si se pliegan acentos (la prueba-empaquetada de este documento dice que **no** por
defecto).

## Validación en el borde

`GET /api/users/buscar?q=`

| Entrada | Respuesta | Motivo |
|---|---|---|
| `q` ausente o vacío | `400` + `error` | No es una búsqueda: es una llamada mal formada, y no puede compartir respuesta con "no hay nadie". |
| `q` de un carácter | `400` + `error` | Con 1 carácter "a" devuelve casi todo, y el endpoint se convierte en un `GET /api/users` con otro nombre. |
| `q` con 2+ caracteres | `200` con la lista | El caso normal. |

El mínimo de 2 caracteres se aplica **en el servidor y no sólo en el cliente**, por la misma razón
que `/comunes` valida sus parámetros: un cliente puede ser cualquiera, y la mitigación que sólo
existe en el navegador no mitiga nada contra un `curl`.

El cuerpo de error usa la clave `error`, que es la que `getUserFacingError` del frontend ya lee.

## Privacidad de la respuesta

`UsuarioPublicoResponse` — cuatro campos, sin correo, sin `password`, sin `pushSubscriptionJson`.

No se busca por `email` y **no se devuelve el correo aunque se buscara por él**. Buscar por correo no
aporta nada al usuario —nadie recuerda el correo de alguien a quien quiere seguir— y convierte el
endpoint en un oráculo de "este correo existe en la comunidad", que es un vector de enumeración de
correos.

**El propio usuario aparece entre los resultados si busca su propio nombre.** Excluirlo escondería un
resultado real sin que nadie lo pidiera, y alguien puede estar comprobando que su perfil se ve bien.

## El choque de rutas

`/api/users/buscar` convive con `/api/users/{userId}`. En RESTEasy Reactive el segmento literal gana
al de plantilla, así que resuelve bien, pero **eso no se verifica leyendo el código**: se verifica
subiendo el servidor. Es la razón de que exista `PerfilAjenoRutasIT`.

Tres casos que hay que cubrir con HTTP de verdad:

1. `GET /api/users/buscar?q=...` resuelve a la búsqueda.
2. `GET /api/users/{userId}` sigue resolviendo al perfil, y `buscar` no se cuela ahí.
3. `GET /api/users` responde `404`: el directorio ya no existe.

## Frontend

### `UserSearchBox`

Seis estados, y **ninguno comparte forma con otro**. Un desplegable vacío sin explicación se lee
como "no hay nadie", que es una afirmación falsa:

| Estado | Qué muestra |
|---|---|
| Sin texto | Nada. El desplegable no se abre. |
| Texto demasiado corto | "Escribe al menos 2 caracteres." — sin pedir nada al servidor |
| Cargando | Indicador, y no un desplegable vacío |
| Con resultados | Una fila por persona, cada una un botón que abre el perfil |
| Sin resultados | "No encontramos a nadie con ese texto." — explícito |
| Fallo | Mensaje de error, con `role="alert"` |

### Debounce y cancelación

Son dos problemas distintos y hacen falta los dos:

- **Debounce (250 ms).** Sin él, escribir "beatriz" dispara siete peticiones.
- **Cancelación (`AbortController`).** Con debounce y sin cancelación, las respuestas pueden llegar
  desordenadas y pintar el resultado de un texto anterior. Es un fallo de identidad: se ve el
  resultado de "beat" mientras el campo dice "beatriz".

### Cancelar la petición anterior

`buscarUsuarios(texto, signal)` pasa el `signal` a axios. El efecto de React aborta la petición en
vuelo cuando llega un texto nuevo o cuando el componente se desmonta, y descarta la respuesta si ya
no es la vigente.

### Enlace al perfil

Cada resultado llama a `onOpenPerfil(id)`, que es el mismo manejador que ya usan las sugerencias de
US-12 y el perfil ajeno. La búsqueda cierra el circuito: **buscar → resultado → perfil → seguir.**

El buscador no excluye al usuario activo de los resultados, ni los resultados entre sí: son decisiones
del backend y el frontend no las reimplementa.

## Fuera de alcance, y por qué

- **Rate limiting.** La búsqueda es un vector de enumeración de nombres y **no hay rate limiting en
  ningún endpoint de la API**. El mínimo de 2 caracteres lo mitiga; no lo arregla. Anotado como deuda
  con dueño, junto a las que ya están en el ROADMAP.
- **Autenticación.** US-01 es su dueña. Con esta historia la búsqueda queda expuesta igual que ya
  estaban `/follows` y `/followers`: es una mejora, no una solución.
- **Búsqueda difusa.** La nearer de Levenshtein. Se descartó al corregir el cURL del ticket: es una
  decisión de producto, no un arreglo de un ejemplo mal escrito.
- **Índice de texto completo.** Requiere decidir el tratamiento de acentos, y el escaneo de etiqueta
  es aceptable a esta escala.