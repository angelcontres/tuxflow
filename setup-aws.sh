#!/usr/bin/env bash
# ==============================================================================
# Script de Automatización Completa para AWS EC2 (Zero-Touch Setup)
# Red Social Distribuida - UPSE
# ==============================================================================
set -euo pipefail

echo "==============================================================================="
echo "   INICIALIZACIÓN AUTOMÁTICA DEL SERVIDOR AWS EC2"
echo "==============================================================================="

# 1. Configurar SWAP de 2GB para evitar cierres por falta de RAM (OOM)
SWAP_ACTUAL=$(free -m | awk '/^Swap:/ {print $2}')
if [ "${SWAP_ACTUAL:-0}" -lt 1000 ]; then
    echo "[1/4] Configurando 2GB de Memoria Swap..."
    if [ ! -f /swapfile ]; then
        sudo fallocate -l 2G /swapfile 2>/dev/null || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
        sudo chmod 600 /swapfile
        sudo mkswap /swapfile
    fi
    sudo swapon /swapfile 2>/dev/null || true
    if ! grep -q '/swapfile' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi
    echo "  [OK] Memoria Swap habilitada con éxito."
else
    echo "  [OK] Memoria Swap ya configurada (${SWAP_ACTUAL} MB)."
fi

# 2. Verificar o Instalar Docker Engine
echo "[2/4] Verificando Docker Engine..."
if ! command -v docker &> /dev/null; then
    echo "  Docker no detectado. Instalando Docker automáticamente..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm -f get-docker.sh
    echo "  [OK] Docker instalado."
else
    echo "  [OK] Docker ya está instalado."
fi

# 3. Configurar Permisos de Docker para el usuario y el Runner
echo "[3/4] Configurando permisos de usuario para Docker..."
sudo usermod -aG docker "$USER" 2>/dev/null || true

# Si existe un usuario dedicado para el runner de GitHub, también le damos permisos
for RUNNER_USER in actions-runner runner-user ubuntu ec2-user; do
    if id "$RUNNER_USER" &>/dev/null; then
        sudo usermod -aG docker "$RUNNER_USER" 2>/dev/null || true
    fi
done

sudo systemctl enable docker
sudo systemctl start docker
echo "  [OK] Docker daemon activo y permisos asignados."

# 4. Ajustar socket de Docker para el runner actual sin requerir reinicio de sesión
sudo chmod 666 /var/run/docker.sock 2>/dev/null || true

echo "==============================================================================="
echo "   [LISTO] La máquina de AWS está 100% preparada para desplegar."
echo "==============================================================================="
