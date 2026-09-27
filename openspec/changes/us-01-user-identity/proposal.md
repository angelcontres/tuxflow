# Proposal: US-01 (TUX-52) — Registro, sesión y perfil con avatar en MinIO

**Change**: `us-01-user-identity`
**Ticket**: TUX-52 (US-01) · Sprint 1 · 2 SP · MoSCoW Must
**Alcance**: Fullstack (backend + frontend en un único change)
**Fecha**: 2026-09-26
**Spec base**: `openspec/specs/user-identity/spec.md`

---

## Intent

Permitir que una persona se registre, inicie sesión y consulte y edite su perfil con avatar, de modo que el sistema deje de depender de una identidad hardcodeada en el frontend.

Hoy el backend **ya sabe crear usuarios** y el frontend **no sabe quién es el usuario**. Entre esos dos hechos hay un hueco de identidad completo: no hay emisión de token, no hay validación de identidad en ningún endpoint, no hay lectura de perfil, y el avatar tiene un puerto de almacenamiento implementado que nadie invoca. Esta historia cierra ese hueco.

**Flujo de usuario**:

1. La persona abre la aplicación sin sesión.
2. Se registra con username, email, nombre y contraseña; opcionalmente adjunta un avatar.
3. El sistema persiste el nodo `:Usuario` en Neo4j con el hash de la contraseña.
4. Si hubo avatar, el sistema lo sube a MinIO y guarda la URL en `avatarUrl`.
5. El sistema emite un token JWT.
6. El frontend guarda el token y actualiza el estado de sesión con la identidad real.
7. La persona abre su perfil, ve su avatar y puede editar nombre y avatar.
8. Las peticiones posteriores viajan con el token; el backend valida la identidad.

---

## Alcance

### Dentro del alcance

**Identidad y sesión (backend)**

- Campo de credencial en `Usuario` con hash, nunca en claro.
- Emisión de token JWT en un endpoint de login.
- Mecanismo de validación de token reutilizable por el resto de endpoints.
- Endpoint de lectura de perfil `GET /api/users/{userId}`.

**Avatar (backend)**

- Vía de transporte para subir un archivo y convertirlo en `avatarUrl`.
- El endpoint consume el puerto de salida `StorageMultimediaPort` **a través de un puerto de entrada**, nunca directamente desde el Resource.

**Validación de entrada**

- Restricciones declarativas en el borde REST para los endpoints tocados por esta historia.

**Identidad y sesión (frontend)**

- Servicio HTTP de autenticación y de perfil.
- Estado de sesión con setter, con el token persistido en el navegador, reemplazando los valores fijos de `App.tsx`.
- Formulario de registro, formulario de login, y vista y edición de perfil.
- Controles de sesión en `Navbar`.
- Subida de avatar desde la interfaz.

> **La persistencia de la sesión es un requisito, no una comodidad.** Se evaluó explícitamente dejarla solo en memoria y se descartó: obliga a autenticarse en cada recarga y vuelve engorroso cualquier ciclo de revisión o verificación en el frontend, porque ninguna observación sobre el comportamiento de la interfaz es reproducible sin un paso de login previo. En el contexto de esta aplicación, que no está dirigida a un escenario de alta carga operacional, el endurecimiento que aportaría una cookie `httpOnly` no compensa la complejidad de CSRF y de ciclo de vida que introduce. La persistencia se conserva y su riesgo se acepta de forma consciente, documentado en la tabla de riesgos.

### Fuera del alcance

Esta sección es el delimitador de la historia. Nada de lo siguiente se toca, aunque viva en el mismo archivo o comparta dominio.

