package ec.edu.upse.redsocial.domain.port.out;

import java.io.InputStream;

public interface StorageMultimediaPort {
    String subirArchivo(
            InputStream inputStream, long contentLength, String contentType, String extension);
}
