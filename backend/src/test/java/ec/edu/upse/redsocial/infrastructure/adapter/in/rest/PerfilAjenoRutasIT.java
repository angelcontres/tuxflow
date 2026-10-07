package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import ec.edu.upse.redsocial.infrastructure.adapter.in.rest.dto.UsuarioRequest;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Los endpoints del perfil ajeno sobre HTTP de verdad, con el servidor levantado.
 *
 * <p>Las pruebas de recurso llaman al método Java directamente, así que pasan aunque la ruta no
 * resuelva o aunque dos rutas se pisen. Esta clase sube el servidor y pregunta por URL, que es lo
 * que hace el navegador.
 *
 * <p>Lo que más busca es el choque de rutas, que no se ve leyendo el código. {@code
 * /api/posts/autor/{userId}} convive con {@code /api/posts/{postId}/like} y con {@code
 * /api/posts/tendencias/{userId}}, y {@code /api/users/{userId}/followers} con {@code
 * /api/users/comunes}. En RESTEasy Reactive el segmento literal gana al de plantilla, así que el
 * orden importa: declarar una ruta más general primero cambiaría qué responde cada URL, y ninguna
 * prueba de recurso lo detecta.
 *
 * <p><b>No hay base de datos detrás.</b> Los casos de uso están sustituidos por {@link
 * CrearPostUseCaseDePrueba} y {@link GestionarGrafoSocialUseCaseDePrueba}, así que estas pruebas no
 * dependen de que haya un Neo4j. Antes de hacerlo así, la versión anterior sí lo dependedía y sin
 * base de datos el driver no fallaba rápido: reintentaba hasta agotar su timeout, la petición se
 * quedaba colgada y las nueve pruebas morían con {@code SocketTimeout}. Un test de rutas no debería
 * depender de un grafo.
 *
 * <p>Ese cambio además permite comprobar el <b>cuerpo</b> de la respuesta, que era lo que se perdió
 * al no poder usar {@code @InjectMock}: {@code quarkus-junit5-mockito} no está en el repositorio
 * local de esta máquina y el build corre sin acceso a Maven Central.
 */
@QuarkusTest
class PerfilAjenoRutasIT {

    @Test
    @DisplayName("GET /api/posts/autor/{userId} resuelve y devuelve las publicaciones")
    void publicacionesPorAutorResuelve() {
        given().when()
                .get("/api/posts/autor/beatriz-silva")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("$", hasSize(2))
                .body("[0].id", equalTo("post-2"))
                .body("[0].autorId", equalTo("beatriz-silva"))
                .body("[0].autorUsername", equalTo("beatriz"));
    }

    @Test
    @DisplayName("la fecha de creación serializa como número, no como texto")
    void laFechaSerializaComoNumero() {
        // Es la representación que decidió el ROADMAP. Si volviera a serializarse como texto, el
        // cliente recibiría "1727270000000" y el orden cronológico del perfil quedaría sin base.
        String crudo =
                given().when()
                        .get("/api/posts/autor/beatriz-silva")
                        .then()
                        .statusCode(200)
                        .extract()
                        .asString();

        org.junit.jupiter.api.Assertions.assertTrue(
                crudo.contains("1727270000000"), "La fecha no llegó en el cuerpo: " + crudo);
        assertFalse(crudo.contains("\"1727270000000\""), "La fecha llegó como texto: " + crudo);
    }

    @Test
    @DisplayName("las reacciones llegan las cuatro, no en cero")
    void lasReaccionesLleganCompletas() {
        // US-06 agregó dislikes al modelo. Si la consulta no los proyectara, el perfil respondería
        // "cero dislikes" para toda publicación, porque el valor por defecto del modelo es cero y
        // no
        // un null. Esta aserción es la que lo caza.
        given().when()
                .get("/api/posts/autor/beatriz-silva")
                .then()
                .statusCode(200)
                .body("[0].totalLikes", equalTo(3))
                .body("[0].totalDislikes", equalTo(1))
                .body("[0].likedByMe", equalTo(true))
                .body("[0].dislikedByMe", equalTo(false));
    }

