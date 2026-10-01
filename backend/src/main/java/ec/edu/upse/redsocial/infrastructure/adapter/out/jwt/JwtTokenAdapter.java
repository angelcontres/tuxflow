package ec.edu.upse.redsocial.infrastructure.adapter.out.jwt;

import ec.edu.upse.redsocial.domain.port.out.TokenService;
import io.smallrye.jwt.auth.principal.DefaultJWTParser;
import io.smallrye.jwt.build.Jwt;
import jakarta.annotation.PostConstruct;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.logging.Logger;

/**
 * Emisión y validación de JWT con firma RSA (RS256) mediante SmallRye JWT.
 *
 * La clave privada solo se usa para firmar; la pública alcanza para validar.
 * Ambas se leen del classpath segun la ruta configurada.
 */
@ApplicationScoped
public class JwtTokenAdapter implements TokenService {

    private static final Logger LOG = Logger.getLogger(JwtTokenAdapter.class);

    @Inject
    @ConfigProperty(name = "redsocial.jwt.issuer")
    String issuer;

    @ConfigProperty(name = "redsocial.jwt.public-key-location")
    String publicKeyLocation;

    private PublicKey publicKey;

    private final DefaultJWTParser parser = new DefaultJWTParser();

    @PostConstruct
    void cargarClavePublica() {
        String pem;
        try (InputStream in =
                Thread.currentThread().getContextClassLoader().getResourceAsStream(publicKeyLocation)) {
            if (in == null) {
                throw new IllegalStateException("No se encontró la clave pública: " + publicKeyLocation);
            }
            pem = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("No se pudo leer la clave pública", e);
        }
        publicKey = parsearClavePublica(pem);
    }

    /** Convierte un PEM X.509 ("BEGIN PUBLIC KEY") en un objeto PublicKey. */
    private static PublicKey parsearClavePublica(String pem) {
        String base64 =
                pem.replaceAll("-----BEGIN PUBLIC KEY-----", "")
                        .replaceAll("-----END PUBLIC KEY-----", "")
                        .replaceAll("\\s", "");
        try {
            byte[] der = Base64.getDecoder().decode(base64);
            return KeyFactory.getInstance("RSA").generatePublic(new X509EncodedKeySpec(der));
        } catch (Exception e) {
            throw new IllegalStateException("La clave pública no tiene un formato válido", e);
        }
    }

    @Override
    public String emitirToken(String userId, String username, long expirationHours) {
        return Jwt.issuer(issuer)
                .upn(userId)
                .claim("username", username)
                .expiresIn(expirationHours * 3600)
                .sign();
    }

    @Override
    public Optional<String> validarToken(String token) {
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }
        try {
            JsonWebToken claims = parser.verify(token, publicKey);
            // El id del usuario viaja en el claim 'upn' (User Principal Name),
            // que es donde Jwt.upn() lo escribe. 'sub' queda sin usar.
            Object upn = claims.getClaim("upn");
            if (upn == null) {
                return Optional.empty();
            }
            return Optional.of(upn.toString());
        } catch (Exception e) {
            // Token manipulado, expirado o firmado con otra clave.
            LOG.debugf("Token rechazado: %s", e.getMessage());
            return Optional.empty();
        }
    }
}
