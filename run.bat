@echo off
echo ===================================================
echo   BigQuery Release Pulse - Launching Server...
echo ===================================================
echo.
if not exist .venv (
    echo [ERROR] Virtual environment (.venv) not found.
    echo Please ensure the project was installed correctly.
    pause
    exit /b
)
echo Server starting at http://127.0.0.1:5000/
echo.
.venv\Scripts\python.exe app.py
pause