    @Test
    @DisplayName(
            "GET /api/posts/autor/{userId} acepta el visor y sin él sigue siendo la misma ruta")
    void publicacionesConVisorResuelve() {
        given().when()
                .get("/api/posts/autor/beatriz-silva?viewerId=carlos-patino")
                .then()
                .statusCode(200)
                .body("$", hasSize(2));

        // El cURL del ticket no manda visor y tiene que seguir funcionando tal cual.
        given().when().get("/api/posts/autor/beatriz-silva").then().statusCode(200);
    }

    @Test
    @DisplayName("un segmento del path con %20 llega como texto, no como espacio")
    void elPathNoSeDecodifica() {
        // Comprobado, no supuesto: RESTEasy entrega el `@PathParam` sin decodificar, así que "%20"
        // llega como la cadena de cuatro caracteres y no como un espacio. Por eso la validación de
        // "identificador en blanco" del recurso no se puede provocar por URL, y esta clase no la
        // prueba: la cubre `PostResourceTest`, que llama al método directamente.
        //
        // El efecto lateral que sí importa: un identificador con acentos enviado como "%C3%A9"
        // llegaría también como texto escapado y no coincidiría con el nodo. Hoy da igual porque
        // todos los `username` de la semilla son ASCII, pero es lo que hay que tener en cuenta si
        // alguna vez se busca por texto acentuado.
        given().when()
                .get("/api/posts/autor/%20")
                .then()
                .statusCode(200)
                .body("[0].autorId", equalTo("%20"));
    }

    @Test
    @DisplayName("GET /api/posts/autor/{userId} no se confunde con la ruta de like")
    void publicacionesNoColisionanConLike() {
        // La colisión de rutas no se vería leyendo el código: sólo se ve cuando el servidor
        // resuelve.
        //
        // Lo que se espera en el segundo caso es 404 y no 405: en JAX-RS un GET sobre una ruta que
        // sólo
        // declara POST no encuentra recurso para ese verbo y responde "aquí no hay nada", no
        // "existe pero no por este método". Lo que importa es que no responda 200 con
        // publicaciones: si `/autor/{userId}/like` llegara a la consulta, el identificador sería
        // "like" y devolvería la lista de un autor llamado así.
        given().when().get("/api/posts/autor").then().statusCode(404);

        given().when().get("/api/posts/autor/beatriz-silva/like").then().statusCode(404);
    }

    @Test
    @DisplayName("GET /api/posts/autor/{userId} no se confunde con tendencias")
    void publicacionesNoColisionanConTendencias() {
        // `tendencias/{userId}` y `autor/{userId}` comparten la forma de la ruta y sólo difieren en
        // el segmento literal. Si el orden de declaración importara, una devolvería la otra.
        given().when().get("/api/posts/autor/beatriz-silva").then().statusCode(200);

        given().when()
                .get("/api/posts/tendencias/beatriz-silva")
                .then()
                .statusCode(200)
                .body("$", hasSize(0));
    }

    @Test
    @DisplayName("GET /api/users/{userId}/followers resuelve y devuelve la lista")
    void seguidoresResuelve() {
        given().when()
                .get("/api/users/beatriz-silva/followers")
                .then()
                .statusCode(200)
                .body("$", hasSize(2))
                .body("id", hasItem("carlos-patino"))
                .body("username", hasItem("elena"));
    }

    @Test
    @DisplayName("GET /api/users/{userId}/followers no filtra contraseña, correo ni suscripción")
    void seguidoresNoFiltranDatosDeSesion() {
        String crudo =
                given().when()
                        .get("/api/users/beatriz-silva/followers")
                        .then()
                        .statusCode(200)
                        .extract()
                        .asString();

        assertFalse(crudo.contains("no-debe-aparecer"), "La contraseña se filtró: " + crudo);
        assertFalse(crudo.contains("upse.edu.ec"), "El correo se filtró: " + crudo);
        assertFalse(crudo.contains("fcm"), "La suscripción push se filtró: " + crudo);
        org.junit.jupiter.api.Assertions.assertTrue(
                crudo.contains("Carlos Patiño"), "El nombre debería venir: " + crudo);
    }

