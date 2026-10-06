# US-14: Buscar usuarios (propuesta de ticket para Linear)

> **Estado:** propuesta. **No** está en `docs/backlog-programadores.md` ni en el `ROADMAP.md`, y no
> debe agregarse sin decisión del arquitecto. Este archivo existe para que la tarjeta se copie y
> pegue en Linear, tal como describe el encabezado de `backlog-programadores.md`.
>
> **Numeración propuesta:** US-14, siguiendo a la propuesta de US-13 (`docs/propuesta-us-13-scroll-infinito.md`).
> **No se propone número de ticket.** Hay al menos un `TUX-65` en una rama remota, y la numeración ya
> se equivocó una vez en este repo. Hay que verificarla en Linear.
>
> **Épica:** Identidad / Grafo Social · **Sprint sugerido:** 4 · **Asignado sugerido:** Angel Villon /
> Carlos Patiño

---

### US-14: Buscar usuarios

* **Épica:** Identidad
* **Prioridad:** P1 (Should Have)
* **Estimación:** 3 Story Points
* **Rama Git:** `feature/US-14-buscar-usuarios`
* **Asignado recomendado:** Angel Villon / Carlos Patiño
* **Depende de:** US-12

#### 📝 Descripción

Como usuario de la comunidad, quiero buscar a una persona por su nombre o su nombre de usuario para
encontrarla y abrir su perfil, sin conocer su identificador de antemano.

Hoy el producto sólo se conoce a quien ya está en tu red: sugerencias, seguidos y conexiones en común.
US-12 construyó el perfil de otra persona, así que la segunda mitad de la navegación ya existe, pero
falta la primera: **encontrar** a esa persona. Hoy la única forma es adivinar el identificador
(`beatriz-silva`) y escribirlo a mano.

#### ⚠️ El defecto previo que esta historia tiene que tocar

**`GET /api/users` devuelve todos los usuarios, con su correo, y no pide autenticación.** `UserGraphResource.listarUsuarios()`
no tiene guarda de sesión y mapea a `UsuarioResponse`, que sí lleva `email`.

```bash
curl -X GET http://localhost:8080/api/users
```

Devuelve el directorio completo de la comunidad con el correo de cada persona. No hay fuga de
`password` --`UsuarioResponse` no lo expone-- pero el correo es un dato de contacto que nadie pidió
publicar, y sin autenticación cualquiera que sepa la URL lo lee.

Dos consecuencias para esta historia:

1. **Es el atajo más tentador y es un error.** Filtrar la lista en el navegador es la implementación
   que cualquiera escribiría primero, y por eso está disponible hoy. No sirve: reparte un directorio
   completo a cada cliente para descartar el 99%, y perpetúa la fuga.
2. **Esta historia debe cerrar el endpoint**, no sólo dejar de usarlo. Un `GET /api/users` abierto
   sigue siendo un directorio con correos aunque la búsqueda correcta exista al lado.

Ninguno de los dos es opcional. Una búsqueda por el navegador sobre un endpoint abierto es la peor de
las tres opciones: paga el coste de la versión correcta y mantiene el defecto de la incorrecta.

#### 🎯 Criterios de Aceptación (Gherkin)

```gherkin
Dado que "carlos-patino" ha iniciado sesión
Y que existe el usuario "beatriz-silva" con nombre "Beatriz Silva"
Cuando escribe "beatriz" en el buscador
Entonces ve a "Beatriz Silva" entre los resultados
Y ningún resultado trae correo, contraseña ni suscripción push

Cuando escribe "beatriz sil"
Entonces ve a "Beatriz Silva", aunque su nombre de usuario no contenga el espacio

Cuando escribe un texto que no coincide con nadie
Entonces ve un mensaje que dice que no hay resultados
Y no una lista vacía sin explicación

Cuando escribe menos de dos caracteres
Entonces no se hace ninguna petición al servidor

Dado que "carlos-patino" ya sigue a "beatriz-silva"
Cuando busca "beatriz"
Entonces puede abrir el perfil de "beatriz-silva" desde el resultado
```

#### 🛠️ Tareas de Desarrollo

