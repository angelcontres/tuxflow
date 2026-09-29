package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.model.Usuario;
import ec.edu.upse.redsocial.domain.port.in.GestionarGrafoSocialUseCase;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.Map;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

@Path("/api/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserGraphResource {

    @Inject GestionarGrafoSocialUseCase gestionarGrafoSocialUseCase;

    @GET
    public Response listarUsuarios() {
        return Response.ok(gestionarGrafoSocialUseCase.listarUsuarios()).build();
    }

    @GET
    @Path("/{userId}")
    public Response obtenerUsuarioPorId(@PathParam("userId") String userId) {
        return gestionarGrafoSocialUseCase
                .obtenerUsuarioPorId(userId)
                .map(u -> Response.ok(u).build())
                .orElse(Response.status(Response.Status.NOT_FOUND).build());
    }

    @POST
    public Response registrarUsuario(Usuario usuario) {
        if (usuario == null
                || usuario.getId() == null
                || usuario.getId().isBlank()
                || usuario.getUsername() == null
                || usuario.getUsername().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Los campos 'id' y 'username' son obligatorios."))
                    .build();
        }
        gestionarGrafoSocialUseCase.registrarUsuario(usuario);
        return Response.status(Response.Status.CREATED).entity(usuario).build();
    }

    @POST
    @Path("/avatar")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response subirAvatarSinUsuario(@RestForm("file") FileUpload file) {
        return procesarSubidaAvatar(null, file);
    }

    @POST
    @Path("/{userId}/avatar")
    @Consumes(MediaType.MULTIPART_FORM_DATA)
    public Response subirAvatarUsuario(
            @PathParam("userId") String userId, @RestForm("file") FileUpload file) {
        return procesarSubidaAvatar(userId, file);
    }

    private Response procesarSubidaAvatar(String userId, FileUpload file) {
        if (file == null || file.uploadedFile() == null) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "No se proporcionó ningún archivo de imagen."))
                    .build();
        }
        try (InputStream is = Files.newInputStream(file.uploadedFile())) {
            String fileName = file.fileName() != null ? file.fileName() : "avatar.jpg";
            String extension =
                    fileName.contains(".")
                            ? fileName.substring(fileName.lastIndexOf("."))
                            : ".jpg";
            String contentType =
                    file.contentType() != null ? file.contentType() : "image/jpeg";
            String avatarUrl =
                    gestionarGrafoSocialUseCase.subirAvatar(
                            userId, is, file.size(), contentType, extension);
            return Response.ok(Map.of("avatarUrl", avatarUrl)).build();
        } catch (Exception e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("error", "Error al procesar avatar: " + e.getMessage()))
                    .build();
        }
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
