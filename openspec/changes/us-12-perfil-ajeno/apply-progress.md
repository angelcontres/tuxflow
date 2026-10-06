# Apply Progress: US-12 (TUX-64) — Perfil de usuario ajeno

> **Change**: `us-12-perfil-ajeno` · **Ticket**: `TUX-64` · **Rama**:
> `angelvilloon853/tux-64-us-12-ver-perfil-de-usuario-ajeno-posts-seguidores-y`
> **Contrato seguido**: `design.md` (D1–D3, §1–§8) y los dos `specs/`.

## Estado

Aplicado completo. Backend y frontend verdes.

| Fase | Tareas | Estado |
|---|---|---|
| 1. Puertos y adaptadores de salida [back] | 14 | Completa |
| 2. Servicios y recursos REST [back] | 10 | Completa |
| 3. Pruebas de contrato [back] | 8 | Completa, con una salvedad (ver abajo) |
| 4. Cliente HTTP y navegación [front] | 5 | Completa |
| 5. Componentes de UI [front] | 13 | Completa |
| 6. Pruebas de interfaz e integración [both] | 5 | Completa |
| Segunda vuelta (revisión) | 3 | Completa: D4, D5, D6 |

## Decisiones aplicadas

Las tres de `proposal.md` se aplicaron como estaban escritas:

- **D1** — `ORDER BY p.fechaCreacion DESC` sobre entero, lectura con `.asLong()`, `WHERE
  p.fechaCreacion IS NOT NULL`. No se migró el campo.
- **D2** — Guarda de `nombre` nulo añadida en `obtenerSugerenciasUsuarios` y `obtenerSeguidos`, y las
  dos lecturas nuevas la usan.
- **D3** — `UsuarioPublicoResponse` en los tres endpoints de listas.

## Desviación respecto al plan: los `*IT` corren en Surefire

`tasks.md` (fase 3) decía recoger los `*IT` con `maven-failsafe-plugin`. **No se pudo**: el artefacto
del plugin no está en el repositorio local de esta máquina y el build corre sin acceso a Maven Central.
Añadirlo dejó el proyecto sin poder compilar, así que el plan cambió a dos partes:

1. Los `*IT` se recogen en Surefire, con el motivo escrito en el POM. El resultado observable es el
   mismo: las consultas se ejecutan contra un Neo4j de verdad.
2. `Neo4jGrafoAdapterPerfilAjenoIT` levanta y apaga el contenedor a mano en lugar de usar
   `@Testcontainers`, porque la extensión de Testcontainers para JUnit 5 tampoco está en el
   repositorio local.

Si algún día hay red, se revierte: failsafe para los `*IT` y `@Testcontainers` para el contenedor.

## Salvedad de verificación: las pruebas de integración se saltaron

`mvn verify` pasa en verde con 100 pruebas, de las cuales **13 saltadas**: las de
`Neo4jGrafoAdapterPerfilAjenoIT`. Docker está instalado en esta máquina pero Testcontainers no logra
conectarse: el socket npipe de Docker Desktop devuelve una respuesta malformada y el cliente aborta
con un `BadRequestException`. `docker run` sí funciona, así que el daemon está vivo y el problema es de
negociación del cliente, no de ausencia de Docker.

**Las consultas se verificaron de todos modos**, levantando un Neo4j 5.20 a mano con `docker run`,
sembrando un grafo con la misma forma de `docker/neo4j-seed.cql` y ejecutando por `cypher-shell` las
dos consultas nuevas:

| Comprobación | Resultado |
|---|---|
| Publicaciones de `beatriz-silva` | 2 filas, `post-b2` antes que `post-b1` |
| Publicación sin fecha | Descartada por el `WHERE` |
| `fechaCreacion` en la respuesta | Entero (`1727270000000`), no texto |
| Texto con `ñ`, tilde y emoji | Conservado |
| Dos reaccores distintos | `totalLikes = 2` y la publicación aparece una vez |
| `viewerId` válido | `likedByMe = TRUE` sólo en la publicación reagida |
| `viewerId` inexistente | Consulta válida, devuelve las publicaciones, `likedByMe = FALSE` |
| Autor inexistente | Sin filas, sin error |
| Seguidores de `beatriz-silva` | `carlos-patino` |
| Seguidores de `paulo-orrala` | `carlos-patino` |
| Seguidos de `paulo-orrala` | `beatriz-silva`, no `carlos-patino` |

