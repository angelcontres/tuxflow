package ec.edu.upse.redsocial.infrastructure.adapter.out.neo4j;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.exception.PostNoEncontradoException;
import ec.edu.upse.redsocial.domain.model.EstadoReaccion;
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

/**
 * Cubre el dislike y la retirada de reacciones, espejos del like idempotente, más la mutualidad
 * entre ambas.
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

    /** Simula la fila que devuelve el Cypher de registro con ambos totales más el centinela. */
    private void resultadoConTotales(long totalLikes, long totalDislikes) {
        registrarFila(Values.value(totalLikes), Values.value(totalDislikes), Values.value(1));
    }

    /**
     * Reproduce lo que el driver hace de verdad cuando el MATCH no encuentra usuario ni post en una
     * consulta que AGGREGA: sin clave de agrupamiento devuelve UNA fila con cero, no cero filas.
     * Por eso hasNext() es true y el centinela es count(p).
     */
    private void resultadoVacio() {
        registrarFila(Values.value(0), Values.value(0), Values.value(0));
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

    private void registrarFila(Value totalLikes, Value totalDislikes, Value encontrados) {
        Record fila = mock(Record.class);
        when(fila.get("totalLikes")).thenReturn(totalLikes);
        when(fila.get("totalDislikes")).thenReturn(totalDislikes);
        when(fila.get("encontrados")).thenReturn(encontrados);
        Result result = mock(Result.class);
        // El driver SIEMPRE entrega una fila en esta consulta, incluso sin coincidencias.
        when(result.hasNext()).thenReturn(true);
        when(result.next()).thenReturn(fila);
        when(tx.run(anyString(), any(Value.class))).thenReturn(result);
    }

    /**
     * Simula la retirada en dos pasos dentro de la misma transacción: el {@code DELETE} (cuyo
     * resumen se consume) y el conteo posterior que devuelve el estado completo.
     */
    private void borradoYConteo(long totalLikes, long totalDislikes, long encontrados) {
        Result borrado = mock(Result.class);
        when(borrado.consume()).thenReturn(mock(ResultSummary.class));
        Record fila = mock(Record.class);
        when(fila.get("totalLikes")).thenReturn(Values.value(totalLikes));
        when(fila.get("totalDislikes")).thenReturn(Values.value(totalDislikes));
        when(fila.get("encontrados")).thenReturn(Values.value(encontrados));
        Result conteo = mock(Result.class);
        when(conteo.hasNext()).thenReturn(true);
        when(conteo.next()).thenReturn(fila);
        when(tx.run(anyString(), any(Value.class))).thenReturn(borrado, conteo);
    }

    private void borradoYConteo(long totalLikes, long totalDislikes) {
        borradoYConteo(totalLikes, totalDislikes, 1);
    }

    private String consultaNormalizada() {
        ArgumentCaptor<String> cypher = ArgumentCaptor.forClass(String.class);
        verify(tx).run(cypher.capture(), any(Value.class));
        return cypher.getValue().replaceAll("\\s+", " ").trim();
    }

    /** Las dos consultas de la retirada: primero el DELETE, después el conteo. */
    private List<String> consultasNormalizadas() {
        ArgumentCaptor<String> cypher = ArgumentCaptor.forClass(String.class);
        verify(tx, times(2)).run(cypher.capture(), any(Value.class));
        return cypher.getAllValues().stream().map(c -> c.replaceAll("\\s+", " ").trim()).toList();
    }

    private Value parametrosEnviados() {
        ArgumentCaptor<Value> params = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(anyString(), params.capture());
        return params.getValue();
    }

    /** Parámetros del DELETE en la retirada: es la primera de las dos consultas. */
    private Value parametrosDelBorrado() {
        ArgumentCaptor<Value> params = ArgumentCaptor.forClass(Value.class);
        verify(tx, times(2)).run(anyString(), params.capture());
        return params.getAllValues().get(0);
    }

    @Test
    @DisplayName("el dislike se registra con MERGE y tipo DISLIKE, no con CREATE")
    void elDislikeUsaMergeConTipoDislike() {
        resultadoConTotales(0, 1);

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
    @DisplayName("registrar dislike borra en la misma consulta el like previo del mismo usuario")
    void registrarDislikeBorraElLikePrevio() {
        resultadoConTotales(0, 1);

        adapter.registrarDislike("carlos-patino", "post-b1");

        String consulta = consultaNormalizada();
        // Espejo de registrarLike: sin esta limpieza ambas relaciones convivirían y el feed
        // mostraría likedByMe y dislikedByMe en true a la vez.
        assertTrue(
                consulta.contains("OPTIONAL MATCH (u)-[d:REACCIONA {tipo: 'LIKE'}]->(p)"),
                "El dislike debe buscar el like contrario del mismo usuario: " + consulta);
        assertTrue(
                consulta.contains("DELETE d"),
                "El like contrario debe borrarse en la misma transacción: " + consulta);
    }

    @Test
    @DisplayName("registrar dislike devuelve el estado completo, no solo los dislikes")
    void registrarDislikeDevuelveElEstadoCompleto() {
        resultadoConTotales(2, 1);

        EstadoReaccion estado = adapter.registrarDislike("carlos-patino", "post-b1");

        assertEquals(2, estado.totalLikes());
        assertEquals(1, estado.totalDislikes());
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
        resultadoConTotales(0, 1);

        adapter.registrarDislike("carlos-patino", "post-b1");

        assertEquals(
                Values.parameters("userId", "carlos-patino", "postId", "post-b1").asMap(),
                parametrosEnviados().asMap());
    }

    @Test
    @DisplayName("retirar like borra solo la reacción LIKE y devuelve el estado completo")
    void retirarLikeBorraYDevuelveElEstado() {
        borradoYConteo(2, 1);

        EstadoReaccion estado = adapter.retirarLike("carlos-patino", "post-b1");

        assertEquals(2, estado.totalLikes());
        assertEquals(1, estado.totalDislikes());

        List<String> consultas = consultasNormalizadas();
        String borrado = consultas.get(0);
        assertTrue(borrado.contains("DELETE r"), "Retirar debe borrar la relación: " + borrado);
        assertTrue(
                !borrado.contains("MERGE") && !borrado.contains("CREATE"),
                "Retirar no debe crear nada: " + borrado);
        // La retirada no toca la reacción contraria: el DELETE menciona un solo tipo y no hay
        // limpieza del otro.
        assertTrue(
                !borrado.contains("DISLIKE") && !borrado.contains("OPTIONAL MATCH"),
                "Retirar el like no debe mencionar ni borrar el dislike: " + borrado);
        String conteo = consultas.get(1);
        assertTrue(
                conteo.contains("count(DISTINCT rl) AS totalLikes")
                        && conteo.contains("count(DISTINCT rd) AS totalDislikes"),
                "La retirada debe devolver ambos totales: " + conteo);
        assertEquals(
                Values.parameters("userId", "carlos-patino", "postId", "post-b1", "tipo", "LIKE")
                        .asMap(),
                parametrosDelBorrado().asMap());
    }

    @Test
    @DisplayName("retirar like sobre un post inexistente devuelve el estado en ceros sin error")
    void retirarLikeSobrePostInexistenteDevuelveCeros() {
        // Retirar es idempotente: si no había nada que borrar, igual hay estado que devolver.
        borradoYConteo(0, 0, 0);

        EstadoReaccion estado = adapter.retirarLike("carlos-patino", "post-inexistente");

        assertEquals(0, estado.totalLikes());
        assertEquals(0, estado.totalDislikes());
    }

    @Test
    @DisplayName("retirar dislike borra solo la reacción DISLIKE y devuelve el estado completo")
    void retirarDislikeBorraYDevuelveElEstado() {
        borradoYConteo(3, 0);

        EstadoReaccion estado = adapter.retirarDislike("carlos-patino", "post-b1");

        assertEquals(3, estado.totalLikes());
        assertEquals(0, estado.totalDislikes());

        List<String> consultas = consultasNormalizadas();
        String borrado = consultas.get(0);
        assertTrue(borrado.contains("DELETE r"), "Retirar debe borrar la relación: " + borrado);
        // La retirada no toca la reacción contraria: el like de ese usuario sigue intacto.
        assertTrue(
                !borrado.contains("'LIKE'") && !borrado.contains("OPTIONAL MATCH"),
                "Retirar el dislike no debe mencionar ni borrar el like: " + borrado);
        assertEquals(
                Values.parameters("userId", "carlos-patino", "postId", "post-b1", "tipo", "DISLIKE")
                        .asMap(),
                parametrosDelBorrado().asMap());
    }

    @Test
    @DisplayName("retirar dislike sobre un post inexistente devuelve el estado en ceros sin error")
    void retirarDislikeSobrePostInexistenteDevuelveCeros() {
        borradoYConteo(0, 0, 0);

        EstadoReaccion estado = adapter.retirarDislike("carlos-patino", "post-inexistente");

        assertEquals(0, estado.totalLikes());
        assertEquals(0, estado.totalDislikes());
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
        assertTrue(!feed.get(0).isLikedByMe());
        assertTrue(feed.get(0).isDislikedByMe());
    }
}
