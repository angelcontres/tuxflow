package ec.edu.upse.redsocial.domain.port.out;

import ec.edu.upse.redsocial.domain.exception.PostNoEncontradoException;
import ec.edu.upse.redsocial.domain.model.Comentario;
import ec.edu.upse.redsocial.domain.model.ConversacionChat;
import ec.edu.upse.redsocial.domain.model.EstadoComentario;
import ec.edu.upse.redsocial.domain.model.EstadoReaccion;
import ec.edu.upse.redsocial.domain.model.MensajeChat;
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

    // Quien sigue a un perfil. Es la inversa de obtenerSeguidos: mismo par de nodos, flecha al
    // revés.
    // No es un alias de obtenerSeguidosInvertidos porque la consulta tiene su propia forma y su
    // propia
    // lista de defectos.
    List<Usuario> obtenerSeguidores(String userId);

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

    /**
     * Personas cuyo nombre o nombre de usuario contienen el texto, ya ordenadas por relevancia.
     *
     * <p>El orden lo decide esta consulta y no el cliente: la regla (coincidencia exacta de nombre
     * de usuario, luego empieza por, luego contiene, y para el nombre completo) es del servidor.
     * Devolverla sin ordenar obligaría a cada consumidor a reimplementarla.
     *
     * <p>La comparación ignora acentos y eñes en los dos lados, así que {@code "patino"} encuentra
     * a {@code "Carlos Patiño"}. El texto buscado llega sin normalizar y se normaliza aquí, porque
     * la forma normalizada del dato guardado se calcula en la propia consulta.
     *
     * @param texto lo que la persona escribió, sin normalizar
     * @param limite tope de resultados, para que el servidor pueda recortarlos
     * @return las personas que coinciden, con las mismas cuatro propiedades que las listas de
     *     seguidores y conexiones en común
     */
    List<Usuario> buscarUsuarios(String texto, long limite);

    void actualizarAvatarUsuario(String userId, String avatarUrl);

    void seguirUsuario(String seguidorId, String seguidoId);

    void dejarDeSeguir(String seguidorId, String seguidoId);

    void crearPost(String autorId, String postId, String texto, String mediaUrl);

    // Publicaciones de un autor, de la más nueva a la más antigua. `viewerId` es opcional: sin él
    // la respuesta no trae `likedByMe` porque no hay quién mirar.
    List<Post> obtenerPostsDeUsuario(String userId, String viewerId);

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

    /**
     * Conserva un mensaje de la conversación como nodo {@code :MensajeChat} enlazado a emisor y
     * destinatario.
     *
     * <p>Los dos usuarios se localizan con {@code MATCH}, nunca con {@code MERGE}: un mensaje no
     * crea las personas que lo escriben. Si alguno no existe, la consulta no devuelve filas y la
     * operación falla en vez de inventar un usuario con el identificador que se le pasó.
     *
     * <p>El mensaje llega con identificador y marca de tiempo ya fijados por el servidor.
     *
     * @throws ParticipanteNoEncontradoException si el destinatario no existe en el grafo
     */
    void guardarMensajeChat(MensajeChat mensaje);

    /**
     * Mensajes intercambiados por una pareja, en ambos sentidos y del más antiguo al más reciente.
     *
     * <p>La pareja se trata como conjunto y no como par ordenado, porque una conversación no tiene
     * dirección propia: filtrar por {@code emisor = A AND destinatario = B} devolvería el historial
     * completo para uno de los dos participantes y vacío para el otro. Ese fallo es silencioso,
     * porque la consulta responde bien y simplemente no hay burbujas que mostrar.
     *
     * @return los mensajes ordenados cronológicamente; lista vacía si la pareja nunca se escribió
     */
    List<MensajeChat> obtenerHistorialChat(String usuarioA, String usuarioB);

    /**
     * Conversaciones en las que participa un usuario, una fila por interlocutor y con el último
     * mensaje de esa pareja.
     *
     * <p>El filtro es simétrico por la misma razón que en {@link #obtenerHistorialChat}: la
     * conversación no tiene dirección, así que cuentan tanto los enviados como los recibidos. Una
     * fila por interlocutor y no un mensaje por mensaje es lo que la convierte en una bandeja en
     * vez de un historial sin filtro.
     *
     * @return las conversaciones, de la más reciente a la más antigua; lista vacía si nunca se
     *     escribió con nadie
     */
    List<ConversacionChat> obtenerConversacionesChat(String userId);

    default void eliminarSuscripcionPush(String usuarioId, String pushSubscriptionJson) {
        // Implementación por defecto: no-op hasta completar infraestructura
    }

    default void guardarSuscripcionPush(String usuarioId, String pushSubscriptionJson) {
        // Implementación por defecto: no-op hasta completar infraestructura
    }

    void guardarNotificacionInApp(
            String userId, ec.edu.upse.redsocial.domain.model.NotificacionInApp notificacion);

    List<ec.edu.upse.redsocial.domain.model.NotificacionInApp> obtenerNotificacionesInApp(
            String userId);

    long obtenerConteoNoLeidas(String userId);

    void marcarComoLeida(String userId, String notificacionId);

    List<String> obtenerSeguidoresId(String autorId);

    String obtenerAutorDePost(String postId);

    /**
     * Crea un comentario y lo devuelve completo, con autor y fecha.
     *
     * <p>El autor y la publicación se localizan con {@code MATCH}, nunca con {@code CREATE}: un
     * comentario no inventa ni a quien lo escribe ni la publicación que comenta. Si el autor o el
     * post no existen la operación falla en vez de crear contenido huérfano.
     *
     * <p>{@code parentId} es opcional. Cuando llega, tiene que apuntar a un comentario de primer
     * nivel colgado de la misma publicación; si no, se rechaza como {@link
     * ec.edu.upse.redsocial.domain.exception.ComentarioNoEncontradoException}.
     *
     * @throws ec.edu.upse.redsocial.domain.exception.AutorNoEncontradoException si el autor no
     *     existe
     * @throws PostNoEncontradoException si la publicación no existe
     * @throws ec.edu.upse.redsocial.domain.exception.ComentarioNoEncontradoException si el padre no
     *     es válido
     */
    Comentario crearComentario(
            String autorId, String comentarioId, String postId, String texto, String parentId);

    /**
     * Comentarios de una publicación, del más antiguo al más reciente.
     *
     * <p>{@code viewerId} es opcional y sólo cambia {@code likedByMe}; los totales no dependen de
     * quién mira.
     */
    List<Comentario> obtenerComentariosDePost(String postId, String viewerId);

    /**
     * Registra {@code [:REACCIONA {tipo:'LIKE'}]} de un usuario hacia un comentario, idempotente.
     *
     * <p>Reutiliza el mismo tipo de relación que los posts: el label del nodo destino distingue el
     * objetivo y todas las consultas de posts ya están tipadas a {@code :Post}. No hay dislike de
     * comentarios, así que no hay reacción contraria que limpiar.
     *
     * @return el total de likes tras registrar
     * @throws ec.edu.upse.redsocial.domain.exception.ComentarioNoEncontradoException si no existe
     */
    EstadoComentario registrarLikeComentario(String userId, String comentarioId);

    /**
     * Retira el like de un comentario. Idempotente: retirar lo que no existe (o sobre un comentario
     * inexistente) devuelve el estado en ceros sin lanzar excepción.
     */
    EstadoComentario retirarLikeComentario(String userId, String comentarioId);
}
