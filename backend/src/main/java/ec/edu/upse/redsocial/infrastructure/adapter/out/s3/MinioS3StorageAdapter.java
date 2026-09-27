package ec.edu.upse.redsocial.infrastructure.adapter.out.s3;

import ec.edu.upse.redsocial.domain.port.out.StorageMultimediaPort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.io.InputStream;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@ApplicationScoped
public class MinioS3StorageAdapter implements StorageMultimediaPort {

    @Inject S3Client s3Client;

    @ConfigProperty(name = "redsocial.s3.bucket", defaultValue = "redsocial-media")
    String bucketName;

    @ConfigProperty(name = "quarkus.s3.endpoint-override", defaultValue = "http://localhost:9000")
    String endpoint;

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

        s3Client.putObject(putRequest, RequestBody.fromInputStream(inputStream, contentLength));

        return endpoint + "/" + bucketName + "/" + key;
    }
}
