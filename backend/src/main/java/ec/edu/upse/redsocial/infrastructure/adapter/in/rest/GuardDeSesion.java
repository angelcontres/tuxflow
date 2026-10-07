package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import ec.edu.upse.redsocial.domain.port.out.TokenService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.Optional;

/**
 * Exige una sesión válida y, opcionalmente, que la sesión sea la de un identificador concreto.
 *
 * <p>Nace porque la validación de sesión estaba escrita a mano dentro de {@code AuthResource} y no
 * se podía reutilizar. El resultado era que cada endpoint de escritura decidía por su cuenta si
 * exigía identidad, y {@code POST /api/users/{userId}/avatar} no exigía ninguna: cualquiera podía
 * cambiar el avatar de otra persona escribiendo su identificador en la URL.
 *
 * <p>Es un guard y no un filtro global a propósito. Un filtro exigiría sesión en todo, incluidas
 * las lecturas públicas que hoy funcionan sin cuenta --seguidores, seguidos, publicaciones por
 * autor-- y eso cambiaría el contrato de nueve endpoints de golpe. El alcance acordado es proteger
 * lo que toca datos propios, endpoint por endpoint, y que cada historia active el suyo.
 */
/**
 * Exige una sesión válida y, opcionalmente, que la sesión sea la de un identificador concreto.
 *
 * <p>Nace porque la validación de sesión estaba escrita a mano dentro de {@code AuthResource} y no
 * se podía reutilizar. El resultado era que cada endpoint de escritura decidía por su cuenta si
 * exigía identidad, y {@code POST /api/users/{userId}/avatar} no exigía ninguna: cualquiera podía
 * cambiar el avatar de otra persona escribiendo su identificador en la URL.
 *
 * <p>Es un guard y no un filtro global a propósito. Un filtro exigiría sesión en todo, incluidas
 * las lecturas públicas que hoy funcionan sin cuenta --seguidores, seguidos, publicaciones por
 * autor-- y eso cambiaría el contrato de nueve endpoints de golpe. El alcance acordado es proteger
 * lo que toca datos propios, endpoint por endpoint, y que cada historia activate el suyo.
 *
 * <p>Es {@code ApplicationScoped} y sin estado entre peticiones: el identificador se devuelve como
 * valor de retorno en vez de guardarse en un campo, porque un recurso REST se instancia una vez por
 * aplicación y un campo se compartiría entre peticiones concurrentes.
 */
@ApplicationScoped
public class GuardDeSesion {

    private static final String BEARER = "Bearer ";

    @Inject TokenService tokenService;

    /** Identificador de la sesión de la petición en curso, o vacío si no hay. */
    public Optional<String> usuarioActual(String authorization) {
        if (authorization == null || !authorization.startsWith(BEARER)) {
            return Optional.empty();
        }
        return tokenService.validarToken(authorization.substring(BEARER.length()));
    }

    /**
     * Comprueba la sesión y devuelve una respuesta si falta.
     *
     * @return la respuesta de error, o vacío si hay sesión válida y se puede seguir
     */
    public Optional<Response> sinSesion(String authorization) {
        return usuarioActual(authorization).isEmpty()
                ? Optional.of(noAutorizado())
                : Optional.empty();
    }

    /**
     * Comprueba que la sesión es la del identificador indicado.
     *
     * <p>La comprobación va más allá de "hay sesión": con un token válido de Carlos se podía
     * escribir en el nodo de Beatriz sólo poniendo su identificador en la URL. Sin comparar el
     * titular, exigir un token no impide nada.
     *
     * @return la respuesta de error, o vacío si la sesión corresponde a ese identificador
     */
    public Optional<Response> siNoEsElDueño(String authorization, String userId) {
        Optional<String> actual = usuarioActual(authorization);
        if (actual.isEmpty()) {
            return Optional.of(noAutorizado());
        }
        if (userId == null || !userId.equals(actual.get())) {
            // 403 y no 401: la sesión es válida, lo que no es válido es que sea de otra persona.
            // Con 401 el cliente interpretaría que su sesión caducó y cerraría la sesión de nuevo,
            // que es lo que hace `client.ts` ante cualquier 401.
            return Optional.of(
                    Response.status(Response.Status.FORBIDDEN)
                            .entity(
                                    Map.of(
                                            "error",
                                            "No puedes modificar el perfil de otra persona"))
                            .build());
        }
        return Optional.empty();
    }

    /**
     * El mensaje no dice si el token faltaba o caducó, a propósito.
     *
     * <p>Distinguirlo convierte el login en un oráculo de qué tokens existen. Es la misma razón por
     * la que el login responde el mismo texto para usuario inexistente y contraseña incorrecta.
     */
    private static Response noAutorizado() {
        return Response.status(Response.Status.UNAUTHORIZED)
                .entity(Map.of("error", "Sesión no válida o expirada"))
                .build();
    }
}
