package ec.edu.upse.redsocial.application.service;

import ec.edu.upse.redsocial.domain.model.SugerenciaUsuario;
import ec.edu.upse.redsocial.domain.model.Usuario;
import ec.edu.upse.redsocial.domain.port.in.GestionarGrafoSocialUseCase;
import ec.edu.upse.redsocial.domain.port.out.GrafoPersistencePort;
import ec.edu.upse.redsocial.domain.port.out.StorageMultimediaPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@ApplicationScoped
public class UserGraphApplicationService implements GestionarGrafoSocialUseCase {

    @Inject GrafoPersistencePort grafoPersistencePort;
    @Inject StorageMultimediaPort storageMultimediaPort;

    @Override
    public void registrarUsuario(Usuario usuario) {
        grafoPersistencePort.guardarUsuario(usuario);
    }

    @Override
    public Optional<Usuario> obtenerUsuarioPorId(String id) {
        return grafoPersistencePort.obtenerUsuarioPorId(id);
    }

    @Override
    public List<Usuario> listarUsuarios() {
        return grafoPersistencePort.listarUsuarios();
    }

    @Override
    public String subirAvatar(
            String userId,
            InputStream inputStream,
            long contentLength,
            String contentType,
            String extension) {
        String avatarUrl =
                storageMultimediaPort.subirArchivo(
                        inputStream, contentLength, contentType, extension);
        if (userId != null && !userId.isBlank()) {
            grafoPersistencePort.actualizarAvatarUsuario(userId, avatarUrl);
        }
        return avatarUrl;
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
