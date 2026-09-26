# Design: US-01 (User Identity)

> Reelaborado tras una auditoría adversarial (16 hallazgos). Regenerado por la misma sesión
> de arquitecto que conservaba la exploración original del codebase.

## D1. Emisión JWT, Hashing y Credenciales

**Decisión:** Se utilizará `Bcrypt` para aplicar hash a las contraseñas, almacenando el resultado en la nueva propiedad `passwordHash` del nodo `:Usuario`. El endpoint `POST /api/auth/login` validará las credenciales y emitirá un token *stateless* mediante `quarkus-smallrye-jwt` con expiración de 24 horas, incluyendo el `id` en el claim `sub` y el `username` en `preferred_username`.

**Por qué:** Resolver la autenticación requiere un estándar seguro y probado. `Bcrypt` maneja su propio *salt*. El uso de JWT *stateless* evita cargar consultas adicionales a la base de datos en peticiones posteriores.

**Alternativa rechazada:** Usar algoritmos obsoletos o almacenar credenciales en texto plano. Se rechazó generar tokens personalizados en lugar de apoyarse en la especificación SmallRye JWT de Quarkus.

**Consecuencia:** Afecta a la capa de aplicación y puerto de salida. Obliga a agregar el método de lectura `obtenerUsuarioPorUsername` en el `GrafoPersistencePort` e implementar su Cypher en `Neo4jGrafoAdapter`. El proyecto requerirá configurar claves JWT en `application.properties`.

## D2. Validación de Registro y Manejo de Conflictos

**Decisión:** El `POST /api/users` aplicará restricciones declarativas con `hibernate-validator` (`@NotBlank`, `@Email`) e ignorará el campo `avatarUrl` en su payload. Para garantizar la respuesta HTTP 409 ante un `id` duplicado, el adaptador modificará su comportamiento para realizar una comprobación previa (`MATCH`) o utilizar lógicas seguras de inserción en lugar de ejecutar un `MERGE` ciego.

**Por qué:** Un `MERGE` en Cypher sobrescribe silenciosamente si el identificador existe, imposibilitando el 409 exigido. Ignorar la URL del avatar en el JSON previene suplantación remota de imágenes.

**Alternativa rechazada:** Delegar el conflicto de identificadores exclusivamente a la restricción `unique_user_id` en Neo4j, lo cual demostró ser ineficaz debido a la semántica del comando `MERGE` existente.

**Consecuencia:** Afecta al `Neo4jGrafoAdapter`. El registro será más rígido y retornará errores HTTP 400 automáticos si los campos requeridos faltan.

## D3. Persistencia de Sesión y Sincronización

**Decisión:** El frontend almacenará únicamente el token JWT crudo en `localStorage`. El estado de React inicializará la identidad del usuario descodificando los *claims* del token, sin duplicar variables independientes de estado en el almacenamiento del navegador.

**Por qué:** Guardar un perfil JSON junto al token en disco genera riesgo de desincronización si los datos cambian. Decodificar el JWT asegura una única fuente de verdad local.

**Alternativa rechazada:** Guardar la sesión en `sessionStorage` (destruye la experiencia multi-pestaña) o implementar cookies `httpOnly` (agrega complejidad de mitigación CSRF innecesaria en este alcance).

**Consecuencia:** Decisión puramente de frontera (UI). La revocación es estrictamente local (eliminar clave); un token expuesto en un ataque XSS no podrá ser revocado centralmente durante su ventana de validez de 24 horas.

## D4. Intercepción 401 y Migración de Clientes

**Decisión:** Se construirá un único cliente Axios centralizado (`apiClient.ts`). Los servicios `feedApi.ts` y `networkApi.ts` serán migrados a esta instancia. El interceptor central capturará respuestas 401, limpiará el `localStorage` y forzará `window.location.reload()`. El componente `App.tsx` debe condicionar sus llamadas de red de arranque a la existencia confirmada de la sesión.

