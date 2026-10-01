package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.model.Usuario;
import ec.edu.upse.redsocial.domain.port.in.GestionarGrafoSocialUseCase;
import ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto.LoginRequest;
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Optional;

@Path("/api/auth")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
public class AuthResource {

    @Inject GestionarGrafoSocialUseCase gestionarGrafoSocialUseCase;

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

        // Buscar usuario por email o username
        Optional<Usuario> userOpt = gestionarGrafoSocialUseCase.listarUsuarios().stream()
                .filter(u -> emailOrUsername.equals(u.getEmail()) || emailOrUsername.equals(u.getUsername()))
                .findFirst();

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

        // No devolver la contraseña
        user.setPassword(null);

        return Response.ok(user).build();
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
                    .entity(Map.of("error", "Los campos nombre, username y password son obligatorios"))
                    .build();
        }

        // Generar ID automáticamente desde el username
        String id = usuario.getUsername().toLowerCase()
                .replaceAll("[^a-z0-9_]", "-")
                + "-" + java.util.UUID.randomUUID().toString().substring(0, 8);
        usuario.setId(id);

        // Verificar si el usuario ya existe
        Optional<Usuario> existing = gestionarGrafoSocialUseCase.listarUsuarios().stream()
                .filter(u -> u.getUsername().equals(usuario.getUsername()))
                .findFirst();

        if (existing.isPresent()) {
            return Response.status(Response.Status.CONFLICT)
                    .entity(Map.of("error", "El usuario ya existe"))
                    .build();
        }

        gestionarGrafoSocialUseCase.registrarUsuario(usuario);

        // No devolver la contraseña
        usuario.setPassword(null);

        return Response.status(Response.Status.CREATED).entity(usuario).build();
    }
}
