# Kalavritti Meet — Production Subdomain VPS Deployment Guide (1GB RAM Optimized)

This guide provides step-by-step instructions for deploying **Kalavritti Meet** on a **1 GB RAM VPS** (Ubuntu 22.04 / 24.04 or Debian) using a **subdomain** such as:
**`meet.yourdomain.in`** (or `meet.yourdomain.com`).

It includes:
- **1GB VPS Memory Optimization**: Swap memory setup (preventing out-of-memory killed processes during `npm install` and `npm run build`), Node memory flags, and lightweight PM2 configuration.
- **Subdomain DNS Setup**: Directing `meet.yourdomain.in` to your VPS IP without disturbing your primary root website or store.
- **Nginx Reverse Proxy**: Full WebSocket (`Upgrade`) proxying for WebRTC live video and private customer rooms on the subdomain.
- **Free Automated SSL**: Let's Encrypt SSL/TLS via Certbot exclusively for `meet.yourdomain.in`.

---

## 1. Subdomain DNS Setup

You do **not** need to touch your main domain (`@`) records if your main site is elsewhere. You only configure an **A Record** for the `meet` subdomain.

1. Log into your DNS manager (Cloudflare, GoDaddy, Hostinger, Namecheap, BigRock, etc.).
2. Navigate to **DNS Records** for `yourdomain.in`.
3. Add an **A Record**:

| Type | Name / Host | IPv4 Value / Points to | TTL |
| :--- | :--- | :--- | :--- |
| **A** | `meet` | `YOUR_VPS_PUBLIC_IP` | Auto / 300 seconds |

> **Result**: After propagation, visiting `http://meet.yourdomain.in` will reach your VPS server.
> *(If using Cloudflare, make sure the proxy status is **DNS Only (Grey Cloud)** during initial Certbot SSL setup, or ensure WebSockets are enabled in Network settings).*

---

## 2. Server Preparation & 1GB RAM Optimization

A 1 GB RAM VPS requires a swap file so that npm builds (`vite build` and TypeScript compile) run smoothly without getting killed by Linux's Out-Of-Memory (OOM) killer.

### 2.1 Connect to your VPS
```bash
ssh root@YOUR_VPS_PUBLIC_IP
```

### 2.2 Configure 2 GB Swap File (CRITICAL FOR 1GB RAM VPS)
Run these commands to add 2 GB of virtual swap memory:
```bash
# Check if swap exists
sudo swapon --show

# Create 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make swap permanent across reboots
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimize swap aggressiveness for 1GB VPS
sudo sysctl vm.swappiness=20
echo 'vm.swappiness=20' | sudo tee -a /etc/sysctl.conf
```

### 2.3 Update Packages
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw build-essential
```

### 2.4 Install Node.js (v20 LTS) & PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify versions
node -v   # v20.x.x
npm -v    # v10.x.x

# Install PM2 process manager
sudo npm install -g pm2
```

---

## 3. Clone and Build the Application

### 3.1 Setup Project Directory
```bash
sudo mkdir -p /var/www/kalavritti-meet
sudo chown -R $USER:$USER /var/www/kalavritti-meet
cd /var/www/kalavritti-meet

# Clone your project files
git clone <YOUR_GIT_REPO_URL> .
```

### 3.2 Configure `.env` for Subdomain
```bash
cp .env.example .env
nano .env
```

Enter your subdomain and production settings:
```env
# Full Subdomain URL (No trailing slash)
APP_URL="https://meet.yourdomain.in"

# Secure administrator password for https://meet.yourdomain.in/admin
ADMIN_PASSWORD="YourStrongSecretAdminPassword123"

# Strong JWT Secret for session tokens
JWT_SECRET="EnterRandomSecretString_X98a72b10f543"

# Port & Node Environment
NODE_ENV="production"
PORT=3000
```
Save and exit in `nano`: Press `Ctrl + O`, `Enter`, then `Ctrl + X`.

### 3.3 Build on 1GB VPS (Memory-Safe Mode)
Run the install and build with Node's memory ceiling adjusted for a 1GB environment:
```bash
# Install dependencies
npm install

# Build client and server bundle with memory limit
NODE_OPTIONS="--max-old-space-size=768" npm run build
```
This compiles the production assets into `dist/` and the server into `dist/server.cjs`.

---

