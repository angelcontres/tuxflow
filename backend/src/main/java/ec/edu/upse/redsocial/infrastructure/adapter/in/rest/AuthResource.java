package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.model.Usuario;
import ec.edu.upse.redsocial.domain.port.in.GestionarGrafoSocialUseCase;
import ec.edu.upse.redsocial.domain.port.out.TokenService;
import ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto.LoginRequest;
import ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto.LoginResponse;
import ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto.UsuarioResponse;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.HttpHeaders;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@Path("/api/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AuthResource {

    private static final String BEARER = "Bearer ";

    @Inject GestionarGrafoSocialUseCase gestionarGrafoSocialUseCase;

    @Inject TokenService tokenService;

    @ConfigProperty(name = "redsocial.jwt.expiration-hours")
    long expirationHours;

    @POST
    @Path("/login")
    public Response login(LoginRequest credentials) {
        String emailOrUsername = credentials.getEmail();
        String password = credentials.getPassword();

        if (emailOrUsername == null || emailOrUsername.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "El email o usuario es obligatorio"))
                    .build();
        }

        if (password == null || password.isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(Map.of("error", "La contraseña es obligatoria"))
                    .build();
        }

        // Buscar usuario por email o username (incluye el password)
        Optional<Usuario> userOpt =
                gestionarGrafoSocialUseCase.buscarUsuarioPorCredenciales(emailOrUsername);

        if (userOpt.isEmpty()) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity(Map.of("error", "Credenciales inválidas"))
                    .build();
        }

        Usuario user = userOpt.get();

        // Verificar contraseña (en producción usar hash)
        if (!password.equals(user.getPassword())) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity(Map.of("error", "Credenciales inválidas"))
                    .build();
        }

        // Token firmado con expiración: el frontend lo reenvía en cada
        // petición y así sobrevive a un refresh del navegador.
        String token = tokenService.emitirToken(user.getId(), user.getUsername(), expirationHours);

        return Response.ok(LoginResponse.of(token, user)).build();
    }

    /**
     * Devuelve el usuario del token presentado. Es lo que permite al frontend restaurar la sesión
     * tras recargar la página sin volver a pedir la contraseña.
     */
    @GET
    @Path("/me")
    public Response miPerfil(@HeaderParam(HttpHeaders.AUTHORIZATION) String authorization) {
        String userId = usuarioDelToken(authorization);
        if (userId == null) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity(Map.of("error", "Sesión no válida o expirada"))
                    .build();
        }

        return gestionarGrafoSocialUseCase
                .obtenerUsuarioPorId(userId)
                .map(u -> Response.ok(UsuarioResponse.from(u)).build())
                .orElse(
                        Response.status(Response.Status.UNAUTHORIZED)
                                .entity(Map.of("error", "El usuario de la sesión ya no existe"))
                                .build());
    }

    /** Extrae y valida el id del usuario de un header Authorization: Bearer x. */
    private String usuarioDelToken(String authorization) {
        if (authorization == null || !authorization.startsWith(BEARER)) {
            return null;
        }
        return tokenService.validarToken(authorization.substring(BEARER.length())).orElse(null);
    }

    @POST
    @Path("/register")
    public Response register(Usuario usuario) {
        if (usuario == null
                || usuario.getNombre() == null
                || usuario.getNombre().isBlank()
                || usuario.getUsername() == null
                || usuario.getUsername().isBlank()
                || usuario.getPassword() == null
                || usuario.getPassword().isBlank()) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(
                            Map.of(
                                    "error",
                                    "Los campos nombre, username y password son obligatorios"))
                    .build();
        }

        // Generar ID automáticamente desde el username
        String id =
                usuario.getUsername().toLowerCase().replaceAll("[^a-z0-9_]", "-")
                        + "-"
                        + java.util.UUID.randomUUID().toString().substring(0, 8);
        usuario.setId(id);

        // Verificar si el usuario ya existe
        Optional<Usuario> existing =
                gestionarGrafoSocialUseCase.buscarUsuarioPorCredenciales(usuario.getUsername());

        if (existing.isPresent()) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of("error", "El usuario ya existe"))
                    .build();
        }

        gestionarGrafoSocialUseCase.registrarUsuario(usuario);

        // Se emite token en el registro para que el usuario entre sin pasar
        // por el login inmediatamente.
        String token =
                tokenService.emitirToken(usuario.getId(), usuario.getUsername(), expirationHours);

        return Response.status(Response.Status.CREATED)
                .entity(LoginResponse.of(token, usuario))
                .build();
    }
}