**Por qué:** Sin un enrutador en el proyecto, recargar el entorno es el único mecanismo predecible para desmontar la aplicación completa. Restringir la carga de datos inicial si el usuario no tiene sesión evita un bucle infinito de recargas continuas.

**Alternativa rechazada:** Mantener la dispersión de clientes Axios o utilizar un contexto de React inyectado en el interceptor, lo que generaría acoplamiento bidireccional severo entre las librerías de red y la interfaz de usuario.

**Consecuencia:** Decisión puramente de frontera (UI/Cliente HTTP). Cualquier caída de sesión resulta en un destello de pantalla por la recarga forzada del navegador.

## D5. Lectura de Perfil y Autorización

**Decisión:** El recurso `GET /api/users/{userId}` será protegido en su firma. La lógica de la capa de Aplicación ejecutará una doble verificación: primero buscará el perfil en la base de datos (devolviendo `404 Not Found` si no existe). Si el perfil existe, validará explícitamente que el `sub` del token coincida con el `userId` solicitado; si no coincide, lanzará una excepción que retorne `403 Forbidden`.

**Por qué:** Este orden estricto de validación (existencia primero, autorización después) garantiza que se devuelva un 403 solo para usuarios existentes, revelando a propósito su existencia frente a otros usuarios de la red tal como demanda el spec.

**Alternativa rechazada:** Comprobar la autorización criptográfica de propietario antes de intentar localizar el nodo en la base de datos (lo que enmascararía la existencia del usuario detrás de un 403 universal).

**Consecuencia:** Afecta a los puertos e infraestructura. Exige la inclusión de la firma `obtenerUsuarioPorId` en el `GrafoPersistencePort`. La exigencia de identidad en la firma se resuelve en D12.

## D6. Transporte y Autorización del Avatar

**Decisión:** Se implementará el endpoint `POST /api/users/{userId}/avatar` incluyendo la dependencia `quarkus-resteasy-multipart` y sobreescribiendo el consumo local con `@Consumes(MediaType.MULTIPART_FORM_DATA)`. Las limitaciones HTTP nativas de Quarkus devolverán un `413 Payload Too Large` por tamaño, y la lógica REST devolverá un `400 Bad Request` ante MIME types no permitidos. En ambos rechazos, el proceso se abortará en la capa HTTP antes de invocar a `StorageMultimediaPort`.

**Por qué:** Aislar los rechazos en la propia frontera REST asegura tajantemente que el bucket de MinIO quede vacío y no se generen consumos de red innecesarios hacia S3 en caso de archivos maliciosos.

**Alternativa rechazada:** Invocar el puerto S3 primero y, ante un error o revisión de formato tardía, intentar enviar un comando de borrado al bucket (inseguro y altamente ineficiente).

**Consecuencia:** Afecta a `UserGraphResource`, `StorageMultimediaPort` y `GrafoPersistencePort` (requiriendo agregar un método `actualizarAvatarUrl`). Si la inserción en base de Neo4j falla *después* de subir el archivo válido a MinIO, el objeto en S3 quedará huérfano.

## D7. Avatar por Defecto

**Decisión:** La provisión del avatar por defecto será responsabilidad del frontend. Si el campo `avatarUrl` retornado por la API es nulo o vacío, la interfaz de usuario renderizará un componente visual sustituto de respaldo (por ejemplo, un SVG basado en iniciales).

**Por qué:** Mantiene limpio el dominio y reduce el consumo de almacenamiento y ancho de banda al evitar almacenar o traficar imágenes genéricas idénticas desde el servidor.

**Alternativa rechazada:** Generar e inyectar un URL genérico en el backend durante el registro del nodo `:Usuario`, o copiar una imagen por defecto físicamente en el cubo S3 por cada nuevo registro.

**Consecuencia:** Decisión puramente de UI. Requiere una ligera capa extra de lógica condicional en la renderización de la cabecera y el perfil en React.

## D8. Modalidad de Registro y Mitigación

**Decisión:** El registro será totalmente público. Se mitigará el abuso excesivo mediante limitaciones de tasa en memoria, asumiendo conscientemente el riesgo residual de creación de cuentas de *spam* que logren esquivar el control de red operando por debajo del umbral del límite.

