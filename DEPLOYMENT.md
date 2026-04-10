# Ubuntu Server Deployment Guide

## Prerequisites on Ubuntu Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python and git
sudo apt install -y python3 python3-venv python3-pip git

# Create tilloff user
sudo useradd -m -s /bin/bash tilloff
sudo usermod -aG sudo tilloff
```

## One-Time Setup on Local (Your Desktop)

### 1. Ensure code is on GitHub
```bash
# In your project directory
git add .
git commit -m "Deploy to server"
git push origin main
```

### 2. Update deploy.sh with your GitHub URL
Edit `deploy.sh` and change:
```bash
REPO_URL="https://github.com/YOUR_USERNAME/SmartSolutions---Hackathon.git"
```

## Deployment Steps on Ubuntu Server

### 1. SSH into server
```bash
ssh user@server_ip
```

### 2. Download deployment script
```bash
curl -O https://raw.githubusercontent.com/YOUR_USERNAME/SmartSolutions---Hackathon/main/deploy.sh
chmod +x deploy.sh
```

Or copy it manually:
```bash
# Copy from local machine
scp deploy.sh user@server_ip:~/
```

### 3. Run deployment script
```bash
sudo ./deploy.sh
```

### 4. Configure environment variables
```bash
sudo nano /opt/tilloff/cyberclowns/backend/.env
```

### 5. Start the backend
```bash
sudo systemctl start tilloff-backend
sudo systemctl status tilloff-backend
```

### 6. View logs
```bash
sudo journalctl -u tilloff-backend -f
```

## For Subsequent Updates

Simply pull the latest code and restart:

```bash
# SSH into server
ssh user@server_ip

# Navigate to app directory
cd /opt/tilloff

# Pull latest changes
git pull origin main

# Restart backend
sudo systemctl restart tilloff-backend
```

## Access Backend

- **API**: http://server_ip:8000
- **Docs**: http://server_ip:8000/docs
- **Dashboard**: http://server_ip:8000/dashboard.html

## Troubleshooting

```bash
# Check service status
sudo systemctl status tilloff-backend

# View real-time logs
sudo journalctl -u tilloff-backend -f

# Restart service
sudo systemctl restart tilloff-backend

# Stop service
sudo systemctl stop tilloff-backend

# Check if port 8000 is listening
sudo netstat -tlnp | grep 8000
```

## Optional: Nginx Reverse Proxy

For production, use Nginx to proxy requests:

```bash
sudo apt install nginx

# Edit nginx config
sudo nano /etc/nginx/sites-available/default
```

Add to server block:
```nginx
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Restart nginx:
```bash
sudo systemctl restart nginx
```
