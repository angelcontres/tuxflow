# Delta Spec: user-identity (US-01)

> **Ticket**: `TUX-52` — US-01: User registration, session and profile with MinIO avatar. **Asignada a Angel Villon** (equipo TuxDev: Paulo, Carlos Patiño, Angel Villon).
>
> Este delta describe el **estado objetivo**. No lleva anotaciones `Estado:` — esas son del spec durable, que documenta la realidad verificada del código. Al archivarse, estos requisitos se consolidan en `openspec/specs/user-identity/spec.md`.
>
> Decisiones de diseño de referencia: `openspec/changes/us-01-user-identity/design.md` (D1–D10).

---

## MODIFIED Requirements

### Requirement: Registro de usuario

El sistema DEBE permitir crear un usuario persistiendo su nodo `:Usuario` en el grafo, validando la entrada en el borde REST y rechazando cualquier intento de sobrescribir un usuario existente.

#### Scenario: Registro exitoso

- **GIVEN** un payload con `id`, `username`, `email` y `nombre` válidos
- **WHEN** se envía `POST /api/users`
- **THEN** el nodo `:Usuario` queda persistido vía `GrafoPersistencePort.guardarUsuario()`
- **AND** la respuesta es `201 Created` con el JSON del usuario

#### Scenario: Registro con payload incompleto

- **GIVEN** un payload sin `id`, o sin `username`, o con `email` de formato inválido
- **WHEN** se envía `POST /api/users`
- **THEN** la respuesta es `400 Bad Request` con el detalle de cada campo rechazado

#### Scenario: Registro con `id` duplicado

- **GIVEN** un `id` que ya existe en el grafo
- **WHEN** se envía `POST /api/users` con ese mismo `id`
- **THEN** la respuesta es `409 Conflict`
- **AND** el nodo `:Usuario` existente **permanece intacto**: ningún campo suyo se sobrescribe

> Este es el comportamiento que `MERGE` hoy impide. La implementación debe usar `CREATE` y propagatingar la violación de `unique_user_id`, o un mecanismo atómico equivalente. Un `MATCH` previo sin atomicidad no satisface el escenario bajo concurrencia.

#### Scenario: `avatarUrl` rechazado en el payload de registro

- **GIVEN** un payload de registro que incluye `avatarUrl`
- **WHEN** se envía `POST /api/users`
- **THEN** el campo se ignora y el usuario se crea con `avatarUrl` nulo
- **AND** el avatar solo puede asignarse por el endpoint de subida dedicado

> Ignorar el campo evita que un usuario referencie una imagen arbitraria externa. El campo no debe eliminarse del contrato, para no romper clientes ya existentes.

---

### Requirement: Unicidad de username

El sistema DEBE garantizar que el `username` sea único entre todos los usuarios, porque es la clave de búsqueda de la autenticación.

#### Scenario: Registro con `username` duplicado

- **GIVEN** un `username` que ya pertenece a otro usuario
- **WHEN** se envía `POST /api/users` con ese `username`
- **THEN** la respuesta es `409 Conflict`
- **AND** no se crea el segundo usuario

#### Scenario: Login sin ambigüedad

- **GIVEN** un `username` existente
- **WHEN** se solicita `POST /api/auth/login`
- **THEN** el sistema resuelve **exactamente un** usuario y verifica sus credenciales

> **Deuda que este delta cierra**: `docker/neo4j-seed.cql` solo declara `unique_user_id` y `unique_post_id`. `username` no tiene restricción, y `design.md` D1 hace depender el login de `obtenerUsuarioPorUsername`. Sin unicidad, dos usuarios con el mismo `username` harían el login ambiguo. El diseño debe decidir si la garantía vive en la restricción del grafo o en el puerto de entrada; este requisito exige el comportamiento, no el mecanismo.

---

### Requirement: Lectura de perfil

El sistema DEBE permitir consultar el perfil de un usuario por su identificador, restringiendo el acceso al propietario y a ningún otro actor.

#### Scenario: Consultar perfil propio

