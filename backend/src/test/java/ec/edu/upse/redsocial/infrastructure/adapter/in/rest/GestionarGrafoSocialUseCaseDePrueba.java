package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.model.SugerenciaUsuario;
import ec.edu.upse.redsocial.domain.model.Usuario;
import ec.edu.upse.redsocial.domain.port.in.GestionarGrafoSocialUseCase;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Caso de uso del grafo social, sustituido en las pruebas de recurso.
 *
 * <p>Ver {@link CrearPostUseCaseDePrueba} para el motivo: sin este sustituto, una prueba que
 * levanta el servidor se queda colgada esperando a un Neo4j que no está.
 *
 * <p>Los métodos que no son de lectura fallan a propósito con {@link
 * UnsupportedOperationException}: si alguna prueba llega a tocar el grafo por una vía de escritura,
 * que se note en el nombre del fallo en vez de devolver un valor que nadie pidió y que esconde el
 * error.
 */
@Alternative
@Priority(1)
@ApplicationScoped
public class GestionarGrafoSocialUseCaseDePrueba implements GestionarGrafoSocialUseCase {

    /**
     * Usuario de ejemplo. El correo va puesto a propósito: las pruebas comprueban que no se filtra.
     */
    private static Usuario beatriz() {
        Usuario u =
                new Usuario(
                        "beatriz-silva", "beatriz", "beatriz@upse.edu.ec", "Beatriz Silva", null);
        u.setPassword("no-debe-aparecer");
        u.setPushSubscriptionJson("{\"endpoint\":\"https://fcm/secreto\"}");
        return u;
    }

    private static Usuario persona(String id, String username, String nombre) {
        Usuario u = new Usuario(id, username, "correo@upse.edu.ec", nombre, null);
        u.setPassword("no-debe-aparecer");
        u.setPushSubscriptionJson("{\"endpoint\":\"https://fcm/secreto\"}");
        return u;
    }

    @Override
    public void registrarUsuario(Usuario usuario) {
        throw new UnsupportedOperationException("Las pruebas de recurso no registran usuarios");
    }

    @Override
    public Optional<Usuario> obtenerUsuarioPorId(String id) {
        return "beatriz-silva".equals(id) ? Optional.of(beatriz()) : Optional.empty();
    }

    @Override
    public Optional<Usuario> buscarUsuarioPorCredenciales(String emailOrUsername) {
        return Optional.empty();
    }

    @Override
    public List<Usuario> listarUsuarios() {
        return List.of(beatriz());
    }

    @Override
    public String subirAvatar(
            String userId,
            InputStream inputStream,
            long contentLength,
            String contentType,
            String extension) {
        throw new UnsupportedOperationException("Las pruebas de recurso no suben avatares");
    }

    @Override
    public void seguir(String seguidorId, String seguidoId) {
        throw new UnsupportedOperationException("Las pruebas de recurso no siguen a nadie");
    }

    @Override
    public void dejarDeSeguir(String seguidorId, String seguidoId) {
        throw new UnsupportedOperationException("Las pruebas de recurso no dejan de seguir");
    }

    @Override
    public List<SugerenciaUsuario> obtenerSugerencias(String userId) {
        return List.of();
    }

    @Override
    public List<Usuario> obtenerSeguidosEnComun(String userA, String userB) {
        return List.of(persona("david-mendoza", "david", "David Mendoza"));
    }

    @Override
    public List<Usuario> obtenerSeguidos(String userId) {
        // El visor ya sigue a Beatriz, para que el botón de "Dejar de seguir" tenga con qué estado
        // inicial y la prueba no dependa de una relación que no existe en el grafo.
        return "carlos-patino".equals(userId)
                ? List.of(persona("beatriz-silva", "beatriz", "Beatriz Silva"))
                : List.of();
    }

    @Override
    public List<Usuario> obtenerSeguidores(String userId) {
        return List.of(
                persona("carlos-patino", "carlos", "Carlos Patiño"),
                persona("elena-vega", "elena", "Elena Vega"));
    }

    @Override
    public Map<String, Object> obtenerCaminoMasCorto(String origen, String destino) {
        return Map.of("rutaConexion", List.of(), "saltosTotales", 0);
    }
}
