package ec.edu.upse.redsocial.domain.port.out;

import ec.edu.upse.redsocial.domain.exception.PostNoEncontradoException;
import ec.edu.upse.redsocial.domain.model.EstadoReaccion;
import ec.edu.upse.redsocial.domain.model.Post;
import ec.edu.upse.redsocial.domain.model.SugerenciaUsuario;
import ec.edu.upse.redsocial.domain.model.Usuario;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface GrafoPersistencePort {
    // 1. Feed Cronológico Filtrado por Grafo Social (2 Saltos)
    List<Post> obtenerFeedCronologico(String userId);

    // 2. Algoritmo de Sugerencia de Usuarios (2do Grado)
    List<SugerenciaUsuario> obtenerSugerenciasUsuarios(String userId);

    List<Usuario> obtenerSeguidos(String userId);

    // 3. Seguidos en común entre dos perfiles: las personas que ambos siguen
    List<Usuario> obtenerSeguidosEnComun(String userA, String userB);

    // 4. Grado de Separación y Camino Más Corto (Shortest Path)
    Map<String, Object> obtenerCaminoMasCorto(String origenId, String destinoId);

    // 5. Tendencias en la Red Extendida (Posts más interactuados a 1 y 2 saltos)
    List<Map<String, Object>> obtenerTendenciasRedExtendida(String userId);

    // Operaciones del Grafo
    void guardarUsuario(Usuario u);

    Optional<Usuario> obtenerUsuarioPorId(String id);

    // Busca por email o username incluyendo el password (uso exclusivo de autenticación)
    Optional<Usuario> buscarUsuarioPorCredenciales(String emailOrUsername);

    List<Usuario> listarUsuarios();

    void actualizarAvatarUsuario(String userId, String avatarUrl);

    void seguirUsuario(String seguidorId, String seguidoId);

    void dejarDeSeguir(String seguidorId, String seguidoId);

    void crearPost(String autorId, String postId, String texto, String mediaUrl);

    /**
     * Registra la relación {@code [:REACCIONA {tipo: 'LIKE'}]} de forma idempotente y devuelve el
     * estado completo de reacciones del post, para que la UI pueda conciliar ambos contadores con
     * la realidad.
     *
     * <p>Like y dislike son mutuamente excluyentes por par (usuario, post): registrar el like
     * elimina en la misma transacción cualquier dislike previo de ese usuario hacia ese post.
     * Repetir la operación no crea una segunda relación ni cambia la fecha original.
     *
     * @return los totales de likes y dislikes tras registrar la nueva reacción
     * @throws PostNoEncontradoException si el usuario o la publicación no existen
     */
    EstadoReaccion registrarLike(String userId, String postId);

    /**
     * Registra la relación {@code [:REACCIONA {tipo: 'DISLIKE'}]} de forma idempotente y devuelve
     * el estado completo de reacciones del post, espejo exacto de {@link #registrarLike}.
     *
     * <p>Registrar el dislike elimina en la misma transacción cualquier like previo de ese usuario
     * hacia ese post.
     *
     * @return los totales de likes y dislikes tras registrar la nueva reacción
     * @throws PostNoEncontradoException si el usuario o la publicación no existen
     */
    EstadoReaccion registrarDislike(String userId, String postId);

    /**
     * Borra la relación {@code [:REACCIONA {tipo: 'LIKE'}]} y devuelve el estado completo de
     * reacciones del post. Idempotente: si no había reacción devuelve el estado sin cambios y sin
     * lanzar excepción (también cuando el post no existe).
     *
     * <p>La retirada no toca la reacción contraria: como registro y limpieza ya son excluyentes, no
     * hay nada que tocar.
     *
     * @return los totales de likes y dislikes tras borrar la reacción
     */
    EstadoReaccion retirarLike(String userId, String postId);

    /**
     * Borra la relación {@code [:REACCIONA {tipo: 'DISLIKE'}]} y devuelve el estado completo de
     * reacciones del post. Idempotente, con la misma garantía que {@link #retirarLike}.
     *
     * @return los totales de likes y dislikes tras borrar la reacción
     */
    EstadoReaccion retirarDislike(String userId, String postId);

    List<String> obtenerSuscripcionesPushDeSeguidores(String autorId);
}
