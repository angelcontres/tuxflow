package ec.edu.upse.redsocial.infrastructure.adapter.out.neo4j;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.model.Usuario;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;
import org.neo4j.driver.TransactionCallback;
import org.neo4j.driver.TransactionContext;
import org.neo4j.driver.Value;

/**
 * Cubre que guardar un usuario NO borre la contraseña cuando el cliente no la manda.
 *
 * <p>El defecto que se cubre: el Navbar guarda el perfil con un {@code Usuario} sin {@code
 * password} porque el tipo del frontend no tiene ese campo. Con el ternario anterior ({@code
 * password != null ? password : ""}) cada guardado escribía "" y dejaba al usuario sin poder
 * iniciar sesión, aunque las credenciales fueran correctas.
 */
class Neo4jGrafoAdapterGuardarUsuarioTest {

    private TransactionContext tx;
    private Neo4jGrafoAdapter adapter;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void stubeaDriver() {
        Driver driver = mock(Driver.class);
        Session session = mock(Session.class);
        tx = mock(TransactionContext.class);

        when(driver.session()).thenReturn(session);
        when(session.executeWrite(any()))
                .thenAnswer(
                        invocacion ->
                                ((TransactionCallback<Object>) invocacion.getArgument(0))
                                        .execute(tx));
        // guardarUsuario encadena .consume() sobre el resultado, así que el stub tiene que
        // devolver un Result y no null.
        when(tx.run(anyString(), any(Value.class))).thenReturn(mock(Result.class));

        adapter = new Neo4jGrafoAdapter();
        adapter.driver = driver;
    }

    /** Ejecuta guardarUsuario y devuelve la consulta y los parámetros enviados. */
    private ArgumentCaptor<String> capturaConsulta() {
        ArgumentCaptor<String> cypher = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Value> params = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(cypher.capture(), params.capture());
        return cypher;
    }

    private Map<String, Object> parametros() {
        ArgumentCaptor<Value> params = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(anyString(), params.capture());
        return params.getValue().asMap();
    }

    /** Usuario tal como lo manda el Navbar al guardar el perfil: sin password. */
    private Usuario perfilSinPassword() {
        Usuario u = new Usuario();
        u.setId("carlos-patino");
        u.setUsername("carlos");
        u.setNombre("Carlos Patino");
        u.setEmail("carlos@upse.edu.ec");
        u.setAvatarUrl("http://localhost:9000/redsocial-media/media-x.png");
        return u;
    }

    @Test
    @DisplayName("guardar un perfil sin password manda null, no una cadena vacía")
    void sinPasswordMandaNullYNoCadenaVacia() {
        // El defecto era el ternario a "": convertir el null en "" convertía "no cambiar la
        // contraseña" en "dejar la contraseña vacía". El valor tiene que viajar como null para
        // que el Cypher pueda distinguir las dos intenciones.
        adapter.guardarUsuario(perfilSinPassword());

        Map<String, Object> enviados = parametros();
        assertTrue(enviados.containsKey("password"), "Falta el parámetro password: " + enviados);
        assertNull(
                enviados.get("password"),
                "La password debe viajar como null, no como texto vacío: llega '"
                        + enviados.get("password")
                        + "'");
    }

    @Test
    @DisplayName("la consulta NO asigna la contraseña de forma incondicional")
    void laConsultaNoAsignaPasswordIncondicionalmente() {
        adapter.guardarUsuario(perfilSinPassword());

        String consulta = capturaConsulta().getValue().replaceAll("\\s+", " ").trim();

        // El fallo tenía esta forma exacta tras normalizar espacios. Si vuelve a aparecer, el
        // perfil vuelve a romper el inicio de sesión, así que se falla de forma explícita en
        // vez de confiar en que la prueba de parámetros lo note.
        assertFalse(
                consulta.contains("u.avatarUrl = $avatarUrl, u.password = $password"),
                "La contraseña volvió a asignarse sin condición: " + consulta);
        assertTrue(
                consulta.contains("CASE WHEN $password IS NULL THEN [] ELSE [1] END"),
                "Falta la condición que protege la contraseña: " + consulta);
        assertTrue(consulta.contains("FOREACH ("), consulta);
    }

    @Test
    @DisplayName("el resto del perfil se sigue actualizando junto a la contraseña")
    void losDemasCamposSeSiguenActualizando() {
        // El fix no puede pasar por no escribir nada: guardar el perfil tiene que seguir
        // guardando nombre, email y avatar.
        adapter.guardarUsuario(perfilSinPassword());

        String consulta = capturaConsulta().getValue().replaceAll("\\s+", " ").trim();

        assertTrue(consulta.contains("MERGE (u:Usuario {id: $id})"), consulta);
        assertTrue(consulta.contains("u.username = $username"), consulta);
        assertTrue(consulta.contains("u.email = $email"), consulta);
        assertTrue(consulta.contains("u.nombre = $nombre"), consulta);
        assertTrue(consulta.contains("u.avatarUrl = $avatarUrl"), consulta);
    }

    @Test
    @DisplayName("una contraseña real se envía tal cual y se aplica")
    void unaPasswordRealSeEnviaYSeAplica() {
        // El otro extremo del fix: si la contraseña viene de verdad, tiene que escribirla.
        Usuario u = perfilSinPassword();
        u.setPassword("carlos123");

        adapter.guardarUsuario(u);

        assertEquals("carlos123", parametros().get("password"));
    }

    @Test
    @DisplayName("un usuario nuevo sin password sigue sin password, sin romper nada")
    void usuarioNuevoSinPasswordNoFalla() {
        // El registro normal siempre manda contraseña, pero guardar un perfil no debe
        // romperse si llega sin ella: se guarda el resto y se deja la contraseña como estaba.
        adapter.guardarUsuario(perfilSinPassword());

        Map<String, Object> enviados = parametros();
        assertEquals("carlos-patino", enviados.get("id"));
        assertEquals("carlos", enviados.get("username"));
        assertEquals("Carlos Patino", enviados.get("nombre"));
    }
}
