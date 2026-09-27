package ec.edu.upse.redsocial.infrastructure.adapter.out.neo4j;

import ec.edu.upse.redsocial.domain.model.Post;
import ec.edu.upse.redsocial.domain.model.SugerenciaUsuario;
import ec.edu.upse.redsocial.domain.model.Usuario;
import ec.edu.upse.redsocial.domain.port.out.GrafoPersistencePort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.*;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Values;

@ApplicationScoped
public class Neo4jGrafoAdapter implements GrafoPersistencePort {

    @Inject Driver driver;

    // --- 1. Feed Cronológico Filtrado por Grafo Social (2 Saltos) ---
    @Override
    public List<Post> obtenerFeedCronologico(String userId) {
        String cypher =
                """
            MATCH (u:Usuario {id: $userId})-[:SIGUE]->(amigo:Usuario)-[:PUBLICA]->(p:Post)
            OPTIONAL MATCH (p)<-[r:REACCIONA]-(:Usuario)
            RETURN p.id AS id,
                   p.texto AS texto,
                   p.mediaUrl AS mediaUrl,
                   p.fechaCreacion AS fecha,
                   amigo.id AS autorId,
                   amigo.username AS autorUsername,
                   amigo.avatarUrl AS autorAvatar,
                   count(r) AS totalLikes,
                   EXISTS((u)-[:REACCIONA]->(p)) AS likedByMe
            ORDER BY p.fechaCreacion DESC
            LIMIT 20;
            """;

        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
                        var result = tx.run(cypher, Values.parameters("userId", userId));
                        List<Post> posts = new ArrayList<>();
                        while (result.hasNext()) {
                            Record record = result.next();
                            Post p = new Post();
                            p.setId(record.get("id").asString());
                            p.setTexto(record.get("texto").asString());
                            p.setMediaUrl(
                                    record.get("mediaUrl").isNull()
                                            ? null
                                            : record.get("mediaUrl").asString());
                            p.setFechaCreacion(record.get("fecha").asString());
                            p.setAutorId(record.get("autorId").asString());
                            p.setAutorUsername(record.get("autorUsername").asString());
                            p.setAutorAvatar(
                                    record.get("autorAvatar").isNull()
                                            ? null
                                            : record.get("autorAvatar").asString());
                            p.setTotalLikes(record.get("totalLikes").asLong());
                            p.setLikedByMe(record.get("likedByMe").asBoolean());
                            posts.add(p);
                        }
                        return posts;
                    });
        }
    }

    // --- 2. Algoritmo de Sugerencia de Usuarios (Red Social de Segundo Nivel) ---
    @Override
    public List<SugerenciaUsuario> obtenerSugerenciasUsuarios(String userId) {
        String cypher =
                """
            MATCH (u:Usuario {id: $userId})-[:SIGUE]->(intermedio:Usuario)-[:SIGUE]->(sugerido:Usuario)
            WHERE u <> sugerido AND NOT (u)-[:SIGUE]->(sugerido)
            RETURN sugerido.id AS id,
                   sugerido.username AS username,
                   sugerido.nombre AS nombre,
                   sugerido.avatarUrl AS avatar,
                   count(intermedio) AS conexionesEnComun,
                   collect(intermedio.username) AS seguidosEnComun
            ORDER BY conexionesEnComun DESC
            LIMIT 5;
            """;

        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
                        var result = tx.run(cypher, Values.parameters("userId", userId));
                        List<SugerenciaUsuario> sugerencias = new ArrayList<>();
                        while (result.hasNext()) {
                            Record record = result.next();
                            SugerenciaUsuario s = new SugerenciaUsuario();
                            s.setId(record.get("id").asString());
                            s.setUsername(record.get("username").asString());
                            s.setNombre(record.get("nombre").asString());
                            s.setAvatar(
                                    record.get("avatar").isNull()
                                            ? null
                                            : record.get("avatar").asString());
                            s.setConexionesEnComun(record.get("conexionesEnComun").asLong());
                            s.setSeguidosEnComun(
                                    record.get("seguidosEnComun").asList(v -> v.asString()));
                            sugerencias.add(s);
                        }
                        return sugerencias;
                    });
        }
    }

    // --- 3. Seguidores y Conexiones en Común entre Dos Perfiles ---
    @Override
    public List<Usuario> obtenerSeguidoresEnComun(String userA, String userB) {
        String cypher =
                """
            MATCH (u1:Usuario {id: $userA})<-[:SIGUE]-(comun:Usuario)-[:SIGUE]->(u2:Usuario {id: $userB})
            RETURN comun.id AS id,
                   comun.username AS username,
                   comun.nombre AS nombre,
                   comun.avatarUrl AS avatar;
            """;

        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
                        var result =
                                tx.run(cypher, Values.parameters("userA", userA, "userB", userB));
                        List<Usuario> usuarios = new ArrayList<>();
                        while (result.hasNext()) {
                            Record record = result.next();
                            Usuario u = new Usuario();
                            u.setId(record.get("id").asString());
                            u.setUsername(record.get("username").asString());
                            u.setNombre(record.get("nombre").asString());
                            u.setAvatarUrl(
                                    record.get("avatar").isNull()
                                            ? null
                                            : record.get("avatar").asString());
                            usuarios.add(u);
                        }
                        return usuarios;
                    });
        }
    }

    // --- 4. Grado de Separación y Camino Más Corto (Shortest Path) ---
    @Override
    public Map<String, Object> obtenerCaminoMasCorto(String origenId, String destinoId) {
        String cypher =
                """
            MATCH p = shortestPath((origen:Usuario {id: $origenId})-[:SIGUE*..6]->(destino:Usuario {id: $destinoId}))
            WHERE origen <> destino
            RETURN [n IN nodes(p) | n.username] AS rutaConexion,
                   length(p) AS saltosTotales;
            """;

        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
                        var result =
                                tx.run(
                                        cypher,
                                        Values.parameters(
                                                "origenId", origenId, "destinoId", destinoId));
                        if (result.hasNext()) {
                            Record record = result.next();
                            Map<String, Object> map = new HashMap<>();
                            map.put(
                                    "rutaConexion",
                                    record.get("rutaConexion").asList(v -> v.asString()));
                            map.put("saltosTotales", record.get("saltosTotales").asInt());
                            return map;
                        }
                        return Collections.emptyMap();
                    });
        }
    }

    // --- 5. Tendencias en la Red Extendida (Posts con más interacción a 1 y 2 saltos) ---
    @Override
    public List<Map<String, Object>> obtenerTendenciasRedExtendida(String userId) {
        String cypher =
                """
            MATCH (u:Usuario {id: $userId})-[:SIGUE*1..2]->(autor:Usuario)-[:PUBLICA]->(p:Post)
            WHERE p.fechaCreacion >= datetime() - duration('P7D')
            MATCH (reactor:Usuario)-[:REACCIONA]->(p)
            RETURN p.id AS id,
                   p.texto AS texto,
                   autor.username AS autor,
                   count(reactor) AS totalReacciones
            ORDER BY totalReacciones DESC
            LIMIT 10;
            """;

        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
                        var result = tx.run(cypher, Values.parameters("userId", userId));
                        List<Map<String, Object>> trends = new ArrayList<>();
                        while (result.hasNext()) {
                            Record record = result.next();
                            Map<String, Object> item = new HashMap<>();
                            item.put("id", record.get("id").asString());
                            item.put("texto", record.get("texto").asString());
                            item.put("autor", record.get("autor").asString());
                            item.put("totalReacciones", record.get("totalReacciones").asLong());
                            trends.add(item);
                        }
                        return trends;
                    });
        }
    }

    @Override
    public void guardarUsuario(Usuario u) {
        String cypher =
                """
            MERGE (u:Usuario {id: $id})
            SET u.username = $username,
                u.email = $email,
                u.nombre = $nombre,
                u.avatarUrl = $avatarUrl
            """;
        try (var session = driver.session()) {
            session.executeWrite(
                    tx ->
                            tx.run(
                                    cypher,
                                    Values.parameters(
                                            "id", u.getId(),
                                            "username", u.getUsername(),
                                            "email", u.getEmail(),
                                            "nombre", u.getNombre(),
                                            "avatarUrl",
                                                    u.getAvatarUrl() != null
                                                            ? u.getAvatarUrl()
                                                            : "")));
        }
    }

    @Override
    public void seguirUsuario(String seguidorId, String seguidoId) {
        String cypher =
                """
            MATCH (a:Usuario {id: $seguidorId}), (b:Usuario {id: $seguidoId})
            MERGE (a)-[r:SIGUE]->(b)
            ON CREATE SET r.desde = timestamp()
            """;
        try (var session = driver.session()) {
            session.executeWrite(
                    tx ->
                            tx.run(
                                    cypher,
                                    Values.parameters(
                                            "seguidorId", seguidorId, "seguidoId", seguidoId)));
        }
    }

    @Override
    public void dejarDeSeguir(String seguidorId, String seguidoId) {
        String cypher =
                """
            MATCH (a:Usuario {id: $seguidorId})-[r:SIGUE]->(b:Usuario {id: $seguidoId})
            DELETE r
            """;
        try (var session = driver.session()) {
            session.executeWrite(
                    tx ->
                            tx.run(
                                    cypher,
                                    Values.parameters(
                                            "seguidorId", seguidorId, "seguidoId", seguidoId)));
        }
    }

    @Override
    public void crearPost(String autorId, String postId, String texto, String mediaUrl) {
        String cypher =
                """
            MATCH (u:Usuario {id: $autorId})
            CREATE (p:Post {
                id: $postId,
                texto: $texto,
                mediaUrl: $mediaUrl,
                fechaCreacion: datetime().epochMillis
            })
            CREATE (u)-[:PUBLICA]->(p)
            """;
        try (var session = driver.session()) {
            session.executeWrite(
                    tx ->
                            tx.run(
                                    cypher,
                                    Values.parameters(
                                            "autorId", autorId,
                                            "postId", postId,
                                            "texto", texto,
                                            "mediaUrl", mediaUrl != null ? mediaUrl : "")));
        }
    }

    @Override
    public void alternarLike(String userId, String postId) {
        String cypher =
                """
            MATCH (u:Usuario {id: $userId}), (p:Post {id: $postId})
            MERGE (u)-[r:REACCIONA {tipo: 'LIKE'}]->(p)
            ON CREATE SET r.fecha = timestamp()
            """;
        try (var session = driver.session()) {
            session.executeWrite(
                    tx -> tx.run(cypher, Values.parameters("userId", userId, "postId", postId)));
        }
    }

    @Override
    public List<String> obtenerSuscripcionesPushDeSeguidores(String autorId) {
        String cypher =
                """
            MATCH (seguidor:Usuario)-[:SIGUE]->(autor:Usuario {id: $autorId})
            WHERE seguidor.pushSubscriptionJson IS NOT NULL
            RETURN seguidor.pushSubscriptionJson AS pushJson
            """;
        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
                        var res = tx.run(cypher, Values.parameters("autorId", autorId));
                        List<String> list = new ArrayList<>();
                        while (res.hasNext()) {
                            list.add(res.next().get("pushJson").asString());
                        }
                        return list;
                    });
        }
    }
}
