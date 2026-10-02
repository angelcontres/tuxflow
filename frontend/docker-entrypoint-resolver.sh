#!/bin/sh
# nginx resuelve "backend" una sola vez al arrancar y guarda la IP en memoria.
# Si el contenedor del backend se recrea y toma otra IP, nginx sigue apuntando
# a la vieja y cada /api responde 502 hasta que se reinicia nginx también.
#
# La config usa un resolver por defecto (127.0.0.11, el de Docker) para que el
# archivo siempre sea válido. Acá lo sustituimos por el nameserver real del
# contenedor, que en Docker es 127.0.0.11 pero en podman es el de aardvark.
set -eu

CONF=/etc/nginx/conf.d/default.conf

ns="$(awk '/^nameserver/ { print $2; exit }' /etc/resolv.conf)"

if [ -n "$ns" ] && [ "$ns" != "127.0.0.11" ]; then
  sed -i "s|resolver 127\.0\.0\.11|resolver $ns|" "$CONF"
  echo "nginx: resolver upstream -> $ns"
fi