# Proposal: US-14 (TUX-71) — Buscar usuarios

> **Ticket Linear**: `TUX-71` · **Dominio**: `social-graph` · **Prioridad**: P1 (Should Have)
> **Estimación**: 3 Story Points · **Rama Git**: `angelvilloon853/tux-71-us-14-buscar-usuarios`
> **Depende de**: US-12 (perfil ajeno)

## Intent

Como usuario de la comunidad, quiero buscar a una persona por su nombre o su nombre de usuario para
encontrarla y abrir su perfil, sin conocer su identificador de antemano.

US-12 construyó la segunda mitad de la navegación (abrir el perfil de otra persona). Falta la
primera: **encontrar** a esa persona. Hoy la única forma es adivinar el identificador
(`beatriz-silva`) y escribirlo a mano.

## El defecto previo que esta historia tiene que cerrar

`GET /api/users` devuelve **todos** los usuarios **con su correo** y **no pide autenticación**.

```
$ curl -X GET http://localhost:8080/api/users
```

`UserGraphResource.listarUsuarios()` no tiene guarda de sesión y mapea a `UsuarioResponse`, que sí
lleva `email`. No hay fuga de `password` —ese DTO no lo expone— pero el correo es un dato de
contacto que nadie pidió publicar, y sin autenticación cualquiera que sepa la URL lo lee.

Verificado antes de decidir: el frontend **no lo llama en ningún sitio**. `userApi.ts` usa
`/users/{id}`, `POST /users` para registrar y `/users/{id}/avatar`. El `GET /users` es un endpoint
**muerto en el cliente y vivo en el servidor**, que es la peor combinación posible.

Filtrar esa lista en el navegador sería el atajo más tentador y es un error: reparte un directorio
completo a cada cliente para descartar el 99%, y perpetúa la fuga. Por eso esta historia **elimina**
el endpoint y no sólo deja de usarlo.

## Decisiones previas que había que tomar antes de escribir código

### D1 — Los acentos: se normaliza en la consulta, no se añade un campo al nodo

El ticket recomienda (a) agregar `nombreNormalizado` y `usernameNormalizado` al nodo y migrar la
semilla, y (b) aceptar que `pino` no encuentre a `Patiño`. La segunda estaba descartada de entrada:
en una comunidad universitaria la mayoría de los nombres llevan `ñ`, `á` o `é`, y una búsqueda rota
para ellos no es una limitación documentada, es el producto sin función.

**Decisión: calcular la forma sin acentos dentro de la propia consulta con `reduce` + `replace`,
sin tocar el esquema y sin migrar la semilla.** Es la opción (a) en cuanto al comportamiento y la
(b) en cuanto al coste, y hay una razón técnica para que sea la única que funciona limpia. Se
verificó empíricamente contra Neo4j 5.20 real, no por intuición:

| Candidato | ¿`patino` encuentra a `Patiño`? | Por qué |
|---|---|---|
| `toLower()` puro | No | `ñ` no es `n` |
| `reduce` + `replace` en Cypher | **Sí** | Devuelve `"carlos patino"` |
| Índice full-text de Neo4j | No | El analizador no pliega `ñ` |
| `apoc.text.clean(toLower(x))` | No | **Borra los espacios**: `"carlospatino"` |
| `apoc.text.regreplace(toLower(x))` | No | **Borra la `ñ`** en vez de convertirla: `"carlos patio"` |

Las tres últimas fallan de forma silenciosa: devuelven `[]` sin error y se leen como correctas. La
cuarta además depende de un plugin. `reduce` + `replace` es la única que hace lo que promete usando
sólo funciones estándar.

El coste es que se evalúa por nodo en cada búsqueda, así que sigue siendo un escaneo de etiqueta. Es
aceptable para miles de nodos y ya lo declaraba el ticket como deuda abierta; la respuesta cuando
crezca es el índice de texto completo, que es otro trabajo.

**Lo que esta decisión evita y por qué importa:** con el campo en el nodo, cualquier `:Usuario`
creado antes de esta historia queda **invisible en búsquedas sin ningún error**. Eso incluye
registros reales, no sólo la semilla. Con la normalización en la consulta no existe ese caso: los
datos viejos se normalizan igual que los nuevos.

### D2 — El cURL de verificación del ticket dice `q=pino`, y `pino` no puede encontrar a `Patiño`

El ticket pide, en dos sitios, que buscar `pino` encuentre a `Carlos Patiño`. **Eso es imposible**, y
no por los acentos:

```
"Carlos Patiño" → normalizado → "carlos patino"
"pino" NO es subcadena de "patino"   (faltan dos letras)
```

Medido sobre Neo4j 5.20 con el dato real: `norm CONTAINS 'pino'` es `FALSE` y
`norm CONTAINS 'patino'` es `TRUE`. Da igual cómo se normalice: sin normalizar `patino` también da
`FALSE`, así que el ejemplo no distingue la opción (a) de la (b) y no prueba nada.

La normalización **sí funciona**, y el caso que lo demuestra es `q=patino` (y `q=jose` para
`José Ramírez`). Ambos son `FALSE` con `toLower()` y `TRUE` con la normalización.

