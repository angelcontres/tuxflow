package ec.edu.upse.redsocial.infrastructure.adapter.out.neo4j;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.model.ConversacionChat;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
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
 * Cubre la consulta de la bandeja de conversaciones: una fila por interlocutor y el último mensaje
 * de cada pareja.
 *
 * <p>Sigue el patrón del resto de pruebas del adaptador: driver, sesión y transacción doblados, y
 * filas simuladas con {@code Record} y {@code Values}. Aquí lo que se prueba sobre todo es el texto
 * de la consulta, porque su forma es lo que decide si la bandeja sale bien o no.
 *
 * <p>Los tres fallos que se cubren son silenciosos, que es lo que los hace caros. Filtrar por par
 * ordenado deja fuera la mitad de las conversaciones, la de las que solo se escribieron en un
 * sentido. Ordenar después de agrupar muestra un mensaje viejo como si fuera el último. Y devolver
 * un mensaje por fila no da una bandeja, sino el buzón entero con la misma persona repetida.
 */
class Neo4jGrafoAdapterConversacionesChatTest {

    private TransactionContext tx;
    private Neo4jGrafoAdapter adapter;
    private Result result;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void preparar() {
        tx = mock(TransactionContext.class);
        Session session = mock(Session.class);
        result = mock(Result.class);

        Driver driver = mock(Driver.class);
        when(driver.session()).thenReturn(session);
        when(session.executeRead(any(TransactionCallback.class)))
                .thenAnswer(
                        invoc -> {
                            TransactionCallback<Object> callback =
                                    (TransactionCallback<Object>) invoc.getArgument(0);
                            return callback.execute(tx);
                        });
        when(tx.run(anyString(), any(Value.class))).thenReturn(result);

        adapter = new Neo4jGrafoAdapter();
        adapter.driver = driver;
    }

    @Test
    @DisplayName("La bandeja trata la conversación como conjunto y no como par ordenado")
    void bandejaSimetrica() {
        conversacionesDe(fila("paulo-orrala"));

        adapter.obtenerConversacionesChat("carlos-patino");

        // El filtro tiene que aceptar los dos sentidos. Con un par ordenado la bandeja saldría con
        // la
        // mitad de las parejas: las que solo se escribieron de un lado.
        assertTrue(
                consultaCapturada().contains("parte.id = $userId OR otra.id = $userId"),
                "deben contar tanto los enviados como los recibidos: " + consultaCapturada());
    }

    @Test
    @DisplayName("El interlocutor se decide de las dos variables, no de una posición fija")
    void interlocutorSegunElSentido() {
        conversacionesDe(fila("paulo-orrala"));

        adapter.obtenerConversacionesChat("carlos-patino");

        // Sin el CASE, el mismo patrón devolvería al interlocutor en una variable u otra según
        // quién
        // escribió, y el cliente no tendría forma de saber cuál de las dos es "el otro".
        assertTrue(
                consultaCapturada()
                        .toUpperCase()
                        .contains("CASE WHEN PARTE.ID = $USERID THEN OTRA ELSE PARTE END"),
                "el interlocutor debe salir de las dos variables: " + consultaCapturada());
    }

    @Test
    @DisplayName("Agrupa por interlocutor y no devuelve un mensaje por fila")
    void unaFilaPorInterlocutor() {
        conversacionesDe(fila("paulo-orrala"));

        adapter.obtenerConversacionesChat("carlos-patino");

        // El agrupador es el WITH que proyecta `ultimo`. Sin él la consulta devolvería una fila por
        // mensaje y la lista repetiría a la misma persona tantas veces como mensajes tenga
        // escritos.
        String cypher = consultaCapturada();
        assertTrue(
                cypher.contains("WITH interlocutor,") && cypher.contains("AS ultimo"),
                "debe agrupar por interlocutor: " + cypher);
    }

    @Test
    @DisplayName("El mensaje sale del collect con head, y el collect viene después del ORDER BY")
    void elUltimoSaleDelCollectOrdenado() {
        conversacionesDe(fila("paulo-orrala"));

        adapter.obtenerConversacionesChat("carlos-patino");

        String cypher = consultaCapturada();
        String enMayusculas = cypher.toUpperCase();
        assertTrue(
                cypher.contains("head(collect("), "el último mensaje se saca con head: " + cypher);

        int orden = enMayusculas.indexOf("ORDER BY FECHAENVIO DESC");
        int agrupamiento = enMayusculas.indexOf("HEAD(COLLECT(");
        assertTrue(orden >= 0, "los mensajes se ordenan antes de agrupar: " + cypher);
        assertTrue(
                orden < agrupamiento,
                "el ORDER BY tiene que ir antes del collect: al revés, la cabecera de cada lista "
                        + "sería arbitraria y la bandeja mostraría un mensaje viejo como el último: "
                        + cypher);
    }

    @Test
    @DisplayName("No usa APOC, porque el despliegue no carga esa biblioteca")
    void sinApoc() {
        conversacionesDe(fila("paulo-orrala"));

        adapter.obtenerConversacionesChat("carlos-patino");

        // apoc.coll.sortMaps o apoc.cypher.runFirstColumn darían el mismo resultado, y este
        // proyecto
        // no los tiene: una consulta que dependa de APOC funciona en el portátil y falla en el
        // despliegue.
        assertFalse(
                consultaCapturada().toLowerCase().contains("apoc."),
                "la consulta no debe depender de APOC: " + consultaCapturada());
    }

