# US-14 Buscar usuarios (TUX-71) — Odd tasks

> **Rama**: `angelvilloon853/tux-71-us-14-buscar-usuarios`
> **Ticket**: TUX-71 · **Dominio**: `social-graph` · **Estimación**: 3 SP
> **TDD**: desactivado (`strict_tdd: false`, fuente `openspec/config.yaml`). Se escribe el test antes
> del cambio cuando aporta (RED → GREEN), pero no es obligatorio por contrato.

## Objetivo

Encontrar a una persona por su nombre o su nombre de usuario y abrir su perfil, cerrando el circuito
que US-12 dejó a medias: **buscar → resultado → perfil → seguir.**

## Estado inicial verificado (rama limpia en `fab73ac`)

Hecho:

- `GET /api/users/{userId}` (perfil), `/follows`, `/followers`, `/comunes`, `/sugerencias`.
- `UsuarioPublicoResponse` de US-12, el DTO estrecho para listas de personas.
- `mapearUsuarioDeRelacion` con la guarda de null sobre `nombre`.

Falta:

- **Cualquier** lectura de búsqueda. No hay consulta, ni puerto, ni ruta, ni cliente, ni UI.
- `GET /api/users` devuelve **toda la comunidad con el correo de cada persona y sin autenticación**.
  Verificado que el frontend no lo llama: `userApi.ts` usa `/users/{id}`, `POST /users` y
  `/users/{id}/avatar`. Es un endpoint muerto en el cliente y vivo en el servidor.

## Decisiones

- **D1 — Los acentos se normalizan en la consulta, no en un campo del nodo.** El ticket recomendaba
  agregar `nombreNormalizado` y `usernameNormalizado` al `:Usuario` y migrar la semilla. Se descarta
  el campo. La razón no es el rendimiento: es que todo `:Usuario` escrito antes de esta historia
  quedaría **invisible en búsquedas sin lanzar ningún error**. Con la normalización en la consulta no
  existe ese caso.

  Se probaron cuatro técnicas contra Neo4j 5.20 real antes de decidir. **Tres fallan en silencio**:

  | Candidato | `patino` encuentra a `Patiño` | Por qué falla |
  |---|---|---|
  | `toLower()` puro | no | `ñ` no es `n` |
  | Índice full-text de Neo4j | no | el analizador no pliega la `ñ` |
  | `apoc.text.clean(toLower(x))` | no | **borra los espacios**: `"carlospatino"` |
  | `apoc.text.regreplace(toLower(x))` | no | **borra la `ñ`**: `"carlos patio"` |
  | `reduce` + `replace` en Cypher | **sí** | ninguna de las tres anteriores lanza error |

  Ninguna de las perdedoras se delata: devuelven `[]` y se leen como correctas. `reduce` + `replace`
  usa sólo funciones estándar y no depende de un plugin.

  **Deuda que deja**: sigue siendo un escaneo de etiqueta (la normalización se evalúa por nodo).
  Aceptable para miles de nodos. Cuando crezca, la respuesta es el índice de texto completo, que
  además exige decidir si pliega acentos — la medición de esta historia dice que **no** por defecto.

- **D2 — El cURL de verificación del ticket dice `q=pino` y es imposible.** El ticket pide, en dos
  sitios, que buscar `pino` encuentre a `Carlos Patiño`. Medido sobre el dato real:
  `"Carlos Patiño"` → `"carlos patino"`, y **`pino` no es subcadena de `patino`** (faltan `at`).
  Da igual la normalización: sin ella `patino` tampoco encuentra.

  El ejemplo además no distingue la opción (a) de la (b), así que no prueba nada. **Se corrige a
  `q=patino`**, que es el caso que de verdad demuestra el valor de la normalización, y queda una
  prueba que fija por qué `pino` no funciona, para que nadie lea el `[]` como un fallo.

- **D3 — `GET /api/users` se elimina de los cinco eslabones**, no sólo del recurso. Dejar
  `listarUsuarios()` en el servicio deja la puerta abierta con el mismo defecto detrás.

- **D4 — `GET /api/users` responde `405`, no el `404` que pide el ticket.** Medido: `POST /api/users`
  (el registro de US-01) sigue declarado en esa ruta, así que la ruta existe y lo que no existe es
  el GET. Conseguir un `404` exigiría romper el alta de usuarios. El defecto queda cerrado igual.

