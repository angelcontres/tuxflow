# Configuración de Docker y Entorno

Este directorio contiene utilidades y documentación de despliegue para la arquitectura distribuida.

## Servicios Orquestados

1. **Neo4j (`redsocial-neo4j`):**
   - Puerto HTTP/Browser: `7474`
   - Puerto Bolt: `7687`
   - Credenciales: `neo4j` / `password123`
   - Plugins: APOC

2. **MinIO (`redsocial-minio`):**
   - Puerto API S3: `9000`
   - Puerto Consola Web: `9001`
   - Credenciales: `minioadmin` / `minioadmin`
   - Bucket: `redsocial-media`

3. **Backend Quarkus (`redsocial-backend`):**
   - Puerto REST/WebSocket: `8080`
   - Dev UI: `http://localhost:8080/q/dev`

4. **Frontend React (`redsocial-frontend`):**
   - Puerto Web: `3000`

## Comandos Útiles

```bash
# Levantar todos los servicios en segundo plano y reconstruir imágenes
docker compose up --build -d

# Ver registros en tiempo real
docker compose logs -f

# Detener todos los contenedores y remover volúmenes de datos
docker compose down -v
```

## Datos Iniciales (seed)

El seed **no** se carga solo: el servicio de Neo4j no monta ningún `.cql` ni
ejecuta script de inicio. Hay que cargarlo a mano con `seed.sh`.

```bash
# Carga los datos iniciales. Pide confirmación porque BORRA la base entera:
docker/seed.sh --wipe

# Reparar textos con "��" sin borrar nada (idempotente):
docker/seed.sh docker/repair-encoding.cql
```

### Por qué hay que usar `seed.sh` y no `cat` directo

`cypher-shell` decodifica la entrada por **stdin** usando el locale del
contenedor. La imagen oficial de Neo4j corre con `LC_CTYPE=POSIX` y `LANG`
vacío, así que **cada byte de un carácter multibyte se convierte en un
carácter de reemplazo (U+FFFD)**. En la práctica:

| En el archivo | Cargado con `cat \| cypher-shell` | Cargado con `seed.sh` |
| ------------- | ---------------------------------- | --------------------- |
| `¡` (2 bytes) | `��` | `¡` |
| `ó` (2 bytes) | `��` | `ó` |
| `🚀` (4 bytes) | `����` | `🚀` |

`seed.sh` fuerza `LANG=C.UTF-8` en el `docker exec`, que es lo que evita la
pérdida. La consulta va por stdin justamente porque los archivos `.cql` se
cargan así; por eso el problema solo se manifestaba con acentos y emojis.

Para comprobar si hay texto dañado:

```bash
docker exec redsocial-neo4j cypher-shell -u neo4j -p password123 --format plain "
MATCH (n)
UNWIND keys(n) AS k
WITH n, k, n[k] AS v
WHERE v IS NOT NULL AND toString(v) CONTAINS '\uFFFD'
RETURN labels(n)[0] AS tipo, k AS propiedad, toString(v) AS valor;"
```

Debe devolver `0` filas. Ojo: para *leer* acentos en la terminal también hace
falta el locale, si no `cypher-shell` imprime `?` en lugar del carácter
(eso es solo output, los datos están bien):

```bash
docker exec -e LANG=C.UTF-8 -e LC_ALL=C.UTF-8 redsocial-neo4j \
  cypher-shell -u neo4j -p password123 --format plain "MATCH (n) RETURN n;"
```
