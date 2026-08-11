@echo off
chcp 65001 >nul
title Receivables Control - Iniciando Projeto
color 0A

echo ============================================================
echo            RECEIVABLES CONTROL - START SCRIPT
echo ============================================================
echo.

cd /d "%~dp0"

echo [1/4] Verificando Node.js...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERRO] Node.js nao encontrado!
    echo Instale em: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo       Node.js %NODE_VERSION% OK.

echo [2/4] Verificando PostgreSQL na porta 5432...
netstat -ano | findstr ":5432" | findstr "LISTENING" >nul
if %ERRORLEVEL% neq 0 (
    echo.
    echo [AVISO] PostgreSQL nao encontrado na porta 5432.
    echo         Inicie o servico do PostgreSQL ou execute: docker compose up -d db
    echo.
    set /p CONTINUE="Deseja continuar mesmo assim? (S/N): "
    if /i not "%CONTINUE%"=="S" (
        echo Operacao cancelada.
        pause
        exit /b 1
    )
    echo       Continuando...
) else (
    echo       PostgreSQL detectado na porta 5432. OK.
)

echo [3/4] Verificando dependencias do projeto...
if not exist "node_modules" (
    echo       Instalando dependencias da raiz (concurrently)...
    call npm install
)
if not exist "backend\node_modules" (
    echo       Instalando dependencias do backend...
    call npm --prefix backend install
)
if not exist "frontend\node_modules" (
    echo       Instalando dependencias do frontend...
    call npm --prefix frontend install
)
if not exist "backend\prisma\generated" (
    if exist "backend\prisma\schema.prisma" (
        echo       Gerando cliente Prisma...
        call npm --prefix backend run prisma:generate
    )
)
echo       Dependencias OK.

echo [4/4] Iniciando backend (porta 4000) e frontend (porta 3000)...
echo.
echo ============================================================
echo   Backend:  http://localhost:4000
echo   Frontend: http://localhost:3000
echo.
echo   Pressione Ctrl+C nesta janela para encerrar ambos.
echo ============================================================
echo.

call npm run dev

echo.
echo Servicos encerrados.
pause
