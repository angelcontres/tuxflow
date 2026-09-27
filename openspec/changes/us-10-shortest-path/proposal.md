# Proposal: US-10 (TUX-61) — Grado de separación y camino más corto

> **Ticket Linear**: `TUX-61` · **Card backlog**: `TUX-10` · **Dominio**: `graph-algorithms`
> **Prioridad**: P2 (Could Have) · **RICE**: 20.0 · **Estimación**: 3 Story Points · **Sprint**: 3
> **Rama Git**: `feature/US-10-shortest-path`

## Intent

Como analista de la red, quiero conocer la cadena mínima de relaciones de seguimiento que me conecta
con cualquier usuario distante, hasta seis grados de separación.

## El estado real del código

El backend de esta historia está **completo y es la mejor implementación de la cola**. La consulta
obligatoria del ticket está implementada **literalmente**, y la cadena hexagonal está cableada de
punta a punta sin un solo hueco.

### Ya implementado y correcto

- La consulta Cypher obligatoria está copiada tal cual: el camino más corto con `[:SIGUE*..6]`, la
  exclusión de origen igual a destino, la extracción de nombres de usuario por cada nodo del camino
  y el conteo de saltos.
- El recorrido completo existe y no tiene eslabones sueltos: el caso de uso de entrada, el servicio de
  aplicación, el puerto de salida, el adaptador de Neo4j y el recurso REST.
- El endpoint coincide con el `curl` del ticket, incluidos los nombres de parámetro.
- La lectura es transaccional y correcta: usa el bloque de lectura de sesión, no una sesión suelta.

### Los huecos

**1. El frontend no existe.** La tarea 2 del ticket pide un botón de calcular distancia en el perfil o
en la tarjeta de sugerencias. No hay ni una sola referencia a distancia, camino o grado de separación
en todo el frontend. La mitad de la historia no está empezada.

**2. No hay servicio HTTP en el cliente.** Ningún archivo del frontend consulta el endpoint. Aun con
el endpoint vivo, no hay forma de alcanzarlo desde la interfaz.

**3. El camino vacío es indistinguible de una entrada inválida.** Cuando no hay conexión dentro de
seis grados, el adaptador devuelve un mapa vacío con respuesta correcta. Cuando faltan los parámetros
de la consulta, ocurre lo mismo. Cuando se consulta la distancia de un usuario consigo mismo, también
ocurre lo mismo. Son tres situaciones distintas con una sola respuesta posible, y ninguna de ellas se
puede distinguir desde el cliente.

**4. Los parámetros de la consulta no se validan.** Si falta el origen o el destino, la consulta se
ejecuta con un parámetro nulo en lugar de responder que falta un dato.

**5. Riesgo de nulidad al leer los nombres del camino.** El adaptador convierte cada nombre del camino
a texto sin comprobar que exista. Un usuario sin nombre cargado en medio del camino rompe la consulta
entera, que es el mismo patrón de defecto que ya aparece en otras consultas del adaptador.

## Sobre la dirección del camino: una decisión que conviene revisar

La consulta obligatoria recorre `SIGUE` **en un solo sentido**: de origen a destino. Eso significa que
"carlos" sigue a "elena", pero "elena" no sigue a "carlos", no encuentra camino, aunque para un análisis
de grados de separación se trata de una relación de uno.

La lectura de la descripción del ticket dice cadena de relaciones que conecta. La lectura de un analista
de redes diría que dos personas están a un grado de separación si cualquiera de las dos sigue a la
otra. La consulta obligatoria expresa la primera.

Este change **respeta la consulta obligatoria** porque el ticket la marca como obligatoria, y deja el
comportamiento explícito en el spec para que no sea accidental. La alternativa queda registrada en el
design con su coste, porque la decisión es del producto y no del implementador.

## Alcance

1. Distinguir explícitamente los tres resultados posibles: camino encontrado, sin conexión dentro del
   alcance, y petición incompleta.
2. Validar los parámetros de entrada y proteger la lectura de los nombres del camino.
3. Añadir el servicio de cliente y el control de calcular distancia sobre la tarjeta de sugerencias,
   más el punto de entrada de la ruta.

## Fuera de alcance

- **Recorrido bidireccional del camino.** La consulta obligatoria es dirigida y este change la mantiene.
  La alternativa queda anotada en el design para decisión de producto.
- **Visualización de grafo o mapa de la red.** El ticket pide un botón y un resultado, no un renderizado de
  la topología.
- **Cálculo de grados de separación contra un grupo.** Es una consulta distinta, no una extensión de
  esta.

## Riesgos

- **Tocar la tarjeta de sugerencias implica aceptar el trabajo previo.** La tarjeta la modifican
  US-02 y US-03. US-10 se aplica después de ambas en el orden del roadmap, así que la dependencia
  está satisfecha. Conviene dejarlo escrito porque es la razón por la que este change puede añadir
  ahí su control y antes no podía.
- **Un resultado vacío sin causa discernible se convierte en un bug de interfaz.** Si el cliente no
  puede diferenciar "no hay camino" de "petición inválida", la interfaz acaba mostrando un error
  genérico para un caso que en realidad es un resultado legítimo.

## Delta de especificación

Todos los requisitos son `ADDED` sobre la capability `graph-algorithms`. Ninguna otra capacidad cambia:
esta historia solo lee el grafo.
