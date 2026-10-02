package ec.edu.upse.redsocial.domain.model;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/**
 * Pruebas del contrato del modelo de dominio {@link Post}.
 *
 * <p>Estas pruebas fijan el comportamiento que hoy declara el dominio. No cubren la persistencia:
 * la diferencia entre lo que el dominio declara y lo que el adaptador escribe en Neo4j está
 * documentada en {@code openspec/ROADMAP.md} y se resuelve con la historia que decida la
 * representación de {@code fechaCreacion}.
 */
class PostTest {

    @Nested
    @DisplayName("Valores por defecto")
    class Defaults {

        @Test
        @DisplayName("una publicación nueva no tiene identificador ni contenido")
        void newPostHasNoValues() {
            Post post = new Post();

            assertNull(post.getId());
            assertNull(post.getTexto());
            assertNull(post.getMediaUrl());
            assertNull(post.getAutorId());
            assertNull(post.getAutorUsername());
            assertNull(post.getAutorAvatar());
        }

        @Test
        @DisplayName("una publicación nueva no tiene reacciones ni marca de like propio")
        void newPostHasNoReactions() {
            Post post = new Post();

            assertEquals(0L, post.getTotalLikes());
            assertFalse(post.isLikedByMe());
        }
    }

    @Nested
    @DisplayName("Asignación de valores")
    class Assignment {

        @Test
        @DisplayName("conserva el contenido y la autoría leídos del grafo")
        void keepsContentAndAuthor() {
            Post post = new Post();
            post.setId("p-1");
            post.setTexto("Hola red");
            post.setMediaUrl("http://minio/imagen.png");
            post.setAutorId("u-1");
            post.setAutorUsername("carlos");

            assertEquals("p-1", post.getId());
            assertEquals("Hola red", post.getTexto());
            assertEquals("http://minio/imagen.png", post.getMediaUrl());
            assertEquals("u-1", post.getAutorId());
            assertEquals("carlos", post.getAutorUsername());
        }

        @Test
        @DisplayName("conserva el total de reacciones y la marca de like propio")
        void keepsReactionTotals() {
            Post post = new Post();
            post.setTotalLikes(7L);
            post.setLikedByMe(true);

            assertEquals(7L, post.getTotalLikes());
            assertTrue(post.isLikedByMe());
        }
    }

    @Nested
    @DisplayName("Contrato de la fecha de creación")
    class FechaCreacion {

        @Test
        @DisplayName("el dominio declara la fecha de creación como epoch millis (tipo long)")
        void domainDeclaresFechaAsLong() {
            Post post = new Post();
            post.setFechaCreacion(1750000000000L);

            // La fecha es epoch millis de punta a punta: el seed la escribe como entero
            // (1727260000000), crearPost usa datetime().epochMillis y el adaptador la lee con
            // asLong(). El dominio la declara como Long para no forzar una coerción que antes
            // rompía el feed con "Cannot coerce INTEGER to Java String".
            assertEquals(1750000000000L, post.getFechaCreacion().longValue());
        }

        @Test
        @DisplayName("una publicación sin fecha no falla al consultar la fecha")
        void fechaCanBeNull() {
            Post post = new Post();

            assertNull(post.getFechaCreacion());
        }
    }
}
