package ec.edu.upse.redsocial.application.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.model.NotificacionInApp;
import ec.edu.upse.redsocial.domain.model.Usuario;
import ec.edu.upse.redsocial.domain.port.out.GrafoPersistencePort;
import ec.edu.upse.redsocial.infrastructure.adapter.in.rest.SseNotificationManager;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class InAppNotificationServiceTest {

    @Mock GrafoPersistencePort grafoPersistencePort;
    @Mock SseNotificationManager sseManager;

    @InjectMocks InAppNotificationService inAppNotificationService;

    @BeforeEach
    void setUp() {}

    @Test
    void noDebeNotificarSiPostNoExiste() {
        when(grafoPersistencePort.obtenerAutorDePost("post-1")).thenReturn(null);

        inAppNotificationService.notificarNuevaReaccion("user-1", "post-1", "LIKE");

        verify(grafoPersistencePort, never()).obtenerUsuarioPorId(anyString());
        verify(grafoPersistencePort, never()).guardarNotificacionInApp(anyString(), any());
        verify(sseManager, never()).sendNotification(anyString(), any());
    }

    @Test
    void noDebeNotificarSiEsAutoReaccion() {
        // El autor del post es el mismo que reacciona
        when(grafoPersistencePort.obtenerAutorDePost("post-1")).thenReturn("user-1");

        inAppNotificationService.notificarNuevaReaccion("user-1", "post-1", "LIKE");

        verify(grafoPersistencePort, never()).obtenerUsuarioPorId(anyString());
        verify(grafoPersistencePort, never()).guardarNotificacionInApp(anyString(), any());
        verify(sseManager, never()).sendNotification(anyString(), any());
    }

    @Test
    void debeNotificarAutorAlRecibirReaccionValida() {
        when(grafoPersistencePort.obtenerAutorDePost("post-1")).thenReturn("autor-1");

        Usuario liker = new Usuario("user-1", "carlosfpatino", "carlos@test.com", "pass", "avatar");
        when(grafoPersistencePort.obtenerUsuarioPorId("user-1")).thenReturn(Optional.of(liker));

        inAppNotificationService.notificarNuevaReaccion("user-1", "post-1", "LIKE");

        // Verifica que se guarda en BD
        verify(grafoPersistencePort)
                .guardarNotificacionInApp(eq("autor-1"), any(NotificacionInApp.class));

        // Verifica que se emite SSE
        verify(sseManager).sendNotification(eq("autor-1"), any(NotificacionInApp.class));
    }
}
