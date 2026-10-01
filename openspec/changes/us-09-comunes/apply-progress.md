# Apply Progress: US-09 (TUX-57) — Conexiones en común entre dos perfiles

> **Change**: `us-09-comunes` · **Ticket**: `TUX-57` · **Rama**: `angelvilloon853/tux-57-us-09-followers-and-mutual-connections-between-two-profiles`
> **Contrato seguido**: `design.md` (D1–D4) y `specs/social-graph/spec.md`, sin desvíos de alcance.

## Qué quedó implementado

| Unidad | Archivo | Estado |
|---|---|---|
| 1 — Guarda de null en `nombre` (D1) | `Neo4jGrafoAdapter.java:135` | Completa |
| 2 — Validación de `userA` y `userB` (D2) | `UserGraphResource.java:129` | Completa |
| 3 — Tipo y función de API | `network.types.ts`, `networkApi.ts` | Completa |
| 4 — Panel de conexiones mutuas (D3, D4) | `ConexionesComunesPanel.tsx`, montado en `App.tsx:180` | Completa |

`UserSuggestionsCard.tsx` no aparece en el diff, tal como pedía D3.

## Contradicción entre el contrato y la realidad — hay que leerla

**El `design.md` y el `proposal.md` describen mal el síntoma del defecto de D1.** Afirman que
`record.get("nombre").asString()` **lanza excepción** y que el endpoint responde **500**.

No es lo que pasa. Medido contra `neo4j-java-driver 5.24.0` (el que trae `quarkus-neo4j 4.4.0`):

```
Values.parameters("p", (Object) null).get("p")
  → class=org.neo4j.driver.internal.value.NullValue
  → isNull()=true
  → asString()="null"   (4 caracteres, no una referencia nula, NO lanza)
```

El `NullValue` de esta versión **devuelve el texto literal `"null"`**. Consecuencia real:

- El endpoint ya respondía **200** antes de este cambio, no 500.
- Lo que devolvía era un **nombre de usuario inventado**: la fila llegaba con `"nombre": "null"`, y
  ese texto salía por la API y se renderizaba en pantalla como si fuera el nombre real de la persona.

**Por qué la corrección sigue siendo correcta.** El `design.md` acierta en el diagnóstico de fondo
(la propiedad se borra cuando se asigna `null`, `.asString()` no es seguro) y en la solución (copiar
la guarda que ya tenía `avatar`). Lo que estaba mal era el síntoma. El arreglo es el mismo y el
riesgo que evita es real: sin la guarda, un usuario sin nombre se muestra como "null" en la UI, que es
peor que un 500 porque no se nota y no dispara ninguna alerta.

