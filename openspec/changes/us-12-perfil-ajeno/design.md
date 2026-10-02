# Design: US-12 (TUX-64) — Perfil de usuario ajeno

> **Dominio**: `social-graph` + `post-management` · **Delta**: todo `ADDED`

## 1. Grafo

No hay cambios en el esquema. Esta historia no crea nodos, relaciones ni propiedades nuevas: lee las
que ya existen. Lo que cambia es que ahora hay una forma de recorrerlas que no era un feed filtrado.

```
(:Usuario {id, username, nombre, email, avatarUrl, password, pushSubscriptionJson})
(:Post   {id, texto, mediaUrl, fechaCreacion})      -- fechaCreacion es ENTERO epochMillis
(:Usuario)-[:SIGUE]->(:Usuario)                    -- dirigido
(:Usuario)-[:PUBLICA]->(:Post)
(:Usuario)-[:REACCIONA]->(:Post)
```

El grafo no se distinguishe entre "perfil propio" y "perfil ajeno". La dirección la pone el parámetro
`userId` de cada consulta, y la relación `[:SIGUE]` es la misma que ya usa la red: no hay una arista
nueva para "el perfil que estoy mirando".

## 2. Las dos consultas nuevas

### 2.1 Publicaciones de un autor

```cypher
MATCH (autor:Usuario {id: $userId})-[:PUBLICA]->(p:Post)
WHERE p.fechaCreacion IS NOT NULL
OPTIONAL MATCH (reactor:Usuario)-[r:REACCIONA]->(p)
OPTIONAL MATCH (visor:Usuario {id: $viewerId})
RETURN p.id AS id,
       p.texto AS texto,
       p.mediaUrl AS mediaUrl,
       p.fechaCreacion AS fecha,
       autor.id AS autorId,
       autor.username AS autorUsername,
       autor.avatarUrl AS autorAvatar,
       count(DISTINCT reactor) AS totalLikes,
       EXISTS((visor)-[:REACCIONA]->(p)) AS likedByMe
ORDER BY p.fechaCreacion DESC
```

Cuatro decisiones, todas con una alternativa que se descartó:

**Sin `LIMIT`.** A diferencia del feed, que corta en 20, esta consulta devuelve todas las
publicaciones del autor. El feed es una muestra de lo que pasa ahora; un perfil es el archivo de una
persona. Poner un tope aquí haría que el perfil dejara de mostrar publicaciones sin que nada lo dijera,
que es la clase de defecto que el repositorio ya documenta en otros endpoints.

**`WHERE p.fechaCreacion IS NOT NULL`.** Una publicación sin fecha no se puede ordenar. Meterla detrás
con `coalesce` exige inventarle un número, y un número inventado es peor que una publicación que no
aparece: la lista se vería completa y estaría mal.

**El visor en un `OPTIONAL MATCH`, no en un `WHERE`.** Si fuera un `WHERE`, la consulta no devolvería
filas sin visor y el cURL del ticket, que no lo manda, respondería `[]` siempre. En un `OPTIONAL
MATCH`, `visor` queda null y `EXISTS((visor)-[:REACCIONA]->(p))` es `false`: la misma forma de consulta
sirve con y sin visor, y sin visor la respuesta es la honesta en vez de un error silencioso. Verificado
contra Neo4j 5.20: con visor inexistente la consulta sigue devolviendo las publicaciones.

**`count(DISTINCT reactor)`, no `count(reactor)`.** `obtenerFeedCronologico` cuenta con
`count(r)`, y `obtenerTendenciasRedExtendida` tuvo que pasar a `count(DISTINCT ...)` por el defecto
que el ROADMAP registra como "conteo de tendencias multiplica por caminos". Aquí hay dos `OPTIONAL
MATCH` seguidos, así que el producto cartesiano está presente: con `count(reactor)` y dos reaccores el
total saldría 2 por la suerte del plan, pero el conteo deja de depender de la suerte. Verificado contra
Neo4j real: dos reaccores distintos dan 2, y la publicación no aparece dos veces.

El mapeo es el mismo que en `obtenerFeedCronologico`, incluidas las guardas de null de `mediaUrl` y
`autorAvatar`, y con `.asLong()` en la fecha. No se unifica en un método compartido: las dos
consultas proyectan cosas distintas y se leen mejor por separado, pero la lectura de los valores es
idéntica y por eso vive en un `mapearPostDeAutor` propio.

