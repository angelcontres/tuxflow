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

import ec.edu.upse.redsocial.domain.model.Post;
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
 * Cubre la lectura de publicaciones de un autor (endpoint del perfil ajeno) sin levantar un Neo4j:
 * se stubea el driver y se devuelve un {@link Result} con las filas que el grafo devolvería.
 */
class Neo4jGrafoAdapterPostsDeUsuarioTest {

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

    /** Valor de texto tal como lo entrega el driver por una propiedad del grafo. */
    private static Value texto(String contenido) {
        return Values.parameters("propiedad", (Object) contenido).get("propiedad");
    }

    /** Valor numérico tal como lo entrega el driver, que es como se escribe `fechaCreacion`. */
    private static Value numero(long contenido) {
        return Values.parameters("propiedad", (Object) contenido).get("propiedad");
    }

    /** Construye una fila con la forma que devuelve la consulta de publicaciones por autor. */
    private Record fila(
            String id,
            String textoPost,
            String mediaUrl,
            Long fecha,
            String autorUsername,
            String autorAvatar,
            long totalLikes,
            boolean likedByMe) {
        Record record = mock(Record.class);
        when(record.get("id")).thenReturn(texto(id));
        when(record.get("texto")).thenReturn(texto(textoPost));
        when(record.get("mediaUrl")).thenReturn(texto(mediaUrl));
        when(record.get("fecha")).thenReturn(fecha == null ? texto(null) : numero(fecha));
        when(record.get("autorId")).thenReturn(texto("beatriz-silva"));
        when(record.get("autorUsername")).thenReturn(texto(autorUsername));
        when(record.get("autorAvatar")).thenReturn(texto(autorAvatar));
        when(record.get("totalLikes")).thenReturn(numero(totalLikes));
        when(record.get("likedByMe")).thenReturn(Values.value(likedByMe));
        return record;
    }

    @Test
    @DisplayName("obtenerPostsDeUsuario devuelve las publicaciones del autor en el orden recibido")
    void devuelveLasPublicacionesDelAutor() {
        filasDevueltas(
                fila(
                        "post-b1",
                        "Bienvenidos a la Red Social",
                        "https://cdn/b1.png",
                        1727260000000L,
                        "beatriz",
                        "https://cdn/beatriz.png",
                        2,
                        false),
                fila(
                        "post-b2",
                        "Segunda publicacion",
                        "",
                        1727270000000L,
                        "beatriz",
                        "https://cdn/beatriz.png",
                        0,
                        true));

        List<Post> resultado = adapter.obtenerPostsDeUsuario("beatriz-silva", "carlos-patino");

        assertEquals(2, resultado.size());
        assertEquals("post-b1", resultado.get(0).getId());
        assertEquals("Bienvenidos a la Red Social", resultado.get(0).getTexto());
        assertEquals("post-b2", resultado.get(1).getId());
    }

    @Test
    @DisplayName("la fecha de creación se lee como entero, no como texto")
    void leeLaFechaComoEntero() {
        // `crearPost` escribe `fechaCreacion: datetime().epochMillis`, y la semilla escribe el
        // mismo
        // entero a mano. Leerlo con `.asString()` devolvería el texto "1727260000000" en vez de
        // llenar el campo Long del modelo. El entero es la única lectura correcta.
        filasDevueltas(
                fila("post-b1", "texto", "", 1727260000000L, "beatriz", null, 0, false),
                fila("post-b2", "texto", "", 1727270000000L, "beatriz", null, 0, false));

        List<Post> resultado = adapter.obtenerPostsDeUsuario("beatriz-silva", null);

        assertEquals(1727260000000L, resultado.get(0).getFechaCreacion());
        assertEquals(1727270000000L, resultado.get(1).getFechaCreacion());
    }

    @Test
    @DisplayName("el total de reacciones y el estado del visor se copian de la fila")
    void copiaReaccionesYEstadoDelVisor() {
        filasDevueltas(
                fila("post-b1", "texto", "", 1727260000000L, "beatriz", null, 2, true),
                fila("post-b2", "texto", "", 1727270000000L, "beatriz", null, 5, false));

        List<Post> resultado = adapter.obtenerPostsDeUsuario("beatriz-silva", "carlos-patino");

        assertEquals(2, resultado.get(0).getTotalLikes());
        assertTrue(resultado.get(0).isLikedByMe());
        assertEquals(5, resultado.get(1).getTotalLikes());
        assertFalse(resultado.get(1).isLikedByMe());
    }

