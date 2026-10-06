# Tasks: US-12 (TUX-64) — Perfil de usuario ajeno

> **Dominio**: `social-graph` + `post-management` · **Estrategia de entrega**: `single-pr`
> **Límite de revisión**: 800 líneas

**Archivos a modificar**: `GrafoPersistencePort.java`, `GestionarGrafoSocialUseCase.java`,
`CrearPostUseCase.java`, `Neo4jGrafoAdapter.java`, `UserGraphApplicationService.java`,
`PostApplicationService.java`, `PostResource.java`, `UserGraphResource.java`,
`UsuarioPublicoResponse.java` (nuevo), `userApi.ts`, `ConexionesComunesPanel.tsx`,
`UserSuggestionsCard.tsx`, `PerfilAjeno.tsx` (nuevo), `App.tsx`.

## Review Workload Forecast

| Métrica | Valor |
|---|---|
| Unidades de trabajo | 6 |
| Líneas estimadas de cambio | 900–1100, de las cuales ~400 de pruebas |
| Riesgo de presupuesto de 400 líneas | **Alto** |
| Presión de revisión | Media |
| Decisión previa a aplicar | Sí: las tres de `proposal.md` |

Se pasa del presupuesto de 400 líneas y no se divide la entrega, por una razón concreta: las unidades
1 y 2 son las consultas sin las que el perfil no muestra nada, y las unidades 5 y 6 son la pantalla sin
las que las consultas no tienen consumidor. Dividirlas produce commits que compilan y no se pueden
probar. Las 400 líneas de código sin pruebas sí caben en la unidad de revisión que el repo ya usa; el
exceso es casi todo `PerfilAjeno.test.tsx` y `Neo4jGrafoAdapterPerfilAjenoIT.java`, que se leen
aislados.

## Fase 1 — Puertos y adaptadores de salida [back]

Sin esto no hay lectura. Desbloquea la fase 2.

- [ ] Declarar `obtenerPostsDeUsuario(String, String)` en `GrafoPersistencePort`
- [ ] Declarar `obtenerSeguidores(String)` en `GrafoPersistencePort`
- [ ] Implementar `obtenerSeguidores` con la flecha entrando por el perfil que se mira
- [ ] Implementar `obtenerPostsDeUsuario` con `WHERE p.fechaCreacion IS NOT NULL`
- [ ] Ordenar por `p.fechaCreacion DESC` como entero, sin comparar contra una fecha con hora
- [ ] Leer la fecha con `.asLong()`
- [ ] Contar reacciones con `count(DISTINCT reactor)`
- [ ] Dejar el visor en un `OPTIONAL MATCH` para que la consulta sirva con y sin visor
- [ ] Normalizar un visor en blanco a `null` antes de mandarlo al grafo
- [ ] Extraer `mapearUsuarioDeRelacion` y usarlo en `obtenerSeguidos` y `obtenerSeguidores`
- [ ] Extraer `mapearPostDeAutor`
- [ ] Aplicar la guarda de `nombre` nulo en `obtenerSugerenciasUsuarios`
- [ ] Ejecutar `cd backend && mvn compile`

## Fase 2 — Servicios y recursos REST [back]

Sin API no hay cliente. Desbloquea la fase 3.

- [ ] Declarar `obtenerPostsDeUsuario` en `CrearPostUseCase` y delegarlo en `PostApplicationService`
- [ ] Declarar `obtenerSeguidores` en `GestionarGrafoSocialUseCase` y delegarlo en el servicio
- [ ] Crear `UsuarioPublicoResponse` sin correo, contraseña ni suscripción push
- [ ] `GET /api/posts/autor/{userId}` con `viewerId` opcional y validación de identificador en blanco
- [ ] `GET /api/users/{userId}/followers` devolviendo `UsuarioPublicoResponse`
- [ ] Pasar `/follows` por `UsuarioPublicoResponse`
- [ ] Pasar `/comunes` por `UsuarioPublicoResponse`
- [ ] No tocar el `UsuarioResponse` de `GET /api/users/{userId}`
- [ ] Ejecutar `cd backend && mvn compile`

## Fase 3 — Pruebas de contrato del backend [back]

