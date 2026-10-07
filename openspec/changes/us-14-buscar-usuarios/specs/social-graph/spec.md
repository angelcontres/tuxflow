# Specifications: US-14 (TUX-71) — Buscar usuarios

> **Ticket Linear**: `TUX-71` · **Dominio**: `social-graph` · **Delta**: todo `ADDED`

## ADDED Requirements

### Requirement: Búsqueda de personas por nombre o nombre de usuario

La API debe permitir encontrar a una persona por su nombre o su nombre de usuario, devolverla en un
orden que ponga delante lo más relevante, y devolver lo justo para abrir su perfil. La búsqueda es la
primera mitad del circuito que el perfil ajeno de US-12 dejó a medias: **buscar → resultado → perfil
→ seguir.**

#### Scenario: Buscar por una parte del nombre

- **Dado** que existe el usuario `beatriz-silva` con nombre `Beatriz Silva`
- **Cuando** se pide `GET /api/users/buscar?q=beatriz`
- **Entonces** la respuesta es `200` y contiene a `Beatriz Silva`

#### Scenario: Buscar por una parte del nombre de usuario

- **Dado** que existe el usuario `beatriz-silva` con nombre de usuario `beatriz`
- **When** se busca `beatriz`
- **Then** aparece entre los resultados

#### Scenario: Un texto con espacio encuentra aunque el nombre de usuario no lo tenga

- **Dado** el usuario `beatriz-silva`, cuyo nombre es `Beatriz Silva` y su nombre de usuario `beatriz`
- **When** se busca `beatriz sil`
- **Then** aparece entre los resultados
- **And** el desempate no depende de que el espacio esté en el nombre de usuario

#### Scenario: Un texto sin coincidencias responde vacío, no con un error

- **Dado** que ningún usuario coincide con el texto buscado
- **When** se busca ese texto
- **Then** la respuesta es `200` con la lista vacía
- **And** no es un error: "no hay nadie" es un resultado legítimo

#### Scenario: El propio usuario puede aparecer entre los resultados

- **Dado** que quien busca es `carlos-patino`
- **When** busca su propio nombre
- **Then** aparece entre los resultados
- **And** no se excluye automáticamente: excluirlo escondería un resultado real

### Requirement: La búsqueda ignora los acentos y la eñe

En una comunidad universitaria la mayoría de los nombres llevan `ñ`, `á` o `é`. Una búsqueda que no
los tiene en cuenta parece rota para casi todo el mundo, así que la comparación se hace sobre una
forma del texto sin acentos y sin eñes.

#### Scenario: Buscar sin la eñe encuentra al que la lleva

- **Dado** el usuario `carlos-patino` con nombre `Carlos Patiño`
- **When** se busca `patino`
- **Then** aparece entre los resultados
- **And** con `toLower()` solamente, el mismo texto no lo encuentra: la normalización es lo que
  produce el resultado, no el orden alfabético

#### Scenario: Buscar con la eñe encuentra al que la tiene

- **Dado** el usuario `carlos-patino` con nombre `Carlos Patiño`
- **When** se busca `patiño`
- **Then** aparece entre los resultados

#### Scenario: Buscar con mayúsculas y sin acentos también encuentra

- **Dado** el usuario `jose-ramirez` con nombre `José Ramírez`
- **When** se busca `Jose`
- **Then** aparece entre los resultados

#### Scenario: La búsqueda no pliega subcadenas

- **Dado** el usuario `carlos-patino`, cuyo nombre normalizado es `carlos patino`
- **When** se busca `pino`
- **Then** **no** aparece entre los resultados
- **And** `pino` no es una subcadena de `patino`: falta `at`. Ninguna normalización puede hacer que
  esa consulta encuentre a esa persona

### Requirement: Los resultados van ordenados por relevancia

El orden alfabético por nombre hace la búsqueda inusable: buscar `sil` pondría a `Angel Villon` antes
que a `Beatriz Silva`. El orden lo decide el servidor, porque es el servidor el que sabe la regla.

#### Scenario: La coincidencia exacta del nombre de usuario va primera

- **Dado** que existe `beatriz` con nombre de usuario `beatriz`
- **And** existe `beatriz-2` con nombre de usuario `beatriz-2`
- **When** se busca `beatriz`
- **Then** `beatriz` va antes que `beatriz-2`

#### Scenario: El orden de relevancia es, de mayor a menor

1. coincidencia exacta de `username`
2. `username` empieza por lo buscado
3. `username` lo contiene
4. `nombre` empieza por lo buscado
5. `nombre` lo contiene

- **Dado** usuarios que coinciden en varias de estas posiciones a la vez
- **When** se ejecuta la búsqueda
- **Then** el orden de la respuesta es el de esa escala

#### Scenario: El orden es determinista

- **Dado** dos personas que coinciden en la misma posición de relevancia
- **When** se repite la misma búsqueda
- **Then** la respuesta viene en el mismo orden las dos veces

#### Scenario: El cliente no reordena

- **Dado** una respuesta ya ordenada por relevancia
- **When** la interfaz la muestra
- **Then** respeta ese orden y no lo recalcula

### Requirement: La búsqueda exige al menos dos caracteres

Con un solo carácter, `"a"` devuelve casi toda la comunidad y el endpoint se convierte en un
`GET /api/users` con otro nombre. Con dos se evita el volcado del directorio letra a letra.