- **GIVEN** un request con token válido cuyo claim `sub` coincide con el `{userId}` de la ruta
- **WHEN** se solicita `GET /api/users/{userId}`
- **THEN** la respuesta es `200 OK` con los campos del usuario

#### Scenario: Consultar perfil de otro usuario

- **GIVEN** un request con token válido cuyo claim `sub` **no** coincide con el `{userId}` de la ruta
- **WHEN** se solicita `GET /api/users/{userId}`
- **THEN** la respuesta es `403 Forbidden`
- **AND** no se filtra ningún dato del usuario consultado

> El `403` —y no el `404`— es deliberado: el sistema **sí** revela que el recurso existe. Si se prefiriera no revelar existencia, el requisito pasaría a `404` y esa decisión quedaría registrada en el diseño.

#### Scenario: Consulta sin token

- **GIVEN** un request sin token o con token inválido
- **WHEN** se solicita `GET /api/users/{userId}`
- **THEN** la respuesta es `401 Unauthorized`

#### Scenario: Usuario inexistente

- **GIVEN** un `{userId}` que no existe en el grafo
- **WHEN** se solicita `GET /api/users/{userId}` con token válido del solicitante
- **THEN** la respuesta es `404 Not Found`

---

### Requirement: Avatar en MinIO

El sistema DEBE almacenar el avatar del usuario en MinIO S3 y persistir su URL en la propiedad `avatarUrl` del nodo `:Usuario`, validando tipo y tamaño en el borde.

#### Scenario: Subir avatar propio

- **GIVEN** un token válido cuyo claim `sub` coincide con el `{userId}` de la ruta, y una imagen que cumple el límite de tamaño y la lista de tipos permitidos
- **WHEN** se envía `POST /api/users/{userId}/avatar` como `multipart/form-data`
- **THEN** el archivo queda en el bucket de MinIO
- **AND** la URL devuelta se persiste en `Usuario.avatarUrl`
- **AND** la respuesta es `200 OK` con la URL

#### Scenario: Subir avatar de otro usuario

- **GIVEN** un token válido cuyo claim `sub` **no** coincide con el `{userId}` de la ruta
- **WHEN** se intenta subir un avatar a ese `{userId}`
- **THEN** la respuesta es `403 Forbidden`
- **AND** ningún archivo queda escrito en el bucket

> Sin este chequeo, cualquier usuario autenticado puede escribir el avatar de otro. `GrafoPersistencePort` no tiene hoy método de actualización de avatar; debe incorporarse.

#### Scenario: Archivo de tipo no permitido

- **GIVEN** un archivo cuyo tipo MIME no está en la lista permitida
- **WHEN** se envía `POST /api/users/{userId}/avatar`
- **THEN** la respuesta es `400 Bad Request`
- **AND** ningún archivo queda escrito en el bucket

#### Scenario: Archivo que excede el tamaño máximo

- **GIVEN** un archivo que supera el tamaño máximo permitido
- **WHEN** se envía `POST /api/users/{userId}/avatar`
- **THEN** la respuesta es `413 Payload Too Large`
- **AND** ningún archivo queda escrito en el bucket

#### Scenario: Avatar por defecto

- **GIVEN** un usuario registrado cuyo `avatarUrl` es nulo o vacío
- **WHEN** el frontend renderiza el perfil o la cabecera
- **THEN** muestra un avatar de respaldo derivado de las iniciales del usuario
- **AND** no realiza ninguna petición de red adicional para obtenerlo

> El respaldo es responsabilidad del frontend (`design.md` D7): el backend devuelve `avatarUrl` nulo y el cliente resuelve la ausencia. Así el dominio no almacena imágenes genéricas idénticas y no se duplica el tráfico.

---

### Requirement: Autenticación JWT

El sistema DEBE emitir y validar tokens JWT stateless para identificar al usuario en cada request, guardando la credencial como hash y nunca en claro.

#### Scenario: Registro con credencial

