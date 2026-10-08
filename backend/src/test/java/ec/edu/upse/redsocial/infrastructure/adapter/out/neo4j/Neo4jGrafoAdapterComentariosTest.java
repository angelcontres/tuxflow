package ec.edu.upse.redsocial.infrastructure.adapter.out.neo4j;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.exception.AutorNoEncontradoException;
import ec.edu.upse.redsocial.domain.exception.ComentarioNoEncontradoException;
import ec.edu.upse.redsocial.domain.exception.PostNoEncontradoException;
import ec.edu.upse.redsocial.domain.model.Comentario;
import ec.edu.upse.redsocial.domain.model.EstadoComentario;
import java.util.List;
import java.util.function.Function;
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
 * Cubre el modelado de comentarios: que la creación use MATCH para autor y publicación (nunca
 * CREATE), que valide el padre antes de crear, que el like sea un MERGE idempotente con centinela,
 * y que la lectura proyecte parentId y likedByMe.
 *
 * <p>El fallo que se cubre: un comentario colgado de un post o de un padre que no existen no crea
 * nada y, sin validación, respondería igual que si lo hubiera hecho. El usuario vería su comentario
 * publicado en una interfaz que en realidad lo perdió.
 */
class Neo4jGrafoAdapterComentariosTest {

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
        when(session.executeRead(any()))
                .thenAnswer(
                        invocacion ->
                                ((TransactionCallback<Object>) invocacion.getArgument(0))
                                        .execute(tx));

