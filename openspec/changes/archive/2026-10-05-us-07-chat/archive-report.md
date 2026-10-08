# Archive Report: US-07 (TUX-59) — Chat instantáneo 1 a 1 por WebSockets

**Change**: `2026-10-05-us-07-chat`
**Archived**: 2026-10-05
**Status**: Complete

## Final State

El chat 1 a 1 en tiempo real está implementado de punta a punta sobre los cuatro anillos. El backend
expone `ChatWebSocket` en `/chat/{userId}` y un historial por HTTP en
`/api/chat/historial`; el frontend monta un widget flotante disponible sobre cualquier vista.

La identidad del emisor sale siempre de la ruta de conexión y el `emisorId` del cuerpo se descarta, así
que un cliente no puede escribir en nombre de otro. Cada mensaje se persiste como nodo `MensajeChat`
unido por `ENVIA` y `DIRIGIDO_A` antes de intentar el despacho, de modo que un destinatario ausente
también conserva el mensaje para el historial. El emisor siempre recibe el desenlace: entregado, no
entregado con motivo, o rechazado con el motivo del rechazo.

`ChatApplicationService` no importa `jakarta.websocket`: recibe el caso de uso, lo ejecuta y devuelve
un `ResultadoEnvio`. Eso permite probar toda la lógica sin levantar el contenedor, que es lo que
hacían los tests del servicio.

**Source Artifacts**:
- Proposal: `proposal.md`
- Design: `design.md`
- Tasks: `tasks.md`
- Spec: `specs/chat-messaging/spec.md`

## Key Completion Evidence

- `mvn -o verify`: BUILD SUCCESS, 203 pruebas, 0 fallos, 16 omitidas preexistentes.
- `pnpm run check`: 13 archivos y 210 pruebas en verde, y build de Vite correcto.
- `tools/chat-smoke.mjs`: dos sockets reales contra el backend en marcha; entrega, acuse, rechazo,
  multi-sesión e historial por HTTP, todo en verde.
- Navegador: dos pestañas del mismo usuario con el widget abierto, envío en ambos sentidos con un
  cliente real en el otro extremo, entrega a las dos pestañas al mismo tiempo e indicador "Conectado".

## Defectos Encontrados During Verification

Tres de ellos aparecieron al probar contra el sistema en marcha, no al leer el código, y por eso se
añadieron las pruebas que los fijan:

1. **El destinatario no veía nunca los mensajes que le enviaban.** El frame de entrega al destinatario
   se serializaba con la misma fábrica que el acuse, y esa fábrica ponía `estado: "ENTREGADO"`. Como la
   presencia de `estado` es lo que el cliente usa para distinguir un acuse de un mensaje nuevo, leía la
   entrega como un acuse, buscaba la burbuja a la que correspondía ese id, no hallaba ninguna porque el
   mensaje aún no se había dibujado, y lo descartaba. Ninguna capa daba error: el servidor escribía, el
   emisor recibía un acuse de entrega y solo faltaba el mensaje en el otro lado. Lo detectable por un
   usuario era que el chat no funcionaba, que es exactamente lo que no se puede dejar pasar. Corregido
   con dos fábricas en el DTO, una sin desenlace para el frame de entrega y otra con desenlace para el
   acuse, más `@JsonInclude(NON_NULL)` para que los nulos no dependan de la configuración global de
   Jackson. Fijado en `SesionesChatAdapterTest` y en `tools/chat-smoke.mjs`.

2. **Enviar a un destinatario inexistente cerraba el socket del emisor.** El error del grafo se
   propagaba al manejador de transporte, que cerraba la sesión. El destinatario inválido es un
   resultado del envío, no un fallo del canal: se traduce a `NO_ENTREGADO` con motivo y la conexión
   sigue viva. Fijado en `ChatApplicationServiceTest`.

3. **El widget guardaba un interlocutor obsoleto y los acuses se cruzaban.** El callback del socket
   capturaba el interlocutor del render en que se conectó, de modo que al elegir destinatario y
   escribir, el mensaje se comparaba contra el interlocutor vacío de antes y la conversación no se
   abría. Además los acuses se emparejaban con la primera burbuja pendiente de contenido idéntico, así
   que dos envíos del mismo texto se confirmaban cruzados: el primero con el resultado del segundo. Se
   empareja por posición en la cola de pendientes y el interlocutor se lee de una ref. Fijado en
   `ChatWidget.test.tsx`.

## SDD Cycle

Proposal → Spec → Design → Tasks → Apply → Verify → Archive (COMPLETE)

## Related Artifacts

- US-01 (`user-identity`): sin `(:Usuario)` no hay `MensajeChat` al que enlazar `ENVIA` y `DIRIGIDO_A`.

## Deuda Registrada

- **Canal sin autenticar**: `/chat/{userId}` confía en el identificador de la ruta, así que cualquiera
  que lo adivine entra como ese usuario. Queda anotado en `openspec/ROADMAP.md`. El ticket de US-07 la
  dejaba fuera de alcance y cerrarla exige un token de sesión para WebSocket que el proyecto aún no
  tiene.
- Sin restricción de unicidad para `:MensajeChat.id` en el dataset semilla, igual que el resto de
  índices del grafo.

---

*Archived by the sdd-archive phase. Change moved to
`openspec/changes/archive/2026-10-05-us-07-chat/`.*