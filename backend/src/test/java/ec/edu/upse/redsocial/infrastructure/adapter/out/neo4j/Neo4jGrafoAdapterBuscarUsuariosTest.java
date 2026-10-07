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
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;
import org.neo4j.driver.TransactionCallback;
import org.neo4j.driver.TransactionContext;
import org.neo4j.driver.Value;
import org.neo4j.driver.Values;

/**
 * La consulta de búsqueda de US-14: qué proyecta, contra qué compara y en qué orden devuelve.
 *
 * <p>Las pruebas unitarias stubean el driver, así que comprueban el texto de la consulta y el mapeo
 * de las filas. No comprueban que la consulta sea válida: para eso está {@code
 * Neo4jGrafoAdapterPerfilAjenoIT}, que la ejecuta contra un Neo4j de verdad.
 *
 * <p>Lo que más se protege aquí son tres cosas que fallan sin lanzar error. Una consulta que
 * proyecte el nodo entero filtra el correo. Una que compare con el texto crudo no encuentra a nadie
 * con acentos. Y un {@code CASE} con las ramas desordenadas devuelve un orden que se parece al
 * correcto y no lo es: como Cypher evalúa la primera rama que coincide, "el nombre empieza por"
 * ganaría a "el nombre de usuario empieza por".
 */
class Neo4jGrafoAdapterBuscarUsuariosTest {

    private TransactionContext tx;
    private Neo4jGrafoAdapter adapter;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void stubeaDriver() {
        Driver driver = mock(Driver.class);
        Session session = mock(Session.class);
        tx = mock(TransactionContext.class);

        when(driver.session()).thenReturn(session);
        when(session.executeRead(any()))
                .thenAnswer(
                        invocacion ->
                                ((TransactionCallback<Object>) invocacion.getArgument(0))
                                        .execute(tx));
        when(tx.run(anyString(), any(Value.class))).thenReturn(mock(Result.class));

        adapter = new Neo4jGrafoAdapter();
        adapter.driver = driver;
    }

    /** Ejecuta la búsqueda y devuelve la consulta y los parámetros enviados. */
    private Map<String, Object> ejecuta(String texto) {
        adapter.buscarUsuarios(texto, 20L);

        ArgumentCaptor<String> cypher = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Value> params = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(cypher.capture(), params.capture());
        consultaActual = cypher.getValue().replaceAll("\\s+", " ").trim();
        return params.getValue().asMap();
    }

    private String consultaActual = "";

    @Test
    @DisplayName("la consulta no proyecta el correo, la contraseña ni la suscripción push")
    void noProyectaLosDatosDeSesion() {
        // El RETURN es la primera defensa contra la fuga. Si proyectara el nodo entero, el mapeo
        // tendría que elegir qué ignorar, y eso se rompe el día que alguien añade una propiedad con
        // credenciales. La segunda defensa es el DTO, que no tiene dónde mapear un campo que la
        // consulta nunca trae.
        ejecuta("beatriz");

        assertFalse(consultaActual.contains("u.email"), consultaActual);
        assertFalse(consultaActual.contains("u.password"), consultaActual);
        assertFalse(consultaActual.contains("pushSubscriptionJson"), consultaActual);
        assertFalse(consultaActual.contains("u.contra"), consultaActual);
        // Y sí proyecta las cuatro que la búsqueda necesita.
        assertTrue(consultaActual.contains("u.id AS id"), consultaActual);
        assertTrue(consultaActual.contains("u.username AS username"), consultaActual);
        assertTrue(consultaActual.contains("u.nombre AS nombre"), consultaActual);
        assertTrue(consultaActual.contains("u.avatarUrl AS avatarUrl"), consultaActual);
    }

    @Test
    @DisplayName("no busca por el correo, que sería un oráculo de correos existentes")
    void noBuscaPorCorreo() {
        // Buscar por correo no aporta nada al usuario --nadie recuerda el correo de alguien a quien
        // quiere seguir-- y convierte el endpoint en un oráculo de "este correo existe en la
        // comunidad".
        ejecuta("beatriz@upse.edu.ec");

        assertFalse(consultaActual.contains("u.email"), consultaActual);
    }

