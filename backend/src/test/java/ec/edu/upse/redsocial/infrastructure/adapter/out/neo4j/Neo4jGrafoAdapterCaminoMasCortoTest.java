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

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
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
 * Cubre el camino más corto (Cypher #4 obligatoria) sin levantar un Neo4j: se stubea el driver y se
 * devuelve el {@link Result} con las filas que el grafo devolvería.
 */
class Neo4jGrafoAdapterCaminoMasCortoTest {

    private Driver driver;
    private TransactionContext tx;
    private Neo4jGrafoAdapter adapter;

    /** Stubea el driver para que la consulta devuelva exactamente las filas indicadas. */
    @SuppressWarnings("unchecked")
    private void filasDevueltas(Record... filas) {
        driver = mock(Driver.class);
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

        // Un adaptador de camino lee como mucho una fila, pero el cursor se mueve igual: el
        // índice es lo que decide cuándo no hay más, y con cero filas hasNext() es false de
        // entrada. Es el caso de "no hay camino dentro de seis grados".
        AtomicInteger cursor = new AtomicInteger();
        when(result.hasNext()).thenAnswer(invocacion -> cursor.get() < filas.length);
        when(result.next()).thenAnswer(invocacion -> filas[cursor.getAndIncrement()]);

        adapter = new Neo4jGrafoAdapter();
        adapter.driver = driver;
    }

    /** Nodo del camino tal como lo entrega el grafo: identificador y nombre de usuario. */
    private static Map<String, Object> salto(String id, String username) {
        Map<String, Object> nodo = new HashMap<>();
        nodo.put("id", id);
        nodo.put("username", username);
        return nodo;
    }

    /** Valor tal como lo entrega el driver por la lista de saltos proyectada. */
    private static Value valorRuta(List<Map<String, Object>> ruta) {
        return Values.parameters("ruta", (Object) ruta).get("ruta");
    }

    /** Construye una fila con la forma que devuelve el Cypher #4. */
    private static Record filaCamino(List<Map<String, Object>> ruta, int saltos) {
        Record record = mock(Record.class);
        when(record.get("rutaConexion")).thenReturn(valorRuta(ruta));
        when(record.get("saltosTotales")).thenReturn(Values.value((long) saltos));
        return record;
    }

    @Test
    @DisplayName("devuelve la ruta con identificador y nombre de usuario, y los saltos totales")
    void devuelveLaRutaYLosSaltos() {
        filasDevueltas(
                filaCamino(
                        List.of(
                                salto("carlos-patino", "carlos"),
                                salto("beatriz-silva", "beatriz"),
                                salto("david-mendoza", "david"),
                                salto("elena-vega", "elena")),
                        3));

        Map<String, Object> resultado =
                adapter.obtenerCaminoMasCorto("carlos-patino", "elena-vega");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> ruta = (List<Map<String, Object>>) resultado.get("rutaConexion");
        assertEquals(4, ruta.size());
        // El orden importa: es el de la cadena de seguimiento, no uno alfabético.
        assertEquals("carlos-patino", ruta.get(0).get("id"));
        assertEquals("carlos", ruta.get(0).get("username"));
        assertEquals("beatriz", ruta.get(1).get("username"));
        assertEquals("david", ruta.get(2).get("username"));
        assertEquals("elena", ruta.get(3).get("username"));
        assertEquals(3, resultado.get("saltosTotales"));
    }

    @Test
    @DisplayName("sin camino devuelve ruta vacía y cero saltos, no un mapa vacío")
    void sinCaminoDevuelveLaFormaVaciaExplicita() {
        // El shortestPath no devuelve filas cuando no hay cadena dentro de seis grados. Antes
        // se respondía con Collections.emptyMap(), que es indistinguible de una petición sin
        // parámetros: el cliente no podía pintar "no hay conexión" sin tratarlo como fallo.
        filasDevueltas();

        Map<String, Object> resultado =
                adapter.obtenerCaminoMasCorto("carlos-patino", "angel-villon");

        assertTrue(
                resultado.containsKey("rutaConexion"), "Falta la clave rutaConexion: " + resultado);
        assertTrue(
                resultado.containsKey("saltosTotales"),
                "Falta la clave saltosTotales: " + resultado);
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> ruta = (List<Map<String, Object>>) resultado.get("rutaConexion");
        assertTrue(ruta.isEmpty());
        assertEquals(0, resultado.get("saltosTotales"));
    }

    @Test
    @DisplayName("un salto sin username no anula el resto de la ruta")
    void unSaltoSinUsernameNoRompeLaRuta() {
        // En Neo4j asignar null a una propiedad la elimina, así que un usuario sin username
        // llega sin la propiedad. Sin sustituirla, NullValue.asString() devolvería el texto
        // literal "null" y se vería como un nombre real.
        filasDevueltas(
                filaCamino(
                        List.of(salto("carlos-patino", "carlos"), salto("misterioso", null)), 1));

        Map<String, Object> resultado =
                adapter.obtenerCaminoMasCorto("carlos-patino", "misterioso");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> ruta = (List<Map<String, Object>>) resultado.get("rutaConexion");
        assertEquals(
                2, ruta.size(), "La ruta completa debe llegar aunque un salto venga sin nombre");
        assertEquals("carlos", ruta.get(0).get("username"));
        assertEquals("desconocido", ruta.get(1).get("username"));
        // El identificador sigue ahí: no se pierde información al sustituir el nombre.
        assertEquals("misterioso", ruta.get(1).get("id"));
        assertEquals(1, resultado.get("saltosTotales"));
    }

    @Test
    @DisplayName("un salto sin identificador llega con id null y la ruta no falla")
    void unSaltoSinIdentificadorLlegaConIdNull() {
        filasDevueltas(filaCamino(List.of(salto(null, "carlos")), 0));

        Map<String, Object> resultado =
                adapter.obtenerCaminoMasCorto("carlos-patino", "carlos-patino");

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> ruta = (List<Map<String, Object>>) resultado.get("rutaConexion");
        assertEquals(1, ruta.size());
        assertNull(ruta.get(0).get("id"));
        assertEquals("carlos", ruta.get(0).get("username"));
    }

    @Test
    @DisplayName("la consulta enviada es el Cypher #4 de camino más corto")
    void ejecutaElCypherDeCaminoMasCorto() {
        filasDevueltas(
                filaCamino(
                        List.of(salto("carlos-patino", "carlos"), salto("elena-vega", "elena")),
                        1));

        adapter.obtenerCaminoMasCorto("carlos-patino", "elena-vega");

        ArgumentCaptor<String> cypher = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Value> params = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(cypher.capture(), params.capture());

        String consulta = cypher.getValue().replaceAll("\\s+", " ").trim();
        assertTrue(consulta.contains("MATCH p = shortestPath("), consulta);
        assertTrue(
                consulta.contains(
                        "(origen:Usuario {id: $origenId})-[:SIGUE*..6]->(destino:Usuario {id: $destinoId})"),
                "El alcance dirigido de seis grados se perdió: " + consulta);
        // D1: el recorrido es dirigido. Las dos formas sin dirección --la variable de longitud
        // suelta y la flecha invertida-- encontrarían conexiones que la consulta del ticket no
        // encuentra, así que se fijan aquí para que no se introduzcan en silencio.
        assertFalse(
                consulta.contains("[:SIGUE*..6]-(destino"),
                "El alcance quedó sin dirección: " + consulta);
        assertFalse(
                consulta.contains("<-[:SIGUE*..6]-(origen"),
                "El alcance quedó con la flecha invertida: " + consulta);
        assertTrue(consulta.contains("WHERE origen <> destino"), consulta);
        assertTrue(consulta.contains("length(p) AS saltosTotales"), consulta);

        Map<String, Object> enviados = params.getValue().asMap();
        assertEquals("carlos-patino", enviados.get("origenId"));
        assertEquals("elena-vega", enviados.get("destinoId"));
    }

    @Test
    @DisplayName("la ruta proyecta el identificador junto al nombre de usuario de cada salto")
    void laRutaProyectaIdentificadorYUsername() {
        // D4: sin identificadores la interfaz imprime el camino como texto y no puede recorrer
        // cada salto. El cURL del ticket espera una lista de nombres; el identificador viaja
        // en el mismo elemento para no perder lo que el ticket pide.
        filasDevueltas(filaCamino(new ArrayList<>(), 0));

        adapter.obtenerCaminoMasCorto("carlos-patino", "elena-vega");

        ArgumentCaptor<String> cypher = ArgumentCaptor.forClass(String.class);
        verify(tx).run(cypher.capture(), any(Value.class));

        String consulta = cypher.getValue().replaceAll("\\s+", " ").trim();
        assertTrue(consulta.contains("AS rutaConexion"), consulta);
        assertTrue(consulta.contains("{id: n.id, username: n.username}"), consulta);
    }
}
