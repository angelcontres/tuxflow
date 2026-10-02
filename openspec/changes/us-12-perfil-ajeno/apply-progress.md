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
| `cd backend && mvn verify` | BUILD SUCCESS · 100 pruebas, 0 fallos, 13 saltadas · SpotBugs 0 bugs · Spotless limpio |
| `cd frontend && pnpm run check` | 149 pruebas verdes en 11 archivos · ESLint sin errores · Prettier limpio · `tsc` y build sin avisos |
| cURL | Verificado contra el Neo4j manual, tabla arriba |

## Deuda que queda y a quién pertenece

- **`GET /api/users/comunes` y `/followers` sin control de acceso.** Cualquiera que conozca dos
  identificadores obtiene la intersección de seguidos. US-12 no lo empeora y lo hace algo menos
  trivial: hace falta abrir un perfil para tener un segundo identificador. Sigue siendo la dueña
  US-01.
- **`Post.fechaCreacion` sigue con consumidores que asumen tres cosas.** US-12 lee y ordena como
  entero, que es lo correcto, pero `obtenerTendenciasRedExtendida` sigue comparando contra una fecha
  con hora. La migración del campo no se tocó.
- **`currentUserId` sigue sin sesión real.** El perfil ajeno se desarrolló contra la sesión
  restaurada con la pantalla de login como respaldo, que es lo que había.
- **El perfil ajeno no tiene URL.** No hay router en el proyecto, así que la navegación es estado
  local: no se puede compartir por enlace ni llegar con F5.
- **Las pruebas de integración no corren en el CI de esta máquina** mientras Testcontainers no pueda
  conectar con el socket de Docker Desktop. Conviene comprobarlas en un agente Linux antes de dar la
  historia por cerrada del todo.