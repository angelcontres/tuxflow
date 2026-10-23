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

## Backup (Neo4j)

`backup-neo4j.sh` genera, **una carpeta por corrida**, en
`backups/<AAAAmmdd-HHMMSS>/` con estos artefactos:

| Archivo        | Qué es                                 | Para qué sirve                                     |
| -------------- | -------------------------------------- | -------------------------------------------------- |
| `neo4j.dump`   | Dump binario offline (`neo4j-admin`)   | **Restore real ante desastre**: rápido y verificable |
| `system.dump`  | Dump de la BD `system`                 | Usuarios y roles del DBMS                          |
| `neo4j.cypher` | Script Cypher legible (APOC)           | Sembrar otros entornos, revisión manual, migración |

> El `.cypher` **no reemplaza al dump**: APOC exporta leyendo la BD online, no
> es un snapshot transaccional consistente. Para prod, el backup de verdad es
> el dump; el `.cypher` es el complemento portátil.

```bash
# Correr a mano (downtime de ~1 min, la BD queda offline durante el dump):
docker/backup-neo4j.sh

# Automatizar con cron (todos los días 03:00):
0 3 * * * /ruta/al/repo/docker/backup-neo4j.sh >> /var/log/neo4j-backup.log 2>&1
```

- **Retención**: 30 días por defecto, configurable con `RETENTION_DAYS`.
- **Requisitos en el compose** (ya presentes en los tres compose del repo):
  bind mount `./backups:/backups:z` (el `:z` es por SELinux: sin él el
  contenedor no puede escribir el directorio) y
  `NEO4J_apoc_export_file_enabled=true`.
- **Cron**: el usuario del crontab necesita el PATH de `docker` (o la ruta
  absoluta) y pertenecer al grupo `docker`.
- **Fuera de la máquina**: un backup en el mismo disco que la BD no sobrevive
  al servidor. Sincronizar después de cada corrida, por ejemplo:
  `rsync -a backups/ otra-maquina:/backups-neo4j/` o
  `aws s3 sync backups/ s3://tu-bucket/neo4j/`.

### Restore del dump

```bash
docker stop -t 60 redsocial-neo4j
docker run --rm --volumes-from redsocial-neo4j --entrypoint sh neo4j:5.20-community \
  -c 'neo4j-admin database load neo4j --from-path=/backups/<AAAAmmdd-HHMMSS>'
docker start redsocial-neo4j
```

`--from-path` es el **directorio** que contiene `neo4j.dump` (neo4j-admin
rechaza cualquier otro nombre de archivo). Verificar después con
`MATCH (n) RETURN count(n);`.

### Aplicar el .cypher (instancia nueva o vacía)

```bash
docker exec -i -e LANG=C.UTF-8 -e LC_ALL=C.UTF-8 redsocial-neo4j \
  cypher-shell -u neo4j -p password123 --format plain < backups/<corrida>/neo4j.cypher
```

Ojo: el archivo crea constraints (`... IS UNIQUE`), así que **choca si la BD
ya tiene datos o constraints**; usálo contra una BD vacía (o borrando antes
con `MATCH (n) DETACH DELETE n;`). `LANG=C.UTF-8` no es opcional: sin él se
pierden los acentos y emojis (ver la tabla de `seed.sh` arriba).

### Verificar que el backup sirve

Un backup que nunca se restauró no es un backup. Contra una instancia
descartable (volumen scratch, sin puertos), restaurar y comparar conteos con
la origen:

```bash
docker volume create scratch-neo4j
docker run --rm -v scratch-neo4j:/data -v "$PWD/backups/<corrida>":/incoming:z \
  --entrypoint sh neo4j:5.20-community \
  -c 'neo4j-admin database load neo4j --from-path=/incoming'
# levantar una instancia efímera con ese volumen y comparar:
#   MATCH (n) RETURN count(n);   MATCH ()-[r]->() RETURN count(r);
docker volume rm scratch-neo4j
```