        adapter = new Neo4jGrafoAdapter();
        adapter.driver = driver;
    }

    private void runResponde(Function<String, Result> porConsulta) {
        when(tx.run(anyString(), any(Value.class)))
                .thenAnswer(invocacion -> porConsulta.apply(invocacion.getArgument(0)));
    }

    private Result resultConFilas(Record... filas) {
        Result result = mock(Result.class);
        Boolean[] hasNext = new Boolean[filas.length + 1];
        for (int i = 0; i < filas.length; i++) {
            hasNext[i] = true;
        }
        hasNext[filas.length] = false;
        when(result.hasNext())
                .thenReturn(hasNext[0], java.util.Arrays.copyOfRange(hasNext, 1, hasNext.length));
        when(result.next())
                .thenReturn(filas[0], java.util.Arrays.copyOfRange(filas, 1, filas.length));
        return result;
    }

    private Record validacion(boolean autor, boolean post, boolean padre) {
        Record fila = mock(Record.class);
        when(fila.get("autorExiste")).thenReturn(Values.value(autor));
        when(fila.get("postExiste")).thenReturn(Values.value(post));
        when(fila.get("padreValido")).thenReturn(Values.value(padre));
        return fila;
    }

    private Record filaComentario(String id, String parentId, boolean likedByMe, long likes) {
        Record fila = mock(Record.class);
        when(fila.get("id")).thenReturn(Values.value(id));
        when(fila.get("texto")).thenReturn(Values.value("texto de " + id));
        when(fila.get("fecha")).thenReturn(Values.value(1727270000000L));
        when(fila.get("parentId"))
                .thenReturn(parentId == null ? Values.NULL : Values.value(parentId));
        when(fila.get("autorId")).thenReturn(Values.value("paulo-orrala"));
        when(fila.get("autorUsername")).thenReturn(Values.value("paulo"));
        when(fila.get("autorAvatar")).thenReturn(Values.value("http://avatar/paulo.png"));
        when(fila.get("likedByMe")).thenReturn(Values.value(likedByMe));
        when(fila.get("totalLikes")).thenReturn(Values.value(likes));
        return fila;
    }

    private List<String> consultasEjecutadas() {
        ArgumentCaptor<String> cypher = ArgumentCaptor.forClass(String.class);
        verify(tx, atLeastOnce()).run(cypher.capture(), any(Value.class));
        return cypher.getAllValues().stream().map(c -> c.replaceAll("\\s+", " ").trim()).toList();
    }

    // --- Creación ---

    @Test
    @DisplayName("crear valida existencia y crea el nodo con CREATE, no con MERGE")
    void crearValidaYCrea() {
        runResponde(
                cypher ->
                        cypher.contains("EXISTS((:Usuario")
                                ? resultConFilas(validacion(true, true, true))
                                : resultConFilas(filaComentario("com-1", null, false, 0)));

        Comentario creado =
                adapter.crearComentario("paulo-orrala", "com-1", "post-b1", "Hola", null);

        assertEquals("com-1", creado.getId());
        assertEquals("paulo", creado.getAutorUsername());
        assertEquals(0, creado.getTotalLikes());
        assertNull(creado.getParentId());

        List<String> consultas = consultasEjecutadas();
        assertTrue(
                consultas.stream().anyMatch(c -> c.contains("CREATE (c:Comentario")),
                "El comentario debe crearse con CREATE: " + consultas);
        assertTrue(
                consultas.stream().noneMatch(c -> c.contains("MERGE (c:Comentario")),
                "Un comentario no es idempotente; no debe usar MERGE: " + consultas);
        assertTrue(
                consultas.stream()
                        .anyMatch(
                                c ->
                                        c.contains(
                                                "MATCH (u:Usuario {id: $autorId}), (p:Post {id: $postId})")),
                "La creación localiza autor y publicación con MATCH: " + consultas);
    }

    @Test
    @DisplayName("crear lanza AutorNoEncontradoException si el autor no existe")
    void crearSinAutor() {
        runResponde(cypher -> resultConFilas(validacion(false, true, true)));

        assertThrows(
                AutorNoEncontradoException.class,
                () -> adapter.crearComentario("fantasma", "com-1", "post-b1", "Hola", null));

        assertTrue(
                consultasEjecutadas().stream().noneMatch(c -> c.contains("CREATE (c:Comentario")),
                "Sin autor no se debe crear el comentario");
    }

    @Test
    @DisplayName("crear lanza PostNoEncontradoException si la publicación no existe")
    void crearSinPost() {
        runResponde(cypher -> resultConFilas(validacion(true, false, true)));

        assertThrows(
                PostNoEncontradoException.class,
                () -> adapter.crearComentario("paulo-orrala", "com-1", "post-x", "Hola", null));
    }

    @Test
    @DisplayName("crear lanza ComentarioNoEncontradoException si el padre no es válido")
    void crearConPadreInvalido() {
        runResponde(cypher -> resultConFilas(validacion(true, true, false)));

        ComentarioNoEncontradoException error =
                assertThrows(
                        ComentarioNoEncontradoException.class,
                        () ->
                                adapter.crearComentario(
                                        "paulo-orrala", "com-2", "post-b1", "Hola", "com-x"));

        assertEquals("com-x", error.getComentarioId());
    }

    @Test
    @DisplayName("la validación exige que el padre sea de primer nivel y de la misma publicación")
    void validacionDelPadreEsEstricta() {
        runResponde(
                cypher ->
                        cypher.contains("EXISTS((:Usuario")
                                ? resultConFilas(validacion(true, true, true))
                                : resultConFilas(filaComentario("com-2", "com-1", false, 0)));

        adapter.crearComentario("carlos-patino", "com-2", "post-b1", "Hola", "com-1");

        String validacionQuery =
                consultasEjecutadas().stream()
                        .filter(c -> c.contains("padreValido"))
                        .findFirst()
                        .orElseThrow();
        assertTrue(
                validacionQuery.contains("padre.parentId IS NULL"),
                "Sólo se responde a comentarios de primer nivel: " + validacionQuery);
        assertTrue(
                validacionQuery.contains("(:Post {id: $postId})"),
                "El padre tiene que colgar del mismo post: " + validacionQuery);
    }

    // --- Lectura ---

    @Test
    @DisplayName("la lectura ordena ASC y marca likedByMe según el visor")
    void lecturaOrdenaYMarca() {
        runResponde(
                cypher ->
                        resultConFilas(
                                filaComentario("com-1", null, true, 2),
                                filaComentario("com-2", "com-1", false, 0)));

        List<Comentario> comentarios = adapter.obtenerComentariosDePost("post-b1", "carlos-patino");

        assertEquals(2, comentarios.size());
        assertTrue(comentarios.get(0).isLikedByMe());
        assertEquals("com-1", comentarios.get(1).getParentId());

        String consulta =
                consultasEjecutadas().stream()
                        .filter(c -> c.contains("ORDER BY"))
                        .findFirst()
                        .orElseThrow();
        assertTrue(consulta.contains("ORDER BY c.fechaCreacion ASC"), consulta);
        assertTrue(
                consulta.contains("EXISTS((visor)-[:REACCIONA {tipo: 'LIKE'}]->(c)) AS likedByMe"),
                consulta);
    }

    // --- Likes ---

    @Test
    @DisplayName("el like de comentario usa MERGE con ON CREATE SET y cuenta con DISTINCT")
    void likeUsaMerge() {
        runResponde(
                cypher -> {
                    Record fila = mock(Record.class);
                    when(fila.get("totalLikes")).thenReturn(Values.value(1L));
                    when(fila.get("encontrados")).thenReturn(Values.value(1L));
                    return resultConFilas(fila);
                });

        EstadoComentario estado = adapter.registrarLikeComentario("carlos-patino", "com-1");

        assertEquals(1, estado.totalLikes());
        assertTrue(estado.likedByMe());

        List<String> consultas = consultasEjecutadas();
        String like = consultas.stream().filter(c -> c.contains("MERGE")).findFirst().orElseThrow();
        assertTrue(like.contains("MERGE (u)-[r:REACCIONA {tipo: 'LIKE'}]->(c)"), like);
        assertTrue(like.contains("ON CREATE SET r.fecha = timestamp()"), like);
        assertTrue(like.contains("count(DISTINCT rl) AS totalLikes"), like);
        assertTrue(like.contains("(c:Comentario {id: $comentarioId})"), like);
        assertTrue(
                consultas.stream().noneMatch(c -> c.contains("CREATE (u)-[r:REACCIONA")),
                "El like no debe duplicar la relación");
    }

    @Test
    @DisplayName("el like sobre un comentario inexistente lanza ComentarioNoEncontradoException")
    void likeSinComentario() {
        runResponde(
                cypher -> {
                    Record fila = mock(Record.class);
                    when(fila.get("totalLikes")).thenReturn(Values.value(0L));
                    when(fila.get("encontrados")).thenReturn(Values.value(0L));
                    return resultConFilas(fila);
                });

        ComentarioNoEncontradoException error =
                assertThrows(
                        ComentarioNoEncontradoException.class,
                        () -> adapter.registrarLikeComentario("carlos-patino", "com-x"));

        assertEquals("com-x", error.getComentarioId());
    }

    @Test
    @DisplayName("retirar el like es idempotente y devuelve el total recalculado")
    void retirarLikeIdempotente() {
        runResponde(
                cypher -> {
                    if (cypher.contains("DELETE r")) {
                        return mock(Result.class);
                    }
                    Record fila = mock(Record.class);
                    when(fila.get("totalLikes")).thenReturn(Values.value(2L));
                    when(fila.get("encontrados")).thenReturn(Values.value(1L));
                    return resultConFilas(fila);
                });

        EstadoComentario estado = adapter.retirarLikeComentario("carlos-patino", "com-1");

        assertEquals(2, estado.totalLikes());
        assertTrue(!estado.likedByMe());

        List<String> consultas = consultasEjecutadas();
        assertTrue(
                consultas.stream()
                        .anyMatch(
                                c ->
                                        c.contains(
                                                "MATCH (u:Usuario {id: $userId})-[r:REACCIONA {tipo: 'LIKE'}]->(c:Comentario {id: $comentarioId}) DELETE r")),
                consultas.toString());
        assertTrue(
                consultas.stream()
                        .anyMatch(c -> c.contains("RETURN count(DISTINCT rl) AS totalLikes")),
                consultas.toString());
    }

    @Test
    @DisplayName("no se ejecuta ninguna creación cuando la validación falla")
    void noCreaCuandoValidaMal() {
        runResponde(cypher -> resultConFilas(validacion(true, false, true)));

        assertThrows(
                PostNoEncontradoException.class,
                () -> adapter.crearComentario("paulo-orrala", "com-1", "post-x", "Hola", null));

        assertTrue(
                consultasEjecutadas().stream().noneMatch(c -> c.contains("CREATE (c:Comentario")),
                "Con la validación en rojo no debe correr la creación");
    }
}
