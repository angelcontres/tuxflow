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
2. Validar en el backend los mensajes entrantes y cerrar la sesión cuando `@OnError` se dispara.
3. Añadir reconexión automática con espera creciente al servicio del frontend, y exponer el estado real
   de la conexión.
4. Convertir el distintivo de la cabecera en un indicador verde/rojo que refleje el estado real, y
   marcar visualmente los mensajes que no pudieron entregarse.

## Fuera de alcance

- **Autenticación.** `currentUserId` sigue siendo un valor fijo en `App.tsx`. Este cambio lo consume
  como entrada y no inventa un mecanismo de sesión. La autenticación pertenece a `user-identity` y ya
  está declarada como futura.
- **Grupos, adjuntos y confirmaciones de entrega sobre el socket.** El canal es 1 a 1 y de texto plano, como dice el
  ticket. Los adjuntos viajan por el camino de MinIO que ya existe para las publicaciones.
- **Indicador de "escribiendo".** Es una mejora de experiencia, no un requisito del ticket.

## Riesgos

- **La reconexión puede amplificar la carga.** Sin espera creciente, un backend caído produce un
  bucle de reconexión desde cada pestaña abierta. La espera creciente no es opcional aquí.
- **El historial cambia la naturaleza del endpoint.** Una conversación 1 a 1 no tiene clave única en un
  grafo: la consulta debe tratar la pareja como conjunto simétrico. Si se escribe en un solo sentido, el
  historial sale vacío para uno de los dos participantes.
- **Tocar `App.tsx` afecta a las historias ya documentadas.** La montura del widget no se modifica; el
  componente recibe `currentUserId` como propiedad y sigue igual.

## Delta de especificación

Todos los requisitos son `ADDED` sobre la capability `chat-messaging`, salvo la precisión del nodo
`MensajeChat`, que ya está declarado en la especificación canónica y aquí se concreta.
