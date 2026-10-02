# Feedback al dejar de seguir: quién desaparece y por qué

## Objetivo

Cuando un usuario deja de seguir a alguien y eso provoca que **otra** persona salga de "Tu red", la interfaz debe explicarlo. Hoy la lista cambia en silencio y el único feedback es "No hay nuevas recomendaciones por ahora", sinFNExplicación de que su acción_async强劲改动了 el alcance a 2 saltos.

## Problema

"Tu red" es alcance a 2 saltos calculado en cada request, no una lista almacenada. Al quitar el último puente de una persona, esa persona deja de ser alcanzable y desaparece. La lógica es correcta, pero la **comunicación** no: ver a alguien desaparecer como efecto secundario de un botón rotulado "Dejar de seguir a Paulo" es indistinguible de un fallo de carga.

Escenario verificado por API con `angel` (seeds):

| Paso | `conexionesEnComun` | `seguidosEnComun` | "Tu red" |
|---|---|---|---|
| Entra | 2 | `[paulo, beatriz]` | paulo, beatriz, david |
| Suelta beatriz | 1 | `[paulo]` | paulo, david |
| Suelta paulo | — | — | vacía |

Los tres pasos son correctos. Lo que falta es el aviso.

## Por qué

El usuario lo percibe como bug (lista vacía de golpe) y sin explicación va a seguir reportándolo, descifraando tiempo en reproducir un comportamiento correcto. Explicar la desaparición devuelve la causalidad sin cambiar la semántica.

## Alcance

- **Sí**: aviso en `UserSuggestionsCard` cuando alguien no seguido desaparece de "Tu red" y el puente que se quitó figura en sus `seguidosEnComun` de la fila previa.
- **No**: cambiar la semántica de la red. No se agrega a "Tu red" a quien ya no es alcanzable. No se altera ningún Cypher, endpoint ni cálculo de `conexionesEnComun`.
- **No**: tocar el feed, `fusionarRed`, `App.tsx` ni la firma de `onNetworkUpdated`.

## Restricciones

- El aviso sólo se emite para la desaparición **colateral**. A quien el usuario acaba de dejar de seguir no se le anuncia: es obvio y sería ruido.
- Sólo se anuncia lo que se puede probar. Si alguien desaparece y el puente no figura en sus `seguidosEnComun`, no hay explicación honesta y no se inventa ninguna.
- Artefactos técnicos en inglés; el copy de UI en español, que es el idioma de la interfaz existente.
- Reutilizar el patrón visual de la tarjeta. Sin librería nueva.

## Checklist

- [ ] T1. Tests que fallan para el comportamiento nuevo (RED), con convención colocateada e imports explícitos de `vitest`.
- [ ] T2. Snapshot pre-refresh + diff en cambio de `filas` que detecta sólo la desaparición **colateral** explicable.
- [ ] T3. Render del aviso temporal con auto-ocultamiento, re-consumible en cada unfollow.
- [ ] T4. Verde: `pnpm test`, `pnpm run lint`, `pnpm run build`, `pnpm run format:check` en los archivos tocados.
- [ ] T5. Documentar el comportamiento en los artefactos de US-05 (spec + design + tasks).

## Alcance autorizado

`frontend/src/features/network/components/UserSuggestionsCard.tsx` y su `.test.tsx`; artefactos de `openspec/changes/us-05-feed/`. Nada fuera de esas rutas.

## Criterios de aceptación

1. Unfollow de `paulo` con david visible y `seguidosEnComun: ['paulo']` produce el aviso "David dejó de aparecer en tu red al dejar de seguir a Paulo."
2. Unfollow de `beatriz` con `seguidosEnComun: ['paulo','beatriz']` **no** produce aviso, porque david sigue alcanzable por paulo.
3. Dejar de seguir a `beatriz` no anuncia la desaparición de beatriz (no es colateral).
4. Sólo hay aviso si el puente realmente estaba en `seguidosEnComun`; nunca se explica un消失 sin evidencia.
5. Los tests existentes de `UserSuggestionsCard` y `App` siguen pasando sin modificarlos.
6. El aviso desaparece solo y no bloquea la interacción con la lista.

## Comprobaciones

TDD efectivo: **off**. Fuente: `openspec/config.yaml` → `testing.strict_tdd: false`. Runner: `pnpm test` (Vitest). Aun así se escribe el test antes de la implementación (RED → GREEN).
`pnpm run format:check` tiene 5 fallos preexistentes en `LoginScreen.tsx`, `authApi.test.ts`, `CreatePostForm.tsx`, `CreatePostForm.test.tsx`, `Navbar.tsx`: ajenos a este cambio, no los toques.
`.atl/` es ruido de tooling sin trackear: no lo agregues.

## Ruta

Writer delegado (T2 y T3 tocan componente + tests: 2 archivos no triviales → dispara el writer trigger).

## Progreso

- [x] T1. Tests primero (RED observado: "Unable to find role status"), luego implementación.
- [x] T2. Snapshot `filasPreviasRef` + diff que detecta sólo desaparición **colateral** con puente probado en `seguidosEnComun`.
- [x] T3. Banner `role="status"` + `aria-live="polite"`, auto-oculta a los 6000 ms, no bloquea la lista.
- [x] T4. Verde: `pnpm test` 86/86, `pnpm run lint` exit 0, `pnpm run build` exit 0, prettier limpio en los 2 archivos.
- [x] T5. Documentado en spec + design (sección D4) + tasks (Unidad 5).

### Hallazgo durante la implementación

El writer dejó `afectada.nombre !== ''` como guarda. **Es un bug latente**: el tipo declara
`nombre: string`, pero `network.types.ts:23` documenta que `guardarUsuario` borra la propiedad cuando
el valor es null y el backend la devuelve tal cual. En runtime la fila llega sin `nombre`, la
comparación da `true` y el mensaje renderiza literalmente `undefined dejó de aparecer en tu red`.
Corregido con guarda por trim + fallback al username, y cubierto con un test que simula la fila sin
`nombre` mediante cast explícito (el cast documenta la mentira del tipo).

El nombre del puente también se capitaliza: `seguidosEnComun` guarda usernames en minúscula y el
mensaje los interpola en una oración.

## Verificación

| Comando | Resultado |
|---|---|
| `pnpm test` | 86/86, 9 archivos (28 en la tarjeta: 21 previos + 7 nuevos) |
| `pnpm run lint` | exit 0, limpio |
| `pnpm run build` | exit 0, `tsc && vite build` |
| `prettier --check` (2 archivos) | limpio |

Los 21 tests previos de la tarjeta pasan **sin modificarse**. Los 5 fallos de `format:check` del repo
son preexistentes y ajenos.

## Siguiente paso

Implementar T1..T5, commitear como unidad de trabajo y registrar la evidencia.