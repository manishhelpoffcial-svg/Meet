# Kalavritti Meet — Production VPS & Custom Domain Deployment Guide

This guide provides end-to-end instructions for deploying **Kalavritti Meet** on any Ubuntu / Debian VPS (DigitalOcean, Hetzner, AWS EC2, Linode, Contabo, Vultr) with custom domain connection, automated SSL/TLS certificates via Let's Encrypt, Nginx reverse proxy with WebSocket support, and background process management via PM2 or systemd.

---

## Architecture Overview

- **Frontend**: React 19 + TypeScript + Tailwind CSS (bundled via Vite)
- **Backend**: Node.js + Express + WebRTC Signaling WebSocket server
- **Port**: Default application runs on `http://127.0.0.1:3000`
- **Reverse Proxy**: Nginx handling HTTPS (Port 443), WSS (`wss://` WebSocket upgrade), and HTTP-to-HTTPS redirect (Port 80)
- **Process Manager**: PM2 (auto-restart on crash & server reboot)

---

## 1. Domain DNS Configuration

Before configuring your VPS, map your custom domain or subdomain to your server's Public IPv4 address.

1. Log into your domain registrar (GoDaddy, Namecheap, Cloudflare, Hostinger, Porkbun, etc.).
2. Go to the **DNS Management / DNS Records** section of your domain.
3. Add or update the following DNS `A` records:

| Type | Host / Name | Value / Target | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` (or leave blank) | `YOUR_VPS_PUBLIC_IP` | 300 / Auto |
| **A** | `www` | `YOUR_VPS_PUBLIC_IP` | 300 / Auto |

> *If deploying on a subdomain like `meet.yourdomain.com`:*
> Add an `A` record with Host `meet` pointing to `YOUR_VPS_PUBLIC_IP`.

*Note: DNS propagation typically takes 2 to 30 minutes.*

---

## 2. Server Preparation (Ubuntu / Debian VPS)

### 2.1 Connect to your VPS
```bash
ssh root@YOUR_VPS_PUBLIC_IP
```

### 2.2 Update System Packages
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw build-essential
```

### 2.3 Install Node.js (v20 LTS or v22 LTS)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node -v   # Should be v20.x.x or higher
npm -v    # Should be v10.x.x or higher
```

### 2.4 Install PM2 Globally
PM2 keeps your application running 24/7 in the background and restarts it if the server reboots:
```bash
sudo npm install -g pm2
```

---

## 3. Clone and Build Kalavritti Meet

### 3.1 Clone the Codebase
```bash
# Recommended directory: /var/www/kalavritti-meet
sudo mkdir -p /var/www/kalavritti-meet
sudo chown -R $USER:$USER /var/www/kalavritti-meet
cd /var/www/kalavritti-meet

# Clone your repository (or copy your files using SCP / SFTP / rsync)
git clone <YOUR_GIT_REPO_URL> .
```

### 3.2 Configure Environment Variables
Create your production `.env` file:
```bash
cp .env.example .env
nano .env
```

Set your production variables in `.env`:
```env
# Your actual domain with https:// (no trailing slash)
APP_URL="https://yourdomain.com"

# Secure administrator password for /admin portal
ADMIN_PASSWORD="YourStrongAdminPasswordHere"

# Strong JWT Secret for session signing
JWT_SECRET="ReplaceWithRandomLongSecretString_99a8b7c6d5"

# Optional: Gemini API Key if using AI features
GEMINI_API_KEY=""

# Production Environment
NODE_ENV="production"
PORT=3000
```
Save and exit in `nano` (`Ctrl + O`, `Enter`, then `Ctrl + X`).

### 3.3 Install Dependencies & Build
```bash
npm install
npm run build
```
This builds both the client assets into `dist/` and compiles the server bundle into `dist/server.cjs`.

### 3.4 Test Run
```bash
node dist/server.cjs
```
You should see:
```text
[Server] Running on port 3000
```
Press `Ctrl + C` to stop after verifying it starts cleanly.

---

## 4. Run Kalavritti Meet with PM2

Start the application with PM2:
```bash
pm2 start dist/server.cjs --name "kalavritti-meet" --time

