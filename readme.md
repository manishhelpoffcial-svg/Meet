# Kalavritti Meet — Production Subdomain VPS Deployment Guide (1GB RAM Optimized)

Target Subdomain: **`meet.kalavritti.in`** (or your custom subdomain)  
Target Server: **1 GB RAM Ubuntu/Debian VPS** (IP: e.g. `137.23.50.29`)

---

## ⚡ QUICK FIX: If Certbot says "Timeout during connect (likely firewall problem)"

If you encountered:
```text
Detail: 137.23.50.29: Fetching http://meet.kalavritti.in/.well-known/acme-challenge/...: Timeout during connect (likely firewall problem)
```

This error happens for one of two reasons:
1. **The VPS firewall (UFW) or Cloud provider firewall (Security Group) is blocking Port 80 & 443.** Let's Encrypt **MUST** be able to reach Port 80 over plain HTTP to verify ownership before issuing the SSL certificate!
2. **Cloudflare Proxy (Orange Cloud) is enabled.** Cloudflare's proxy will block direct ACME verification requests.

### Immediate 3-Minute Fix:

#### Step 1: Open Ports 80 and 443 on your VPS
Run this directly on your VPS terminal:
```bash
# Allow HTTP (Port 80), HTTPS (Port 443), and SSH (Port 22)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw reload
```

#### Step 2: Check Cloud Provider Firewall (Crucial!)
If your VPS is on **AWS EC2, Oracle Cloud, DigitalOcean, Hetzner Cloud, Hostinger, Google Cloud, or Azure**, there is an **external firewall** in your web dashboard:
- Go to your VPS cloud dashboard -> **Security Groups / Firewall / Networking**.
- Ensure **Inbound Rules** include:
  - **Port 80 (HTTP)**: Source `0.0.0.0/0` (Anywhere)
  - **Port 443 (HTTPS)**: Source `0.0.0.0/0` (Anywhere)
  - **Port 22 (SSH)**: Source `0.0.0.0/0` (or your IP)

#### Step 3: If Using Cloudflare, Switch to "DNS Only" (Grey Cloud)
- Go to your Cloudflare Dashboard -> **DNS**.
- Find the `A` record for `meet`.
- Change Proxy status from **Proxied (Orange Cloud)** to **DNS only (Grey Cloud)**.
- Wait 60 seconds.

#### Step 4: Ensure Nginx is running and listening on port 80
```bash
sudo systemctl restart nginx
sudo systemctl status nginx
```

#### Step 5: Re-run Certbot
```bash
sudo certbot --nginx -d meet.kalavritti.in
```
It will now authenticate immediately and issue your SSL certificate!

---

## Complete Step-by-Step Deployment Guide

---

### 1. Subdomain DNS Setup

In your domain registrar / DNS provider:

| Type | Name / Host | Points to (IPv4) | Proxy Status (Cloudflare) | TTL |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `meet` | `137.23.50.29` | **DNS Only (Grey Cloud)** | Auto / 300s |

> Verify with `ping meet.kalavritti.in` on your computer. It should resolve to your VPS IP (`137.23.50.29`).

---

### 2. Server Preparation & 1GB RAM Optimization

A 1 GB RAM VPS needs virtual swap memory so that `npm install` and Vite build never trigger the Linux Out-Of-Memory (OOM) killer.

#### 2.1 Connect to your VPS
```bash
ssh root@137.23.50.29
```

#### 2.2 Configure 2 GB Swap File
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo sysctl vm.swappiness=20
echo 'vm.swappiness=20' | sudo tee -a /etc/sysctl.conf
```

#### 2.3 Open Firewall Ports First (Prevents Certbot Timeout)
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw build-essential nginx certbot python3-certbot-nginx

# Open required ports
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

#### 2.4 Install Node.js (v20 LTS) & PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

---

### 3. Clone and Build the Application

#### 3.1 Project Directory
```bash
sudo mkdir -p /var/www/kalavritti-meet
sudo chown -R $USER:$USER /var/www/kalavritti-meet
cd /var/www/kalavritti-meet

# Clone your repository files
git clone <YOUR_GIT_REPO_URL> .
```

#### 3.2 Environment Variables (`.env`)
```bash
cp .env.example .env
nano .env
```

Set:
```env
APP_URL="https://meet.kalavritti.in"
ADMIN_PASSWORD="YourStrongAdminPasswordHere"
JWT_SECRET="YourLongRandomJwtSecretString998811"
NODE_ENV="production"
PORT=3000
```
Save with `Ctrl + O`, `Enter`, and exit with `Ctrl + X`.

#### 3.3 Build with Memory Ceiling for 1GB VPS
```bash
npm install
NODE_OPTIONS="--max-old-space-size=768" npm run build
```

---

### 4. Start the Application with PM2

```bash
# Start background server capped at 400MB
pm2 start dist/server.cjs --name "kalavritti-meet" --max-memory-restart 400M --time

# Enable auto-start on server reboot
pm2 startup
# (Run the generated sudo env PATH=... command printed on screen)
pm2 save
```

---

### 5. Configure Nginx Reverse Proxy for `meet.kalavritti.in`

Create the Nginx configuration file:
```bash
sudo nano /etc/nginx/sites-available/meet.kalavritti.in
```

Paste the following:
```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}

server {
    listen 80;
    listen [::]:80;
    server_name meet.kalavritti.in;

    client_max_body_size 25M;
    keepalive_timeout 65;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WebSocket support for WebRTC signaling
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
        proxy_connect_timeout 60s;
        proxy_buffering off;
    }
}
```

Enable the configuration and reload Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/meet.kalavritti.in /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

---

### 6. Issue SSL Certificate (Certbot)

Now that Port 80 is open in UFW and your Cloud firewall, run:
```bash
sudo certbot --nginx -d meet.kalavritti.in
```

Certbot will automatically:
1. Contact Let's Encrypt over Port 80 via `meet.kalavritti.in`.
2. Validate domain ownership.
3. Configure SSL certificates (`/etc/letsencrypt/live/meet.kalavritti.in/`).
4. Automatically redirect all `http://` traffic to `https://meet.kalavritti.in`.

---

### 8. Admin Password (.env) & PM2 Restart

If you changed `ADMIN_PASSWORD` in `/var/www/kalavritti-meet/.env`, you must rebuild/restart PM2 so Node reloads the environment:

```bash
# 1. Edit .env
nano /var/www/kalavritti-meet/.env

# Example:
# ADMIN_PASSWORD="your_new_password"

# 2. Restart PM2 with --update-env to flush old memory variables
pm2 restart kalavritti-meet --update-env

# 3. Verify server is running
pm2 logs kalavritti-meet --lines 10
```

> **Built-in Fallbacks**: 
> - If `ADMIN_PASSWORD` is not set or empty, the server accepts `admin` or `kalavritti_admin`.
> - Any surrounding quotes (`"..."` or `'...'`) and leading/trailing whitespace in `.env` are automatically trimmed by the server.

