#!/bin/bash

# Tilloff Backend Deployment Script
# Run this on the Ubuntu server to deploy/update the backend

set -e

# Configuration
REPO_URL="https://github.com/YOUR_USERNAME/SmartSolutions---Hackathon.git"
APP_DIR="/opt/tilloff"
BACKEND_DIR="$APP_DIR/cyberclowns/backend"
SERVICE_NAME="tilloff-backend"
USER="tilloff"

echo "🚀 Tilloff Backend Deployment Starting..."

# Create app directory if it doesn't exist
if [ ! -d "$APP_DIR" ]; then
    echo "📁 Creating app directory..."
    sudo mkdir -p "$APP_DIR"
    sudo chown -R "$USER:$USER" "$APP_DIR"
fi

# Navigate to app directory
cd "$APP_DIR"

# Clone or update repository
if [ ! -d ".git" ]; then
    echo "📥 Cloning repository..."
    sudo -u "$USER" git clone "$REPO_URL" .
else
    echo "🔄 Pulling latest changes..."
    sudo -u "$USER" git pull origin main
fi

# Navigate to backend
cd "$BACKEND_DIR"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "🐍 Creating Python virtual environment..."
    sudo -u "$USER" python3 -m venv venv
fi

# Activate virtual environment and install dependencies
echo "📦 Installing dependencies..."
sudo -u "$USER" bash -c "source venv/bin/activate && pip install --upgrade pip && pip install -r requirements.txt"

# Copy .env if not exists
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file from .env.example..."
    sudo -u "$USER" cp .env.example .env
    echo "⚠️  Please edit .env with your configuration"
fi

# Create systemd service file
echo "🔧 Setting up systemd service..."
sudo tee "/etc/systemd/system/$SERVICE_NAME.service" > /dev/null <<EOF
[Unit]
Description=Tilloff Backend API
After=network.target
Wants=network-online.target

[Service]
Type=notify
User=$USER
WorkingDirectory=$BACKEND_DIR
Environment="PATH=$BACKEND_DIR/venv/bin"
ExecStart=$BACKEND_DIR/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --reload
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"

echo "✅ Deployment Complete!"
echo ""
echo "📝 Next steps:"
echo "1. Edit .env file: nano $BACKEND_DIR/.env"
echo "2. Start the service: sudo systemctl start $SERVICE_NAME"
echo "3. Check status: sudo systemctl status $SERVICE_NAME"
echo "4. View logs: sudo journalctl -u $SERVICE_NAME -f"
