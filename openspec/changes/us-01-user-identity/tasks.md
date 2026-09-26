# Tasks: US-01 (User Identity)

> **Ticket**: `TUX-52` — US-01: User registration, session and profile with MinIO avatar.
> **Asignada a**: Angel Villon (equipo TuxDev).
> **Especificación**: `openspec/changes/us-01-user-identity/specs/user-identity/spec.md` (7 requisitos, 23 escenarios).
> **Diseño**: `openspec/changes/us-01-user-identity/design.md` (D1–D10).

## Review Workload Forecast

| Métrica | Valor |
|---|---|
| Unidades de trabajo | 9 |
| Líneas estimadas (autoral) | **900 – 1300** |
| Riesgo de presupuesto de 400 líneas | **Alto** |
| PRs encadenados recomendados | **Sí** |
| Decisión necesaria antes de implementar | **Sí** |

**Estimación por unidad** (autoral, sin tests generados):

| Unidad | Alcance | Líneas |
|---|---|---|
| 1 | Seguridad JWT + credencial + lookup por username | 150–220 |
| 2 | Endpoint de login | 90–130 |
| 3 | Identidad de request + 401 | 60–90 |
| 4 | Validación de registro + 409 de id + unicidad de username | 120–170 |
| 5 | Lectura de perfil + autorización de propietario | 100–150 |
| 6 | Subida de avatar multipart | 150–210 |
| 7 | Avatar por defecto en frontend | 40–60 |
| 8 | Servicio de auth en frontend + migración a cliente único | 140–200 |
| 9 | Rate limiting en endpoints de auth | 90–130 |

**Recomendación**: encadenar en 3 PRs, cortando por frontera de dominio y no por tipo de archivo.

- **PR 1 — Credenciales y sesión** (unidades 1, 2, 3): deja el login funcionando de punta a punta.
- **PR 2 — Registro y perfil** (unidades 4, 5, 9): cierra el contrato de escritura y la autorización de lectura.
- **PR 3 — Avatar y frontend** (unidades 6, 7, 8): la parte más grande y la más revisable sola.

> El PR 1 es verificable de punta a punta sin lo demás: registrar → loguear → recibir `401` sin token. Eso lo hace buen candidato para el primer PR.

---

## Prerrequisito bloqueante

### T0. Cerrar decisiones de diseño abiertas

**Las cuatro están cerradas.** El diseño va de D1 a D14. Ninguna unidad de código debería empezar antes de esto.

- [x] **T0.1 — Unicidad de `username`** → **D11**. Doble mecanismo: restricción `unique_username` en `docker/neo4j-seed.cql` (garantía real ante concurrencia) más `MATCH` preventivo en `Neo4jGrafoAdapter` para mapear la colisión a `409` sin parsear `ConstraintViolationException`. `id` y `username` comparten el mismo camino.
  - **Verificación**: el Cypher de `obtenerUsuarioPorUsername` devuelve como máximo un nodo; dos peticiones concurrentes con el mismo `username` producen `409` en ambas.
  - **Riesgo residual a resolver en la unidad 4**: el `MATCH` preventivo no es atómico. Si dos peticiones lo pasan antes de que ninguna escriba, la segunda recibe `ConstraintViolationException` y **el mapeo de esa excepción a `409` no está diseñado**. La restricción lo impide, pero el código que traduce la excepción hay que escribirlo.
- [x] **T0.2 — Activación de seguridad** → **D12**. Se agrega `quarkus-security` al pom y se usa **estrictamente** `@Authenticated`, sin `@RolesAllowed("**")`: el sistema no tiene modelo de roles, y D5 mueve la autorización de propietario a la capa de aplicación.
  - **Verificación**: el diseño nombra la extensión, y el `401` de `GET /api/users/{userId}` no depende de un componente ausente.