    @Test
    @DisplayName("sin visor, la reacción llega sin marcar en vez de fallar")
    void sinVisorLaReaccionLlegaSinMarcar() {
        // EXISTS((null)-[:REACCIONA]->(p)) es false en Cypher, así que la consulta no necesita
        // ramificar: la misma forma sirve con y sin visor, y sin visor la respuesta es la honesta.
        filasDevueltas(
                fila("post-b1", "texto", "", 1727260000000L, "beatriz", null, 2, false),
                fila("post-b2", "texto", "", 1727270000000L, "beatriz", null, 0, false));

        List<Post> resultado = adapter.obtenerPostsDeUsuario("beatriz-silva", null);

        assertFalse(resultado.get(0).isLikedByMe());
        assertEquals(2, resultado.get(0).getTotalLikes());
    }

    @Test
    @DisplayName("un post sin imagen ni avatar de autor degrada sin romper la respuesta")
    void autorSinAvatarDegradaANull() {
        filasDevueltas(
                fila("post-b1", "texto", null, 1727260000000L, "beatriz", null, 0, false),
                fila("post-b2", "texto", null, 1727270000000L, "beatriz", null, 0, false));

        List<Post> resultado = adapter.obtenerPostsDeUsuario("beatriz-silva", null);

        assertNull(resultado.get(0).getAutorAvatar());
        assertNull(resultado.get(0).getMediaUrl());
        assertEquals("beatriz-silva", resultado.get(0).getAutorId());
        assertEquals("beatriz", resultado.get(0).getAutorUsername());
    }

    @Test
    @DisplayName(
            "la consulta enviada es la de publicaciones por autor, ordenada de la más nueva a la más antigua")
    void ejecutaElCypherDePublicacionesPorAutor() {
        filasDevueltas(
                fila("post-b1", "texto", "", 1727260000000L, "beatriz", null, 0, false),
                fila("post-b2", "texto", "", 1727270000000L, "beatriz", null, 0, false));

        adapter.obtenerPostsDeUsuario("beatriz-silva", "carlos-patino");

        ArgumentCaptor<String> cypher = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Value> params = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(cypher.capture(), params.capture());

        String consulta = cypher.getValue().replaceAll("\\s+", " ").trim();
        assertTrue(
                consulta.contains("MATCH (autor:Usuario {id: $userId})-[:PUBLICA]->(p:Post)"),
                "La consulta no es la de publicaciones del autor: " + consulta);
        assertTrue(consulta.contains("ORDER BY p.fechaCreacion DESC"), consulta);
        // La fecha se ordena y se lee como entero. Si alguna vez se vuelve a comparar contra una
        // fecha con hora, esta aserción avisa de que la representación cambió de acuerdo.
        assertFalse(consulta.contains("datetime() -"), consulta);

        Map<String, Object> enviados = params.getValue().asMap();
        assertEquals("beatriz-silva", enviados.get("userId"));
        assertEquals("carlos-patino", enviados.get("viewerId"));
    }

    @Test
    @DisplayName("sin visor, el parámetro se envía como null y no como texto vacío")
    void sinVisorEnviaNullYNoCadenaVacia() {
        filasDevueltas(
                fila("post-b1", "texto", "", 1727260000000L, "beatriz", null, 0, false),
                fila("post-b2", "texto", "", 1727270000000L, "beatriz", null, 0, false));

        adapter.obtenerPostsDeUsuario("beatriz-silva", null);

        ArgumentCaptor<Value> params = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(anyString(), params.capture());

        Map<String, Object> enviados = params.getValue().asMap();
        assertEquals("beatriz-silva", enviados.get("userId"));
        org.junit.jupiter.api.Assertions.assertNull(enviados.get("viewerId"));
    }

    @Test
    @DisplayName("un visor en blanco se normaliza a null antes de llegar al grafo")
    void visorEnBlancoSeNormalizaANull() {
        // Un `viewerId=""` es lo que llega de un cliente que manda el parámetro sin valor. Sin
        // normalizarlo, el MATCH de texto sobre el id vacío no da filas (que es el resultado
        // correcto) pero el log muestra un visor que nadie está mirando.
        filasDevueltas(
                fila("post-b1", "texto", "", 1727260000000L, "beatriz", null, 0, false),
                fila("post-b2", "texto", "", 1727270000000L, "beatriz", null, 0, false));

        adapter.obtenerPostsDeUsuario("beatriz-silva", "   ");

        ArgumentCaptor<Value> params = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(anyString(), params.capture());

        org.junit.jupiter.api.Assertions.assertNull(params.getValue().asMap().get("viewerId"));
    }
}
