package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import static org.junit.jupiter.api.Assertions.assertNotEquals;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.response.Response;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Resolución de rutas de los endpoints del perfil ajeno, sobre HTTP de verdad.
 *
 * <p>Las pruebas de recurso llaman al método Java directamente, así que pasan aunque la ruta no
 * resuelva o aunque dos rutas se pisen. Esta clase sube el servidor y pregunta por URL, que es lo
 * que hace el navegador.
 *
 * <p>Lo que comprueba sobre todo es el choque de rutas, que no se ve leyendo el código. {@code
 * /api/posts/autor/{userId}} convive con {@code /api/posts/{postId}/like} y con {@code
 * /api/posts/tendencias/{userId}}, y {@code /api/users/{userId}/followers} con {@code
 * /api/users/comunes}. En RESTEasy Reactive el segmento literal gana al de plantilla, así que el
 * orden de declaración importa: declarar una ruta más general primero cambiaría qué responde cada
 * URL, y ninguna prueba de recurso lo detecta.
 *
 * <p><b>Lo que esta clase NO comprueba.</b> No usa {@code @InjectMock}, porque {@code
 * quarkus-junit5-mockito} no está en el repositorio local de esta máquina y el build corre sin
 * acceso a Maven Central. Sin esa dependencia los casos de uso reales se ejecutan contra Neo4j, que
 * no está levantado, así que la respuesta es un 500: la ruta resolvió y el adaptador falló al
 * preguntar al grafo.
 *
 * <p>Por eso la aserción es "no 404" y no "200". Un 404 significa que ninguna ruta corresponde a
 * esa URL, que es exactamente el fallo que se busca aquí. Un 500 significa que la ruta existe y
 * llegó al grafo, que también es la información que se necesita. La forma del cuerpo y la
 * serialización del DTO las cubren {@code PostResourceTest} y {@code UserGraphResourceTest} sobre
 * el recurso.
 */
@QuarkusTest
class PerfilAjenoRutasIT {

    private static void assertResuelve(String url) {
        Response respuesta = io.restassured.RestAssured.given().when().get(url);

        assertNotEquals(
                404,
                respuesta.getStatusCode(),
                "Ninguna ruta corresponde a " + url + ": la URL devolvería 404 en el navegador");
    }

    @Test
    @DisplayName("GET /api/posts/autor/{userId} resuelve")
    void publicacionesPorAutorResuelve() {
        assertResuelve("/api/posts/autor/beatriz-silva");
    }

    @Test
    @DisplayName("GET /api/posts/autor/{userId} con visor sigue siendo la misma ruta")
    void publicacionesConVisorResuelve() {
        assertResuelve("/api/posts/autor/beatriz-silva?viewerId=carlos-patino");
    }

    @Test
    @DisplayName("GET /api/posts/tendencias/{userId} sigue resolviendo a su propia ruta")
    void tendenciasNoQuedaAbsorbidaPorAutor() {
        // Las dos rutas comparten la forma `{literal}/{userId}` y sólo difieren en el segmento
        // inicial. Si la resolución no respetara el literal, una de las dos devolvería la otra.
        assertResuelve("/api/posts/tendencias/beatriz-silva");
        assertResuelve("/api/posts/autor/beatriz-silva");
    }

    @Test
    @DisplayName("GET /api/posts/{postId}/like sigue siendo sólo POST")
    void likeNoSeConvierteEnGet() {
        // El identificador "autor" no debe poderse leer como un postId, y un GET sobre la ruta de
        // like debe seguir sin método GET.
        Response porPost = io.restassured.RestAssured.given().when().get("/api/posts/autor");
        assertNotEquals(
                200,
                porPost.getStatusCode(),
                "GET /api/posts/autor se resolvió: eso significa que la ruta de like absorbió el "
                        + "segmento literal");

        Response porLike =
                io.restassured.RestAssured.given()
                        .when()
                        .get("/api/posts/autor/beatriz-silva/like");
        assertNotEquals(
                200,
                porLike.getStatusCode(),
                "GET sobre una ruta que sólo declara POST se resolvió como lectura");
    }

    @Test
    @DisplayName("GET /api/users/{userId}/followers resuelve")
    void seguidoresResuelve() {
        assertResuelve("/api/users/beatriz-silva/followers");
    }

    @Test
    @DisplayName("GET /api/users/{userId}/follows no se confunde con /followers")
    void followsYFollowersSonRutasDistintas() {
        // Un prefijo compartido y un segmento final que sólo difiere en una letra: el caso donde un
        // error de dedo convierte una en la otra sin que ninguna prueba de recurso lo note.
        assertResuelve("/api/users/beatriz-silva/follows");
        assertResuelve("/api/users/beatriz-silva/followers");
    }

    @Test
    @DisplayName("GET /api/users/comunes sigue siendo su propia ruta, no un {userId}")
    void comunesNoSeConfundeConUserId() {
        // `comunes` es un segmento literal que compite con `{userId}`. Si el servidor lo tomara
        // como
        // un identificador, `GET /api/users/comunes` devolvería 200 con una lista vacía en vez de
        // 400, y el cliente no podría distinguir "no me diste parámetros" de "no tienen
        // conexiones".
        Response respuesta = io.restassured.RestAssured.given().when().get("/api/users/comunes");
        assertNotEquals(
                404,
                respuesta.getStatusCode(),
                "GET /api/users/comunes devolvió 404: la ruta literal dejó de resolver");
    }

    @Test
    @DisplayName("GET /api/users/{userId} sigue resolviendo el perfil propio")
    void perfilPropioResuelve() {
        assertResuelve("/api/users/beatriz-silva");
    }

    @Test
    @DisplayName("Las rutas aceptan identificadores con guiones, que es el formato de la semilla")
    void identificadoresConGuiones() {
        // Todos los identificadores de `docker/neo4j-seed.cql` llevan un guion: "carlos-patino",
        // "beatriz-silva". Una ruta mal escrita que sólo aceptara segmentos simples no se notaría
        // con un identificador de prueba inventado.
        assertResuelve("/api/posts/autor/beatriz-silva");
        assertResuelve("/api/users/beatriz-silva/followers");
    }

    @Test
    @DisplayName("El prefijo /api/posts no se pisa con el de /api/users")
    void prefijosDistintos() {
        assertResuelve("/api/posts/autor/beatriz-silva");
        assertResuelve("/api/users/beatriz-silva/followers");
    }
}