- [ ] `Neo4jGrafoAdapterPostsDeUsuarioTest`: orden, fecha entera, reacciones, visor ausente, cypher
- [ ] `Neo4jGrafoAdapterSeguidoresTest`: dirección de la flecha, guarda de nombre, avatar nulo
- [ ] `Neo4jGrafoAdapterNombreNullTest`: la guarda en las dos lecturas que la habían perdido
- [ ] `PostResourceTest`: 200 con lista, 200 vacío, 400 en blanco, el visor llega al caso de uso
- [ ] `UserGraphResourceTest`: seguidores, y que los tres endpoints no filtren contraseña ni correo
- [ ] `Neo4jGrafoAdapterPerfilAjenoIT`: las consultas contra un Neo4j real
- [ ] Recoger los `*IT` en Surefire, con el motivo en el POM
- [ ] Ejecutar `cd backend && mvn test`

## Fase 4 — Cliente HTTP y estado de navegación [front]

- [ ] `fetchPostsDeUsuario(userId, viewerId?)` sin reordenar ni tragar errores
- [ ] `fetchSeguidores(userId)`
- [ ] Estado `perfilAjenoId` en `App.tsx`, que se limpia al cerrar sesión
- [ ] `onOpenPerfil` y `onCerrarPerfil` como `useCallback`
- [ ] Ejecutar `cd frontend && pnpm run build`

## Fase 5 — Componentes de UI [front]

- [ ] `PerfilAjeno.tsx` con estado independiente por bloque
- [ ] Reiniciar los cuatro bloques cuando cambia el identificador
- [ ] Nombre con respaldo en el `@username` y avatar con respaldo en la inicial
- [ ] Botón Seguir / Dejar de seguir con estado inicial desde `fetchSeguidos`
- [ ] Ocultar el botón si la relación no se pudo comprobar
- [ ] Publicaciones en el orden recibido, sin reordenar
- [ ] Distinguir perfil sin publicaciones de fallo de carga
- [ ] Lista de seguidores con enlace al perfil de cada persona
- [ ] Distancia de separación con el visor y el perfil abierto
- [ ] Montar `ConexionesComunesPanel` con `otroUsuarioId` y sin campo de texto
- [ ] Hacer opcional `onOpenPerfil` en `UserSuggestionsCard` y rotular el enlace
- [ ] Envolver los `@username` de los seguidores y del autor como enlaces
- [ ] Ejecutar `cd frontend && pnpm run build`

## Fase 6 — Pruebas de interfaz e integración [both]

- [ ] `PerfilAjeno.test.tsx`: las cuatro consultas, avatar, publicaciones, seguidores, seguir,
      distancia, cambio de persona y montaje de US-09 sin campo
- [ ] `ConexionesComunesPanel.test.tsx`: los dos modos, la consulta automática y el rótulo
- [ ] `UserSuggestionsCard.test.tsx`: el enlace abre el perfil y no se confunde con seguir
- [ ] `App.test.tsx`: abrir el perfil, volver, el panel de US-09 y el cierre de sesión
- [ ] `pnpm test` y `pnpm run check` en verde
- [ ] `mvn verify` en verde

## Verificación manual

- [ ] `curl -X GET "http://localhost:8080/api/users/beatriz-silva"` responde el perfil
- [ ] `curl -X GET "http://localhost:8080/api/posts/autor/beatriz-silva"` responde las publicaciones,
      de la más nueva a la más antigua
- [ ] `curl -X GET "http://localhost:8080/api/users/beatriz-silva/followers"` responde con `carlos` y
      `angel` con la semilla del proyecto
- [ ] Ninguno de los tres devuelve `password`, `email` ni `pushSubscriptionJson`
- [ ] En el navegador, abrir el perfil desde el `@username` de una sugerencia
- [ ] Comprobar que carga avatar y publicaciones, y que el botón refleja la relación real
- [ ] Desde el perfil, abrir conexiones en común sin escribir el identificador
- [ ] Desde el perfil, calcular la distancia
- [ ] Seguir y dejar de seguir desde el perfil, y comprobar que la barra lateral se actualiza

## Fuera de alcance

- Migrar `Post.fechaCreacion` a fecha con hora
- Autenticación o control de acceso en `/followers` y `/comunes`
- Una URL compartible para el perfil
- Paginación de publicaciones o de seguidores
- Un perfil propio redesigned, que es lo que vive en el modal del Navbar