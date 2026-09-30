package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.model.Usuario;
import ec.edu.upse.redsocial.domain.port.in.GestionarGrafoSocialUseCase;
import jakarta.ws.rs.core.Response;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class UserGraphResourceTest {

    @Mock GestionarGrafoSocialUseCase gestionarGrafoSocialUseCase;

    @InjectMocks UserGraphResource resource;

    @Test
    @DisplayName("GET /{userId}/follows responde 200 con lista vacía cuando no hay seguidos")
    void obtenerSeguidosSinSeguidosResponde200ConListaVacia() {
        when(gestionarGrafoSocialUseCase.obtenerSeguidos("u1")).thenReturn(List.of());

        Response respuesta = resource.obtenerSeguidos("u1");

        assertEquals(200, respuesta.getStatus());
        assertEquals(List.of(), respuesta.getEntity());
    }

    @Test
    @DisplayName("GET /{userId}/follows responde 200 con la lista de seguidos del caso de uso")
    void obtenerSeguidosConSeguidosResponde200ConLaLista() {
        List<Usuario> seguidos =
                List.of(
                        new Usuario("u2", "ana_upse", "ana@upse.edu.ec", "Ana", null),
                        new Usuario(
                                "u3",
                                "leo_upse",
                                "leo@upse.edu.ec",
                                "Leo",
                                "https://minio.upse.edu.ec/leo.png"));
        when(gestionarGrafoSocialUseCase.obtenerSeguidos("u1")).thenReturn(seguidos);

        Response respuesta = resource.obtenerSeguidos("u1");

        assertEquals(200, respuesta.getStatus());
        assertEquals(seguidos, respuesta.getEntity());
    }
}