- [x] **T0.3 — `401` indistinguible** → **D13**. Mensaje genérico idéntico en ambos casos, **más** un cálculo de Bcrypt ficticio contra un hash constante cuando el usuario no existe, para igualar el tiempo de respuesta. `Thread.sleep()` se rechaza por ser evadible estadísticamente.
  - **Verificación**: los dos casos devuelven `status` y cuerpo idénticos carácter a carácter, **y** la diferencia de latencia entre ambos está dentro del ruido de medición.
  - **Nuevo punto de implementación**: el hash constante contra el que se calcula el Bcrypt ficticio debe ser un valor de producción fijo y elegido con el mismo factor de costo que los hashes reales. Si el dummy corre con menos rondas que un hash real, la defensa es theater.
- [x] **T0.4 — `passwordHash` no serializado** → **D14**. Tipos de vista hexagonales: el dominio conserva `Usuario` con el hash, y el borde REST expone un DTO `UsuarioResponse` que lo omite. `@JsonIgnore` se rechaza por acoplar el dominio a Jackson.
  - **Verificación**: `passwordHash` ausente en las **tres** respuestas — registro, login y lectura de perfil.
  - **Punto de mayor riesgo**: la respuesta de login. D14 la define como **solo el JWT**, sin objeto de usuario. Si la implementación devuelve el `Usuario` por comodidad, el hash se filtra por el endpoint menos vigilado.

> **Por qué bloqueaban**: sin T0.1 el login de la unidad 2 era ambiguo para usuarios homónimos. Sin T0.2 la autorización de las unidades 3 y 5 no existía y el endpoint quedaba abierto. T0.4 en particular era caro de reparar después: un hash de contraseña filtrado por todas las respuestas no se corrige sin tocar cada endpoint.

---

## PR 1 — Credenciales y sesión

### Unidad 1: Fundamento de seguridad y credencial

- **Estado inicial**: `quarkus-smallrye-jwt` declarado y sin uso. `Usuario` sin campo de credencial. `GrafoPersistencePort` sin lookup por username. `application.properties` sin claves JWT.
- **Terminado cuando**: el modelo `Usuario` tiene `passwordHash`; el puerto declara `obtenerUsuarioPorUsername`; el adaptador lo implementa con Cypher; las claves y el issuer JWT están configurados; la extensión de seguridad está en el pom.
- **Verificación**: `mvn compile` desde `backend`. Comprobación manual de que el contexto de Quarkus arranca sin complaining de issuer.
- **Boundary de rollback**: `domain/model/Usuario.java`, `domain/port/out/GrafoPersistencePort.java`, su implementación en `infrastructure/adapter/out/neo4j/`, `application.properties`, `backend/pom.xml`. Revertir devuelve el proyecto a JWT declarado y sin uso, que es el estado actual.

### Unidad 2: Emisión de token en login

- **Estado inicial**: existe lookup por username, no existe endpoint de emisión.
- **Terminado cuando**: `POST /api/auth/login` verifica Bcrypt contra `passwordHash`, emite un JWT con `sub` = `id` y `preferred_username` = `username`, y devuelve `401` con mensaje indistinguible ante credenciales incorrectas.
- **Verificación**: `mvn compile`. Ejecución manual del escenario: credencial correcta devuelve `200` con token; `username` inexistente y contraseña incorrecta devuelven el mismo `401`.
- **Boundary de rollback**: el recurso de login y su caso de uso. Revertir deja el lookup por username sin consumidor, que es inocuo.

### Unidad 3: Identidad de request y `401`

- **Estado inicial**: ningún endpoint valida identidad.
- **Terminado cuando**: los endpoints que requieren identidad rechazan request sin token o con token inválido con `401`, mediante el mecanismo nativo de la extensión de seguridad, no con filtros manuales.
- **Verificación**: `mvn compile`. Un request sin token a un endpoint protegido devuelve `401`; con token válido, deja de devolverlo.
- **Boundary de rollback**: anotaciones y configuración de seguridad. Sin cambios de comportamiento en el dominio.

