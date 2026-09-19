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
REM 0. Verificacoes iniciais
REM ============================================================
echo [0/9] Verificando dependencias basicas...

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
REM 1. Verifica se o projeto esta em execucao
REM ============================================================
:check_running
echo [1/9] Verificando se o projeto esta em execucao...

set RUNNING=0

netstat -ano | findstr ":4000" | findstr /I "LISTENING ESTABLISHED" >nul
if %ERRORLEVEL% equ 0 (
    echo       [AVISO] Backend detectado na porta 4000.
    set RUNNING=1
)

netstat -ano | findstr ":3000" | findstr /I "LISTENING ESTABLISHED" >nul
if %ERRORLEVEL% equ 0 (
    echo       [AVISO] Frontend detectado na porta 3000.
    set RUNNING=1
)

if %RUNNING% equ 1 (
    echo.
    echo [ERRO] O projeto parece estar em execucao.
    echo.
    echo Para atualizar com seguranca, pare o projeto primeiro:
    echo   - Feche a janela do start.bat (pressione Ctrl+C e confirme);
    echo   - Ou finalize os processos Node.js manualmente.
    echo.
    pause
    exit /b 1
)

echo       Nenhum servico detectado nas portas 3000/4000. OK.

REM ============================================================
REM 2. Confirma backup do banco de dados
REM ============================================================
:confirm_backup
echo [2/9] Confirmacao de backup do banco de dados
echo.
echo ATENCAO: antes de atualizar, faca backup do banco "receivables".
echo Consulte docs/DEPLOYMENT.md para o comando completo de pg_dump.
echo.
set /p BACKUP_OK="Ja realizou o backup do banco? (S/N): "
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
REM 3. Atualiza o codigo-fonte
REM ============================================================
:git_pull
echo [3/9] Atualizando codigo-fonte (git pull)...
call git pull
if %ERRORLEVEL% neq 0 goto :error
echo       git pull concluido. OK.

REM ============================================================
REM 4. Instala dependencias do backend
REM ============================================================
:backend_deps
echo [4/9] Instalando dependencias do backend (npm ci)...
call npm --prefix backend ci
if %ERRORLEVEL% neq 0 goto :error
echo       Dependencias do backend OK.

REM ============================================================
REM 5. Aplica migrations do Prisma
REM ============================================================
:prisma_migrate
echo [5/9] Aplicando migrations do Prisma (migrate deploy)...
call npm --prefix backend run prisma:migrate:deploy
if %ERRORLEVEL% neq 0 goto :error
echo       Migrations aplicadas. OK.

REM ============================================================
REM 6. Gera Prisma Client
REM ============================================================
:prisma_generate
echo [6/9] Gerando Prisma Client...
call npm --prefix backend run prisma:generate
if %ERRORLEVEL% neq 0 goto :error
echo       Prisma Client gerado. OK.

REM ============================================================
REM 7. Instala dependencias do frontend
REM ============================================================
:frontend_deps
echo [7/9] Instalando dependencias do frontend (npm ci)...
call npm --prefix frontend ci
if %ERRORLEVEL% neq 0 goto :error
echo       Dependencias do frontend OK.

REM ============================================================
REM 8. Build do frontend
REM ============================================================
:frontend_build
echo [8/9] Construindo frontend (npm run build)...
call npm --prefix frontend run build
if %ERRORLEVEL% neq 0 goto :error
echo       Build do frontend concluido. OK.

echo.
echo ============================================================
echo            ATUALIZACAO CONCLUIDA COM SUCESSO
echo ============================================================
echo.

REM ============================================================
REM 9. Pergunta se deseja iniciar o projeto
REM ============================================================
if /I "%~1"=="--from-start" (
    echo.
    echo Atualizacao concluida. Retornando ao start.bat...
    exit /b 0
)

set /p START_PROJECT="Deseja iniciar o projeto agora? (S/N): "
if /i "%START_PROJECT%"=="S" (
    echo.
    echo Iniciando projeto...
    call "%~dp0start.bat"
) else (
    echo.
    echo Projeto atualizado. Execute start.bat quando desejar iniciar.
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
