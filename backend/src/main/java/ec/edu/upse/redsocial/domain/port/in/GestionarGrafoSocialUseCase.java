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

    List<Usuario> listarUsuarios();

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

    Map<String, Object> obtenerCaminoMasCorto(String origen, String destino);
}
