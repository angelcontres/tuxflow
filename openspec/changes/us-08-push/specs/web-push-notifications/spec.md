# Specifications: US-08 (TUX-60) — Notificación Web Push asíncrona ante publicaciones

> **Ticket Linear**: `TUX-60` · **Card backlog**: `TUX-09` · **Dominio**: `web-push-notifications`
> **Delta**: todos los requisitos son `ADDED`

---

### Requirement: Enviar la notificación cifrada a los seguidores

El sistema DEBE enviar un payload cifrado a cada suscripción push activa de los seguidores del autor,
usando las llaves VAPID configuradas. NO DEBE limitarse a registrar el intento de envío.

#### Scenario: Entrega efectiva a un seguidor suscrito

- **GIVEN** que "carlos-patino" sigue a "beatriz" y tiene una suscripción push registrada
- **WHEN** "beatriz" crea una publicación
- **THEN** el backend envía un payload cifrado al endpoint de la suscripción de "carlos-patino"
- **AND** el payload identifica al autor y contiene el texto de la publicación
- **AND** el registro de la operación no es el único efecto observable

#### Scenario: Sin seguidores suscritos, la publicación se crea igual

- **GIVEN** que ningún seguidor del autor tiene suscripción registrada
- **WHEN** el autor crea una publicación
- **THEN** la publicación se crea correctamente
- **AND** la respuesta no indica error

---

### Requirement: La notificación no bloquea ni puede fallar la publicación

El sistema DEBE ejecutar el envío fuera del hilo que atiende la petición de creación. NO DEBE
propagar al cliente ningún fallo(originado en la notificación.

#### Scenario: El fallo de notificación no altera la respuesta

- **GIVEN** que el servicio de push está inaccesible
- **WHEN** un autor crea una publicación
- **THEN** la respuesta indica que la publicación se creó
- **AND** la publicación queda persistida
- **AND** el fallo de notificación no aparece en la respuesta

#### Scenario: La creación no espera al servicio de push

- **GIVEN** un autor con muchos seguidores suscritos
- **WHEN** crea una publicación
- **THEN** la respuesta no espera a completar el envío a cada seguidor

---

### Requirement: Registrar y persistir la suscripción del navegador

El sistema DEBE exponer un endpoint que reciba la suscripción push del navegador y la persista en el
nodo del usuario. DEBE exponer la clave pública VAPID como dato de solo lectura.

#### Scenario: Alta de suscripción

- **WHEN** un navegador envía su suscripción push para el usuario "carlos-patino"
- **THEN** la respuesta es correcta
- **AND** la suscripción queda guardada en el nodo de "carlos-patino"

#### Scenario: Registro repetido de la misma suscripción

- **WHEN** el navegador registra una suscripción que ya estaba guardada
- **THEN** no se duplica la entrada
- **AND** la suscripción sigue disponible para el envío

#### Scenario: La clave pública es legible

- **WHEN** se consulta el endpoint de la clave pública
- **THEN** devuelve la clave pública VAPID vigente
- **AND** en ningún momento devuelve la clave privada

---

### Requirement: Pedir el permiso de notificación y distinguir sus estados

El cliente DEBE solicitar el permiso de notificación antes de suscribirse, y DEBE distinguir entre
permiso concedido, denegado y sin responder. NO DEBE tragar el motivo del fallo.

#### Scenario: Permiso concedido y suscripción registrada

- **GIVEN** que el usuario concede el permiso
- **WHEN** el cliente intenta registrarse
- **THEN** obtiene la suscripción push
- **AND** la envía al backend para persistirla

#### Scenario: Permiso denegado, motivo visible

- **GIVEN** que el usuario deniega el permiso
- **WHEN** el cliente intenta registrarse
- **THEN** informa que el permiso fue denegado
- **AND** no intenta suscribirse

#### Scenario: Permiso sin responder, motivo visible

- **GIVEN** que el usuario no responde al pedido de permiso
- **WHEN** el cliente intenta registrarse
- **THEN** informa que el permiso quedó sin responder
- **AND** no reporta un error de suscripción genérico

#### Scenario: Navegador sin soporte

- **GIVEN** que el navegador no soporta Web Push
- **WHEN** el cliente intenta registrarse
- **THEN** informa que la función no está disponible
- **AND** no lanza un error no controlado

---

### Requirement: Podar las suscripciones que ya no son válidas

El sistema DEBE eliminar del nodo del usuario toda suscripción que el servicio de push reporte como
inválida, y NO DEBE reintentar de forma indefinida contra ella.

#### Scenario: Suscripción caducada durante el envío

- **GIVEN** que el servicio de push responde que una suscripción ya no es válida
- **WHEN** el backend procesa el resultado del envío
- **THEN** esa suscripción se elimina del nodo del usuario
- **AND** no vuelve a intentarse en envíos posteriores

#### Scenario: Un fallo transitorio no poda la suscripción

- **GIVEN** que el envío falla por un error temporal de red
- **WHEN** el backend procesa el resultado
- **THEN** la suscripción se conserva para futuros envíos

---

### Requirement: La notificación lleva a la publicación

El service worker DEBE mostrar la notificación nativa con los datos del payload y DEBE enfocar una
ventana ya abierta de la aplicación al hacer clic, en lugar de abrir siempre una ventana nueva.

#### Scenario: Notificación con la aplicación cerrada

- **GIVEN** que la aplicación no está abierta
- **WHEN** llega la notificación y el usuario hace clic
- **THEN** se abre la aplicación en la publicación notificada

#### Scenario: Notificación con la aplicación abierta

- **GIVEN** que la aplicación ya está abierta en una pestaña
- **WHEN** el usuario hace clic en la notificación
- **THEN** se enfoca la ventana existente
- **AND** no se abre una pestaña duplicada

#### Scenario: Payload incompleto

- **WHEN** llega un payload sin título ni cuerpo
- **THEN** la notificación se muestra con el texto por defecto
- **AND** no se produce un error en el service worker
