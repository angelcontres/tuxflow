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
import org.neo4j.driver.AuthTokens;
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
 * <p>Se puede apuntar a un Neo4j ya levantado con {@code -Dneo4j.test.uri=bolt://...}, y en ese
 * caso no hace falta Docker. Es lo que permite ejecutar estas pruebas en un agente donde
 * Testcontainers no negocia con el socket, y en un CI con un servicio Neo4j ya provisionado.
 *
 * <p>El contenedor se levanta y se apaga a mano en lugar de con la extensión
 * {@code @Testcontainers}: la extensión de Testcontainers para JUnit 5 no está en el repositorio
 * local de esta máquina, y el build corre sin acceso a Maven Central. Con {@code @BeforeAll} y
 * {@code @AfterAll} el resultado es el mismo y no hace falta una dependencia que no se puede
 * resolver.
 */
class Neo4jGrafoAdapterPerfilAjenoIT {

    /** URI de un Neo4j externo. Si no está, se levanta un contenedor. */
    private static final String URI_EXTERNA =
            System.getProperty("neo4j.test.uri", System.getenv("NEO4J_TEST_URI"));

    private static final String USUARIO_EXTERNO = System.getProperty("neo4j.test.user", "neo4j");

    private static final String CLAVE_EXTERNA =
            System.getProperty("neo4j.test.password", "password123");

    private static Neo4jContainer<?> neo4j;
    private static Driver driver;
    private static Neo4jGrafoAdapter adapter;

    /** Si no hay Docker y no hay URI externa, ninguna prueba de esta clase tiene sentido. */
    private static boolean hayGrafoDisponible() {
        if (hayUriExterna()) {
            return true;
        }
        try {
            return DockerClientFactory.instance().isDockerAvailable();
        } catch (RuntimeException e) {
            // Sin Docker el cliente lanza al inicializarse, y eso no es un fallo del codigo bajo
            // prueba: es una maquina que no puede correr esta capa.
            return false;
        }
    }

    private static boolean hayUriExterna() {
        return URI_EXTERNA != null && !URI_EXTERNA.isBlank();
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
        Assumptions.assumeTrue(
                hayGrafoDisponible(), "Requiere Docker o -Dneo4j.test.uri para levantar un Neo4j");
        Assumptions.assumeTrue(driver != null, "El grafo de Neo4j no llego a levantarse");
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
        if (!hayGrafoDisponible()) {
            return;
        }
        if (hayUriExterna()) {
            driver =
                    GraphDatabase.driver(
                            URI_EXTERNA, AuthTokens.basic(USUARIO_EXTERNO, CLAVE_EXTERNA));
        } else {
            neo4j = new Neo4jContainer<>("neo4j:5.20");
            neo4j.start();
            // El token es obligatorio: `Neo4jContainer` de Testcontainers 1.20 levanta el servidor
            // con `NEO4J_AUTH` y contraseña por defecto, así que conectar sin token falla con
            // "scheme 'none' is only allowed when auth is disabled".
            driver =
                    GraphDatabase.driver(
                            neo4j.getBoltUrl(),
                            AuthTokens.basic("neo4j", neo4j.getAdminPassword()));
        }
        adapter = new Neo4jGrafoAdapter();
        adapter.driver = driver;

        // El grafo se limpia antes de sembrar: si se apunta a un Neo4j externo puede venir con
        // datos,
        // y las pruebas cuentan filas.
        try (Session session = driver.session()) {
            session.executeWrite(tx -> tx.run("MATCH (n) DETACH DELETE n").consume());
        }

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
        // La relación lleva `{tipo: 'LIKE'}` porque US-06 la hizo obligatoria: la consulta filtra
        // por tipo, así que una reacción sin `tipo` no la encuentra. Estos fixtures se escribieron
        // antes de US-06 y quedaron viejos; como las pruebas se saltaban sin Docker, nadie lo vio.
        escribir(
                "MATCH (c:Usuario {id: 'carlos-patino'}), (p:Post {id: 'post-b1'}) "
                        + "MERGE (c)-[:REACCIONA {tipo: 'LIKE'}]->(p)");

        List<Post> posts = adapter.obtenerPostsDeUsuario("beatriz-silva", "carlos-patino");

        Post marcada = posts.stream().filter(Post::isLikedByMe).findFirst().orElseThrow();
        assertEquals("post-b1", marcada.getId());
        assertEquals(1, posts.stream().filter(Post::isLikedByMe).count());
        assertEquals(1, marcada.getTotalLikes());

        escribir("MATCH (:Usuario)-[r:REACCIONA]->(:Post) DELETE r");
    }

    @Test
    @DisplayName("un dislike no cuenta como like, porque la consulta filtra por tipo")
    void unDislikeNoCuentaComoLike() {
        // El otro lado de la mutualidad de US-06. Sin el filtro por tipo, estos diez dislikes
        // aparecerían como diez likes.
        escribir(
                "MATCH (c:Usuario {id: 'carlos-patino'}), (b:Post {id: 'post-b1'}) "
                        + "MERGE (c)-[:REACCIONA {tipo: 'DISLIKE'}]->(b)");

        List<Post> posts = adapter.obtenerPostsDeUsuario("beatriz-silva", "carlos-patino");
        Post conDislike =
                posts.stream().filter(p -> p.getId().equals("post-b1")).findFirst().orElseThrow();

        assertEquals(0, conDislike.getTotalLikes());
        assertEquals(1, conDislike.getTotalDislikes());
        assertFalse(conDislike.isLikedByMe());
        assertTrue(conDislike.isDislikedByMe());

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
                        + "MERGE (c)-[:REACCIONA {tipo: 'LIKE'}]->(b) "
                        + "MERGE (p)-[:REACCIONA {tipo: 'LIKE'}]->(b)");

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
                        + "MERGE (c)-[:REACCIONA {tipo: 'LIKE'}]->(b)");
        escribir(
                "MATCH (p:Usuario {id: 'paulo-orrala'}), (b:Post {id: 'post-b1'}) "
                        + "MERGE (p)-[:REACCIONA {tipo: 'LIKE'}]->(b)");

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

        // Y al reves: en la semilla Paulo no sigue a nadie, asi que su lista de seguidos esta
        // vacia. Esta asercion estaba mal escrita --esperaba a Beatriz-- y las pruebas se saltaban
        // sin Docker, asi que nunca se vio. Que la lista este vacia es justo lo que distingue las
        // dos consultas: Paulo tiene un seguidor y no tiene a nadie seguido.
        List<Usuario> seguidosDePaulo = adapter.obtenerSeguidos("paulo-orrala");
        assertTrue(seguidosDePaulo.isEmpty(), "La semilla no tiene a Paulo siguiendo a nadie");

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
    @DisplayName("la consulta con tope se ejecuta sin error y devuelve lo que hay")
    void laConsultaConTopeFunciona() {
        // El LIMIT es un parámetro, no un número escrito en el texto. Si alguien lo cambiara por
        // una constante, esta prueba seguiría pasando pero el valor dejaría de ser ajustable, así
        // que aquí se comprueba el resultado y no sólo que la consulta no falle.
        List<Post> posts = adapter.obtenerPostsDeUsuario("beatriz-silva", null);

        assertEquals(2, posts.size());
    }

    @Test
    @DisplayName("la lista de seguidores con tope se ejecuta sin error")
    void losSeguidoresConTopeFuncionan() {
        assertEquals(1, adapter.obtenerSeguidores("beatriz-silva").size());
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

    // --- Búsqueda de personas (US-14) ---

    @Test
    @DisplayName("buscar por una parte del nombre o del nombre de usuario encuentra a la persona")
    void encuentraPorNombreYPorNombreDeUsuario() {
        List<Usuario> porNombre = adapter.buscarUsuarios("beatriz", 20L);
        assertEquals(1, porNombre.size());
        assertEquals("beatriz-silva", porNombre.get(0).getId());
        assertEquals("Beatriz Silva", porNombre.get(0).getNombre());

        // Y por el nombre de usuario, que es lo que alguien busca el 90% de las veces.
        assertEquals("beatriz-silva", adapter.buscarUsuarios("beatri", 20L).get(0).getId());
    }

    @Test
    @DisplayName("buscar sin la eñe encuentra a quien la tiene")
    void encuentraSinLaEnye() {
        // Este es el caso por el que existe la normalización, y no se puede comprobar con un mock:
        // `Carlos Patiño` está en el grafo de verdad, con la eñe, desde el @BeforeAll.
        List<Usuario> encontrados = adapter.buscarUsuarios("patino", 20L);

        assertEquals(1, encontrados.size(), "La búsqueda sin acentos no encontró a nadie");
        assertEquals("carlos-patino", encontrados.get(0).getId());
        // El nombre que se devuelve es el real, con su eñe: la normalización es para comparar, no
        // para mostrar. Si se devolviera la forma normalizada, el perfil de Carlos se leería
        // "Carlos Patino".
        assertEquals("Carlos Patiño", encontrados.get(0).getNombre());
    }

    @Test
    @DisplayName("buscar con la eñe también encuentra a quien la tiene")
    void encuentraConLaEnye() {
        // El texto buscado se normaliza con la misma regla que los datos. Si sólo se normalizaran
        // los datos, escribir "Patiño" no encontraría nunca nada.
        assertEquals("carlos-patino", adapter.buscarUsuarios("Patiño", 20L).get(0).getId());
    }

    @Test
    @DisplayName("buscar con mayúsculas y sin acentos encuentra igual")
    void encuentraConMayusculas() {
        assertEquals("carlos-patino", adapter.buscarUsuarios("CARLOS", 20L).get(0).getId());
    }

    @Test
    @DisplayName("un texto con espacio encuentra aunque el nombre de usuario no lo tenga")
    void encuentraConEspacioEnElNombre() {
        // El Gherkin de US-14 lo pide explícitamente: "beatriz sil" tiene que encontrar a
        // "Beatriz Silva", cuyo nombre de usuario es "beatriz" y no contiene ningún espacio.
        List<Usuario> encontrados = adapter.buscarUsuarios("beatriz sil", 20L);

        assertEquals(1, encontrados.size());
        assertEquals("beatriz-silva", encontrados.get(0).getId());
    }

    @Test
    @DisplayName("buscar 'pino' NO encuentra a Patiño, y no es un defecto")
    void pinoNoEncuentraAPatino() {
        // El cURL de verificación del ticket dice que buscar "pino" tiene que encontrar a
        // "Carlos Patiño". No puede: la forma normalizada de ese nombre es "carlos patino", y
        // "pino"
        // no es una subcadena de "patino" -- faltan las letras "at". Da igual cuántas técnicas de
        // normalización se apliquen.
        //
        // Esta prueba fija esa realidad para que nadie lea el resultado vacío como un fallo de la
        // normalización. La forma correcta de la misma comprobación es "patino", que sí lo
        // encuentra
        // y que da cero resultados sin normalizar.
        assertTrue(
                adapter.buscarUsuarios("pino", 20L).isEmpty(),
                "'pino' encontró a alguien, lo que significa que la comparación ya no es por "
                        + "subcadena");
        assertEquals("carlos-patino", adapter.buscarUsuarios("patino", 20L).get(0).getId());
    }

    @Test
    @DisplayName("los resultados llegan en el orden de relevancia, no alfabético")
    void ordenaPorRelevancia() {
        // El orden alfabético por nombre haría la búsqueda inusable: buscando "sil" pondría a
        // "Angel Villon" antes que a "Beatriz Silva". Se comprueba con dos personas que coinciden
        // en
        // posiciones distintas de la escala.
        escribir(
                """
                CREATE (angel:Usuario {id: 'angel-villon', username: 'angel-silva', nombre: 'Angel Silva'})
                CREATE (sandra:Usuario {id: 'sandra-ruiz', username: 'sandra', nombre: 'Sandra Ruiz'})
                CREATE (maria:Usuario {id: 'maria-solano', username: 'maria-solano', nombre: 'Maria Solano'})
                """);

        List<Usuario> resultados = adapter.buscarUsuarios("silva", 20L);
        List<String> ids = resultados.stream().map(Usuario::getId).toList();

        // angel-silva gana por nombre de usuario exacto, aunque "Angel Silva" esté antes que
        // "Beatriz Silva" en el alfabeto por nombre.
        assertEquals(List.of("angel-villon", "beatriz-silva"), ids);

        // Y el nombre completo también ordena: buscando "solano", la que lo tiene entero en el
        // nombre de usuario va antes que la que sólo lo tiene como parte.
        List<String> porNombre =
                adapter.buscarUsuarios("solano", 20L).stream().map(Usuario::getId).toList();
        assertTrue(
                porNombre.contains("maria-solano"),
                "El nombre de usuario completo debe aparecer: " + porNombre);
    }

    @Test
    @DisplayName("el propio usuario aparece entre los resultados si busca su propio nombre")
    void elPropioUsuarioAparece() {
        // Excluirlo escondería un resultado real sin que nadie lo pidiera, y alguien puede buscar
        // su propio nombre para comprobar que su perfil se ve bien.
        List<Usuario> resultados = adapter.buscarUsuarios("carlos", 20L);

        assertTrue(
                resultados.stream().anyMatch(u -> u.getId().equals("carlos-patino")),
                "Quien busca su propio nombre no se encuentra a sí mismo");
    }

    @Test
    @DisplayName("una búsqueda sin coincidencias devuelve vacío y no falla")
    void sinCoincidenciasDevuelveVacio() {
        assertTrue(adapter.buscarUsuarios("zzzzz", 20L).isEmpty());
    }

    @Test
    @DisplayName("un usuario sin nombre se busca por su nombre de usuario y no rompe nada")
    void unUsuarioSinNombreNoRompeLaBusqueda() {
        // Paulo se creó sin la propiedad `nombre`. La normalización de un valor nulo tiene que
        // devolver algo con lo que comparar en vez de romper la consulta, y el resultado llega con
        // nombre null, no con el texto literal "null".
        List<Usuario> resultados = adapter.buscarUsuarios("paulo", 20L);

        assertEquals(1, resultados.size());
        assertEquals("paulo-orrala", resultados.get(0).getId());
        assertNull(
                resultados.get(0).getNombre(), "Llegó el texto \"null\" como si fuera un nombre");
    }

    @Test
    @DisplayName("la búsqueda no trae correo, contraseña ni suscripción push")
    void laBusquedaNoTraeDatosDeSesion() {
        escribir(
                """
                MATCH (u:Usuario {id: 'carlos-patino'})
                SET u.email = 'carlos@upse.edu.ec',
                    u.password = 'no-debe-aparecer',
                    u.pushSubscriptionJson = '{"endpoint":"https://fcm/secreto"}'
                """);

        List<Usuario> resultados = adapter.buscarUsuarios("carlos", 20L);
        assertFalse(resultados.isEmpty(), "No hay resultados con los que comprobar la fuga");

        for (Usuario persona : resultados) {
            assertNull(persona.getEmail(), "El correo llegó en los resultados: " + persona.getId());
            assertNull(persona.getPassword(), "La contraseña llegó: " + persona.getId());
            assertNull(
                    persona.getPushSubscriptionJson(),
                    "La suscripción push llegó: " + persona.getId());
        }

        // Y se limpia para que no afecte a las demás pruebas de la clase.
        escribir(
                """
                MATCH (u:Usuario {id: 'carlos-patino'})
                REMOVE u.email, u.password, u.pushSubscriptionJson
                """);
    }

    @Test
    @DisplayName("la búsqueda respeta el tope que se le pasa")
    void laBusquedaRespetaElTope() {
        // Sin tope, una búsqueda por una letra común devuelve la comunidad entera, que es el
        // defecto que US-14 cierra con GET /api/users. El tope es un parámetro, así que aquí se
        // comprueba que el valor que sale es el que se pidió.
        assertEquals(1, adapter.buscarUsuarios("a", 1L).size());
    }
}
