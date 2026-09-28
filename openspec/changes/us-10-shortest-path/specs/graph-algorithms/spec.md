# Specifications: US-10 (TUX-61) — Grado de separación y camino más corto

> **Ticket Linear**: `TUX-61` · **Card backlog**: `TUX-10` · **Dominio**: `graph-algorithms`
> **Delta**: todos los requisitos son `ADDED`

---

### Requirement: Calcular el camino más corto dentro del alcance

El sistema DEBE devolver la cadena mínima de relaciones `SIGUE` que conecta origen y destino, con un
máximo de seis saltos, incluyendo los nombres de usuario de cada nodo del camino y el total de saltos.

#### Scenario: Existe camino dentro del alcance

- **GIVEN** que "carlos-patino" sigue a "beatriz", "beatriz" sigue a "david" y "david" sigue a
  "elena-vega"
- **WHEN** se consulta el camino entre "carlos-patina" y "elena-vega"
- **THEN** la respuesta es correcta
- **AND** la ruta contiene los cuatro usuarios en orden
- **AND** el total de saltos es tres

#### Scenario: No existe camino dentro de seis grados

- **GIVEN** que "carlos-patina" y "elena-vega" están a más de seis saltos
- **WHEN** se consulta el camino entre ambos
- **THEN** la respuesta es correcta
- **AND** la ruta viene vacía
- **AND** el total de saltos es cero
- **AND** la respuesta NO es un error

#### Scenario: El alcance es dirigido

- **GIVEN** que "elena-vega" sigue a "carlos-patina" pero "carlos-patina" NO sigue a "elena-vega"
- **WHEN** se consulta el camino de "carlos-patina" a "elena-vega"
- **THEN** la respuesta indica que no hay camino
- **AND** la respuesta no se construye con la relación inversa

#### Scenario: Origen igual a destino

- **WHEN** se consulta el camino de un usuario consigo mismo
- **THEN** la respuesta es distinguishable de una petición incompleta
- **AND** la respuesta es distinguishable de un camino encontrado

---

### Requirement: Validar los parámetros de la petición

El sistema DEBE responder con error de cliente cuando falta el origen, falta el destino, o alguno
viene vacío. NO DEBE ejecutar la consulta con un parámetro ausente.

#### Scenario: Falta el destino

- **WHEN** se consulta el camino solo con el origen
- **THEN** la respuesta es de petición incorrecta
- **AND** no se ejecuta la búsqueda de camino

#### Scenario: Parámetro vacío

- **WHEN** se consulta el camino con el destino vacío
- **THEN** la respuesta es de petición incorrecta

#### Scenario: Origen o destino inexistente

- **WHEN** se consulta el camino con un identificador que no corresponde a ningún usuario
- **THEN** la respuesta indica que no hay camino
- **AND** la respuesta no es un error de servidor

---

### Requirement: La ruta identifica cada salto

El sistema DEBE incluir el identificador de cada nodo del camino junto a su nombre de usuario, para
que la interfaz pueda representar cada salto.

#### Scenario: Cada elemento de la ruta es identificable

- **WHEN** se consulta un camino con varios saltos
- **THEN** cada elemento de la ruta trae identificador y nombre de usuario

#### Scenario: Nodo sin nombre en medio del camino

- **GIVEN** que un usuario intermedio del camino no tiene nombre cargado
- **WHEN** se consulta el camino
- **THEN** la respuesta incluye el resto de la ruta
- **AND** el nombre ausente se sustituye por un valor por defecto
- **AND** la consulta no falla en su conjunto

---

### Requirement: Ofrecer el cálculo de distancia en la interfaz

El cliente DEBE permitir solicitar el camino entre el usuario actual y un usuario elegido, y DEBE
mostrar la ruta y el total de saltos.

#### Scenario: Cálculo correcto y su presentación

- **GIVEN** que la aplicación está abierta con un usuario identificado
- **WHEN** el usuario pide la distancia a otro usuario de la tarjeta de sugerencias
- **THEN** se muestra la cadena de nombres que conecta ambos
- **AND** se muestra cuántos saltos los separan

#### Scenario: Sin conexión, resultado legítimo

- **WHEN** el usuario pide la distancia a alguien a más de seis saltos
- **THEN** la interfaz comunica que no hay conexión dentro del alcance
- **AND** no se presenta como un fallo de la aplicación

#### Scenario: Petición incompleta en la interfaz

- **WHEN** la petición no puede realizarse por falta de datos
- **THEN** la interfaz comunica el error de la petición
- **AND** no lo confunde con la ausencia de conexión
