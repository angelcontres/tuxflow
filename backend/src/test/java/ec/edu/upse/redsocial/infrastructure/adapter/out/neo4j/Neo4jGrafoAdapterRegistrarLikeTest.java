package ec.edu.upse.redsocial.infrastructure.adapter.out.neo4j;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.exception.PostNoEncontradoException;
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
 * Cubre que registrar un like sea idempotente y que devuelva el total real de reacciones.
 *
 * <p>El defecto que se cubre: el {@code MERGE} se descartaba con {@code .consume()}, así que un
 * post o un usuario inexistente devolvía la misma respuesta que un like correcto. El cliente
 * entonces pintaba un corazón marcado que en el grafo no existía.
 */
class Neo4jGrafoAdapterRegistrarLikeTest {

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

        adapter = new Neo4jGrafoAdapter();
        adapter.driver = driver;
    }

    /** Simula una fila devuelta por el Cypher con el total de reacciones. */
    private void resultadoConTotal(long total) {
        registrarFila(Values.value(total), Values.value(1));
    }

    /**
     * Reproduce lo que el driver hace de verdad cuando el MATCH no encuentra usuario ni post: la
     * agregación sin clave de agrupamiento devuelve UNA fila con cero, no cero filas. Por eso
     * hasNext() es true y el centinela es count(p).
     */
    private void resultadoVacio() {
        registrarFila(Values.value(0), Values.value(0));
    }

    private void registrarFila(Value totalLikes, Value encontrados) {
        Record fila = mock(Record.class);
        when(fila.get("totalLikes")).thenReturn(totalLikes);
        when(fila.get("encontrados")).thenReturn(encontrados);
        Result result = mock(Result.class);
        // El driver SIEMPRE entrega una fila en esta consulta, incluso sin coincidencias.
        when(result.hasNext()).thenReturn(true);
        when(result.next()).thenReturn(fila);
        when(tx.run(anyString(), any(Value.class))).thenReturn(result);
    }

    private String consultaNormalizada() {
        ArgumentCaptor<String> cypher = ArgumentCaptor.forClass(String.class);
        verify(tx).run(cypher.capture(), any(Value.class));
        return cypher.getValue().replaceAll("\\s+", " ").trim();
    }

    @Test
    @DisplayName("la reacción se registra con MERGE, no con CREATE")
    void laReaccionUsaMerge() {
        resultadoConTotal(1);

        adapter.registrarLike("carlos-patino", "post-b1");

        String consulta = consultaNormalizada();
        // MERGE es lo que hace idempotente el like; CREATE duplicaría la relación en cada clic.
        assertTrue(
                consulta.contains("MERGE (u)-[r:REACCIONA {tipo: 'LIKE'}]->(p)"),
                "El like debe seguir registrándose con MERGE: " + consulta);
        assertTrue(
                consulta.contains("ON CREATE SET r.fecha = timestamp()"),
                "La fecha solo debe fijarse al crear la relación, para que repetir el like no la "
                        + "cambie: "
                        + consulta);
        assertTrue(
                !consulta.contains("CREATE (u)-[r:REACCIONA"),
                "No debe haber un CREATE que duplique la relación: " + consulta);
    }

    @Test
    @DisplayName("devuelve el total de reacciones que cuenta el grafo")
    void devuelveElTotalDelGrafo() {
        resultadoConTotal(7);

        assertEquals(7, adapter.registrarLike("carlos-patino", "post-b1"));
    }

    @Test
    @DisplayName("el conteo se lee después del MERGE para incluir la reacción recién creada")
    void elConteoSeLeeDespuesDelMerge() {
        resultadoConTotal(1);

        adapter.registrarLike("carlos-patino", "post-b1");

        String consulta = consultaNormalizada();
        int posicionMerge = consulta.indexOf("MERGE");
        int posicionConteo = consulta.indexOf("count(reaccion)");
        assertTrue(
                posicionMerge >= 0 && posicionConteo > posicionMerge,
                "El conteo tiene que ir después del MERGE o devolvería el total anterior al like: "
                        + consulta);
    }

    @Test
    @DisplayName("lanza PostNoEncontradoException cuando el usuario o la publicación no existen")
    void fallaCuandoNoHayCoincidencia() {
        resultadoVacio();

        PostNoEncontradoException error =
                assertThrows(
                        PostNoEncontradoException.class,
                        () -> adapter.registrarLike("carlos-patino", "post-inexistente"));

        assertEquals("post-inexistente", error.getPostId());
    }

    @Test
    @DisplayName("envía el usuario y la publicación como parámetros, no interpolados")
    void enviaLosParametros() {
        resultadoConTotal(1);

        adapter.registrarLike("carlos-patino", "post-b1");

        ArgumentCaptor<Value> params = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(anyString(), params.capture());
        // Solo userId y postId: el total lo cuenta la propia consulta, así que un parámetro de
        // conteo sería una segunda fuente de verdad para el mismo número.
        assertEquals(
                Values.parameters("userId", "carlos-patino", "postId", "post-b1").asMap(),
                params.getValue().asMap());
    }
}