La fila de seguidores y la de seguidos son distintas en el par Carlos/Paulo, que es el caso que la
semilla de `docker/neo4j-seed.cql` ya documentaba para US-09. Eso descarta la flecha invertida.

El contenedor y la red se limpiaron después.

## Verificación

| Comando | Resultado |
|---|---|
| `cd backend && mvn verify` | BUILD SUCCESS · 110 pruebas, 0 fallos, 13 saltadas · SpotBugs 0 bugs · Spotless limpio |
| `cd frontend && pnpm run test` | 149 pruebas verdes en 11 archivos |
| `cd frontend && pnpm run lint` | 0 errores |
| `cd frontend && pnpm run build` | `tsc` sin errores, build sin avisos |
| `cd frontend && pnpm exec prettier --check` sobre los archivos tocados | Limpio |
| cURL | Verificado contra el Neo4j manual, tabla arriba |

> `pnpm run check` sigue fallando en `format:check` por 5 archivos de `features/feed/` que esta
> historia no toca. Se comprobó con `git stash` que el fallo es previo: es del `develop`. La decisión
> fue no arreglarlo aquí para no meter formato ajeno en el diff de US-12.

## Segunda vuelta: defectos encontrados en revisión

Después de entregar, una revisión encontró tres problemas reales en lo ya hecho. Los tres eran míos.

### D4 — `PerfilAjeno` mostraba las fechas en un formato distinto al feed

Se había duplicado la lógica de fecha en `PerfilAjeno.tsx` con el argumento de que importar
`formatFecha` cruzaba features "por un dato de una línea". El argumento era falso: `formatFecha` es una
función pura en `features/feed/utils/`, sin dependencias del feed. Y la copia además estaba mal:

| | hace 8 días |
|---|---|
| `PostCard` (feed) | `4 ago 2026` |
| `PerfilAjeno` (perfil) | `04/08/2026` |

La misma publicación se leía de dos maneras según dónde. La copia además devolvía `''` ante una fecha
inválida donde `formatFecha` devuelve `'Reciente'`. Corregido importando `formatFecha`. Los dos
formatos son ahora el mismo.

### D5 — `nombre` seguía declarado obligatorio cuando puede no venir

`user.types.ts` declaraba `nombre: string`. Es falso: `guardarUsuario` hace `SET u.nombre = $nombre`, y
en Neo4j asignar `null` a una propiedad la elimina, así que un usuario guardado sin nombre llega sin
la propiedad. `ConexionesComunesPanel` lo tenía documentado desde US-09; `PerfilAjeno` heredó la
mentira y se defendió con `|| username || '?'` en cuatro sitios.

La razón para no tocarlo, escrita en `design.md` §4, era que cambiarlo obligaría a revisar tres
features. Es un motivo malo: el coste ya se estaba pagando en código nuevo. Pasó a `nombre?: string`,
`tsc` limpio sin tocar los otros consumidores. El `Usuario` de `network.types.ts` mantiene
`nombre: string` a propósito, porque ahí sí se sabe qué consultas lo llenan.

### D6 - No había prueba de que las rutas resolvieran

Todas las pruebas llamaban al método Java del recurso, así que pasaban aunque la ruta no existiera,
aunque dos rutas se pisen o aunque el DTO no serializara como se cree. Un choque de rutas sería un
404 en el navegador sin que nada lo detectara.

`quarkus-junit5-mockito` no está en el repositorio local y el build corre sin Maven Central, así que
`@InjectMock` no es una opción aquí. Se escribió `PerfilAjenoRutasIT`, que sube el servidor y pregunta
por URL con RestAssured. Como los casos de uso reales corren contra un Neo4j que no está levantado, la
aserción es **"no 404"** y no "200": un 404 significa que ninguna ruta corresponde a esa URL, que es
justo el fallo buscado; un 500 significa que la ruta resolvió y el adaptador falló al preguntar al
grafo, que también es información válida.

