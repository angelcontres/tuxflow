package ec.edu.upse.redsocial.infrastructure.adapter.out.neo4j;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ec.edu.upse.redsocial.domain.model.Post;
import ec.edu.upse.redsocial.domain.model.Usuario;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.neo4j.driver.Driver;
import org.neo4j.driver.GraphDatabase;
import org.neo4j.driver.Session;
import org.neo4j.driver.Values;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.Neo4jContainer;

/**
 * Las dos consultas nuevas del perfil ajeno contra un Neo4j de verdad.
 *
 * <p>Las pruebas unitarias del adaptador stubean el driver, así que comprueban el mapeo y el texto
 * de la consulta, pero no que la consulta sea válida: un Cypher con un error de sintaxis o una
 * agregación mal formada se ve igual de bien en un mock. Aquí se levanta el grafo con la misma
 * forma que usa {@code docker/neo4j-seed.cql} y se ejecuta de verdad.
 *
 * <p>Requiere Docker. Si no está disponible, cada prueba se salta con {@code @BeforeEach}/{@code
 * requireGrafo}, en vez de romper el build en una máquina sin Docker.
 *
 * <p>El contenedor se levanta y se apaga a mano en lugar de con la extensión
 * {@code @Testcontainers}: la extensión de Testcontainers para JUnit 5 no está en el repositorio
 * local de esta máquina, y el build corre sin acceso a Maven Central. Con {@code @BeforeAll} y
 * {@code @AfterAll} el resultado es el mismo y no hace falta una dependencia que no se puede
 * resolver.
 */
class Neo4jGrafoAdapterPerfilAjenoIT {

    private static Neo4jContainer<?> neo4j;
    private static Driver driver;
    private static Neo4jGrafoAdapter adapter;

    /** Si no hay Docker, ninguna prueba de esta clase tiene sentido. */
    private static boolean dockerDisponible() {
        try {
            return DockerClientFactory.instance().isDockerAvailable();
        } catch (RuntimeException e) {
            // Sin Docker el cliente lanza al inicializarse, y eso no es un fallo del codigo bajo
            // prueba: es una maquina que no puede correr esta capa.
            return false;
        }
    }

    /**
     * Corta la prueba si no hay grafo levantado.
     *
     * <p>Va al principio de cada prueba y no solo en {@code @BeforeAll}: si el contenedor no
     * arranco, las pruebas quedan marcadas como saltadas y se ve en el reporte, en vez de fallar
     * con una NullPointerException que parece un defecto del codigo.
     */
    @BeforeEach
    void exigirGrafo() {
        Assumptions.assumeTrue(dockerDisponible(), "Requiere Docker para levantar un Neo4j");
        Assumptions.assumeTrue(driver != null, "El contenedor de Neo4j no llego a levantarse");
    }

    /**
     * Grafo minimo con las dos aristas que las consultas leen.
     *
     * <p>Se arma con la forma exacta de la semilla y no con una mas comoda a proposito: {@code
     * Post} lleva {@code fechaCreacion} como entero, que es la representacion cuya decision
     * documenta el ROADMAP, y hay un post sin fecha, que es el caso que decide el {@code WHERE}.
     */
    @BeforeAll
    static void prepararGrafo() {
        if (!dockerDisponible()) {
            return;
        }
        neo4j = new Neo4jContainer<>("neo4j:5.20");
        neo4j.start();
        driver = GraphDatabase.driver(neo4j.getBoltUrl());
        adapter = new Neo4jGrafoAdapter();
        adapter.driver = driver;

        try (Session session = driver.session()) {
            session.executeWrite(
                    tx ->
                            tx.run(
                                            """
                            CREATE (carlos:Usuario {id: 'carlos-patino', username: 'carlos', nombre: 'Carlos Patiño'})
                            CREATE (beatriz:Usuario {id: 'beatriz-silva', username: 'beatriz', nombre: 'Beatriz Silva'})
                            CREATE (paulo:Usuario {id: 'paulo-orrala', username: 'paulo'})
                            CREATE (carlos)-[:SIGUE]->(beatriz)
                            CREATE (carlos)-[:SIGUE]->(paulo)
                            CREATE (beatriz)-[:SIGUE]->(carlos)
                            CREATE (b1:Post {id: 'post-b1', texto: '¡Bienvenidos! Conexión lista con acentos: añoñéz 🚀', mediaUrl: 'https://cdn/b1.png', fechaCreacion: 1727260000000})
                            CREATE (b2:Post {id: 'post-b2', texto: 'Publicación más nueva', mediaUrl: '', fechaCreacion: 1727270000000})
                            CREATE (sinFecha:Post {id: 'post-sin-fecha', texto: 'Publicación sin fecha', mediaUrl: ''})
                            CREATE (beatriz)-[:PUBLICA]->(b1)
                            CREATE (beatriz)-[:PUBLICA]->(b2)
                            CREATE (beatriz)-[:PUBLICA]->(sinFecha)
                            CREATE (paulo)-[:PUBLICA]->(p1:Post {id: 'post-p1', texto: 'Post de Paulo', mediaUrl: '', fechaCreacion: 1727265000000})
                            """)
                                    .consume());
        }
    }

