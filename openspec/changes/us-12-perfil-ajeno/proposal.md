# Proposal: US-12 (TUX-64) — Perfil de usuario ajeno

> **Ticket Linear**: `TUX-64` · **Dominio**: `social-graph` · **Prioridad**: P1 (Should Have)
> **Estimación**: 5 Story Points · **Rama Git**: `angelvilloon853/tux-64-us-12-ver-perfil-de-usuario-ajeno-posts-seguidores-y`

> **Nota sobre la numeración.** `docs/propuesta-us-12-perfil-ajeno.md` proponía `TUX-63` y decía que
> había que verificar la numeración en Linear antes de crear la tarjeta. La tarjeta real es `TUX-64`.
> Este change usa el número verificado y el documento viejo se deja como está, porque avisaba de esta
> misma trampa y su contenido sigue siendo válido como respaldo.

## Intent

Como usuario de la comunidad, quiero abrir el perfil de cualquier otra persona para ver quién es, qué
publica y cómo me conecto con ella, sin salir de mi sesión ni cambiar de usuario.

## El estado real del código

El backend ya tenía la mitad de lo que hace falta y le faltaba la otra mitad:

- `GET /api/users/{userId}` existía y devolvía `UsuarioResponse`. El perfil se podía leer.
- `GrafoPersistencePort.obtenerSeguidos` existía. La red de una persona se podía leer.
- **No existía** ninguna lectura de las publicaciones de un autor. `obtenerFeedCronologico` mezcla
  las propias con las de los seguidos y filtra por el grafo, así que no sirve para un perfil: no hay
  forma de pedir "las publicaciones de esta persona y nada más".
- **No existía** ninguna lectura de los seguidores. `obtenerSeguidos` es la arista en un sentido y el
  perfil necesita el otro. No es un alias con el parámetro cambiado: son preguntas distintas, y con
  la semilla del proyecto dan respuestas distintas.

En el frontend no había nada: `features/user/` contenía sólo `services/userApi.ts` y
`types/user.types.ts`, sin un solo componente. El `@username` de `UserSuggestionsCard` era texto con
`hover:underline`, es decir un enlace que no llevaba a ninguna parte.

## Decisiones previas que había que tomar antes de escribir código

El ticket lists cinco defectos abiertos y tres de ellos obligaban a decidir algo, no solo a escribir
código.

### D1 — `Post.fechaCreacion` se ordena como entero

`crearPost` escribe `fechaCreacion: datetime().epochMillis`, que es un entero, y la semilla escribe el
mismo entero a mano. `obtenerTendenciasRedExtendida` lo compara contra `datetime() - duration('P7D')`,
que es una comparación entre un entero y una fecha con hora y por eso no devuelve nada.

