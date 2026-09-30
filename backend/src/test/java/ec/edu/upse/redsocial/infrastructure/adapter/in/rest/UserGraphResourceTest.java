package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.model.Usuario;
import ec.edu.upse.redsocial.domain.port.in.GestionarGrafoSocialUseCase;
import jakarta.ws.rs.core.Response;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.jboss.resteasy.reactive.multipart.FileUpload;
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

    @Test
    @DisplayName("POST /{userId}/avatar responde 400 cuando no se adjunta archivo")
    void subirAvatarSinArchivoResponde400() {
        Response respuesta = resource.subirAvatarUsuario("u1", null);

        assertEquals(400, respuesta.getStatus());
    }

    @Test
    @DisplayName("POST /{userId}/avatar responde 200 con la URL devuelta por el caso de uso")
    void subirAvatarConArchivoResponde200ConLaUrl() throws Exception {
        FileUpload archivo = mockArchivoSubido("avatar.png", "image/png", new byte[] {1, 2, 3});
        when(gestionarGrafoSocialUseCase.subirAvatar(
                        eq("u1"), any(InputStream.class), anyLong(), anyString(), anyString()))
                .thenReturn("http://minio:9000/redsocial-media/avatar.png");

        Response respuesta = resource.subirAvatarUsuario("u1", archivo);

        assertEquals(200, respuesta.getStatus());
        assertEquals(
                Map.of("avatarUrl", "http://minio:9000/redsocial-media/avatar.png"),
                respuesta.getEntity());
    }

    @Test
    @DisplayName("POST /{userId}/avatar responde 500 genérico sin filtrar el detalle interno")
    void subirAvatarConFalloResponde500SinFiltrarDetalle() throws Exception {
        FileUpload archivo = mockArchivoSubido("avatar.png", "image/png", new byte[] {1, 2, 3});
        when(gestionarGrafoSocialUseCase.subirAvatar(
                        eq("u1"), any(InputStream.class), anyLong(), anyString(), anyString()))
                .thenThrow(new RuntimeException("NoSuchBucket: redsocial-media"));

        Response respuesta = resource.subirAvatarUsuario("u1", archivo);

        assertEquals(500, respuesta.getStatus());
        assertTrue(respuesta.getEntity() instanceof Map);
        String cuerpo = respuesta.getEntity().toString();
        assertFalse(cuerpo.contains("NoSuchBucket"), "El detalle interno no debe exponerse");
    }

    private static FileUpload mockArchivoSubido(String nombre, String tipoContenido, byte[] datos)
            throws Exception {
        Path temporal = Files.createTempFile("avatar-test", ".png");
        Files.write(temporal, datos);
        temporal.toFile().deleteOnExit();
        FileUpload archivo = mock(FileUpload.class);
        when(archivo.uploadedFile()).thenReturn(temporal);
        when(archivo.fileName()).thenReturn(nombre);
        when(archivo.contentType()).thenReturn(tipoContenido);
        when(archivo.size()).thenReturn((long) datos.length);
        return archivo;
    }
}
