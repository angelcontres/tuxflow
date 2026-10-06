# Proposal: US-07 (TUX-59) — Chat instantáneo 1 a 1 por WebSockets

> **Ticket Linear**: `TUX-59` · **Card backlog**: `TUX-08` · **Dominio**: `chat-messaging`
> **Prioridad**: P0 (Must Have) · **RICE**: 40.0 · **Estimación**: 5 Story Points · **Sprint**: 3
> **Rama Git**: `feature/US-07-chat-websocket`

## Intent

Como usuario conectado, quiero enviar y recibir mensajes instantáneos en privado con otro contacto a
través de un canal WebSocket dúplex, sin sobrecarga de HTTP polling, y con visibilidad honesta de si
la conexión está viva y si el mensaje llegó.

## El estado real del código

Esta historia está **más implementada de lo que el ticket sugiere**, y a la vez tiene **más huecos de
lo que aparenta**. Conviene separar las dos cosas antes de decidir alcance.

### Ya implementado y correcto

- `quarkus-websockets` está declarado en `backend/pom.xml`. El canal WebSocket existe.
- `ChatWebSocket` usa `@ServerEndpoint("/chat/{userId}")` y `ConcurrentHashMap<String, Session>`, tal
  como pide el ticket. Es exactamente el diseño que la tarea 1 del ticket describe.
- El despacho al destinatario existe y verifica `isOpen()` antes de enviar.
- `chatSocket.ts` construye la URL correcta y detecta `wss:` frente a `ws:` según el protocolo de la
  página, lo que permite operar detrás de TLS sin tocar el servicio.
- `ChatWidget` ya dibuja la lista de mensajes, distingue burbuja propia de ajena y hace auto-scroll.
- `ChatWidget` está montado en `App.tsx`, no es un componente muerto.

### Huecos que el ticket exige y el código no cumple

- **Falta la reconexión automática.** La tarea 2 del ticket la pide de forma explícita. El manejador
  `onclose` actual solo escribe un mensaje en consola. Si la red se cae, el chat queda muerto para
  siempre sin que nada lo intente de nuevo.
- **El indicador de estado verde/rojo es decorativo.** La tarea 2 pide un indicador que refleje la
  conexión. El distintivo que hay en la cabecera está codificado en verde con animación permanente: se
  ve verde siempre, incluso con el socket cerrado o conectando. Es peor que no tenerlo, porque afirma
  algo falso.

### Huecos que la especificación canónica exige y el código no cumple

- **Los mensajes no se persisten.** `MensajeChat` existe únicamente como objeto de transporte. Se
  deserializa del JSON y se reenvía, y ahí muere. No hay nodo, ni relación, ni consulta, ni método de
  repositorio. `openspec/specs/spec.md` declara `MensajeChat` como uno de los nodos principales del
  grafo, así que el modelo canónico y el código están en desacuerdo.
- **La entrega no se acusa.** El emisor agrega el mensaje a su lista de forma optimista y el servidor
  nunca le devuelve nada. Si el destinatario está desconectado, el backend escribe una línea en el log
  y el emisor no se entera: el mensaje se pierde mostrando una burbuja como si se hubiera entregado.

## Alcance

1. Persistir cada mensaje en el grafo como nodo `MensajeChat`, con relaciones navegables hacia emisor y
   destinatario, y exponer un endpoint HTTP de historial de conversación.
2. Validar en el backend los mensajes entrantes, acusar el resultado del envío al emisor y cerrar la
   sesión cuando `@OnError` se dispara.
3. Corregir el registro de sesiones, que hoy desregistra una pestaña cuando se cierra otra del mismo
   usuario.
4. Añadir reconexión automática con espera creciente al servicio del frontend, y exponer el estado real
   de la conexión.
5. Convertir el widget en un componente flotante con indicador de estado real, y marcar visualmente
   los mensajes que no pudieron entregarse.
6. Cubrir el cambio con pruebas de las cuatro piezas nuevas: el Cypher, el servicio de aplicación, el
   registro de sesiones y el comportamiento de reconexión en el cliente.

## Fuera de alcance

- **Autenticación.** `currentUserId` sigue siendo un valor fijo en `App.tsx`. Este cambio lo consume
  como entrada y no inventa un mecanismo de sesión. La autenticación pertenece a `user-identity` y ya
  está declarada como futura. Consecuencia asumida y registrada como deuda: el canal acepta que
  cualquiera se anuncie como cualquier `userId`, igual que ya lo hacía antes de este change.
- **Migrar a `quarkus-websockets-next`.** El proyecto usa la extensión JSR-356 `quarkus-websockets` y
  el ticket pide `@ServerEndpoint`. Cambiar de extensión es una historia propia, con su propio
  análisis de espacio de nombres y de ciclo de vida de sesión.
- **Grupos, adjuntos e indicador de escritura.** El canal es 1 a 1 y de texto plano, como dice el
  ticket. Los adjuntos viajan por el camino de MinIO que ya existe para las publicaciones.
- **Un índice o restricción de unicidad para `:MensajeChat.id`.** El identificador lo genera el
  servidor con `randomUUID()`, así que la colisión no es un riesgo realista. El dataset semilla es
  compartido con otras historias y no se toca.

## Riesgos

- **La reconexión puede amplificar la carga.** Sin espera creciente, un backend caído produce un
  bucle de reconexión desde cada pestaña abierta. La espera creciente no es opcional aquí.
- **El historial cambia la naturaleza del endpoint.** Una conversación 1 a 1 no tiene clave única en un
  grafo: la consulta debe tratar la pareja como conjunto simétrico. Si se escribe en un solo sentido, el
  historial sale vacío para uno de los dos participantes.
- **El registro de sesiones es un defecto latente, no un defecto visible.** `Map<String, Session>` con
  `remove(userId)` sin condición desregistra la primera pestaña cuando se cierra la segunda. Pasa
  desapercibido en las pruebas de dos identidades distintas, que es como se prueba el canal hoy. La
  corrección cambia la estructura del registro, no solo su contenido.
- **Tocar `App.tsx` sí ocurre, y rompe una restricción que este change se había puesto.** La
  montura pasa del `<aside>` a un launcher flotante. El riesgo original era desplazar el layout que
  US-09, US-10 y US-12 ya documentan; con el widget flotante ese layout deja de cambiar, y el
  componente conserva su contrato de recibir `currentUserId` por propiedad.
- **El alcance excede la estimación del ticket.** El ticket estima 5 Story Points y describe solo dos
  tareas. Lo que la especificación canónica exige —persistencia, acuses, validación, historial— no cabe
  en esa estimación. La historia se entrega con este alcance y la diferencia queda anotada, no oculta.

## Delta de especificación

Todos los requisitos son `ADDED` sobre la capability `chat-messaging`, salvo la precisión del nodo
`MensajeChat`, que ya está declarado en la especificación canónica y aquí se concreta.
