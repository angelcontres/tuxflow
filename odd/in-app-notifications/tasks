# Tasks: Centro de Notificaciones In-App en Tiempo Real

> **Dominio**: `in-app-notifications` · **Estrategia de entrega**: `single-pr` · **Límite de revisión**: 800 líneas

**Archivos a modificar**: Backend (`Neo4jGrafoAdapter.java`, `NotificationResource.java`, `NotificationInAppService.java`), Frontend (`Navbar.tsx`, `NotificationBadge.tsx`, `NotificationDropdown.tsx`, `notificationApi.ts`).

## Review Workload Forecast

| Métrica | Valor |
|---|---|
| Unidades de trabajo | 4 |
| Líneas estimadas de cambio | 300–400 |
| Riesgo de presupuesto de 400 líneas | **Medio** |
| Presión de revisión | Alta: introduce SSE (Server-Sent Events) y persistencia de notificaciones |
| Decisión previa a aplicar | SSE en lugar de WebSocket puro para simpleza unidireccional |

## Unidad 1 — Dominio y Persistencia (Backend)

- [x] Crear el modelo de dominio `NotificacionInApp` (id, tipo, mensaje, leido, fecha, actor, url).
- [x] Implementar `guardarNotificacion` en `Neo4jGrafoAdapter` (`CREATE (n:Notificacion)-[:PERTENECE_A]->(u:Usuario)`).
- [x] Implementar `obtenerNotificaciones(userId)` ordenadas por fecha en `Neo4jGrafoAdapter`.
- [x] Implementar `obtenerConteoNoLeidas(userId)` en `Neo4jGrafoAdapter`.
- [x] Implementar `marcarComoLeida(notificacionId)` en `Neo4jGrafoAdapter`.

## Unidad 2 — SSE y Endpoints REST (Backend)

- [x] Crear el endpoint GET `/api/in-app-notifications` para listar el historial.
- [x] Crear el endpoint GET `/api/in-app-notifications/unread-count` para el badge inicial.
- [x] Crear el endpoint PUT `/api/in-app-notifications/{id}/read` para marcar leídas.
- [x] Crear el endpoint GET `/api/in-app-notifications/stream` (SSE, `text/event-stream`) que mantenga a los clientes conectados.
- [x] Modificar el flujo de publicación para que guarde la notificación in-app y la emita a los clientes SSE conectados.

## Unidad 3 — Componentes UI (Frontend)

- [x] Crear los tipos `InAppNotification` en el frontend.
- [x] Crear el servicio `notificationApi.ts` para consumir los endpoints REST.
- [x] Crear el componente `NotificationDropdown` (Lista de notificaciones).
- [x] Integrar un icono de Mundo / Campana con Badge en el `Navbar.tsx`.

## Unidad 4 — Conexión en Tiempo Real SSE (Frontend)

- [x] Crear un hook o efecto que se conecte a `/api/in-app-notifications/stream` usando `EventSource` cuando el usuario esté logueado.
- [x] Al recibir un evento SSE, incrementar el contador del badge automáticamente.
- [x] Mostrar un Toast temporal in-app (opcional, como en el demo distribuida) cuando llega la notificación.
- [x] Al abrir el dropdown, cargar la lista desde el backend y resetear el contador.
- [x] Al hacer clic en una notificación, navegar a la ruta y llamar al endpoint de marcar leída.