    @Test
    @DisplayName("Tope de cincuenta conversaciones")
    void topeDeConversaciones() {
        conversacionesDe(fila("paulo-orrala"));

        adapter.obtenerConversacionesChat("carlos-patino");

        assertTrue(consultaCapturada().contains("LIMIT"), "la bandeja debe venir acotada");

        ArgumentCaptor<Value> parametros = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(anyString(), parametros.capture());
        Map<String, Object> valores = parametros.getValue().asMap();
        assertEquals("carlos-patino", valores.get("userId"));
        assertEquals(50L, valores.get("tope"), "cincuenta filas son las que se leen de un vistazo");
    }

    @Test
    @DisplayName("Trae al interlocutor con nombre y avatar, no solo su identificador")
    void traeLosDatosDelInterlocutor() {
        conversacionesDe(fila("paulo-orrala", "Paulo", "https://cdn/paulo.png", "que tal"));

        List<ConversacionChat> bandeja = adapter.obtenerConversacionesChat("carlos-patino");

        assertEquals(1, bandeja.size());
        ConversacionChat conversacion = bandeja.get(0);
        assertEquals("paulo-orrala", conversacion.getInterlocutorId());
        assertEquals("paulo", conversacion.getInterlocutorUsername());
        assertEquals("Paulo", conversacion.getInterlocutorNombre());
        assertEquals("https://cdn/paulo.png", conversacion.getInterlocutorAvatarUrl());
        assertEquals("que tal", conversacion.getUltimoMensaje());
        assertEquals(1700000005000L, conversacion.getFechaUltimoMensaje());
    }

    @Test
    @DisplayName(
            "Un interlocutor sin nombre ni avatar sale con esos campos nulos, no con el texto \"null\"")
    void sinNombreNiAvatar() {
        // Guardar null en Neo4j borra la propiedad, así que las dos llegan como NullValue. Sin la
        // guarda, NullValue.asString() devuelve el literal "null" y la bandeja inventaría un
        // nombre.
        conversacionesDe(fila("elena-vega", null, null, "hola"));

        ConversacionChat conversacion = adapter.obtenerConversacionesChat("carlos-patino").get(0);

        assertNull(conversacion.getInterlocutorNombre());
        assertNull(conversacion.getInterlocutorAvatarUrl());
        assertEquals(
                "elena", conversacion.getInterlocutorUsername(), "el username sí se sustituye");
    }

    @Test
    @DisplayName("Un usuario sin conversaciones recibe una lista vacía y no un error")
    void sinConversaciones() {
        conversacionesDe();

        assertTrue(adapter.obtenerConversacionesChat("carlos-patino").isEmpty());
    }

    @Test
    @DisplayName("Los mensajes sin marca de tiempo no salen como si fueran los más recientes")
    void descartaMensajesSinFecha() {
        conversacionesDe();

        adapter.obtenerConversacionesChat("carlos-patino");

        // Sin este filtro, un mensaje sin fecha se agruparía al final por ser el último que se vio,
        // y
        // aparecería como el más reciente de su conversación.
        assertTrue(
                consultaCapturada().contains("m.fechaEnvio IS NOT NULL"),
                "un mensaje sin fecha no puede ordenar la bandeja: " + consultaCapturada());
    }

    private String consultaCapturada() {
        ArgumentCaptor<String> consulta = ArgumentCaptor.forClass(String.class);
        verify(tx).run(consulta.capture(), any(Value.class));
        return consulta.getValue();
    }

    /**
     * Entrega las filas una a una, con {@code hasNext}/{@code next}, que es como las lee el
     * adaptador.
     */
    private void conversacionesDe(Record... filas) {
        AtomicInteger cursor = new AtomicInteger();
        when(result.hasNext()).thenAnswer(inv -> cursor.get() < filas.length);
        when(result.next()).thenAnswer(inv -> filas[cursor.getAndIncrement()]);
    }

    /** Fila con la forma que devuelve la consulta de la bandeja. */
    private Record fila(String interlocutorId) {
        return fila(interlocutorId, "Paulo", "https://cdn/paulo.png", "que tal");
    }

    private Record fila(String interlocutorId, String nombre, String avatarUrl, String ultimo) {
        Record registro = mock(Record.class);
        when(registro.get(eq("interlocutorId"))).thenReturn(Values.value(interlocutorId));
        when(registro.get(eq("interlocutorUsername")))
                .thenReturn(Values.value(interlocutorId.split("-")[0]));
        when(registro.get(eq("interlocutorNombre"))).thenReturn(valor(nombre));
        when(registro.get(eq("interlocutorAvatarUrl"))).thenReturn(valor(avatarUrl));
        when(registro.get(eq("ultimoMensaje"))).thenReturn(Values.value(ultimo));
        when(registro.get(eq("fechaUltimoMensaje"))).thenReturn(Values.value(1700000005000L));
        return registro;
    }

    /**
     * Valor tal como lo entrega el driver por una propiedad del grafo, {@code null} incluido.
     *
     * <p>Una propiedad ausente no llega como Java {@code null} sino como {@code NullValue}, y es
     * justo lo que hay que simular para que se vea la diferencia: {@code NullValue.asString()}
     * devuelve el literal "null" en vez de lanzar.
     */
    private static Value valor(String contenido) {
        return Values.parameters("propiedad", (Object) contenido).get("propiedad");
    }
}