- **Relaciones sociales.** Seguir, dejar de seguir, sugerencias de segundo grado, seguidores en común y grado de separación. Ya están implementados en `UserGraphResource` y `Neo4jGrafoAdapter` y pertenecen a las capabilities `social-graph` y `graph-algorithms`.
- **Publicaciones, multimedia de posts, feed, reacciones, chat y Web Push.** Corresponden a `post-management`, `feed-generation`, `post-reactions`, `chat-messaging` y `web-push-notifications`.
- **Suscripción push del usuario.** El campo `Usuario.pushSubscriptionJson` y el método `obtenerSuscripcionesPushDeSeguidores` ya existen; su gestión es de US-08.
- **Modelo de roles y permisos.** No hay tal concepto en el sistema y esta historia no lo introduce. Todo usuario autenticado es equivalente.
- **Recuperación de contraseña, verificación de email, refresh token, revocación o lista negra de tokens.**
- **Login social o de terceros (OAuth, Google, GitHub).**
- **Borrado de usuario.**
- **Ciclo de vida del objeto en S3.** Reemplazar un avatar no elimina el objeto anterior en el bucket.
- **Redimensionado, compresión o validación de contenido de imagen.**
- **Protegir los endpoints de las demás capabilities.** Esta historia entrega el mecanismo de validación y lo aplica a los endpoints de `user-identity`. La aplicación del mecanismo a feed, posts, chat y push es trabajo de sus respectivas historias.
- **Cualquier test.** `strict_tdd` es `false` y no hay runner en `backend/pom.xml` ni script `test` en `frontend/package.json`. No se crean archivos de prueba.
- **Linter ni formateador.**
- **Los demás stories.** US-02 a US-11 no se modifican.

---

## Contexto técnico

### Lo que ya está construido

La cadena de registro backend **existe y funciona de punta a punta**. Esto **no** es trabajo de esta historia:

```java
// infrastructure/adapter/in/rest/UserGraphResource.java
@Path("/api/users")
public class UserGraphResource {

    @POST
    public Response registrarUsuario(Usuario usuario) {
        gestionarGrafoSocialUseCase.registrarUsuario(usuario);
        return Response.status(Response.Status.CREATED).entity(usuario).build();
    }
```

```java
// application/service/UserGraphApplicationService.java
@Override
public void registrarUsuario(Usuario usuario) {
    grafoPersistencePort.guardarUsuario(usuario);
}
```

```java
// infrastructure/adapter/out/neo4j/Neo4jGrafoAdapter.java (línea 187)
@Override
public void guardarUsuario(Usuario u) { /* ... */ }
```

También existe el modelo de dominio con los campos que esta historia necesita:

```java
// domain/model/Usuario.java
public class Usuario {
    private String id;
    private String username;
    private String email;
    private String nombre;
    private String avatarUrl;
    private String pushSubscriptionJson;
    // getters y setters
}
```

Y el puerto de multimedia está implementado y **nadie lo usa**:

```java
// infrastructure/adapter/out/s3/MinioS3StorageAdapter.java (línea 27)
@Override
public String subirArchivo(InputStream inputStream, long contentLength,
                          String contentType, String extension) { /* ... */ }
```

### Los dos huecos reales

**Hueco 1 — el avatar no tiene transporte.** `StorageMultimediaPort` está declarado e implementado, pero ningún Resource ni caso de uso lo inyecta. No existe endpoint que reciba una subida. La propiedad `avatarUrl` existe en el modelo y nunca se puebla desde un archivo real.

`PostResource.crearPost()` recibe un `mediaUrl` como texto del body, no una subida, así que **no hay precedente multipart en el proyecto**. Cómo se transporta el archivo es una decisión de diseño, no un hecho que este documento resuelva.

**Hueco 2 — la autenticación no existe.** `quarkus-smallrye-jwt` es una dependencia declarada en `backend/pom.xml` que ninguna clase usa. No hay endpoint de login, ni emisión de token, ni validación, ni campo de credencial en `Usuario`, ni hashing en ningún lado. `UserGraphResource` opera sobre identificadores que llegan crudos en el body o en el path: cualquiera que conozca un `id` puede seguir o dejar de seguir a ese usuario.

En el frontend la identidad es un valor fijo:

```tsx
// frontend/src/App.tsx
const [currentUserId] = useState<string>('carlos-patino');
const [currentUsername] = useState<string>('carlos');
```

Ambos `useState` están **sin setter**: no hay forma de cambiar la identidad ni de tener una sesión.

### Forma posterior

