# Proposal: US-02 (TUX-53) — Seguir y dejar de seguir en el grafo social

**Change**: `us-02-social-graph`
**Ticket**: TUX-53 (US-02)
**Alcance**: Frontend (el backend ya está implementado y verificado)
**Fecha**: 2026-09-26
**Spec base**: no existe todavia `openspec/specs/social-graph/spec.md`. La capability `social-graph` esta declarada en `openspec/specs/spec.md` (capability 2 de 8), pero su spec durable aun no se escribio. El delta de este change es, por lo tanto, enteramente `## ADDED Requirements`.

> **Este proposal es corto a propósito.** La historia está implementada en su mayor parte desde el commit `964620d`. Un documento largo aquí sería relleno, y el relleno es exactamente lo que motivó rehacer esta historia. El trabajo real que queda está enumerado con precisión y es pequeño.

---

## Intent

Completar la capacidad de seguir y dejar de seguir usuarios, cerrando el último hueco del lado del cliente: **no existe forma de dejar de seguir**.

El botón "Seguir" funciona. El camino inverso no está en la interfaz, aunque el servicio HTTP que lo implementa sí existe y está probado por lectura de código.

---

## Estado verificado

### Backend: implementado de punta a punta

La cadena hexagonal está completa y cableada. Ninguna de estas piezas falta:

| Anillo | Artefacto | Evidencia |
|---|---|---|
| Entrada (REST) | `UserGraphResource` — `POST` y `DELETE` `/{seguidorId}/follow/{seguidoId}` | líneas 26-38 |
| Puerto de entrada | `GestionarGrafoSocialUseCase` — `seguirUsuario`, `dejarDeSeguir` | líneas 11-12 |
| Servicio | `UserGraphApplicationService` — delega al puerto de salida | líneas 26, 31 |
| Puerto de salida | `GrafoPersistencePort` — ambos métodos declarados | líneas 28-29 |
| Adaptador | `Neo4jGrafoAdapter` — `seguirUsuario`, `dejarDeSeguir` | líneas 207, 219 |

### Frontend: servicio completo, UI incompleta

| Artefacto | Estado | Evidencia |
|---|---|---|
| `networkApi.followUserInGraph` | ✅ existe | `features/network/services/networkApi.ts` |
| `networkApi.unfollowUserInGraph` | ✅ existe | mismo archivo |
| Botón "Seguir" | ✅ renderiza y llama al servicio | `UserSuggestionsCard.tsx`, `handleFollow` |
| Botón "Dejar de seguir" | ❌ **no existe** | `UserSuggestionsCard.tsx` solo renderiza "Seguir" |
| Estado de seguimiento | ❌ **no existe** | la tarjeta no sabe si ya se sigue al usuario |
| Montaje en la app | ✅ `UserSuggestionsCard` montado con `currentUserId` | `App.tsx` |

---

## Alcance

### Dentro del alcance

- Botón "Dejar de seguir" en `UserSuggestionsCard`, reutilizando `unfollowUserInGraph`, que ya existe.
- Conocimiento del estado de seguimiento para alternar correctamente entre "Seguir" y "Dejar de seguir".
- Manejo del error de la acción, hoy limitado a un `console.error` silencioso.
- Verificación de que la cadena backend responde y de que la interfaz refleja el cambio.

### Fuera del alcance

- **Sugerencias de segundo grado.** `obtenerSugerencias` ya existe en `UserGraphResource` y alimenta esta tarjeta, pero el cálculo del algoritmo es de US-03. Aquí no se toca.
- **Relaciones sociales en general.** Seguir y dejar de seguir son las únicas operaciones de esta historia.
- **Autenticación.** El `currentUserId` que consume la acción viene de un valor fijo en `App.tsx`. Sustituirlo por una sesión real es de US-01, y esta historia **no** puede Resolveerse sin ella en un sentido estricto: se puede seguir usando la identidad hardcodeada, pero la acción no es verificable por usuario hasta que exista sesión.
- **Backend.** No se modifica. Si la verificación detecta un defecto ahí, es trabajo de corrección, no de esta historia.
- **Chat, feed, reacciones, push, posts, tendencias, seguidores en común y camino más corto.** Corresponden a US-04 a US-11.
- **Tests.** Sin runner en el proyecto.