    @AfterAll
    static void cerrar() {
        if (driver != null) {
            driver.close();
        }
        if (neo4j != null) {
            neo4j.stop();
        }
    }

    /** Ejecuta una escritura de grafo y consume el resultado. */
    private static void escribir(String cypher) {
        try (Session session = driver.session()) {
            session.executeWrite(tx -> tx.run(cypher).consume());
        }
    }

    @Test
    @DisplayName(
            "obtenerPostsDeUsuario devuelve las publicaciones del autor de la más nueva a la más antigua")
    void devuelveLasPublicacionesOrdenadas() {
        List<Post> posts = adapter.obtenerPostsDeUsuario("beatriz-silva", null);

        // La publicacion sin fecha se descarta: no hay forma honesta de ordenarla sin inventarle
        // una posicion, y una lista de publicaciones en un orden que no es el real no sirve.
        assertEquals(2, posts.size());
        assertEquals("post-b2", posts.get(0).getId());
        assertEquals("post-b1", posts.get(1).getId());
        // La fecha llega como numero entero y por eso el orden es cronologico de verdad.
        assertEquals(1727270000000L, posts.get(0).getFechaCreacion());
        assertEquals(1727260000000L, posts.get(1).getFechaCreacion());
        assertEquals("beatriz-silva", posts.get(0).getAutorId());
        assertEquals("beatriz", posts.get(0).getAutorUsername());
    }

    @Test
    @DisplayName("el texto con acentos, eñes y emoji sobrevive al viaje por el grafo")
    void conservaElTextoConAcentos() {
        List<Post> posts = adapter.obtenerPostsDeUsuario("beatriz-silva", null);

        String texto = posts.get(1).getTexto();
        assertTrue(texto.contains("ñ"), "El texto perdio la enye: " + texto);
        assertTrue(texto.contains("ó"), "El texto perdio la tilde: " + texto);
        assertTrue(texto.contains("🚀"), "El texto perdio el emoji: " + texto);
    }

    @Test
    @DisplayName("las publicaciones de otro autor no se mezclan con las de este")
    void noMezclaPublicacionesDeOtrosAutores() {
        List<Post> dePaulo = adapter.obtenerPostsDeUsuario("paulo-orrala", null);

        assertEquals(1, dePaulo.size());
        assertEquals("post-p1", dePaulo.get(0).getId());
    }

    @Test
    @DisplayName("un autor sin publicaciones devuelve la lista vacía y no un error")
    void autorSinPublicacionesDevuelveListaVacia() {
        assertTrue(adapter.obtenerPostsDeUsuario("carlos-patino", null).isEmpty());
    }

    @Test
    @DisplayName("con visor, likedByMe distingue las publicaciones que ya le gustan")
    void calculaLikedByMeConVisor() {
        escribir(
                "MATCH (c:Usuario {id: 'carlos-patino'}), (p:Post {id: 'post-b1'}) "
                        + "MERGE (c)-[:REACCIONA]->(p)");

        List<Post> posts = adapter.obtenerPostsDeUsuario("beatriz-silva", "carlos-patino");

        Post marcada = posts.stream().filter(Post::isLikedByMe).findFirst().orElseThrow();
        assertEquals("post-b1", marcada.getId());
        assertEquals(1, posts.stream().filter(Post::isLikedByMe).count());
        assertEquals(1, marcada.getTotalLikes());

        escribir("MATCH (:Usuario)-[r:REACCIONA]->(:Post) DELETE r");
    }

    @Test
    @DisplayName("sin visor, likedByMe es false en todas y no se rompe la consulta")
    void sinVisorNoRompeLaConsulta() {
        List<Post> posts = adapter.obtenerPostsDeUsuario("beatriz-silva", null);

        assertFalse(posts.stream().anyMatch(Post::isLikedByMe));
    }

    @Test
    @DisplayName("el total de reacciones no se multiplica por el número de reaccores distintos")
    void cuentaReaccionesSinMultiplicar() {
        escribir(
                "MATCH (c:Usuario {id: 'carlos-patino'}), (p:Usuario {id: 'paulo-orrala'}), "
                        + "(b:Post {id: 'post-b1'}) "
                        + "MERGE (c)-[:REACCIONA]->(b) MERGE (p)-[:REACCIONA]->(b)");

        List<Post> posts = adapter.obtenerPostsDeUsuario("beatriz-silva", null);
        Post conDos =
                posts.stream().filter(p -> p.getId().equals("post-b1")).findFirst().orElseThrow();

        // Dos reaccores distintos son dos reacciones. Con `count(reactor)` y dos OPTIONAL MATCH
        // seguidos, el producto cartesiano haria que este numero fuera mayor.
        assertEquals(2, conDos.getTotalLikes());

        escribir("MATCH (:Usuario)-[r:REACCIONA]->(:Post) DELETE r");
    }

