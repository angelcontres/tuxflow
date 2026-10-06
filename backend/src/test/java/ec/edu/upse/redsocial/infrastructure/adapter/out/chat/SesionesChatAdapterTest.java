package ec.edu.upse.redsocial.infrastructure.adapter.out.chat;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import ec.edu.upse.redsocial.domain.model.MensajeChat;
import jakarta.websocket.RemoteEndpoint;
import jakarta.websocket.Session;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/**
 * Cubre el registro de sesiones y el reparto del chat.
 *
 * <p>El defecto central no se reproduce con dos personas distintas, que es como se probaba antes:
 * necesita dos pestañas del mismo usuario. Con un único slot por usuario, la segunda pestaña
 * sobrescribe a la primera y, al cerrarse, la arrastra consigo. Quien dejó la pestaña abierta deja
 * de recibir mensajes sin haber hecho nada, y el síntoma se atribuye a la red.
 *
 * <p>Las {@code Session} se doblan con Mockito porque la interfaz de Jakarta trae decenas de
 * métodos que no participan aquí; lo que importa es cuántas veces se registra, se retira y se
 * escribe.
 */
class SesionesChatAdapterTest {

    private SesionesChatAdapter adapter;

    @BeforeEach
    void crearAdaptador() {
        adapter = new SesionesChatAdapter();
        // El mapper se inyecta por CDI en la aplicación, así que en una prueba suelta hay que
        // aportarlo a mano. Con el mapper real, no con un doble, para que el frame que se serializa
        // sea el mismo que verá el cliente.
        adapter.mapper = new ObjectMapper();
    }

    private static Session sesionAbierta() {
        Session sesion = mock(Session.class);
        when(sesion.isOpen()).thenReturn(true);
        when(sesion.getAsyncRemote()).thenReturn(mock(RemoteEndpoint.Async.class));
        return sesion;
    }

    private static Session sesionCerrada() {
        Session sesion = mock(Session.class);
        when(sesion.isOpen()).thenReturn(false);
        return sesion;
    }

    private static MensajeChat mensaje() {
        return new MensajeChat("id-1", "carlos", "paulo", "hola");
    }

    @Test
    @DisplayName("El frame de entrega no lleva estado: es lo que distingue un acuse de un mensaje")
    void elFrameDeEntregaNoLlevaEstado() {
        // Si el frame que va al destinatario trajera `estado`, el cliente lo leería como un acuse,
        // buscaría la burbuja a la que corresponde y no encontraría ninguna: descartaría el mensaje
        // y el destinatario no vería nunca lo que le escriben, sin que nadie más se entere.
        Session paulo = sesionAbierta();
        adapter.registrar("paulo", paulo);

        adapter.enviar("paulo", mensaje());

        ArgumentCaptor<String> frame = ArgumentCaptor.forClass(String.class);
        verify(paulo.getAsyncRemote()).sendText(frame.capture());
        assertFalse(
                frame.getValue().contains("estado"),
                "el frame de entrega debe ir sin desenlace: " + frame.getValue());
        assertFalse(
                frame.getValue().contains("motivo"),
                "y sin motivo, que solo le importa a quien envía: " + frame.getValue());
        assertTrue(frame.getValue().contains("\"id\""), "pero sí con el id del servidor");
        assertTrue(frame.getValue().contains("hola"));
    }

    @Test
    @DisplayName("Entrega a la única sesión abierta del destinatario")
    void entregaAUnaSesion() {
        Session paulo = sesionAbierta();
        adapter.registrar("paulo", paulo);

        boolean entregado = adapter.enviar("paulo", mensaje());

        assertTrue(entregado);
        verify(paulo.getAsyncRemote()).sendText(anyString());
    }

    @Test
    @DisplayName(
            "Sin ninguna sesión abierta devuelve false, que es lo que el servicio traduce a no entregado")
    void sinSesionesDevuelveFalse() {
        assertFalse(adapter.enviar("paulo", mensaje()));
    }

    @Test
    @DisplayName("El usuario desaparece del registro cuando cierra su última sesión")
    void desapareceAlCerrarLaUltima() {
        Session paulo = sesionAbierta();
        adapter.registrar("paulo", paulo);
        assertEquals(1, adapter.sesionesDe("paulo"));

        adapter.retirar("paulo", paulo);

        assertEquals(0, adapter.sesionesDe("paulo"));
        assertFalse(adapter.enviar("paulo", mensaje()));
    }