    @Test
    @DisplayName("GET /api/users/{userId}/followers no se confunde con /comunes ni con /follows")
    void seguidoresNoColisionanConComunesNiFollows() {
        // `comunes` es un segmento literal que compite con `{userId}`. Si el servidor lo tomara
        // como
        // un identificador, pediría los seguidores de una persona llamada "comunes" y devolvería
        // 200
        // con una lista vacía en vez de 400.
        given().when().get("/api/users/comunes").then().statusCode(400);

        // Un prefijo compartido y un segmento final que sólo difiere en una letra: el caso donde un
        // error de dedo convierte una ruta en la otra sin que ninguna prueba de recurso lo note.
        given().when().get("/api/users/beatriz-silva/follows").then().statusCode(200);
        given().when()
                .get("/api/users/beatriz-silva/followers")
                .then()
                .statusCode(200)
                .body("$", hasSize(2));
    }

    @Test
    @DisplayName(
            "GET /api/users/{userId} del perfil propio conserva el correo y oculta la contraseña")
    void perfilPropioConservaCorreoYOcultaContrasena() {
        // El DTO de las listas es más estrecho a propósito. Este endpoint es el otro: es el perfil
        // propio, se pide autenticado, y por eso sí lleva el correo. La distinción entre los dos es
        // la razón de que existan dos DTO, así que también merece una prueba.
        String crudo =
                given().when()
                        .get("/api/users/beatriz-silva")
                        .then()
                        .statusCode(200)
                        .body("email", equalTo("beatriz@upse.edu.ec"))
                        .body("password", not(org.hamcrest.Matchers.hasKey("password")))
                        .extract()
                        .asString();

        assertFalse(crudo.contains("no-debe-aparecer"), "La contraseña se filtró: " + crudo);
    }

    @Test
    @DisplayName("Las rutas aceptan identificadores con guiones, que es el formato de la semilla")
    void identificadoresConGuiones() {
        // Todos los identificadores de `docker/neo4j-seed.cql` llevan un guion: "carlos-patino",
        // "beatriz-silva". Una ruta mal escrita que sólo aceptara segmentos simples no se notaría
        // con
        // un identificador de prueba inventado.
        given().when()
                .get("/api/posts/autor/beatriz-silva")
                .then()
                .statusCode(200)
                .body("[0].autorId", equalTo("beatriz-silva"));

        given().when().get("/api/users/beatriz-silva/followers").then().statusCode(200);
    }

    @Test
    @DisplayName("El cuerpo de error usa la forma que el cliente ya lee")
    void errorConFormaConocida() {
        // `getUserFacingError` del frontend lee el campo `error`. Si un endpoint devolviera otra
        // clave, el mensaje del servidor no llegaría nunca a pantalla y salaría el texto genérico.
        //
        // La validación de "identificador en blanco" de /autor/{userId} no se puede disparar por el
        // path (ver la prueba del `%20`), así que aquí se comprueba la forma con `/comunes`, que sí
        // la tiene y que el frontend también consume.
        given().when()
                .get("/api/users/comunes")
                .then()
                .statusCode(400)
                .body("$", hasKey("error"))
                .body("error", not(org.hamcrest.Matchers.nullValue()));
    }

    // --- Búsqueda de personas (US-14) ---
    //
    // Estas tres no se pueden probar llamando al método Java: pasan aunque la ruta no resuelva. Lo
    // que
    // se comprueba aquí es el choque entre `/api/users/buscar` y `/api/users/{userId}`, que sólo se
    // ve
    // cuando el servidor resuelve la URL, y el hecho de que el directorio completo ya no exista.

    @Test
    @DisplayName("GET /api/users/buscar?q= resuelve y devuelve la lista")
    void laBusquedaResuelve() {
        given().when()
                .get("/api/users/buscar?q=beatriz")
                .then()
                .statusCode(200)
                .contentType(ContentType.JSON)
                .body("$", hasSize(1))
                .body("[0].id", equalTo("beatriz-silva"))
                .body("[0].username", equalTo("beatriz"));
    }

    @Test
    @DisplayName("GET /api/users/buscar no se confunde con GET /api/users/{userId}")
    void laBusquedaNoColisionaConElPerfil() {
        // `buscar` es un segmento literal que compite con `{userId}`. Si el servidor lo tomara como
        // un identificador, buscaría a una persona llamada "buscar" y devolvería 404 en vez de la
        // lista, que es la forma silenciosa de este defecto: un 404 por identificador inexistente y
        // un 404 por ruta mal declarada son indistinguibles desde fuera.
        given().when().get("/api/users/buscar?q=beatriz").then().statusCode(200);

        // Y al revés: el perfil sigue resolviendo como perfil, no como búsqueda.
        given().when()
                .get("/api/users/beatriz-silva")
                .then()
                .statusCode(200)
                .body("id", equalTo("beatriz-silva"))
                .body("username", equalTo("beatriz"));
    }

