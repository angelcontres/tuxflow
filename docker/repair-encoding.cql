// ==============================================================================
// Reparación de caracteres de reemplazo (U+FFFD) introducidos al cargar el seed
// ==============================================================================
// Cuándo hace falta: solo si `docker/neo4j-seed.cql` se cargó por stdin sin
// forzar locale UTF-8. En ese caso cada byte de un carácter multibyte se
// convirtió en un U+FFFD, así que "¡" quedó como "��" y "🚀" como "����".
//
// Es idempotente: se puede correr las veces que haga falta. No borra nada,
// solo reescribe cuatro propiedades. Cargar SIEMPRE con docker/seed.sh:
//   docker/seed.sh docker/repair-encoding.cql
// ==============================================================================

// --- 1. Textos de las publicaciones del seed -------------------------------
// Fuente: docker/neo4j-seed.cql (verificado byte a byte contra el archivo).

MATCH (p:Post {id: 'post-b1'})
SET p.texto = '¡Bienvenidos a la Red Social Distribuida en UPSE! 🚀 Conexión Neo4j y MinIO lista.';

MATCH (p:Post {id: 'post-p1'})
SET p.texto = 'Microservicio Quarkus 3 corriendo en modo JVM con bajo consumo de memoria ⚡';

MATCH (p:Post {id: 'post-d1'})
SET p.texto = 'Publicación de prueba creada por David (Carlos NO la verá en su feed)';

// --- 2. Nombre de carlos ----------------------------------------------------
// Único Usuario con caracteres no-ASCII: "Carlos Patiño".

MATCH (u:Usuario {id: 'carlos-patino'})
SET u.nombre = 'Carlos Patiño';

// --- 3. Verificación --------------------------------------------------------
// Debe devolver 0. Si devuelve filas, queda texto sucio en la base.
//   MATCH (n)
//   UNWIND keys(n) AS k
//   WITH n, k, n[k] AS v
//   WHERE v IS NOT NULL AND toString(v) CONTAINS '\uFFFD'
//   RETURN labels(n)[0] AS tipo, k AS propiedad, toString(v) AS valor;