# Tasks: US-07 (TUX-59) — Chat instantáneo 1 a 1 por WebSockets

> **Dominio**: `chat-messaging` · **Estrategia de entrega**: `single-pr` · **Límite de revisión**: 800 líneas

**Archivos a modificar**: `MensajeChat.java`, `GrafoPersistencePort.java`, `Neo4jGrafoAdapter.java`,
`ChatWebSocket.java`, `App.tsx`, `chatSocket.ts`, `ChatWidget.tsx` y `chat.types.ts`.

**Archivos a crear**: `ResultadoEnvio.java`, `GestionarChatUseCase.java`, `CanalChatPort.java`,
`ChatApplicationService.java`, `SesionesChatAdapter.java`, `ChatResource.java`, `MensajeChatResponse.java`,
`chatApi.ts`, más las pruebas de la Unidad 5.

## Review Workload Forecast

| Métrica | Valor |
|---|---|
| Unidades de trabajo | 6 |
| Líneas estimadas de cambio | 620–780 |
| Riesgo de presupuesto de 800 líneas | **Alto**: el change es mayor que los 5 puntos del ticket |
| Prendas de revisión | Alta: toca los cuatro anillos, un endpoint WebSocket y un recurso REST |
| Decisión previa a aplicar | Sí: alcance, montaje flotante y fase de tests acordados antes de escribir código |

## Unidad 1 — Puertos y servicio de aplicación

- [x] Añadir `id` a `MensajeChat`, que el servidor genera y el cliente usa como clave de burbuja
- [x] Crear `ResultadoEnvio` con los estados `ENTREGADO`, `NO_ENTREGADO` y `RECHAZADO`, más el motivo
- [x] Documentar por qué el estado de entrega **no** vive en `MensajeChat`: es efímero y no se persiste
- [x] Crear el puerto de entrada `GestionarChatUseCase` con `enviar` y `historial`
- [x] Crear el puerto de salida `CanalChatPort` con `estaConectado` y `enviar`
- [x] Implementar `ChatApplicationService` sin ninguna referencia a `jakarta.websocket`
- [x] Validar destinatario ausente o en blanco antes de tocar el grafo
- [x] Validar destinatario igual al emisor antes de tocar el grafo
- [x] Validar contenido vacío o solo espacios antes de tocar el grafo
- [x] Persistir el mensaje antes de intentar el despacho, para que el destinatario ausente no lo pierda
- [x] Devolver `NO_ENTREGADO` cuando el destinatario no tiene sesión abierta
- [x] Devolver `ENTREGADO` solo cuando el despacho al canal tiene éxito

## Unidad 2 — Persistencia del mensaje en el grafo

- [x] Añadir al puerto de salida del grafo el método para guardar un mensaje con emisor, destinatario,
      contenido y marca de tiempo
- [x] Implementar en `Neo4jGrafoAdapter` el `CREATE` del nodo `MensajeChat` con sus dos relaciones
- [x] Reutilizar el `MATCH` de usuario existente en lugar de crear usuarios implícitos al guardar
- [x] Reportar como usuario ausente cuando el `MATCH` no devuelva filas, en vez de guardar en silencio
- [x] Propagar la marca de tiempo del servidor al nodo, sin depender del reloj del cliente
- [x] Añadir al puerto el método que devuelve los mensajes de una pareja en ambos sentidos
- [x] Implementar la consulta simétrica, tratando la pareja como conjunto y no como par ordenado
- [x] Ordenar el resultado por marca de tiempo ascendente en la propia consulta
- [x] Aislar las consultas nuevas en su propia sección del adapter, siguiendo la convención del archivo

## Unidad 3 — Historial por HTTP

- [x] Crear el recurso REST que expone el historial de la conversación
- [x] Inyectar el puerto de entrada, nunca el puerto de salida del grafo, como hacen los demás recursos
- [x] Validar en el recurso que los dos participantes estén presentes y sean distintos
- [x] Devolver lista vacía con 200 cuando la pareja no tenga mensajes
- [x] Mapear a un DTO, siguiendo la convención de `UsuarioResponse`, sin exponer el modelo de dominio

## Unidad 4 — Registro de sesiones, validación y acuses en el canal

