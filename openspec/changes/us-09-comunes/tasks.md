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

- [ ] En `obtenerSeguidoresEnComun()`, aplicar a `nombre` la misma guarda de null que ya tiene `avatar`
      una línea más abajo
- [ ] No cambiar ningún otro campo del mapeo
- [ ] No agregar la guarda de `nombre` en `obtenerSugerencias`. Es el mismo defecto de una línea, pero
      pertenece a US-03 y está anotado acá para no perderlo

**Nota**: `guardarUsuario` hace `SET u.nombre = $nombre`, y en Neo4j asignar `null` a una propiedad la
elimina. Como `Usuario` no valida, un registro sin nombre produce un nodo sin esa propiedad. Por eso
`.asString()` revienta.

---

## Unidad 2: Validar la consulta

**Desbloquea**: que una lista vacía signifique una sola cosa, y que comparar un usuario consigo mismo no
devuelva la lista completa de sus seguidos.
**Rollback**: vuelve el `200` con `[]` para parámetros inválidos.

- [ ] En `UserGraphResource.obtenerSeguidoresEnComun()`, leer `userA` y `userB` y responder `400` si
      cualquiera de los dos es `null` o `isBlank()`
- [ ] Responder `400` si `userA` es igual a `userB`
- [ ] Usar `String.isBlank()`, el mismo criterio que US-04 y US-06
- [ ] No normalizar ni reordenar los parámetros. La intersección no depende del orden
- [ ] No devolver la lista completa cuando los dos son iguales. El cliente pidió una intersección y
      recibió otra cosa

---

## Unidad 3: Función de API y tipo

**Desbloquea**: que el panel pueda consultar el endpoint.
**Rollback**: trivial, no hay consumidor todavía.

- [ ] Agregar a `network.types.ts` un tipo `ConexionComun` con `id`, `username`, `nombre` y `avatar`
      opcional
- [ ] Agregar a `networkApi.ts` una función `fetchConexionesComunes(userA, userB)` que llame a
      `GET /users/comunes` con los dos parámetros
- [ ] Reutilizar la instancia de `axios` ya configurada en ese archivo, con la base que ya usa
- [ ] No agregar try/catch dentro de la función. El error debe propagarse al componente, que es quien
      sabe cómo mostrarlo
- [ ] Tipar `nombre` como opcional si el backend lo puede mandar nulo

---

## Unidad 4: Panel de conexiones mutuas

**Desbloquea**: el entregable "modal o sección de conexiones mutuas" del backlog.
**Rollback**: quitar el componente del punto de montaje. El backend queda intacto.

### Pasos

- [ ] Crear `network/components/ConexionesComunesPanel.tsx`
- [ ] NO editar `UserSuggestionsCard.tsx` (read-only). US-02 y US-03 modifican ese archivo y meter esta historia ahí
      genera conflictos entre tres historias
- [ ] Incluir un campo de texto para el identificador del otro usuario, porque el producto no tiene
      página de perfil donde elegirlo
- [ ] Consultar a pedido, no en cada cambio del campo
- [ ] No consultar cuando el identificador esté vacío. Mostrar el aviso y no enviar la petición
- [ ] Mostrar el avatar de cada conexión, con la inicial como respaldo cuando no haya
- [ ] Mostrar `nombre`, con `username` como respaldo cuando `nombre` venga nulo
- [ ] Mostrar un estado vacío explícito cuando la lista venga vacía, distinguiéndolo de un error
- [ ] Mostrar un mensaje visible cuando la consulta falle, en vez de una lista vacía que aparente ser un
      resultado
- [ ] Montar el componente desde `App.tsx`. El punto de montaje es una línea y no condiciona el resto

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

No hay suite de pruebas en el proyecto, por decisión registrada en `openspec/config.yaml`.

- [ ] `mvn compile` termina en verde
- [ ] `pnpm run build` termina en verde
- [ ] El cURL del backlog devuelve `200` con "beatriz" y "paulo"
- [ ] El cURL sin parámetros devuelve `400`, no `200` con lista vacía
- [ ] El cURL con `userA` igual a `userB` devuelve `400`
- [ ] El cURL con un usuario registrado sin `nombre` devuelve `200`, no `500`
- [ ] En navegador: el panel lista las conexiones con avatar o inicial
- [ ] En navegador: un usuario sin nombre muestra su identificador
- [ ] En navegador: una lista vacía muestra el estado vacío, no un error
- [ ] En navegador: un fallo de red muestra un mensaje, no una lista vacía
- [ ] `UserSuggestionsCard.tsx` no aparece en el diff
