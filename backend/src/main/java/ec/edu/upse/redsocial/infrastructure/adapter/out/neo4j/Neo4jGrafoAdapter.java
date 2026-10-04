package ec.edu.upse.redsocial.infrastructure.adapter.out.neo4j;

import ec.edu.upse.redsocial.domain.exception.AutorNoEncontradoException;
import ec.edu.upse.redsocial.domain.exception.PostNoEncontradoException;
import ec.edu.upse.redsocial.domain.model.EstadoReaccion;
import ec.edu.upse.redsocial.domain.model.Post;
import ec.edu.upse.redsocial.domain.model.SugerenciaUsuario;
import ec.edu.upse.redsocial.domain.model.Usuario;
import ec.edu.upse.redsocial.domain.port.out.GrafoPersistencePort;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.*;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Value;
import org.neo4j.driver.Values;

@ApplicationScoped
public class Neo4jGrafoAdapter implements GrafoPersistencePort {

    @Inject Driver driver;

    // --- 1. Feed Cronológico Filtrado por Grafo Social (2 Saltos) ---
    @Override
    public List<Post> obtenerFeedCronologico(String userId) {
        String cypher =
                """
            MATCH (u:Usuario {id: $userId})
            MATCH (autor:Usuario)-[:PUBLICA]->(p:Post)
            WHERE autor = u OR (u)-[:SIGUE]->(autor)
            OPTIONAL MATCH (p)<-[rl:REACCIONA {tipo: 'LIKE'}]-(:Usuario)
            OPTIONAL MATCH (p)<-[rd:REACCIONA {tipo: 'DISLIKE'}]-(:Usuario)
            RETURN p.id AS id,
                   p.texto AS texto,
                   p.mediaUrl AS mediaUrl,
                   p.fechaCreacion AS fecha,
                   autor.id AS autorId,
                   autor.username AS autorUsername,
                   autor.avatarUrl AS autorAvatar,
                   count(DISTINCT rl) AS totalLikes,
                   count(DISTINCT rd) AS totalDislikes,
                   EXISTS((u)-[:REACCIONA {tipo: 'LIKE'}]->(p)) AS likedByMe,
                   EXISTS((u)-[:REACCIONA {tipo: 'DISLIKE'}]->(p)) AS dislikedByMe
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
                            p.setFechaCreacion(
                                    record.get("fecha").isNull()
                                            ? null
                                            : record.get("fecha").asLong());
                            p.setAutorId(record.get("autorId").asString());
                            p.setAutorUsername(record.get("autorUsername").asString());
                            p.setAutorAvatar(
                                    record.get("autorAvatar").isNull()
                                            ? null
                                            : record.get("autorAvatar").asString());
                            p.setTotalLikes(record.get("totalLikes").asLong());
                            p.setLikedByMe(record.get("likedByMe").asBoolean());
                            p.setTotalDislikes(record.get("totalDislikes").asLong());
                            p.setDislikedByMe(record.get("dislikedByMe").asBoolean());
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

    // --- 3. Seguidos en Común entre Dos Perfiles ---
    @Override
    public List<Usuario> obtenerSeguidosEnComun(String userA, String userB) {
        // u1 -> comun <- u2, es decir las personas que AMBOS usuarios siguen.
        //
        // El Cypher del ticket original era (u1)<-[:SIGUE]-(comun)-[:SIGUE]->(u2), que
        // invierte las flechas y devuelve a QUIENES SIGUEN a los dos: los seguidores
        // comunes, no los seguidos comunes. Con la semilla de docker/neo4j-seed.cql eso
        // hace que el cURL del propio ticket devuelva [] en vez de beatriz y paulo.
        // La flecha va hacia el nodo comun porque el criterio de aceptación dice
        // "siguen conjuntamente a beatriz y paulo".
        String cypher =
                """
            MATCH (u1:Usuario {id: $userA})-[:SIGUE]->(comun:Usuario)<-[:SIGUE]-(u2:Usuario {id: $userB})
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
                            // Guarda de null, con el mismo criterio que el avatar de la
                            // línea siguiente. No es una exquisitez: guardarUsuario hace
                            // SET u.nombre = $nombre, y en Neo4j asignar null a una
                            // propiedad la elimina, así que un usuario sin nombre llega
                            // aquí como NullValue. El driver no falla al coercionar --
                            // NullValue.asString() devuelve el texto literal "null" --
                            // así que sin esta guarda la API responde 200 con un nombre
                            // inventado, que es peor que un 500 porque no se nota.
                            u.setNombre(
                                    record.get("nombre").isNull()
                                            ? null
                                            : record.get("nombre").asString());
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

    // --- Usuarios seguidos por un perfil (lectura directa de [:SIGUE]) ---
    @Override
    public List<Usuario> obtenerSeguidos(String userId) {
        String cypher =
                """
            MATCH (u:Usuario {id: $userId})-[:SIGUE]->(s:Usuario)
            RETURN s.id AS id, s.username AS username, s.nombre AS nombre, s.avatarUrl AS avatarUrl
            """;

        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
                        var result = tx.run(cypher, Values.parameters("userId", userId));
                        List<Usuario> usuarios = new ArrayList<>();
                        while (result.hasNext()) {
                            Record record = result.next();
                            Usuario u = new Usuario();
                            u.setId(record.get("id").asString());
                            u.setUsername(record.get("username").asString());
                            u.setNombre(record.get("nombre").asString());
                            u.setAvatarUrl(
                                    record.get("avatarUrl").isNull()
                                            ? null
                                            : record.get("avatarUrl").asString());
                            usuarios.add(u);
                        }
                        return usuarios;
                    });
        }
    }

    /**
     * Nombre de usuario con el que se sustituye un salto sin username.
     *
     * <p>En Neo4j asignar null a una propiedad la elimina, así que un usuario sin nombre llega aquí
     * como {@code NullValue}. Sin el sustituto, {@code NullValue.asString()} devolvería el texto
     * literal {@code "null"} y ese nombre inventado se renderizaría como si fuera real. El
     * identificador viaja en el mismo elemento, así que no se pierde información.
     */
    private static final String USERNAME_POR_DEFECTO = "desconocido";

    // --- 4. Grado de Separación y Camino Más Corto (Shortest Path) ---
    @Override
    public Map<String, Object> obtenerCaminoMasCorto(String origenId, String destinoId) {
        // El Cypher obligatorio del ticket proyecta sólo el username de cada nodo
        // (`[n IN nodes(p) | n.username]`). El design (D4) pide además el identificador de
        // cada salto, para que la interfaz pueda recorrer el camino y no imprimirlo como texto
        // plano, así que la proyección pasa a un mapa por nodo. Lo demás se mantiene literal,
        // porque es el alcance que fija D1: shortestPath, el recorrido dirigido de SIGUE, el
        // tope de 6 grados y la exclusión `origen <> destino`.
        String cypher =
                """
            MATCH p = shortestPath((origen:Usuario {id: $origenId})-[:SIGUE*..6]->(destino:Usuario {id: $destinoId}))
            WHERE origen <> destino
            RETURN [n IN nodes(p) | {id: n.id, username: n.username}] AS rutaConexion,
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
                        // Sin camino dentro de seis grados, el shortestPath no devuelve filas.
                        // Antes se respondía con un mapa vacío, indistinguible de una petición sin
                        // parámetros y de un usuario comparado consigo mismo: tres situaciones
                        // distintas con una sola respuesta posible. La forma vacía explícita deja
                        // "no hay conexión" como resultado y no como fallo (D2).
                        if (!result.hasNext()) {
                            return caminoVacio();
                        }
                        Record record = result.next();
                        Map<String, Object> map = new HashMap<>();
                        map.put("rutaConexion", leerRutaConexion(record.get("rutaConexion")));
                        map.put("saltosTotales", record.get("saltosTotales").asInt());
                        return map;
                    });
        }
    }

    /** Respuesta de "no hay camino dentro del alcance": ruta vacía y cero saltos, no un error. */
    private static Map<String, Object> caminoVacio() {
        Map<String, Object> map = new HashMap<>();
        map.put("rutaConexion", new ArrayList<Map<String, Object>>());
        map.put("saltosTotales", 0);
        return map;
    }

    /**
     * Lee la lista de saltos del camino, conservando el orden que devolvió la base de datos.
     *
     * <p>Un salto sin username no anula el resto de la ruta: el resto de la información es válida y
     * se necesita (D5).
     */
    private static List<Map<String, Object>> leerRutaConexion(Value ruta) {
        List<Map<String, Object>> saltos = new ArrayList<>();
        if (ruta == null || ruta.isNull()) {
            return saltos;
        }
        for (Value salto : ruta.asList(valor -> valor)) {
            Map<String, Object> nodo = new HashMap<>();
            nodo.put("id", textoONulo(salto, "id"));
            nodo.put("username", usernameONulo(salto));
            saltos.add(nodo);
        }
        return saltos;
    }

    /** Texto de una propiedad del salto, o null si el salto no la trae. */
    private static String textoONulo(Value salto, String propiedad) {
        Value valor = salto.get(propiedad);
        return valor == null || valor.isNull() ? null : valor.asString();
    }

    /** Username del salto, con valor por defecto cuando el nodo no lo tiene cargado. */
    private static String usernameONulo(Value salto) {
        Value valor = salto.get("username");
        return valor == null || valor.isNull() ? USERNAME_POR_DEFECTO : valor.asString();
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
            FOREACH (_ IN CASE WHEN $password IS NULL THEN [] ELSE [1] END |
                SET u.password = $password
            )
            """;
        try (var session = driver.session()) {
            session.executeWrite(
                    tx -> {
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
                                                                : "",
                                                // Sin el ternario a "" de antes. Aquí el
                                                // null es una señal de "no cambiar", y
                                                // convertirlo a "" la convertía en "borrar":
                                                // guardar el perfil desde el Navbar manda el
                                                // Usuario sin password porque el tipo del
                                                // frontend no lo tiene, y con este ternario
                                                // cada guardado dejaba al usuario sin poder
                                                // iniciar sesión. El FOREACH de arriba sólo
                                                // escribe la contraseña cuando llega.
                                                "password", u.getPassword()))
                                .consume();
                        return null;
                    });
        }
    }

    @Override
    public Optional<Usuario> obtenerUsuarioPorId(String userId) {
        String cypher =
                """
            MATCH (u:Usuario {id: $userId})
            RETURN u.id AS id,
                   u.username AS username,
                   u.email AS email,
                   u.nombre AS nombre,
                   u.avatarUrl AS avatarUrl,
                   u.pushSubscriptionJson AS pushSubscriptionJson;
            """;
        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
                        var result = tx.run(cypher, Values.parameters("userId", userId));
                        if (result.hasNext()) {
                            Record record = result.next();
                            Usuario u = new Usuario();
                            u.setId(record.get("id").asString());
                            u.setUsername(record.get("username").asString());
                            u.setEmail(
                                    record.get("email").isNull()
                                            ? null
                                            : record.get("email").asString());
                            u.setNombre(
                                    record.get("nombre").isNull()
                                            ? null
                                            : record.get("nombre").asString());
                            u.setAvatarUrl(
                                    record.get("avatarUrl").isNull()
                                            ? null
                                            : record.get("avatarUrl").asString());
                            u.setPushSubscriptionJson(
                                    record.get("pushSubscriptionJson").isNull()
                                            ? null
                                            : record.get("pushSubscriptionJson").asString());
                            return Optional.of(u);
                        }
                        return Optional.empty();
                    });
        }
    }

    @Override
    public Optional<Usuario> buscarUsuarioPorCredenciales(String emailOrUsername) {
        String cypher =
                """
            MATCH (u:Usuario)
            WHERE u.email = $valor OR u.username = $valor
            RETURN u.id AS id,
                   u.username AS username,
                   u.email AS email,
                   u.nombre AS nombre,
                   u.avatarUrl AS avatarUrl,
                   u.pushSubscriptionJson AS pushSubscriptionJson,
                   u.password AS password
            LIMIT 1;
            """;
        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
                        var result = tx.run(cypher, Values.parameters("valor", emailOrUsername));
                        if (result.hasNext()) {
                            Record record = result.next();
                            Usuario u = new Usuario();
                            u.setId(record.get("id").asString());
                            u.setUsername(record.get("username").asString());
                            u.setEmail(
                                    record.get("email").isNull()
                                            ? null
                                            : record.get("email").asString());
                            u.setNombre(
                                    record.get("nombre").isNull()
                                            ? null
                                            : record.get("nombre").asString());
                            u.setAvatarUrl(
                                    record.get("avatarUrl").isNull()
                                            ? null
                                            : record.get("avatarUrl").asString());
                            u.setPushSubscriptionJson(
                                    record.get("pushSubscriptionJson").isNull()
                                            ? null
                                            : record.get("pushSubscriptionJson").asString());
                            u.setPassword(
                                    record.get("password").isNull()
                                            ? null
                                            : record.get("password").asString());
                            return Optional.of(u);
                        }
                        return Optional.empty();
                    });
        }
    }

    @Override
    public List<Usuario> listarUsuarios() {
        String cypher =
                """
            MATCH (u:Usuario)
            RETURN u.id AS id,
                   u.username AS username,
                   u.email AS email,
                   u.nombre AS nombre,
                   u.avatarUrl AS avatarUrl,
                   u.pushSubscriptionJson AS pushSubscriptionJson
            ORDER BY u.nombre ASC;
            """;
        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
                        var result = tx.run(cypher);
                        List<Usuario> list = new ArrayList<>();
                        while (result.hasNext()) {
                            Record record = result.next();
                            Usuario u = new Usuario();
                            u.setId(record.get("id").asString());
                            u.setUsername(record.get("username").asString());
                            u.setEmail(
                                    record.get("email").isNull()
                                            ? null
                                            : record.get("email").asString());
                            u.setNombre(
                                    record.get("nombre").isNull()
                                            ? null
                                            : record.get("nombre").asString());
                            u.setAvatarUrl(
                                    record.get("avatarUrl").isNull()
                                            ? null
                                            : record.get("avatarUrl").asString());
                            u.setPushSubscriptionJson(
                                    record.get("pushSubscriptionJson").isNull()
                                            ? null
                                            : record.get("pushSubscriptionJson").asString());
                            list.add(u);
                        }
                        return list;
                    });
        }
    }

    @Override
    public void actualizarAvatarUsuario(String userId, String avatarUrl) {
        String cypher =
                """
            MATCH (u:Usuario {id: $userId})
            SET u.avatarUrl = $avatarUrl
            """;
        try (var session = driver.session()) {
            session.executeWrite(
                    tx -> {
                        tx.run(
                                        cypher,
                                        Values.parameters(
                                                "userId",
                                                userId,
                                                "avatarUrl",
                                                avatarUrl != null ? avatarUrl : ""))
                                .consume();
                        return null;
                    });
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
                    tx -> {
                        tx.run(
                                        cypher,
                                        Values.parameters(
                                                "seguidorId", seguidorId, "seguidoId", seguidoId))
                                .consume();
                        return null;
                    });
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
                    tx -> {
                        tx.run(
                                        cypher,
                                        Values.parameters(
                                                "seguidorId", seguidorId, "seguidoId", seguidoId))
                                .consume();
                        return null;
                    });
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
            RETURN p.id AS postId
            """;
        try (var session = driver.session()) {
            session.executeWrite(
                    tx -> {
                        var result =
                                tx.run(
                                        cypher,
                                        Values.parameters(
                                                "autorId", autorId,
                                                "postId", postId,
                                                "texto", texto,
                                                "mediaUrl", mediaUrl != null ? mediaUrl : ""));
                        // Si el autor no existe, el MATCH no devuelve filas y el CREATE
                        // se descarta en silencio. Hay que reportarlo para no responder
                        // 201 con un post que nunca se creó.
                        if (!result.hasNext()) {
                            throw new AutorNoEncontradoException(autorId);
                        }
                        return null;
                    });
        }
    }

    /**
     * Registro de like con limpieza del dislike contrario en la misma transacción. Es el Cypher
     * verificado contra Neo4j real, literal y sin interpolar: así lo que corre en producción es
     * exactamente lo que se probó en vivo.
     */
    private static final String CYPHER_REGISTRAR_LIKE =
            """
            MATCH (u:Usuario {id: $userId}), (p:Post {id: $postId})
            MERGE (u)-[r:REACCIONA {tipo: 'LIKE'}]->(p)
            ON CREATE SET r.fecha = timestamp()
            WITH u, p
            OPTIONAL MATCH (u)-[d:REACCIONA {tipo: 'DISLIKE'}]->(p)
            DELETE d
            WITH p
            OPTIONAL MATCH (p)<-[rl:REACCIONA {tipo: 'LIKE'}]-(:Usuario)
            OPTIONAL MATCH (p)<-[rd:REACCIONA {tipo: 'DISLIKE'}]-(:Usuario)
            RETURN count(DISTINCT rl) AS totalLikes, count(DISTINCT rd) AS totalDislikes, count(p) AS encontrados
            """;

    /** Espejo exacto del anterior con los tipos cruzados. */
    private static final String CYPHER_REGISTRAR_DISLIKE =
            """
            MATCH (u:Usuario {id: $userId}), (p:Post {id: $postId})
            MERGE (u)-[r:REACCIONA {tipo: 'DISLIKE'}]->(p)
            ON CREATE SET r.fecha = timestamp()
            WITH u, p
            OPTIONAL MATCH (u)-[d:REACCIONA {tipo: 'LIKE'}]->(p)
            DELETE d
            WITH p
            OPTIONAL MATCH (p)<-[rl:REACCIONA {tipo: 'LIKE'}]-(:Usuario)
            OPTIONAL MATCH (p)<-[rd:REACCIONA {tipo: 'DISLIKE'}]-(:Usuario)
            RETURN count(DISTINCT rl) AS totalLikes, count(DISTINCT rd) AS totalDislikes, count(p) AS encontrados
            """;

    @Override
    public EstadoReaccion registrarLike(String userId, String postId) {
        // Like y dislike son mutuamente excluyentes: el MERGE registra el like y el OPTIONAL
        // MATCH + DELETE borra el dislike contrario del mismo usuario en la misma transacción.
        // El conteo va después de ambas escrituras para que incluya la reacción recién creada.
        return registrarReaccion(userId, postId, CYPHER_REGISTRAR_LIKE);
    }

    @Override
    public EstadoReaccion registrarDislike(String userId, String postId) {
        // Espejo exacto de registrarLike: registra el dislike y borra el like contrario.
        return registrarReaccion(userId, postId, CYPHER_REGISTRAR_DISLIKE);
    }

    /**
     * Registra la reacción con el Cypher indicado, borra la contraria del mismo usuario y devuelve
     * el estado completo. El {@code count(DISTINCT ...)} es obligatorio porque los dos {@code
     * OPTIONAL MATCH} encadenados sobre el mismo {@code p} multiplican filas (3 likes x 2 dislikes
     * daban 6 sin {@code DISTINCT}).
     */
    private EstadoReaccion registrarReaccion(String userId, String postId, String cypher) {
        try (var session = driver.session()) {
            return session.executeWrite(
                    tx -> {
                        var result =
                                tx.run(
                                        cypher,
                                        Values.parameters("userId", userId, "postId", postId));
                        Record fila = result.next();
                        // La ausencia de usuario o publicación NO se detecta con hasNext(): una
                        // agregación sin clave de agrupamiento devuelve UNA fila con cero cuando el
                        // MATCH no produjo filas. El centinela es count(p): vale 0 solo cuando el
                        // MATCH no encontró nada. Sin esto, un post inexistente respondía 200 con
                        // totales en 0 y el cliente pintaba una reacción que nunca existió.
                        if (fila.get("encontrados").asLong() == 0) {
                            throw new PostNoEncontradoException(postId);
                        }
                        return new EstadoReaccion(
                                (int) fila.get("totalLikes").asLong(),
                                (int) fila.get("totalDislikes").asLong());
                    });
        }
    }

    @Override
    public EstadoReaccion retirarLike(String userId, String postId) {
        return retirarReaccion(userId, postId, "LIKE");
    }

    @Override
    public EstadoReaccion retirarDislike(String userId, String postId) {
        return retirarReaccion(userId, postId, "DISLIKE");
    }

    /**
     * Borra la reacción del tipo indicado y devuelve el estado completo con ambos totales. El
     * {@code DELETE} y el conteo corren en la misma transacción. La retirada no toca la reacción
     * contraria: como el registro ya es excluyente, no hay nada que tocar.
     *
     * <p>A diferencia del registro, aquí el centinela no lanza excepción: retirar lo que no existe
     * (o sobre un post inexistente) es idempotente y responde con el estado en ceros.
     */
    private EstadoReaccion retirarReaccion(String userId, String postId, String tipo) {
        String borrado =
                """
            MATCH (u:Usuario {id: $userId})-[r:REACCIONA {tipo: $tipo}]->(p:Post {id: $postId})
            DELETE r
            """;
        String conteo =
                """
            MATCH (u:Usuario {id: $userId}), (p:Post {id: $postId})
            WITH p
            OPTIONAL MATCH (p)<-[rl:REACCIONA {tipo: 'LIKE'}]-(:Usuario)
            OPTIONAL MATCH (p)<-[rd:REACCIONA {tipo: 'DISLIKE'}]-(:Usuario)
            RETURN count(DISTINCT rl) AS totalLikes, count(DISTINCT rd) AS totalDislikes, count(p) AS encontrados
            """;
        try (var session = driver.session()) {
            return session.executeWrite(
                    tx -> {
                        tx.run(
                                        borrado,
                                        Values.parameters(
                                                "userId", userId, "postId", postId, "tipo", tipo))
                                .consume();
                        var resultado =
                                tx.run(
                                        conteo,
                                        Values.parameters("userId", userId, "postId", postId));
                        // Agregación sin agrupamiento: siempre hay una fila, incluso si el MATCH
                        // no encontró nada (totales en cero). Por eso no hay 404 en la retirada.
                        Record fila = resultado.next();
                        return new EstadoReaccion(
                                (int) fila.get("totalLikes").asLong(),
                                (int) fila.get("totalDislikes").asLong());
                    });
        }
    }

    @Override
    public List<String> obtenerSuscripcionesPushDeSeguidores(String autorId) {
        String cypher =
                """
            MATCH (seguidor:Usuario)-[:SIGUE]->(autor:Usuario {id: $autorId})
            UNWIND coalesce(seguidor.pushSubscriptions, []) AS pushJson
            RETURN pushJson
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

    @Override
    public void eliminarSuscripcionPush(String usuarioId, String pushSubscriptionJson) {
        if (usuarioId == null || pushSubscriptionJson == null || pushSubscriptionJson.isBlank()) {
            return;
        }
        String cypher =
                """
            MATCH (u:Usuario {id: $usuarioId})
            SET u.pushSubscriptions = [sub IN coalesce(u.pushSubscriptions, []) WHERE sub <> $subJson]
            """;
        try (var session = driver.session()) {
            session.executeWrite(
                    tx -> {
                        tx.run(
                                cypher,
                                Values.parameters("usuarioId", usuarioId, "subJson", pushSubscriptionJson))
                                .consume();
                        return null;
                    });
        }
    }

    @Override
    public void guardarSuscripcionPush(String usuarioId, String pushSubscriptionJson) {
        if (usuarioId == null || pushSubscriptionJson == null || pushSubscriptionJson.isBlank()) {
            return;
        }
        String cypher =
                """
            MATCH (u:Usuario {id: $usuarioId})
            WHERE NOT $subJson IN coalesce(u.pushSubscriptions, [])
            SET u.pushSubscriptions = coalesce(u.pushSubscriptions, []) + $subJson
            """;
        try (var session = driver.session()) {
            session.executeWrite(
                    tx -> {
                        tx.run(cypher, Values.parameters("usuarioId", usuarioId, "subJson", pushSubscriptionJson))
                                .consume();
                        return null;
                    });
        }
    }

    @Override
    public void guardarNotificacionInApp(String userId, ec.edu.upse.redsocial.domain.model.NotificacionInApp notificacion) {
        String cypher =
            """
            MATCH (u:Usuario {id: $userId})
            MERGE (n:NotificacionInApp {id: $id})
            ON CREATE SET n.tipo = $tipo, n.titulo = $titulo, n.mensaje = $mensaje, n.leido = $leido, n.fechaCreacion = $fechaCreacion, n.url = $url
            MERGE (u)-[:RECIBE]->(n)
            """;
        try (var session = driver.session()) {
            session.executeWrite(tx -> {
                tx.run(cypher, Values.parameters(
                    "userId", userId,
                    "id", notificacion.getId(),
                    "tipo", notificacion.getTipo(),
                    "titulo", notificacion.getTitulo(),
                    "mensaje", notificacion.getMensaje(),
                    "leido", notificacion.isLeido(),
                    "fechaCreacion", notificacion.getFechaCreacion(),
                    "url", notificacion.getUrl()
                )).consume();
                return null;
            });
        }
    }

    @Override
    public List<ec.edu.upse.redsocial.domain.model.NotificacionInApp> obtenerNotificacionesInApp(String userId) {
        String cypher = "MATCH (u:Usuario {id: $userId})-[:RECIBE]->(n:NotificacionInApp) RETURN n ORDER BY n.fechaCreacion DESC LIMIT 20";
        try (var session = driver.session()) {
            return session.executeRead(tx -> {
                var res = tx.run(cypher, Values.parameters("userId", userId));
                List<ec.edu.upse.redsocial.domain.model.NotificacionInApp> list = new ArrayList<>();
                while (res.hasNext()) {
                    var record = res.next();
                    var nNode = record.get("n").asNode();
                    var noti = new ec.edu.upse.redsocial.domain.model.NotificacionInApp();
                    noti.setId(nNode.get("id").asString());
                    noti.setTipo(nNode.get("tipo").isNull() ? null : nNode.get("tipo").asString());
                    noti.setTitulo(nNode.get("titulo").isNull() ? null : nNode.get("titulo").asString());
                    noti.setMensaje(nNode.get("mensaje").isNull() ? null : nNode.get("mensaje").asString());
                    noti.setLeido(nNode.get("leido").asBoolean(false));
                    noti.setFechaCreacion(nNode.get("fechaCreacion").asLong(0L));
                    noti.setUrl(nNode.get("url").isNull() ? null : nNode.get("url").asString());
                    list.add(noti);
                }
                return list;
            });
        }
    }

    @Override
    public long obtenerConteoNoLeidas(String userId) {
        String cypher = "MATCH (u:Usuario {id: $userId})-[:RECIBE]->(n:NotificacionInApp) WHERE n.leido = false RETURN count(n) AS conteo";
        try (var session = driver.session()) {
            return session.executeRead(tx -> {
                var res = tx.run(cypher, Values.parameters("userId", userId));
                if (res.hasNext()) {
                    return res.next().get("conteo").asLong();
                }
                return 0L;
            });
        }
    }

    @Override
    public void marcarComoLeida(String userId, String notificacionId) {
        String cypher = "MATCH (u:Usuario {id: $userId})-[:RECIBE]->(n:NotificacionInApp {id: $notificacionId}) SET n.leido = true";
        try (var session = driver.session()) {
            session.executeWrite(tx -> {
                tx.run(cypher, Values.parameters("userId", userId, "notificacionId", notificacionId)).consume();
                return null;
            });
        }
    }

    @Override
    public List<String> obtenerSeguidoresId(String autorId) {
        String cypher = "MATCH (s:Usuario)-[:SIGUE]->(a:Usuario {id: $autorId}) RETURN s.id AS id";
        try (var session = driver.session()) {
            return session.executeRead(tx -> {
                var res = tx.run(cypher, Values.parameters("autorId", autorId));
                List<String> list = new ArrayList<>();
                while (res.hasNext()) {
                    list.add(res.next().get("id").asString());
                }
                return list;
            });
        }
    }
}
