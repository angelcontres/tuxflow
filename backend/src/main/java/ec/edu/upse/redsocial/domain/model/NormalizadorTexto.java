package ec.edu.upse.redsocial.domain.model;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Forma sin acentos ni eñes con la que se comparan los textos de una búsqueda de personas.
 *
 * <p>Vive en el dominio y no en el adaptador de Neo4j por dos razones. La primera es que la regla
 * es del dominio: "buscar `patino` encuentra a `Patiño`" es una regla del producto, no un detalle
 * de cómo se guarda el grafo. La segunda es que la búsqueda necesita la forma normalizada en los
 * dos lados —el texto que se busca y el que está guardado—, y si la regla viviera en el adaptador
 * habría que duplicarla en Java y en Cypher, donde una discrepancia no lanza ningún error: devuelve
 * [] y parece una búsqueda sin resultados.
 *
 * <p>Se pliegan {@code á é í ó ú ñ} y sus mayúsculas. No se hace nada más: no se quitan espacios,
 * no se colapsan espacios dobles y no se tocan otros alfabetos. Cada transformación extra es una
 * regla que alguien tiene que recordar y que puede sorprender.
 *
 * <p><b>El counterpart en Cypher</b> está en {@code Neo4jGrafoAdapter}, y las dos implementaciones
 * tienen que coincidir carácter a carácter. Hay una prueba que fija esta tabla justamente para que
 * no se puedan separar sin que se note.
 */
public final class NormalizadorTexto {

    private NormalizadorTexto() {}

    /**
     * Devuelve el texto en minúsculas y sin acentos ni eñes.
     *
     * @param texto el texto a normalizar; puede ser {@code null}
     * @return el texto normalizado, o {@code null} si la entrada era {@code null} o estaba en
     *     blanco
     */
    public static String normalizar(String texto) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        // Locale.ROOT y no el del sistema: el nombre de una persona no depende del idioma
        // del servidor. En Turkish, toLowerCase convierte la "I" en una "i" con punto que
        // no es la "i" que nadie escribe al buscar. ROOT lo evita.
        String minusculas = texto.toLowerCase(Locale.ROOT);

        // NFD separa cada letra acentuada en su letra base más un diacrítico combinante, y quitar
        // los
        // diacríticos deja la base. Es el mecanismo estándar para esto y cubre de paso otros
        // alfabetos que esta historia no documenta.
        String sinDiacriticos =
                Normalizer.normalize(minusculas, Normalizer.Form.NFD).replaceAll("\\p{M}", "");

        return sinDiacriticos.strip();
    }
}