**Decisión: el cURL de verificación se corrige a `q=patino`**, y queda documentado por qué `pino`
no puede funcionar. Implementar tal cual dejaría el cURL oficial del ticket devolviendo `[]`, y eso
se leería como "el campo normalizado falló" cuando lo que falla es el literal del ejemplo.

### D3 — Cerrar `GET /api/users` eliminándolo de toda la cadena

No alcanza con borrar el método del recurso: dejar `listarUsuarios()` en el caso de uso, el servicio,
el puerto y el adaptador es dejar la puerta abierta con el mismo defecto detrás. Se borra de los
cinelacros.

**`GET /api/users` responde `405`, no el `404` que pide el ticket.** El `404` no es alcanzable aquí:
`POST /api/users` —el registro de US-01— sigue declarado en esa misma ruta, así que la ruta existe y lo
que no existe es el GET, y en JAX-RS eso es "existe pero no por este método". Conseguir un `404`
exigiría borrar también el registro, lo que rompería el alta de usuarios y no es de esta historia. El
defecto queda cerrado igual —no hay forma de leer el directorio— y el `405` es más exacto que el
`404` porque distingue "no existe" de "existe pero no por GET". Medido levantando el servidor, no
supuesto: el primer intento de la prueba buscaba un `404` y falló con `405`.

## Alcance

- **Backend**:
  - `Neo4jGrafoAdapter.buscarUsuarios(texto, limite)` con orden por relevancia y `LIMIT` como
    parámetro.
  - Se **elimina** `listarUsuarios` de recurso, caso de uso, servicio, puerto y adaptador.
  - `GET /api/users/buscar?q=` con mínimo de 2 caracteres, `400` por debajo, y `UsuarioPublicoResponse`
    en la respuesta.
  - Mínimo de caracteres y validación en el borde, no sólo en el cliente.
- **Frontend**: `buscarUsuarios` en `userApi.ts` con soporte de cancelación, `UserSearchBox` en el
  `Navbar` con debounce de 250 ms, seis estados distintos y cada resultado como enlace al perfil.
- **Pruebas**: adaptador (texto de la consulta, orden, fuga), recurso (validación y forma), rutas
  HTTP reales (colisión `/buscar` vs `/{userId}`, y el `404` del directorio), y frontend.

## El choque de rutas que hay que probar

`/api/users/buscar` compite con `/api/users/{userId}`. En RESTEasy Reactive el segmento literal
gana al de plantilla, así que funciona, pero es exactamente el tipo de choque que no se ve leyendo
el código: sólo aparece cuando el servidor resuelve la URL. `PerfilAjenoRutasIT` existe para
probar esto sobre otras dos rutas (`/comunes` vs `/{userId}`, `/follows` vs `/followers`), y US-14
añade un caso más a esa misma clase de problema.

No se elige `/api/users/{userId}/search` porque se solaparía con `/{userId}/follows` y
`/{userId}/followers`.

## Fuera de alcance

- **Rate limiting.** La búsqueda es un vector de enumeración de nombres y no hay rate limiting en
  ningún endpoint de la API. El mínimo de 2 caracteres lo mitiga, no lo arregla. Se anota como
  deuda con dueño, igual que ya están las demás.
- **Autenticación en la búsqueda.** US-01 es su dueña y el ROADMAP la tiene como bloqueante.
- **Búsqueda por correo.** Aporta nada al usuario y convierte el endpoint en un oráculo de "este
  correo existe en la comunidad".
- **Búsqueda difusa.** La nearer de Levenshtein. Se descartó al corregir D2: es una decisión de
  producto, no un arreglo de un ejemplo.
- **Paginación de resultados.** El tope de 20 hace que la lista corta sea el resultado esperado.
- **Reordenar en el cliente.** El backend orden por relevancia; el cliente no conoce la regla.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Una de las cuatro técnicas de normalización falla en silencio | Se verificó cada una contra Neo4j 5.20 real antes de elegir; las tres perdedoras están documentadas en D1 |
| `q=pino` sigue devolviendo `[]` y se lee como un fallo de la normalización | D2: el cURL se corrige a `q=patino` y el motivo queda escrito en el propio ODD y en la spec |
| `/api/users/buscar` se confunde con `/api/users/{userId}` | Prueba de rutas HTTP reales; el `404` de `GET /api/users` se cubre en la misma clase |
| La búsqueda por `nombre` devuelve `"null"` como nombre | Guarda de null de US-12 aplicada, con prueba |
| Un fallo de red se pinta como "no hay nadie" | Estados separados; el desplegable vacío sin explicación está prohibido por la propia spec |
| Respuestas cruzadas pintan resultados de un texto anterior | Cancelación con `AbortController` además del debounce |

## Delta de especificación

Todo `ADDED` sobre la capability `social-graph`: la búsqueda, el cierre del directorio y las reglas
de privacidad que la sostienen. Ninguna capability existente cambia de comportamiento; lo que US-14
hace es exponer una lectura que no existía y cerrar una que sobraba.