- **D5 — El mínimo de 2 caracteres se comprueba en el servidor, no sólo en el cliente.** Una
  mitigación que sólo existe en el navegador no mitiga nada contra un `curl`. El frontend lo comprueba
  además para no hacer una ida que el servidor va a rechazar con `400`.

- **D6 — Se reutiliza `UsuarioPublicoResponse` y no se crea un DTO nuevo.** La búsqueda devuelve
  exactamente las mismas cuatro propiedades que los seguidores y las conexiones en común. Dos clases
  con los mismos campos serían dos sitios donde añadir un campo por accidente.

- **D7 — El buscador va en el Navbar sin ocultarse en móvil.** Es la única forma de llegar a alguien
  que no está en tu red, y en un teléfono la red es pequeña. La primera versión lo ocultaba con
  `hidden md:block`; jsdom no calcula media queries y la prueba de integración de `App` no lo encontraba,
  lo que destapó la decisión de diseño además del fallo.

## Tareas

### B1 — Consulta y orden `[back]`

- [x] B1.1 `buscarUsuarios(texto, limite)` con `reduce` + `replace` sobre `username` y `nombre`
- [x] B1.2 `CASE` de 5 niveles, en orden de prioridad, + desempate por `username`
- [x] B1.3 `LIMIT $limite` como parámetro, tope 20 (en el servicio, no en el adaptador)
- [x] B1.4 `RETURN` de cuatro propiedades; `email`, `password` y `pushSubscriptionJson` no se proyectan
- [x] B1.5 Reutiliza `mapearUsuarioDeRelacion` (guarda de null de US-12)
- [x] B1.6 El texto buscado se normaliza en Java, con la misma tabla que la de Cypher

### B2 — Cerrar el directorio `[back]`

- [x] B2.1 `listarUsuarios()` borrado de recurso, caso de uso, servicio, puerto y adaptador
- [x] B2.2 `GestionarGrafoSocialUseCaseDePrueba` actualizado
- [x] B2.3 `GET /api/users` → `405`, `POST /api/users` sigue en pie

### B3/B4 — Puertos, servicio y recurso `[back]`

- [x] B3.1 `buscarUsuarios` en `GrafoPersistencePort` y en `GestionarGrafoSocialUseCase`
- [x] B4.1 `GET /api/users/buscar?q=` con `UsuarioPublicoResponse`
- [x] B4.2 `400` + clave `error` si falta `q` o tiene menos de 2 caracteres
- [x] B4.3 `400` sin tocar el grafo

### F1/F2 — Frontend `[front]`

- [x] F1.1 `ResultadoBusquedaUsuario` (tipo distinto de `Usuario`: aquí no hay correo)
- [x] F1.2 `buscarUsuarios(texto, signal)` propagando el error
- [x] F2.1 `UserSearchBox` con seis estados separados
- [x] F2.2 Debounce de 250 ms
- [x] F2.3 `AbortController` + descarte de respuestas obsoletas
- [x] F2.4 Montado en `Navbar`, con `onOpenPerfil` desde `App`

## Checklist

| # | Comprobación | Resultado |
|---|---|---|
| B1 | La consulta no proyecta correo, contraseña ni push | verde |
| B1 | El orden es el `CASE` de 5 niveles, en orden de prioridad | verde |
| B1 | El ranking es determinista (desempata por `username`) | verde |
| B1 | Un `nombre` ausente llega `null`, no `"null"` | verde |
| B1 | `q=patino` encuentra a `Patiño`; `q=pino` no | verde, contra Neo4j real |
| B2 | `listarUsuarios` no existe en ningún eslabón | verde |
| B2 | `GET /api/users` no devuelve el directorio | verde, por HTTP |
| B2 | `POST /api/users` sigue declarado | verde |
| B4 | Menos de 2 caracteres → `400` sin tocar el grafo | verde |
| B4 | La respuesta es `UsuarioPublicoResponse`, sin correo | verde |
| Rutas | `/buscar` no se confunde con `/{userId}` | verde, por HTTP real |
| F2 | Menos de 2 caracteres → ninguna petición | verde |
| F2 | Una sola petición por texto escrito (debounce) | verde |
| F2 | La petición anterior se cancela y su respuesta no se pinta | verde |
| F2 | Los seis estados se distinguen | verde |
| F2 | El resultado abre el perfil | verde |
| F2 | `App` encadena búsqueda → perfil | verde |
| G1 | `mvn verify` | verde: 213 pruebas, Spotless limpio, SpotBugs 0 |
| G2 | `pnpm run lint` | verde, 0 errores |
| G3 | `pnpm test` | verde: 14 archivos de prueba |
| G4 | `pnpm run build` | verde |
| G5 | Prettier en los 7 archivos de US-14 | verde |
| G6 | `pnpm run format:check` completo | **rojo por 22 archivos que NO son de esta historia** |

