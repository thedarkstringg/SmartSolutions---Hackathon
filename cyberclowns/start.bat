@echo off
REM CyberClowns Quick Start Script (Windows)
REM This script initializes and starts the CyberClowns backend

setlocal enabledelayedexpansion

cls
echo.
echo 🚀 Starting CyberClowns Backend...
echo.

REM Change to backend directory
cd /d "%~dp0backend" || (
    echo Error: Could not change to backend directory
    pause
    exit /b 1
)

REM Check for .env file
if not exist .env (
    echo ⚠️  No .env file found!
    echo.
    echo Create backend\.env with your Google Gemini API key:
    echo     GEMINI_API_KEY=your_api_key_here
    echo.
    echo Get your key from: https://aistudio.google.com/app/apikey
    echo.
    pause
    exit /b 1
)

REM Check for pHash database
if not exist data\known_hashes.json (
    echo 📸 Building pHash database for the first time...
    echo    (This may take 2-5 minutes. Downloading screenshots from 12 known sites...)
    echo.
    python scripts\build_phash_db.py
    echo.
)

REM Check for ML model
if not exist models\phishing_detector.pkl (
    echo 🤖 Building ML phishing detector model...
    python scripts\build_ml_model.py
    echo.
)

REM Check for uvicorn
where uvicorn >nul 2>nul
if !errorlevel! neq 0 (
    echo ❌ uvicorn not found! Install dependencies:
    echo    pip install -r requirements.txt
    pause
    exit /b 1
)

echo ✅ Starting FastAPI server on http://localhost:8000
echo.
echo    Press Ctrl+C to stop
echo.

REM Start the server
uvicorn main:app --reload --port 8000

pause
