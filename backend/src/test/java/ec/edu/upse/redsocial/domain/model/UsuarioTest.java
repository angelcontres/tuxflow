package ec.edu.upse.redsocial.domain.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Pruebas del contrato del modelo de dominio {@link Usuario}.
 *
 * <p>Verifica constructores, accesores y mutadores requeridos para la gestión de identidad en el grafo.
 */
class UsuarioTest {

    @Nested
    @DisplayName("Valores por defecto")
    class Defaults {

        @Test
        @DisplayName("un usuario nuevo sin parámetros tiene campos nulos")
        void newUsuarioHasNullValues() {
            Usuario usuario = new Usuario();

            assertNull(usuario.getId());
            assertNull(usuario.getUsername());
            assertNull(usuario.getEmail());
            assertNull(usuario.getNombre());
            assertNull(usuario.getAvatarUrl());
            assertNull(usuario.getPushSubscriptionJson());
        }
    }

    @Nested
    @DisplayName("Constructor con argumentos")
    class ParametrizedConstructor {

        @Test
        @DisplayName("inicializa los datos básicos de perfil correctamente")
        void setsBasicProfileFields() {
            Usuario usuario =
                    new Usuario(
                            "dev-1",
                            "dev_upse",
                            "dev@upse.edu.ec",
                            "Programador Insano",
                            "https://minio.upse.edu.ec/avatar.png");

            assertEquals("dev-1", usuario.getId());
            assertEquals("dev_upse", usuario.getUsername());
            assertEquals("dev@upse.edu.ec", usuario.getEmail());
            assertEquals("Programador Insano", usuario.getNombre());
            assertEquals("https://minio.upse.edu.ec/avatar.png", usuario.getAvatarUrl());
            assertNull(usuario.getPushSubscriptionJson());
        }
    }

    @Nested
    @DisplayName("Mutadores y Accesores")
    class MutatorsAndAccessors {

        @Test
        @DisplayName("permite modificar y leer todos los atributos de perfil y push")
        void updatesAllFields() {
            Usuario usuario = new Usuario();

            usuario.setId("user-100");
            usuario.setUsername("nuevo_user");
            usuario.setEmail("test@upse.edu.ec");
            usuario.setNombre("Nuevo Usuario");
            usuario.setAvatarUrl("http://localhost:9000/redsocial-media/avatar.jpg");
            usuario.setPushSubscriptionJson("{\"endpoint\":\"https://fcm.googleapis.com/...\"}");

            assertEquals("user-100", usuario.getId());
            assertEquals("nuevo_user", usuario.getUsername());
            assertEquals("test@upse.edu.ec", usuario.getEmail());
            assertEquals("Nuevo Usuario", usuario.getNombre());
            assertEquals(
                    "http://localhost:9000/redsocial-media/avatar.jpg", usuario.getAvatarUrl());
            assertEquals(
                    "{\"endpoint\":\"https://fcm.googleapis.com/...\"}",
                    usuario.getPushSubscriptionJson());
        }
    }
}
