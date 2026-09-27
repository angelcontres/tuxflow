package ec.edu.upse.redsocial.domain.port.in;

import ec.edu.upse.redsocial.domain.model.SugerenciaUsuario;
import ec.edu.upse.redsocial.domain.model.Usuario;
import java.util.List;
import java.util.Map;

public interface GestionarGrafoSocialUseCase {
    void registrarUsuario(Usuario usuario);

    void seguir(String seguidorId, String seguidoId);

    void dejarDeSeguir(String seguidorId, String seguidoId);

    List<SugerenciaUsuario> obtenerSugerencias(String userId);

    List<Usuario> obtenerSeguidoresEnComun(String userA, String userB);

    Map<String, Object> obtenerCaminoMasCorto(String origen, String destino);
}
