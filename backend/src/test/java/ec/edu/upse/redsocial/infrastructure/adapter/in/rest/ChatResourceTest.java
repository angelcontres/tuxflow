package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.model.ConversacionChat;
import ec.edu.upse.redsocial.domain.model.MensajeChat;
import ec.edu.upse.redsocial.domain.port.in.GestionarChatUseCase;
import ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto.ConversacionChatResponse;
import jakarta.ws.rs.core.Response;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Cubre las respuestas del historial, en especial las dos que responden 400.
 *
 * <p>Se prueban sobre el recurso y no levantando la aplicación, porque lo que interesa es el código
 * de respuesta y el motivo que ve el cliente. El orden de la historia ya está cubierto en {@code
 * ChatApplicationServiceTest}; aquí lo que se vigila es que el endpoint no confunda "nunca se
 * escribieron" con "la llamada está mal".
 */
@ExtendWith(MockitoExtension.class)
class ChatResourceTest {

    @Mock GestionarChatUseCase gestionarChatUseCase;

    @InjectMocks ChatResource resource;

    @Test
    @DisplayName("Devuelve 200 con los mensajes de la pareja")
    void devuelveElHistorial() {
        when(gestionarChatUseCase.historial("carlos", "paulo"))
                .thenReturn(List.of(new MensajeChat("id-1", "carlos", "paulo", "hola")));

        Response respuesta = resource.obtenerHistorial("carlos", "paulo");

        assertEquals(200, respuesta.getStatus());
        assertEquals(1, ((List<?>) respuesta.getEntity()).size());
    }

    @Test
    @DisplayName("Una pareja sin mensajes responde 200 con lista vacía")
    void parejaSinMensajes() {
        when(gestionarChatUseCase.historial("carlos", "paulo")).thenReturn(List.of());

        Response respuesta = resource.obtenerHistorial("carlos", "paulo");

        assertEquals(200, respuesta.getStatus());
        assertTrue(((List<?>) respuesta.getEntity()).isEmpty());
    }

    @Test
    @DisplayName("Sin los dos participantes responde 400 y no consulta el grafo")
    void sinParametros() {
        assertEquals(400, resource.obtenerHistorial(null, "paulo").getStatus());
        assertEquals(400, resource.obtenerHistorial("carlos", null).getStatus());
        assertEquals(400, resource.obtenerHistorial(null, null).getStatus());
        assertEquals(400, resource.obtenerHistorial("", "paulo").getStatus());
        assertEquals(400, resource.obtenerHistorial("carlos", "  ").getStatus());

        verifyNoInteractions(gestionarChatUseCase);
    }

    @Test
    @DisplayName("Pedir el historial consigo mismo responde 400 y no consulta el grafo")
    void consigoMismo() {
        assertEquals(400, resource.obtenerHistorial("carlos", "carlos").getStatus());

        verifyNoInteractions(gestionarChatUseCase);
    }

    @Test
    @DisplayName("El motivo del 400 explica qué corregir")
    void el400ExplicaElMotivo() {
        Response respuesta = resource.obtenerHistorial("carlos", "carlos");

        assertTrue(
                respuesta.getEntity().toString().contains("distintos"),
                "el cuerpo debe decir qué está mal: " + respuesta.getEntity());
    }

    @Test
    @DisplayName("Pasa los dos participantes al caso de uso tal cual llegaron")
    void delegaLosParametros() {
        when(gestionarChatUseCase.historial("carlos", "paulo")).thenReturn(List.of());

        resource.obtenerHistorial("carlos", "paulo");

        verify(gestionarChatUseCase).historial("carlos", "paulo");
    }

    /** El recurso no debe dejar la validación en manos del caso de uso: aquí se comprueba. */
    @Test
    @DisplayName("Un caso de uso malicioso no se invoca nunca con datos incompletos")
    void noInvocaConDatosIncompletos() {
        GestionarChatUseCase espia = mock(GestionarChatUseCase.class);
        ChatResource conEspia = new ChatResource();
        conEspia.gestionarChatUseCase = espia;

        conEspia.obtenerHistorial("carlos", null);
        conEspia.obtenerHistorial("carlos", "carlos");

        verifyNoInteractions(espia);
    }

    @Nested
    @DisplayName("Bandeja de conversaciones")
    class Bandeja {

        @Test
        @DisplayName("Devuelve 200 con una fila por conversación")
        void devuelveLaBandeja() {
            ConversacionChat conversacion = conversacion("paulo-orrala");
            when(gestionarChatUseCase.conversaciones("carlos")).thenReturn(List.of(conversacion));

            Response respuesta = resource.obtenerConversaciones("carlos");

            assertEquals(200, respuesta.getStatus());
            assertEquals(1, ((List<?>) respuesta.getEntity()).size());
        }

        @Test
        @DisplayName("La fila viaja como DTO, sin los nombres del dominio")
        void laFilaEsUnDto() {
            when(gestionarChatUseCase.conversaciones("carlos"))
                    .thenReturn(List.of(conversacion("paulo-orrala")));

            Response respuesta = resource.obtenerConversaciones("carlos");

            Object entidad = respuesta.getEntity();
            assertInstanceOf(List.class, entidad);
            Object fila = ((List<?>) entidad).get(0);
            assertInstanceOf(ConversacionChatResponse.class, fila, "no debe verse el modelo");
            // El prefijo `interlocutor` disappears en el DTO: la fila de la bandeja siempre es
            // "esta
            // persona", así que el prefijo no dice nada que el contenedor no diga ya.
            assertFalse(
                    fila.toString().contains("interlocutor"),
                    "las propiedades públicas no llevan el prefijo del dominio: " + fila);
        }

        @Test
        @DisplayName("Un usuario sin conversaciones responde 200 con lista vacía")
        void sinConversaciones() {
            when(gestionarChatUseCase.conversaciones("carlos")).thenReturn(List.of());

            Response respuesta = resource.obtenerConversaciones("carlos");

            assertEquals(200, respuesta.getStatus());
            assertTrue(((List<?>) respuesta.getEntity()).isEmpty());
        }

        @Test
        @DisplayName("Sin identificador responde 400 y no consulta el grafo")
        void sinIdentificador() {
            assertEquals(400, resource.obtenerConversaciones(null).getStatus());
            assertEquals(400, resource.obtenerConversaciones("").getStatus());
            assertEquals(400, resource.obtenerConversaciones("   ").getStatus());

            // Sin el 400, "no has escrito con nadie" y "no me dijiste de quién" serían la misma
            // respuesta y el cliente no podría distinguirlas.
            verifyNoInteractions(gestionarChatUseCase);
        }

        @Test
        @DisplayName("Pasa el identificador al caso de uso tal cual llegó")
        void delegaElIdentificador() {
            when(gestionarChatUseCase.conversaciones("carlos")).thenReturn(List.of());

            resource.obtenerConversaciones("carlos");

            verify(gestionarChatUseCase).conversaciones("carlos");
        }

        private ConversacionChat conversacion(String interlocutorId) {
            ConversacionChat conversacion = new ConversacionChat();
            conversacion.setInterlocutorId(interlocutorId);
            conversacion.setInterlocutorUsername("paulo");
            conversacion.setInterlocutorNombre("Paulo Orrala");
            conversacion.setUltimoMensaje("que tal");
            conversacion.setFechaUltimoMensaje(1700000005000L);
            return conversacion;
        }
    }
}
