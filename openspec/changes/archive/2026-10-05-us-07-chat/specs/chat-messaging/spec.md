# Specifications: US-07 (TUX-59) — Chat instantáneo 1 a 1 por WebSockets

> **Ticket Linear**: `TUX-59` · **Card backlog**: `TUX-08` · **Dominio**: `chat-messaging`
> **Delta**: todos los requisitos son `ADDED`

---

## ADDED Requirements

### Requirement: Entregar mensajes en tiempo real entre dos usuarios conectados

El sistema DEBE enrutar por el canal WebSocket cada mensaje recibido al canal del destinatario
indicado, sin polling HTTP. DEBE asignar la identidad del emisor a partir de la ruta de conexión, nunca
a partir del cuerpo del mensaje.

#### Scenario: Entrega directa entre dos participantes

- **GIVEN** que "carlos-patino" y "paulo-orrala" están conectados al canal
- **WHEN** "carlos-patino" envía el mensaje con `destinatarioId` "paulo-orrala" y contenido "Hola Paulo"
- **THEN** el mensaje se entrega en el canal de "paulo-orrala"
- **AND** el mensaje recibido trae `emisorId` "carlos-patino"
- **AND** el contenido recibido es idéntico al enviado

#### Scenario: El emisor no puede suplantar a otro

- **GIVEN** que "carlos-patino" está conectado
- **WHEN** envía un cuerpo con `emisorId` "paulo-orrala"
- **THEN** el mensaje se entrega con `emisorId` "carlos-patino"
- **AND** el valor del cuerpo se descarta

#### Scenario: El frame que recibe el destinatario no lleva desenlace

- **GIVEN** que "paulo-orrala" está conectado
- **WHEN** "carlos-patino" le envía un mensaje
- **THEN** el frame entregado a "paulo-orrala" no incluye el campo de estado
- **AND** ese campo no aparece siquiera con valor nulo
- **AND** el destinatario puede distinguirlo de un acuse por su ausencia

---

### Requirement: Acusar la entrega o el fracaso al emisor

El sistema DEBE devolver al emisor el resultado del despacho, distinguiendo entre entrega efectiva y
destinatario ausente, y DEBE adjuntar la marca de tiempo del servidor. NO DEBE descartar el resultado
solo en el registro del servidor.

#### Scenario: Destinatario conectado, entrega confirmada

- **GIVEN** que "paulo-orrala" está conectado
- **WHEN** "carlos-patino" le envía un mensaje
- **THEN** "carlos-patino" recibe el acuse con estado de entregado
- **AND** la marca de tiempo del acuse la fija el servidor

#### Scenario: Destinatario ausente, entrega fallida y visible

- **GIVEN** que "paulo-orrala" NO está conectado
- **WHEN** "carlos-patino" le envía un mensaje
- **THEN** "carlos-patino" recibe el acuse con estado de no entregado
- **AND** el mensaje queda persistido para entregarlo en el historial

#### Scenario: El emisor nunca ve un fallo como si fuera éxito

- **WHEN** el emisor observa el resultado de un envío
- **THEN** un mensaje no entregado se distingue visualmente de uno entregado

---

### Requirement: Conservar el historial de la conversación

El sistema DEBE persistir cada mensaje en el grafo como nodo `MensajeChat` enlazado a emisor y
destinatatario, y DEBE exponer un endpoint HTTP que devuelva los mensajes de la pareja en ambos
sentidos, ordenados cronológicamente.

#### Scenario: El historial es simétrico entre los dos participantes

- **GIVEN** que existe un mensaje de "carlos-patino" a "paulo-orrala"
- **WHEN** se consulta el historial de la pareja
- **THEN** el mensaje aparece tanto al consultarlo desde "carlos-patino" como desde "paulo-orrala"

#### Scenario: Orden cronológico estable

- **WHEN** se consulta el historial de una pareja con varios mensajes
- **THEN** los mensajes vienen ordenados de más antiguo a más reciente

#### Scenario: Conversación sin mensajes

- **WHEN** se consulta el historial de una pareja que nunca se escribió
- **THEN** la respuesta es una lista vacía con código 200

---

