@echo off
chcp 65001 >nul
title Receivables Control - Atualizando Projeto
color 0A

echo ============================================================
echo            RECEIVABLES CONTROL - UPDATE SCRIPT
echo ============================================================
echo.

cd /d "%~dp0"

REM ============================================================
REM 1. Verificacoes iniciais
REM ============================================================
echo [1/10] Verificando dependencias basicas...

where node >nul 2>nul
if %ERRORLEVEL% neq 0 goto :no_node
for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo       Node.js %NODE_VERSION% OK.

where git >nul 2>nul
if %ERRORLEVEL% neq 0 goto :no_git
for /f "tokens=*" %%v in ('git --version') do set GIT_VERSION=%%v
echo       %GIT_VERSION% OK.

goto :check_running

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
REM 2. Verifica se o projeto esta em execucao
REM ============================================================
:check_running
echo [2/10] Verificando se o projeto esta em execucao...

set RUNNING=0

netstat -ano | findstr "LISTENING" | findstr /C:":4000 " >nul
if %ERRORLEVEL% equ 0 (
    echo       [AVISO] Backend detectado na porta 4000.
    set RUNNING=1
)

netstat -ano | findstr "LISTENING" | findstr /C:":3000 " >nul
if %ERRORLEVEL% equ 0 (
    echo       [AVISO] Frontend detectado na porta 3000.
    set RUNNING=1
)

if %RUNNING% equ 1 (
    echo.
    echo [ERRO] O projeto parece estar em execucao.
    echo.
    echo Para atualizar com seguranca, pare o projeto primeiro:
    echo   - Feche a janela do start.bat com Ctrl+C;
    echo   - Ou finalize os processos Node.js manualmente.
    echo.
    pause
    exit /b 1
)

echo       Nenhum servico detectado nas portas 3000/4000. OK.

REM ============================================================
REM 3. Verifica se ha atualizacoes antes de executar os comandos
REM ============================================================
:check_updates_available
echo [3/10] Verificando atualizacoes disponiveis...

call "%~dp0check-updates.bat"
if errorlevel 1 (
    echo       Nao foi possivel verificar atualizacoes. Prosseguindo com a atualizacao...
    goto :confirm_backup
)

if "%COMMITS_BEHIND%"=="0" goto :no_update

echo       %COMMITS_BEHIND% atualizacoes pendentes no branch '%CURRENT_BRANCH%'. Prosseguindo...
goto :confirm_backup

:no_update
echo.
echo ============================================================
echo            PROJETO JA ESTA ATUALIZADO
echo ============================================================
echo.
goto :offer_start

REM ============================================================
REM 4. Confirma backup do banco de dados
REM ============================================================
:confirm_backup
echo [4/10] Confirmacao de backup do banco de dados
echo.
echo ATENCAO: antes de atualizar, faca backup do banco "receivables".
echo Consulte docs/DEPLOYMENT.md para o comando completo de pg_dump.
echo.
set /p BACKUP_OK="Ja realizou o backup do banco? S/N: "
if /i not "%BACKUP_OK%"=="S" goto :backup_not_confirmed
echo       Backup confirmado. Continuando...
goto :git_pull

:backup_not_confirmed
echo.
echo Operacao cancelada. Faca o backup antes de continuar.
echo.
pause
exit /b 1

REM ============================================================
REM 5. Atualiza o codigo-fonte e detecta mudancas relevantes
REM ============================================================
:git_pull
echo [5/10] Atualizando codigo-fonte (git pull)...

git rev-parse HEAD > "%TEMP%\update_old_head.txt"
if %ERRORLEVEL% neq 0 goto :error
set /p OLD_HEAD=<"%TEMP%\update_old_head.txt"

call git pull
if %ERRORLEVEL% neq 0 goto :error
echo       git pull concluido. OK.

git diff --name-only %OLD_HEAD% HEAD > "%TEMP%\update_changed_files.txt"
if %ERRORLEVEL% neq 0 goto :error

set BACKEND_LOCK_CHANGED=0
set FRONTEND_LOCK_CHANGED=0
set MIGRATIONS_CHANGED=0
set PRISMA_SCHEMA_CHANGED=0

