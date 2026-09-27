package ec.edu.upse.redsocial.application.service;

import ec.edu.upse.redsocial.domain.model.Post;
import ec.edu.upse.redsocial.domain.port.in.ObtenerFeedUseCase;
import ec.edu.upse.redsocial.domain.port.out.GrafoPersistencePort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;

@ApplicationScoped
public class FeedApplicationService implements ObtenerFeedUseCase {

    @Inject GrafoPersistencePort grafoPersistencePort;

    @Override
    public List<Post> ejecutar(String userId) {
        return grafoPersistencePort.obtenerFeedCronologico(userId);
    }
}
