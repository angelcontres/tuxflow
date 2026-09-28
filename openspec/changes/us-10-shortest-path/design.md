# Design: US-10 (TUX-61) — Grado de separación y camino más corto

> **Dominio**: `graph-algorithms` · **Delta**: todos los requisitos `ADDED`

## Contexto técnico

La parte difícil de esta historia —la consulta de camino más corto con profundidad acotada— ya está
escrita y es correcta. Lo que hay que diseñar es cómo se **comunica un resultado que tiene tres
significados distintos** y cómo se conecta el cliente que no existe.

## Decisiones

### D1. La consulta obligatoria se respeta tal cual

**Decisión**: mantener la consulta exactamente como el ticket la especifica, con recorrido dirigido de
`SIGUE` y profundidad máxima de seis, y fijar ese comportamiento en el spec como explícito.

**Alternativas consideradas**:

- *Recorrer `SIGUE` en ambos sentidos con la variable de longitud sin dirección*: encontraría
  conexiones que la versión dirigida no encuentra. Es más fiel a la lectura de "grado de separación" de
  un analista de redes, pero **se aparta de la consulta que el ticket declara obligatoria**. Decidirlo
  es una decisión de producto, no una mejora técnica que este change pueda tomar por su cuenta.
- *Ejecutar las dos direcciones y unir los resultados*: duplica el coste de la búsqueda y multiplica
  los casos de respuesta, a cambio de lo mismo que la primera opción.

**Consecuencia**: el spec fija que el alcance es dirigido, con un escenario que lo hace verificable. Si
en el futuro se decide hacerlo bidireccional, ese escenario es el que hay que cambiar, y el cambio
queda a la vista en vez de implícito.

### D2. Tres resultados, tres respuestas distinguibles

**Decisión**: el endpoint responde de forma distinta para cada uno de los tres casos.

- *Camino encontrado*: respuesta correcta con la ruta y el número de saltos.
- *Sin conexión dentro de seis grados*: respuesta correcta con la ruta vacía y los saltos en cero.
  Es un resultado legítimo, no un error.
- *Petición incompleta*: respuesta de error de cliente, porque falta un parámetro y eso no es un
  resultado, es una llamada mal formada.

**Por qué importa**: hoy los tres casos devuelven un mapa vacío. Con eso, el cliente no puede
distinguir "estás a más de seis grados" de "te faltó un parámetro", y la interfaz acaba tratando un
resultado válido como si fuera un fallo. Devolver una forma vacía explícita cuesta poco y elimina esa
ambigüedad para siempre.

### D3. El control de distancia vive en la tarjeta de sugerencias

**Decisión**: añadir el control de calcular distancia en la tarjeta de sugerencias, no en un perfil
nuevo.

**Por qué importa**: no existe una vista de perfil en el frontend. Crear una sería trabajo de otra
historia. La tarjeta de sugerencias ya existe, ya muestra otros usuarios y es el lugar donde tiene
sentido preguntar "¿a cuántos saltos estoy de esta persona?".

**Consecuencia**: este change modifica un archivo que US-02 y US-03 también modifican. En el orden del
roadmap US-10 se aplica después de ambas, así que la dependencia está satisfecha y no hay conflicto de
merge. Es la razón por la que es válido tocar ese archivo aquí y no lo era antes.

### D4. La ruta devuelve identificadores además de nombres

**Decisión**: incluir el identificador de cada nodo del camino junto a su nombre de usuario.

**Por qué importa**: el ticket espera una lista de nombres, y eso se mantiene. Pero una lista de
nombres no permite que la interfaz convierta cada salto en un enlace. Sin identificadores, el camino se
muestra como texto y el usuario no puede recorrerlo. Son unos pocos caracteres de más por elemento y
convierte un resultado informativo en un resultado navegable.

### D5. La lectura de nombres es tolerante a ausencias

**Decisión**: proteger la conversión de cada nombre del camino, sustituyendo por un valor por defecto
cuando el nodo no lo tenga.

**Por qué importa**: es el mismo patrón de nulidad que ya aparece en otras consultas del mismo
adaptador. Un único usuario sin nombre en medio del camino no debe anular la respuesta completa,
porque el resto de la información es válida y el usuario la necesita.

## Estructura resultante

El backend conserva su consulta y gana en la distinción de resultados y la validación de entrada. El
frontend gana un servicio de cliente y un control en la tarjeta de sugerencias, que muestra la ruta y
el número de saltos.

## Verificación

- `cd backend && mvn compile`
- `cd frontend && pnpm run build`
- Prueba con el `curl` del ticket entre dos usuarios conectados y entre dos usuarios sin conexión.
- Consulta con un solo parámetro, para comprobar que responde como petición incompleta y no como
  resultado vacío.
- Consulta de un usuario consigo mismo, para comprobar que la respuesta es distinguible.