findstr /I /C:"backend/package-lock.json" "%TEMP%\update_changed_files.txt" >nul
if %ERRORLEVEL% equ 0 set BACKEND_LOCK_CHANGED=1

findstr /I /C:"frontend/package-lock.json" "%TEMP%\update_changed_files.txt" >nul
if %ERRORLEVEL% equ 0 set FRONTEND_LOCK_CHANGED=1

findstr /I /C:"prisma/migrations/" "%TEMP%\update_changed_files.txt" >nul
if %ERRORLEVEL% equ 0 set MIGRATIONS_CHANGED=1

findstr /I /C:"prisma/schema.prisma" "%TEMP%\update_changed_files.txt" >nul
if %ERRORLEVEL% equ 0 set PRISMA_SCHEMA_CHANGED=1

REM ============================================================
REM 6. Instala dependencias do backend
REM ============================================================
:backend_deps
if %BACKEND_LOCK_CHANGED% equ 1 (
    echo [6/10] package-lock.json do backend alterado. Instalando dependencias com npm ci...
    call npm --prefix backend ci
    if %ERRORLEVEL% neq 0 goto :error
    echo       Dependencias do backend OK.
) else (
    echo [6/10] package-lock.json do backend NAO alterado. Pulando npm ci.
)

REM ============================================================
REM 7. Aplica migrations do Prisma
REM ============================================================
:prisma_migrate
if %MIGRATIONS_CHANGED% equ 1 (
    echo [7/10] Migrations novas detectadas. Aplicando migrate deploy...
    call npm --prefix backend run prisma:migrate:deploy
    if %ERRORLEVEL% neq 0 goto :error
    echo       Migrations aplicadas. OK.
) else (
    echo [7/10] Nenhuma migration nova detectada. Pulando migrate deploy.
)

REM ============================================================
REM 8. Gera Prisma Client
REM ============================================================
:prisma_generate
if %PRISMA_SCHEMA_CHANGED% equ 1 (
    echo [8/10] schema.prisma alterado. Gerando Prisma Client...
    call npm --prefix backend run prisma:generate
    if %ERRORLEVEL% neq 0 goto :error
    echo       Prisma Client gerado. OK.
) else (
    echo [8/10] schema.prisma NAO alterado. Pulando prisma generate.
)

REM ============================================================
REM 9. Instala dependencias do frontend
REM ============================================================
:frontend_deps
if %FRONTEND_LOCK_CHANGED% equ 1 (
    echo [9/10] package-lock.json do frontend alterado. Instalando dependencias com npm ci...
    call npm --prefix frontend ci
    if %ERRORLEVEL% neq 0 goto :error
    echo       Dependencias do frontend OK.
) else (
    echo [9/10] package-lock.json do frontend NAO alterado. Pulando npm ci.
)

REM ============================================================
REM 10. Build do frontend
REM ============================================================
:frontend_build
echo [10/10] Construindo frontend (npm run build)...
call npm --prefix frontend run build
if %ERRORLEVEL% neq 0 goto :error
echo       Build do frontend concluido. OK.

echo.
echo ============================================================
echo            ATUALIZACAO CONCLUIDA COM SUCESSO
echo ============================================================
echo.
goto :offer_start

REM ============================================================
REM Inicia o projeto, se desejado
REM ============================================================
:offer_start
if /I "%~1"=="--from-start" (
    echo Atualizacao concluida. Retornando ao start.bat...
    exit /b 0
)

set /p START_PROJECT="Deseja iniciar o projeto agora? S/N: "
if /i "%START_PROJECT%"=="S" (
    echo.
    echo Iniciando projeto...
    call "%~dp0start.bat"
) else (
    echo.
    echo Execute start.bat quando desejar iniciar.
    pause
)

exit /b 0

REM ============================================================
REM Tratamento de erro generico
REM ============================================================
:error
echo.
echo [ERRO] Falha durante a atualizacao. Verifique as mensagens acima.
echo.
pause
exit /b 1
