# Design: US-07 (TUX-59) — Chat instantáneo 1 a 1 por WebSockets

> **Dominio**: `chat-messaging` · **Delta**: todos los requisitos `ADDED`

## Contexto técnico

El canal ya existe y funciona: `ChatWebSocket` enruta en memoria y `chatSocket.ts` se conecta con la
URL correcta. Lo que falta es la capa de **persistencia**, la de **confiabilidad** y la de
**honestidad del estado visible**. Son tres problemas distintos y conviene no mezclarlos.

## Decisiones

### D1. El mensaje se persiste en el grafo, no solo en memoria

**Decisión**: crear el nodo `MensajeChat` en Neo4j en el momento del despacho, enlazado al emisor y al
destinatario mediante relaciones navegables.

**Alternativas consideradas**:

- *Solo memoria, sin persistencia*: se descarta porque `openspec/specs/spec.md` ya declara
  `MensajeChat` como nodo principal del grafo. Un modelo canónico que la implementación no cumple es
  una deuda que se paga en cada historia futura que necesite el historial.
- *Propiedades sueltas en el nodo, sin relaciones*: se descarta. El grafo del proyecto se recorre con
  relaciones (`SIGUE`, `PUBLICA`, `REACCIONA`) y la estrategia declarada es index-free adjacency. Meter
  la identidad del usuario en propiedades obligaría a escanear nodos para reconstruir una conversación.

**Consecuencia**: hay que actualizar la lista de relaciones de la especificación canónica, porque
declara solo `SIGUE`, `PUBLICA` y `REACCIONA`. Este change no la reescribe: deja la modificación
anotada para cuando se archive.

### D2. El historial se carga por HTTP, no por el socket

**Decisión**: el tiempo real es el socket; el historial es un endpoint HTTP que se consulta una vez al
montar el widget.

**Alternativas consideradas**:

- *Historial por el socket al abrir*: acopla el canal a la carga de datos y hace que el socket dependa
  de la base de datos. Un canal que entrega mensajes en milisegundos no debería bloquearse esperando
  una consulta.
- *Polling HTTP de historial*: se descarta explícitamente. Es lo que el ticket quiere eliminar.

**Consecuencia**: el chat necesita dos superficies, y eso hay que dejarlo escrito para que nadie lo
lea como duplicación. La regla es simple: el socket transporta, HTTP recupera.

### D3. La consulta de historial trata la conversación como conjunto simétrico

**Decisión**: el endpoint recibe los dos participantes y devuelve los mensajes en los que ambos
aparecen, sin importar cuál es emisor y cuál destinatario, ordenados por marca de tiempo.

**Por qué importa**: una conversación no tiene identificador propio. Si la consulta filtra en un solo
sentido, el historial aparece completo para uno de los dos participantes y vacío para el otro. Ese es
un fallo silencioso: la interfaz no muestra ningún error, simplemente no hay burbujas.

### D4. El servidor devuelve el acuse de entrega

**Decisión**: tras enrutar, el servidor reenvía el mensaje al emisor con un estado de entrega. Si el
destinatario no está conectado, el emisor recibe el mismo mensaje con estado de no entregado.

**Alternativas consideradas**:

- *No acusar y confiar en el cliente*: conserva el fallo actual. El emisor ve una burbuja idéntica a
  un mensaje entregado, y la diferencia es invisible.
- *Echo con marca de tiempo del servidor*: es lo que se hará. El emisor conserva su marca original y
  recibe además la confirmación del servidor, de modo que la hora mostrada no depende del reloj del
  navegador, que es la fuente habitual de discrepancias en estos chats.

**Consecuencia**: el tipo del mensaje en el frontend deja de ser un registro de transporte y pasa a
tener un estado. Es un cambio de contrato, y por eso es una decisión y no un detalle de implementación.

### D5. La reconexión usa espera creciente y es cancelable

**Decisión**: al cerrarse el socket, el servicio reintenta con espera creciente acotada. El
desmontaje del componente cancela cualquier reintento pendiente.

**Por qué importa**: elwebsocket sobrevive a la caída del backend. Sin espera creciente, cada pestaña
abierta martilla al servidor con un intento por segundo mientras este no vuelve. Con desmontaje sin
cancelar, un reintento pendiente puede abrir un socket huérfano después de que el componente ya no
exista.

**Consecuencia**: el temporizador de reintento es estado del servicio, no del componente. Si vive en el
componente, dos instancias pueden competir por el mismo socket, porque el servicio es un singleton
exportado.

### D6. El indicador refleja el estado, no la intención

**Decisión**: el servicio expone el estado de la conexión y el componente lo pinta. Se eliminan el
verde fijo y la animación permanente.

**Por qué importa**: el distintivo actual afirma una conexión que puede no existir. Un indicador
falso es peor que un indicador ausente, porque el usuario deja de mirar la señal y asume que todo
funciona. Un estado que parpadea durante la reconexión comunica la verdad sin exigir que el usuario
adivine.

## Estructura resultante

El historial llega por HTTP y el tiempo real por WebSocket, con el socket como único camino de los
mensajes nuevos. El estado de conexión vive en el servicio porque es compartido, y el componente solo
lo refleja.

## Verificación

- `cd backend && mvn compile`
- `cd frontend && pnpm run build`
- Prueba de consola del navegador del ticket, con dos pestañas y dos identidades distintas.