    @Test
    @DisplayName("varios reaccores no convierten una publicación en varias filas")
    void noDuplicaPublicacionesConVariosReaccores() {
        escribir(
                "MATCH (c:Usuario {id: 'carlos-patino'}), (b:Post {id: 'post-b1'}) "
                        + "MERGE (c)-[:REACCIONA]->(b)");
        escribir(
                "MATCH (p:Usuario {id: 'paulo-orrala'}), (b:Post {id: 'post-b1'}) "
                        + "MERGE (p)-[:REACCIONA]->(b)");

        List<Post> posts = adapter.obtenerPostsDeUsuario("beatriz-silva", null);

        assertEquals(2, posts.size());
        assertEquals(2, posts.stream().map(Post::getId).distinct().count());

        escribir("MATCH (:Usuario)-[r:REACCIONA]->(:Post) DELETE r");
    }

    @Test
    @DisplayName("obtenerSeguidores devuelve a quien sigue al perfil, y no a quien sigue")
    void devuelveSeguidoresYNoSeguidos() {
        // Beatriz y Carlos se siguen los dos, asi que ahi las dos consultas darian una fila cada
        // una y no se podrian distinguir. El par que las separa es Carlos con Paulo: Carlos sigue
        // a Paulo, pero Paulo no sigue a Carlos.
        List<Usuario> seguidoresDeBeatriz = adapter.obtenerSeguidores("beatriz-silva");
        assertEquals(1, seguidoresDeBeatriz.size());
        assertEquals("carlos-patino", seguidoresDeBeatriz.get(0).getId());

        List<Usuario> seguidoresDePaulo = adapter.obtenerSeguidores("paulo-orrala");
        assertEquals(1, seguidoresDePaulo.size());
        assertEquals("carlos-patino", seguidoresDePaulo.get(0).getId());

        // Y al reves: quien no te sigue de vuelta no aparece en tu lista de seguidos.
        List<Usuario> seguidosDePaulo = adapter.obtenerSeguidos("paulo-orrala");
        assertEquals(1, seguidosDePaulo.size());
        assertEquals("beatriz-silva", seguidosDePaulo.get(0).getId());

        assertEquals(1, adapter.obtenerSeguidos("beatriz-silva").size());
        assertEquals(2, adapter.obtenerSeguidos("carlos-patino").size());
    }

    @Test
    @DisplayName("un usuario sin nombre llega con nombre null, no con el texto \"null\"")
    void usuarioSinNombreLlegaConNull() {
        // Paulo se creo sin la propiedad nombre, igual que un usuario guardado con el campo en
        // null: guardarUsuario hace SET u.nombre = $nombre y en Neo4j asignar null borra.
        assertNull(adapter.obtenerUsuarioPorId("paulo-orrala").orElseThrow().getNombre());

        for (Usuario u : adapter.obtenerSeguidos("carlos-patino")) {
            assertFalse(
                    "null".equals(u.getNombre()), "Llego el texto literal null: " + u.getNombre());
        }
        assertEquals(
                "Carlos Patiño", adapter.obtenerSeguidores("beatriz-silva").get(0).getNombre());
    }

    @Test
    @DisplayName("las consultas no fallan cuando el identificador no existe")
    void identificadorInexistenteDevuelveVacio() {
        assertTrue(adapter.obtenerSeguidores("no-existe").isEmpty());
        assertTrue(adapter.obtenerPostsDeUsuario("no-existe", null).isEmpty());
    }

    @Test
    @DisplayName("las publicaciones se piden con el visor para saber si la reacción es propia")
    void lasPublicacionesSePidenConElVisor() {
        // El cURL del ticket no lleva visor y tiene que seguir funcionando; la vista del perfil si
        // lo manda, y por eso la misma consulta tiene que servir para las dos formas.
        List<Post> sinVisor = adapter.obtenerPostsDeUsuario("beatriz-silva", null);
        List<Post> conVisor = adapter.obtenerPostsDeUsuario("beatriz-silva", "carlos-patino");

        assertEquals(sinVisor.size(), conVisor.size());
        assertEquals(
                sinVisor.stream().map(Post::getId).toList(),
                conVisor.stream().map(Post::getId).toList());
    }

    @Test
    @DisplayName("el driver acepta un parámetro nulo, que es lo que hace válido el visor ausente")
    void elDriverAceptaUnParametroNulo() {
        // `viewerId` viaja como null cuando no hay visor, y el MATCH sobre el no debe romper la
        // consulta. Esta asercion fija esa premisa: si el driver la cambiara, la consulta de
        // publicaciones sin visor dejaria de funcionar.
        try (Session session = driver.session()) {
            boolean nulo =
                    session.run("RETURN $v AS v", Values.parameters("v", (Object) null))
                            .single()
                            .get("v")
                            .isNull();
            assertTrue(nulo);
        }
    }
}
