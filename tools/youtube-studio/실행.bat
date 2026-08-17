@echo off
chcp 65001 >nul
setlocal
set PYTHONIOENCODING=utf-8
set PYTHONUTF8=1
cd /d "%~dp0"

set PY=
where py >nul 2>nul && set PY=py -3
if "%PY%"=="" ( where python >nul 2>nul && set PY=python )
if "%PY%"=="" (
  echo.
  echo [ERROR] Python not found.  https://www.python.org/downloads/ ^(check "Add python.exe to PATH"^)
  echo.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo Setting up for the first time. This takes a minute...
  %PY% -m venv .venv || ( echo [ERROR] venv failed & pause & exit /b 1 )
  ".venv\Scripts\python.exe" -m pip install --upgrade pip --quiet
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt --quiet || ( echo [ERROR] install failed & pause & exit /b 1 )
  echo Done.
  echo.
)

".venv\Scripts\python.exe" youtube_studio.py %*

echo.
pause
