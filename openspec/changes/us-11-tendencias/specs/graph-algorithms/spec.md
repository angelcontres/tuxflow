# Specifications: US-11 (TUX-62) — Tendencias en la red extendida

> **Ticket Linear**: `TUX-62` · **Card backlog**: `TUX-11` · **Dominio**: `graph-algorithms`
> **Delta**: todos los requisitos son `ADDED`

---

### Requirement: Filtrar por la ventana de los últimos siete días

El sistema DEBE considerar únicamente publicaciones creadas dentro de los siete días previos a la
consulta, comparando la fecha guardada con su equivalente numérico.

#### Scenario: Publicación dentro de la ventana

- **GIVEN** que una publicación en el círculo del usuario fue creada hace dos días
- **WHEN** se solicitan las tendencias
- **THEN** esa publicación aparece en el resultado

#### Scenario: Publicación fuera de la ventana

- **GIVEN** que una publicación en el círculo del usuario fue creada hace diez días
- **WHEN** se solicitan las tendencias
- **THEN** esa publicación NO aparece en el resultado

#### Scenario: La comparación no descarta todas las publicaciones

- **GIVEN** que el círculo del usuario tiene publicaciones recientes y reacciones
- **WHEN** se solicitan las tendencias
- **THEN** el resultado NO está vacío
- **AND** la fecha de la publicación se compara con su equivalente numérico, no con una fecha con hora

#### Scenario: Publicación sin fecha

- **GIVEN** que una publicación no tiene fecha de creación
- **WHEN** se solicitan las tendencias
- **THEN** esa publicación se excluye del resultado
- **AND** la consulta no falla en su conjunto

---

### Requirement: Contar reacciones de personas distintas

El sistema DEBE contar cada persona reaccor una sola vez por publicación, con independencia de
cuántos caminos conecten al usuario con el autor.

#### Scenario: Autor alcanzable por dos rutas

- **GIVEN** que el usuario sigue directamente al autor y además lo sigue alguien a quien sigue
- **AND** que la publicación del autor tiene tres reaccores distintos
- **WHEN** se solicitan las tendencias
- **THEN** el total de reacciones de esa publicación es tres
- **AND** NO es seis ni ningún múltiplo de tres

#### Scenario: Varias reacciones de la misma persona

- **GIVEN** que una persona reaccionó más de una vez a la misma publicación
- **WHEN** se solicitan las tendencias
- **THEN** esa persona se cuenta una sola vez en el total

#### Scenario: El orden no premia la conectividad

- **GIVEN** dos publicaciones con el mismo número de reaccores distintos
- **AND** que el autor de una está conectado al usuario por más rutas que el autor de la otra
- **WHEN** se solicitan las tendencias y se ordenan por total de reacciones
- **THEN** el total de reacciones NO depende del número de rutas de conexión

---

### Requirement: El alcance es de uno y dos saltos, sin incluir al propio usuario

El sistema DEBE considerar publicaciones de autores alcanzables en uno o dos saltos de seguimiento, y
NO DEBE incluir publicaciones del propio usuario.

#### Scenario: Autor a un salto

- **GIVEN** que el usuario sigue directamente al autor
- **WHEN** se solicitan las tendencias
- **THEN** las publicaciones del autor se consideran

#### Scenario: Autor a dos saltos

- **GIVEN** que el usuario sigue a alguien que sigue al autor
- **WHEN** se solicitan las tendencias
- **THEN** las publicaciones del autor se consideran

#### Scenario: Autor a tres saltos

- **GIVEN** que el autor está a tres o más saltos del usuario
- **WHEN** se solicitan las tendencias
- **THEN** las publicaciones del autor NO se consideran

#### Scenario: El usuario es alcanzable a sí mismo

- **GIVEN** que existe un ciclo que devuelve al usuario al usuario
- **WHEN** se solicitan las tendencias
- **THEN** las publicaciones del propio usuario NO aparecen
- **AND** las reacciones del usuario a sus propias publicaciones NO cuentan

---

### Requirement: Limitar el resultado a cinco publicaciones ordenadas

El sistema DEBE devolver como máximo cinco publicaciones, ordenadas por puntuación neta
(likes − dislikes) de mayor a menor, con el total de reacciones como desempate.

#### Scenario: Más de cinco publicaciones candidatas

- **WHEN** se solicitan las tendencias con más de cinco publicaciones candidatas
- **THEN** se devuelven como máximo cinco
- **AND** están ordenadas por puntuación neta DESC (desate por total de reacciones DESC)

#### Scenario: Menos de cinco publicaciones candidatas

- **WHEN** se solicitan las tendencias con menos de cinco publicaciones candidatas
- **THEN** se devuelven todas las disponibles
- **AND** no se inventan ni se completan resultados

---

### Requirement: Mostrar las tendencias en la barra lateral

El cliente DEBE presentar un componente de tendencias en la barra lateral existente, por encima de las
sugerencias, y DEBE distinguir la ausencia de tendencias de un fallo de la petición.

#### Scenario: Presentación correcta

- **GIVEN** que la aplicación está abierta con un usuario identificado
- **WHEN** se solicitan las tendencias de ese usuario
- **THEN** el componente aparece en la barra lateral por encima de las sugerencias
- **AND** muestra el autor, el texto y el total de reacciones de cada publicación

#### Scenario: Ausencia de tendencias

- **WHEN** el usuario no tiene publicaciones recientes en su círculo
- **THEN** el componente comunica que no hay tendencias
- **AND** no lo presenta como un fallo de la aplicación

#### Scenario: Fallo de la petición

- **WHEN** la solicitud de tendencias no puede completarse
- **THEN** el componente comunica el error
- **AND** no lo confunde con la ausencia de tendencias

#### Scenario: El contenido existente de la barra se mantiene

- **THEN** la tarjeta de sugerencias y el chat siguen presentes y en su lugar actual
- **AND** el orden de la barra es: tendencias, sugerencias, chat
