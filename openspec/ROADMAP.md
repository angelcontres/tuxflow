# Roadmap — Ejecución y Arquitectura de Red Social Distribuida

> **Punto de entrada para sesiones nuevas.** Este archivo fija el orden, las decisiones ya cerradas y los hechos verificados del código, para que nadie los vuelva a discutir ni los redescubra.
>
> Fecha: 2026-09-25 · Actualizado: 2026-10-02 (US-12 aplicada) · Artefactos SDD: `openspec/changes/` · Tickets: Linear `TUX-52`..`TUX-64` (`US-01`..`US-12`)

---

## Contexto en una línea

El sistema es una Red Social Distribuida apoyada en Neo4j, Quarkus y MinIO; el frontend usa React + Vite + Tailwind, sin embargo, faltan pruebas, linting y la implementación real de autenticación.

---

## Estado real del código

El esqueleto de la arquitectura hexagonal (Quarkus) y la estructura de features (React) ya existen, con puertos y adaptadores definidos. 
Lo que está implementado (al menos como interfaces o componentes base):
- Los adaptadores hacia Neo4j, MinIO y Web Push.
- Componentes de interfaz de usuario, recursos REST y el WebSocket del Chat.
Lo que NO está implementado:
- Cobertura de pruebas baja: hay runner y pruebas base, pero cada US debe traer las suyas.
- Autenticación JWT (definido en diseño, pero no construido en el código).

## Cómo verificar antes de abrir un PR

La política de pruebas ya no es sólo compilación. Antes de abrir un PR hay que correr los tres
comandos y verlos verdes:

| Comando | Qué cubre | Runner |
|---|---|---|
| `$MAVEN_HOME/bin/mvn test` (en `backend/`) | Pruebas Java, con `quarkus-junit5` como punto de entrada | JUnit 5 vía Surefire |
| `pnpm test` (en `frontend/`) | Pruebas de componentes y servicios | Vitest con entorno jsdom |
| `pnpm run build` (en `frontend/`) | Typecheck (`tsc`) y empaquetado de producción | tsc + Vite |

`$MAVEN_HOME` apunta a `~/.local/opt/apache-maven-3.9.6`. Ojo: `~/.bashrc` define `MAVEN_HOME`
y `JAVA_HOME` pero **no** los agrega al PATH, así que `mvn` a secas no funciona. El sistema sólo
tiene Java 25, que es un JRE sin `javac` y no compila: hay que usar el JDK 21 de `~/.local/opt`.

Base de pruebas al 2026-09-26: 5 en `PostTest` (backend) y 8 en `UserSuggestionsCard.test.tsx`
(frontend), más cobertura con `pnpm run test:coverage` (v8). No hay runner e2e: Playwright y
Cypress siguen sin configurarse, y `openspec/config.yaml` los declara no disponibles a propósito.

---

## ⛔ Antes de empezar: tres contratos que hay que decidir

Estas tres cosas **no son órdenes**, son decisiones. Tomarlas después deja historias aplicadas que
funcionan por casualidad y se rompen cuando llega la siguiente.

| # | Contrato | Por qué no puede esperar | Quién decide |
|---|---|---|---|
| 1 | **Representación de `Post.fechaCreacion`** | La escribe `US-04`, la ordena y la lee `US-05`, la compara `US-11`. Si cada una asume un tipo distinto, las tres rompen. Hoy está guardada como entero, y los tres consumidores asumen tres tipos diferentes. | Arquitectura, **antes de aplicar US-04** |
| 2 | **VAPID real y strategy de token push** | `US-08` usa llaves de ejemplo en el arranque. La notification se dispara dentro de `crearPost`, así que hoy el camino de error se ejercita con cada publicación. | Operaciones, antes de `US-08` |
| 3 | **Identidad única de sesión** | `App.tsx:13` fija `currentUserId` a `'carlos-patino'`. Toda historia de frontend depende de este valor. Sin decisión, cada historia lo trata distinto. | `US-01`, y las demás la consumen |

---

## Grafo de dependencias

Cada fila indica contra qué historias **no se puede empezar**. La columna de evidencia es lo que hay que
mirar en el código para comprobarla.

