# Tasks: US-04 (TUX-54) — Crear publicación con multimedia en S3

> **Dominio**: `post-management` · **Estrategia de entrega**: `single-pr` · **Límite de revisión**: 800 líneas

**Archivos a modificar**: `PostResource.java`, `GrafoPersistencePort.java`, `Neo4jGrafoAdapter.java`,
`PostApplicationService.java`, `CreatePostForm.tsx`

## Review Workload Forecast

| Métrica | Valor |
|---|---|
| Unidades de trabajo | 4 |
| Líneas estimadas de cambio | 60–90 |
| Riesgo de presupuesto de 400 líneas | **Bajo** |
| PRs encadenados recomendados | **No** |
| Decisión necesaria antes de apply | **No** |
| División sugerida | PR único |
| Estrategia de entrega | single-pr |
| Límite de revisión del preflight | 800 líneas |

| Unidad | Alcance | Líneas |
|---|---|---|
| 1 | Validación de entrada en el recurso (D1) | 10–15 |
| 2 | `crearPost` devuelve si creó filas (D2) | 15–25 |
| 3 | Preview de imagen en el formulario (D3) | 25–40 |
| 4 | Corrección de `pl-13` (D4) | 1–2 |

**Recomendación**: un único PR. Los cinco archivos son pequeños y las unidades 1 y 2 forman una sola
causa: que un `201` signifique que la publicación existe.

---

## Unidad 1: Validar entrada en el borde

**Desbloquea**: que el frontend pueda confiar en que un `201` significa publicación creada.
**Rollback**: revertir devuelve el `400` a un `201` silencioso.

- [ ] Al inicio de `PostResource.crearPost()`, leer `autorId` y `texto` del `Map<String, String>` recibido
- [ ] Si `autorId` es `null` o `isBlank()`, responder `400` con un mensaje que nombre el campo faltante
- [ ] Si `texto` es `null` o `isBlank()`, responder `400` con el mismo criterio
- [ ] Usar `String.isBlank()`: cubre `null`, cadena vacía y solo espacios en una comprobación
- [ ] No agregar validación de formato de la URL. El criterio de aceptación trata la URL como válida por
      defecto y no pide comprobar su alcanzabilidad
- [ ] No lanzar excepciones desde el recurso. Responder con `Response.status(...)`

---

## Unidad 2: Que `crearPost` confirme que creó filas

**Desbloquea**: convierte el enlace `[:PUBLICA]` del criterio de aceptación en algo verificable en lugar de
accidental.
**Rollback**: revertir devuelve el puerto a `void` y el recurso al `201` sin comprobar.

### Pasos

- [ ] Cambiar la firma de `GrafoPersistencePort.crearPost()` de `void` a `boolean`
- [ ] En `Neo4jGrafoAdapter.crearPost()`, capturar el `ResultSummary` de la escritura y devolver si.con
      `counters().nodesCreated()` es mayor que cero
- [ ] Propagar el `boolean` en `PostApplicationService.crearPost()`, que hoy devuelve solo el `String` del id
- [ ] En `PostResource`, responder `404` cuando el resultado sea `false`, con un mensaje que diga que el
      autor no existe
- [ ] Devolver el `201` con el UUID **únicamente** cuando el resultado sea `true`

### Nota de alcance

Este es el único cambio de contrato de la historia. No toca `MinioS3StorageAdapter` ni los adaptadores de
Push o WebSocket. Compilar el backend debe revelar cualquier otro implementador de
`GrafoPersistencePort`; si aparece uno, no existe y hay que revisar el grafo de puertos.

---

## Unidad 3: Preview de la imagen

**Desbloquea**: el entregable *"State handler and multimedia image preview"* de TUX-54, hoy a medias.
**Rollback**: revertir deja el campo de URL sin previsualización, como está hoy.

- [ ] Mostrar la previsualización solo cuando `showMediaInput` es `true` **y** `mediaUrl.trim()` no está vacío
- [ ] Resolver la imagen contra la misma URL que se enviará al backend. Sin endpoint nuevo, sin subida
- [ ] Agregar `onError` al `<img>` para volver al estado sin preview cuando la imagen no carga, con un
      booleano en el estado del componente
- [ ] Cuando el autor borre la URL, la previsualización desaparece: la condición de visibilidad ya lo cubre
- [ ] Mantener el campo de texto de la URL. El preview es un espejo, no un reemplazo
- [ ] No convertir el campo en `type="file"`. El criterio de aceptación entrega una URL, no un archivo
- [ ] No agregar botón de subir a MinIO: la subida binaria es de US-01

---

## Unidad 4: Corregir `pl-13`

**Desbloquea**: alineación del campo de multimedia con el `textarea` de arriba.
**Rollback**: trivial, una clase.

- [ ] Reemplazar `pl-13` por `pl-12` en el contenedor del campo de multimedia
- [ ] No tocar ninguna otra clase del formulario. `pl-13` no existe en la escala de Tailwind, así que hoy no
      produce ningún padding

---

## Fuera de alcance

- Subida real de archivos a MinIO. El criterio entrega una URL.
- Autenticación de `autorId`. Sigue hardcodeado desde `App.tsx` hasta que US-01 aterrice.
- US-06 y US-11, que comparten el puerto `CrearPostUseCase` pero no la ruta de creación.
- El adaptador Web Push que `crearPost()` invoca. Hoy es un stub que solo registra logs.

## Verificación

```bash
# Backend
cd backend && mvn compile

# Frontend
cd frontend && pnpm run build
```

No hay suite de pruebas en el proyecto, por decisión registrada en `openspec/config.yaml`.

- [ ] `mvn compile` termina en verde
- [ ] `pnpm run build` termina en verde
- [ ] cURL del backlog devuelve `201` con id para un autor existente
- [ ] cURL con `autorId` inexistente devuelve `404`, no `201`
- [ ] cURL sin `texto` devuelve `400`
- [ ] En navegador: escribir una URL válida muestra la previsualización
- [ ] En navegador: escribir una URL inválida no rompe el formulario
- [ ] En navegador: el campo de multimedia queda alineado con el `textarea`
