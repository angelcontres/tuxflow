package ec.edu.upse.redsocial.infrastructure.adapter.in.rest;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.Response;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import org.jboss.logging.Logger;

/**
 * Corta las peticiones de búsqueda cuando una misma dirección IP supera el tope por ventana.
 *
 * <p>La búsqueda de usuarios es la lectura más amplia de la API: con dos caracteres ya se pueden
 * recorrer todos los nombres de la comunidad. El mínimo de dos caracteres de {@code
 * UserGraphResource} evita el volcado letra a letra, pero no evita la enumeración, y sin nada más
 * el endpoint es un `GET /api/users` con otro nombre.
 *
 * <p><b>Por qué un filtro y no la anotación {@code @RateLimit} de SmallRye Fault Tolerance.</b> Se
 * probó la anotación sobre el método del recurso y no surte efecto: la extensión queda instalada y
 * la anotación está en el bytecode, pero el interceptor no llega a aplicarse sobre un recurso
 * JAX-RS en este modo de desarrollo, y 30 peticiones seguidas pasaron con un tope de 20
 * configurado. Un límite que no corta es peor que no tenerlo, porque aparenta estar protegido. El
 * filtro sí se ejecuta en el ciclo de petición de REST, que es donde hace falta.
 *
 * <p><b>Por qué por IP y no por sesión.</b> La búsqueda no exige sesión, así que un límite por
 * usuario dejaría pasar justo a quien se quiere parar: alguien sin cuenta que recorre la comunidad
 * con dos letras. El límite global tampoco sirve: en una carrera todo el campus comparte pocas
 * direcciones de salida y el barrido de una sola persona bloquearía a los demás. El coste del
 * límite por IP es que tras un mismo NAT se comparte el cupo, lo que en una facultad puede ser
 * media clase; es un trade-off consciente.
 *
 * <p>El contador vive en memoria y por proceso. Con varias instancias habría que compartirlo --en
 * Redis, por ejemplo-- o el tope se multiplica por el número de nodos. Para una comunidad
 * universitaria en una sola instancia es suficiente, y está anotado como deuda.
 */
@jakarta.ws.rs.ext.Provider
public class FiltroLimiteDeBusqueda implements ContainerRequestFilter {

    private static final Logger LOG = Logger.getLogger(FiltroLimiteDeBusqueda.class);

    /** Peticiones de búsqueda permitidas por ventana y por dirección IP. */
    static final int PETICIONES_POR_VENTANA = 20;

    /** Tamaño de la ventana, en segundos. */
    static final long VENTANA_EN_SEGUNDOS = 1;

    private static final String RUTA_BUSQUEDA = "/buscar";

    /**
     * Contadores por dirección IP, con la ventana en la que se cuentan.
     *
     * <p>{@code ConcurrentHashMap} porque las peticiones llegan en paralelo y el recuento no puede
     * ser una estructura compartida sin sincronizar.
     */
    private static final Map<String, Ventana> CONTADORES = new ConcurrentHashMap<>();

    /** Un contador y la ventana en la que vale. */
    private static final class Ventana {
        private final AtomicInteger cuenta = new AtomicInteger();
        private long iniciaEnSegundos;

        Ventana(long ahora) {
            this.iniciaEnSegundos = ahora;
        }

        /**
         * Suma una petición y devuelve si el tope se pasó.
         *
         * <p>La ventana se renueva aquí en lugar de con un temporizador: sin esta comprobación, las
         * claves de IP nunca se limpian y el mapa crece con cada dirección que consulta alguna vez.
         */
        boolean registrarYPasar(long ahora) {
            if (ahora - iniciaEnSegundos >= VENTANA_EN_SEGUNDOS) {
                iniciaEnSegundos = ahora;
                cuenta.set(0);
            }
            return cuenta.incrementAndGet() > PETICIONES_POR_VENTANA;
        }
    }

    /**
     * Reinicia los contadores por IP. Usado en pruebas para evitar que una ráfaga contamine las
     * aserciones de otras suites que prueban la búsqueda.
     */
    static void reiniciar() {
        CONTADORES.clear();
    }

    @Override
    public void filter(ContainerRequestContext contexto) {
        if (!esBusqueda(contexto)) {
            return;
        }

        String ip = direccionDe(contexto);
        long ahora = System.currentTimeMillis() / 1000;
        boolean excedido =
                CONTADORES.computeIfAbsent(ip, clave -> new Ventana(ahora)).registrarYPasar(ahora);

        if (excedido) {
            LOG.debugf("Búsqueda bloqueada por límite de peticiones para %s", ip);
            // Se aborta la petición aquí, así que no llega al recurso y no toca el grafo. El
            // `Retry-After` dice cuándo reintentar, que es lo que un cliente bien hecho necesita.
            contexto.abortWith(
                    Response.status(Response.Status.TOO_MANY_REQUESTS)
                            .header("Retry-After", VENTANA_EN_SEGUNDOS)
                            .type(jakarta.ws.rs.core.MediaType.APPLICATION_JSON)
                            .entity(
                                    Map.of(
                                            "error",
                                            "Has buscado demasiadas veces seguidas. Espera un momento."))
                            .build());
        }
    }

    /** Sólo aplica a `GET /api/users/buscar`, no al resto de lecturas. */
    private static boolean esBusqueda(ContainerRequestContext contexto) {
        return contexto.getUriInfo().getPath().endsWith(RUTA_BUSQUEDA)
                && "GET".equalsIgnoreCase(contexto.getMethod());
    }

    /**
     * Dirección de la que viene la petición.
     *
     * <p>Usa la remota tal cual, sin confiar en cabeceras `X-Forwarded-For`: esas las pone quien
     * está delante y, sin un proxy de confianza configurado,ergentombArt依据的是信任头部，那等于没限。
     */
    private static String direccionDe(ContainerRequestContext contexto) {
        // El contenedor expone la direccion real en una propiedad que varia por implementacion, asi
        // que se busca sin atar el filtro a una. Si no se encuentra, se cae a una constante: es
        // peor que un limite por IP porque castiga tambien al resto, pero sigue cortando.
        for (String clave :
                new String[] {
                    "org.jboss.resteasy.reactive.container.Request",
                    "org.jboss.resteasy.core.ResteasyContext"
                }) {
            Object peticion = contexto.getProperty(clave);
            if (peticion != null) {
                try {
                    Object remoto = peticion.getClass().getMethod("getRemoteAddr").invoke(peticion);
                    if (remoto != null) {
                        return remoto.toString();
                    }
                } catch (ReflectiveOperationException e) {
                    LOG.debugf("No se pudo leer la direccion remota: %s", e.getMessage());
                }
            }
        }
        return "desconocida";
    }
}