---

## Contexto técnico

El componente actual no distingue el estado de la relación, así que solo puede ofrecer una de las dos acciones:

```tsx
// UserSuggestionsCard.tsx — estado actual
const handleFollow = async (targetId: string) => {
  try {
    await followUserInGraph(currentUserId, targetId);
    onNetworkUpdated();
  } catch (err) {
    console.error('Error al seguir usuario:', err);
  }
};

// ...y en el render, siempre:
<button onClick={() => handleFollow(sug.id)}>
  <UserPlus className="w-3.5 h-3.5" />
  <span>Seguir</span>
</button>
```

`followUserInGraph` y `unfollowUserInGraph` comparten firma, de modo que alternar entre ambas es una decisión de presentación, no un gap de red. El mecanismo concreto para conocer el estado de seguimiento —y si ese estado debe derivarse de las sugerencias o de una consulta nueva— queda diferido a `design.md`.

El servicio ya expone ambos verbos:

```ts
export const followUserInGraph = async (seguidorId: string, seguidoId: string): Promise<void> => {
  await api.post(`/users/${seguidorId}/follow/${seguidoId}` (read-only));
};

export const unfollowUserInGraph = async (seguidorId: string, seguidoId: string): Promise<void> => {
  await api.delete(`/users/${seguidorId}/follow/${seguidoId}` (read-only));
};
```

---

## Cambios en el grafo

Ninguno. La relación `[:SIGUE]` y su aritmética de creación y borrado ya están en `Neo4jGrafoAdapter`. Esta historia no escribe en el grafo de forma nueva: consume lo que ya existe.

La única consecuencia observable es que la interfaz debe reflejar el estado real de la relación después de cada acción, para no ofrecer "Seguir" sobre alguien a quien ya se sigue.

---

## Cambios en permisos

Ninguno en esta historia. La autorización de la acción depende de US-01: hasta que exista token y sesión, `currentUserId` es `'carlos-patino'` fijo y la acción se ejecuta como ese usuario sin autenticación. Es un riesgo conocido y aceptado **de forma temporal**, con US-01 como dependencia de cierre.

---

## Entregables

1. Alternancia de acción en `UserSuggestionsCard` entre seguir y dejar de seguir.
2. Botón de "Dejar de seguir" invocando `unfollowUserInGraph`.
3. Conocimiento del estado de seguimiento por usuario.
4. Retroalimentación visible al usuario cuando la acción falla, en lugar de un `console.error` silencioso.
5. `cd frontend && pnpm run build` en verde, sin errores de tipos.

---

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| La acción se ejecuta con identidad hardcodeada | Cualquier usuario puede seguir como `carlos-patino` | Depende de US-01. Riesgo temporal y aceptado, con dependencia de cierre declarada |
| El estado de seguimiento se deriva de un origen que no lo refleja | La interfaz ofrece "Seguir" sobre alguien ya seguido | La decisión de origen del estado queda en `design.md` y debe quedar justificada, no asumida |
| La compilación del frontend falla por un error de tipos | Ningún criterio de éxito es alcanzable | **Resuelto antes de esta historia**: `pushService.ts` ya declara `Uint8Array<ArrayBuffer>` y `pnpm run build` está en verde. Si vuelve a fallar, es regresión, no deuda heredada |
| Un fallo de red se muestra solo en consola | El usuario no sabe si la acción ocurrió | El entregable 4 cubre la retroalimentación visible |

---

## Criterios de éxito

- [ ] `UserSuggestionsCard` ofrece "Dejar de seguir" sobre un usuario ya seguido
- [ ] La acción de dejar de seguir invoca `unfollowUserInGraph` con `currentUserId` y el identificador correcto
- [ ] Seguir y dejar de seguir alternan correctamente sin recargar la página
- [ ] Un error de la acción produce una señal visible, no solo un `console.error`
- [ ] La interfaz no ofrece "Seguir" sobre una relación ya establecida
- [ ] No se modificó ningún archivo del backend
- [ ] `cd frontend && pnpm run build` no introduce errores de tipos nuevos
- [ ] Ningún archivo de prueba fue creado
