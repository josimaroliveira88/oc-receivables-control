@echo off
chcp 65001 >nul
title Receivables Control - Producao
color 0A

echo ============================================================
echo            RECEIVABLES CONTROL - MODO PRODUCAO
echo ============================================================
echo.

cd /d "%~dp0"

REM ============================================================
REM 1. Verificacoes iniciais
REM ============================================================
echo [1/6] Verificando dependencias basicas...

where node >nul 2>nul
if errorlevel 1 goto :no_node
for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo       Node.js %NODE_VERSION% OK.

where git >nul 2>nul
if errorlevel 1 goto :no_git
for /f "tokens=*" %%v in ('git --version') do set GIT_VERSION=%%v
echo       %GIT_VERSION% OK.

goto :check_pg

:no_node
echo.
echo [ERRO] Node.js nao encontrado!
echo Instale em: https://nodejs.org/
echo.
pause
exit /b 1

:no_git
echo.
echo [ERRO] Git nao encontrado!
echo Instale em: https://git-scm.com/download/win
echo.
pause
exit /b 1

REM ============================================================
REM 2. Verifica o PostgreSQL
REM ============================================================
:check_pg
echo [2/6] Verificando PostgreSQL na porta 5432...
netstat -ano | findstr "LISTENING" | findstr /C:":5432 " >nul
if errorlevel 1 goto :no_pg
echo       PostgreSQL detectado na porta 5432. OK.
goto :check_deps

:no_pg
echo.
echo [AVISO] PostgreSQL nao encontrado na porta 5432.
echo         Inicie o servico do PostgreSQL ou execute: docker compose up -d db
echo.
set /p CONTINUE="Deseja continuar mesmo assim? S/N: "
if /i not "%CONTINUE%"=="S" goto :cancel
echo       Continuando...
goto :check_deps

:cancel
echo Operacao cancelada.
pause
exit /b 1

REM ============================================================
REM 3. Dependencias do projeto
REM ============================================================
:check_deps
echo [3/6] Verificando dependencias do projeto...
if not exist "node_modules" goto :install_root
goto :check_backend_deps

:install_root
echo       Instalando dependencias da raiz...
call npm install

:check_backend_deps
if not exist "backend\node_modules" goto :install_backend
goto :check_frontend_deps

:install_backend
echo       Instalando dependencias do backend...
call npm --prefix backend install

:check_frontend_deps
if not exist "frontend\node_modules" goto :install_frontend
goto :check_prisma

:install_frontend
echo       Instalando dependencias do frontend...
call npm --prefix frontend install

:check_prisma
if not exist "backend\node_modules\.prisma\client" goto :gen_prisma
goto :deps_ok

:gen_prisma
if not exist "backend\prisma\schema.prisma" goto :deps_ok
echo       Gerando cliente Prisma...
call npm --prefix backend run prisma:generate

:deps_ok
echo       Dependencias OK.

REM ============================================================
REM 4. Aplica migrations do banco
REM ============================================================
:apply_migrations
echo [4/6] Aplicando migrations do banco (migrate deploy)...
call npm --prefix backend run prisma:migrate:deploy
if errorlevel 1 goto :migrate_failed
echo       Migrations aplicadas. OK.
goto :build_frontend

:migrate_failed
echo.
echo [ERRO] Falha ao aplicar migrations. Verifique a conexao com o banco.
pause
exit /b 1

REM ============================================================
REM 5. Build do frontend apenas quando necessario
REM ============================================================
:build_frontend
echo [5/6] Verificando build do frontend...

set CURRENT_HEAD=
for /f "tokens=*" %%h in ('git rev-parse HEAD 2^>nul') do set CURRENT_HEAD=%%h
set LAST_BUILD=
if exist "frontend\dist\.build-commit" set /p LAST_BUILD=<"frontend\dist\.build-commit"

set NEED_BUILD=0
if not exist "frontend\dist\index.html" set NEED_BUILD=1
if not "%LAST_BUILD%"=="%CURRENT_HEAD%" set NEED_BUILD=1
git status --porcelain -- frontend | findstr /R /C:"." >nul
if not errorlevel 1 set NEED_BUILD=1

if "%NEED_BUILD%"=="1" goto :do_build
echo       Frontend ja buildado na versao atual. Pulando build.
goto :start_app

:do_build
echo       Construindo frontend com npm run build...
call npm --prefix frontend run build
if errorlevel 1 goto :build_failed
if not "%CURRENT_HEAD%"=="" echo %CURRENT_HEAD%> "frontend\dist\.build-commit"
echo       Build do frontend concluido. OK.
goto :start_app

:build_failed
echo.
echo [ERRO] Falha ao construir o frontend.
pause
exit /b 1

REM ============================================================
REM 6. Inicia a aplicacao em modo producao
REM ============================================================
:start_app
echo [6/6] Iniciando aplicacao em modo producao...
echo.
echo ============================================================
echo   Aplicacao: http://localhost:3000
echo   Backend + frontend servidos pelo mesmo processo.
echo.
echo   Pressione Ctrl+C nesta janela para encerrar.
echo ============================================================
echo.

set NODE_ENV=production
set SERVE_STATIC=true
set PORT=3000

call npm --prefix backend start

echo.
echo Aplicacao encerrada.
pause
