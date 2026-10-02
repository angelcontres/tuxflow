# US-12: Perfil de Usuario Ajeno (Propuesta de Ticket para Linear)

> **Estado:** propuesta. **No** está en `docs/backlog-programadores.md` ni en el `ROADMAP.md`, y no
> debe agregarse sin decisión del arquitecto. Este archivo existe para que la tarjeta se copie y
> pegue en Linear, tal como describe el encabezado de `backlog-programadores.md`.
>
> **Numeración propuesta:** US-12 y `TUX-63`. El último Linear usado es `TUX-62` (US-11) y las
> tarjetas del backlog llegan a `TUX-11`. **Verificar en Linear antes de crear**: la numeración ya se
> equivocó una vez (`TUX-57` y `TUX-58` estaban intercambiados en el roadmap hasta el 2026-09-26) y no
> se debe deducir el ticket a partir del número de historia.
>
> **Épica:** Identidad / Grafo Social · **Sprint sugerido:** 3 · **Asignado sugerido:** Angel Villon / Carlos Patiño

---

### [TUX-63] US-12: Perfil de Usuario Ajeno

* **Épica:** Identidad
* **Prioridad:** P1 (Should Have)
* **Estimación:** 5 Story Points
* **Rama Git:** `feature/US-12-perfil-ajeno`
* **Asignado recomendado:** Angel Villon / Carlos Patiño
* **Depende de:** US-01, US-02, US-09

#### 📝 Descripción

Como usuario de la comunidad, quiero abrir el perfil de cualquier otra persona para ver quién es, qué
publica y cómo me conecto con ella, sin tener que salir de la sesión ni cambiar de usuario.

Hoy el producto sólo conoce el perfil propio: el modal de `Navbar` carga `/api/users/{id}` con el
`currentUserId` de la sesión, y no existe ninguna noción de "estoy mirando a otra persona". Esta
historia crea esa noción, y es la que desbloquea a US-09 y US-10, que hoy la asumen y no la tienen.

#### 🎯 Criterios de Aceptación (Gherkin)

```gherkin
Dado que "carlos-patino" ha iniciado sesión
Y que existe el usuario "beatriz-silva"
Cuando abre el perfil de "beatriz-silva"
Entonces el frontend obtiene sus datos con GET /api/users/beatriz-silva
Y muestra nombre, @username y avatar, con la inicial como respaldo si no hay avatar
Y muestra sus publicaciones con GET /api/posts/autor/beatriz-silva
Y muestra el botón "Seguir" o "Dejar de seguir" según exista la relación [:SIGUE]
Y desde ese perfil se puede abrir el panel de conexiones en común con "carlos-patino"
Y desde ese perfil se puede calcular la distancia de separación con "carlos-patino"
```

#### 🛠️ Tareas de Desarrollo

1. **Backend (Quarkus Hexagonal):**
   - `UserGraphResource.java`: reutilizar `GET /api/users/{userId}`, que ya existe y ya devuelve
     `UsuarioResponse`. **No crear un endpoint nuevo para leer el perfil.**
   - `PostResource.java` + `GrafoPersistencePort`: **endpoint nuevo** `GET /api/posts/autor/{userId}`,
     con la consulta
     `MATCH (u:Usuario {id: $userId})-[:PUBLICA]->(p:Post) RETURN p ... ORDER BY p.fechaCreacion DESC`.
     Reutilizar `Post` y el mapeo existente; no duplicar el DTO.
   - `Neo4jGrafoAdapter.java`: método de lectura `obtenerPostsDeUsuario(String)`, siguiendo el patrón
     de `obtenerSeguidos`. Ojo con `p.fechaCreacion`: se escribe como entero
     (`datetime().epochMillis`) y no debe leerse con `.asString()`. Ver la tabla de defectos abiertos.
   - **Endpoint nuevo** `GET /api/users/{userId}/followers`, siguiendo el `follows` que ya existe con
     `MATCH (u:Usuario {id: $userId})<-[:SIGUE]-(s:Usuario)`.
   - Pasar la relación siempre por `UsuarioResponse` o por un DTO nuevo. **Nunca** serializar `Usuario`
     de dominio directo: tiene `password` y `pushSubscriptionJson`.

2. **Frontend (React + Tailwind):**
   - `features/user/components/PerfilAjeno.tsx`: componente nuevo. **No** reutilizar ni editar el modal
     de `Navbar`, que es el perfil propio y tiene formulario de edición.
   - `features/user/services/userApi.ts`: `fetchUsuario` ya existe y sirve. Agregar
     `fetchPostsDeUsuario(userId)` y `fetchSeguidores(userId)`.
   - Navegación: los `@username` de `UserSuggestionsCard` y de `ConexionesComunesPanel` pasan a ser
     enlaces al perfil. Hoy son texto plano en ambos.
   - Montar `ConexionesComunesPanel` (US-09) y el panel de distancia (US-10) **dentro** del perfil
     ajeno, con el otro usuario ya preseleccionado. Así el campo de texto de US-09 se vuelve un
     selector y queda saldada la deuda que su `design.md` declara.
   - Botón Seguir / Dejar de seguir reutilizando `followUserInGraph` y `unfollowUserInGraph` de
     `features/network/services/networkApi.ts`. El estado inicial sale de
     `GET /api/users/{viewerId}/follows`.

