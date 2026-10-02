package ec.edu.upse.redsocial.infrastructure.adapter.out.jwt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Prueba el adaptador con la configuracion real de Quarkus, que es el camino que sigue la
 * aplicacion. Un test plano de JUnit no lee smallrye.jwt.sign.key.location y por eso no alcanza
 * para validar la integracion de la firma.
 */
@QuarkusTest
class JwtTokenAdapterQuarkusTest {

    @Inject JwtTokenAdapter adapter;

    @Test
    @DisplayName("Emite y valida un token usando la clave configurada en la app")
    void emiteYValidaConClaveDeConfiguracion() {
        String token = adapter.emitirToken("u-quarkus", "angelprueba", 1);

        Optional<String> userId = adapter.validarToken(token);

        assertTrue(userId.isPresent(), "el token debe validarse contra la clave de la app");
        assertEquals("u-quarkus", userId.get());
    }

    @Test
    @DisplayName("Rechaza un token con firma alterada")
    void rechazaFirmaAlterada() {
        String token = adapter.emitirToken("u-quarkus", "angelprueba", 1);
        String[] partes = token.split("\\.");
        String alterada = partes[2].substring(0, partes[2].length() - 4) + "AAAA";

        assertTrue(adapter.validarToken(partes[0] + "." + partes[1] + "." + alterada).isEmpty());
    }
}
