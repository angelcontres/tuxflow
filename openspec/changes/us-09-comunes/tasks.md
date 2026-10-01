# Tasks: US-09 (TUX-57) — Conexiones en común entre dos perfiles

> **Dominio**: `social-graph` · **Estrategia de entrega**: `single-pr` · **Límite de revisión**: 800 líneas

**Archivos a modificar**: `Neo4jGrafoAdapter.java`, `UserGraphResource.java`, `networkApi.ts`,
`network.types.ts`, y un componente nuevo en `network/components/`

## Review Workload Forecast

| Métrica | Valor |
|---|---|
| Unidades de trabajo | 4 |
| Líneas estimadas de cambio | 95–135 |
| Riesgo de presupuesto de 400 líneas | **Bajo** |
| PRs encadenados recomendados | **No** |
| Decisión necesaria antes de apply | **No** |
| División sugerida | PR único |
| Estrategia de entrega | single-pr |
| Límite de revisión del preflight | 800 líneas |

| Unidad | Alcance | Líneas |
|---|---|---|
| 1 | Guarda de null en `nombre` (D1) | 1–2 |
| 2 | Validar `userA` y `userB` (D2) | 12–18 |
| 3 | Función de API y tipo | 15–20 |
| 4 | Componente del panel | 65–95 |

**Recomendación**: un único PR. La unidad 1 es una línea y es la que evita el 500; las unidades 3 y 4
dependen del endpoint de la unidad 2, así que separarlas dejaría commits que no se pueden probar.

---

## Unidad 1: Que un usuario sin nombre no rompa la consulta

**Desbloquea**: que el endpoint responda `200` con cualquier grafo, incluso con registros incompletos.
**Rollback**: revertir devuelve el 500 que ya existe hoy.

- [x] En `obtenerSeguidoresEnComun()`, aplicar a `nombre` la misma guarda de null que ya tiene `avatar`
      una línea más abajo
- [x] No cambiar ningún otro campo del mapeo
- [x] No agregar la guarda de `nombre` en `obtenerSugerencias`. Es el mismo defecto de una línea, pero
      pertenece a US-03 y está anotado acá para no perderlo

**Nota**: `guardarUsuario` hace `SET u.nombre = $nombre`, y en Neo4j asignar `null` a una propiedad la
elimina. Como `Usuario` no valida, un registro sin nombre produce un nodo sin esa propiedad. Por eso
`.asString()` revienta.

---

## Unidad 2: Validar la consulta

**Desbloquea**: que una lista vacía signifique una sola cosa, y que comparar un usuario consigo mismo no
devuelva la lista completa de sus seguidos.
**Rollback**: vuelve el `200` con `[]` para parámetros inválidos.

- [x] En `UserGraphResource.obtenerSeguidoresEnComun()`, leer `userA` y `userB` y responder `400` si
      cualquiera de los dos es `null` o `isBlank()`
- [x] Responder `400` si `userA` es igual a `userB`
- [x] Usar `String.isBlank()`, el mismo criterio que US-04 y US-06
- [x] No normalizar ni reordenar los parámetros. La intersección no depende del orden
- [x] No devolver la lista completa cuando los dos son iguales. El cliente pidió una intersección y
      recibió otra cosa

---

## Unidad 3: Función de API y tipo

**Desbloquea**: que el panel pueda consultar el endpoint.
**Rollback**: trivial, no hay consumidor todavía.

- [x] Agregar a `network.types.ts` un tipo `ConexionComun` con `id`, `username`, `nombre` y `avatar`
      opcional
- [x] Agregar a `networkApi.ts` una función `fetchConexionesComunes(userA, userB)` que llame a
      `GET /users/comunes` con los dos parámetros
- [x] Reutilizar la instancia de `axios` ya configurada en ese archivo, con la base que ya usa
- [x] No agregar try/catch dentro de la función. El error debe propagarse al componente, que es quien
      sabe cómo mostrarlo
