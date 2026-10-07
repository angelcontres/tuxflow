# Tasks: US-14 (TUX-71) — Buscar usuarios

> **Estrategia de entrega**: `single-pr` · **Límite de revisión**: 800 líneas
> **TDD**: desactivado (`strict_tdd: false`, fuente `openspec/config.yaml`). Se escribe el test
> antes del cambio cuando aporta (RED → GREEN), pero no es obligatorio por contrato.

## Orden

Las fases son verticales y causales: cada una desbloquea la siguiente.

```
B1 ──▶ B2 ──▶ B3 ──▶ B4 ──▶ F1 ──▶ F2 ──▶ F3 ──▶ V1 ──▶ V2
consulta  cerrar   ruta   mapeo  tipos  API    UI      pruebas  gates
```

---

## Fase B — Backend

### B1. Consulta de búsqueda y orden por relevancia `[back]`

**Desbloquea**: sin consulta no hay endpoint, y sin endpoint no hay nada que el cliente consuma.

- [x] B1.1 `Neo4jGrafoAdapter.buscarUsuarios(String texto, long limite)`: normaliza en la consulta con
      `reduce` + `replace`, sobre `username` y `nombre` (D1)
- [x] B1.2 `CASE` de 5 niveles para el orden por relevancia + desempate por `username` ASC
- [x] B1.3 `LIMIT $limite` como parámetro, tope 20
- [x] B1.4 `RETURN` de exactamente `id`, `username`, `nombre`, `avatarUrl`
- [x] B1.5 Reutilizar el mapeo con guarda de null de US-12 (`mapearUsuarioDeRelacion`)

**Verifica**: `Neo4jGrafoAdapterBuscarUsuariosTest` (texto de la consulta, normalización, orden,
ausencia de `email`/`password` en el `RETURN`, `nombre` nulo) + `Neo4jGrafoAdapterPerfilAjenoIT`
contra Neo4j real.

### B2. Cerrar el directorio `[back]`

**Desbloquea**: sin esto, la historia es un endpoint más encima de un `GET /api/users` abierto.

Verificado antes: el frontend no lo llama (`userApi.ts` usa `/users/{id}`, `POST /users` y
`/users/{id}/avatar`).

- [x] B2.1 Borrar `listarUsuarios()` del recurso, del caso de uso, del servicio, del puerto y del
      adaptador. No basta con el recurso: dejar el método en el servicio deja la puerta abierta
- [x] B2.2 `GestionarGrafoSocialUseCaseDePrueba` (doble de prueba) actualizado
- [x] B2.3 `GET /api/users` responde `404`; `POST /api/users` (registro) sigue funcionando

### B3. Puerto de salida y caso de uso `[back]`

**Desbloquea**: sin el contrato, el recurso no tiene nada que llamar.

- [x] B3.1 `+ List<Usuario> buscarUsuarios(String texto, long limite)` en `GrafoPersistencePort`
- [x] B3.2 `+ List<Usuario> buscarUsuarios(String texto)` en `GestionarGrafoSocialUseCase`
- [x] B3.3 `UserGraphApplicationService` delega sin normalizar ni ordenar

### B4. Recurso REST `[back]`

**Desbloquea**: la API es lo que el cliente consume.

- [x] B4.1 `GET /api/users/buscar?q=` mapeando a `UsuarioPublicoResponse`
- [x] B4.2 `400` + clave `error` si `q` es nulo, vacío o de menos de 2 caracteres
- [x] B4.3 `400` **sin tocar el grafo** cuando la petición es inválida
- [x] B4.4 Declarado antes de `/{userId}` por legibilidad (en RESTEasy Reactive el segmento literal
      gana al de plantilla; el orden no es lo que lo resuelve)

**Verifica**: `UserGraphResourceTest` (validación, forma del DTO, ausencia de correo y contraseña) +
`PerfilAjenoRutasIT` (el choque `/buscar` vs `/{userId}`, y el `404` del directorio).

---

## Fase F — Frontend

### F1. Tipo y cliente HTTP `[front]`

**Desbloquea**: sin la función no hay componente que pueda pedir datos.

- [x] F1.1 `ResultadoBusquedaUsuario` en `features/user/types/user.types.ts` — `nombre` opcional, por
      la misma razón que en `Usuario`
- [x] F1.2 `buscarUsuarios(texto, signal)` en `userApi.ts`, propagando el error sin convertirlo en
      `[]`

### F2. Componente del buscador `[front]`

**Desbloquea**: es lo que el usuario ve.

- [x] F2.1 `UserSearchBox.tsx` con los seis estados separados (sin texto, demasiado corto, cargando,
      sin resultados, con resultados, fallo)
- [x] F2.2 Debounce de 250 ms
- [x] F2.3 `AbortController`: cancelar la petición anterior y descartar respuestas que ya no son la
      vigente
- [x] F2.4 Cada resultado es un botón que llama a `onOpenPerfil(id)`; avatar con degradación a la
      inicial
- [x] F2.5 Montar en `Navbar` y pasar `onOpenPerfil` desde `App`

**Verifica**: `UserSearchBox.test.tsx` (los seis estados, el debounce con temporizadores falsos, la
cancelación, el enlace al perfil) + `App.test.tsx` (el buscador llega a la navegación).

---

## Fase V — Verificación

### V1. Pruebas de rutas sobre HTTP real

`PerfilAjenoRutasIT` existe para probar colisiones de rutas, que **no se ven leyendo el código**.
US-14 añade tres casos a esa misma clase de problema.

- [x] V1.1 `GET /api/users/buscar?q=...` resuelve
- [x] V1.2 `GET /api/users/buscar` no se confunde con `GET /api/users/{userId}`
- [x] V1.3 `GET /api/users` responde `404` (el directorio ya no existe)
- [x] V1.4 La respuesta de la búsqueda no contiene correo, contraseña ni suscripción push

### V2. Gates

- [x] V2.1 `mvn verify` — pruebas + Spotless + SpotBugs
- [x] V2.2 `pnpm run check` — Prettier + ESLint + Vitest + build
- [x] V2.3 `curl` contra el backend levantado

---

## Criterios de aceptación, con su prueba

| Criterio (Gherkin del ticket) | Prueba |
|---|---|
| Escribir "beatriz" ve a "Beatriz Silva" | `UserSearchBox.test.tsx` + `Neo4jGrafoAdapterPerfilAjenoIT` |
| Ningún resultado trae correo, contraseña ni push | `PerfilAjenoRutasIT.busquedaNoFiltraDatosDeSesion` |
| "beatriz sil" encuentra a "Beatriz Silva" | `Neo4jGrafoAdapterPerfilAjenoIT` |
| Texto sin coincidencias → mensaje, no lista vacía | `UserSearchBox.test.tsx` |
| Menos de 2 caracteres → ninguna petición | `UserSearchBox.test.tsx` + `UserGraphResourceTest` (400) |
| El resultado abre el perfil | `UserSearchBox.test.tsx` + `App.test.tsx` |
| `GET /api/users` da 404 | `PerfilAjenoRutasIT.elDirectorioYaNoExiste` |

## Desviación consciente del ticket

**El cURL de verificación del ticket dice `q=pino` y se corrige a `q=patino`.** `pino` no es subcadena
de `patino`: faltan dos letras, así que no puede encontrar a `Patiño` con ninguna técnica de
normalización. Verificado contra Neo4j 5.20 real; el detalle está en `proposal.md` D2.

El comportamiento del ticket **sí** se cumple: `q=patino` encuentra a `Carlos Patiño` y da `FALSE`
sin normalización, que es la prueba que de verdad distingue una implementación de la otra.