1. **Cerrar el directorio [back]**
   - `GET /api/users` deja de responder la lista completa. O se elimina, o pasa a exigir sesión y a
     devolver `UsuarioPublicoResponse`.
   - **Recomendado:** eliminarlo. Se verificó que el frontend no lo llama en ningún sitio: `userApi.ts`
     usa `/users/{id}`, `/users` para registrar y `/users/{id}/avatar`. El `GET /users` es un endpoint
     muerto en el cliente y vivo en el servidor, que es la peor combinación posible.
   - La búsqueda nueva no es su sustituto funcional: filtra, ordena y limita, y eso es lo que este
     endpoint no hace.

2. **Consulta de búsqueda [back]**
   - `MATCH (u:Usuario) WHERE toLower(u.username) CONTAINS $q OR toLower(u.nombre) CONTAINS $q`.
   - Proyectar `id`, `username`, `nombre`, `avatarUrl` y nada más. El `RETURN` es la primera defensa
     contra la fuga; la segunda es el DTO.
   - `LIMIT` como parámetro, con un tope mucho menor que el de un perfil: aquí la lista corta es
     siempre el resultado esperado, porque hay un criterio de búsqueda. 20 es suficiente.

3. **Orden de los resultados [back]**
   - El orden tiene que ser por relevancia, no por `nombre` alfabético, o la búsqueda es inusable:
   - **1.** Coincidencia exacta de `username`. Es lo que alguien busca el 90% de las veces.
   - **2.** El `username` empieza por lo buscado.
   - **3.** El `username` lo contiene.
   - **4.** El `nombre` empieza por lo buscado.
   - **5.** El `nombre` lo contiene.
   - En Cypher es un `CASE` sobre las posiciones, o dos consultas encadenadas. Lo que no vale es
     devolver por `id` y dejar que el cliente ordene: el cliente no sabe la regla.

4. **Acentos: hay que decidirlo antes de escribir la consulta**
   - La semilla tiene `Carlos Patiño` y `Paulo Orrala`, así que el caso es real desde el primer día.
   - Buscar `pino` debería encontrar a `Patiño`. Con `toLower()` no lo encuentra: `ñ` no es `n`.
   - **Opciones:** (a) guardar un campo normalizado sin acentos al escribir el usuario, y buscar
     contra él; (b) aceptar que `pino` no encuentre a `Patiño` y documentarlo.
   - **Recomendada (a).** Se agrega `nombreNormalizado` y `usernameNormalizado` al nodo, se llenan en
     `guardarUsuario`, y la búsqueda va contra esos campos. Cuesta un campo más y una migración de
     los datos de la semilla, y hace que la búsqueda funcione como la gente espera.
   - Sin esto, la búsqueda parece rota con cualquier nombre que lleve `ñ`, `á` o `é`, que en una
     comunidad universitaria es la mayoría.

5. **Mínimo de caracteres y enumeración**
   - Con un mínimo de 2 caracteres se evita el volcado del directorio letra a letra. Con 1, "a" devuelve
     casi todo y el endpoint se convierte en un `GET /api/users` con otro nombre.
   - Es una mitigación, no una solución: con 2 caracteres también se pueden enumerar los nombres. Lo
     que falta es el rate limiting, que no hay en ninguna parte de la API. Queda anotado como deuda.

6. **Qué se busca [back]**
   - `username` y `nombre`. **No** `email`.
   - Buscar por correo no aporta nada al usuario --nadie recuerda el correo de alguien a quien quiere
     seguir-- y convierte el endpoint en un oráculo de "este correo existe en la comunidad", que es un
     vector de enumeración de correos.
   - **Y no se devuelve el correo en los resultados**, aunque se buscara por él.

7. **Interfaz [front]**
   - Un campo de búsqueda en el `Navbar`, con los resultados en un desplegable debajo.
   - Debounce de unos 250 ms: sin él, escribir "beatriz" dispara siete peticiones.
   - Cancelar la petición anterior si llega una nueva. Con debounce y sin cancelación, las respuestas
     pueden llegar desordenadas y pintar el resultado de un texto anterior.
   - Cada resultado es un enlace al perfil, que es lo que US-12 ya sabe hacer. La búsqueda cierra el
     circuito: **buscar → resultado → perfil → seguir.**
   - Estados distintos para: sin texto, demasiado corto, cargando, sin resultados, con resultados, y
     fallo. Un desplegable vacío sin explicación se lee como "no hay nadie".