| Historia | Ticket | SP | Bloqueada por | Evidencia de la dependencia |
|---|---|---|---|---|
| **US-01** | TUX-52 | 2 | — | Crea `Usuario`. Sin nodo `Usuario` no hay grafo. |
| **US-02** | TUX-53 | 2 | US-01 | La relación `SIGUE` va de `Usuario` a `Usuario`. |
| **US-04** | TUX-54 | 3 | US-01 | `crearPost` enlaza `(:Usuario)-[:PUBLICA]->(:Post)`. |
| **US-07** | TUX-59 | 5 | US-01 | `chatSocket.ts:36` envía `emisorId: ''`. Sin identidad no hay chat. |
| **US-03** | TUX-58 | 3 | US-02 | El Cypher de sugerencias filtra por `sigueA`. |
| **US-05** | TUX-55 | 5 | US-02, US-04 | El feed navega `SIGUE` y lee `Post`. |
| **US-06** | TUX-56 | 2 | US-04 | Se reacciona a un `Post` existente. |
| **US-08** | TUX-60 | 5 | US-02, US-04 | Se dispara desde `crearPost` e itera `seguidor` de `SIGUE`. |
| **US-09** | TUX-57 | 3 | US-02 | `seguidoresEnComun` requiere `SIGUE`. |
| **US-10** | TUX-61 | 3 | US-02, US-03 | Comparte archivo con ambas: `UserSuggestionsCard.tsx`. |
| **US-11** | TUX-62 | 3 | US-04, US-05, US-06 | Cuenta `REACCIONA` sobre `Post` y filtra por `fechaCreacion`. |
| **US-12** | TUX-64 | 5 | US-01, US-02, US-09 | Lee `[:PUBLICA]` y `[:SIGUE]` por un identificador que no es el de la sesión, y monta dentro los paneles de US-09 y US-10 que ambas asumían. |

### El único conflicto de merge real

`UserSuggestionsCard.tsx` lo tocan **tres** historias: `US-02`, `US-03` y `US-10`. Es la única
colisión de archivo de todo el plan, y es estrictamente serial: nunca dos de las tres en paralelo.

Cualquier otro archivo del plan no se solapa.

### Camino crítico

```
US-01 → US-02 → US-05 → US-11
US-01 → US-04 → US-05 → US-11
```

Cuatro historias en cadena, tres handoffs. **Si se paraleliza, `US-11` es la historia que manda en la
fecha de entrega** — es la última del camino crítico por los dos lados. `US-11` no es "la última de la
lista": es la que más dependencias acumuladas tiene, por dos rutas distintas.

---

## Orden de implementación

El orden total válido, para cuando se trabaja de a uno:

```
US-01 → US-02 → US-04 → US-05 → US-06 → US-03 → US-09 → US-07 → US-08 → US-10 → US-11
```

### Carriles paralelos

El orden total **no** significa que haya que trabajarlo en fila. Estas historias pueden estar en
marcha al mismo tiempo:

| Carril | Secuencia interna | Puede arrancar cuando |
|---|---|---|
| **A — Grafo social** | US-01 → US-02 → US-03 → US-10 | US-01 aplicado |
| **B — Publicaciones** | US-04 → US-05 → US-06 → US-11 | US-01 aplicado |
| **C — Interacción** | US-07 | US-01 aplicado |
| **D — Notificaciones** | US-08 | US-02 **y** US-04 aplicados |
| **E — Conexiones** | US-09 | US-02 aplicado |

Con 3 o 4 personas, el plan se ve así:

| Momento | En marcha | Requiere |
|---|---|---|
| 1 | US-01 | — |
| 2 | US-02, US-04, US-07 | US-01 |
| 3 | US-05, US-06, US-03, US-09 | US-02, US-04 |
| 4 | US-08, US-10 | US-02 + US-04 · US-02 + US-03 |
| 5 | US-11 | US-04, US-05, US-06 |

**Tres personas pueden trabajar en paralelo desde el momento 2.** Si el equipo trabaja en fila y US-11
es la última, la fecha la marca una sola persona. Si se paraleliza, la marca la ruta más larga, que es
la misma historia pero alcanzada por más gente.

### Regla operativa para no bloquear a un dev

> Antes de tomar un ticket, mira su fila en el grafo de dependencias. Si alguna de las historias que lo
> bloquean **no está en `main`**, ese ticket no se toma. "No está en main" no es lo mismo que "está
> empezada" ni que "tiene un pull request abierto": hasta que no está en `main`, el siguiente dev
> está programando contra algo que puede cambiar.

---

## Qué hace cada historia

Hay **dos numeraciones distintas** y confundirlas rompe el traceo. `Ticket Linear` es la canónica. La
columna `Card backlog` es la numeración interna de `docs/backlog-programadores.md`, que va 1:1 con las US
y **no** coincide con Linear. Al leer cualquiera de los dos documentos, verificar ambas.