**La hipótesis de US-05 que se repite en `design.md`** ("`fechaCreacion` se leía con `asString()`
sobre un entero") merece la misma relectura antes de que alguien la use como precedente.

**Verificación de que la prueba detecta el defecto:** se revirtió la guarda a mano y
`usuarioSinNombreNoSeConvierteEnElTextoNull` falló con
`expected: <null> but was: java.lang.String@61e7bf2f<null>`; se restauró y volvió a verde. La
prueba no pasa por casualidad.

## Desviaciones respecto al `design.md`

1. **Se agregaron pruebas, y `tasks.md` decía que no había suite.** `tasks.md` afirmaba "No hay suite
   de pruebas en el proyecto, por decisión registrada en `openspec/config.yaml`". Es falso:
   `config.yaml` declara JUnit 5 y Vitest operativos, y el repositorio ya traía 26 pruebas de backend
   y 39 de frontend en verde antes de este cambio. La instrucción de `opencode-builder.md`
   ("NO agregar tests") y la de `docs/sdd/conventions.md` ("Testing: Deshabilitado") están
   desactualizadas respecto de `config.yaml`, que es la fuente de reglas. Se siguió `config.yaml`, que
   además exige la "fase de tests obligatoria" y prohíbe cerrar una historia sólo con compilación.
   Esto es una **desviación deliberada de un artefacto del arquitecto**, y se reporta para que decida.

2. **Sin `try/catch` en `fetchConexionesComunes`**, como pedía la unidad 3. El componente usa
   `getUserFacingError` de `shared/utils`, que es el patrón que ya usan `Navbar` y `CreatePostForm`;
   cumple el requisito de "mensaje visible ante fallo".

3. **Mensajes de `400` en español y sin jerga técnica**, siguiendo el criterio de `PostResource` y la
   regla de `getUserFacingError`, que descarta mensajes con detalle interno antes de mostrarlos. Los
   dos textos pasan ese filtro, así que el frontend puede mostrar el del servidor tal cual.

## Verificación

**Ejecutado y en verde:**

- `mvn verify` (backend): 36 pruebas en verde, **+10** nuevas (6 en `UserGraphResourceTest`, 4 en
  `Neo4jGrafoAdapterConexionesComunesTest`). SpotBugs: `BugInstance size is 0`.
- `pnpm test` (frontend): 58 pruebas en verde, **+19** nuevas (3 en `networkApi.test.ts`, 16 en
  `ConexionesComunesPanel.test.tsx`).
- `pnpm run build`: verde, 1576 módulos.
- `pnpm run lint`: sin errores.
- `mvn spotless:check` y `mvn spotbugs:check` sobre **los archivos de esta historia**: limpios.

**Fallos preexistentes, ajenos a esta historia** (verificados con `git stash` sobre el árbol limpio):

- `mvn spotless:check` falla en 9 archivos que nadie tocó en este change: `Usuario.java`,
  `TokenService.java`, `AuthResource.java`, `DomainExceptionMapper.java`, `LoginRequest.java`,
  `JwtTokenAdapter.java`, `PostResourceTest.java`, `JwtTokenAdapterQuarkusTest.java`,
  `JwtTokenAdapterTest.java`. Por eso `mvn verify` termina en `BUILD FAILURE` aunque las 36 pruebas
  pasen. **CI está rojo en `develop` por esto**, y lo seguirá estando. Corregirlo es un change aparte.
- `pnpm run format:check` marca `src/shared/utils/errorMessage.ts`, también sin tocar.
- `mvn test` emite un error de Testcontainers por falta de Docker en la máquina. No afecta: ninguna
  prueba usa Testcontainers, el error se registra y el build continúa.

**No verificado — pendiente por falta de infraestructura:**

- Los 4 cURL del backlog contra `localhost:8080` con Neo4j en `localhost:7687`. No hay Docker
  funcionando en esta máquina, así que no se levantó el grafo ni MinIO. Lo que sí se verificó es que
  la consulta enviada es exactamente el Cypher #3 obligatorio (hay una prueba que captura la cadena y
  los parámetros enviados al driver, y falla si la intersección cambia de dirección).
- Los 4 puntos de "en navegador". El comportamiento está cubierto por prueba de componente, pero no se
  abrió el navegador.

## Deuda que queda anotada

- **El mismo defecto sin corregir, medido y verificado, está en dos sitios más de este mismo
  archivo**: `obtenerSugerencias` (`:97`, US-03) y `obtenerSeguidos` (`:177`, US-02), ambos con
  `record.get("nombre").asString()` sin guarda. Con el comportamiento real del driver devuelven el
  texto `"null"` como nombre. **Ambos son de historias ajenas, así que no se tocaron** — pero el
  `design.md` señalaba sólo uno de los dos, y lo señalaba en la línea equivocada (`:88` en vez de
  `:97`). El de `:177` no estaba anotado en ninguna parte. Vale la pena que el arquitecto lo registre
  antes de aplicar US-02 y US-03.
- **`GET /api/users/comunes` no tiene control de acceso.** Cualquiera que conozca dos identificadores
  obtiene su intersección de seguidos. No es una regresión de esta historia — es el estado del
  proyecto, ya que la autenticación aún no aterriza — pero es exactamente el dato que se vuelve
  sensible cuando aterrice US-01.
- **La intersección no tiene paginación.** Dos personas que sigan a las mismas 200 personas devuelven
  200 filas. Inocuo a esta escala, y el Gherkin no lo pide.
- **El segundo usuario se elige con un campo de texto**, no con un selector, porque el producto no
  tiene página de perfil. Se paga cuando exista.
- **El endpoint serializa el `Usuario` de dominio directo**, sin pasar por `UsuarioResponse`, a
  diferencia de `listarUsuarios` y `obtenerUsuarioPorId`. Como `obtenerSeguidoresEnComun` solo
  mapea cuatro campos, `password` y `pushSubscriptionJson` viajan en `null`: no hay fuga de datos,
  pero sí se expone la forma del dominio, y el bootstrap de `UserSuggestionsCard` no cubre el caso
  "viene con un campo que el backend no llenó". La robustificación corresponde a la historia de perfil.