### Requirement: Rechazar mensajes inválidos

El sistema NO DEBE enrutar mensajes con destinatario ausente, con destinatario igual al emisor, ni con
contenido vacío o en blanco. DEBE cerrar la sesión cuando se produzca un error de transporte.

#### Scenario: Mensaje a uno mismo

- **WHEN** un usuario envía un mensaje cuyo `destinatarioId` es su propio identificador
- **THEN** el mensaje no se enruta
- **AND** el emisor recibe el motivo del rechazo

#### Scenario: Contenido vacío

- **WHEN** un usuario envía un mensaje con `contenido` vacío o solo espacios
- **THEN** el mensaje no se enruta
- **AND** no se persiste

#### Scenario: Error de transporte

- **WHEN** se produce un error en una sesión abierta
- **THEN** la sesión se cierra y se retira del registro de sesiones activas

---

### Requirement: Entregar a todas las sesiones del destinatario

El sistema DEBE mantener un conjunto de sesiones por usuario, en lugar de una sola, y DEBE entregar el
mensaje a todas las que estén abiertas. DEBE retirar del conjunto únicamente la sesión que se cierra, y
eliminar la clave del usuario solo cuando no quede ninguna sesión abierta para él.

#### Scenario: Dos pestañas del mismo usuario

- **GIVEN** que "paulo-orrala" tiene el chat abierto en dos pestañas
- **WHEN** se cierra una de las dos pestañas
- **THEN** la otra pestaña sigue recibiendo mensajes
- **AND** el usuario sigue registrado como conectado

#### Scenario: Última pestaña cerrada

- **WHEN** se cierra la última pestaña de un usuario
- **THEN** ese usuario deja de estar registrado como conectado

---

### Requirement: Recuperar la conexión sin intervención del usuario

El cliente DEBE reintentar la conexión automáticamente cuando el socket se cierre, con espera creciente
acotada, y DEBE cancelar los reintentos pendientes cuando el componente se desmonte. DEBE exponer el
estado real de la conexión.

#### Scenario: Reconexión tras caída de red

- **GIVEN** que el widget está montado y la conexión se cae
- **WHEN** el socket se cierra de forma inesperada
- **THEN** el cliente reintenta automáticamente con espera creciente
- **AND** la interfaz muestra estado desconectado mientras reintenta

#### Scenario: Los reintentos no se acumulan

- **WHEN** el componente se desmonta
- **THEN** no queda ningún reintento pendiente
- **AND** no se abre un socket después del desmontaje

#### Scenario: Cierre intencionado, sin reintentos

- **WHEN** el cliente desconecta de forma intencionada
- **THEN** no se reintenta la conexión

---

### Requirement: Mostrar el estado real de la conexión

La interfaz DEBE indicar conectado, conectando o desconectado según el estado del socket. NO DEBE
mostrar un estado de conexión que no corresponda con el estado real.

#### Scenario: Indicador durante la reconexión

- **WHEN** la conexión se está reintentando
- **THEN** el indicador refleja un estado distinto del de conexión establecida

#### Scenario: El indicador no afirma una conexión inexistente

- **WHEN** el socket está cerrado
- **THEN** el indicador no se presenta como conectado

---

### Requirement: Ofrecer el chat sin que el layout lo desplace

La interfaz DEBE ofrecer el chat como componente flotante disponible sobre cualquier vista, y NO DEBE
ocupar espacio fijo en la barra lateral. El componente DEBE seguir recibiendo el identificador del
usuario conectado como propiedad.

#### Scenario: El chat está disponible sobre el feed

- **GIVEN** que el usuario está en la vista principal
- **WHEN** abre el chat
- **THEN** el panel aparece sobre la página sin desplazar el feed ni la barra lateral

#### Scenario: El chat está disponible sobre un perfil ajeno

- **GIVEN** que el usuario está viendo el perfil de otra persona
- **WHEN** abre el chat
- **THEN** el panel aparece igual que en la vista principal

#### Scenario: El widget no busca la identidad por su cuenta

- **WHEN** el componente se monta
- **THEN** usa el `currentUserId` que recibe como propiedad y no lo obtiene por otra vía
