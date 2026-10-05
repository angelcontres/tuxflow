package ec.edu.upse.redsocial.domain.model;

/**
 * Estado completo de reacciones de un post tras una operación de like/dislike.
 *
 * <p>Es un {@code record} y no un POJO mutable como {@link Post} o {@link Usuario} porque no es una
 * entidad del grafo ni se deserializa desde la base: es una foto inmutable de dos contadores que se
 * construye en el adaptador y solo se lee hacia afuera. Sin setters no hay forma de dejarlo a medio
 * armar entre la escritura y la respuesta.
 *
 * @param totalLikes cantidad de relaciones {@code [:REACCIONA {tipo: 'LIKE'}]} del post
 * @param totalDislikes cantidad de relaciones {@code [:REACCIONA {tipo: 'DISLIKE'}]} del post
 */
public record EstadoReaccion(int totalLikes, int totalDislikes) {}
