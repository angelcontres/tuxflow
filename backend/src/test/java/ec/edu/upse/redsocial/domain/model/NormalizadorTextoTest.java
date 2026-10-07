package ec.edu.upse.redsocial.domain.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import ec.edu.upse.redsocial.infrastructure.adapter.out.neo4j.Neo4jGrafoAdapter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * La forma sin acentos con la que se comparan las búsquedas de US-14.
 *
 * <p>Hay una clase espejo en Cypher, dentro de {@code Neo4jGrafoAdapter}, y las dos tienen que
 * coincidir carácter a carácter. Si se separan, la búsqueda devuelve {@code []} sin lanzar ningún
 * error, y eso se lee como "no hay nadie con ese nombre". Por eso la última prueba de esta clase
 * ata las dos: es la que avisa cuando una se cambia y la otra no.
 */
class NormalizadorTextoTest {

    @Test
    @DisplayName("la eñe se convierte en n, que es el caso que rompe la búsqueda")
    void laEnyeSeConvierteEnN() {
        // El caso del ticket: buscar "patino" tiene que encontrar a "Patiño". Con toLower()
        // solamente
        // esto es FALSE, porque "ñ" no es "n".
        assertEquals("carlos patino", NormalizadorTexto.normalizar("Carlos Patiño"));
    }

    @Test
    @DisplayName("una palabra acentuada se queda sin acento y en minúsculas")
    void unaPalabraAcentuada() {
        assertEquals("jose ramirez", NormalizadorTexto.normalizar("José Ramírez"));
    }

    @Test
    @DisplayName("todas las vocales acentuadas y la eñe se pliegan")
    void todasLasVocalesAcentuadas() {
        assertEquals("aaeeiioouunn", NormalizadorTexto.normalizar("ÁáÉéÍíÓóÚúÑñ"));
    }

    @Test
    @DisplayName("los acentos de mayúsculas y minúsculas dan el mismo resultado")
    void mayusculasYMinusculasCoinciden() {
        // Si esto fallara, buscar "Jose" y buscar "jose" darían resultados distintos, y sería el
        // tipo de defecto que sólo aparece con un usuario en mayúsculas.
        assertEquals(
                NormalizadorTexto.normalizar("José Ramírez"),
                NormalizadorTexto.normalizar("JOSE RAMIREZ"));
    }

    @Test
    @DisplayName("el espacio del medio se conserva")
    void elEspacioSeConserva() {
        // "beatriz sil" tiene que encontrar a "Beatriz Silva": si la normalización quitara o
        // colapsara espacios, esta búsqueda --que está en el Gherkin-- dejaría de funcionar.
        assertEquals("beatriz sil", NormalizadorTexto.normalizar("Beatriz Sil"));
    }

    @Test
    @DisplayName("los sobrantes de los extremos se quitan")
    void losEspaciosSobrantesSeQuitan() {
        assertEquals("beatriz", NormalizadorTexto.normalizar("   beatriz   "));
    }

    @Test
    @DisplayName("un texto vacío o nulo se devuelve como nulo, no como cadena vacía")
    void textoVacioDevuelveNulo() {
        // El recurso rechaza el vacío con un 400 antes de llegar aquí. El nulo de este método es la
        // red de seguridad para un camino que no debería existir: devolver "" haría que la consulta
        // buscara nodos cuya forma normalizada contiene la cadena vacía, que son todos.
        assertNull(NormalizadorTexto.normalizar(null));
        assertNull(NormalizadorTexto.normalizar(""));
        assertNull(NormalizadorTexto.normalizar("   "));
    }

    @Test
    @DisplayName("el texto que no tiene acentos no cambia")
    void textoSinAcentosNoCambia() {
        assertEquals("beatriz", NormalizadorTexto.normalizar("beatriz"));
    }

    @Test
    @DisplayName("la consulta Cypher pliega exactamente las mismas seis letras, en el mismo orden")
    void laTablaCypherCoincideConLaDeJava() {
        // Esta es la prueba que ata las dos implementaciones de la regla: la de Java, que es esta
        // clase, y la copia escrita en Cypher dentro de Neo4jGrafoAdapter. Si alguien cambia una y
        // no
        // la otra, la búsqueda deja de encontrar a la gente con acentos, y no lanza ningún error:
        // devuelve [] y se lee como que no hay nadie. Esa es la razón de que el texto de la
        // consulta
        // sea visible y de que esta prueba exista.
        String cypher = Neo4jGrafoAdapter.NORMALIZAR.formatted("u.nombre");

        assertTrue(
                cypher.contains("['á', 'é', 'í', 'ó', 'ú', 'ñ']"),
                "La consulta Cypher ya no pliega las mismas letras que Java: " + cypher);
        assertTrue(
                cypher.contains("['a', 'e', 'i', 'o', 'u', 'n']"),
                "La consulta Cypher ya no convierte a las mismas letras que Java: " + cypher);

        // Y cada letra tiene que plegarse a un único carácter, porque el replace de Cypher empareja
        // por posición: si Java plegara "ñ" a "nn" y la consulta a "n", los dos lados comparan
        // textos distintos.
        for (String acentuada : new String[] {"á", "é", "í", "ó", "ú", "ñ"}) {
            String plegada = NormalizadorTexto.normalizar(acentuada);
            assertEquals(
                    1,
                    plegada.length(),
                    "La letra '" + acentuada + "' se pliega a " + plegada.length() + " caracteres");
            assertTrue(
                    "aeioun".contains(plegada),
                    "La letra '"
                            + acentuada
                            + "' se pliega a '"
                            + plegada
                            + "', y la consulta Cypher no conoce ese destino");
        }
    }
}