    @Test
    @DisplayName("GET /api/users ya no devuelve el directorio con correos")
    void elDirectorioYaNoExiste() {
        // Este endpoint devolvía TODOS los usuarios con su correo y sin pedir autenticación.
        //
        // Lo que responde es 405 y no el 404 que dice el ticket, y la razón es que no puede ser
        // 404: `POST /api/users` --el registro de US-01-- sigue declarado en esta misma ruta, así
        // que
        // la ruta existe y lo que no existe es el GET. En JAX-RS eso es "existe pero no por este
        // método". El 404 del ticket sólo sería alcanzable borrando también el registro, que no es
        // de
        // esta historia.
        //
        // El defecto está cerrado igual: no hay forma de leer el directorio. Y el 405 es más exacto
        // que el 404, porque distingue "esta ruta no existe" de "existe pero no por GET".
        String crudo = given().when().get("/api/users").then().statusCode(405).extract().asString();

        assertFalse(crudo.contains("beatriz@upse.edu.ec"), "El directorio se filtró: " + crudo);
        assertFalse(crudo.contains("username"), "El directorio se filtró: " + crudo);
        assertFalse(crudo.contains("nombre"), "El directorio se filtró: " + crudo);
    }

    @Test
    @DisplayName("POST /api/users sigue declarado: cerrar el directorio no cerró el registro")
    void elRegistroDeUsuariosSigueDeclarado() throws NoSuchMethodException {
        // El registro de US-01 comparte ruta con el directorio que US-14 cierra, y es justo por eso
        // que `GET /api/users` responde 405 y no 404 (ver la prueba anterior). Si esta ruta
        // desapareciera, el alta de usuarios de US-01 se rompería.
        //
        // No se espera un 201: el doble de prueba que sustituye al caso de uso lanza
        // UnsupportedOperationException a propósito en todo lo que escribe, porque estas pruebas no
        // tocan el grafo. Lo que se comprueba aquí es que la ruta y el verbo siguen declarados, que
        // es lo que depende de esta historia.
        assertNotNull(
                UserGraphResource.class.getDeclaredMethod("registrarUsuario", UsuarioRequest.class),
                "El registro de usuarios dejó de estar declarado");
    }

    @Test
    @DisplayName("GET /api/users/buscar no filtra correo, contraseña ni suscripción push")
    void laBusquedaNoFiltraDatosDeSesion() {
        // La búsqueda es la lectura más amplia de la comunidad que tiene la API: cualquiera que
        // adivine dos letras puede preguntar por todos. La respuesta tiene que ser la más estrecha.
        String crudo =
                given().when()
                        .get("/api/users/buscar?q=beatriz")
                        .then()
                        .statusCode(200)
                        .extract()
                        .asString();

        assertFalse(crudo.contains("no-debe-aparecer"), "La contraseña se filtró: " + crudo);
        assertFalse(crudo.contains("upse.edu.ec"), "El correo se filtró: " + crudo);
        assertFalse(crudo.contains("fcm"), "La suscripción push se filtró: " + crudo);
        org.junit.jupiter.api.Assertions.assertTrue(
                crudo.contains("Beatriz Silva"), "El nombre debería venir: " + crudo);
    }

    @Test
    @DisplayName("GET /api/users/buscar con menos de dos caracteres responde 400")
    void laBusquedaConPocoTextoResponde400() {
        // La mitigación tiene que estar en el servidor, no sólo en el navegador: en el frontend no
        // mitiga nada contra un curl. Y responde 400 y no la lista vacía, porque una llamada mal
        // formada no puede parecerse a "no hay nadie".
        given().when()
                .get("/api/users/buscar?q=a")
                .then()
                .statusCode(400)
                .body("$", hasKey("error"));

        given().when().get("/api/users/buscar").then().statusCode(400).body("$", hasKey("error"));

        // Y con dos caracteres sí busca: si el mínimo estuviera mal, nadie encontraría a nadie.
        given().when().get("/api/users/buscar?q=be").then().statusCode(200);
    }
}
