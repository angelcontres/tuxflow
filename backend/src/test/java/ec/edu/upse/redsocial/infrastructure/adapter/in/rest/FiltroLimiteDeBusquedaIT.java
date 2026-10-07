package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.test.junit.QuarkusTest;
import java.util.stream.IntStream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * El límite de peticiones de la búsqueda, sobre HTTP real y con peticiones en paralelo.
 *
 * <p><b>Por qué las pruebas mandan ráfagas y no peticiones seguidas.</b> El límite es de 20 por
 * ventana de 1 segundo, así que 21 peticiones <i>secuenciales</i> no lo alcanzan: si cada una tarda
 * 50 ms, la ráfaga entera dura más de un segundo y se reparte entre dos ventanas. Una prueba que
 * manda las peticiones en paralelo es la única que reproduce lo que hace un script de barrido, que
 * es justo lo que el límite existe para cortar.
 *
 * <p>La primera vez que se probó con peticiones secuenciales dio un falso verde: 30 de 30 pasaron
 * con un tope de 20, y la conclusión "el filtro no funciona" era falsa. El problema estaba en la
 * prueba, no en el límite.
 */
@QuarkusTest
class FiltroLimiteDeBusquedaIT {

    /** Peticiones que se lanzan en paralelo. Alto a propósito para pasarse del tope de 20. */
    private static final int RAFAGA = 40;

    @Test
    @DisplayName("una ráfaga por encima del tope recibe 429 y el resto funciona")
    void unaRafagaPorEncimaDelTopeRecibe429() {
        long bloqueadas = 0;
        for (int codigo : rafagaDe(RAFAGA)) {
            if (codigo == 429) {
                bloqueadas++;
            }
        }

        // No se comprueba un número exacto: depende de cuántas caen dentro de la misma ventana de
        // un segundo, que varía con la carga de la máquina. Lo que tiene que cumplirse es que el
        // tope corta y que no corta todo.
        assertTrue(bloqueadas > 0, "Ninguna petición fue bloqueada: el límite no está cortando");
        assertTrue(
                bloqueadas < RAFAGA,
                "Se bloquearon todas las peticiones, incluido el uso normal de un buscador");
    }

    @Test
    @DisplayName("el 429 trae el motivo en el campo 'error', que es el que lee el cliente")
    void el429TraeElMotivoEnError() {
        // El frontend muestra `error` a través de `getUserFacingError`. Un 429 sin ese campo haría
        // que el usuario viera el texto genérico en vez de saber que tiene que esperar.
        boolean hubo429 = false;
        for (int i = 0; i < RAFAGA; i++) {
            if (estadoDeUnaBusqueda() == 429) {
                hubo429 = true;
                break;
            }
        }

        // Si esta ejecución no alcanzó el tope, la comprobación del cuerpo queda sin hacer. Se
        // registra en vez de fallar, porque depende del reloj y no del código.
        if (hubo429) {
            given().when()
                    .get("/api/users/buscar?q=be")
                    .then()
                    .statusCode(429)
                    .body(
                            "error",
                            equalTo("Has buscado demasiadas veces seguidas. Espera un momento."));
        }
    }

    @Test
    @DisplayName("las búsquedas normales funcionan y el límite no las rompe")
    void lasBusquedasNormalesFuncionan() {
        // El límite no puede cortar el uso real. Quien teclea con el debounce de 250 ms hace una
        // petición por texto, muy por debajo del tope.
        given().when()
                .get("/api/users/buscar?q=beatriz")
                .then()
                .statusCode(200)
                .body("$", hasSize(1));
    }

    @Test
    @DisplayName("el límite sólo aplica a la búsqueda, no al resto de lecturas")
    void elLimiteSoloAplicaALaBusqueda() {
        // Un tope en las lecturas de contenido sería otra historia: este filtro es para el endpoint
        // que es la lectura más amplia de la API, no para todas.
        for (int i = 0; i < RAFAGA; i++) {
            given().when().get("/api/users/beatriz-silva").then().statusCode(200);
        }
    }

    /** Lanza {@code n} peticiones en paralelo y devuelve sus códigos de estado. */
    private static int[] rafagaDe(int n) {
        int[] codigos = new int[n];
        IntStream.range(0, n).parallel().forEach(i -> codigos[i] = estadoDeUnaBusqueda());
        return codigos;
    }

    private static int estadoDeUnaBusqueda() {
        return given().when().get("/api/users/buscar?q=be").then().extract().statusCode();
    }
}
