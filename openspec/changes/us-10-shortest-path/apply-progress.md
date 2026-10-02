# Apply Progress: US-10 (TUX-61) — Grado de separación y camino más corto

> **Change**: `us-10-shortest-path` · **Ticket**: `TUX-61` · **Rama**: `angelvilloon853/tux-61-us-10-degree-of-separation-and-shortest-path`
> **Contrato seguido**: `design.md` (D1–D5) y `specs/graph-algorithms/spec.md`.
> **Decisión del solicitante**: ante el conflicto de forma descrito abajo, manda el openspec sobre el
> cURL del ticket.

## Qué quedó implementado

| Unidad | Archivo | Estado |
|---|---|---|
| 1 — Validación de `origen` y `destino` (D2) | `UserGraphResource.java` | Completa |
| 1 — Forma vacía explícita sin camino (D2) | `Neo4jGrafoAdapter.java` | Completa |
| 1 — Username tolerante a ausencias (D5) | `Neo4jGrafoAdapter.java` | Completa |
| 1 — Identificador por salto (D4) | `Neo4jGrafoAdapter.java` | Completa |
| 2 — Tipo y función de API | `network.types.ts`, `networkApi.ts` | Completa |
| 3 — Control de distancia en la tarjeta (D3) | `UserSuggestionsCard.tsx` | Completa |

El backend ya venía cableado de punta a punta cuando llegó este change (el `proposal.md` lo
documenta). Lo que faltaba era exactamente lo que el `proposal.md` señaló: validación, distinción
de resultados y todo el frontend.

## CONFLICTO DE CONTRATO — la forma de `rutaConexion` cambió respecto al cURL del ticket

**El ticket dice una cosa y el `design.md` otra, y son incompatibles en el mismo campo.**

- El criterio de aceptación y el cURL del ticket esperan un **array de usernames**:
  `{"rutaConexion": ["carlos", "beatriz", "david", "elena"], "saltosTotales": 3}`
