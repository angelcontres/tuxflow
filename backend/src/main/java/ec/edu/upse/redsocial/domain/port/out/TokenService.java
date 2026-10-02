package ec.edu.upse.redsocial.domain.port.out;

import java.util.Optional;

/**
 * Puerto de salida para emitir y validar tokens de sesión firmados.
 *
 * <p>Mantiene la lógica criptográfica fuera del dominio: el dominio solo sabe que pide "un token
 * para este usuario" y "valida este token".
 */
public interface TokenService {

    /**
     * Emite un token firmado que identifica al usuario.
     *
     * @param userId identificador del usuario
     * @param username nombre de usuario
     * @param expirationHours horas de vigencia del token
     */
    String emitirToken(String userId, String username, long expirationHours);

    /**
     * Valida la firma y la expiración del token.
     *
     * @return el id del usuario autenticado, o vacío si el token es inválido, está manipulado o
     *     expiró
     */
    Optional<String> validarToken(String token);
}
