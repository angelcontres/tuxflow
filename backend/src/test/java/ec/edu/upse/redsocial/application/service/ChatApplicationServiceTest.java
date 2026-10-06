package ec.edu.upse.redsocial.application.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.exception.ParticipanteNoEncontradoException;
import ec.edu.upse.redsocial.domain.model.MensajeChat;
import ec.edu.upse.redsocial.domain.model.ResultadoEnvio;
import ec.edu.upse.redsocial.domain.port.out.CanalChatPort;
import ec.edu.upse.redsocial.domain.port.out.GrafoPersistencePort;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Cubre las reglas del envío, su orden y el destino de cada una de las tres salidas.
 *
 * <p>El defecto que se persigue aquí es de orden y no de lógica aislada: si la validación de los
 * datos fuera después del guardado, un mensaje vacío quedaría escrito en el grafo aunque el cliente
 * recibiera el rechazo, y nadie se enteraría de que la fila sobrante está ahí.
 *
 * <p>Lo que no se prueba aquí es el reparto a sesiones abiertas, que es territorio de {@code
 * SesionesChatAdapterTest}; aquí el canal es un doble que solo anota a quién se le entrega.
 */
@ExtendWith(MockitoExtension.class)
class ChatApplicationServiceTest {

    @Mock GrafoPersistencePort grafoPersistencePort;

    @Mock CanalChatPort canalChatPort;

    @InjectMocks ChatApplicationService service;

    @Nested
    @DisplayName("Lo que se rechaza antes de tocar la persistencia")
    class RechazosPrevios {

        @Test
        @DisplayName("Un contenido en blanco se rechaza y no deja fila en el grafo")
        void rechazaContenidoEnBlanco() {
            ResultadoEnvio resultado = service.enviar("carlos", "paulo", "   ");

            assertEquals(ResultadoEnvio.Estado.RECHAZADO, resultado.estado());
            assertNotNull(resultado.motivo());
            assertFalse(resultado.motivo().isBlank());
            verifyNoInteractions(grafoPersistencePort, canalChatPort);
        }

        @Test
        @DisplayName("Un contenido ausente se rechaza igual que uno en blanco")
        void rechazaContenidoAusente() {
            ResultadoEnvio resultado = service.enviar("carlos", "paulo", null);

            assertEquals(ResultadoEnvio.Estado.RECHAZADO, resultado.estado());
            verifyNoInteractions(grafoPersistencePort, canalChatPort);
        }

        @Test
        @DisplayName("Un destinatario ausente se rechaza y se nombra el motivo")
        void rechazaDestinatarioAusente() {
            ResultadoEnvio resultado = service.enviar("carlos", "  ", "hola");

            assertEquals(ResultadoEnvio.Estado.RECHAZADO, resultado.estado());
            assertNotNull(resultado.motivo());
            verifyNoInteractions(grafoPersistencePort, canalChatPort);
        }

        @Test
        @DisplayName(
                "Escribirse a uno mismo se rechaza con un motivo propio, no con el del destinatario")
        void rechazaAUnoMismo() {
            ResultadoEnvio resultado = service.enviar("carlos", "carlos", "hola");

            assertEquals(ResultadoEnvio.Estado.RECHAZADO, resultado.estado());
            assertTrue(
                    resultado.motivo().toLowerCase().contains("mismo")
                            || resultado.motivo().toLowerCase().contains("ti"),
                    "el motivo debe explicar que es uno mismo y no que falta el destinatario: "
                            + resultado.motivo());
            verifyNoInteractions(grafoPersistencePort, canalChatPort);
        }

        @Test
        @DisplayName("El rechazo conserva el texto que se quiso enviar")
        void elRechazoDevuelveElContenido() {
            ResultadoEnvio resultado = service.enviar("carlos", "paulo", "hola");

            assertEquals("hola", resultado.mensaje().getContenido());
        }
    }

    @Nested
    @DisplayName("Envío válido")
    class EnvioValido {

        @Test
        @DisplayName("El mensaje se guarda antes de repartirse")
        void guardaAntesDeRepartir() {
            when(canalChatPort.enviar(eq("paulo"), any())).thenReturn(true);

            service.enviar("carlos", "paulo", "hola");

            InOrder orden = inOrder(grafoPersistencePort, canalChatPort);
            orden.verify(grafoPersistencePort).guardarMensajeChat(any());
            orden.verify(canalChatPort).enviar(eq("paulo"), any());
        }

        @Test
        @DisplayName("El emisor es el de la ruta de conexión, nunca uno que venga en el cuerpo")
        void elEmisorVieneDeLaRuta() {
            when(canalChatPort.enviar(eq("paulo"), any())).thenReturn(true);

            service.enviar("carlos", "paulo", "hola");

            ArgumentCaptor<MensajeChat> guardado = ArgumentCaptor.forClass(MensajeChat.class);
            verify(grafoPersistencePort).guardarMensajeChat(guardado.capture());
            assertEquals("carlos", guardado.getValue().getEmisorId());
            assertEquals("paulo", guardado.getValue().getDestinatarioId());
            assertEquals("hola", guardado.getValue().getContenido());
        }

