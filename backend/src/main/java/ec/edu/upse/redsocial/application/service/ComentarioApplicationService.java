package ec.edu.upse.redsocial.application.service;

import ec.edu.upse.redsocial.domain.model.Comentario;
import ec.edu.upse.redsocial.domain.model.EstadoComentario;
import ec.edu.upse.redsocial.domain.port.in.GestionarComentariosUseCase;
import ec.edu.upse.redsocial.domain.port.out.GrafoPersistencePort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class ComentarioApplicationService implements GestionarComentariosUseCase {

    @Inject GrafoPersistencePort grafoPersistencePort;

    @Override
    public Comentario crearComentario(String userId, String postId, String texto, String parentId) {
        // El identificador lo fija el servidor y no el cliente: si viniera del borde, dos
        // peticiones
        // repetidas de un cliente defectuoso podrían reutilizar el mismo id y pisarse.
        String comentarioId = UUID.randomUUID().toString();
        return grafoPersistencePort.crearComentario(userId, comentarioId, postId, texto, parentId);
    }

    @Override
    public List<Comentario> obtenerComentarios(String postId, String viewerId) {
        return grafoPersistencePort.obtenerComentariosDePost(postId, viewerId);
    }

    @Override
    public EstadoComentario likeComentario(String userId, String comentarioId) {
        return grafoPersistencePort.registrarLikeComentario(userId, comentarioId);
    }

    @Override
    public EstadoComentario quitarLikeComentario(String userId, String comentarioId) {
        return grafoPersistencePort.retirarLikeComentario(userId, comentarioId);
    }
}