- [x] Extraer el registro de sesiones a un adaptador `@ApplicationScoped` implementando `CanalChatPort`
- [x] Registrar cada sesión en un conjunto por usuario, en lugar de una sola sesión por usuario
- [x] Retirar del conjunto la sesión que se cierra, y no el usuario entero
- [x] Eliminar la clave del usuario solo cuando su conjunto de sesiones queda vacío
- [x] Inyectar el caso de uso en el endpoint con `@Inject`
- [x] Rechazar en `ChatWebSocket` los mensajes con `destinatarioId` ausente, reenviando el motivo
- [x] Rechazar los mensajes con `destinatarioId` igual al emisor de la ruta
- [x] Rechazar los mensajes con `contenido` vacío o compuesto solo de espacios
- [x] Descartar siempre el `emisorId` del cuerpo y usar el de la ruta
- [x] Cerrar la sesión en el manejador de error, además de retirarla del registro
- [x] Enviar al emisor el acuse con estado de entregado cuando el despacho funciona
- [x] Enviar al emisor el acuse con estado de no entregado cuando el destinatario está ausente
- [x] Enviar al emisor el acuse con estado de rechazado y el motivo del rechazo
- [x] Incluir en el acuse la marca de tiempo del servidor y el identificador del mensaje
- [x] Mantener el registro en el log de los tres resultados: entregado, no entregado y rechazado

## Unidad 5 — Reconexión, estado real, historial y widget flotante

- [x] Añadir al tipo `ChatMessage` el estado de entrega, el motivo y el identificador de mensaje
- [x] Exponer en `chatSocket` un manejador de cambio de estado de conexión
- [x] Notificar el estado conectado desde el manejador de apertura
- [x] Notificar el estado desconectado desde el manejador de cierre
- [x] Notificar el estado conectando desde el manejador de error
- [x] Implementar el reintento con espera creciente y tope máximo
- [x] Registrar el número de intento en el estado, para poder observar la insistencia
- [x] Distinguir el cierre intencionado del fallo, para no reintentar en el primer caso
- [x] Cancelar el temporizador de reintento pendiente al desconectar de forma intencionada
- [x] Exponer la cancelación de reintentos para el desmontaje del componente
- [x] Dejar de enviar el `emisorId` vacío en el cuerpo, que hoy miente sobre el remitente
- [x] Crear el servicio HTTP del historial usando el cliente compartido, que ya adjunta el token
- [x] Cargar el historial de la conversación al montar el widget
- [x] Poblar la lista de mensajes con el historial, antes de la conexión en vivo
- [x] Mantener el orden cronológico al combinar historial y mensajes nuevos
- [x] Convertir el widget en un componente flotante, con botón lanzador y panel expandible
- [x] Montar el widget flotante fuera de la barra lateral en `App.tsx`
- [x] Mantener el widget disponible sobre el perfil ajeno y sobre el feed por igual
- [x] Sustituir el distintivo fijo de la cabecera por el indicador de estado real
- [x] Mostrar estado conectado, conectando y desconectado con colores distintos
- [x] Retirar la animación permanente del estado conectado
- [x] Reconciliar la burbuja optimista con el acuse, en lugar de duplicar el mensaje
- [x] Marcar visualmente los mensajes con estado de no entregado
- [x] Mostrar el motivo cuando el servidor rechaza un envío
- [x] Cancelar los reintentos pendientes en el desmontaje del componente
- [x] Limpiar los mensajes de la conversación al cambiar de destinatario
- [x] Mantener `currentUserId` como propiedad del widget, sin leer identidad por su cuenta

## Unidad 6 — Pruebas y verificación

- [x] Probar que el Cypher de guardado enlaza emisor y destinatario y no crea usuarios implícitos
- [x] Probar que el Cypher de historial trata la pareja como conjunto y ordena de más antiguo a más nuevo
- [x] Probar que los tres rechazos devuelven el motivo y no persisten nada
- [x] Probar que el mensaje se persiste antes de intentar el despacho
- [x] Probar que el registro de sesiones conserva la primera pestaña al cerrar la segunda
- [x] Probar que la reconexión espera cada vez más entre intento e intento
- [x] Probar que un cierre intencionado no dispara ningún reintento
- [x] Probar que el desmontaje no deja reintentos pendientes
- [x] Probar que el indicador refleja el estado real del socket
- [x] Ejecutar `$MAVEN_HOME/bin/mvn verify`
- [x] Ejecutar `cd frontend && pnpm run check`
- [x] Probar con dos pestañas y dos identidades usando la consola del navegador, según el ticket
- [x] Anotar en `openspec/specs/spec.md` la nueva relación de mensajes cuando este change se archive

## Fuera de alcance

- Autenticación y sesión: `currentUserId` sigue siendo entrada, no un mecanismo de sesión. La deuda de
  seguridad que abre un canal sin autenticar se registra en el ROADMAP
- Grupos, adjuntos e indicador de escritura
- Migrar de la extensión `quarkus-websockets` (JSR-356) a `quarkus-websockets-next`
- Un índice o restricción de unicidad para `:MensajeChat.id` en el dataset semilla