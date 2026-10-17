@echo off
chcp 65001 >nul
cd /d "%~dp0.."
py -3 -c "import cryptography" >nul 2>nul
if errorlevel 1 (
 echo Python ou a biblioteca cryptography nao encontrados.
 echo Instale Python 3.11+ e execute: py -3 -m pip install -r companion\requirements.txt
 pause
 exit /b 1
)
py -3 companion\sync.py
pause