---

## PR 2 — Registro y perfil

### Unidad 4: Validación de registro y conflictos de unicidad

- **Estado inicial**: `POST /api/users` acepta `Usuario` crudo, sin validación, y sobrescribe ante `id` repetido.
- **Terminado cuando**: campos obligatorios y formato de `email` inválidos devuelven `400` con detalle por campo; un `id` existente devuelve `409` sin sobrescribir el nodo; un `username` existente devuelve `409` sin crear el segundo usuario; `avatarUrl` del payload se ignora.
- **Verificación**: `mvn compile`. Los cuatro escenarios del spec, ejecutados a mano. El caso del `409` debe probarse **dos veces en serie** sobre el mismo `id`, porque es exactamente el caso que `MERGE` ocultaba.
- **Boundary de rollback**: el Cypher de escritura, las anotaciones de validación y el recurso de registro. Revertir devuelve el overwrite, que es el estado actual.

> **Punto de riesgo**: alcanzar el `409` requiere `CREATE` en lugar de `MERGE`, y `CREATE` cambia la forma del error de Neo4j. La traducción de esa excepción a `409` es la parte delicate de esta unidad, no la validación.

### Unidad 5: Lectura de perfil y autorización de propietario

- **Estado inicial**: no existe endpoint de lectura. `GrafoPersistencePort` no declara lectura individual.
- **Terminado cuando**: `GET /api/users/{userId}` devuelve `200` con los campos del usuario cuando el claim `sub` coincide con la ruta; `403` cuando no coincide, sin filtrar datos; `404` cuando el `userId` no existe.
- **Verificación**: `mvn compile`. Los cuatro escenarios del requisito, con dos tokens distintos para probar el `403`.
- **Boundary de rollback**: el método de lectura del puerto, su Cypher y el endpoint. Aditivo sobre el estado actual.

### Unidad 9: Límite de tasa en autenticación

- **Estado inicial**: sin limitación alguna.
- **Terminado cuando**: `POST /api/users` y `POST /api/auth/login` devuelven `429` al superar el umbral desde un mismo origen, sin alcanzar la capa de aplicación, y el contador tiene cota y purga temporal.
- **Verificación**: `mvn compile`. Un serie de peticiones por encima del umbral produce `429`; el mapa no crece sin límite tras agotar la ventana.
- **Boundary de rollback**: el filtro, la anotación de enlace y su registro. Desregistrarlo devuelve los endpoints a su comportamiento actual.

> Esta unidad puede ir en cualquier PR: no depende de las otras. Se ubica acá por claridad de lectura, no por dependencia.

---

## PR 3 — Avatar y frontend

### Unidad 6: Subida de avatar

- **Estado inicial**: `StorageMultimediaPort.subirArchivo(...)` declarado e implementado, sin ningún consumidor. Sin dependencia multipart en el pom.
- **Terminado cuando**: `POST /api/users/{userId}/avatar` acepta `multipart/form-data` y persiste la URL; rechaza con `403` cuando el `sub` no coincide con la ruta, sin escribir en el bucket; `400` por tipo MIME no permitido; `413` por tamaño excedido.
- **Verificación**: `mvn compile`. Los cuatro escenarios. En los tres rechazos, comprobar que el bucket **queda vacío** — es el criterio que distingue un rechazo real de un rechazo tardío.
- **Boundary de rollback**: el endpoint, el método `actualizarAvatarUrl` del puerto, la dependencia multipart y el override de `@Consumes`. Revertir devuelve el puerto de almacenamiento a su estado actual: cableado a la nada.

> **Punto de riesgo**: `UserGraphResource` declara `@Consumes(APPLICATION_JSON)` a nivel de clase. El override local es obligatorio; sin él el endpoint devuelve `415`. Mismo patrón en `PostResource`, que esta unidad **no** toca pero que **quedará bloqueada** por el mismo motivo si otra historia sube archivos ahí.

