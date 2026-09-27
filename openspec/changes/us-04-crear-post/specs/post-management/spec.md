# Specifications: US-04 (TUX-54) — Crear publicación con multimedia en S3

> **Ticket Linear**: `TUX-54` · **Card backlog**: `TUX-03` · **Dominio**: `post-management`
> **Delta**: todos los requisitos son `ADDED`

---

### Requirement: Crear una publicación enlazada a su autor

El sistema DEBE generar un identificador único para la publicación, crear el nodo `(:Post)` con su fecha de
creación y enlazarlo mediante `[:PUBLICA]` al nodo `(:Usuario)` del autor. La respuesta solo debe indicar
creación exitosa si el nodo y el enlace existen.

#### Scenario: Publicación creada con enlace a su autor

- **GIVEN** que existe el usuario "carlos-patino"
- **WHEN** se envía `POST /api/posts` con `autorId` "carlos-patino", texto y una URL de imagen
- **THEN** se genera un UUID para la publicación
- **AND** se crea el nodo `(:Post)` con `fechaCreacion`
- **AND** se crea la relación `(:Usuario)-[:PUBLICA]->(:Post)`
- **AND** la respuesta es `201` con el identificador

#### Scenario: El autor no existe

- **GIVEN** que no existe ningún usuario con el identificador enviado
- **WHEN** se envía `POST /api/posts` con ese `autorId`
- **THEN** la respuesta NO es `201`
- **AND** no se crea ningún nodo `(:Post)` sin autor

---

### Requirement: Rechazar publicaciones con datos incompletos

El sistema DEBE rechazar con `400` cualquier publicación cuyo `autorId` o `texto` sea nulo, vacío o contenga
solo espacios, y no debe crear nada en ese caso.

#### Scenario: Falta el texto

- **GIVEN** que se envía `autorId` válido y texto vacío
- **WHEN** se ejecuta `POST /api/posts`
- **THEN** la respuesta es `400`
- **AND** no se crea ninguna publicación

#### Scenario: El texto es solo espacios

- **GIVEN** que se envía `autorId` válido y un texto formado únicamente por espacios
- **WHEN** se ejecuta `POST /api/posts`
- **THEN** la respuesta es `400`
- **AND** no se crea ninguna publicación

#### Scenario: Falta el autor

- **GIVEN** que se envía texto válido y un `autorId` vacío
- **WHEN** se ejecuta `POST /api/posts`
- **THEN** la respuesta es `400`
- **AND** no se crea ninguna publicación

---

### Requirement: Previsualizar la imagen adjunta

El sistema DEBE mostrar una previsualización de la imagen referenciada por la URL de multimedia mientras el
autor está escribiendo la publicación, y DEBE manejar el caso en que la imagen no cargue.

#### Scenario: La previsualización aparece

- **GIVEN** que el autor escribió una URL en el campo de multimedia
- **WHEN** la imagen se carga correctamente
- **THEN** se muestra la previsualización junto al campo

#### Scenario: La previsualización se retira

- **GIVEN** que el autorBorra la URL del campo de multimedia
- **WHEN** el campo queda vacío
- **THEN** la previsualización desaparece

#### Scenario: La imagen no carga

- **GIVEN** que el autor escribió una URL que el navegador no puede cargar
- **WHEN** se intenta mostrar la previsualización
- **THEN** la previsualización no se muestra
- **AND** el formulario sigue siendo utilizable

---

### Requirement: Publicación sin multimedia

El sistema DEBE permitir crear una publicación sin imagen adjunta, y la ausencia de multimedia no debe ser
un error.

#### Scenario: Publicación solo de texto

- **GIVEN** que el autor escribe texto y no completa la URL de multimedia
- **WHEN** se envía `POST /api/posts`
- **THEN** la publicación se crea con el mismo enlace `[:PUBLICA]`
- **AND** el campo de multimedia queda vacío
