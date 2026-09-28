# Design: US-08 (TUX-60) — Notificación Web Push asíncrona ante publicaciones

> **Dominio**: `web-push-notifications` · **Delta**: todos los requisitos `ADDED`

## Contexto técnico

Toda la estructura está en su sitio: puerto de salida, adaptador, consulta Cypher, service worker
registrado. El trabajo no es construir la arquitectura, es **hacer que el cable conduzca** y que el
fallo de una ponta no arrase la otra.

## Decisiones

### D1. Se usa la librería declarada, no criptografía propia

**Decisión**: enviar con la librería de web push que ya está en el `pom.xml`, con la configuración
VAPID inyectada.

**Alternativas consideradas**:

- *Implementar el cifrado a mano*: se descarta sin discusión. El esquema combina cifrado simétrico
  con acuerdos de clave, y es exactamente el tipo de código que parece correcto, funciona en las
  pruebas y falla en producción. Ya hay una dependencia probada instalada y sin usar.
- *Mandar el payload sin cifrar*: no es una opción. Los push services rechazan payloads sin cifrar.

### D2. El envío va en un borde asíncrono y su fallo no toca la publicación

**Decisión**: ejecutar la notificación de forma asíncrona respecto al hilo de la petición, y absorber
cualquier excepción dentro de ese borde.

**Por qué importa**: hoy la llamada es síncrona y ya hay una publicación escrita en la línea anterior.
Si el envío falla y la excepción sube, el controlador responde con error sobre una publicación que sí
existe. El usuario reintenta y duplica. Con el fallo absorbido, el peor caso es que nadie reciba una
notificación, que es un fallo aceptable; el otro es inconsistencia entre lo escrito y lo respondido,
que no lo es.

**Consecuencia**: hay que elegir una primitiva de asincronía y dejar explícito que la notificación es
best-effort. No es una operación que pueda confirmar éxito al cliente.

### D3. Las suscripciones muertas se podan, no se reintentan para siempre

**Decisión**: cuando el envío a una suscripción falle indicando que ya no es válida, eliminar esa
suscripción del nodo del usuario.

**Por qué importa**: un navegador puede desuscribirse, o el servicio de push puede invalidar la
suscripción por rotación de claves. Sin poda, la lista de suscripciones de un autor con muchos
seguidores crece de forma monótona y cada publicación reintenta endpoints muertos. El síntoma no es un
error visible: es latencia que crece sin control y una lista que nunca se acorta.

### D4. La clave pública se expone por endpoint, no se empotra en el bundle

**Decisión**: endpoint de solo lectura que entrega la clave pública VAPID.

**Alternativas consideradas**:

- *Variable de entorno de Vite inyectada en build*: se descarta. Obliga a reconstruir el frontend cada
  vez que la llave rota, y en desarrollo la llave del frontend puede no ser la del backend. Una
  desalineación silenciosa produce un fallo de suscripción inexplicable.
- *Endpoint*: la fuente única es el backend, que es quien tiene la llave. Es la opción que no puede
  desalinearse.

**Aclaración importante**: la clave pública **no es un secreto** y no debe tratarse como tal. Se
expone a propósito. La privada nunca sale del backend.

### D5. El permiso se pide de forma explícita y sus tres estados se distinguen

**Decisión**: pedir el permiso antes de suscribirse y tratar por separado concedido, denegado y sin
responder.

**Por qué importa**: el permiso de notificación no se puede volver a solicitar desde la web después de
que el usuario lo deniega. Hay una sola oportunidad. Un pedido fallido o automatizado se pierde para
siempre sin segunda chance, así que la interfaz tiene que poder explicar qué pasó y, cuando no hay
remedio desde la web, decirlo con claridad.

**Consecuencia**: el retorno de la función de suscripción deja de ser un valor único y pasa a distinguir
los casos. Ocultar el motivo detrás de una consola es la razón por la que este hueco lleva tanto
tiempo invisible.

### D6. El clic enfoca la aplicación abierta y lleva a la publicación

**Decisión**: al hacer clic, reutilizar una ventana ya abierta si existe, y abrir la publicación
concreta.

**Por qué importa**: abrir siempre la página de inicio duplica pestañas y pierde el contexto de lo que
se acaba de notificar. El payload lleva la referencia de la publicación precisamente para poder
enlazarla; sin ella, esa información no se transporta.

## Estructura resultante

El endpoint de suscripción y el de la clave pública completan la parte de registro, y el borde
asíncrono aísla la parte de envío. La notification es best-effort y el cliente nunca espera un
acuse.

## Verificación

- `cd backend && mvn compile`
- `cd frontend && pnpm run build`
- Conceder el permiso en el navegador y comprobar que la suscripción queda en el nodo del usuario.
- Publicar desde un usuario seguido y confirmar que aparece la notificación del sistema con la
  pestaña cerrada.
- Comprobar que un fallo de notificación no altera la respuesta de creación de la publicación.