- **GIVEN** un payload de registro que incluye la credencial inicial
- **WHEN** se envía `POST /api/users`
- **THEN** la credencial se persiste hasheada con Bcrypt en la propiedad `passwordHash` del nodo
- **AND** la credencial en claro **nunca** se persiste ni aparece en ninguna respuesta

#### Scenario: Login válido

- **GIVEN** credenciales correctas de un usuario registrado
- **WHEN** se solicita `POST /api/auth/login`
- **THEN** la respuesta es `200 OK` con un token JWT firmado
- **AND** el token lleva el `id` del usuario en el claim `sub` y su `username` en `preferred_username`

#### Scenario: Login con credenciales incorrectas

- **GIVEN** un `username` existente con una credencial que no corresponde
- **WHEN** se solicita `POST /api/auth/login`
- **THEN** la respuesta es `401 Unauthorized`
- **AND** el mensaje **no** distingue entre "usuario inexistente" y "contraseña incorrecta"

> La indistinguibilidad evita enumerar cuentas registradas.

#### Scenario: Request sin token

- **GIVEN** un endpoint que requiere identidad
- **WHEN** se envía un request sin token o con token inválido
- **THEN** la respuesta es `401 Unauthorized`

#### Scenario: Identidad en el frontend

- **GIVEN** un usuario autenticado
- **WHEN** carga la aplicación
- **THEN** el frontend obtiene su identidad decodificando los claims del token
- **AND** no mantiene una copia del perfil en almacenamiento aparte del token
- **AND** no usa valores hardcodeados de usuario

> `App.tsx` hoy declara `const [currentUserId] = useState<string>('carlos-patino')` sin setter. La identidad pasa a derivarse del token.

#### Scenario: Sesión expirada durante el arranque

- **GIVEN** un token presente en el navegador que ya venció o fue invalidado
- **WHEN** la aplicación carga y dispara su carga de datos inicial
- **THEN** detecta el `401`, limpia el token y **no** reintenta la carga en bucle
- **AND** la aplicación queda en el estado deslogueado

> Riesgo concreto: `App.tsx` dispara la carga en `useEffect` al montar. Una recarga forzada sin condicionar la sesión inicial puede producir un bucle infinito de peticiones.

---

## ADDED Requirements

### Requirement: Límite de tasa en endpoints de autenticación

El sistema DEBE limitar la tasa de peticiones a los endpoints de registro y login para reducir el abuso automatizado.

#### Scenario: Exceso de peticiones desde una origen

- **GIVEN** un origen que supera el umbral de peticiones en la ventana temporal
- **WHEN** continúa llamando a `POST /api/users` o `POST /api/auth/login`
- **THEN** la respuesta es `429 Too Many Requests`
- **AND** la petición **no** alcanza la capa de aplicación

> **Riesgo residual declarado**: el límite es por instancia, en memoria y por IP. Se reinicia con el proceso, es evitable trivialmente desde un origen distinto, y no coordina entre réplicas. El mapa en memoria debe tener cota y purga temporal para no convertirse en un vector de agotamiento de memoria. Mitigar de forma real exige un almacén compartido, fuera del alcance de esta historia.

### Requirement: Aislamiento de sesión

El sistema DEBE admitir sesiones concurrentes ilimitadas para una misma cuenta.

#### Scenario: Múltiples dispositivos

- **GIVEN** un usuario que inicia sesión en tres dispositivos
- **WHEN** los tres tokens vigentes realizan peticiones
- **THEN** los tres operan sin conflicto

> Consecuencia aceptada de la validación matemática local del JWT: no existe revocación ni tope de sesiones sin introducir estado en el servidor. Un token filtrado permanece válido hasta su expiración.

---

## Fuera de alcance

- Ciclo de vida de objetos en MinIO: la historia no define supresión. Un avatar subido y luego no referenciado queda huérfano de forma permanente. Registrado como deuda, no resuelto acá.
- Recuperación de contraseña, verificación de email y refresco de token: sin historias asignadas.
- Rate limiting distribuido o compartido entre réplicas: ver el riesgo residual de la Requirement de límite de tasa.