La estructura objetivo respeta los anillos hexagonales. El Resource depende solo de puertos de entrada; el caso de uso orquesta los puertos de salida:

```
Resource (in)  ──►  Puerto de entrada  ──►  Servicio (application)
                                                    │
                            Puerto de salida ◄──────┘
                                    │
                          Neo4jGrafoAdapter
                          MinioS3StorageAdapter
```

El mecanismo concreto de transporte del archivo y la emisión del token quedan diferidos a `design.md`. La persistencia de la sesión sí está en alcance, pero su mecanismo queda también diferido a `design.md`.

---

## Cambios en el grafo

**Nodos**

- `:Usuario` ya existe. Se agrega **una** propiedad de credencial con el hash de la contraseña. El nombre de la propiedad es decisión de diseño.
- `avatarUrl` ya existe y por fin se puebla desde una subida real.

**Restricciones**

- El seed ya declara `CREATE CONSTRAINT unique_user_id IF NOT EXISTS FOR (u:Usuario) REQUIRE u.id IS UNIQUE;`. La restricción existe y el grafo garantiza la unicidad de `id` a nivel de almacenamiento, pero esa garantía solo se ejerce cuando una consulta **intenta crear** un `id` repetido. Ver la restricción del punto siguiente.
- `username` **no** tiene restricción de unicidad. Dos usuarios podrían compartir username. Decidir si se agrega la restricción o se valida en el puerto de entrada es decisión de diseño.
- El registro debe fallar ante `id` duplicado con `409` y **no** fusionar silenciosamente. **La restricción `unique_user_id` no basta para garantizarlo**: `Neo4jGrafoAdapter.guardarUsuario` ejecuta `MERGE (u:Usuario {id: $id}) SET ...`, que es match-or-create, de modo que ante un `id` repetido hace match y el `SET` sobrescribe el nodo existente. La restricción solo salta ante dos creaciones **concurrentes** del mismo `id`, no ante un envío duplicado en serie. Alcanzar el `409` exige un cambio de código —usar `CREATE` en lugar de `MERGE`, o comprobar la existencia en el puerto de entrada antes de escribir— y esa brecha queda declarada para la fase de apply.

**Relaciones**

Ninguna nueva. Esta historia no crea ni modifica tipos de relación.

**Datos semilla**

`docker/neo4j-seed.cql` crea seis usuarios (`carlos-patino`, `paulo-orrala`, `angel-villon`, `beatriz-silva`, `david-mendoza`, `elena`) **sin credencial**. Consecuencia directa: esos seis usuarios no podrían iniciar sesión. Se debe decidir si el seed se actualiza con hashes de las credenciales de desarrollo, o si el login solo habilita a usuarios recién registrados. Es una decisión explícita, no un descuido.

---

## Cambios en permisos

Hoy **ningún endpoint valida identidad**. Esta historia introduce el mecanismo y lo aplica al alcance de `user-identity`.

- `POST /api/auth/login` es público por definición: emite el token.
- El registro es público, y genera la credencial.
- La lectura y edición de perfil, y la subida de avatar, requieren token válido.
- Identidad válida significa: el token contiene un identificador de usuario existente y no expirado. No hay roles ni permisos differentiation; la autorización es de proprietario — un usuario solo puede leer y editar su propio perfil.

La aplicación del mismo mecanismo a los endpoints de `feed`, `posts`, `chat` y `push` corresponde a sus historias. Mientras tanto, esos endpoints siguen operando sobre identificadores crudos: es un riesgo conocido y aceptado durante esta historia, no un olvido.

---

## Entregables