    @Test
    @DisplayName(
            "Dos pestañas del mismo usuario siguen recibiendo ambas mientras las dos estén abiertas")
    void dosPestanasReciben() {
        Session primera = sesionAbierta();
        Session segunda = sesionAbierta();
        adapter.registrar("carlos", primera);
        adapter.registrar("carlos", segunda);
        assertEquals(2, adapter.sesionesDe("carlos"));

        boolean entregado = adapter.enviar("carlos", mensaje());

        assertTrue(entregado);
        verify(primera.getAsyncRemote()).sendText(anyString());
        verify(segunda.getAsyncRemote()).sendText(anyString());
    }

    @Test
    @DisplayName(
            "Cerrar una pestaña no desconecta a la que sigue abierta: el defecto que se corrige")
    void cerrarUnaPestanaNoDesconectaALaOtra() {
        Session primera = sesionAbierta();
        Session segunda = sesionAbierta();
        adapter.registrar("carlos", primera);
        adapter.registrar("carlos", segunda);

        adapter.retirar("carlos", segunda);

        assertEquals(1, adapter.sesionesDe("carlos"), "la primera pestaña debe seguir registrada");
        assertTrue(adapter.enviar("carlos", mensaje()), "y debe seguir recibiendo mensajes");
        verify(primera.getAsyncRemote()).sendText(anyString());
    }

    @Test
    @DisplayName("Cerrar la primera pestaña deja a la segunda conectada")
    void cerrarLaPrimeraNoDesconectaALaSegunda() {
        Session primera = sesionAbierta();
        Session segunda = sesionAbierta();
        adapter.registrar("carlos", primera);
        adapter.registrar("carlos", segunda);

        adapter.retirar("carlos", primera);

        assertEquals(1, adapter.sesionesDe("carlos"));
        assertTrue(adapter.enviar("carlos", mensaje()));
        verify(segunda.getAsyncRemote()).sendText(anyString());
    }

    @Test
    @DisplayName("Retirar una sesión que no estaba registrada no rompe nada")
    void retirarSesionDesconocida() {
        adapter.retirar("carlos", sesionAbierta());

        assertEquals(0, adapter.sesionesDe("carlos"));
    }

    @Test
    @DisplayName("Las sesiones de un usuario no se mezclan con las de otro")
    void losUsuariosNoSeMezclan() {
        Session carlos = sesionAbierta();
        adapter.registrar("carlos", carlos);

        adapter.enviar("paulo", mensaje());

        verify(carlos.getAsyncRemote(), never()).sendText(anyString());
        assertFalse(adapter.enviar("paulo", mensaje()));
    }

    @Test
    @DisplayName("Una sesión ya cerrada se descarta y no impide que las demás reciban")
    void unaSesionCerradaNoImpideElReparto() {
        Session cerrada = sesionCerrada();
        Session abierta = sesionAbierta();
        adapter.registrar("carlos", cerrada);
        adapter.registrar("carlos", abierta);

        boolean entregado = adapter.enviar("carlos", mensaje());

        assertTrue(entregado, "la sesión viva recibe y por eso el envío cuenta como entregado");
        verify(abierta.getAsyncRemote()).sendText(anyString());
        assertEquals(1, adapter.sesionesDe("carlos"), "la sesión cerrada se retira del registro");
    }

    @Test
    @DisplayName("Si todas las sesiones están cerradas el envío se da por no entregado")
    void todasCerradasEsNoEntregado() {
        adapter.registrar("carlos", sesionCerrada());

        assertFalse(adapter.enviar("carlos", mensaje()));
        assertEquals(0, adapter.sesionesDe("carlos"));
    }

    @Test
    @DisplayName("Un envío que falla en una sesión no impide el reparto a las demás")
    void unFalloNoImpideElReparto() {
        Session queFalla = mock(Session.class);
        when(queFalla.isOpen()).thenReturn(true);
        RemoteEndpoint.Async remotoQueFalla = mock(RemoteEndpoint.Async.class);
        doThrow(new IllegalStateException("canal caído"))
                .when(remotoQueFalla)
                .sendText(anyString());
        when(queFalla.getAsyncRemote()).thenReturn(remotoQueFalla);
        Session sana = sesionAbierta();

        adapter.registrar("carlos", queFalla);
        adapter.registrar("carlos", sana);

        boolean entregado = adapter.enviar("carlos", mensaje());

        // El fallo de una sesión no corta el reparto: quien escribe no puede arreglar el canal
        // caído de otra pestaña, y propagar la excepción cerraría su propio socket.
        assertTrue(entregado, "la sesión sana recibe, así que el envío cuenta como entregado");
        verify(sana.getAsyncRemote(), times(1)).sendText(anyString());
    }
}