- El `design.md` D4 y el spec (*"cada elemento de la ruta trae identificador y nombre de
  usuario"*) exigen que cada salto sea un objeto `{id, username}`.

Un campo no puede ser las dos cosas. **Se siguió el openspec**, por indicación explícita del
solicitante. Consecuencia asumida y visible: **el cURL del ticket ya no devuelve la forma que el
ticket imprime.**

```
{"rutaConexion":[{"id":"carlos-patino","username":"carlos"},
                 {"id":"paulo-orrala","username":"paulo"},
                 {"id":"david-mendoza","username":"david"},
                 {"id":"elena-vega","username":"elena"}],
 "saltosTotales":3}
```

**Si el arquitecto prefiere el cURL literal, la reversión es de un momento**: en el adaptador, la
proyección vuelve a `[n IN nodes(p) | n.username]` y el tipo del frontend pasa a `string[]`. El
resto —validación, forma vacía, tolerancia a nulos, control de la tarjeta— no depende de la forma.

Nótese que D4 se contradice *consigo mismo*: dice *"el ticket espera una lista de nombres, y eso se
mantiene"* y en la misma frase pide el identificador. Sólo una de las dos lecturas es satisfacible.

### El Cypher obligatorio cambió en su proyección

Para poder devolver el identificador (D4) la proyección pasó de `[n IN nodes(p) | n.username]` a
`[n IN nodes(p) | {id: n.id, username: n.username}]`. **La semántica no se tocó**, que es lo que D1
declara obligatorio: `shortestPath`, recorrido **dirigido** de `[:SIGUE]`, tope de `*..6` y la
exclusión `WHERE origen <> destino`. La prueba `ejecutaElCypherDeCaminoMasCorto` falla si alguien
reintroduce la forma sin dirección o con la flecha invertida.

## HALLAZGO — el cURL esperado del ticket nombra un intermedio que no es el que sale

El ticket espera `["carlos", "beatriz", "david", "elena"]`. **La respuesta real es
`["carlos", "paulo", "david", "elena"]`.** No es un defecto de la consulta: es que **hay dos
caminos igual de cortos** y `shortestPath` devuelve uno de los dos.

Verificado contra el grafo real:

```
MATCH p = (carlos)-[:SIGUE*3]->(elena) RETURN [n IN nodes(p)|n.username]
  → ["carlos", "beatriz", "david", "elena"]
  → ["carlos", "paulo",  "david", "elena"]     <-- empate
```

`carlos` sigue a `beatriz` **y** a `paulo`, y los dos siguen a `david`. Los dos caminos son de 3
saltos, así que ninguno es "más corto" que el otro. Ejecutado tres veces seguidas, Neo4j devuelve
el de `paulo` de forma estable en este entorno, pero **el contrato de `shortestPath` no garantiza
cuál de los dos**, y puede cambiar con la versión, el plan o los datos.

**El total de saltos (3) sí coincide siempre con el ticket.** Lo que no está fijado es *qué*
intermedio aparece. Si la respuesta exacta del ticket importa como criterio, la semilla tiene que
dejar un único camino mínimo: basta con quitar `carlos -[:SIGUE]-> paulo`, o añadir un salto a
`beatriz`, para que el de `beatriz` sea el único mínimo. Es una decisión sobre la semilla, no
sobre el código.

## Verificación contra el grafo real

Neo4j levantado con `docker/neo4j-seed.cql` y el backend en `quarkus:dev`. Las 9 peticiones:

| Caso | Esperado por el spec | Resultado |
|---|---|---|
| `carlos-patino` → `elena-vega` | 200 con ruta y 3 saltos | **200 con ruta y 3 saltos** |
| `carlos-patino` → `angel-villon` (sin camino) | 200 ruta vacía, 0 saltos | **200 `{"rutaConexion":[],"saltosTotales":0}`** |
| Sin parámetros | 400 | **400** |
| Sólo `origen` | 400 | **400** |
| Sólo `destino` | 400 | **400** |
| `destino` de sólo espacios | 400 | **400** |
| Identificador inexistente | 200 sin camino, no 500 | **200 ruta vacía** |
| `carlos-patino` → `carlos-patino` | distinguible de 400 y de un camino | **200 ruta vacía** |
| `angel-villon` → `carlos-patino` | 4 saltos | **200 con 4 saltos** |

Cuerpo real del 400, con mensaje apto para el usuario y sin jerga técnica:

```json
{"error":"Los campos 'origen' y 'destino' son obligatorios"}
```

**D1 (alcance dirigido) queda demostrado con un par, no sólo afirmado.** `angel → carlos` devuelve
4 saltos, mientras que `carlos → angel` no encuentra camino. Si el alcance fuera bidireccional, el
segundo caso también tendría ruta. La diferencia entre ambos sólo puede deberse a la dirección.

**D5 verificado con datos reales**, no con un mock: se creó un `:Usuario {id:'sin-nombre',
username:null}` en medio de la cadena y el endpoint devolvió

```json
{"rutaConexion":[{"id":"carlos-patino","username":"carlos"},
                 {"id":"beatriz-silva","username":"beatriz"},
                 {"id":"sin-nombre","username":"desconocido"}],
 "saltosTotales":2}
```

El resto de la ruta sobrevive y no aparece el texto `"null"`. El nodo de prueba se borró después.

## Verificación de los gates

**Ejecutado y en verde:**

- `mvn test`: **48 pruebas verdes** (36 antes, **+12**: 6 en `Neo4jGrafoAdapterCaminoMasCortoTest`,
  6 en `UserGraphResourceTest`).
- `mvn spotbugs:check`: `BugInstance size is 0`.
- `pnpm test`: **69 pruebas verdes** (58 antes, **+11**: 3 en `networkApi.test.ts`, 8 en
  `UserSuggestionsCard.test.tsx`).
- `pnpm run build`: verde. `pnpm run lint`: **0 errores**.
- `pnpm exec prettier --check` sobre los 5 archivos de esta historia: **limpio**.
- `mvn spotless:check` sobre los 4 archivos Java de esta historia: **limpio**.

**Fallos preexistentes que este change sí resolvió** (con autorización del solicitante, que es
quien hizo esos archivos):

- `mvn spotless:check` fallaba en 9 archivos de historias anteriores: `Usuario.java`,
  `TokenService.java`, `AuthResource.java`, `DomainExceptionMapper.java`, `LoginRequest.java`,
  `JwtTokenAdapter.java`, `PostResourceTest.java`, `JwtTokenAdapterQuarkusTest.java` y
  `JwtTokenAdapterTest.java`. Aplicado `spotless:apply` sobre esos 9 y comprobado que **sólo**
  cambia formato: 4 son idénticos ignorando espacios y 5 difieren únicamente en el re-empuje del
  Javadoc y en cortes de línea. Se revisó a mano el único caso con expresión de código
  (`AuthResource`, la generación del id) para confirmar que conserva los mismos operadores,
  el mismo orden y los mismos literales. **`mvn verify` pasa: BUILD SUCCESS.**
- `prettier --check .` fallaba en 31 archivos de siete historias y de la configuración del
  proyecto. Aplicado `prettier --write` sobre los 31. **Pero sólo 5 de esos 31 tenían un defecto
  real de formato** — `LoginScreen.tsx`, `authApi.test.ts`, `CreatePostForm.test.tsx`,
  `CreatePostForm.tsx` y `Navbar.tsx` — y el cambio es normalización estándar de Prettier:
  paréntesis en un ternario JSX y comas finales en listas de imports y llamadas. Ninguna cadena
  ni lógica cambia. **`pnpm run check` pasa completo.**

### CORRECCIÓN — 26 de los 31 archivos nunca tuvieron deuda: era el working tree

La primera redacción de esta sección decía que los 31 archivos eran "deuda de formato repartida
en siete historias". **Es falso, y el dato importa porque cambia qué hay que arreglar.**

Al intentar commitear se vio que `git diff` sólo recognize 10 archivos modificados del frontend, no
36. La causa: `git config core.autocrlf = true` en esta máquina hace que git escriba **CRLF** en el
working tree al hacer checkout, mientras que el blob commiteado guarda **LF**, que es lo que pide
`endOfLine: "lf"`. Medido sobre `App.tsx`:

```
blob commiteado -> 7478 bytes, 0 CR      working tree tras prettier --write -> 7478 bytes, 0 CR
```

Idénticos byte a byte. O sea que **el contenido del repositorio siempre pasó Prettier**: 26 de los
31 archivos no tenían nada que corregir, y `prettier --write` simplemente devolvió el working tree
al estado en que ya estaba el repo. Al commitear, git normaliza a LF y esos 26 archivos no
aparecen en ningún commit.

Por tanto:

- La deuda de formato real que existía en el repo eran **9 archivos Java (Spotless) y 5 archivos
  frontend (Prettier)**, no 9 y 31.
- `pnpm run format:check` fallaba en local y seguirá fallando en cada checkout nuevo de esta
  máquina, aunque el repo esté limpio. Eso **no es deuda del código**, es el conflicto de
  configuración descrito abajo.

### El conflicto de configuración que sí queda abierto

- `git config core.autocrlf = true` en esta máquina: git escribe CRLF en el working tree.
- `frontend/.prettierrc.json` declara `"endOfLine": "lf"`: Prettier exige LF.
- **No existe `.gitattributes`** que resuelva la contradicción.

Efecto para el equipo: en Windows, `pnpm run format:check` falla en la copia de trabajo aunque el
código commiteado sea correcto, y hay que correr `prettier --write` para volver a dejarlo bien. En
CI no ocurre, porque el runner de Linux no aplica `autocrlf`.

La solución es un `.gitattributes` con `* text=auto eol=lf`, que obliga a git a escribir LF y pone
la configuración de acuerdo con Prettier. **No se añadió en este change** a propósito:
renormaliza los finales de línea del working tree de todo el equipo y en Windows produciría un diff
grande en el próximo checkout de cada uno. Es decisión del equipo.

### Fallos preexistentes que este change NO resolvió

- `mvn test` registra un error de Testcontainers por Docker durante la prueba. Ninguna prueba usa
  Testcontainers y el build continúa; se comprobó después que Docker sí está operativo.
- `docs/propuesta-us-12-perfil-ajeno.md` apareció en el working tree durante este change, escrito
  en paralelo para otra historia. **No se tocó ni se comiteó.**

## Desviaciones respecto al `design.md` y al `tasks.md`

1. **La forma de `rutaConexion` sigue el openspec, no el cURL del ticket.** Es la desviación más
   grande de la historia y está detallada arriba. Se took por indicación del solicitante.

2. **Se agregaron pruebas**, que el `tasks.md` no pedía (estimaba 120–180 líneas). `config.yaml`
   declara la "fase de tests obligatoria" y prohíbe cerrar una historia sólo con compilación, y la
   verificación de `tasks.md` pide probar los cuatro casos de cURL. Se siguió `config.yaml`.

3. **"Deshabilitar el control mientras la petición está en curso" se aplicó al botón de distancia
   y no se.extiende al de seguir.** El control de la tarjeta de sugerencias ya deshabilitaba su
   propio botón; el nuevo control lleva su propio estado, igual que el de seguir.

4. **El botón dice "Distancia", no "Calcular distancia".** El texto completo del ticket es más
   largo que el hueco disponible junto a "Seguir" sin romper la fila en móvil. La acción queda
   descrita en el `title` del botón.

## Deuda que queda anotada

- **`GET /api/users/camino-corto` no tiene control de acceso.** Basta conocer dos identificadores
  para obtener la cadena que los une. No es una regresión de esta historia — es el estado del
  proyecto mientras no aterrice US-01 — pero es exactamente el dato que se vuelve sensible cuando
  aterrice.
- **El recorrido sigue siendo dirigido.** `carlos` y `elena` pueden estar a un paso y a tres en la
  misma dirección y al revés. Para un analista de redes esto es discutible: dos personas están a un
  grado si *cualquiera* sigue a la otra. La decisión es de producto y está anotada en D1.
- **La semilla no tiene un par sin camino dentro de los seis grados.** Todos los usuarios están
  conectados salvo en el sentido inverso de alguna flecha. El caso "no hay camino" se verificó con
  `carlos → angel` y con un identificador inexistente, pero ninguno es el caso "dos personas reales
  a más de seis grados" que describe el spec. Haría falta una cadena de 7 saltos en la semilla.
- **La ruta se muestra como texto, no como enlaces.** D4 pidió los identificadores para poder
  representar cada salto, y el identificador ya viaja, pero convertirlo en enlace requiere una
  vista de perfil que el producto no tiene. Los identificadores quedan disponibles para cuando
  exista.
- **El camino no distingue "origen == destino" de "sin camino".** Ambos devuelven la forma vacía.
  Los scenarios del spec piden que la respuesta sea *distinguible de una petición incompleta* y de
  *un camino encontrado*, y ambas condiciones se cumplen; no pide distinguirlo de "sin camino".
- **`App.tsx` no se tocó.** El control vive dentro de la tarjeta que ya se renderiza en
  `App.tsx:174`, así que no hizo falta cablearlo ni tocar el punto de entrada.

## Desmontaje

Se levantaron `neo4j`, `minio` y `minio-init` y el backend en `quarkus:dev` para la verificación.
El proceso de Quarkus se detuvo al terminar. **Los contenedores de Docker siguen levantados** por si
se quiere repetir la prueba: `docker compose stop` los baja.