#!/bin/bash
# ===============================================================================
# Script de Despliegue Automatizado para Red Social Distribuida
# Integrantes: Paulo Orrala, Carlos Patino, Angel Villon
# ===============================================================================

# Función para mostrar ayuda
show_help() {
    echo "==============================================================================="
    echo "                  AYUDA DEL COMANDO DE DESPLIEGUE"
    echo "==============================================================================="
    echo "Uso:"
    echo "  ./desplegar.sh [COMANDO]"
    echo ""
    echo "Comandos disponibles:"
    echo "  (sin argumento) : Construye, levanta la red distribuida, carga datos y abre la app."
    echo "  stop            : Detiene y apaga los contenedores."
    echo "  down            : Detiene y apaga los contenedores."
    echo "  restart         : Reinicia toda la arquitectura."
    echo "  seed            : Vuelve a ejecutar la carga de datos semilla en Neo4j."
    echo "  logs            : Muestra la consola de logs en vivo de todos los servicios."
    echo "  status          : Lista los contenedores en ejecucion y sus puertos."
    echo "  ps              : Lista los contenedores en ejecucion y sus puertos."
    echo "  help            : Muestra este mensaje de ayuda."
    echo "==============================================================================="
    exit 0
}

# Comprobar argumentos
case "$1" in
    help|--help|-h|-\?)
        show_help
        ;;
    stop|down)
        echo "Deteniendo todos los contenedores de la Red Social Distribuida..."
        docker compose down
        echo "[OK] Servicios detenidos correctamente."
        exit 0
        ;;
    restart)
        echo "Reiniciando todos los servicios..."
        docker compose down
        # continuar con el flujo normal
        ;;
    logs)
        echo "Mostrando logs en tiempo real (Presiona Ctrl+C para salir)..."
        docker compose logs -f
        exit 0
        ;;
    status|ps)
        echo "Estado actual de los contenedores:"
        docker compose ps
        exit 0
        ;;
    seed)
        seed_only=true
        ;;
    "")
        # despliegue normal
        ;;
    *)
        echo "Comando no reconocido: $1"
        show_help
        ;;
esac

check_prerequisites() {
    clear
    echo "==============================================================================="
    echo "       RED SOCIAL DISTRIBUIDA - DESPLIEGUE CON UN SOLO COMANDO"
    echo "       Universidad Estatal Peninsula de Santa Elena (UPSE)"
    echo "==============================================================================="
    echo ""
    echo "[1/4] Verificando requisitos de entorno..."

    if ! command -v docker &> /dev/null; then
        echo ""
        echo "[ERROR] Docker no esta instalado o no se encuentra en el PATH."
        echo "Por favor instala Docker: https://docs.docker.com/engine/install/"
        echo ""
        read -p "Presiona Enter para salir..."
        exit 1
    fi

    if ! docker info &> /dev/null; then
        echo ""
        echo "[ERROR] El daemon de Docker no se esta ejecutando actualmente."
        echo "Por favor inicia Docker y vuelve a ejecutar este script."
        echo ""
        read -p "Presiona Enter para salir..."
        exit 1
    fi

    echo "[OK] Docker y Docker Compose detectados y listos."
    echo ""
}

deploy_all() {
    echo "[2/4] Construyendo y levantando contenedores (Neo4j, MinIO, Backend, Frontend)..."
    if ! docker compose up --build -d; then
        echo ""
        echo "[ERROR] Fallo la construccion o inicio de los contenedores."
        echo "Revisa los logs con: docker compose logs"
        echo ""
        read -p "Presiona Enter para salir..."
        exit 1
    fi

    echo ""
    echo "[3/4] Esperando a que el grafo Neo4j este listo para recibir consultas..."
    RETRIES=35
    NEO4J_READY=false
    while [ $RETRIES -gt 0 ]; do
        if docker exec redsocial-neo4j cypher-shell -u neo4j -p password123 "RETURN 1;" >/dev/null 2>&1; then
            NEO4J_READY=true
            break
        fi
        sleep 2
        RETRIES=$((RETRIES-1))
        if [ $RETRIES -gt 0 ]; then
            echo "    Esperando conexion Bolt con Neo4j... (intentos restantes: $RETRIES)"
        fi
    done

    if [ "$NEO4J_READY" = false ]; then
        echo "[ADVERTENCIA] Neo4j tardo mas de lo esperado en iniciar. Continuando..."
    else
        echo "[OK] Neo4j esta en linea y saludable."
    fi
    echo ""
}

