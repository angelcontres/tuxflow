# Proposal: US-11 (TUX-62) — Tendencias en la red extendida

> **Ticket Linear**: `TUX-62` · **Card backlog**: `TUX-11` · **Dominio**: `graph-algorithms`
> **Prioridad**: P2 (Could Have) · **RICE**: 20.0 · **Estimación**: 3 Story Points · **Sprint**: 3
> **Rama Git**: `feature/US-11-tendencias-red`

## Intent

Como miembro de la comunidad, quiero ver las diez publicaciones más populares, con más reacciones,
creadas en los últimos siete días dentro de mi círculo social extendido a uno y dos saltos.

## El estado real del código

El backend está cableado completo y la consulta obligatoria está copiada literalmente, como en US-10.
Pero esta historia tiene un defecto que las demás no tienen: **la consulta no puede devolver nada**, y
aunque se arreglara, sus números serían falsos.

### El bloqueante: la comparación de fechas no puede funcionar

La fecha de creación **se guarda como número entero**, en milisegundos desde la época. La consulta de
tendencias la compara contra una fecha con hora, calculada restando siete días. Son dos tipos
distintos.

Una propiedad entera comparada con una fecha con hora no produce la ventana temporal que el ticket
pide. Produce una lista vacía, siempre. **No hay ningún escenario en el que esta función devuelva las
tendencias correctas**, por muy bien cargada que esté la base.

No es un error aislado: es el mismo campo con tres consumidores que hacen tres suposiciones distintas
sobre su tipo. El feed lo ordena asumiendo que es un número, y por eso ordena bien. El feed lo lee
asumiendo que es texto, y por eso revienta. Las tendencias lo comparan asumiendo que es una fecha, y por
eso no devuelven nada. Un campo, tres supuestos, dos de ellos equivocados.

### El segundo defecto: los números serían falsos aunque la ventana funcionara

La cuenta de reacciones cuenta **pares de camino y reaccor**, no reaccores distintos.

La consulta llega a un autor por dos rutas posibles: si el usuario sigue a ese autor directamente y
también lo sigue siguiendo alguien a quien el usuario sigue, el mismo autor aparece dos veces, una por
cada ruta. Cada fila resultante se combina después con cada reaccor, así que un post con diez
reacciones puede contar veinte.

El efecto es peor que un error de redondeo. **El error favorece sistemáticamente a los autores con más
rutas de entrada**, es decir, a los que están bien conectados en el centro de la red. Una métrica de
popularidad contaminada por la densidad del grafo deja de medir popularidad y empieza a medir
conectividad. El orden de los diez primeros sería exactamente el orden equivocado, y no por un margen
pequeño.

### Los huecos restantes

- **El widget de tendencias no existe.** El ticket pide un componente en la barra lateral derecha. La
  barra lateral **ya existe** y ya contiene la tarjeta de sugerencias y el chat, así que el componente
  tiene sitio: no hace falta crear maquetación.
- **No hay servicio de cliente.** Ningún archivo del frontend consulta el endpoint.
- **El usuario no queda excluido de su propia ventana.** El recorrido empieza en el usuario y no tiene
  ninguna condición que lo descarte. Si el grafo tiene un ciclo, el usuario alcanza sus propias
  publicaciones, y sus reacciones a sí mismo cuentan.
- **La distinción entre sin resultados y error** no está resuelta, con el mismo problema que se detectó
  en US-10.

## Decisión previa que hay que tomar antes de escribir código

La consulta obligatoria se puede arreglar de dos maneras, y no son equivalentes en coste.

- **Comparar contra el mismo tipo que se guardó**, sin tocar los datos existentes.
- **Cambiar la representación del campo a una fecha con hora de verdad**, lo que arregla a los tres
  consumidores de una vez, pero exige migrar las publicaciones ya guardadas y cambiar el tipo del
  dominio, que hoy declara texto.

Este change aplica la primera. La segunda es deuda real, pero migrar un campo compartido desde dentro
de una historia de tres puntos no es una decisión que corresponda a este change: la segunda la leen o
escriben US-04, US-05 y US-11, y el tipo declarado en el dominio no coincide con ninguno de los dos. Se
deja registrada con su nombre y su coste para que se decida con las tres historias a la vista.

## Alcance

1. Corregir la comparación temporal para que la ventana de siete días funcione con la representación
   que el sistema ya usa.
2. Corregir el conteo para que mida reaccores distintos y no rutas de entrada.
3. Excluir al usuario de su propia ventana de tendencias.
4. Añadir el servicio de cliente y el componente de tendencias en la barra lateral existente.

## Fuera de alcance

- **Migrar el campo de fecha a una fecha con hora.** Es trabajo propio, con las tres historias
  consumidoras a la vista.
- **Deshacer duplicados de reacción ya existentes.** La historia de reacciones viene antes en el
  roadmap y evita que se creen; limpiar lo que ya hay en la base es otra cosa.
- **Ponderar la popularidad por tiempo.** La ventana ya acota el período, y ponderar sería otro modelo.
- **Página de tendencias completa o clasificación por categorías.** El ticket pide un widget lateral.

## Riesgos

- **Esta historia depende de la de reacciones para que sus números sean ciertos.** Si una misma persona
  puede reaccionar dos veces a la misma publicación, contar reaccores distintos no corrige el total.
  En el orden del roadmap la historia de reacciones va antes, así que la dependencia está satisfecha.
- **Corregir solo la comparación deja el conteo engañosamente plausible.** Si se arregla la ventana y
  no el conteo, la pantalla muestra números que parecen razonables y no lo son. Peor que una pantalla
  rota, porque nadie lo va a investigar.
- **El campo de fecha compartido es el punto de mayor riesgo de toda la cola.** Tres historias lo leen o
  escriben y hoy ninguna tiene el mismo tipo que la otra. Cualquier cambio de convención debe hacerse
  una vez, no tres.

## Delta de especificación

Todos los requisitos son `ADDED` sobre la capability `graph-algorithms`, igual que US-10, porque ambas
historias leen el grafo y no agregan entidades.