### 2.2 Seguidores

```cypher
MATCH (s:Usuario)-[:SIGUE]->(u:Usuario {id: $userId})
RETURN s.id AS id, s.username AS username, s.nombre AS nombre, s.avatarUrl AS avatarUrl
ORDER BY s.username ASC
```

La flecha entra por el perfil que se mira. Invertirla devolvería a quién sigue, que es
`obtenerSeguidos`, y con la semilla del proyecto eso no da un error: da la lista espejo, que es una
respuesta verosímil y equivocada al mismo tiempo. La semilla tiene el caso que lo hace visible:
`elena-vega` sigue a `carlos-patino` y a `paulo-orrala`, así que `carlos-patino` tiene una seguidora y
no tiene a nadie de esos dos entre sus seguidos.

El `ORDER BY` es por `username` y no por `id` a propósito: las dos listas se muestran una al lado de la
otra en el perfil, y ordenarlas por la misma columna las hace comparables. Sin el `ORDER BY`, Neo4j no
garantiza orden y la lista cambiaría entre peticiones.

Comparte el mapeo con `obtenerSeguidos` mediante `mapearUsuarioDeRelacion`, con la guarda de `nombre`
nulo. El `DESIGN D2` del proposal explica el mecanismo: en Neo4j asignar null a una propiedad la
elimina, y `NullValue.asString()` devuelve el texto literal `"null"` sin lanzar.

## 3. Puertos y adaptadores

```
                      ┌─────────────────────────────────────────┐
  GET /api/posts/     │ PostResource                            │
  autor/{userId} ────▶│   └─ CrearPostUseCase                   │
  ?viewerId=          │       └─ PostApplicationService        │
                      │           └─ GrafoPersistencePort      │──▶ Neo4jGrafoAdapter
                      │               .obtenerPostsDeUsuario() │    (Neo4j)
  GET /api/users/     ├─────────────────────────────────────────┤
  {userId}/followers │ UserGraphResource                      │
  ──────────────────▶│   └─ GestionarGrafoSocialUseCase        │
                      │       └─ UserGraphApplicationService    │
                      │           └─ GrafoPersistencePort      │──▶ Neo4jGrafoAdapter
                      │               .obtenerSeguidores()     │
                      └─────────────────────────────────────────┘
```

`obtenerPostsDeUsuario` va por `CrearPostUseCase` y no por `GestionarGrafoSocialUseCase` porque es la
tercera lectura de `PostResource` y el recurso ya tiene ese caso de uso inyectado. Meter una lectura de
publicaciones en el caso de uso del grafo social sería una acquaintance de más entre Posting y Grafos
que la historia no necesita.

`obtenerSeguidores` sí va por `GestionarGrafoSocialUseCase`, que ya expone `obtenerSeguidos`: seguir y
dejar de seguir son de la misma capability que seguir y dejar de seguir.

El puerto `GrafoPersistencePort` no cambia de forma: sigue siendo "el grafo dice". No se filtra detalle
de Neo4j hacia arriba; la decisión de descartar las publicaciones sin fecha vive en el adaptador, que
es donde se puede tomar.

## 4. El contrato de salida de las listas de personas

```
UsuarioPublicoResponse        UsuarioResponse          UsuarioResponse es el perfil
├─ id                         ├─ id                     propio: se pide autenticado
├─ username                   ├─ username
├─ nombre                     ├─ email                  UsuarioPublicoResponse no lleva
└─ avatarUrl                  ├─ nombre                 email ni pushSubscriptionJson:
                              ├─ avatarUrl              son de la sesión, no de la red.
                              └─ pushSubscriptionJson
```

`UsuarioResponse` se queda como está porque el perfil propio sí necesita el correo. Lo que cambia es
que ninguna lista de personas lo usa.

El nombre del DTO dice lo que hace: `Publico`. Un `UsuarioResumen` habría sido igual de bueno y más
corto, pero `Publico` deja claro en el sitio donde se lee de qué está y de qué no.

