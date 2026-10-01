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
 * Cubre el mapeo de la intersección de seguidos (Cypher #3 obligatoria) sin levantar un Neo4j: se
 * stubea el driver y se devuelve un {@link Result} con las filas que el grafo devolvería.
 */
class Neo4jGrafoAdapterConexionesComunesTest {

    private TransactionContext tx;
    private Neo4jGrafoAdapter adapter;

    /** Stubea el driver para que la consulta devuelva las filas indicadas. */
    @SuppressWarnings("unchecked")
    private void filasDevueltas(Record... filas) {
        Driver driver = mock(Driver.class);
        Session session = mock(Session.class);
        tx = mock(TransactionContext.class);
        Result result = mock(Result.class);

        when(driver.session()).thenReturn(session);
        when(session.executeRead(any()))
                .thenAnswer(
                        invocacion ->
                                ((TransactionCallback<Object>) invocacion.getArgument(0))
                                        .execute(tx));
        when(tx.run(anyString(), any(Value.class))).thenReturn(result);
        // El adaptador consume las filas con un while(result.hasNext()): dos true
        // seguidos y un false en el tercer llamado.
        when(result.hasNext()).thenReturn(true, true, false);
        when(result.next()).thenReturn(filas[0], filas[1]);

        adapter = new Neo4jGrafoAdapter();
        adapter.driver = driver;
    }

    /**
     * Valor tal como lo entrega el driver por una propiedad del grafo.
     *
     * <p>Para una propiedad ausente reproduce el {@code NullValue} que produce Neo4j. Ojo con su
     * {@code asString()}: no lanza, devuelve el texto literal "null".
     */
    private static Value valor(String texto) {
        return Values.parameters("propiedad", (Object) texto).get("propiedad");
    }

    /** Construye una fila con la forma que devuelve el Cypher #3. */
    private Record fila(String id, String username, String nombre, String avatar) {
        Record record = mock(Record.class);
        when(record.get("id")).thenReturn(valor(id));
        when(record.get("username")).thenReturn(valor(username));
        when(record.get("nombre")).thenReturn(valor(nombre));
        when(record.get("avatar")).thenReturn(valor(avatar));
        return record;
    }

    @Test
    @DisplayName("obtenerSeguidoresEnComun devuelve las personas que ambos perfiles siguen")
    void devuelveLaInterseccionDeSeguidos() {
        filasDevueltas(
                fila("beatriz-silva", "beatriz", "Beatriz Silva", "https://cdn/beatriz.png"),
                fila("paulo-orrala", "paulo", "Paulo Orrala", null));

        List<Usuario> resultado = adapter.obtenerSeguidoresEnComun("carlos-patino", "angel-villon");

        assertEquals(2, resultado.size());
        assertEquals("beatriz-silva", resultado.get(0).getId());
        assertEquals("beatriz", resultado.get(0).getUsername());
        assertEquals("Beatriz Silva", resultado.get(0).getNombre());
        assertEquals("https://cdn/beatriz.png", resultado.get(0).getAvatarUrl());
        assertEquals("Paulo Orrala", resultado.get(1).getNombre());
    }

    @Test
    @DisplayName("un usuario sin nombre llega con nombre null, no con el texto \"null\"")
    void usuarioSinNombreNoSeConvierteEnElTextoNull() {
        // guardarUsuario hace SET u.nombre = $nombre, y en Neo4j asignar null a una
        // propiedad la elimina: el nodo llega sin la propiedad. El defecto no es un
        // 500 -- el driver no lanza -- sino que NullValue.asString() devuelve el texto
        // literal "null", y ese nombre inventado sale por la API como si fuera real.
        filasDevueltas(
                fila("beatriz-silva", "beatriz", null, null),
                fila("paulo-orrala", "paulo", "Paulo Orrala", null));

        List<Usuario> resultado = adapter.obtenerSeguidoresEnComun("carlos-patino", "angel-villon");

        assertEquals(2, resultado.size());
        assertNull(resultado.get(0).getNombre());
        assertNull(resultado.get(0).getAvatarUrl());
        assertEquals("beatriz", resultado.get(0).getUsername());
        assertEquals("Paulo Orrala", resultado.get(1).getNombre());
    }

    @Test
    @DisplayName("un usuario sin avatar degrada a null")
    void usuarioSinAvatarDegradaANull() {
        filasDevueltas(
                fila("paulo-orrala", "paulo", "Paulo Orrala", null),
                fila("david-mendoza", "david", "David Mendoza", null));

        List<Usuario> resultado = adapter.obtenerSeguidoresEnComun("carlos-patino", "angel-villon");

        assertNull(resultado.get(0).getAvatarUrl());
        assertEquals("David Mendoza", resultado.get(1).getNombre());
    }

    @Test
    @DisplayName("la consulta enviada es el Cypher #3 de intersección de seguidas")
    void ejecutaElCypherDeInterseccionDeSeguidos() {
        filasDevueltas(
                fila("beatriz-silva", "beatriz", "Beatriz Silva", null),
                fila("paulo-orrala", "paulo", "Paulo Orrala", null));

        adapter.obtenerSeguidoresEnComun("carlos-patino", "angel-villon");

        ArgumentCaptor<String> cypher = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Value> params = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(cypher.capture(), params.capture());

        // Las dos flechas apuntan HACIA comun: u1 sigue a comun y u2 sigue a comun.
        // Es lo que dice el criterio de aceptación ("siguen conjuntamente a beatriz y
        // paulo"). La forma invertida, (u1)<-[:SIGUE]-(comun)-[:SIGUE]->(u2), devuelve
        // a quienes siguen a los dos, que es otra pregunta, y con la semilla del
        // proyecto hace que el cURL del ticket devuelva [].
        String consulta = cypher.getValue().replaceAll("\\s+", " ").trim();
        assertTrue(
                consulta.contains(
                        "MATCH (u1:Usuario {id: $userA})-[:SIGUE]->(comun:Usuario)<-[:SIGUE]-(u2:Usuario {id: $userB})"),
                "La consulta no es la intersección de seguidas: " + consulta);
        assertFalse(
                consulta.contains("u1:Usuario {id: $userA})<-[:SIGUE]-(comun"),
                "Las flechas están invertidas: devolvería los seguidores comunes: " + consulta);
        assertTrue(consulta.contains("comun.username AS username"), consulta);
        assertTrue(consulta.contains("comun.avatarUrl AS avatar"), consulta);

        Map<String, Object> enviados = params.getValue().asMap();
        assertEquals("carlos-patino", enviados.get("userA"));
        assertEquals("angel-villon", enviados.get("userB"));
    }
}
