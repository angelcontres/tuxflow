package ec.edu.upse.redsocial.application.service;

import ec.edu.upse.redsocial.domain.model.SugerenciaUsuario;
import ec.edu.upse.redsocial.domain.model.Usuario;
import ec.edu.upse.redsocial.domain.port.in.GestionarGrafoSocialUseCase;
import ec.edu.upse.redsocial.domain.port.out.GrafoPersistencePort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Map;

@ApplicationScoped
public class UserGraphApplicationService implements GestionarGrafoSocialUseCase {

    @Inject GrafoPersistencePort grafoPersistencePort;

    @Override
    public void registrarUsuario(Usuario usuario) {
        grafoPersistencePort.guardarUsuario(usuario);
    }

    @Override
    public void seguir(String seguidorId, String seguidoId) {
        grafoPersistencePort.seguirUsuario(seguidorId, seguidoId);
    }

    @Override
    public void dejarDeSeguir(String seguidorId, String seguidoId) {
        grafoPersistencePort.dejarDeSeguir(seguidorId, seguidoId);
    }

    @Override
    public List<SugerenciaUsuario> obtenerSugerencias(String userId) {
        return grafoPersistencePort.obtenerSugerenciasUsuarios(userId);
    }

    @Override
    public List<Usuario> obtenerSeguidoresEnComun(String userA, String userB) {
        return grafoPersistencePort.obtenerSeguidoresEnComun(userA, userB);
    }

    @Override
    public Map<String, Object> obtenerCaminoMasCorto(String origen, String destino) {
        return grafoPersistencePort.obtenerCaminoMasCorto(origen, destino);
    }
}
