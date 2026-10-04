# Tasks: US-08 (TUX-60) — Notificación Web Push asíncrona ante publicaciones

> **Dominio**: `web-push-notifications` · **Estrategia de entrega**: `single-pr` · **Límite de revisión**: 800 líneas

**Archivos a modificar**: `WebPushNotificationAdapter.java`, `PostApplicationService.java`,
`Neo4jGrafoAdapter.java`, el puerto de salida del grafo, un recurso REST nuevo de notificaciones y
`sw.js` en el frontend, y un servicio nuevo junto a `pushService.ts`.

## Review Workload Forecast

| Métrica | Valor |
|---|---|
| Unidades de trabajo | 4 |
| Líneas estimadas de cambio | 200–290 |
| Riesgo de presupuesto de 400 líneas | **Bajo** |
| Presión de revisión | Media: el asincronismo y la poda cambian el comportamiento observable |
| Decisión previa a aplicar | No |

## Unidad 1 — Envío real en un borde asíncrono

- [ ] Importar la librería de web push en `WebPushNotificationAdapter`
- [ ] Construir el remitente con las llaves VAPID inyectadas y el sujeto configurado
- [ ] Enviar el payload cifrado real a cada suscripción, en lugar de solo registrar el intento
- [ ] Incluir en el payload el autor, el texto de la publicación y la referencia de la publicación
- [ ] Ejecutar el envío fuera del hilo de la petición, con asincronía declarativa
- [ ] Absorber toda excepción dentro del borde asíncrono, sin propagarla al controlador
- [ ] Registrar el fallo con la suscripción afectada, sin exponer contenido de la publicación
- [ ] Mantener la creación de la publicación independiente del resultado de la notificación
- [ ] Distinguir en el registro entre suscripción inválida y fallo transitorio
- [ ] Eliminar la suscripción del nodo cuando el servicio la reporte como inválida
- [ ] Conservar la suscripción ante un fallo transitorio de red
- [ ] Ejecutar `cd backend && mvn compile`

## Unidad 2 — Endpoint de suscripción y clave pública

- [x] Añadir al puerto de salida del grafo el método que guarda la suscripción de un usuario
- [x] Implementar en `Neo4jGrafoAdapter` el guardado de la suscripción en el nodo del usuario
- [x] Hacer que el guardado sea idempotente, para no duplicar la misma suscripción
- [ ] Añadir al puerto el método que elimina una suscripción concreta de un usuario
- [x] Implementar la eliminación selectiva de una sola suscripción
- [ ] Crear el recurso REST que recibe la suscripción y la persiste
- [x] Validar en el recurso que la suscripción trae endpoint y claves obligatorios
- [ ] Devolver la clave pública VAPID en un endpoint de solo lectura
- [ ] Verificar que el endpoint de la clave nunca expone la clave privada
- [ ] Eliminar los valores de ejemplo de las llaves VAPID de la configuración
- [ ] Documentar en el arranque que faltan las llaves VAPID cuando no están definidas
- [ ] Ejecutar `cd backend && mvn compile`

## Unidad 3 — Permiso explícito y registro en el frontend

- [x] Solicitar el permiso de notificación antes de intentar la suscripción
- [ ] Distinguir en el retorno los estados concedido, denegado y sin responder
- [ ] Devolver un motivo legible en cada estado, en lugar de tragar el error
- [ ] Dejar de capturar en silencio los fallos de suscripción
- [ ] Devolver vacío de forma explícita cuando el navegador no soporta Web Push
- [x] Solicitar la clave pública VAPID al backend al iniciar el registro
- [x] Enviar la suscripción obtenida al endpoint de registro
- [ ] Tratar la suscripción ya existente como un resultado válido, sin volver a pedirla
- [ ] No seccionar de nuevo si la suscripción existente sigue activa
- [ ] Mostrar en la interfaz el estado del permiso, para que el rechazo no quede invisible
- [ ] Explicar al usuario que el permiso denegado solo se cambia en los ajustes del navegador
- [ ] Ejecutar `cd frontend && pnpm run build`

## Unidad 4 — Service worker con enlace a la publicación

- [ ] Añadir al manejador de clic la búsqueda de ventanas ya abiertas de la aplicación
- [ ] Enfocar la ventana existente cuando haya una, en lugar de abrir siempre una nueva
- [ ] Abrir la ruta de la publicación notificada cuando no haya ninguna ventana abierta
- [ ] Leer del payload la referencia de la publicación para construir esa ruta
- [ ] Mantener los valores por defecto cuando el payload no trae título ni cuerpo
- [ ] Conservar el cierre de la notificación antes de abrir o enfocar
- [ ] Ejecutar `cd frontend && pnpm run build`
- [ ] Comprobar que el archivo del service worker en la carpeta de compilación coincide con el fuente
- [ ] Probar con la pestaña cerrada que la notificación del sistema aparece
- [ ] Comprobar que el clic enfoca la pestaña abierta en lugar de duplicarla
- [ ] Comprobar que un fallo de notificación no altera la respuesta de creación de la publicación

## Fuera de alcance

- Notificaciones por email o dentro de la aplicación
- Preferencias de notificación por usuario
- Cualquier modificación del grafo, de las reacciones o del feed
