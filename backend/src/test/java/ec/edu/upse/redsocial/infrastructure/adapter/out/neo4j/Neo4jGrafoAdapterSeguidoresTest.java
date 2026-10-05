package ec.edu.upse.redsocial.infrastructure.adapter.out.neo4j;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import ec.edu.upse.redsocial.domain.model.Usuario;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.neo4j.driver.Driver;
import org.neo4j.driver.Record;
import org.neo4j.driver.Result;
import org.neo4j.driver.Session;
import org.neo4j.driver.TransactionCallback;
import org.neo4j.driver.TransactionContext;
import org.neo4j.driver.Value;
import org.neo4j.driver.Values;

/**
 * Cubre la lectura de seguidores (la arista de [:SIGUE] leída al revés) sin levantar un Neo4j.
 *
 * <p>El caso que más importa aquí es el de la dirección de la flecha: con la semilla del proyecto
 * las dos consultas dan conjuntos distintos, así que una flecha invertida se ve sin necesidad de
 * tener un grafo montado.
 */
class Neo4jGrafoAdapterSeguidoresTest {

    private TransactionContext tx;
    private Neo4jGrafoAdapter adapter;

    /** Stubea el driver para que la consulta devuelva las filas indicadas. */
    @SuppressWarnings("unchecked")
    private void filasDevueltas(Record... filas) {
        Driver driver = mock(Driver.class);
        Session session = mock(Session.class);
        tx = mock(TransactionContext.class);
        Result result = mock(Result.class);

        when(driver.session()).thenReturn(session);
        when(session.executeRead(any()))
                .thenAnswer(
                        invocacion ->
                                ((TransactionCallback<Object>) invocacion.getArgument(0))
                                        .execute(tx));
        when(tx.run(anyString(), any(Value.class))).thenReturn(result);
        when(result.hasNext()).thenReturn(true, true, false);
        when(result.next()).thenReturn(filas[0], filas[1]);

        adapter = new Neo4jGrafoAdapter();
        adapter.driver = driver;
    }

    /** Valor tal como lo entrega el driver por una propiedad del grafo. */
    private static Value valor(String contenido) {
        return Values.parameters("propiedad", (Object) contenido).get("propiedad");
    }

    /** Construye una fila con la forma que devuelven seguidos y seguidores. */
    private Record fila(String id, String username, String nombre, String avatarUrl) {
        Record record = mock(Record.class);
        when(record.get("id")).thenReturn(valor(id));
        when(record.get("username")).thenReturn(valor(username));
        when(record.get("nombre")).thenReturn(valor(nombre));
        when(record.get("avatarUrl")).thenReturn(valor(avatarUrl));
        return record;
    }

    @Test
    @DisplayName("obtenerSeguidores devuelve las personas que siguen al perfil")
    void devuelveLasPersonasQueSiguenAlPerfil() {
        filasDevueltas(
                fila("carlos-patino", "carlos", "Carlos Patiño", "https://cdn/carlos.png"),
                fila("paulo-orrala", "paulo", "Paulo Orrala", null));

        List<Usuario> resultado = adapter.obtenerSeguidores("beatriz-silva");

        assertEquals(2, resultado.size());
        assertEquals("carlos-patino", resultado.get(0).getId());
        assertEquals("carlos", resultado.get(0).getUsername());
        assertEquals("Carlos Patiño", resultado.get(0).getNombre());
        assertEquals("https://cdn/carlos.png", resultado.get(0).getAvatarUrl());
        assertEquals("Paulo Orrala", resultado.get(1).getNombre());
    }