        @Test
        @DisplayName("El servidor completa id y marca de tiempo antes de guardar")
        void elServidorAsignaIdYMarcaDeTiempo() {
            when(canalChatPort.enviar(eq("paulo"), any())).thenReturn(true);

            service.enviar("carlos", "paulo", "hola");

            ArgumentCaptor<MensajeChat> guardado = ArgumentCaptor.forClass(MensajeChat.class);
            verify(grafoPersistencePort).guardarMensajeChat(guardado.capture());
            assertNotNull(guardado.getValue().getId());
            assertFalse(guardado.getValue().getId().isBlank());
            assertTrue(guardado.getValue().getTimestamp() > 0);
        }

        @Test
        @DisplayName(
                "Dos envíos del mismo texto reciben id distintos, para no confundirlos al reconciliar")
        void idsDistintosPorEnvio() {
            when(canalChatPort.enviar(eq("paulo"), any())).thenReturn(true);

            service.enviar("carlos", "paulo", "hola");
            service.enviar("carlos", "paulo", "hola");

            ArgumentCaptor<MensajeChat> guardados = ArgumentCaptor.forClass(MensajeChat.class);
            verify(grafoPersistencePort, times(2)).guardarMensajeChat(guardados.capture());
            assertNotEquals(
                    guardados.getAllValues().get(0).getId(),
                    guardados.getAllValues().get(1).getId());
        }

        @Test
        @DisplayName("Con destino abierto se marca ENTREGADO y no hay motivo que explicar")
        void entregadoConDestino() {
            when(canalChatPort.enviar(eq("paulo"), any())).thenReturn(true);

            ResultadoEnvio resultado = service.enviar("carlos", "paulo", "hola");

            assertEquals(ResultadoEnvio.Estado.ENTREGADO, resultado.estado());
            assertTrue(resultado.motivo() == null || resultado.motivo().isBlank());
        }

        @Test
        @DisplayName(
                "Sin ninguna sesión abierta se marca NO_ENTREGADO y se aclara que quedó guardado")
        void noEntregadoSinSesiones() {
            when(canalChatPort.enviar(eq("paulo"), any())).thenReturn(false);

            ResultadoEnvio resultado = service.enviar("carlos", "paulo", "hola");

            assertEquals(ResultadoEnvio.Estado.NO_ENTREGADO, resultado.estado());
            assertTrue(
                    resultado.motivo().toLowerCase().contains("guardado"),
                    "el motivo debe tranquilizar de que no se perdió: " + resultado.motivo());
            assertNotNull(resultado.mensaje().getId());
        }
    }

    @Nested
    @DisplayName("Destinatario que no existe en el grafo")
    class DestinatarioInexistente {

        @Test
        @DisplayName(
                "Se rechaza el mensaje en vez de propagar la excepción, para no matar el socket del emisor")
        void seRechazaEnVezDePropagar() {
            doThrow(new ParticipanteNoEncontradoException("fantasma"))
                    .when(grafoPersistencePort)
                    .guardarMensajeChat(any());

            ResultadoEnvio resultado = service.enviar("carlos", "fantasma", "hola");

            assertEquals(ResultadoEnvio.Estado.RECHAZADO, resultado.estado());
            assertTrue(
                    resultado.motivo().contains("fantasma"),
                    "el motivo nombra a quien no existe: " + resultado.motivo());
            verify(canalChatPort, never()).enviar(any(), any());
        }

        @Test
        @DisplayName("El motivo no afirma que el mensaje quedó guardado, porque no se guardó")
        void elMotivoNoMiente() {
            doThrow(new ParticipanteNoEncontradoException("fantasma"))
                    .when(grafoPersistencePort)
                    .guardarMensajeChat(any());

            ResultadoEnvio resultado = service.enviar("carlos", "fantasma", "hola");

            assertFalse(
                    resultado.motivo().toLowerCase().contains("guardado"),
                    "no llegó a guardarse, así que el motivo no puede decirlo: "
                            + resultado.motivo());
        }

        @Test
        @DisplayName(
                "Un mensaje rechazado por inexistente vuelve sin id, porque no llegó a existir")
        void sinIdCuandoNoSeGuardo() {
            doThrow(new ParticipanteNoEncontradoException("fantasma"))
                    .when(grafoPersistencePort)
                    .guardarMensajeChat(any());

            ResultadoEnvio resultado = service.enviar("carlos", "fantasma", "hola");

            assertNull(resultado.mensaje().getId());
        }
    }

    @Nested
    @DisplayName("Historial")
    class Historial {

        @Test
        @DisplayName("Delega tal cual en la persistencia")
        void delegaEnLaPersistencia() {
            MensajeChat esperado = new MensajeChat("id-1", "carlos", "paulo", "hola");
            when(grafoPersistencePort.obtenerHistorialChat("carlos", "paulo"))
                    .thenReturn(List.of(esperado));

            List<MensajeChat> resultado = service.historial("carlos", "paulo");

            assertEquals(List.of(esperado), resultado);
            verify(grafoPersistencePort).obtenerHistorialChat("carlos", "paulo");
        }

        @Test
        @DisplayName("Una pareja sin mensajes devuelve una lista vacía, no un error")
        void vacioSinMensajes() {
            when(grafoPersistencePort.obtenerHistorialChat("carlos", "paulo"))
                    .thenReturn(List.of());

            assertTrue(service.historial("carlos", "paulo").isEmpty());
        }
    }
}
