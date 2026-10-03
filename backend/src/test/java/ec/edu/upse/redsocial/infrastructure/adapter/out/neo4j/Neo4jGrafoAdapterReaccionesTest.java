package ec.edu.upse.redsocial.infrastructure.adapter.out.neo4j;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.exception.PostNoEncontradoException;
import ec.edu.upse.redsocial.domain.model.Post;
import java.util.List;
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
import org.neo4j.driver.summary.ResultSummary;
import org.neo4j.driver.summary.SummaryCounters;

/**
 * Cubre el dislike y la retirada de reacciones, espejos del like idempotente.
 *
 * <p>Sigue el mismo patrón de {@code Neo4jGrafoAdapterRegistrarLikeTest}: driver, sesión y
 * transacción mockeados, filas simuladas con {@code Record}/{@code Values}. El defecto que se
 * cubre: al existir DISLIKE, los conteos y el {@code EXISTS} del feed mentían sin dar error porque
 * no filtraban por {@code tipo}.
 */
class Neo4jGrafoAdapterReaccionesTest {

    private TransactionContext tx;
    private Session session;
    private Neo4jGrafoAdapter adapter;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void stubeaDriver() {
        Driver driver = mock(Driver.class);
        session = mock(Session.class);
        tx = mock(TransactionContext.class);

        when(driver.session()).thenReturn(session);
        when(session.executeWrite(any()))
                .thenAnswer(
                        invocacion ->
                                ((TransactionCallback<Object>) invocacion.getArgument(0))
                                        .execute(tx));
        when(session.executeRead(any()))
                .thenAnswer(
                        invocacion ->
                                ((TransactionCallback<Object>) invocacion.getArgument(0))
                                        .execute(tx));

        adapter = new Neo4jGrafoAdapter();
        adapter.driver = driver;
    }

    /** Simula una fila devuelta por el Cypher con el total bajo la columna indicada. */
    private void resultadoConTotal(String columna, long total) {
        registrarFila(columna, Values.value(total), Values.value(1));
    }

    /**
     * Reproduce lo que el driver hace de verdad cuando el MATCH no encuentra usuario ni post en una
     * consulta que AGGREGA: sin clave de agrupamiento devuelve UNA fila con cero, no cero filas.
     * Por eso hasNext() es true y el centinela es count(p).
     */
    private void resultadoVacio() {
        registrarFila("totalDislikes", Values.value(0), Values.value(0));
    }

    /**
     * Consulta sin agregación (el feed): si el MATCH no produce filas, el driver no devuelve
     * ninguna. Es el caso opposite a {@link #resultadoVacio()} y por eso son dos helpers distintos.
     */
    private void resultadoSinFilas() {
        Result result = mock(Result.class);
        when(result.hasNext()).thenReturn(false);
        when(tx.run(anyString(), any(Value.class))).thenReturn(result);
    }

    private void registrarFila(String columna, Value total, Value encontrados) {
        Record fila = mock(Record.class);
        when(fila.get(columna)).thenReturn(total);
        when(fila.get("encontrados")).thenReturn(encontrados);
        Result result = mock(Result.class);
        // El driver SIEMPRE entrega una fila en esta consulta, incluso sin coincidencias.
        when(result.hasNext()).thenReturn(true);
        when(result.next()).thenReturn(fila);
        when(tx.run(anyString(), any(Value.class))).thenReturn(result);
    }

    /** Simula el resumen de un DELETE con tantas relaciones borradas. */
    private void borradas(int cantidad) {
        SummaryCounters counters = mock(SummaryCounters.class);
        when(counters.relationshipsDeleted()).thenReturn(cantidad);
        ResultSummary resumen = mock(ResultSummary.class);
        when(resumen.counters()).thenReturn(counters);
        Result result = mock(Result.class);
        when(result.consume()).thenReturn(resumen);
        when(tx.run(anyString(), any(Value.class))).thenReturn(result);
    }

