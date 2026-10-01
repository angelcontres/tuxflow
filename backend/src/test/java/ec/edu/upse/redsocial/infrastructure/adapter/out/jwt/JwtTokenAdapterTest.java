package ec.edu.upse.redsocial.infrastructure.adapter.out.jwt;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.smallrye.jwt.build.Jwt;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.PrivateKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.Base64;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class JwtTokenAdapterTest {

    private JwtTokenAdapter adapter;
    private PrivateKey privateKey;

    @BeforeEach
    void setUp() throws Exception {
        adapter = new JwtTokenAdapter();
        adapter.issuer = "https://redsocial.test";
        adapter.publicKeyLocation = "jwt-publicKey.pem";
        adapter.cargarClavePublica();

        // En un test plano de JUnit no hay configuracion de Quarkus, asi que
        // Jwt.sign() no encuentra la clave. Se firma con la clave explicita.
        String pemPrivada = leer("jwt-privateKey.pem");
        String base64 =
                pemPrivada
                        .replaceAll("-----BEGIN PRIVATE KEY-----", "")
                        .replaceAll("-----END PRIVATE KEY-----", "")
                        .replaceAll("\\s", "");
        privateKey =
                KeyFactory.getInstance("RSA")
                        .generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(base64)));
    }

    private String leer(String recurso) throws Exception {
        try (InputStream in =
                Thread.currentThread().getContextClassLoader().getResourceAsStream(recurso)) {
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    /** Firma con la clave explicita, equivalente a lo que hace la app. */
    private String firmar(String userId, long horas) {
        return Jwt.issuer(adapter.issuer)
                .upn(userId)
                .claim("username", "angelprueba")
                .expiresIn(horas * 3600)
                .sign(privateKey);
    }

    @Test
    @DisplayName("Emite un token con el id del usuario en el claim upn")
    void tokenContieneUpn() {
        String token = firmar("u1", 1);

        String[] partes = token.split("\\.");
        assertEquals(3, partes.length, "un JWT tiene 3 segmentos");

        String payload = new String(Base64.getUrlDecoder().decode(partes[1]));
        assertTrue(payload.contains("\"upn\":\"u1\""), "payload: " + payload);
    }

    @Test
    @DisplayName("Valida un token firmado con la clave del proyecto y devuelve el id")
    void validaTokenPropio() {
        String token = firmar("u1", 1);

        Optional<String> userId = adapter.validarToken(token);

        assertTrue(userId.isPresent(), "el token propio debe validarse");
        assertEquals("u1", userId.get());
    }

    @Test
    @DisplayName("Rechaza un token manipulado")
    void rechazaTokenManipulado() {
        String token = firmar("u1", 1);
        String[] partes = token.split("\\.");
        String firmaAlterada = partes[2].substring(0, partes[2].length() - 4) + "AAAA";

        Optional<String> userId =
                adapter.validarToken(partes[0] + "." + partes[1] + "." + firmaAlterada);

        assertTrue(userId.isEmpty(), "un token manipulado no debe validar");
    }

    @Test
    @DisplayName("Rechaza un token expirado")
    void rechazaTokenExpirado() {
        // -1 hora de vigencia: ya nació vencido
        String token = firmar("u1", -1);

        assertTrue(adapter.validarToken(token).isEmpty());
    }

    @Test
    @DisplayName("Rechaza null, vacío y texto sin estructura de token")
    void rechazaEntradasInvalidas() {
        assertTrue(adapter.validarToken(null).isEmpty());
        assertTrue(adapter.validarToken("").isEmpty());
        assertTrue(adapter.validarToken("   ").isEmpty());
        assertTrue(adapter.validarToken("no-es-un-jwt").isEmpty());
    }

    @Test
    @DisplayName("Rechaza un token firmado con una clave distinta")
    void rechazaTokenDeOtraClave() throws Exception {
        KeyPairGenerator generador = KeyPairGenerator.getInstance("RSA");
        generador.initialize(2048);
        KeyPair otroPar = generador.generateKeyPair();

        String tokenAjeno =
                Jwt.issuer(adapter.issuer)
                        .upn("atacante")
                        .expiresIn(3600)
                        .sign(otroPar.getPrivate());

        assertTrue(
                adapter.validarToken(tokenAjeno).isEmpty(),
                "una firma hecha con otra clave no debe validar");
    }
}
