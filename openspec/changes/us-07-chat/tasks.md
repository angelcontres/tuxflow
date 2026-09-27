# Tasks: US-07 (TUX-59) — Chat instantáneo 1 a 1 por WebSockets

> **Dominio**: `chat-messaging` · **Estrategia de entrega**: `single-pr` · **Límite de revisión**: 800 líneas

**Archivos a modificar**: `ChatWebSocket.java`, `Neo4jGrafoAdapter.java`, el puerto de salida del
grafo, `chatSocket.ts`, `ChatWidget.tsx`, `chat.types.ts` y un endpoint REST nuevo de historial.

## Review Workload Forecast

| Métrica | Valor |
|---|---|
| Unidades de trabajo | 4 |
| Líneas estimadas de cambio | 190–280 |
| Riesgo de presupuesto de 400 líneas | **Bajo** |
| Prendas de revisión | Media: el estado de conexión es compartido por el servicio y el componente |
| Decisión previa a aplicar | No |

## Unidad 1 — Persistencia del mensaje en el grafo

- [ ] Añadir al puerto de salida del grafo el método para guardar un mensaje con emisor, destinatario,
      contenido y marca de tiempo
- [ ] Implementar en `Neo4jGrafoAdapter` el `CREATE` del nodo `MensajeChat` con sus dos relaciones
- [ ] Reutilizar el `MERGE` de usuario existente en lugar de crear usuarios implícitos al guardar
- [ ] Propagar la marca de tiempo del servidor al nodo, sin depender del reloj del cliente
- [ ] Añadir al puerto el método que devuelve los mensajes de una pareja en ambos sentidos
- [ ] Implementar la consulta simétrica, tratando la pareja como conjunto y no como par ordenado
- [ ] Ordenar el resultado por marca de tiempo ascendente en la propia consulta
- [ ] Crear el recurso REST que expone el historial de la conversación
- [ ] Validar en el recurso que los dos participantes estén presentes y sean distintos
- [ ] Devolver lista vacía con 200 cuando la pareja no tenga mensajes
- [ ] Aislar las consultas nuevas en su propia sección del adapter, siguiendo la convención del archivo

## Unidad 2 — Validación y cierre de sesión en el canal

- [ ] Rechazar en `ChatWebSocket` los mensajes con `destinatarioId` ausente
- [ ] Rechazar los mensajes con `destinatarioId` igual al emisor de la ruta
- [ ] Rechazar los mensajes con `contenido` vacío o compuesto solo de espacios
- [ ] Responder al emisor con el motivo del rechazo en cada caso
- [ ] Persistir el mensaje antes de intentar el despacho, para que el destinatario ausente no lo pierda
- [ ] Cerrar la sesión en el manejador de error, además de retirarla del registro
- [ ] Enviar al emisor el acuse con estado de entregado cuando el despacho funciona
- [ ] Enviar al emisor el acuse con estado de no entregado cuando el destinatario está ausente
- [ ] Incluir en el acuse la marca de tiempo del servidor
- [ ] Mantener el registro en el log de los tres resultados: entregado, no entregado y rechazado

## Unidad 3 — Reconexión y estado real en el servicio

- [ ] Añadir al tipo `ChatMessage` el estado de entrega y el identificador de mensaje
- [ ] Exponer en `chatSocket` un manejador de cambio de estado de conexión
- [ ] Notificar el estado conectado desde el manejador de apertura
- [ ] Notificar el estado desconectado desde el manejador de cierre
- [ ] Notificar el error de conexión desde el manejador de error
- [ ] Implementar el reintento con espera creciente y tope máximo
- [ ] Registrar el número de intento en el estado, para poder observar la insistencia
- [ ] Distinguir el cierre intencionado del fallo, para no reintentar en el primer caso
- [ ] Cancelar el temporizador de reintento pendiente al desconectar de forma intencionada
- [ ] Exponer la cancelación de reintentos para el desmontaje del componente
- [ ] Dejar de enviar el `emisorId` vacío en el cuerpo, que hoy miente sobre el remitente
- [ ] Registrar el remitente real en el mensaje saliente

## Unidad 4 — Indicador honesto e historial en el widget

- [ ] Cargar el historial de la conversación al montar el widget
- [ ] PoblAR la lista de mensajes con el historial, antes de la conexión en vivo
- [ ] Mantener el orden cronológico al combinar historial y mensajes nuevos
- [ ] Sustituir el distintivo fijo de la cabecera por el indicador de estado real
- [ ] Mostrar estado conectado, conectando y desconectado con colores distintos
- [ ] Retirar la animación permanente del estado conectado
- [ ] Marcar visualmente los mensajes con estado de no entregado
- [ ] Mostrar el motivo cuando el servidor rechaza un envío
- [ ] Cancelar los reintentos pendientes en el desmontaje del componente
- [ ] Limpiar los mensajes de la conversación al cambiar de destinatario
- [ ] Verificar que el widget siga recibiendo `currentUserId` como propiedad y no lea identidad por su
      cuenta
- [ ] Ejecutar `cd backend && mvn compile`
- [ ] Ejecutar `cd frontend && pnpm run build`
- [ ] Probar con dos pestañas y dos identidades usando la consola del navegador, según el ticket
- [ ] Anotar en `openspec/specs/spec.md` la nueva relación de mensajes cuando este change se archive

## Fuera de alcance

- Autenticación y sesión: `currentUserId` sigue siendo entrada, no un mecanismo de sesión
- Grupos, adjuntos e indicador de escritura
- Cualquier modificación de la montura del widget en `App.tsx`
