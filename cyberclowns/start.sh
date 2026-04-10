#!/bin/bash

# CyberClowns Quick Start Script (macOS/Linux)
# This script initializes and starts the CyberClowns backend

set -e  # Exit on error

clear

echo ""
echo "🚀 Starting CyberClowns Backend..."
echo ""

# Change to backend directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/backend" || {
    echo "Error: Could not change to backend directory"
    exit 1
}

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  No .env file found!"
    echo ""
    echo "Create backend/.env with your Google Gemini API key:"
    echo "    GEMINI_API_KEY=your_api_key_here"
    echo ""
    echo "Get your key from: https://aistudio.google.com/app/apikey"
    echo ""
    exit 1
fi

# Check for pHash database
if [ ! -f data/known_hashes.json ]; then
    echo "📸 Building pHash database for the first time..."
    echo "   (This may take 2-5 minutes. Downloading screenshots from 12 known sites...)"
    echo ""
    python3 scripts/build_phash_db.py
    echo ""
fi

# Check for ML model
if [ ! -f models/phishing_detector.pkl ]; then
    echo "🤖 Building ML phishing detector model..."
    python3 scripts/build_ml_model.py
    echo ""
fi

# Check for uvicorn
if ! command -v uvicorn &> /dev/null; then
    echo "❌ uvicorn not found! Install dependencies:"
    echo "    pip install -r requirements.txt"
    exit 1
fi

echo "✅ Starting FastAPI server on http://localhost:8000"
echo ""
echo "   Press Ctrl+C to stop"
echo ""

# Start the server
uvicorn main:app --reload --port 8000
