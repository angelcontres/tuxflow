package ec.edu.upse.redsocial.infrastructure.adapter.out.neo4j;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
 * La ventana de siete días de las tendencias, que fue el defecto más difícil de ver del proyecto.
 *
 * <p>El endpoint devolvía siempre vacío por dos motivos encadenados, y cada uno tapa al otro:
 *
 * <ol>
 *   <li>La condición comparaba un entero ({@code fechaCreacion}, que es epochMillis) contra {@code
 *       datetime()}, que es una fecha con hora. Entero contra fecha con hora es siempre falso.
 *   <li>Corregido eso, el arreglo natural —restar {@code duration('P7D').milliseconds}— tampoco
 *       funciona, porque esa propiedad vale <b>cero</b>. Neo4j separa la duración en meses/días y
 *       segundos/nanos, y {@code .milliseconds} sólo lee la parte sub-día. Medido en Neo4j 5.20:
 *       {@code duration('P7D').milliseconds} es 0 y {@code duration('P7D').days} es 7.
 * </ol>
 *
 * <p>El segundo es el que hace el defecto peligroso: el Cypher resultante se lee como correcto, así
 * que quien lo repase no ve nada raro, y el endpoint sigue vacío. Estas pruebas fijan las dos
 * cosas: la forma que funciona está, y la que no funciona no.
 */
class Neo4jGrafoAdapterTendenciasTest {

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
        when(result.hasNext()).thenReturn(true, true, false);
        when(result.next()).thenReturn(filas[0], filas[1]);

        adapter = new Neo4jGrafoAdapter();
        adapter.driver = driver;
    }

    private static Value valor(String contenido) {
        return Values.parameters("propiedad", (Object) contenido).get("propiedad");
    }

    private static long numero(long contenido) {
        return Values.parameters("propiedad", (Object) contenido).get("propiedad").asLong();
    }

    private Record fila(String id, String texto, String autor, long reacciones) {
        Record record = mock(Record.class);
        when(record.get("id")).thenReturn(valor(id));
        when(record.get("texto")).thenReturn(valor(texto));
        when(record.get("autor")).thenReturn(valor(autor));
        when(record.get("totalReacciones")).thenReturn(Values.value(reacciones));
        return record;
    }

    private String cypherDeTendencias() {
        filasDevueltas(
                fila("post-1", "Popular", "beatriz", 9),
                fila("post-2", "Menos popular", "paulo", 3));
        adapter.obtenerTendenciasRedExtendida("carlos-patino");

        ArgumentCaptor<String> cypher = ArgumentCaptor.forClass(String.class);
        verify(tx).run(cypher.capture(), any(Value.class));
        return cypher.getValue().replaceAll("\\s+", " ").trim();
    }

    @Test
    @DisplayName("el umbral de siete días se calcula con los días, no con los milisegundos")
    void elUmbralUsaLaParteDeDias() {
        String consulta = cypherDeTendencias();

        // La forma que funciona: los días multiplicados por los milisegundos de un día.
        assertTrue(
                consulta.contains("duration('P7D').days * 86400000"),
                "El umbral no convierte la duración a milisegundos: " + consulta);
    }

    @Test
    @DisplayName("el umbral NO usa duration('P7D').milliseconds, que vale cero")
    void elUmbralNoUsaLaPropiedadQueValeCero() {
        String consulta = cypherDeTendencias();

        // Esta es la aserción que evita el falso arreglo. `.milliseconds` sobre P7D devuelve 0, así
        // que restarla no cambia el umbral y el endpoint sigue vacío. Un Cypher que se lee bien y
        // no
        // hace nada es peor que uno que se ve mal.
        assertFalse(
                consulta.contains("duration('P7D').milliseconds"),
                "El umbral resta cero: la consulta seguiría devolviendo vacío: " + consulta);
    }

    @Test
    @DisplayName("la comparación es entre enteros, no entre un entero y una fecha con hora")
    void laComparacionEsEntreEnteros() {
        String consulta = cypherDeTendencias();

        assertTrue(
                consulta.contains("datetime().epochMillis"),
                "No compara contra epochMillis: " + consulta);
        assertFalse(
                consulta.contains(">= datetime() -"),
                "Compara contra datetime() en vez de contra su epochMillis: " + consulta);
    }

    @Test
    @DisplayName("las reacciones se cuentan por tipo y sin multiplicar por caminos")
    void cuentaLasReaccionesComoPersonas() {
        String consulta = cypherDeTendencias();

        // US-06 hizo que like y dislike sean excluyentes: sin el filtro por tipo, un dislike cuenta
        // como un like. Y con dos OPTIONAL MATCH, `count` a secas multiplicaría los totales.
        assertTrue(
                consulta.contains("{tipo: 'LIKE'}"),
                "No filtra las reacciones por tipo: " + consulta);
        assertTrue(
                consulta.contains("count(DISTINCT reactor)"),
                "Cuenta filas, no personas: " + consulta);
        assertFalse(
                consulta.contains("count(reactor)"),
                "El conteo multiplica por caminos: " + consulta);
    }

    @Test
    @DisplayName("devuelve las tendencias con el total de reacciones de cada publicación")
    void devuelveLasTendenciasConSusTotales() {
        filasDevueltas(
                fila("post-1", "Popular", "beatriz", 9),
                fila("post-2", "Menos popular", "paulo", 3));

        List<Map<String, Object>> resultado =
                adapter.obtenerTendenciasRedExtendida("carlos-patino");

        assertEquals(2, resultado.size());
        assertEquals("post-1", resultado.get(0).get("id"));
        assertEquals(9L, resultado.get(0).get("totalReacciones"));
        assertEquals("beatriz", resultado.get(0).get("autor"));
    }

    @Test
    @DisplayName("sin tendencias devuelve la lista vacía, no un error")
    void sinTendenciasDevuelveListaVacia() {
        Driver driver = mock(Driver.class);
        Session session = mock(Session.class);
        TransactionContext contexto = mock(TransactionContext.class);
        Result result = mock(Result.class);

        when(driver.session()).thenReturn(session);
        when(session.executeRead(any()))
                .thenAnswer(
                        invocacion ->
                                ((TransactionCallback<Object>) invocacion.getArgument(0))
                                        .execute(contexto));
        when(contexto.run(anyString(), any(Value.class))).thenReturn(result);
        when(result.hasNext()).thenReturn(false);

        Neo4jGrafoAdapter vacio = new Neo4jGrafoAdapter();
        vacio.driver = driver;

        assertTrue(vacio.obtenerTendenciasRedExtendida("carlos-patino").isEmpty());
    }
}
