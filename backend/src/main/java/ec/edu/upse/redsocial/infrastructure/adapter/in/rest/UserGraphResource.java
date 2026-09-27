package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.model.Usuario;
import ec.edu.upse.redsocial.domain.port.in.GestionarGrafoSocialUseCase;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;

@Path("/api/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserGraphResource {

    @Inject GestionarGrafoSocialUseCase gestionarGrafoSocialUseCase;

    @POST
    public Response registrarUsuario(Usuario usuario) {
        gestionarGrafoSocialUseCase.registrarUsuario(usuario);
        return Response.status(Response.Status.CREATED).entity(usuario).build();
    }

    @POST
    @Path("/{seguidorId}/follow/{seguidoId}")
    public Response seguirUsuario(
            @PathParam("seguidorId") String seguidorId, @PathParam("seguidoId") String seguidoId) {
        gestionarGrafoSocialUseCase.seguir(seguidorId, seguidoId);
        return Response.ok(Map.of("mensaje", "Usuario seguido exitosamente")).build();
    }

    @DELETE
    @Path("/{seguidorId}/follow/{seguidoId}")
    public Response dejarDeSeguir(
            @PathParam("seguidorId") String seguidorId, @PathParam("seguidoId") String seguidoId) {
        gestionarGrafoSocialUseCase.dejarDeSeguir(seguidorId, seguidoId);
        return Response.ok(Map.of("mensaje", "Has dejado de seguir al usuario")).build();
    }

    @GET
    @Path("/{userId}/sugerencias")
    public Response obtenerSugerencias(@PathParam("userId") String userId) {
        return Response.ok(gestionarGrafoSocialUseCase.obtenerSugerencias(userId)).build();
    }

    @GET
    @Path("/comunes")
    public Response obtenerSeguidoresEnComun(
            @QueryParam("userA") String userA, @QueryParam("userB") String userB) {
        return Response.ok(gestionarGrafoSocialUseCase.obtenerSeguidoresEnComun(userA, userB))
                .build();
    }

    @GET
    @Path("/camino-corto")
    public Response obtenerCaminoMasCorto(
            @QueryParam("origen") String origen, @QueryParam("destino") String destino) {
        return Response.ok(gestionarGrafoSocialUseCase.obtenerCaminoMasCorto(origen, destino))
                .build();
    }
}
