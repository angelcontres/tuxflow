# Tasks: US-03 (TUX-58) — Sugerencia inteligente de contactos

> **Ticket**: `TUX-58` — US-03: Sugerencia Inteligente de Contactos (2do Grado)
> **Único archivo a modificar**: `frontend/src/features/network/components/UserSuggestionsCard.tsx`

## Review Workload Forecast

| Métrica | Valor |
|---|---|
| Unidades de trabajo | 2 |
| Líneas estimadas de cambio | 30–50 |
| Riesgo de presupuesto de 400 líneas | **Bajo** |
| PRs encadenados recomendados | **No** |
| Decisión necesaria antes de apply | **No** |
| División sugerida | PR único |
| Estrategia de entrega | single-pr |
| Límite de revisión del preflight | 800 líneas |

**Estimación por unidad**:

| Unidad | Alcance | Líneas |
|---|---|---|
| 1 | Renderizar `seguidosEnComun` bajo el contador (D1) | 15–25 |
| 2 | Renderizar `sug.avatar` con respaldo a la inicial (D2) | 15–25 |

**Recomendación**: un único PR. El cambio entra holgadamente en el presupuesto y toca un solo archivo.

---

## Unidad 1: Mostrar los intermediarios en común

**Qué hace**: renderiza `sug.seguidosEnComun` como lista de usernames legible, debajo del contador de
conexiones que ya existe.

**Dónde**: `UserSuggestionsCard.tsx`, dentro del bloque `<p>` que hoy muestra
`{sug.conexionesEnComun} conexión(es) mutua(s)`.

**Desbloquea**: la tarjeta pasa a explicar por qué aparece cada sugerencia, que es el criterio de
aceptación de TUX-58.

**Rollback**: revertir devuelve la tarjeta a mostrar solo el número.

### Directrices de implementación

- [x] Conservar el contador como primera línea. No reemplazarlo: responde la pregunta rápida antes del detalle.
- [x] Renderizar los usernames con el `@` que ya usa el encabezado de la tarjeta, para que la convención
      visual sea la misma en ambos lugares.
- [x] Unir los usernames con una coma o con un punto y coma. No hace falta ningún componente nuevo.
- [x] Si el arreglo viene vacío, no renderizar la línea. El bloque completo se omite, no se muestra vacío.
- [x] Es JSX directo sobre el arreglo. No hace falta `useState`, `useMemo` ni ningún otro hook.
- [x] No deduplicar: `collect` sobre una ruta de dos saltos no produce repetidos para el mismo sugerido.

---

## Unidad 2: Renderizar el avatar con respaldo

**Qué hace**: muestra `sug.avatar` como imagen cuando existe, y conserva el círculo con la inicial como
respaldo cuando la URL está vacía o la imagen no carga.

**Dónde**: `UserSuggestionsCard.tsx`, el `<div>` circular que hoy contiene
`{sug.username.charAt(0).toUpperCase()}`.

**Desbloquea**: la tarjeta muestra el avatar que el backend ya envía en vez de descartarlo.

**Rollback**: revertir devuelve el círculo con la inicial en todas las casos.

### Directrices de implementación

- [x] Sustituir el círculo por un contenedor que sostenga el `<img>` y el respaldo.
      **Desviación**: se usa `w-9 h-9 rounded-full overflow-hidden` en vez de `relative` + overlay
      absoluto. Ambas harturas son idénticas; la conmutación es condicional, no superpuesta.
- [x] Reutilizar el círculo con la inicial que ya existe como respaldo. No se diseña uno nuevo.
- [x] Conmutar al respaldo con `onError` del `<img>`, mediante un booleano en el estado del componente
      que solo se activa ante error.
- [x] Mantener el tamaño actual del círculo (`.w-9 .h-9`) y el degradado, para no romper la alineación de la fila.
- [x] Usar un `alt` que no contradiga lo visible. El `@username` de al lado ya aporta el nombre.
- [x] No agregar manejo de error a las sugerencias: solo al avatar.

---

## Fuera de alcance