3. **Deuda que esta historia cierra:**
   - `ConexionesComunesPanel` y el futuro panel de distancia dejan de recibir el "otro usuario" por
     campo de texto.
   - La matriz de trazabilidad de `architecture-and-backlog.md` nombra
     `features/network/MutualFriendsModal.tsx` (US-09) y `features/network/DegreeSeparationModal.tsx`
     (US-10). **Ninguno de los dos archivos existe.** Con esta historia, el sitio natural de ambos es
     el perfil ajeno. Actualizar la matriz al implementar.

#### ⚡ Prueba cURL Inmediata

```bash
# El perfil ya responde hoy: no requiere cambios de backend
curl -X GET "http://localhost:8080/api/users/beatriz-silva"
# Respuesta esperada:
# {"id":"beatriz-silva","username":"beatriz","nombre":"Beatriz Silva",
#  "email":"beatriz@upse.edu.ec","avatarUrl":"https://...","pushSubscriptionJson":null}

# ESTE ES EL QUE NO EXISTE HOY: las publicaciones de un usuario
curl -X GET "http://localhost:8080/api/posts/autor/beatriz-silva"
# Respuesta esperada: los :Post que publica beatriz-silva, del más nuevo al más viejo.
```

#### 🎯 Por qué 5 Story Points y no 3

US-09 y US-10 son de 3 SP cada una y ambas asumen un perfil ajeno que no existe. Esta historia es la
que lo construye, y además agrega dos endpoints nuevos, un componente, navegación y cierre de deuda.
Comparada con US-07 (5 SP, mensajería con WebSockets) es de tamaño similar.

#### ⚠️ Defectos abiertos que toca, y que hay que decidir antes de empezar

| Defecto | Dónde | Por qué importa acá |
|---|---|---|
| `Post.fechaCreacion` con tres supuestos | `Neo4jGrafoAdapter` | US-04 lo escribe como entero, US-05 lo lee con `.asString()` y US-11 lo compara contra fecha con hora. **Dos de los tres están equivocados.** El endpoint de publicaciones de esta historia ordena por ese campo, así que hay que decidir la representación **antes** de escribir el `ORDER BY`. |
| `nombre` sin guarda de null | `Neo4jGrafoAdapter:97` y `:177` | `obtenerSugerencias` y `obtenerSeguidos` devuelven el texto literal `"null"` cuando el nodo no tiene nombre: en `neo4j-java-driver 5.24.0`, `NullValue.asString()` no lanza. En US-09 se corrigió sólo la copia de `obtenerSeguidoresEnComun`. **El perfil ajeno muestra nombres, así que acá el defecto es visible.** |
| `currentUserId` fijo en código | `frontend/src/App.tsx` | El `ROADMAP` lo tiene como defecto abierto de US-01. Sin sesión real, el perfil ajeno se desarrolla contra un viewer hardcodeado. |
| `GET /api/users/comunes` sin control de acceso | backend | Cualquiera que conozca dos identificadores obtiene la intersección de seguidos. El perfil ajeno vuelve esto trivial de explotar. Hoy no hay autenticación; cuando aterrice US-01 hay que revisarlo. |
| Serialización de `Usuario` de dominio | `UserGraphResource` | `/comunes` y `/follows` devuelven `Usuario` crudo, con `password` y `pushSubscriptionJson` en `null`. No hay fuga hoy porque esos métodos no los llenan, pero el patrón es frágil y el perfil ajeno lo hace más visible. Corregir con `UsuarioResponse`. |

#### 🔗 Relación con el resto de historias

```
US-01 (perfil propio)  ─┐
US-02 (seguir/dejar)   ─┼─→  US-12 (perfil ajeno)  ─┬─→  US-09 (conexiones en común)
US-09 (conexiones)     ─┘                          └─→  US-10 (camino más corto)
```

US-09 se implementó sin esta historia, con un campo de texto, y por eso su `design.md` la declara
deuda. Implementar US-12 después es el orden correcto y no obliga a retocar US-09: sólo cambia de
sitio el montaje del panel.

#### ✅ Verificación

```bash
# Backend
cd backend && mvn verify

# Frontend
cd frontend && pnpm run check

# cURL
curl -X GET "http://localhost:8080/api/users/beatriz-silva"
curl -X GET "http://localhost:8080/api/posts/autor/beatriz-silva"
```

En navegador: abrir el perfil desde un `@username` de la tarjeta de sugerencias, comprobar que carga
avatar y publicaciones, que el botón de seguir refleja el estado real, y que desde ahí se abre el
panel de conexiones en común sin escribir el identificador a mano.
