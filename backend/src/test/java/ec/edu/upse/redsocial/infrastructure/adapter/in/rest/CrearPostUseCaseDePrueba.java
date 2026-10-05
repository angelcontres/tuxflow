package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.model.EstadoReaccion;
import ec.edu.upse.redsocial.domain.model.Post;
import ec.edu.upse.redsocial.domain.port.in.CrearPostUseCase;
import jakarta.annotation.Priority;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Alternative;
import java.util.List;

/**
 * Caso de uso de publications, sustituido en las pruebas de recurso.
 *
 * <p>Es un {@link Alternative} de CDI, no un mock: no hace falta ninguna biblioteca de mocks, que
 * además no se puede resolver en esta máquina porque el build corre sin Maven Central.
 *
 * <p>Existe por un motivo concreto. {@code PerfilAjenoRutasIT} levanta el servidor de Quarkus y
 * pregunta por URL, y si el caso de uso real estuviera detrás el adaptador intentaría abrir una
 * sesión contra Neo4j en {@code localhost:7687}. Sin base de datos, el driver no falla rápido:
 * reintenta hasta agotar su timeout de conexión, la petición HTTP se queda colgada y la prueba
 * falla con {@code SocketTimeout} en lugar de comprobar la ruta. Un test de rutas no debería
 * depender de que haya un grafo.
 *
 * <p>La alternativa --poner un tiempo de conexión corto en la configuración de pruebas-- deja la
 * prueba dependente de un valor de configuración y dependiente de que el grafo esté o no. Con un
 * sustituto no hay grafo, ni dependencias, ni esperas.
 */
@Alternative
@Priority(1)
@ApplicationScoped
public class CrearPostUseCaseDePrueba implements CrearPostUseCase {

    @Override
    public String crearPost(String autorId, String autorUsername, String texto, String mediaUrl) {
        return "post-de-prueba";
    }

    @Override
    public EstadoReaccion reaccionarPost(String userId, String postId) {
        throw new UnsupportedOperationException("Las pruebas de recurso no reaccionan a posts");
    }

    @Override
    public EstadoReaccion reaccionarDislike(String userId, String postId) {
        throw new UnsupportedOperationException("Las pruebas de recurso no reaccionan a posts");
    }

    @Override
    public EstadoReaccion quitarLike(String userId, String postId) {
        throw new UnsupportedOperationException("Las pruebas de recurso no reaccionan a posts");
    }

    @Override
    public EstadoReaccion quitarDislike(String userId, String postId) {
        throw new UnsupportedOperationException("Las pruebas de recurso no reaccionan a posts");
    }

    @Override
    public Object obtenerTendencias(String userId) {
        return List.of();
    }

    @Override
    public List<Post> obtenerPostsDeUsuario(String autorId, String viewerId) {
        // Se devuelven dos publicaciones para poder comprobar el orden y la forma de la respuesta,
        // y con `autorId` igual al identificador pedido para que la comprobación de "no se enlaza
        // al
        // perfil que ya se mira" tenga un caso real.
        Post antigua = post("post-1", "La más antigua", 1727260000000L, autorId);
        Post nueva = post("post-2", "La más nueva", 1727270000000L, autorId);
        return List.of(nueva, antigua);
    }

    private static Post post(String id, String texto, long fecha, String autorId) {
        Post p = new Post();
        p.setId(id);
        p.setTexto(texto);
        p.setFechaCreacion(fecha);
        p.setAutorId(autorId);
        p.setAutorUsername("beatriz");
        p.setTotalLikes(3);
        p.setTotalDislikes(1);
        p.setLikedByMe(true);
        p.setDislikedByMe(false);
        return p;
    }
}