**Por qué:** Una red social carece de sentido orgánico bajo un modelo estricto de invitación centralizada; requiere fricción mínima.

**Alternativa rechazada:** Modelar un sistema de registro privado e invitaciones transaccionales. Esta opción exigiría expansión de capacidades y un sobrecosto sustancial en tiempo de desarrollo.

**Consecuencia:** Decisión de modelo de negocio y frontera. El proyecto expone intencionalmente la infraestructura a posibles actores maliciosos lentos que consuman cuotas de Neo4j de forma automatizada.

## D9. Rate Limiting en Endpoints de Auth

**Decisión:** Se implementará un `ContainerRequestFilter` (capa de Infraestructura) mapeado a `POST /api/auth/login` y el registro mediante una anotación de enlace (como `@RateLimited`). Utilizará un mapa en memoria acotado para devolver un `429 Too Many Requests` ante excesos (ej. más de 5 peticiones por minuto). Al operar en la fase de filtrado de JAX-RS, el rechazo cortocircuita la conexión y jamás alcanza la capa de Aplicación.

**Por qué:** El equipo prioriza la simplicidad de despliegue sobre bloqueos globales perfectos. Controlar la velocidad de ataque en el filtro REST satisface el aislamiento exigido por el spec sin violar las restricciones de no agregar dependencias operativas pesadas.

**Alternativa rechazada:** Desplegar una instancia de Redis o delegar el límite a los Casos de Uso del dominio. Se rechazaron para mantener la lógica de red fuera del anillo de Aplicación y evitar infraestructura externa no prevista.

**Consecuencia:** Decisión que afecta netamente a la capa de infraestructura HTTP. El límite es estricto por instancia e IP; al reiniciar el servicio de Quarkus, todos los contadores de tráfico en memoria se borran.

## D10. Políticas de Sesiones Concurrentes

**Decisión:** Se admitirá un número infinito de sesiones activas en paralelo para cualquier identificador válido.

**Por qué:** Validar topes de sesiones choca frontalmente con la arquitectura de validación matemática local de JWT. Requería forzar el almacenamiento de estado externo.

**Alternativa rechazada:** Obligar al sistema a buscar el usuario en Neo4j durante cada solicitud HTTP para cruzar el momento de emisión del token contra un registro centralizado.

**Consecuencia:** Estipulación puramente lógica del flujo de autenticación. Un usuario jamás poseerá mecanismos remotos nativos para deshabilitar dispositivos previamente conectados desde el servidor.

## D11. Unicidad de Username y Resolución de Conflictos

**Decisión:** Se aplicará un doble mecanismo de protección. En infraestructura, se agregará la restricción `unique_username` en `docker/neo4j-seed.cql`. En el puerto de salida (`Neo4jGrafoAdapter`), se implementará una validación proactiva mediante una cláusula `MATCH` preventiva: si se detecta que el `username` o `id` ya existen, el adaptador lanzará una excepción que será procesada por REST para devolver explícitamente `409 Conflict`.

**Por qué:** La restricción pura en la base de datos es la única garantía frente a escrituras concurrentes. Sin embargo, complementar la operación con el `MATCH` previo permite a la aplicación mapear limpiamente la colisión a un `409` amistoso, eludiendo la ardua tarea de parsear el genérico `ConstraintViolationException` del driver de Neo4j en el borde HTTP.

**Alternativa rechazada:** Emplear únicamente la validación lógica `MATCH` en Java (dejando la base vulnerable a condiciones de carrera) o emplear solo la restricción en Neo4j (dificultando el ruteo limpio del código de respuesta 409).

**Consecuencia:** Afecta al `Neo4jGrafoAdapter` y a los scripts de despliegue de infraestructura. La capa de dominio garantizará que siempre se resuelva exactamente un único usuario para evitar autenticaciones ambiguas.

## D12. Activación de Seguridad y Anotaciones de Identidad

