# Specifications: US-12 (TUX-64) — Perfil de usuario ajeno

> **Ticket Linear**: `TUX-64` · **Dominio**: `social-graph` · **Delta**: todo `ADDED`

## ADDED Requirements

### Requirement: Lectura de los seguidores de un perfil

La API debe exponer quién sigue a una persona, en la dirección contraria a los seguidos. Son dos
preguntas distintas sobre la misma arista y no una respuesta interchangeable: un perfil que muestra la
red de alguien necesita las dos.

#### Scenario: Devolver las personas que siguen al perfil

- **Dado** el grafo `(:Usuario)-[:SIGUE]->(:Usuario)` con `carlos-patino -> beatriz-silva`
- **Cuando** se pide `GET /api/users/beatriz-silva/followers`
- **Entonces** la respuesta es `200` con una lista que contiene a `carlos-patino`
- **Y** no contiene a `beatriz-silva`, porque seguir no es simétrico

#### Scenario: No confundir seguidores con seguidos

- **Dado** `carlos-patino -> paulo-orrala` y que `paulo-orrala` no sigue a `carlos-patino`
- **Cuando** se pide `GET /api/users/paulo-orrala/followers`
- **Entonces** la respuesta contiene a `carlos-patino`
- **Y** `GET /api/users/paulo-orrala/follows` contiene a `beatriz-silva` y no a `carlos-patino`

#### Scenario: Un perfil sin seguidores

- **Dado** un usuario al que nadie sigue
- **Cuando** se pide `GET /api/users/{id}/followers`
- **Entonces** la respuesta es `200` con la lista vacía, no un error

#### Scenario: La lista de seguidores tiene un tope

- **Dado** un perfil con más seguidores que el tope del endpoint
- **Cuando** se pide `GET /api/users/{id}/followers`
- **Entonces** la respuesta trae como máximo 500
- **Y** el tope no lo decide el cliente: no es un parámetro de la petición

> Igual que las publicaciones, la lista se corta sin avisar. Una cuenta con más de 500 seguidores ya es
> una cuenta pública en una comunidad universitaria, así que el recorte no debería verse. Si se ve, la
> respuesta es paginar.

### Requirement: Ninguna lista de personas expone datos de sesión

Las listas de seguidores, seguidos y conexiones en común se componen de datos de otras personas. Ninguna
de ellas puede devolver la contraseña, el correo ni la suscripción de push de quien aparece en la lista,
porque son datos de la sesión y no de la red.

#### Scenario: La respuesta de una lista no contiene campos del dominio

- **Dado** un usuario guardado con contraseña y suscripción push
- **Cuando** se pide `GET /api/users/{id}/follows`, `/followers` o `/comunes`
- **Entonces** la respuesta no contiene `password`, `email` ni `pushSubscriptionJson`
- **Y** cada elemento trae `id`, `username`, `nombre` y `avatarUrl`

#### Scenario: El perfil propio sí conserva su correo

- **Dado** el usuario de la sesión
- **Cuando** se pide `GET /api/users/{id}`
- **Entonces** la respuesta conserva `email` y `pushSubscriptionJson`
- **Y** sigue sin exponer `password`

### Requirement: Un nombre ausente no se convierte en el texto "null"

En Neo4j asignar `null` a una propiedad la elimina, así que un usuario guardado sin nombre llega a las
lecturas como un valor nulo. Ninguna lectura de personas puede devolver el texto literal `"null"` como
nombre, porque ese nombre se renderiza como si fuera real y no hay forma de distinguirlo de uno
verdadero desde la interfaz.

#### Scenario: Un usuario sin nombre en la lista de seguidores

- **Dado** un `:Usuario` guardado sin `nombre`
- **Cuando** se lee su lista de seguidores, de seguidos o de conexiones en común
- **Entonces** el elemento llega con `nombre` en `null`
- **Y** no con la cadena `"null"`

#### Scenario: La interfaz degrada al identificador

- **Dado** una persona cuyo nombre llegó ausente
- **Cuando** se muestra en el perfil
- **Entonces** se muestra `@` seguido de su nombre de usuario
- **Y** el avatar degrada a la inicial, que siempre se puede calcular porque el identificador está

### Requirement: Perfil de otra persona en la interfaz

La aplicación debe permitir abrir el perfil de cualquier persona sin cerrar la sesión ni cambiar de
usuario, y mostrar quién es, qué publica y cómo se conecta el usuario activo con ella.

#### Scenario: Abrir un perfil desde la red

- **Dado** que `carlos-patino` ha iniciado sesión
- **Y** que `UserSuggestionsCard` muestra una sugerencia `beatriz-silva`
- **Cuando** pulsa el `@beatriz` de esa fila
- **Entonces** la vista deja de mostrar el feed y muestra el perfil de `beatriz-silva`
- **Y** se piden `GET /api/users/beatriz-silva`, `GET /api/posts/autor/beatriz-silva` y
  `GET /api/users/beatriz-silva/followers`

#### Scenario: El encabezado degrada sin nombre y sin avatar

- **Dado** que la persona consultada no tiene `nombre` ni `avatarUrl`
- **Cuando** se abre su perfil
- **Entonces** el encabezado muestra `@` seguido de su nombre de usuario
- **Y** el avatar muestra la inicial de ese identificador

- **Y** si el avatar viene con una URL que no carga, el perfil vuelve a la inicial

#### Scenario: Distinguir un perfil sin publicaciones de un fallo

- **Dado** que la persona no ha publicado nada
- **Cuando** se abre su perfil
- **Entonces** se comunica que no ha publicado, sin rol de alerta
- **Y** un fallo de la petición se comunica con rol de alerta, sin tapar el resto del perfil

