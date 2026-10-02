@echo off
setlocal enabledelayedexpansion
title Red Social Distribuida - Despliegue Automatizado
chcp 65001 >nul

:: ===============================================================================
:: Script de Despliegue Automatizado para Red Social Distribuida
:: Integrantes: Paulo Orrala, Carlos Patino, Angel Villon
:: ===============================================================================

:: Argumentos opcionales soportados:
::   desplegar.bat           -- Construye, levanta contenedores, inyecta semilla y abre la app
::   desplegar.bat stop      -- Detiene todos los contenedores
::   desplegar.bat down      -- Detiene y elimina contenedores y redes
::   desplegar.bat restart   -- Reinicia todos los servicios
::   desplegar.bat logs      -- Muestra logs en tiempo real
::   desplegar.bat seed      -- Reinicia e inyecta los datos semilla en Neo4j
::   desplegar.bat status    -- Muestra el estado actual de los contenedores
::   desplegar.bat help      -- Muestra la ayuda de comandos

if /i "%~1"=="help" goto show_help
if /i "%~1"=="--help" goto show_help
if /i "%~1"=="-h" goto show_help
if /i "%~1"=="/?" goto show_help

if /i "%~1"=="stop" goto stop_services
if /i "%~1"=="down" goto stop_services
if /i "%~1"=="restart" goto restart_services
if /i "%~1"=="logs" goto view_logs
if /i "%~1"=="seed" goto seed_database
if /i "%~1"=="status" goto check_status
if /i "%~1"=="ps" goto check_status

goto check_prerequisites

:: ===============================================================================
:: 1. VERIFICACION DE REQUISITOS
:: ===============================================================================
:check_prerequisites
cls
echo ===============================================================================
echo        RED SOCIAL DISTRIBUIDA - DESPLIEGUE CON UN SOLO COMANDO
echo        Universidad Estatal Peninsula de Santa Elena (UPSE)
echo ===============================================================================
echo.
echo [1/4] Verificando requisitos de entorno...

where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Docker no esta instalado o no se encuentra en el PATH.
    echo Por favor instala Docker Desktop: https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Docker Desktop no se esta ejecutando actualmente.
    echo Por favor inicia Docker Desktop y vuelve a ejecutar este archivo.
    echo.
    pause
    exit /b 1
)

echo [OK] Docker y Docker Compose detectados y listos.
echo.

:: ===============================================================================
:: 2. LEVANTAR CONTENEDORES CON DOCKER COMPOSE
:: ===============================================================================
:deploy_all
echo [2/4] Construyendo y levantando contenedores (Neo4j, MinIO, Backend, Frontend)...
docker compose up --build -d
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Fallo la construccion o inicio de los contenedores.
    echo Revisa los logs con: docker compose logs
    echo.
    pause
    exit /b 1
)

echo.
echo [3/4] Esperando a que el grafo Neo4j este listo para recibir consultas...
set RETRIES=35
:wait_neo4j
docker exec redsocial-neo4j cypher-shell -u neo4j -p password123 "RETURN 1;" >nul 2>&1
if %errorlevel% equ 0 goto neo4j_ready
timeout /t 2 /nobreak >nul
set /a RETRIES=%RETRIES%-1
if %RETRIES% gtr 0 (
    echo     Esperando conexion Bolt con Neo4j... (intentos restantes: %RETRIES%)
    goto wait_neo4j
)
echo [ADVERTENCIA] Neo4j tardo mas de lo esperado en iniciar. Continuando...

:neo4j_ready
echo [OK] Neo4j esta en linea y saludable.
echo.