Es una mitigación y no una solución: con dos caracteres también se pueden enumerar los nombres. Lo
que falta es rate limiting, que no existe en ninguna parte de la API, y queda como deuda.

#### Scenario: Con menos de dos caracteres la respuesta es un error de la petición

- **Dado** una búsqueda con un solo carácter
- **When** se pide `GET /api/users/buscar?q=a`
- **Then** la respuesta es `400` con el motivo en el cuerpo
- **And** no es una lista vacía: una llamada mal formada no puede parecerse a "no hay nadie"

#### Scenario: La interfaz ni siquiera pregunta

- **Dado** que hay menos de dos caracteres escritos en el buscador
- **When** el usuario escribe
- **Then** no se hace ninguna petición al servidor

#### Scenario: La búsqueda vacía es un error de la petición

- **Dado** una petición sin `q`, o con `q` vacío
- **When** se pide `GET /api/users/buscar`
- **Then** la respuesta es `400`

### Requirement: El directorio de usuarios no es público

`GET /api/users` devolvía la lista completa de la comunidad **con el correo de cada persona** y sin
pedir autenticación. Nadie pidió publicar ese dato de contacto, y un endpoint que lo entrega abierto
sigue delivering un directorio aunque al lado haya una búsqueda correcta.

#### Scenario: El directorio completo ya no existe

- **Dado** que hay seis usuarios en el grafo
- **When** se pide `GET /api/users`
- **Then** la respuesta es `405` y no devuelve ninguna lista de usuarios con su correo
- **And** `405` y no `404` porque `POST /api/users` —el registro de US-01— sigue declarado en esa
  misma ruta: la ruta existe y lo que no existe es el GET. Borrar también el registro para conseguir
  un `404` rompería el alta de usuarios y no es de esta historia

#### Scenario: Registrar un usuario sigue funcionando

- **Dado** que `GET /api/users` ya no existe
- **When** se envía `POST /api/users` con un perfil
- **Then** la respuesta es `201` y el usuario queda guardado

- **And** el método `listarUsuarios` desaparece de toda la cadena hexagonal: recurso, caso de uso,
  servicio, puerto y adaptador. Dejarlo en el servicio dejaría la puerta abierta con el mismo
  defecto detrás

### Requirement: La búsqueda no revela datos de sesión

La búsqueda es la lectura más amplia de la comunidad que tiene la API: cualquiera que adivine dos
letras puede preguntar por todos. Por eso la respuesta es la más estrecha posible.

#### Scenario: La respuesta no contiene correo, contraseña ni suscripción push

- **Dado** usuarios guardados con contraseña, correo y suscripción push
- **When** se busca un texto que los devuelve a todos
- **Then** cada elemento trae `id`, `username`, `nombre` y `avatarUrl`
- **And** ninguno trae `email`, `password` ni `pushSubscriptionJson`

#### Scenario: La consulta no proyecta los datos de sesión

- **Dado** el grafo con usuarios que tienen correo y contraseña
- **When** se ejecuta la búsqueda
- **Then** la consulta no proyecta esas propiedades: no hay forma de que lleguen al driver
- **And** la respuesta pública es la segunda defensa, no la única

#### Scenario: No se busca por correo

- **Dado** que existe un usuario con correo `beatriz@upse.edu.ec`
- **When** se busca `beatriz@upse.edu.ec`
- **Then** no se encuentra por ese correo
- **And** aunque se encontrara, el correo no se devolvería en los resultados

- **And** buscar por correo no aporta nada al usuario y convierte el endpoint en un oráculo de "este
  correo existe en la comunidad", que es un vector de enumeración de correos

### Requirement: Cada resultado abre el perfil

La búsqueda cierra el circuito con US-12: cada resultado es un enlace al perfil, y desde ahí se puede
seguir a la persona.

#### Scenario: El resultado abre el perfil

- **Dado** que `carlos-patino` ya sigue a `beatriz-silva`
- **When** busca `beatriz` y elige el resultado
- **Then** se abre el perfil de `beatriz-silva`

#### Scenario: Cada estado del desplegable se distingue de los demás

- **Dado** el buscador en el `Navbar`
- **When** no hay texto, hay poco texto, está cargando, no hay resultados, hay resultados, o la
  consulta falla
- **Then** cada uno de los seis estados se muestra de forma distinta
- **And** un desplegable vacío sin explicación no aparece nunca: se lee como "no hay nadie", que es
  una afirmación falsa

#### Scenario: La búsqueda no dispara una petición por tecla

- **Dado** que el usuario escribe `beatriz`
- **When** sigue escribiendo
- **Then** sólo se hace una petición por texto escrito, con un retardo de unos 250 ms

#### Scenario: Una respuesta obsoleta no se pinta

- **Dado** que hay una petición en vuelo para el texto anterior
- **When** el usuario escribe un texto nuevo
- **Then** la petición anterior se cancela
- **And** su respuesta no llega a pintarse, aunque llegue después

## Límites de la capability

- La búsqueda de personas y el cierre del directorio pertenecen a `social-graph`.
- La búsqueda por publications, etiquetas o posts no existe y no se implementa aquí: esta historia
  busca **personas**.
- El grafo, la apertura del perfil de la persona encontrada y el cálculo de distancia pertenecen a
  `social-graph` y `graph-algorithms` respectivamente.