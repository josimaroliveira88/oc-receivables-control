@echo off
chcp 65001 >nul
title Receivables Control - Backup do Banco de Dados
color 0E

echo ============================================================
echo            RECEIVABLES CONTROL - BACKUP SCRIPT
echo ============================================================
echo.

REM ============================================================
REM 0. Identifica o local da instalacao
REM    O script sempre opera a partir da propria pasta.
REM    Destino opcional: backup.bat "D:\caminho\dos\backups"
REM ============================================================
cd /d "%~dp0"

set "ENV_FILE=%~dp0backend\.env"

REM ============================================================
REM 1. Verifica o arquivo de conexao (.env)
REM ============================================================
echo [1/6] Verificando local da instalacao e arquivo de conexao...

if not exist "%ENV_FILE%" goto :no_env_file

echo       Instalacao: %~dp0
echo       Conexao....: backend\.env
echo.

goto :read_env

:no_env_file
echo.
echo [ERRO] Arquivo backend\.env nao encontrado.
echo.
echo Esperado em: %ENV_FILE%
echo Copie backend\.env.default para backend\.env e ajuste a DATABASE_URL.
echo.
pause
exit /b 1

REM ============================================================
REM 2. Le a DATABASE_URL do .env e extrai os dados de conexao
REM    Formato esperado:
REM    postgresql://usuario:senha@host:porta/banco?schema=public
REM ============================================================
:read_env
echo [2/6] Lendo dados de conexao...

set "DB_URL_RAW="
for /f "usebackq tokens=1,* delims==" %%a in (`findstr /B /C:"DATABASE_URL" "%ENV_FILE%" 2^>nul`) do set "DB_URL_RAW=%%b"

if not defined DB_URL_RAW if defined DATABASE_URL set "DB_URL_RAW=%DATABASE_URL%"
if not defined DB_URL_RAW goto :no_db_url

REM Remove as aspas ao redor do valor
set "DB_URL=%DB_URL_RAW:"=%"

