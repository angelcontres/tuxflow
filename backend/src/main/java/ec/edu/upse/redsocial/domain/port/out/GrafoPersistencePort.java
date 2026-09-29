package ec.edu.upse.redsocial.domain.port.out;

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

    // 3. Seguidores y Conexiones en Común entre Dos Perfiles
    List<Usuario> obtenerSeguidoresEnComun(String userA, String userB);

    // 4. Grado de Separación y Camino Más Corto (Shortest Path)
    Map<String, Object> obtenerCaminoMasCorto(String origenId, String destinoId);

    // 5. Tendencias en la Red Extendida (Posts más interactuados a 1 y 2 saltos)
    List<Map<String, Object>> obtenerTendenciasRedExtendida(String userId);

    // Operaciones del Grafo
    void guardarUsuario(Usuario u);

    Optional<Usuario> obtenerUsuarioPorId(String id);

    List<Usuario> listarUsuarios();

    void actualizarAvatarUsuario(String userId, String avatarUrl);

    void seguirUsuario(String seguidorId, String seguidoId);

    void dejarDeSeguir(String seguidorId, String seguidoId);

    void crearPost(String autorId, String postId, String texto, String mediaUrl);

    void alternarLike(String userId, String postId);

    List<String> obtenerSuscripcionesPushDeSeguidores(String autorId);
}
