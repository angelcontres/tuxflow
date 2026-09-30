package ec.edu.upse.redsocial.application.service;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.model.Usuario;
import ec.edu.upse.redsocial.domain.port.out.GrafoPersistencePort;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserGraphApplicationServiceTest {

    @Mock GrafoPersistencePort grafoPersistencePort;

    @InjectMocks UserGraphApplicationService service;

    @Test
    @DisplayName(
            "obtenerSeguidos delega al puerto con el mismo argumento y devuelve su lista sin cambios")
    void obtenerSeguidosDelegaAlPuertoSinValidarNiTransformar() {
        List<Usuario> esperados =
                List.of(new Usuario("u2", "ana_upse", "ana@upse.edu.ec", "Ana", null));
        when(grafoPersistencePort.obtenerSeguidos("u1")).thenReturn(esperados);

        List<Usuario> resultado = service.obtenerSeguidos("u1");

        verify(grafoPersistencePort).obtenerSeguidos("u1");
        assertSame(esperados, resultado);
    }
}
