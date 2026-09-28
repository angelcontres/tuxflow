# Tasks: US-02 (TUX-53) — Seguir y dejar de seguir en el grafo social

> **Ticket**: `TUX-53` — US-02: Seguir y dejar de seguir en el grafo social.
> **Especificación**: `openspec/changes/us-02-social-graph/specs/social-graph/spec.md` (4 requisitos, 8 escenarios).
> **Diseño**: `openspec/changes/us-02-social-graph/design.md` (D1–D5).
> **Alcance**: exclusivo de frontend. El backend y el servicio HTTP ya existen y no se modifican.

## Review Workload Forecast

| Métrica | Valor |
|---|---|
| Unidades de trabajo | 3 |
| Líneas estimadas de cambio | 80–120 |
| Riesgo de presupuesto de 400 líneas | **Bajo** |
| PRs encadenados recomendados | **No** |
| Decisión necesaria antes de apply | **No** |
| División sugerida | PR único |
| Estrategia de entrega | single-pr |
| Límite de revisión del preflight | 800 líneas |

**Estimación por unidad** (autoría, sin pruebas generadas):

| Unidad | Alcance | Líneas |
|---|---|---|
| 1 | Estado `seguidosIds` y manejador de alternancia (D1, D2, D4) | 50–70 |
| 2 | Error visible por tarjeta y protección de doble acción (D2, D3) | 20–30 |
| 3 | Integración y verificación por compilación, sin cambio de código | 0 |

**Recomendación**: un único PR. El máximo estimado (120 líneas) queda lejos del presupuesto de 400 y del límite de 800 del preflight. El cambio es de un solo archivo y reversible en bloque; dividirlo no aporta control de revisión.

---

## Fase 1 — Estado local y alternancia

### Unidad 1: estado `seguidosIds` confirmado por el servidor y manejador único

- **Estado inicial**: la tarjeta solo renderiza "Seguir" vía `handleFollow`; no conoce el estado de seguimiento.
- **Terminado cuando**: cada tarjeta inicia como no seguida y cambia solo tras respuesta confirmada; `handleToggle` invoca `followUserInGraph` o `unfollowUserInGraph`; la tarjeta muestra "Dejar de seguir" sin recargar tras éxito.
- **Trazabilidad**: Requirement Alternancia según estado de seguimiento, Requirement Dejar de seguir usuario, Requirement Reflejo inmediato del cambio.
- **Archivos**: solo `frontend/src/features/network/components/UserSuggestionsCard.tsx`. Sin cambios en `networkApi.ts`, `network.types.ts`, `App.tsx` ni `backend/**`.
- **Desbloquea (frontier)**: la alternancia visual es prerrequisito del error por tarjeta de la Fase 2, que necesita un estado previo que conservar ante rechazo.
- **Boundary de rollback**: el archivo citado. Revertirlo devuelve la tarjeta al botón único de "Seguir", estado actual.
- **Verificación**: `pnpm run build` desde `frontend`.

- [ ] 1.1 Agregar `seguidosIds: Set<string>` en `frontend/src/features/network/components/UserSuggestionsCard.tsx`, actualizado solo tras `await` exitoso (D1, D2)
- [ ] 1.2 Agregar `handleToggle(targetId, seguido)` en `frontend/src/features/network/components/UserSuggestionsCard.tsx` que reutilice `followUserInGraph` y `unfollowUserInGraph` sin cliente nuevo (D4)
- [ ] 1.3 Renderizar "Seguir" o "Dejar de seguir" en `frontend/src/features/network/components/UserSuggestionsCard.tsx` según `seguidosIds`, con `onNetworkUpdated()` tras éxito

---

## Fase 2 — Error visible y protección de doble acción

### Unidad 2: error local por tarjeta y botón deshabilitado durante la promesa

- **Estado inicial**: el fallo se limita a `console.error`; el usuario no recibe señal visible. Nada impide el doble clic.
- **Terminado cuando**: ante rechazo, la tarjeta muestra un mensaje con `role="alert"` y conserva el botón previo; el botón queda deshabilitado mientras su promesa está en curso.
- **Trazabilidad**: Requirement Retroalimentación visible ante error (ambos escenarios), Requirement Reflejo inmediato del cambio (cambio confirmado, D2).
- **Archivos**: solo `frontend/src/features/network/components/UserSuggestionsCard.tsx`.
- **Desbloquea (frontier)**: cierra el componente completo que la Fase 3 verifica por compilación.
- **Boundary de rollback**: el estado `errorPorId` y la deshabilitación temporal. Revertirlos devuelve el error silencioso, sin afectar la alternancia.
- **Verificación**: `pnpm run build` desde `frontend`.

- [ ] 2.1 Agregar `errorPorId` con `role="alert"` en `frontend/src/features/network/components/UserSuggestionsCard.tsx`, conservando el estado previo ante rechazo (D2, D3)
- [ ] 2.2 Deshabilitar el botón de la tarjeta en `frontend/src/features/network/components/UserSuggestionsCard.tsx` mientras su promesa está en curso

---

## Fase 3 — Integración y verificación por compilación

### Unidad 3: confirmación de compilación en verde con el backend intacto

- **Estado inicial**: componente completo, compilación sin comprobar.
- **Terminado cuando**: `pnpm run build` pasa sin errores de tipos nuevos y `mvn compile` confirma que el backend sigue intacto.
- **Trazabilidad**: sin requisito funcional; cierra los criterios de éxito de compilación del proposal.
- **Archivos**: ninguno; es verificación.
- **Desbloquea (frontier)**: habilita `sdd-apply` y `sdd-verify` sobre una base compilable.
- **Boundary de rollback**: sin cambio de código; no hay reversión parcial.
- **Verificación**: los dos comandos de esta fase son la verificación.

- [ ] 3.1 Ejecutar `pnpm run build` desde `frontend` sin errores de tipos nuevos
- [ ] 3.2 Ejecutar `mvn compile` desde `backend` para confirmar que el backend sigue intacto

---

## Fuera de alcance

- Cualquier cambio en `backend/**`.
- Sugerencias de segundo grado (US-03).
- Autenticación y sesión (US-01). `currentUserId` sigue hardcodeado (`carlos-patino`); es dependencia de cierre de US-01, no tarea de esta historia.
- Chat, feed, reacciones, push, posts, tendencias y camino más corto (US-04 a US-11).
- Infraestructura de notificaciones; pruebas: el proyecto no tiene runner configurado.

## Riesgos de implementación

| Riesgo | Mitigación |
|---|---|
| Recarga vía `onNetworkUpdated` reemplaza la lista | Conservar `seguidosIds` por identificador y fusionar tras la recarga (Unidad 1) |
| Doble clic dispara dos mutaciones | Deshabilitar el botón mientras la promesa está en curso (Unidad 2) |
| Identidad hardcodeada (`carlos-patino`) | Riesgo temporal aceptado, dependencia de cierre de US-01 (D5) |

## Verificación: solo compilación, por decisión del proyecto

`openspec/config.yaml` ya decidió este punto: sin fase de tests; no se crean ni ejecutan pruebas. La verificación es estrictamente `pnpm run build` en `frontend`, con `mvn compile` como confirmación de que el backend sigue intacto. Estas tareas no incluyen ninguna fase de pruebas.
