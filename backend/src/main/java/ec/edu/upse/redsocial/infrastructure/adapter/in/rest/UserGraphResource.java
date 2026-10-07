package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.model.Usuario;
import ec.edu.upse.redsocial.domain.port.in.GestionarGrafoSocialUseCase;
import ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto.UsuarioPublicoResponse;
import ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto.UsuarioRequest;
import ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto.UsuarioResponse;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.InputStream;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;
import org.jboss.logging.Logger;
import org.jboss.resteasy.reactive.RestForm;
import org.jboss.resteasy.reactive.multipart.FileUpload;

@Path("/api/users")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class UserGraphResource {

    private static final Logger LOG = Logger.getLogger(UserGraphResource.class);

    @Inject GestionarGrafoSocialUseCase gestionarGrafoSocialUseCase;

    /**
     * Búsqueda de personas por nombre o nombre de usuario (US-14).
     *
     * <p>La ruta compite con {@code /{userId}}, y por eso hay una prueba sobre HTTP real que la
     * comprueba: en RESTEasy Reactive el segmento literal gana al de plantilla, así que resuelve
     * bien, pero eso no se verifica leyendo el código sino levantando el servidor.
     *
     * <p>Responde {@link UsuarioPublicoResponse} y no {@link UsuarioResponse}: la búsqueda es la
     * lectura más amplia de la comunidad que tiene la API —cualquiera que adivine dos letras puede
     * preguntar por todos—, así que la respuesta es la más estrecha posible. El correo no se busca
     * ni se devuelve: buscarlo convertiría el endpoint en un oráculo de "este correo existe en la
     * comunidad".
     */
    @GET
    @Path("/buscar")
    public Response buscarUsuarios(@QueryParam("q") String q) {
        // El mínimo de dos caracteres se comprueba aquí y no sólo en el navegador, por el mismo
        // motivo que /comunes valida sus parámetros: un cliente puede ser cualquiera, y una
        // mitigación que sólo existe en el frontend no mitiga nada contra un curl. Con un carácter,
        // "a" devuelve casi toda la comunidad y el endpoint es un GET /api/users con otro nombre.
        //
        // Y responde 400 y no la lista vacía: una llamada mal formada no puede parecerse a "no hay
        // nadie", porque el cliente no tiene forma de distinguirlas y pintaría un resultado que no
        // es un resultado.
        if (q == null || q.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "El campo 'q' es obligatorio"))
                    .build();
        }
        if (q.strip().length() < MINIMO_CARACTERES_BUSQUEDA) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(
                            Map.of(
                                    "error",
                                    "Escribe al menos "
                                            + MINIMO_CARACTERES_BUSQUEDA
                                            + " caracteres para buscar"))
                    .build();
        }

        List<UsuarioPublicoResponse> resultados =
                gestionarGrafoSocialUseCase.buscarUsuarios(q).stream()
                        .map(UsuarioPublicoResponse::from)
                        .toList();
        return Response.ok(resultados).build();
    }

    /**
     * Mínimo de caracteres para buscar.
     *
     * <p>Es una mitigación y no una solución: con dos caracteres también se pueden enumerar los
     * nombres. Lo que falta es rate limiting, que no existe en ninguna parte de la API, y queda
     * anotado como deuda con dueño.
     */
    static final int MINIMO_CARACTERES_BUSQUEDA = 2;

    @GET
    @Path("/{userId}")
    public Response obtenerUsuarioPorId(@PathParam("userId") String userId) {
        return gestionarGrafoSocialUseCase
                .obtenerUsuarioPorId(userId)
                .map(u -> Response.ok(UsuarioResponse.from(u)).build())
                .orElse(Response.status(Response.Status.NOT_FOUND).build());
    }

    @POST
    public Response registrarUsuario(UsuarioRequest request) {
        if (request == null
                || request.getId() == null
                || request.getId().isBlank()
                || request.getUsername() == null
                || request.getUsername().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Los campos 'id' y 'username' son obligatorios."))
                    .build();
        }

        Usuario usuario = request.toUsuario();
        gestionarGrafoSocialUseCase.registrarUsuario(usuario);

        // Se devuelve UsuarioResponse y no el modelo de dominio. Antes se respondía el Usuario
        // crudo, y eso arrastraba al contrato publico campos que son de persistencia, como
        // "password": null. No es una fuga de la credencial real, pero expone la forma del
        // dominio como si fuera parte de la API.
        return Response.status(Response.Status.CREATED)
                .entity(UsuarioResponse.from(usuario))
                .build();
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
                    fileName.contains(".") ? fileName.substring(fileName.lastIndexOf(".")) : ".jpg";
            String contentType = file.contentType() != null ? file.contentType() : "image/jpeg";
            String avatarUrl =
                    gestionarGrafoSocialUseCase.subirAvatar(
                            userId, is, file.size(), contentType, extension);
            return Response.ok(Map.of("avatarUrl", avatarUrl)).build();
        } catch (Exception e) {
            // Log con la causa real: sin esto, un fallo de S3 era invisible.
            LOG.error("Error al procesar la subida del avatar", e);

            // El mensaje va al log, no al cliente: el detalle del SDK de AWS
            // no le sirve de nada a quien está usando la app.
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                    .entity(Map.of("error", "No pudimos guardar la imagen. Inténtalo de nuevo."))
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
    @Path("/{userId}/follows")
    public Response obtenerSeguidos(@PathParam("userId") String userId) {
        // Antes devolvía List<Usuario>, el modelo de dominio. Se devuelve el DTO por el mismo
        // motivo que en listarUsuarios y registrarUsuario: el dominio tiene password y
        // pushSubscriptionJson, y un endpoint de lectura no debería poder filtrarlos ni por
        // descuido. Ver UsuarioPublicoResponse para el detalle.
        List<UsuarioPublicoResponse> safe =
                gestionarGrafoSocialUseCase.obtenerSeguidos(userId).stream()
                        .map(UsuarioPublicoResponse::from)
                        .toList();
        return Response.ok(safe).build();
    }

    @GET
    @Path("/{userId}/followers")
    public Response obtenerSeguidores(@PathParam("userId") String userId) {
        List<UsuarioPublicoResponse> safe =
                gestionarGrafoSocialUseCase.obtenerSeguidores(userId).stream()
                        .map(UsuarioPublicoResponse::from)
                        .toList();
        return Response.ok(safe).build();
    }

    @GET
    @Path("/comunes")
    public Response obtenerSeguidosEnComun(
            @QueryParam("userA") String userA, @QueryParam("userB") String userB) {
        // Sin esta validación, una consulta sin parámetros devolvía 200 con la lista
        // vacía: "no tienen conexiones en común" y "no le pasaste los parámetros" son
        // la misma respuesta y el cliente no puede distinguirlas.
        if (userA == null || userA.isBlank() || userB == null || userB.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Los campos 'userA' y 'userB' son obligatorios"))
                    .build();
        }

        // Comparar a alguien consigo mismo devuelve la lista completa de sus seguidos
        // etiquetada como "conexiones en común": una respuesta correcta sobre una
        // pregunta que nunca se hizo, y que el cliente no tiene forma de detectar.
        if (userA.equals(userB)) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Elige dos identificadores distintos para comparar"))
                    .build();
        }

        return Response.ok(
                        gestionarGrafoSocialUseCase.obtenerSeguidosEnComun(userA, userB).stream()
                                .map(UsuarioPublicoResponse::from)
                                .toList())
                .build();
    }

    @GET
    @Path("/camino-corto")
    public Response obtenerCaminoMasCorto(
            @QueryParam("origen") String origen, @QueryParam("destino") String destino) {
        // Sin esta validación la consulta se ejecuta con un parámetro ausente y el grafo no
        // encuentra nada: la respuesta es 200 con la forma de "no hay camino dentro de seis
        // grados", que es idéntica a la de una consulta válida entre dos personas lejanas. El
        // cliente no podría distinguir un resultado legítimo de una llamada mal formada, y
        // terminaría pintando como error un caso que no lo es. Es el mismo motivo por el que
        // /comunes responde 400 en vez de devolver la lista vacía.
        if (origen == null || origen.isBlank() || destino == null || destino.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "Los campos 'origen' y 'destino' son obligatorios"))
                    .build();
        }

        return Response.ok(gestionarGrafoSocialUseCase.obtenerCaminoMasCorto(origen, destino))
                .build();
    }
}