seed_database() {
    echo "[4/4] Inyectando dataset semilla en Neo4j (usuarios, relaciones y posts)..."
    # Se delega en docker/seed.sh y no se carga el .cql aca a mano. Motivo: la
    # imagen de neo4j corre con LC_CTYPE=POSIX, y al mandar el .cql por stdin sin
    # forzar locale cada byte de un caracter multibyte se convierte en un U+FFFD,
    # dejando "¡" como "��" y el emoji del post de Paulo como "���".
    # Tambien centraliza el aviso de borrado: el seed arranca con DETACH DELETE.
    if [ ! -f "docker/neo4j-seed.cql" ]; then
        echo "[ADVERTENCIA] No se encontro el archivo docker/neo4j-seed.cql."
        echo ""
        return
    fi

    if [ ! -x "docker/seed.sh" ]; then
        chmod +x "docker/seed.sh" 2>/dev/null || true
    fi

    if docker/seed.sh --wipe docker/neo4j-seed.cql >/dev/null 2>&1; then
        echo "[OK] Datos semilla inyectados exitosamente en el grafo."
    else
        echo "[ADVERTENCIA] No se pudo cargar el archivo cql automaticamente."
        echo "               Para reintentar: docker/seed.sh --wipe docker/neo4j-seed.cql"
    fi
    echo ""
}

summary() {
    echo "==============================================================================="
    echo "               DESPLIEGUE DISTRIBUIDO COMPLETADO CON EXITO"
    echo "==============================================================================="
    echo ""
    echo " Enlaces directos de acceso:"
    echo " -----------------------------------------------------------------------------"
    echo " [+] Frontend Web SPA:     http://localhost:3000"
    echo " [+] Backend REST API:     http://localhost:8080/api/users"
    echo " [+] Swagger UI:           http://localhost:8080/q/swagger-ui"
    echo " [+] Quarkus Dev UI:       http://localhost:8080/q/dev"
    echo " [+] Neo4j Browser:        http://localhost:7474   (User: neo4j / Pass: password123)"
    echo " [+] MinIO Console (S3):   http://localhost:9001   (User: minioadmin / Pass: minioadmin)"
    echo " [+] WebSocket Chat:       ws://localhost:8080/chat/{userId}"
    echo ""
    echo " Comandos rapidos de gestion:"
    echo " * Ver logs en tiempo real:    ./desplegar.sh logs"
    echo " * Detener servicios:          ./desplegar.sh stop"
    echo " * Reiniciar servicios:        ./desplegar.sh restart"
    echo " * Re-cargar datos semilla:    ./desplegar.sh seed"
    echo " * Ver estado de contenedores: ./desplegar.sh status"
    echo "==============================================================================="
    echo ""

    read -p "Deseas abrir la aplicacion en tu navegador ahora? (S/N) [S]: " OPEN_BROWSER
    OPEN_BROWSER=${OPEN_BROWSER:-S}
    
    if [[ "$OPEN_BROWSER" =~ ^[Ss]$ ]]; then
        echo "Abriendo http://localhost:3000 en el navegador predeterminado..."
        if command -v xdg-open > /dev/null; then
            xdg-open http://localhost:3000 &> /dev/null
        elif command -v sensible-browser > /dev/null; then
            sensible-browser http://localhost:3000 &> /dev/null
        else
            echo "No se encontro un comando para abrir el navegador automaticamente. Puedes abrir http://localhost:3000 manualmente."
        fi
    fi

    echo ""
    read -p "Para salir presiona cualquier tecla..." -n 1 -s
    echo ""
    exit 0
}

# Flujo de ejecución
if [ "$seed_only" = true ]; then
    seed_database
    exit 0
fi

check_prerequisites
deploy_all
seed_database
summary
