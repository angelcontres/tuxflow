#!/usr/bin/env bash
# ==============================================================================
# backup-neo4j.sh - Backup completo de Neo4j (dump binario + export Cypher)
#
# Genera UN directorio por corrida en <repo>/backups/<AAAAmmdd-HHMMSS>/:
#   1. neo4j.dump y system.dump     - imagen binaria de la base (dump offline
#      con neo4j-admin). Es el artefacto real de restauracion ante desastre:
#      rapido, integro y verificable. OJO: neo4j-admin SOLO acepta el archivo
#      con el nombre exacto '<db>.dump', por eso va en directorio propio.
#   2. neo4j.cypher                 - script Cypher legible (via APOC) con
#      esquema y datos. Sirve para sembrar otros entornos, revision manual o
#      migracion. NO reemplaza al dump: APOC exporta leyendo la BD online, no
#      es un snapshot transaccional consistente.
#
# El dump exige la BD offline (edicion Community). El script por lo tanto:
#   detiene el contenedor -> vuelca con un contenedor efimero que reutiliza
#   sus volumenes -> reinicia el contenedor -> espera a que la BD responda.
#   Downtime estimado: ~1 minuto. Pensado para cron (p. ej. 03:00).
#
# Uso:
#   docker/backup-neo4j.sh
#   RETENTION_DAYS=7 docker/backup-neo4j.sh
#   NEO4J_CONTAINER=otro-contenedor docker/backup-neo4j.sh
#
# Requisitos (ya presentes en los compose del repo):
#   - servicio neo4j con el bind mount ./backups:/backups
#   - NEO4J_apoc_export_file_enabled=true
#
# Restore (ver docker/README.md):
#   neo4j-admin database load neo4j --from-path=<repo>/backups/<corrida>
# ==============================================================================
set -euo pipefail

# ------------------------------- Configuracion -------------------------------
CONTAINER="${NEO4J_CONTAINER:-redsocial-neo4j}"
NEO4J_USER="${NEO4J_USER:-neo4j}"
NEO4J_PASSWORD="${NEO4J_PASSWORD:-password123}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
# Import dir dentro de la imagen oficial (server.directories.import=import,
# relativo a /var/lib/neo4j). APOC escribe ahi y luego se copia al run dir.
IMPORT_DIR_IN_CONTAINER="/var/lib/neo4j/import"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
TS="$(date +%Y%m%d-%H%M%S)"
RUN_DIR="$BACKUP_DIR/$TS"
STAGING_DIR="$BACKUP_DIR/.staging"
NEEDS_START=0

log()  { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }
die()  { printf '[%s] ERROR: %s\n' "$(date '+%F %T')" "$*" >&2; exit 1; }

# ------------------------------- Verificaciones ------------------------------
command -v docker >/dev/null 2>&1 || die "docker no esta en el PATH"
docker inspect "$CONTAINER" >/dev/null 2>&1 || die "el contenedor '$CONTAINER' no existe"
[ "$(docker inspect -f '{{.State.Running}}' "$CONTAINER")" = "true" ] \
  || die "el contenedor '$CONTAINER' no esta corriendo"
mkdir -p "$BACKUP_DIR"

IMAGE="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER")"

# Garantiza que el contenedor vuelva a correr aunque el script falle en el
# medio de la fase de dump (set -e) - sin esto un fallo deja prod caida.
ensure_started() {
  if [ "$NEEDS_START" -eq 1 ]; then
    log "Aviso: reiniciando '$CONTAINER' tras un fallo intermedio..."
    docker start "$CONTAINER" >/dev/null 2>&1 || true
  fi
}
trap ensure_started EXIT

# ------------------- Fase 1: dump binario (BD offline) -----------------------
log "Fase 1/3: dump binario de '$CONTAINER' (downtime de ~1 minuto)..."
NEEDS_START=1
docker stop -t 60 "$CONTAINER" >/dev/null
# El entrypoint por defecto de la imagen corre como el usuario 'neo4j' (uid
# 7474), que no puede escribir en /backups; se fuerza --entrypoint sh (root en
# el contenedor; en rootless eso equivale al usuario del host). El dump va a un
# staging porque neo4j-admin escribe 'neo4j.dump' con nombre fijo: sin staging,
# la segunda ejecucion pisaria la primera.
docker run --rm --volumes-from "$CONTAINER" --entrypoint sh "$IMAGE" -c '
  set -e
  rm -rf /backups/.staging
  mkdir -p /backups/.staging
  neo4j-admin database dump neo4j  --to-path=/backups/.staging
  neo4j-admin database dump system --to-path=/backups/.staging
  # 644 explícito: en Docker real esto corre como root y el usuario de cron
  # (dueño del directorio) tiene que poder leer/rsyncear los archivos.
  chmod 644 /backups/.staging/*.dump
'
docker start "$CONTAINER" >/dev/null
NEEDS_START=0
log "Contenedor levantado."

# Promueve el staging al directorio de la corrida (neo4j-admin exige el
# nombre exacto '<db>.dump' para poder cargarlo despues).
mkdir "$RUN_DIR"
for db in neo4j system; do
  [ -s "$STAGING_DIR/$db.dump" ] \
    || die "dump ausente o vacio: $STAGING_DIR/$db.dump"
  mv "$STAGING_DIR/$db.dump" "$RUN_DIR/$db.dump"
done
rmdir "$STAGING_DIR"

# ---------------- Espera a que la BD vuelva a responder ----------------------
log "Esperando a que Neo4j acepte consultas..."
ready=0
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" \
      "RETURN 1;" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 5
done
[ "$ready" -eq 1 ] || die "Neo4j no volvio a estar disponible en 5 min; revisa 'docker logs $CONTAINER'"

# ---------------- Fase 2: export Cypher legible (APOC, online) ---------------
log "Fase 2/3: export Cypher con APOC..."
EXPORT_NAME="neo4j.cypher"
docker exec -e LANG=C.UTF-8 -e LC_ALL=C.UTF-8 "$CONTAINER" \
  cypher-shell -u "$NEO4J_USER" -p "$NEO4J_PASSWORD" --format plain \
  "CALL apoc.export.cypher.all('${EXPORT_NAME}', {format: 'cypher-shell'});" \
  || die "falló apoc.export.cypher.all (¿NEO4J_apoc_export_file_enabled=true en el compose?)"
# 644 por la misma razón que en la fase 1 (el archivo lo crea root con 700).
docker exec "$CONTAINER" chmod 644 "$IMPORT_DIR_IN_CONTAINER/$EXPORT_NAME"
docker cp "$CONTAINER:$IMPORT_DIR_IN_CONTAINER/$EXPORT_NAME" "$RUN_DIR/$EXPORT_NAME" \
  || die "no se pudo copiar el export desde el contenedor"

# ------------------------- Fase 3: retencion --------------------------------
log "Fase 3/3: borrando corridas con mas de ${RETENTION_DAYS} dias..."
find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" \
  -exec rm -rf {} +

log "Backup OK. Artefactos de la corrida $TS en $RUN_DIR:"
ls -lh "$RUN_DIR"
