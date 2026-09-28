# Design: US-02 — Seguir y dejar de seguir en el grafo social

**Change**: `us-02-social-graph` · **Ticket**: TUX-53 · **Alcance**: exclusivo de frontend · **Base**: `specs/social-graph/spec.md` (delta verificado, 4 requisitos) y `proposal.md`.

## Enfoque técnico

La cadena de backend está completa y no se modifica. El trabajo es de presentación en `UserSuggestionsCard`: alternar entre `followUserInGraph` y `unfollowUserInGraph` según estado local por tarjeta, actualizado solo tras respuesta confirmada, con error visible por tarjeta.

## Decisiones de arquitectura

### D1. Origen del estado de seguimiento: estado local del cliente confirmado por el servidor

**Decisión**: `UserSuggestionsCard` mantiene `seguidosIds: Set<string>` en estado local. Cada tarjeta inicia como no seguida y cambia a seguida solo cuando `POST` responde con éxito; vuelve a no seguida solo cuando `DELETE` responde con éxito.

**Alternativas descartadas**:
- (a) Derivarlo del payload de sugerencias. Descartada por lectura de código: `SugerenciaUsuario` (frontend y `domain/model`) no contiene ningún campo de estado, y la consulta Cypher de `obtenerSugerenciasUsuarios` filtra con `NOT (u)-[:SIGUE]->(sugerido)`. Por construcción, todo sugerido está no seguido; el payload no puede distinguir el caso "ya seguido".
- (b) Endpoint nuevo de estado de seguimiento. Descartada por alcance: el proposal y el spec declaran backend intacto. Requiere puerto de entrada, servicio y adaptador nuevos. Reutilizar `GET /comunes` por tarjeta sería un N+1 con semántica incorrecta.

**Justificación**: la consulta garantiza el estado inicial (no seguido); el único estado restante es el producido en la sesión por las acciones del usuario. El estado local lo cubre con costo cero de backend y dentro del alcance.

### D2. Actualización confirmada, no optimista

**Decisión**: el estado cambia después de `await` exitoso; ante rechazo se conserva el estado previo.

**Alternativa descartada**: actualización optimista antes de la respuesta. Viola el requisito "Cambio confirmado contra el servidor".

**Justificación**: el spec exige coincidencia con la respuesta del servidor. El retardo por ación es mínimo y aceptable.

### D3. Error visible por tarjeta, sin infraestructura global

**Decisión**: mensaje de error local en la tarjeta (`role="alert"`), conservando el botón previo.

**Alternativas descartadas**: mantener `console.error` (viola el requisito); un sistema global de notificaciones (excede el ticket; esa infraestructura no existe).

**Justificación**: es el cambio mínimo que satisface los dos escenarios de error sin introducir dependencias nuevas.

### D4. Reutilizar el servicio existente, sin cliente nuevo

**Decisión**: un único manejador `handleToggle(targetId, seguido)` invoca `followUserInGraph` o `unfollowUserInGraph`; `networkApi.ts` no cambia.

**Alternativa descartada**: un hook `useFollow` separado. Sin reutilizadores a la vista, sería anticipación innecesaria.

**Justificación**: ambas funciones comparten firma; la alternancia es presentación, como ya establece el proposal.

### D5. Identidad hardcodeada intacta

**Decisión**: `currentUserId` sigue fijo en `App.tsx`; es dependencia de cierre de US-01, no requisito ni tarea de US-02.

**Alternativa descartada**: convertirlo en requisito de esta historia. Contradice el spec y la regla de no implementar autenticación antes de US-01.

**Justificación**: evita expansión de alcance hacia US-01.

## Grafo y arquitectura hexagonal

Sin cambios de esquema: `[:SIGUE]` ya se crea y borra en `Neo4jGrafoAdapter`. ningún puerto ni adaptador se toca. Sin almacenamiento nuevo ni autenticación nueva, conforme a `config.yaml`.

## Flujo de datos

```
App.tsx (sugerencias, currentUserId)
  -> UserSuggestionsCard [seguidosIds, errorPorId]
       -> follow/unfollowUserInGraph -> POST|DELETE /users/{id}/follow/{id}
       <- éxito: actualiza seguidosIds + onNetworkUpdated()
       <- fallo: fija errorPorId, conserva estado
```

## Cambios de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `frontend/src/features/network/components/UserSuggestionsCard.tsx` | Modificar | Estado `seguidosIds` y `errorPorId`, manejador de alternancia, render "Seguir"/"Dejar de seguir", mensaje visible de error |
| `frontend/src/features/network/services/networkApi.ts` | Sin cambios | Ya expone ambos verbos |
| `frontend/src/features/network/types/network.types.ts` | Sin cambios | `SugerenciaUsuario` no requiere campo nuevo |
| `frontend/src/App.tsx` | Sin cambios | `currentUserId` fijo hasta US-01 |
| `backend/**` | Sin cambios | Alcance exclusivo de frontend |

## Interfaces

```ts
const [seguidosIds, setSeguidosIds] = useState<Set<string>>(new Set());
const [errorPorId, setErrorPorId] = useState<Record<string, string | null>>({});
```

## Verificación

`cd frontend && pnpm run build` en verde, sin errores de tipos. Sin fases ni código de pruebas, según `config.yaml`. `mvn compile` confirma que el backend sigue intacto.

## Matriz de amenazas

N/A — sin enrutamiento, shell, subprocesos, automatización de VCS ni integración de procesos.

## Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Recarga vía `onNetworkUpdated` reemplaza la lista | El estado se conserva por identificador y se fusiona tras la recarga; el cambio visual no espera a la recarga |
| Doble clic dispara dos mutaciones | Deshabilitar el botón de la tarjeta mientras su promesa está en curso |
| Identidad hardcodeada (`carlos-patino`) | Riesgo temporal aceptado, dependencia de cierre US-01 |

## Diferido explícitamente

Sugerencias de segundo grado (US-03); autenticación y sesión (US-01); chat, feed, reacciones, push, posts, tendencias, camino más corto (US-04 a US-11); cualquier endpoint o campo nuevo de backend; infraestructura de notificaciones; pruebas.

## Preguntas abiertas

Ninguna. La decisión de origen del estado queda cerrada por D1.
