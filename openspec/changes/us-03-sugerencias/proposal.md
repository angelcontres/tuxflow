# Proposal: US-03 (TUX-58) — Sugerencia inteligente de contactos (segundo grado)

> **Ticket Linear**: `TUX-58` — US-03: Smart contact suggestions (2nd degree) · Sprint 2 · 3 SP · MoSCoW Should
> **Card backlog**: `TUX-06` en `docs/backlog-programadores.md` línea 278
> **Rama**: `feature/US-03-sugerencias-amigos`
> **Épica**: Grafo / Algoritmos · **Asignado**: Paulo Orrala

## Corrección de trazabilidad

Hay dos numeraciones de tickets en circulación y este change arrastra mal ambas en distintos documentos:

- El número canónico es el de **Linear**: `TUX-58`.
- `docs/backlog-programadores.md` numera sus tarjetas `TUX-01`..`TUX-11`, y ahí US-03 es `TUX-06`. Esa
  numeración es local al documento y no corresponde a Linear.
- El skeleton generado para este change declaraba `TUX-57 (US-03)`, y `openspec/ROADMAP.md` repetía ese
  error. Ambos están equivocados: en Linear **`TUX-57` es US-09** (*"Followers and mutual connections
  between two profiles"*), no US-03.

La numeración de Linear no sigue el orden de las historias. US-03 es `TUX-58` y US-09 es `TUX-57`. No
deducir el ticket a partir del número de historia.

## Intención

Como usuario interesado en expandir mi red, quiero recibir sugerencias automáticas de contactos basadas
en conexiones de segundo nivel ("amigos de amigos"), ponderadas por la cantidad de intermediarios que
tenemos en común.

## Criterio de aceptación (Gherkin)

```gherkin
Dado que "carlos-patino" sigue a "beatriz" y "paulo", y ambos siguen a "david"
Cuando "carlos-patino" solicita sugerencias en GET /api/users/carlos-patino/sugerencias
Entonces "david" aparece en la lista con conexionesEnComun = 2
Y seguidosEnComun = ["beatriz", "paulo"].
```

## Estado real: la historia ya está construida en su mayor parte

Este change **no arranca desde cero**. La auditoría del código muestra que el backend está completo y
que el frontend tiene dos huecos concretos.

### Backend — completo, no se modifica

| Entregable del backlog | Ubicación | Estado |
|---|---|---|
| Consulta Cypher #2 obligatoria | `Neo4jGrafoAdapter.obtenerSugerenciasUsuarios()` | **Ya implementado** |
| Inbound `GET /{userId}/sugerencias` | `UserGraphResource.obtenerSugerencias()` | **Ya implementado** |

La consulta ya recorre dos saltos, excluye al propio usuario y a los que ya se siguen, y ordena por
intermediarios compartidos:

```cypher
MATCH (u:Usuario {id: $userId})-[:SIGUE]->(intermedio:Usuario)-[:SIGUE]->(sugerido:Usuario)
WHERE u <> sugerido AND NOT (u)-[:SIGUE]->(sugerido)
RETURN sugerido.id AS id,
       sugerido.username AS username,
       sugerido.nombre AS nombre,
       sugerido.avatarUrl AS avatar,
       count(intermedio) AS conexionesEnComun,
       collect(intermedio.username) AS seguidosEnComun
ORDER BY conexionesEnComun DESC
LIMIT 5;
```

Devuelve además los intermediarios en la propia línea del agregado, que es exactamente lo que el
criterio de aceptación pide exponer.

### Frontend — dos huecos

| Entregable del backlog | Estado | Detalle |
|---|---|---|
| Nombre del usuario | **Completo** | La tarjeta renderiza `@{sug.username}` |
| Botón directo de "Seguir" | **Completo** | US-02 lo convierte en alternancia Seguir / Dejar de seguir |
| Avatar | **Hueco** | La tarjeta pinta la inicial del usuario en un círculo degradado e **ignora `sug.avatar`**, que el backend ya envía |
| Badge de amigos en común | **Parcial** | Pinta `sug.conexionesEnComun` (el número) pero **nunca `sug.seguidosEnComun`** (los nombres) |

El badge parcial es el que incumple el Gherkin: el criterio exige que `seguidosEnComun` valga
`["beatriz", "paulo"]`, y ese dato llega al navegador pero no se muestra.

## Alcance de este change

Solo `frontend/src/features/network/components/UserSuggestionsCard.tsx`. Sin backend, sin servicios, sin
tipos, sin esquema Neo4j.

## Fuera de alcance

- US-02: alternancia del botón. Este change no toca el manejador de seguir, solo lo reutiliza.
- US-01: la identidad hardcodeada en `App.tsx`.
- MinIO y la carga de avatares. Esta historia consume el avatar que ya existe; no lo produce.
- Cualquier endpoint, campo o relación nueva en el backend.
