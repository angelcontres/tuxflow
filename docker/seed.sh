#!/usr/bin/env bash
# ==============================================================================
# Carga un archivo .cql en Neo4j preservando UTF-8
# ==============================================================================
# Por qué existe este script:
#
# cypher-shell decodifica la entrada de stdin usando el locale del contenedor.
# La imagen oficial de neo4j corre con LC_CTYPE=POSIX y LANG vacío, así que sin
# este wrapper cada byte de un carácter multibyte que entra por stdin se
# convierte en un U+FFFD. El síntoma es texto con "��" donde debería haber "¡",
# "ó" o un emoji, y solo aparece si el .cql se carga por stdin.
#
# Las consultas que van como argumento (cypher-shell "MATCH ...") no sufren el
# problema. Solo lo sufre la entrada por stdin, que es justo como se carga un
# seed.
#
# Uso:
#   docker/seed.sh                        # carga docker/neo4j-seed.cql (pide --wipe)
#   docker/seed.sh --wipe                 # idem, confirmando el borrado
#   docker/seed.sh docker/repair-encoding.cql
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER="${NEO4J_CONTAINER:-redsocial-neo4j}"
FILE="$SCRIPT_DIR/neo4j-seed.cql"
ALLOW_WIPE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --wipe) ALLOW_WIPE=1; shift ;;
    -h|--help) sed -n '2,22p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    -*) echo "Opción desconocida: $1" >&2; exit 2 ;;
    *) FILE="$1"; shift ;;
  esac
done

[[ -f "$FILE" ]] || { echo "No existe el archivo: $FILE" >&2; exit 1; }

if ! docker exec "$CONTAINER" cypher-shell -u neo4j -p "${NEO4J_PASSWORD:-password123}" \
     "RETURN 1" >/dev/null 2>&1; then
  echo "No se pudo conectar con $CONTAINER. ¿Está levantado? (docker compose ps)" >&2
  exit 1
fi

# Aviso de borrado: neo4j-seed.cql arranca con MATCH (n) DETACH DELETE n, que
# elimina usuarios, relaciones y publicaciones. Se detiene acá salvo que venga
# --wipe explícito, para que nadie tire la base por accidente.
if grep -q "DETACH DELETE" "$FILE" && [[ "$ALLOW_WIPE" -eq 0 ]]; then
  cat >&2 <<EOF

  $FILE borra TODA la base (DETACH DELETE).

  Se perderán los usuarios creados desde la app, las relaciones que no estén
  en el seed y cualquier publicación nueva.

  Para seguir de todos modos:
      docker/seed.sh --wipe $FILE

  Para reparar sin borrar nada:
      docker/seed.sh docker/repair-encoding.cql

EOF
  exit 1
fi

# LANG/LC_ALL es lo que arregla el problema: sin esto, stdin se decodifica con
# el locale POSIX del contenedor y cada byte multibyte se pierde.
docker exec -i \
  -e LANG=C.UTF-8 \
  -e LC_ALL=C.UTF-8 \
  "$CONTAINER" cypher-shell \
    -u neo4j -p "${NEO4J_PASSWORD:-password123}" \
    --format plain < "$FILE"

echo "Cargado: $(basename "$FILE")"