## Gotchas

- **`apoc.text.clean` y `apoc.text.regreplace` no sirven** y fallan en silencio. La tabla de D1 es la
  razón de que el código use `reduce`, y hay una prueba que ata la tabla de Cypher con la de Java
  (`NormalizadorTextoTest.laTablaCypherCoincideConLaDeJava`). Si alguien cambia una y no la otra, la
  búsqueda deja de encontrar a la gente con acentos sin ningún error.
- **Testcontainers no negocia con el socket de Docker en esta máquina** y salta las 28 pruebas de
  `Neo4jGrafoAdapterPerfilAjenoIT`. Con un Neo4j externo (`-Dneo4j.test.uri=bolt://localhost:7688`)
  corren las 28 de verdad. Verificado así.
- **`spotless:check` falla offline** porque falta `google-java-format:1.22.0` en el repositorio local
  (sólo hay 1.24.0). No es un defecto del código: se resolvió descargando el artefacto y corriendo
  `spotless:apply`.
- **`cypher-shell` por stdin destroza los acentos**: la `ñ` de la semilla llega como dos caracteres de
  reemplazo y `Carlos Patiño` mide 14 en vez de 13. Es el defecto que documenta `docker/seed.sh`. Para
  la verificación se corrigió el nodo con escapes Unicode. **No afecta al código**, pero hace que una
  comprobación manual de acentos dé un falso negativo.
- **`userEvent` se cuelga con temporizadores falsos** salvo que se le pase `advanceTimers`. Las
  pruebas del buscador usan `fireEvent` + `vi.advanceTimersByTime` dentro de `act`, que además
  elimina la dependencia de cuánto tarde el runner.
- **`vi.resetAllMocks()` en `App.test.tsx`** deja `buscarUsuarios` en `undefined` y el render de `App`
  revienta con "Cannot read properties of undefined (reading 'then')". Es el mismo gotcha que
  documentaba el mock de `fetchTendencias` en US-11.
- **jsdom no calcula media queries**: un `hidden md:block` hace que el elemento no exista para
  `getByLabelText`. Salió así la decisión D7.
- **`pnpm run format:check` ya estaba rojo antes de esta historia**: en `fab73ac` falla con 27
  archivos, verificado con `git stash` sobre el árbol limpio. Los 22 que quedan ahora son los
  preexistentes; los 7 de US-14 están formateados y pasan. **`pnpm run check` está rojo por eso, y
  el CI también**, así que conviene arreglarlo en un commit aparte: no es de esta historia y meter
  aquí un reformateo de 22 archivos ajenos escondería el diff de la funcionalidad. Los tres gates que
  sí importan para US-14 (`lint`, `test`, `build`) están en verde.

## Deuda que deja esta historia

| Deuda | Por qué no se resuelve aquí |
|---|---|
| Sin rate limiting en ningún endpoint | La búsqueda es un vector de enumeración de nombres. El mínimo de 2 caracteres lo mitiga; no lo arregla. Anotada con dueño en el ROADMAP. |
| `CONTAINS` es un escaneo de etiqueta | Aceptable para miles de nodos. La respuesta es un índice de texto completo, que además exige decidir el tratamiento de acentos. |
| Sin autenticación en la búsqueda | US-01 es su dueña y el ROADMAP la tiene como bloqueante. Con esto la búsqueda queda expuesta igual que ya estaban `/follows` y `/followers`. |
| `GET /api/users/{userId}` sigue devolviendo el correo de cualquier persona | Fuera del alcance de esta historia: es el perfil propio, se pide autenticado, y cerrarlo rompería el `Navbar`, que lo usa para editar el perfil. **Es el mismo tipo de fuga que esta historia cierra en el otro endpoint**, y conviene revisarlo con US-01. |