**Decisión:** Se incorporará la dependencia `quarkus-security` al `pom.xml` del proyecto. El endpoint de consulta de perfiles será protegido empleando estrictamente la anotación semántica `@Authenticated` en lugar de modificadores de rol no mapeados. La verificación final de la titularidad de los datos recae en el código imperativo de la Aplicación.

**Por qué:** Sin la extensión de Quarkus Security, las anotaciones de protección se vuelven inertes y el 401 nativo no se gatilla. Se prescribe el uso de `@Authenticated` y no un comodín tipo `@RolesAllowed("**")` porque este sistema carece de un modelo segregado de permisos o jerarquías (RBAC); el acceso depende puramente de la existencia de una identidad válida en el JWT.

**Alternativa rechazada:** Construir un filtro HTTP manual personalizado que intercepte y descifre cada JWT de forma aislada. Fue descartado porque supone reinventar y arriesgar una rueda de seguridad que SmallRye y Quarkus ya brindan de forma nativa e integrada.

**Consecuencia:** Decisión de frontera (Infraestructura). Asegura el bloqueo temprano de acceso anónimo devolviendo un `401 Unauthorized` de manera automática, sin saturar los métodos del framework con variables ficticias de roles.

---

## D13. Mitigación de Enumeración y Canal de Tiempo en Login

**Decisión:** El endpoint `POST /api/auth/login` devolverá un estado `401 Unauthorized` con un mensaje genérico idéntico tanto si el usuario no existe como si la contraseña es errónea. Para mitigar el canal lateral de tiempo provocado por el algoritmo de *hashing*, si el usuario buscado no existe, el sistema ejecutará un cálculo de `Bcrypt` ficticio contra un *hash* constante antes de emitir la respuesta.

**Por qué:** Igualar el texto del error es insuficiente si el tiempo de respuesta varía. `Bcrypt` introduce latencia intencional alta; sin el cálculo ficticio, un atacante puede adivinar qué usuarios existen midiendo el tiempo de respuesta, permitiendo la enumeración masiva de cuentas registradas.

**Alternativa rechazada:** Usar retrasos aleatorios de hilo. Rechazada por ser estadísticamente evadible mediante múltiples muestras de latencia y por resultar ineficiente frente al consumo de recursos del servidor.

**Consecuencia:** Afecta exclusivamente a la capa de Aplicación (Caso de Uso de autenticación). El sistema incurrirá intencionalmente en un costo computacional de CPU adicional al rechazar inicios de sesión de usuarios inexistentes, para blindar la privacidad del grafo.

## D14. Exclusión de Credenciales mediante Tipos de Vista Hexagonales

**Decisión:** Se establecerán tipos distintos para el modelo de dominio y la salida de la API. El dominio retendrá su `record` `Usuario` incluyendo el campo `passwordHash`. En el adaptador REST (capa de infraestructura), se creará un DTO de respuesta `UsuarioResponse` que omitirá la propiedad de la contraseña. Las respuestas HTTP mapearán el dominio de salida a este DTO de vista.

**Por qué:** Cumple con las directivas de la arquitectura hexagonal al no permitir que la capa de infraestructura dicte la forma de los objetos del dominio. Asegura mecánicamente que el hash no sea expuesto bajo ningún contexto en la serialización JSON.

**Alternativa rechazada:** Agregar una anotación `@JsonIgnore` sobre el `record` original `Usuario`. Rechazada de plano por contaminar el modelo de negocio con dependencias exclusivas del motor de infraestructura (`Jackson`), quebrando la independencia de los anillos exigida en `config.yaml`.

**Consecuencia:** Afecta al Borde REST (`UserGraphResource`) y a los tres puntos de salida. El contrato de exposición queda definido así:

| Punto de salida | Expone | Exposición de `passwordHash` |
|---|---|---|
| `POST /api/users` | `UsuarioResponse` | Ninguna |
| `POST /api/auth/login` | Exclusivamente el JWT | Ninguna. La identidad viaja en los claims, no en un objeto de usuario |
| `GET /api/users/{userId}` | `UsuarioResponse` | Ninguna |