Cubre diez casos, con emphasis en los que sólo se ven cuando el servidor resuelve:
`/autor/{id}` frente a `/{postId}/like` y `/tendencias/{id}`, `/followers` frente a `/follows`
(que difieren en una letra) y frente a `/comunes` (literal contra `{userId}`), y el `GET /api/posts/autor`
sin identificador, que no debe convertirse en lectura por la ruta de like.

El bloque de `quarkus-junit5-mockito` queda **comentado** en el POM con el motivo. Descomentado
comprueba el cuerpo de las respuestas y no sólo que la ruta resuelve, pero deja el proyecto sin
compilar mientras no se resuelva el artefacto.

### D7 - El autor de cada publicación se enlazaba al perfil que ya se está viendo

Las publicaciones de un perfil las escribió esa misma persona, así que el `@username` de cada una
era un enlace que recargaba lo que ya estaba en pantalla. Ahora es texto plano cuando
`post.autorId === usuarioId`, y sigue siendo enlace cuando no coincide.

La comparación es por identificador y no por nombre de usuario, porque es el identificador lo que
viaja en la ruta del endpoint. La prueba comprueba que las dos apariciones de `@beatriz` —el subtítulo
del encabezado y el autor de la publicación— no son botones.

### D8 - Las consultas no tenían tope

`obtenerPostsDeUsuario` y `obtenerSeguidores` devolvían todo. Se añade un `LIMIT` como parámetro, con
constantes con nombre junto al adaptador: 200 publicaciones y 500 seguidores.

El criterio para no subir los números: los dos están por encima de lo que publica o sigue cualquier
cuenta real de una comunidad universitaria, así que en la práctica no se ven. La respuesta correcta
si alguna vez se ven es paginar, no subir el número, y eso es otra historia.

El `LIMIT` es parámetro y no un número escrito en el texto del Cypher, con una aserción que fija el
valor en las pruebas unitarias. Un número en el texto obligaría a editar la consulta para cambiarlo, y
esa es la forma en que un tope se vuelve invisible para quien lee el código.

**Consecuencia asumida:** la lista de un perfil con más de 200 publicaciones se corta sin avisar. Es
un defecto conocido a cambio de no agotar la memoria del servidor. La alternativa no es un contador
—"mostrando 200 de 3.000"— sino scroll infinito, y está redactada en
`docs/propuesta-us-13-scroll-infinito.md`. Esa propuesta además documenta por qué el cursor no puede
ser sólo la fecha: `fechaCreacion` no es única, así que hacen falta fecha e `id` juntos.

## Deuda que queda y a quién pertenece

- **`GET /api/users/comunes` y `/followers` sin control de acceso.** Cualquiera que conozca dos
  identificadores obtiene la intersección de seguidos. US-12 no lo empeora y lo hace algo menos
  trivial: hace falta abrir un perfil para tener un segundo identificador. Sigue siendo la dueña
  US-01.
- **`Post.fechaCreacion` sigue con consumidores que asumen tres cosas.** US-12 lee y ordena como
  entero, que es lo correcto, pero `obtenerTendenciasRedExtendida` sigue comparando contra una fecha
  con hora. La migración del campo no se tocó.
- **`nombre` sigue declarado obligatorio en `network.types.ts`.** Es cierto para las consultas que lo
  llenan, pero el tipo no lo admite y el mismo campo llega de tres consultas distintas. Harmonizarlo
  es trabajo de la feature que posea esas consultas, no de esta.
- **`currentUserId` sigue sin sesión real.** El perfil ajeno se desarrolló contra la sesión
  restaurada con la pantalla de login como respaldo, que es lo que había.
- **El perfil ajeno no tiene URL.** No hay router en el proyecto, así que la navegación es estado
  local: no se puede compartir por enlace ni llegar con F5.
- **Las pruebas de integración no corren en el CI de esta máquina** mientras Testcontainers no pueda
  conectar con el socket de Docker Desktop. Conviene comprobarlas en un agente Linux antes de dar la
  historia por cerrada del todo.