### Unidad 7: Avatar por defecto

- **Estado inicial**: un usuario sin avatar renderiza un hueco.
- **Terminado cuando**: si `avatarUrl` llega nulo o vacío, el perfil y la cabecera muestran un avatar derivado de las iniciales, sin petición de red adicional.
- **Verificación**: `pnpm run build` desde `frontend`. Comprobación manual con un usuario sin avatar.
- **Boundary de rollback**: el componente de respaldo y su uso. Aditivo, sin acoplamiento.

### Unidad 8: Servicio de autenticación en frontend

- **Estado inicial**: dos instancias de `axios.create` separadas (`feedApi.ts`, `networkApi.ts`). `App.tsx` usa `currentUserId` y `currentUsername` hardcodeados, sin setter. Sin cliente HTTP central.
- **Terminado cuando**: existe un cliente Axios único; los servicios de feed y red migran a esa instancia; el interceptor limpia el token y fuerza recarga ante `401`; `App.tsx` condiciona la carga de datos de arranque a la existencia de sesión, evitando el bucle de recargas.
- **Verificación**: `pnpm run build`. Con un token expirado en el navegador, la aplicación carga, recibe `401`, limpia y **no** repite peticiones indefinidamente. Ese es el criterio de aceptación.
- **Boundary de rollback**: `apiClient.ts`, los dos servicios migrados, el interceptor y el `App.tsx`. Revertir devuelve los dos clientes separados y la identidad hardcodeada.

> **Punto de riesgo**: la migración de los dos servicios toca su superficie pública. Si algo externo los consume, la unidad no es autoverificable por build solamente.

---

## Fuera de alcance

- Ciclo de vida de objetos en MinIO. La historia no define supresión; un avatar no referenciado queda huérfano de forma permanente.
- Recuperación de contraseña, verificación de email, refresco de token.
- Rate limiting compartido entre réplicas. Ver el riesgo residual en el spec.
- Migración de `PostResource` a multipart. Solo `UserGraphResource` cambia en esta historia.

## Riesgos que sobreviven a esta historia

| Riesgo | Estado |
|---|---|
| Token filtrado no revocable hasta 24 h | Aceptado en el diseño (D3, D10) |
| Rate limiting evitable por origen o por reinicio | Aceptado y declarado en el spec |
| Objetos huérfanos en MinIO | Registrado, sin resolver |
| Sin infraestructura de tests en el proyecto | Declarado en `config.yaml`; ver abajo |

## Verificación: solo compilación, por decisión del proyecto

`openspec/config.yaml` ya decidió este punto, en tres lugares (líneas 77, 86 y 87):

> «Sin fase de tests: no agregar tareas de unit/e2e/manual testing en ningún momento. La verificación es estrictamente compilación.»
> «SIN FASE DE TESTS: No se crean ni ejecutan pruebas unitarias, de integración ni e2e. No se genera código de test.»
> «Tests deshabilitados hasta que se asigne tarea de infraestructura de testing.»

Por lo tanto **estas tareas no incluyen ninguna fase de pruebas**, y `mvn compile` + `pnpm run build` es la verificación completa y suficiente que el proyecto define. Agregar JUnit aquí violaría la configuración.

**Lo que sí queda pendiente, y no es una decisión de tests:** levantar la tarea de infraestructura de testing es un trabajo aparte, con su propio alcance. Hasta que exista, el proyecto acepta que la verificación de comportamiento sea manual y explícita.

Esa limitación tiene un costo concreto y conviene que el equipo lo sepa: un `compile` en verde sobre un interceptor de `401` que no evita el bucle de recargas no dice nada. Quien implemente las unidades 4 y 5 debe **verificar en el navegador** el flujo de sesión expirada, porque la compilación no lo va a detectar. Esa disciplina manual es la red de seguridad real de esta historia, y depende de que alguien la ejecute.