`nombre` puede venir null, y el tipo del frontend lo declara `string`. Eso no se cambia aquí porque
`Usuario` en `network.types.ts` es el tipo que ya usaba `/follows`, y cambiarlo obliga a revisar las
tres feature que lo consumen. El componente ya trata el caso con `|| `@${username}`` en todas partes,
que es la forma correcta de no mostrar un nombre inventado.

## 5. Sin router

El proyecto tiene `react`, `react-dom`, `axios` y `lucide-react`. No hay router, y meter
`react-router-dom` para resolver lo que aquí son dos vistas del mismo sitio significa rehacer el layout
y el Navbar. La navegación es un `perfilAjenoId` en el estado de `App`.

La consecuencia honesta: un perfil ajeno no tiene URL, así que no se puede compartir por enlace ni
llegar con F5. Es un límite conocido, no un olvido, y se anota en el proposal.

## 6. Un perfil, cuatro bloques independientes

`PerfilAjeno` no tiene un `cargando` único. Cada bloque —perfil, publicaciones, seguidores, distancia—
tiene su propio estado discriminado, y el efecto de carga los reinicia todos cuando cambia el
identificador.

Sin esto, abrir el perfil de otra persona deja en pantalla el nombre de la anterior hasta que llegan los
datos nuevos: se ve "Beatriz Silva" con las publicaciones de Carlos. Es un fallo de identidad, y por eso
el reinicio va en el mismo efecto que dispara las cuatro peticiones.

El estado inicial del botón de seguir sale de `GET /api/users/{viewerId}/follows`, que es la misma
fuente que alimenta la lista de la barra lateral. Si el botón y la lista se contradicen, uno de los dos
está viejo, y compartir la fuente hace que eso no pueda pasar por construcción. Si la petición falla, el
botón no se pinta: un botón que afirma una relación que no se comprobó puede perder el seguimiento de
otra persona.

## 7. Montaje de US-09 y US-10 dentro del perfil

`ConexionesComunesPanel` gana dos props opcionales:

| | Barra lateral | Dentro del perfil |
|---|---|---|
| `otroUsuarioId` | ausente | el identificador del perfil abierto |
| Campo de texto | visible | ausente |
| Consulta | al pulsar Buscar | al montar y al pulsar Actualizar |
| Rótulo | `con @{{currentUsername}}` | `con @{{otroUsername}}` |

Es dual y no sólo preseleccionado por dos razones. La primera es que el componente ya funciona y sus
veinte pruebas cubren el campo, el error y la lista vacía: borrarlo tiraría comportamiento que alguien
usa por la barra lateral, donde todavía no hay ninguna persona elegida. La segunda es que los dos modos
comparten el mismo `consultar`, así que el camino de la consulta se ejercita igual en los dos.

El `useEffect` que consulta al montar depende de `[fijado, otroUsuarioId, currentUserId]` y no del
nombre, porque cambiar de etiqueta no cambia la pregunta. La lista de `exhaustive-deps` está
deshabilitada a propósito y con comentario: `consultar` se recrea en cada render, y sacarla a un
`useCallback` obligaría a depender de su identidad y volvería a dispararse el efecto.

`UserSuggestionsCard` recibe `onOpenPerfil?`, también opcional. Sin él el `@username` vuelve a texto y
no promete nada: es preferible a un enlace que no hace nada. El rótulo accesible
(`Ver perfil de @{{username}}`) importa porque la fila ya tiene tres botones y sin rótulo el enlace se
confunde con el de seguimiento.

## 8. Lo que esta historia no arregla

- `currentUserId` sigue viniendo de la sesión restaurada, con la pantalla de login como respaldo. El
  defecto abierto de US-01 no se toca aquí.
- `/comunes` y `/followers` no tienen control de acceso. Nadie que no sea el propio usuario puede leer la
  red de otra persona. Cuando aterrice US-01 hay que revisarlo, y el ROADMAP ya lo tiene anotado.
- `formatFecha` del feed resuelve formato relativo y esta historia sólo necesita fecha absoluta, así
  que `PerfilAjeno` tiene su propio `formatearFecha` de una línea. Duplicarlo es preferible a cruzar
  `features/user` con `features/feed` por un dato de una línea; si mañana se unifican, el lugar es
  `formatFecha`.