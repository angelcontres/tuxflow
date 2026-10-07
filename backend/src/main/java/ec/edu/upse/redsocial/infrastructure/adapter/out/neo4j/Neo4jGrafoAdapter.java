package ec.edu.upse.redsocial.infrastructure.adapter.out.neo4j;

import ec.edu.upse.redsocial.domain.exception.AutorNoEncontradoException;
import ec.edu.upse.redsocial.domain.exception.ParticipanteNoEncontradoException;
import ec.edu.upse.redsocial.domain.exception.PostNoEncontradoException;
import ec.edu.upse.redsocial.domain.model.EstadoReaccion;
import ec.edu.upse.redsocial.domain.model.MensajeChat;
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
                            // Guarda de null, con el mismo criterio y el mismo motivo que en
                            // obtenerSeguidosEnComun: guardarUsuario hace SET u.nombre = $nombre, y
                            // en
                            // Neo4j asignar null a una propiedad la elimina, así que el nodo llega
                            // como NullValue. NullValue.asString() no lanza, devuelve el texto
                            // literal
                            // "null", y ese nombre inventado se renderizaría como si fuera real.
                            // US-09
                            // corrigió sólo la copia de obtenerSeguidosEnComun y dejó estas dos: el
                            // perfil ajeno muestra nombres, así que el defecto pasó a ser visible.
                            s.setNombre(
                                    record.get("nombre").isNull()
                                            ? null
                                            : record.get("nombre").asString());
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
                            // Mapeo compartido con obtenerSeguidores: las dos consultas devuelven
                            // las
                            // mismas cuatro propiedades, y el nombre necesita guarda de null en las
                            // dos.
                            usuarios.add(mapearUsuarioDeRelacion(record));
                        }
                        return usuarios;
                    });
        }
    }

    // --- Seguidores de un perfil (la misma arista de [:SIGUE], leída al revés) ---
    @Override
    public List<Usuario> obtenerSeguidores(String userId) {
        // La flecha entra por el usuario que se está mirando: (s)-[:SIGUE]->(u) son las personas
        // que lo siguen. Invertirla devolvería a quién sigue, que es obtenerSeguidos, y con la
        // semilla del proyecto las dos consultas devuelven conjuntos distintos (elena-vega sigue a
        // carlos-patino, así que carlos tiene una seguidora y no tiene a nadie que él siga de
        // ella).
        String cypher =
                """
            MATCH (s:Usuario)-[:SIGUE]->(u:Usuario {id: $userId})
            RETURN s.id AS id, s.username AS username, s.nombre AS nombre, s.avatarUrl AS avatarUrl
            ORDER BY s.username ASC
            LIMIT $limite
            """;

        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
                        var result =
                                tx.run(
                                        cypher,
                                        Values.parameters(
                                                "userId", userId,
                                                "limite", LIMITE_SEGUIDORES_POR_PERFIL));
                        List<Usuario> usuarios = new ArrayList<>();
                        while (result.hasNext()) {
                            Record record = result.next();
                            usuarios.add(mapearUsuarioDeRelacion(record));
                        }
                        return usuarios;
                    });
        }
    }

    /**
     * Tope de seguridad de los seguidores que devuelve un perfil.
     *
     * <p>El caso que justifica el tope es distinto al de las publicaciones: la comunidad es de una
     * universidad, así que una persona con más de mil seguidores ya es una persona pública. Sin
     * tope, esa cuenta convierte el perfil en una respuesta de megabytes.
     */
    static final long LIMITE_SEGUIDORES_POR_PERFIL = 500;

    /**
     * Mapea una fila de seguido o de seguidor al modelo de dominio.
     *
     * <p>El `nombre` lleva guarda de null porque en Neo4j asignar null a una propiedad la elimina:
     * un usuario guardado sin nombre llega aquí como {@code NullValue}, y {@code
     * NullValue.asString()} no lanza -- devuelve el texto literal {@code "null"} -- así que sin la
     * guarda la API respondería 200 con un nombre inventado, que es peor que un 500 porque no se
     * nota.
     *
     * <p>El identificador es la única propiedad garantizada: es la clave del {@code MERGE} de
     * {@link #guardarUsuario}, así que siempre está.
     */
    private static Usuario mapearUsuarioDeRelacion(Record record) {
        Usuario u = new Usuario();
        u.setId(record.get("id").asString());
        u.setUsername(record.get("username").asString());
        u.setNombre(record.get("nombre").isNull() ? null : record.get("nombre").asString());
        u.setAvatarUrl(
                record.get("avatarUrl").isNull() ? null : record.get("avatarUrl").asString());
        return u;
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

    /**
     * Tope de seguridad de las publicaciones que devuelve un perfil.
     *
     * <p>No es una política de producto: es el punto en el que un perfil deja de ser razonable. Con
     * treinta mil publicaciones la respuesta sin tope no cabe cómodamente en memoria y el servidor
     * se degrada por una pantalla. Está por encima de lo que publica cualquier cuenta real de esta
     * comunidad, así que en la práctica no se ve, y si algún día se ve la respuesta correcta es
     * paginar, no subir el número.
     */
    static final long LIMITE_PUBLICACIONES_POR_PERFIL = 200;

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
        // El umbral de siete días está en la forma que funciona, y la forma obvia no funciona.
        //
        // `p.fechaCreacion` es un entero (epochMillis), así que hay que compararlo contra un
        // entero.
        // La comparación original era contra `datetime()`, que es una fecha con hora, y por eso la
        // condición era siempre falsa y el endpoint no devolvía nada.
        //
        // Corregir sólo eso NO alcanza, y este es el motivo de que el arreglo sea menos obvio de lo
        // que parece. `duration('P7D').milliseconds` vale **cero**: Neo4j separa la duración en
        // meses/días y segundos/nanos, y `.milliseconds` sólo lee la parte sub-día. Los siete días
        // están en `.days`, así que la conversión correcta multiplica por los milisegundos de un
        // día. Medido contra Neo4j 5.20:
        //
        //     duration('P7D').milliseconds   ->  0             resta nada
        //     duration('P7D').days           ->  7             el dato real
        //
        // Con `.milliseconds` el síntoma es idéntico al original: sigue devolviendo vacío, y lo
        // peor es que el Cypher parece correcto al leerlo.
        //
        // El ranking NO es el de la Cypher 5 obligatoria del ticket, que ordena por total de
        // reacciones: la decisión de producto (TUX-62) es la **puntuación neta**, likes menos
        // dislikes, para que un post polémico no encabece la lista por volumen solo. Se conserva
        // el esqueleto de la consulta obligatoria —mismo MATCH de 1 a 2 saltos, misma ventana—
        // y `totalReacciones` viaja en el RETURN para el criterio de aceptación. El límite baja
        // de 10 a 5 (decisión D6): la tarjeta de la barra lateral pinta un top 5.
        //
        // Dos salvaguardas sobre los datos:
        //   * `WITH DISTINCT p, autor, reactor, r.tipo` es lo que impide que la multiplicidad de
        //     caminos del `*1..2` duplique los totales: sin ese DISTINCT, un autor alcanzable por
        //     dos rutas contaría cada reacción dos veces, y el error crecería justo con la
        //     conectividad del autor.
        //   * `autor <> u` excluye al usuario de su propia ventana. El recorrido arranca en el
        //     usuario, así que cualquier ciclo lo vuelve alcanzable de sí mismo y sus propias
        //     reacciones inflarían su propio ranking.
        String cypher =
                """
            MATCH (u:Usuario {id: $userId})-[:SIGUE*1..2]->(autor:Usuario)-[:PUBLICA]->(p:Post)
            WHERE autor <> u
              AND p.fechaCreacion IS NOT NULL
              AND p.fechaCreacion >= datetime().epochMillis - duration('P7D').days * 86400000
            MATCH (reactor:Usuario)-[r:REACCIONA]->(p)
            WITH DISTINCT p, autor, reactor, r.tipo AS tipo
            WITH p, autor,
                 sum(CASE WHEN tipo = 'LIKE' THEN 1 ELSE 0 END) AS likes,
                 sum(CASE WHEN tipo = 'DISLIKE' THEN 1 ELSE 0 END) AS dislikes
            WITH p, autor, likes, dislikes,
                 likes - dislikes AS puntuacionNeta,
                 likes + dislikes AS totalReacciones
            RETURN p.id AS id,
                   p.texto AS texto,
                   autor.username AS autor,
                   likes,
                   dislikes,
                   totalReacciones,
                   puntuacionNeta
            ORDER BY puntuacionNeta DESC, totalReacciones DESC
            LIMIT 5;
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
                            item.put("likes", record.get("likes").asLong());
                            item.put("dislikes", record.get("dislikes").asLong());
                            item.put("totalReacciones", record.get("totalReacciones").asLong());
                            item.put("puntuacionNeta", record.get("puntuacionNeta").asLong());
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

    @Override
    public List<Post> obtenerPostsDeUsuario(String userId, String viewerId) {
        // --- Por qué esta consulta se parece a obtenerFeedCronologico y no al revés ---
        //
        // `fechaCreacion` se escribe como `datetime().epochMillis`, o sea un entero en
        // milisegundos, y eso es también lo que trae la semilla. Ordenar por un entero da el orden
        // cronológico correcto, así que `ORDER BY p.fechaCreacion DESC` se queda como está y la
        // lectura es `.asLong()`. El ROADMAP cerró esta decisión ("comparar contra su equivalente
        // numérico, no migrar el campo a fecha con hora desde dentro de la historia").
        //
        // El WHERE descarta las publicaciones sin fecha: no pueden ordenarse, y meterlas detrás
        // con un `coalesce` exige inventarles una posición.
        //
        // Los dos OPTIONAL MATCH de reacción, uno por tipo, son obligatorios desde que US-06 hizo
        // que like y dislike sean excluyentes. Con un solo `[:REACCIONA]` sin filtrar, una
        // publicación con diez dislikes reportaría diez likes, y el perfil respondería con la
        // reacción equivocada. Es la misma forma que usa el feed, a propósito: las dos consultas
        // devuelven el mismo tipo `Post`, así que tienen que projectar los mismos campos.
        //
        // `count(DISTINCT ...)` y no `count(...)`: hay dos OPTIONAL MATCH seguidos, así que el
        // producto cartesiano está presente y contar filas multiplicaría los totales.
        //
        // El visor va en un OPTIONAL MATCH y no en un WHERE: si fuera un WHERE, la consulta no
        // devolvería filas sin visor y el cURL del ticket, que no lo manda, respondería siempre
        // vacío. Con `visor` null, `EXISTS((visor)-[...]->(p))` es false, que es la respuesta
        // honesta para "no se está mirando desde nadie".
        //
        // El LIMIT es un tope de seguridad, no una política de producto. Está por encima de lo que
        // publica cualquier cuenta real de esta comunidad, así que en la práctica no se ve.
        String cypher =
                """
            MATCH (autor:Usuario {id: $userId})-[:PUBLICA]->(p:Post)
            WHERE p.fechaCreacion IS NOT NULL
            OPTIONAL MATCH (reactorLike:Usuario)-[:REACCIONA {tipo: 'LIKE'}]->(p)
            OPTIONAL MATCH (reactorDislike:Usuario)-[:REACCIONA {tipo: 'DISLIKE'}]->(p)
            OPTIONAL MATCH (visor:Usuario {id: $viewerId})
            RETURN p.id AS id,
                   p.texto AS texto,
                   p.mediaUrl AS mediaUrl,
                   p.fechaCreacion AS fecha,
                   autor.id AS autorId,
                   autor.username AS autorUsername,
                   autor.avatarUrl AS autorAvatar,
                   count(DISTINCT reactorLike) AS totalLikes,
                   count(DISTINCT reactorDislike) AS totalDislikes,
                   EXISTS((visor)-[:REACCIONA {tipo: 'LIKE'}]->(p)) AS likedByMe,
                   EXISTS((visor)-[:REACCIONA {tipo: 'DISLIKE'}]->(p)) AS dislikedByMe
            ORDER BY p.fechaCreacion DESC
            LIMIT $limite
            """;

        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
                        var result =
                                tx.run(
                                        cypher,
                                        Values.parameters(
                                                "userId",
                                                userId,
                                                "viewerId",
                                                viewerId == null || viewerId.isBlank()
                                                        ? null
                                                        : viewerId,
                                                "limite",
                                                LIMITE_PUBLICACIONES_POR_PERFIL));
                        List<Post> posts = new ArrayList<>();
                        while (result.hasNext()) {
                            posts.add(mapearPostDeAutor(result.next()));
                        }
                        return posts;
                    });
        }
    }

    private static Post mapearPostDeAutor(Record record) {
        Post p = new Post();
        p.setId(record.get("id").asString());
        p.setTexto(record.get("texto").asString());
        p.setMediaUrl(record.get("mediaUrl").isNull() ? null : record.get("mediaUrl").asString());
        p.setFechaCreacion(record.get("fecha").asLong());
        p.setAutorId(record.get("autorId").asString());
        p.setAutorUsername(record.get("autorUsername").asString());
        p.setAutorAvatar(
                record.get("autorAvatar").isNull() ? null : record.get("autorAvatar").asString());
        p.setTotalLikes(record.get("totalLikes").asLong());
        p.setTotalDislikes(record.get("totalDislikes").asLong());
        p.setLikedByMe(record.get("likedByMe").asBoolean());
        p.setDislikedByMe(record.get("dislikedByMe").asBoolean());
        return p;
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
                                        Values.parameters(
                                                "usuarioId",
                                                usuarioId,
                                                "subJson",
                                                pushSubscriptionJson))
                                .consume();
                        return null;
                    });
        }
    }

    // --- Chat 1 a 1: nodo :MensajeChat enlazado a emisor y destinatario (US-07) ---

    /**
     * Conserva el mensaje y lo enlaza a las dos personas que lo escribieron.
     *
     * <p>Las dos relaciones son explícitas y de roles distintos: {@code ENVIA} sale del emisor y
     * {@code DIRIGIDO_A} llega al destinatario. Podría haberse guardado un par de propiedades
     * {@code emisorId} y {@code destinatarioId} en el nodo y no haber creado ninguna arista, pero
     * el grafo del proyecto se recorre con relaciones ({@code SIGUE}, {@code PUBLICA}, {@code
     * REACCIONA}) y la estrategia declarada es index-free adjacency. Con propiedades sueltas,
     * reconstruir una conversación obligaría a escanear todos los mensajes del sistema.
     *
     * <p>La marca de tiempo la fija el servidor como parámetro, no el reloj del navegador: el
     * cliente envía la hora que tiene, y esa hora es la de su máquina.
     */
    @Override
    public void guardarMensajeChat(MensajeChat mensaje) {
        String cypher =
                """
            MATCH (emisor:Usuario {id: $emisorId}), (destinatario:Usuario {id: $destinatarioId})
            CREATE (m:MensajeChat {
                id: $id,
                contenido: $contenido,
                fechaEnvio: $fechaEnvio
            })
            CREATE (emisor)-[:ENVIA]->(m)
            CREATE (m)-[:DIRIGIDO_A]->(destinatario)
            RETURN m.id AS id
            """;
        try (var session = driver.session()) {
            session.executeWrite(
                    tx -> {
<<<<<<< HEAD
                        var resultado =
                                tx.run(
                                        cypher,
                                        Values.parameters(
                                                "id",
                                                mensaje.getId(),
                                                "emisorId",
                                                mensaje.getEmisorId(),
                                                "destinatarioId",
                                                mensaje.getDestinatarioId(),
                                                "contenido",
                                                mensaje.getContenido(),
                                                "fechaEnvio",
                                                mensaje.getTimestamp()));
                        // Si alguno de los dos usuarios no existe, el MATCH no produce filas y el
                        // CREATE se descarta en silencio. Sin este chequeo se respondería
                        // "entregado" sobre un mensaje que nunca llegó a existir en el grafo.
                        //
                        // Se reporta el destinatario y no el emisor porque es el que puede estar
                        // mal:
                        // el emisor está conectado, así que existe, y un motivo que lo señale a él
                        // mandaría al cliente a buscar un error donde no lo hay.
                        if (!resultado.hasNext()) {
                            throw new ParticipanteNoEncontradoException(
                                    mensaje.getDestinatarioId());
                        }
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
                        tx.run(
                                        cypher,
                                        Values.parameters(
                                                "usuarioId",
                                                usuarioId,
                                                "subJson",
                                                pushSubscriptionJson))
                                .consume();
                        return null;
                    });
        }
    }

    /**
     * Historial de una pareja en ambos sentidos.
     *
     * <p>La pareja se filtra por las dos aristas a la vez y no por un par ordenado. Con {@code
     * (emisor:Usuario {id: $usuarioA})}-[:ENVIA]->(m) y {@code (m)-[:DIRIGIDO_A]->(destinatario)}
     * filtrando además {@code destinatario.id = $usuarioB}, la conversación saldría completa para
     * uno de los dos participantes y vacía para el otro. No es un error visible: la consulta
     * responde bien y el usuario ve una conversación sin burbujas.
     *
     * <p>Se reparten emisor y destinatario entre las variables para que la consulta no dependa de
     * qué participante se nombró primero. El nombre de la variable no significa nada para Neo4j; lo
     * que importa es que las dos aristas se comprueben juntas.
     *
     * <p>El orden va en la consulta y no en Java, siguiendo la convención del resto del archivo: en
     * el momento de leer el resultado, los mensajes ya vienen en orden cronológico.
     */
    @Override
    public List<MensajeChat> obtenerHistorialChat(String usuarioA, String usuarioB) {
        String cypher =
                """
            MATCH (parte:Usuario)-[:ENVIA]->(m:MensajeChat)-[:DIRIGIDO_A]->(otra:Usuario)
            WHERE (parte.id = $usuarioA AND otra.id = $usuarioB)
               OR (parte.id = $usuarioB AND otra.id = $usuarioA)
            RETURN m.id AS id,
                   m.contenido AS contenido,
                   m.fechaEnvio AS fecha,
                   parte.id AS emisorId,
                   otra.id AS destinatarioId
            ORDER BY m.fechaEnvio ASC
            """;
        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
                        var resultado =
                                tx.run(
                                        cypher,
                                        Values.parameters(
                                                "usuarioA", usuarioA, "usuarioB", usuarioB));
                        List<MensajeChat> mensajes = new ArrayList<>();
                        while (resultado.hasNext()) {
                            Record fila = resultado.next();
                            MensajeChat mensaje = new MensajeChat();
                            mensaje.setId(fila.get("id").asString());
                            mensaje.setContenido(fila.get("contenido").asString());
                            mensaje.setTimestamp(fila.get("fecha").asLong());
                            mensaje.setEmisorId(fila.get("emisorId").asString());
                            mensaje.setDestinatarioId(fila.get("destinatarioId").asString());
                            mensajes.add(mensaje);
                        }
                        return mensajes;

    @Override
    public void guardarNotificacionInApp(
            String userId, ec.edu.upse.redsocial.domain.model.NotificacionInApp notificacion) {
        String cypher =
                """
            MATCH (u:Usuario {id: $userId})
            MERGE (n:NotificacionInApp {id: $id})
            ON CREATE SET n.tipo = $tipo, n.titulo = $titulo, n.mensaje = $mensaje, n.leido = $leido, n.fechaCreacion = $fechaCreacion, n.url = $url
            MERGE (u)-[:RECIBE]->(n)
            """;
        try (var session = driver.session()) {
            session.executeWrite(
                    tx -> {
                        tx.run(
                                        cypher,
                                        Values.parameters(
                                                "userId", userId,
                                                "id", notificacion.getId(),
                                                "tipo", notificacion.getTipo(),
                                                "titulo", notificacion.getTitulo(),
                                                "mensaje", notificacion.getMensaje(),
                                                "leido", notificacion.isLeido(),
                                                "fechaCreacion", notificacion.getFechaCreacion(),
                                                "url", notificacion.getUrl()))
                                .consume();
                        return null;
                    });
        }
    }

    @Override
    public List<ec.edu.upse.redsocial.domain.model.NotificacionInApp> obtenerNotificacionesInApp(
            String userId) {
        String cypher =
                "MATCH (u:Usuario {id: $userId})-[:RECIBE]->(n:NotificacionInApp) RETURN n ORDER BY n.fechaCreacion DESC LIMIT 20";
        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
                        var res = tx.run(cypher, Values.parameters("userId", userId));
                        List<ec.edu.upse.redsocial.domain.model.NotificacionInApp> list =
                                new ArrayList<>();
                        while (res.hasNext()) {
                            var record = res.next();
                            var nNode = record.get("n").asNode();
                            var noti = new ec.edu.upse.redsocial.domain.model.NotificacionInApp();
                            noti.setId(nNode.get("id").asString());
                            noti.setTipo(
                                    nNode.get("tipo").isNull()
                                            ? null
                                            : nNode.get("tipo").asString());
                            noti.setTitulo(
                                    nNode.get("titulo").isNull()
                                            ? null
                                            : nNode.get("titulo").asString());
                            noti.setMensaje(
                                    nNode.get("mensaje").isNull()
                                            ? null
                                            : nNode.get("mensaje").asString());
                            noti.setLeido(nNode.get("leido").asBoolean(false));
                            noti.setFechaCreacion(nNode.get("fechaCreacion").asLong(0L));
                            noti.setUrl(
                                    nNode.get("url").isNull() ? null : nNode.get("url").asString());
                            list.add(noti);
                        }
                        return list;
                    });
        }
    }

    @Override
    public long obtenerConteoNoLeidas(String userId) {
        String cypher =
                "MATCH (u:Usuario {id: $userId})-[:RECIBE]->(n:NotificacionInApp) WHERE n.leido = false RETURN count(n) AS conteo";
        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
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
        String cypher =
                "MATCH (u:Usuario {id: $userId})-[:RECIBE]->(n:NotificacionInApp {id: $notificacionId}) SET n.leido = true";
        try (var session = driver.session()) {
            session.executeWrite(
                    tx -> {
                        tx.run(
                                        cypher,
                                        Values.parameters(
                                                "userId", userId, "notificacionId", notificacionId))
                                .consume();
                        return null;
                    });
        }
    }

    @Override
    public List<String> obtenerSeguidoresId(String autorId) {
        String cypher = "MATCH (s:Usuario)-[:SIGUE]->(a:Usuario {id: $autorId}) RETURN s.id AS id";
        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
                        var res = tx.run(cypher, Values.parameters("autorId", autorId));
                        List<String> list = new ArrayList<>();
                        while (res.hasNext()) {
                            list.add(res.next().get("id").asString());
                        }
                        return list;
                    });
        }
    }

    @Override
    public String obtenerAutorDePost(String postId) {
        String cypher = "MATCH (u:Usuario)-[:PUBLICA]->(p:Post {id: $postId}) RETURN u.id AS id";
        try (var session = driver.session()) {
            return session.executeRead(
                    tx -> {
                        var res = tx.run(cypher, Values.parameters("postId", postId));
                        if (res.hasNext()) {
                            return res.next().get("id").asString();
                        }
                        return null;
                    });
        }
    }
}
