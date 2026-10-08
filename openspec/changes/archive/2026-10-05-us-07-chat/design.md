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

### D7. Un usuario puede tener varias sesiones abiertas a la vez

**Decisión**: el registro pasa de `Map<String, Session>` a `Map<String, Set<Session>>`, con una
instancia de `CanalChatPort` propia en infraestructura.

**Por qué importa**: el mapa actual sobrescribe la sesión cuando el mismo usuario abre una segunda
pestaña, y `@OnClose` / `@OnError` retiran la clave del usuario sin comprobar a qué sesión
pertenecía. El resultado es que cerrar la segunda pestaña desregistra la primera, y el usuario deja
de recibir mensajes sin haber cerrado nada: un fallo que solo aparece con dos pestañas del mismo
usuario y que por eso no se ve probando con dos personas distintas.

**Alternativas consideradas**:

- *Dejar el mapa como estaba*: se descarta por el motivo anterior.
- *Cerrar la sesión anterior al abrir una nueva*: rompe el caso legítimo de dos pestañas, que es
  justo el que la prueba de consola del ticket provoca al abrir el mismo usuario en dos ventanas.

**Consecuencia**: la clave del usuario desaparece solo cuando su conjunto de sesiones queda vacío. El
endpoint WebSocket pasa a ser un adaptador delgado que delega el registro, porque el registro es
infraestructura de canal y no dominio.

### D8. La validación y el estado de entrega no se filtran al dominio del mensaje

**Decisión**: `MensajeChat` describe lo que se persiste (emisor, destinatario, contenido, marca de
tiempo, identificador). El estado de entrega vive en `ResultadoEnvio`, en el dominio pero fuera del
mensaje, y el frame de transporte lo añade el adaptador.

**Por qué importa**: `NO_ENTREGADO` es una propiedad del instante del envío, no del mensaje. Si se
guardara en `MensajeChat`, el grafo tendría un mensaje marcado como no entregado que en el historial
se lee igual que un mensaje entregado, y el cliente no tendría forma de saber en qué momento se
decidió el estado.

**Consecuencia**: `ChatApplicationService` no conoce `jakarta.websocket`. Recibe un caso de uso, lo
ejecuta y devuelve un `ResultadoEnvio`; quién lo traduce a bytes es del adaptador. Eso además lo hace
pruebable sin levantar el contenedor.

**Consecuencia del formato del frame**: el mismo tipo serializa los dos sentidos, con dos fábricas:
una para el frame que va al destinatario y otra para el acuse. La diferencia no es solo qué campos
se rellenan, es que el destinatario NO puede recibir `estado`. Ese campo es la única señal con la que
el cliente distingue un acuse de un mensaje nuevo, así que si el frame de entrega lo trajera, el
cliente buscaría la burbuja a la que corresponde ese id, no hallaría ninguna porque el mensaje aún no
se dibujó en su pantalla, y lo descartaría. El resultado sería que el destinatario no ve nunca los
mensajes que le envían, sin error en ninguna capa: el servidor escribió, el emisor recibió un acuse de
entrega y solo falta el mensaje en el otro lado. Por eso los nulos no se serializan tampoco, con
`@JsonInclude(NON_NULL)` en el DTO y no confiando en la configuración global de Jackson, que es ajena
a este contrato.

### D9. El widget es flotante, y eso cambia su montaje

**Decisión**: el widget se monta fuera de la barra lateral, como botón lanzador fijo en la esquina
inferior derecha con panel expandible.

**Por qué importa**: el ticket pide un componente flotante, y una tarjeta más en la barra lateral
compite por el espacio con los paneles de sugerencias, conexiones en común y perfil. Flotante, el
chat está disponible sobre cualquier vista, incluido el perfil ajeno, sin empujar el resto del
layout.

**Consecuencia**: se modifica `App.tsx`, que este change antes declaraba fuera de alcance. Es una
decisión consciente: la restricción original protegía el layout ya documentado por US-09, US-10 y
US-12, y con el montaje flotante ese layout deja de cambiar. El componente sigue recibiendo
`currentUserId` como propiedad y no lee identidad por su cuenta.

## Estructura resultante

El historial llega por HTTP y el tiempo real por WebSocket, con el socket como único camino de los
mensajes nuevos. El estado de conexión vive en el servicio porque es compartido, y el componente solo
lo refleja. El caso de uso de aplicación orquesta validar, persistir y despachar sin conocer ni el
socket ni el grafo.

## Verificación

- `cd backend && $MAVEN_HOME/bin/mvn verify` — compila, ejecuta Spotless, SpotBugs y Surefire
- `cd frontend && pnpm run check` — `format:check`, `lint`, `test` y `build`
- Prueba de consola del navegador del ticket, con dos pestañas y dos identidades distintas
- Prueba de dos pestañas del **mismo** usuario, que es la que expone el defecto de D7
