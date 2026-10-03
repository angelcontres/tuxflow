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
import ec.edu.upse.redsocial.domain.model.EstadoReaccion;
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
 * Cubre que registrar un like sea idempotente, mutuamente excluyente con el dislike y que devuelva
 * el estado completo de reacciones.
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

    /** Simula la fila que devuelve el Cypher con agregación: ambos totales más el centinela. */
    private void resultadoConTotales(long totalLikes, long totalDislikes) {
        registrarFila(Values.value(totalLikes), Values.value(totalDislikes), Values.value(1));
    }

    /**
     * Reproduce lo que el driver hace de verdad cuando el MATCH no encuentra usuario ni post: la
     * agregación sin clave de agrupamiento devuelve UNA fila con cero, no cero filas. Por eso
     * hasNext() es true y el centinela es count(p).
     */
    private void resultadoVacio() {
        registrarFila(Values.value(0), Values.value(0), Values.value(0));
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

    private String consultaNormalizada() {
        ArgumentCaptor<String> cypher = ArgumentCaptor.forClass(String.class);
        verify(tx).run(cypher.capture(), any(Value.class));
        return cypher.getValue().replaceAll("\\s+", " ").trim();
    }

    @Test
    @DisplayName("la reacción se registra con MERGE, no con CREATE")
    void laReaccionUsaMerge() {
        resultadoConTotales(1, 0);

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
    @DisplayName("devuelve el estado completo que cuenta el grafo")
    void devuelveElEstadoDelGrafo() {
        resultadoConTotales(7, 2);

        EstadoReaccion estado = adapter.registrarLike("carlos-patino", "post-b1");

        assertEquals(7, estado.totalLikes());
        assertEquals(2, estado.totalDislikes());
    }

    @Test
    @DisplayName("registrar like borra en la misma consulta el dislike previo del mismo usuario")
    void registrarLikeBorraElDislikePrevio() {
        resultadoConTotales(4, 0);

        adapter.registrarLike("carlos-patino", "post-b1");

        String consulta = consultaNormalizada();
        // Sin esta limpieza, dar dislike a un post con tu like dejaría ambas relaciones y el
        // feed mostraría likedByMe y dislikedByMe en true a la vez.
        assertTrue(
                consulta.contains("OPTIONAL MATCH (u)-[d:REACCIONA {tipo: 'DISLIKE'}]->(p)"),
                "El like debe buscar el dislike contrario del mismo usuario: " + consulta);
        assertTrue(
                consulta.contains("DELETE d"),
                "El dislike contrario debe borrarse en la misma transacción: " + consulta);
        assertTrue(
                consulta.indexOf("MERGE") < consulta.indexOf("DELETE d"),
                "La limpieza va después del registro, en la misma consulta: " + consulta);
    }

    @Test
    @DisplayName(
            "los conteos usan DISTINCT porque los OPTIONAL MATCH encadenados multiplican filas")
    void losConteosUsanDistinct() {
        resultadoConTotales(3, 0);

        adapter.registrarLike("carlos-patino", "post-b1");

        String consulta = consultaNormalizada();
        // Medido: 3 likes x 2 dislikes daban count(rl) = 6 sin DISTINCT.
        assertTrue(
                consulta.contains("count(DISTINCT rl) AS totalLikes"),
                "El conteo de likes debe usar DISTINCT: " + consulta);
        assertTrue(
                consulta.contains("count(DISTINCT rd) AS totalDislikes"),
                "El conteo de dislikes debe usar DISTINCT: " + consulta);
    }

    @Test
    @DisplayName("el conteo se lee después del MERGE para incluir la reacción recién creada")
    void elConteoSeLeeDespuesDelMerge() {
        resultadoConTotales(1, 0);

        adapter.registrarLike("carlos-patino", "post-b1");

        String consulta = consultaNormalizada();
        int posicionMerge = consulta.indexOf("MERGE");
        int posicionConteo = consulta.indexOf("count(DISTINCT rl)");
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
        resultadoConTotales(1, 0);

        adapter.registrarLike("carlos-patino", "post-b1");

        ArgumentCaptor<Value> params = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(anyString(), params.capture());
        // Solo userId y postId: los totales los cuenta la propia consulta, así que un parámetro de
        // conteo sería una segunda fuente de verdad para el mismo número.
        assertEquals(
                Values.parameters("userId", "carlos-patino", "postId", "post-b1").asMap(),
                params.getValue().asMap());
    }
}