## 4. Run Application with PM2 (Memory-Capped)

Configure PM2 with a memory restart limit so it stays light on your 1GB VPS:
```bash
# Start server with 400MB memory limit
pm2 start dist/server.cjs --name "kalavritti-meet" --max-memory-restart 400M --time

# Save PM2 state for automatic restart on server reboot
pm2 startup
# (Copy and run the sudo env PATH=... command printed by PM2)
pm2 save
```

Useful PM2 status commands:
```bash
pm2 status                  # Check memory & CPU usage
pm2 logs kalavritti-meet    # View real-time logs
pm2 restart kalavritti-meet # Restart server
```

---

## 5. Configure Nginx Reverse Proxy for Subdomain

### 5.1 Install Nginx
```bash
sudo apt install -y nginx
```

### 5.2 Create Subdomain Configuration Block
```bash
sudo nano /etc/nginx/sites-available/meet.yourdomain.in
```

Paste the following Nginx configuration (replace `meet.yourdomain.in` with your exact subdomain):
```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name meet.yourdomain.in;

    # Maximum upload for KYC snapshots
    client_max_body_size 25M;

    # Optimize for 1GB VPS
    keepalive_timeout 65;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket support (Required for WebRTC signaling and rooms)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        # Domain and proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        # WebSocket streaming timeouts
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 60s;
        proxy_buffering off;
    }
}
```

### 5.3 Enable Site & Test Nginx
```bash
# Enable the subdomain config
sudo ln -s /etc/nginx/sites-available/meet.yourdomain.in /etc/nginx/sites-enabled/

# Remove default Nginx site if present
sudo rm -f /etc/nginx/sites-enabled/default

# Check syntax
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## 6. Install Free SSL Certificate (HTTPS) for Subdomain

WebRTC camera and microphone permissions (`getUserMedia`) are **blocked by web browsers on insecure HTTP**. An SSL certificate on your subdomain is mandatory.

### 6.1 Install Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 6.2 Generate Certificate for Subdomain
```bash
sudo certbot --nginx -d meet.yourdomain.in
```
- Provide your email address for renewal notices.
- Agree to the Terms of Service.
- Certbot will automatically modify your Nginx block to redirect `http://meet.yourdomain.in` to `https://meet.yourdomain.in` and install the SSL certificate.

### 6.3 Verify Auto-Renewal
Certbot automatically installs a renewal timer. Verify with:
```bash
sudo certbot renew --dry-run
```

---

## 7. Firewall (UFW) Security

Ensure only the necessary ports are opened:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
```

---

## 8. Verifying Your Subdomain Deployment

1. **Public Video Portal**:
   - Open **`https://meet.yourdomain.in`** in your browser.
   - You should see the secure padlock icon in the address bar.
2. **Admin Management**:
   - Access the admin portal at **`https://meet.yourdomain.in/admin`**.
   - Enter your `ADMIN_PASSWORD` from `.env`.
3. **Private Customer Rooms**:
   - Click on the **Customer Rooms** tab.
   - Configure duration (e.g. 1 hour up to 24 hours) and participant capacity.
   - Click **Generate Private Room Link**.
   - The generated guest link will be **`https://meet.yourdomain.in/room/pv-xxxxxx`**.
   - The admin host link with management superpowers will be **`https://meet.yourdomain.in/room/pv-xxxxxx?adminKey=adm-xxxxxx`**.
4. **Live Broadcast Studio**:
   - From the Admin console, start the live broadcast camera.
   - Open `https://meet.yourdomain.in/join` on a phone or another device to verify sub-second WebRTC streaming.
5. **Audience Inspector**:
   - View connected attendees, their IP address, and browser geolocation in real time.

---

## 9. 1GB VPS Maintenance & Code Updates

Whenever you make updates to the application:

```bash
cd /var/www/kalavritti-meet
git pull origin main

# Build using swap-friendly memory limit
NODE_OPTIONS="--max-old-space-size=768" npm run build

# Restart PM2 app
pm2 restart kalavritti-meet
```

### Monitor Memory Usage Anytime
```bash
# View RAM and Swap usage
free -h

# View PM2 memory footprint
pm2 status
```
On idle, Kalavritti Meet will comfortably run using ~80MB–140MB of RAM, leaving plenty of headroom on your 1GB VPS.