    @Test
    @DisplayName("el texto buscado se normaliza antes de compararlo")
    void elTextoBuscadoSeNormaliza() {
        // Si se normalizaran sólo los datos guardados y no el texto buscado, escribir "Patiño" con
        // enye no encontraría nunca nada: es el mismo error en el otro sentido.
        Map<String, Object> enviados = ejecuta("  BEATRÍZ  ");

        assertEquals("beatriz", enviados.get("q"));
    }

    @Test
    @DisplayName("la comparación ignora los acentos y la eñe, en los dos campos")
    void laComparacionIgnoraLosAcentos() {
        // Es la razón de existir de la normalización: buscar "patino" tiene que encontrar a
        // "Carlos Patiño", y buscar "Jose" a "José Ramírez". Con toLower() solamente, los dos dan
        // cero resultados.
        ejecuta("patino");

        assertTrue(consultaActual.contains("usuarioNormalizado CONTAINS $q"), consultaActual);
        assertTrue(consultaActual.contains("nombreNormalizado CONTAINS $q"), consultaActual);
        assertTrue(
                consultaActual.contains("reduce(s = toLower(u.username)"),
                "El nombre de usuario no se normaliza: " + consultaActual);
        assertTrue(
                consultaActual.contains("reduce(s = toLower(u.nombre)"),
                "El nombre no se normaliza: " + consultaActual);
    }

    @Test
    @DisplayName("el orden va por relevancia y en la escala del Gherkin, de mayor a menor")
    void elOrdenVaPorRelevancia() {
        // El orden de las ramas importa: Cypher devuelve la PRIMERA que coincide. Con las ramas en
        // otro orden, "el nombre empieza por" ganaría a "el nombre de usuario empieza por", que es
        // justo el error que este test detecta.
        Map<String, Object> enviados = ejecuta("beatriz");

        assertTrue(consultaActual.contains("ORDER BY relevancia ASC"), consultaActual);

        int exacta = consultaActual.indexOf("WHEN usuarioNormalizado = $q THEN 1");
        int empiezaUsuario =
                consultaActual.indexOf("WHEN usuarioNormalizado STARTS WITH $q THEN 2");
        int contieneUsuario = consultaActual.indexOf("WHEN usuarioNormalizado CONTAINS $q THEN 3");
        int empiezaNombre = consultaActual.indexOf("WHEN nombreNormalizado STARTS WITH $q THEN 4");

        assertTrue(exacta >= 0, "Falta la coincidencia exacta de username: " + consultaActual);
        assertTrue(
                empiezaUsuario > exacta,
                "El orden de las ramas no es 1, 2, 3, 4: " + consultaActual);
        assertTrue(
                contieneUsuario > empiezaUsuario,
                "El orden de las ramas no es 1, 2, 3, 4: " + consultaActual);
        assertTrue(
                empiezaNombre > contieneUsuario,
                "El orden de las ramas no es 1, 2, 3, 4: " + consultaActual);
        assertEquals(20L, ((Number) enviados.get("limite")).longValue());
    }

    @Test
    @DisplayName("el ranking se desempata por nombre de usuario, para que sea determinista")
    void elRankingEsDeterminista() {
        // Sin este desempate, dos ejecuciones de la misma búsqueda pueden devolver el mismo
        // conjunto en distinto orden, y una prueba que espere un orden concreto se vuelve
        // intermitente.
        ejecuta("sil");

        assertTrue(
                consultaActual.contains("ORDER BY relevancia ASC, u.username ASC"), consultaActual);
    }

    @Test
    @DisplayName("el tope va como parámetro y no escrito en el texto de la consulta")
    void elTopeVaComoParametro() {
        // Con el 20 escrito en el texto habría que reconstruir la cadena para cambiarlo, y las
        // pruebas no podrían comprobar que sale el que se pidió.
        adapter.buscarUsuarios("beatriz", 7L);

        ArgumentCaptor<String> cypher = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Value> params = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(cypher.capture(), params.capture());

        String consulta = cypher.getValue().replaceAll("\\s+", " ").trim();
        assertTrue(consulta.contains("LIMIT $limite"), consulta);
        assertFalse(
                consulta.contains("LIMIT 20"), "El tope quedó escrito en la consulta: " + consulta);
        assertEquals(7L, ((Number) params.getValue().asMap().get("limite")).longValue());
    }