- [x] Tipar `nombre` como opcional si el backend lo puede mandar nulo

---

## Unidad 4: Panel de conexiones mutuas

**Desbloquea**: el entregable "modal o sección de conexiones mutuas" del backlog.
**Rollback**: quitar el componente del punto de montaje. El backend queda intacto.

### Pasos

- [x] Crear `network/components/ConexionesComunesPanel.tsx`
- [x] NO editar `UserSuggestionsCard.tsx` (read-only). US-02 y US-03 modifican ese archivo y meter esta historia ahí
      genera conflictos entre tres historias
- [x] Incluir un campo de texto para el identificador del otro usuario, porque el producto no tiene
      página de perfil donde elegirlo
- [x] Consultar a pedido, no en cada cambio del campo
- [x] No consultar cuando el identificador esté vacío. Mostrar el aviso y no enviar la petición
- [x] Mostrar el avatar de cada conexión, con la inicial como respaldo cuando no haya
- [x] Mostrar `nombre`, con `username` como respaldo cuando `nombre` venga nulo
- [x] Mostrar un estado vacío explícito cuando la lista venga vacía, distinguiéndolo de un error
- [x] Mostrar un mensaje visible cuando la consulta falle, en vez de una lista vacía que aparente ser un
      resultado
- [x] Montar el componente desde `App.tsx`. El punto de montaje es una línea y no condiciona el resto

---

## Fuera de alcance

- Una página de perfil. Es la solución natural para elegir el segundo usuario, y es más grande que esta
  historia de 3 SP.
- La guarda de `nombre` en `obtenerSugerencias`, que pertenece a US-03.
- Paginación de la intersección. A esta escala es inocuo.
- Autenticación o control de acceso. No existe en el proyecto todavía; aterriza con US-01.

## Verificación

```bash
# Backend
cd backend && mvn compile

# Frontend
cd frontend && pnpm run build

# cURL del backlog
curl -X GET "http://localhost:8080/api/users/comunes?userA=carlos-patino&userB=angel-villon"
```

Corrección a esta sección: **sí hay suite de pruebas** y ambas están operativas (JUnit 5 + Surefire en
backend, Vitest + Testing Library en frontend), según `openspec/config.yaml`. Las verificaciones se
corrieron con `mvn verify` y `pnpm test`, no sólo compilando. Ver `apply-progress.md` para el detalle
de los 4 cURL pendientes por falta de un Neo4j local.

- [x] `mvn verify` en verde: 36 pruebas, Spotless y SpotBugs sin observaciones en los archivos tocados
- [x] `pnpm test` en verde: 58 pruebas, 19 de ellas nuevas para esta historia
- [x] `pnpm run build` termina en verde
- [x] `pnpm run lint` sin errores nuevos
- [x] El cURL del backlog devuelve `200` con "beatriz" y "paulo" — **ejecutado**; el Cypher #3 del
      ticket estaba invertido y devolvía `[]`. Corregido, ver `apply-progress.md`
- [x] El cURL sin parámetros devuelve `400`, no `200` con lista vacía — ejecutado
- [x] El cURL con `userA` igual a `userB` devuelve `400` — ejecutado
- [x] El cURL con un usuario registrado sin `nombre` devuelve `200`, con `nombre` null y no el texto
      `"null"` — ejecutado
- [ ] En navegador: el panel lista las conexiones con avatar o inicial — cubierto por prueba de
      componente; no se abrió el navegador
- [ ] En navegador: un usuario sin nombre muestra su identificador — cubierto por prueba de componente
- [ ] En navegador: una lista vacía muestra el estado vacío, no un error — cubierto por prueba de
      componente
- [ ] En navegador: un fallo de red muestra un mensaje, no una lista vacía — cubierto por prueba de
      componente
- [x] `UserSuggestionsCard.tsx` no aparece en el diff