    @Test
    @DisplayName("la consulta entra por el usuario que se está mirando, no por el que sigue")
    void laFlechaEntraPorElPerfilQueSeMira() {
        // Invertir la flecha devolvería a quién sigue el perfil, que es obtenerSeguidos. Con la
        // semilla del proyecto las dos dan conjuntos distintos: carlos-patino sigue a beatriz-silva
        // (así que beatriz tiene a carlos como seguidor y carlos no tiene a beatriz como seguido),
        // y elena-vega sigue a carlos-patino y a paulo-orrala. Una flecha invertida no produce una
        // lista vacía que se note: produce la lista espejo, que es una respuesta verosímil y
        // equivoca al mismo tiempo.
        filasDevueltas(
                fila("carlos-patino", "carlos", "Carlos Patiño", null),
                fila("paulo-orrala", "paulo", "Paulo Orrala", null));

        adapter.obtenerSeguidores("beatriz-silva");

        ArgumentCaptor<String> cypher = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Value> params = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(cypher.capture(), params.capture());

        String consulta = cypher.getValue().replaceAll("\\s+", " ").trim();
        assertTrue(
                consulta.contains("MATCH (s:Usuario)-[:SIGUE]->(u:Usuario {id: $userId})"),
                "La consulta no lee la arista hacia el perfil que se mira: " + consulta);
        assertTrue(
                !consulta.contains("(u:Usuario {id: $userId})-[:SIGUE]->(s:Usuario)"),
                "Las flechas están invertidas: devolvería a quién sigue el perfil: " + consulta);

        Map<String, Object> enviados = params.getValue().asMap();
        assertEquals("beatriz-silva", enviados.get("userId"));
    }

    @Test
    @DisplayName("la consulta lleva un tope, y el tope viaja como parámetro")
    void llevaTopeDeSeguridad() {
        filasDevueltas(
                fila("carlos-patino", "carlos", "Carlos Patiño", null),
                fila("paulo-orrala", "paulo", "Paulo Orrala", null));

        adapter.obtenerSeguidores("beatriz-silva");

        ArgumentCaptor<String> cypher = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Value> params = ArgumentCaptor.forClass(Value.class);
        verify(tx).run(cypher.capture(), params.capture());

        String consulta = cypher.getValue().replaceAll("\\s+", " ").trim();
        assertTrue(consulta.contains("LIMIT $limite"), "La consulta no lleva tope: " + consulta);

        long limite = ((Number) params.getValue().asMap().get("limite")).longValue();
        assertEquals(500, limite, "El tope de seguidores cambió sin que nadie lo decidiera");
    }

    @Test
    @DisplayName("un seguidor sin nombre llega con nombre null, no con el texto \"null\"")
    void seguidorSinNombreNoSeConvierteEnElTextoNull() {
        // La misma guarda que ya aplica obtenerSeguidosEnComun. guardarUsuario borra la propiedad
        // cuando recibe null, así que el nodo llega como NullValue, y NullValue.asString() no
        // lanza: devuelve el texto literal "null". Sin la guarda la API responde 200 con un nombre
        // inventado, que es peor que un 500 porque no se nota. El perfil ajeno muestra estos
        // nombres en una lista de seguidores, así que el defecto pasó a ser visible.
        filasDevueltas(
                fila("david-mendoza", "david", null, null),
                fila("carlos-patino", "carlos", "Carlos Patiño", null));

        List<Usuario> resultado = adapter.obtenerSeguidores("beatriz-silva");

        assertEquals(2, resultado.size());
        assertNull(resultado.get(0).getNombre());
        assertNull(resultado.get(0).getAvatarUrl());
        assertEquals("david", resultado.get(0).getUsername());
        assertEquals("Carlos Patiño", resultado.get(1).getNombre());
    }

    @Test
    @DisplayName("un seguidor sin avatar degrada a null en vez de romper la respuesta")
    void seguidorSinAvatarDegradaANull() {
        filasDevueltas(
                fila("carlos-patino", "carlos", "Carlos Patiño", null),
                fila("angel-villon", "angel", "Angel Villon", null));

        List<Usuario> resultado = adapter.obtenerSeguidores("beatriz-silva");

        assertNull(resultado.get(0).getAvatarUrl());
        assertNull(resultado.get(1).getAvatarUrl());
        assertEquals("Angel Villon", resultado.get(1).getNombre());
    }
}