:: ===============================================================================
:: 3. CARGA DE DATOS SEMILLA EN NEO4J
:: ===============================================================================
:seed_database
echo [4/4] Inyectando dataset semilla en Neo4j (usuarios, relaciones y posts)...
:: LANG/LC_ALL son obligatorios: la imagen de neo4j corre con LC_CTYPE=POSIX y al
:: mandar el .cql por stdin cada byte de un caracter multibyte se convierte en un
:: U+FFFD, dejando "¡" como "��" y el emoji del post de Paulo como "���".
if exist "docker\neo4j-seed.cql" (
    type "docker\neo4j-seed.cql" | docker exec -i -e LANG=C.UTF-8 -e LC_ALL=C.UTF-8 redsocial-neo4j cypher-shell -u neo4j -p password123 >nul 2>&1
    if %errorlevel% equ 0 (
        echo [OK] Datos semilla inyectados exitosamente en el grafo.
    ) else (
        echo [ADVERTENCIA] No se pudo cargar el archivo cql automaticamente.
    )
) else (
    echo [ADVERTENCIA] No se encontro el archivo docker\neo4j-seed.cql.
)
echo.
if /i "%~1"=="seed" exit /b 0

:: ===============================================================================
:: 4. RESUMEN DE SERVICIOS Y URLs
:: ===============================================================================
:summary
echo ===============================================================================
echo                DESPLIEGUE DISTRIBUIDO COMPLETADO CON EXITO
echo ===============================================================================
echo.
echo  Enlaces directos de acceso:
echo  -----------------------------------------------------------------------------
echo  [+] Frontend Web SPA:     http://localhost:3000
echo  [+] Backend REST API:     http://localhost:8080/api/users
echo  [+] Swagger UI:           http://localhost:8080/q/swagger-ui
echo  [+] Quarkus Dev UI:       http://localhost:8080/q/dev
echo  [+] Neo4j Browser:        http://localhost:7474   (User: neo4j / Pass: password123)
echo  [+] MinIO Console (S3):   http://localhost:9001   (User: minioadmin / Pass: minioadmin)
echo  [+] WebSocket Chat:       ws://localhost:8080/chat/{userId}
echo.
echo  Comandos rapidos de gestion:
echo  * Ver logs en tiempo real:    desplegar.bat logs
echo  * Detener servicios:          desplegar.bat stop
echo  * Reiniciar servicios:        desplegar.bat restart
echo  * Re-cargar datos semilla:    desplegar.bat seed
echo  * Ver estado de contenedores: desplegar.bat status
echo ===============================================================================
echo.

set /p OPEN_BROWSER="Deseas abrir la aplicacion en tu navegador ahora? (S/N) [S]: "
if /i "%OPEN_BROWSER%"=="" set OPEN_BROWSER=S
if /i "%OPEN_BROWSER%"=="S" (
    echo Abriendo http://localhost:3000 en el navegador predeterminado...
    start http://localhost:3000
)

echo.
echo Para salir presiona cualquier tecla.
pause >nul
exit /b 0

:: ===============================================================================
:: RUTINAS DE COMANDOS SECUNDARIOS
:: ===============================================================================

:stop_services
echo Deteniendo todos los contenedores de la Red Social Distribuida...
docker compose down
echo [OK] Servicios detenidos correctamente.
exit /b 0

:restart_services
echo Reiniciando todos los servicios...
docker compose down
goto deploy_all

:view_logs
echo Mostrando logs en tiempo real (Presiona Ctrl+C para salir)...
docker compose logs -f
exit /b 0

:check_status
echo Estado actual de los contenedores:
docker compose ps
exit /b 0

:show_help
echo ===============================================================================
echo                   AYUDA DEL COMANDO DE DESPLIEGUE
echo ===============================================================================
echo Uso:
echo   desplegar.bat [COMANDO]
echo.
echo Comandos disponibles:
echo   (sin argumento) : Construye, levanta la red distribuida, carga datos y abre la app.
echo   stop            : Detiene y apaga los contenedores.
echo   restart         : Reinicia toda la arquitectura.
echo   seed            : Vuelve a ejecutar la carga de datos semilla en Neo4j.
echo   logs            : Muestra la consola de logs en vivo de todos los servicios.
echo   status          : Lista los contenedores en ejecucion y sus puertos.
echo   help            : Muestra este mensaje de ayuda.
echo ===============================================================================
exit /b 0