| Sprint | Ticket Linear | Card backlog | Historia | SP | MoSCoW | Criterio de Éxito / Qué hace |
|---|---|---|---|---|---|---|
| Sprint 1 | TUX-52 | TUX-01 | US-01 | 2 | Must | Registro, sesión y perfil con avatar en MinIO |
| Sprint 1 | TUX-53 | TUX-02 | US-02 | 2 | Must | Seguir, dejar de seguir y consultar red social |
| Sprint 1 | TUX-54 | TUX-03 | US-04 | 3 | Must | Crear publicación con multimedia S3 |
| Sprint 2 | TUX-55 | TUX-04 | US-05 | 5 | Must | Feed generado por grafo social (2 saltos) |
| Sprint 2 | TUX-56 | TUX-05 | US-06 | 2 | Should | Reaccionar a publicaciones (Likes) |
| Sprint 2 | **TUX-58** | TUX-06 | US-03 | 3 | Should | Sugerencia inteligente de contactos (2do grado) |
| Sprint 2 | **TUX-57** | TUX-07 | US-09 | 3 | Should | Conexiones y seguidores en común |
| Sprint 3 | TUX-59 | TUX-08 | US-07 | 5 | Must | Mensajería instantánea 1 a 1 (WebSockets) |
| Sprint 3 | TUX-60 | TUX-09 | US-08 | 5 | Should | Notificaciones Web Push (VAPID) |
| Sprint 3 | TUX-61 | TUX-10 | US-10 | 3 | Could | Camino más corto (Shortest Path 6 grados) |
| Sprint 3 | TUX-62 | TUX-11 | US-11 | 3 | Could | Tendencias y viralidad en red extendida |
| Sprint 3 | TUX-64 | — | US-12 | 5 | Should | Perfil de usuario ajeno: posts, seguidores y distancia |

> US-12 no tiene card en `docs/backlog-programadores.md`: nació de
> `docs/propuesta-us-12-perfil-ajeno.md`, que proponía `TUX-63` y avisaba de que había que verificar
> la numeración en Linear. La tarjeta real resultó ser `TUX-64`.

> `TUX-57` y `TUX-58` estaban intercambiados en este roadmap hasta el 2026-09-26. Verificado contra Linear:
> `TUX-58` es *"US-03: Smart contact suggestions (2nd degree)"* y `TUX-57` es *"US-09: Followers and mutual
> connections between two profiles"*. La numeración de Linear **no** sigue el orden de las US: US-03 es
> `TUX-58` y US-09 es `TUX-57`. No deducir el ticket a partir del número de historia.

---

## Decisiones cerradas — NO reabrir

| Tema | Decisión |
|---|---|
| Grafo vs Relacional | Grafo (Neo4j) por *index-free adjacency*. Evita consultas recursivas lentas. |
| Multimedia | S3 / MinIO para mantener el grafo ligero. |
| Chat | WebSockets sobre polling HTTP por menor sobrecarga. |
| Alertas | Web Push sobre long polling para soporte background. |
| Despliegue | Docker Compose para asegurar reproducibilidad. |
| Repositorio | GitFlow Lite con la rama por defecto `develop`. |
| Autenticación | JWT Stateless. |
| Camino más corto (US-10) | La consulta es **dirigida**: `-[:SIGUE*..6]->`. Mantener la consulta obligatoria del ticket. Hacerla bidireccional es decisión de producto, no técnica. |
| Ventana de tendencias (US-11) | Comparar `fechaCreacion` contra su equivalente numérico. **No** migrar el campo a fecha con hora desde dentro de la historia. |

---

## Hechos verificados del código

Comprobados en `backend/src/main/java/ec/edu/upse/redsocial/`:
- **4 nodos del dominio:** `Usuario`, `Post`, `MensajeChat`, `SugerenciaUsuario`.
- **3 puertos de salida:** `GrafoPersistencePort`, `NotificationPushPort`, `StorageMultimediaPort`.
- **3 clases de caso de uso (ports in):** `ObtenerFeedUseCase`, `CrearPostUseCase`, `GestionarGrafoSocialUseCase`.
- **3 Resources REST:** `FeedResource`, `PostResource`, `UserGraphResource`.
- **El ChatWebSocket:** Actúa como adaptador in en `infrastructure/adapter/in/websocket/ChatWebSocket`.
- **4 adaptadores out/in:** `Neo4jGrafoAdapter`, `MinioS3StorageAdapter`, `WebPushNotificationAdapter`, y el `ChatWebSocket`.
- **Cadena hexagonal completa** en las 5 consultas de grafo (`obtenerSugerencias`, `obtenerFeedCronologico`,
  `obtenerReaccionesDePost`, `obtenerSeguidoresEnComun`, `obtenerCaminoMasCorto`,
  `obtenerTendenciasRedExtendida`): caso de uso, servicio, puerto, adaptador y recurso.