    @Test
    @DisplayName("una fila sin nombre llega con nombre nulo y no con el texto \"null\"")
    void unNombreAusenteNoSeConvierteEnNull() {
        // En Neo4j asignar null a una propiedad la elimina, así que un usuario guardado sin nombre
        // llega como NullValue, y NullValue.asString() no lanza: devuelve el texto literal "null".
        // Sin la guarda, la API responde 200 con un nombre inventado, que es peor que un 500 porque
        // no se nota.
        Driver driver = mock(Driver.class);
        Session session = mock(Session.class);
        TransactionContext contexto = mock(TransactionContext.class);
        Result result = mock(Result.class);
        Record fila = mock(Record.class);

        when(fila.get("id")).thenReturn(Values.value("sin-nombre"));
        when(fila.get("username")).thenReturn(Values.value("sinnombre"));
        // Values.NULL y no Values.value(null): así es como llega de verdad una propiedad borrada, y
        // es lo
        // que hace que NullValue.asString() devuelva el texto literal "null".
        when(fila.get("nombre")).thenReturn(Values.NULL);
        when(fila.get("avatarUrl")).thenReturn(Values.NULL);

        when(result.hasNext()).thenReturn(true, false);
        when(result.next()).thenReturn(fila);
        when(contexto.run(anyString(), any(Value.class))).thenReturn(result);
        when(driver.session()).thenReturn(session);
        when(session.executeRead(any()))
                .thenAnswer(
                        invocacion ->
                                ((TransactionCallback<Object>) invocacion.getArgument(0))
                                        .execute(contexto));

        Neo4jGrafoAdapter conFila = new Neo4jGrafoAdapter();
        conFila.driver = driver;

        List<Usuario> usuarios = conFila.buscarUsuarios("sinnombre", 20L);

        assertEquals(1, usuarios.size());
        assertNull(usuarios.get(0).getNombre(), "Llegó el texto \"null\" como si fuera un nombre");
        assertEquals("sinnombre", usuarios.get(0).getUsername());
    }

    @Test
    @DisplayName("las filas llegan mapeadas con las cuatro propiedades de la lista pública")
    void mapeaLasCuatroPropiedades() {
        Driver driver = mock(Driver.class);
        Session session = mock(Session.class);
        TransactionContext contexto = mock(TransactionContext.class);
        Result result = mock(Result.class);
        Record fila = mock(Record.class);

        when(fila.get("id")).thenReturn(Values.value("beatriz-silva"));
        when(fila.get("username")).thenReturn(Values.value("beatriz"));
        when(fila.get("nombre")).thenReturn(Values.value("Beatriz Silva"));
        when(fila.get("avatarUrl")).thenReturn(Values.value("https://cdn/b.png"));
        when(result.hasNext()).thenReturn(true, false);
        when(result.next()).thenReturn(fila);
        when(contexto.run(anyString(), any(Value.class))).thenReturn(result);
        when(driver.session()).thenReturn(session);
        when(session.executeRead(any()))
                .thenAnswer(
                        invocacion ->
                                ((TransactionCallback<Object>) invocacion.getArgument(0))
                                        .execute(contexto));

        Neo4jGrafoAdapter conFila = new Neo4jGrafoAdapter();
        conFila.driver = driver;

        Usuario beatriz = conFila.buscarUsuarios("beatriz", 20L).get(0);

        assertEquals("beatriz-silva", beatriz.getId());
        assertEquals("beatriz", beatriz.getUsername());
        assertEquals("Beatriz Silva", beatriz.getNombre());
        assertEquals("https://cdn/b.png", beatriz.getAvatarUrl());
        // Y el modelo de dominio no se llena con nada de la sesión: la consulta ni siquiera lo
        // trae.
        assertNull(beatriz.getEmail());
        assertNull(beatriz.getPassword());
        assertNull(beatriz.getPushSubscriptionJson());
    }
}
