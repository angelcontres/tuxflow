package ec.edu.upse.redsocial.infrastructure.adapter.out.neo4j;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.exception.ParticipanteNoEncontradoException;
import ec.edu.upse.redsocial.domain.model.MensajeChat;
import java.util.List;
import java.util.Map;
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
 * Cubre las consultas de mensajes de chat: la que escribe y la que trae el historial.
 *
 * <p>Sigue el patrón del resto de pruebas del adaptador: driver, sesión y transacción doblados, y
 * filas simuladas con {@code Record} y {@code Values}. El motivo de no usar un grafo real es que
 * aquí lo que se prueba es el texto de la consulta, y eso se lee mejor que un resultado que hay que
 * interpretar.
 *
 * <p>Los dos fallos que se cubren son silenciosos. Un {@code MATCH} que no encuentra al usuario
 * hace que el {@code CREATE} se descarte sin avisar, así que el mensaje se pierde en silencio. Y un
 * historial filtrado como par ordenado en vez de como conjunto devuelve la conversación completa a
 * uno de los dos participantes y vacía al otro, también sin error: solo faltan burbujas en
 * pantalla.
 */
class Neo4jGrafoAdapterMensajesChatTest {

    private TransactionContext tx;
    private Session session;
    private Neo4jGrafoAdapter adapter;
    private Result result;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void preparar() {
        tx = mock(TransactionContext.class);
        session = mock(Session.class);
        result = mock(Result.class);

        Driver driver = mock(Driver.class);
        when(driver.session()).thenReturn(session);
        when(session.executeWrite(any(TransactionCallback.class)))
                .thenAnswer(
                        invoc -> {
                            TransactionCallback<Object> callback =
                                    (TransactionCallback<Object>) invoc.getArgument(0);
                            return callback.execute(tx);
                        });
        when(tx.run(anyString(), any(Value.class))).thenReturn(result);
        when(result.hasNext()).thenReturn(true);
        when(session.executeRead(any(TransactionCallback.class)))
                .thenAnswer(
                        invoc -> {
                            TransactionCallback<Object> callback =
                                    (TransactionCallback<Object>) invoc.getArgument(0);
                            return callback.execute(tx);
                        });

        adapter = new Neo4jGrafoAdapter();
        // El campo del driver no es privado porque en la aplicación lo llena CDI y en la prueba hay
        // que aportarlo a mano; el mismo criterio que usa el resto de pruebas de este adaptador.
        adapter.driver = driver;
    }

    private static MensajeChat mensaje() {
        return new MensajeChat("id-1", "carlos", "paulo", "hola");
    }

    @Test
    @DisplayName("Guarda el mensaje localizando a los dos usuarios, sin crearlos si faltan")
    void guardaLocalizandoUsuarios() {
        adapter.guardarMensajeChat(mensaje());

        ArgumentCaptor<String> consulta = ArgumentCaptor.forClass(String.class);
        verify(tx).run(consulta.capture(), any(Value.class));

        String cypher = consulta.getValue();
        assertTrue(cypher.contains("MATCH"), "debe localizar a los usuarios: " + cypher);
        // Un mensaje no crea a las personas que lo escriben: si un identificador está mal, la
        // consulta no devuelve filas y el mensaje se rechaza, en vez de inventar un usuario.
        assertFalse(
                cypher.toUpperCase().contains("MERGE ("),
                "ni el emisor ni el destinatario pueden crearse al escribir: " + cypher);
        assertTrue(cypher.contains(":MensajeChat"), "el mensaje debe quedar como nodo de mensaje");
    }

    @Test
    @DisplayName("Escribe el contenido y la marca de tiempo que trae el mensaje")
    void escribeContenidoYMarcaDeTiempo() {
        adapter.guardarMensajeChat(mensaje());

        ArgumentCaptor<Value> parametros = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(anyString(), parametros.capture());

        Map<String, Object> valores = parametros.getValue().asMap();
        assertEquals("id-1", valores.get("id"));
        assertEquals("carlos", valores.get("emisorId"));
        assertEquals("paulo", valores.get("destinatarioId"));
        assertEquals("hola", valores.get("contenido"));
        assertTrue(valores.containsKey("fechaEnvio"), "la marca de tiempo debe persistirse");
    }