- **`Post.fechaCreacion` tiene tres consumidores con tres supuestos distintos:** se escribe como entero
  (`datetime().epochMillis`), se ordena asumiendo número, se lee como texto y se compara como fecha con
  hora. Dos de los tres están equivocados.

---

## Defectos abiertos

| Defecto | Dónde | Estado / Solución Planificada |
|---|---|---|
| Drift en fuente de verdad canónica | `openspec/specs/spec.md` | Corregir relaciones inventadas y aclarar el alcance de tests y de JWT |
| Autenticación no existe | `backend/src` | Falsa declaración de bcrypt/JWT en la spec; por implementar en US-01 |
| `fechaCreacion` con tres tipos asumidos | `Neo4jGrafoAdapter` | US-04 escribe, US-05 lee, US-11 compara. Decidir la representación **antes de US-04**. |
| Adaptador de push no envía nada | `WebPushNotificationAdapter:36` | El bucle solo registra. `US-08` está documentada, sin aplicar. |
| Suscripción push nunca se persiste | `Neo4jGrafoAdapter` | `setPushSubscriptionJson` no se llama. Filtra siempre a lista vacía. |
| Sin endpoint de registro de push | backend | Falta el eslabón frontend-datos. `US-08`. |
| `registerWebPush` nunca se invoca | `frontend/src/features/notifications` | Nunca pide permiso; el error se traga. `US-08`. |
| Push síncrono dentro de `crearPost` | `PostApplicationService:26` | Con envío real: publication persistida y error devuelto al cliente. `US-08`. |
| `obtenerFeedCronologico` lee un entero como texto | `Neo4jGrafoAdapter` | `.asString()` sobre epoch. Rompe el feed con datos. `US-05`. |
| Tendencias no devuelven nada | `Neo4jGrafoAdapter:158` | Entero comparado con fecha con hora. `US-11`. |
| Conteo de tendencias multiplica por caminos | `Neo4jGrafoAdapter:155` | `count(reactor)` cuenta filas, no reaccores. `US-11`. |
| `asList(v -> v.asString())` sin protección | `Neo4jGrafoAdapter` | Nodo sin nombre rompe la consulta. `US-09`, `US-10`. |
| `nombre` sin guarda de null | `Neo4jGrafoAdapter` | `obtenerSugerenciasUsuarios` y `obtenerSeguidos` devolvían el texto literal `"null"`: en el driver 5.24.0 `NullValue.asString()` no lanza. **Corregido en US-12**; la copia de US-09 en `obtenerSeguidosEnComun` ya lo tenía. |
| Serialización de `Usuario` de dominio | `UserGraphResource` | `/follows` y `/comunes` devolvían el modelo crudo, con `password` y `pushSubscriptionJson`. **Corregido en US-12** con `UsuarioPublicoResponse`. |
| `currentUserId` fijo en código | `frontend/src/App.tsx:13` | `'carlos-patino'`. `US-01`. |
| `emisorId` vacío en el chat | `frontend/src/features/chat/services/chatSocket.ts:36` | **Corregido en US-07**: el cliente ya no lo envía y el servidor toma la identidad de la ruta de conexión, que es la única fuente fiable. |
| Canal de chat sin autenticar | `backend/.../in/websocket/ChatWebSocket.java` | `US-07` abre `/chat/{userId}` creyendo el identificador de la ruta: cualquiera que lo adivine entra como ese usuario, lee su historial y le escribe. Es deuda de seguridad asumida de forma explícita, no un descuido: el ticket de US-07 la dejaba fuera y cerrar el canal exige un token de sesión para WebSocket que hoy no existe. |
| Sin restricción de unicidad en reacciones | backend | Permite reaccionar dos veces; rompe el conteo de `US-11`. `US-06`. |
| No se expone la clave pública VAPID | backend | `registerWebPush(vapidPublicKey)` nunca recibe valor. `US-08`. |
| Llaves VAPID de ejemplo | arranque | No son claves válidas. `US-08`. |

---

## Deuda con dueño asignado

| Tarea de Deuda | Dueño asignado |
|---|---|
| Agregar configuración y script para el Linter (ESLint) en frontend | Angel Villon / Paulo Orrala |
| Migrar propuestas obsoletas (`proposals/`) al formato correcto | opencode (bot) |
| Decidir la representación definitiva de `Post.fechaCreacion` y migrar datos existentes | Equipo de Arquitectura |
| Limpiar reacciones duplicadas que ya existan en la base | Angel Villon / Paulo Orrala |