Esta historia **no migra el campo**. Ordenar por entero da el orden cronológico correcto, así que
`ORDER BY p.fechaCreacion DESC` se queda y la lectura es `.asLong()`. El ROADMAP ya cerró esta
decisión ("comparar contra su equivalente numérico, no migrar el campo a fecha con hora desde dentro de
la historia") y esta historia la aplica. La migración del campo sigue siendo deuda con las tres
historias consumidoras a la vista.

Lo que sí cambia aquí: la publicación sin fecha se descarta con un `WHERE`. No hay una cantidad
razonable de publicaciones sin fecha, pero si las hubiera no se pueden ordenar sin inventarles una
posición, y una lista de publicaciones en un orden que no es el real no sirve.

### D2 — La guarda de `nombre` nulo se aplica a las lecturas que la habían perdido

`obtenerSeguidosEnComun` ya comprobaba si `nombre` venía nulo. `obtenerSugerenciasUsuarios` y
`obtenerSeguidos` no lo hacían, y devolvían el texto literal `"null"`: en Neo4j asignar `null` a una
propiedad la elimina, el nodo llega como `NullValue`, y `NullValue.asString()` no lanza.

No era un 500 sino algo peor: un 200 con un nombre inventado. El perfil ajeno lo vuelve visible, porque
el nombre pasa a ser el encabezado de una pantalla. Se corrigieron las dos lecturas y las dos nuevas
usan el mismo criterio.

### D3 — Ninguna lista de personas serializa el `Usuario` de dominio

`/follows` y `/comunes` devolvían `List<Usuario>`, el modelo de dominio, que lleva `password` y
`pushSubscriptionJson`. No había fuga porque esas consultas nunca llenan esas dos propiedades, así que
salían en `null`: lo frágil era el patrón. Con el perfil ajeno, una lista de seguidores se convierte
en una pantalla, y una pantalla es lo que alguien copia.

Se crea `UsuarioPublicoResponse`, que es más estrecho que `UsuarioResponse` a propósito: `UsuarioResponse`
existe para el perfil propio, se pide autenticado y por eso lleva el correo y la suscripción. Las
listas de personas no necesitan ninguno de los dos.

## Alcance

- **Backend**: `obtenerPostsDeUsuario` y `obtenerSeguidores` en el puerto, el adaptador y el servicio;
  `GET /api/posts/autor/{userId}` y `GET /api/users/{userId}/followers`; `UsuarioPublicoResponse` en
  `/follows`, `/comunes` y `/followers`.
- **Frontend**: `PerfilAjeno.tsx`, `fetchPostsDeUsuario` y `fetchSeguidores`, el `@username` de las
  sugerencias como enlace real, y el montaje de los paneles de US-09 y US-10 dentro del perfil con la
  otra persona ya fijada.
- **Pruebas**: 4 clases nuevas de adaptador, una de integración contra Neo4j real, y las de frontend.

### El parámetro `viewerId` en `GET /api/posts/autor/{userId}`

El cURL del ticket no lleva visor y tiene que seguir funcionando tal cual. Pero el perfil se abre desde
la sesión de alguien, y sin saber quién mira la tarjeta de reacción se reinicia en cada recarga: el
botón muestra "no me gusta" sobre una publicación que sí te gusta. El parámetro es opcional y sólo
cambia `likedByMe`, así que las dos formas sirven con la misma consulta: `visor` va en un `OPTIONAL
MATCH`, y `EXISTS((visor)-[:REACCIONA]->(p))` es `false` cuando `visor` es null.

## Fuera de alcance

- Migrar `Post.fechaCreacion` a fecha con hora: es la decisión que el ROADMAP dejó abierta y arrastra
  a US-04, US-05 y US-11.
- Autenticación o control de acceso en `/followers` y en `/comunes`. US-01 es su dueña y el ROADMAP la
  tiene como bloqueante. Con esta historia `/followers` queda expuesto igual que ya lo estaba
  `/follows`, y `/comunes` queda algo menos fácil de explotar porque ahora hace falta abrir un perfil
  para tener un segundo identificador. Es una mejora, no una solución.
- Una URL compartible para el perfil. El proyecto no tiene router; se naviga con estado local.
- Reordenar las publicaciones en el cliente: el backend ya las ordena y la vista respeta ese orden.
- Paginación de publicaciones y de seguidores.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Que el `OPTIONAL MATCH` del visor duplique el conteo de reacciones | `count(DISTINCT reactor)`, y una prueba de integración que mete dos reaccores y comprueba que el total es 2 y que la publicación no se duplica |
| Que abrir un perfil deje en pantalla los datos del anterior | El efecto de carga reinicia los cuatro bloques; hay una prueba que cambia de persona y comprueba que el nombre viejo desaparece |
| Que el botón de seguir contradiga a la lista de la barra lateral | Ambos leen `GET /follows` del que mira; si el botón dice "Seguir" y la red lo tiene como seguido, uno de los dos está viejo |
| Que un fallo al leer los seguidos pinte "Seguir" sobre alguien a quien ya se sigue | El botón no se pinta si la relación no se pudo comprobar |
| Devolver el `Usuario` de dominio por un endpoint nuevo | Los tres endpoints de listas van por `UsuarioPublicoResponse`, y hay pruebas que buscan la contraseña y el correo en el cuerpo de la respuesta |

## Delta de especificación

Todos los requisitos son `ADDED` sobre la capability `social-graph`, con un requisito `ADDED` sobre
`post-management` para la lectura de publicaciones por autor. Ninguna de las dos capabilities
existentes cambia de comportamiento: lo que US-12 hace es exponer lecturas que ya sabían hacerse en el
grafo y que ninguna pantalla consumía.