# Configure PM2 to start automatically on system boot
pm2 startup
# (Run the sudo env PATH=... command that PM2 prints out)
pm2 save
```

Useful PM2 commands:
- `pm2 status`: View running services
- `pm2 logs kalavritti-meet`: View real-time application logs
- `pm2 restart kalavritti-meet`: Restart the app
- `pm2 reload kalavritti-meet`: Zero-downtime reload

---

## 5. Configure Nginx Reverse Proxy with WebSocket Support

WebRTC signaling and private rooms require full HTTP-to-WebSocket (`Upgrade`) proxying.

### 5.1 Install Nginx
```bash
sudo apt install -y nginx
```

### 5.2 Create Nginx Server Block
Create a new configuration file for your domain:
```bash
sudo nano /etc/nginx/sites-available/kalavritti-meet
```

Paste the following configuration (replace `yourdomain.com` with your actual domain):
```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;

    # Client upload limit for KYC snapshots
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket headers
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        # WebSocket timeouts for persistent streaming
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 60s;
        proxy_buffering off;
    }
}
```

### 5.3 Enable Site and Test Nginx
```bash
# Enable the configuration
sudo ln -s /etc/nginx/sites-available/kalavritti-meet /etc/nginx/sites-enabled/

# Remove default site if present
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration syntax
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## 6. Secure with SSL / HTTPS (Let's Encrypt & Certbot)

Camera and microphone access (`getUserMedia`) in modern browsers **requires HTTPS**. Let's Encrypt provides free, auto-renewing SSL certificates.

### 6.1 Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 6.2 Obtain and Install SSL Certificate
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Follow the interactive prompts:
1. Enter your email for urgent renewal notices.
2. Agree to the Terms of Service.
3. Certbot will automatically configure SSL inside your Nginx configuration and reload the service.

### 6.3 Verify Automatic Renewal
```bash
sudo certbot renew --dry-run
```

---

## 7. Firewall Configuration (UFW)

Ensure SSH, HTTP, and HTTPS ports are open:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

---

## 8. Verifying Your Production Deployment

1. **Visit your website**: Open `https://yourdomain.com` in your browser.
2. **Admin Portal**:
   - Navigate to `https://yourdomain.com/admin`.
   - Log in using your secure `ADMIN_PASSWORD` defined in `.env`.
3. **Private Customer Rooms**:
   - Go to the **Customer Rooms** tab.
   - Set link validity (e.g. 2 hours or up to 24 hours) and participant capacity.
   - Click **Generate Private Room Link**.
   - Notice that the generated Guest Link (`https://yourdomain.com/room/pv-xxxxxx`) and Admin Host Link (`https://yourdomain.com/room/pv-xxxxxx?adminKey=adm-xxxxxx`) use your custom domain.
4. **Broadcast Studio**:
   - Click **Start Live Broadcast** to stream with WebRTC.
   - Visitors on `https://yourdomain.com/join` can watch with sub-second latency.
5. **Audience Inspector**:
   - View connected attendees with IP and browser-verified geographic coordinates.

---

## 9. Updating & Maintenance

When you release code changes or pull updates:
```bash
cd /var/www/kalavritti-meet
git pull origin main
npm install
npm run build
pm2 restart kalavritti-meet
```

---

## 10. Troubleshooting

- **502 Bad Gateway**: The Node.js server isn't running. Check with `pm2 status` and `pm2 logs kalavritti-meet`.
- **WebSocket connection failed**: Check that your Nginx config contains `proxy_set_header Upgrade $http_upgrade;` and `proxy_set_header Connection $connection_upgrade;`.
- **Camera/Mic not working**: Ensure you are visiting via `https://` (not `http://`), as browsers restrict media devices to secure origins.
- **Admin Password Reset**: Update `ADMIN_PASSWORD` in `/var/www/kalavritti-meet/.env` and run `pm2 restart kalavritti-meet`.
