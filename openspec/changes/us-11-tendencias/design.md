# Design: US-11 (TUX-62) — Tendencias en la red extendida

> **Dominio**: `graph-algorithms` · **Delta**: todos los requisitos `ADDED`

## Contexto técnico

La consulta obligatoria tiene dos defectos independientes, y el orden en que se corrigan importa. Si se
corrige solo la ventana temporal, la pantalla muestra números falsos con apariencia de correctos: es el
peor resultado posible, porque un error visible se investiga y uno invisible se implanta. **Por eso el
conteo se corrige en la misma unidad que la ventana**, aunque sean dos causas distintas.

## Decisiones

### D1. La ventana se corrige contra la representación existente

**Decisión**: comparar la fecha guardada contra el equivalente numérico de la fecha límite, en lugar de
compararla contra una fecha con hora.

**Alternativas consideradas**:

- *Migrar el campo a fecha con hora*: arregla los tres consumidores de una vez y elimina la raíz. Pero
  exige migrar las publicaciones existentes, cambiar el tipo declarado en el dominio, y coordinar tres
  historias que leen o escriben el mismo campo. Es la solución correcta a largo plazo y **no es una
  decisión que este change pueda tomar por su cuenta**.
- *Guardar la fecha dos veces, número y texto*: evita la migración, pero introduce dos representaciones
  del mismo dato que pueden divergir sin que nada lo detecte. Los datos que se contradicen a sí mismos
  son peores que los datos con un solo tipo.

**Consecuencia**: la migración queda registrada como deuda con nombre, y el spec fija que la ventana
mide siete días reales sobre la representación vigente. Cuando alguien decida migrar, este requisito se
sigue cumpliendo y lo que cambia es el tipo, no la intención.

### D2. El conteo mide reaccores distintos

**Decisión**: contar reaccores distintos y no filas.

**Por qué importa**: la consulta llega a un autor por cada camino que lo conecte con el usuario, y
después cruza cada fila con cada reaccor. Un autor alcanzable por dos rutas duplica todas sus
reacciones. Como el error crece con la conectividad, **ordena mal justo a los autores más centrales**,
que son los que más probablemente están en la lista. Un error sistemático en la dirección del criterio de
orden es más peligroso que un error aleatorio, porque parece un criterio de diseño.

**Consecuencia**: el total coincide con el número de personas que reaccionaron, que es lo que la
historia promete.

### D3. El usuario no es tendencia de sí mismo

**Decisión**: excluir al usuario de los autores de su propia ventana.

**Por qué importa**: el recorrido arranca en el usuario. Sin una condición que lo descarte, cualquier
ciclo en el grafo lo hace alcanzable a sí mismo. El efecto secundario es peor que la molestia visual: sus
propias reacciones a sus propias publicaciones inflan su propia clasificación. Es un caso patológico
disparado por datos, no por código.

### D4. El widget entra en la barra lateral que ya existe

**Decisión**: añadir el componente de tendencias al elemento lateral existente, sin crear maquetación.

**Por qué importa**: la barra lateral ya existe y ya aloja otros dos componentes. Crear una segunda
columna o una vista nueva para esto sería duplicar estructura por una diferencia de tres puntos. En US-10
ocurrió lo contrario: no había barra lateral, y por eso el control se fue a la tarjeta de sugerencias.
**La misma historia pide el mismo widget en dos lugares distintos, y en cada caso la razón del destino
es distinta.** Merece quedar escrito para que nadie lo lea como una inconsistencia.

**Orden en la barra**: por encima de las sugerencias, porque las tendencias son el contenido principal
del lateral y las sugerencias son contenido de apoyo. El orden de lectura de arriba hacia abajo debe
reflejar qué es lo primero que el usuario busca.

### D5. Sin resultados no es lo mismo que error

**Decisión**: que la interfaz distinga la ausencia de tendencias de un fallo de la petición.

**Por qué importa**: el mismo aprendizaje de US-10. Una persona que sigue a nadie, o que no tiene
publicaciones recientes en su círculo, obtiene una lista vacía legítima. Si eso se presenta como error,
la interfaz enseña un fallo donde no hay ninguno, y ese mensaje se cuela en decisiones de producto.

## Estructura resultante

El backend corrige la ventana y el conteo, y excluye al usuario. El frontend gana un tipo de respuesta,
una función de cliente y un componente en la barra lateral existente, con estado vacío propio.

## Verificación

- `cd backend && mvn compile`
- `cd frontend && pnpm run build`
- Prueba con el `curl` del ticket sobre una base con publicaciones reacted, para confirmar que la
  ventana ya no vacía el resultado.
- Comparar el total de una publicación con el número de personas que reaccionaron, para confirmar que
  el conteo no se duplica.
- Prueba con un autor alcanzable por dos rutas distintas, para confirmar que no se duplica.
- Confirmar que la barra lateral mantiene el orden superior a inferior.