#### Scenario: Volver a la vista anterior

- **Dado** que se está mirando el perfil de otra persona
- **Cuando** se pulsa "Volver"
- **Entonces** se vuelve al feed y al formulario de publicación
- **Y** el identificador del perfil abierto se descarta

#### Scenario: El perfil ajeno no sobrevive a un cambio de sesión

- **Dado** que se está mirando el perfil de otra persona
- **Cuando** se cierra la sesión
- **Entonces** el perfil abierto se descarta, para que la siguiente sesión no lo herede

### Requirement: El botón de seguir refleja la relación real

El perfil de otra persona debe ofrecer seguir o dejar de seguir según exista la relación `[:SIGUE]`, y
el estado inicial no puede ser una suposición.

#### Scenario: Mostrar el estado que corresponde

- **Dado** que `GET /api/users/carlos-patino/follows` contiene a `beatriz-silva`
- **Cuando** se abre el perfil de `beatriz-silva`
- **Entonces** el botón dice "Dejar de seguir"
- **Y** si no lo contiene, el botón dice "Seguir"

#### Scenario: El estado inicial y la red lateral no se contradicen

- **Dado** que el perfil se abre desde la lista de la barra lateral
- **Cuando** el botón dice "Seguir"
- **Entonces** `beatriz-silva` no aparece entre los seguidos en esa misma barra lateral

#### Scenario: No afirmar una relación que no se comprobó

- **Dado** que la petición de seguidos falla
- **Cuando** se abre un perfil ajeno
- **Entonces** no se muestra ningún botón de seguimiento, en vez de afirmar una relación desconocida

#### Scenario: Seguir y dejar de seguir desde el perfil

- **Dado** que se está mirando el perfil de `beatriz-silva` sin seguirla
- **Cuando** se pulsa "Seguir"
- **Entonces** se llama a `POST /api/users/carlos-patino/follow/beatriz-silva`
- **Y** si ya se la seguía y se pulsa "Dejar de seguir", se llama a
  `DELETE /api/users/carlos-patino/follow/beatriz-silva`
- **Y** un fallo revierte el botón y se comunica con rol de alerta

#### Scenario: No ofrecer seguir sobre el propio perfil

- **Dado** que se abre el propio identificador
- **Entonces** no hay botón de seguimiento, porque la pregunta no tiene sentido

### Requirement: Conexiones en común y distancia desde el perfil ajeno

Desde el perfil de otra persona debe poder consultarse la intersección de seguidos y la distancia de
separación con el usuario activo, sin que ninguna de las dos requiera escribir un identificador. El
campo de texto de US-09 existía porque no había un perfil ajeno donde elegir a la otra persona.

#### Scenario: La consulta de conexiones sale sola al abrir el perfil

- **Dado** que se abre el perfil de `beatriz-silva` desde la sesión de `carlos-patino`
- **Entonces** se consulta `GET /api/users/comunes` con `userA=carlos-patino` y `userB=beatriz-silva`
- **Y** el panel no tiene campo de texto

#### Scenario: El panel conserva su campo donde todavía se necesita

- **Dado** que el panel se muestra en la barra lateral, sin ninguna persona elegida
- **Entonces** mantiene su campo de texto
- **Y** no consulta nada hasta que se pulse "Buscar"

#### Scenario: El rótulo nombra a la otra persona, no al usuario activo

- **Dado** que el panel está montado dentro del perfil de `beatriz-silva`
- **Cuando** encuentra conexiones en común
- **Entonces** el resultado dice cuántas hay "con @beatriz", no "con @carlos"

#### Scenario: Calcular la distancia desde el perfil

- **Dado** que se está mirando el perfil de `beatriz-silva`
- **Cuando** se pulsa el botón de distancia
- **Entonces** se consulta `GET /api/users/camino-corto` con `origen` igual al usuario activo y
  `destino` igual a la persona del perfil

#### Scenario: La ausencia de conexión no es un fallo

- **Dado** que no hay camino dentro de los seis grados
- **Entonces** se informa como resultado, sin rol de alerta
- **Y** un fallo de la petición se informa con rol de alerta

### Requirement: Enlace al perfil desde otras listas

Los `@username` que aparecen en otras pantallas deben llevar al perfil de esa persona, no sólo
parecerlo.

#### Scenario: Un username es un enlace real

- **Dado** que `UserSuggestionsCard` recibe `onOpenPerfil`
- **Entonces** el `@username` de cada fila es un botón con nombre accesible
  "Ver perfil de @{{username}}"
- **Y** al pulsarlo se llama a `onOpenPerfil` con el identificador de la fila, no con el nombre de usuario

#### Scenario: Sin manejador, no hay enlace

- **Dado** que `UserSuggestionsCard` se monta sin `onOpenPerfil`
- **Entonces** el `@username` es texto sin `hover:underline`

#### Scenario: Seguir desde una lista de seguidores

- **Dado** que el perfil muestra sus seguidores
- **Cuando** se pulsa uno de ellos
- **Entonces** se abre el perfil de esa persona

#### Scenario: El autor no se enlaza al perfil que ya se está viendo

- **Dado** que se está mirando el perfil de `beatriz-silva`
- **Y** sus publicaciones las escribió ella
- **Entonces** el `@beatriz` de cada publicación es texto, no un enlace
- **Y** no recargar el perfil es lo esperado: el enlace llevaría a la pantalla que ya se está viendo

- **Y** si una publicación viniera de otra persona, su autor sí sería un enlace a su perfil