    private String consultaNormalizada() {
        ArgumentCaptor<String> cypher = ArgumentCaptor.forClass(String.class);
        verify(tx).run(cypher.capture(), any(Value.class));
        return cypher.getValue().replaceAll("\\s+", " ").trim();
    }

    private Value parametrosEnviados() {
        ArgumentCaptor<Value> params = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(anyString(), params.capture());
        return params.getValue();
    }

    @Test
    @DisplayName("el dislike se registra con MERGE y tipo DISLIKE, no con CREATE")
    void elDislikeUsaMergeConTipoDislike() {
        resultadoConTotal("totalDislikes", 1);

        adapter.registrarDislike("carlos-patino", "post-b1");

        String consulta = consultaNormalizada();
        assertTrue(
                consulta.contains("MERGE (u)-[r:REACCIONA {tipo: 'DISLIKE'}]->(p)"),
                "El dislike debe registrarse con MERGE y tipo DISLIKE: " + consulta);
        assertTrue(
                consulta.contains("ON CREATE SET r.fecha = timestamp()"),
                "La fecha solo debe fijarse al crear la relación: " + consulta);
        assertTrue(
                !consulta.contains("CREATE (u)-[r:REACCIONA"),
                "No debe haber un CREATE que duplique la relación: " + consulta);
    }

    @Test
    @DisplayName("registrar dislike cuenta dislikes, no likes")
    void registrarDislikeCuentaSoloDislikes() {
        resultadoConTotal("totalDislikes", 3);

        assertEquals(3, adapter.registrarDislike("carlos-patino", "post-b1"));

        String consulta = consultaNormalizada();
        // Sin el filtro, los likes del post inflarían el total de dislikes.
        assertTrue(
                consulta.contains("[reaccion:REACCIONA {tipo: 'DISLIKE'}]"),
                "El conteo tras el MERGE debe filtrar por tipo DISLIKE: " + consulta);
        assertTrue(
                !consulta.contains("[reaccion:REACCIONA]-("),
                "El conteo no puede leer reacciones sin filtro de tipo: " + consulta);
    }

    @Test
    @DisplayName("registrar dislike lanza PostNoEncontradoException si no hay coincidencia")
    void registrarDislikeFallaCuandoNoHayCoincidencia() {
        resultadoVacio();

        PostNoEncontradoException error =
                assertThrows(
                        PostNoEncontradoException.class,
                        () -> adapter.registrarDislike("carlos-patino", "post-inexistente"));

        assertEquals("post-inexistente", error.getPostId());
    }

    @Test
    @DisplayName("registrar dislike envía usuario y publicación como parámetros")
    void registrarDislikeEnviaLosParametros() {
        resultadoConTotal("totalDislikes", 1);

        adapter.registrarDislike("carlos-patino", "post-b1");

        assertEquals(
                Values.parameters("userId", "carlos-patino", "postId", "post-b1").asMap(),
                parametrosEnviados().asMap());
    }

    @Test
    @DisplayName("retirar like borra la reacción LIKE y devuelve true")
    void retirarLikeBorraYDevuelveTrue() {
        borradas(1);

        assertTrue(adapter.retirarLike("carlos-patino", "post-b1"));

        String consulta = consultaNormalizada();
        assertTrue(consulta.contains("DELETE r"), "Retirar debe borrar la relación: " + consulta);
        assertTrue(
                !consulta.contains("MERGE") && !consulta.contains("CREATE"),
                "Retirar no debe crear nada: " + consulta);
        assertEquals(
                Values.parameters("userId", "carlos-patino", "postId", "post-b1", "tipo", "LIKE")
                        .asMap(),
                parametrosEnviados().asMap());
    }

    @Test
    @DisplayName("retirar like devuelve false si no había nada que borrar")
    void retirarLikeDevuelveFalseSiNoHabiaReaccion() {
        borradas(0);

        assertFalse(adapter.retirarLike("carlos-patino", "post-b1"));
    }

