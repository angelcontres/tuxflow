package ec.edu.upse.redsocial.infrastructure.adapter.out.s3;

import ec.edu.upse.redsocial.domain.port.out.StorageMultimediaPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.InputStream;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@ApplicationScoped
public class MinioS3StorageAdapter implements StorageMultimediaPort {

    @Inject S3Client s3Client;

    @ConfigProperty(name = "redsocial.s3.bucket", defaultValue = "redsocial-media")
    String bucketName;

    @ConfigProperty(name = "quarkus.s3.endpoint-override", defaultValue = "http://localhost:9000")
    String endpoint;

    /**
     * Endpoint que se devuelve al navegador. Distinto del endpoint que usa el cliente S3: dentro de
     * la red de Docker el host es "minio", pero el navegador no resuelve ese nombre. Guardar esa
     * URL deja el <img> roto y el post se ve solo con el texto, aunque el archivo este subido.
     */
    @ConfigProperty(name = "redsocial.s3.public-endpoint", defaultValue = "http://localhost:9000")
    String publicEndpoint;

    @Override
    public String subirArchivo(
            InputStream inputStream, long contentLength, String contentType, String extension) {
        String key =
                "media-"
                        + UUID.randomUUID()
                        + (extension.startsWith(".") ? extension : "." + extension);

        PutObjectRequest putRequest =
                PutObjectRequest.builder()
                        .bucket(bucketName)
                        .key(key)
                        .contentType(contentType)
                        .build();

        try {
            s3Client.putObject(putRequest, RequestBody.fromInputStream(inputStream, contentLength));
        } catch (NoSuchBucketException e) {
            // Es el fallo mas comun en desarrollo: MinIO arranca sin el bucket
            // porque el servicio minio-init no se ejecutó. Sin este mensaje,
            // el frontend solo ve un error generico sin pista de la causa.
            throw new IllegalStateException(
                    "El bucket de almacenamiento '"
                            + bucketName
                            + "' no existe en "
                            + endpoint
                            + ". Crearlo con: mc mb <endpoint>/"
                            + bucketName
                            + " (docker-compose lo hace en el servicio minio-init).",
                    e);
        }

        return publicEndpoint + "/" + bucketName + "/" + key;
    }
}
