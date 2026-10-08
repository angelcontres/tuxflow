package ec.edu.upse.redsocial.domain.model;

/**
 * Estado de los likes de un comentario tras registrar o retirar uno.
 *
 * <p>Es un record inmutable, igual que {@link EstadoReaccion}: es una foto de sólo lectura que el
 * adaptador construye y el recurso serializa. Los comentarios no tienen dislike, así que a
 * diferencia de {@code EstadoReaccion} no hay total contrario que devolver.
 *
 * <p>{@code likedByMe} viaja aunque se conozca de antemano (registrar deja {@code true}, retirar
 * {@code false}): la respuesta pasa a ser el estado completo autodescriptivo y el cliente no tiene
 * que deducirlo del verbo que llamó.
 */
public record EstadoComentario(int totalLikes, boolean likedByMe) {}
