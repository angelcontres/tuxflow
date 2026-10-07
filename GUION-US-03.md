# Guion de demo — US-03 Sugerencias inteligentes (TUX-58)

**Duración:** ~1:30 · **PR:** #8 · **Rama:** `feature/US-03-sugerencias-amigos`

## Antes de empezar (no cuenta)

```bash
docker compose up -d
```

Abrir <http://localhost:3000>. Sesión por defecto: `@carlos`.

> ⚠️ Si la ventana es menor a 1024px el layout se apila y la tarjeta queda **abajo**, bajo el feed. Maximizar.

---

## 0:00 — El problema (15 s)

> El endpoint de sugerencias ya devolvía **el avatar** y **quiénes son los intermediarios**. La tarjeta recibía ambos campos y los tiraba a la basura: pintaba una inicial en un círculo y mostraba solo *el número* de conexiones.

> El criterio de aceptación pide los intermediarios, no su cantidad. La tarjeta no lo cumplía.

## 0:15 — Qué se implementó (15 s)

> Dos cambios, solo de presentación. **El backend no se tocó**: la consulta obligatoria #2 ya devolvía los dos campos.

## 0:30 — Demo: la tarjeta (30 s)

Señalar la tarjeta **"Tu red"**, columna derecha:

| Fila | Qué debe verse | Botón |
|---|---|---|
| `@paulo` | `Paulo Orrala` | Dejar de seguir |
| `@beatriz` | `Beatriz Silva` | Dejar de seguir |
| `@david` | `2 conexión(es) mutua(s)`<br>`Conocido por @paulo, @beatriz` | **Seguir** |

> Las dos primeras son contactos directos: nombre real y nada más.
> `@david` es de segundo grado, y ahora **dice a través de quién**: conocido por `@paulo` y `@beatriz`.

Las 3 fotos deben verse **cargadas**. Si sale una letra en un círculo, ese avatar falló y estás viendo el respaldo.

## 1:00 — Demo: la interacción (20 s)

Pulsar **Seguir** en `@david`.

> Esto es la prueba real. Al seguirlo, desaparece de sugerencias y aparece `@elena` con **1** conexión mutua, conocida a través de `@david`.

Debe quedar:

| Fila | Qué debe verse |
|---|---|
| `@elena` | `1 conexión(es) mutua(s)` · `Conocido por @david` |
| `@david` | `David Mendoza` |

Luego **Dejar de seguir** en `@david` → vuelve al estado inicial.

## 1:20 — Verificación (15 s)

> `pnpm run check` en exit 0: formato, lint, 27 tests y build. Las 14 pruebas preexistentes siguen intactas; añadimos 7, y **3 fallan si se revierte el componente** — se comprobó con `git stash`.
> En navegador se verificó el respaldo del avatar forzando un error de carga real.

## 1:35 — Cierre (10 s)

> El orden de los intermediarios no es estable: `collect()` en Cypher no lo garantiza. Cumplimos el conjunto, no el orden literal del Gherkin.

---

## Plan B — si no hay tiempo para la demo

Muestra solo la tabla de 0:30 y el clic de 1:00. Con eso queda el 90% del valor.

## Lo que NO debes prometer

**El feed sale vacío.** No es este PR: `GET /api/feed/{id}` devuelve 500 por un desajuste de tipo en `fechaCreacion` (`Neo4jGrafoAdapter.java:53`), que es la consulta #1 y requiere su propia historia. Si alguien pregunta, es el dato honesto.

**El chat tampoco conecta.** Es independiente de US-03.

---

## Comprobación técnica del respaldo (opcional, ~10 s)

Consola del navegador — parte **todas** las fotos a la vez:

```js
document.querySelectorAll('.space-y-3 img').forEach(i => i.src = 'http://localhost:9/x.png')
```

Las 3 filas deben cambiar a círculos con `P`, `B`, `D`.

## Reset del dataset

El clic de "Seguir" escribe una relación real en Neo4j:

```bash
cat docker/neo4j-seed.cql | docker exec -i redsocial-neo4j cypher-shell -u neo4j -p password123
```