    @Test
    @DisplayName("retirar dislike borra la reacción DISLIKE y devuelve true")
    void retirarDislikeBorraYDevuelveTrue() {
        borradas(1);

        assertTrue(adapter.retirarDislike("carlos-patino", "post-b1"));

        String consulta = consultaNormalizada();
        assertTrue(consulta.contains("DELETE r"), "Retirar debe borrar la relación: " + consulta);
        assertEquals(
                Values.parameters("userId", "carlos-patino", "postId", "post-b1", "tipo", "DISLIKE")
                        .asMap(),
                parametrosEnviados().asMap());
    }

    @Test
    @DisplayName("retirar dislike devuelve false si no había nada que borrar")
    void retirarDislikeDevuelveFalseSiNoHabiaReaccion() {
        borradas(0);

        assertFalse(adapter.retirarDislike("carlos-patino", "post-b1"));
    }

    @Test
    @DisplayName("el feed filtra likes y dislikes por tipo en conteos y marcas")
    void elFeedFiltraPorTipo() {
        resultadoSinFilas();

        adapter.obtenerFeedCronologico("carlos-patino");

        String consulta = consultaNormalizada();
        // Sin estos filtros, un dislike sumaría en totalLikes y marcaría likedByMe.
        assertTrue(
                consulta.contains("[rl:REACCIONA {tipo: 'LIKE'}]"),
                "El conteo de likes debe filtrar por tipo LIKE: " + consulta);
        assertTrue(
                consulta.contains("[rd:REACCIONA {tipo: 'DISLIKE'}]"),
                "El conteo de dislikes debe filtrar por tipo DISLIKE: " + consulta);
        assertTrue(
                consulta.contains("-[:REACCIONA {tipo: 'LIKE'}]->(p)) AS likedByMe"),
                "likedByMe debe filtrar por tipo LIKE: " + consulta);
        assertTrue(
                consulta.contains("-[:REACCIONA {tipo: 'DISLIKE'}]->(p)) AS dislikedByMe"),
                "dislikedByMe debe filtrar por tipo DISLIKE: " + consulta);
        assertTrue(
                !consulta.contains("count(r)") && !consulta.contains("count(reaccion)"),
                "Ningún conteo puede leer reacciones sin filtro de tipo: " + consulta);
    }

    @Test
    @DisplayName("el feed mapea totalDislikes y dislikedByMe en cada post")
    void elFeedMapeaDislikes() {
        Record fila = mock(Record.class);
        when(fila.get("id")).thenReturn(Values.value("post-b1"));
        when(fila.get("texto")).thenReturn(Values.value("Hola red"));
        when(fila.get("mediaUrl")).thenReturn(Values.NULL);
        when(fila.get("fecha")).thenReturn(Values.value(1727269000000L));
        when(fila.get("autorId")).thenReturn(Values.value("carlos-patino"));
        when(fila.get("autorUsername")).thenReturn(Values.value("carlos"));
        when(fila.get("autorAvatar")).thenReturn(Values.NULL);
        when(fila.get("totalLikes")).thenReturn(Values.value(2L));
        when(fila.get("likedByMe")).thenReturn(Values.value(false));
        when(fila.get("totalDislikes")).thenReturn(Values.value(1L));
        when(fila.get("dislikedByMe")).thenReturn(Values.value(true));
        Result result = mock(Result.class);
        when(result.hasNext()).thenReturn(true, false);
        when(result.next()).thenReturn(fila);
        when(tx.run(anyString(), any(Value.class))).thenReturn(result);

        List<Post> feed = adapter.obtenerFeedCronologico("carlos-patino");

        assertEquals(1, feed.size());
        assertEquals(2L, feed.get(0).getTotalLikes());
        assertEquals(1L, feed.get(0).getTotalDislikes());
        assertFalse(feed.get(0).isLikedByMe());
        assertTrue(feed.get(0).isDislikedByMe());
    }
}
