package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.model.Post;
import ec.edu.upse.redsocial.domain.port.in.ObtenerFeedUseCase;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;

@Path("/api/feed")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class FeedResource {

    @Inject ObtenerFeedUseCase obtenerFeedUseCase;

    @GET
    @Path("/{userId}")
    public Response obtenerFeed(@PathParam("userId") String userId) {
        List<Post> feed = obtenerFeedUseCase.ejecutar(userId);
        return Response.ok(feed).build();
    }
}
