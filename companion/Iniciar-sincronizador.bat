@echo off
setlocal
cd /d "%~dp0.."
rem Prefer the background Windows app: no persistent CMD.
if exist "%~dp0JourneyArchiveSync.exe" (
  start "" "%~dp0JourneyArchiveSync.exe"
  exit /b 0
)
if exist "%~dp0..\dist\JourneyArchiveSync.exe" (
  start "" "%~dp0..\dist\JourneyArchiveSync.exe"
  exit /b 0
)
rem Python fallback uses pythonw.exe, which has no console.
where pyw >nul 2>&1
if not errorlevel 1 (
  start "" pyw -3 "%~dp0tray.py"
  exit /b 0
)
echo Sincronizador discreto nao encontrado.
echo Baixe JourneyArchiveSync.exe em GitHub Actions ou instale Python e dependencias.
pause
exit /b 1
