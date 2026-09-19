@echo off
REM ============================================================
REM Helper compartilhado por start.bat e update.bat.
REM Verifica se o branch local esta atras de origin/<branch>.
REM
REM Exporta para o ambiente do chamador:
REM   CURRENT_BRANCH - branch atual
REM   COMMITS_BEHIND - commits pendentes no remote
REM
REM Retorna 0 quando a verificacao foi concluida e 1 quando nao
REM foi possivel verificar (sem Git, sem remote ou sem rede).
REM ============================================================

set CURRENT_BRANCH=
set COMMITS_BEHIND=

where git >nul 2>nul
if errorlevel 1 exit /b 1

call git fetch --quiet
if errorlevel 1 exit /b 1

for /f "tokens=*" %%b in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set CURRENT_BRANCH=%%b
if "%CURRENT_BRANCH%"=="" exit /b 1

for /f "tokens=*" %%c in ('git rev-list --count HEAD..origin/%CURRENT_BRANCH% 2^>nul') do set COMMITS_BEHIND=%%c
if "%COMMITS_BEHIND%"=="" exit /b 1

exit /b 0