8. **El propio usuario entre los resultados**
   - No excluirlo automáticamente: alguien puede buscar su propio nombre para comprobar que su perfil
     aparece bien. Excluirlo esconde un resultado real sin que nadie lo pida.

#### ⚡ Prueba cURL Inmediata

```bash
# Búsqueda normal
curl -X GET "http://localhost:8080/api/users/buscar?q=beatriz"

# Por parte del nombre, con acento
curl -X GET "http://localhost:8080/api/users/buscar?q=pino"

# El directorio completo, que YA NO debe existir
curl -X GET http://localhost:8080/api/users
# Antes: 200 con todos los usuarios y su correo. Después: 404.
```

> Ojo con la ruta: `/api/users/buscar` compite con `/api/users/{userId}`. En RESTEasy Reactive el
> segmento literal gana al de plantilla, así que funciona, pero **es exactamente el choque de rutas
> que US-12 no tenía prueba de** y que `PerfilAjenoRutasIT` cubre hoy para otras dos rutas. Si se
> elige `/api/users/search`, la comprobación es la misma. Lo que no vale es `/api/users/{userId}/search`,
> que se solapa con `/api/users/{userId}/follows` y `/{userId}/followers`.

#### ⚠️ Defectos abiertos que toca

| Defecto | Dónde | Por qué importa acá |
|---|---|---|
| `GET /api/users` devuelve el directorio con correos | `UserGraphResource.listarUsuarios()` | Es la fuga que la búsqueda deja de necesitar y hay que cerrar. Sin esto, la historia es un endpoint más encima de un directorio abierto. |
| Búsqueda con `CONTAINS` es un escaneo de etiqueta | `Neo4jGrafoAdapter` | Aceptable para una comunidad universitaria, que son miles de nodos. A escala de un campus grande se nota, y la respuesta es un índice de texto completo de Neo4j, que es otro trabajo. |
| Sin rate limiting en ningún endpoint | backend | La búsqueda es un vector de enumeración de nombres. El mínimo de 2 caracteres lo mitigate; no lo arregla. |
| `nombre` puede no venir | `Neo4jGrafoAdapter` | La búsqueda sobre `nombre` tiene que usar la guarda de null que US-12 aplicó, o devuelve el texto `"null"` como si fuera un nombre. |
| `toLower()` no quita acentos | consulta de búsqueda | Decidido en el punto 4 de las tareas, no se puede dejar abierto. |

#### 🔗 Relación con el resto de historias

```
US-01 (perfil propio) ─┐
US-02 (seguir/dejar)   ─┼─→  US-12 (perfil ajeno) ─┬─→  US-14 (buscar usuarios)
US-12 (perfil ajeno)   ─┘                          └─→  US-13 (scroll infinito)
```

US-14 es la primera mitad del circuito que US-12 dejó a medias. Sin ella, el perfil ajeno sólo se
alcanza desde la red, y una comunidad grande es casi toda gente que no está en tu red.

#### 🎯 Por qué 3 Story Points

Una consulta con orden por relevancia, el campo normalizado con su migración de la semilla, el cierre
de un endpoint, y un desplegable con debounce y cancelación. Es menos que US-12 y más que US-11, que
fue sólo un widget.

Lo que puede estirar la estimación, y hay que mirar antes de comprometer:

- **El campo normalizado.** No es un detalle: es un cambio de esquema y una migración de datos
  existentes. Si el arquitecto prefiere la opción (b) --buscar sin acentos y documentar la
  limitación-- la historia baja a 2 SP y no toca el esquema.
- **Cerrar `GET /api/users`**, si algún consumidor no visible depende de él, obliga a buscar quién lo
  usa antes de poder borrarlo.

#### ✅ Verificación

```bash
# Backend
cd backend && mvn verify

# Frontend
cd frontend && pnpm run test && pnpm run build

# cURL
curl -X GET "http://localhost:8080/api/users/buscar?q=beatriz"
curl -X GET "http://localhost:8080/api/users/buscar?q=pino"     # debe encontrar a Patiño
curl -X GET http://localhost:8080/api/users                    # debe dar 404
```

En navegador: escribir en el buscador, comprobar que no dispara una petición por tecla, que "pino"
encuentra a "Patiño", que los resultados llevan al perfil y que al llegar al final no hay un contador
sino más resultados.
