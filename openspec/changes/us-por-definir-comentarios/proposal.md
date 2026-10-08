# Proposal: US (por definir) — Comentarios en publicaciones con respuestas y likes

> **Ticket Linear**: pendiente de verificar en Linear antes de crear la tarjeta. No se deduce de acá
> (misma regla que US-13 y US-14). Última referencia conocida: `TUX-71` (US-14).
> **Card backlog**: sin card en `docs/backlog-programadores.md`; nace como las tres anteriores.
> **Rama**: `feature/US-por-definir-comentarios`
> **Épica**: Contenido / Interacciones · **Dominio canónico**: `comments` · **Depende de**: US-04 (post
> existe) y US-06 (patrón de reacciones idempotentes).

## Intención

El botón **Comentar** de `PostCard` existe hoy sin comportamiento (`PostCard.tsx:274-278`). Esta
historia lo conecta a un modal con la publicación a la izquierda (o arriba en móvil) y el hilo de
comentarios a la derecha, con scroll, de forma que se pueda:

1. **Ver** los comentarios de una publicación sin salir del feed, con su autor y fecha.
2. **Escribir** un comentario de primer nivel.
3. **Responder** a un comentario existente (un solo nivel de anidación, como Instagram web).
4. **Dar y quitar like** a un comentario, de forma idempotente.

El modal reutiliza el patrón de overlay ya establecido (`GraphExplorerModal`: `fixed inset-0 z-50`,
backdrop con click para cerrar, `role="dialog"`) y el patrón optimista con reconciliación y reversión
de `PostCard`.

## Criterio de aceptación (Gherkin)

```gherkin
Dado una publicación "post-b1" visible en el feed
Cuando el usuario pulsa "Comentar" en su tarjeta
Entonces se abre un modal con la publicación y su lista de comentarios
Y al hacer scroll en el panel derecho se recorren todos los comentarios

Dado el modal de comentarios abierto
Cuando el usuario escribe "Buen aporte" y envía
Entonces el comentario aparece en la lista con su nombre y avatar
Y el grafo registra (usuario)-[:COMENTA]->(:Comentario)-[:COMENTA_EN]->(:Post {id: "post-b1"})

Dado un comentario de "beatriz" en el hilo
Cuando el usuario pulsa "Responder" y envía "De acuerdo"
Entonces la respuesta aparece anidada bajo el comentario y con parentId = <id del comentario>

Dado un comentario sin likes
Cuando el usuario pulsa el corazón
Entonces el contador sube de inmediato (optimista) y se concilia con el total del servidor
Y pulsarlo de nuevo retira el like sin bajar de cero

Dado que el servidor falla al registrar un like
Entonces el corazón y el contador vuelven al estado previo y se muestra un error
```

## Estado real

| Pieza | Estado hoy | Qué falta |
|---|---|---|
| Botón "Comentar" | Presente, sin `onClick` (`PostCard.tsx:274`) | Handler y modal |
| Nodo `:Comentario` | No existe | Modelo, Cypher y constraint |
| Endpoints de comentarios | No existen | `ComentarioResource` |
| Likes sobre comentarios | No existen | Reutilizar `[:REACCIONA {tipo:'LIKE'}]` hacia `:Comentario` |
| UI de hilo con respuestas | No existe | `ComentariosModal` |

## Alcance de este change

- Nodo `:Comentario` con `parentId` para un nivel de respuestas y relación `[:COMENTA_EN]` al `:Post`.
- Reutilización de `[:REACCIONA {tipo:'LIKE'}]` para likes de comentario (el tipo ya es genérico; las
  consultas de post están tipadas a `:Post` y no se ven afectadas).
- `GestionarComentariosUseCase` + `ComentarioApplicationService` + `ComentarioResource`.
- `ComentariosModal.tsx` y cableado del botón en `PostCard`, `FeedList`, `PerfilAjeno` y `App`.
- Tests backend (recurso con Mockito, adaptador con captura de Cypher) y frontend (Vitest).

## Fuera de alcance

- Notificaciones (in-app o push) por comentario o por like de comentario.
- Editar o borrar comentarios.
- Paginación del hilo: se devuelve una lista con tope de seguridad (500), igual criterio que el tope
  de 200 publicaciones por perfil.
- Contador de comentarios junto al botón en la tarjeta del feed: exigiría tocar la consulta del feed
  y de perfil. Se puede añadir después sin cambiar el contrato del hilo.
- Menciones (`@`) y hashtags dentro del texto del comentario: el texto se pinta tal cual.
