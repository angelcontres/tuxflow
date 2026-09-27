# Proposal: US-04 (TUX-54) — Crear publicación con multimedia desacoplada en S3

> **Ticket Linear**: `TUX-54` — US-04: Create post with decoupled S3 multimedia · Sprint 1 · 3 SP · P0 Must
> **Card backlog**: `TUX-03` en `docs/backlog-programadores.md` línea 161
> **Rama**: `feature/US-04-crear-post-s3`
> **Épica**: Contenido · **Dominio canónico**: `post-management` · **Asignado**: Angel Villon

## Intención

Como creador de contenido, quiero publicar texto acompañado opcionalmente de imágenes almacenadas en
MinIO S3, guardando la metadata y la relación `(:Usuario)-[:PUBLICA]->(:Post)` en Neo4j.

## Criterio de aceptación (Gherkin)

```gherkin
Dado que el autor "carlos-patino" envía texto y una URL válida de imagen
Cuando se ejecuta POST /api/posts
Entonces se genera un UUID para el post, se crea el nodo (:Post) con fechaCreacion
Y se enlaza atómicamente al nodo (:Usuario) mediante la relación [:PUBLICA].
```

## Estado real: la historia está construida casi entera

### Backend — completo, salvo la garantía de atomicidad

| Entregable de TUX-54 | Ubicación | Estado |
|---|---|---|
| Caso de uso | `CrearPostUseCase.crearPost()` | **Completo** |
| Servicio de aplicación | `PostApplicationService.crearPost()` | **Completo** |
| Inbound `POST /api/posts` | `PostResource.crearPost()` | **Completo en forma, sin validación** |
| Outbound `crearPost()` | `Neo4jGrafoAdapter:230` | **Completo** |
| `MinioS3StorageAdapter` | `infrastructure/adapter/out/s3/` | **Existe, fuera de la ruta de creación** |

La generación del UUID, el nodo `(:Post)` con `fechaCreacion` y la relación `[:PUBLICA]` ya están
implementados y coinciden con el criterio de aceptación:

```cypher
MATCH (u:Usuario {id: $autorId})
CREATE (p:Post { id: $postId, texto: $texto, mediaUrl: $mediaUrl, fechaCreacion: datetime().epochMillis })
CREATE (u)-[:PUBLICA]->(p)
```

MinIO no participa en la creación. El criterio dice *"envía texto y una URL válida de imagen"*: el cliente
entrega la URL ya resuelta, y el adaptador de S3 sirve el archivo en otra historia.

### Frontend — completo, salvo el preview

| Entregable de TUX-54 | Estado | Detalle |
|---|---|---|
| Componente `CreatePostForm.tsx` | **Completo** | 97 líneas, montado en `App.tsx:47` |
| Manejador de estado | **Completo** | `texto`, `mediaUrl`, `submitting` |
| Disparo de `onPostCreated` | **Completo** | `App.tsx:50` lo enlaza a `loadAllData` |
| **Preview de imagen multimedia** | **Hueco** | Solo existe el campo de texto para la URL. No hay previsualización |

## Los tres huecos reales

### H1 — La API reporta éxito cuando no creó nada

`PostResource.crearPost()` no valida nada: el archivo tiene **cero guards** sobre `autorId` y `texto`.

La consulta Cypher es orientada a filas. Si `MATCH (u:Usuario {id: $autorId})` no encuentra al autor, las
cláusulas `CREATE` se ejecutan sobre cero filas y **no crean nada**. Pero el recurso responde igual:

```java
return Response.status(Response.Status.CREATED)
        .entity(Map.of("id", postId, "mensaje", "Publicación creada con éxito"))
        .build();
```

El resultado es un **201 con un UUID que no existe en la base**. El frontend lo trata como éxito, limpia
el formulario y refresca el muro, y la publicación simplemente nunca aparece. Esto incumple la segunda
línea del criterio de aceptación: nada garantiza el enlace, solo se promete.

### H2 — No hay preview de la imagen

El entregable *"State handler and multimedia image preview"* está a medias. El usuario escribe una URL a
ciegas, sin saber si la imagen carga ni a qué se está referenciando.

### H3 — Clase `pl-13` inválida

El campo de multimedia usa `pl-13`, que no existe en la escala de Tailwind. No producepadding, así que la
URL queda desalineada respecto del `textarea` que está arriba.

## Alcance de este change

- `PostResource.java`: validación de entrada y respuesta de error honesta.
- `CreatePostForm.tsx`: preview de imagen y corrección de `pl-13`.

## Fuera de alcance

- **Subida real a MinIO.** El criterio de aceptación entrega una URL, no un archivo. La subida binaria es
  de US-01, que ya cubre avatares.
- **Authenticación de `autorId`.** Hoy viaja hardcodeado desde `App.tsx`. Se resuelve con US-01.
- US-06 (reacciones) y US-11 (tendencias), que comparten el puerto `CrearPostUseCase` pero no la ruta de
  creación.
- El adaptador Web Push, que se invoca desde `crearPost()` pero hoy es un stub que solo registra logs.
