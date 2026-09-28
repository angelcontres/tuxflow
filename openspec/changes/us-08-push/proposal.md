# Proposal: US-08 (TUX-60) — Notificación Web Push asíncrona ante publicaciones

> **Ticket Linear**: `TUX-60` · **Card backlog**: `TUX-09` · **Dominio**: `web-push-notifications`
> **Prioridad**: P1 (Should Have) · **RICE**: 32.0 · **Estimación**: 5 Story Points · **Sprint**: 3
> **Rama Git**: `feature/US-08-push-notifications`

## Intent

Como seguidor de un perfil, quiero recibir una notificación nativa en mi sistema operativo cuando se
publique contenido nuevo, incluso con la pestaña del navegador cerrada.

## El estado real del código

La arquitectura está **completa y bien planteada**. La hexagonización es correcta, el disparador está
conectado, la consulta Cypher es la adecuada y el service worker se registra. Lo que falta es que
**algo ocurra**. La cadena entera está construida, pero rota en cuatro puntos independientes, y ninguno
de ellos se manifiesta como error visible.

### Ya implementado y correcto

- La dependencia `web-push` y su soporte criptográfico están declarados en `backend/pom.xml`. La
  elección de biblioteca es la correcta y no hay que reemplazarla.
- El bloque de configuración VAPID existe en `application.properties` con lectura por variable de
  entorno.
- `WebPushNotificationAdapter` implementa `NotificationPushPort` e inyecta la configuración con
  `@ConfigProperty`. El puerto de salida está en el lugar correcto.
- **El disparador está conectado**: `PostApplicationService` invoca la notificación justo después de
  persistir la publicación. La arquitectura hexagonal está bien montada de punta a punta.
- La consulta Cypher es la correcta: parte del autor, atraviesa `[:SIGUE]` hacia atrás y filtra las
  suscripciones ausentes.
- `sw.js` tiene los dos escuchadores que pide el ticket, y `index.html` registra el service worker al
  cargar. Además Vite copia `public/` a `dist/`, así que el archivo llega al navegador.

### Los cuatro puntos donde la cadena se rompe

**1. El adaptador no envía nada.** El cuerpo del bucle es una llamada al registro. No hay import de la
librería de web push, no hay invocación de envío, no hay cifrado. La dependencia está declarada y
nunca se usa. La notificación nunca sale del servidor.

**2. La suscripción nunca se guarda.** El campo existe en el modelo de usuario con sus accesores, y la
consulta Cypher filtra por él, pero ningún código lo escribe. Como la consulta exige que la propiedad
tenga valor, devuelve una lista vacía de forma permanente. Aunque el envío fuera real, apuntaría a
nadie.

**3. No existe endpoint para registrar la suscripción.** No hay recurso REST que reciba la suscripción
del navegador ni la persista. Es el eslabón que falta entre el frontend y la base de datos.

**4. El registro del frontend no se invoca y nunca pide permiso.** La función de suscripción existe,
convierte correctamente la clave VAPID y maneja el error, pero ningún archivo la importa. Y sobre todo:
**nunca solicita el permiso de notificación**. Suscribirse sin permiso granted falla, y el propio
manejador de error de la función se traga ese fallo y devuelve vacío. El síntoma es una línea en la
consola del navegador y nada más.

Además, la clave pública VAPID no se expone al frontend en ningún punto, y los valores por defecto de
la configuración son marcadores de posición, no claves válidas. Sin llaves reales el criptografiado
falla en tiempo de ejecución.

### Un defecto de diseño que ya está en el código

La notificación se invoca **de forma síncrona** en la línea que crea la publicación. Hoy no se nota
porque el cuerpo del bucle no hace trabajo. En cuanto el envío sea real, cada seguidor será una
llamada HTTPS secuencial dentro del hilo que atiende la petición. Crear una publicación bloquearía al
usuario durante segundos.

Peor todavía: la publicación **ya está persistida** un par de líneas antes. Si el envío lanza una
excepción, la excepción sube hasta el controlador y la respuesta dice que la creación falló, cuando el
nodo ya está escrito. El cliente ve un error y reintenta, duplicando la publicación. Es el peor tipo de
fallo: la escritura ocurrió y la respuesta la niega.

## Alcance

1. Enviar la notificación de verdad con la librería ya declarada, desde un borde asíncrono que no
   bloquee la creación de la publicación ni convierta un fallo de notificación en un fallo de
   publicación.
2. Exponer el endpoint que recibe y persiste la suscripción del navegador, y el que entrega la clave
   pública VAPID.
3. Pedir el permiso de notificación de forma explícita en el frontend, distinguir los tres estados
   posibles y registrar la suscripción ante el backend.
4. Podar las suscripciones que el servicio de push ya no reconoce, y hacer que la notificación abra la
   publicación concreta en lugar de la página de inicio.

## Fuera de alcance

- **Notificaciones por email o dentro de la aplicación.** El canal es Web Push y solo Web Push.
- **Preferencias de notificación por usuario.** El ticket no las pide y agregar una pantalla de
  ajustes sería otro cambio.
- **Contenido enriquecido de la notificación.** Se envía texto plano. El service worker ya resuelve
  valores por defecto cuando el payload no trae título ni cuerpo.

## Riesgos

- **Enviar a suscripciones muertas degrada cada publicación.** Un push service responde con error
  cuando la suscripción caducó. Sin poda, la lista crece para siempre y cada publicación reintenta
  endpoints que ya no existen. La poda no es una mejora: es parte de que la función sea sostenible.
- **Pedir permiso sin explicar el momento es la vía rápida al rechazo.** El permiso no se puede volver
  a pedir desde la web tras un rechazo. Un pedido mal colocado se pierde para siempre y no hay segunda
  oportunidad sin guía al usuario a los ajustes del navegador.
- **Las llaves VAPID de ejemplo no sirven para nada.** El valor por defecto debe fallar de forma
  ruidosa al arrancar, no durante una publicación, cuando el usuario ya no puede hacer nada al respecto.

## Delta de especificación

Todos los requisitos son `ADDED` sobre la capability `web-push-notifications`. Ninguna de las
capacidades existentes cambia: esta historia no toca el grafo, ni las reacciones, ni el feed.