REM Remove o esquema (postgresql://)
for /f "tokens=1,* delims=/" %%a in ("%DB_URL%") do set "DB_URL_REST=%%b"
if not defined DB_URL_REST goto :bad_db_url

REM Separa credenciais do host
for /f "tokens=1,* delims=@" %%a in ("%DB_URL_REST%") do (
    set "DB_CRED=%%a"
    set "DB_HOSTPART=%%b"
)
if not defined DB_HOSTPART goto :bad_db_url

REM Separa usuario e senha
for /f "tokens=1,* delims=:" %%a in ("%DB_CRED%") do (
    set "DB_USER=%%a"
    set "DB_PASS=%%b"
)

REM Separa host:porta do banco
for /f "tokens=1,* delims=/" %%a in ("%DB_HOSTPART%") do (
    set "DB_AUTHORITY=%%a"
    set "DB_TAIL=%%b"
)
if not defined DB_AUTHORITY goto :bad_db_url

REM Separa host e porta (porta e opcional)
for /f "tokens=1,* delims=:" %%a in ("%DB_AUTHORITY%") do (
    set "DB_HOST=%%a"
    set "DB_PORT=%%b"
)
if not defined DB_PORT set "DB_PORT=5432"

REM Remove os parametros (ex.: ?schema=public) do nome do banco
for /f "tokens=1 delims=?" %%a in ("%DB_TAIL%") do set "DB_NAME=%%a"

if not defined DB_USER goto :bad_db_url
if not defined DB_HOST goto :bad_db_url
if not defined DB_NAME goto :bad_db_url

echo       Dados de conexao lidos. OK.
echo.

REM ============================================================
REM 3. Apresenta e valida os dados de conexao
REM ============================================================
echo [3/6] Dados de conexao identificados:
echo.
echo       Host......: %DB_HOST%
echo       Porta.....: %DB_PORT%
echo       Banco.....: %DB_NAME%
echo       Usuario...: %DB_USER%
echo       Senha.....: ****** (oculta)
echo.

if not defined DB_PASS (
    echo       [AVISO] Sem senha na DATABASE_URL. O pg_dump tentara autenticacao sem senha.
    echo.
)

set "LOCAL_DB=0"
if /i "%DB_HOST%"=="localhost" set "LOCAL_DB=1"
if /i "%DB_HOST%"=="db" set "LOCAL_DB=1"
if "%DB_HOST%"=="127.0.0.1" set "LOCAL_DB=1"
if "%DB_HOST%"=="::1" set "LOCAL_DB=1"

if %LOCAL_DB% neq 1 goto :skip_port_check

netstat -ano | findstr "LISTENING" | findstr /C:":%DB_PORT% " >nul
if %ERRORLEVEL% neq 0 (
    echo       [AVISO] Nenhum servico escutando na porta %DB_PORT% - %DB_HOST%.
    echo       Verifique se o PostgreSQL esta em execucao.
    echo.
) else (
    echo       PostgreSQL detectado na porta %DB_PORT%. OK.
)

:skip_port_check

echo.
set /p CONFIRM="Confirma o backup deste banco? S/N: "
if /i not "%CONFIRM%"=="S" goto :cancelled

echo.

REM ============================================================
REM 4. Localiza o pg_dump
REM ============================================================
echo [4/6] Localizando pg_dump...

set "PG_DUMP="

if defined PG_BIN if exist "%PG_BIN%\pg_dump.exe" set "PG_DUMP=%PG_BIN%\pg_dump.exe"

if defined PG_DUMP goto :pg_dump_found

where pg_dump >nul 2>nul
if %ERRORLEVEL% equ 0 set "PG_DUMP=pg_dump"

:pg_dump_found

if not defined PG_DUMP (
    for %%v in (17 16 15 14 13 12 11 10 9) do (
        if not defined PG_DUMP if exist "C:\Program Files\PostgreSQL\%%v\bin\pg_dump.exe" set "PG_DUMP=C:\Program Files\PostgreSQL\%%v\bin\pg_dump.exe"
    )
)

if not defined PG_DUMP (
    for %%v in (17 16 15 14 13 12 11 10 9) do (
        if not defined PG_DUMP if exist "C:\Program Files (x86)\PostgreSQL\%%v\bin\pg_dump.exe" set "PG_DUMP=C:\Program Files (x86)\PostgreSQL\%%v\bin\pg_dump.exe"
    )
)

if not defined PG_DUMP goto :no_pg_dump
echo       pg_dump: %PG_DUMP%
echo.

REM ============================================================
REM 5. Define destino e executa o backup
REM ============================================================
echo [5/6] Executando backup...

set "BACKUP_DIR=%~1"
if not defined BACKUP_DIR set "BACKUP_DIR=%~dp0backend\backups"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

set "STAMP="
for /f "usebackq tokens=*" %%t in (`powershell -NoProfile -Command "Get-Date -Format 'yyyy-MM-dd_HHmmss'" 2^>nul`) do set "STAMP=%%t"
if not defined STAMP set "STAMP=%DATE%_%TIME: =0%"
set "STAMP=%STAMP:/=-%"
set "STAMP=%STAMP::=-%"
set "STAMP=%STAMP:.=-%"
set "STAMP=%STAMP:,=-%"
set "STAMP=%STAMP: =_%"

set "BACKUP_FILE=%BACKUP_DIR%\receivables-backup-%STAMP%.backup"

echo       Destino: %BACKUP_FILE%
echo.

set "PGPASSWORD=%DB_PASS%"
"%PG_DUMP%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -F c -b -v -f "%BACKUP_FILE%"
set "PG_EXIT=%ERRORLEVEL%"
set "PGPASSWORD="

if not "%PG_EXIT%"=="0" goto :backup_failed
if not exist "%BACKUP_FILE%" goto :backup_failed

for %%f in ("%BACKUP_FILE%") do set "BACKUP_SIZE=%%~zf"
if not defined BACKUP_SIZE goto :backup_failed
if "%BACKUP_SIZE%"=="0" goto :backup_failed

echo.

REM ============================================================
REM 6. Verifica o resultado
REM ============================================================
echo [6/6] Verificando arquivo gerado...

echo ============================================================
echo            BACKUP CONCLUIDO COM SUCESSO
echo ============================================================
echo.
echo       Arquivo: %BACKUP_FILE%
echo       Tamanho: %BACKUP_SIZE% bytes
echo.
echo       Restauracao (rollback):
echo         set PGPASSWORD=******
echo         "%PG_DUMP:pg_dump=pg_restore%" -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% --clean --if-exists --verbose "%BACKUP_FILE%"
echo.
pause
exit /b 0

REM ============================================================
REM Tratamento de erros
REM ============================================================
:no_db_url
echo.
echo [ERRO] DATABASE_URL nao encontrada em backend\.env.
echo Adicione uma linha como:
echo   DATABASE_URL="postgresql://admin:admin@localhost:5432/receivables?schema=public"
echo.
pause
exit /b 1

:bad_db_url
echo.
echo [ERRO] Nao foi possivel interpretar a DATABASE_URL.
echo Formato esperado: postgresql://usuario:senha@host:porta/banco?schema=public
echo.
pause
exit /b 1

:no_pg_dump
echo.
echo [ERRO] pg_dump nao encontrado.
echo.
echo Instale o PostgreSQL ou informe o diretorio bin pela variavel PG_BIN, ex.:
echo   set PG_BIN=C:\Program Files\PostgreSQL\15\bin
echo Baixe em: https://www.postgresql.org/download/windows/
echo.
pause
exit /b 1

:backup_failed
echo.
echo [ERRO] Falha ao gerar o backup. Verifique as mensagens acima.
echo.
pause
exit /b 1

:cancelled
echo.
echo Operacao cancelada pelo usuario.
echo.
pause
exit /b 1