1. Propiedad de credencial en `Usuario`, con hash y sin exposición en respuestas ni logs.
2. Método de lectura de usuario en el puerto de entrada y en el de salida, con su implementación Cypher.
3. `GET /api/users/{userId}` con validación de proprietario.
4. `POST /api/auth/login` que emite el token.
5. Mecanismo reutilizable de validación de token.
6. Método de subida de avatar en el puerto de entrada, su implementación en el servicio de aplicación, y el endpoint REST correspondiente.
7. Restricciones de validación declarativas en los endpoints nuevos y modificados.
8. Servicio HTTP de autenticación y perfil en el frontend.
9. Estado de sesión con setter, con la identidad real, y el token persistido en el navegador de modo que la sesión sobreviva a una recarga.
10. Formulario de registro y formulario de inicio de sesión.
11. Vista y edición de perfil, con subida de avatar.
12. Controles de sesión en `Navbar`.
13. `cd backend && mvn compile` y `cd frontend && pnpm run build` en verde.

---

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| La credencial se persiste o se registra en claro | compromises total de cuentas | Hash con algoritmo de derivación con sal; nunca incluir credencial en logs ni en el JSON de respuesta |
| El token en `localStorage` es legible desde JavaScript | Robo de sesión ante un XSS | Riesgo aceptado y documentado. Mitigarlo exigiría cookie `httpOnly`, con el manejo de CSRF y de ciclo de vida que arrastra, sin beneficio operacional en el contexto de esta aplicación. Se acepta como contrapeso de la persistencia, con vida de token acotada y sin logging del valor |
| La sesión persiste indefinidamente en el navegador | Sesión abierta en un equipo compartido | Cerrar sesión es una acción explícita del usuario y descarta el token del almacenamiento. El riesgo se acepta porque el modo de uso previsto es de un único operador por estación |
| El registro fusiona silenciosamente un `id` repetido | Pérdida de datos del usuario existente | **Hoy ocurre de hecho.** El `MERGE` de `guardarUsuario` hace match y sobrescribe; la restricción `unique_user_id` no lo impide porque solo salta ante creaciones concurrentes. Mitigar exige cambiar el Cypher a `CREATE` o validar la existencia en el puerto de entrada. El riesgo queda **abierto** hasta que ese cambio se aplique |
| `username` duplicado | Ambigüedad al buscar o autenticar | Decidir en diseño entre agregar restricción de unicidad o validar en el puerto de entrada |
| Subida sin límites de tamaño ni de tipo | Consumo de memoria y objetos inválidos en el bucket | Validación en el borde REST: tamaño máximo y tipo permitido |
| Los seis usuarios semilla no pueden iniciar sesión | Rompe el flujo de desarrollo por defecto | Decisión explícita sobre el seed, declarada arriba |
| Reemplazar `currentUserId` fijo rompe features que lo consumen como prop | Regresión en feed, sugerencias y chat | Esas features ya reciben `currentUserId` por prop; cambiar su origen no debe cambiar su forma |
| El estado de sesión se duplica en varios componentes | Sesión inconsistente entre vistas | Una única fuente de verdad en el nivel de aplicación, leída por el resto |

---

## Criterios de éxito

- [ ] `POST /api/auth/login` con credenciales válidas responde `200` con token
- [ ] `POST /api/auth/login` con credenciales inválidas responde `401` y no filtra si el usuario existe
- [ ] El nodo `:Usuario` creado no contiene la contraseña en claro
- [ ] `POST /api/users` con `id` duplicado responde `409` y no sobrescribe el usuario existente
- [ ] `POST /api/users` con campos faltantes responde `400` identificando el campo
- [ ] `GET /api/users/{id}` sin token responde `401`
- [ ] `GET /api/users/{id}` con token de otro usuario no permite leer el perfil ajeno
- [ ] `GET /api/users/{id}` con token propio responde `200` con los datos del perfil
- [ ] La subida de avatar deja el archivo en MinIO y persiste la URL en `avatarUrl`
- [ ] La subida rechaza tipos no permitidos y archivos por encima del límite de tamaño
- [ ] El frontend deja de usar `carlos-patino` fijo, conserva el token entre recargas y mantiene la sesión al recargar la página
- [ ] Cerrar sesión descarta el token del almacenamiento del navegador
- [ ] El estado de sesión se actualiza al registrarse, al iniciar sesión y al cerrar sesión
- [ ] `cd backend && mvn compile` sale con código 0
- [ ] `cd frontend && pnpm run build` sale con código 0
- [ ] Ningún archivo de prueba fue creado
