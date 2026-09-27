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

- [ ] Conservar el contador como primera línea. No reemplazarlo: responde la pregunta rápida antes del detalle.
- [ ] Renderizar los usernames con el `@` que ya usa el encabezado de la tarjeta, para que la convención
      visual sea la misma en ambos lugares.
- [ ] Unir los usernames con una coma o con un punto y coma. No hace falta ningún componente nuevo.
- [ ] Si el arreglo viene vacío, no renderizar la línea. El bloque completo se omite, no se muestra vacío.
- [ ] Es JSX directo sobre el arreglo. No hace falta `useState`, `useMemo` ni ningún otro hook.
- [ ] No deduplicar: `collect` sobre una ruta de dos saltos no produce repetidos para el mismo sugerido.

---

## Unidad 2: Renderizar el avatar con respaldo

**Qué hace**: muestra `sug.avatar` como imagen cuando existe, y conserva el círculo con la inicial como
respaldo cuando la URL está vacía o la imagen no carga.

**Dónde**: `UserSuggestionsCard.tsx`, el `<div>` circular que hoy contiene
`{sug.username.charAt(0).toUpperCase()}`.

**Desbloquea**: la tarjeta muestra el avatar que el backend ya envía en vez de descartarlo.

**Rollback**: revertir devuelve el círculo con la inicial en todas las casos.

### Directrices de implementación

- [ ] Reemplazar el `<div>` circular por un contenedor relativo que sostenga el `<img>` y el respaldo.
- [ ] Reutilizar el círculo con la inicial que ya existe como respaldo. No se diseña uno nuevo.
- [ ] Conmutar al respaldo con `onError` del `<img>`, mediante un booleano en el estado del componente
      que solo se activa ante error.
- [ ] Mantener el tamaño actual del círculo (`.w-9 .h-9`) y el degradado, para no romper la alineación de la fila.
- [ ] Usar un `alt` que no contradiga lo visible. El `@username` de al lado ya aporta el nombre.
- [ ] No agregar manejo de error a las sugerencias: solo al avatar.

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
pnpm run build
```

No hay suite de pruebas en el proyecto, por decisión registrada en `openspec/config.yaml`. La disciplina
manual en navegador es la verificación real de esta historia.

- [ ] `pnpm run build` termina en verde desde `frontend`
- [ ] `networkApi.ts` y `network.types.ts` sin modificar
- [ ] En navegador: una sugerencia con 2 intermediarios muestra el número y los dos usernames
- [ ] En navegador: una sugerencia sin avatar muestra el círculo con la inicial
