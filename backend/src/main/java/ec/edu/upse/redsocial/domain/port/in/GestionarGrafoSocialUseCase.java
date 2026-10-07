package ec.edu.upse.redsocial.domain.port.in;

import ec.edu.upse.redsocial.domain.model.SugerenciaUsuario;
import ec.edu.upse.redsocial.domain.model.Usuario;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public interface GestionarGrafoSocialUseCase {
    void registrarUsuario(Usuario usuario);

    Optional<Usuario> obtenerUsuarioPorId(String id);

    Optional<Usuario> buscarUsuarioPorCredenciales(String emailOrUsername);

    /**
     * Personas que se pueden encontrar escribiendo su nombre o su nombre de usuario.
     *
     * <p>Devuelve la lista ya ordenada por relevancia y limitada. El mínimo de caracteres se
     * comprueba en el borde REST, no aquí: es una regla de la petición, como lo son los parámetros
     * de {@code /comunes}.
     */
    List<Usuario> buscarUsuarios(String texto);

    String subirAvatar(
            String userId,
            InputStream inputStream,
            long contentLength,
            String contentType,
            String extension);

    void seguir(String seguidorId, String seguidoId);

    void dejarDeSeguir(String seguidorId, String seguidoId);

    List<SugerenciaUsuario> obtenerSugerencias(String userId);

    // Las personas que ambos usuarios siguen, no quienes los siguen a ambos
    List<Usuario> obtenerSeguidosEnComun(String userA, String userB);

    List<Usuario> obtenerSeguidos(String userId);

    // Las personas que siguen a este perfil, no las que sigue
    List<Usuario> obtenerSeguidores(String userId);

    Map<String, Object> obtenerCaminoMasCorto(String origen, String destino);
}