- Modificar el Cypher de sugerencias. Ya devuelve los dos campos.
- Agregar campos, endpoints o tipos. `networkApi.ts` y `network.types.ts` no se tocan.
- Cambiar el manejador de seguir. US-02 lo convierte en alternancia y este change lo reutiliza tal cual.
- Cargar avatares a MinIO. Esta historia consume el avatar existente; no lo produce.
- Sustituir el `@username` por `nombre`. El campo `nombre` existe en el payload pero el criterio de
  aceptación no lo pide, y el identificador de la red es el username.

## Verificación

Comando único, desde `frontend`:

```bash
pnpm run check
```

> **Corrección**: esta sección afirmaba antes que "no hay suite de pruebas en el proyecto". Es falso.
> `openspec/config.yaml` registra ambos runners operativos (JUnit 5 y Vitest), y
> `UserSuggestionsCard.test.tsx` ya existía con 14 pruebas. La verificación real de esta historia es
> `pnpm run check`, que encadena `format:check`, `lint`, `test` y `build`.

- [x] `pnpm run check` termina en verde desde `frontend`
- [x] `networkApi.ts` y `network.types.ts` sin modificar
- [x] Las 14 pruebas preexistentes siguen verdes sin haberlas tocado
- [x] Las pruebas nuevas fallan si se revierte `UserSuggestionsCard.tsx` (verificado con `git stash`)
- [x] En navegador: una sugerencia con 2 intermediarios muestra el número y los dos usernames
- [x] En navegador: una sugerencia sin avatar muestra el círculo con la inicial

> Verificado en Microsoft Edge 153 mediante el MCP de Playwright contra `pnpm dev` en `:3001` con el
> backend real y el dataset semilla cargado. Lectura del DOM de la fila de `@david`:
>
> ```
> encabezado: "@david"
> lineas: ["2 conexión(es) mutua(s)", "Conocido por @paulo, @beatriz"]
> hayImg: true    alt: "Avatar de @david"    cargada: true (naturalWidth > 0)
> ```
>
> Para el respaldo se forzó un error de carga real apuntando el `src` del `<img>` a un puerto cerrado
> (`http://localhost:9/no-existe.png`), lo que produjo `net::ERR_UNSAFE_PORT` en la consola del navegador
> y confirmó la conmutación:
>
> ```
> { habiaImg: true, imgSigue: false, inicial: "D" }
> ```

## Defecto latente detectado, fuera de alcance

`Neo4jGrafoAdapter.obtenerSugerenciasUsuarios()` lee `nombre` y `seguidosEnComun` sin guarda `isNull()`.
Un nodo `:Usuario` sin `nombre` hace fallar el endpoint completo. El seed define `nombre` en los seis
nodos, así que no se manifiesta aquí, pero la guarda sigue pendiente y ya estaba diferida a US-09 en
`openspec/ROADMAP.md`.

Durante la verificación en navegador se encontró otro defecto, este **ya activo**: `GET /api/feed/{id}`
devuelve **500** para todos los usuarios.

```
org.neo4j.driver.exceptions.value.Uncoercible: Cannot coerce INTEGER to Java String
  at Neo4jGrafoAdapter.lambda$obtenerFeedCronologico$0(Neo4jGrafoAdapter.java:53)
```

`crearPost` escribe `fechaCreacion = datetime().epochMillis` (entero) y el seed escribe el mismo tipo, pero
`obtenerFeedCronologico` lo lee con `record.get("fecha").asString()`. Es el mismo desajuste de tipos que ya
figuraba en `openspec/ROADMAP.md`, y afecta a la consulta obligatoria #1, no a la #2. **US-03 no lo toca**:
`GET /api/users/{userId}/sugerencias` responde 200 con normalidad. Requiere su propia historia.

El criterio de aceptación escribe `seguidosEnComun = ["beatriz", "paulo"]`. El endpoint devuelve el
mismo conjunto en orden `["paulo", "beatriz"]`. `collect()` no garantiza orden en Cypher sin `ORDER BY`
interno, así que el orden literal no es una propiedad estable de la consulta. Se cumple el contenido,
que es lo que el criterio exige; no se modifica la consulta obligatoria #2 para forzar un orden.
