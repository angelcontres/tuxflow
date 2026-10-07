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

    /**
     * Tope de resultados de la búsqueda.
     *
     * <p>El límite lo decide el servidor y no el cliente por dos razones: una búsqueda con dos
     * caracteres puede pedir el mismo recorte que con veinte y no tiene por qué conocer el tope, y
     * el número no es un parámetro de la petición, así que nadie puede subirlo desde fuera.
     *
     * <p>Veinte es suficiente para la lista corta que espera quien escribe en el buscador. Con más,
     * la búsqueda dejaría de ser una búsqueda y volvería a ser el directorio con filtro que US-14
     * cierra.
     */
    private static final long LIMITE_BUSQUEDA = 20;

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
    public List<Usuario> buscarUsuarios(String texto) {
        return grafoPersistencePort.buscarUsuarios(texto, LIMITE_BUSQUEDA);
    }

    @Override
    public Optional<Usuario> buscarUsuarioPorCredenciales(String emailOrUsername) {
        return grafoPersistencePort.buscarUsuarioPorCredenciales(emailOrUsername);
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
    public List<Usuario> obtenerSeguidos(String userId) {
        return grafoPersistencePort.obtenerSeguidos(userId);
    }

    @Override
    public List<Usuario> obtenerSeguidores(String userId) {
        return grafoPersistencePort.obtenerSeguidores(userId);
    }

    @Override
    public List<Usuario> obtenerSeguidosEnComun(String userA, String userB) {
        return grafoPersistencePort.obtenerSeguidosEnComun(userA, userB);
    }

    @Override
    public Map<String, Object> obtenerCaminoMasCorto(String origen, String destino) {
        return grafoPersistencePort.obtenerCaminoMasCorto(origen, destino);
    }
}