    @Test
    @DisplayName(
            "Si el destinatario no existe la operación falla en vez de perder el mensaje en silencio")
    void fallaSiElDestinatarioNoExiste() {
        when(result.hasNext()).thenReturn(false);

        ParticipanteNoEncontradoException error =
                assertThrows(
                        ParticipanteNoEncontradoException.class,
                        () -> adapter.guardarMensajeChat(mensaje()));

        assertEquals("paulo", error.getParticipanteId(), "el motivo debe señalar al destinatario");
    }

    @Test
    @DisplayName("El historial trata a la pareja como conjunto y no como par ordenado")
    void historialSimetrico() {
        historialDe(fila("carlos"));

        adapter.obtenerHistorialChat("carlos", "paulo");

        ArgumentCaptor<String> consulta = ArgumentCaptor.forClass(String.class);
        verify(tx).run(consulta.capture(), any(Value.class));

        String cypher = consulta.getValue();
        assertTrue(
                cypher.contains("$usuarioA") && cypher.contains("$usuarioB"),
                "deben aparecer los dos participantes: " + cypher);
        assertTrue(
                !cypher.contains("m.emisorId = $usuarioA AND m.destinatarioId = $usuarioB"),
                "filtrar como par ordenado dejaría vacío el historial del otro participante: "
                        + cypher);
        assertTrue(cypher.contains("ORDER BY"), "debe venir ordenado cronológicamente: " + cypher);
    }

    @Test
    @DisplayName("Ordena del más antiguo al más reciente")
    void ordenaDelMasAntiguoAlMasReciente() {
        historialDe(fila("carlos"));

        adapter.obtenerHistorialChat("carlos", "paulo");

        ArgumentCaptor<String> consulta = ArgumentCaptor.forClass(String.class);
        verify(tx).run(consulta.capture(), any(Value.class));
        String enMayusculas = consulta.getValue().toUpperCase();
        assertTrue(
                enMayusculas.contains("ORDER BY M.FECHAENVIO ASC"),
                "el orden debe ser ascendente por la marca de envío: " + consulta.getValue());
    }

    @Test
    @DisplayName("Devuelve los mensajes con emisor y destinatario, no solo el texto")
    void devuelveEmisorYDestinatario() {
        historialDe(fila("carlos"));

        List<MensajeChat> historial = adapter.obtenerHistorialChat("carlos", "paulo");

        assertEquals(1, historial.size());
        MensajeChat recuperado = historial.get(0);
        assertEquals("id-1", recuperado.getId());
        assertEquals("carlos", recuperado.getEmisorId());
        assertEquals("paulo", recuperado.getDestinatarioId());
        assertEquals("hola", recuperado.getContenido());
        assertTrue(recuperado.getTimestamp() > 0);
    }

    @Test
    @DisplayName("Una pareja sin mensajes devuelve una lista vacía y no un error")
    void parejaSinMensajes() {
        historialDe();

        assertTrue(adapter.obtenerHistorialChat("carlos", "paulo").isEmpty());
    }

    /**
     * Simula el historial que devolvería la consulta: la recorre con {@code hasNext}/{@code next},
     * que es como lo hace el adaptador, así que las filas se entregan una a una.
     */
    @SuppressWarnings("unchecked")
    private void historialDe(Record... filas) {
        java.util.concurrent.atomic.AtomicInteger cursor =
                new java.util.concurrent.atomic.AtomicInteger();
        when(result.hasNext()).thenAnswer(inv -> cursor.get() < filas.length);
        when(result.next()).thenAnswer(inv -> filas[cursor.getAndIncrement()]);
    }

    /** Fila simulada con la forma que devuelve la consulta del historial. */
    private Record fila(String emisor) {
        Record registro = mock(Record.class);
        when(registro.get(eq("id"))).thenReturn(Values.value("id-1"));
        when(registro.get(eq("emisorId"))).thenReturn(Values.value(emisor));
        when(registro.get(eq("destinatarioId"))).thenReturn(Values.value("paulo"));
        when(registro.get(eq("contenido"))).thenReturn(Values.value("hola"));
        when(registro.get(eq("fecha"))).thenReturn(Values.value(1700000000000L));
        return registro;
    }
}
