# Design: US-03 (TUX-58) — Sugerencia inteligente de contactos

> **Change**: `us-03-sugerencias` · **Ticket**: `TUX-58` · **Alcance**: exclusivo de frontend
> **Base**: el criterio de aceptación de `proposal.md` y el código actual de `UserSuggestionsCard.tsx`

## Contexto técnico

El backend ya entrega el dato completo por sugerencia:

```ts
interface SugerenciaUsuario {
  id: string;
  username: string;
  nombre: string;
  avatar: string;          // ← se recibe y no se usa
  conexionesEnComun: number;
  seguidosEnComun: string[]; // ← se recibe y no se usa
}
```

Ambos campos llegan desde `collect(intermedio.username)` y `count(intermedio)` en la misma agregación
Cypher, así que no hace falta ninguna consulta adicional: el trabajo es de presentación.

## Decisiones

### D1 — Mostrar los nombres de los intermediarios, no solo la cantidad

La tarjeta pasa a renderizar `seguidosEnComun` como lista legible bajo el contador. Es el único modo de
satisfacer el criterio de aceptación, que exige el contenido de la lista y no su tamaño.

Se conserva el número como encabezado porque responde la pregunta rápida ("¿cuántos tenemos en
común?") antes de que el usuario lea los nombres. Ambos datos juntos son la explicación de por qué la
persona aparece sugerida.

**Consecuencia**: si `seguidosEnComun` llega vacío, la línea de nombres no se renderiza y queda solo el
contador. Una sugerencia nunca debería llegar así, porque la agregación solo produce filas cuando existe
al menos un intermediario; el guard es defensivo, no funcional.

### D2 — Renderizar el avatar real con respaldo a la inicial

El backend ya envía `sugerido.avatarUrl AS avatar`. La tarjeta lo descarta y dibuja un círculo
degradado con la inicial.

Se renderiza la imagen cuando `sug.avatar` es truthy, y se conserva el círculo con la inicial como
respaldo cuando la URL está vacía o la imagen falla al cargar. El respaldo no es decorativo: los usuarios
sin avatar subido son comunes y una imagen rota deja la tarjeta a medias.

**Consecuencia**: el componente necesita manejar el error de carga de la imagen, que antes no existía
como estado. Se resuelve con `onError` sobre el elemento `img`, sin estado nuevo.

### D3 — Sin cambios de backend, tipos ni servicios

El contrato de datos ya es suficiente. No se agrega campo, endpoint ni tipo. El único archivo que cambia
es `UserSuggestionsCard.tsx`.

**Consecuencia**: la verificación es exclusivamente `pnpm run build` desde `frontend`. No hay comando
de pruebas en el proyecto, por decisión registrada en `openspec/config.yaml`.

## Riesgo residual

`seguidosEnComun` contiene **usernames de los intermediarios**, no nombres de display. Es lo que exige el
criterio de aceptación (`["beatriz", "paulo"]`) y lo que produce la consulta. Si más adelante se quiere
mostrar el nombre real de cada intermediario, eso requiere cambiar la agregación Cypher y sale de este
alcance.
