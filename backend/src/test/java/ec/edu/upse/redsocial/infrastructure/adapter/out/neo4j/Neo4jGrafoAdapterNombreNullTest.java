package ec.edu.upse.redsocial.infrastructure.adapter.out.neo4j;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.model.SugerenciaUsuario;
import ec.edu.upse.redsocial.domain.model.Usuario;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;
import org.neo4j.driver.TransactionCallback;
import org.neo4j.driver.TransactionContext;
import org.neo4j.driver.Value;
import org.neo4j.driver.Values;

/**
 * Cubre la guarda de {@code nombre} nulo en las dos lecturas que la tenían perdida.
 *
 * <p>US-09 la aplicó sólo en {@code obtenerSeguidosEnComun} y dejó estas dos, que devolvían el
 * nombre con {@code .asString()} y sin comprobar. El defecto era invisible mientras esas filas sólo
 * se pintaban en una lista lateral; el perfil ajeno las muestra en un encabezado y en una lista de
 * seguidores, así que se cerró aquí en lugar de dejarlo anotado.
 *
 * <p>El mecanismo del defecto: en Neo4j asignar {@code null} a una propiedad la elimina, y {@code
 * guardarUsuario} hace {@code SET u.nombre = $nombre}. Un usuario guardado sin nombre llega como
 * {@code NullValue}, y {@code NullValue.asString()} no lanza -- devuelve el texto literal {@code
 * "null"}. La respuesta sería un 200 con un nombre inventado.
 */
class Neo4jGrafoAdapterNombreNullTest {

    private Neo4jGrafoAdapter adapter;

    /** Stubea el driver para que la consulta devuelva las dos filas indicadas. */
    @SuppressWarnings("unchecked")
    private void filasDevueltas(Record primera, Record segunda) {
        Driver driver = mock(Driver.class);
        Session session = mock(Session.class);
        TransactionContext tx = mock(TransactionContext.class);
        Result result = mock(Result.class);

        when(driver.session()).thenReturn(session);
        when(session.executeRead(any()))
                .thenAnswer(
                        invocacion ->
                                ((TransactionCallback<Object>) invocacion.getArgument(0))
                                        .execute(tx));
        when(tx.run(anyString(), any(Value.class))).thenReturn(result);
        when(result.hasNext()).thenReturn(true, true, false);
        when(result.next()).thenReturn(primera, segunda);

        adapter = new Neo4jGrafoAdapter();
        adapter.driver = driver;
    }

    /** Valor tal como lo entrega el driver por una propiedad del grafo. */
    private static Value valor(String contenido) {
        return Values.parameters("propiedad", (Object) contenido).get("propiedad");
    }

    @Test
    @DisplayName("obtenerSeguidos deja el nombre en null cuando el nodo no lo tiene")
    void obtenerSeguidosConNombreAusente() {
        filasDevueltas(
                fila("david-mendoza", "david", null, null),
                fila("angel-villon", "angel", "Angel", null));

        List<Usuario> resultado = adapter.obtenerSeguidos("carlos-patino");

        assertEquals(2, resultado.size());
        assertNull(resultado.get(0).getNombre());
        // El identificador siempre está: es la clave del MERGE de guardarUsuario, así que el
        // identificador sigue siendo un enlace válido aunque el nombre no haya llegado.
        assertEquals("david", resultado.get(0).getUsername());
        assertEquals("Angel", resultado.get(1).getNombre());
    }

    @Test
    @DisplayName("obtenerSugerenciasUsuarios deja el nombre en null cuando el nodo no lo tiene")
    void obtenerSugerenciasConNombreAusente() {
        filasDevueltas(
                filaSugerencia("david-mendoza", "david", null, null),
                filaSugerencia("elena-vega", "elena", "Elena Vega", null));

        List<SugerenciaUsuario> resultado = adapter.obtenerSugerenciasUsuarios("carlos-patino");

        assertEquals(2, resultado.size());
        assertNull(resultado.get(0).getNombre());
        assertEquals("david", resultado.get(0).getUsername());
        assertEquals("Elena Vega", resultado.get(1).getNombre());
    }

    /** Fila con la forma que devuelve la consulta de sugerencias. */
    private static Record filaSugerencia(String id, String username, String nombre, String avatar) {
        Record record = mock(Record.class);
        when(record.get("id")).thenReturn(valor(id));
        when(record.get("username")).thenReturn(valor(username));
        when(record.get("nombre")).thenReturn(valor(nombre));
        when(record.get("avatar")).thenReturn(valor(avatar));
        when(record.get("conexionesEnComun")).thenReturn(Values.value(2L));
        when(record.get("seguidosEnComun")).thenReturn(Values.value(List.of("beatriz", "paulo")));
        return record;
    }

    /** Fila con la forma que devuelven seguidos y seguidores. */
    private static Record fila(String id, String username, String nombre, String avatarUrl) {
        Record record = mock(Record.class);
        when(record.get("id")).thenReturn(valor(id));
        when(record.get("username")).thenReturn(valor(username));
        when(record.get("nombre")).thenReturn(valor(nombre));
        when(record.get("avatarUrl")).thenReturn(valor(avatarUrl));
        return record;
    }
}
